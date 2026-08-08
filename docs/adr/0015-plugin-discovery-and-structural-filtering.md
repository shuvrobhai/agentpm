# 15. Two-Tier Structural Plugin Validation and Discovery Filtering

- Status: Accepted
- Date: 2026-08-09

## Context and Problem Statement

When running `plugins list`, `plugins doctor`, or `plugins providers`, `BaseAgentAdapter.findActive()` and `inspectProviders()` performed raw `fs.readdir()` calls on provider directories (`~/.claude/plugins/`, `~/.codex/plugins/`, `~/.config/opencode/`, `.agents/plugins/`, `.agents/skills/`).

This caused three major failure modes:
1. Provider internal metadata files (`blocklist.json`, `installed_plugins.json`, `known_marketplaces.json`), catalog caches (`plugin-catalog-cache.json`), cache directories (`cache/`, `data/`), and single command files (`mobile.md`) were misclassified as active materialized plugins.
2. In `AntigravityAdapter`, candidate search paths included `.agents/skills` directly, causing individual standalone skills (`migrate-agent-plugin`, `node`, `nodejs-best-practices`, `typescript-pro`) to be reported as active plugins.
3. Subdirectory execution caused local workspace plugin detection to fail when executed outside the project root.

## Decision Drivers

- **Zero False Positives**: Internal agent metadata, cache folders, and unadapted command files must never appear as active plugins.
- **Fast Execution**: Inspection during `plugins list` and `plugins doctor` must remain sub-millisecond per candidate directory.
- **Robustness Across Providers**: Multi-agent support across Claude Code, Codex, Antigravity, and OpenCode AI requires resilient structural validation.

## Considered Options

1. **Name-Only File Exclusion**: Exclude dotfiles and known filenames (`cache`, `data`, `blocklist.json`).
   - *Trade-off*: Fast, but fragile when providers introduce new metadata file or directory names.
2. **Full IR Schema Parsing (`parsePlugin`)**: Attempt to parse every candidate directory into `PluginIR`.
   - *Trade-off*: 100% precision, but introduces high disk I/O latency during listing commands.
3. **Two-Tier Validation (`isValidPluginEntry`) & Provider Search Path Isolation [Chosen]**: 
   - Reject non-directory files and known infrastructure directories (`cache`, `data`, `marketplaces`, `commands`, `node_modules`, `logs`, `state`, `backups`) in Tier 1.
   - Perform shallow marker probes (`plugin.json`, `mcp.json`, `opencode.json`, `hooks.json`, `.claude-plugin`, `.codex-plugin`, `skills`, `agents`, `commands`, `rules`) in Tier 2. Standalone top-level `SKILL.md` is excluded to prevent single skills from being misidentified as full plugin containers.

## Decision Outcome

Chosen option: **"Two-Tier Validation (`isValidPluginEntry`) & Provider Search Path Isolation"**, because it enforces complete boundary isolation between plugins and skills across **all agent providers** (Antigravity, Claude Code, OpenAI Codex, OpenCode AI):

1. **Provider Search Path Isolation**: Candidate search paths (`candidateSearchDirs`) across all adapters strictly target `plugins/` directories (`~/.gemini/config/plugins`, `~/.claude/plugins`, `~/.codex/plugins`, `~/.config/opencode/plugins`, `.agents/plugins`, `.claude/plugins`, `.codex/plugins`, `.opencode/plugins`). Standalone `skills/` and `commands/` paths are excluded.
2. **Refined Structural Marker Probe**: `PLUGIN_MARKERS` checks for container manifests (`plugin.json`, `mcp.json`, `opencode.json`, `hooks.json`, `.claude-plugin`, `.codex-plugin`) or plugin component directories (`skills/`, `agents/`, `commands/`, `rules/`). Standalone `SKILL.md` is omitted.
