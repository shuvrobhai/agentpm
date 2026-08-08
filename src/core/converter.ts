import fs from 'node:fs/promises';
import path from 'node:path';
import { ConversionPipeline } from './pipeline/pipeline.js';
import { ConversionContext } from './pipeline/context.js';
import {
  VariableRewriteStep,
  MemoryTranspileStep,
  McpPathExpansionStep,
  HookSchemaConvertStep,
  TerminologyNeutralizeStep,
} from './pipeline/steps.js';

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
}

export class PluginConverter {
  private static defaultPipeline = new ConversionPipeline([
    new VariableRewriteStep(),
    new MemoryTranspileStep(),
    new McpPathExpansionStep(),
    new HookSchemaConvertStep(),
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

    // Post-process: Synthesize root plugin.json if present in .claude-plugin/
    const rootPluginJson = path.join(targetDir, 'plugin.json');
    const claudePluginJson = path.join(targetDir, '.claude-plugin', 'plugin.json');
    const rootExists = await fs.access(rootPluginJson).then(() => true).catch(() => false);
    const claudeExists = await fs.access(claudePluginJson).then(() => true).catch(() => false);

    if (!rootExists && claudeExists) {
      await fs.copyFile(claudePluginJson, rootPluginJson);
      result.filesModified++;
    }

    return result;
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
