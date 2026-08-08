import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import type { AgentAdapter, AgentAdapterPaths } from './base.js';
import type { PortableCoreIR, ConversionResult, FileOutput } from '../ir/types.js';
import { MaterializationEngine } from '../core/materialization.js';
import { GlobalStore } from '../core/store.js';

function mcpCommandToArray(
  command: string | undefined,
  args: string[] | undefined,
): string[] | undefined {
  if (!command) return undefined;
  return args?.length ? [command, ...args] : [command];
}

function mcpEnvironment(
  env: Record<string, string> | undefined,
): Record<string, string> | undefined {
  return env && Object.keys(env).length > 0 ? env : undefined;
}

const CLAUDE_TOOL_TO_OPENCODE: Record<string, string> = {
  Read: 'read',
  Write: 'edit',
  Edit: 'edit',
  Bash: 'bash',
  Grep: 'grep',
  Glob: 'glob',
  WebFetch: 'webfetch',
  WebSearch: 'websearch',
  LSP: 'lsp',
  Task: 'task',
  TodoWrite: 'todowrite',
};

function toolsToPermissions(tools: string[]): Record<string, string> {
  const permissions: Record<string, string> = {};

  const allTools = ['read', 'edit', 'bash', 'grep', 'glob', 'webfetch', 'websearch', 'lsp', 'task', 'todowrite'];
  for (const tool of allTools) {
    permissions[tool] = 'deny';
  }

  for (const tool of tools) {
    const mapped = CLAUDE_TOOL_TO_OPENCODE[tool];
    if (mapped) {
      permissions[mapped] = 'allow';
    }
  }

  return permissions;
}

function mapModel(model: string | undefined): string | undefined {
  if (!model) return undefined;
  if (model === 'inherit') return undefined;

  const modelMap: Record<string, string> = {
    'claude-sonnet-4-20250514': 'anthropic/claude-sonnet-4',
    'claude-4-sonnet': 'anthropic/claude-sonnet-4',
    'claude-4-opus': 'anthropic/claude-4-opus',
    'claude-3.7-sonnet': 'anthropic/claude-3.7-sonnet',
    'claude-3.5-sonnet': 'anthropic/claude-3.5-sonnet',
    'claude-3-haiku': 'anthropic/claude-3-haiku',
    'claude-3-opus': 'anthropic/claude-3-opus',
    'gpt-4o': 'openai/gpt-4o',
    'gpt-4o-mini': 'openai/gpt-4o-mini',
    'o1': 'openai/o1',
    'o3-mini': 'openai/o3-mini',
    'gemini-2.5-flash': 'gemini/gemini-2.5-flash',
    'gemini-2.5-pro': 'gemini/gemini-2.5-pro',
    'deepseek-r1': 'openrouter/deepseek-r1',
    'deepseek-coder': 'openrouter/deepseek-coder',
  };

  return modelMap[model] || model;
}

function agentMode(background?: boolean): string {
  return background ? 'subagent' : 'primary';
}

function formatSkillBody(skill: {
  name: string;
  description: string;
  body: string;
}): string {
  const lines: string[] = [];
  if (skill.description) {
    lines.push(`> ${skill.description}`);
    lines.push('');
  }
  lines.push(skill.body);
  return lines.join('\n');
}

function formatAgentFrontmatter(agent: {
  description: string;
  tools: string[];
  model?: string;
  background?: boolean;
  memory?: string;
}): string {
  const frontmatter: Record<string, unknown> = {
    description: agent.description,
    mode: agentMode(agent.background),
    permission: toolsToPermissions(agent.tools),
  };

  const model = mapModel(agent.model);
  if (model) {
    frontmatter.model = model;
  }

  return `---\n${Object.entries(frontmatter)
    .map(([k, v]) => {
      if (typeof v === 'object') {
        return `${k}:\n${Object.entries(v as Record<string, unknown>)
          .map(([sk, sv]) => `  ${sk}: ${sv}`)
          .join('\n')}`;
      }
      return `${k}: ${v}`;
    })
    .join('\n')}\n---`;
}

export class OpenCodeAdapter implements AgentAdapter {
  name = 'opencode';
  displayName = 'OpenCode';

  paths: AgentAdapterPaths = {
    skillsWorkspace: '.opencode/skills',
    skillsGlobal: '~/.config/opencode/skills',
    rulesWorkspace: '.opencode/rules',
    rulesGlobal: '~/.config/opencode/rules',
    hooksWorkspace: '.opencode/plugins',
    hooksGlobal: '~/.config/opencode/plugins',
    mcpConfig: 'opencode.json',
    contextFile: 'AGENTS.md',
  };

  async detect(scope: 'global' | 'local' = 'local'): Promise<boolean> {
    if (scope === 'local') {
      const localDir = path.join(process.cwd(), '.opencode');
      const localSkills = path.join(process.cwd(), '.opencode', 'skills');
      const hasDir = await fs.access(localDir).then(() => true).catch(() => false);
      const hasSkills = await fs.access(localSkills).then(() => true).catch(() => false);
      return hasDir || hasSkills;
    } else {
      const globalDir = path.join(os.homedir(), '.config', 'opencode');
      return await fs.access(globalDir).then(() => true).catch(() => false);
    }
  }

  capabilities(): string[] {
    return ['skills', 'mcp', 'rules', 'agents', 'commands'];
  }

  supportsDirectSymlink(): boolean {
    return true;
  }

  async install(pluginPath: string, scope: 'global' | 'local'): Promise<void> {
    console.log(`[OpenCodeAdapter] Installed plugin at ${pluginPath} (${scope})`);
  }

  async uninstall(pluginName: string, scope: 'global' | 'local'): Promise<void> {
    console.log(`[OpenCodeAdapter] Uninstalled plugin ${pluginName} (${scope})`);
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
    return path.join(process.cwd(), '.opencode', 'skills', pluginName);
  }

  convert(ir: PortableCoreIR, _scope: 'workspace' | 'global'): ConversionResult {
    const files: FileOutput[] = [];
    const warnings: string[] = [];
    const manualSteps: string[] = [];
    const { extensions } = ir;

    const mcpConfig: Record<string, unknown> = {};
    if (ir.mcpServers.length > 0) {
      for (const server of ir.mcpServers) {
        const cmd = mcpCommandToArray(server.command, server.args);
        if (!cmd) {
          warnings.push(`MCP "${server.name}": missing command, skipping`);
          continue;
        }
        const env = mcpEnvironment(server.env);
        mcpConfig[server.name] = {
          type: server.type === 'url' ? 'remote' : 'local',
          command: cmd,
          ...(env !== undefined ? { environment: env } : {}),
          ...(server.url !== undefined ? { url: server.url } : {}),
          ...(server.headers !== undefined ? { headers: server.headers } : {}),
          enabled: server.disabled === true ? false : true,
        };
      }

      const opencodeConfig: Record<string, unknown> = {
        $schema: 'https://opencode.ai/config.json',
      };

      if (Object.keys(mcpConfig).length > 0) {
        opencodeConfig.mcp = mcpConfig;
      }

      if (extensions.rules.length > 0) {
        opencodeConfig.instructions = ['.opencode/rules/*.md'];
      }

      files.push({
        relativePath: 'opencode.json',
        content: JSON.stringify(opencodeConfig, null, 2),
        merge: true,
        description: 'OpenCode configuration (MCP servers, instructions)',
      });
    } else if (extensions.rules.length > 0) {
      const opencodeConfig: Record<string, unknown> = {
        $schema: 'https://opencode.ai/config.json',
        instructions: ['.opencode/rules/*.md'],
      };

      files.push({
        relativePath: 'opencode.json',
        content: JSON.stringify(opencodeConfig, null, 2),
        merge: true,
        description: 'OpenCode configuration (instructions)',
      });
    }

    // OpenCode discovers skills from `SKILL.md` files. The directory form
    // (skills/<name>/SKILL.md) is the recommended layout because it gives the
    // skill a private base directory for supporting files; a flat markdown
    // file at the source root is also supported but has no private dir.
    for (const skill of ir.skills) {
      const skillContent = formatSkillBody(skill);
      files.push({
        relativePath: `.opencode/skills/${skill.name}/SKILL.md`,
        content: skillContent,
        description: `Skill: ${skill.name}`,
      });
      if (skill.supportingFiles.length > 0) {
        warnings.push(
          `Skill "${skill.name}": supporting files (${skill.supportingFiles.join(', ')}) ` +
            'must be copied into .opencode/skills/<name>/ — this converter emits SKILL.md only',
        );
      }
    }

    for (const command of extensions.commands) {
      files.push({
        relativePath: `.opencode/commands/${command.name}.md`,
        content: command.body,
        description: `Command: ${command.name}`,
      });
    }

    for (const agent of extensions.agents) {
      const frontmatter = formatAgentFrontmatter(agent);
      const agentContent = `${frontmatter}\n\n${agent.body}`;
      files.push({
        relativePath: `.opencode/agents/${agent.name}.md`,
        content: agentContent,
        description: `Agent: ${agent.name}`,
      });
    }

    for (const rule of extensions.rules) {
      files.push({
        relativePath: `.opencode/rules/${rule.name}.md`,
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

    if (extensions.hooks.length > 0) {
      warnings.push(
        'Hooks are not directly supported in OpenCode. ' +
          'Consider implementing them as an OpenCode plugin (.opencode/plugins/).',
      );
    }

    if (extensions.outputStyles.length > 0) {
      warnings.push('Output styles not supported in OpenCode — dropped');
    }
    if (extensions.workflows.length > 0) {
      warnings.push('Workflows not directly supported in OpenCode — convert manually');
    }

    for (const skill of ir.skills) {
      if (skill.rawFrontmatter['disable-model-invocation']) {
        warnings.push(
          `Skill "${skill.name}": disable-model-invocation → ` +
            'set permission for this skill in OpenCode agent config',
        );
      }
      if (skill.rawFrontmatter['context'] === 'fork') {
        warnings.push(
          `Skill "${skill.name}": context:fork → ` +
            'OpenCode supports subagents; create a subagent from this skill',
        );
      }
    }

    manualSteps.push(
      'Claude Code tools map to OpenCode: Read\u2192read, Write\u2192edit, Edit\u2192edit, ' +
        'Bash\u2192bash, Grep\u2192grep, Glob\u2192glob',
    );
    manualSteps.push(
      'Review agent permissions in .opencode/agents/*.md \u2014 OpenCode uses ' +
        'allow/deny/ask per tool rather than tool name lists',
    );
    if (ir.mcpServers.length > 0) {
      manualSteps.push(
        'MCP servers were added to opencode.json. Run `opencode mcp auth <server>` ' +
          'for any remote servers that require authentication.',
      );
    }
    if (extensions.agents.some((a) => a.memory)) {
      manualSteps.push(
        'Persistent memory is not available in OpenCode. ' +
          'Use AGENTS.md for persistent instructions instead.',
      );
    }

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
      : path.join(os.homedir(), '.config', 'opencode', 'plugins');

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
      console.log(`[OpenCodeAdapter] Materialized copied folder: ${result.materializedPath} (isolated edit mode)`);
    } else {
      console.log(`[OpenCodeAdapter] Materialized symlink: ${result.materializedPath} -> ${result.sourcePath} (${result.adaptedFilesCount} files adapted)`);
    }
  }

  async disable(pluginName: string, scope: 'global' | 'local' = 'local'): Promise<void> {
    const targetDirs = scope === 'local'
      ? [
          path.join(process.cwd(), '.agents', 'plugins'),
          path.join(process.cwd(), '.opencode', 'plugins'),
          path.join(process.cwd(), '.opencode', 'skills'),
          path.join(process.cwd(), '.opencode', 'commands'),
        ]
      : [
          path.join(os.homedir(), '.config', 'opencode', 'plugins'),
          path.join(os.homedir(), '.config', 'opencode', 'skills'),
          path.join(os.homedir(), '.config', 'opencode', 'commands'),
        ];

    const removed = await MaterializationEngine.dematerialize({
      pluginName,
      targetBaseDirs: targetDirs,
    });

    for (const remPath of removed) {
      console.log(`[OpenCodeAdapter] Removed materialization link: ${remPath}`);
    }

    if (removed.length === 0) {
      console.log(`[OpenCodeAdapter] No active materialization found for ${pluginName}`);
    }
  }
}
