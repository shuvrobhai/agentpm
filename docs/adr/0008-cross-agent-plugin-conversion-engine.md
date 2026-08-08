# 8. Cross-Agent Plugin Conversion Engine

- Status: Accepted
- Date: 2026-08-08

## Context and Problem Statement
AI coding agents (Claude Code, Google Antigravity, OpenAI Codex CLI, OpenCode, Pi) enforce distinct plugin paradigms, configuration schemas, path variable names (`${CLAUDE_PLUGIN_ROOT}` vs `${PLUGIN_ROOT}`), working memory standards (`CLAUDE.md` vs `AGENTS.md`), and MCP path resolution requirements. Naively symlinking global store plugins across different target agents results in broken path variables, unparsed rule schemas, or relative MCP path resolution failures.

## Decision Drivers
- Cross-Agent Portability: Plugins authored for one agent platform should run seamlessly on other target agents without requiring manual prompt editing or path patching by developers.
- Materialization Integrity: Converted plugins must be staged in isolated adapter caches without mutating the canonical global store (`~/.agentplugins/plugins/`).
- Developer Utility: Users should have a dedicated CLI command (`agentpm convert`) to inspect and translate plugin packages on demand.

## Considered Options
1. Require plugin authors to publish agent-specific versions of every package.
2. Naive directory symlinking with manual user patching.
3. Automated Synthesis & Plugin Conversion Engine (`PluginConverter`) with staged adapted cache (`~/.agentplugins/adapted/`) (Chosen).

## Decision Outcome
Chosen option: "Automated Synthesis & Plugin Conversion Engine with staged adapted cache".

### Architectural Impact:
- **`PluginConverter` (`src/core/converter.ts`)**: Automatically rewrites root path variables (`${CLAUDE_PLUGIN_ROOT}` → `${PLUGIN_ROOT}`), transpiles memory & rule references (`CLAUDE.md` → `AGENTS.md`), resolves relative MCP `cwd` paths to absolute paths, and neutralizes vendor-bound terminology.
- **Staged Adapted Store (`GlobalStore.getAdaptedPluginPath`)**: Stores converted plugin assets under `~/.agentplugins/adapted/<adapter-name>/<namespace>/<plugin>/<version>/`.
- **Adapter Conversion Hooks**: Adapters (such as `AntigravityAdapter`) detect vendor-specific artifacts on `enable()`, invoke `PluginConverter`, and symlink to the staged adapted directory.
- **CLI Command**: Exposed `agentpm convert <plugin>` command with options for `--target`, `--memory`, `--var-prefix`, and `--out`.
