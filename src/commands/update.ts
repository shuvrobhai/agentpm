import { GlobalStore } from '../core/store.js';
import { downloadPlugin } from '../core/fetcher.js';
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
        const result = await downloadPlugin(parsed, true);
        await convertDirToPortableCore(result.targetPath, result.targetPath);
        console.log(`  Updated ${parsed.namespace}/${parsed.pluginName}@${result.version} -> ${result.targetPath}`);
      } catch (err: any) {
        console.error(`  Failed to update ${identifier}: ${err.message}`);
      }
    }
  } catch (err: any) {
    console.error(`Error updating plugins: ${err.message}`);
    process.exitCode = 1;
  }
}
