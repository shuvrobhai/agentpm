# 4. Adapter Materialization Strategy (MVP)

- Status: Accepted
- Date: 2026-08-08

## Context and Problem Statement
For the MVP, `agentpm` must support materializing plugins for two specific agents: Antigravity and Claude Code. We need to decide how the adapters for these agents will make declarative capabilities (like `SKILL.md` or MCP configurations) available to their respective hosts.

## Decision Drivers
- Agent Compatibility: The chosen method must be supported natively by the target agent.
- Efficiency: Minimizing disk space usage and duplication.
- Live Updates: If a plugin is updated globally in place, local projects should ideally see the update without a manual sync step, unless strictly pinned.

## Considered Options
1. Symlink Manifests (Chosen)
2. Copy Files (Deep Copy)
3. Config Mutation (Native Plugin JSONs)

## Decision Outcome
Chosen option: "Symlink Manifests", because both Antigravity and Claude Code support dynamic path resolution.
- **Antigravity Adapter**: Will create symlinks in `<workspace>/.agents/skills/<plugin-name>` pointing to the versioned directory in `~/.agentplugins/plugins/`. MCP configs will be similarly linked or mutated.
- **Claude Code Adapter**: Will follow a similar symlink pattern into the `.claudecode/` or global config directories as appropriate.
This approach prevents duplication of files, saves disk space, and ensures updates to the symlinked versions are instantly available to the agents.
