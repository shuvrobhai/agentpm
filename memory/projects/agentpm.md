# Project agentpm

**Codename/Name:** agentpm
**Status:** Active Development (v0.1.0)

## What It Is
The Universal Agent Extension Manager. A TypeScript CLI application built on Commander.js and `simple-git` that manages composite extension packages for AI coding agents (Antigravity, Claude Code, etc.).

## Architecture & Design
- **Capabilities-First**: Declarative capabilities (`SKILL.md`, MCP configs) managed centrally in `~/.agentplugins/plugins/`.
- **Plugin Conversion Engine**: `PluginConverter` (`src/core/converter.ts`) automatically translates vendor placeholders (`${CLAUDE_PLUGIN_ROOT}` → `${PLUGIN_ROOT}`), memory files (`CLAUDE.md` → `AGENTS.md`), and relative MCP working directory paths prior to materialization.
- **Staged Adapted Store**: Transformed packages are staged under `~/.agentplugins/adapted/<adapter-name>/<namespace>/<plugin>/<version>/`.
- **Symlink Materialization**: `AgentAdapter` implementations (`AntigravityAdapter`, `ClaudeCodeAdapter`) materialize plugins into host-specific directories (`.agents/skills/`, `.claudecode/skills/`) via directory symlinks.
- **Global Store Resolver**: `GlobalStore.findPluginPath(pluginName, version)` resolves packages across namespaces.

## Key Files & Directories
- `src/index.ts` — CLI entrypoint
- `src/core/converter.ts` — Plugin conversion engine
- `src/commands/` — Command handlers (`install`, `enable`, `disable`, `convert`, `info`, `list`, `uninstall`)
- `src/core/` — Core store & plugin resolution
- `src/adapters/` — Target agent adapters
- `docs/adr/` — Architectural Decision Records (ADRs 0001 - 0008)
