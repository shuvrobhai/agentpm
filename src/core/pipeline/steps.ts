import path from 'node:path';
import { ConversionStep } from './step.js';
import { ConversionContext, TransformStepResult } from './context.js';
import { convertHooks, ClaudeHooksFile } from '../hook-converter.js';

export class VariableRewriteStep implements ConversionStep {
  name = 'VariableRewrite';

  async transform(context: ConversionContext): Promise<TransformStepResult> {
    let content = context.content;
    let modified = false;

    if (content.includes('${CLAUDE_PLUGIN_ROOT}') || content.includes('${GEMINI_PLUGIN_ROOT}')) {
      const varRegex = /\$\{(CLAUDE_PLUGIN_ROOT|GEMINI_PLUGIN_ROOT)\}/g;
      const matches = content.match(varRegex);
      if (matches) {
        context.result.variablesRewritten += matches.length;
      }
      content = content.replace(varRegex, `\${${context.options.rootVarName}}`);
      modified = true;
    }

    return { content, modified };
  }
}

export class MemoryTranspileStep implements ConversionStep {
  name = 'MemoryTranspile';

  async transform(context: ConversionContext): Promise<TransformStepResult> {
    let content = context.content;
    let modified = false;

    if (context.options.memoryFilename === 'AGENTS.md') {
      if (content.includes('CLAUDE.md') || content.includes('claudeMd')) {
        content = content.replace(/CLAUDE\.md/g, 'AGENTS.md');
        content = content.replace(/claudeMd/g, 'agentsMd');
        modified = true;
      }
    } else if (context.options.memoryFilename === 'CLAUDE.md') {
      if (content.includes('AGENTS.md') || content.includes('agentsMd')) {
        content = content.replace(/AGENTS\.md/g, 'CLAUDE.md');
        content = content.replace(/agentsMd/g, 'claudeMd');
        modified = true;
      }
    }

    return { content, modified };
  }
}

export class McpPathExpansionStep implements ConversionStep {
  name = 'McpPathExpansion';

  async transform(context: ConversionContext): Promise<TransformStepResult> {
    let content = context.content;
    let modified = false;

    if (
      context.options.expandMcpPaths &&
      (context.basename === '.mcp.json' || context.basename === 'mcp_config.json' || context.basename === 'plugin.json')
    ) {
      try {
        const json = JSON.parse(content);
        let mcpModified = false;

        const processMcpServers = (serversObj: Record<string, any>) => {
          for (const serverKey of Object.keys(serversObj)) {
            const server = serversObj[serverKey];
            if (server && typeof server.cwd === 'string' && !path.isAbsolute(server.cwd)) {
              server.cwd = path.resolve(context.sourceRoot, server.cwd);
              context.result.mcpPathsExpanded++;
              mcpModified = true;
            }
          }
        };

        if (json.mcpServers && typeof json.mcpServers === 'object') {
          processMcpServers(json.mcpServers);
        } else if (json.mcp && typeof json.mcp === 'object') {
          processMcpServers(json.mcp);
        }

        if (mcpModified) {
          content = JSON.stringify(json, null, 2);
          modified = true;
        }
      } catch (e) {
        // Fallthrough
      }
    }

    return { content, modified };
  }
}

export class HookSchemaConvertStep implements ConversionStep {
  name = 'HookSchemaConvert';

  async transform(context: ConversionContext): Promise<TransformStepResult> {
    let content = context.content;
    let modified = false;

    if (context.basename === 'hooks.json' && context.options.targetAdapter === 'antigravity') {
      try {
        const json = JSON.parse(content);
        if (json.hooks) {
          const pluginName = path.basename(context.sourceRoot);
          const converted = convertHooks(json as ClaudeHooksFile, pluginName);
          content = JSON.stringify(converted.output, null, 2);
          if (context.result.hooksConverted !== undefined) {
            context.result.hooksConverted += converted.converted;
          }
          modified = true;
        }
      } catch (e) {
        // Fallthrough
      }
    }

    return { content, modified };
  }
}

export class TerminologyNeutralizeStep implements ConversionStep {
  name = 'TerminologyNeutralize';

  async transform(context: ConversionContext): Promise<TransformStepResult> {
    let content = context.content;
    let modified = false;

    if (context.options.neutralizeTerms && (context.ext === '.md' || context.ext === '.txt')) {
      if (/\bClaude Code\b|\bClaude\b|\bCowork\b/.test(content)) {
        content = content.replace(/\bClaude Code\b/g, 'coding agent');
        content = content.replace(/\bClaude\b/g, 'coding agent');
        content = content.replace(/\bCowork\b/g, 'agent environment');
        modified = true;
      }
    }

    return { content, modified };
  }
}
