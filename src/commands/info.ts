import fs from 'node:fs/promises';
import path from 'node:path';
import { GlobalStore } from '../core/store.js';
import { PackageManifest } from '../core/manifest.js';

export interface PluginInfoReport {
  pluginIdentifier: string;
  storePath: string;
  manifest: {
    name: string;
    version: string;
    description: string;
    author?: any;
    isOpenCanonicalFormat: boolean;
  };
  skills: string[];
  mcpServers: string[];
  hasHooks: boolean;
  activeInWorkspace: {
    antigravity: boolean;
    claudeCode: boolean;
  };
}

export async function infoCommand(plugin: string, options: { json?: boolean }): Promise<void> {
  try {
    const storePath = await GlobalStore.findPluginPath(plugin);
    const manifest = await PackageManifest.load(storePath);

    const lastSegment = path.basename(storePath);
    const isVersionSegment = ['latest', 'main', 'master', 'head'].includes(lastSegment.toLowerCase()) || /^v?\d+/.test(lastSegment);

    const pluginDirName = isVersionSegment
      ? path.basename(path.dirname(storePath))
      : lastSegment;

    const antigravityPlugins = path.join(process.cwd(), '.agents', 'plugins', pluginDirName);
    const antigravitySkills = path.join(process.cwd(), '.agents', 'skills', pluginDirName);
    const claudePath = path.join(process.cwd(), '.claudecode', 'skills', pluginDirName);

    const isAntigravityActive = (await fs.lstat(antigravityPlugins).then(() => true).catch(() => false)) ||
                                (await fs.lstat(antigravitySkills).then(() => true).catch(() => false));
    const isClaudeActive = await fs.lstat(claudePath).then(() => true).catch(() => false);

    const report: PluginInfoReport = {
      pluginIdentifier: plugin,
      storePath,
      manifest: {
        name: manifest.name,
        version: manifest.version,
        description: manifest.description,
        author: manifest.author,
        isOpenCanonicalFormat: manifest.isOpenCanonicalFormat,
      },
      skills: manifest.capabilities.skills,
      mcpServers: manifest.capabilities.mcpServers,
      hasHooks: manifest.capabilities.hooks,
      activeInWorkspace: {
        antigravity: isAntigravityActive,
        claudeCode: isClaudeActive,
      },
    };

    if (options.json) {
      console.log(JSON.stringify(report, null, 2));
      return;
    }

    console.log(`\n🔍 Plugin Information: ${manifest.name}\n`);
    console.log(`  • Store Location: ${storePath}`);
    if (manifest.description) {
      console.log(`  • Description:    ${manifest.description}`);
    }
    console.log(`  • Version:        ${manifest.version}`);
    console.log(`  • Open Canonical: ${manifest.isOpenCanonicalFormat ? 'Yes' : 'No (vendor-specific)'}`);
    console.log(`  • Skills:         ${manifest.capabilities.skills.length > 0 ? manifest.capabilities.skills.join(', ') : 'None'}`);
    console.log(`  • MCP Servers:    ${manifest.capabilities.mcpServers.length > 0 ? manifest.capabilities.mcpServers.join(', ') : 'None'}`);
    console.log(`  • Hooks Defined:  ${manifest.capabilities.hooks ? 'Yes' : 'No'}`);
    console.log('  • Workspace Status:');
    console.log(`     - Antigravity: ${isAntigravityActive ? 'Active' : 'Inactive'}`);
    console.log(`     - Claude Code: ${isClaudeActive ? 'Active' : 'Inactive'}`);
    console.log('');
  } catch (err: any) {
    console.error(`Error fetching info for plugin: ${err.message}`);
    process.exitCode = 1;
  }
}
