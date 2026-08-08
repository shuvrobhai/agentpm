import fs from 'node:fs/promises';
import path from 'node:path';

export interface ManifestCapabilities {
  skills: string[];
  rules: string[];
  mcpServers: string[];
  hooks: boolean;
}

export interface AuthorDetails {
  name?: string;
  email?: string;
  url?: string;
}

export class PackageManifest {
  name: string;
  version: string;
  description: string;
  author: AuthorDetails;
  schema: string | null;
  capabilities: ManifestCapabilities;
  pluginPath: string;
  manifestPath: string | null;
  isOpenCanonicalFormat: boolean;

  constructor(data: {
    name: string;
    version?: string;
    description?: string;
    author?: AuthorDetails;
    schema?: string | null;
    capabilities?: Partial<ManifestCapabilities>;
    pluginPath: string;
    manifestPath?: string | null;
    isOpenCanonicalFormat?: boolean;
  }) {
    this.name = data.name;
    this.version = data.version || '1.0.0';
    this.description = data.description || '';
    this.author = data.author || {};
    this.schema = data.schema || null;
    this.pluginPath = data.pluginPath;
    this.manifestPath = data.manifestPath || null;
    this.isOpenCanonicalFormat = data.isOpenCanonicalFormat !== false;
    this.capabilities = {
      skills: data.capabilities?.skills || [],
      rules: data.capabilities?.rules || [],
      mcpServers: data.capabilities?.mcpServers || [],
      hooks: data.capabilities?.hooks || false,
    };
  }

  static async load(pluginPath: string): Promise<PackageManifest> {
    const rootManifestPath = path.join(pluginPath, 'plugin.json');
    const claudeManifestPath = path.join(pluginPath, '.claude-plugin', 'plugin.json');

    let manifestData: any = null;
    let loadedManifestPath: string | null = null;
    let isCanonical = true;

    const rootExists = await fs.access(rootManifestPath).then(() => true).catch(() => false);
    if (rootExists) {
      try {
        const raw = await fs.readFile(rootManifestPath, 'utf8');
        manifestData = JSON.parse(raw);
        loadedManifestPath = rootManifestPath;
      } catch (e) {
        // Fallthrough if invalid JSON
      }
    }

    if (!manifestData) {
      const claudeExists = await fs.access(claudeManifestPath).then(() => true).catch(() => false);
      if (claudeExists) {
        try {
          const raw = await fs.readFile(claudeManifestPath, 'utf8');
          manifestData = JSON.parse(raw);
          loadedManifestPath = claudeManifestPath;
          isCanonical = false;
        } catch (e) {
          // Fallthrough
        }
      }
    }

    const fallbackName = path.basename(pluginPath);
    const name = manifestData?.name || fallbackName;
    const version = manifestData?.version || '1.0.0';
    const description = manifestData?.description || '';
    const author = manifestData?.author || {};
    const schema = manifestData?.$schema || null;

    const capabilities = await this.inspectCapabilities(pluginPath);

    return new PackageManifest({
      name,
      version,
      description,
      author,
      schema,
      capabilities,
      pluginPath,
      manifestPath: loadedManifestPath,
      isOpenCanonicalFormat: isCanonical,
    });
  }

  static validateSchema(manifestData: any): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!manifestData || typeof manifestData !== 'object') {
      return { valid: false, errors: ['Manifest data is not a valid JSON object'] };
    }

    if (manifestData.name && typeof manifestData.name !== 'string') {
      errors.push('Field "name" must be a string');
    }

    if (manifestData.version && typeof manifestData.version !== 'string') {
      errors.push('Field "version" must be a string');
    }

    if (manifestData.$schema && typeof manifestData.$schema !== 'string') {
      errors.push('Field "$schema" must be a string URL');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  private static async inspectCapabilities(pluginPath: string): Promise<ManifestCapabilities> {
    const skills: string[] = [];
    const rules: string[] = [];
    const mcpServers: string[] = [];
    let hooks = false;

    // 1. Discover Skills
    const skillsDir = path.join(pluginPath, 'skills');
    const skillsExist = await fs.access(skillsDir).then(() => true).catch(() => false);
    if (skillsExist) {
      const entries = await fs.readdir(skillsDir, { withFileTypes: true }).catch(() => []);
      for (const entry of entries) {
        if (entry.isDirectory()) {
          const skillMd = path.join(skillsDir, entry.name, 'SKILL.md');
          const hasSkill = await fs.access(skillMd).then(() => true).catch(() => false);
          if (hasSkill) {
            skills.push(entry.name);
          }
        }
      }
    }

    // 2. Discover MCP Servers (.mcp.json / mcp_config.json)
    for (const mcpFile of ['.mcp.json', 'mcp_config.json', 'plugin.json']) {
      const mcpPath = path.join(pluginPath, mcpFile);
      const exists = await fs.access(mcpPath).then(() => true).catch(() => false);
      if (exists) {
        try {
          const raw = await fs.readFile(mcpPath, 'utf8');
          const json = JSON.parse(raw);
          const servers = json.mcpServers || json.mcp;
          if (servers && typeof servers === 'object') {
            for (const key of Object.keys(servers)) {
              if (!mcpServers.includes(key)) {
                mcpServers.push(key);
              }
            }
          }
        } catch (e) {
          // Fallthrough
        }
      }
    }

    // 3. Discover Hooks (hooks.json)
    const hooksPath = path.join(pluginPath, 'hooks.json');
    hooks = await fs.access(hooksPath).then(() => true).catch(() => false);

    // 4. Discover Rules
    for (const ruleFile of ['AGENTS.md', 'CLAUDE.md', 'rules']) {
      const rulePath = path.join(pluginPath, ruleFile);
      const exists = await fs.access(rulePath).then(() => true).catch(() => false);
      if (exists) {
        rules.push(ruleFile);
      }
    }

    return { skills, rules, mcpServers, hooks };
  }
}
