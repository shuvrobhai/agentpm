import type { AgentAdapter } from './base.js';
import { AntigravityAdapter } from './antigravity.js';
import { ClaudeCodeAdapter } from './claudecode.js';
import { CodexAdapter } from './codex.js';
import { OpenCodeAdapter } from './opencode.js';

export type { AgentAdapter, AgentAdapterPaths } from './base.js';
export * from './antigravity.js';
export * from './claudecode.js';
export * from './codex.js';
export * from './opencode.js';

const adapters: Record<string, () => AgentAdapter> = {
  'antigravity': () => new AntigravityAdapter(),
  'claude-code': () => new ClaudeCodeAdapter(),
  'claudecode': () => new ClaudeCodeAdapter(),
  'codex': () => new CodexAdapter(),
  'opencode': () => new OpenCodeAdapter(),
};

export function listAdapters(): string[] {
  return Object.keys(adapters);
}

export function getAdapter(name: string): AgentAdapter {
  const normalized = name.toLowerCase().trim();
  const factory = adapters[normalized];
  if (!factory) {
    throw new Error(`Unknown or unsupported target adapter: "${name}". Supported adapters: ${listAdapters().join(', ')}.`);
  }
  return factory();
}
