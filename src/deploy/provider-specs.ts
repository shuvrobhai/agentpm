export interface ProviderSpec {
  id: string;
  displayName: string;
  description: string;
  targetPath: string;
  supportedComponents: Record<string, boolean>;
  manifestRequirements: string;
  configFiles: string[];
  officialDocUrl: string;
  notes: string[];
}

export const PROVIDER_SPECS: ProviderSpec[] = [
  {
    id: 'antigravity',
    displayName: 'Google Antigravity IDE',
    description: 'Google\u2019s agent IDE with native plugin, skills, and MCP support.',
    targetPath: '~/.gemini/config/plugins/<name>',
    supportedComponents: { skill: true, rule: true, hook: true, mcp_server: true, tool: true },
    manifestRequirements: 'Requires plugin.json or .claude-plugin/plugin.json; skills auto-discovered.',
    configFiles: ['~/.gemini/config/plugins/<name>', '~/.gemini/config/skills/<name>'],
    officialDocUrl: 'https://antigravity.google/docs/plugins',
    notes: [
      'Hooks registered in ~/.gemini/config/hooks.json',
      'Skills auto-discovered from ~/.gemini/config/skills/',
    ],
  },
  {
    id: 'opencode',
    displayName: 'OpenCode CLI / Assistant',
    description: 'Open-source CLI agent supporting modular plugins, skills, custom TS hooks, and rules.',
    targetPath: '~/.config/opencode/plugins/<name>',
    supportedComponents: { skill: true, rule: true, hook: true, mcp_server: true, tool: true, module: true },
    manifestRequirements: 'Requires plugin.json or directory component auto-discovery.',
    configFiles: ['~/.config/opencode/opencode.json', '~/.config/opencode/opencode.jsonc'],
    officialDocUrl: 'https://opencode.ai/docs/plugins/',
    notes: [
      'Stores hooks/modules in ~/.config/opencode/plugins/',
      'Skills auto-discovered from ~/.config/opencode/skills/',
      'MCP servers registered in opencode.json',
    ],
  },
  {
    id: 'claude',
    displayName: 'Claude / Claude Code Assistant',
    description: 'Anthropic\u2019s agent with the plugin format this converter reads from.',
    targetPath: '~/.config/claude/plugins/<name> (or claude_desktop_config.json)',
    supportedComponents: { skill: true, rule: true, hook: true, mcp_server: true, tool: false },
    manifestRequirements: 'Requires .claude-plugin/plugin.json manifest.',
    configFiles: ['~/.claude/plugins/', '~/.claude.json'],
    officialDocUrl: 'https://docs.anthropic.com/en/docs/agents-and-tools/claude-code/plugins',
    notes: [
      'MCP servers merged into ~/.claude.json',
      'Skills live in ~/.claude/skills/',
    ],
  },
  {
    id: 'codex',
    displayName: 'OpenAI Codex Extensions',
    description: 'OpenAI CLI extensions with marketplace + plugin JSON manifests.',
    targetPath: '~/.codex/extensions/<name>',
    supportedComponents: { skill: true, rule: true, mcp_server: true, tool: false, hook: false },
    manifestRequirements: 'Requires plugin.json + marketplace.json for registry installs.',
    configFiles: ['~/.codex/config.toml', '~/.codex/extensions/<name>/plugin.json'],
    officialDocUrl: 'https://developers.openai.com/plugins/build/plugins',
    notes: [
      'Extension dir copied wholesale into ~/.codex/extensions/',
      'MCP servers merged into config.toml',
    ],
  },
];

export function getProviderSpec(id: string): ProviderSpec | undefined {
  return PROVIDER_SPECS.find(s => s.id === id);
}
