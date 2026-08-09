import fs from 'node:fs/promises';
import path from 'node:path';
import { GlobalStore } from './store.js';
import { parsePlugin } from '../parser/index.js';
import { toPortableCore } from '../ir/to-portable-core.js';
import { LockfileEngine, type MaterializedFile } from './lockfile.js';
import { findWorkspaceRoot } from './config.js';

export interface MaterializationOptions {
  adapterName: string;
  pluginName: string;
  version?: string | undefined;
  sourcePath?: string | undefined;
  scope: 'global' | 'local';
  targetBaseDir: string;
  copy?: boolean | undefined;
}

export interface MaterializationResult {
  pluginDirName: string;
  materializedPath: string;
  sourcePath: string;
  isCopy: boolean;
  adaptedFilesCount: number;
}

export interface DematerializationOptions {
  pluginName: string;
  targetBaseDirs: string[];
  agentName?: string | undefined;
  workspaceRoot?: string | undefined;
}

export class MaterializationEngine {
  static async materialize(options: MaterializationOptions): Promise<MaterializationResult> {
    const version = options.version || 'latest';
    const rawSourcePath = options.sourcePath || (await GlobalStore.findPluginPath(options.pluginName, version));

    let namespace = 'local';
    let pluginDirName = options.pluginName;

    if (options.pluginName.includes('/')) {
      const parts = options.pluginName.split('/');
      namespace = parts[0] || 'local';
      pluginDirName = parts[1] || options.pluginName;
    } else {
      const storeRoot = GlobalStore.getStorePath();
      const resolvedRaw = path.resolve(rawSourcePath);
      if (resolvedRaw.startsWith(path.resolve(storeRoot))) {
        const rel = path.relative(storeRoot, resolvedRaw);
        const segments = rel.split(path.sep).filter(Boolean);
        if (segments.length >= 3) {
          if (segments.length >= 4) {
            namespace = segments[1] || 'default';
            pluginDirName = segments[2] || options.pluginName;
          } else {
            namespace = segments[0] || 'default';
            pluginDirName = segments[1] || options.pluginName;
          }
        }
      } else {
        namespace = 'local';
        const last = path.basename(rawSourcePath);
        pluginDirName = last && !last.startsWith('.') ? last : options.pluginName;
      }
    }

    if (namespace.startsWith('.')) {
      namespace = 'local';
    }
    if (pluginDirName.startsWith('.')) {
      pluginDirName = options.pluginName;
    }

    const adaptedDir = GlobalStore.getAdaptedPluginPath(
      options.adapterName,
      namespace,
      pluginDirName,
      version
    );

    const adaptedFilesCount = await this.adaptToNative(rawSourcePath, adaptedDir, options.adapterName);

    const targetSourcePath = options.sourcePath || (adaptedFilesCount > 0 ? adaptedDir : rawSourcePath);
    const linkPath = path.join(options.targetBaseDir, pluginDirName);

    if (path.resolve(targetSourcePath) !== path.resolve(linkPath)) {
      const exists = await fs.lstat(linkPath).then(() => true).catch(() => false);
      if (exists) {
        await fs.rm(linkPath, { recursive: true, force: true });
      }

      if (options.copy) {
        await GlobalStore.copyDirectoryDereferenced(targetSourcePath, linkPath);
      } else {
        await fs.symlink(targetSourcePath, linkPath, 'dir');
      }
    }

    // Record in local workspace lockfile if local scope (ADR 0021)
    if (options.scope === 'local') {
      const workspaceRoot = findWorkspaceRoot();
      const relativeLinkPath = path.relative(workspaceRoot, linkPath);
      const files: MaterializedFile[] = [
        {
          path: relativeLinkPath,
          type: 'other',
          managed: true,
        },
      ];

      await LockfileEngine.recordMaterialization({
        pluginName: options.pluginName,
        source: rawSourcePath,
        version,
        agent: options.adapterName,
        files,
        workspaceRoot,
      });
    }

    return {
      pluginDirName,
      materializedPath: linkPath,
      sourcePath: targetSourcePath,
      isCopy: !!options.copy,
      adaptedFilesCount,
    };
  }

  /**
   * Derive a native layout from the portable core (ADR 0013 Q8/Q11). Parses the
   * stored package, narrows to PortableCoreIR, and runs the per-agent emitter.
   */
  private static async adaptToNative(
    sourceDir: string,
    adaptedDir: string,
    adapterName: string,
  ): Promise<number> {
    const { getAdapter } = await import('../adapters/index.js');
    const adapter = getAdapter(adapterName);

    const ir = await parsePlugin(sourceDir);
    const result = adapter.convert(toPortableCore(ir), 'workspace');

    if (result.files.length === 0) {
      return 0;
    }

    await fs.mkdir(adaptedDir, { recursive: true });
    await GlobalStore.copyDirectoryDereferenced(sourceDir, adaptedDir);

    for (const file of result.files) {
      const filePath = path.join(adaptedDir, file.relativePath);
      await fs.mkdir(path.dirname(filePath), { recursive: true });
      await fs.writeFile(filePath, file.content, 'utf-8');
    }

    return result.files.length;
  }

  static async dematerialize(options: DematerializationOptions): Promise<string[]> {
    const removedPaths: string[] = [];

    for (const baseDir of options.targetBaseDirs) {
      const linkPath = path.join(baseDir, options.pluginName);
      const exists = await fs.lstat(linkPath).then(() => true).catch(() => false);
      if (exists) {
        await fs.rm(linkPath, { recursive: true, force: true });
        removedPaths.push(linkPath);
      }
    }

    // Clean up lockfile entries
    const workspaceRoot = options.workspaceRoot || findWorkspaceRoot();
    const lockfileRemoved = await LockfileEngine.removeMaterialization(
      options.pluginName,
      options.agentName,
      workspaceRoot
    );

    for (const p of lockfileRemoved) {
      if (!removedPaths.includes(p)) {
        removedPaths.push(p);
      }
    }

    return removedPaths;
  }
}
