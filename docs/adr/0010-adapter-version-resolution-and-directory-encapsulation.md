# 10. Adapter Version Resolution and Directory Encapsulation

- Status: Accepted
- Date: 2026-08-08

## Context and Problem Statement
Previously, `AgentAdapter.enable()` required callers (such as CLI commands) to explicitly pass a `version` string. Furthermore, CLI commands like `agentpm convert` directly constructed target output paths using `GlobalStore.getAdaptedPluginPath(adapterName, 'manual-convert', pluginName, 'latest')`. This broke adapter encapsulation by leaking store layout logic into CLI commands and forcing callers to manage version lookups manually.

## Decision Drivers
- Adapters should encapsulate target-specific storage layout rules.
- CLI commands (`enable`, `convert`) should not need to pass hardcoded namespace tags or version parameters.
- Support robust automatic resolution of plugin versions from global/adapted stores.

## Considered Options
1. Require callers to pass `version` and centralize version resolution in `GlobalStore`.
2. Add `resolveVersion(name)` and `getPluginDir(name, version?)` to `AgentAdapter`, removing mandatory `version` parameters from `enable()` (Chosen).

## Decision Outcome
Chosen option: "Add `resolveVersion(name)` and `getPluginDir(name, version?)` to `AgentAdapter`", because it allows each adapter to manage its target filesystem layout cleanly while keeping CLI command handlers decoupled from store implementation details.
