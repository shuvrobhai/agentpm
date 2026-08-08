import path from 'node:path';
import os from 'node:os';

function xdgDataHome(): string {
  return process.env.XDG_DATA_HOME || path.join(os.homedir(), '.local', 'share');
}

function xdgCacheHome(): string {
  return process.env.XDG_CACHE_HOME || path.join(os.homedir(), '.cache');
}

/**
 * Injectable roots (ADR 0013 Q16): AGENTPM_STORE is the canonical store of
 * validated portable-core packages (XDG data), AGENTPM_CACHE is the disposable
 * fetch cache (XDG cache). Tests point both at a temp dir, never ~/.agentplugins.
 */
export function agentpmStoreRoot(): string {
  return process.env.AGENTPM_STORE || path.join(xdgDataHome(), 'agentpm');
}

export function agentpmCacheRoot(): string {
  return process.env.AGENTPM_CACHE || path.join(xdgCacheHome(), 'agentpm');
}

export function agentpmStorePluginsDir(): string {
  return path.join(agentpmStoreRoot(), 'plugins');
}

export function agentpmStoreAdaptedDir(): string {
  return path.join(agentpmStoreRoot(), 'adapted');
}

export function agentpmFetchCacheDir(): string {
  return path.join(agentpmCacheRoot(), 'fetch');
}
