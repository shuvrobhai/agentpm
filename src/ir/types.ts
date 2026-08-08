export type SourceType = 'local' | 'git' | 'github' | 'marketplace';

export interface SourceInfo {
  type: SourceType;
  originalInput: string;
  resolvedPath: string;
  pluginName: string;
  pluginDescription: string;
  pluginVersion?: string;
  pluginAuthor?: string;
}

export interface SkillIR {
  name: string;
  description: string;
  body: string;
  rawFrontmatter: Record<string, unknown>;
  supportingFiles: string[];
  variables: string[];
  dynamicInjections: string[];
  sourcePath: string;
  sourceDir: string;
}

export interface CommandIR {
  name: string;
  description: string;
  body: string;
  rawFrontmatter: Record<string, unknown>;
  variables: string[];
  dynamicInjections: string[];
  sourcePath: string;
}

export interface AgentIR {
  name: string;
  description: string;
  body: string;
  tools: string[];
  model?: string;
  hooks?: Record<string, unknown>;
  memory?: string;
  skills?: string[];
  background?: boolean;
  rawFrontmatter: Record<string, unknown>;
  sourcePath: string;
}

export interface RuleIR {
  name: string;
  content: string;
  paths?: string[];
  sourcePath: string;
}

export interface ContextSection {
  heading: string;
  content: string;
  level: number;
}

export interface ContextFileIR {
  filename: string;
  content: string;
  sections: ContextSection[];
  sourcePath: string;
}

export type HookEventType =
  | 'PreToolUse'
  | 'PostToolUse'
  | 'Stop'
  | 'SubagentStart'
  | 'SubagentStop'
  | 'SessionStart'
  | 'Notification'
  | string;

export type HookType = 'command' | 'http' | 'mcp_tool';

export interface HookIR {
  event: HookEventType;
  matcher?: string;
  type: HookType;
  command?: string;
  url?: string;
  mcpTool?: string;
  timeout?: number;
  raw: Record<string, unknown>;
  sourcePath: string;
}

export interface MCPServerIR {
  name: string;
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  type?: string;
  url?: string;
  headers?: Record<string, string>;
  cwd?: string;
  disabled?: boolean;
  raw: Record<string, unknown>;
  sourcePath: string;
}

export interface OutputStyleIR {
  name: string;
  content: string;
  sourcePath: string;
}

export interface WorkflowIR {
  name: string;
  content: string;
  extension: string;
  sourcePath: string;
}

export interface PluginIR {
  source: SourceInfo;
  skills: SkillIR[];
  commands: CommandIR[];
  agents: AgentIR[];
  rules: RuleIR[];
  contextFile?: ContextFileIR;
  hooks: HookIR[];
  mcpServers: MCPServerIR[];
  outputStyles: OutputStyleIR[];
  workflows: WorkflowIR[];
  metadata: Record<string, unknown>;
  warnings: string[];
}

export interface FileOutput {
  relativePath: string;
  content: string;
  merge?: boolean;
  description: string;
}

export interface ConversionResult {
  targetId: string;
  targetName: string;
  files: FileOutput[];
  warnings: string[];
  manualSteps: string[];
}

/**
 * PortableCoreIR is the single conversion seam (ADR 0013). It narrows the
 * 9-type PluginIR to what Agent Plugins v1 actually makes portable: Agent
 * Skills and MCP servers. Everything else travels in the extensions bag so
 * nothing is lost, but per-agent adapters consume the narrowed type and
 * cannot read non-portable component types by accident.
 */
export interface PortableSkillIR {
  name: string;
  description: string;
  body: string;
  rawFrontmatter: Record<string, unknown>;
  supportingFiles: string[];
  sourcePath: string;
  sourceDir: string;
}

export interface PortableMCPServerIR {
  name: string;
  type: string;
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  url?: string;
  headers?: Record<string, string>;
  cwd?: string;
  disabled?: boolean;
  sourcePath: string;
}

/**
 * The extensions bag keeps every non-portable component type available to the
 * converting adapter, in three tiers (per ADR 0013 Q13):
 * 1. Hooks stay normalized — the Claude Code hook shape is the closest thing
 *    to a cross-client standard, so a future portable hooks type can adopt it.
 * 2. Agents, commands, rules, and context files keep their typed IR.
 * 3. Output styles, workflows, LSP, UI, and marketplace data are opaque.
 */
export interface PortableExtensionsIR {
  hooks: HookIR[];
  agents: AgentIR[];
  commands: CommandIR[];
  rules: RuleIR[];
  contextFile?: ContextFileIR;
  outputStyles: OutputStyleIR[];
  workflows: WorkflowIR[];
  opaque: Record<string, unknown>;
}

export interface PortableCoreIR {
  source: SourceInfo;
  metadata: Record<string, unknown>;
  skills: PortableSkillIR[];
  mcpServers: PortableMCPServerIR[];
  extensions: PortableExtensionsIR;
  warnings: string[];
}
