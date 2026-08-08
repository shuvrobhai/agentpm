import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { GlobalStore } from './store.js';
import type { ParsedRepo } from './store.js';

const execFileAsync = promisify(execFile);
const COMMIT_SHA_REGEX = /^[0-9a-fA-F]{40}$/;

async function runGit(args: string[], cwd?: string): Promise<string> {
  const { stdout } = await execFileAsync('git', args, {
    cwd,
    encoding: 'utf8',
    maxBuffer: 10 * 1024 * 1024,
  });
  return stdout.trim();
}

/**
 * Single acquisition surface (ADR 0013 Q15). All git-based fetching —
 * store installs, `use` previews, parser resolution — routes through this
 * module so the security checks (ref flag-injection, subfolder containment,
 * commit validation) live in exactly one place.
 */

export interface AcquiredClone {
  dir: string;
  commit: string;
  /** Path inside the clone selected by `subfolder`, if any. */
  pluginDir: string;
}

export async function cloneRepo(parsed: ParsedRepo, targetDir: string): Promise<AcquiredClone> {
  if (parsed.ref && parsed.ref.startsWith('-')) {
    throw new Error(`Security Violation: Ref "${parsed.ref}" cannot start with '-'.`);
  }

  const isCommitSha = parsed.ref ? COMMIT_SHA_REGEX.test(parsed.ref) : false;

  const cloneArgs = ['clone'];
  if (!isCommitSha) {
    cloneArgs.push('--depth', '1');
    if (parsed.ref && parsed.ref !== 'latest') {
      cloneArgs.push('--branch', parsed.ref);
    }
  }
  cloneArgs.push(parsed.cloneUrl, targetDir);

  await GlobalStore.ensureDir(path.dirname(targetDir));

  await runGit(cloneArgs);
  if (isCommitSha && parsed.ref) {
    await runGit(['checkout', parsed.ref], targetDir);
  }

  const commit = await runGit(['rev-parse', 'HEAD'], targetDir);

  let pluginDir = targetDir;
  if (parsed.subfolder) {
    const sub = path.join(targetDir, parsed.subfolder);
    const exists = await fs.access(sub).then(() => true).catch(() => false);
    if (!exists) {
      throw new Error(`Subfolder "${parsed.subfolder}" not found in repository ${parsed.cloneUrl} at ref ${parsed.ref || 'HEAD'}`);
    }
    pluginDir = sub;
  }

  return { dir: targetDir, commit, pluginDir };
}


export function contentHashOfDir(dir: string, skip: string[] = ['.git']): Promise<string> {
  return hashTree(dir, skip, new Set());
}

async function hashTree(dir: string, skip: string[], seen: Set<string>): Promise<string> {
  const hash = createHash('sha256');
  const resolved = await fs.realpath(dir).catch(() => dir);
  if (seen.has(resolved)) return '';
  seen.add(resolved);

  const entries = (await fs.readdir(dir, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name));
  for (const entry of entries) {
    if (skip.includes(entry.name)) continue;
    const full = path.join(dir, entry.name);
    const rel = path.relative(path.dirname(dir), full);
    if (entry.isDirectory()) {
      hash.update(`dir:${rel}\n`);
      hash.update(await hashTree(full, skip, seen));
    } else if (entry.isFile()) {
      hash.update(`file:${rel}:`);
      hash.update(await fs.readFile(full));
      hash.update('\n');
    }
  }
  return hash.digest('hex');
}

export interface ApmLockfile {
  version: '0.2';
  packages: Record<string, ApmPackageLock>;
}

export interface ApmPackageLock {
  source: string;
  ref?: string;
  resolved_commit: string;
  content_hash: string;
  deployed_files: string[];
  installed_at: string;
}

export const APM_LOCKFILE = 'apm.lock.yaml';

export function readApmLockfile(text: string): ApmLockfile | null {
  try {
    const parsed = parseYamlish(text);
    if (!parsed || parsed.version !== '0.2') return null;
    return parsed as unknown as ApmLockfile;
  } catch {
    return null;
  }
}

export function serializeApmLockfile(lock: ApmLockfile): string {
  const lines: string[] = ['version: 0.2', '', 'packages:'];
  for (const [name, pkg] of Object.entries(lock.packages).sort(([a], [b]) => a.localeCompare(b))) {
    lines.push(`  ${name}:`);
    lines.push(`    source: ${pkg.source}`);
    if (pkg.ref) lines.push(`    ref: ${pkg.ref}`);
    lines.push(`    resolved_commit: ${pkg.resolved_commit}`);
    lines.push(`    content_hash: ${pkg.content_hash}`);
    lines.push(`    installed_at: ${pkg.installed_at}`);
    lines.push('    deployed_files:');
    for (const file of pkg.deployed_files) {
      lines.push(`      - ${file}`);
    }
  }
  return lines.join('\n') + '\n';
}

async function listDeployedFiles(dir: string): Promise<string[]> {
  const files: string[] = [];
  const walk = async (current: string, rel: string): Promise<void> => {
    const entries = (await fs.readdir(current, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name));
    for (const entry of entries) {
      if (entry.name === '.git') continue;
      const entryRel = rel ? path.join(rel, entry.name) : entry.name;
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) {
        await walk(full, entryRel);
      } else if (entry.isFile()) {
        files.push(entryRel.split(path.sep).join('/'));
      }
    }
  };
  await walk(dir, '');
  return files;
}

export async function writeApmLockfile(
  lockPath: string,
  packageName: string,
  source: string,
  ref: string | undefined,
  commit: string,
  pluginDir: string,
): Promise<void> {
  const [contentHash, deployedFiles] = await Promise.all([
    contentHashOfDir(pluginDir),
    listDeployedFiles(pluginDir),
  ]);

  const lock: ApmLockfile = {
    version: '0.2',
    packages: {
      [packageName]: {
        source,
        ...(ref !== undefined ? { ref } : {}),
        resolved_commit: commit,
        content_hash: contentHash,
        deployed_files: deployedFiles,
        installed_at: new Date().toISOString(),
      },
    },
  };

  await fs.writeFile(lockPath, serializeApmLockfile(lock), 'utf8');
}

/** Minimal YAML subset for apm.lock.yaml — no external deps. */
export function parseYamlish(text: string): Record<string, unknown> | null {
  const out: Record<string, unknown> = {};
  const lines = text.split('\n');
  const indentStack: Array<{ indent: number; key: string; parent: Record<string, unknown> }> = [];

  for (const rawLine of lines) {
    if (!rawLine.trim() || rawLine.trim().startsWith('#')) continue;
    const indent = rawLine.match(/^\s*/)?.[0].length ?? 0;
    const trimmed = rawLine.trim();
    if (trimmed.startsWith('- ')) {
      const parent = indentStack[indentStack.length - 1];
      if (parent) {
        const existing = parent.parent[parent.key];
        let arr: unknown[];
        if (Array.isArray(existing)) {
          arr = existing;
        } else if (existing && typeof existing === 'object' && Object.keys(existing).length === 0) {
          arr = [];
        } else {
          arr = [];
        }
        arr.push(scalar(trimmed.slice(2)));
        parent.parent[parent.key] = arr;
      }
      continue;
    }
    const colon = trimmed.indexOf(':');
    if (colon <= 0) continue;
    const key = trimmed.slice(0, colon).trim();
    const value = trimmed.slice(colon + 1).trim();

    while (indentStack.length > 0) {
      const top = indentStack[indentStack.length - 1];
      if (!top || top.indent < indent) break;
      indentStack.pop();
    }

    let target = out;
    if (indentStack.length > 0) {
      const parent = indentStack[indentStack.length - 1];
      if (parent) {
        const parentVal = parent.parent[parent.key];
        if (Array.isArray(parentVal)) {
          const last = parentVal[parentVal.length - 1];
          if (last && typeof last === 'object') {
            target = last as Record<string, unknown>;
          }
        } else if (parentVal && typeof parentVal === 'object') {
          target = parentVal as Record<string, unknown>;
        }
      }
    }

    if (value === '') {
      const child: Record<string, unknown> = {};
      target[key] = child;
      indentStack.push({ indent, key, parent: target });
    } else {
      target[key] = scalar(value);
    }
  }

  return out;
}

function scalar(value: string): string | boolean | number {
  if (value === 'true') return true;
  if (value === 'false') return false;
  if (/^-?\d+$/.test(value)) return Number(value);
  return value;
}
