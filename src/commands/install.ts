import { GlobalStore } from '../core/store.js';
import { downloadPlugin } from '../core/fetcher.js';
import { convertDirToPortableCore } from '../core/portable-writer.js';

export interface InstallOptions {
  target?: string;
  force?: boolean;
}

export const DEFAULT_INSTALL_TARGET = 'agent-plugins';

export async function installCommand(repo: string, options: InstallOptions = {}): Promise<void> {
  try {
    const parsed = GlobalStore.parseRepoIdentifier(repo);
    const targetAdapter = options.target || DEFAULT_INSTALL_TARGET;
    console.log(`Downloading plugin ${parsed.namespace}/${parsed.pluginName} (ref: ${parsed.ref || 'default'})...`);

    const result = await downloadPlugin(parsed, options.force);

    if (result.alreadyExisted) {
      console.log(`Plugin ${result.namespace}/${result.pluginName}@${result.version} is already installed at ${result.targetPath}.`);
      console.log(`Use '--force' to redownload.`);
    } else {
      console.log(`Converting downloaded plugin to portable format (target: ${targetAdapter})...`);
      await convertDirToPortableCore(result.targetPath, result.targetPath);

      console.log(`Successfully installed ${result.namespace}/${result.pluginName}@${result.version}:`);
      console.log(`  ${result.targetPath}`);
    }

    console.log(`\nNext step: Run 'plugins enable ${result.pluginName}' to activate it for your target agent.`);
  } catch (err: any) {
    console.error(`Error installing plugin: ${err.message}`);
    process.exitCode = 1;
  }
}
