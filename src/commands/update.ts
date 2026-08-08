import { GlobalStore } from '../core/store.js';
import { PackageAcquirer } from '../core/acquirer.js';
import { convertDirToPortableCore } from '../core/portable-writer.js';

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
        const parsed = GlobalStore.parseRepoIdentifier(identifier);
        console.log(`Updating ${parsed.namespace}/${parsed.pluginName}...`);
        const result = await PackageAcquirer.fetchPlugin(parsed, true);
        console.log(`  Updated ${parsed.namespace}/${parsed.pluginName}@${result.version} -> ${result.sourcePath}`);
      } catch (err: any) {
        console.error(`  Failed to update ${identifier}: ${err.message}`);
      }
    }
  } catch (err: any) {
    console.error(`Error updating plugins: ${err.message}`);
    process.exitCode = 1;
  }
}
