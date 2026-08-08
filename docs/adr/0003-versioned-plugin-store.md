# 3. Versioned Global Plugin Store

- Status: Accepted
- Date: 2026-08-08

## Context and Problem Statement
When `agentpm` installs a plugin into the global store (`~/.agentplugins/plugins/`), it needs to decide how to structure the directories to handle subsequent updates and potential multi-version requirements across different workspaces.

## Decision Drivers
- Isolation: Workspaces might depend on different versions of the same plugin. Upgrading a plugin for one project shouldn't break another project.
- Rollbacks: It should be easy to revert to a previous version of a plugin.
- Simplicity: The structure shouldn't be overly complex to navigate manually.

## Considered Options
1. Versioned Subdirectories (Chosen)
2. Latest Only (Overwrite)

## Decision Outcome
Chosen option: "Versioned Subdirectories", because it allows multiple versions to safely coexist. 
The global store will be structured as: `~/.agentplugins/plugins/<namespace>/<plugin-name>/<version>/`. When a workspace enables a plugin, the target agent's adapter will materialize the specific requested version, preventing unintended global upgrades from breaking isolated workspace configurations.
