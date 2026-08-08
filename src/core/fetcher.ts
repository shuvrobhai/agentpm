import fs from 'node:fs/promises';
import path from 'node:path';
import { GlobalStore } from './store.js';
import { agentpmFetchCacheDir } from './config.js';
import { cloneRepo, writeApmLockfile, APM_LOCKFILE, contentHashOfDir } from './acquirer.js';
import type { ParsedRepo } from './store.js';

export interface DownloadResult {
  targetPath: string;
  namespace: string;
  pluginName: string;
  version: string;
  alreadyExisted: boolean;
  commit?: string;
  vendor?: string;
}

export async function detectSourceVendor(dir: string): Promise<string> {
  const claudePlugin = await fs.access(path.join(dir, '.claude-plugin', 'plugin.json')).then(() => true).catch(() => false);
  if (claudePlugin) return 'claude-code';

  const claudeMd = await fs.access(path.join(dir, 'CLAUDE.md')).then(() => true).catch(() => false);
  if (claudeMd) return 'claude-code';

  const opencodeJson = await fs.access(path.join(dir, 'opencode.json')).then(() => true).catch(() => false);
  if (opencodeJson) return 'opencode';

  const codexPlugin = await fs.access(path.join(dir, '.codex-plugin', 'plugin.json')).then(() => true).catch(() => false);
  if (codexPlugin) return 'codex';

  const agyAgents = await fs.access(path.join(dir, '.agents')).then(() => true).catch(() => false);
  if (agyAgents) return 'antigravity';

  return 'claude-code';
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

  // 1. Fetch / Clone pristine raw repo into repos/<namespace>/<plugin>/
  const repoDir = GlobalStore.getRepoClonePath(parsed.namespace, parsed.pluginName);
  await fs.mkdir(path.dirname(repoDir), { recursive: true });

  let commit = '';
  let pluginSourceDir = repoDir;

  const cacheKey = `${parsed.namespace}-${parsed.pluginName}-${version}`;
  const fetchCacheDir = path.join(agentpmFetchCacheDir(), cacheKey);

  let cacheReady = false;
  if (!force) {
    const cacheMarker = path.join(fetchCacheDir, '.complete');
    cacheReady = await fs.access(cacheMarker).then(() => true).catch(() => false);
  }

  if (cacheReady) {
    pluginSourceDir = path.join(fetchCacheDir, 'repo');
    commit = await fs.readFile(path.join(fetchCacheDir, '.complete'), 'utf8').catch(() => '');
  } else {
    await fs.rm(fetchCacheDir, { recursive: true, force: true }).catch(() => {});
    const acquired = await cloneRepo(parsed, path.join(fetchCacheDir, 'repo'));
    pluginSourceDir = acquired.pluginDir;
    commit = acquired.commit;
    await fs.writeFile(path.join(fetchCacheDir, '.complete'), acquired.commit, 'utf8');

    // Also persist pristine raw clone in repos/<namespace>/<plugin>
    await fs.rm(repoDir, { recursive: true, force: true }).catch(() => {});
    await GlobalStore.copyDirectoryDereferenced(path.join(fetchCacheDir, 'repo'), repoDir).catch(() => {});
  }

  // 2. Detect source vendor
  const vendor = await detectSourceVendor(pluginSourceDir);

  // 3. Stage clean extracted plugin in store
  await GlobalStore.copyDirectoryDereferenced(pluginSourceDir, targetPath);

  // 4. Update source-registry.json
  try {
    const contentHash = await contentHashOfDir(targetPath);
    const deployedFiles = await fs.readdir(targetPath).catch(() => []);
    await GlobalStore.updateRegistry(`${parsed.namespace}/${parsed.pluginName}`, {
      source: parsed.cloneUrl,
      ...(parsed.ref ? { ref: parsed.ref } : {}),
      resolved_commit: commit,
      content_hash: contentHash,
      source_vendor: vendor,
      installed_at: new Date().toISOString(),
      clone_path: repoDir,
      extracted_path: targetPath,
      deployed_files: deployedFiles,
    });
  } catch {
    // Registry update is best-effort
  }

  try {
    await writeApmLockfile(
      path.join(targetPath, APM_LOCKFILE),
      parsed.pluginName,
      parsed.cloneUrl,
      parsed.ref,
      commit,
      targetPath,
    );
  } catch {
    // Lockfile is best-effort
  }

  return {
    targetPath,
    namespace: parsed.namespace,
    pluginName: parsed.pluginName,
    version,
    alreadyExisted: false,
    commit,
    vendor,
  };
}

