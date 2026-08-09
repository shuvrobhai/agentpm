import type {
  AgentAdapter,
  ActivePluginInfo,
  DiagnosticIssue,
  AdapterHealthReport,
} from './base.js';
import { AntigravityAdapter } from './antigravity.js';
import { ClaudeCodeAdapter } from './claudecode.js';
import { CodexAdapter } from './codex.js';
import { OpenCodeAdapter } from './opencode.js';
import { PiAdapter } from './pi.js';

export type {
  AgentAdapter,
  ActivePluginInfo,
  DiagnosticIssue,
  AdapterHealthReport,
} from './base.js';
export * from './antigravity.js';
export * from './claudecode.js';
export * from './codex.js';
export * from './opencode.js';
export * from './pi.js';

const adapters: Record<string, () => AgentAdapter> = {
  'antigravity': () => new AntigravityAdapter(),
  'claude-code': () => new ClaudeCodeAdapter(),
  'claudecode': () => new ClaudeCodeAdapter(),
  'codex': () => new CodexAdapter(),
  'opencode': () => new OpenCodeAdapter(),
  'pi': () => new PiAdapter(),
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

export class AdapterRegistry {
  static all(): AgentAdapter[] {
    return [
      new AntigravityAdapter(),
      new ClaudeCodeAdapter(),
      new CodexAdapter(),
      new OpenCodeAdapter(),
      new PiAdapter(),
    ];
  }

  static list(): string[] {
    return ['antigravity', 'claude-code', 'codex', 'opencode', 'pi'];
  }

  static get(name: string): AgentAdapter {
    return getAdapter(name);
  }

  static async detectActive(scope: 'global' | 'local' = 'local'): Promise<AgentAdapter[]> {
    const detected: AgentAdapter[] = [];
    for (const adapter of this.all()) {
      if (await adapter.detect(scope)) {
        detected.push(adapter);
      }
    }
    return detected;
  }

  static async scanWorkspace(cwd: string = process.cwd()): Promise<ActivePluginInfo[]> {
    const results: ActivePluginInfo[] = [];
    for (const adapter of this.all()) {
      const active = await adapter.findActive('local', cwd);
      results.push(...active);
    }
    return results;
  }

  static async scanGlobal(): Promise<ActivePluginInfo[]> {
    const results: ActivePluginInfo[] = [];
    for (const adapter of this.all()) {
      const active = await adapter.findActive('global');
      results.push(...active);
    }
    return results;
  }

  static async checkHealth(options?: { fix?: boolean }, cwd: string = process.cwd()): Promise<{
    timestamp: string;
    healthy: boolean;
    totalChecks: number;
    activePlugins: Array<{ agent: string; scope: string; name: string; target: string }>;
    issues: DiagnosticIssue[];
    fixedIssues: string[];
    reports: AdapterHealthReport[];
  }> {
    const issues: DiagnosticIssue[] = [];
    const fixedIssues: string[] = [];
    const activePlugins: Array<{ agent: string; scope: string; name: string; target: string }> = [];
    const reports: AdapterHealthReport[] = [];
    let totalChecks = 0;

    for (const adapter of this.all()) {
      const report = await adapter.checkHealth(options, cwd);
      reports.push(report);
      totalChecks += report.totalChecks;
      issues.push(...report.issues);
      fixedIssues.push(...report.fixedIssues);
      for (const p of report.activePlugins) {
        activePlugins.push({
          agent: p.agent,
          scope: p.scope,
          name: p.pluginName,
          target: p.targetPath || p.materializedPath,
        });
      }
    }

    return {
      timestamp: new Date().toISOString(),
      healthy: issues.length === 0,
      totalChecks,
      activePlugins,
      issues,
      fixedIssues,
      reports,
    };
  }
}
