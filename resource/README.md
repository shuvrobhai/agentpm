# Agent Ecosystem Knowledge Base (`resource/`)

This directory serves as the definitive reference for AI coding agents, their directory topologies, manifest validation schemas, lifecycle hooks, and plugin ingestion protocols.

---

## Agent Specifications Index

| Agent Provider | Config / Plugin Format | Primary Manifest | Workspace Target | Global Storage | Hook System |
|---|---|---|---|---|---|
| **[Google Antigravity](file:///Users/rayhanislamshuvro/Developer/skills-and-plugins/agentpm/resource/antigravity.md)** | Portable v1 / AGY | `plugin.json` | `.agents/` | `~/.gemini/config/plugins/` | Named hooks (`PreToolUse`, `PreInvocation`, regex matchers) |
| **[OpenAI Codex](file:///Users/rayhanislamshuvro/Developer/skills-and-plugins/agentpm/resource/codex.md)** | Codex Extension | `.codex-plugin/plugin.json` | `.agents/plugins/` / `.codex/plugins/` | `~/.codex/plugins/` | External CLI triggers & `marketplace.json` index |
| **[Claude Code](file:///Users/rayhanislamshuvro/Developer/skills-and-plugins/agentpm/resource/claude-code.md)** | Claude Code Plugin | `.claude-plugin/plugin.json` | `.agents/plugins/` / `.claude/plugins/` | `~/.claude/plugins/` | 31 PascalCase lifecycle hook events |
| **[OpenCode AI](file:///Users/rayhanislamshuvro/Developer/skills-and-plugins/agentpm/resource/opencode.md)** | OpenCode Plugin | `opencode.json` | `.agents/plugins/` / `.opencode/plugins/` | `~/.config/opencode/plugins/` | In-process `@opencode-ai/plugin` lifecycle hooks |

---

## Global Store Topology (`~/.agentplugins/`)

- `repos/<namespace>/<plugin>/`: Pristine shallow git clones (depth 1, unmodified upstream).
- `plugins/<vendor>/<namespace>/<plugin>/<version>/`: Clean extracted shareable bundles containing only `plugin.json` (with `original_vendor`), `skills/`, `mcp.json`, `rules/`, `hooks.json`, `client-adapters/`, and auto-generated `README.md`.
- `source-registry.json`: Provenance registry tracking upstream URL, commit SHA, content hash, and source vendor.

---

## Architectural Guides & Troubleshooting

- **[Global Plugin Failure Modes & Battle-Tested Solutions](file:///Users/rayhanislamshuvro/Developer/skills-and-plugins/agentpm/docs/Global-Plugin-Failure-Modes-and-Solutions.md)**: Deep dive into MCP relative `cwd` path resolution, executable permissions, environment variables, hook translation shims, and namespace collision prevention.

