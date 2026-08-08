import fs from 'node:fs/promises';
import path from 'node:path';
import type { PortableCoreIR } from '../ir/types.js';
import { parsePlugin } from '../parser/index.js';
import { toPortableCore } from '../ir/to-portable-core.js';
import { formatAgentSkill } from '../ir/skill-format.js';
import { PLUGIN_SCHEMA_URL, MCP_SCHEMA_URL, sanitizePluginName } from './v1-manifest.js';

/**
 * The single seam for store writes (ADR 0013 Q8/Q11): `add`, `use`, and
 * `update` all route a local source directory through parse → portable core →
 * portable v1 emit. Native materialization derives from the store on demand.
 */
export async function convertDirToPortableCore(sourceDir: string, outputDir: string): Promise<void> {
  const ir = await parsePlugin(sourceDir);
  await writePortableCore(toPortableCore(ir), outputDir);
}

/**
 * Writes a PortableCoreIR as a portable Agent Plugins v1 package (ADR 0013).
 * Emits the closed-schema root plugin.json, skills/<name>/SKILL.md, and a root
 * mcp.json with explicit transports. The source client's original package is
 * preserved whole in a sibling client-adapters/<client>/ directory — never a
 * namespace invented inside the portable package.
 */
export async function writePortableCore(ir: PortableCoreIR, outputDir: string): Promise<void> {
  await fs.mkdir(outputDir, { recursive: true });

  await writeManifest(ir, outputDir);

  for (const skill of ir.skills) {
    const skillDir = path.join(outputDir, 'skills', skill.name);
    await fs.mkdir(skillDir, { recursive: true });
    await fs.writeFile(path.join(skillDir, 'SKILL.md'), formatAgentSkill(skill), 'utf8');
  }

  if (ir.mcpServers.length > 0) {
    const mcp: Record<string, unknown> = {};
    for (const server of ir.mcpServers) {
      const entry: Record<string, unknown> = { type: server.type };
      if (server.command !== undefined) entry.command = server.command;
      if (server.args !== undefined) entry.args = server.args;
      if (server.env !== undefined) entry.env = server.env;
      if (server.cwd !== undefined) entry.cwd = server.cwd;
      if (server.url !== undefined) entry.url = server.url;
      if (server.headers !== undefined) entry.headers = server.headers;
      mcp[server.name] = entry;
    }
    await fs.writeFile(
      path.join(outputDir, 'mcp.json'),
      JSON.stringify({ $schema: MCP_SCHEMA_URL, mcpServers: mcp }, null, 2) + '\n',
      'utf8',
    );
  }

  await preserveSourceClient(ir, outputDir);

  const fileCount = await countFiles(outputDir);
  console.log(
    `✅ Emitted portable v1 core: plugin.json + ${ir.skills.length} skill(s) to ${outputDir} ` +
      `(${fileCount} files incl. preserved client-adapters)`,
  );
}

async function countFiles(dir: string): Promise<number> {
  let count = 0;
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) count += await countFiles(full);
    else if (entry.isFile()) count++;
  }
  return count;
}

async function writeManifest(ir: PortableCoreIR, outputDir: string): Promise<void> {
  const fallbackName = ir.source.pluginName;
  const metadata = ir.metadata ?? {};

  const manifest: Record<string, unknown> = {
    $schema: PLUGIN_SCHEMA_URL,
    name: sanitizePluginName(String(metadata.name ?? ''), fallbackName),
  };

  for (const key of ['version', 'description', 'homepage', 'repository', 'license'] as const) {
    const value = metadata[key];
    if (typeof value === 'string') manifest[key] = value;
  }

  if (metadata.author && typeof metadata.author === 'object') {
    manifest.author = metadata.author;
  }
  if (Array.isArray(metadata.keywords)) {
    manifest.keywords = metadata.keywords.filter((k): k is string => typeof k === 'string');
  }

  await fs.writeFile(
    path.join(outputDir, 'plugin.json'),
    JSON.stringify(manifest, null, 2) + '\n',
    'utf8',
  );
}

async function preserveSourceClient(ir: PortableCoreIR, outputDir: string): Promise<void> {
  const sourcePath = ir.source.resolvedPath;
  if (!sourcePath) return;

  const stat = await fs.stat(sourcePath).catch(() => null);
  if (!stat || !stat.isDirectory()) return;

  const clientName = sourceClientName(ir);
  const targetDir = path.join(outputDir, 'client-adapters', clientName);

  const statTarget = await fs.stat(targetDir).catch(() => null);
  if (statTarget) return;

  await copyTree(sourcePath, targetDir);
}

function sourceClientName(ir: PortableCoreIR): string {
  const original = ir.source.originalInput || '';
  if (/\.claude-plugin/.test(original)) return 'claude-code';
  if (/codex/.test(original)) return 'codex';
  if (/opencode/.test(original)) return 'opencode';
  return sanitizePluginName(ir.source.pluginName || ir.source.type, 'source');
}

const PRESERVATION_SKIP = new Set(['.git', 'node_modules', 'dist', '.cache', 'coverage', '.turbo', '.next', '.DS_Store']);

async function copyTree(src: string, dest: string): Promise<void> {
  await copyTreeInternal(src, dest, new Set());
}

async function copyTreeInternal(src: string, dest: string, visited: Set<string>): Promise<void> {
  await fs.mkdir(dest, { recursive: true });
  const entries = await fs.readdir(src, { withFileTypes: true });
  for (const entry of entries) {
    if (PRESERVATION_SKIP.has(entry.name)) continue;
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      await copyTreeInternal(srcPath, destPath, visited);
    } else if (entry.isFile()) {
      await fs.copyFile(srcPath, destPath);
    } else if (entry.isSymbolicLink()) {
      // Resolve symlinks so we copy the target contents rather than the link.
      // Skip special files (sockets, FIFOs, devices) that copyFile cannot read,
      // and guard against symlink cycles pointing back into the source tree.
      const real = await fs.realpath(srcPath).catch(() => null);
      if (!real) continue;
      if (visited.has(real)) continue;
      visited.add(real);
      const stat = await fs.stat(srcPath).catch(() => null);
      if (!stat) continue;
      if (stat.isDirectory()) {
        await copyTreeInternal(srcPath, destPath, visited);
      } else if (stat.isFile()) {
        await fs.copyFile(srcPath, destPath);
      }
    }
  }
}
