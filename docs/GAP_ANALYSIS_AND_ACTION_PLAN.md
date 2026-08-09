# agentpm: Architecture Gap Analysis & Implementation Roadmap

> **Target Codebase:** `/Users/rayhanislamshuvro/Developer/projects/agentpm/`  
> **Source Document:** Definitive Adapter Specification (v0.1.0-draft)  
> **Date:** August 10, 2026  
> **Author:** Antigravity Architect  

---

## Executive Summary

The current `agentpm` codebase has a strong foundation: it establishes a **Portable Core IR (`toPortableCore`)**, a **3-tier Global Store (`repos/`, `plugins/`, `adapted/`)**, and basic CLI commands. However, when evaluated against the **Definitive Adapter Specification**, there are major architectural discrepancies and broken conversion mechanics:

1. **Antigravity Emitter produces invalid schemas:** Flat skill paths (`skills/name.md`), markdown headers instead of YAML frontmatter for subagents, flat arrays instead of named nested regex objects for hooks, and `mcp.json` instead of `mcp_config.json`.
2. **Missing Universal Tool Name & Hook Mapping Engines:** Tool mapping (`bash` → `run_command`, `read_file` → `view_file`) is printed as a manual step instead of executed programmatically. Hook translation drops 26 events silently without structured warnings.
3. **Missing MCP Path Rewriter:** `${CLAUDE_PLUGIN_ROOT}` and relative `cwd`/`args` are not resolved to absolute paths.
4. **Missing Commands $\leftrightarrow$ Workflows Converter:** Claude Code slash commands (`# /name`) are not converted to Antigravity Workflows (`.agents/workflows/<name>.md`) with YAML frontmatter and 12k-character limit checks.
5. **Missing Pi Coding Agent Adapter:** `PiAdapter` is completely absent from `src/adapters/`.
6. **No Workspace `.agentpm.lock` Tracker:** Workspace materialization does not track individual materialized files, making precise uninstallation and drift detection during `sync` impossible.

---

## Detailed Gap Analysis by Subsystem

```
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│                                   agentpm Codebase Gaps                                     │
├────────────────────────────┬──────────────────────────────┬─────────────────────────────────┤
│ Subsystem                  │ Current Codebase State       │ Required Specification State    │
├────────────────────────────┼──────────────────────────────┼─────────────────────────────────┤
│ Antigravity Adapter        │ Flat .md skills, flat hooks, │ skills/<name>/SKILL.md, nested  │
│                            │ no YAML agent frontmatter    │ regex hooks, mcp_config.json    │
├────────────────────────────┼──────────────────────────────┼─────────────────────────────────┤
│ Tool & Hook Translation    │ Hardcoded print strings      │ Programmatic mapping engine     │
│                            │ in manualSteps               │ (20 tools, 31 hook events)      │
├────────────────────────────┼──────────────────────────────┼─────────────────────────────────┤
│ MCP Path Rewriting         │ Dumped as-is from IR         │ Absolute expansion of ${ROOT}   │
│                            │                              │ and launch-dir relative paths   │
├────────────────────────────┼──────────────────────────────┼─────────────────────────────────┤
│ Commands ↔ Workflows       │ Workflows dropped as warning │ Bidirectional parser with 12k   │
│                            │                              │ character limit & YAML headers  │
├────────────────────────────┼──────────────────────────────┼─────────────────────────────────┤
│ Pi Agent Adapter           │ Completely missing           │ TypeScript extension wrapper,   │
│                            │                              │ trust.json, /skill: prefix      │
├────────────────────────────┼──────────────────────────────┼─────────────────────────────────┤
│ Workspace State Tracking   │ Only global registry         │ Local .agentpm.lock tracking    │
│                            │ (source-registry.json)       │ per-agent MaterializedFile[]    │
└────────────────────────────┴──────────────────────────────┴─────────────────────────────────┘
```

---

## 1. Antigravity Adapter (`src/adapters/antigravity.ts`)

### What is Broken / Outdated:
1. **Skill Layout:** Emits `skills/${skill.name}.md`.  
   *Fix:* Must emit `skills/${skill.name}/SKILL.md` (Agent Skills standard).
2. **Subagent Frontmatter:** Formats agents with `# ${agent.name}` headers and markdown bullets.  
   *Fix:* Antigravity requires strict YAML frontmatter:
   ```yaml
   ---
   name: code-auditor
   description: Specialized security agent
   tools:
     - view_file
     - grep_search
     - run_command
   subagent: true
   mainAgent: false
   model: inherit
   commandExecutionPolicy: sandbox
   ---
   ```
3. **Hook Schema:** Emits a flat JSON array `[{ event, type, command }]`.  
   *Fix:* Antigravity requires named top-level objects with event keys and nested regex matcher arrays:
   ```json
   {
     "my-hook": {
       "PreToolUse": [
         {
           "matcher": "run_command",
           "hooks": [
             {
               "type": "command",
               "command": "./scripts/check.sh",
               "timeout": 30
             }
           ]
         }
       ]
     }
   }
   ```
4. **MCP Destination & Filename:** Emits `mcp.json`.  
   *Fix:* Must emit `.agents/mcp_config.json` with absolute paths.
5. **Workflows:** Emits warning `"Workflows not directly supported"`.  
   *Fix:* Workflows are natively supported in Antigravity under `.agents/workflows/<name>.md`.
6. **Rules:** Emits plain markdown without trigger metadata.  
   *Fix:* Add frontmatter: `trigger: always_on`, `managed_by: agentpm`.

---

## 2. Universal Tool Name & Matcher Translation (`src/ir/tool-mapper.ts`)

### Required Implementation:
A dedicated bidirectional tool name mapping module:

| Category | Claude Code / Generic | Antigravity Native | OpenCode Native |
| :--- | :--- | :--- | :--- |
| **Shell** | `bash`, `shell`, `terminal` | `run_command` | `bash` |
| **Read** | `read_file`, `cat`, `read` | `view_file` | `read` |
| **Write** | `write_file`, `create_file` | `write_to_file` | `edit` |
| **Edit** | `edit_file`, `str_replace` | `replace_file_content` | `edit` |
| **Multi-Edit** | `multi_edit`, `batch_edit` | `multi_replace_file_content` | `edit` |
| **List Dir** | `list_files`, `ls`, `dir` | `list_dir` | `glob` |
| **Find File** | `find_files`, `glob` | `find_by_name` | `glob` |
| **Grep** | `grep`, `search`, `rg` | `grep_search` | `grep` |
| **Fetch URL** | `fetch`, `curl`, `read_url` | `read_url_content` | `webfetch` |
| **Subagents** | `subagent`, `spawn` | `invoke_subagent` | `task` |

- When translating hooks: Convert matcher `{ "toolName": "bash" }` $\rightarrow$ `"run_command"` (regex). Wildcard `*` $\rightarrow$ `.*`.
- When translating subagents: Map tools array in YAML frontmatter.

---

## 3. Hook Conversion Engine (`src/ir/hook-converter.ts`)

### Required Implementation:
- **Claude Code (31 events) $\rightarrow$ Antigravity (5 events):**
  - Lossless mapping for: `PreToolUse`, `PostToolUse`, `PreInvocation`, `PostInvocation`, `Stop`.
  - Convert `decision: "block"` $\rightarrow$ `decision: "deny"`.
  - Skip 26 unsupported events (`SessionStart`, `PermissionRequest`, `ConfigChange`, etc.) and append structured warnings in `ConversionResult.warnings`.
- **PreInvocation Step Injection:**
  Format step injection responses properly:
  ```json
  {
    "injectSteps": [
      { "ephemeralMessage": "..." },
      { "toolCall": { "name": "run_command", "args": { "CommandLine": "npm test" } } }
    ]
  }
  ```

---

## 4. MCP Path Rewriting Module (`src/core/mcp-rewriter.ts`)

### Required Implementation:
```typescript
export function rewriteMcpPaths(
  mcpConfig: Record<string, unknown>,
  pluginStorePath: string,
  targetProvider: 'antigravity' | 'claude-code' | 'opencode' | 'codex' | 'pi'
): Record<string, unknown>
```
1. **Expand `${CLAUDE_PLUGIN_ROOT}`:** Replace with the absolute resolved path to the plugin directory in the store.
2. **Resolve Relative `cwd` and `args`:** Convert `./scripts/server.js` $\rightarrow$ `/absolute/path/to/scripts/server.js`.
3. **Codex CLI Resolution:** For Codex, expand all paths to absolute because Codex resolves relative `cwd` from the launch directory, not workspace root.

---

## 5. Commands $\leftrightarrow$ Workflows Converter (`src/ir/command-converter.ts`)

### Required Implementation:
- **Claude Code Command $\rightarrow$ Antigravity Workflow:**
  - If multi-step: write `.agents/workflows/<name>.md` with YAML frontmatter (`name`, `description`).
  - Check size: If $> 12,000$ characters, convert to `.agents/skills/<name>/SKILL.md` to prevent Antigravity engine rejection.
- **Antigravity Workflow $\rightarrow$ Claude Code Command:**
  - Strip YAML frontmatter, prepend `# /<name>`, write `.claude/commands/<name>.md`.

---

## 6. Pi Coding Agent Adapter (`src/adapters/pi.ts`)

### Greenfield Implementation:
- **Detection Markers:** `.pi/` directory or `~/.pi/` global config.
- **Paths:** Global `~/.pi/agent/extensions/`, local `.pi/extensions/`.
- **Skills:** Register with `/skill:` prefix in extension API.
- **Hooks:** Synthesize TypeScript `ExtensionAPI` event listener code (`pi.on("session_start", ...)`).
- **Trust Configuration:** Update `~/.pi/agent/trust.json`.

---

## 7. Workspace State & Lockfile Engine (`src/core/lockfile.ts`)

### Required Implementation (`.agentpm.lock`):
Maintain an atomic `.agentpm.lock` in the workspace root:

```json
{
  "version": 1,
  "installs": {
    "nvidia-skills": {
      "version": "1.0.0",
      "source": "github:nvidia/skills",
      "hash": "sha256:40aa48b8...",
      "installedAt": "2026-08-10T03:25:00Z",
      "agents": {
        "antigravity": {
          "syncedAt": "2026-08-10T03:25:01Z",
          "adapterVersion": "2026.08.01",
          "files": [
            { "path": ".agents/skills/nvidia-skills", "type": "skill", "managed": true },
            { "path": ".agents/rules/nvidia-rules.md", "type": "rule", "managed": true },
            { "path": ".agents/mcp_config.json", "type": "mcp", "managed": true }
          ]
        }
      }
    }
  }
}
```

### Operations Enabled:
1. `agentpm install <pkg> --for <agent>`: Records written files in `.agentpm.lock`.
2. `agentpm uninstall <pkg>`: Surgically deletes tracked files and cleans injected `CLAUDE.md` sections without leaving orphan files.
3. `agentpm sync`: Compares lockfile hashes and adapter versions; re-materializes drifted files.

---

## 8. CLI Command Surface Alignment (`src/index.ts`)

Align commands with specification:
- `agentpm install <name> [--for <agent|all>] [--copy]`
- `agentpm uninstall <name> [--for <agent|all>]`
- `agentpm sync [--plugin <name>] [--agent <agent>]`
- `agentpm detect [--verbose]`
- `agentpm convert <path> --from <agent> --to <agent> [--dry-run]`
- `agentpm update-adapters`

---

## File Modification Plan

| File | Action | Description |
| :--- | :--- | :--- |
| `src/adapters/antigravity.ts` | **Rewrite** | Fix skill paths, agent YAML frontmatter, nested regex hooks, `mcp_config.json`, workflows |
| `src/adapters/pi.ts` | **Create** | Implement Pi Coding Agent adapter |
| `src/ir/tool-mapper.ts` | **Create** | Universal tool mapping dictionary & regex matcher generator |
| `src/ir/hook-converter.ts` | **Create** | Bi-directional hook schema converter & lossy warning generator |
| `src/ir/command-converter.ts`| **Create** | Bidirectional Commands $\leftrightarrow$ Workflows converter (with 12k limit check) |
| `src/core/mcp-rewriter.ts` | **Create** | Path expansion engine for `${CLAUDE_PLUGIN_ROOT}` & relative `cwd` |
| `src/core/lockfile.ts` | **Create** | `.agentpm.lock` parser, serializer, and drift detector |
| `src/adapters/codex.ts` | **Update** | Dereference symlinks on cache staging; expand relative MCP paths |
| `src/adapters/claudecode.ts` | **Update** | Support bounded marker injection for `CLAUDE.md` rules |
| `src/adapters/opencode.ts` | **Update** | Synthesize `@opencode-ai/plugin` wrapper for hooks |
| `src/core/materialization.ts`| **Update** | Integrate with `.agentpm.lock` and dual-action symlink/transform pipeline |
| `src/commands/convert.ts` | **Update** | Support `--from` and `--to` flags with dry-run mode |
| `src/commands/sync.ts` | **Create** | Implement workspace re-materialization command |
| `src/commands/detect.ts` | **Create** | Implement multi-agent detection and verbose health auditing |
| `src/index.ts` | **Update** | Wire up `agentpm` binary alias, `sync`, `detect`, and updated flags |

---

## Implementation Roadmap (5 Phases)

### Phase 1: Core Transformers & Mappers
- Build `src/ir/tool-mapper.ts` (tool vocabularies).
- Build `src/core/mcp-rewriter.ts` (path resolution).
- Build `src/ir/hook-converter.ts` (schema restructuring).
- Build `src/ir/command-converter.ts` (command $\leftrightarrow$ workflow).

### Phase 2: Refactor Antigravity & Pi Adapters
- Rewrite `src/adapters/antigravity.ts` to output compliant schemas.
- Implement `src/adapters/pi.ts`.

### Phase 3: Workspace Lockfile & Precise Materialization
- Implement `src/core/lockfile.ts` managing `.agentpm.lock`.
- Update `src/core/materialization.ts` to track `MaterializedFile[]` and inject `CLAUDE.md` markers.

### Phase 4: CLI Commands & Multi-Agent Operations
- Implement `syncCommand` (`src/commands/sync.ts`).
- Implement `detectCommand` (`src/commands/detect.ts`).
- Update `src/index.ts` command options (`--for`, `--from`, `--to`).

### Phase 5: Verification & End-to-End Testing
- Write test suites in `test/conversion-antigravity.test.ts`, `test/mcp-rewriter.test.ts`, `test/hook-converter.test.ts`, `test/lockfile.test.ts`.
- Verify real-world conversion against `nvidia/skills`.
