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

const COMMIT_SHA_REGEX = /^[0-9a-fA-F]{40}$/;

export async function downloadPlugin(parsed: ParsedRepo, force = false): Promise<DownloadResult> {
  if (parsed.ref && parsed.ref.startsWith('-')) {
    throw new Error(`Security Violation: Ref "${parsed.ref}" cannot start with '-'.`);
  }

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
  const isCommitSha = parsed.ref ? COMMIT_SHA_REGEX.test(parsed.ref) : false;

  const options = ['--depth', '1'];
  if (parsed.ref && parsed.ref !== 'latest' && !isCommitSha) {
    options.push('--branch', parsed.ref);
  }

  await git.clone(parsed.cloneUrl, targetPath, isCommitSha ? [] : options);

  if (isCommitSha && parsed.ref) {
    const repoGit = simpleGit(targetPath);
    await repoGit.checkout(parsed.ref);
  }

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
