# AGENTS.md - Workspace Agent Rules & Conventions

Welcome to the **`agentpm`** codebase (`Universal Agent Extension Manager`). This file contains operational rules, security constraints, and architectural guidelines for AI agents working in this repository.

---

## 1. Project Overview & Technology Stack

- **Target**: `agentpm` CLI tool.
- **Language**: TypeScript (ES2022 / NodeNext ESM).
- **CLI Framework**: Commander.js.
- **Git Engine**: `simple-git`.
- **Global Store Path**: `~/.agentplugins/plugins/<namespace>/<plugin-name>/<version>/`.

---

## 2. Core Architecture & Adapter Model

- **Capabilities-First**: Declarative capabilities (`SKILL.md`, MCP configs) are managed centrally in `~/.agentplugins/plugins/`.
- **Symlink Materialization**: `AgentAdapter` implementations (`AntigravityAdapter`, `ClaudeCodeAdapter`) materialize plugins into host-specific directories (`.agents/skills/`, `.claudecode/skills/`) via directory symlinks.
- **Global Store Resolver**: `GlobalStore.findPluginPath(pluginName, version)` resolves packages across namespaces.

---

## 3. Strict Security Constraints

> [!CAUTION]
> Safety and path isolation are critical. Do not bypass validation functions.

1. **Path Traversal Protection**:
   - All path components (`namespace`, `pluginName`, `version`, `ref`) MUST be validated using `GlobalStore.validatePathComponent`.
   - Never allow `.`, `..`, or non-alphanumeric characters outside `/^[a-zA-Z0-9_.-]+$/`.
2. **Git Flag Injection Prevention**:
   - Input references (`ref`) passed to git commands MUST NOT start with `-`.
3. **Safe File Operations**:
   - Use `fs.lstat` before operating on or removing existing symlinks.
   - Always delete existing target symlinks before recreating (`fs.symlink`) to prevent nested symlink bugs.

---

## 4. Coding Standards

- **Node.js Imports**: Always use the explicit `node:` prefix for standard library modules (e.g., `import path from 'node:path'`, `import fs from 'node:fs/promises'`).
- **ESM File Extensions**: Explicitly include `.js` extension in local relative import paths (e.g., `import { GlobalStore } from '../core/store.js'`).
- **Error Handling**: Command handlers (`src/commands/`) must wrap asynchronous execution in `try/catch` blocks and set `process.exitCode = 1` cleanly on failure.

---

## 5. Verification Commands

Before declaring any task complete, verify the build and CLI functionality:
```bash
# Build TypeScript
npm run build

# Test CLI Help Output
npx tsx src/index.ts --help

# Test Plugin Installation & Materialization
npx tsx src/index.ts install octocat/Hello-World
npx tsx src/index.ts enable Hello-World
npx tsx src/index.ts disable Hello-World
```

---

## 6. Key Documentation References

- [CONTEXT.md](file:///Users/rayhanislamshuvro/Developer/skills-and-plugins/agnent-plugins/CONTEXT.md) — Domain Glossary & ubiquitous vocabulary.
- [docs/adr/](file:///Users/rayhanislamshuvro/Developer/skills-and-plugins/agnent-plugins/docs/adr/) — Architectural Decision Records.
- [docs/sprint-plan.md](file:///Users/rayhanislamshuvro/Developer/skills-and-plugins/agnent-plugins/docs/sprint-plan.md) — Project sprint backlog & historical context.
