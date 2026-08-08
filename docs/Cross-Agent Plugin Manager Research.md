Here's the complete consolidated specification — everything from the research report, the conversion document corrections, the official docs verification, and the tool design, all in one definitive document.

```markdown
# agentpm: Definitive Adapter Specification

> **Version:** 0.1.0-draft  
> **Date:** August 8, 2026  
> **Status:** Pre-implementation specification  
> **Scope:** Cross-agent plugin management for AI coding agents  

---

## Table of Contents

1. [Purpose & Scope](#1-purpose--scope)
2. [Terminology](#2-terminology)
3. [Target Agents](#3-target-agents)
4. [Plugin Canonical Format (CPF)](#4-plugin-canonical-format-cpf)
5. [Adapter Interface Contract](#5-adapter-interface-contract)
6. [Adapter: Claude Code](#6-adapter-claude-code)
7. [Adapter: Google Antigravity](#7-adapter-google-antigravity)
8. [Adapter: OpenCode](#8-adapter-opencode)
9. [Adapter: OpenAI Codex CLI](#9-adapter-openai-codex-cli)
10. [Adapter: Pi Coding Agent](#10-adapter-pi-coding-agent)
11. [Cross-Agent Conversion: Claude Code → Antigravity](#11-cross-agent-conversion-claude-code--antigravity)
12. [MCP Path Rewriting](#12-mcp-path-rewriting)
13. [Hook Event Mapping](#13-hook-event-mapping)
14. [Tool Name Mapping](#14-tool-name-mapping)
15. [Global Store & Workspace Layout](#15-global-store--workspace-layout)
16. [CLI Commands](#16-cli-commands)
17. [Lockfile Format](#17-lockfile-format)
18. [Adapter Registry & Update Model](#18-adapter-registry--update-model)
19. [Knowledge Dependencies & Change Management](#19-knowledge-dependencies--change-management)
20. [Works Cited & Verification Status](#20-works-cited--verification-status)

---

## 1. Purpose & Scope

### Problem

Five major AI coding agents — Claude Code, Google Antigravity, OpenCode, OpenAI Codex CLI, and Pi Coding Agent — each enforce distinct extensibility paradigms, file layouts, configuration schemas, lifecycle hooks, and execution runtimes. There is no unified way to install a plugin once and have it work across multiple agents in a single workspace.

### Solution

agentpm is a CLI tool that:

1. Fetches plugins from GitHub, npm, or local paths into a **global store** (`~/.agentpm/`)
2. Installs plugins into workspaces via **target-specific adapters** that write into each agent's native directory structure
3. Converts plugins between agent formats via a **canonical middle layer**
4. Updates globally-stalled plugins and detects staleness in workspaces

### What This Spec Covers

- The canonical plugin format
- The adapter interface contract
- Detailed adapter specifications for all five agents
- Verified conversion mechanics (especially Claude Code → Antigravity)
- MCP path rewriting rules
- Hook event mapping tables
- Tool name mapping tables
- CLI command specifications
- Knowledge dependency analysis

### What This Spec Does NOT Cover

- The adapter registry infrastructure (separate spec)
- The introspection/discovery engine (future phase)
- GUI or web interface

---

## 2. Terminology

| Term                               | Definition                                                                                                             |
| ---------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| **Plugin**                         | A bundle of skills, rules, MCP servers, hooks, agents, and/or workflows that extends an AI coding agent's capabilities |
| **Canonical Package Format (CPF)** | agentpm's internal plugin representation, from which all agent-specific formats are derived                            |
| **Adapter**                        | A module that translates between CPF and a specific agent's native format                                              |
| **Materialization**                | The process of writing adapter output files into an agent's workspace directory                                        |
| **Global Store**                   | `~/.agentpm/plugins/` — the canonical location for fetched plugins                                                     |
| **Workspace**                      | Any project directory where plugins are installed for local use                                                        |
| **Lockfile**                       | `.agentpm.lock` — a single file in the workspace tracking installed plugins                                            |
| **Sync**                           | Re-materializing all workspace plugins (after adapter updates or manual edits)                                         |

---

## 3. Target Agents

| Agent                  | Maintainer    | Extension Paradigm                      | Status                                   |
| ---------------------- | ------------- | --------------------------------------- | ---------------------------------------- |
| **Claude Code**        | Anthropic     | Declarative plugin bundles              | Active                                   |
| **Google Antigravity** | Google        | Namespaced bundles + sparse configs     | Active (superseded Gemini CLI June 2026) |
| **OpenCode**           | Anomaly       | In-process JS/TS modules + Agent Skills | Active                                   |
| **OpenAI Codex CLI**   | OpenAI        | Agent plugins + marketplaces            | Active                                   |
| **Pi Coding Agent**    | Mario Zechner | Pi Packages (TS extensions + skills)    | Active                                   |

---

## 4. Plugin Canonical Format (CPF)

A canonical plugin is a directory with the following structure:

```
<plugin-name>/
├── plugin.json              # Optional manifest
├── SKILL.md                 # Core skill instructions (required for skills)
├── skills/                  # Additional named skills
│   └── <name>/
│       └── SKILL.md
├── rules/                   # Behavioral rules (Markdown)
│   └── <name>.md
├── agents/                  # Subagent definitions (Markdown with YAML frontmatter)
│   └── <name>.md
├── workflows/               # Multi-step workflow definitions (Markdown)
│   └── <name>.md
├── commands/                # Slash command definitions (Markdown)
│   └── <name>.md
├── hooks.json               # Declarative hook definitions
├── mcp.json                 # MCP server declarations
└── scripts/                 # Supporting scripts (referenced by hooks or MCP)
    └── <name>.sh
```

### 4.1 plugin.json (Canonical Manifest)

```json
{
  "name": "my-plugin",
  "version": "1.0.0",
  "description": "What this plugin does",
  "author": "someone",
  "homepage": "https://github.com/user/my-plugin",
  "compatibility": {
    "claude-code": ">=1.0.0",
    "antigravity": ">=2.0.0",
    "opencode": ">=0.1.0",
    "codex": ">=0.147.0",
    "pi": ">=0.1.0"
  }
}
```

If no `plugin.json` exists, the parser infers:

- Name → directory/repo name
- Components → detected from directory contents
- Version → `0.0.0`
- Compatibility → all agents (assume universal)

### 4.2 SKILL.md

Standard Agent Skills format. Contains task-specific instructions in Markdown. This is the same format used by `skills.sh` and `npx skills`, compatible with 18+ agents.

### 4.3 rules/*.md

Markdown files defining behavioral constraints. The adapter is responsible for adding agent-specific metadata (e.g., Antigravity frontmatter triggers, Claude Code `CLAUDE.md` injection).

### 4.4 agents/*.md

Subagent definitions in Markdown with YAML frontmatter. Frontmatter fields are agent-specific — the CPF uses a superset, and each adapter maps to its agent's required fields.

### 4.5 hooks.json (Canonical Format)

```json
{
  "hooks": [
    {
      "name": "lint-on-save",
      "event": "PostToolUse",
      "matcher": "write_to_file",
      "command": "./scripts/lint.sh",
      "timeout": 30,
      "enabled": true
    }
  ]
}
```

The canonical format uses a flat array. Each adapter transforms this into its agent's native hook schema (see Section 13).

### 4.6 mcp.json

```json
{
  "mcpServers": {
    "server-name": {
      "command": "node",
      "args": ["./scripts/server.js"],
      "env": {
        "API_KEY": "${API_KEY}"
      },
      "cwd": "."
    }
  }
}
```

Relative paths in `args` and `cwd` are resolved relative to the plugin's store path. The adapter must rewrite these to absolute paths at materialization time (see Section 12).

---

## 5. Adapter Interface Contract

Every adapter must implement this interface:

```typescript
export interface AgentAdapter {
  /** Unique identifier */
  readonly name: string;

  /** Adapter version (date-based) */
  readonly version: string;

  /** Agent version compatibility range */
  readonly compatibility: string;

  /**
   * Detect if this agent is configured in the workspace.
   * Returns true if the agent's marker files/directories exist.
   */
  detect(workspaceRoot: string): Promise<boolean>;

  /**
   * Materialize a canonical plugin into this agent's native format.
   * Returns the list of files written/modified for lockfile tracking.
   */
  install(
    plugin: CanonicalPlugin,
    storePath: string,
    workspaceRoot: string
  ): Promise<MaterializedFile[]>;

  /**
   * Remove a previously-installed plugin from this agent's workspace.
   * Uses the tracked file list from install() to clean up precisely.
   */
  uninstall(
    name: string,
    files: MaterializedFile[],
    workspaceRoot: string
  ): Promise<void>;

  /**
   * Check current state of an installed plugin.
   */
  status(
    name: string,
    expectedVersion: string,
    files: MaterializedFile[],
    workspaceRoot: string
  ): Promise<'synced' | 'outdated' | 'missing' | 'modified'>;
}

export interface CanonicalPlugin {
  name: string;
  version: string;
  description: string;
  rootPath: string;              // path in global store
  hasSkill: boolean;
  hasRules: boolean;
  hasAgents: boolean;
  hasWorkflows: boolean;
  hasCommands: boolean;
  hasHooks: boolean;
  hasMcp: boolean;
}

export interface MaterializedFile {
  agentPath: string;             // absolute path written to
  componentType: 'skill' | 'rule' | 'agent' | 'workflow' | 'command' | 'hook' | 'mcp';
  managed: boolean;              // true = created by agentpm
}
```

---

## 6. Adapter: Claude Code

### 6.1 Detection

**Markers:** `.claude/` directory in workspace root.

### 6.2 Storage Paths

| Scope                | Path                                                                             |
| -------------------- | -------------------------------------------------------------------------------- |
| Global plugins       | `~/.claude/plugins/`                                                             |
| Workspace skills     | `.claude/commands/` (slash commands) or `.claude/skills/` (background knowledge) |
| Workspace config     | `.claude/settings.local.json`                                                    |
| Project instructions | `CLAUDE.md` in workspace root                                                    |

### 6.3 Component Mapping

| CPF Component            | Claude Code Target                  | Transformation                                                                         |
| ------------------------ | ----------------------------------- | -------------------------------------------------------------------------------------- |
| `SKILL.md`               | `.claude/commands/<plugin-name>.md` | Wrap as slash command: prepend `# /<name>` header                                      |
| `skills/<name>/SKILL.md` | `.claude/commands/<name>.md`        | Same wrapping                                                                          |
| `commands/<name>.md`     | `.claude/commands/<name>.md`        | Copy as-is (already command format)                                                    |
| `rules/*.md`             | `CLAUDE.md`                         | Inject between markers `<!-- agentpm:<name>:start -->` / `<!-- agentpm:<name>:end -->` |
| `agents/<name>.md`       | `.claude/agents/<name>.md`          | Copy (verify frontmatter compatibility)                                                |
| `hooks.json`             | `.claude/settings.local.json`       | Rewrite to Claude hook schema (see Section 13)                                         |
| `mcp.json`               | `.mcp.json` at workspace root       | Merge, rewrite paths, expand `${CLAUDE_PLUGIN_ROOT}` (see Section 12)                  |
| `workflows/<name>.md`    | `.claude/commands/<name>.md`        | Convert to command format (flatten steps)                                              |

### 6.4 Hook Schema (Claude Code)

Claude Code hooks are defined in `hooks/hooks.json` or inline in `plugin.json`. Events are PascalCase.

**Supported events (verified from docs):**

| Event                | Category       | Description                  |
| -------------------- | -------------- | ---------------------------- |
| `PreToolUse`         | Per tool call  | Before tool execution        |
| `PostToolUse`        | Per tool call  | After tool execution         |
| `PostToolUseFailure` | Per tool call  | After tool execution failure |
| `PostToolBatch`      | Per tool call  | After batch tool execution   |
| `PreInvocation`      | Per invocation | Before agent invocation      |
| `PostInvocation`     | Per invocation | After agent invocation       |
| `Stop`               | Per turn       | When agent stops             |
| `StopFailure`        | Per turn       | When agent stop fails        |
| `SessionStart`       | Per session    | At session start             |
| `SessionEnd`         | Per session    | At session end               |
| `UserPromptSubmit`   | Per turn       | When user submits prompt     |
| `PermissionRequest`  | Permission     | When permission is requested |
| `PermissionDenied`   | Permission     | When permission is denied    |
| `SubagentStart`      | Subagent       | When subagent starts         |
| `SubagentStop`       | Subagent       | When subagent stops          |
| `Notification`       | Display        | On notification              |
| `MessageDisplay`     | Display        | On message display           |
| `ConfigChange`       | Environment    | On config change             |
| `CwdChanged`         | Environment    | On working directory change  |
| `FileChanged`        | Environment    | On file change               |
| `DirectoryAdded`     | Environment    | On directory added           |
| `WorktreeCreate`     | Worktree       | On worktree creation         |
| `WorktreeRemove`     | Worktree       | On worktree removal          |
| `PreCompact`         | Compaction     | Before context compaction    |
| `PostCompact`        | Compaction     | After context compaction     |
| `Elicitation`        | MCP            | On MCP elicitation           |
| `ElicitationResult`  | MCP            | On MCP elicitation result    |
| `InstructionsLoaded` | Rules          | On instructions load         |
| `TeammateIdle`       | Agent teams    | When teammate is idle        |
| `TaskCreated`        | Task           | On task creation             |
| `TaskCompleted`      | Task           | On task completion           |

### 6.5 Known Issues

- Supports symlinked marketplace paths
- Uses `${CLAUDE_PLUGIN_ROOT}` variable for path portability
- Hook commands execute out-of-process (shell, HTTP, MCP, prompt, verifier)

---

## 7. Adapter: Google Antigravity

### 7.1 Detection

**Markers:** `.agents/` directory or `AGENTS.md` file in workspace root.

### 7.2 Storage Paths

| Scope             | Path                                                      |
| ----------------- | --------------------------------------------------------- |
| Global plugins    | `~/.gemini/antigravity-cli/plugins/<namespace>/<plugin>/` |
| Global config     | `~/.gemini/config/plugins/`, `~/.gemini/config/skills/`   |
| Workspace skills  | `.agents/skills/`                                         |
| Workspace rules   | `.agents/rules/`                                          |
| Workspace agents  | `.agents/agents/`                                         |
| Workspace plugins | `.agents/plugins/`                                        |
| Workspace MCP     | `.agents/mcp_config.json`                                 |
| Workspace hooks   | `.agents/hooks.json`                                      |

### 7.3 Component Mapping

| CPF Component            | Antigravity Target                                                 | Transformation                            |
| ------------------------ | ------------------------------------------------------------------ | ----------------------------------------- |
| `SKILL.md`               | `.agents/skills/<plugin-name>/SKILL.md`                            | Copy as-is (same standard)                |
| `skills/<name>/SKILL.md` | `.agents/skills/<name>/SKILL.md`                                   | Copy as-is                                |
| `commands/<name>.md`     | `.agents/skills/<name>/<name>.md` or `.agents/workflows/<name>.md` | Convert to skill or workflow              |
| `rules/*.md`             | `.agents/rules/<plugin-name>-<name>.md`                            | Add frontmatter with trigger metadata     |
| `agents/<name>.md`       | `.agents/agents/<name>.md`                                         | Rewrite frontmatter to Antigravity schema |
| `hooks.json`             | `.agents/hooks.json`                                               | Full schema rewrite (see Section 13)      |
| `mcp.json`               | `.agents/mcp_config.json`                                          | Merge, rewrite paths (see Section 12)     |
| `workflows/<name>.md`    | `.agents/workflows/<name>.md`                                      | Copy (same standard)                      |

### 7.4 Manifest Schema (Antigravity plugin.json)

```json
{
  "$schema": "https://antigravity.google/schemas/v1/plugin.json",
  "name": "my-plugin",
  "version": "1.0.0",
  "description": "Plugin description"
}
```

Required fields: `name` (alphanumeric, hyphens, underscores). Component discovery is automatic via directory scanning — no explicit component lists in manifest.

### 7.5 Agent/Subagent Schema (Antigravity)

```yaml
---
name: code-auditor
description: Specialized subagent for security audits
tools:
  - view_file
  - grep_search
  - run_command
subagent: true
mainAgent: false
model: pro
commandExecutionPolicy: sandbox
skills:
  - skills/security-checklist
mcpServers:
  - name: my-server
    command: node
    args: ["server.js"]
---

# System Prompt
You are an expert security auditor...
```

**Frontmatter fields (verified from official docs):**

| Property                 | Type     | Default   | Required | Description                                     |
| ------------------------ | -------- | --------- | -------- | ----------------------------------------------- |
| `name`                   | string   | —         | Yes      | Unique identifier                               |
| `description`            | string   | —         | Yes      | Used by planner for delegation                  |
| `tools`                  | string[] | `[]`      | No       | Permitted tools (see Section 14 for tool names) |
| `mainAgent`              | boolean  | `true`    | No       | Can be primary agent                            |
| `subagent`               | boolean  | `true`    | No       | Can be invoked as subagent                      |
| `model`                  | string   | `inherit` | No       | `inherit`, `flash`, or `pro`                    |
| `commandExecutionPolicy` | string   | `sandbox` | No       | `off`, `auto`, `eager`, `sandbox`               |
| `mcpServers`             | object[] | `[]`      | No       | Custom MCP servers for this agent               |
| `skills`                 | string[] | `[]`      | No       | Skill paths or plugin dependencies              |

**Discovery locations:**

| Scope     | Path                                                                             |
| --------- | -------------------------------------------------------------------------------- |
| Workspace | `.agents/agents/<name>.md` or `.agents/agents/<name>/agent.md`                   |
| Global    | `~/.gemini/config/agents/<name>.md` or `~/.gemini/config/agents/<name>/agent.md` |
| Plugin    | `plugins/<plugin_name>/agents/`                                                  |

### 7.6 Workflow Schema (Antigravity)

```markdown
---
name: deploy-checklist
description: Pre-deployment verification workflow
---

# Deploy Checklist

1. Run all tests
2. Check for security vulnerabilities
3. Verify environment variables
4. Deploy to staging
5. Run smoke tests
```

- Workflows are markdown files invoked via `/workflow-name`
- Can be Global (`~/.gemini/config/workflows/`) or Workspace (`.agents/workflows/`)
- Limited to **12,000 characters** per file

### 7.7 Rules Schema (Antigravity)

```markdown
---
trigger: always_on
managed_by: agentpm
plugin: my-plugin
---

# Rule Content

Always use TypeScript strict mode...
```

**Trigger types (from prior research):**

| Trigger          | Behavior                                     |
| ---------------- | -------------------------------------------- |
| `always_on`      | Applied to every conversation                |
| `glob`           | Applied when matching files are in context   |
| `model_decision` | Applied when model decides it's relevant     |
| `manual`         | Applied only when explicitly mentioned via @ |

### 7.8 Hook Schema (Antigravity — verified from official docs)

```json
{
  "my-linter-hook": {
    "PreToolUse": [
      {
        "matcher": "run_command",
        "hooks": [
          {
            "type": "command",
            "command": "./scripts/lint.sh",
            "timeout": 10
          }
        ]
      }
    ]
  },
  "safety-gate": {
    "enabled": false,
    "PreToolUse": [
      {
        "matcher": ".*",
        "hooks": [
          {
            "type": "command",
            "command": "./scripts/safety-check.sh"
          }
        ]
      }
    ]
  }
}
```

**Key structural differences from Claude Code:**

| Aspect              | Claude Code                          | Antigravity                      |
| ------------------- | ------------------------------------ | -------------------------------- |
| Top-level structure | Array of hooks                       | Object with named hooks          |
| Event as            | String field `"event": "PreToolUse"` | Object key `"PreToolUse": [...]` |
| Matcher             | Object `{ "toolName": "bash" }`      | Regex string `"run_command"`     |
| Hooks nesting       | Flat action                          | Nested array inside matcher      |
| `enabled` toggle    | Not supported                        | Supported (`"enabled": false`)   |
| `timeout`           | Not supported                        | Supported (integer, seconds)     |

**Supported events (verified):**

| Event            | I/O Contract                                                         |
| ---------------- | -------------------------------------------------------------------- |
| `PreToolUse`     | Receives tool input JSON on stdin. Returns: `{ "decision": "allow"   | "deny" | "ask" | "force_ask" | "deny_unless_prior_grant", "reason": "...", "permissionOverrides": [...] }` |
| `PostToolUse`    | Receives tool output on stdin. Returns: `{}`                         |
| `PreInvocation`  | Receives agent context on stdin. Returns: `{ "injectSteps": [...] }` |
| `PostInvocation` | Receives agent result on stdin. Returns: `{}`                        |
| `Stop`           | Receives stop context on stdin. Returns: `{}`                        |

**PreInvocation step injection format:**

```json
{
  "injectSteps": [
    { "ephemeralMessage": "Remember to lint before finalizing." },
    { "toolCall": { "name": "run_command", "args": { "CommandLine": "npm run lint" } } },
    { "userMessage": "Check the test results above." }
  ]
}
```

### 7.9 Terminal Sandbox

Antigravity includes a Terminal Sandbox that restricts local process execution:

- **Linux:** nsjail
- **macOS:** sandbox-exec
- **Windows:** AppContainer

Hook scripts that execute system commands may be sandboxed. The `commandExecutionPolicy` field in agent frontmatter controls this: `off` (no sandbox), `auto` (sandbox when untrusted), `eager` (always sandbox), `sandbox` (force sandbox).

### 7.10 CLI Management

Uses the `agy` command:

```bash
agy plugin install /path/to/local/plugin
agy plugin disable <plugin_name>
agy plugin enable <plugin_name>
agy plugin uninstall <plugin_name>
```

---

## 8. Adapter: OpenCode

### 8.1 Detection

**Markers:** `.opencode/` directory or `opencode.json` file in workspace root.

### 8.2 Storage Paths

| Scope             | Path                          |
| ----------------- | ----------------------------- |
| Global plugins    | `~/.config/opencode/plugins/` |
| Global skills     | `~/.config/opencode/skills/`  |
| Workspace plugins | `.opencode/plugins/`          |
| Workspace skills  | `.opencode/skills/`           |
| Config file       | `opencode.json`               |

### 8.3 Component Mapping

| CPF Component         | OpenCode Target                    | Transformation                           |
| --------------------- | ---------------------------------- | ---------------------------------------- |
| `SKILL.md`            | `.opencode/skills/<name>/SKILL.md` | Copy as-is                               |
| `rules/*.md`          | `opencode.json` context section    | Merge into context config                |
| `agents/<name>.md`    | `.opencode/agents/<name>.md`       | Copy (verify schema)                     |
| `hooks.json`          | `opencode.json` plugins section    | Synthesize `@opencode-ai/plugin` wrapper |
| `mcp.json`            | `opencode.json` mcpServers section | Merge, rewrite paths                     |
| `workflows/<name>.md` | `.opencode/skills/<name>/SKILL.md` | Convert to skill format                  |

### 8.4 Key Differences

- **In-process runtime:** OpenCode loads plugins directly into its Bun/Node process via `@opencode-ai/plugin` SDK
- **Lifecycle events:** Programmatic async hooks (`session.created`, `tool.execute.before`, `tool.execute.after`, `session.compacted`, `tui.command.execute`)
- **Imperative code:** If a plugin includes `src/` with TypeScript, OpenCode can load it natively — other agents cannot

---

## 9. Adapter: OpenAI Codex CLI

### 9.1 Detection

**Markers:** `.codex-plugin/` directory or `~/.codex/` global config.

### 9.2 Storage Paths

| Scope        | Path                                                                                                |
| ------------ | --------------------------------------------------------------------------------------------------- |
| Plugin cache | `~/.codex/plugins/cache/<marketplace>/<plugin>/<version>/`                                          |
| Discovery    | `~/.agents/plugins/marketplace.json` (personal) or `./.agents/plugins/marketplace.json` (workspace) |
| MCP config   | `.mcp.json` at workspace root                                                                       |

### 9.3 Component Mapping

| CPF Component | Codex CLI Target          | Transformation                               |
| ------------- | ------------------------- | -------------------------------------------- |
| `SKILL.md`    | Cache `skills/`           | Copy (dereference symlinks)                  |
| `rules/*.md`  | `AGENTS.md`               | Inject between markers                       |
| `hooks.json`  | External process triggers | Convert to JSON hook definitions             |
| `mcp.json`    | `.mcp.json`               | Merge, **expand relative `cwd` to absolute** |

### 9.4 Known Issues

- **Symlink dropping:** `store.rs` recursive copier historically skips symlinks. Always dereference before staging.
- **Path flattening:** Marketplace name == plugin name causes path bugs.
- **MCP relative paths:** `cwd` in `.mcp.json` resolves from launch dir, not plugin cache root. Must expand to absolute at install time.

---

## 10. Adapter: Pi Coding Agent

### 10.1 Detection

**Markers:** `.pi/` directory in workspace root.

### 10.2 Storage Paths

| Scope                | Path                      |
| -------------------- | ------------------------- |
| Global extensions    | `~/.pi/agent/extensions/` |
| Workspace extensions | `.pi/extensions/`         |
| Trust config         | `~/.pi/agent/trust.json`  |
| Settings             | `.pi/settings.json`       |

### 10.3 Component Mapping

| CPF Component | Pi Agent Target                 | Transformation                  |
| ------------- | ------------------------------- | ------------------------------- |
| `SKILL.md`    | Registered via `/skill:` prefix | Register in extension API       |
| `rules/*.md`  | `.pi/settings.json`             | Inject into settings            |
| `hooks.json`  | `ExtensionAPI` event listeners  | Generate TS event listener code |
| `mcp.json`    | CLI execution wrapper           | Wrap as CLI command             |

### 10.4 Key Differences

- **Trust boundaries:** Pi enforces `~/.pi/agent/trust.json` before executing workspace extensions
- **Event model:** `pi.on("session_start")` within process boundary
- **TypeScript-first:** Extensions are TypeScript entry points imported via Node

---

## 11. Cross-Agent Conversion: Claude Code → Antigravity

This section provides the verified, complete conversion specification.

### 11.1 Pre-Conversion Checklist

1. Backup the entire Claude plugin folder
2. Inventory all components (skills, commands, agents, hooks, MCP servers, rules)
3. Review `.claude-plugin/plugin.json` for inline hook or MCP definitions
4. Identify workspace-specific environment variables or paths
5. Check for `${CLAUDE_PLUGIN_ROOT}` references (requires path expansion)
6. Identify which Claude hook events are used (check lossy mapping in Section 13)

### 11.2 Directory Structure Conversion

**Claude Code source:**

```
my-plugin/
├── .claude-plugin/
│   └── plugin.json              # Claude manifest
├── skills/
│   └── <name>/
│       └── SKILL.md
├── commands/
│   └── <name>.md
├── agents/
│   └── <name>.md
├── hooks/
│   └── hooks.json
├── .mcp.json
└── monitors/                    # Claude-specific (no Antigravity equivalent)
```

**Antigravity target:**

```
my-plugin/
├── plugin.json                  # Rewritten to Antigravity schema
├── skills/
│   └── <name>/
│       └── SKILL.md             # Copied as-is
├── workflows/
│   └── <name>.md                # Converted from commands/
├── agents/
│   └── <name>.md                # Frontmatter rewritten
├── rules/
│   └── <name>.md                # Extracted/created with frontmatter
├── hooks.json                   # Full schema rewrite
├── mcp_config.json              # Rewritten from .mcp.json
└── scripts/
    └── <name>.sh                # Copied as-is
```

### 11.3 Step-by-Step Conversion

#### Step 1: Manifest

| Action  | From                                                                    | To                                                             |
| ------- | ----------------------------------------------------------------------- | -------------------------------------------------------------- |
| Move    | `.claude-plugin/plugin.json`                                            | `plugin.json`                                                  |
| Rewrite | `$schema: "https://agent-plugins.org/schemas/1.0.0/plugin.schema.json"` | `$schema: "https://antigravity.google/schemas/v1/plugin.json"` |
| Keep    | `name`, `version`, `description`                                        | Same fields                                                    |
| Remove  | Claude-specific component lists                                         | Not needed (directory scanning)                                |

#### Step 2: Skills

| Action | From                     | To                       |
| ------ | ------------------------ | ------------------------ |
| Copy   | `skills/<name>/SKILL.md` | `skills/<name>/SKILL.md` |

No transformation needed. Same Agent Skills standard.

#### Step 3: Commands → Workflows or Skills

| Action  | From                 | To                                                                                   |
| ------- | -------------------- | ------------------------------------------------------------------------------------ |
| Convert | `commands/<name>.md` | `workflows/<name>.md` (if multi-step) or `skills/<name>/SKILL.md` (if simple prompt) |

If the command is a simple prompt instruction, convert to a skill. If it involves multi-step logic, convert to a workflow. Respect the 12,000 character limit for workflows.

#### Step 4: Agents

| Action              | From                      | To                                                         |
| ------------------- | ------------------------- | ---------------------------------------------------------- |
| Copy                | `agents/<name>.md`        | `agents/<name>.md`                                         |
| Rewrite frontmatter | Claude frontmatter fields | Antigravity required fields (`name`, `description`)        |
| Map tools           | Claude tool names         | Antigravity tool names (see Section 14)                    |
| Add fields          | —                         | `commandExecutionPolicy`, `model`, `subagent`, `mainAgent` |

#### Step 5: Rules

| Action          | From                                            | To                                                 |
| --------------- | ----------------------------------------------- | -------------------------------------------------- |
| Extract         | Implicit rules from CLAUDE.md or system prompts | `rules/<name>.md`                                  |
| Add frontmatter | —                                               | `trigger: always_on` (or appropriate trigger type) |

#### Step 6: Hooks

| Action      | From                                  | To                                       |
| ----------- | ------------------------------------- | ---------------------------------------- |
| Rewrite     | `hooks/hooks.json` (Claude schema)    | `hooks.json` (Antigravity schema)        |
| Map events  | Claude event names                    | Antigravity event names (see Section 13) |
| Map tools   | Claude tool names in matchers         | Antigravity tool names (see Section 14)  |
| Skip        | Events with no Antigravity equivalent | Log warning for each skipped event       |
| Restructure | Array format                          | Named-object format with nested matchers |

#### Step 7: MCP Configuration

| Action       | From                                 | To                                       |
| ------------ | ------------------------------------ | ---------------------------------------- |
| Extract      | `.mcp.json` or inline in plugin.json | `mcp_config.json`                        |
| Expand paths | `${CLAUDE_PLUGIN_ROOT}`              | Absolute path to plugin location         |
| Expand paths | Relative `cwd` and `args`            | Absolute paths resolved from plugin root |
| Keep         | Server names, commands, env vars     | Same (except path values)                |

#### Step 8: Monitors

| Action | From        | To                                                           |
| ------ | ----------- | ------------------------------------------------------------ |
| Skip   | `monitors/` | No Antigravity equivalent                                    |
| Log    | —           | Warning: "monitors/ component has no Antigravity equivalent" |

### 11.4 Conversion Completeness Matrix

| Claude Code Component   | Antigravity Equivalent | Lossy?  | Details                                                                      |
| ----------------------- | ---------------------- | ------- | ---------------------------------------------------------------------------- |
| Skills (`SKILL.md`)     | Skills                 | No      | Same standard                                                                |
| Commands                | Workflows or Skills    | Minor   | Content preserved, structure changes                                         |
| Agents                  | Agents                 | Minor   | Frontmatter rewrite required                                                 |
| Hooks (5 events)        | Hooks                  | No      | Direct mapping: PreToolUse, PostToolUse, PreInvocation, PostInvocation, Stop |
| Hooks (22 events)       | *No equivalent*        | **Yes** | SessionStart, SessionEnd, PermissionRequest, SubagentStart, etc. — skipped   |
| MCP servers             | MCP config             | No      | Path rewriting required                                                      |
| LSP servers             | *No equivalent*        | **Yes** | Skipped entirely                                                             |
| Monitors                | *No equivalent*        | **Yes** | Skipped entirely                                                             |
| `${CLAUDE_PLUGIN_ROOT}` | Expanded paths         | N/A     | Variable replaced with absolute path                                         |
| Rules (implicit)        | Rules (explicit)       | Gain    | Antigravity has dedicated rules system                                       |

---

## 12. MCP Path Rewriting

### 12.1 Problem

Claude Code provides `${CLAUDE_PLUGIN_ROOT}` as a variable in MCP configs. Antigravity has no equivalent variable. Relative paths in MCP configs resolve differently across agents.

### 12.2 Rewriting Rules

```typescript
function rewriteMcpPaths(mcpConfig: McpConfig, pluginStorePath: string): McpConfig {
  const absoluteStorePath = path.resolve(pluginStorePath);
  const result = JSON.parse(JSON.stringify(mcpConfig)); // deep clone

  for (const [serverName, server] of Object.entries(result.mcpServers || {})) {
    const s = server as any;

    // 1. Expand ${CLAUDE_PLUGIN_ROOT} to actual path
    if (s.command) s.command = expandPluginRoot(s.command, absoluteStorePath);
    if (Array.isArray(s.args)) {
      s.args = s.args.map((a: string) => expandPluginRoot(a, absoluteStorePath));
    }
    if (s.cwd) s.cwd = expandPluginRoot(s.cwd, absoluteStorePath);
    if (s.env) {
      for (const [k, v] of Object.entries(s.env)) {
        if (typeof v === 'string') s.env[k] = expandPluginRoot(v, absoluteStorePath);
      }
    }

    // 2. Resolve relative paths to absolute
    if (s.cwd && isRelative(s.cwd)) s.cwd = path.resolve(absoluteStorePath, s.cwd);
    if (Array.isArray(s.args)) {
      s.args = s.args.map((a: string) =>
        isRelative(a) ? path.resolve(absoluteStorePath, a) : a
      );
    }
  }

  return result;
}

function expandPluginRoot(value: string, pluginPath: string): string {
  return value.replace(/\$\{CLAUDE_PLUGIN_ROOT\}/g, pluginPath);
}

function isRelative(p: string): boolean {
  return p.startsWith('./') || p.startsWith('../') || p === '.';
}
```

### 12.3 Per-Agent Path Behavior

| Agent       | MCP Config Location                | `cwd` Resolution                                   | Variable Support        |
| ----------- | ---------------------------------- | -------------------------------------------------- | ----------------------- |
| Claude Code | `.mcp.json` (workspace root)       | Relative to workspace root                         | `${CLAUDE_PLUGIN_ROOT}` |
| Antigravity | `.agents/mcp_config.json`          | Relative to workspace root                         | None documented         |
| OpenCode    | `opencode.json` mcpServers section | Relative to workspace root                         | None documented         |
| Codex CLI   | `.mcp.json` (workspace root)       | Relative to **launch directory** (not plugin root) | None                    |
| Pi Agent    | CLI execution wrapper              | N/A                                                | N/A                     |

**Critical:** For Codex CLI, the adapter must expand all relative paths to absolute, because `cwd` resolves from the launch directory which may differ from the workspace root.

---

## 13. Hook Event Mapping

### 13.1 Claude Code → Antigravity

| Claude Code Event    | Antigravity Event | Lossy?  | Notes                                         |
| -------------------- | ----------------- | ------- | --------------------------------------------- |
| `PreToolUse`         | `PreToolUse`      | No      | Output schema differs (see below)             |
| `PostToolUse`        | `PostToolUse`     | No      | Both return minimal output                    |
| `PreInvocation`      | `PreInvocation`   | No      | Antigravity supports step injection           |
| `PostInvocation`     | `PostInvocation`  | No      |                                               |
| `Stop`               | `Stop`            | No      |                                               |
| `SessionStart`       | —                 | **Yes** | No equivalent                                 |
| `SessionEnd`         | —                 | **Yes** | No equivalent                                 |
| `UserPromptSubmit`   | —                 | **Yes** | No equivalent                                 |
| `PermissionRequest`  | —                 | **Yes** | Antigravity uses permission engine, not hooks |
| `PermissionDenied`   | —                 | **Yes** | No equivalent                                 |
| `SubagentStart`      | —                 | **Yes** | Antigravity handles via subagent states       |
| `SubagentStop`       | —                 | **Yes** | No equivalent                                 |
| `PostToolUseFailure` | —                 | **Yes** | No equivalent                                 |
| `PostToolBatch`      | —                 | **Yes** | No equivalent                                 |
| `StopFailure`        | —                 | **Yes** | No equivalent                                 |
| `Notification`       | —                 | **Yes** | No equivalent                                 |
| `MessageDisplay`     | —                 | **Yes** | No equivalent                                 |
| `ConfigChange`       | —                 | **Yes** | No equivalent                                 |
| `CwdChanged`         | —                 | **Yes** | No equivalent                                 |
| `FileChanged`        | —                 | **Yes** | No equivalent                                 |
| `DirectoryAdded`     | —                 | **Yes** | No equivalent                                 |
| `WorktreeCreate`     | —                 | **Yes** | No equivalent                                 |
| `WorktreeRemove`     | —                 | **Yes** | No equivalent                                 |
| `PreCompact`         | —                 | **Yes** | No equivalent                                 |
| `PostCompact`        | —                 | **Yes** | No equivalent                                 |
| `Elicitation`        | —                 | **Yes** | No equivalent                                 |
| `ElicitationResult`  | —                 | **Yes** | No equivalent                                 |
| `InstructionsLoaded` | —                 | **Yes** | No equivalent                                 |
| `TeammateIdle`       | —                 | **Yes** | No equivalent                                 |
| `TaskCreated`        | —                 | **Yes** | No equivalent                                 |
| `TaskCompleted`      | —                 | **Yes** | No equivalent                                 |

**Summary: 5 of ~31 Claude Code events have direct Antigravity equivalents. Conversion is 16% lossless for events.**

### 13.2 Output Schema Differences

**Claude Code `PreToolUse` output:**

```json
{
  "decision": "allow" | "block",
  "reason": "string"
}
```

**Antigravity `PreToolUse` output:**

```json
{
  "decision": "allow" | "deny" | "ask" | "force_ask" | "deny_unless_prior_grant",
  "reason": "string",
  "permissionOverrides": ["read_file(/path)", "command(args)"]
}
```

Antigravity's `PreToolUse` has a richer decision vocabulary. Claude hooks returning `"block"` should be converted to `"deny"`.

### 13.3 Schema Rewrite Example

**Claude Code hook (source):**

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": { "toolName": "bash" },
        "action": {
          "type": "command",
          "command": "./check-bash.sh"
        }
      }
    ]
  }
}
```

**Antigravity hook (target):**

```json
{
  "bash-safety-check": {
    "PreToolUse": [
      {
        "matcher": "run_command",
        "hooks": [
          {
            "type": "command",
            "command": "./check-bash.sh",
            "timeout": 30
          }
        ]
      }
    ]
  }
}
```

### 13.4 Conversion Rules

1. Top-level: array → named object (generate name from hook purpose or source filename)
2. Event: string field → object key
3. Matcher: `{ "toolName": "X" }` → regex string with Antigravity tool name
4. Action: flat `{ "type": "command", "command": "..." }` → nested array `[{ "type": "command", "command": "...", "timeout": 30 }]`
5. `decision: "block"` → `decision: "deny"`
6. Unknown events → skip with warning

---

## 14. Tool Name Mapping

### 14.1 Claude Code → Antigravity

| Category        | Claude Code Tool Name                              | Antigravity Tool Name        |
| --------------- | -------------------------------------------------- | ---------------------------- |
| Shell execution | `bash`, `shell`, `terminal`, `execute`             | `run_command`                |
| File read       | `read_file`, `read`, `file_read`, `cat`            | `view_file`                  |
| File write      | `write_file`, `write`, `create_file`, `file_write` | `write_to_file`              |
| File edit       | `edit_file`, `str_replace_editor`, `edit`, `sed`   | `replace_file_content`       |
| Multi-edit      | `multi_edit`, `batch_edit`                         | `multi_replace_file_content` |
| Directory list  | `list_files`, `ls`, `list_dir`, `dir`              | `list_dir`                   |
| File search     | `find_files`, `glob`, `find`, `locate`             | `find_by_name`               |
| Content search  | `grep`, `search`, `rg`, `ag`                       | `grep_search`                |
| Web search      | `web_search`, `search_web`                         | `search_web`                 |
| URL fetch       | `fetch`, `curl`, `read_url`, `http`                | `read_url_content`           |
| Task management | `task`, `todo`, `manage`                           | `manage_task`                |
| Scheduling      | `schedule`, `cron`, `timer`                        | `schedule`                   |
| Subagent        | `subagent`, `delegate`, `spawn`                    | `invoke_subagent`            |
| Subagent define | —                                                  | `define_subagent`            |
| Messaging       | `send_message`, `message`                          | `send_message`               |
| Subagent manage | —                                                  | `manage_subagents`           |
| Question        | `ask`, `question`, `clarify`                       | `ask_question`               |
| Image gen       | `generate_image`, `image`                          | `generate_image`             |
| Permission list | —                                                  | `list_permissions`           |
| Permission ask  | —                                                  | `ask_permission`             |

### 14.2 Matcher Conversion

**Claude Code matcher:**

```json
{ "toolName": "bash" }
```

**Antigravity matcher (regex):**

```
"run_command"
```

For wildcard matchers (Claude `"*"`), use `".*"` in Antigravity.

---

## 15. Global Store & Workspace Layout

### 15.1 Global Store

```
~/.agentpm/
├── plugins/
│   ├── <plugin-name>/
│   │   ├── plugin.json          # Canonical manifest
│   │   ├── SKILL.md
│   │   ├── skills/
│   │   ├── rules/
│   │   ├── agents/
│   │   ├── workflows/
│   │   ├── commands/
│   │   ├── hooks.json
│   │   ├── mcp.json
│   │   └── scripts/
│   └── ...
├── registry.json                # Installed plugin versions, sources, hashes
├── adapters/                    # Downloaded adapter specs (future: from registry)
│   ├── claude-code/
│   ├── antigravity/
│   ├── opencode/
│   ├── codex/
│   └── pi/
└── cache/                       # Tarballs, git clones for fast re-fetch
```

### 15.2 Workspace (No .agentpm/ Directory)

```
my-project/
├── .agentpm.lock                    # Single file — tracks installed plugins
├── .claude/                         # Claude Code (if detected/used)
│   ├── commands/
│   │   └── agentpm-<plugin>.md
│   ├── agents/
│   │   └── agentpm-<agent>.md
│   └── settings.local.json          # MCP + hooks (merged, not overwritten)
├── .agents/                         # Antigravity (if detected/used)
│   ├── skills/
│   │   └── agentpm-<plugin>/
│   │       └── SKILL.md
│   ├── rules/
│   │   └── agentpm-<plugin>-<rule>.md
│   ├── agents/
│   │   └── agentpm-<agent>.md
│   ├── workflows/
│   │   └── agentpm-<workflow>.md
│   └── mcp_config.json
├── .opencode/                       # OpenCode (if detected/used)
│   ├── skills/
│   │   └── agentpm-<plugin>/
│   │       └── SKILL.md
│   └── opencode.json
├── .mcp.json                        # Claude Code / Codex MCP (merged)
├── CLAUDE.md                        # Claude Code rules (injected sections)
└── (project files)
```

### 15.3 Namespacing

All agentpm-managed files are prefixed with `agentpm-` to avoid collisions with manually-created files:

- Skills: `agentpm-<plugin-name>/`
- Rules: `agentpm-<plugin-name>-<rule-name>.md`
- Agents: `agentpm-<agent-name>.md`
- Workflows: `agentpm-<workflow-name>.md`
- MCP entries: `agentpm:<plugin-name>:<server-name>`

---

## 16. CLI Commands

### 16.1 Global Management

```bash
# Fetch plugin from source to global store
agentpm add <source>
agentpm add github:user/repo
agentpm add https://github.com/user/repo
agentpm add @agentpm/plugin-name
agentpm add ./local-path

# Remove from global store
agentpm remove <name>

# List globally installed plugins
agentpm list

# Check for updates
agentpm update
agentpm update <name>

# Update adapter specs
agentpm update-adapters
```

### 16.2 Workspace Management

```bash
# Install plugin into workspace for specific agent
agentpm install <name> --for antigravity
agentpm install <name> --for claude-code
agentpm install <name> --for opencode

# Install for all detected agents
agentpm install <name> --for all

# Remove plugin from workspace
agentpm uninstall <name>

# List workspace-installed plugins with staleness
agentpm list --local

# Re-materialize all plugins (after adapter updates)
agentpm sync
agentpm sync --plugin <name>
agentpm sync --agent antigravity
```

### 16.3 Conversion

```bash
# Convert plugin from one agent format to another
agentpm convert <name-or-path> --from claude-code --to antigravity

# Preview conversion without writing
agentpm convert <name-or-path> --from claude-code --to antigravity --dry-run
```

### 16.4 Detection

```bash
# Show which agents are configured in workspace
agentpm detect

# Verbose: show versions, adapter compatibility
agentpm detect --verbose
```

---

## 17. Lockfile Format

```json
// .agentpm.lock
{
  "version": 1,
  "installs": {
    "some-skill": {
      "version": "1.2.0",
      "source": "github:user/some-skill",
      "hash": "sha256:a1b2c3d4...",
      "installedAt": "2026-08-07T14:30:00Z",
      "agents": {
        "antigravity": {
          "syncedAt": "2026-08-07T14:30:01Z",
          "adapterVersion": "2026.08.01",
          "files": [
            { "path": ".agents/skills/agentpm-some-skill/SKILL.md", "type": "skill" },
            { "path": ".agents/rules/agentpm-some-skill-style.md", "type": "rule" },
            { "path": ".agents/mcp_config.json", "type": "mcp" }
          ]
        },
        "claude-code": {
          "syncedAt": "2026-08-07T14:30:02Z",
          "adapterVersion": "2026.08.01",
          "files": [
            { "path": ".claude/commands/agentpm-some-skill.md", "type": "skill" },
            { "path": "CLAUDE.md", "type": "rule" },
            { "path": ".mcp.json", "type": "mcp" }
          ]
        }
      }
    }
  }
}
```

---

## 18. Adapter Registry & Update Model

### 18.1 Architecture

Adapters are maintained in a separate Git repository, independently versionable from the core tool.

```
agentpm-adapters/                    # Git repository
├── adapters/
│   ├── claude-code/
│   │   ├── adapter.yaml             # Declarative spec
│   │   ├── transforms.ts            # Complex transform functions
│   │   └── changelog.md
│   ├── antigravity/
│   │   ├── adapter.yaml
│   │   ├── transforms.ts
│   │   └── changelog.md
│   ├── opencode/
│   ├── codex/
│   └── pi/
├── metadata.json                    # Version index, compatibility ranges
└── README.md
```

### 18.2 Adapter Versioning

Adapters use date-based versions (`YYYY.MM.DD`). Each adapter declares which agent version range it supports:

```yaml
# adapters/antigravity/adapter.yaml
name: antigravity
version: "2026.08.01"
compatibility: ">=2.0.0"
tested_up_to: "2.3.0"
```

### 18.3 Change Detection

1. **Agent version detection:** `agentpm detect --verbose` compares installed agent version against adapter's `tested_up_to` field
2. **Post-install validation:** After materialization, verify files are discoverable by the agent
3. **Community reporting:** Adapter repo GitHub Issues for format changes

### 18.4 Update Flow

```bash
$ agentpm update-adapters

Checking adapter registry...
  antigravity    2026.08.01 → 2026.09.15   Updated (rules frontmatter changed)
  claude-code    2026.08.01 → 2026.08.01   Current
  opencode       2026.08.01 → 2026.08.10   Updated (MCP config location changed)

$ agentpm sync

Re-syncing 3 plugins across 2 agents...
  some-skill      → antigravity  ✔ (adapter updated)
  some-skill      → claude-code  ✔ (no change needed)
  code-reviewer   → antigravity  ✔ (adapter updated)
```

---

## 19. Knowledge Dependencies & Change Management

### 19.1 What the Tool Knows

| Layer                   | Knowledge                                                                       | Change Frequency     | Source                                              |
| ----------------------- | ------------------------------------------------------------------------------- | -------------------- | --------------------------------------------------- |
| **Core (embedded)**     | SKILL.md spec, MCP spec, Agent Plugins spec, lockfile format, adapter interface | Rarely (yearly)      | Open standards                                      |
| **Adapters (external)** | Per-agent file paths, manifest schemas, hook schemas, tool names                | Quarterly to monthly | Adapter registry, maintained against agent releases |
| **Workspace (managed)** | What's installed where, file hashes                                             | Per-operation        | Lockfile                                            |

### 19.2 What Can Break

| Failure Mode                   | Cause                      | Detection               | Mitigation                    |
| ------------------------------ | -------------------------- | ----------------------- | ----------------------------- |
| Plugin not discovered by agent | Agent changed scan path    | Post-install validation | Adapter update                |
| MCP server fails to start      | Path resolution changed    | MCP health check        | Path rewriting fix in adapter |
| Hook silently ignored          | Event name renamed         | Agent version check     | Adapter update                |
| Hook crashes                   | Tool name changed          | Runtime error           | Tool name mapping update      |
| Rules not applied              | Frontmatter format changed | Agent version check     | Adapter update                |
| Manifest rejected              | Schema fields changed      | Install-time validation | Adapter update                |

### 19.3 Design Principles for Resilience

1. **Externalize volatile knowledge** — agent-specific formats live in adapter specs, not in core code
2. **Version everything** — adapters, agents, and plugins all have versions for compatibility checking
3. **Validate after materialization** — don't assume files work; verify they're discoverable
4. **Warn proactively** — if agent version exceeds adapter's tested range, say so
5. **Fail gracefully** — if a component can't be converted, skip with a clear warning rather than crashing

---

## 20. Works Cited & Verification Status

### Verified Sources

| #   | Source                                | URL                                                                                                                                                                        | Verified Content                                                                             |
| --- | ------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| 1   | Claude Code Plugins Reference         | [code.claude.com/docs/en/plugins-reference](https://code.claude.com/docs/en/plugins-reference)                                                                             | Plugin structure, hooks, events, SKILL.md format, `${CLAUDE_PLUGIN_ROOT}`, hooks.json schema |
| 2   | Claude Code Hooks & Subagents         | [code.claude.com/docs/en/hooks-and-subagents](https://code.claude.com/docs/en/hooks-and-subagents)                                                                         | All 31 hook events, I/O contracts, context objects, tool categories                          |
| 3   | Agent Plugins Spec (VS Code)          | [github.com/microsoft/vscode-copilot-chat#agent-plugins](https://github.com/microsoft/vscode-copilot-chat)                                                                 | Claude format detection via `.claude-plugin/plugin.json`                                     |
| 4   | Claude Code Plugin Structure SKILL.md | [github.com/anthropics/claude-code/.../plugin-structure/SKILL.md](https://github.com/anthropics/claude-code/blob/main/plugins/plugin-dev/skills/plugin-structure/SKILL.md) | Directory layout, manifest schema, all component types                                       |
| 5   | Antigravity Plugin Docs               | [antigravity.google/docs/ide/plugins](https://antigravity.google/docs/ide/plugins)                                                                                         | Plugin structure, manifest schema, CLI commands, directory layout                            |
| 6   | Antigravity Subagent Docs             | [antigravity.google/docs/subagents](https://antigravity.google/docs/subagents)                                                                                             | Subagent frontmatter schema, discovery locations, all fields                                 |
| 7   | Antigravity Hooks Docs                | [antigravity.google/docs/hooks](https://antigravity.google/docs/hooks)                                                                                                     | Hook schema, events, matcher format, I/O contract, step injection                            |
| 8   | Antigravity Workflows Docs            | [antigravity.google/docs/ide/workflows](https://antigravity.google/docs/ide/workflows)                                                                                     | Workflow format, discovery locations, 12K char limit                                         |
| 9   | Antigravity Permissions Docs          | [antigravity.google/docs/permissions](https://antigravity.google/docs/permissions)                                                                                         | Permission engine, tool names, hook integration                                              |
| 10  | MCP Specification                     | [modelcontextprotocol.io](https://modelcontextprotocol.io)                                                                                                                 | Spec version, stateless core, extensions ecosystem                                           |
| 11  | Agent Skills Standard (Vercel)        | [github.com/vercel-labs/skills](https://github.com/vercel-labs/skills)                                                                                                     | SKILL.md format, npx skills, skills.sh directory                                             |
| 12  | Agent Plugins Spec                    | [github.com/agentplugins/agent-plugins-spec](https://github.com/agentplugins/agent-plugins-spec)                                                                           | Vendor-neutral plugin packaging spec                                                         |

### Prior Research Documents

| #   | Document                                       | Status                                     |
| --- | ---------------------------------------------- | ------------------------------------------ |
| 1   | Investigation Results (agents, MCP, skills.sh) | Superseded by verified sources above       |
| 2   | Feasibility Report (agentpm architecture)      | Incorporated into this spec                |
| 3   | Conversion Document (Claude → Antigravity)     | Partially correct; corrected in Section 11 |

### Verification Status Legend

- **Verified from official docs** — confirmed by Anthropic or Google official documentation
- **Verified from specification** — confirmed by MCP or Agent Skills specification
- **From prior research** — from initial investigation, cross-referenced where possible
- **Inferred** — logically derived but not directly confirmed by a primary source

---

*This specification is a living document. Update adapter sections when agent formats change. Update the MCP section when the spec version advances. Update tool name mappings when agents rename or add tools.*
```