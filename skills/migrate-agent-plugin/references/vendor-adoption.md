# Vendor Adoption of Agent Plugins v1

Snapshot of which coding agents support the portable Agent Plugins v1 format, learned while migrating multi-client plugins (`DietrichGebert/ponytail` and `obra/superpowers`). **Snapshot date: 2026-08-08.** Adoption changes; verify against the live list before relying on it.

## Source of truth

- Compatible Clients page: https://agent-plugins.org/compatible-clients
- Canonical data: `lib/compatible-clients.ts` in the agent-plugins-site repo (curated, verified; inclusion requires public documentation or release notes).

## Verified Agent Plugins clients (skills + MCP transports)

| Client | Skills | MCP transports | Notes |
|--------|--------|----------------|-------|
| VS Code (Microsoft) | Yes | stdio, streamable-http, sse | Docs: code.visualstudio.com/docs/agent-customization/agent-plugins |
| Cursor | Yes | stdio, streamable-http, sse | Docs: cursor.com/docs/plugins |
| GitHub Copilot | Yes | stdio, streamable-http, sse | Docs: about-plugins |
| ChatGPT & Codex (OpenAI) | Yes | stdio, streamable-http (no sse) | Docs: developers.openai.com/plugins |
| Kiro | Yes | stdio, streamable-http, sse | Docs: kiro.dev/docs/powers |

## Clients with their OWN plugin format (no verified Agent Plugins support)

These are the clients you will most often be migrating *from*. Their manifests and layouts are client-specific; treat them as a compatibility layer, not portable core:

| Client | Native artifact(s) | Loads `skills/` natively? |
|--------|--------------------|---------------------------|
| Claude Code | `.claude-plugin/plugin.json`, `.claude-plugin/marketplace.json`, `hooks/`, `commands/*.toml` | Yes, plus hooks/agents/commands/LSP |
| Codex | `.codex-plugin/plugin.json` (skills + hooks + interface) | Yes |
| GitHub Copilot CLI | `.github/plugin/` (plugin.json + marketplace.json) | Yes |
| Devin CLI | `.devin-plugin/plugin.json` | Yes |
| OpenCode | `opencode.json`, `.opencode/plugins/*.js`/`*.mjs`, `.opencode/command/` | Yes (via plugin; package.json `main` often doubles as the plugin entry) |
| Kimi | `.kimi-plugin/plugin.json` (skills + `sessionStart.skill` + inline `skillInstructions` tool mapping) | Yes |
| Gemini CLI / Antigravity | `gemini-extension.json` (context file: `AGENTS.md` or `GEMINI.md`), `.agents/plugins/marketplace.json` | Yes |
| Hermes Agent | `plugin.yaml`, `commands/*.toml`, `__init__.py` | Yes |
| pi agent | package.json `pi` field + `.pi/extensions/*.ts` **or** `pi-extension/index.js` | Yes |
| OpenClaw | `.openclaw/skills/` (generated from `skills/`) | Yes |
| Cursor | `.cursor-plugin/plugin.json` (skills + hooks) **and/or** `.cursor/rules/*.mdc` | Yes via plugin manifest; instruction-only via rules |
| Windsurf / Cline | `.windsurf/rules/`, `.clinerules/` | No — instruction-only (rule files) |
| Kiro steering | `.kiro/steering/*.md` | No — steering rules |
| Generic / rule-file agents | `AGENTS.md`, `.agents/rules/`, `.github/copilot-instructions.md` | No — instruction-only |

## What this means when migrating

- **Skills are the portable core almost everywhere.** Nearly every client above can already consume `skills/<name>/SKILL.md` in the Agent Skills format. A plugin that already keeps skills in `skills/` (ponytail and superpowers both do) needs only a root `plugin.json` to become portable.
- **Hooks, commands, agents, LSP, UI, marketplace metadata are NOT portable v1 components** — never claim they became portable. Keep them as the client's compatibility layer (`client-adapters/` or the native manifest in place).
- **A single client can have multiple native forms.** Cursor ships both a `.cursor-plugin/plugin.json` manifest (loads skills + hooks) and `.cursor/rules/*.mdc` (instruction-only). Check for all forms before classifying a client as "instruction-only".
- **Plugin runtimes vary by client.** OpenCode/pi inject the ruleset via plugin code (JS/TS hooks), Gemini/Antigravity via a context-file include, Claude/Cursor via session-start hooks, Kimi via `sessionStart.skill` + `skillInstructions`. Migrating the *skill* is portable; migrating the *injection mechanism* is not.
- **Version fields are synced across many manifests.** Superpowers keeps 7+ version-bearing files in lockstep via `.version-bump.json`; ponytail via `scripts/check-versions.js`. When adding a root `plugin.json`, keep its `version` in that sync or drift will break the checker.
- **Instruction-only clients** (Windsurf, Cline, Kiro, AGENTS.md readers) never had a manifest to convert — leave their copied rule files alone, just add the portable core.
- **Distinguish verified support from shipped-but-unverified.** A vendor shipping plugins that *happen* to work in Claude Code/Codex/Cursor (e.g. AWS) is not the same as Agent Plugins adoption. Verify on the compatible-clients list before assuming a client loads `plugin.json`.
- **When in doubt, inventory the target client's docs** before deleting any legacy layout.
