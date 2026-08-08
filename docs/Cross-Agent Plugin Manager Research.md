
# Cross-Agent Plugin Management: Comprehensive Research & Feasibility Analysis

> **Codename:** `agentpm`
> **Scope:** Feasibility, architecture, and ecosystem analysis of a unified cross-agent plugin manager for AI coding agents
> **Agents Covered:** Claude Code, OpenAI Codex CLI, Google Antigravity, OpenCode, Pi Coding Agent
> **Protocols & Standards:** Model Context Protocol (MCP), Agent Skills, Agent Plugins Specification

---

## Table of Contents

- [Cross-Agent Plugin Management: Comprehensive Research \& Feasibility Analysis](#cross-agent-plugin-management-comprehensive-research--feasibility-analysis)
  - [Table of Contents](#table-of-contents)
  - [1. Introduction \& Context](#1-introduction--context)
    - [Investigation Scope](#investigation-scope)
  - [2. AI Coding Agent Profiles](#2-ai-coding-agent-profiles)
    - [2.1 Claude Code](#21-claude-code)
    - [2.2 OpenAI Codex CLI](#22-openai-codex-cli)
    - [2.3 Google Antigravity](#23-google-antigravity)
    - [2.4 Gemini CLI (Legacy)](#24-gemini-cli-legacy)
    - [2.5 OpenCode](#25-opencode)
    - [2.6 Pi Coding Agent](#26-pi-coding-agent)
  - [3. Protocols, Standards \& Ecosystem Infrastructure](#3-protocols-standards--ecosystem-infrastructure)
    - [3.1 Model Context Protocol (MCP)](#31-model-context-protocol-mcp)
      - [Overview](#overview)
      - [Latest Stable Version](#latest-stable-version)
      - [Does the Spec Define Standard Installation/Enable/Disable for MCP Servers?](#does-the-spec-define-standard-installationenabledisable-for-mcp-servers)
      - [MCP Configuration Across Agents](#mcp-configuration-across-agents)
    - [3.2 Agent Skills Standard](#32-agent-skills-standard)
    - [3.3 Agent Plugins Specification](#33-agent-plugins-specification)
    - [3.4 skills.sh \& npx skills](#34-skillssh--npx-skills)
      - [skills.sh](#skillssh)
      - [npx skills](#npx-skills)
      - [Ecosystem Relationship](#ecosystem-relationship)
      - [Limitations](#limitations)
      - [Known Issues](#known-issues)
      - [Confirmed vs. Inferred](#confirmed-vs-inferred)
    - [3.5 Ecosystem Utilities](#35-ecosystem-utilities)
  - [4. Feasibility Analysis: agentpm](#4-feasibility-analysis-agentpm)
    - [4.1 Executive Summary](#41-executive-summary)
    - [4.2 Architectural Analysis of Target Agents](#42-architectural-analysis-of-target-agents)
      - [Comparative Overview](#comparative-overview)
    - [4.3 Existing Cross-Agent Infrastructure Evaluation](#43-existing-cross-agent-infrastructure-evaluation)
      - [skills.sh / npx skills](#skillssh--npx-skills)
      - [Agent Plugins Specification (agentplugins)](#agent-plugins-specification-agentplugins)
      - [Ecosystem Utilities](#ecosystem-utilities)
    - [4.4 Impedance Mismatches \& Abstraction Challenges](#44-impedance-mismatches--abstraction-challenges)
      - [4.4.1 Imperative vs. Declarative Runtime Paradigms](#441-imperative-vs-declarative-runtime-paradigms)
      - [4.4.2 File System Resolution and Cache Staging](#442-file-system-resolution-and-cache-staging)
      - [4.4.3 Lifecycle Event Models](#443-lifecycle-event-models)
      - [4.4.4 MCP Transport and Path Expansion](#444-mcp-transport-and-path-expansion)
    - [4.5 Proposed Architecture](#45-proposed-architecture)
      - [Canonical Package Format (CPF)](#canonical-package-format-cpf)
      - [Canonical Capabilities Mapping](#canonical-capabilities-mapping)
    - [4.6 Adapter Engine Mechanics per Target Agent](#46-adapter-engine-mechanics-per-target-agent)
      - [Claude Code Adapter](#claude-code-adapter)
      - [OpenAI Codex CLI Adapter](#openai-codex-cli-adapter)
      - [Google Antigravity Adapter](#google-antigravity-adapter)
      - [OpenCode Adapter](#opencode-adapter)
      - [Pi Coding Agent Adapter](#pi-coding-agent-adapter)
    - [4.7 Feasibility Roadmap](#47-feasibility-roadmap)
      - [Phase 1: Declarative Capabilities Synchronization](#phase-1-declarative-capabilities-synchronization)
      - [Phase 2: Hook Translation and Marketplace Integration](#phase-2-hook-translation-and-marketplace-integration)
      - [Phase 3: Runtime IPC Bridging for Imperative Code](#phase-3-runtime-ipc-bridging-for-imperative-code)
  - [5. Conclusions](#5-conclusions)
  - [6. Works Cited \& References](#6-works-cited--references)

---

## 1. Introduction & Context

The rapid proliferation of specialized AI coding agents—including Anthropic's Claude Code, OpenAI's Codex CLI, Google's Antigravity (which officially superseded Gemini CLI in June 2026), Anomaly's OpenCode, and Mario Zechner's Pi Coding Agent—has created severe fragmentation across software engineering workflows. While these agent platforms share the broad goal of automating software engineering tasks, each platform enforces a distinct extensibility paradigm, file directory layout, configuration schema, lifecycle hook model, and execution runtime.

Engineering teams seeking to distribute standardized toolsets, coding rules, custom workflows, and Model Context Protocol (MCP) integrations across multiple agents currently face significant operational friction. This report documents the full investigation—from raw agent profiles and protocol references through to the feasibility analysis and architectural design of a unified cross-agent plugin manager tentatively named **agentpm**.

### Investigation Scope

The research covers three layers:

1. **Agent Platform Profiles** — Documentation, source repositories, plugin/extension systems, and storage mechanisms for each target agent.
2. **Protocols & Standards** — MCP specification, Agent Skills standard, and the Agent Plugins Specification, along with their ecosystems.
3. **Feasibility & Architecture** — Technical barriers, abstraction challenges, and a proposed Canonical Package Format with adapter engine design for `agentpm`.

---

## 2. AI Coding Agent Profiles

### 2.1 Claude Code

| Field                       | Detail                                                                                 |
| --------------------------- | -------------------------------------------------------------------------------------- |
| **Full Name**               | Claude Code                                                                            |
| **Primary Documentation**   | [https://code.claude.com/docs](https://code.claude.com/docs)                           |
| **Source Repository**       | [https://github.com/anthropics/claude-code](https://github.com/anthropics/claude-code) |
| **Plugin/Extension System** | **Yes** — Plugin bundles with `/plugin` command                                        |

**Extension Paradigm:** Declarative Plugin Bundles

Claude Code structures extensibility around self-contained plugin directories with automatic component discovery. A plugin manifest located at `.claude-plugin/plugin.json` defines metadata, while component subdirectories—`skills/`, `commands/`, `agents/`, `hooks/`, and `.mcp.json`—must reside at the plugin root level rather than inside the `.claude-plugin/` folder.

**Storage & Precedence Paths:**

- Global: `~/.claude/plugins/`
- Workspace: `.claude/skills/`

**Key Mechanics:**

- Plugins can be installed globally or pointed to locally using the `--plugin-dir` flag.
- Curated or community marketplaces are added via `/plugin marketplace add`.
- Path portability across plugin updates is supported through the `${CLAUDE_PLUGIN_ROOT}` variable.
- Hooks defined in `hooks/hooks.json` support multiple trigger formats: shell commands, HTTP POST webhooks, MCP tool invocations, prompt evaluations, and agentic verifiers.
- Claude Code supports symlinked marketplace paths.

**Plugin SDK Docs:** [https://code.claude.com/docs/fr/agent-sdk/plugins](https://code.claude.com/docs/fr/agent-sdk/plugins)

---

### 2.2 OpenAI Codex CLI

| Field                       | Detail                                                                                             |
| --------------------------- | -------------------------------------------------------------------------------------------------- |
| **Full Name**               | OpenAI Codex CLI                                                                                   |
| **Primary Documentation**   | [https://mintlify.wiki/openai/codex/introduction](https://mintlify.wiki/openai/codex/introduction) |
| **Source Repository**       | [https://github.com/openai/codex](https://github.com/openai/codex)                                 |
| **Plugin/Extension System** | **Yes** — Agent Plugins (v0.147.0+)                                                                |

**Extension Paradigm:** Agent Plugins & Marketplaces

Codex CLI manages extensibility through Agent Plugins, backed by local, personal, or remote marketplaces. Plugins contain a required manifest at `.codex-plugin/plugin.json`.

**Storage & Precedence Paths:**

- Cache: `~/.codex/plugins/cache/$MARKETSPACE_NAME/$PLUGIN_NAME/$VERSION/`
- Discovery: `~/.agents/plugins/marketplace.json` (personal) or `./.agents/plugins/marketplace.json` (workspace)

**Key Mechanics:**

- When a plugin is installed, Codex copies its files into a structured cache directory.
- External command execution is supported via JSON hook definitions.
- Codex CLI also supports a Chrome extension, installable via the Plugins menu.

**Known Architectural Issues:**

- **Symlink dropping:** The local installation materializer (`store.rs`) historically handled only explicit directory and file types, dropping symlinks during installation. This broke marketplaces using symlinked skill libraries. ([Issue #18863](https://github.com/openai/codex/issues/18863))
- **Path flattening:** If a marketplace name matches a plugin name identically, path-flattening bugs can occur when reading skills. ([Issue #35648](https://github.com/openai/codex/issues/35648))
- **MCP relative path resolution:** For MCP servers declared in `.mcp.json`, relative working directories (`cwd`) resolve relative to the active launch folder rather than the cached plugin root. ([Issue #22842](https://github.com/openai/codex/issues/22842))

---

### 2.3 Google Antigravity

| Field                       | Detail                                                                                             |
| --------------------------- | -------------------------------------------------------------------------------------------------- |
| **Full Name**               | Google Antigravity                                                                                 |
| **Primary Documentation**   | [https://antigravity.google/docs/getting-started](https://antigravity.google/docs/getting-started) |
| **Overview Docs**           | [https://docs.flutter.dev/ai/antigravity](https://docs.flutter.dev/ai/antigravity)                 |
| **CLI Docs**                | [https://docs.flutter.dev/ai/antigravity-cli](https://docs.flutter.dev/ai/antigravity-cli)         |
| **Source Repository**       | **None** — Proprietary Google product                                                              |
| **Plugin/Extension System** | **Yes** — Skills, MCP Servers, rules files                                                         |

> **Note:** Antigravity CLI replaced Gemini CLI as of June 2026.

**Extension Paradigm:** Namespaced Bundles & Sparse Configs

Antigravity is an official agent-first development platform from Google, with a built-in plugin/extension system via MCP servers, `AGENTS.md` workspace rules, and third-party plugins. It organizes extensions into namespaced plugin bundles staged under `~/.gemini/antigravity-cli/plugins/<namespace>/<plugin>/`.

**Storage & Precedence Paths:**

- Global: `~/.gemini/config/plugins/` and `~/.gemini/config/skills/`
- Workspace: `.agents/skills/`, `.agents/rules/`, `.agents/plugins/`
- Plugin staging: `~/.gemini/antigravity-cli/plugins/<namespace>/<plugin>/`

**Key Mechanics:**

- A bundle requires a `plugin.json` marker file at its root, accompanied by optional subdirectories for `skills/`, `rules/`, `hooks.json`, and `mcp_config.json`.
- Real-directory scanning across global and workspace trees.
- Rules framework processes standalone Markdown files in `rules/`, assigning execution triggers: "Always On", "Model Decision", "Manual @mention", or file-matching "Glob" patterns.
- Script hooks via `hooks.json`.
- Includes a Terminal Sandbox that restricts local process execution via system sandbox boundaries (nsjail on Linux, sandbox-exec on macOS, AppContainer on Windows).
- Supports importing Gemini CLI plugins via `agy plugin import gemini`.

**Notable References:**

- Official blog: [Gemini 3 Flash in Google Antigravity](https://antigravity.google/blog/gemini-3-flash-in-google-antigravity)
- Google I/O 2026 keynote: [All the news from the Google I/O 2026 developer keynote](https://developers.googleblog.com/all-the-news-from-the-google-io-2026-developer-keynote) — announces Antigravity 2.0
- Third-party plugin example: [antigravity-plugin](https://github.com/sakibsadmanshajib/antigravity-plugin)
- Plugin marketplace reference: [megapowers](https://github.com/lawzava/megapowers)

---

### 2.4 Gemini CLI (Legacy)

| Field                       | Detail                                                                                                                               |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| **Full Name**               | Gemini CLI                                                                                                                           |
| **Primary Documentation**   | [https://geminicli.com/docs/](https://geminicli.com/docs/)                                                                           |
| **Google Developers Page**  | [https://developers.google.com/gemini-code-assist/docs/gemini-cli](https://developers.google.com/gemini-code-assist/docs/gemini-cli) |
| **Source Repository**       | [https://github.com/google-gemini/gemini-cli](https://github.com/google-gemini/gemini-cli)                                           |
| **Plugin/Extension System** | **Yes** — Extensions (now legacy)                                                                                                    |

**Extension Paradigm:** Legacy Extensions (Superseded by Antigravity)

Gemini CLI served as Google's early open-source terminal agent harness. Extensions packaged commands, prompts, themes, sub-agents, and MCP configurations using a `gemini.json` manifest.

**Key Mechanics:**

- Extensions can be installed via GitHub repo URLs or local paths.
- Extensions package prompts, MCP servers, custom commands, themes, hooks, sub-agents, and agent skills.
- Official extensions docs: [https://geminicli.com/docs/extensions/](https://geminicli.com/docs/extensions/)
- Primitive prompt/command hooks.
- With the launch of Antigravity in June 2026, Gemini CLI was deprecated.
- Antigravity provides backward-compatibility migration tools to convert legacy `gemini.json` configurations and `.gemini/` directories into Antigravity's unified plugin layout.

---

### 2.5 OpenCode

| Field                       | Detail                                                                         |
| --------------------------- | ------------------------------------------------------------------------------ |
| **Full Name**               | OpenCode                                                                       |
| **Primary Documentation**   | [https://open-code.ai/en/docs](https://open-code.ai/en/docs)                   |
| **Alternate Docs**          | [https://opencode.ai/docs](https://opencode.ai/docs)                           |
| **Source Repository**       | [https://github.com/anomalyco/opencode](https://github.com/anomalyco/opencode) |
| **Plugin/Extension System** | **Yes** — In-process JS/TS Plugins + Agent Skills                              |

**Extension Paradigm:** In-Process JS/TS Modules + Agent Skills

OpenCode employs an in-process extensibility model using the **Bun** JavaScript/TypeScript runtime. Rather than shelling out to external processes, OpenCode loads plugins directly into its process context via the `@opencode-ai/plugin` SDK.

**Storage & Precedence Paths:**

- Global: `~/.config/opencode/plugins/`
- Workspace: `.opencode/plugins/`

**Key Mechanics:**

- Plugins are configured in `opencode.json` under the `plugins` array, or automatically discovered as direct JavaScript/TypeScript files inside plugin directories.
- Plugins can intercept core lifecycle events (`session.created`, `tool.execute.before`, `tui.command.execute`), modify prompt context, register custom tools using Zod schemas, and alter model parameters on the fly.
- Rich async runtime lifecycle events (e.g., `session.compacted`, `tool.execute.before`).
- For static capabilities, OpenCode natively implements the Agent Skills standard, scanning six distinct directory locations across project and global levels.
- Plugin docs: [https://opencode.ai/v2/docs/build/plugins](https://opencode.ai/v2/docs/build/plugins)

---

### 2.6 Pi Coding Agent

| Field                       | Detail                                                                                |
| --------------------------- | ------------------------------------------------------------------------------------- |
| **Full Name**               | Pi Coding Agent (`@mariozechner/pi-coding-agent`)                                     |
| **Primary Documentation**   | [https://pi.dev](https://pi.dev)                                                      |
| **Source Repository**       | [https://github.com/badlogic/pi-mono](https://github.com/badlogic/pi-mono) (monorepo) |
| **npm Package**             | `@mariozechner/pi-coding-agent`                                                       |
| **Plugin/Extension System** | **Yes** — Pi Packages (TS Extensions & Skills)                                        |

> **Note:** No project named "PyCoding Agent" exists. The confirmed name is "Pi Coding Agent."

**Extension Paradigm:** Pi Packages (TypeScript Extensions & Skills)

Pi Coding Agent is a terminal coding harness built for customizable workflows. Extensibility is centered around "Pi Packages"—standard npm packages or repositories containing a `package.json` file with a dedicated `"pi"` field.

**Storage & Precedence Paths:**

- Global: `~/.pi/agent/extensions/`
- Workspace: `.pi/extensions/`

**Key Mechanics:**

- Pi dynamically imports TypeScript entry points into Node.js, passing an `ExtensionAPI` instance.
- Extensions can register slash commands, listen to session events (`pi.on("session_start")`), or manage custom user prompts.
- Event listeners via `ExtensionAPI` (e.g., `session_start`, custom slash commands).
- Pi enforces explicit workspace trust boundaries (`~/.pi/agent/trust.json`) before executing project-level extensions, safeguarding against untrusted codebase scripts.
- Also has a Python SDK (`pi-coding-agent-python-sdk` / `pi-py-sdk`) for integration and extension development.

**Related Repositories:**

- [Termux port](https://github.com/termux/pi-coding-agent) — Android terminal adaptation
- [Docker container](https://github.com/pi-coding-agent/docker) — Containerised version

**Notable References:**

- Extension example: [commands.ts](https://github.com/badlogic/pi-mono/blob/main/packages/coding-agent/examples/extensions/commands.ts)
- Settings docs: [settings.md](https://github.com/badlogic/pi-mono/blob/main/packages/coding-agent/docs/settings.md)
- RPC docs: [rpc.md](https://github.com/badlogic/pi-mono/blob/main/packages/coding-agent/docs/rpc.md)
- RFC: [Agent Event Bus Pi Extension for Cross-Session Coordination](https://github.com/badlogic/pi-mono/issues/2714)

---

## 3. Protocols, Standards & Ecosystem Infrastructure

### 3.1 Model Context Protocol (MCP)

**Official Specification Website:** [https://modelcontextprotocol.io](https://modelcontextprotocol.io)
**Latest Spec:** [https://modelcontextprotocol.io/specification/latest](https://modelcontextprotocol.io/specification/latest)
**GitHub Repository:** [https://github.com/modelcontextprotocol/specification](https://github.com/modelcontextprotocol/specification)

#### Overview

The Model Context Protocol (MCP) is an open standard protocol that connects AI agents (such as Claude, Cursor, Copilot, etc.) to external tools and data sources. In the context of AI coding agents, MCP acts as a universal "translation layer" between the agent and external systems—the agent can read codebases, query databases, call APIs, execute build tasks, and more through MCP.

**Key Distinction:** ACP (Agent Client Protocol) connects the code editor to the AI coding agent, while MCP connects that agent to tools and data. They are complementary layers in a hierarchy.

#### Latest Stable Version

| Field            | Detail                                                                       |
| ---------------- | ---------------------------------------------------------------------------- |
| **Version**      | `2026-07-28`                                                                 |
| **Release Date** | July 28, 2026                                                                |
| **Notes**        | Fifth spec version since MCP's November 2024 debut; largest revision to date |

The core change is a shift from a stateful connection model to a **stateless core**, alongside the introduction of an independent extensions ecosystem.

> Older versions (e.g., `2025-11-25`, `2025-06-18`) remain accessible via `https://modelcontextprotocol.io/specification/YYYY-MM-DD`.

#### Does the Spec Define Standard Installation/Enable/Disable for MCP Servers?

**No.** The core MCP specification currently does **not** define a standardized installation, enabling, or disabling process.

- Installing MCP servers is inconsistent across clients; users manually handle JSON configurations, and each client maintains its own registry.
- Ongoing community discussions and proposals exist (e.g., standardizing installation via `/install?server=...` actions and registry parameters), but this has **not yet become part of the official specification**.
- Currently, installation and enable/disable toggling are implemented by individual clients (e.g., using a `"disabled"` field in `.mcp.json`) or managed through community tools like `mcp-switch`.

**Relevant Links:**

- Installation standardization discussion: [Issue #1557](https://github.com/modelcontextprotocol/modelcontextprotocol/issues/1557)
- Server registry `server.json` standard (community proposal): [https://github.com/modelcontextprotocol/registry/tree/main/docs/reference/server-json](https://github.com/modelcontextprotocol/registry/tree/main/docs/reference/server-json)

#### MCP Configuration Across Agents

| Agent              | Config File Location  | Notes                                                        |
| ------------------ | --------------------- | ------------------------------------------------------------ |
| Claude Code        | `.mcp.json`           | At plugin root                                               |
| OpenAI Codex CLI   | `.mcp.json`           | Relative `cwd` resolves to launch dir, not plugin cache root |
| Google Antigravity | `mcp_config.json`     | Global: `~/.gemini/config/`; workspace: `.agents/`           |
| OpenCode           | `opencode.json`       | `mcp` section within main config                             |
| Pi Coding Agent    | CLI execution wrapper | Configured via extension API                                 |

---

### 3.2 Agent Skills Standard

The **Agent Skills Standard** is an open, cross-tool **task knowledge standard**. It packages task-specific instructions, scripts, and resources into portable `SKILL.md` folders for discovery and reuse across different AI coding tools.

A `SKILL.md` file is a Markdown document containing structured instructions that an AI coding agent can follow to perform a specific task. Skills are distributed as directories containing a `SKILL.md` file alongside any supporting resources.

**Compatibility:** The standard is supported by **18+** AI coding agents, including Claude Code, GitHub Copilot, Cursor, Cline, and many others.

---

### 3.3 Agent Plugins Specification

**Repository:** [https://github.com/agentplugins/agent-plugins-spec](https://github.com/agentplugins/agent-plugins-spec)
**Organization:** [https://github.com/agentplugins](https://github.com/agentplugins)

The `agentplugins` project defines a vendor-neutral specification (v1.0.0) for packaging reusable agent components into distributable archives.

A compliant plugin consists of:

- A directory containing a `plugin.json` manifest conforming to the Agent Plugins JSON Schema
- A `skills/` directory
- Optional MCP server definitions

**Design Philosophy:** The specification focuses on static, declarative components (Skills + MCP) to ensure broad compatibility. It intentionally leaves runtime event execution, dynamic UI surfaces, and agent-specific hooks out of the core specification to avoid vendor lock-in.

---

### 3.4 skills.sh & npx skills

Both are fundamental components of the open Agent Skills ecosystem, developed by **Vercel Labs**.

#### skills.sh

| Field                 | Detail                                                                         |
| --------------------- | ------------------------------------------------------------------------------ |
| **Website**           | [https://skills.sh](https://skills.sh)                                         |
| **Source Repository** | [https://github.com/vercel-labs/skills](https://github.com/vercel-labs/skills) |
| **Description**       | Open directory and leaderboard for discovering and ranking AI Agent skills     |

- Automatically indexes skills distributed via `npx skills`
- Ranks skills by anonymous install data
- Displays each skill's source repo, install count, compatible agents, and security audit status
- Serves as the **catalog/presentation layer** of the Agent Skills standard (like an "app store")

#### npx skills

| Field                 | Detail                                                                         |
| --------------------- | ------------------------------------------------------------------------------ |
| **Source Repository** | [https://github.com/vercel-labs/skills](https://github.com/vercel-labs/skills) |
| **npm Package**       | `skills` (run via `npx skills`)                                                |
| **Description**       | CLI tool for installing and managing Agent skills                              |

- The official **package manager** for the open Agent Skills ecosystem
- `npx skills add <repo>` fetches a remote repository containing `SKILL.md` instruction files and deploys them to target agent skill folders (e.g., `.agents/skills/`, `~/.agents/skills/`)
- Supports installing skills into **18+** different AI Agents
- Serves as the **installation and management layer** of the standard (like a "package manager")

#### Ecosystem Relationship

Together, `skills.sh` and `npx skills` form a complete skill distribution and consumption system:

- `skills.sh` → **discovery and showcase** layer
- `npx skills` → **installation and management** layer
- Both are tightly integrated and **not** limited to any single coding agent

#### Limitations

`skills.sh` and `npx skills` successfully establish cross-agent portability for prompt-based workflows but are fundamentally limited to **static Markdown skills**. They cannot install or manage complex plugins requiring:

- Executable binaries
- Custom event hooks
- Environment settings
- Dynamic MCP configurations
- TypeScript extension code

#### Known Issues

- `npx skills add` installs to `~/.agents/skills/` but does not always create symlinks in `~/.claude/skills/` ([Issue #744](https://github.com/vercel-labs/skills/issues/744))

#### Confirmed vs. Inferred

**Confirmed:**

- Both projects are part of the "Agent Skills" open ecosystem
- The CLI supports **18+** agents (officially listed in README: Claude Code, GitHub Copilot, Cursor, Cline, etc.)
- `skills.sh` automatically indexes public skills and ranks them by usage
- `npx skills` installs skills from GitHub repos into local agent environments

**Inferred:**

- That the ecosystem supports exactly 40+ or 68 agents (community numbers vary; the official confirmed number is 18+)
- That the `SKILL.md` format is intended to become an industry-wide standard (implied by the open nature of the project, but not formally standardized by a governing body)

---

### 3.5 Ecosystem Utilities

| Tool             | Description                                                                                                                                                                           |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **qvr (Quiver)** | A Git-native package manager for agent skills that enforces lockfile-first dependency management and content-hash drift detection                                                     |
| **SkillDock**    | A desktop application that scans local agent directories, provides Git-aware diff previews, and manages skills and MCP configurations across Claude Code, Cursor, Codex, and Windsurf |
| **ccmanager**    | A multi-agent session manager that coordinates auto-approvals and container isolation across Claude Code, Codex, Gemini CLI, and OpenCode                                             |
| **megapowers**   | Plugin marketplace reference listing Google Antigravity as a supported platform ([GitHub](https://github.com/lawzava/megapowers))                                                     |

---

## 4. Feasibility Analysis: agentpm

### 4.1 Executive Summary

This research evaluates the technical feasibility of building a unified, cross-agent plugin manager (**agentpm**). Conceptually modeled after package managers like npm or `skills.sh`, agentpm aims to provide a canonical global store alongside an adapter layer to install, enable, configure, update, and remove plugins across heterogeneous coding agents.

**Primary Finding:** A universal cross-agent plugin manager is **partially feasible**, bounded by a strict structural distinction between declarative extension assets and imperative runtime extensions:

- **Declarative Capabilities (Fully Portable):** Assets defined by structured metadata, prompt instructions, and static schemas—specifically Agent Skills (`SKILL.md`), prompt templates, rules files, and stdio/SSE MCP server configurations—can be managed canonically and synthesized into target-specific configurations via an adapter layer.

- **Imperative Capabilities (Host-Bound):** Capabilities requiring dynamic, in-process execution of language-specific code—such as OpenCode's Bun/Node-based event plugins or Pi Agent's TypeScript Extension API—cannot be natively adapted across agent boundaries without embedding heavy polyfill runtimes or process-isolated IPC bridges.

Building an effective cross-agent manager requires **abandoning naive symlinking** in favor of an active **Synthesis and Adapter Layer Engine**. This engine must translate canonical manifests into native formats, rewrite path references, canonicalize configuration schemas, and handle platform-specific symlink and cache behaviors.

---

### 4.2 Architectural Analysis of Target Agents

#### Comparative Overview

| Agent                   | Extension Paradigm                      | Manifest Schema & Location                  | Storage & Precedence Paths                                                 | Symlink & Path Semantics                                            | Lifecycle Hooks & Execution                                                    |
| ----------------------- | --------------------------------------- | ------------------------------------------- | -------------------------------------------------------------------------- | ------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| **Claude Code**         | Declarative Plugin Bundles              | `.claude-plugin/plugin.json` at plugin root | Global: `~/.claude/plugins/` Workspace: `.claude/skills/`                  | Supports marketplace symlinks; resolves via `${CLAUDE_PLUGIN_ROOT}` | Out-of-process hooks (shell, HTTP, MCP tools, agent verifiers)                 |
| **OpenAI Codex CLI**    | Agent Plugins & Marketplaces            | `.codex-plugin/plugin.json`                 | Cache: `~/.codex/plugins/cache/$MARKETPLACE/$PLUGIN/$VER/`                 | Local materializer historically drops/skips source symlinks         | External command execution via JSON hook definitions                           |
| **Google Antigravity**  | Namespaced Bundles & Sparse Configs     | `plugin.json` at bundle root                | Global: `~/.gemini/config/` Workspace: `.agents/skills/`, `.agents/rules/` | Real-directory scanning across global and workspace trees           | Script hooks (`hooks.json`); rules engines (Glob, Always On, Model Decision)   |
| **Gemini CLI (Legacy)** | Legacy Extensions (Superseded)          | `gemini.json`                               | Integrated into Antigravity migration layer                                | Legacy fallback imports mapped to Antigravity structures            | Primitive prompt/command hooks                                                 |
| **OpenCode**            | In-Process JS/TS Modules + Agent Skills | `opencode.json` (plugins array)             | Global: `~/.config/opencode/plugins/` Workspace: `.opencode/plugins/`      | In-process ESM/CJS module loading via Bun                           | Rich async runtime lifecycle events (`session.created`, `tool.execute.before`) |
| **Pi Coding Agent**     | Pi Packages (TS Extensions & Skills)    | `package.json` with `"pi"` field            | Global: `~/.pi/agent/extensions/` Workspace: `.pi/extensions/`             | Direct Node module imports; explicit trust verification             | Event listeners via `ExtensionAPI` (`session_start`, custom slash commands)    |

---

### 4.3 Existing Cross-Agent Infrastructure Evaluation

Several tools and specifications have attempted to unify agent capabilities, offering valuable design insights for a multi-agent plugin manager.

#### skills.sh / npx skills

- Successfully establishes cross-agent portability for **prompt-based workflows** across 18+ coding agents
- Fundamentally limited to **static Markdown skills**
- Cannot install/manage: executable binaries, custom event hooks, environment settings, dynamic MCP configurations, or TypeScript extension code

#### Agent Plugins Specification (agentplugins)

- Defines a vendor-neutral spec (v1.0.0) for packaging reusable agent components
- Focuses on static, declarative components (Skills + MCP) for broad compatibility
- Intentionally excludes runtime event execution, dynamic UI surfaces, and agent-specific hooks

#### Ecosystem Utilities

- **qvr (Quiver):** Git-native lockfile-first dependency management with content-hash drift detection
- **SkillDock:** Desktop app with Git-aware diff previews for cross-agent skill management
- **ccmanager:** Multi-agent session coordination with container isolation

---

### 4.4 Impedance Mismatches & Abstraction Challenges

Building a single, cross-agent plugin manager requires addressing key architectural differences between agent platforms.

#### 4.4.1 Imperative vs. Declarative Runtime Paradigms

The main technical barrier to a unified plugin manager is the difference between declarative asset paradigms and imperative runtime execution models:

**Declarative Agents** (Claude Code, Codex CLI, Antigravity):
- Parse JSON manifests, expose defined tools, and execute external scripts via controlled child processes or I/O channels
- The host binary owns the event loop, state, and tool routing

**Imperative Agents** (OpenCode, Pi Coding Agent):
- Execute extension code directly inside their Node.js or Bun process
- Extensions register callbacks, manipulate ASTs, alter stream buffers, and access internal SDK abstractions

**Consequence:** A plugin written for OpenCode that intercepts an active HTTP stream using Bun APIs cannot run natively within Claude Code or Antigravity, as neither agent exposes an in-process JavaScript runtime.

#### 4.4.2 File System Resolution and Cache Staging

When agentpm installs a package globally to `~/.agentplugins/store/`, exposing that package to local agents requires navigating different file system behaviors:

| Agent                  | Behavior                                                                                                                                  |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| **Claude Code**        | Supports symlinked marketplace paths; uses `${CLAUDE_PLUGIN_ROOT}` for internal file resolution                                           |
| **OpenAI Codex CLI**   | Copies files directly into cache using a recursive file reader; historically skips symlinks, requiring absolute file copies or hard links |
| **Google Antigravity** | Scans local directories (`.agents/skills/`); uses `import_manifest.json` to track staged plugins                                          |

**Consequence:** agentpm cannot rely on a single file-linking strategy. It requires a **Target-Specific Materialization Engine** capable of choosing between atomic symlinking, hardlinking, or explicit directory copying based on the destination agent.

#### 4.4.3 Lifecycle Event Models

Event hooks vary widely across platforms:

| Agent                  | Event Model                                                                                                                                          |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Claude Code**        | Out-of-process execution using shell commands, POST webhooks, or sub-agent verifiers; context passed through environment variables and JSON payloads |
| **Google Antigravity** | `hooks.json` schema triggering shell scripts on specific events                                                                                      |
| **OpenCode**           | Programmatic async hooks (`session.compacted`, `tool.execute.before`) using TypeScript functions                                                     |
| **Pi Coding Agent**    | Event emitter (`pi.on("session_start")`) directly within its process boundary                                                                        |

**Consequence:** Abstracting these event models requires agentpm to translate event declarations into target-native formats: generating shell wrappers for declarative agents and synthesizing TypeScript entry points for imperative agents.

#### 4.4.4 MCP Transport and Path Expansion

While MCP is widely supported across modern coding agents, configuration schemas and path evaluation mechanics differ:

- Configuration file locations vary (`.mcp.json`, `mcp_config.json`, `opencode.json`)
- Relative `cwd` values inside Codex CLI's `.mcp.json` resolve relative to the active launch folder rather than the cached plugin root

**Consequence:** agentpm must automatically expand relative paths to absolute target paths during installation to ensure portable server execution.

---

### 4.5 Proposed Architecture

To support cross-agent compatibility, agentpm must function as an active **Synthesis and Translation Engine** rather than a passive symlink manager.

#### Canonical Package Format (CPF)

agentpm introduces the **Canonical Package Format (CPF)**, extending the `agent-plugins-spec` standard:





#### Canonical Capabilities Mapping

| CPF Capability | Claude Code Mapping                                         | Codex CLI Mapping                                     | Antigravity Mapping                                   | OpenCode Mapping                          | Pi Agent Mapping                        |
| -------------- | ----------------------------------------------------------- | ----------------------------------------------------- | ----------------------------------------------------- | ----------------------------------------- | --------------------------------------- |
| `skills/`      | Synthesizes to `.claude/skills/`                            | Copies to cache `skills/`                             | Syncs to `.agents/skills/`                            | Copies to `~/.config/opencode/skills/`    | Registers via `/skill:` prefixing       |
| `mcp/`         | Writes to `.claude-plugin/plugin.json`                      | Injects into `.mcp.json` with expanded absolute paths | Rewrites to `mcp_config.json`                         | Injects into `opencode.json`              | Configures via CLI execution wrapper    |
| `rules/`       | Appends to `CLAUDE.md`                                      | Injects into `AGENTS.md`                              | Deploys to `.agents/rules/` with frontmatter triggers | Appends to main `opencode.json` context   | Injects into `.pi/settings.json`        |
| `hooks/`       | Converts to `hooks/hooks.json` with `${CLAUDE_PLUGIN_ROOT}` | Generates external process execution triggers         | Converts to native `hooks.json` schema                | Synthesizes `@opencode-ai/plugin` wrapper | Generates `ExtensionAPI` event listener |
| `src/`         | Unsupported (Ignored)                                       | Unsupported (Ignored)                                 | Unsupported (Ignored)                                 | Loaded natively via `opencode.json`       | Loaded natively via Pi Package loader   |

---

### 4.6 Adapter Engine Mechanics per Target Agent

#### Claude Code Adapter

Processes CPF source files and outputs a compliant Claude Code plugin directory:

1. Creates a manifest at `.claude-plugin/plugin.json` containing metadata and mapped component paths.
2. Copies `skills/`, `commands/`, `agents/`, and `hooks/` directly to `~/.claude/plugins/canonical-$PLUGIN_NAME/`.
3. Transforms `mcp/mcp.json` into inline `.mcp.json` definitions, rewriting environment variable references.
4. Replaces local path references in shell hook scripts with the `${CLAUDE_PLUGIN_ROOT}` variable.

#### OpenAI Codex CLI Adapter

Handles installation while working around Codex's cache materialization behaviors:

1. Copies plugin assets directly into `~/.codex/plugins/cache/agentpm/$PLUGIN_NAME/$VERSION/`.
2. **Dereferences all internal symlinks** during staging to prevent the installer from skipping files.
3. Updates `~/.agents/plugins/marketplace.json` with plugin metadata, local file paths, and explicit category declarations.
4. Expands relative working directory (`cwd`) paths in `.mcp.json` into absolute filesystem paths.

#### Google Antigravity Adapter

Targets Google's unified plugin staging environment:

1. Stages plugin bundles under `~/.gemini/antigravity-cli/plugins/agentpm/$PLUGIN_NAME/`.
2. Generates a `plugin.json` marker file at the root.
3. Converts CPF rule files into Markdown documents under `rules/`, injecting frontmatter triggers (Always On, Glob, Model Decision).
4. Merges MCP server configurations into global `~/.gemini/config/mcp_config.json` or workspace `.agents/mcp_config.json` files.

#### OpenCode Adapter

Provisions both static skills and imperative Node/Bun plugins:

1. Syncs static `SKILL.md` folders to `~/.config/opencode/skills/`.
2. If the package contains imperative code (`src/`), installs dependencies using Bun and registers the entry point in `~/.config/opencode/opencode.json` under the `plugins` array.
3. Merges MCP server definitions into `opencode.json`.

#### Pi Coding Agent Adapter

Packages CPF components into a compliant Pi Package:

1. Synthesizes a `package.json` file containing a `"pi"` configuration block pointing to generated skills and extensions.
2. Places TypeScript extension entry points into `~/.pi/agent/extensions/`.
3. Registers skills under the `/skill:` namespace prefix for interactive command auto-completion.

---

### 4.7 Feasibility Roadmap

To maximize adoption and technical feasibility, development of agentpm should proceed in three planned phases:

#### Phase 1: Declarative Capabilities Synchronization

- Focus on cross-agent management for Agent Skills (`SKILL.md`), Rules files, and MCP server configurations.
- Implement the Canonical Package Format parser alongside filesystem sync engines for Claude Code, Codex CLI, Antigravity, OpenCode, and Pi.
- Add automated path expansion routines to rewrite relative paths into absolute paths, resolving MCP working directory issues across agents.

#### Phase 2: Hook Translation and Marketplace Integration

- Build adapter modules that compile declarative `hooks.json` specifications into target-native shell scripts.
- Integrate directly with target registration APIs, updating `~/.agents/plugins/marketplace.json` for Codex CLI and `opencode.json` for OpenCode.
- Build an atomic materialization engine that dereferences symlinks when installing to agents with strict directory copy requirements.

#### Phase 3: Runtime IPC Bridging for Imperative Code

- Design a lightweight background daemon (`agentpm-daemon`) that exposes an IPC/gRPC interface over standard I/O.
- Allow imperative TypeScript plugins (written for OpenCode or Pi) to register events with the daemon, enabling declarative agents (Claude Code, Antigravity) to query plugin state and trigger actions through standard MCP tools.

---

## 5. Conclusions

Building a unified cross-agent plugin manager (`agentpm`) across Claude Code, OpenAI Codex CLI, Google Antigravity, OpenCode, and Pi Coding Agent is **technically feasible for declarative assets**, which comprise the vast majority of developer extensions today.

By establishing a **Canonical Package Format** and an **adapter layer**, developers can author skills, coding rules, prompt workflows, and MCP configurations once, deploying them reliably across heterogeneous AI agents. While full cross-agent execution of in-process imperative code remains limited by differing runtime architectures, focusing on a declarative synthesis engine delivers immediate value to the multi-agent CLI ecosystem.

**Key takeaways:**

1. **Skills, rules, and MCP configurations are fully portable** across all five target agents via an adapter layer.
2. **Hooks can be translated** into target-native formats (shell scripts for declarative agents, TypeScript wrappers for imperative agents) with moderate engineering effort.
3. **In-process imperative code** (OpenCode plugins, Pi extensions) cannot be natively adapted without heavy IPC bridging infrastructure — this is a Phase 3 concern, not a blocker.
4. **File system materialization** must be agent-specific: symlinks for Claude Code, dereferenced copies for Codex CLI, directory scanning for Antigravity.
5. **MCP path expansion** is a critical adapter responsibility — relative paths must be resolved to absolute paths at install time to prevent runtime failures.

---

## 6. Works Cited & References

| #   | Reference                                              | URL                                                                                                                                                                                  |
| --- | ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | Create plugins — Claude Code Docs                      | [https://code.claude.com/docs/en/plugins](https://code.claude.com/docs/en/plugins)                                                                                                   |
| 2   | Plugins — OpenCode                                     | [https://opencode.ai/v2/docs/build/plugins](https://opencode.ai/v2/docs/build/plugins)                                                                                               |
| 3   | Codex plugin-json-spec.md                              | [GitHub](https://github.com/openai/codex/blob/main/codex-rs/skills/src/assets/samples/plugin-creator/references/plugin-json-spec.md)                                                 |
| 4   | Features — Google Antigravity Docs                     | [https://antigravity.google/docs/cli/features](https://antigravity.google/docs/cli/features)                                                                                         |
| 5   | Pi coding-agent README                                 | [GitHub](https://github.com/badlogic/pi-mono/blob/main/packages/coding-agent/README.md)                                                                                              |
| 6   | Plugins — Google Antigravity Docs                      | [https://antigravity.google/docs/plugins](https://antigravity.google/docs/plugins)                                                                                                   |
| 7   | MCP — Google Antigravity Docs                          | [https://antigravity.google/docs/mcp](https://antigravity.google/docs/mcp)                                                                                                           |
| 8   | vercel-labs/skills: The open agent skills tool         | [GitHub](https://github.com/vercel-labs/skills)                                                                                                                                      |
| 9   | Plugins reference — Claude Code Docs                   | [https://code.claude.com/docs/en/plugins-reference](https://code.claude.com/docs/en/plugins-reference)                                                                               |
| 10  | agentplugins/agent-plugins-spec                        | [GitHub](https://github.com/agentplugins/agent-plugins-spec)                                                                                                                         |
| 11  | 10 OpenCode Skills Worth Installing in 2026            | [Firecrawl](https://www.firecrawl.dev/blog/best-opencode-skills)                                                                                                                     |
| 12  | Pi extension commands.ts example                       | [GitHub](https://github.com/badlogic/pi-mono/blob/main/packages/coding-agent/examples/extensions/commands.ts)                                                                        |
| 13  | Plugin install: support symlinks (Codex #24770)        | [GitHub](https://github.com/openai/codex/issues/24770)                                                                                                                               |
| 14  | Pi settings.md                                         | [GitHub](https://github.com/badlogic/pi-mono/blob/main/packages/coding-agent/docs/settings.md)                                                                                       |
| 15  | Claude Code plugin-structure SKILL.md                  | [GitHub](https://github.com/anthropics/claude-code/blob/main/plugins/plugin-dev/skills/plugin-structure/SKILL.md)                                                                    |
| 16  | codex-plugin-cc review.md                              | [GitHub](https://github.com/openai/codex-plugin-cc/blob/main/plugins/codex/commands/review.md)                                                                                       |
| 17  | Codex plugin-creator SKILL.md                          | [GitHub](https://github.com/openai/codex/blob/main/codex-rs/skills/src/assets/samples/plugin-creator/SKILL.md)                                                                       |
| 18  | Codex flattens plugin skill path (Issue #35648)        | [GitHub](https://github.com/openai/codex/issues/35648)                                                                                                                               |
| 19  | Plugin cache drops symlinks (Codex #18863)             | [GitHub](https://github.com/openai/codex/issues/18863)                                                                                                                               |
| 20  | Plugin-root relative paths in .mcp.json (Codex #22842) | [GitHub](https://github.com/openai/codex/issues/22842)                                                                                                                               |
| 21  | Overview — Google Antigravity Docs                     | [https://antigravity.google/docs/agent](https://antigravity.google/docs/agent)                                                                                                       |
| 22  | Skills — Google Antigravity Docs                       | [https://antigravity.google/docs/skills](https://antigravity.google/docs/skills)                                                                                                     |
| 23  | Rules — Google Antigravity Docs                        | [https://antigravity.google/docs/rules-workflows](https://antigravity.google/docs/rules-workflows)                                                                                   |
| 24  | Gemini CLI extensions/releasing.md                     | [GitHub](https://github.com/google-gemini/gemini-cli/blob/main/docs/extensions/releasing.md)                                                                                         |
| 25  | RFC: Agent Event Bus Pi Extension (Issue #2714)        | [GitHub](https://github.com/badlogic/pi-mono/issues/2714)                                                                                                                            |
| 26  | Pi RPC docs                                            | [GitHub](https://github.com/badlogic/pi-mono/blob/main/packages/coding-agent/docs/rpc.md)                                                                                            |
| 27  | skills/find-skills SKILL.md                            | [GitHub](https://github.com/vercel-labs/skills/blob/main/skills/find-skills/SKILL.md)                                                                                                |
| 28  | npx skills add symlink issue (Issue #744)              | [GitHub](https://github.com/vercel-labs/skills/issues/744)                                                                                                                           |
| 29  | Agent Plugins organization                             | [GitHub](https://github.com/agentplugins)                                                                                                                                            |
| 30  | agent-plugins-spec README                              | [GitHub](https://github.com/agentplugins/agent-plugins-spec/blob/main/README.md)                                                                                                     |
| 31  | skills-manager GitHub Topics                           | [GitHub](https://github.com/topics/skills-manager?o=desc&s=updated)                                                                                                                  |
| 32  | skill-manager GitHub Topics                            | [GitHub](https://github.com/topics/skill-manager)                                                                                                                                    |
| 33  | rohitg00/awesome-claude-code-toolkit                   | [GitHub](https://github.com/rohitg00/awesome-claude-code-toolkit)                                                                                                                    |
| 34  | OpenCode MCP config feature request (Issue #10737)     | [GitHub](https://github.com/anomalyco/opencode/issues/10737)                                                                                                                         |
| 35  | Explore the .claude directory — Claude Code Docs       | [https://code.claude.com/docs/en/claude-directory](https://code.claude.com/docs/en/claude-directory)                                                                                 |
| 36  | Claude Code mcp-integration SKILL.md                   | [GitHub](https://github.com/anthropics/claude-code/blob/main/plugins/plugin-dev/skills/mcp-integration/SKILL.md)                                                                     |
| 37  | MCP Official Specification                             | [https://modelcontextprotocol.io](https://modelcontextprotocol.io)                                                                                                                   |
| 38  | MCP Latest Spec                                        | [https://modelcontextprotocol.io/specification/latest](https://modelcontextprotocol.io/specification/latest)                                                                         |
| 39  | MCP Specification GitHub                               | [https://github.com/modelcontextprotocol/specification](https://github.com/modelcontextprotocol/specification)                                                                       |
| 40  | MCP Installation Standardization (Issue #1557)         | [https://github.com/modelcontextprotocol/modelcontextprotocol/issues/1557](https://github.com/modelcontextprotocol/modelcontextprotocol/issues/1557)                                 |
| 41  | MCP Server Registry server.json                        | [GitHub](https://github.com/modelcontextprotocol/registry/tree/main/docs/reference/server-json)                                                                                      |
| 42  | Gemini 3 Flash in Google Antigravity                   | [https://antigravity.google/blog/gemini-3-flash-in-google-antigravity](https://antigravity.google/blog/gemini-3-flash-in-google-antigravity)                                         |
| 43  | Flutter Antigravity overview                           | [https://docs.flutter.dev/ai/antigravity](https://docs.flutter.dev/ai/antigravity)                                                                                                   |
| 44  | Antigravity CLI docs                                   | [https://docs.flutter.dev/ai/antigravity-cli](https://docs.flutter.dev/ai/antigravity-cli)                                                                                           |
| 45  | Google I/O 2026 keynote                                | [https://developers.googleblog.com/all-the-news-from-the-google-io-2026-developer-keynote](https://developers.googleblog.com/all-the-news-from-the-google-io-2026-developer-keynote) |
| 46  | antigravity-plugin (third-party)                       | [GitHub](https://github.com/sakibsadmanshajib/antigravity-plugin)                                                                                                                    |
| 47  | megapowers                                             | [GitHub](https://github.com/lawzava/megapowers)                                                                                                                                      |
| 48  | Claude Code primary docs                               | [https://code.claude.com/docs](https://code.claude.com/docs)                                                                                                                         |
| 49  | Claude Code source                                     | [https://github.com/anthropics/claude-code](https://github.com/anthropics/claude-code)                                                                                               |
| 50  | Claude Code plugin SDK docs                            | [https://code.claude.com/docs/fr/agent-sdk/plugins](https://code.claude.com/docs/fr/agent-sdk/plugins)                                                                               |
| 51  | OpenAI Codex CLI docs                                  | [https://mintlify.wiki/openai/codex/introduction](https://mintlify.wiki/openai/codex/introduction)                                                                                   |
| 52  | OpenAI Codex CLI source                                | [https://github.com/openai/codex](https://github.com/openai/codex)                                                                                                                   |
| 53  | Gemini CLI docs                                        | [https://geminicli.com/docs/](https://geminicli.com/docs/)                                                                                                                           |
| 54  | Gemini CLI source                                      | [https://github.com/google-gemini/gemini-cli](https://github.com/google-gemini/gemini-cli)                                                                                           |
| 55  | OpenCode docs                                          | [https://open-code.ai/en/docs](https://open-code.ai/en/docs)                                                                                                                         |
| 56  | OpenCode source                                        | [https://github.com/anomalyco/opencode](https://github.com/anomalyco/opencode)                                                                                                       |
| 57  | Pi Coding Agent site                                   | [https://pi.dev](https://pi.dev)                                                                                                                                                     |
| 58  | Pi Coding Agent monorepo                               | [https://github.com/badlogic/pi-mono](https://github.com/badlogic/pi-mono)                                                                                                           |
| 59  | Pi Termux port                                         | [https://github.com/termux/pi-coding-agent](https://github.com/termux/pi-coding-agent)                                                                                               |
| 60  | Pi Docker container                                    | [https://github.com/pi-coding-agent/docker](https://github.com/pi-coding-agent/docker)                                                                                               |
| 61  | skills.sh website                                      | [https://skills.sh](https://skills.sh)                                                                                                                                               |