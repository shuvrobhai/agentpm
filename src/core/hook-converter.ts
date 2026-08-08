export type ClaudeHookEvent =
  | 'PreToolUse'
  | 'PostToolUse'
  | 'PreInvocation'
  | 'PostInvocation'
  | 'Stop'
  | 'SessionStart'
  | 'SessionEnd'
  | 'UserPromptSubmit'
  | 'PermissionRequest'
  | 'PermissionDenied'
  | 'SubagentStart'
  | 'SubagentStop'
  | 'PostToolUseFailure'
  | 'PostToolBatch'
  | 'StopFailure'
  | 'Notification'
  | 'MessageDisplay'
  | 'ConfigChange'
  | 'CwdChanged'
  | 'FileChanged'
  | 'DirectoryAdded'
  | 'WorktreeCreate'
  | 'WorktreeRemove'
  | 'PreCompact'
  | 'PostCompact'
  | 'Elicitation'
  | 'ElicitationResult'
  | 'InstructionsLoaded'
  | 'TeammateIdle'
  | 'TaskCreated'
  | 'TaskCompleted';

export type AntigravityHookEvent =
  | 'PreToolUse'
  | 'PostToolUse'
  | 'PreInvocation'
  | 'PostInvocation'
  | 'Stop';

const CONVERTIBLE_EVENTS: Set<string> = new Set([
  'PreToolUse',
  'PostToolUse',
  'PreInvocation',
  'PostInvocation',
  'Stop',
]);

const LOSSY_EVENTS: Map<string, string> = new Map([
  ['SessionStart', 'No Antigravity equivalent — session lifecycle is managed internally'],
  ['SessionEnd', 'No Antigravity equivalent'],
  ['UserPromptSubmit', 'No Antigravity equivalent'],
  ['PermissionRequest', 'Antigravity uses permission engine, not hooks'],
  ['PermissionDenied', 'Antigravity uses permission engine, not hooks'],
  ['SubagentStart', 'Antigravity manages subagent lifecycle via invoke_subagent'],
  ['SubagentStop', 'Antigravity manages subagent lifecycle via invoke_subagent'],
]);

export const TOOL_NAME_MAP: Record<string, string> = {
  'Read': 'view_file',
  'read_file': 'view_file',
  'read': 'view_file',
  'cat': 'view_file',
  'file_read': 'view_file',

  'Write': 'write_to_file',
  'write_file': 'write_to_file',
  'write': 'write_to_file',
  'create_file': 'write_to_file',
  'file_write': 'write_to_file',

  'Edit': 'replace_file_content',
  'edit_file': 'replace_file_content',
  'str_replace_editor': 'replace_file_content',
  'edit': 'replace_file_content',
  'sed': 'replace_file_content',

  'multi_edit': 'multi_replace_file_content',
  'batch_edit': 'multi_replace_file_content',

  'Grep': 'grep_search',
  'grep': 'grep_search',
  'search': 'grep_search',
  'rg': 'grep_search',

  'Glob': 'find_by_name',
  'find_files': 'find_by_name',
  'find': 'find_by_name',
  'glob': 'find_by_name',

  'list_files': 'list_dir',
  'ls': 'list_dir',
  'list_dir': 'list_dir',
  'dir': 'list_dir',

  'WebFetch': 'read_url_content',
  'fetch': 'read_url_content',
  'read_url': 'read_url_content',

  'WebSearch': 'search_web',
  'web_search': 'search_web',
  'search_web': 'search_web',

  'Bash': 'run_command',
  'bash': 'run_command',
  'shell': 'run_command',
  'terminal': 'run_command',
  'Execute': 'run_command',
  'execute': 'run_command',

  'Agent': 'invoke_subagent',
  'Task': 'invoke_subagent',
  'subagent': 'invoke_subagent',

  'AskUserQuestion': 'ask_question',
  'ask': 'ask_question',
};

export interface ClaudeMatcher {
  toolName?: string;
  pattern?: string;
  wildcard?: boolean;
}

export interface ClaudeHookAction {
  type: 'command' | 'http' | 'mcp_tool' | 'prompt' | 'verifier';
  command?: string;
  url?: string;
  verifier?: string;
  prompt?: string;
  env?: Record<string, string>;
}

export interface ClaudeHookDefinition {
  event: ClaudeHookEvent;
  matcher?: ClaudeMatcher | string;
  action: ClaudeHookAction;
  enabled?: boolean;
}

export interface ClaudeHooksFile {
  hooks: ClaudeHookDefinition[] | Record<string, ClaudeHookDefinition[]>;
}

export interface AntigravityHookEntry {
  type: 'command';
  command: string;
  timeout: number;
}

export interface AntigravityMatcherEntry {
  matcher: string;
  hooks: AntigravityHookEntry[];
}

export interface AntigravityNamedHook {
  enabled?: boolean;
  PreToolUse?: AntigravityMatcherEntry[];
  PostToolUse?: AntigravityMatcherEntry[];
  PreInvocation?: AntigravityMatcherEntry[];
  PostInvocation?: AntigravityMatcherEntry[];
  Stop?: AntigravityMatcherEntry[];
}

export type AntigravityHooksFile = Record<string, AntigravityNamedHook>;

export interface ConversionWarning {
  level: 'info' | 'warning' | 'error';
  hookName: string;
  event: string;
  message: string;
}

export interface HookConversionResult {
  output: AntigravityHooksFile;
  converted: number;
  skipped: number;
  partial: number;
  warnings: ConversionWarning[];
  summary: string;
}

export function convertHooks(
  claudeHooks: ClaudeHooksFile,
  pluginName: string
): HookConversionResult {
  const output: AntigravityHooksFile = {};
  const warnings: ConversionWarning[] = [];
  let converted = 0;
  let skipped = 0;
  let partial = 0;
  let hookCounter = 0;

  const hooks = normalizeClaudeHooks(claudeHooks);

  for (const hook of hooks) {
    const { event, matcher, action, enabled } = hook;
    hookCounter++;

    if (!CONVERTIBLE_EVENTS.has(event)) {
      const reason = LOSSY_EVENTS.get(event) || 'No Antigravity equivalent';
      warnings.push({
        level: 'warning',
        hookName: `hook-${hookCounter}`,
        event,
        message: `SKIPPED: Event "${event}" has no Antigravity equivalent. ${reason}`,
      });
      skipped++;
      continue;
    }

    if (action.type === 'verifier') {
      warnings.push({
        level: 'error',
        hookName: `hook-${hookCounter}`,
        event,
        message: `SKIPPED: Claude "verifier" hook type has no Antigravity equivalent.`,
      });
      skipped++;
      continue;
    }

    if (action.type === 'prompt') {
      warnings.push({
        level: 'warning',
        hookName: `hook-${hookCounter}`,
        event,
        message: `PARTIAL: Claude "prompt" hook converted to stub wrapper.`,
      });
      partial++;
    }

    if (action.type === 'http') {
      warnings.push({
        level: 'warning',
        hookName: `hook-${hookCounter}`,
        event,
        message: `PARTIAL: Claude "http" webhook converted to curl wrapper.`,
      });
      partial++;
    }

    if (action.type === 'mcp_tool') {
      warnings.push({
        level: 'warning',
        hookName: `hook-${hookCounter}`,
        event,
        message: `PARTIAL: Claude "mcp_tool" hook converted to stub script.`,
      });
      partial++;
    }

    const antigravityMatcher = convertMatcher(matcher);
    const command = convertAction(action);

    if (!command) {
      warnings.push({
        level: 'error',
        hookName: `hook-${hookCounter}`,
        event,
        message: `SKIPPED: Could not convert action of type "${action.type}" to a command.`,
      });
      skipped++;
      continue;
    }

    const hookName = generateHookName(pluginName, event, antigravityMatcher, hookCounter);

    const antigravityHook: AntigravityHookEntry = {
      type: 'command',
      command: command,
      timeout: 30,
    };

    const antigravityEvent = event as AntigravityHookEvent;

    if (!output[hookName]) {
      output[hookName] = {};
      if (enabled === false) {
        output[hookName].enabled = false;
      }
    }

    if (!output[hookName][antigravityEvent]) {
      output[hookName][antigravityEvent] = [];
    }

    output[hookName][antigravityEvent]!.push({
      matcher: antigravityMatcher,
      hooks: [antigravityHook],
    });

    converted++;
    warnings.push({
      level: 'info',
      hookName,
      event,
      message: `Converted: ${event} [${antigravityMatcher}] → command: ${command}`,
    });
  }

  const summary = [
    `Hook conversion complete for plugin "${pluginName}":`,
    `  ✓ ${converted} hooks converted successfully`,
    skipped > 0 ? `  ✗ ${skipped} hooks skipped` : null,
    partial > 0 ? `  ⚠ ${partial} hooks partially converted` : null,
  ].filter(Boolean).join('\n');

  return { output, converted, skipped, partial, warnings, summary };
}

function normalizeClaudeHooks(claudeHooks: ClaudeHooksFile): ClaudeHookDefinition[] {
  const hooks = claudeHooks.hooks;
  if (!hooks) return [];

  if (Array.isArray(hooks)) {
    return hooks;
  }

  const result: ClaudeHookDefinition[] = [];
  for (const [event, eventHooks] of Object.entries(hooks)) {
    if (Array.isArray(eventHooks)) {
      for (const hook of eventHooks) {
        result.push({
          ...hook,
          event: hook.event || (event as ClaudeHookEvent),
        });
      }
    }
  }
  return result;
}

function convertMatcher(matcher?: ClaudeMatcher | string): string {
  if (!matcher) return '.*';

  if (typeof matcher === 'string') {
    if (matcher === '*' || matcher === '.*') return '.*';
    const mapped = TOOL_NAME_MAP[matcher] || matcher;
    return escapeRegex(mapped);
  }

  if (matcher.wildcard) return '.*';

  if (matcher.toolName) {
    const mapped = TOOL_NAME_MAP[matcher.toolName] || matcher.toolName;
    return escapeRegex(mapped);
  }

  if (matcher.pattern) {
    return matcher.pattern;
  }

  return '.*';
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function convertAction(action: ClaudeHookAction): string | null {
  switch (action.type) {
    case 'command':
      return action.command || null;

    case 'http':
      if (!action.url) return null;
      return `curl -s -X POST -H "Content-Type: application/json" -d "$(cat)" "${action.url}"`;

    case 'mcp_tool':
      return `echo '{"warning": "MCP tool hook converted from Claude — requires manual MCP integration"}'`;

    case 'prompt':
      return `echo '${escapeShellJson(JSON.stringify({ decision: 'allow', reason: 'Prompt hook converted' }))}'`;

    case 'verifier':
      return null;

    default:
      return null;
  }
}

function escapeShellJson(str: string): string {
  return str.replace(/'/g, "'\\''");
}

function generateHookName(
  pluginName: string,
  event: string,
  matcher: string,
  counter: number
): string {
  const eventSlug = event.toLowerCase().replace(/([A-Z])/g, '-$1').replace(/^-/, '');
  const matcherSlug = matcher
    .replace(/[^a-zA-Z0-9]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase()
    .slice(0, 30);

  return `${pluginName}-${eventSlug}-${matcherSlug || 'all'}-${counter}`;
}

export function convertHooksToJson(
  claudeHooks: ClaudeHooksFile,
  pluginName: string
): { json: string; result: HookConversionResult } {
  const result = convertHooks(claudeHooks, pluginName);
  const json = JSON.stringify(result.output, null, 2);
  return { json, result };
}

export const CODEX_SUPPORTED_EVENTS: Record<string, string> = {
  'SessionStart': 'session-start',
  'UserPromptSubmit': 'user-prompt-submit',
  'Stop': 'stop',
  'PreToolUse': 'pre-tool-use',
  'PostToolUse': 'post-tool-use',
  'session-start': 'session-start',
  'user-prompt-submit': 'user-prompt-submit',
  'stop': 'stop',
  'pre-tool-use': 'pre-tool-use',
  'post-tool-use': 'post-tool-use',
};

export interface CodexHookEntry {
  event: string;
  matcher?: string;
  command: string;
  decision?: 'deny';
}

export interface CodexHooksFile {
  hooks: CodexHookEntry[];
}

export function convertHooksForCodex(
  claudeHooks: ClaudeHooksFile,
  pluginName: string
): { output: CodexHooksFile; result: HookConversionResult } {
  const hooks = normalizeClaudeHooks(claudeHooks);
  const output: CodexHooksFile = { hooks: [] };
  const warnings: ConversionWarning[] = [];
  let converted = 0;
  let skipped = 0;
  let partial = 0;
  let hookCounter = 0;

  for (const hook of hooks) {
    hookCounter++;
    const codexEvent = CODEX_SUPPORTED_EVENTS[hook.event];

    if (!codexEvent) {
      warnings.push({
        level: 'warning',
        hookName: `hook-${hookCounter}`,
        event: hook.event,
        message: `SKIPPED: Event "${hook.event}" is not supported by Codex (supports only session-start, user-prompt-submit, stop, pre-tool-use, post-tool-use).`,
      });
      skipped++;
      continue;
    }

    if (hook.action.type !== 'command') {
      warnings.push({
        level: 'warning',
        hookName: `hook-${hookCounter}`,
        event: hook.event,
        message: `SKIPPED: Codex only supports shell script ("command") handlers. Action type "${hook.action.type}" dropped.`,
      });
      skipped++;
      continue;
    }

    let isBashMatcher = true;
    if (hook.matcher) {
      const rawMatcher = typeof hook.matcher === 'string' ? hook.matcher : hook.matcher.toolName || '';
      if (rawMatcher && rawMatcher !== '*' && rawMatcher !== '.*') {
        const mapped = TOOL_NAME_MAP[rawMatcher] || rawMatcher;
        if (mapped !== 'run_command' && mapped !== 'bash' && mapped !== 'shell') {
          isBashMatcher = false;
        }
      }
    }

    if (!isBashMatcher) {
      warnings.push({
        level: 'warning',
        hookName: `hook-${hookCounter}`,
        event: hook.event,
        message: `SKIPPED: Codex hooks only support Bash tool execution. Non-bash tool matcher dropped.`,
      });
      skipped++;
      continue;
    }

    output.hooks.push({
      event: codexEvent,
      matcher: 'bash',
      command: hook.action.command || '',
      decision: 'deny',
    });

    converted++;
    warnings.push({
      level: 'info',
      hookName: `codex-hook-${hookCounter}`,
      event: codexEvent,
      message: `Converted: ${hook.event} → ${codexEvent} (bash, deny-only)`,
    });
  }

  const summary = `Codex Hook conversion for "${pluginName}": ${converted} converted, ${skipped} skipped.`;
  return { output, result: { output: {}, converted, skipped, partial, warnings, summary } };
}

