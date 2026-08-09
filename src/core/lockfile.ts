import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { findWorkspaceRoot } from './config.js';

export interface MaterializedFile {
  path: string;
  type: 'skill' | 'agent' | 'rule' | 'mcp' | 'hook' | 'workflow' | 'context' | 'other';
  managed: boolean;
  hash?: string;
}

export interface AgentSyncState {
  syncedAt: string;
  adapterVersion: string;
  files: MaterializedFile[];
}

export interface PluginInstallState {
  version: string;
  source: string;
  hash: string;
  installedAt: string;
  agents: Record<string, AgentSyncState>;
}

export interface LockfileSchema {
  version: number;
  installs: Record<string, PluginInstallState>;
}

export interface FileDriftIssue {
  pluginName: string;
  agent: string;
  filePath: string;
  type: 'missing' | 'modified' | 'orphaned';
  message: string;
}

export interface DriftReport {
  timestamp: string;
  hasDrift: boolean;
  issues: FileDriftIssue[];
}

const LOCKFILE_VERSION = 1;
const ADAPTER_CURRENT_VERSION = '2026.08.01';

export class LockfileEngine {
  static getLockfilePath(workspaceRoot: string = findWorkspaceRoot()): string {
    return path.join(workspaceRoot, '.agentpm.lock');
  }

  static async readLockfile(workspaceRoot: string = findWorkspaceRoot()): Promise<LockfileSchema> {
    const lockPath = this.getLockfilePath(workspaceRoot);
    try {
      const raw = await fs.readFile(lockPath, 'utf-8');
      const parsed = JSON.parse(raw) as LockfileSchema;
      if (parsed && typeof parsed === 'object' && parsed.version === LOCKFILE_VERSION) {
        return parsed;
      }
    } catch {
      // Lockfile does not exist or is invalid
    }
    return { version: LOCKFILE_VERSION, installs: {} };
  }

  static async writeLockfile(lockfile: LockfileSchema, workspaceRoot: string = findWorkspaceRoot()): Promise<void> {
    const lockPath = this.getLockfilePath(workspaceRoot);
    const content = JSON.stringify(lockfile, null, 2);
    await fs.writeFile(lockPath, content, 'utf-8');
  }

  static async computeFileHash(filePath: string): Promise<string | undefined> {
    try {
      const stat = await fs.lstat(filePath);
      if (stat.isSymbolicLink()) {
        const target = await fs.readlink(filePath);
        return `symlink:${crypto.createHash('sha256').update(target).digest('hex').slice(0, 16)}`;
      }
      if (stat.isFile()) {
        const content = await fs.readFile(filePath);
        return `sha256:${crypto.createHash('sha256').update(content).digest('hex').slice(0, 16)}`;
      }
    } catch {
      // File missing or inaccessible
    }
    return undefined;
  }

  static async recordMaterialization(params: {
    pluginName: string;
    source: string;
    version: string;
    hash?: string;
    agent: string;
    files: MaterializedFile[];
    workspaceRoot?: string;
  }): Promise<void> {
    const root = params.workspaceRoot || findWorkspaceRoot();
    const lock = await this.readLockfile(root);

    const now = new Date().toISOString();
    const pluginState: PluginInstallState = lock.installs[params.pluginName] || {
      version: params.version,
      source: params.source,
      hash: params.hash || 'sha256:unknown',
      installedAt: now,
      agents: {},
    };

    pluginState.version = params.version;
    pluginState.source = params.source;
    if (params.hash) pluginState.hash = params.hash;

    // Compute hashes for materialized files
    const enrichedFiles: MaterializedFile[] = [];
    for (const f of params.files) {
      const absPath = path.isAbsolute(f.path) ? f.path : path.join(root, f.path);
      const relPath = path.relative(root, absPath);
      const hash = await this.computeFileHash(absPath);
      enrichedFiles.push({
        ...f,
        path: relPath,
        ...(hash ? { hash } : {}),
      });
    }

    pluginState.agents[params.agent] = {
      syncedAt: now,
      adapterVersion: ADAPTER_CURRENT_VERSION,
      files: enrichedFiles,
    };

    lock.installs[params.pluginName] = pluginState;
    await this.writeLockfile(lock, root);
  }

  static async removeMaterialization(
    pluginName: string,
    agent?: string,
    workspaceRoot: string = findWorkspaceRoot()
  ): Promise<string[]> {
    const lock = await this.readLockfile(workspaceRoot);
    const installState = lock.installs[pluginName];
    if (!installState) return [];

    const deletedPaths: string[] = [];

    const targetAgents = agent ? [agent] : Object.keys(installState.agents);

    for (const targetAgent of targetAgents) {
      const syncState = installState.agents[targetAgent];
      if (!syncState) continue;

      for (const file of syncState.files) {
        const absPath = path.join(workspaceRoot, file.path);
        const exists = await fs.lstat(absPath).then(() => true).catch(() => false);
        if (exists) {
          await fs.rm(absPath, { recursive: true, force: true });
          deletedPaths.push(absPath);
        }
      }

      delete installState.agents[targetAgent];
    }

    if (Object.keys(installState.agents).length === 0) {
      delete lock.installs[pluginName];
    } else {
      lock.installs[pluginName] = installState;
    }

    await this.writeLockfile(lock, workspaceRoot);
    return deletedPaths;
  }

  static async detectDrift(workspaceRoot: string = findWorkspaceRoot()): Promise<DriftReport> {
    const lock = await this.readLockfile(workspaceRoot);
    const issues: FileDriftIssue[] = [];

    for (const [pluginName, installState] of Object.entries(lock.installs)) {
      for (const [agent, syncState] of Object.entries(installState.agents)) {
        for (const file of syncState.files) {
          const absPath = path.join(workspaceRoot, file.path);
          const currentHash = await this.computeFileHash(absPath);

          if (!currentHash) {
            issues.push({
              pluginName,
              agent,
              filePath: file.path,
              type: 'missing',
              message: `Tracked file missing: ${file.path}`,
            });
          } else if (file.hash && file.hash !== currentHash) {
            issues.push({
              pluginName,
              agent,
              filePath: file.path,
              type: 'modified',
              message: `Tracked file content modified: ${file.path} (${file.hash} -> ${currentHash})`,
            });
          }
        }
      }
    }

    return {
      timestamp: new Date().toISOString(),
      hasDrift: issues.length > 0,
      issues,
    };
  }
}
