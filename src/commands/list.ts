import { GlobalStore } from '../core/store.js';
import { AdapterRegistry, type ActivePluginInfo } from '../adapters/index.js';
import { findWorkspaceRoot } from '../core/config.js';
import { createDispatcher } from '../core/command-dispatcher.js';

export type ActiveSymlinkInfo = ActivePluginInfo;

export const listCommand = createDispatcher(async (ctx, options: { global?: boolean; json?: boolean }) => {
  if (options.global) {
    const stored = await GlobalStore.listGlobalPlugins();
    if (options.json) {
      ctx.log(JSON.stringify(stored, null, 2));
      return;
    }

    ctx.error(`\n📦 Global Plugin Store (${GlobalStore.getStorePath()}):\n`);
    if (stored.length === 0) {
      ctx.error('  (No plugins installed in global store)');
      return;
    }

    for (const item of stored) {
      ctx.log(`  • ${item.namespace}/${item.pluginName} (${item.version}) -> ${item.fullPath}`);
    }
    ctx.error('');
    return;
  }

  // Default: Inspect local workspace materializations using AdapterRegistry
  const symlinks = await AdapterRegistry.scanWorkspace();

  if (options.json) {
    ctx.log(JSON.stringify(symlinks, null, 2));
    return;
  }

  const wsRoot = findWorkspaceRoot();
  ctx.error(`\n🔗 Active Workspace Plugins (${wsRoot}):\n`);
  if (symlinks.length === 0) {
    ctx.error('  (No plugins materialized in active workspace)');
    ctx.error('  Tip: Run `agentpm list --global` to see installed global store plugins.');
    return;
  }

  for (const link of symlinks) {
    const targetDisplay = link.targetPath ? ` -> ${link.targetPath}` : '';
    ctx.log(`  • [${link.agent}] ${link.pluginName}${targetDisplay}`);
  }
  ctx.error('');
});

