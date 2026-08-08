import fs from 'node:fs/promises';
import path from 'node:path';
import { convertHooks, ClaudeHooksFile } from './hook-converter.js';

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

    let content = await fs.readFile(srcPath, 'utf8');
    const originalContent = content;

    // 1. Variable Rewriting (${CLAUDE_PLUGIN_ROOT} / ${GEMINI_PLUGIN_ROOT} -> ${PLUGIN_ROOT})
    if (content.includes('${CLAUDE_PLUGIN_ROOT}') || content.includes('${GEMINI_PLUGIN_ROOT}')) {
      const varRegex = /\$\{(CLAUDE_PLUGIN_ROOT|GEMINI_PLUGIN_ROOT)\}/g;
      const matches = content.match(varRegex);
      if (matches) {
        result.variablesRewritten += matches.length;
      }
      content = content.replace(varRegex, `\${${options.rootVarName}}`);
    }

    // 2. Memory Filename Transformation (CLAUDE.md -> AGENTS.md)
    if (options.memoryFilename === 'AGENTS.md') {
      content = content.replace(/CLAUDE\.md/g, 'AGENTS.md');
      content = content.replace(/claudeMd/g, 'agentsMd');
    } else if (options.memoryFilename === 'CLAUDE.md') {
      content = content.replace(/AGENTS\.md/g, 'CLAUDE.md');
      content = content.replace(/agentsMd/g, 'claudeMd');
    }

    // 3. MCP Config Path Normalization (.mcp.json / mcp_config.json)
    if (options.expandMcpPaths && (basename === '.mcp.json' || basename === 'mcp_config.json' || basename === 'plugin.json')) {
      try {
        const json = JSON.parse(content);
        let modified = false;

        const processMcpServers = (serversObj: Record<string, any>) => {
          for (const serverKey of Object.keys(serversObj)) {
            const server = serversObj[serverKey];
            if (server && typeof server.cwd === 'string' && !path.isAbsolute(server.cwd)) {
              server.cwd = path.resolve(sourceRoot, server.cwd);
              result.mcpPathsExpanded++;
              modified = true;
            }
          }
        };

        if (json.mcpServers && typeof json.mcpServers === 'object') {
          processMcpServers(json.mcpServers);
        } else if (json.mcp && typeof json.mcp === 'object') {
          processMcpServers(json.mcp);
        }

        if (modified) {
          content = JSON.stringify(json, null, 2);
        }
      } catch (e) {
        // Not valid JSON or parsing error
      }
    }

    // 4. Hooks Schema Conversion (hooks.json for Antigravity target)
    if (basename === 'hooks.json' && options.targetAdapter === 'antigravity') {
      try {
        const json = JSON.parse(content);
        if (json.hooks) {
          const pluginName = path.basename(sourceRoot);
          const converted = convertHooks(json as ClaudeHooksFile, pluginName);
          content = JSON.stringify(converted.output, null, 2);
          if (result.hooksConverted !== undefined) {
            result.hooksConverted += converted.converted;
          }
        }
      } catch (e) {
        // Not valid JSON or error converting
      }
    }

    // 5. Terminology Neutralization (Claude / Cowork -> coding agent)
    if (options.neutralizeTerms && (ext === '.md' || ext === '.txt')) {
      content = content.replace(/\bClaude Code\b/g, 'coding agent');
      content = content.replace(/\bClaude\b/g, 'coding agent');
      content = content.replace(/\bCowork\b/g, 'agent environment');
    }

    await fs.writeFile(destPath, content, 'utf8');
    return content !== originalContent;
  }
}
