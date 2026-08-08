import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs/promises';
import { exists, readJson } from '../utils/fs.js';
import { GlobalStore } from '../core/store.js';
import { cloneRepo } from '../core/acquirer.js';
import type { SourceInfo, SourceType } from '../ir/types.js';

export async function resolveSource(input: string): Promise<SourceInfo> {
  if (input.startsWith('/') || input.startsWith('./') || input.startsWith('../') || input.startsWith('~') || /^[A-Za-z]:\\/.test(input)) {
    return resolveLocal(input);
  }

  if (input.startsWith('https://') || input.startsWith('git@') || input.endsWith('.git')) {
    return resolveGit(input, 'git');
  }

  const resolvedPath = path.resolve(input);
  if (await exists(resolvedPath)) {
    return resolveLocal(input);
  }

  if (/^[\w-]+\/[\w-]+$/.test(input)) {
    return resolveGit(input, 'github');
  }

  if (/^[\w-]+\/[\w-]+\/[\w-]+$/.test(input)) {
    return resolveMarketplace(input);
  }

  return resolveLocal(input);
}

async function resolveLocal(input: string): Promise<SourceInfo> {
  const resolvedPath = path.resolve(input.replace('~', os.homedir()));

  if (!await exists(resolvedPath)) {
    throw new Error(`Local path does not exist: ${resolvedPath}`);
  }

  const stat = await fs.stat(resolvedPath);
  if (!stat.isDirectory()) {
    throw new Error(`Path is not a directory: ${resolvedPath}`);
  }

  const meta = await readPluginManifest(resolvedPath);

  return {
    type: 'local',
    originalInput: input,
    resolvedPath,
    pluginName: meta.name,
    pluginDescription: meta.description,
    ...(meta.version !== undefined ? { pluginVersion: meta.version } : {}),
    ...(meta.author !== undefined ? { pluginAuthor: meta.author } : {}),
  };
}

async function resolveGit(input: string, type: SourceType): Promise<SourceInfo> {
  let url = input;

  if (type === 'github') {
    url = `https://github.com/${input}.git`;
  }

  const repoName = path.basename(url, '.git');
  const tmpDir = path.join(os.tmpdir(), `agentport-${repoName}-${Date.now()}`);

  console.log(`Cloning ${url} → ${tmpDir}`);

  try {
    const parsed = GlobalStore.parseRepoIdentifier(url);
    const acquired = await cloneRepo(parsed, tmpDir);
    const meta = await readPluginManifest(acquired.pluginDir);

    return {
      type,
      originalInput: input,
      resolvedPath: acquired.pluginDir,
      pluginName: meta.name,
      pluginDescription: meta.description,
      ...(meta.version !== undefined ? { pluginVersion: meta.version } : {}),
      ...(meta.author !== undefined ? { pluginAuthor: meta.author } : {}),
    };
  } catch (err) {
    await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
    throw new Error(`Failed to clone ${url}: ${(err as Error).message}`);
  }
}

async function resolveMarketplace(input: string): Promise<SourceInfo> {
  const parts = input.split('/');
  const owner = parts[0] as string;
  const repo = parts[1] as string;
  const pluginName = parts[2] as string;
  const url = `https://github.com/${owner}/${repo}.git`;
  const tmpDir = path.join(os.tmpdir(), `agentport-marketplace-${repo}-${Date.now()}`);

  console.log(`Cloning marketplace ${url} → ${tmpDir}`);

  try {
    const parsed = GlobalStore.parseRepoIdentifier(url);
    const acquired = await cloneRepo(parsed, tmpDir);
    const marketplaceJson = await readJson<Record<string, unknown>>(
      path.join(acquired.pluginDir, 'marketplace.json')
    );

    let pluginPath = acquired.pluginDir;

    if (marketplaceJson) {
      const plugins = marketplaceJson.plugins as Array<{ name: string; source: string }> | undefined;
      if (plugins) {
        const plugin = plugins.find(p => p.name === pluginName);
        if (plugin) {
          pluginPath = path.join(acquired.pluginDir, plugin.source);
        }
      }
    }

    if (pluginPath === acquired.pluginDir) {
      const candidatePaths = [
        path.join(acquired.pluginDir, pluginName),
        path.join(acquired.pluginDir, 'plugins', pluginName),
        path.join(acquired.pluginDir, '.claude-plugin', pluginName),
      ];

      for (const candidate of candidatePaths) {
        if (await exists(candidate)) {
          pluginPath = candidate;
          break;
        }
      }
    }

    const meta = await readPluginManifest(pluginPath);

    return {
      type: 'marketplace',
      originalInput: input,
      resolvedPath: pluginPath,
      pluginName: meta.name || pluginName,
      pluginDescription: meta.description,
      ...(meta.version !== undefined ? { pluginVersion: meta.version } : {}),
      ...(meta.author !== undefined ? { pluginAuthor: meta.author } : {}),
    };
  } catch (err) {
    await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
    throw new Error(`Failed to clone marketplace ${url}: ${(err as Error).message}`);
  }
}

async function readPluginManifest(pluginDir: string): Promise<{
  name: string;
  description: string;
  version?: string;
  author?: string;
}> {
  const manifestPath = path.join(pluginDir, '.claude-plugin', 'plugin.json');
  const manifest = await readJson<Record<string, unknown>>(manifestPath);

  if (manifest) {
    const authorValue = manifest.author;
    const author = typeof authorValue === 'string'
      ? authorValue
      : (authorValue as Record<string, unknown> | undefined)?.name as string | undefined;

    return {
      name: (manifest.name as string) || path.basename(pluginDir),
      description: (manifest.description as string) || '',
      ...(typeof manifest.version === 'string' ? { version: manifest.version } : {}),
      ...(author !== undefined ? { author } : {}),
    };
  }

  return {
    name: path.basename(pluginDir),
    description: '',
  };
}
