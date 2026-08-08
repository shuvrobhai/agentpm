import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import type { AgentAdapter } from './base.js';
import type { PortableCoreIR, ConversionResult, FileOutput } from '../ir/types.js';
import { formatAgentSkill, skillSupportingFilesWarning } from '../ir/skill-format.js';
import { serializeNativeHooks } from '../ir/native-hooks.js';
import { buildNativeManifestMetadata } from '../core/v1-manifest.js';
import { MaterializationEngine } from '../core/materialization.js';
import { GlobalStore } from '../core/store.js';

export class CodexAdapter implements AgentAdapter {
  name = 'codex';
  displayName = 'Codex';

  async detect(scope: 'global' | 'local' = 'local'): Promise<boolean> {
    if (scope === 'local') {
      const localCodex = path.join(process.cwd(), '.codex');
      const localPlugin = path.join(process.cwd(), '.codex-plugin');
      const localMarketplace = path.join(process.cwd(), '.agents', 'plugins', 'marketplace.json');
      const hasCodex = await fs.access(localCodex).then(() => true).catch(() => false);
      const hasPlugin = await fs.access(localPlugin).then(() => true).catch(() => false);
      const hasMarketplace = await fs.access(localMarketplace).then(() => true).catch(() => false);
      return hasCodex || hasPlugin || hasMarketplace;
    } else {
      const globalCodex = path.join(os.homedir(), '.codex');
      return await fs.access(globalCodex).then(() => true).catch(() => false);
    }
  }

  capabilities(): string[] {
    return ['skills', 'rules', 'mcp', 'agents', 'hooks'];
  }

  supportsDirectSymlink(): boolean {
    return true;
  }

  convert(ir: PortableCoreIR, _scope: 'workspace' | 'global'): ConversionResult {
    const files: FileOutput[] = [];
    const warnings: string[] = [];
    const manualSteps: string[] = [];
    const { extensions } = ir;

    const metadata = buildNativeManifestMetadata(
      ir.metadata ?? {},
      ir.source.pluginName || 'codex-plugin',
    );
    const manifest: Record<string, unknown> = {
      ...metadata,
      skills: './skills/',
    };

    if (ir.mcpServers.length > 0) {
      manifest.mcpServers = './.mcp.json';
    }
    if (extensions.hooks.length > 0) {
      manifest.hooks = './hooks/hooks.json';
    }

    files.push({
      relativePath: '.codex-plugin/plugin.json',
      content: JSON.stringify(manifest, null, 2),
      description: 'Codex plugin manifest',
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

    if (ir.mcpServers.length > 0) {
      const mcpConfig: Record<string, unknown> = {};
      for (const server of ir.mcpServers) {
        const entry: Record<string, unknown> = {};
        if (server.command !== undefined) entry.command = server.command;
        if (server.args !== undefined) entry.args = server.args;
        if (server.env !== undefined) entry.env = server.env;
        if (server.url !== undefined) entry.url = server.url;
        if (server.headers !== undefined) entry.headers = server.headers;
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

    if (extensions.agents.length > 0) {
      warnings.push(
        'Codex plugins do not bundle subagent files — agents were dropped. ' +
          'Distribute them as a separate Codex custom command or skill.',
      );
    }
    if (extensions.commands.length > 0) {
      warnings.push(
        'Codex plugins do not bundle slash commands — commands were dropped. ' +
          'Express them as skills instead.',
      );
    }
    if (extensions.rules.length > 0) {
      warnings.push('Codex rules were dropped — Codex loads instructions via skills, not rule files.');
    }
    if (extensions.contextFile) {
      warnings.push(
        'Context file was dropped — Codex plugins contribute context through skills. ' +
          'Add the context file content as a skill if it must reach the model.',
      );
    }
    if (extensions.outputStyles.length > 0) {
      warnings.push('Output styles not supported in Codex — dropped');
    }
    if (extensions.workflows.length > 0) {
      warnings.push('Workflows not supported in Codex — dropped');
    }

    if (extensions.hooks.length > 0) {
      manualSteps.push(
        'Plugin hooks are not auto-trusted: the user must review and trust them in Codex. ' +
          'Hook commands receive PLUGIN_ROOT / PLUGIN_DATA environment variables.',
      );
    }
    if (ir.mcpServers.some((s) => s.type === 'url')) {
      manualSteps.push(
        'Remote MCP servers require authentication — enable and authorize the bundled server ' +
          'after installing the plugin.',
      );
    }

    return {
      targetId: this.name,
      targetName: this.displayName || 'Codex',
      files,
      warnings,
      manualSteps,
    };
  }

  async install(pluginPath: string, scope: 'global' | 'local'): Promise<void> {
    console.log(`[CodexAdapter] Installed plugin at ${pluginPath} (${scope})`);
  }

  async uninstall(pluginName: string, scope: 'global' | 'local'): Promise<void> {
    console.log(`[CodexAdapter] Uninstalled plugin ${pluginName} (${scope})`);
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
    return path.join(process.cwd(), '.codex', 'skills', pluginName);
  }

  async enable(
    pluginName: string,
    scope: 'global' | 'local' = 'local',
    options?: { copy?: boolean | undefined; version?: string | undefined }
  ): Promise<void> {
    let sourcePath: string | undefined;
    let version = options?.version;

    const baseDir = scope === 'local'
      ? path.join(process.cwd(), '.codex', 'skills')
      : path.join(os.homedir(), '.codex', 'skills');

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
      console.log(`[CodexAdapter] Materialized copied folder: ${result.materializedPath} (isolated edit mode)`);
    } else {
      console.log(`[CodexAdapter] Materialized symlink: ${result.materializedPath} -> ${result.sourcePath} (${result.adaptedFilesCount} files adapted)`);
    }
  }

  async disable(pluginName: string, scope: 'global' | 'local' = 'local'): Promise<void> {
    const skillsDir = scope === 'local'
      ? path.join(process.cwd(), '.codex', 'skills')
      : path.join(os.homedir(), '.codex', 'skills');

    const pluginsDir = scope === 'local'
      ? path.join(process.cwd(), '.codex-plugin')
      : path.join(os.homedir(), '.codex', 'plugins');

    const removed = await MaterializationEngine.dematerialize({
      pluginName,
      targetBaseDirs: [skillsDir, pluginsDir],
    });

    for (const remPath of removed) {
      console.log(`[CodexAdapter] Removed materialization link: ${remPath}`);
    }

    if (removed.length === 0) {
      console.log(`[CodexAdapter] No active materialization found for ${pluginName}`);
    }
  }
}
