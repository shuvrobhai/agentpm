import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { AgentAdapter } from './base.js';
import { GlobalStore } from '../core/store.js';
import { PluginConverter } from '../core/converter.js';

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

  async enable(pluginName: string, version = 'latest', scope: 'global' | 'local'): Promise<void> {
    const rawSourcePath = await GlobalStore.findPluginPath(pluginName, version);
    const baseDir = scope === 'local'
      ? path.join(process.cwd(), '.agents', 'skills')
      : path.join(os.homedir(), '.gemini', 'config', 'skills');

    await GlobalStore.ensureDir(baseDir);

    const pluginDirName = path.basename(rawSourcePath) === 'latest'
      ? path.basename(path.dirname(rawSourcePath))
      : path.basename(rawSourcePath);

    const namespace = path.basename(path.dirname(path.dirname(rawSourcePath)));
    const adaptedDir = GlobalStore.getAdaptedPluginPath(this.name, namespace || 'default', pluginDirName, version);

    // Convert plugin to Antigravity-adapted format
    const conversionResult = await PluginConverter.convertPlugin(rawSourcePath, adaptedDir, {
      targetAdapter: 'antigravity',
      memoryFilename: 'AGENTS.md',
      rootVarName: 'PLUGIN_ROOT',
      expandMcpPaths: true,
      neutralizeTerms: true,
    });

    const targetSourcePath = conversionResult.filesModified > 0 ? adaptedDir : rawSourcePath;

    const linkPath = path.join(baseDir, pluginDirName);

    const exists = await fs.lstat(linkPath).then(() => true).catch(() => false);
    if (exists) {
      await fs.rm(linkPath, { recursive: true, force: true });
    }

    await fs.symlink(targetSourcePath, linkPath, 'dir');
    console.log(`[AntigravityAdapter] Materialized symlink: ${linkPath} -> ${targetSourcePath} (${conversionResult.filesModified} files adapted)`);
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
