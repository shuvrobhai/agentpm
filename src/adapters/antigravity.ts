import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import type { AgentAdapter, AgentAdapterPaths } from './base.js';
import type { PortableCoreIR, ConversionResult, FileOutput } from '../ir/types.js';
import { MaterializationEngine } from '../core/materialization.js';
import { GlobalStore } from '../core/store.js';

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

export class AntigravityAdapter implements AgentAdapter {
  name = 'antigravity';
  displayName = 'Antigravity CLI';

  paths: AgentAdapterPaths = {
    skillsWorkspace: '.agy/skills',
    skillsGlobal: '~/.agy/skills',
    rulesWorkspace: '.agy/rules',
    rulesGlobal: '~/.agy/rules',
    hooksWorkspace: '.agy/hooks.json',
    hooksGlobal: '~/.agy/hooks.json',
    mcpConfig: '.agy/mcp.json',
    contextFile: '.agy/AGENTS.md',
  };

  async detect(scope: 'global' | 'local' = 'local'): Promise<boolean> {
    if (scope === 'local') {
      const localAgents = path.join(process.cwd(), '.agents');
      return await fs.access(localAgents).then(() => true).catch(() => false);
    } else {
      const globalGemini = path.join(os.homedir(), '.gemini');
      return await fs.access(globalGemini).then(() => true).catch(() => false);
    }
  }

  capabilities(): string[] {
    return ['skills', 'mcp', 'hooks'];
  }

  supportsDirectSymlink(): boolean {
    return true;
  }

  async install(pluginPath: string, scope: 'global' | 'local'): Promise<void> {
    console.log(`[AntigravityAdapter] Installed plugin at ${pluginPath} (${scope})`);
  }

  async uninstall(pluginName: string, scope: 'global' | 'local'): Promise<void> {
    console.log(`[AntigravityAdapter] Uninstalled plugin ${pluginName} (${scope})`);
  }

  async resolveVersion(pluginName: string): Promise<string> {
    try {
      const pluginPath = await GlobalStore.findPluginPath(pluginName);
      return path.basename(pluginPath);
    } catch {
      return 'latest';
    }
  }

  getPluginDir(pluginName: string, version = 'latest'): string {
    return GlobalStore.getAdaptedPluginPath(this.name, 'adapted', pluginName, version);
  }

  getLocalPluginDir(pluginName: string): string {
    return path.join(process.cwd(), '.agents', 'plugins', pluginName);
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

  async enable(
    pluginName: string,
    scope: 'global' | 'local' = 'local',
    options?: { copy?: boolean | undefined; version?: string | undefined }
  ): Promise<void> {
    let sourcePath: string | undefined;
    let version = options?.version;

    const baseDir = scope === 'local'
      ? path.join(process.cwd(), '.agents', 'plugins')
      : path.join(os.homedir(), '.gemini', 'config', 'plugins');

    if (scope === 'local' && !options?.version) {
      const localWorkspacePath = this.getLocalPluginDir(pluginName);
      const localExists = await fs.access(localWorkspacePath).then(() => true).catch(() => false);
      if (localExists) {
        sourcePath = localWorkspacePath;
        version = 'workspace';
      }
    }

    if (!sourcePath) {
      version = version || (await this.resolveVersion(pluginName));
    }

    const result = await MaterializationEngine.materialize({
      adapterName: this.name,
      pluginName,
      version,
      sourcePath,
      scope,
      targetBaseDir: baseDir,
      copy: options?.copy,
    });

    if (result.isCopy) {
      console.log(`[AntigravityAdapter] Materialized copied folder: ${result.materializedPath} (isolated edit mode)`);
    } else {
      console.log(`[AntigravityAdapter] Materialized symlink: ${result.materializedPath} -> ${result.sourcePath} (${result.adaptedFilesCount} files adapted)`);
    }
  }

  async disable(pluginName: string, scope: 'global' | 'local' = 'local'): Promise<void> {
    const pluginsDir = scope === 'local'
      ? path.join(process.cwd(), '.agents', 'plugins')
      : path.join(os.homedir(), '.gemini', 'config', 'plugins');

    const skillsDir = scope === 'local'
      ? path.join(process.cwd(), '.agents', 'skills')
      : path.join(os.homedir(), '.gemini', 'config', 'skills');

    const removed = await MaterializationEngine.dematerialize({
      pluginName,
      targetBaseDirs: [pluginsDir, skillsDir],
    });

    for (const remPath of removed) {
      console.log(`[AntigravityAdapter] Removed materialization link: ${remPath}`);
    }

    if (removed.length === 0) {
      console.log(`[AntigravityAdapter] No active materialization found for ${pluginName}`);
    }
  }
}
