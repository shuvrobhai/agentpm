import { PackageAcquirer } from '../core/acquirer.js';
import type { AcquiredPackage } from '../core/acquirer.js';
import { convertDirToPortableCore } from '../core/portable-writer.js';

export interface InstallOptions {
  target?: string;
  force?: boolean;
}

export const DEFAULT_INSTALL_TARGET = 'agent-plugins';

export async function installCommand(repo: string, options: InstallOptions = {}): Promise<AcquiredPackage | undefined> {
  try {
    const targetAdapter = options.target || DEFAULT_INSTALL_TARGET;
    console.log(`Downloading plugin from specification: ${repo}...`);

    const acquireOpts = options.force !== undefined ? { force: options.force } : undefined;
    const result = await PackageAcquirer.acquire(repo, acquireOpts);

    if (result.alreadyExisted && result.sourceType === 'git') {
      console.log(`Plugin ${result.namespace}/${result.pluginName}@${result.version} is already installed at ${result.sourcePath}.`);
      console.log(`Use '--force' to redownload.`);
    } else {
      console.log(`Converting downloaded plugin to portable format (target: ${targetAdapter})...`);
      await convertDirToPortableCore(result.sourcePath, result.sourcePath);

      console.log(`Successfully installed ${result.namespace}/${result.pluginName}@${result.version}:`);
      console.log(`  ${result.sourcePath}`);
    }

    console.log(`\nNext step: Run 'plugins enable ${result.pluginName}' to activate it for your target agent.`);
    return result;
  } catch (err: any) {
    console.error(`Error installing plugin: ${err.message}`);
    process.exitCode = 1;
    return undefined;
  }
}
