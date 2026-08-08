# AGENTS.md - Merged AgentPlugins Repo (plugins CLI + portable plugin)

Welcome to the merged **AgentPlugins** repo. This is now a single repository that is BOTH:

1. **`plugins`** (formerly `agentpm`) — a cross-agent Agent Plugins CLI: add, use, remove, list, find, update, init, enable, disable, info, convert.
2. A **conforming Agent Plugins v1 plugin** — `plugin.json` (closed schema) + `skills/migrate-agent-plugin/`, dogfooding the portable format it manages.

## 1. Repo Layout

- `src/` — TypeScript CLI (Commander.js, simple-git, NodeNext ESM).
- `test/` — `node:test` suite run via `tsx --test test/*.test.ts`.
- `plugin.json` — portable v1 manifest (closed schema: only `$schema`, `name`, `version`, `description`, `author`, `homepage`, `repository`, `license`, `keywords`, `extensions`).
- `skills/migrate-agent-plugin/` — the portable migration skill (with `references/`).
- `docs/`, `memory/`, `CONTEXT.md`, `IDEA.md` — design history and vocabulary.

## 2. CLI Shape

Mirrors the `skills` CLI UX. The `plugins` binary is canonical; `agentpm` is a bin alias.

- `plugins add <pkg>` (aliases `a`, `install`) — download + convert to portable v1 + enable. `--no-enable` to skip.
- `plugins use <pkg>[@skill]>` — prompt for using a plugin without installing.
- `plugins remove [plugins...]` (aliases `rm`, `uninstall`).
- `plugins list|ls` — workspace materializations or global store.
- `plugins find [query]` — GitHub search for `agent-plugins`-tagged repos.
- `plugins update [plugins...]` (alias `upgrade`) — re-download to latest + reconvert.
- `plugins init [name]` — scaffold `plugin.json` + `skills/<name>/SKILL.md`.
- `plugins enable|disable|info|convert` — materialization and conversion.

Default conversion target is **`agent-plugins`** (portable v1), emitting closed-schema `plugin.json` + portable `mcp.json` with explicit transports. The old `antigravity` default only applies via explicit `--target` or the `convert` command default.

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
