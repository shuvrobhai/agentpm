import { GlobalStore } from '../core/store.js';
import { AdapterRegistry, type ActivePluginInfo } from '../adapters/index.js';

export type ActiveSymlinkInfo = ActivePluginInfo;

export async function listCommand(options: { global?: boolean; json?: boolean }): Promise<void> {
  try {
    if (options.global) {
      const stored = await GlobalStore.listGlobalPlugins();
      if (options.json) {
        console.log(JSON.stringify(stored, null, 2));
        return;
      }

      console.log(`\n📦 Global Plugin Store (${GlobalStore.getStorePath()}):\n`);
      if (stored.length === 0) {
        console.log('  (No plugins installed in global store)');
        return;
      }

      for (const item of stored) {
        console.log(`  • ${item.namespace}/${item.pluginName} (${item.version}) -> ${item.fullPath}`);
      }
      console.log('');
      return;
    }

    // Default: Inspect local workspace materializations using AdapterRegistry
    const symlinks = await AdapterRegistry.scanWorkspace();

    if (options.json) {
      console.log(JSON.stringify(symlinks, null, 2));
      return;
    }

    console.log(`\n🔗 Active Workspace Plugins (${process.cwd()}):\n`);
    if (symlinks.length === 0) {
      console.log('  (No plugins materialized in active workspace)');
      console.log('  Tip: Run `agentpm list --global` to see installed global store plugins.');
      return;
    }

    for (const link of symlinks) {
      const targetDisplay = link.targetPath ? ` -> ${link.targetPath}` : '';
      console.log(`  • [${link.agent}] ${link.pluginName}${targetDisplay}`);
    }
    console.log('');
  } catch (err: any) {
    console.error(`Error listing plugins: ${err.message}`);
    process.exitCode = 1;
  }
}
