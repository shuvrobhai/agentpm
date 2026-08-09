import { AdapterRegistry } from '../adapters/index.js';
import { GlobalStore } from '../core/store.js';
import { createDispatcher } from '../core/command-dispatcher.js';

export const uninstallCommand = createDispatcher(async (ctx, plugin: string, options: { global?: boolean }) => {
  ctx.error(`Uninstalling plugin "${plugin}"...`);

  const adapters = AdapterRegistry.all();

  // 1. Dematerialize active symlinks across adapters (local & global scopes)
  for (const adapter of adapters) {
    if (await adapter.detect('local')) {
      await adapter.disable(plugin, 'local');
    }
    if (options.global) {
      await adapter.disable(plugin, 'global');
    }
  }

  // 2. Remove package directory from Global Store
  const removedPaths = await GlobalStore.removePlugin(plugin);
  for (const p of removedPaths) {
    ctx.error(`Purged package from Global Store: ${p}`);
  }

  ctx.error(`Successfully uninstalled plugin "${plugin}".`);
});


