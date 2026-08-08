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
- `src/core/codex-validator.ts` — native pure TypeScript schema validator for Codex manifests (`interface` object & capabilities).
- `src/core/acquirer.ts` — single git acquisition surface (security checks + APM-shaped `apm.lock.yaml` + content hash).
- `src/core/config.ts` — injectable roots: `~/.agentplugins/` store root (`repos/`, `plugins/`, `adapted/`, `source-registry.json`).
- `src/deploy/` — `provider-specs.ts`, `docs-engine.ts` (capability matrix), `provider-inspector.ts` (on-disk provider inspection).
- `resource/` — agent ecosystem knowledge base (`codex.md`, `claude-code.md`, `antigravity.md`, `opencode.md`).
- `test/` — `node:test` suite run via `tsx --test test/*.test.ts`.
- `plugin.json` — portable v1 manifest (closed schema: only `$schema`, `name`, `version`, `description`, `author`, `homepage`, `repository`, `license`, `keywords`, `extensions`).
- `skills/migrate-agent-plugin/` — the portable migration skill (with `references/`).
- `docs/`, `memory/`, `CONTEXT.md`, `IDEA.md` — design history, ADRs (0001-0014), and master `PROJECT_MAP.md`.

## 2. CLI Shape

Mirrors the `skills` CLI UX. The `plugins` binary is canonical; `agentpm` is a bin alias.

- `plugins add <pkg>` (aliases `a`, `install`) — download to pristine `repos/`, convert to portable v1 in `plugins/`, enable. `--no-enable` to skip.
- `plugins use <pkg>[@skill]>` — prompt for using a plugin without installing.
- `plugins remove [plugins...]` (aliases `rm`, `uninstall`) — dematerialize all symlinks/config entries and purge store.
- `plugins list|ls` — workspace materializations or global store.
- `plugins find [query]` — GitHub search for `agent-plugins`-tagged repos.
- `plugins update [plugins...]` (alias `upgrade`) — re-download to latest + reconvert to portable v1.
- `plugins init [name]` — scaffold `plugin.json` + `skills/<name>/SKILL.md`.
- `plugins enable|disable|info` — materialization, marketplace registration, and runtime activation.
- `plugins convert <src> [-t opencode|antigravity|claude-code|codex|agent-plugins] [-o dir]` — single seam (ADR 0013): parse → `toPortableCore` → emit. Bare `convert` emits the portable v1 core; native targets via `-t`.
- `plugins inspect <source> [--json]` — deep-parse a plugin into IR and print a component summary.
- `plugins docs [provider] [--matrix|--json]` — provider capability matrix / spec docs.
- `plugins providers [-p provider]` — inspect target provider directories on disk.

Default conversion target is **`agent-plugins`** (portable v1), emitting closed-schema `plugin.json` + portable `mcp.json` with explicit transports, with the source package preserved under `client-adapters/<client>/`.

Native emitters (ADR 0013 & ADR 0014):
- **Antigravity**: `~/.gemini/config/plugins/<name>` & `.agents/plugins/<name>` (skills in `skills/`, agents in `agents/`, rules in `rules/`, `mcp.json`, `hooks.json`).
- **Claude Code**: `~/.claude/plugins/<name>` & `.agents/plugins/<name>` (`.claude-plugin/plugin.json` + `skills/` + `commands/` + `agents/` + `hooks/hooks.json` + `.mcp.json`).
- **OpenAI Codex**: `~/.codex/plugins/<name>` & `.agents/plugins/<name>` (`.codex-plugin/plugin.json` with required `interface` block + `skills/` + `.mcp.json` + `marketplace.json` + `config.toml`).
- **OpenCode AI**: `~/.config/opencode/plugins/<name>` & `.agents/plugins/<name>` (`opencode.json` + `.opencode/skills/<name>/SKILL.md`).

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

## 6. Source of Truth & Project Map

- Master Project Map: `docs/PROJECT_MAP.md`
- Failure Modes & Solutions: `docs/Global-Plugin-Failure-Modes-and-Solutions.md`
- Agent Ecosystem Knowledge Base: `resource/`
- Architecture Decisions: `docs/adr/` (0001 - 0014)

