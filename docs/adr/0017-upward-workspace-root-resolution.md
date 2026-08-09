# 17. Upward Workspace Root Resolution

- Status: Accepted
- Date: 2026-08-10

## Context and Problem Statement

Previously, `BaseAgentAdapter.candidateSearchDirs` and workspace path resolutions evaluated local workspace paths relative to `process.cwd()` directly (e.g., `path.join(process.cwd(), '.agents', 'plugins')`).

If a developer executed CLI commands (`plugins list`, `plugins enable`, `plugins disable`) from within a nested subdirectory of a repository (such as `repo/src/components/`), the CLI created or scanned `.agents/plugins` inside the nested subdirectory instead of the root project workspace, causing orphaned materializations and missing active plugin detections.

## Decision Drivers

- **Deterministic Context Resolution**: Executing CLI commands from any nested directory within a repository must target the exact same workspace root.
- **Agent Interoperability**: AI coding agents look for project-level `.agents/plugins/` at the repository root, not in random subdirectories.
- **Graceful Fallback**: In standalone non-repository folders, resolution should default back to `process.cwd()`.

## Considered Options

1. **Strict `process.cwd()` (Previous Behavior)**: Always resolve `.agents/plugins` in the current working directory.
   - *Trade-off*: Fragile; creates fragmented `.agents` directories across subfolders.
2. **Upward Workspace Root Discovery (`findWorkspaceRoot`) [Chosen]**: Recursively traverse parent directories starting from `process.cwd()` looking for workspace marker directories or files (`.agents/`, `.git/`, `package.json`). Lock local materialization search paths to the discovered workspace root; fall back to `process.cwd()` only if no root marker is found.

## Decision Outcome

Chosen option: **"Upward Workspace Root Discovery (`findWorkspaceRoot`)"**, ensuring consistent project-level plugin materialization regardless of the nested execution directory.
