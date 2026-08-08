export const PLUGIN_SCHEMA_URL = 'https://agent-plugins.org/schemas/1.0.0/plugin.schema.json';
export const MCP_SCHEMA_URL = 'https://agent-plugins.org/schemas/1.0.0/mcp.schema.json';

export const PLUGIN_NAME_PATTERN = /^(?!.*(?:--|\.\.))[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?$/;

export const PLUGIN_ALLOWED_KEYS = [
  '$schema',
  'name',
  'version',
  'description',
  'author',
  'homepage',
  'repository',
  'license',
  'keywords',
  'extensions',
] as const;

export type PluginAuthor = {
  name?: string;
  email?: string;
  url?: string;
};

export function sanitizePluginName(raw: string, fallback = 'plugin'): string {
  let name = (raw || '').trim().toLowerCase();
  if (!name) name = fallback.toLowerCase();
  name = name
    .replace(/[^a-z0-9.-]/g, '-')
    .replace(/(--)+/g, '-')
    .replace(/(\.\.)+/g, '.')
    .replace(/^[^a-z0-9]+/, '')
    .replace(/[^a-z0-9]+$/, '');
  if (!name) name = 'plugin';
  return name.slice(0, 64);
}

export function isValidPluginName(name: string): boolean {
  return PLUGIN_NAME_PATTERN.test(name);
}

function sanitizeAuthor(author: unknown): PluginAuthor | undefined {
  if (!author || typeof author !== 'object' || Array.isArray(author)) return undefined;
  const src = author as Record<string, unknown>;
  const out: PluginAuthor = {};
  for (const key of ['name', 'email', 'url'] as const) {
    const value = src[key];
    if (typeof value === 'string') out[key] = value;
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

/**
 * Native manifest metadata shared by per-agent emitters. Derives identity
 * fields (name, version, description, author, homepage, repository, license,
 * keywords) from the plugin IR metadata bag, mirroring how the portable writer
 * builds its closed-schema plugin.json — minus the portable-only keys.
 */
export function buildNativeManifestMetadata(
  metadata: Record<string, unknown>,
  fallbackName: string
): Record<string, unknown> {
  const name = sanitizePluginName(String(metadata.name ?? ''), fallbackName);
  const manifest: Record<string, unknown> = { name };

  for (const key of ['version', 'description', 'homepage', 'repository', 'license'] as const) {
    const value = metadata[key];
    if (typeof value === 'string' && value.trim() !== '') manifest[key] = value;
  }

  if (metadata.author && typeof metadata.author === 'object' && !Array.isArray(metadata.author)) {
    manifest.author = metadata.author;
  }
  if (Array.isArray(metadata.keywords)) {
    manifest.keywords = metadata.keywords.filter((k): k is string => typeof k === 'string');
  }

  return manifest;
}

export function buildPortablePluginManifest(
  source: Record<string, unknown>,
  fallbackName: string
): Record<string, unknown> {
  const name = sanitizePluginName(String(source.name ?? ''), fallbackName);
  const manifest: Record<string, unknown> = {
    $schema: PLUGIN_SCHEMA_URL,
    name,
  };

  for (const key of PLUGIN_ALLOWED_KEYS) {
    if (key === '$schema' || key === 'name') continue;
    const value = source[key];
    if (value === undefined) continue;

    switch (key) {
      case 'author':
        const author = sanitizeAuthor(value);
        if (author) manifest.author = author;
        break;
      case 'keywords':
        if (Array.isArray(value) && value.every((k) => typeof k === 'string')) {
          manifest.keywords = value;
        }
        break;
      case 'version':
        if (typeof value === 'string') manifest.version = value;
        break;
      case 'description':
        if (typeof value === 'string') manifest.description = value;
        break;
      case 'homepage':
      case 'repository':
      case 'license':
        if (typeof value === 'string') manifest[key] = value;
        break;
      case 'extensions':
        if (value && typeof value === 'object' && !Array.isArray(value)) {
          manifest.extensions = value;
        }
        break;
      default:
        break;
    }
  }

  return manifest;
}

type PortedServer = {
  type: 'stdio' | 'streamable-http' | 'sse';
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  cwd?: string;
  url?: string;
  headers?: Record<string, string>;
};

function inferServerType(server: Record<string, unknown>): 'stdio' | 'streamable-http' | 'sse' | null {
  if (typeof server.type === 'string') {
    if (server.type === 'stdio' || server.type === 'streamable-http' || server.type === 'sse') {
      return server.type;
    }
  }
  if (typeof server.command === 'string') return 'stdio';
  if (typeof server.url === 'string') return 'streamable-http';
  return null;
}

function portableCwd(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  if (trimmed === '.' || trimmed === '') return undefined;
  if (trimmed.startsWith('${PLUGIN_ROOT}') || trimmed.startsWith('${PLUGIN_DATA}')) {
    return trimmed;
  }
  if (trimmed.startsWith('./')) return trimmed;
  return `./${trimmed.replace(/^\.\//, '')}`;
}

export function buildPortableMcp(
  source: Record<string, unknown>,
  warnings: string[]
): Record<string, unknown> {
  const rawServers = source.mcpServers ?? source.mcp;
  const mcpServers: Record<string, PortedServer> = {};

  if (rawServers && typeof rawServers === 'object' && !Array.isArray(rawServers)) {
    for (const [name, raw] of Object.entries(rawServers as Record<string, unknown>)) {
      if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
        warnings.push(`MCP server "${name}" skipped: not an object`);
        continue;
      }
      const server = raw as Record<string, unknown>;
      const type = inferServerType(server);
      if (!type) {
        warnings.push(`MCP server "${name}" skipped: could not infer transport (needs "command" or "url")`);
        continue;
      }

      const ported: PortedServer = { type };

      if (type === 'stdio') {
        if (typeof server.command !== 'string') {
          warnings.push(`MCP server "${name}" skipped: stdio requires "command"`);
          continue;
        }
        ported.command = server.command;
        if (Array.isArray(server.args)) {
          ported.args = server.args.map((a) => String(a));
        }
        if (server.env && typeof server.env === 'object' && !Array.isArray(server.env)) {
          const env: Record<string, string> = {};
          for (const [k, v] of Object.entries(server.env as Record<string, unknown>)) {
            if (typeof v === 'string') env[k] = v;
          }
          ported.env = env;
        }
        const cwd = portableCwd(server.cwd);
        if (cwd) ported.cwd = cwd;
      } else {
        if (typeof server.url !== 'string') {
          warnings.push(`MCP server "${name}" skipped: "${type}" requires "url"`);
          continue;
        }
        ported.url = server.url;
        if (server.headers && typeof server.headers === 'object' && !Array.isArray(server.headers)) {
          const headers: Record<string, string> = {};
          for (const [k, v] of Object.entries(server.headers as Record<string, unknown>)) {
            if (typeof v === 'string') headers[k] = v;
          }
          ported.headers = headers;
        }
      }

      mcpServers[name] = ported;
    }
  }

  return {
    $schema: MCP_SCHEMA_URL,
    mcpServers,
  };
}
