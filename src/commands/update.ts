import { GlobalStore } from '../core/store.js';
import { Acquirer } from '../core/acquirer.js';

export interface UpdateOptions {
  target?: string;
  yes?: boolean;
}

export async function updateCommand(plugins: string[], options: UpdateOptions = {}): Promise<void> {
  try {
    if (plugins.length === 0) {
      const stored = await GlobalStore.listGlobalPlugins();
      if (stored.length === 0) {
        console.log('No plugins installed in global store. Nothing to update.');
        return;
      }
      plugins = stored.map((p) => `${p.namespace}/${p.pluginName}`);
      console.log(`Updating ${plugins.length} installed plugin(s)...`);
    }

    for (const identifier of plugins) {
      try {
        console.log(`Updating ${identifier}...`);
        const result = await Acquirer.update(identifier);
        console.log(`  Updated ${result.namespace}/${result.pluginName}@${result.version} -> ${result.sourcePath}`);
      } catch (err: any) {
        console.error(`  Failed to update ${identifier}: ${err.message}`);
      }
    }
  } catch (err: any) {
    console.error(`Error updating plugins: ${err.message}`);
    process.exitCode = 1;
  }
}
