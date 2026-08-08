# plugins — Cross-Agent Agent Plugins Manager & Web Dashboard

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0%2B-blue.svg)](https://www.typescriptlang.org/)

**`plugins`** (formerly `agentpm`) is a cross-agent **Agent Plugins** manager, conversion engine, and interactive web dashboard — the reference implementation for the [Agent Plugins v1.0.0](https://agent-plugins.org) specification. It mirrors the [`skills` CLI](https://skills.sh) UX, but for portable Agent Plugins: discover, add, use, remove, list, find, update, init, inspect, doctor, and convert composite packages (skills, MCP servers, rules, hooks, agents) across coding agents including Google Antigravity, Claude Code, OpenAI Codex CLI, and OpenCode AI.

This repository is itself a conforming Agent Plugins v1 plugin (`plugin.json` + `skills/migrate-agent-plugin/`), dogfooding the portable format it manages.

---

## Features & Capabilities

- 🌐 **Interactive Web Dashboard**: Explore, inspect, convert, and manage plugins visually in a modern web UI.
- 🔍 **Deep 9-Component Parser & IR**: Parses skills, commands, agents, rules, context files, hooks, MCP servers, output styles, and workflows into a normalized Intermediate Representation (IR).
- 🔄 **Single Narrowing Seam Conversion**: Converts any client layout to/from the Portable Core (`PortableCoreIR`), targeting `agent-plugins`, `antigravity`, `claude-code`, `codex`, or `opencode`.
- 📦 **Workspace & Global Store**: Manages cached global store repositories (`~/.agentplugins/plugins/`) and workspace materializations (`.agents/plugins/`).
- 🩺 **Doctor Health Diagnostics**: Checks environment, target paths, and active plugins across all 4 client runtimes.
- 📊 **Provider Capability Matrix**: Compares feature support across agent runtimes.

---

## Installation & Web Server

```bash
# Global installation
npm install -g agentpm

# Or run CLI directly with npx
npx agentpm --help

# Launch the Web Dashboard & Local API Server
npm start
```

The `plugins` binary is the canonical entry point; `agentpm` is kept as a bin alias. When running `npm start` or `npm run dev`, the server starts on `http://localhost:3000` (or `PORT` environment variable).

---

## Command Reference

### `plugins add <package>`
Downloads a plugin package into the Global Store (`$AGENTPM_STORE`, default `~/.agentplugins/repos/`), converts it to the **portable v1 format** in `~/.agentplugins/plugins/`, and enables it for your workspace.

```bash
# Install a standard GitHub repository
plugins add octocat/Hello-World

# Install a specific branch, tag, or commit SHA
plugins add octocat/Hello-World#v1.2.0

# Install a subfolder plugin from a monorepo
plugins add https://github.com/anthropics/knowledge-work-plugins/tree/main/pdf-viewer

# Install into the store without enabling
plugins add octocat/Hello-World --no-enable

# Override the conversion target (portable v1 by default)
plugins add octocat/Hello-World --target antigravity
```

### `plugins inspect <source>`
Parses a plugin directory or repository and prints a summary of its 9 component types along with conversion warnings.

```bash
plugins inspect ./resource/codex/imagegen
plugins inspect ./skills/migrate-agent-plugin --json
```

### `plugins convert <plugin>`
Converts a plugin directory through the unified seam (parse → portable core → emit, ADR 0013). Bare `convert` emits the portable v1 core; native targets via `--target`.

```bash
plugins convert ./my-claude-plugin                 # portable v1 core (default)
plugins convert ./my-claude-plugin --target opencode
plugins convert ./my-claude-plugin --target antigravity
plugins convert ./my-claude-plugin --target claude-code
plugins convert ./my-claude-plugin --target codex
plugins convert ./my-claude-plugin --out ./dist-plugin
```

Native targets: `opencode`, `antigravity`, `claude-code`, `codex`. Each emits its client's own plugin layout from the portable core.

### `plugins doctor`
Runs health checks and reports active plugin materializations across all supported client adapters.

```bash
plugins doctor
```

### `plugins use <package>`
Generate a prompt for using a plugin without installing it. Accepts a GitHub package or a local directory.

```bash
plugins use octocat/Hello-World
plugins use vercel-labs/agent-skills@pdf-viewer   # a single skill within a plugin
plugins use ./my-plugin
```

### `plugins remove [plugins...]`
Dematerialize active symlinks and purge packages from the Global Store.

```bash
plugins remove pdf-viewer
plugins remove pdf-viewer --global
```

### `plugins list`
Lists materialized workspace plugins or the global store inventory.

```bash
plugins list
plugins list --global
plugins list --json
```

### `plugins find [query]`
Searches GitHub for plugin packages (repositories tagged `agent-plugins`).

```bash
plugins find
plugins find skills
plugins find skills --owner vercel
```

### `plugins update [plugins...]`
Re-downloads installed plugins to their latest versions and re-converts them.

```bash
plugins update            # update all installed plugins
plugins update pdf-viewer
```

### `plugins init [name]`
Scaffolds a new portable v1 plugin (`plugin.json` + `skills/<name>/SKILL.md`).

```bash
plugins init pdf-viewer
```

### `plugins enable|disable|info`
Manage materialization for a target agent and inspect plugin capabilities.

```bash
plugins enable pdf-viewer --target antigravity
plugins enable pdf-viewer --copy
plugins disable pdf-viewer
plugins info pdf-viewer
```

### `plugins docs [provider]` / `plugins providers`
Displays provider capability documentation and inspects provider directories on disk.

```bash
plugins docs --matrix
plugins providers -p antigravity
```

---

## Portable v1 Output

Conversion and `add` default to the **Agent Plugins v1** target, which emits:

- `plugin.json` — closed-schema manifest (only `$schema`, `name`, `version`, `description`, `author`, `homepage`, `repository`, `license`, `keywords`, `extensions`).
- `mcp.json` — portable MCP configuration (`$schema` + `mcpServers` with explicit `stdio` / `streamable-http` / `sse` transports).
- `skills/<name>/SKILL.md` — skills are the portable unit.

Vendor-specific hooks, commands, agents, LSP, and marketplace metadata are preserved under `client-adapters/<client>/` as client compatibility layers.

---

## Architecture

- **Deep Parser (`src/parser/`)**: Discovers skills, commands, agents, rules, context files, hooks, MCP servers, output styles, and workflows.
- **Single Seam IR (`src/ir/to-portable-core.ts`)**: Narrows the 9-component IR down to `PortableCoreIR` (skills + MCP + client extensions).
- **Client Adapters (`src/adapters/`)**: Native emitters & lifecycle managers for `antigravity`, `claude-code`, `codex`, and `opencode`.
- **Materialization Engine (`src/core/materialization.ts`)**: Handles workspace symlink/copy materialization and precedence rules.
- **Acquirer (`src/core/acquirer.ts`)**: Secure Git package acquisition, lockfiles (`apm.lock.yaml`), and content hash verification.
- **Portable Writer (`src/core/portable-writer.ts`)**: Emits closed-schema `plugin.json` and portable `mcp.json`.
- **Global Store (`src/core/store.ts`)**: Manages the multi-tier store in `~/.agentplugins/`.
- **Web Server & Dashboard (`server.ts`)**: Express-based REST API and responsive single-page Web Dashboard.

---

## Development & Testing

```bash
npm install
npm run build     # Compiles TypeScript
npm test          # Runs node:test suite (55 tests)
```

Validate `plugin.json` against the canonical schema:

```bash
npx ajv-cli validate --spec=draft2020 \
  -s schemas/1.0.0/plugin.schema.json \
  -d plugin.json
```

---

## License

MIT License © 2026 Rayhan Islam Shuvro (`shuvrobhai`)

