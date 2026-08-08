export interface ProviderSpec {
  id: string;
  displayName: string;
  description: string;
  targetPath: string;
  supportedComponents: Record<string, boolean>;
  manifestPath: string;
  manifestRequirements: string;
  configFiles: string[];
  officialDocUrl: string;
  schemaUrl?: string;
  requiredManifestFields: string[];
  notes: string[];
}

export const PROVIDER_SPECS: ProviderSpec[] = [
  {
    id: 'antigravity',
    displayName: 'Google Antigravity IDE',
    description: 'Google’s agentic development IDE supporting namespaced plugin bundles (skills, rules, MCP, hooks).',
    targetPath: '~/.gemini/config/plugins/<name> (Global) / .agents/plugins/<name> (Workspace)',
    supportedComponents: { skill: true, rule: true, hook: true, mcp_server: true, tool: true },
    manifestPath: 'plugin.json',
    manifestRequirements: 'Requires plugin.json with name and description. Discovers skills in skills/ and rules in rules/.',
    configFiles: ['~/.gemini/config/plugins/<name>', '.agents/plugins/<name>', '.agents/mcp_config.json', '.agents/hooks.json'],
    officialDocUrl: 'https://antigravity.google/docs/plugins',
    requiredManifestFields: ['name', 'description'],
    notes: [
      'Workspace plugins take precedence when placed in .agents/plugins/<name>',
      'Hooks configured via named objects in .agents/hooks.json (supports PreToolUse decision protocol)',
      'Subagent definitions configured via YAML frontmatter in .agents/agents/<name>.md',
    ],
  },
  {
    id: 'opencode',
    displayName: 'OpenCode CLI / Assistant',
    description: 'Open-source CLI coding assistant with opencode.json schema validation and TypeScript plugin SDK.',
    targetPath: '~/.config/opencode/plugins/<name> (Global) / .opencode/plugins/<name> (Workspace)',
    supportedComponents: { skill: true, rule: true, hook: true, mcp_server: true, tool: true, module: true },
    manifestPath: 'opencode.json (or opencode.jsonc)',
    manifestRequirements: 'Validates against $schema: https://opencode.ai/config.json. Plugin manifest requires name and description.',
    configFiles: ['~/.config/opencode/opencode.json', '.opencode/opencode.json'],
    officialDocUrl: 'https://opencode.ai/docs/plugins/',
    schemaUrl: 'https://opencode.ai/config.json',
    requiredManifestFields: ['name', 'description'],
    notes: [
      'Executes TypeScript in-process plugins via @opencode-ai/plugin',
      'Skills loaded automatically from ~/.config/opencode/skills/ or .opencode/skills/',
      'Supports opencode.json configuration with plugins, skills array, and mcpServers',
    ],
  },
  {
    id: 'claude',
    displayName: 'Claude / Claude Code Assistant',
    description: 'Anthropic’s agent platform using .claude-plugin/plugin.json manifests and 31 PascalCase lifecycle hook events.',
    targetPath: '~/.claude/plugins/<name> (Global) / .claude/plugins/ or .agents/plugins/ (Workspace)',
    supportedComponents: { skill: true, rule: true, hook: true, mcp_server: true, tool: false },
    manifestPath: '.claude-plugin/plugin.json',
    manifestRequirements: 'Requires .claude-plugin/plugin.json manifest with required `name` and `description` fields.',
    configFiles: ['~/.claude/plugins/<name>', '~/.claude.json'],
    officialDocUrl: 'https://docs.anthropic.com/en/docs/agents-and-tools/claude-code/plugins',
    requiredManifestFields: ['name', 'description'],
    notes: [
      'Uses ${CLAUDE_PLUGIN_ROOT} variable for path portability across scripts and hook commands',
      'Supports 31 declarative PascalCase hook events (PreToolUse, PostToolUse, SessionStart, etc.)',
      'MCP servers declared in .mcp.json and merged into runtime configuration',
    ],
  },
  {
    id: 'codex',
    displayName: 'OpenAI Codex Extensions',
    description: 'OpenAI CLI extension platform enforcing strict manifest interface validation and personal marketplace registry.',
    targetPath: '~/.codex/plugins/<name> (Global) / .agents/plugins/<name> (Workspace)',
    supportedComponents: { skill: true, rule: true, mcp_server: true, tool: false, hook: false },
    manifestPath: '.codex-plugin/plugin.json',
    manifestRequirements: 'Requires .codex-plugin/plugin.json with required top-level name, version, description AND required interface object (displayName, shortDescription, longDescription, developerName, category, capabilities, defaultPrompt). Top-level `hooks` strictly disallowed.',
    configFiles: ['~/.codex/config.toml', '~/.agents/plugins/marketplace.json'],
    officialDocUrl: 'https://developers.openai.com/plugins/build/plugins',
    requiredManifestFields: ['name', 'version', 'description', 'interface', 'interface.displayName', 'interface.shortDescription', 'interface.longDescription', 'interface.developerName', 'interface.category', 'interface.capabilities', 'interface.defaultPrompt'],
    notes: [
      'Must be registered in marketplace.json and enabled in ~/.codex/config.toml ([plugins] <name> = "enabled")',
      'Top-level `hooks` field strictly disallowed in manifest (causes validation error)',
      'Requires dereferenced copies (no symlinks) due to Codex store copier constraints',
    ],
  },
];

export function getProviderSpec(id: string): ProviderSpec | undefined {
  return PROVIDER_SPECS.find(s => s.id === id);
}
