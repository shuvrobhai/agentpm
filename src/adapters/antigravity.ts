import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { AgentAdapter } from './base.js';
import { GlobalStore } from '../core/store.js';

export class AntigravityAdapter implements AgentAdapter {
  name = 'antigravity';

  async detect(): Promise<boolean> {
    const localAgents = path.join(process.cwd(), '.agents');
    const globalGemini = path.join(os.homedir(), '.gemini');

    const hasLocal = await fs.access(localAgents).then(() => true).catch(() => false);
    const hasGlobal = await fs.access(globalGemini).then(() => true).catch(() => false);

    return hasLocal || hasGlobal;
  }

  capabilities(): string[] {
    return ['skills', 'mcp', 'hooks'];
  }

  async install(pluginPath: string, scope: 'global' | 'local'): Promise<void> {
    console.log(`[AntigravityAdapter] Installed plugin at ${pluginPath} (${scope})`);
  }

  async uninstall(pluginName: string, scope: 'global' | 'local'): Promise<void> {
    console.log(`[AntigravityAdapter] Uninstalled plugin ${pluginName} (${scope})`);
  }

  async enable(pluginName: string, version = 'latest', scope: 'global' | 'local'): Promise<void> {
    const sourcePath = await GlobalStore.findPluginPath(pluginName, version);
    const baseDir = scope === 'local'
      ? path.join(process.cwd(), '.agents', 'skills')
      : path.join(os.homedir(), '.gemini', 'config', 'skills');

    await GlobalStore.ensureDir(baseDir);

    const pluginDirName = path.basename(sourcePath) === 'latest'
      ? path.basename(path.dirname(sourcePath))
      : path.basename(sourcePath);

    const linkPath = path.join(baseDir, pluginDirName);

    const exists = await fs.lstat(linkPath).then(() => true).catch(() => false);
    if (exists) {
      await fs.rm(linkPath, { recursive: true, force: true });
    }

    await fs.symlink(sourcePath, linkPath, 'dir');
    console.log(`[AntigravityAdapter] Materialized symlink: ${linkPath} -> ${sourcePath}`);
  }

  async disable(pluginName: string, scope: 'global' | 'local'): Promise<void> {
    const baseDir = scope === 'local'
      ? path.join(process.cwd(), '.agents', 'skills')
      : path.join(os.homedir(), '.gemini', 'config', 'skills');

    const linkPath = path.join(baseDir, pluginName);
    const exists = await fs.lstat(linkPath).then(() => true).catch(() => false);

    if (exists) {
      await fs.rm(linkPath, { recursive: true, force: true });
      console.log(`[AntigravityAdapter] Removed symlink: ${linkPath}`);
    } else {
      console.log(`[AntigravityAdapter] No active symlink found for ${pluginName} at ${linkPath}`);
    }
  }
}
