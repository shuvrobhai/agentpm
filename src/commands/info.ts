import path from 'node:path';
import { GlobalStore } from '../core/store.js';
import { parsePlugin } from '../parser/index.js';
import { AdapterRegistry } from '../adapters/index.js';

export interface PluginInfoReport {
  pluginIdentifier: string;
  storePath: string;
  manifest: {
    name: string;
    version: string;
    description: string;
    author?: unknown;
    isOpenCanonicalFormat: boolean;
  };
  skills: string[];
  commands: string[];
  agents: string[];
  rules: string[];
  contextFile?: string | undefined;
  mcpServers: string[];
  hasHooks: boolean;
  activeInWorkspace: Record<string, boolean>;
}

export async function infoCommand(plugin: string, options: { json?: boolean }): Promise<void> {
  try {
    const storePath = await GlobalStore.findPluginPath(plugin);
    const ir = await parsePlugin(storePath);

    const lastSegment = path.basename(storePath);
    const isVersionSegment = ['latest', 'main', 'master', 'head'].includes(lastSegment.toLowerCase()) || /^v?\d+/.test(lastSegment);

    const pluginDirName = isVersionSegment
      ? path.basename(path.dirname(storePath))
      : lastSegment;

    const activeList = await AdapterRegistry.scanWorkspace();
    const activeInWorkspace: Record<string, boolean> = {};
    for (const adapter of AdapterRegistry.all()) {
      const isActive = activeList.some((item) => item.agent === adapter.name && item.pluginName === pluginDirName);
      activeInWorkspace[adapter.name] = isActive;
    }

    const metaName = typeof ir.metadata.name === 'string' ? ir.metadata.name : ir.source.pluginName || plugin;
    const metaVersion = typeof ir.metadata.version === 'string' ? ir.metadata.version : '1.0.0';
    const metaDesc = typeof ir.metadata.description === 'string' ? ir.metadata.description : '';
    const isOpenCanonical = typeof ir.metadata.$schema === 'string' && ir.metadata.$schema.includes('agent-plugins.org');

    const report: PluginInfoReport = {
      pluginIdentifier: plugin,
      storePath,
      manifest: {
        name: metaName,
        version: metaVersion,
        description: metaDesc,
        author: ir.metadata.author,
        isOpenCanonicalFormat: isOpenCanonical,
      },
      skills: ir.skills.map((s) => s.name),
      commands: ir.commands.map((c) => c.name),
      agents: ir.agents.map((a) => a.name),
      rules: ir.rules.map((r) => r.name),
      ...(ir.contextFile ? { contextFile: ir.contextFile.sourcePath } : {}),
      mcpServers: ir.mcpServers.map((s) => s.name),
      hasHooks: ir.hooks.length > 0,
      activeInWorkspace,
    };

    if (options.json) {
      console.log(JSON.stringify(report, null, 2));
      return;
    }

    console.log(`\n🔍 Plugin Information: ${report.manifest.name}\n`);
    console.log(`  • Store Location: ${storePath}`);
    if (report.manifest.description) {
      console.log(`  • Description:    ${report.manifest.description}`);
    }
    console.log(`  • Version:        ${report.manifest.version}`);
    console.log(`  • Open Canonical: ${report.manifest.isOpenCanonicalFormat ? 'Yes' : 'No (vendor-specific)'}`);
    console.log(`  • Skills:         ${report.skills.length > 0 ? report.skills.join(', ') : 'None'}`);
    if (report.commands.length > 0) {
      console.log(`  • Commands:       ${report.commands.join(', ')}`);
    }
    if (report.agents.length > 0) {
      console.log(`  • Agents:         ${report.agents.join(', ')}`);
    }
    if (report.rules.length > 0) {
      console.log(`  • Rules:          ${report.rules.join(', ')}`);
    }
    console.log(`  • MCP Servers:    ${report.mcpServers.length > 0 ? report.mcpServers.join(', ') : 'None'}`);
    console.log(`  • Hooks Defined:  ${report.hasHooks ? 'Yes' : 'No'}`);
    console.log('  • Workspace Status:');
    for (const [agentName, active] of Object.entries(activeInWorkspace)) {
      console.log(`     - ${agentName}: ${active ? 'Active' : 'Inactive'}`);
    }
    console.log('');
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`Error fetching info for plugin: ${msg}`);
    process.exitCode = 1;
  }
}
