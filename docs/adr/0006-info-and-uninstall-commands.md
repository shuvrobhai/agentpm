# 6. Command Lifecycle Completion: `info` and `uninstall`

- Status: Accepted
- Date: 2026-08-08

## Context and Problem Statement
With `install`, `enable`, `disable`, and `list` specified, users need commands to inspect extension metadata/capabilities before enabling them, and a safe way to remove packages completely from disk.

## Decision Drivers
- Safety: Deleting a package from the global store while workspace symlinks exist causes broken symlinks in agent skill folders.
- Transparency: Users need to view declarative capabilities (`SKILL.md`, MCP servers) contained inside a plugin package.
- Completeness: Provide a complete local package lifecycle before introducing network search or upgrade mechanics.

## Considered Options
1. `info` and `uninstall` with pre-uninstall dematerialization check (Chosen)
2. `update` and `uninstall`
3. `search` and `info`

## Decision Outcome
Chosen option: "`info` and `uninstall`", because it fulfills the core CRUD capability lifecycle for local management.
- `agentpm info <plugin>` inspects the global store package, parsing manifest metadata (`plugin.json`, `SKILL.md` headers, MCP definitions) and reporting materialization status across agent targets.
- `agentpm uninstall <plugin>` (alias `remove`) removes the specified package directory from `~/.agentplugins/plugins/`. Before directory removal, it automatically dematerializes all symlinks pointing to that plugin across active agent contexts to prevent dangling symlinks.
