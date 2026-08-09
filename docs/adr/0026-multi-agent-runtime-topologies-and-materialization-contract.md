# ADR 0026: Multi-Agent Runtime Topologies and Materialization Contract

## Status
Accepted

## Context
AI coding agents (Antigravity, Claude Code, OpenCode AI, OpenAI Codex, and Pi Coding Agent) possess distinct, incompatible runtime architectures, plugin discovery paths, manifest schemas, MCP configuration formats, and lifecycle hook systems. 

Previously, certain materialization pathways defaulted to `.agents/plugins` or assumed an Antigravity-centric directory hierarchy for all targets. To provide true zero-friction cross-agent compatibility, `agentpm` requires a definitive, codified architectural contract reflecting the real-world filesystem layouts and manifest standards across all 5 major coding agents.

---

## The 5 Real-World Agent Architectures Comparison

| Dimension | Google Antigravity (`antigravity`) | Anthropic Claude Code (`claude-code`) | OpenCode AI (`opencode`) | OpenAI Codex (`codex`) | Pi Coding Agent (`pi`) |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Global Plugin Dir** | `~/.gemini/config/plugins/<name>/` | `~/.claude/plugins/` | `~/.config/opencode/plugins/<name>/` | `~/.codex/plugins/cache/personal/<name>/` | `~/.pi/agent/extensions/<name>/` |
| **Workspace Plugin Dir** | `.agents/plugins/<name>/` | `.claude/plugins/<name>/` | `.opencode/plugins/<name>/` | `.agents/plugins/<name>/` | `.pi/extensions/<name>/` |
| **Root Manifest** | `plugin.json` (`$schema: "https://antigravity.google/schemas/v1/plugin.json"`) | `.claude-plugin/plugin.json` | `opencode.json` (`$schema: "https://opencode.ai/config.json"`) | `.codex-plugin/plugin.json` | `trust.json` (`{ "trusted": true }`) |
| **Skills Hierarchy** | `skills/<name>/SKILL.md` | `skills/<name>/SKILL.md` | `.opencode/skills/<name>/SKILL.md` or `skills/<name>/SKILL.md` | `skills/<name>/SKILL.md` | `skills/<name>/SKILL.md` |
| **Slash Commands** | `workflows/<name>.md` (if < 12k chars, else upgraded to skill) | `commands/<name>.md` | `.opencode/commands/<name>.md` | Upgraded to `skills/<name>/SKILL.md` | Upgraded to `skills/<name>/SKILL.md` |
| **Subagents** | `agents/<name>.md` (YAML: `tools`, `model`, `subagent: true`, `commandExecutionPolicy`) | `agents/<name>.md` (YAML frontmatter + system prompt) | `.opencode/agents/<name>.md` (YAML: `permission: { read: allow, ... }`) | Not supported as standalone bundle; wrapped as skills | Not supported as standalone bundle; wrapped as skills |
| **Rules / Context** | `rules/<name>.md` (`trigger: always_on`) + `AGENTS.md` | `rules/<name>.md` + `CLAUDE.md` | `.opencode/rules/<name>.md` + `AGENTS.md` | `AGENTS.md` | Inline system prompt / skill references |
| **MCP Config** | `mcp_config.json` (`{ mcpServers: { ... } }`) | `.mcp.json` (`{ mcpServers: { ... } }`) | `opencode.json` (`{ mcp: { ... } }`) | `.mcp.json` (explicit `cwd` required) | `mcp.json` (standalone) |
| **Hooks / Life Cycle** | `hooks.json` (5 events: `PreToolUse`, `PostToolUse`, `PreInvocation`, `PostInvocation`, `Stop`) | `hooks/hooks.json` (31 Claude lifecycle events) | OpenCode plugin extensions | Reviewed & trusted via Codex UI / CLI | `index.ts` extension wrapper (`pi.on('tool_call', ...)`) |
| **Extension Entrypoint** | Manifest-declared component folders | Manifest-declared component folders | `opencode.json` manifest declarations | `marketplace.json` + `config.toml` registration | `index.ts` (`export default function(pi) { pi.registerSkill(...); }`) |

---

## Detailed Directory Specifications

### 1. Google Antigravity Layout
```text
<plugin-root>/
├── plugin.json                 # Manifest with schema, name, and description
├── skills/                     # Skills directory
│   ├── <skill-1>/
│   │   ├── SKILL.md            # YAML frontmatter + instructions
│   │   └── scripts/            # Supporting scripts / templates
│   └── <skill-2>/
│       └── SKILL.md
├── agents/                     # Subagent definitions
│   └── <agent-name>.md         # Tools list, model, subagent: true, etc.
├── rules/                      # Behavioral rules
│   └── <rule-name>.md          # activation: always / triggers
├── workflows/                  # Slash command recipes (< 12k chars)
│   └── <workflow-name>.md
├── mcp_config.json             # MCP server declarations
└── hooks.json                  # PreToolUse / PostToolUse lifecycle hooks
```

### 2. Anthropic Claude Code Layout
```text
<plugin-root>/
├── .claude-plugin/
│   └── plugin.json             # Manifest (name, description, version, author, hooks, mcpServers)
├── skills/
│   └── <skill-name>/SKILL.md
├── commands/
│   └── <command-name>.md       # Native slash command prompt templates
├── agents/
│   └── <agent-name>.md         # Subagents with mapped Claude tools (Bash, View, Edit, etc.)
├── rules/
│   └── <rule-name>.md
├── hooks/
│   └── hooks.json              # 31 Claude lifecycle events
├── .mcp.json                   # MCP servers mapping
└── CLAUDE.md                   # Plugin context documentation
```

### 3. OpenCode AI Layout
```text
<plugin-root>/
├── opencode.json               # Config manifest ($schema, name, description, mcp, instructions)
├── .opencode/
│   ├── skills/
│   │   └── <skill-name>/SKILL.md
│   ├── commands/
│   │   └── <command-name>.md
│   ├── agents/
│   │   └── <agent-name>.md     # Agent with permission allow/deny matrices
│   └── rules/
│       └── <rule-name>.md
└── AGENTS.md
```

### 4. OpenAI Codex Layout
```text
<plugin-root>/
├── .codex-plugin/
│   └── plugin.json             # Validated manifest (name, version, interface: { ... }, skills)
├── skills/
│   ├── <skill-name>/SKILL.md
│   └── <upgraded-command>/SKILL.md  # Slash commands upgraded to skills
├── .mcp.json                   # MCP servers with absolute cwd expansion
└── AGENTS.md
```

### 5. Pi Coding Agent Layout
```text
<plugin-root>/
├── index.ts                    # TypeScript extension wrapper (export default function(pi) { ... })
├── trust.json                  # Trust authorization manifest ({ "trusted": true })
├── skills/
│   └── <skill-name>/SKILL.md
└── mcp.json                    # MCP configuration
```

---

## Architectural Principles Enforced

1. **Seam Decoupling:** `PortableCoreIR` acts as the universal canonical intermediate representation. No adapter communicates directly with another agent's format.
2. **Dynamic Materialization Routing:** `BaseAgentAdapter.enable()` routes dynamically to `this.localPluginDir` and `this.globalPluginDir`, completely eliminating cross-agent path contamination.
3. **Asset Preservation:** `MaterializationEngine.adaptToNative()` copies non-IR assets (scripts, binaries, images) into the adapted package before overlaying native files, preventing asset erasure.
4. **Dual-Phase MCP Expansion:** All 5 adapters invoke `rewriteMcpServer()`, expanding `${CLAUDE_PLUGIN_ROOT}` and relative executable paths into launch-directory-independent absolute paths.
5. **Universal Tool Mapping:** Every adapter translates tool names and hook matchers across the 20-tool canonical dictionary, honoring the unknown-tool pass-through contract (ADR 0022).

## Consequences
- **Positive:** Full zero-friction installation and materialization across Antigravity, Claude Code, OpenCode, Codex, and Pi.
- **Positive:** Complete prevention of folder pollution or malformed path nesting across workspace roots.
- **Positive:** Deterministic drift detection and surgical removal via `.agentpm.lock`.
