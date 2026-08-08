import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { BaseAgentAdapter } from './base.js';
import type { MaterializationContext, DematerializationContext, AdapterHealthReport } from './base.js';
import type { PortableCoreIR, ConversionResult, FileOutput } from '../ir/types.js';
import { formatAgentSkill, skillSupportingFilesWarning } from '../ir/skill-format.js';
import { serializeNativeHooks } from '../ir/native-hooks.js';
import { validateCodexManifest } from '../core/codex-validator.js';

export class CodexAdapter extends BaseAgentAdapter {
  name = 'codex';
  displayName = 'Codex';
  protected override logTag = 'CodexAdapter';

  override get detectProbes(): { global: string[]; local: string[] } {
    return {
      global: [path.join(os.homedir(), '.codex')],
      local: [
        path.join(process.cwd(), '.codex'),
        path.join(process.cwd(), '.codex-plugin'),
        path.join(process.cwd(), '.agents', 'plugins', 'marketplace.json'),
      ],
    };
  }

  get globalPluginDir(): string {
    return path.join(os.homedir(), '.codex', 'plugins');
  }

  get localPluginDir(): string {
    return path.join(process.cwd(), '.codex');
  }

  override get candidateSearchDirs(): { global: string[]; local: string[] } {
    return {
      global: [
        path.join(os.homedir(), '.codex', 'plugins', 'cache', 'personal'),
        path.join(os.homedir(), '.codex', 'plugins', 'cache', 'openai-bundled'),
        path.join(os.homedir(), '.codex', 'plugins', 'cache', 'openai-curated'),
        path.join(os.homedir(), '.codex', 'plugins'),
        path.join(os.homedir(), '.codex', 'skills'),
      ],
      local: [
        path.join(process.cwd(), '.agents', 'plugins'),
        path.join(process.cwd(), '.codex', 'plugins'),
      ],
    };
  }

  capabilities(): string[] {
    return ['skills', 'rules', 'mcp', 'agents', 'hooks'];
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

  protected override async onAfterEnable(context: MaterializationContext): Promise<void> {
    await this.updateMarketplace(context.pluginName, context.scope, 'add');
    if (context.scope === 'global') {
      await this.updateCodexConfig(context.pluginName, 'add');
    }
  }

  protected override async onAfterDisable(context: DematerializationContext): Promise<void> {
    await this.updateMarketplace(context.pluginName, context.scope, 'remove');
    if (context.scope === 'global') {
      await this.updateCodexConfig(context.pluginName, 'remove');
    }
  }
  override async checkHealth(options?: { fix?: boolean }, cwd: string = process.cwd()): Promise<AdapterHealthReport> {
    const baseReport = await super.checkHealth(options, cwd);
    const issues = [...baseReport.issues];
    const fixedIssues = [...baseReport.fixedIssues];
    let totalChecks = baseReport.totalChecks;

    const home = os.homedir();
    const marketplaceFiles: Array<{ scope: 'global' | 'local'; file: string }> = [
      { scope: 'local', file: path.join(cwd, '.codex', 'marketplace.json') },
      { scope: 'local', file: path.join(cwd, '.agents', 'plugins', 'marketplace.json') },
      { scope: 'global', file: path.join(home, '.codex', 'plugins', 'marketplace.json') },
      { scope: 'global', file: path.join(home, '.agents', 'plugins', 'marketplace.json') },
    ];

    for (const { scope, file } of marketplaceFiles) {
      const exists = await fs.access(file).then(() => true).catch(() => false);
      if (!exists) continue;

      totalChecks++;
      try {
        const raw = await fs.readFile(file, 'utf8');
        const data = JSON.parse(raw);
        if (!Array.isArray(data.plugins)) continue;

        let changed = false;
        const remainingPlugins: unknown[] = [];

        for (const entry of data.plugins) {
          totalChecks++;
          if (!entry || typeof entry !== 'object') continue;
          const p = entry as Record<string, unknown>;
          const pluginName = typeof p.name === 'string' ? p.name : 'unknown';
          const source = p.source as Record<string, unknown> | undefined;
          const relPath = source && typeof source.path === 'string' ? source.path : undefined;

          if (!relPath) continue;
          const targetDir = path.resolve(path.dirname(file), relPath);
          const targetExists = await fs.access(targetDir).then(() => true).catch(() => false);

          if (!targetExists) {
            issues.push({
              type: 'dangling_marketplace_entry',
              agent: this.name,
              scope,
              path: file,
              target: targetDir,
              message: `Marketplace entry "${pluginName}" points to missing target: ${targetDir}`,
            });
            if (options?.fix) {
              changed = true;
              fixedIssues.push(`[${this.displayName}] Removed dangling entry "${pluginName}" from ${file}`);
              continue;
            }
          } else {
            const manifestPath = path.join(targetDir, '.codex-plugin', 'plugin.json');
            const altManifest = path.join(targetDir, 'plugin.json');
            const manifestFile = (await fs.access(manifestPath).then(() => true).catch(() => false))
              ? manifestPath
              : (await fs.access(altManifest).then(() => true).catch(() => false))
              ? altManifest
              : null;

            if (manifestFile) {
              try {
                const manifestRaw = await fs.readFile(manifestFile, 'utf8');
                const manifestData = JSON.parse(manifestRaw);
                const validation = validateCodexManifest(manifestData);
                if (!validation.valid) {
                  issues.push({
                    type: 'schema_error',
                    agent: this.name,
                    scope,
                    path: manifestFile,
                    message: `Codex manifest schema invalid: ${validation.errors.join('; ')}`,
                  });
                }
              } catch (err: unknown) {
                const msg = err instanceof Error ? err.message : String(err);
                issues.push({
                  type: 'schema_error',
                  agent: this.name,
                  scope,
                  path: manifestFile,
                  message: `Failed to parse Codex manifest JSON: ${msg}`,
                });
              }
            }
          }
          remainingPlugins.push(entry);
        }

        if (changed && options?.fix) {
          data.plugins = remainingPlugins;
          await fs.writeFile(file, JSON.stringify(data, null, 2) + '\n', 'utf8');
        }
      } catch {
        // ignore parse error on marketplace.json file itself
      }
    }

    return {
      agent: this.name,
      displayName: this.displayName || this.name,
      totalChecks,
      activePlugins: baseReport.activePlugins,
      issues,
      fixedIssues,
    };
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
}




