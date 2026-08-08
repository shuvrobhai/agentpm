import fs from 'node:fs/promises';
import { statSync } from 'node:fs';
import path from 'node:path';
import type { PortableCoreIR, ConversionResult } from '../ir/types.js';
import { MaterializationEngine } from '../core/materialization.js';
import { GlobalStore } from '../core/store.js';

const NON_PLUGIN_DIR_NAMES = new Set([
  'cache',
  'data',
  'marketplaces',
  'commands',
  'node_modules',
  'logs',
  'state',
  'backups',
]);

const PLUGIN_MARKERS = [
  'plugin.json',
  'mcp.json',
  'opencode.json',
  'hooks.json',
  '.claude-plugin',
  '.codex-plugin',
  'skills',
  'agents',
  'commands',
  'rules',
];

export function isValidPluginEntry(
  entryName: string,
  stats: { isDirectory(): boolean; isSymbolicLink(): boolean },
  parentDir: string
): boolean {
  if (stats.isSymbolicLink()) return true;
  if (!stats.isDirectory()) return false;
  if (NON_PLUGIN_DIR_NAMES.has(entryName.toLowerCase())) return false;

  const candidateDir = path.join(parentDir, entryName);
  for (const marker of PLUGIN_MARKERS) {
    try {
      statSync(path.join(candidateDir, marker));
      return true;
    } catch {
      // marker not present, try next
    }
  }

  return false;
}

export interface ActivePluginInfo {
  agent: string;
  displayName: string;
  scope: 'local' | 'global';
  pluginName: string;
  materializedPath: string;
  targetPath?: string | undefined;
  isSymlink: boolean;
  isBroken: boolean;
}

export interface DiagnosticIssue {
  type: 'broken_symlink' | 'schema_error' | 'dangling_marketplace_entry' | 'missing_target';
  agent: string;
  scope: 'global' | 'local';
  path: string;
  target?: string;
  message: string;
}

export interface AdapterHealthReport {
  agent: string;
  displayName: string;
  totalChecks: number;
  activePlugins: ActivePluginInfo[];
  issues: DiagnosticIssue[];
  fixedIssues: string[];
}

export interface AgentAdapter {
  name: string;
  displayName?: string;
  detect(scope?: 'global' | 'local'): Promise<boolean>;
  capabilities(): string[];
  enable(
    pluginName: string,
    scope?: 'global' | 'local',
    options?: { copy?: boolean | undefined; version?: string | undefined }
  ): Promise<void>;
  disable(pluginName: string, scope?: 'global' | 'local'): Promise<void>;
  resolveVersion(pluginName: string): Promise<string>;
  getPluginDir(pluginName: string, version?: string): string;
  getLocalPluginDir(pluginName: string): string;
  convert(ir: PortableCoreIR, scope: 'workspace' | 'global'): ConversionResult;
  getMaterializationPaths(scope: 'global' | 'local', cwd?: string): string[];
  findActive(scope?: 'global' | 'local', cwd?: string): Promise<ActivePluginInfo[]>;
  checkHealth(options?: { fix?: boolean }, cwd?: string): Promise<AdapterHealthReport>;
}

export interface MaterializationContext {
  pluginName: string;
  scope: 'global' | 'local';
  version: string;
  sourcePath?: string | undefined;
  materializedPath: string;
  isCopy: boolean;
  adaptedFilesCount: number;
}

export interface DematerializationContext {
  pluginName: string;
  scope: 'global' | 'local';
  removedPaths: string[];
}

export abstract class BaseAgentAdapter implements AgentAdapter {
  abstract name: string;
  abstract displayName: string;
  abstract capabilities(): string[];
  abstract convert(ir: PortableCoreIR, scope: 'workspace' | 'global'): ConversionResult;

  /** Logging identity used in materialization messages, e.g. "ClaudeCodeAdapter". */
  protected logTag: string = 'AgentAdapter';

  /** Dirs probed for agent presence; `detect` returns true if any exists. */
  get detectProbes(): { global: string[]; local: string[] } {
    return {
      global: [this.globalPluginDir],
      local: [this.localPluginDir],
    };
  }

  abstract get globalPluginDir(): string;
  abstract get localPluginDir(): string;

  get candidateSearchDirs(): { global: string[]; local: string[] } {
    return {
      global: [this.globalPluginDir],
      local: [path.join(process.cwd(), '.agents', 'plugins')],
    };
  }

  getMaterializationPaths(scope: 'global' | 'local', cwd: string = process.cwd()): string[] {
    if (scope === 'local') {
      const localDirs = this.candidateSearchDirs.local;
      if (cwd !== process.cwd()) {
        return localDirs.map((d) => d.replace(process.cwd(), cwd));
      }
      return localDirs;
    }
    return this.candidateSearchDirs.global;
  }

  async findActive(scope: 'global' | 'local' = 'local', cwd: string = process.cwd()): Promise<ActivePluginInfo[]> {
    const dirs = this.getMaterializationPaths(scope, cwd);
    const results: ActivePluginInfo[] = [];
    const seen = new Set<string>();

    for (const dir of dirs) {
      const exists = await fs.access(dir).then(() => true).catch(() => false);
      if (!exists) continue;

      const entries = await fs.readdir(dir).catch(() => []);
      for (const entry of entries) {
        if (entry.startsWith('.')) continue;
        const itemKey = `${scope}:${entry}`;
        if (seen.has(itemKey)) continue;

        const symlinkPath = path.join(dir, entry);
        const lstat = await fs.lstat(symlinkPath).catch(() => null);
        if (!lstat) continue;
        if (!isValidPluginEntry(entry, lstat, dir)) continue;

        let targetPath: string | undefined;
        let isBroken = false;
        const isSymlink = lstat.isSymbolicLink();

        if (isSymlink) {
          try {
            targetPath = await fs.readlink(symlinkPath);
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

        seen.add(itemKey);
        results.push({
          agent: this.name,
          displayName: this.displayName || this.name,
          scope,
          pluginName: entry,
          materializedPath: symlinkPath,
          targetPath,
          isSymlink,
          isBroken,
        });
      }
    }

    return results;
  }

  async checkHealth(options?: { fix?: boolean }, cwd: string = process.cwd()): Promise<AdapterHealthReport> {
    const issues: DiagnosticIssue[] = [];
    const fixedIssues: string[] = [];
    const activePlugins: ActivePluginInfo[] = [];
    let totalChecks = 0;

    for (const scope of ['local', 'global'] as const) {
      const active = await this.findActive(scope, cwd);
      activePlugins.push(...active);

      for (const item of active) {
        totalChecks++;
        if (item.isBroken && item.isSymlink) {
          issues.push({
            type: 'broken_symlink',
            agent: this.name,
            scope,
            path: item.materializedPath,
            ...(item.targetPath !== undefined ? { target: item.targetPath } : {}),
            message: `Broken symlink points to non-existent target: ${item.targetPath}`,
          });

          if (options?.fix) {
            try {
              await fs.unlink(item.materializedPath);
              fixedIssues.push(`[${this.displayName || this.name}] Removed broken symlink: ${item.materializedPath}`);
            } catch (err: any) {
              fixedIssues.push(`[${this.displayName || this.name}] Failed to remove ${item.materializedPath}: ${err.message}`);
            }
          }
        }
      }
    }

    return {
      agent: this.name,
      displayName: this.displayName || this.name,
      totalChecks,
      activePlugins,
      issues,
      fixedIssues,
    };
  }

  async detect(scope: 'global' | 'local' = 'local'): Promise<boolean> {
    const probes = scope === 'local' ? this.detectProbes.local : this.detectProbes.global;
    for (const probe of probes) {
      const exists = await fs.access(probe).then(() => true).catch(() => false);
      if (exists) return true;
    }
    return false;
  }

  async resolveVersion(pluginName: string): Promise<string> {
    try {
      const pluginPath = await GlobalStore.findPluginPath(pluginName);
      return path.basename(pluginPath);
    } catch {
      return 'latest';
    }
  }

  getPluginDir(pluginName: string, version = 'latest'): string {
    return GlobalStore.getAdaptedPluginPath(this.name, 'adapted', pluginName, version);
  }

  getLocalPluginDir(pluginName: string): string {
    return path.join(process.cwd(), '.agents', 'plugins', pluginName);
  }

  async enable(
    pluginName: string,
    scope: 'global' | 'local' = 'local',
    options?: { copy?: boolean | undefined; version?: string | undefined }
  ): Promise<void> {
    let sourcePath: string | undefined;
    let version = options?.version;

    const baseDir = scope === 'local'
      ? path.join(process.cwd(), '.agents', 'plugins')
      : this.globalPluginDir;

    if (scope === 'local' && !options?.version) {
      const localWorkspacePath = this.getLocalPluginDir(pluginName);
      const localExists = await fs.access(localWorkspacePath).then(() => true).catch(() => false);
      if (localExists) {
        sourcePath = localWorkspacePath;
        version = 'workspace';
      }
    }

    if (!sourcePath) {
      version = version || (await this.resolveVersion(pluginName));
    }

    const result = await MaterializationEngine.materialize({
      adapterName: this.name,
      pluginName,
      version,
      sourcePath,
      scope,
      targetBaseDir: baseDir,
      copy: options?.copy,
    });

    const adapterTag = this.logTag;

    if (result.isCopy) {
      console.log(`[${adapterTag}] Materialized copied folder: ${result.materializedPath} (isolated edit mode)`);
    } else {
      const countSuffix = result.adaptedFilesCount > 0 ? ` (${result.adaptedFilesCount} files adapted)` : '';
      console.log(`[${adapterTag}] Materialized symlink: ${result.materializedPath} -> ${result.sourcePath}${countSuffix}`);
    }

    const resolvedVer = version || 'latest';

    await this.onAfterEnable({
      pluginName,
      scope,
      version: resolvedVer,
      sourcePath,
      materializedPath: result.materializedPath,
      isCopy: result.isCopy,
      adaptedFilesCount: result.adaptedFilesCount,
    });
  }

  async disable(pluginName: string, scope: 'global' | 'local' = 'local'): Promise<void> {
    const targetDirs = scope === 'local'
      ? this.candidateSearchDirs.local
      : this.candidateSearchDirs.global;

    const removed = await MaterializationEngine.dematerialize({
      pluginName,
      targetBaseDirs: targetDirs,
    });

    const adapterTag = this.logTag;

    for (const remPath of removed) {
      console.log(`[${adapterTag}] Removed materialization link: ${remPath}`);
    }

    if (removed.length === 0) {
      console.log(`[${adapterTag}] No active materialization found for ${pluginName}`);
    }

    await this.onAfterDisable({
      pluginName,
      scope,
      removedPaths: removed,
    });
  }

  protected async onAfterEnable(_context: MaterializationContext): Promise<void> {}
  protected async onAfterDisable(_context: DematerializationContext): Promise<void> {}
}

