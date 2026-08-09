import { AdapterRegistry } from '../adapters/index.js';
import { createDispatcher } from '../core/command-dispatcher.js';

export const disableCommand = createDispatcher(async (ctx, plugin: string, options: { global?: boolean; target?: string }) => {
  const scope = options.global ? 'global' : 'local';
  ctx.error(`Disabling plugin ${plugin} (${scope})...`);

  const adapters = AdapterRegistry.all();

  for (const adapter of adapters) {
    if (!options.target || options.target === adapter.name) {
      if (await adapter.detect(scope)) {
        await adapter.disable(plugin, scope);
      }
    }
  }
});

