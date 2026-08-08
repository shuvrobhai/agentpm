# 11. Workspace-First Local Plugin Conversion and Materialization

- Status: Accepted
- Date: 2026-08-08

## Context and Problem Statement
When developers convert local plugins (`agentpm convert ./my-plugin --target claude-code`), the CLI previously placed converted files into the global store (`~/.agentplugins/adapted/...`) for non-antigravity adapters. When running `agentpm enable my-plugin`, `enable()` only queried `GlobalStore.findPluginPath()`, failing if the plugin had not been globally installed via `agentpm install`.

## Decision Drivers
- Support an intuitive local development loop (`agentpm convert ./my-plugin` -> `agentpm enable my-plugin`) without requiring an un-staged global store installation.
- Each adapter should encapsulate its local workspace directory resolution (`getLocalPluginDir`).
- `MaterializationEngine.materialize` should support explicit `sourcePath` overrides.

## Considered Options
1. Require global `agentpm install` prior to `enable` (Global-first).
2. Workspace-first local resolution: check local adapter directory (`getLocalPluginDir`) before falling back to global store lookup in `enable()`, and support `sourcePath` in `MaterializationEngine` (Chosen).

## Decision Outcome
Chosen option: "Workspace-first local resolution", because it allows developers to convert and enable local workspace plugins in one seamless step, matching standard developer expectations (like `npm link`).
