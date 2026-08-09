import path from 'node:path';
import os from 'node:os';
import { BaseAgentAdapter } from './base.js';
import type { PortableCoreIR, ConversionResult, FileOutput } from '../ir/types.js';
import { mapToolNames } from '../ir/tool-mapper.js';
import { rewriteMcpServer } from '../core/mcp-rewriter.js';
import { convertHooks } from '../ir/hook-converter.js';
import { convertCommandsToAntigravityWorkflows } from '../ir/command-converter.js';

function formatAntigravitySkill(skill: { name: string; description: string; body: string }): string {
  const lines: string[] = [];
  lines.push('---');
  lines.push(`name: ${skill.name}`);
  lines.push(`description: ${JSON.stringify(skill.description || skill.name)}`);
  lines.push('---');
  lines.push('');
  lines.push(`# ${skill.name}`);
  lines.push('');
  lines.push(skill.body);
  return lines.join('\n');
}

function formatAntigravityAgent(agent: {
  name: string;
  description: string;
  body: string;
  tools: string[];
  model?: string;
}): { content: string; warnings: string[] } {
  const { mappedTools, warnings } = mapToolNames(agent.tools, 'antigravity');

  const frontmatter: string[] = [
    '---',
    `name: ${agent.name}`,
    `description: ${JSON.stringify(agent.description || agent.name)}`,
    'tools:',
  ];

  for (const tool of mappedTools) {
    frontmatter.push(`  - ${tool}`);
  }

  frontmatter.push('subagent: true');
  frontmatter.push('mainAgent: false');
  frontmatter.push(`model: ${agent.model || 'inherit'}`);
  frontmatter.push('commandExecutionPolicy: sandbox');
  frontmatter.push('---');
  frontmatter.push('');
  frontmatter.push(agent.body);

  return {
    content: frontmatter.join('\n'),
    warnings,
  };
}

export class AntigravityAdapter extends BaseAgentAdapter {
  name = 'antigravity';
  displayName = 'Antigravity CLI';
  protected override logTag = 'AntigravityAdapter';

  override get detectProbes(): { global: string[]; local: string[] } {
    return {
      global: [path.join(os.homedir(), '.gemini')],
      local: [path.join(process.cwd(), '.agents')],
    };
  }

  get globalPluginDir(): string {
    return path.join(os.homedir(), '.gemini', 'config', 'plugins');
  }

  get localPluginDir(): string {
    return path.join(process.cwd(), '.agents');
  }

  override get candidateSearchDirs(): { global: string[]; local: string[] } {
    return {
      global: [path.join(os.homedir(), '.gemini', 'config', 'plugins')],
      local: [path.join(process.cwd(), '.agents', 'plugins')],
    };
  }

  capabilities(): string[] {
    return ['skills', 'mcp', 'hooks', 'agents', 'rules', 'workflows'];
  }

  convert(ir: PortableCoreIR, _scope: 'workspace' | 'global'): ConversionResult {
    const files: FileOutput[] = [];
    const warnings: string[] = [...(ir.warnings || [])];
    const manualSteps: string[] = [];
    const { extensions } = ir;
    const storePath = ir.source.resolvedPath || process.cwd();

    const hasComponents =
      ir.skills.length > 0 ||
      ir.mcpServers.length > 0 ||
      extensions.agents.length > 0 ||
      extensions.rules.length > 0 ||
      extensions.commands.length > 0 ||
      extensions.workflows.length > 0 ||
      extensions.hooks.length > 0 ||
      !!extensions.contextFile;

    if (hasComponents) {
      // 0. Emit plugin.json manifest
      const pluginManifest = {
        $schema: 'https://antigravity.google/schemas/v1/plugin.json',
        name: ir.source.pluginName || 'agentpm-plugin',
        description: ir.source.pluginDescription || `${ir.source.pluginName || 'agentpm'} plugin for Antigravity`,
      };
      files.push({
        relativePath: 'plugin.json',
        content: JSON.stringify(pluginManifest, null, 2),
        description: 'Antigravity Plugin Manifest (plugin.json)',
      });
    }

    // 1. Emit Skills in Agent Skills standard directory layout: skills/<name>/SKILL.md
    for (const skill of ir.skills) {
      const skillContent = formatAntigravitySkill(skill);
      files.push({
        relativePath: `skills/${skill.name}/SKILL.md`,
        content: skillContent,
        description: `Skill: ${skill.name}`,
      });
    }

    // 2. Emit Subagents with strict YAML frontmatter & tool mapping
    for (const agent of extensions.agents) {
      const { content, warnings: agentWarnings } = formatAntigravityAgent(agent);
      warnings.push(...agentWarnings);
      files.push({
        relativePath: `agents/${agent.name}.md`,
        content,
        description: `Agent: ${agent.name}`,
      });
    }

    // 3. Emit Rules with trigger metadata
    for (const rule of extensions.rules) {
      const ruleContent = [
        '---',
        `trigger: always_on`,
        `managed_by: agentpm`,
        '---',
        '',
        rule.content,
      ].join('\n');

      files.push({
        relativePath: `rules/${rule.name}.md`,
        content: ruleContent,
        description: `Rule: ${rule.name}`,
      });
    }

    // 4. Emit AGENTS.md context file
    if (extensions.contextFile) {
      files.push({
        relativePath: 'AGENTS.md',
        content: extensions.contextFile.content,
        description: 'Context file (CLAUDE.md → AGENTS.md)',
      });
    }

    // 5. Emit Commands as Workflows (or upgraded Skills if > 12k chars per ADR 0023)
    if (extensions.commands.length > 0) {
      const cmdResult = convertCommandsToAntigravityWorkflows(extensions.commands);
      warnings.push(...cmdResult.warnings);

      files.push(...cmdResult.workflowFiles);
      files.push(...cmdResult.upgradedSkillFiles);
    }

    // Direct workflows
    for (const wf of extensions.workflows) {
      files.push({
        relativePath: `workflows/${wf.name}.md`,
        content: wf.content,
        description: `Workflow: ${wf.name}`,
      });
    }

    // 6. Emit MCP servers with path expansion -> mcp_config.json
    if (ir.mcpServers.length > 0) {
      const mcpConfig: Record<string, unknown> = {};
      for (const server of ir.mcpServers) {
        const rewritten = rewriteMcpServer(server, {
          pluginStorePath: storePath,
          targetProvider: 'antigravity',
        });
        mcpConfig[server.name] = {
          ...(rewritten.command !== undefined ? { command: rewritten.command } : {}),
          ...(rewritten.args !== undefined ? { args: rewritten.args } : {}),
          ...(rewritten.env !== undefined ? { env: rewritten.env } : {}),
          ...(rewritten.type !== undefined ? { type: rewritten.type } : {}),
          ...(rewritten.url !== undefined ? { url: rewritten.url } : {}),
          ...(rewritten.headers !== undefined ? { headers: rewritten.headers } : {}),
          ...(rewritten.cwd !== undefined ? { cwd: rewritten.cwd } : {}),
        };
      }
      files.push({
        relativePath: 'mcp_config.json',
        content: JSON.stringify(mcpConfig, null, 2),
        merge: true,
        description: 'MCP server configuration (.agents/mcp_config.json)',
      });
    }

    // 7. Emit Hooks as nested object schema via hook-converter
    if (extensions.hooks.length > 0) {
      const hookResult = convertHooks(extensions.hooks, 'antigravity', ir.source.pluginName || 'agentpm-plugin');
      warnings.push(...hookResult.warnings);

      if (hookResult.antigravitySchema) {
        files.push({
          relativePath: 'hooks.json',
          content: JSON.stringify(hookResult.antigravitySchema, null, 2),
          description: 'Hook definitions (nested object schema)',
        });
      }
    }

    if (extensions.outputStyles.length > 0) {
      warnings.push('Output styles not natively supported in Antigravity — dropped');
    }

    return {
      targetId: this.name,
      targetName: this.displayName,
      files,
      warnings,
      manualSteps,
    };
  }
}
