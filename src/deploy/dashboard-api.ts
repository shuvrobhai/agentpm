import { Router } from 'express';
import path from 'node:path';
import fs from 'node:fs/promises';
import os from 'node:os';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

import { Acquirer } from '../core/acquirer.js';
import { listAdapters, AdapterRegistry } from '../adapters/index.js';
import { GlobalStore } from '../core/store.js';
import { DocsEngine } from './docs-engine.js';
import { PROVIDER_SPECS } from './provider-specs.js';
import { inspectProviders } from './provider-inspector.js';

const execFileAsync = promisify(execFile);

export interface InstalledPluginSample {
  name: string;
  path: string;
  description: string;
  source: string;
}

export async function getRealPluginsList(): Promise<InstalledPluginSample[]> {
  const result: InstalledPluginSample[] = [];

  const candidateDirs = [
    { label: 'antigravity', dir: path.join(os.homedir(), '.gemini', 'config', 'plugins') },
    { label: 'codex', dir: path.join(os.homedir(), '.codex', 'plugins', 'cache', 'personal') },
    { label: 'codex', dir: path.join(os.homedir(), '.codex', 'plugins', 'cache', 'openai-bundled') },
    { label: 'codex-skills', dir: path.join(os.homedir(), '.codex', 'skills') },
    { label: 'claude-code', dir: path.join(os.homedir(), '.claude', 'plugins') },
    { label: 'opencode', dir: path.join(os.homedir(), '.config', 'opencode', 'plugins') },
    { label: 'workspace', dir: path.join(process.cwd(), '.agents', 'plugins') },
  ];

  for (const item of candidateDirs) {
    try {
      const entries = await fs.readdir(item.dir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.name.startsWith('.')) continue;
        if (entry.isDirectory() || entry.isSymbolicLink()) {
          const pluginPath = path.join(item.dir, entry.name);

          // Check if versioned subdirectory exists (e.g. plugin/2026.7.0/.codex-plugin)
          const subEntries = await fs.readdir(pluginPath, { withFileTypes: true }).catch(() => []);
          const versionDir = subEntries.find((s) => (s.isDirectory() || s.isSymbolicLink()) && !s.name.startsWith('.'));
          if (versionDir) {
            const versionPath = path.join(pluginPath, versionDir.name);
            const hasPluginManifest = await fs.access(path.join(versionPath, '.codex-plugin')).then(() => true).catch(() => false) ||
                                     await fs.access(path.join(versionPath, 'plugin.json')).then(() => true).catch(() => false);
            if (hasPluginManifest) {
              result.push({
                name: `${item.label}/${entry.name}@${versionDir.name}`,
                path: versionPath,
                description: `Installed ${item.label} plugin version ${versionDir.name}`,
                source: item.label,
              });
              continue;
            }
          }

          result.push({
            name: `${item.label}/${entry.name}`,
            path: pluginPath,
            description: `Installed ${item.label} plugin: ${entry.name}`,
            source: item.label,
          });
        }
      }
    } catch {
      // directory may not exist
    }
  }

  // Include self plugin
  result.push({
    name: 'agentpm-self',
    path: '.',
    description: 'Root AgentPM Conforming Portable v1 Plugin',
    source: 'workspace',
  });

  return result;
}

interface PluginDetectResult {
  isPlugin: boolean;
  type?: string | undefined;
  details?: string | undefined;
}

async function detectPluginInfo(dirPath: string): Promise<PluginDetectResult> {
  try {
    const files = await fs.readdir(dirPath);
    const fileSet = new Set(files);

    if (fileSet.has('plugin.json')) {
      return { isPlugin: true, type: 'portable', details: 'Agent Plugins v1 (plugin.json)' };
    }
    if (fileSet.has('.claude-plugin')) {
      return { isPlugin: true, type: 'claude-code', details: 'Claude Code (.claude-plugin)' };
    }
    if (fileSet.has('.codex-plugin')) {
      return { isPlugin: true, type: 'codex', details: 'OpenAI Codex (.codex-plugin)' };
    }
    if (fileSet.has('.opencode') || fileSet.has('opencode.json')) {
      return { isPlugin: true, type: 'opencode', details: 'OpenCode AI' };
    }
    if (fileSet.has('.gemini')) {
      return { isPlugin: true, type: 'antigravity', details: 'Antigravity (.gemini)' };
    }
    if (fileSet.has('SKILL.md')) {
      return { isPlugin: true, type: 'skill', details: 'Single Skill (SKILL.md)' };
    }
    if (fileSet.has('skills')) {
      return { isPlugin: true, type: 'skills-bundle', details: 'Skills Bundle (skills/)' };
    }
    if (fileSet.has('.agents')) {
      return { isPlugin: true, type: 'agents', details: 'Agents Workspace (.agents/)' };
    }
    if (fileSet.has('rules') || fileSet.has('agents') || fileSet.has('hooks.json')) {
      return { isPlugin: true, type: 'components', details: 'Agent Components Directory' };
    }

    // Check if subfolder has version with .codex-plugin or plugin.json
    for (const f of files) {
      if (f.startsWith('.')) continue;
      const subPath = path.join(dirPath, f);
      const isDir = await fs.stat(subPath).then((s) => s.isDirectory()).catch(() => false);
      if (isDir) {
        const subFiles: string[] = await fs.readdir(subPath).catch(() => []);
        if (subFiles.includes('.codex-plugin') || subFiles.includes('plugin.json')) {
          return { isPlugin: true, type: 'codex', details: `OpenAI Codex Versioned Plugin (${f})` };
        }
      }
    }

    // Check parent directory context for provider plugin roots
    const parentDir = path.dirname(dirPath);
    const geminiPlugins = path.join(os.homedir(), '.gemini', 'config', 'plugins');
    const codexPlugins = path.join(os.homedir(), '.codex', 'plugins');
    const codexPersonal = path.join(os.homedir(), '.codex', 'plugins', 'cache', 'personal');
    const codexBundled = path.join(os.homedir(), '.codex', 'plugins', 'cache', 'openai-bundled');
    const claudePlugins = path.join(os.homedir(), '.claude', 'plugins');
    const opencodePlugins = path.join(os.homedir(), '.config', 'opencode', 'plugins');
    const workspacePlugins = path.resolve('.agents/plugins');

    if (parentDir === geminiPlugins) {
      return { isPlugin: true, type: 'antigravity', details: 'Google Antigravity Plugin (~/.gemini/config/plugins)' };
    }
    if (parentDir === codexPlugins || parentDir === codexPersonal || parentDir === codexBundled) {
      return { isPlugin: true, type: 'codex', details: 'OpenAI Codex Plugin (~/.codex/plugins)' };
    }
    if (parentDir === claudePlugins) {
      return { isPlugin: true, type: 'claude-code', details: 'Claude Code Plugin (~/.claude/plugins)' };
    }
    if (parentDir === opencodePlugins) {
      return { isPlugin: true, type: 'opencode', details: 'OpenCode AI Plugin (~/.config/opencode/plugins)' };
    }
    if (parentDir === workspacePlugins) {
      return { isPlugin: true, type: 'workspace', details: 'Workspace Materialized Plugin (.agents/plugins)' };
    }

    return { isPlugin: false };
  } catch {
    return { isPlugin: false };
  }
}

function tokenizeArgs(cmdString: string): string[] {
  const args: string[] = [];
  let current = '';
  let inDouble = false;
  let inSingle = false;

  for (let i = 0; i < cmdString.length; i++) {
    const char = cmdString[i];
    if (char === undefined) continue;
    if (char === '"' && !inSingle) {
      inDouble = !inDouble;
    } else if (char === "'" && !inDouble) {
      inSingle = !inSingle;
    } else if (/\s/.test(char) && !inDouble && !inSingle) {
      if (current.length > 0) {
        args.push(current);
        current = '';
      }
    } else {
      current += char;
    }
  }
  if (current.length > 0) {
    args.push(current);
  }
  return args;
}

export function createDashboardApiRouter(): Router {
  const router = Router();

  // System Status & Adapters
  router.get('/status', async (_req, res) => {
    try {
      const adapters = listAdapters();
      const storeRoot = GlobalStore.getStorePath();
      const globalPlugins = await GlobalStore.listGlobalPlugins();
      const samples = await getRealPluginsList();
      res.json({
        status: 'online',
        version: '0.2.0',
        storeRoot,
        adapters,
        globalPluginsCount: globalPlugins.length,
        samplePluginsCount: samples.length,
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Sample & Installed Plugins List
  router.get('/samples', async (_req, res) => {
    try {
      const samples = await getRealPluginsList();
      res.json({ samples });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // File System Directory Browser
  router.get('/fs/browse', async (req, res) => {
    try {
      let targetDir = (req.query.dir as string) || '.';
      if (targetDir.startsWith('~')) {
        targetDir = path.join(os.homedir(), targetDir.slice(1));
      }

      const resolvedPath = path.resolve(targetDir);
      let stat;
      try {
        stat = await fs.stat(resolvedPath);
      } catch {
        return res.status(404).json({
          error: `Directory does not exist: ${resolvedPath}`,
          resolvedPath,
          workspacePath: process.cwd(),
          homePath: os.homedir(),
        });
      }

      if (!stat.isDirectory()) {
        return res.status(400).json({ error: `Path is not a directory: ${resolvedPath}` });
      }

      const rawEntries = await fs.readdir(resolvedPath, { withFileTypes: true });
      const currentPluginInfo = await detectPluginInfo(resolvedPath);

      const entries = await Promise.all(
        rawEntries.map(async (entry) => {
          const fullPath = path.join(resolvedPath, entry.name);
          let relativePath = path.relative(process.cwd(), fullPath) || '.';
          if (!relativePath.startsWith('.') && !path.isAbsolute(relativePath)) {
            relativePath = `./${relativePath}`;
          }

          const isDirectory = entry.isDirectory();
          let pluginInfo: PluginDetectResult = { isPlugin: false };

          if (isDirectory) {
            pluginInfo = await detectPluginInfo(fullPath);
          }

          return {
            name: entry.name,
            fullPath,
            relativePath,
            isDirectory,
            isPlugin: pluginInfo.isPlugin,
            pluginType: pluginInfo.type,
            pluginDetails: pluginInfo.details,
          };
        })
      );

      entries.sort((a, b) => {
        if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1;
        if (a.isPlugin !== b.isPlugin) return a.isPlugin ? -1 : 1;
        return a.name.localeCompare(b.name);
      });

      const parentPath = path.dirname(resolvedPath);

      res.json({
        currentPath: resolvedPath,
        displayPath: path.relative(process.cwd(), resolvedPath) || '.',
        parentPath: parentPath !== resolvedPath ? parentPath : null,
        workspacePath: process.cwd(),
        homePath: os.homedir(),
        isCurrentPlugin: currentPluginInfo.isPlugin,
        currentPluginDetails: currentPluginInfo.details,
        entries,
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to browse filesystem' });
    }
  });

  // Inspect Plugin
  router.post('/inspect', async (req, res) => {
    const { source } = req.body;
    if (!source) {
      return res.status(400).json({ error: 'Source path is required' });
    }

    try {
      const result = await Acquirer.inspectSource(source);
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to inspect plugin' });
    }
  });

  // Convert Plugin
  router.post('/convert', async (req, res) => {
    const { source, target, outputDir } = req.body;
    if (!source || !target) {
      return res.status(400).json({ error: 'Source and target adapter are required' });
    }

    try {
      const result = await Acquirer.convertSource(source, target, outputDir);

      if (target === 'agent-plugins' || target === 'portable' || target === 'v1') {
        return res.json({
          success: true,
          target: result.target,
          outputDir: result.outputDir,
          manifest: result.manifest,
          skillsCount: result.skillsCount,
          mcpCount: result.mcpCount,
        });
      }

      res.json({
        success: true,
        target: result.target,
        outputDir: result.outputDir,
        files: result.files || [],
        warnings: result.warnings || [],
        manualSteps: result.manualSteps || [],
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to convert plugin' });
    }
  });

  // Global & Workspace Store
  router.get('/store', async (_req, res) => {
    try {
      const globalPlugins = await GlobalStore.listGlobalPlugins();
      const workspaceDir = path.resolve('.agents/plugins');
      let workspacePlugins: string[] = [];
      try {
        const entries = await fs.readdir(workspaceDir, { withFileTypes: true });
        workspacePlugins = entries.filter((e) => e.isDirectory() || e.isSymbolicLink()).map((e) => e.name);
      } catch {
        // directory may not exist
      }

      res.json({
        globalStoreRoot: GlobalStore.getStorePath(),
        globalPlugins,
        workspacePlugins,
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Doctor Diagnostics
  router.get('/doctor', async (_req, res) => {
    try {
      const adapters = AdapterRegistry.all();
      const reports = await Promise.all(
        adapters.map(async (adapter) => {
          const health = await adapter.checkHealth();
          let activePlugins: unknown[] = [];
          try {
            activePlugins = await adapter.findActive();
          } catch {
            // find active failed
          }
          return {
            adapter: adapter.displayName || adapter.name,
            health,
            activePlugins,
          };
        })
      );

      res.json({ reports });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Provider Matrix & Disk Inspection
  router.get('/providers', async (_req, res) => {
    try {
      new DocsEngine();
      const matrix = PROVIDER_SPECS;

      const providers = ['antigravity', 'claude-code', 'codex', 'opencode', 'agent-plugins'];
      const diskInspections = await Promise.all(
        providers.map(async (p) => ({
          provider: p,
          inspection: await inspectProviders(p),
        }))
      );

      res.json({
        matrix,
        diskInspections,
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // CLI Command Execution
  router.post('/cli', async (req, res) => {
    const { command } = req.body;
    if (!command || typeof command !== 'string') {
      return res.status(400).json({ error: 'Command string is required' });
    }

    let rawCmd = command.trim();
    if (rawCmd.startsWith('plugins ')) {
      rawCmd = rawCmd.slice(8).trim();
    } else if (rawCmd === 'plugins') {
      rawCmd = '';
    } else if (rawCmd.startsWith('agentpm ')) {
      rawCmd = rawCmd.slice(8).trim();
    } else if (rawCmd === 'agentpm') {
      rawCmd = '';
    } else if (rawCmd.startsWith('npx tsx src/index.ts ')) {
      rawCmd = rawCmd.slice(21).trim();
    } else if (rawCmd === 'npx tsx src/index.ts') {
      rawCmd = '';
    }

    const parsedArgs = tokenizeArgs(rawCmd);

    try {
      const { stdout, stderr } = await execFileAsync('npx', ['tsx', 'src/index.ts', ...parsedArgs], { cwd: process.cwd() });
      res.json({ stdout, stderr, exitCode: 0 });
    } catch (err: any) {
      res.json({
        stdout: err.stdout || '',
        stderr: err.stderr || err.message,
        exitCode: err.code || 1,
      });
    }
  });

  return router;
}
