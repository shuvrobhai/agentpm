import { installCommand } from './install.js';
import { enableCommand } from './enable.js';

export interface AddOptions {
  target?: string;
  force?: boolean;
  global?: boolean;
  copy?: boolean;
  skipEnable?: boolean;
}

export async function addCommand(repo: string, options: AddOptions = {}): Promise<void> {
  const installOpts: { target?: string; force?: boolean } = {};
  if (options.target !== undefined) installOpts.target = options.target;
  if (options.force !== undefined) installOpts.force = options.force;
  await installCommand(repo, installOpts);
  if (options.skipEnable) return;

  try {
    const parsed = repo.split('#')[0]?.split('/');
    const pluginName = parsed?.[parsed.length - 1];
    if (!pluginName) {
      console.log('Skipping auto-enable: could not infer plugin name.');
      return;
    }
    const enableOpts: { global?: boolean; target?: string; copy?: boolean } = {};
    if (options.global !== undefined) enableOpts.global = options.global;
    if (options.target !== undefined) enableOpts.target = options.target;
    if (options.copy !== undefined) enableOpts.copy = options.copy;
    await enableCommand(pluginName, enableOpts);
  } catch (err: any) {
    console.log(`Skipping auto-enable: ${err.message}`);
  }
}
