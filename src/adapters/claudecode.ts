import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { AgentAdapter } from './base.js';
import { GlobalStore } from '../core/store.js';

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
    const sourcePath = await GlobalStore.findPluginPath(pluginName, version);
    const baseDir = scope === 'local'
      ? path.join(process.cwd(), '.claudecode', 'skills')
      : path.join(os.homedir(), '.claude', 'skills');

    await GlobalStore.ensureDir(baseDir);

    const lastSegment = path.basename(sourcePath);
    const isVersionSegment = ['latest', 'main', 'master', 'head'].includes(lastSegment.toLowerCase()) || /^v?\d+/.test(lastSegment);

    const pluginDirName = isVersionSegment
      ? path.basename(path.dirname(sourcePath))
      : lastSegment;

    const linkPath = path.join(baseDir, pluginDirName);

    const exists = await fs.lstat(linkPath).then(() => true).catch(() => false);
    if (exists) {
      await fs.rm(linkPath, { recursive: true, force: true });
    }

    if (options?.copy) {
      await GlobalStore.copyDirectoryDereferenced(sourcePath, linkPath);
      console.log(`[ClaudeCodeAdapter] Materialized copied folder: ${linkPath} (isolated edit mode)`);
    } else {
      await fs.symlink(sourcePath, linkPath, 'dir');
      console.log(`[ClaudeCodeAdapter] Materialized symlink: ${linkPath} -> ${sourcePath}`);
    }
  }

  async disable(pluginName: string, scope: 'global' | 'local' = 'local'): Promise<void> {
    const baseDir = scope === 'local'
      ? path.join(process.cwd(), '.claudecode', 'skills')
      : path.join(os.homedir(), '.claude', 'skills');

    const linkPath = path.join(baseDir, pluginName);
    const exists = await fs.lstat(linkPath).then(() => true).catch(() => false);

    if (exists) {
      await fs.rm(linkPath, { recursive: true, force: true });
      console.log(`[ClaudeCodeAdapter] Removed symlink: ${linkPath}`);
    } else {
      console.log(`[ClaudeCodeAdapter] No active symlink found for ${pluginName} at ${linkPath}`);
    }
  }
}
