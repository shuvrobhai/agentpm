# `agentpm` — Universal Agent Extension Manager

[![Build Status](https://img.shields.io/badge/build-passing-brightgreen.svg)](https://github.com/shuvrobhai/agentpm)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0%2B-blue.svg)](https://www.typescriptlang.org/)

**`agentpm`** is a cross-agent package manager and conversion engine for AI coding extensions. It allows developers to discover, install, convert, and materialize composite plugin packages (skills, rules, MCP servers, hooks) across multiple AI agent platforms—including **Google Antigravity**, **Claude Code**, **OpenAI Codex CLI**, **OpenCode**, and **Pi**.

---

## 🌟 Key Features

- **Open Canonical Format Staging**: Standardizes vendor-specific packages upon download into a unified, agent-agnostic format (`plugin.json`, `skills/`, `rules/`, `AGENTS.md`, `mcp_config.json`, `hooks.json`).
- **Workspace Materialization Priority**: Materializes plugins directly into `.agents/plugins/<plugin-name>` for Google Antigravity without placing package manager files inside project repositories.
- **Directory Symlinking & Copy Mode**: Defaults to zero-copy directory symlinks from `~/.agentplugins/plugins/` for central updates, with `--copy` flag support for isolated workspace edits.
- **Cross-Agent Conversion Engine**: Translates vendor-specific variable placeholders (`${CLAUDE_PLUGIN_ROOT}` → `${PLUGIN_ROOT}`), memory files (`CLAUDE.md` → `AGENTS.md`), relative MCP working paths, and hook schemas (`hooks.json` → Antigravity hooks format).
- **Monorepo Subfolder URL Extraction**: Directly installs plugins hosted within nested GitHub repository folders (e.g. `https://github.com/owner/repo/tree/main/subfolder-plugin`).
- **Security & Path Isolation**: Strict path traversal validation, Git flag injection protection, and safe dematerialization during uninstallation.

---

## 🚀 Installation & Usage

Run `agentpm` globally via Node.js or `npx`:

```bash
# Global installation via npm
npm install -g agentpm

# Or run directly with npx
npx agentpm --help
```

---

## 📚 Command Reference

### 1. `agentpm install <repo>`
Downloads a plugin package from GitHub into the central Global Store (`~/.agentplugins/plugins/`) and automatically converts it into the **Open Canonical Format**.

```bash
# Install a standard GitHub repository
agentpm install octocat/Hello-World

# Install a specific branch, tag, or commit SHA
agentpm install octocat/Hello-World#v1.2.0

# Install a specific subfolder plugin from a monorepo
agentpm install https://github.com/anthropics/knowledge-work-plugins/tree/main/pdf-viewer
```

### 2. `agentpm enable <plugin>`
Materializes an installed plugin into your active workspace for detected host agents (or a specified target agent adapter).

```bash
# Materialize plugin into .agents/plugins/<plugin> via symlink for Google Antigravity
agentpm enable pdf-viewer --target antigravity

# Materialize as an isolated, editable local copy instead of a symlink
agentpm enable pdf-viewer --copy

# Enable globally across global agent directories
agentpm enable pdf-viewer --global
```

### 3. `agentpm disable <plugin>`
Dematerializes active workspace or global links for a plugin without removing it from the central Global Store.

```bash
agentpm disable pdf-viewer
```

### 4. `agentpm list`
Lists active workspace plugins or inspects installed packages in the central Global Store inventory.

```bash
# List active workspace materializations
agentpm list

# List all installed packages in the central Global Store
agentpm list --global
```

### 5. `agentpm info <plugin>`
Inspects plugin capabilities, manifest headers, contained skills, MCP servers, hooks, and workspace materialization status using the `PackageManifest` module.

```bash
agentpm info pdf-viewer
```

### 6. `agentpm convert <plugin|path>`
Converts vendor-specific plugin directories or foreign in-workspace packages to target agent-agnostic schemas.

```bash
# Convert a local vendor plugin directly into .agents/plugins/<plugin> in your workspace
agentpm convert ./my-claude-plugin --target antigravity

# Convert with custom memory filename and output path
agentpm convert ./my-plugin --memory AGENTS.md --out ./dist-plugin
```

### 7. `agentpm uninstall <plugin>`
Safely dematerializes active workspace and global symlinks, then purges the package directory from the Global Store.

```bash
agentpm uninstall pdf-viewer
```

---

## 🏗️ Architecture & Core Modules

`agentpm` is designed around deep, testable architectural modules:

- **`PackageManifest` (`src/core/manifest.ts`)**: Encapsulates manifest parsing, capability detection (skills, rules, MCP, hooks), and format validation behind a single interface (`PackageManifest.load(pluginPath)`).
- **`MaterializationEngine` (`src/core/materialization.ts`)**: Manages symlink creation, version segment stripping (`main`/`latest`/`v...`), `--copy` mode handling, and safe dematerialization across agent adapters.
- **`PluginConverter` (`src/core/converter.ts`) & `convertHooks` (`src/core/hook-converter.ts`)**: Pipeline executing text variable transformations, memory file transpilation, MCP path expansion, and Claude-to-Antigravity hook schema translations.
- **`GlobalStore` (`src/core/store.ts`)**: Manages central storage (`~/.agentplugins/plugins/`) and adapted cache staging (`~/.agentplugins/adapted/`).

---

## 🧪 Development & Testing

```bash
# Clone the repository
git clone https://github.com/shuvrobhai/agentpm.git
cd agentpm

# Install dependencies
npm install

# Build TypeScript source
npm run build

# Run unit test suite (22 tests across 6 test suites)
npm test
```

---

## 📄 License

[MIT License](LICENSE) © 2026 Rayhan Islam Shuvro (`shuvrobhai`)
