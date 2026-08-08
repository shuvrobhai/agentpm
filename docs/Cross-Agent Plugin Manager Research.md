# Cross-Agent Plugin Manager Research & Architectural Source of Truth

**Project:** `agentpm` (Universal Agent Extension Manager)  
**Date:** 2026-08-08  
**Status:** Canonical Source of Truth Document  

---

## 1. Executive Summary & Core Purpose

`agentpm` is a universal, cross-agent plugin manager designed to discover, install, materialize, inspect, and safely dematerialize AI agent extensions across multiple host platforms (e.g., Google Antigravity, Anthropic Claude Code).

By maintaining declarative capabilities centrally in a versioned global store (`~/.agentplugins/plugins/`), `agentpm` enables zero-copy sharing and seamless per-workspace materialization using host-specific `AgentAdapter` implementations.

---

## 2. Industry Benchmark & CLI Extension Conventions

A survey of production CLI extension managers (`gh extension`, Claude Code `/plugin`, `brew`, `pip`) establishes the following standard lifecycle mechanics:

| Action Category | CLI Subcommand | Purpose in `agentpm` | Scope Options | Output / Scriptability |
| :--- | :--- | :--- | :--- | :--- |
| **Package Retrieval** | `install <repo>` | Shallow-clones repository into versioned global store | `-g`, `-f` | Progress logs |
| **Materialization** | `enable <plugin>` | Creates directory symlinks in target agent workspace | `-g`, `-t <agent>` | Materialization confirmation |
| **Dematerialization** | `disable <plugin>` | Unlinks workspace symlinks without deleting stored source | `-g`, `-t <agent>` | Dematerialization summary |
| **Inspection** | `list` | Lists active workspace symlinks or global store inventory | `-g` | Tree format + `--json` |
| **Manifest Audit** | `info <plugin>` | Inspects capabilities (`SKILL.md`, MCP tools, `plugin.json`) | None | Rich text + `--json` |
| **Purge / Cleanup** | `uninstall <plugin>` | Unlinks active symlinks and purges global store package | `-g` | Safe removal confirmation |

---

## 3. System Architecture & Core Components

```
+-------------------------------------------------------------------+
|                            agentpm CLI                            |
|       (install | enable | disable | list | info | uninstall)      |
+-------------------------------------------------------------------+
                                  |
                                  v
+-------------------------------------------------------------------+
|                    Global Store & Security Core                   |
|              (~/.agentplugins/plugins/ns/name/ver/)               |
|  - Path Traversal Validation (/^[a-zA-Z0-9_.-]+$/)                |
|  - Git Reference Sanitization                                     |
+-------------------------------------------------------------------+
                                  |
         +------------------------+------------------------+
         |                                                 |
         v                                                 v
+---------------------------------+               +---------------------------------+
|       AntigravityAdapter        |               |        ClaudeCodeAdapter        |
|  Local:  <cwd>/.agents/skills/  |               |  Local:  <cwd>/.claudecode/sk/  |
|  Global: ~/.gemini/config/sk/   |               |  Global: ~/.claude/skills/      |
+---------------------------------+               +---------------------------------+
```

### 3.1 Global Store Path Mechanics
- **Canonical Root:** `~/.agentplugins/plugins/` (resolved dynamically via `GlobalStore.getStorePath()`).
- **Hierarchy:** `<namespace>/<pluginName>/<version>/` to allow multiple versions and namespaces to coexist without collision.
- **Security Validation:** Every path component (`namespace`, `pluginName`, `version`, `ref`) is strictly validated against `/^[a-zA-Z0-9_.-]+$/` (`GlobalStore.validatePathComponent`).

### 3.2 Symlink Materialization Model
- **Zero-Copy Symlinking:** Adapters create direct directory symlinks pointing from agent-specific search paths to the global store folder.
- **Dematerialize-on-Uninstall Safety:** Running `agentpm uninstall <plugin>` automatically detects and removes active symlinks across registered target agent contexts before purging store directories, preventing broken dangling symlinks.

---

## 4. Command Suite Specification

### 4.1 `agentpm install <repo>`
- **Behavior:** Parses package identifier (`owner/repo`, full Git URL, or `#ref`), validates path components and git refs against flag injection (`-`), and shallow-clones the package into `~/.agentplugins/plugins/<owner>/<repo>/<version>/`.

### 4.2 `agentpm enable <plugin>`
- **Behavior:** Resolves plugin path via `GlobalStore.findPluginPath()`, detects active agent contexts (e.g., Antigravity, Claude Code), and creates symlinks in target directories (`.agents/skills/` or `.claudecode/skills/`).

### 4.3 `agentpm disable <plugin>`
- **Behavior:** Removes symlinks from active agent targets without modifying files in the global store.

### 4.4 `agentpm list [flags]`
- **Default (Workspace Scope):** Scans `.agents/skills/` and `.claudecode/skills/` in current working directory and lists active materialized plugins.
- **Global Flag (`-g` / `--global`):** Scans `~/.agentplugins/plugins/` across namespaces and lists installed packages.
- **JSON Flag (`--json`):** Outputs structured JSON data for CLI scripting and agent integration.

### 4.5 `agentpm info <plugin>`
- **Behavior:** Locates global store folder, reads declarative manifests (`plugin.json`, `SKILL.md` headers, MCP definitions), and reports capabilities alongside active materialization status.

### 4.6 `agentpm uninstall <plugin>` (alias `remove`)
- **Behavior:** Executes `disable` across all detected agent adapters to clear active symlinks, then purges the package directory from `~/.agentplugins/plugins/`.

---

## 5. Architectural Decision Record (ADR) Index

1. [ADR 0001: Install Behavior Defaults](file:///Users/rayhanislamshuvro/Developer/skills-and-plugins/agnent-plugins/docs/adr/0001-install-behavior-defaults.md)
2. [ADR 0002: Contextual Plugin Enabling](file:///Users/rayhanislamshuvro/Developer/skills-and-plugins/agnent-plugins/docs/adr/0002-contextual-plugin-enabling.md)
3. [ADR 0003: Versioned Plugin Store](file:///Users/rayhanislamshuvro/Developer/skills-and-plugins/agnent-plugins/docs/adr/0003-versioned-plugin-store.md)
4. [ADR 0004: MVP Adapter Materialization](file:///Users/rayhanislamshuvro/Developer/skills-and-plugins/agnent-plugins/docs/adr/0004-mvp-adapter-materialization.md)
5. [ADR 0005: Dual-Scope Plugin Listing & Inspection](file:///Users/rayhanislamshuvro/Developer/skills-and-plugins/agnent-plugins/docs/adr/0005-plugin-listing-and-inspection.md)
6. [ADR 0006: Info & Uninstall Command Lifecycle](file:///Users/rayhanislamshuvro/Developer/skills-and-plugins/agnent-plugins/docs/adr/0006-info-and-uninstall-commands.md)
7. [ADR 0007: GitHub Monorepo and Subfolder (/tree/) URL Parsing](file:///Users/rayhanislamshuvro/Developer/skills-and-plugins/agnent-plugins/docs/adr/0007-github-monorepo-and-tree-url-parsing.md)
