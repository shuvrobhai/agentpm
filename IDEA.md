## The Problem
There are multiple AI coding agents (Claude Code, Codex, Antigravity, OpenCode, Pi, etc.), each with its own extension ecosystem, plugin formats, and installation paths. Installing and maintaining the same capabilities (Skills, MCP servers, etc.) across these disparate hosts is cumbersome.

Previous research showed a critical distinction:
- **Declarative capabilities** (Skills, MCP, static config) are highly portable.
- **Imperative runtime extensions** (OpenCode TS plugins, Pi extensions) are host-specific.

## The Core Concept
**`agentpm` is a Universal Agent Extension Manager.**

It is NOT a simple symlink manager, nor does it assume a "write once, run everywhere" execution model. 
Instead, it manages composite packages containing **portable declarative capabilities** alongside **host-specific implementations**, using a materialization/adapter layer to synthesize these capabilities for whichever agent is being targeted.

`agentpm` serves as the reference implementation for the vendor-neutral `agentplugins` specification.

## Architectural Decisions

### 1. The Package Model: Capabilities-First
Packages primarily contain declarative capabilities (e.g., `SKILL.md`, MCP configuration). Package authors don't need to write host-specific code unless they are creating a dedicated runtime extension. `agentpm` handles the translation of these declarative capabilities into what the target host expects.

### 2. The Adapter Model: Hybrid Materialization
Each target agent has an adapter within `agentpm`. Adapters use the most appropriate mechanism for the target host:
- **Symlinking/Config Mutation:** Used for agents that support dynamic path resolution (e.g., Claude Code, Antigravity), allowing real-time updates.
- **Full Copy Materialization:** Used for agents that require caching or strict directory structures (e.g., Codex).

**Adapter Interface Concept:**
```typescript
interface AgentAdapter {
  detect(): boolean;
  capabilities(): string[]; // e.g., ['skills', 'mcp']
  install(pluginPath: string, scope: 'global' | 'local'): Promise<void>;
  uninstall(pluginName: string, scope: 'global' | 'local'): Promise<void>;
  enable(pluginName: string, scope: 'global' | 'local'): Promise<void>;
  disable(pluginName: string, scope: 'global' | 'local'): Promise<void>;
}
```

### 3. Global vs. Workspace: Project-Local First
- `agentpm` maintains a global canonical store (e.g., `~/.agentplugins/plugins/`).
- If a workspace contains a `.agentplugins/manifest.json`, `agentpm` synthesizes or links those specific versions into the workspace's local agent configurations.
- Local workspace versions override global versions if there is a conflict.

### 4. Registry Model: GitHub-Backed (MVP)
For the MVP, there is no centralized registry server. Packages are resolved directly from GitHub repositories (e.g., `agentpm install user/repo`). A dedicated registry protocol can be defined later if the ecosystem demands it.

### 5. Security & Trust: Capability-Based Permissions
`agentpm` analyzes the capabilities of a package before installation. 
- Purely declarative components (Skills, static MCP config) are installed automatically.
- If a plugin requests runtime hooks or host-specific imperative code, `agentpm` requires explicit user confirmation before proceeding.

### 6. Enable/Disable Mechanics
Enabling or disabling a plugin does not delete the package from the global store. Instead, it mutates the target agent's config file (e.g., removing a path from `mcp_config.json` or `plugin.json`) or removes the symlink in the agent's target directory.

### 7. Runtime Plugin Representation
Host-specific runtime extensions (when supported) are stored in a dedicated folder within the package: `/runtimes/<agent-name>/`. The corresponding `agentpm` adapter knows to look there and materialize the host-specific code.

### 8. The Smallest Useful MVP
**Declarative Only.**
The initial MVP will strictly focus on installing and managing Agent Skills (`SKILL.md`) and MCP configurations across agents. Runtime plugins (like OpenCode TypeScript) will be deferred to v2 to prove the cross-agent portability and materialization concept first.

## Next Steps for the New Chat
This document provides the foundational constraints. In the next session, you should focus on:
1. Designing the exact CLI commands (`agentpm install`, `agentpm enable`, etc.).
2. Designing the internal folder structure of `~/.agentplugins/`.
3. Defining the MVP Adapter implementations for Claude Code and Antigravity.
4. Scaffolding the `agentpm` CLI tool.
