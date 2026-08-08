import fs from 'node:fs/promises';
import path from 'node:path';
import { ConversionPipeline } from './pipeline/pipeline.js';
import type { ConversionContext } from './pipeline/context.js';
import {
  VariableRewriteStep,
  MemoryTranspileStep,
  McpPathExpansionStep,
  HookSchemaConvertStep,
  CommandTranspileStep,
  AgentTomlTranspileStep,
  TerminologyNeutralizeStep,
} from './pipeline/steps.js';
import { buildPortablePluginManifest, buildPortableMcp } from './v1-manifest.js';

export interface ConversionOptions {
  targetAdapter?: 'antigravity' | 'claude-code' | 'codex' | 'opencode' | 'pi' | string;
  memoryFilename?: 'AGENTS.md' | 'CLAUDE.md' | string;
  rootVarName?: string;
  expandMcpPaths?: boolean;
  neutralizeTerms?: boolean;
}

export interface ConversionResult {
  filesProcessed: number;
  filesModified: number;
  variablesRewritten: number;
  mcpPathsExpanded: number;
  rulesTranspiled: number;
  hooksConverted?: number;
  commandsTranspiled?: number;
}

export class PluginConverter {
  private static defaultPipeline = new ConversionPipeline([
    new VariableRewriteStep(),
    new MemoryTranspileStep(),
    new McpPathExpansionStep(),
    new HookSchemaConvertStep(),
    new CommandTranspileStep(),
    new AgentTomlTranspileStep(),
    new TerminologyNeutralizeStep(),
  ]);

  static async convertPlugin(
    sourceDir: string,
    targetDir: string,
    options: ConversionOptions = {}
  ): Promise<ConversionResult> {
    const targetAdapter = options.targetAdapter || 'antigravity';
    const memoryFilename = options.memoryFilename || 'AGENTS.md';
    const rootVarName = options.rootVarName || 'PLUGIN_ROOT';
    const expandMcpPaths = options.expandMcpPaths !== false;
    const neutralizeTerms = options.neutralizeTerms !== false;

    const resolvedOptions: Required<ConversionOptions> = {
      targetAdapter,
      memoryFilename,
      rootVarName,
      expandMcpPaths,
      neutralizeTerms,
    };

    const result: ConversionResult = {
      filesProcessed: 0,
      filesModified: 0,
      variablesRewritten: 0,
      mcpPathsExpanded: 0,
      rulesTranspiled: 0,
      hooksConverted: 0,
      commandsTranspiled: 0,
    };

    await fs.mkdir(targetDir, { recursive: true });

    await this.processDirectory(
      sourceDir,
      targetDir,
      sourceDir,
      targetDir,
      resolvedOptions,
      result
    );

    // Post-process: Synthesize manifests and configs
    const rootPluginJson = path.join(targetDir, 'plugin.json');
    const claudePluginJson = path.join(targetDir, '.claude-plugin', 'plugin.json');
    const claudeExists = await fs.access(claudePluginJson).then(() => true).catch(() => false);

    if (targetAdapter === 'antigravity') {
      const rootExists = await fs.access(rootPluginJson).then(() => true).catch(() => false);
      if (!rootExists && claudeExists) {
        await fs.copyFile(claudePluginJson, rootPluginJson);
        result.filesModified++;
      }
      // Mirror .mcp.json to mcp_config.json
      const dotMcp = path.join(targetDir, '.mcp.json');
      const mcpConfig = path.join(targetDir, 'mcp_config.json');
      const dotMcpExists = await fs.access(dotMcp).then(() => true).catch(() => false);
      if (dotMcpExists) {
        await fs.copyFile(dotMcp, mcpConfig);
        result.filesModified++;
      }
    } else if (targetAdapter === 'codex') {
      const codexPluginDir = path.join(targetDir, '.codex-plugin');
      await fs.mkdir(codexPluginDir, { recursive: true });
      const codexPluginJson = path.join(codexPluginDir, 'plugin.json');
      if (claudeExists) {
        await fs.copyFile(claudePluginJson, codexPluginJson);
        result.filesModified++;
      }
    } else if (targetAdapter === 'agent-plugins') {
      // Portable v1: synthesize a closed-schema root plugin.json
      const sourceManifest = await this.readSourceManifest(sourceDir);
      const portableManifest = buildPortablePluginManifest(sourceManifest, path.basename(sourceDir));
      await fs.writeFile(rootPluginJson, JSON.stringify(portableManifest, null, 2) + '\n', 'utf8');
      result.filesModified++;

      // Portable v1: convert .mcp.json / mcp_config.json to mcp.json
      const warnings: string[] = [];
      const dotMcp = path.join(targetDir, '.mcp.json');
      const mcpConfig = path.join(targetDir, 'mcp_config.json');
      const mcpSourceExists = await fs.access(dotMcp).then(() => true).catch(() => false);
      const mcpConfigExists = await fs.access(mcpConfig).then(() => true).catch(() => false);
      const mcpSource = mcpSourceExists ? dotMcp : mcpConfig;
      if (mcpSourceExists || mcpConfigExists) {
        try {
          const raw = await fs.readFile(mcpSource, 'utf8');
          const parsed = JSON.parse(raw);
          const portableMcp = buildPortableMcp(parsed, warnings);
          await fs.writeFile(
            path.join(targetDir, 'mcp.json'),
            JSON.stringify(portableMcp, null, 2) + '\n',
            'utf8'
          );
          if (mcpSourceExists) {
            await fs.rm(dotMcp, { force: true });
          }
          if (mcpConfigExists) {
            await fs.rm(mcpConfig, { force: true });
          }
          result.filesModified++;
        } catch (e) {
          warnings.push(`Failed to convert MCP config to mcp.json: ${(e as Error).message}`);
        }
      }

      for (const warning of warnings) {
        console.warn(`[agentpm] ${warning}`);
      }
    }

    return result;
  }

  private static async readSourceManifest(sourceDir: string): Promise<Record<string, unknown>> {
    const candidates = [
      path.join(sourceDir, 'plugin.json'),
      path.join(sourceDir, '.claude-plugin', 'plugin.json'),
      path.join(sourceDir, '.codex-plugin', 'plugin.json'),
    ];
    for (const candidate of candidates) {
      const exists = await fs.access(candidate).then(() => true).catch(() => false);
      if (!exists) continue;
      try {
        const parsed = JSON.parse(await fs.readFile(candidate, 'utf8'));
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
          return parsed as Record<string, unknown>;
        }
      } catch (e) {
        // Fallthrough to next candidate
      }
    }
    return {};
  }

  private static async processDirectory(
    currentSourceDir: string,
    currentTargetDir: string,
    sourceRoot: string,
    targetRoot: string,
    options: Required<ConversionOptions>,
    result: ConversionResult
  ): Promise<void> {
    const entries = await fs.readdir(currentSourceDir, { withFileTypes: true });

    for (const entry of entries) {
      if (entry.name.startsWith('.git')) continue;

      const srcPath = path.join(currentSourceDir, entry.name);
      let destName = entry.name;

      if (entry.name === 'CLAUDE.md' && options.memoryFilename === 'AGENTS.md') {
        destName = 'AGENTS.md';
        result.rulesTranspiled++;
      } else if (entry.isDirectory() && entry.name === 'commands') {
        if (options.targetAdapter === 'antigravity') {
          destName = 'workflows';
          if (result.commandsTranspiled !== undefined) result.commandsTranspiled++;
        } else if (options.targetAdapter === 'codex') {
          destName = 'skills';
          if (result.commandsTranspiled !== undefined) result.commandsTranspiled++;
        }
      } else if (entry.isFile() && options.targetAdapter === 'codex' && currentSourceDir.endsWith('agents') && destName.endsWith('.md')) {
        destName = destName.replace(/\.md$/, '.toml');
      }

      const destPath = path.join(currentTargetDir, destName);

      if (entry.isDirectory()) {
        await fs.mkdir(destPath, { recursive: true });
        await this.processDirectory(srcPath, destPath, sourceRoot, targetRoot, options, result);
      } else if (entry.isFile() || entry.isSymbolicLink()) {
        result.filesProcessed++;
        const wasModified = await this.convertFile(srcPath, destPath, sourceRoot, targetRoot, options, result);
        if (wasModified) {
          result.filesModified++;
        }
      }
    }
  }

  private static async convertFile(
    srcPath: string,
    destPath: string,
    sourceRoot: string,
    targetRoot: string,
    options: Required<ConversionOptions>,
    result: ConversionResult
  ): Promise<boolean> {
    const ext = path.extname(srcPath).toLowerCase();
    const basename = path.basename(srcPath).toLowerCase();

    const isTextFile = [
      '.md', '.txt', '.json', '.js', '.ts', '.html', '.css', '.sh', '.yml', '.yaml'
    ].includes(ext) || basename === 'plugin.json' || basename === 'hooks.json';

    if (!isTextFile) {
      await fs.copyFile(srcPath, destPath);
      return false;
    }

    const content = await fs.readFile(srcPath, 'utf8');

    const context: ConversionContext = {
      srcPath,
      destPath,
      sourceRoot,
      targetRoot,
      ext,
      basename,
      content,
      options,
      result,
    };

    const pipelineRes = await this.defaultPipeline.execute(context);

    await fs.writeFile(destPath, pipelineRes.content, 'utf8');
    return pipelineRes.modified;
  }
}
