# 25. Pi Coding Agent Adapter TypeScript Extension Synthesis

- Status: Accepted
- Date: 2026-08-10

## Context and Problem Statement

The Pi Coding Agent environment uses programmatic TypeScript extensions (`ExtensionAPI`) with `pi.on(...)` event listeners and `pi.registerSkill(...)` calls, rather than reading static declarative JSON configuration files for hooks and skills. A dedicated `PiAdapter` (`src/adapters/pi.ts`) is required to bridge portable v1 plugins to the Pi ecosystem.

## Decision Drivers

- **Native Integration**: Pi extensions execute natively within the Pi runtime process; materialized plugins must match this native paradigm.
- **Full Lifecycle Support**: Hooks for security assertion, pre-tool evaluation, and session events must execute natively without child-process overhead.
- **Trust Configuration**: Pi requires extensions to be listed in `~/.pi/agent/trust.json` for security authorization.

## Considered Options

1. **Synthesize Programmatic TypeScript Extension Wrapper (`extension.ts`) [Chosen]**:
   - `PiAdapter.convert(portableCore)` synthesizes a self-contained TypeScript extension file (`index.ts`) under `.pi/extensions/<plugin-name>/` that registers skills (prefixed with `/skill:`) and attaches `pi.on()` event listeners for hooks.
   - `PiAdapter` automatically registers the generated extension path in `~/.pi/agent/trust.json`.
2. **Shell Script Bridge**:
   - Emit raw shell scripts in `.pi/hooks/` and require a separate static extension to execute them via child processes.
   - *Trade-off*: Slower execution, extra process overhead, and complex runtime bridge requirements.
3. **Drop Hooks for Pi**:
   - Only materialize skills and MCP servers; ignore hooks with a warning.
   - *Trade-off*: Lossy conversion for security and workflow plugins.

## Decision Outcome

Chosen option: **"Synthesize Programmatic TypeScript Extension Wrapper"**, providing native high-performance hook and skill integration for the Pi Coding Agent ecosystem while automating trust registration.
