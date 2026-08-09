import type { HookIR } from './types.js';
import type { TargetAgent } from './tool-mapper.js';
import { mapHookMatcher } from './tool-mapper.js';

export interface AntigravityHookObject {
  [pluginOrHookName: string]: {
    [eventType: string]: Array<{
      matcher?: string;
      hooks: Array<{
        type: 'command' | 'http' | 'mcp_tool';
        command?: string;
        url?: string;
        mcpTool?: string;
        timeout?: number;
      }>;
    }>;
  };
}

export interface HookConversionOutput {
  convertedHooks: HookIR[];
  antigravitySchema?: AntigravityHookObject;
  warnings: string[];
}

/**
 * Antigravity natively supports 5 core hook lifecycle events.
 */
const ANTIGRAVITY_SUPPORTED_EVENTS = new Set([
  'PreToolUse',
  'PostToolUse',
  'PreInvocation',
  'PostInvocation',
  'Stop',
]);

/**
 * Converts generic HookIR items into target agent native structures, logging structured warnings for unsupported events.
 */
export function convertHooks(
  hooks: HookIR[],
  targetAgent: TargetAgent,
  pluginName: string = 'agentpm-hooks'
): HookConversionOutput {
  const warnings: string[] = [];
  const convertedHooks: HookIR[] = [];

  if (targetAgent === 'antigravity') {
    const agSchema: AntigravityHookObject = {
      [pluginName]: {},
    };

    const eventMap = agSchema[pluginName]!;

    for (const hook of hooks) {
      if (!ANTIGRAVITY_SUPPORTED_EVENTS.has(hook.event)) {
        warnings.push(`Hook event '${hook.event}' is not supported by Antigravity — skipped`);
        continue;
      }

      const { mappedMatcher, warnings: matcherWarnings } = mapHookMatcher(hook.matcher, 'antigravity');
      warnings.push(...matcherWarnings);

      if (!eventMap[hook.event]) {
        eventMap[hook.event] = [];
      }

      const matcherKey = mappedMatcher || '.*';
      let entry = eventMap[hook.event]!.find((e) => e.matcher === matcherKey);
      if (!entry) {
        entry = { matcher: matcherKey, hooks: [] };
        eventMap[hook.event]!.push(entry);
      }

      entry.hooks.push({
        type: hook.type,
        ...(hook.command ? { command: hook.command } : {}),
        ...(hook.url ? { url: hook.url } : {}),
        ...(hook.mcpTool ? { mcpTool: hook.mcpTool } : {}),
        ...(hook.timeout ? { timeout: hook.timeout } : {}),
      });

      const updatedHook: HookIR = { ...hook };
      if (mappedMatcher !== undefined) {
        updatedHook.matcher = mappedMatcher;
      } else {
        delete updatedHook.matcher;
      }
      convertedHooks.push(updatedHook);
    }

    return {
      convertedHooks,
      antigravitySchema: agSchema,
      warnings,
    };
  }

  // Default passthrough for other target agents with tool matcher mapping
  for (const hook of hooks) {
    const { mappedMatcher, warnings: matcherWarnings } = mapHookMatcher(hook.matcher, targetAgent);
    warnings.push(...matcherWarnings);

    const updatedHook: HookIR = { ...hook };
    if (mappedMatcher !== undefined) {
      updatedHook.matcher = mappedMatcher;
    } else {
      delete updatedHook.matcher;
    }
    convertedHooks.push(updatedHook);
  }

  return {
    convertedHooks,
    warnings,
  };
}
