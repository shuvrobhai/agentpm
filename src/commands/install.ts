import { GlobalStore } from '../core/store.js';
import { downloadPlugin } from '../core/fetcher.js';

export async function installCommand(repo: string, options: { global?: boolean; force?: boolean }): Promise<void> {
  try {
    const parsed = GlobalStore.parseRepoIdentifier(repo);
    console.log(`Downloading plugin ${parsed.namespace}/${parsed.pluginName} (ref: ${parsed.ref || 'default'})...`);

    const result = await downloadPlugin(parsed, options.force);

    if (result.alreadyExisted) {
      console.log(`Plugin ${result.namespace}/${result.pluginName}@${result.version} is already installed at ${result.targetPath}.`);
      console.log(`Use '--force' to redownload.`);
    } else {
      console.log(`Successfully installed ${result.namespace}/${result.pluginName}@${result.version} to:`);
      console.log(`  ${result.targetPath}`);
    }

    console.log(`\nNext step: Run 'agentpm enable ${result.pluginName}' to activate it for your target agent.`);
  } catch (err: any) {
    console.error(`Error installing plugin: ${err.message}`);
    process.exitCode = 1;
  }
}
