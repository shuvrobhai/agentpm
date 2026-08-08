# 5. Dual-Scope Plugin Listing & Inspection Formatting (`agentpm list`, `agentpm info`)

- Status: Accepted
- Date: 2026-08-08

## Context and Problem Statement
Users need visibility into which plugins are active in their current project workspace versus which plugins exist in the central global store (`~/.agentplugins/plugins/`). Furthermore, `agentpm list` and `agentpm info` must present information in a clear, formatted human-readable way while remaining scriptable for agents and automation tools.

## Decision Drivers
- Consistency: Align CLI scope flags (`--global` / `-g`) with `agentpm enable` and `agentpm disable`.
- Project Isolation: Developers primarily care about what capabilities are currently materialized into their active workspace context.
- Programmatic & Human Compatibility: Terminal output should offer visual clarity (tree structures, status badges), but allow raw JSON export (`--json`) for machine/agent parsing.

## Considered Options
1. Dual-Scope with Rich Terminal Text & `--json` Flag (Chosen)
2. Global Store Default with Tabular Plaintext Only
3. Combined Single-Matrix View

## Decision Outcome
Chosen option: "Dual-Scope with Rich Terminal Text & `--json` Flag", because it provides clear developer experience while retaining scriptability.
- `agentpm list` inspects current workspace agent directories (`.agents/skills/`, `.claudecode/skills/`) and lists active symlinked plugins.
- `agentpm list --global` (or `-g`) scans `~/.agentplugins/plugins/` and lists all downloaded namespaces, packages, and installed versions.
- Both `list` and `info` accept `--json` to output machine-parseable JSON objects.
