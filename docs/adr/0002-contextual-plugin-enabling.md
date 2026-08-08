# 2. Contextual Plugin Enabling

- Status: Accepted
- Date: 2026-08-08

## Context and Problem Statement
When a user runs `agentpm enable <plugin>`, the tool must determine which host agent (e.g., Claude Code, Antigravity) should have the plugin materialized/enabled. Since multiple agents might exist on a single machine, we need a predictable mechanism to resolve the target agent.

## Decision Drivers
- User Experience: Enabling plugins per-project should be seamless and require minimal typing.
- Predictability: The user shouldn't accidentally enable a plugin globally when they meant it for one project.
- Flexibility: The CLI should still allow targeting all agents globally or a specific agent explicitly.

## Considered Options
1. Target by Workspace Context (Chosen)
2. Require Explicit Target
3. Interactive Selection

## Decision Outcome
Chosen option: "Target by Workspace Context", because it optimizes for the most common developer workflow (per-project configuration). 
- If run without `--global`, `agentpm` detects the current directory's workspace context (e.g., looking for `.agents` for Antigravity or `.claudecode` for Claude Code) and enables the plugin ONLY for that agent in that specific project.
- If run with `--global`, it targets all installed agents on the system by default.
- Users can override this behavior by explicitly providing `--target=<agent>`.
