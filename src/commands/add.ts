import { Acquirer, type AcquiredPackage } from '../core/acquirer.js';
import { convertDirToPortableCore } from '../core/portable-writer.js';
import { enableCommand } from './enable.js';

export interface AddOptions {
  target?: string;
  force?: boolean;
  global?: boolean;
  copy?: boolean;
  skipEnable?: boolean;
}

export interface InstallOptions {
  target?: string;
  force?: boolean;
}

export const DEFAULT_INSTALL_TARGET = 'agent-plugins';

// ponytail: acquire + convert + enable merged into single unified add/install command
export async function installCommand(repo: string, options: InstallOptions = {}): Promise<AcquiredPackage | undefined> {
  try {
    const targetAdapter = options.target || DEFAULT_INSTALL_TARGET;
    console.log(`Downloading plugin from specification: ${repo}...`);

    const acquireOpts = options.force !== undefined ? { force: options.force } : undefined;
    const result = await Acquirer.acquire(repo, acquireOpts);

    if (result.alreadyExisted && result.sourceType === 'git') {
      console.log(`Plugin ${result.namespace}/${result.pluginName}@${result.version} is already installed at ${result.sourcePath}.`);
      console.log(`Use '--force' to redownload.`);
    } else {
      if (result.sourceType === 'local') {
        console.log(`Converting local plugin to portable format (target: ${targetAdapter})...`);
        await convertDirToPortableCore(result.sourcePath, result.sourcePath);
      } else {
        console.log(`Converted downloaded plugin to portable format (target: ${targetAdapter}).`);
      }

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

export async function addCommand(repo: string, options: AddOptions = {}): Promise<void> {
  const installOpts: InstallOptions = {};
  if (options.target !== undefined) installOpts.target = options.target;
  if (options.force !== undefined) installOpts.force = options.force;
  const pkg = await installCommand(repo, installOpts);
  if (options.skipEnable || !pkg?.pluginName) return;

  try {
    const enableOpts: { global?: boolean; target?: string; copy?: boolean } = {};
    if (options.global !== undefined) enableOpts.global = options.global;
    if (options.target !== undefined) enableOpts.target = options.target;
    if (options.copy !== undefined) enableOpts.copy = options.copy;
    await enableCommand(pkg.pluginName, enableOpts);
  } catch (err: any) {
    console.log(`Skipping auto-enable: ${err.message}`);
  }
}
