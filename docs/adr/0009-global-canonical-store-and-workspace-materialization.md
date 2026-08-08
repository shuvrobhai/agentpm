# 9. Global Canonical Store and Workspace Materialization Paradigm

- Status: Accepted
- Date: 2026-08-08

## Context and Problem Statement
Users want to manage extensions across multiple project workspaces without littering project repositories with `agentpm` tool files or execution scripts. Furthermore, plugins downloaded from upstream repositories (e.g. GitHub) often contain vendor-specific artifacts (`.claude-plugin/`, `${CLAUDE_PLUGIN_ROOT}`, `CLAUDE.md`). A clean paradigm is needed to store plugins centrally in an Open Canonical Format, check for upstream updates, materialize into workspace `.agents/plugins/` directories, and convert foreign in-workspace plugins on demand.

## Decision Drivers
- Workspace Isolation: Workspaces should contain no `agentpm` engine code or build artifacts—only target agent configuration paths (`.agents/plugins/` or `.agents/skills/`).
- Centralized Maintenance: Plugins should be stored and updated centrally in `~/.agentplugins/plugins/` in an Open Canonical Format (`plugin.json` + `skills/` + `rules/` + `AGENTS.md` + `mcp_config.json` + `hooks.json`).
- Flexibility: Materialization in workspace `.agents/plugins/` should default to zero-copy symlinking for live global updates, while supporting `--copy` for workspace-isolated edits.
- Seamless Local Conversion: In-workspace foreign plugins (e.g. `.claudecode/` or raw vendor folders) should be convertible to Antigravity's `.agents/plugins/` schema with vendor auto-detection.

## Considered Options
1. Local Workspace CLI Installation: Install `agentpm` scripts inside every project workspace directory.
2. Direct Raw Symlinking without Global Canonical Standardization.
3. Global Tool Engine + Install-Time Open Canonical Format Conversion + Workspace Materialization (`.agents/plugins/`) (Chosen).

## Decision Outcome
Chosen option: "Global Tool Engine + Install-Time Open Canonical Format Conversion + Workspace Materialization".

### Key Architectural Standards:
1. **Global Tool Engine**: `agentpm` runs strictly as a global CLI tool (`npm install -g agentpm` or `npx agentpm`).
2. **Install-Time Conversion (`agentpm install`)**: Upstream plugins downloaded to `~/.agentplugins/plugins/` are automatically sanitized and converted into the Open Canonical Format upon download.
3. **Workspace Materialization (`agentpm enable`)**: Materializes open-format plugins into workspace `.agents/plugins/<plugin-name>` (or `.agents/skills/`). Defaults to directory symlinking for zero-copy global updates, with `--copy` flag support for isolated local edits.
4. **In-Workspace Foreign Conversion (`agentpm convert`)**: Auto-detects vendor markers (`.claude-plugin/`, `.codex-plugin/`, `gemini.json`) in any workspace directory and converts them into `.agents/plugins/` format for Antigravity.
