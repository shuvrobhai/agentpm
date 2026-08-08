import path from 'node:path';
import { readJson, exists } from '../utils/fs.js';
import type { HookIR } from '../ir/types.js';

interface ClaudeHookDefinition {
  matcher?: string;
  hooks: Array<{
    type: 'command' | 'http' | 'mcp_tool';
    command?: string;
    url?: string;
    mcp_tool?: string;
    timeout?: number;
  }>;
}

export async function parseHooks(pluginDir: string): Promise<HookIR[]> {
  const hooksPaths = [
    path.join(pluginDir, 'hooks', 'hooks.json'),
    path.join(pluginDir, 'hooks.json'),
  ];

  let hooksPath: string | undefined;
  for (const candidate of hooksPaths) {
    if (await exists(candidate)) {
      hooksPath = candidate;
      break;
    }
  }

  if (!hooksPath) return [];

  const raw = await readJson<Record<string, unknown>>(hooksPath);
  if (!raw) return [];

  const hooks: HookIR[] = [];
  const hooksObj = (raw.hooks || raw) as Record<string, ClaudeHookDefinition[]>;

  for (const [event, definitions] of Object.entries(hooksObj)) {
    if (!Array.isArray(definitions)) continue;

    for (const def of definitions) {
      if (!def.hooks || !Array.isArray(def.hooks)) continue;

      for (const hook of def.hooks) {
        hooks.push({
          event,
          ...(def.matcher !== undefined ? { matcher: def.matcher } : {}),
          type: hook.type,
          ...(hook.command !== undefined ? { command: hook.command } : {}),
          ...(hook.url !== undefined ? { url: hook.url } : {}),
          ...(hook.mcp_tool !== undefined ? { mcpTool: hook.mcp_tool } : {}),
          ...(hook.timeout !== undefined ? { timeout: hook.timeout } : {}),
          raw: { ...def, ...hook } as Record<string, unknown>,
          sourcePath: hooksPath,
        });
      }
    }
  }

  return hooks;
}
