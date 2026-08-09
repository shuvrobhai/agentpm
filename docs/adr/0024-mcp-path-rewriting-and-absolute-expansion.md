# 24. MCP Path Rewriting and Absolute Path Expansion Strategy

- Status: Accepted
- Date: 2026-08-10

## Context and Problem Statement

MCP server definitions in source plugins often contain environment placeholders like `${CLAUDE_PLUGIN_ROOT}` or relative path references (`"command": "./bin/server.js"`, `"args": ["./scripts/entry.js"]`). Different target agent runtimes handle launch directories differently (e.g. OpenAI Codex resolves relative paths from the launch CWD rather than the plugin installation directory), causing file-not-found errors at runtime.

## Decision Drivers

- **Launch CWD Independence**: MCP server invocations must function reliably regardless of which directory the user launches the AI coding agent from.
- **Cross-Agent Compatibility**: Target agents that do not natively expand `${CLAUDE_PLUGIN_ROOT}` (such as Codex, OpenCode, or Pi) must receive valid executable paths.
- **Store Portability**: The global plugin store (`~/.agentplugins/plugins/`) must maintain resolved canonical paths while native emission converts them to fully expanded absolute paths.

## Considered Options

1. **Dual-Phase Path Expansion [Chosen]**:
   - *Phase 1 (Store Canonicalization)*: When storing a plugin in `~/.agentplugins/plugins/`, expand `${CLAUDE_PLUGIN_ROOT}` to the absolute resolved store path of that plugin version.
   - *Phase 2 (Native Materialization Expansion)*: `McpRewriter` (`src/core/mcp-rewriter.ts`) rewrites all relative `command`, `args`, and `cwd` paths into fully qualified absolute paths pointing directly to target executables during adapter emission (`convert` / `materialize`).
2. **Materialization-Time Only Expansion**:
   - Keep `${CLAUDE_PLUGIN_ROOT}` verbatim in store manifests; expand only during target materialization.
   - *Trade-off*: Store inspection tools encounter unexpanded path variables.
3. **Variable Passthrough**:
   - Pass `${CLAUDE_PLUGIN_ROOT}` directly to target manifests.
   - *Trade-off*: Breaks execution on agents that do not support Claude variable expansion.

## Decision Outcome

Chosen option: **"Dual-Phase Path Expansion"**, guaranteeing launch-CWD-independent execution of MCP servers across all target agent environments.
