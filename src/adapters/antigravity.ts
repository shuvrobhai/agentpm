import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { AgentAdapter } from './base.js';
import { MaterializationEngine } from '../core/materialization.js';

export class AntigravityAdapter implements AgentAdapter {
  name = 'antigravity';

  async detect(scope: 'global' | 'local' = 'local'): Promise<boolean> {
    if (scope === 'local') {
      const localAgents = path.join(process.cwd(), '.agents');
      return await fs.access(localAgents).then(() => true).catch(() => false);
    } else {
      const globalGemini = path.join(os.homedir(), '.gemini');
      return await fs.access(globalGemini).then(() => true).catch(() => false);
    }
  }

  capabilities(): string[] {
    return ['skills', 'mcp', 'hooks'];
  }

  supportsDirectSymlink(): boolean {
    return true;
  }

  async install(pluginPath: string, scope: 'global' | 'local'): Promise<void> {
    console.log(`[AntigravityAdapter] Installed plugin at ${pluginPath} (${scope})`);
  }

  async uninstall(pluginName: string, scope: 'global' | 'local'): Promise<void> {
    console.log(`[AntigravityAdapter] Uninstalled plugin ${pluginName} (${scope})`);
  }

  async enable(
    pluginName: string,
    version = 'latest',
    scope: 'global' | 'local' = 'local',
    options?: { copy?: boolean }
  ): Promise<void> {
    const baseDir = scope === 'local'
      ? path.join(process.cwd(), '.agents', 'plugins')
      : path.join(os.homedir(), '.gemini', 'config', 'plugins');

    const result = await MaterializationEngine.materialize({
      adapterName: this.name,
      pluginName,
      version,
      scope,
      targetBaseDir: baseDir,
      copy: options?.copy,
    });

    if (result.isCopy) {
      console.log(`[AntigravityAdapter] Materialized copied folder: ${result.materializedPath} (isolated edit mode)`);
    } else {
      console.log(`[AntigravityAdapter] Materialized symlink: ${result.materializedPath} -> ${result.sourcePath} (${result.adaptedFilesCount} files adapted)`);
    }
  }

  async disable(pluginName: string, scope: 'global' | 'local' = 'local'): Promise<void> {
    const pluginsDir = scope === 'local'
      ? path.join(process.cwd(), '.agents', 'plugins')
      : path.join(os.homedir(), '.gemini', 'config', 'plugins');

    const skillsDir = scope === 'local'
      ? path.join(process.cwd(), '.agents', 'skills')
      : path.join(os.homedir(), '.gemini', 'config', 'skills');

    const removed = await MaterializationEngine.dematerialize({
      pluginName,
      targetBaseDirs: [pluginsDir, skillsDir],
    });

    for (const remPath of removed) {
      console.log(`[AntigravityAdapter] Removed materialization link: ${remPath}`);
    }

    if (removed.length === 0) {
      console.log(`[AntigravityAdapter] No active materialization found for ${pluginName}`);
    }
  }
}
