import fs from 'node:fs/promises';
import path from 'node:path';
import { GlobalStore } from './store.js';
import { agentpmFetchCacheDir } from './config.js';
import { cloneRepo, writeApmLockfile, APM_LOCKFILE } from './acquirer.js';
import type { ParsedRepo } from './store.js';

export interface DownloadResult {
  targetPath: string;
  namespace: string;
  pluginName: string;
  version: string;
  alreadyExisted: boolean;
  commit?: string;
}

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

  const cacheKey = `${parsed.namespace}-${parsed.pluginName}-${version}`;
  const fetchCacheDir = path.join(agentpmFetchCacheDir(), cacheKey);

  let cacheReady = false;
  if (!force) {
    const cacheMarker = path.join(fetchCacheDir, '.complete');
    cacheReady = await fs.access(cacheMarker).then(() => true).catch(() => false);
  }

  let cloneDir = fetchCacheDir;
  if (cacheReady) {
    cloneDir = path.join(fetchCacheDir, 'repo');
  } else {
    await fs.rm(fetchCacheDir, { recursive: true, force: true }).catch(() => {});
    const repoDir = path.join(fetchCacheDir, 'repo');
    const acquired = await cloneRepo(parsed, repoDir);
    cloneDir = acquired.pluginDir;
    await fs.writeFile(path.join(fetchCacheDir, '.complete'), acquired.commit, 'utf8');
  }

  await GlobalStore.copyDirectoryDereferenced(cloneDir, targetPath);

  try {
    await writeApmLockfile(
      path.join(targetPath, APM_LOCKFILE),
      parsed.pluginName,
      parsed.cloneUrl,
      parsed.ref,
      await fs.readFile(path.join(fetchCacheDir, '.complete'), 'utf8'),
      targetPath,
    );
  } catch {
    // Lockfile is best-effort; a failed write must not fail the install.
  }

  return {
    targetPath,
    namespace: parsed.namespace,
    pluginName: parsed.pluginName,
    version,
    alreadyExisted: false,
  };
}
