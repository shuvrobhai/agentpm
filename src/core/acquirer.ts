import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { GlobalStore } from './store.js';
import { agentpmFetchCacheDir } from './config.js';
import { convertDirToPortableCore, writePortableCore } from './portable-writer.js';
import { parsePlugin } from '../parser/index.js';
import { toPortableCore } from '../ir/to-portable-core.js';
import type { ParsedRepo } from './store.js';
import type { PluginIR, PortableCoreIR } from '../ir/types.js';

export interface ConvertSourceResult {
  success: boolean;
  target: string;
  outputDir: string;
  ir: PluginIR;
  portableCore: PortableCoreIR;
  files?: string[];
  warnings?: string[];
  manualSteps?: string[];
  manifest?: unknown;
  skillsCount?: number;
  mcpCount?: number;
}

export interface InspectSourceResult {
  source: string;
  ir: PluginIR;
  portableCore: PortableCoreIR;
  summary: {
    skills: number;
    commands: number;
    agents: number;
    rules: number;
    contextFile: number;
    hooks: number;
    mcpServers: number;
    outputStyles: number;
    workflows: number;
  };
}

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

export interface AcquiredClone {
  dir: string;
  commit: string;
  pluginDir: string;
}

export interface AcquireOptions {
  force?: boolean | undefined;
  ref?: string | undefined;
  subfolder?: string | undefined;
  /** Clone into a disposable temp dir instead of the store; the result carries a cleanup(). */
  temp?: boolean | undefined;
}

export interface AcquiredPackage {
  pluginName: string;
  namespace: string;
  version: string;
  sourceType: 'local' | 'git' | 'store';
  sourcePath: string;
  clonePath?: string | undefined;
  commit?: string | undefined;
  contentHash?: string | undefined;
  alreadyExisted?: boolean | undefined;
  vendor?: string | undefined;
  /** Present when acquired in temp mode; removes the temp clone. */
  cleanup?: (() => Promise<void>) | undefined;
}

async function detectSourceVendor(dir: string): Promise<string> {
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

export class Acquirer {
  static async acquire(spec: string, options: AcquireOptions = {}): Promise<AcquiredPackage> {
    const rawTrimmed = spec.trim();

    if (rawTrimmed.startsWith('/') || rawTrimmed.startsWith('./') || rawTrimmed.startsWith('../') || rawTrimmed === '.') {
      const absPath = path.resolve(rawTrimmed);
      const exists = await fs.access(absPath).then(() => true).catch(() => false);
      if (exists) {
        const stat = await fs.stat(absPath);
        if (stat.isDirectory()) {
          const pluginName = path.basename(absPath);
          return {
            pluginName,
            namespace: 'local',
            version: 'workspace',
            sourceType: 'local',
            sourcePath: absPath,
            alreadyExisted: true,
          };
        }
      }
    }

    const parsed = GlobalStore.parseRepoIdentifier(spec);
    if (options.ref) parsed.ref = options.ref;
    if (options.subfolder) parsed.subfolder = options.subfolder;

    // Security assertions
    if (parsed.ref && parsed.ref.startsWith('-')) {
      throw new Error(`Invalid git ref "${parsed.ref}": refs must not start with a dash (-)`);
    }
    if (parsed.subfolder && (parsed.subfolder.includes('..') || path.isAbsolute(parsed.subfolder))) {
      throw new Error(`Invalid subfolder path "${parsed.subfolder}": path traversal forbidden`);
    }

    if (options.temp) {
      return this.acquireTemporary(parsed);
    }

    return this.fetchPlugin(parsed, options.force);
  }

  static async convertSource(
    source: string,
    target = 'agent-plugins',
    outputDir?: string
  ): Promise<ConvertSourceResult> {
    const ir = await parsePlugin(source);
    const portableCore = toPortableCore(ir);
    const PORTABLE_TARGETS = new Set(['agent-plugins', 'v1', 'portable']);

    const outDir = outputDir || `./dist/converted/${target}/${path.basename(source)}`;

    if (PORTABLE_TARGETS.has(target)) {
      await writePortableCore(portableCore, outDir);
      return {
        success: true,
        target: 'Agent Plugins v1 (Portable)',
        outputDir: outDir,
        ir,
        portableCore,
        manifest: portableCore.metadata,
        skillsCount: portableCore.skills.length,
        mcpCount: portableCore.mcpServers.length,
      };
    }

    const { getAdapter } = await import('../adapters/index.js');
    const adapter = getAdapter(target);
    const conversionResult = adapter.convert(portableCore, 'workspace');

    if (outputDir) {
      const { writeConversion } = await import('../adapters/convert-writer.js');
      await writeConversion(portableCore, adapter, outputDir);
    }

    return {
      success: true,
      target: adapter.displayName || adapter.name,
      outputDir: outDir,
      ir,
      portableCore,
      files: conversionResult.files.map(f => f.relativePath),
      warnings: conversionResult.warnings,
      manualSteps: conversionResult.manualSteps,
    };
  }

  static async inspectSource(source: string): Promise<InspectSourceResult> {
    const ir = await parsePlugin(source);
    const portableCore = toPortableCore(ir);
    const summary = {
      skills: ir.skills.length,
      commands: ir.commands.length,
      agents: ir.agents.length,
      rules: ir.rules.length,
      contextFile: ir.contextFile ? 1 : 0,
      hooks: ir.hooks.length,
      mcpServers: ir.mcpServers.length,
      outputStyles: ir.outputStyles.length,
      workflows: ir.workflows.length,
    };
    return {
      source,
      ir,
      portableCore,
      summary,
    };
  }

  static async update(spec: string, options: AcquireOptions = {}): Promise<AcquiredPackage> {
    const registry = await GlobalStore.readRegistry();
    const parsed = GlobalStore.parseRepoIdentifier(spec);
    const key = `${parsed.namespace}/${parsed.pluginName}`;
    const registryEntry = registry.packages[key];

    if (registryEntry) {
      if (!options.ref && registryEntry.ref) {
        parsed.ref = registryEntry.ref;
      }
      if (!options.subfolder && registryEntry.subfolder) {
        parsed.subfolder = registryEntry.subfolder;
      }
    }

    if (options.ref) parsed.ref = options.ref;
    if (options.subfolder) parsed.subfolder = options.subfolder;

    if (!options.force && registryEntry && registryEntry.resolved_commit) {
      try {
        let remoteCommit = '';
        if (COMMIT_SHA_REGEX.test(parsed.ref || '')) {
          remoteCommit = parsed.ref!;
        } else {
          const lsOut = await runGit(['ls-remote', parsed.cloneUrl, parsed.ref || 'HEAD']);
          if (lsOut) {
            const firstLine = lsOut.split('\n')[0];
            const sha = firstLine?.split(/\s+/)[0];
            if (sha && COMMIT_SHA_REGEX.test(sha)) {
              remoteCommit = sha;
            }
          }
        }

        if (remoteCommit && remoteCommit === registryEntry.resolved_commit) {
          const version = parsed.ref || 'latest';
          const targetPath = GlobalStore.getPluginPath(parsed.namespace, parsed.pluginName, version);
          const exists = await fs.access(targetPath).then(() => true).catch(() => false);
          if (exists) {
            return {
              pluginName: parsed.pluginName,
              namespace: parsed.namespace,
              version,
              sourceType: 'git',
              sourcePath: targetPath,
              commit: remoteCommit,
              alreadyExisted: true,
              vendor: registryEntry.source_vendor,
            };
          }
        }
      } catch {
        // Fall through to fetchPlugin if git ls-remote fails
      }
    }

    return this.fetchPlugin(parsed, true);
  }

  private static async acquireTemporary(parsed: ParsedRepo): Promise<AcquiredPackage> {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'agentpm-acquire-'));
    const cloneDir = path.join(tempDir, 'repo');
    const cleanup = async (): Promise<void> => {
      await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
    };
    try {
      const acquired = await cloneRepo(parsed, cloneDir);
      return {
        pluginName: parsed.pluginName,
        namespace: parsed.namespace,
        version: parsed.ref || 'latest',
        sourceType: 'git',
        sourcePath: acquired.pluginDir,
        commit: acquired.commit,
        cleanup,
      };
    } catch (err) {
      await cleanup();
      throw err;
    }
  }

  static async fetchPlugin(parsed: ParsedRepo, force = false): Promise<AcquiredPackage> {
    const version = parsed.ref || 'latest';
    const targetPath = GlobalStore.getPluginPath(parsed.namespace, parsed.pluginName, version);

    const exists = await fs.access(targetPath).then(() => true).catch(() => false);

    if (exists && !force) {
      return {
        pluginName: parsed.pluginName,
        namespace: parsed.namespace,
        version,
        sourceType: 'git',
        sourcePath: targetPath,
        alreadyExisted: true,
      };
    }

    if (exists && force) {
      await fs.rm(targetPath, { recursive: true, force: true });
    }

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
    }

    // Pristine tier: mirror pristine clone into repos/<namespace>/<plugin>
    await fs.rm(repoDir, { recursive: true, force: true }).catch(() => {});
    await GlobalStore.copyDirectoryDereferenced(pluginSourceDir, repoDir).catch(() => {});

    const vendor = await detectSourceVendor(pluginSourceDir);

    // Convert pristine source -> portable core in store plugin dir
    await fs.rm(targetPath, { recursive: true, force: true }).catch(() => {});
    await convertDirToPortableCore(pluginSourceDir, targetPath);

    // Single hashing per operation
    const contentHash = await contentHashOfDir(targetPath);
    const deployedFiles = await listDeployedFiles(targetPath);

    // Assembly of source-registry.json entry behind Acquirer seam; failures propagate
    await GlobalStore.updateRegistry(`${parsed.namespace}/${parsed.pluginName}`, {
      source: parsed.cloneUrl,
      ...(parsed.ref ? { ref: parsed.ref } : {}),
      ...(parsed.subfolder ? { subfolder: parsed.subfolder } : {}),
      resolved_commit: commit,
      content_hash: contentHash,
      source_vendor: vendor,
      installed_at: new Date().toISOString(),
      clone_path: repoDir,
      extracted_path: targetPath,
      deployed_files: deployedFiles,
    });

    await writeApmLockfile(
      path.join(targetPath, APM_LOCKFILE),
      parsed.pluginName,
      parsed.cloneUrl,
      parsed.ref,
      commit,
      targetPath,
      contentHash,
      deployedFiles,
    );

    return {
      pluginName: parsed.pluginName,
      namespace: parsed.namespace,
      version,
      sourceType: 'git',
      sourcePath: targetPath,
      clonePath: repoDir,
      commit,
      alreadyExisted: false,
      vendor,
    };
  }
}

export async function cloneRepo(parsed: ParsedRepo, targetDir: string): Promise<AcquiredClone> {
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

export async function writeApmLockfile(
  lockPath: string,
  packageName: string,
  source: string,
  ref: string | undefined,
  commit: string,
  pluginDir: string,
  precomputedHash?: string,
  precomputedFiles?: string[],
): Promise<void> {
  const [contentHash, deployedFiles] = await Promise.all([
    precomputedHash !== undefined ? Promise.resolve(precomputedHash) : contentHashOfDir(pluginDir),
    precomputedFiles !== undefined ? Promise.resolve(precomputedFiles) : listDeployedFiles(pluginDir),
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
