import type { AgentAdapter } from './base.js';
import { AntigravityAdapter } from './antigravity.js';
import { ClaudeCodeAdapter } from './claudecode.js';
import { CodexAdapter } from './codex.js';
import { AgentPluginsAdapter } from './agent-plugins.js';

export type { AgentAdapter } from './base.js';
export * from './antigravity.js';
export * from './claudecode.js';
export * from './codex.js';
export * from './agent-plugins.js';

const adapters: Record<string, () => AgentAdapter> = {
  'antigravity': () => new AntigravityAdapter(),
  'claude-code': () => new ClaudeCodeAdapter(),
  'claudecode': () => new ClaudeCodeAdapter(),
  'codex': () => new CodexAdapter(),
  'agent-plugins': () => new AgentPluginsAdapter(),
  'v1': () => new AgentPluginsAdapter(),
};

export function getAdapter(name: string): AgentAdapter {
  const normalized = name.toLowerCase().trim();
  const factory = adapters[normalized];
  if (!factory) {
    throw new Error(`Unknown or unsupported target adapter: "${name}". Supported adapters: antigravity, claude-code, codex, agent-plugins.`);
  }
  return factory();
}
