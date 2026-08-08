# 0013 - Unify Conversion Behind the Portable v1 Core

Date: 2026-08-08

## Context

ADR 0012 merged agentport into agentpm as a *parallel* conversion path: the
legacy `PluginConverter` (file-copy + 7 text-transform pipeline steps,
`src/core/converter.ts`) and the IR pipeline (`parsePlugin` →
`ConversionAdapter.convert` → `writeConversion`, gated behind `convert --deep`).
The two paths already disagree on output — `opencode` materializes a different
directory layout and hook schema than the legacy converter for the same target
agent — so a fix in one path silently diverges from the other.

An architecture review (2026-08-08) surfaced the fork as the codebase's
strongest deepening opportunity, and web research confirmed the ecosystem
already converged on the shape of the fix: every major tool
(`openmarketplace`, `jal-co/agent-plugin-sdk`, `@agentplugins/cli`, Microsoft
APM) implements "one normalized core → N native emitters". The Agent Plugins
v1 spec pins the core: portable components are exactly **Agent Skills** and
**MCP servers** (§7); everything else (hooks, agents, commands, rules, output
styles, workflows, context files, LSP, UI, marketplace) is client territory
owned under reverse-domain namespaces (§8) or left entirely client-specific.

## Decision

Collapse both conversion paths onto one seam: the portable v1 core. The full
decision record (19 decisions, the grilling tree) is captured here in
condensed form.

### The seam

```
parsePlugin (9-type IR, unchanged) → toPortableCore(ir): PortableCoreIR → per-agent adapter
```

- **`PortableCoreIR`** is a distinct narrowed type: `{ skills, mcpServers,
  extensions }`. Portable = skills + MCP only (spec §7). `parsePlugin` stays
  untouched; `toPortableCore` is a pure narrowing. `inspect`/`info` remain
  deep (9 types).
- **Extensions bag, three tiers**: hooks stay normalized (`HookIR` — a future
  portable hooks type is plausible as the TSC "may consider" new component
  types); agents/commands/rules keep their typed IR under the per-client
  namespace; output styles/workflows/LSP/UI/marketplace are opaque.

### One per-agent module

Merge `AgentAdapter` (lifecycle) and `ConversionAdapter` (emit) into a single
per-agent adapter that owns:
- its install paths,
- `convert(portableCore) → native package` (authoring),
- `materialize(install/enable/disable)` (install),
- a shared internal "project portable core → native layout" helper.

The `agent-plugins` adapter stub is deleted — the portable core *is* that
target's output. Native emitters: **opencode** (corrected to real
`SKILL.md`-directory + `Plugin.define` shape), **antigravity**, and the two
formerly-deferred targets **claude-code** (`.claude-plugin/plugin.json` +
`skills/` + `commands/` + `agents/` + `hooks/hooks.json` + `.mcp.json`) and
**codex** (`.codex-plugin/plugin.json` + `skills/` + `hooks/hooks.json` +
`.mcp.json`). `convert` is required on every adapter; pi remains unregistered.

### Pipeline

- Single path; `--deep` flag removed. Bare `plugins convert` emits portable
  v1 core; native targets reached via `--target` (opencode, antigravity,
  claude-code, codex).
- `add`/`use`/`update` route through the same seam (they already emit
  portable v1 via the `agent-plugins` target).
- The 7 legacy pipeline steps (VariableRewrite, MemoryTranspile,
  McpPathExpansion, HookSchemaConvert, CommandTranspile, AgentTomlTranspile,
  TerminologyNeutralize) fold into the adapters. `PluginConverter` + its
  pipeline are deleted.
- `convert(portableCore)` is required on every adapter; materialization
  always derives the native layout via the seam (the copy-through fallback for
  deferred targets is gone).

### Preservation

The source client's original package is preserved whole in a **sibling
`client-adapters/<client>/`** directory (per the migration skill's recommended
`plugin/` + `client-adapters/` layout). agentpm never invents a namespace
inside the portable package — the spec forbids assuming an unrelated client
will load an undocumented namespace.

### Acquisition and store

- One acquirer module: `source spec → local plugin directory`, single
  security surface (ref/subfolder/flag-injection checks). Replaces the three
  current clone implementations.
- **APM-shaped lockfile** (resolved commit + content hash + deployed files,
  committed, `--frozen` replay) + a disposable fetch cache. No ecosystem
  format exists to adopt; APM's is the most complete published reference.
- **Injectable store root**: `AGENTPM_STORE` / `AGENTPM_CACHE` env vars with
  XDG-compliant defaults, splitting fetch cache (disposable, XDG cache) from
  canonical store (validated portable-core packages, XDG data). The store
  holds portable core; native materialization derives from it on demand.
  Tests run against a temp store, never `~/.agentplugins`.

### Tests

Retire `test/pipeline.test.ts` and `test/converter.test.ts` (coverage folds
into adapter tests). Retarget `ir-adapters`, `portable`, `store`,
`materialization`, and `commands*.test.ts` at the single seam.

## Consequences

- Conversion bugs concentrate in one module; `inspect`, `convert`, `add`,
  `use`, `update` share one parse → normalize path.
- Per-agent adapter files shrink to their real differences; adding an agent
  edits one module, not eight files.
- Git acquisition is tested once against the security surface; lockfile +
  cache bring reproducible, auditable installs.
- Tests run against an injectable store — no more mutating the real home dir.
- This supersedes ADR 0012's parallel-path rationale. 0012 remains the record
  of *why* agentport's parser/IR/inspect/docs/providers entered the repo;
  those components are retained. Its `convert --deep` fork is replaced by the
  unified seam.
