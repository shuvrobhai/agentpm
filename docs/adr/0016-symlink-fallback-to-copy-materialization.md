# 16. Automatic Symlink Fallback to Copy Materialization Mode

- Status: Accepted
- Date: 2026-08-10

## Context and Problem Statement

`agentpm` materializes plugins into agent provider target directories (`.agents/plugins/`, `~/.claude/plugins/`, `~/.gemini/config/plugins/`) using directory symlinks by default.

On Windows operating systems (or restricted environment filesystems), creating directory symlinks without elevated Administrator privileges or Windows Developer Mode enabled fails with `EPERM` or `EACCES` filesystem errors.

## Decision Drivers

- **Cross-Platform Reliability**: The CLI must execute seamlessly on Windows, macOS, and Linux without requiring privilege elevation.
- **Graceful Degradation**: If symlink creation fails due to platform or permission constraints, plugin installation/enabling must not fail completely.
- **Transparency**: Users should be notified when fallback occurs and state metadata must reflect the materialization mode.

## Considered Options

1. **Strict Failure**: Fail immediately on symlink `EPERM`/`EACCES` with an error message instructing the user to re-run with `--copy` or enable Administrator mode.
   - *Trade-off*: Disruptive UX for standard Windows users.
2. **Automatic Fallback to Copy Materialization [Chosen]**: Catch symlink permission errors (`EPERM`, `EACCES`, or `win32` non-admin limitations), automatically execute copy materialization (`copyDirectoryDereferenced`), log a non-fatal warning notice, and record `isCopy: true` in the materialization context.

## Decision Outcome

Chosen option: **"Automatic Fallback to Copy Materialization"**, because it ensures uninterrupted workflow execution across all platforms while preserving explicit metadata for tracking copied materializations versus symlinks.
