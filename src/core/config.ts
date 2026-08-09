import path from 'node:path';
import os from 'node:os';

/**
 * Injectable roots: AGENTPM_STORE is the canonical store of
 * validated portable-core packages, AGENTPM_CACHE is the disposable
 * fetch cache. Default store root is ~/.agentplugins.
 */
export function agentpmStoreRoot(): string {
  return process.env.AGENTPM_STORE || path.join(os.homedir(), '.agentplugins');
}

export function agentpmCacheRoot(): string {
  return process.env.AGENTPM_CACHE || path.join(os.homedir(), '.cache', 'agentpm');
}

export function agentpmReposDir(): string {
  return path.join(agentpmStoreRoot(), 'repos');
}

export function agentpmCleanPluginsDir(): string {
  return path.join(agentpmStoreRoot(), 'plugins');
}

export function agentpmStorePluginsDir(): string {
  return path.join(agentpmStoreRoot(), 'plugins');
}

export function agentpmStoreAdaptedDir(): string {
  return path.join(agentpmStoreRoot(), 'adapted');
}

export function agentpmRegistryPath(): string {
  return path.join(agentpmStoreRoot(), 'source-registry.json');
}

export function agentpmFetchCacheDir(): string {
  return path.join(agentpmCacheRoot(), 'fetch');
}

import fs from 'node:fs';

export function findWorkspaceRoot(startDir: string = process.cwd()): string {
  let current = path.resolve(startDir);
  const root = path.parse(current).root;

  while (current && current !== root) {
    if (
      fs.existsSync(path.join(current, '.agents')) ||
      fs.existsSync(path.join(current, '.git')) ||
      fs.existsSync(path.join(current, 'package.json'))
    ) {
      return current;
    }
    current = path.dirname(current);
  }

  if (
    fs.existsSync(path.join(root, '.agents')) ||
    fs.existsSync(path.join(root, '.git')) ||
    fs.existsSync(path.join(root, 'package.json'))
  ) {
    return root;
  }

  return startDir;
}


