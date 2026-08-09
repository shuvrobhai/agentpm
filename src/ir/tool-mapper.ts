export type TargetAgent = 'antigravity' | 'opencode' | 'claude-code' | 'codex' | 'pi';

export interface ToolMapResult {
  mappedName: string;
  isKnown: boolean;
}

export interface ToolListMapResult {
  mappedTools: string[];
  warnings: string[];
}

/**
 * 20-tool canonical dictionary mapping tool aliases across agent environments.
 */
const CANONICAL_TOOL_MAP: Record<string, Record<TargetAgent, string>> = {
  // Shell
  bash: { antigravity: 'run_command', opencode: 'bash', 'claude-code': 'Bash', codex: 'bash', pi: 'bash' },
  shell: { antigravity: 'run_command', opencode: 'bash', 'claude-code': 'Bash', codex: 'bash', pi: 'bash' },
  terminal: { antigravity: 'run_command', opencode: 'bash', 'claude-code': 'Bash', codex: 'bash', pi: 'bash' },
  run_command: { antigravity: 'run_command', opencode: 'bash', 'claude-code': 'Bash', codex: 'bash', pi: 'bash' },

  // Read
  read_file: { antigravity: 'view_file', opencode: 'read', 'claude-code': 'View', codex: 'read', pi: 'read' },
  cat: { antigravity: 'view_file', opencode: 'read', 'claude-code': 'View', codex: 'read', pi: 'read' },
  read: { antigravity: 'view_file', opencode: 'read', 'claude-code': 'View', codex: 'read', pi: 'read' },
  view_file: { antigravity: 'view_file', opencode: 'read', 'claude-code': 'View', codex: 'read', pi: 'read' },

  // Write
  write_file: { antigravity: 'write_to_file', opencode: 'edit', 'claude-code': 'Write', codex: 'write', pi: 'write' },
  create_file: { antigravity: 'write_to_file', opencode: 'edit', 'claude-code': 'Write', codex: 'write', pi: 'write' },
  write_to_file: { antigravity: 'write_to_file', opencode: 'edit', 'claude-code': 'Write', codex: 'write', pi: 'write' },

  // Edit
  edit_file: { antigravity: 'replace_file_content', opencode: 'edit', 'claude-code': 'Edit', codex: 'edit', pi: 'edit' },
  str_replace: { antigravity: 'replace_file_content', opencode: 'edit', 'claude-code': 'Edit', codex: 'edit', pi: 'edit' },
  replace_file_content: { antigravity: 'replace_file_content', opencode: 'edit', 'claude-code': 'Edit', codex: 'edit', pi: 'edit' },

  // Multi-Edit
  multi_edit: { antigravity: 'multi_replace_file_content', opencode: 'edit', 'claude-code': 'Edit', codex: 'edit', pi: 'edit' },
  batch_edit: { antigravity: 'multi_replace_file_content', opencode: 'edit', 'claude-code': 'Edit', codex: 'edit', pi: 'edit' },
  multi_replace_file_content: { antigravity: 'multi_replace_file_content', opencode: 'edit', 'claude-code': 'Edit', codex: 'edit', pi: 'edit' },

  // List Dir
  list_files: { antigravity: 'list_dir', opencode: 'glob', 'claude-code': 'LS', codex: 'list_dir', pi: 'list_dir' },
  ls: { antigravity: 'list_dir', opencode: 'glob', 'claude-code': 'LS', codex: 'list_dir', pi: 'list_dir' },
  dir: { antigravity: 'list_dir', opencode: 'glob', 'claude-code': 'LS', codex: 'list_dir', pi: 'list_dir' },
  list_dir: { antigravity: 'list_dir', opencode: 'glob', 'claude-code': 'LS', codex: 'list_dir', pi: 'list_dir' },

  // Find File
  find_files: { antigravity: 'find_by_name', opencode: 'glob', 'claude-code': 'Glob', codex: 'find', pi: 'find' },
  glob: { antigravity: 'find_by_name', opencode: 'glob', 'claude-code': 'Glob', codex: 'find', pi: 'find' },
  find_by_name: { antigravity: 'find_by_name', opencode: 'glob', 'claude-code': 'Glob', codex: 'find', pi: 'find' },

  // Grep
  grep: { antigravity: 'grep_search', opencode: 'grep', 'claude-code': 'Grep', codex: 'grep', pi: 'grep' },
  search: { antigravity: 'grep_search', opencode: 'grep', 'claude-code': 'Grep', codex: 'grep', pi: 'grep' },
  rg: { antigravity: 'grep_search', opencode: 'grep', 'claude-code': 'Grep', codex: 'grep', pi: 'grep' },
  grep_search: { antigravity: 'grep_search', opencode: 'grep', 'claude-code': 'Grep', codex: 'grep', pi: 'grep' },

  // Fetch URL
  fetch: { antigravity: 'read_url_content', opencode: 'webfetch', 'claude-code': 'WebFetch', codex: 'fetch', pi: 'fetch' },
  curl: { antigravity: 'read_url_content', opencode: 'webfetch', 'claude-code': 'WebFetch', codex: 'fetch', pi: 'fetch' },
  read_url: { antigravity: 'read_url_content', opencode: 'webfetch', 'claude-code': 'WebFetch', codex: 'fetch', pi: 'fetch' },
  read_url_content: { antigravity: 'read_url_content', opencode: 'webfetch', 'claude-code': 'WebFetch', codex: 'fetch', pi: 'fetch' },

  // Subagents
  subagent: { antigravity: 'invoke_subagent', opencode: 'task', 'claude-code': 'Agent', codex: 'subagent', pi: 'subagent' },
  spawn: { antigravity: 'invoke_subagent', opencode: 'task', 'claude-code': 'Agent', codex: 'subagent', pi: 'subagent' },
  invoke_subagent: { antigravity: 'invoke_subagent', opencode: 'task', 'claude-code': 'Agent', codex: 'subagent', pi: 'subagent' },
};

/**
 * Maps a single tool name to target agent native tool name according to ADR 0022.
 * Custom / unknown tool names are passed through unchanged.
 */
export function mapToolName(toolName: string, targetAgent: TargetAgent): ToolMapResult {
  const normalized = toolName.trim().toLowerCase();
  const match = CANONICAL_TOOL_MAP[normalized];
  if (match) {
    return { mappedName: match[targetAgent], isKnown: true };
  }
  // ADR 0022: Pass-through unknown / custom tool names
  return { mappedName: toolName, isKnown: false };
}

/**
 * Maps an array of tool names, deduplicating and returning structured warnings for unknown tools.
 */
export function mapToolNames(tools: string[], targetAgent: TargetAgent): ToolListMapResult {
  const mappedTools: string[] = [];
  const warnings: string[] = [];
  const seen = new Set<string>();

  for (const tool of tools) {
    const { mappedName, isKnown } = mapToolName(tool, targetAgent);
    if (!isKnown) {
      warnings.push(`Custom or unrecognized tool '${tool}' passed through unchanged to target '${targetAgent}'`);
    }
    if (!seen.has(mappedName)) {
      seen.add(mappedName);
      mappedTools.push(mappedName);
    }
  }

  return { mappedTools, warnings };
}

/**
 * Maps tool matcher expressions in hooks (e.g., "bash" → "run_command" regex for Antigravity).
 */
export function mapHookMatcher(matcher: string | undefined, targetAgent: TargetAgent): { mappedMatcher?: string; warnings: string[] } {
  if (!matcher) {
    return { warnings: [] };
  }

  const { mappedName, isKnown } = mapToolName(matcher, targetAgent);
  const warnings: string[] = [];

  if (!isKnown) {
    warnings.push(`Hook matcher tool '${matcher}' passed through as '${mappedName}' for target '${targetAgent}'`);
  }

  return { mappedMatcher: mappedName, warnings };
}
