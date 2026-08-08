import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import type { AgentAdapter } from './base.js';
import { MaterializationEngine } from '../core/materialization.js';
import { GlobalStore } from '../core/store.js';

export class CodexAdapter implements AgentAdapter {
  name = 'codex';

  async detect(scope: 'global' | 'local' = 'local'): Promise<boolean> {
    if (scope === 'local') {
      const localCodex = path.join(process.cwd(), '.codex');
      const localPlugin = path.join(process.cwd(), '.codex-plugin');
      const localMarketplace = path.join(process.cwd(), '.agents', 'plugins', 'marketplace.json');
      const hasCodex = await fs.access(localCodex).then(() => true).catch(() => false);
      const hasPlugin = await fs.access(localPlugin).then(() => true).catch(() => false);
      const hasMarketplace = await fs.access(localMarketplace).then(() => true).catch(() => false);
      return hasCodex || hasPlugin || hasMarketplace;
    } else {
      const globalCodex = path.join(os.homedir(), '.codex');
      return await fs.access(globalCodex).then(() => true).catch(() => false);
    }
  }

  capabilities(): string[] {
    return ['skills', 'rules', 'mcp', 'agents', 'hooks'];
  }

  supportsDirectSymlink(): boolean {
    return true;
  }

  async install(pluginPath: string, scope: 'global' | 'local'): Promise<void> {
    console.log(`[CodexAdapter] Installed plugin at ${pluginPath} (${scope})`);
  }

  async uninstall(pluginName: string, scope: 'global' | 'local'): Promise<void> {
    console.log(`[CodexAdapter] Uninstalled plugin ${pluginName} (${scope})`);
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
    return path.join(process.cwd(), '.codex', 'skills', pluginName);
  }

  async enable(
    pluginName: string,
    scope: 'global' | 'local' = 'local',
    options?: { copy?: boolean | undefined; version?: string | undefined }
  ): Promise<void> {
    let sourcePath: string | undefined;
    let version = options?.version;

    const baseDir = scope === 'local'
      ? path.join(process.cwd(), '.codex', 'skills')
      : path.join(os.homedir(), '.codex', 'skills');

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
      conversionOptions: {
        targetAdapter: 'codex',
        memoryFilename: 'AGENTS.md',
        rootVarName: 'PLUGIN_ROOT',
        expandMcpPaths: true,
        neutralizeTerms: true,
      },
    });

    if (result.isCopy) {
      console.log(`[CodexAdapter] Materialized copied folder: ${result.materializedPath} (isolated edit mode)`);
    } else {
      console.log(`[CodexAdapter] Materialized symlink: ${result.materializedPath} -> ${result.sourcePath} (${result.adaptedFilesCount} files adapted)`);
    }
  }

  async disable(pluginName: string, scope: 'global' | 'local' = 'local'): Promise<void> {
    const skillsDir = scope === 'local'
      ? path.join(process.cwd(), '.codex', 'skills')
      : path.join(os.homedir(), '.codex', 'skills');

    const pluginsDir = scope === 'local'
      ? path.join(process.cwd(), '.codex-plugin')
      : path.join(os.homedir(), '.codex', 'plugins');

    const removed = await MaterializationEngine.dematerialize({
      pluginName,
      targetBaseDirs: [skillsDir, pluginsDir],
    });

    for (const remPath of removed) {
      console.log(`[CodexAdapter] Removed materialization link: ${remPath}`);
    }

    if (removed.length === 0) {
      console.log(`[CodexAdapter] No active materialization found for ${pluginName}`);
    }
  }
}
