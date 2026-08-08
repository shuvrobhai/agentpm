# 0012 - Merge Agentport into AgentPlugins (plugins CLI)

Date: 2026-08-08

## Context

The workspace contained two overlapping TypeScript CLIs for cross-agent plugin
conversion and lifecycle:

- **`agentpm`** (`plugins`) — the reference implementation for the Agent Plugins
  v1 spec. Normalizes everything to portable v1 first (`plugin.json` +
  `mcp.json` + `skills/`), then materializes per agent. Has a GitHub remote,
  mirrors the `skills` CLI UX, and dogfoods its own portable format.
- **`agentport`** — a format converter (Parser → IR → Adapter) plus a plugin
  lifecycle manager (`pm add/remove/sync/update/list/providers/docs`). No
  remote, no spec alignment, its own zod-validated config.

Both convert plugins and manage lifecycle, duplicating surface area and
maintenance burden.

## Decision

Fold **agentport into agentpm**. `agentpm` is the host because it is the
spec-aligned reference implementation with a remote and a richer, spec-correct
lifecycle. Bring over agentport's genuinely unique wins, skip the redundant
deploy subsystem:

- **Deep parser + IR** (`src/parser/`, `src/ir/types.ts`): 9-component parsing
  (skills, commands, agents, rules, hooks, MCP, output styles, workflows,
  context file) with source resolution (local, git, GitHub shorthand,
  marketplace). Replaces agentpm's shallow manifest-only scan for inspection.
- **`plugins inspect <source> [--json]`** command.
- **IR conversion adapters** (`src/adapters/ir/`): `opencode` + `antigravity`
  format adapters; `convert --deep` runs parse → IR → adapter → files.
- **`opencode` lifecycle adapter** (`src/adapters/opencode.ts`): agentpm had no
  OpenCode lifecycle support.
- **`plugins docs`** (provider capability matrix) + **`plugins providers`**
  (on-disk provider inspection) backed by a static spec registry
  (`src/deploy/provider-specs.ts`), avoiding the zod/full deploy subsystem.

Dropped from agentport (redundant with agentpm's lifecycle): the zod
`config-manager`, `acquisition-engine`, `discovery-engine`,
`deploy-pipeline`, and the `pm add/remove/sync/update` commands. The
Parser/IR code was adapted to agentpm conventions: `node:`-prefixed stdlib,
`.js` ESM import extensions, `exactOptionalPropertyTypes`-safe object
construction, `gray-matter` for frontmatter (only new runtime dependency).

## Consequences

- One repo to maintain; `agentport/` directory is removed from the workspace.
- `plugins` gains deep inspection + OpenCode support + provider docs without
  losing its spec-aligned lifecycle.
- CLI name for the merged tool stays `plugins`/`agentpm`; `agentport` is not
  published or continued.
- Agentport's unique test cases (IR parsing, adapter output) were ported into
  `test/ir-adapters.test.ts`.

## Superseded in part

The merge decision itself stands — agentport's parser, IR, `inspect`, `docs`,
and `providers` remain part of the repo. The **`convert --deep` parallel
conversion path** it introduced is superseded by ADR 0013, which unifies both
conversion paths behind the portable v1 core and retires `PluginConverter`.

