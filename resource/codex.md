# OpenAI Codex CLI Agent Specifications

> **Target Directory:** `~/.codex/plugins/<plugin>` (Global) / `.agents/plugins/<plugin>` or `.codex/plugins/` (Workspace)  
> **Manifest Location:** `.codex-plugin/plugin.json`  
> **Discovery Registry:** `~/.agents/plugins/marketplace.json` (Personal)  
> **Runtime Config:** `~/.codex/config.toml`  

---

## 1. Manifest Schema Requirements (`.codex-plugin/plugin.json`)

Codex CLI enforces strict validation via `validate_plugin.py`.

```json
{
  "name": "superpowers",
  "version": "1.0.0",
  "description": "Core skills library for coding agents",
  "interface": {
    "displayName": "Superpowers",
    "shortDescription": "TDD, systematic debugging, and planning skills",
    "longDescription": "Comprehensive skills library covering test-driven development, plan execution, and code review.",
    "developerName": "obra",
    "category": "Coding",
    "defaultPrompt": "Use superpowers skills to assist with coding tasks."
  },
  "skills": "./skills/"
}
```

### Critical Validation Rules
1. **Required `interface` Object**:
   - `displayName` (string): Human-friendly name displayed in the Codex TUI.
   - `shortDescription` (string): 1-sentence summary.
   - `longDescription` (string): Detailed explanation of capabilities.
   - `developerName` (string): Author or organization.
   - `category` (string): e.g., `"Coding"`, `"Productivity"`, `"Data"`.
   - `defaultPrompt` (string): Initial suggested prompt for the user.
2. **Top-Level `hooks` Strictly Disallowed**:
   - Declaring `"hooks": "./hooks/hooks.json"` at the root of `.codex-plugin/plugin.json` will cause schema validation failure.
3. **No Claude Variable References**:
   - `${CLAUDE_PLUGIN_ROOT}` must be rewritten to absolute paths or relative runtime roots.

---

## 2. Personal Marketplace Registration (`marketplace.json`)

Codex discovers and installs local plugins via the personal marketplace index located at `~/.agents/plugins/marketplace.json` or `.agents/plugins/marketplace.json`.

```json
{
  "name": "personal",
  "plugins": [
    {
      "name": "superpowers",
      "path": "./plugins/superpowers",
      "category": "Coding",
      "installation": "AVAILABLE",
      "authentication": "ON_INSTALL"
    }
  ]
}
```

---

## 3. Runtime Activation (`~/.codex/config.toml`)

Even when materialized on disk, the plugin must be enabled in Codex runtime configuration:

```toml
[plugins]
superpowers = "enabled"
```

Alternatively activated through CLI:
```bash
codex plugin add superpowers@personal
```

---

## 4. Known Engine Constraints
- **Dereferencing Required:** Codex's internal `store.rs` copier historically skips symbolic links; all files staged for Codex must be copied dereferenced.
- **MCP Absolute Path Requirement:** Relative `cwd` and `args` in `.mcp.json` resolve relative to the launching directory, not the plugin cache; must expand to absolute paths during conversion.
