# ADR 0014: Global Store Multi-Tier Topology, Cross-Agent Path Realignment, and Native Codex Manifest Validation

- **Status:** Accepted
- **Date:** 2026-08-08
- **Context:** Following ADR 0013 (Portable Core), real-world testing with full multi-skill repositories (like `obra/superpowers`) revealed four operational challenges:
  1. Global stores dumped all clone files directly into single folders, losing raw commit history and mixing upstream build tools with clean portable bundles.
  2. Adapter paths across Claude Code and Codex placed plugins in `skills/` directories instead of their respective canonical global `plugins/` directories (`~/.claude/plugins/`, `~/.codex/plugins/`).
  3. OpenAI Codex rejected manifests lacking the `interface` block or containing root `hooks` keys, and failed to discover plugins without `marketplace.json` indexing and `config.toml` runtime enablement.
  4. Workspaces across all agents required `.agents/` as the primary workspace target.

---

## Decision

1. **Multi-Tier Global Store (`~/.agentplugins/`)**:
   - `repos/<namespace>/<plugin>/`: Pristine shallow git clones preserving full upstream history, tests, and build files.
   - `plugins/<vendor>/<namespace>/<plugin>/<version>/`: Clean extracted shareable bundles containing only closed-schema `plugin.json` (with `original_vendor`), `skills/`, `mcp.json`, `rules/`, `hooks.json`, `client-adapters/`, and auto-generated `README.md`.
   - `source-registry.json`: Provenance metadata tracking source URL, commit SHA, directory content hash, and source vendor identity.

2. **Provider Path Realignment**:
   - **Google Antigravity:** Global `~/.gemini/config/plugins/<plugin>/`, Workspace `.agents/plugins/<plugin>/` and `.agents/skills/`.
   - **Claude Code:** Global `~/.claude/plugins/<plugin>/`, Workspace `.agents/plugins/<plugin>/` (or `.claude/plugins/`).
   - **OpenAI Codex:** Global `~/.codex/plugins/<plugin>/`, Workspace `.agents/plugins/<plugin>/` (or `.codex/plugins/`).
   - **OpenCode AI:** Global `~/.config/opencode/plugins/<plugin>/`, Workspace `.agents/plugins/<plugin>/`.

3. **OpenAI Codex Manifest & Marketplace Synchronization**:
   - `CodexAdapter.convert()` generates the required `interface` object (`displayName`, `shortDescription`, `longDescription`, `developerName`, `category`, `capabilities: ['Interactive', 'Write']`, `defaultPrompt`) and drops root `hooks`.
   - `CodexAdapter.enable()` automatically upserts the plugin entry into `~/.agents/plugins/marketplace.json` and activates `[plugins."<name>@personal"] enabled = true` in `~/.codex/config.toml`.
   - `CodexAdapter.disable()` cleanly removes these entries.

4. **Native TypeScript Codex Validation Engine**:
   - Implemented `src/core/codex-validator.ts` as a pure TypeScript validation engine with zero external Python dependencies.

---

## Consequences

- All 4 major AI coding agent runtimes discover, load, and activate global and workspace plugins correctly.
- Global store maintains full upstream reproducibility without polluting clean portable bundles.
- OpenAI Codex plugins pass 100% of schema validation natively in TypeScript.
