import { simpleGit } from 'simple-git';
import fs from 'node:fs/promises';
import path from 'node:path';
import { GlobalStore, ParsedRepo } from './store.js';

export interface DownloadResult {
  targetPath: string;
  namespace: string;
  pluginName: string;
  version: string;
  alreadyExisted: boolean;
}

export async function downloadPlugin(parsed: ParsedRepo, force = false): Promise<DownloadResult> {
  const version = parsed.ref || 'latest';
  const targetPath = GlobalStore.getPluginPath(parsed.namespace, parsed.pluginName, version);

  const exists = await fs.access(targetPath).then(() => true).catch(() => false);

  if (exists && !force) {
    return {
      targetPath,
      namespace: parsed.namespace,
      pluginName: parsed.pluginName,
      version,
      alreadyExisted: true,
    };
  }

  if (exists && force) {
    await fs.rm(targetPath, { recursive: true, force: true });
  }

  await GlobalStore.ensureDir(path.dirname(targetPath));

  const git = simpleGit();

  const options = ['--depth', '1'];
  if (parsed.ref && parsed.ref !== 'latest') {
    options.push('--branch', parsed.ref);
  }

  await git.clone(parsed.cloneUrl, targetPath, options);

  // Remove .git folder inside the downloaded store to save space and avoid nested repo confusion
  const internalGitDir = path.join(targetPath, '.git');
  await fs.rm(internalGitDir, { recursive: true, force: true }).catch(() => {});

  return {
    targetPath,
    namespace: parsed.namespace,
    pluginName: parsed.pluginName,
    version,
    alreadyExisted: false,
  };
}
