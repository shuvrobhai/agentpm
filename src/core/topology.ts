import fs from 'node:fs/promises';
import path from 'node:path';
import { AdapterRegistry } from '../adapters/index.js';
import { isValidPluginEntry } from '../adapters/base.js';

export interface InstalledPluginDescriptor {
  name: string;
  provider: string;
  path: string;
  version?: string;
  description?: string;
  scope: 'global' | 'workspace';
  isSymlink: boolean;
  isBroken?: boolean;
  targetPath?: string;
}

export interface ProviderInspectionItem {
  name: string;
  type: string;
  path: string;
}

export class ProviderTopology {
  /**
   * Scans installed provider plugins across all host agents or a specific provider.
   */
  static async scanInstalled(provider?: string, cwd: string = process.cwd()): Promise<InstalledPluginDescriptor[]> {
    const allAdapters = AdapterRegistry.all();
    const targetAdapters = provider
      ? allAdapters.filter(
          (a) =>
            a.name === provider.toLowerCase() ||
            a.displayName?.toLowerCase() === provider.toLowerCase() ||
            (provider.toLowerCase() === 'claude' && a.name === 'claude-code')
        )
      : allAdapters;

    const results: InstalledPluginDescriptor[] = [];
    const seen = new Set<string>();

    for (const adapter of targetAdapters) {
      for (const scope of ['global', 'local'] as const) {
        const dirs = adapter.getMaterializationPaths(scope, cwd);
        for (const dir of dirs) {
          const exists = await fs.access(dir).then(() => true).catch(() => false);
          if (!exists) continue;

          const entries = await fs.readdir(dir).catch(() => []);
          for (const entry of entries) {
            if (entry.startsWith('.')) continue;
            const itemKey = `${adapter.name}:${scope}:${entry}`;
            if (seen.has(itemKey)) continue;

            const itemPath = path.join(dir, entry);
            const lstat = await fs.lstat(itemPath).catch(() => null);
            if (!lstat) continue;
            if (!isValidPluginEntry(entry, lstat, dir)) continue;

            let targetPath: string | undefined;
            let isBroken = false;
            const isSymlink = lstat.isSymbolicLink();

            if (isSymlink) {
              try {
                targetPath = await fs.readlink(itemPath);
                const resolvedTarget = path.isAbsolute(targetPath)
                  ? targetPath
                  : path.resolve(dir, targetPath);
                const targetExists = await fs.access(resolvedTarget).then(() => true).catch(() => false);
                if (!targetExists) {
                  isBroken = true;
                }
              } catch {
                isBroken = true;
              }
            }

            // Check versioned subdirectories (e.g. plugin/2026.7.0/.codex-plugin)
            let version: string | undefined;
            if (lstat.isDirectory() || isSymlink) {
              const subEntries = await fs.readdir(itemPath, { withFileTypes: true }).catch(() => []);
              const versionDir = subEntries.find((s) => (s.isDirectory() || s.isSymbolicLink()) && !s.name.startsWith('.'));
              if (versionDir) {
                version = versionDir.name;
              }
            }

            seen.add(itemKey);
            results.push({
              name: `${adapter.name}/${entry}${version ? `@${version}` : ''}`,
              provider: adapter.displayName || adapter.name,
              path: itemPath,
              scope: scope === 'local' ? 'workspace' : 'global',
              isSymlink,
              ...(version ? { version } : {}),
              ...(isBroken ? { isBroken } : {}),
              ...(targetPath ? { targetPath } : {}),
            });
          }
        }
      }
    }

    return results;
  }

  /**
   * Inspects provider directories on disk and returns print-ready inspection items.
   */
  static async inspectProviders(provider?: string, cwd: string = process.cwd()): Promise<ProviderInspectionItem[]> {
    const descriptors = await this.scanInstalled(provider, cwd);
    return descriptors.map((d) => ({
      name: d.name.includes('/') ? d.name.split('/')[1] || d.name : d.name,
      type: `${path.basename(path.dirname(d.path))} (${d.scope})`,
      path: d.path,
    }));
  }
}
