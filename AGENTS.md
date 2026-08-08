# AGENTS.md - Merged AgentPlugins Repo (plugins CLI + portable plugin)

Welcome to the merged **AgentPlugins** repo. This is now a single repository that is BOTH:

1. **`plugins`** (formerly `agentpm`) — a cross-agent Agent Plugins CLI: add, use, remove, list, find, update, init, enable, disable, info, convert.
2. A **conforming Agent Plugins v1 plugin** — `plugin.json` (closed schema) + `skills/migrate-agent-plugin/`, dogfooding the portable format it manages.

This repo also absorbed **agentport** (2026-08): the deep 9-component parser + IR, the `opencode` format/lifecycle adapters, and the `inspect` / `docs` / `providers` commands now live here. See `docs/adr/` for the merge decision.

## 1. Repo Layout

- `src/` — TypeScript CLI (Commander.js, simple-git, NodeNext ESM).
- `src/parser/` + `src/ir/types.ts` — deep Claude Code plugin parser → normalized IR (skills, commands, agents, rules, hooks, MCP, output styles, workflows, context file). Ported from `agentport`.
- `src/ir/to-portable-core.ts` — the single narrowing seam (ADR 0013): 9-type IR → `PortableCoreIR` (skills + MCP + three-tier extensions bag).
- `src/adapters/` — one merged module per agent (lifecycle + conversion, ADR 0013 Q9): `antigravity`, `claude-code`, `codex`, `opencode`. Each owns install paths, `convert(portableCore)` (native emit), and `materialize` (install/enable/disable).
- `src/core/portable-writer.ts` — emits the portable v1 core (`plugin.json` closed schema + `skills/` + `mcp.json`) and preserves the source client whole under `client-adapters/<client>/`.
- `src/core/acquirer.ts` — single git acquisition surface (security checks + APM-shaped `apm.lock.yaml` + content hash).
- `src/core/config.ts` — injectable roots: `AGENTPM_STORE` (XDG data) / `AGENTPM_CACHE` (XDG cache).
- `src/deploy/` — `provider-specs.ts`, `docs-engine.ts` (capability matrix), `provider-inspector.ts` (on-disk provider inspection).
- `test/` — `node:test` suite run via `tsx --test test/*.test.ts`.
- `plugin.json` — portable v1 manifest (closed schema: only `$schema`, `name`, `version`, `description`, `author`, `homepage`, `repository`, `license`, `keywords`, `extensions`).
- `skills/migrate-agent-plugin/` — the portable migration skill (with `references/`).
- `docs/`, `memory/`, `CONTEXT.md`, `IDEA.md` — design history and vocabulary.

## 2. CLI Shape

Mirrors the `skills` CLI UX. The `plugins` binary is canonical; `agentpm` is a bin alias.

- `plugins add <pkg>` (aliases `a`, `install`) — download to the store, convert to portable v1, enable. `--no-enable` to skip.
- `plugins use <pkg>[@skill]>` — prompt for using a plugin without installing.
- `plugins remove [plugins...]` (aliases `rm`, `uninstall`).
- `plugins list|ls` — workspace materializations or global store.
- `plugins find [query]` — GitHub search for `agent-plugins`-tagged repos.
- `plugins update [plugins...]` (alias `upgrade`) — re-download to latest + reconvert to portable v1.
- `plugins init [name]` — scaffold `plugin.json` + `skills/<name>/SKILL.md`.
- `plugins enable|disable|info` — materialization and lifecycle.
- `plugins convert <src> [-t opencode|antigravity|claude-code|codex|agent-plugins] [-o dir]` — single seam (ADR 0013): parse → `toPortableCore` → emit. Bare `convert` emits the portable v1 core; native targets via `-t`. `--deep` is gone.
- `plugins inspect <source> [--json]` — deep-parse a plugin into IR and print a component summary.
- `plugins docs [provider] [--matrix|--json]` — provider capability matrix / spec docs.
- `plugins providers [-p provider]` — inspect target provider directories on disk.

Default conversion target is **`agent-plugins`** (portable v1), emitting closed-schema `plugin.json` + portable `mcp.json` with explicit transports, with the source package preserved under `client-adapters/<client>/`.

Native emitters (ADR 0013): opencode (`opencode.json` + `.opencode/skills/<name>/SKILL.md`), antigravity (`skills/` + `agents/` + `rules/` + `mcp.json` + `hooks.json`), claude-code (`.claude-plugin/plugin.json` + `skills/` + `commands/` + `agents/` + `hooks/hooks.json` + `.mcp.json`), codex (`.codex-plugin/plugin.json` + `skills/` + `hooks/hooks.json` + `.mcp.json`). Every adapter implements `convert(portableCore)`; materialization derives the native layout through it.

## 3. Security Constraints

1. **Path Traversal**: validate namespace/pluginName/version/ref with `GlobalStore.validatePathComponent` (`/^[a-zA-Z0-9_.-]+$/`, no `.`/`..`).
2. **Git Flag Injection**: refs passed to git MUST NOT start with `-`.
3. **Safe File Ops**: `fs.lstat` before removing symlinks; delete existing symlinks before recreating.
4. **Confirmation**: before modifying existing files or creating new files, explicitly ask the user for permission.

## 4. Coding Standards

- `node:` prefix for stdlib imports.
- Explicit `.js` extension in local relative imports (ESM).
- Command handlers wrap async work in `try/catch` and set `process.exitCode = 1` on failure.
- Strict TS: `strict`, `exactOptionalPropertyTypes`, `noUncheckedIndexedAccess`.

## 5. Verification

```bash
npm run build          # tsc
npm test               # tsx --test test/*.test.ts
npx tsx src/index.ts --help
```

Validate `plugin.json` against the canonical schema before committing:

```sh
npx ajv-cli validate --spec=draft2020 \
  -s ../agent-plugins-spec/schemas/1.0.0/plugin.schema.json \
  -d plugin.json
```

Keep the repo's own `plugin.json` in sync with skill changes (bump `version`), and keep `skills/migrate-agent-plugin/` aligned with the migration skill copy in the workspace (`agentplugins/.agents/skills/`).

## 6. Source of truth

- Agent Plugins spec: `../agent-plugins-spec/spec/1.0.0.md` (normative)
- Schemas: `../agent-plugins-spec/schemas/1.0.0/`

## 7. History & Memory

See `CONTEXT.md` (glossary), `IDEA.md` (original agentpm concept), `docs/adr/`, and `memory/` for people/terms/projects.
