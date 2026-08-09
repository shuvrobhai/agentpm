import { AdapterRegistry } from '../adapters/index.js';

export interface DetectCommandOptions {
  verbose?: boolean;
  json?: boolean;
}

export async function detectCommand(options: DetectCommandOptions): Promise<void> {
  try {
    const globalDetected = await AdapterRegistry.detectActive('global');
    const localDetected = await AdapterRegistry.detectActive('local');
    const workspacePlugins = await AdapterRegistry.scanWorkspace();
    const globalPlugins = await AdapterRegistry.scanGlobal();

    const report = {
      globalAgents: globalDetected.map((a) => ({ name: a.name, displayName: a.displayName })),
      localAgents: localDetected.map((a) => ({ name: a.name, displayName: a.displayName })),
      workspacePluginsCount: workspacePlugins.length,
      globalPluginsCount: globalPlugins.length,
      workspacePlugins,
      globalPlugins,
    };

    if (options.json) {
      console.log(JSON.stringify(report, null, 2));
      return;
    }

    console.log('\n🔍 Agent Environment Detection Report');
    console.log('──────────────────────────────────────');

    console.log('\n🖥️  Detected Active Agent Environments:');
    const allAdapters = AdapterRegistry.all();
    for (const adapter of allAdapters) {
      const isGlobal = globalDetected.some((a) => a.name === adapter.name);
      const isLocal = localDetected.some((a) => a.name === adapter.name);

      const statusStr = isLocal && isGlobal
        ? 'Active (Workspace & Global)'
        : isLocal
        ? 'Active (Workspace)'
        : isGlobal
        ? 'Active (Global)'
        : 'Not Detected';

      const icon = (isLocal || isGlobal) ? '✅' : '⚪';
      console.log(`  ${icon} ${adapter.displayName || adapter.name} (${adapter.name}): ${statusStr}`);
    }

    console.log(`\n📦 Materialized Plugins:`);
    console.log(`  • Workspace (.agents/): ${workspacePlugins.length}`);
    console.log(`  • Global Store (~/.agentplugins/): ${globalPlugins.length}`);

    if (options.verbose && (workspacePlugins.length > 0 || globalPlugins.length > 0)) {
      console.log('\n📋 Materialized Plugin Details:');
      for (const p of [...workspacePlugins, ...globalPlugins]) {
        console.log(`  • [${p.agent}] (${p.scope}) ${p.pluginName} -> ${p.materializedPath}`);
      }
    }

    console.log('');
  } catch (err: unknown) {
    console.error('Error detecting agent environments:', err instanceof Error ? err.message : String(err));
    process.exitCode = 1;
  }
}
