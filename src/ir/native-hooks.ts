import type { HookIR } from './types.js';

/**
 * Serializes normalized hooks (HookIR) into the `hooks/hooks.json` shape shared
 * by Claude Code and Codex: an object keyed by event, each value an array of
 * `{ matcher?, hooks: [{ type, command|url|mcpTool, ... }] }` entries.
 */
export function serializeNativeHooks(hooks: HookIR[]): { hooks: Record<string, unknown[]> } {
  const byEvent: Record<string, Array<{ matcher?: string; hooks: Record<string, unknown>[] }>> = {};

  for (const hook of hooks) {
    const action: Record<string, unknown> = { type: hook.type };
    if (hook.command !== undefined) action.command = hook.command;
    if (hook.url !== undefined) action.url = hook.url;
    if (hook.mcpTool !== undefined) action.mcp_tool_name = hook.mcpTool;
    if (hook.timeout !== undefined) action.timeout = hook.timeout;

    const event = hook.event;
    const group = byEvent[event] ?? (byEvent[event] = []);
    const matcher = hook.matcher;

    const existing = group.find((g) => g.matcher === matcher);
    if (existing) {
      existing.hooks.push(action);
    } else {
      group.push({
        ...(matcher !== undefined ? { matcher } : {}),
        hooks: [action],
      });
    }
  }

  return { hooks: byEvent };
}
