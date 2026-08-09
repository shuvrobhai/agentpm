import path from 'node:path';
import type { PortableMCPServerIR, MCPServerIR } from '../ir/types.js';
import type { TargetAgent } from '../ir/tool-mapper.js';

export interface McpRewriteOptions {
  pluginStorePath: string;
  targetProvider: TargetAgent;
  workspaceRoot?: string;
}

/**
 * Expands ${CLAUDE_PLUGIN_ROOT} and relative executable paths to absolute paths
 * according to ADR 0024 (Dual-Phase Expansion).
 */
export function expandPathString(
  input: string,
  pluginStorePath: string,
  workspaceRoot?: string
): string {
  if (!input) return input;

  // 1. Replace ${CLAUDE_PLUGIN_ROOT} placeholder with pluginStorePath
  let resolved = input.replace(/\$\{CLAUDE_PLUGIN_ROOT\}/g, pluginStorePath);

  // 2. Expand relative file path if starting with ./ or ../ or matching relative paths
  if (resolved.startsWith('./') || resolved.startsWith('../')) {
    const basePath = workspaceRoot || pluginStorePath;
    resolved = path.resolve(basePath, resolved);
  }

  return resolved;
}

/**
 * Rewrites a single PortableMCPServerIR or MCPServerIR configuration.
 */
export function rewriteMcpServer<T extends PortableMCPServerIR | MCPServerIR>(
  server: T,
  options: McpRewriteOptions
): T {
  const { pluginStorePath, workspaceRoot } = options;
  const copy = JSON.parse(JSON.stringify(server)) as T;

  if (copy.command) {
    copy.command = expandPathString(copy.command, pluginStorePath, workspaceRoot);
  }

  if (copy.args && Array.isArray(copy.args)) {
    copy.args = copy.args.map((arg) => expandPathString(arg, pluginStorePath, workspaceRoot));
  }

  if (copy.cwd) {
    copy.cwd = expandPathString(copy.cwd, pluginStorePath, workspaceRoot);
  } else {
    // Codex & Antigravity explicitly require cwd to be set if relative paths are present
    copy.cwd = pluginStorePath;
  }

  return copy;
}

/**
 * Rewrites a full MCP config object (key-value mapping of server name -> server config).
 */
export function rewriteMcpConfig(
  mcpConfig: Record<string, unknown>,
  options: McpRewriteOptions
): Record<string, unknown> {
  const { pluginStorePath, workspaceRoot } = options;
  const rewritten: Record<string, unknown> = {};

  for (const [serverName, rawConfig] of Object.entries(mcpConfig)) {
    if (!rawConfig || typeof rawConfig !== 'object') {
      rewritten[serverName] = rawConfig;
      continue;
    }

    const cfg = JSON.parse(JSON.stringify(rawConfig)) as Record<string, unknown>;

    if (typeof cfg.command === 'string') {
      cfg.command = expandPathString(cfg.command, pluginStorePath, workspaceRoot);
    }

    if (Array.isArray(cfg.args)) {
      cfg.args = cfg.args.map((arg) =>
        typeof arg === 'string' ? expandPathString(arg, pluginStorePath, workspaceRoot) : arg
      );
    }

    if (typeof cfg.cwd === 'string') {
      cfg.cwd = expandPathString(cfg.cwd, pluginStorePath, workspaceRoot);
    } else {
      cfg.cwd = pluginStorePath;
    }

    rewritten[serverName] = cfg;
  }

  return rewritten;
}
