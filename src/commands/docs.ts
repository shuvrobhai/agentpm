import { AdapterRegistry } from '../adapters/index.js';

export interface DocsCommandOptions {
  matrix?: boolean;
  json?: boolean;
}

// ponytail: render capability matrix and provider info directly from AdapterRegistry
export async function docsCommand(providerArg?: string, options?: DocsCommandOptions): Promise<void> {
  const adapters = AdapterRegistry.all();
  const provider = providerArg?.toLowerCase();

  if (options?.json) {
    const data = provider
      ? adapters.find((a) => a.name === provider) ?? { error: `Provider "${provider}" not found` }
      : adapters.map((a) => ({
          name: a.name,
          displayName: a.displayName,
          capabilities: a.capabilities(),
          globalPluginDir: a.globalPluginDir,
          localPluginDir: a.localPluginDir,
        }));
    console.log(JSON.stringify(data, null, 2));
    return;
  }

  if (provider) {
    const adapter = adapters.find((a) => a.name === provider);
    if (!adapter) {
      console.error(`Provider "${provider}" not found. Available: ${adapters.map((a) => a.name).join(', ')}`);
      process.exitCode = 1;
      return;
    }
    console.log(`\n=== Provider: ${adapter.displayName} (${adapter.name}) ===\n`);
    console.log(`Global Path:    ${adapter.globalPluginDir}`);
    console.log(`Workspace Path: ${adapter.localPluginDir}`);
    console.log(`Capabilities:   ${adapter.capabilities().join(', ')}\n`);
    return;
  }

  // Capability Matrix
  console.log('\n=== Multi-Provider Plugin Capability Matrix ===\n');
  const rows = adapters.map((a) => {
    const caps = new Set(a.capabilities());
    return {
      name: a.name,
      display: a.displayName,
      skills: caps.has('skills') ? '✔' : '✖',
      rules: caps.has('rules') ? '✔' : '✖',
      hooks: caps.has('hooks') ? '✔' : '✖',
      mcp: caps.has('mcp') ? '✔' : '✖',
      agents: caps.has('agents') ? '✔' : '✖',
      localDir: a.localPluginDir,
    };
  });

  console.log('Provider       | Display Name        | Skills | Rules | Hooks | MCP   | Agents | Workspace Target');
  console.log('---------------+---------------------+--------+-------+-------+-------+--------+-------------------');
  for (const r of rows) {
    console.log(
      `${r.name.padEnd(14)} | ${(r.display || '').padEnd(19)} | ${r.skills.padEnd(6)} | ${r.rules.padEnd(5)} | ${r.hooks.padEnd(5)} | ${r.mcp.padEnd(5)} | ${r.agents.padEnd(6)} | ${r.localDir}`
    );
  }
  console.log('\nRun "plugins docs <provider>" for individual details.\n');
}
