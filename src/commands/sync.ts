import { LockfileEngine } from '../core/lockfile.js';
import { AdapterRegistry } from '../adapters/index.js';

export interface SyncCommandOptions {
  plugin?: string;
  agent?: string;
  dryRun?: boolean;
  json?: boolean;
}

export async function syncCommand(options: SyncCommandOptions): Promise<void> {
  try {
    const lock = await LockfileEngine.readLockfile();
    const drift = await LockfileEngine.detectDrift();

    if (options.json) {
      console.log(JSON.stringify({ lock, drift }, null, 2));
      return;
    }

    console.log('\n🔄 AgentPlugins Workspace Sync');
    console.log('──────────────────────────────');

    const totalPlugins = Object.keys(lock.installs).length;
    console.log(`Tracked Plugins in .agentpm.lock: ${totalPlugins}`);

    if (totalPlugins === 0) {
      console.log('No plugins tracked in workspace lockfile. Run `plugins install <pkg>` to add plugins.\n');
      return;
    }

    if (drift.hasDrift) {
      console.log(`\n⚠️  Detected ${drift.issues.length} file drift issue(s):`);
      for (const issue of drift.issues) {
        console.log(`  ❌ [${issue.agent.toUpperCase()}] ${issue.message}`);
      }
    } else {
      console.log('\n✅ All workspace materialization files match .agentpm.lock content hashes.');
    }

    if (options.dryRun) {
      console.log('\n[Dry-run mode] No materialization changes executed.\n');
      return;
    }

    // Re-materialize tracked plugins for active agents
    const activeAdapters = await AdapterRegistry.detectActive('local');
    const targetAgents = options.agent
      ? activeAdapters.filter((a) => a.name === options.agent || a.displayName?.toLowerCase().includes(options.agent!.toLowerCase()))
      : activeAdapters;

    console.log(`\n📦 Syncing across ${targetAgents.length} detected active agent(s)...`);

    for (const [pluginName, installState] of Object.entries(lock.installs)) {
      if (options.plugin && pluginName !== options.plugin) continue;

      for (const adapter of targetAgents) {
        try {
          await adapter.enable(pluginName, 'local', { version: installState.version });
          console.log(`  ✨ Synced [${adapter.displayName || adapter.name}] ${pluginName} (v${installState.version})`);
        } catch (err: unknown) {
          console.error(`  ❌ Failed to sync ${pluginName} for ${adapter.name}: ${err instanceof Error ? err.message : String(err)}`);
        }
      }
    }

    console.log('\n✅ Workspace sync complete!\n');
  } catch (err: unknown) {
    console.error('Error during workspace sync:', err instanceof Error ? err.message : String(err));
    process.exitCode = 1;
  }
}
