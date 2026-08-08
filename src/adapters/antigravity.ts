import path from 'node:path';
import os from 'node:os';
import { BaseAgentAdapter } from './base.js';
import type { PortableCoreIR, ConversionResult, FileOutput } from '../ir/types.js';

function formatSkill(skill: { name: string; description: string; body: string }): string {
  const lines: string[] = [];
  lines.push(`# ${skill.name}`);
  lines.push('');
  if (skill.description) {
    lines.push(skill.description);
    lines.push('');
  }
  lines.push(skill.body);
  return lines.join('\n');
}

function formatAgent(agent: { name: string; description: string; body: string; tools: string[]; model?: string }): string {
  const lines: string[] = [];
  lines.push(`# ${agent.name}`);
  lines.push('');
  lines.push(`**Description:** ${agent.description}`);
  if (agent.model) {
    lines.push(`**Model:** ${agent.model}`);
  }
  lines.push('');
  lines.push('## System Prompt');
  lines.push('');
  lines.push(agent.body);
  return lines.join('\n');
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
      local: [
        path.join(process.cwd(), '.agents', 'plugins'),
      ],
    };
  }

  capabilities(): string[] {
    return ['skills', 'mcp', 'hooks'];
  }

  convert(ir: PortableCoreIR, _scope: 'workspace' | 'global'): ConversionResult {
    const files: FileOutput[] = [];
    const warnings: string[] = [];
    const manualSteps: string[] = [];
    const { extensions } = ir;

    for (const skill of ir.skills) {
      const skillContent = formatSkill(skill);
      files.push({
        relativePath: `skills/${skill.name}.md`,
        content: skillContent,
        description: `Skill: ${skill.name}`,
      });
    }

    for (const agent of extensions.agents) {
      const agentContent = formatAgent(agent);
      files.push({
        relativePath: `agents/${agent.name}.md`,
        content: agentContent,
        description: `Agent: ${agent.name}`,
      });
    }

    for (const rule of extensions.rules) {
      files.push({
        relativePath: `rules/${rule.name}.md`,
        content: rule.content,
        description: `Rule: ${rule.name}`,
      });
    }

    if (extensions.contextFile) {
      files.push({
        relativePath: 'AGENTS.md',
        content: extensions.contextFile.content,
        description: 'Context file (CLAUDE.md → AGENTS.md)',
      });
    }

    if (ir.mcpServers.length > 0) {
      const mcpConfig: Record<string, unknown> = {};
      for (const server of ir.mcpServers) {
        mcpConfig[server.name] = {
          ...(server.command !== undefined ? { command: server.command } : {}),
          ...(server.args !== undefined ? { args: server.args } : {}),
          ...(server.env !== undefined ? { env: server.env } : {}),
          ...(server.type !== undefined ? { type: server.type } : {}),
          ...(server.url !== undefined ? { url: server.url } : {}),
          ...(server.headers !== undefined ? { headers: server.headers } : {}),
        };
      }
      files.push({
        relativePath: 'mcp.json',
        content: JSON.stringify(mcpConfig, null, 2),
        merge: true,
        description: 'MCP server configuration',
      });
    }

    if (extensions.hooks.length > 0) {
      const hooksConfig: Record<string, unknown>[] = [];
      for (const hook of extensions.hooks) {
        hooksConfig.push({
          event: hook.event,
          type: hook.type,
          ...(hook.command !== undefined ? { command: hook.command } : {}),
          ...(hook.url !== undefined ? { url: hook.url } : {}),
          ...(hook.mcpTool !== undefined ? { mcpTool: hook.mcpTool } : {}),
          ...(hook.matcher !== undefined ? { matcher: hook.matcher } : {}),
          ...(hook.timeout !== undefined ? { timeout: hook.timeout } : {}),
        });
      }
      files.push({
        relativePath: 'hooks.json',
        content: JSON.stringify(hooksConfig, null, 2),
        description: 'Hook definitions',
      });
    }

    if (extensions.outputStyles.length > 0) {
      warnings.push('Output styles not supported in Antigravity — dropped');
    }
    if (extensions.workflows.length > 0) {
      warnings.push('Workflows not directly supported — convert to Antigravity schedules manually');
    }

    manualSteps.push(
      'Claude Code tools map to Antigravity: Read→view_file, Write→write_to_file, Edit→replace_file_content, Grep→grep_search, Glob→list_dir, Bash→run_command'
    );

    return {
      targetId: this.name,
      targetName: this.displayName,
      files,
      warnings,
      manualSteps,
    };
  }
}

