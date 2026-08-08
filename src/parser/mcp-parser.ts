import path from 'node:path';
import { readJson, exists } from '../utils/fs.js';
import type { MCPServerIR } from '../ir/types.js';

interface ClaudeMCPServer {
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  type?: string;
  url?: string;
  headers?: Record<string, string>;
  cwd?: string;
  disabled?: boolean;
}

export async function parseMCPServers(pluginDir: string): Promise<MCPServerIR[]> {
  const mcpPath = path.join(pluginDir, '.mcp.json');
  if (!await exists(mcpPath)) return [];

  const raw = await readJson<Record<string, unknown>>(mcpPath);
  if (!raw) return [];

  const servers: MCPServerIR[] = [];
  const mcpServers = (raw.mcpServers || {}) as Record<string, ClaudeMCPServer>;

  for (const [name, config] of Object.entries(mcpServers)) {
    servers.push({
      name,
      ...(config.command !== undefined ? { command: config.command } : {}),
      ...(config.args !== undefined ? { args: config.args } : {}),
      ...(config.env !== undefined ? { env: config.env } : {}),
      ...(config.type !== undefined ? { type: config.type } : {}),
      ...(config.url !== undefined ? { url: config.url } : {}),
      ...(config.headers !== undefined ? { headers: config.headers } : {}),
      ...(config.cwd !== undefined ? { cwd: config.cwd } : {}),
      ...(config.disabled !== undefined ? { disabled: config.disabled } : {}),
      raw: config as Record<string, unknown>,
      sourcePath: mcpPath,
    });
  }

  return servers;
}
