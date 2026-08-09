import { AdapterRegistry, getAdapter } from '../adapters/index.js';

export async function enableCommand(
  plugin: string,
  options: { global?: boolean | undefined; target?: string | undefined; copy?: boolean | undefined }
): Promise<void> {
  try {
    const scope = options.global ? 'global' : 'local';
    console.error(`Enabling plugin ${plugin} (${scope}, mode: ${options.copy ? 'copy' : 'symlink'})...`);

    const enableOpts = options.copy !== undefined ? { copy: options.copy } : undefined;

    if (options.target && options.target !== 'agent-plugins') {
      const adapter = getAdapter(options.target);
      await adapter.enable(plugin, scope, enableOpts);
      return;
    }

    const adapters = AdapterRegistry.all();
    let materializedCount = 0;

    for (const adapter of adapters) {
      if (await adapter.detect(scope)) {
        await adapter.enable(plugin, scope, enableOpts);
        materializedCount++;
      }
    }

    if (materializedCount === 0) {
      const defaultAdapter = AdapterRegistry.get('antigravity');
      await defaultAdapter.enable(plugin, scope, enableOpts);
    }
  } catch (err: any) {
    console.error('Error enabling plugin:', err);
    process.exitCode = 1;
  }
}
