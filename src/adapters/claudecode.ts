import path from 'node:path';
import os from 'node:os';
import { BaseAgentAdapter } from './base.js';
import type { PortableCoreIR, ConversionResult, FileOutput } from '../ir/types.js';
import { formatAgentSkill, skillSupportingFilesWarning } from '../ir/skill-format.js';
import { serializeNativeHooks } from '../ir/native-hooks.js';
import { buildNativeManifestMetadata } from '../core/v1-manifest.js';

export class ClaudeCodeAdapter extends BaseAgentAdapter {
  name = 'claude-code';
  displayName = 'Claude Code';
  protected override logTag = 'ClaudeCodeAdapter';

  override get detectProbes(): { global: string[]; local: string[] } {
    return {
      global: [path.join(os.homedir(), '.claude')],
      local: [path.join(process.cwd(), '.claudecode')],
    };
  }

  get globalPluginDir(): string {
    return path.join(os.homedir(), '.claude', 'plugins');
  }

  get localPluginDir(): string {
    return path.join(process.cwd(), '.claudecode');
  }

  override get candidateSearchDirs(): { global: string[]; local: string[] } {
    return {
      global: [path.join(os.homedir(), '.claude', 'plugins')],
      local: [
        path.join(process.cwd(), '.agents', 'plugins'),
        path.join(process.cwd(), '.claude', 'plugins'),
      ],
    };
  }

  capabilities(): string[] {
    return ['skills', 'mcp'];
  }

  convert(ir: PortableCoreIR, _scope: 'workspace' | 'global'): ConversionResult {
    const files: FileOutput[] = [];
    const warnings: string[] = [];
    const manualSteps: string[] = [];
    const { extensions } = ir;

    const metadata = buildNativeManifestMetadata(
      ir.metadata ?? {},
      ir.source.pluginName || 'claude-plugin',
    );
    const manifest: Record<string, unknown> = { ...metadata };

    if (extensions.hooks.length > 0) {
      manifest.hooks = './hooks/hooks.json';
    }
    if (ir.mcpServers.length > 0) {
      manifest.mcpServers = './.mcp.json';
    }

    files.push({
      relativePath: '.claude-plugin/plugin.json',
      content: JSON.stringify(manifest, null, 2),
      description: 'Claude Code plugin manifest',
    });

    for (const skill of ir.skills) {
      files.push({
        relativePath: `skills/${skill.name}/SKILL.md`,
        content: formatAgentSkill(skill),
        description: `Skill: ${skill.name}`,
      });
      const warn = skillSupportingFilesWarning(skill);
      if (warn) warnings.push(warn);
    }

    for (const command of extensions.commands) {
      files.push({
        relativePath: `commands/${command.name}.md`,
        content: command.body,
        description: `Command: ${command.name}`,
      });
    }

    for (const agent of extensions.agents) {
      files.push({
        relativePath: `agents/${agent.name}.md`,
        content: agent.body,
        description: `Agent: ${agent.name}`,
      });
    }

    if (ir.mcpServers.length > 0) {
      const mcpConfig: Record<string, unknown> = {};
      for (const server of ir.mcpServers) {
        const entry: Record<string, unknown> = {};
        if (server.command !== undefined) entry.command = server.command;
        if (server.args !== undefined) entry.args = server.args;
        if (server.env !== undefined) entry.env = server.env;
        if (server.url !== undefined) entry.url = server.url;
        if (server.headers !== undefined) entry.headers = server.headers;
        // stdio is implicit from `command`; remote transports carry an explicit type.
        if (server.type !== undefined && server.type !== 'stdio') {
          entry.type = server.type === 'streamable-http' ? 'http' : server.type;
        }
        mcpConfig[server.name] = entry;
      }
      files.push({
        relativePath: '.mcp.json',
        content: JSON.stringify({ mcpServers: mcpConfig }, null, 2),
        merge: true,
        description: 'MCP server configuration',
      });
    }

    if (extensions.hooks.length > 0) {
      files.push({
        relativePath: 'hooks/hooks.json',
        content: JSON.stringify(serializeNativeHooks(extensions.hooks), null, 2),
        description: 'Hook definitions',
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
        relativePath: 'CLAUDE.md',
        content: extensions.contextFile.content,
        description: 'Context file (CLAUDE.md)',
      });
    }

    for (const style of extensions.outputStyles) {
      files.push({
        relativePath: `output-styles/${style.name}.md`,
        content: style.content,
        description: `Output style: ${style.name}`,
      });
    }

    for (const workflow of extensions.workflows) {
      const ext = workflow.extension || 'md';
      files.push({
        relativePath: `workflows/${workflow.name}.${ext}`,
        content: workflow.content,
        description: `Workflow: ${workflow.name}`,
      });
    }

    if (extensions.rules.length > 0) {
      manualSteps.push(
        'Rules were emitted under rules/. Claude Code loads plugin rules only if the ' +
          'manifest references them or they live in .claude/rules/ — verify discovery.',
      );
    }
    if (extensions.contextFile) {
      manualSteps.push(
        'CLAUDE.md at the plugin root is not loaded as project context by Claude Code. ' +
          'Ship instructions as a skill if they must reach the model.',
      );
    }
    if (extensions.hooks.length > 0) {
      manualSteps.push(
        'Hooks require trust: Claude Code prompts the user before running plugin hooks. ' +
          'Commands should use ${CLAUDE_PLUGIN_ROOT} for bundled script paths.',
      );
    }
    if (ir.mcpServers.some((s) => s.type === 'url')) {
      manualSteps.push(
        'Remote MCP servers require authentication — run `claude mcp auth <server>` after enabling.',
      );
    }

    return {
      targetId: this.name,
      targetName: this.displayName || 'Claude Code',
      files,
      warnings,
      manualSteps,
    };
  }
}



