import express from 'express';
import path from 'node:path';
import fs from 'node:fs/promises';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

import { parsePlugin } from './src/parser/index.js';
import { toPortableCore } from './src/ir/to-portable-core.js';
import { getAdapter, listAdapters, AdapterRegistry } from './src/adapters/index.js';
import { convertDirToPortableCore, writePortableCore } from './src/core/portable-writer.js';
import { writeConversion } from './src/adapters/convert-writer.js';
import { GlobalStore } from './src/core/store.js';
import { MaterializationEngine } from './src/core/materialization.js';
import { DocsEngine } from './src/deploy/docs-engine.js';
import { PROVIDER_SPECS } from './src/deploy/provider-specs.js';
import { inspectProviders } from './src/deploy/provider-inspector.js';

const execFileAsync = promisify(execFile);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || '0.0.0.0';

app.use(express.json());

// Sample plugins available in the workspace repository
const SAMPLE_PLUGINS = [
  {
    name: 'codex/imagegen',
    path: './resource/codex/imagegen',
    description: 'Codex Image Generation Skill & Agent with DALL-E reference scripts'
  },
  {
    name: 'codex/openai-docs',
    path: './resource/codex/openai-docs',
    description: 'OpenAI Docs & Model Info Skill with reference scripts'
  },
  {
    name: 'codex/plugin-creator',
    path: './resource/codex/plugin-creator',
    description: 'Codex Plugin Creator Skill with validation scripts'
  },
  {
    name: 'codex/review-agent',
    path: './resource/codex/review-agent',
    description: 'Codex Code Review Agent skill'
  },
  {
    name: 'codex/skill-creator',
    path: './resource/codex/skill-creator',
    description: 'Codex Skill Scaffolding and Validation plugin'
  },
  {
    name: 'codex/skill-installer',
    path: './resource/codex/skill-installer',
    description: 'Codex Skill Installer plugin'
  },
  {
    name: 'migrate-agent-plugin',
    path: './skills/migrate-agent-plugin',
    description: 'Agent Plugins Migration Skill with vendor adoption references'
  },
  {
    name: 'agentpm-self',
    path: '.',
    description: 'Root AgentPM Conforming Portable v1 Plugin'
  }
];

// --- API ROUTES ---

// System Status & Adapters
app.get('/api/status', async (req, res) => {
  try {
    const adapters = listAdapters();
    const storeRoot = GlobalStore.getStorePath();
    const globalPlugins = await GlobalStore.listGlobalPlugins();
    res.json({
      status: 'online',
      version: '0.2.0',
      storeRoot,
      adapters,
      globalPluginsCount: globalPlugins.length,
      samplePluginsCount: SAMPLE_PLUGINS.length,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Sample Plugins List
app.get('/api/samples', (req, res) => {
  res.json({ samples: SAMPLE_PLUGINS });
});

async function detectPluginInfo(dirPath: string): Promise<{ isPlugin: boolean; type?: string; details?: string }> {
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
    return { isPlugin: false };
  } catch {
    return { isPlugin: false };
  }
}

// File System Directory Browser
app.get('/api/fs/browse', async (req, res) => {
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
        let pluginInfo = { isPlugin: false, type: undefined as string | undefined, details: undefined as string | undefined };

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
app.post('/api/inspect', async (req, res) => {
  const { source } = req.body;
  if (!source) {
    return res.status(400).json({ error: 'Source path is required' });
  }

  try {
    const ir = await parsePlugin(source);
    const portableCore = toPortableCore(ir);

    // Component summary breakdown
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

    res.json({
      source,
      ir,
      portableCore,
      summary,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to inspect plugin' });
  }
});

// Convert Plugin
app.post('/api/convert', async (req, res) => {
  const { source, target, outputDir } = req.body;
  if (!source || !target) {
    return res.status(400).json({ error: 'Source and target adapter are required' });
  }

  try {
    const ir = await parsePlugin(source);
    const portableCore = toPortableCore(ir);

    const outDir = outputDir || `./dist/converted/${target}/${path.basename(source)}`;

    if (target === 'agent-plugins' || target === 'portable') {
      await writePortableCore(portableCore, outDir);
      return res.json({
        success: true,
        target: 'Agent Plugins v1 (Portable)',
        outputDir: outDir,
        manifest: portableCore.manifest,
        skillsCount: portableCore.skills.length,
        mcpCount: portableCore.mcpServers.length,
      });
    }

    const adapter = getAdapter(target);
    const conversionResult = adapter.convert(portableCore, 'workspace');

    if (outputDir) {
      await writeConversion(portableCore, adapter, outDir);
    }

    res.json({
      success: true,
      target: adapter.displayName || adapter.name,
      outputDir: outDir,
      files: conversionResult.files,
      warnings: conversionResult.warnings,
      manualSteps: conversionResult.manualSteps,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to convert plugin' });
  }
});

// Global & Workspace Store
app.get('/api/store', async (req, res) => {
  try {
    const globalPlugins = await GlobalStore.listGlobalPlugins();
    const workspaceDir = path.resolve('.agents/plugins');
    let workspacePlugins: string[] = [];
    try {
      const entries = await fs.readdir(workspaceDir, { withFileTypes: true });
      workspacePlugins = entries.filter(e => e.isDirectory() || e.isSymbolicLink()).map(e => e.name);
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
app.get('/api/doctor', async (req, res) => {
  try {
    const adapters = AdapterRegistry.all();
    const reports = await Promise.all(
      adapters.map(async (adapter) => {
        const health = await adapter.checkHealth();
        let activePlugins = [];
        try {
          activePlugins = await adapter.listActivePlugins();
        } catch {
          // list failed
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
app.get('/api/providers', async (req, res) => {
  try {
    const docsEngine = new DocsEngine();
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

function tokenizeArgs(cmdString: string): string[] {
  const args: string[] = [];
  let current = '';
  let inDouble = false;
  let inSingle = false;

  for (let i = 0; i < cmdString.length; i++) {
    const char = cmdString[i];
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

// CLI Command Execution
app.post('/api/cli', async (req, res) => {
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

// --- DASHBOARD UI ---
app.use((req, res) => {
  res.send(`<!DOCTYPE html>
<html lang="en" class="h-full bg-slate-900 text-slate-100">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>AgentPM — Cross-Agent Plugin Manager</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet">
  <script>
    tailwind.config = {
      theme: {
        extend: {
          fontFamily: {
            sans: ['"Plus Jakarta Sans"', 'sans-serif'],
            mono: ['"JetBrains Mono"', 'monospace'],
          }
        }
      }
    }
  </script>
  <style>
    body { font-family: 'Plus Jakarta Sans', sans-serif; }
    pre, code { font-family: 'JetBrains Mono', monospace; }
  </style>
</head>
<body class="h-full flex flex-col bg-slate-950 text-slate-100 antialiased selection:bg-indigo-500 selection:text-white">

  <!-- TOP HEADER -->
  <header class="border-b border-slate-800 bg-slate-900/80 backdrop-blur sticky top-0 z-50">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
      <div class="flex items-center space-x-3">
        <div class="w-9 h-9 rounded-lg bg-gradient-to-tr from-indigo-500 to-violet-500 flex items-center justify-center font-bold text-lg text-white shadow-lg shadow-indigo-500/20">
          🔌
        </div>
        <div>
          <h1 class="font-bold text-lg text-white tracking-tight leading-none flex items-center gap-2">
            AgentPM <span class="text-xs font-semibold px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">v0.2.0</span>
          </h1>
          <p class="text-xs text-slate-400">Cross-Agent Agent Plugins Manager & Conversion Engine</p>
        </div>
      </div>

      <div class="flex items-center space-x-4 text-xs font-medium">
        <div class="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700/60 text-slate-300">
          <span class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
          <span>Engine Online</span>
        </div>
        <div class="hidden md:flex items-center space-x-2 text-slate-400">
          <span>Supported:</span>
          <span class="px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-200">Antigravity</span>
          <span class="px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-200">Claude Code</span>
          <span class="px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-200">Codex</span>
          <span class="px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-200">OpenCode</span>
        </div>
      </div>
    </div>
  </header>

  <!-- NAVIGATION TABS -->
  <div class="border-b border-slate-800 bg-slate-900/40 px-4 sm:px-6 lg:px-8">
    <div class="max-w-7xl mx-auto flex space-x-1 overflow-x-auto py-2 text-sm font-medium">
      <button onclick="switchTab('inspect')" id="tab-inspect" class="tab-btn px-4 py-2 rounded-lg text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 transition flex items-center gap-2">
        <span>🔍</span> Plugin Inspector (9-IR)
      </button>
      <button onclick="switchTab('convert')" id="tab-convert" class="tab-btn px-4 py-2 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 transition flex items-center gap-2">
        <span>🔄</span> Conversion Studio
      </button>
      <button onclick="switchTab('store')" id="tab-store" class="tab-btn px-4 py-2 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 transition flex items-center gap-2">
        <span>📦</span> Store & Workspace
      </button>
      <button onclick="switchTab('doctor')" id="tab-doctor" class="tab-btn px-4 py-2 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 transition flex items-center gap-2">
        <span>🩺</span> Doctor Diagnostics
      </button>
      <button onclick="switchTab('matrix')" id="tab-matrix" class="tab-btn px-4 py-2 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 transition flex items-center gap-2">
        <span>📊</span> Provider Matrix
      </button>
      <button onclick="switchTab('cli')" id="tab-cli" class="tab-btn px-4 py-2 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 transition flex items-center gap-2">
        <span>⚡</span> CLI Console
      </button>
    </div>
  </div>

  <!-- MAIN CONTENT AREA -->
  <main class="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">

    <!-- VIEW 1: INSPECTOR -->
    <section id="view-inspect" class="space-y-6">
      <div class="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl">
        <h2 class="text-lg font-bold text-white mb-1 flex items-center gap-2">
          <span>🔍</span> Deep Plugin Inspector
        </h2>
        <p class="text-sm text-slate-400 mb-4">
          Parse any agent plugin directory or repo into the unified 9-component Normalized Intermediate Representation (IR).
        </p>

        <div class="flex flex-col sm:flex-row gap-3">
          <input id="inspect-path-input" type="text" value="./resource/codex/imagegen" placeholder="e.g. ./resource/codex/imagegen, ~/.gemini, or ." class="flex-1 bg-slate-950 border border-slate-700/80 rounded-lg px-4 py-2.5 text-sm text-slate-100 font-mono focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500" />
          <button onclick="openDirectoryPicker('inspect')" class="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 font-medium text-sm rounded-lg transition flex items-center justify-center gap-2 shrink-0">
            <span>📂 Browse Folders...</span>
          </button>
          <button onclick="runInspect()" class="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-sm rounded-lg shadow-lg shadow-indigo-600/20 transition flex items-center justify-center gap-2 shrink-0">
            <span>Parse & Inspect</span>
          </button>
        </div>

        <div class="mt-4 pt-4 border-t border-slate-800 flex flex-wrap items-center gap-2 text-xs text-slate-400">
          <span class="font-medium text-slate-300">Quick Samples:</span>
          <button onclick="selectSample('./resource/codex/imagegen')" class="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 font-mono transition">codex/imagegen</button>
          <button onclick="selectSample('./resource/codex/openai-docs')" class="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 font-mono transition">codex/openai-docs</button>
          <button onclick="selectSample('./resource/codex/plugin-creator')" class="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 font-mono transition">codex/plugin-creator</button>
          <button onclick="selectSample('./skills/migrate-agent-plugin')" class="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 font-mono transition">skills/migrate-agent-plugin</button>
          <button onclick="selectSample('.')" class="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 font-mono transition">AgentPM (Self)</button>
          <button onclick="openDirectoryPicker('inspect')" class="px-2.5 py-1 rounded bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 font-medium transition flex items-center gap-1">📂 Browse All Folders...</button>
        </div>
      </div>

      <div id="inspect-results" class="hidden space-y-6">
        <!-- Component Summary Cards Grid -->
        <div class="grid grid-cols-3 sm:grid-cols-5 md:grid-cols-9 gap-3">
          <div class="bg-slate-900 border border-slate-800 rounded-lg p-3 text-center">
            <div class="text-xs text-slate-400 font-medium">Skills</div>
            <div id="summary-skills" class="text-xl font-bold text-indigo-400 mt-1">0</div>
          </div>
          <div class="bg-slate-900 border border-slate-800 rounded-lg p-3 text-center">
            <div class="text-xs text-slate-400 font-medium">Commands</div>
            <div id="summary-commands" class="text-xl font-bold text-indigo-400 mt-1">0</div>
          </div>
          <div class="bg-slate-900 border border-slate-800 rounded-lg p-3 text-center">
            <div class="text-xs text-slate-400 font-medium">Agents</div>
            <div id="summary-agents" class="text-xl font-bold text-indigo-400 mt-1">0</div>
          </div>
          <div class="bg-slate-900 border border-slate-800 rounded-lg p-3 text-center">
            <div class="text-xs text-slate-400 font-medium">Rules</div>
            <div id="summary-rules" class="text-xl font-bold text-indigo-400 mt-1">0</div>
          </div>
          <div class="bg-slate-900 border border-slate-800 rounded-lg p-3 text-center">
            <div class="text-xs text-slate-400 font-medium">Context</div>
            <div id="summary-context" class="text-xl font-bold text-indigo-400 mt-1">0</div>
          </div>
          <div class="bg-slate-900 border border-slate-800 rounded-lg p-3 text-center">
            <div class="text-xs text-slate-400 font-medium">Hooks</div>
            <div id="summary-hooks" class="text-xl font-bold text-indigo-400 mt-1">0</div>
          </div>
          <div class="bg-slate-900 border border-slate-800 rounded-lg p-3 text-center">
            <div class="text-xs text-slate-400 font-medium">MCP</div>
            <div id="summary-mcp" class="text-xl font-bold text-indigo-400 mt-1">0</div>
          </div>
          <div class="bg-slate-900 border border-slate-800 rounded-lg p-3 text-center">
            <div class="text-xs text-slate-400 font-medium">Styles</div>
            <div id="summary-styles" class="text-xl font-bold text-indigo-400 mt-1">0</div>
          </div>
          <div class="bg-slate-900 border border-slate-800 rounded-lg p-3 text-center">
            <div class="text-xs text-slate-400 font-medium">Workflows</div>
            <div id="summary-workflows" class="text-xl font-bold text-indigo-400 mt-1">0</div>
          </div>
        </div>

        <!-- IR Viewer Tabs / Code Box -->
        <div class="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-xl">
          <div class="bg-slate-950 px-4 py-3 border-b border-slate-800 flex items-center justify-between">
            <span class="text-xs font-mono text-slate-400" id="inspect-source-title">Source IR Output</span>
            <span class="text-xs text-indigo-400 font-medium">Normalized IR JSON</span>
          </div>
          <pre id="inspect-json-output" class="p-4 text-xs font-mono text-slate-200 overflow-x-auto max-h-[500px] leading-relaxed"></pre>
        </div>
      </div>
    </section>

    <!-- VIEW 2: CONVERSION STUDIO -->
    <section id="view-convert" class="hidden space-y-6">
      <div class="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl">
        <h2 class="text-lg font-bold text-white mb-1 flex items-center gap-2">
          <span>🔄</span> Multi-Agent Conversion Studio
        </h2>
        <p class="text-sm text-slate-400 mb-4">
          Convert any agent plugin into any client format via the single narrowing seam (<code class="font-mono text-indigo-400">PortableCoreIR</code>).
        </p>

        <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <div>
            <label class="block text-xs font-semibold text-slate-300 mb-1">Source Plugin Path</label>
            <div class="flex gap-2">
              <input id="convert-source-input" type="text" value="./resource/codex/imagegen" class="flex-1 bg-slate-950 border border-slate-700/80 rounded-lg px-3 py-2 text-sm text-slate-100 font-mono focus:outline-none focus:border-indigo-500" />
              <button onclick="openDirectoryPicker('convert-source')" class="px-3 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-medium rounded-lg transition flex items-center gap-1.5 shrink-0">
                <span>📂 Browse...</span>
              </button>
            </div>
          </div>
          <div>
            <label class="block text-xs font-semibold text-slate-300 mb-1">Target Client Adapter</label>
            <select id="convert-target-select" class="w-full bg-slate-950 border border-slate-700/80 rounded-lg px-3 py-2 text-sm text-slate-100 font-mono focus:outline-none focus:border-indigo-500">
              <option value="agent-plugins">Agent Plugins v1 (Portable Core)</option>
              <option value="antigravity">Antigravity (~/.gemini / .agents)</option>
              <option value="claude-code">Claude Code (~/.claude / .claude-plugin)</option>
              <option value="codex">OpenAI Codex (~/.codex / .codex-plugin)</option>
              <option value="opencode">OpenCode AI (~/.config/opencode)</option>
            </select>
          </div>
          <div>
            <label class="block text-xs font-semibold text-slate-300 mb-1">Output Directory (Optional)</label>
            <input id="convert-out-input" type="text" placeholder="./dist/converted/preview" class="w-full bg-slate-950 border border-slate-700/80 rounded-lg px-3 py-2 text-sm text-slate-100 font-mono focus:outline-none focus:border-indigo-500" />
          </div>
        </div>

        <button onclick="runConvert()" class="w-full sm:w-auto px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-sm rounded-lg shadow-lg shadow-indigo-600/20 transition flex items-center justify-center gap-2">
          <span>Execute Conversion</span>
        </button>
      </div>

      <div id="convert-results" class="hidden space-y-6">
        <div class="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl space-y-4">
          <div class="flex items-center justify-between pb-4 border-b border-slate-800">
            <div>
              <span class="text-xs uppercase tracking-wider text-slate-400 font-semibold">Conversion Target</span>
              <h3 id="convert-target-name" class="text-lg font-bold text-indigo-400"></h3>
            </div>
            <span class="px-3 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">Success</span>
          </div>

          <div id="convert-files-container" class="space-y-2">
            <h4 class="text-xs font-semibold uppercase tracking-wider text-slate-400">Emitted File Tree</h4>
            <div id="convert-files-list" class="bg-slate-950 border border-slate-800 rounded-lg p-3 font-mono text-xs space-y-1 max-h-60 overflow-y-auto"></div>
          </div>

          <div id="convert-warnings-container" class="hidden space-y-2">
            <h4 class="text-xs font-semibold uppercase tracking-wider text-amber-400">Conversion Warnings</h4>
            <div id="convert-warnings-list" class="bg-amber-500/10 border border-amber-500/20 text-amber-200 rounded-lg p-3 text-xs space-y-1"></div>
          </div>
        </div>
      </div>
    </section>

    <!-- VIEW 3: STORE & WORKSPACE -->
    <section id="view-store" class="hidden space-y-6">
      <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
        <!-- Global Store -->
        <div class="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl space-y-4">
          <div class="flex items-center justify-between">
            <h3 class="font-bold text-white flex items-center gap-2">
              <span>🌐</span> Global Plugin Store
            </h3>
            <span id="global-store-path" class="text-xs font-mono text-slate-400 truncate max-w-[200px]"></span>
          </div>
          <p class="text-xs text-slate-400">Plugins downloaded and cached in global repository storage.</p>

          <div id="global-plugins-list" class="space-y-2 max-h-80 overflow-y-auto">
            <div class="p-4 text-center text-xs text-slate-500 bg-slate-950 rounded-lg">Loading store...</div>
          </div>
        </div>

        <!-- Workspace Plugins -->
        <div class="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl space-y-4">
          <div class="flex items-center justify-between">
            <h3 class="font-bold text-white flex items-center gap-2">
              <span>🏠</span> Workspace Materializations
            </h3>
            <span class="text-xs font-mono text-slate-400">.agents/plugins</span>
          </div>
          <p class="text-xs text-slate-400">Plugins materialized directly into current project context.</p>

          <div id="workspace-plugins-list" class="space-y-2 max-h-80 overflow-y-auto">
            <div class="p-4 text-center text-xs text-slate-500 bg-slate-950 rounded-lg">Loading workspace...</div>
          </div>
        </div>
      </div>
    </section>

    <!-- VIEW 4: DOCTOR DIAGNOSTICS -->
    <section id="view-doctor" class="hidden space-y-6">
      <div class="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl space-y-4">
        <div class="flex items-center justify-between">
          <div>
            <h2 class="text-lg font-bold text-white flex items-center gap-2">
              <span>🩺</span> Adapter Health Diagnostics
            </h2>
            <p class="text-sm text-slate-400">Verifies system environment, target paths, and permissions across all 4 client adapters.</p>
          </div>
          <button onclick="loadDoctor()" class="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium rounded-lg border border-slate-700 transition">
            Refresh Health
          </button>
        </div>

        <div id="doctor-reports-grid" class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div class="p-4 text-center text-xs text-slate-500 bg-slate-950 rounded-lg">Running diagnostics...</div>
        </div>
      </div>
    </section>

    <!-- VIEW 5: PROVIDER MATRIX -->
    <section id="view-matrix" class="hidden space-y-6">
      <div class="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl space-y-4">
        <h2 class="text-lg font-bold text-white flex items-center gap-2">
          <span>📊</span> Cross-Agent Capability Matrix
        </h2>
        <p class="text-sm text-slate-400">Comparison of supported components across agent runtimes.</p>

        <div id="matrix-table-container" class="overflow-x-auto">
          <div class="p-4 text-center text-xs text-slate-500 bg-slate-950 rounded-lg">Loading provider specs...</div>
        </div>
      </div>
    </section>

    <!-- VIEW 6: CLI CONSOLE -->
    <section id="view-cli" class="hidden space-y-6">
      <div class="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl space-y-4">
        <h2 class="text-lg font-bold text-white flex items-center gap-2">
          <span>⚡</span> AgentPM Terminal Console
        </h2>
        <p class="text-sm text-slate-400">Run CLI commands directly against the AgentPM engine.</p>

        <div class="flex gap-2">
          <div class="flex-1 relative">
            <span class="absolute left-3 top-2.5 font-mono text-sm text-slate-500">plugins</span>
            <input id="cli-cmd-input" type="text" value="list" placeholder="list | doctor | inspect resource/codex/imagegen | docs" class="w-full bg-slate-950 border border-slate-700/80 rounded-lg pl-20 pr-4 py-2 text-sm text-slate-100 font-mono focus:outline-none focus:border-indigo-500" />
          </div>
          <button onclick="runCliCommand()" class="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-sm rounded-lg transition">
            Execute
          </button>
        </div>

        <div class="bg-slate-950 border border-slate-800 rounded-lg p-4 font-mono text-xs text-slate-200 min-h-[300px] max-h-[500px] overflow-y-auto leading-relaxed" id="cli-output-box">
          <span class="text-slate-500">$ Ready for command...</span>
        </div>
      </div>
    </section>

  </main>

  <!-- DIRECTORY PICKER MODAL -->
  <div id="dir-picker-modal" class="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 hidden">
    <div class="bg-slate-900 border border-slate-800 rounded-2xl max-w-3xl w-full shadow-2xl flex flex-col max-h-[85vh] overflow-hidden">
      <!-- Header -->
      <div class="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/50">
        <div class="flex items-center gap-2.5">
          <div class="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 font-bold">
            📂
          </div>
          <div>
            <h3 class="font-bold text-slate-100 text-base">File System Directory Picker</h3>
            <p class="text-xs text-slate-400">Select any local agent plugin directory or browse system folders</p>
          </div>
        </div>
        <button onclick="closeDirectoryPicker()" class="text-slate-400 hover:text-slate-200 p-1.5 rounded-lg hover:bg-slate-800 transition">
          ✕
        </button>
      </div>

      <!-- Quick Shortcuts & Address Bar -->
      <div class="p-4 bg-slate-950 border-b border-slate-800 space-y-3">
        <div class="flex items-center gap-2 overflow-x-auto text-xs pb-1">
          <span class="text-slate-400 font-medium shrink-0">Shortcuts:</span>
          <button onclick="browseDirectory('.')" class="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 font-mono transition shrink-0">📁 Workspace (.)</button>
          <button onclick="browseDirectory('~')" class="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 font-mono transition shrink-0">🏠 Home (~)</button>
          <button onclick="browseDirectory('~/.gemini')" class="px-2.5 py-1 rounded bg-indigo-950/50 hover:bg-indigo-900/60 text-indigo-300 border border-indigo-500/30 font-mono transition shrink-0">✨ ~/.gemini</button>
          <button onclick="browseDirectory('~/.claude')" class="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 font-mono transition shrink-0">🤖 ~/.claude</button>
          <button onclick="browseDirectory('./resource')" class="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 font-mono transition shrink-0">📦 ./resource</button>
          <button onclick="browseDirectory('./skills')" class="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 font-mono transition shrink-0">🧠 ./skills</button>
        </div>

        <div class="flex gap-2">
          <input id="picker-address-input" type="text" class="flex-1 bg-slate-900 border border-slate-700/80 rounded-lg px-3 py-2 text-xs text-slate-100 font-mono focus:outline-none focus:border-indigo-500" placeholder="Path to browse..." />
          <button onclick="browseDirectory(document.getElementById('picker-address-input').value)" class="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium rounded-lg transition">
            Go
          </button>
        </div>
      </div>

      <!-- Directory Explorer Entries -->
      <div class="flex-1 overflow-y-auto p-4 space-y-2 min-h-[260px] max-h-[400px]">
        <div id="picker-loading" class="text-center py-8 text-sm text-slate-400">Loading directory contents...</div>
        <div id="picker-entries-list" class="space-y-1.5"></div>
      </div>

      <!-- Footer -->
      <div class="px-6 py-4 border-t border-slate-800 bg-slate-950/50 flex flex-col sm:flex-row items-center justify-between gap-3">
        <div class="text-xs font-mono text-slate-400 truncate max-w-md">
          Selected: <span id="picker-selected-path-display" class="text-indigo-300 font-semibold">.</span>
        </div>
        <div class="flex items-center gap-2 shrink-0">
          <button onclick="closeDirectoryPicker()" class="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium rounded-lg transition">
            Cancel
          </button>
          <button onclick="confirmSelectedDirectory()" class="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-lg shadow-lg shadow-indigo-600/20 transition flex items-center gap-1.5">
            <span>✓ Select Folder & Use</span>
          </button>
        </div>
      </div>
    </div>
  </div>

  <script>
    let currentPickerTarget = 'inspect';
    let currentlyBrowsedDir = '.';
    let currentlySelectedDir = '.';

    function openDirectoryPicker(targetInput) {
      currentPickerTarget = targetInput;
      const initialPath = targetInput === 'inspect'
        ? (document.getElementById('inspect-path-input').value || '.')
        : (document.getElementById('convert-source-input')?.value || '.');

      document.getElementById('dir-picker-modal').classList.remove('hidden');
      browseDirectory(initialPath);
    }

    function closeDirectoryPicker() {
      document.getElementById('dir-picker-modal').classList.add('hidden');
    }

    async function browseDirectory(dirPath) {
      const loading = document.getElementById('picker-loading');
      const list = document.getElementById('picker-entries-list');
      const addressInput = document.getElementById('picker-address-input');
      const selectedDisplay = document.getElementById('picker-selected-path-display');

      loading.classList.remove('hidden');
      loading.innerHTML = '<div class="text-slate-400 py-6 text-center text-xs">Loading directory contents...</div>';
      list.innerHTML = '';

      try {
        const res = await fetch('/api/fs/browse?dir=' + encodeURIComponent(dirPath || '.'));
        const data = await res.json();

        if (data.error) {
          loading.innerHTML = '<div class="p-4 text-xs text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-lg">' + data.error + '</div>';
          return;
        }

        loading.classList.add('hidden');
        currentlyBrowsedDir = data.displayPath || data.currentPath;
        currentlySelectedDir = currentlyBrowsedDir;
        addressInput.value = data.currentPath;
        selectedDisplay.textContent = currentlySelectedDir;

        let itemsHtml = '';

        function escapeHtml(str) {
          if (!str) return '';
          return String(str)
            .replace(/&/g, '&amp;')
            .replace(/'/g, '&#39;')
            .replace(/"/g, '&quot;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
        }

        if (data.parentPath) {
          const safeParent = data.parentPath.replace(/\\/g, '/');
          itemsHtml += '<div data-action="browse" data-path="' + escapeHtml(safeParent) + '" class="p-2.5 rounded-lg bg-slate-950/80 hover:bg-slate-800/80 border border-slate-800/80 cursor-pointer flex items-center justify-between text-xs transition group">' +
            '<div class="flex items-center gap-2 text-slate-300 group-hover:text-white pointer-events-none">' +
              '<span class="text-base">⬆️</span>' +
              '<span class="font-mono font-medium">.. (Up to ' + escapeHtml(safeParent) + ')</span>' +
            '</div>' +
            '<span class="text-slate-500 text-[10px] pointer-events-none">Parent Directory</span>' +
          '</div>';
        }

        if (data.entries.length === 0) {
          itemsHtml += '<div class="p-6 text-center text-xs text-slate-500">Directory is empty</div>';
        } else {
          itemsHtml += data.entries.map(function(e) {
            const isDir = e.isDirectory;
            const isPlugin = e.isPlugin;
            const icon = isPlugin ? '⚡' : (isDir ? '📁' : '📄');
            const bgClass = isPlugin
              ? 'bg-indigo-950/30 border-indigo-500/30 hover:bg-indigo-900/40'
              : (isDir ? 'bg-slate-950 border-slate-800/80 hover:bg-slate-800/80' : 'bg-slate-950/40 border-slate-800/40 opacity-60');

            const safeFullPath = e.fullPath.replace(/\\/g, '/');
            const safeRelPath = e.relativePath.replace(/\\/g, '/');
            const itemAction = isDir ? 'browse' : 'select';
            const itemPath = isDir ? safeFullPath : safeRelPath;

            const pluginBadge = isPlugin ? '<span class="px-2 py-0.5 text-[10px] rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 font-semibold pointer-events-none">Plugin</span>' : '';
            const detailsBadge = e.pluginDetails ? '<div class="text-[10px] text-indigo-400 font-sans pointer-events-none">' + escapeHtml(e.pluginDetails) + '</div>' : '';

            const actionButtons = isDir
              ? '<button data-action="select" data-path="' + escapeHtml(safeRelPath) + '" class="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded font-medium text-[11px] transition shadow">Select</button>' +
                '<button data-action="browse" data-path="' + escapeHtml(safeFullPath) + '" class="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded font-medium text-[11px] transition">Open 📂</button>'
              : '<span class="text-[10px] text-slate-500 font-mono pointer-events-none">File</span>';

            return '<div class="p-2.5 rounded-lg border ' + bgClass + ' flex items-center justify-between text-xs transition">' +
              '<div class="flex items-center gap-2.5 truncate max-w-[65%] cursor-pointer" data-action="' + itemAction + '" data-path="' + escapeHtml(itemPath) + '">' +
                '<span class="text-base shrink-0 pointer-events-none">' + icon + '</span>' +
                '<div class="truncate pointer-events-none">' +
                  '<div class="font-mono font-medium text-slate-200 hover:text-indigo-300 truncate">' + escapeHtml(e.name) + '</div>' +
                  detailsBadge +
                '</div>' +
              '</div>' +
              '<div class="flex items-center gap-2 shrink-0">' +
                pluginBadge +
                actionButtons +
              '</div>' +
            '</div>';
          }).join('');
        }

        list.innerHTML = itemsHtml;
        list.onclick = function(evt) {
          const target = evt.target.closest('[data-action]');
          if (!target) return;
          evt.stopPropagation();
          const action = target.getAttribute('data-action');
          const path = target.getAttribute('data-path');
          if (action === 'browse') {
            browseDirectory(path);
          } else if (action === 'select') {
            selectDirectoryItem(path);
          }
        };
      } catch (err) {
        loading.innerHTML = '<div class="p-4 text-xs text-red-400">Failed to browse path: ' + err.message + '</div>';
      }
    }

    function selectDirectoryItem(pathStr) {
      currentlySelectedDir = pathStr;
      document.getElementById('picker-selected-path-display').textContent = pathStr;
    }

    function confirmSelectedDirectory() {
      const chosen = currentlySelectedDir || currentlyBrowsedDir || '.';
      if (currentPickerTarget === 'inspect') {
        document.getElementById('inspect-path-input').value = chosen;
        runInspect();
      } else if (currentPickerTarget === 'convert-source') {
        const convertInput = document.getElementById('convert-source-input');
        if (convertInput) convertInput.value = chosen;
      }
      closeDirectoryPicker();
    }
    function switchTab(tabId) {
      document.querySelectorAll('section[id^="view-"]').forEach(s => s.classList.add('hidden'));
      document.querySelectorAll('.tab-btn').forEach(b => {
        b.classList.remove('text-indigo-400', 'bg-indigo-500/10', 'border', 'border-indigo-500/20');
        b.classList.add('text-slate-400');
      });

      const view = document.getElementById('view-' + tabId);
      const btn = document.getElementById('tab-' + tabId);
      if (view && btn) {
        view.classList.remove('hidden');
        btn.classList.remove('text-slate-400');
        btn.classList.add('text-indigo-400', 'bg-indigo-500/10', 'border', 'border-indigo-500/20');
      }

      if (tabId === 'store') loadStore();
      if (tabId === 'doctor') loadDoctor();
      if (tabId === 'matrix') loadMatrix();
    }

    function selectSample(path) {
      document.getElementById('inspect-path-input').value = path;
      document.getElementById('convert-source-input').value = path;
      runInspect();
    }

    async function runInspect() {
      const source = document.getElementById('inspect-path-input').value.trim();
      if (!source) return;

      const outputBox = document.getElementById('inspect-json-output');
      const resultsDiv = document.getElementById('inspect-results');
      outputBox.textContent = 'Parsing plugin directory...';
      resultsDiv.classList.remove('hidden');

      try {
        const res = await fetch('/api/inspect', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ source })
        });
        const data = await res.json();

        if (data.error) {
          outputBox.textContent = 'Error: ' + data.error;
          return;
        }

        document.getElementById('summary-skills').textContent = data.summary.skills;
        document.getElementById('summary-commands').textContent = data.summary.commands;
        document.getElementById('summary-agents').textContent = data.summary.agents;
        document.getElementById('summary-rules').textContent = data.summary.rules;
        document.getElementById('summary-context').textContent = data.summary.contextFile;
        document.getElementById('summary-hooks').textContent = data.summary.hooks;
        document.getElementById('summary-mcp').textContent = data.summary.mcpServers;
        document.getElementById('summary-styles').textContent = data.summary.outputStyles;
        document.getElementById('summary-workflows').textContent = data.summary.workflows;

        document.getElementById('inspect-source-title').textContent = 'Source: ' + data.source;
        outputBox.textContent = JSON.stringify(data.ir, null, 2);
      } catch (err) {
        outputBox.textContent = 'Fetch error: ' + err.message;
      }
    }

    async function runConvert() {
      const source = document.getElementById('convert-source-input').value.trim();
      const target = document.getElementById('convert-target-select').value;
      const outputDir = document.getElementById('convert-out-input').value.trim();

      const resultsDiv = document.getElementById('convert-results');
      resultsDiv.classList.remove('hidden');
      document.getElementById('convert-target-name').textContent = target;

      const filesList = document.getElementById('convert-files-list');
      filesList.textContent = 'Converting...';

      try {
        const res = await fetch('/api/convert', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ source, target, outputDir: outputDir || undefined })
        });
        const data = await res.json();

        if (data.error) {
          filesList.textContent = 'Error: ' + data.error;
          return;
        }

        if (data.target) {
          document.getElementById('convert-target-name').textContent = data.target;
        }

        if (data.files) {
          filesList.innerHTML = data.files.map(f => \`
            <div class="flex items-center justify-between text-slate-300 py-0.5">
              <span>📄 \${f.relativePath}</span>
              <span class="text-slate-500 font-mono">\${f.content.length} bytes</span>
            </div>
          \`).join('');
        } else {
          filesList.textContent = 'Emitted portable core to ' + data.outputDir;
        }

        if (data.warnings && data.warnings.length > 0) {
          const warnDiv = document.getElementById('convert-warnings-container');
          warnDiv.classList.remove('hidden');
          document.getElementById('convert-warnings-list').innerHTML = data.warnings.map(w => \`<div>⚠️ \${w}</div>\`).join('');
        }
      } catch (err) {
        filesList.textContent = 'Fetch error: ' + err.message;
      }
    }

    async function loadStore() {
      try {
        const res = await fetch('/api/store');
        const data = await res.json();

        document.getElementById('global-store-path').textContent = data.globalStoreRoot;

        const globalBox = document.getElementById('global-plugins-list');
        if (data.globalPlugins.length === 0) {
          globalBox.innerHTML = '<div class="p-4 text-center text-xs text-slate-500 bg-slate-950 rounded-lg">Global store empty</div>';
        } else {
          globalBox.innerHTML = data.globalPlugins.map(p => \`
            <div class="p-3 bg-slate-950 border border-slate-800 rounded-lg flex items-center justify-between">
              <div>
                <div class="font-bold text-sm text-slate-200">\${p.name}</div>
                <div class="text-xs font-mono text-slate-400">\${p.namespace || 'global'}</div>
              </div>
              <span class="px-2 py-0.5 text-xs rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">Cached</span>
            </div>
          \`).join('');
        }

        const wsBox = document.getElementById('workspace-plugins-list');
        if (data.workspacePlugins.length === 0) {
          wsBox.innerHTML = '<div class="p-4 text-center text-xs text-slate-500 bg-slate-950 rounded-lg">No workspace plugins active</div>';
        } else {
          wsBox.innerHTML = data.workspacePlugins.map(p => \`
            <div class="p-3 bg-slate-950 border border-slate-800 rounded-lg flex items-center justify-between">
              <div class="font-bold text-sm text-slate-200">\${p}</div>
              <span class="px-2 py-0.5 text-xs rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">Active</span>
            </div>
          \`).join('');
        }
      } catch (err) {
        console.error(err);
      }
    }

    async function loadDoctor() {
      const container = document.getElementById('doctor-reports-grid');
      try {
        const res = await fetch('/api/doctor');
        const data = await res.json();

        container.innerHTML = data.reports.map(r => \`
          <div class="p-4 bg-slate-950 border border-slate-800 rounded-lg space-y-3">
            <div class="flex items-center justify-between">
              <h4 class="font-bold text-sm text-slate-200">\${r.adapter}</h4>
              <span class="px-2 py-0.5 text-xs rounded \${r.health.installed ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-slate-800 text-slate-400'}">
                \${r.health.installed ? 'Available' : 'Path Standard'}
              </span>
            </div>
            <div class="text-xs font-mono text-slate-400 space-y-1">
              <div>Global Path: \${r.health.targetPath || 'N/A'}</div>
              <div>Active Plugins: \${r.activePlugins.length}</div>
            </div>
          </div>
        \`).join('');
      } catch (err) {
        container.innerHTML = '<div class="p-4 text-red-400 text-xs">Failed to load health reports</div>';
      }
    }

    async function loadMatrix() {
      const container = document.getElementById('matrix-table-container');
      try {
        const res = await fetch('/api/providers');
        const data = await res.json();

        container.innerHTML = \`
          <table class="w-full text-left text-xs border-collapse">
            <thead>
              <tr class="border-b border-slate-800 text-slate-400">
                <th class="p-3">Component / Feature</th>
                <th class="p-3">Antigravity</th>
                <th class="p-3">Claude Code</th>
                <th class="p-3">Codex</th>
                <th class="p-3">OpenCode</th>
                <th class="p-3 text-indigo-400">Agent Plugins v1</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-800/60 font-mono text-slate-300">
              <tr><td class="p-3 font-sans font-semibold text-slate-200">Skills</td><td class="p-3 text-emerald-400">Native</td><td class="p-3 text-emerald-400">Native</td><td class="p-3 text-emerald-400">Native</td><td class="p-3 text-emerald-400">Native</td><td class="p-3 text-indigo-400 font-bold">Native Core</td></tr>
              <tr><td class="p-3 font-sans font-semibold text-slate-200">MCP Servers</td><td class="p-3 text-emerald-400">Native</td><td class="p-3 text-emerald-400">Native</td><td class="p-3 text-emerald-400">Native</td><td class="p-3 text-slate-500">N/A</td><td class="p-3 text-indigo-400 font-bold">Native Core</td></tr>
              <tr><td class="p-3 font-sans font-semibold text-slate-200">Custom Rules</td><td class="p-3 text-emerald-400">rules/</td><td class="p-3 text-slate-500">CLAUDE.md</td><td class="p-3 text-slate-500">N/A</td><td class="p-3 text-slate-500">N/A</td><td class="p-3 text-indigo-400 font-bold">Client Extension</td></tr>
              <tr><td class="p-3 font-sans font-semibold text-slate-200">Hooks</td><td class="p-3 text-emerald-400">hooks.json</td><td class="p-3 text-emerald-400">hooks.json</td><td class="p-3 text-slate-500">N/A</td><td class="p-3 text-slate-500">N/A</td><td class="p-3 text-indigo-400 font-bold">Client Extension</td></tr>
              <tr><td class="p-3 font-sans font-semibold text-slate-200">Custom Agents</td><td class="p-3 text-emerald-400">agents/</td><td class="p-3 text-emerald-400">agents/</td><td class="p-3 text-emerald-400">agents/</td><td class="p-3 text-slate-500">N/A</td><td class="p-3 text-indigo-400 font-bold">Client Extension</td></tr>
            </tbody>
          </table>
        \`;
      } catch (err) {
        container.innerHTML = '<div class="p-4 text-red-400 text-xs">Failed to load matrix</div>';
      }
    }

    async function runCliCommand() {
      const input = document.getElementById('cli-cmd-input').value.trim();
      const outputBox = document.getElementById('cli-output-box');
      if (!input) return;

      outputBox.textContent = '$ plugins ' + input + '\\nExecuting...';

      try {
        const res = await fetch('/api/cli', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ command: input })
        });
        const data = await res.json();

        outputBox.textContent = '$ plugins ' + input + '\\n' + (data.stdout || '') + (data.stderr || '');
      } catch (err) {
        outputBox.textContent = 'Command execution error: ' + err.message;
      }
    }

    // Run initial inspection on load
    runInspect();
  </script>
</body>
</html>`);
});

app.listen(PORT, HOST, () => {
  console.log(`\n🚀 AgentPM Web Dashboard & Server running on http://${HOST}:${PORT}`);
});