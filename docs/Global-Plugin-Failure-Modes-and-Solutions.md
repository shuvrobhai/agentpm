# Global Plugin Ecosystem: Probable Issues & Battle-Tested Solutions

This document serves as the comprehensive architectural reference for probable failure modes encountered when installing, adapting, and managing cross-agent plugins globally across **OpenAI Codex**, **Claude Code**, **Google Antigravity**, and **OpenCode AI**, along with concrete solutions.

---

## Matrix of Failure Modes & Solutions

| Failure Category | Specific Probable Issue | Affected Providers | Root Cause | Concrete Solution |
|---|---|---|---|---|
| **1. MCP Execution** | `ENOENT` / Server Crash on startup | OpenAI Codex, OpenCode AI | Relative `cwd: "."` and `args: ["./dist/index.js"]` resolve against the user's terminal launch dir, not the plugin dir. | Expand all relative paths to **absolute paths** during adapter materialization. |
| **1. MCP Execution** | `EACCES: permission denied` on scripts | Claude Code, Codex, Antigravity | Git clones and zip archives drop executable bits (`0755` becomes `0644`). | Run recursive `fs.chmod(file, 0o755)` on `scripts/`, `hooks/`, and executable binaries. |
| **1. MCP Execution** | `MODULE_NOT_FOUND` / Missing dependencies | All Providers | Plugin bundles TypeScript/Node/Python MCP servers without bundled `node_modules` or `venv`. | Detect `package.json`/`pyproject.toml` and provide dependency bootstrapping. |
| **2. Lifecycle Hooks** | Claude Code variable references break (`${CLAUDE_PLUGIN_ROOT}`) | Codex, Antigravity, OpenCode | Target agents do not export `${CLAUDE_PLUGIN_ROOT}` to child processes. | Rewrite variable occurrences to absolute plugin paths or inject a cross-agent env shim. |
| **2. Lifecycle Hooks** | Antigravity `PreToolUse` protocol failure | Google Antigravity | Antigravity expects JSON on stdin/stdout (`{"decision": "allow"}`), while Claude uses bash exit codes. | Wrap bash hook scripts in a translation shim that converts exit code 0 to JSON `allow` and non-zero to `deny`. |
| **2. Lifecycle Hooks** | Manifest schema validation crash | OpenAI Codex | Codex parser strictly rejects `"hooks": "./hooks/hooks.json"` at the root of `plugin.json`. | Strip root `hooks` from `.codex-plugin/plugin.json` during Codex conversion. |
| **3. Agent Discovery** | Global plugin completely ignored | OpenAI Codex | Codex does not scan `~/.codex/plugins/` directly without an entry in `marketplace.json`. | Auto-upsert entries into `~/.agents/plugins/marketplace.json` upon `plugins enable -g`. |
| **3. Agent Discovery** | Plugin inactive during session start | OpenAI Codex | Codex requires explicit runtime enablement under `[plugins]` in `~/.codex/config.toml`. | Auto-append `[plugins."<name>@personal"] enabled = true` in `config.toml`. |
| **3. Agent Discovery** | Missing rule trigger metadata | Google Antigravity | Antigravity rules in `.agents/rules/` require YAML frontmatter (`globs`, `alwaysApply`). | Generate YAML frontmatter when extracting markdown rules into `.agents/rules/`. |
| **4. Store & Namespace** | Plugin collision on same name from different authors | All Providers | Installing `obra/superpowers` and `alice/superpowers` overwrites destination folders. | Use vendor-tiered store (`plugins/<vendor>/<namespace>/<plugin>/<version>/`) and collision warnings. |
| **4. Store & Namespace** | Broken symlinks after manual file deletion | All Providers | User deletes upstream clone without running `plugins remove`. | Provide a `plugins doctor` command to detect and purge dangling symlinks. |

---

## Detailed Failure Modes & Architectural Solutions

### 1. MCP Relative Path Resolution Failure
- **The Issue:** A plugin declares:
  ```json
  {
    "mcpServers": {
      "formatter": {
        "command": "node",
        "args": ["./dist/index.js"]
      }
    }
  }
  ```
  When the user opens Codex in `/Users/user/my-project`, Codex launches `node /Users/user/my-project/./dist/index.js`, which immediately fails with `ENOENT`.
- **The Solution:** The materialization engine computes the absolute installation path and emits:
  ```json
  {
    "mcpServers": {
      "formatter": {
        "command": "node",
        "args": ["/Users/user/.agentplugins/adapted/codex/obra/superpowers/main/dist/index.js"]
      }
    }
  }
  ```

---

### 2. Executable Permission Bit Loss
- **The Issue:** Git clones or filesystem extractions strip execution bits. When an agent tries to invoke `scripts/lint.sh`, the OS rejects execution with `EACCES`.
- **The Solution:** During `MaterializationEngine.materialize()`, scan all files in `scripts/`, `bin/`, and `hooks/` and execute:
  ```typescript
  await fs.chmod(filePath, 0o755);
  ```

---

### 3. Missing `marketplace.json` & `config.toml` in OpenAI Codex
- **The Issue:** Even with files placed in `~/.codex/plugins/superpowers/`, Codex requires two registration steps:
  1. `~/.agents/plugins/marketplace.json`:
     ```json
     {
       "name": "superpowers",
       "source": { "source": "local", "path": "./plugins/superpowers" },
       "policy": { "installation": "AVAILABLE", "authentication": "ON_INSTALL" },
       "category": "Coding"
     }
     ```
  2. `~/.codex/config.toml`:
     ```toml
     [plugins."superpowers@personal"]
     enabled = true
     ```
- **The Solution:** `CodexAdapter.enable()` automatically manages these two registrations, and `CodexAdapter.disable()` cleanly removes them.

---

### 4. Hook Protocol Translation (Claude Code → Antigravity)
- **The Issue:** Claude Code hooks are shell scripts that communicate via process exit codes (`exit 0` for allow, `exit 1` for deny). Antigravity `PreToolUse` hooks require JSON on standard I/O:
  ```json
  {
    "decision": "allow",
    "reason": "Security checks passed"
  }
  ```
- **The Solution:** When Antigravity adapter encounters a shell-based `PreToolUse` hook, generate an inline translation wrapper:
  ```bash
  #!/usr/bin/env bash
  if ./original_hook.sh; then
    echo '{"decision": "allow"}'
  else
    echo '{"decision": "deny", "reason": "Blocked by hook script"}'
  fi
  ```

---

### 5. Multi-Author Namespace Collision
- **The Issue:** Two distinct GitHub repositories (e.g. `obra/superpowers` and `acme/superpowers`) both produce the plugin folder name `superpowers`.
- **The Solution:**
  - Store repositories under `repos/<namespace>/<plugin>/` (e.g. `repos/obra/superpowers/`).
  - Store extracted bundles under `plugins/<vendor>/<namespace>/<plugin>/<version>/`.
  - Maintain provenance and content hashes in `source-registry.json`.
  - Prompt or alias during install if a destination collision occurs in global directories.

---

### 6. Dangling Symlinks & Integrity Audit (`plugins doctor`)
- **The Issue:** Over time, users or external tools may move folders, leaving dead symlinks in `~/.claude/plugins/`, `~/.codex/plugins/`, or `~/.gemini/config/plugins/`.
- **The Solution:** Implement a native `plugins doctor` diagnostic command that:
  - Scans all agent plugin directories.
  - Verifies whether symlink targets exist on disk.
  - Validates manifests against native schema rules.
  - Offers one-click automatic pruning of orphaned links.
