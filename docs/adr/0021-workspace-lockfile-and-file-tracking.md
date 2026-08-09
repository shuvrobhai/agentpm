# 21. Committed Workspace Lockfile (.agentpm.lock) and File-Level Tracking

- Status: Accepted
- Date: 2026-08-10

## Context and Problem Statement

`agentpm` previously tracked global package provenance in `~/.agentplugins/source-registry.json`, but lacked local workspace-level tracking for materialized files. This made surgical uninstalls impossible (leading to orphan files or over-aggressive deletions), prevented drift detection, and blocked reliable implementation of workspace sync commands (`agentpm sync`).

## Decision Drivers

- **Team Reproducibility**: Dev teams working on the same repository should have consistent agent plugin versions and materializations.
- **Surgical Lifecycle Operations**: `agentpm uninstall` must cleanly unmaterialize tracked files without leaving orphan skills/rules or deleting user code.
- **Drift Detection & Sync**: `agentpm sync` must detect when local materialized files have drifted from the global store or when adapter versions require re-materialization.

## Considered Options

1. **Committed Workspace Lockfile (`.agentpm.lock`) with Per-File Tracking [Chosen]**:
   - Maintain an atomic `.agentpm.lock` JSON file in the project root tracking installed plugins, version, git acquisition hash, target agent sync status, and exact list of `MaterializedFile[]` entries with content hashes.
   - Commit `.agentpm.lock` to Git to ensure team-wide reproducibility.
2. **Local-only Uncommitted Lockfile**:
   - Store lockfile locally under `.agents/.agentpm.lock` (gitignored).
   - *Trade-off*: Avoids git diff churn, but sacrifices team reproducibility and CI/CD validation.
3. **Stateless Dynamic Symlink Scanning**:
   - Dynamically scan target provider directories for symlinks without a state file.
   - *Trade-off*: Fails for copied files (`--copy`), inline text markers in shared context files (`CLAUDE.md`), and drift detection.

## Decision Outcome

Chosen option: **"Committed Workspace Lockfile (`.agentpm.lock`) with Per-File Tracking"**, guaranteeing team-wide reproducibility, surgical uninstallation, and precise drift detection for workspace sync operations.
