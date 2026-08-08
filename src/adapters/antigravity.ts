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

  async enable(
    pluginName: string,
    version = 'latest',
    scope: 'global' | 'local' = 'local',
    options?: { copy?: boolean }
  ): Promise<void> {
    const rawSourcePath = await GlobalStore.findPluginPath(pluginName, version);

    const baseDir = scope === 'local'
      ? path.join(process.cwd(), '.agents', 'plugins')
      : path.join(os.homedir(), '.gemini', 'config', 'plugins');

    await GlobalStore.ensureDir(baseDir);

    const lastSegment = path.basename(rawSourcePath);
    const isVersionSegment = ['latest', 'main', 'master', 'head'].includes(lastSegment.toLowerCase()) || /^v?\d+/.test(lastSegment);

    const pluginDirName = isVersionSegment
      ? path.basename(path.dirname(rawSourcePath))
      : lastSegment;

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

    if (options?.copy) {
      await GlobalStore.copyDirectoryDereferenced(targetSourcePath, linkPath);
      console.log(`[AntigravityAdapter] Materialized copied folder: ${linkPath} (isolated edit mode)`);
    } else {
      await fs.symlink(targetSourcePath, linkPath, 'dir');
      console.log(`[AntigravityAdapter] Materialized symlink: ${linkPath} -> ${targetSourcePath} (${conversionResult.filesModified} files adapted)`);
    }
  }

  async disable(pluginName: string, scope: 'global' | 'local' = 'local'): Promise<void> {
    const pluginsDir = scope === 'local'
      ? path.join(process.cwd(), '.agents', 'plugins')
      : path.join(os.homedir(), '.gemini', 'config', 'plugins');

    const skillsDir = scope === 'local'
      ? path.join(process.cwd(), '.agents', 'skills')
      : path.join(os.homedir(), '.gemini', 'config', 'skills');

    const pluginLink = path.join(pluginsDir, pluginName);
    const skillLink = path.join(skillsDir, pluginName);

    let removed = false;

    for (const linkPath of [pluginLink, skillLink]) {
      const exists = await fs.lstat(linkPath).then(() => true).catch(() => false);
      if (exists) {
        await fs.rm(linkPath, { recursive: true, force: true });
        console.log(`[AntigravityAdapter] Removed materialization link: ${linkPath}`);
        removed = true;
      }
    }

    if (!removed) {
      console.log(`[AntigravityAdapter] No active materialization found for ${pluginName}`);
    }
  }
}
