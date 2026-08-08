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
import { validateCodexManifest } from '../core/codex-validator.js';

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

    const desc = typeof ir.metadata['description'] === 'string' ? ir.metadata['description'] : '';
    const shortDesc = desc.slice(0, 100) || `${ir.source.pluginName} skills`;
    const longDesc = desc || `Comprehensive ${ir.source.pluginName} skills library.`;
    const authorObj = (ir.metadata['author'] && typeof ir.metadata['author'] === 'object') ? (ir.metadata['author'] as any) : null;
    const devName = authorObj?.name || 'Agent Plugins';
    const keywords = Array.isArray(ir.metadata['keywords']) ? ir.metadata['keywords'] : [];
    const cat = (typeof keywords[0] === 'string') ? keywords[0] : 'Coding';
    const starterPrompts = ir.skills.length > 0
      ? ir.skills.slice(0, 3).map((s) => `Use ${s.name} to assist with tasks.`.slice(0, 128))
      : [`Use ${ir.source.pluginName} skills.`];

    const manifest: Record<string, unknown> = {
      name: ir.source.pluginName,
      version: typeof ir.metadata['version'] === 'string' ? ir.metadata['version'] : '1.0.0',
      description: desc || 'Agent plugin',
      interface: {
        displayName: typeof ir.metadata['title'] === 'string' ? ir.metadata['title'] : ir.source.pluginName,
        shortDescription: shortDesc,
        longDescription: longDesc,
        developerName: devName,
        category: cat,
        capabilities: ['Interactive', 'Write'],
        defaultPrompt: starterPrompts,
      },
      skills: './skills/',
    };

    if (authorObj) manifest['author'] = authorObj;
    if (typeof ir.metadata['homepage'] === 'string') manifest['homepage'] = ir.metadata['homepage'];
    if (typeof ir.metadata['repository'] === 'string') manifest['repository'] = ir.metadata['repository'];
    if (typeof ir.metadata['license'] === 'string') manifest['license'] = ir.metadata['license'];
    if (keywords.length > 0) manifest['keywords'] = keywords;


    if (ir.mcpServers.length > 0) {
      manifest.mcpServers = './.mcp.json';
    }

    const validation = validateCodexManifest(manifest);
    if (!validation.valid) {
      warnings.push(...validation.errors.map((e) => `Codex manifest schema warning: ${e}`));
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
        if (server.cwd !== undefined) entry.cwd = server.cwd;
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
    return path.join(process.cwd(), '.agents', 'plugins', pluginName);
  }

  private async updateMarketplace(pluginName: string, scope: 'global' | 'local', action: 'add' | 'remove'): Promise<void> {
    const marketplaceFile = scope === 'local'
      ? path.join(process.cwd(), '.agents', 'plugins', 'marketplace.json')
      : path.join(os.homedir(), '.agents', 'plugins', 'marketplace.json');

    try {
      await fs.mkdir(path.dirname(marketplaceFile), { recursive: true });
      let data: any = {
        name: 'personal',
        interface: { displayName: 'Personal' },
        plugins: [],
      };

      try {
        const raw = await fs.readFile(marketplaceFile, 'utf8');
        data = JSON.parse(raw);
        if (!Array.isArray(data.plugins)) {
          data.plugins = [];
        }
      } catch {
        // file doesn't exist yet, use default template
      }

      if (action === 'add') {
        const exists = data.plugins.some((p: any) => p.name === pluginName);
        if (!exists) {
          data.plugins.push({
            name: pluginName,
            source: {
              source: 'local',
              path: `./plugins/${pluginName}`,
            },
            policy: {
              installation: 'AVAILABLE',
              authentication: 'ON_INSTALL',
            },
            category: 'Coding',
          });
          await fs.writeFile(marketplaceFile, JSON.stringify(data, null, 2) + '\n', 'utf8');
          console.log(`[CodexAdapter] Registered ${pluginName} in ${marketplaceFile}`);
        }
      } else {
        const initialLen = data.plugins.length;
        data.plugins = data.plugins.filter((p: any) => p.name !== pluginName);
        if (data.plugins.length !== initialLen) {
          await fs.writeFile(marketplaceFile, JSON.stringify(data, null, 2) + '\n', 'utf8');
          console.log(`[CodexAdapter] Unregistered ${pluginName} from ${marketplaceFile}`);
        }
      }
    } catch (err: any) {
      console.warn(`[CodexAdapter] Could not update marketplace.json: ${err.message}`);
    }
  }

  private async updateCodexConfig(pluginName: string, action: 'add' | 'remove'): Promise<void> {
    const configFile = path.join(os.homedir(), '.codex', 'config.toml');
    try {
      let content = '';
      try {
        content = await fs.readFile(configFile, 'utf8');
      } catch {
        return; // config file doesn't exist
      }

      const pluginSection = `[plugins."${pluginName}@personal"]`;
      if (action === 'add') {
        if (!content.includes(pluginSection)) {
          const addition = `\n${pluginSection}\nenabled = true\n`;
          await fs.appendFile(configFile, addition, 'utf8');
          console.log(`[CodexAdapter] Enabled ${pluginName}@personal in ${configFile}`);
        }
      } else {
        if (content.includes(pluginSection)) {
          const regex = new RegExp(`\\n*\\[plugins\\."${pluginName}@personal"\\]\\s*enabled\\s*=\\s*true\\s*`, 'g');
          const updated = content.replace(regex, '\n');
          await fs.writeFile(configFile, updated, 'utf8');
          console.log(`[CodexAdapter] Disabled ${pluginName}@personal in ${configFile}`);
        }
      }
    } catch (err: any) {
      console.warn(`[CodexAdapter] Could not update config.toml: ${err.message}`);
    }
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
      : path.join(os.homedir(), '.codex', 'plugins');

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

    // Register in marketplace and config.toml
    await this.updateMarketplace(pluginName, scope, 'add');
    if (scope === 'global') {
      await this.updateCodexConfig(pluginName, 'add');
    }
  }

  async disable(pluginName: string, scope: 'global' | 'local' = 'local'): Promise<void> {
    const targetDirs = scope === 'local'
      ? [
          path.join(process.cwd(), '.agents', 'plugins'),
          path.join(process.cwd(), '.codex', 'plugins'),
        ]
      : [
          path.join(os.homedir(), '.codex', 'plugins'),
        ];

    const removed = await MaterializationEngine.dematerialize({
      pluginName,
      targetBaseDirs: targetDirs,
    });

    for (const remPath of removed) {
      console.log(`[CodexAdapter] Removed materialization link: ${remPath}`);
    }

    // Unregister from marketplace and config.toml
    await this.updateMarketplace(pluginName, scope, 'remove');
    if (scope === 'global') {
      await this.updateCodexConfig(pluginName, 'remove');
    }

    if (removed.length === 0) {
      console.log(`[CodexAdapter] No active materialization found for ${pluginName}`);
    }
  }
}



