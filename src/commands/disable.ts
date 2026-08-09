import { AdapterRegistry } from '../adapters/index.js';

export async function disableCommand(plugin: string, options: { global?: boolean; target?: string }): Promise<void> {
  try {
    const scope = options.global ? 'global' : 'local';
    console.error(`Disabling plugin ${plugin} (${scope})...`);

    const adapters = AdapterRegistry.all();

    for (const adapter of adapters) {
      if (!options.target || options.target === adapter.name) {
        if (await adapter.detect(scope)) {
          await adapter.disable(plugin, scope);
        }
      }
    }
  } catch (err: any) {
    console.error(`Error disabling plugin: ${err.message}`);
    process.exitCode = 1;
  }
}
