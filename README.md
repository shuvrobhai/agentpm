# plugins — Cross-Agent Agent Plugins Manager

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0%2B-blue.svg)](https://www.typescriptlang.org/)

**`plugins`** (formerly `agentpm`) is a cross-agent **Agent Plugins** manager and conversion engine — the reference implementation for the [Agent Plugins v1.0.0](https://agent-plugins.org) specification. It mirrors the [`skills` CLI](https://skills.sh) UX, but for portable Agent Plugins: discover, add, use, remove, list, find, update, init, and convert composite packages (skills, MCP servers, rules, hooks) across coding agents including Google Antigravity, Claude Code, OpenAI Codex CLI, OpenCode, and Pi.

This repository is itself a conforming Agent Plugins v1 plugin (`plugin.json` + `skills/migrate-agent-plugin/`), dogfooding the portable format it manages.

---

## Installation

```bash
# Global installation
npm install -g agentpm

# Or run directly with npx
npx agentpm --help
```

The `plugins` binary is the canonical entry point; `agentpm` is kept as an alias.

---

## Command Reference

### `plugins add <package>`
Downloads a plugin package into the Global Store (`$AGENTPM_STORE`, default `~/.local/share/agentpm/plugins/`), converts it to the **portable v1 format**, and enables it for your agents.

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

### `plugins convert <plugin>`
Converts a plugin directory through the unified seam (parse → portable core → emit, ADR 0013). Bare `convert` emits the portable v1 core; native targets via `--target`.

```bash
plugins convert ./my-claude-plugin                 # portable v1 core (default)
plugins convert ./my-claude-plugin --target opencode
plugins convert ./my-claude-plugin --target claude-code
plugins convert ./my-claude-plugin --target codex
plugins convert ./my-claude-plugin --out ./dist-plugin
```

Native targets: `opencode`, `antigravity`, `claude-code`, `codex`. Each emits its
client's own plugin layout from the portable core (see ADR 0013).

---

## Portable v1 Output

Conversion and `add` default to the **Agent Plugins v1** target, which emits:

- `plugin.json` — closed-schema manifest (only `$schema`, `name`, `version`, `description`, `author`, `homepage`, `repository`, `license`, `keywords`, `extensions`).
- `mcp.json` — portable MCP configuration (`$schema` + `mcpServers` with explicit `stdio` / `streamable-http` / `sse` transports).
- `skills/<name>/SKILL.md` — skills are the portable unit.

Vendor-specific hooks, commands, agents, LSP, and marketplace metadata are **not** portable v1 components; the `migrate-agent-plugin` skill (in `skills/`) documents keeping them as client compatibility layers.

---

## Architecture

- **`PackageManifest` (`src/core/manifest.ts`)** — manifest parsing, capability detection (skills, rules, MCP, hooks), format validation.
- **`MaterializationEngine` (`src/core/materialization.ts`)** — derives a native layout from the portable core via the per-agent emitter (passthrough for deferred agents), then symlinks or copies; safe dematerialization.
- **`acquirer.ts`** — single git acquisition surface: security checks, APM-shaped `apm.lock.yaml`, content hashing, fetch cache.
- **`v1-manifest.ts`** — closed-schema `plugin.json` + portable `mcp.json` builders (the Agent Plugins v1 target).
- **`portable-writer.ts`** — emits the portable v1 core and preserves the source client under `client-adapters/<client>/`.
- **`config.ts`** — injectable store/cache roots (`AGENTPM_STORE` / `AGENTPM_CACHE`, XDG defaults).
- **`GlobalStore` (`src/core/store.ts`)** — store of validated portable-core packages (`$AGENTPM_STORE/plugins/`) and adapted cache (`$AGENTPM_STORE/adapted/`).
- **`src/adapters/`** — one merged module per agent (lifecycle + `convert(portableCore)` emitter). Day-one emitters: `opencode`, `antigravity`; `claude-code`/`codex` deferred.

## Development

```bash
npm install
npm run build
npm test
```

## License

MIT License © 2026 Rayhan Islam Shuvro (`shuvrobhai`)
