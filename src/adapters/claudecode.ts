import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { AgentAdapter } from './base.js';
import { MaterializationEngine } from '../core/materialization.js';

export class ClaudeCodeAdapter implements AgentAdapter {
  name = 'claude-code';

  async detect(scope: 'global' | 'local' = 'local'): Promise<boolean> {
    if (scope === 'local') {
      const localClaude = path.join(process.cwd(), '.claudecode');
      return await fs.access(localClaude).then(() => true).catch(() => false);
    } else {
      const globalClaude = path.join(os.homedir(), '.claude');
      return await fs.access(globalClaude).then(() => true).catch(() => false);
    }
  }

  capabilities(): string[] {
    return ['skills', 'mcp'];
  }

  async install(pluginPath: string, scope: 'global' | 'local'): Promise<void> {
    console.log(`[ClaudeCodeAdapter] Installed plugin at ${pluginPath} (${scope})`);
  }

  async uninstall(pluginName: string, scope: 'global' | 'local'): Promise<void> {
    console.log(`[ClaudeCodeAdapter] Uninstalled plugin ${pluginName} (${scope})`);
  }

  async enable(
    pluginName: string,
    version = 'latest',
    scope: 'global' | 'local' = 'local',
    options?: { copy?: boolean }
  ): Promise<void> {
    const baseDir = scope === 'local'
      ? path.join(process.cwd(), '.claudecode', 'skills')
      : path.join(os.homedir(), '.claude', 'skills');

    const result = await MaterializationEngine.materialize({
      adapterName: this.name,
      pluginName,
      version,
      scope,
      targetBaseDir: baseDir,
      copy: options?.copy,
      conversionOptions: {
        targetAdapter: 'claude-code',
        memoryFilename: 'CLAUDE.md',
        rootVarName: 'CLAUDE_PLUGIN_ROOT',
        expandMcpPaths: true,
        neutralizeTerms: false,
      },
    });

    if (result.isCopy) {
      console.log(`[ClaudeCodeAdapter] Materialized copied folder: ${result.materializedPath} (isolated edit mode)`);
    } else {
      console.log(`[ClaudeCodeAdapter] Materialized symlink: ${result.materializedPath} -> ${result.sourcePath}`);
    }
  }

  async disable(pluginName: string, scope: 'global' | 'local' = 'local'): Promise<void> {
    const baseDir = scope === 'local'
      ? path.join(process.cwd(), '.claudecode', 'skills')
      : path.join(os.homedir(), '.claude', 'skills');

    const removed = await MaterializationEngine.dematerialize({
      pluginName,
      targetBaseDirs: [baseDir],
    });

    for (const remPath of removed) {
      console.log(`[ClaudeCodeAdapter] Removed symlink: ${remPath}`);
    }

    if (removed.length === 0) {
      console.log(`[ClaudeCodeAdapter] No active symlink found for ${pluginName} at ${path.join(baseDir, pluginName)}`);
    }
  }
}
