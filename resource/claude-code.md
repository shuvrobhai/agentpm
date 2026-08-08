# Claude Code Agent Specifications

> **Target Directory:** `~/.claude/plugins/<plugin>` (Global) / `.agents/plugins/<plugin>` or `.claude/plugins/` (Workspace)  
> **Manifest Location:** `.claude-plugin/plugin.json`  
> **Hooks Definition:** `hooks/hooks.json` or inline in `plugin.json`  
> **MCP Configuration:** `.mcp.json`  
> **Instruction File:** `CLAUDE.md`  

---

## 1. Manifest Schema (`.claude-plugin/plugin.json`)

```json
{
  "name": "superpowers",
  "version": "6.2.0",
  "description": "Core skills library for Claude Code",
  "author": {
    "name": "Jesse Vincent",
    "email": "jesse@fsck.com"
  },
  "homepage": "https://github.com/obra/superpowers",
  "repository": "https://github.com/obra/superpowers",
  "license": "MIT",
  "keywords": ["skills", "tdd", "debugging"],
  "hooks": "./hooks/hooks.json",
  "mcpServers": "./.mcp.json"
}
```

---

## 2. Lifecycle Hook Events (31 PascalCase Events)

Claude Code supports 31 declarative PascalCase hook lifecycle events:

| Event | Category | Description |
|---|---|---|
| `PreToolUse` | Tool Call | Triggered before tool execution; can evaluate arguments or abort execution |
| `PostToolUse` | Tool Call | Triggered after tool returns success |
| `PostToolUseFailure` | Tool Call | Triggered when a tool throws an error |
| `PostToolBatch` | Tool Call | Triggered after parallel tool calls finish |
| `PreInvocation` | Invocation | Before agent model invocation |
| `PostInvocation` | Invocation | After agent model generates response |
| `Stop` | Turn | When agent stops execution |
| `StopFailure` | Turn | When stop condition fails |
| `SessionStart` | Lifecycle | At start of new session |
| `SessionEnd` | Lifecycle | At teardown of session |
| `UserPromptSubmit` | Turn | When user submits a prompt |
| `PermissionRequest` | Permission | When sensitive action requires elevation |
| `PermissionDenied` | Permission | When user or rule denies permission |
| `SubagentStart` | Subagent | When subagent is spawned |
| `SubagentStop` | Subagent | When subagent completes |
| `Notification` | UI | On system notification |
| `MessageDisplay` | UI | On message rendering in TUI |
| `ConfigChange` | Env | On configuration change |
| `CwdChanged` | Env | On working directory modification |
| `FileChanged` | Env | When watched files are updated |
| `DirectoryAdded` | Env | When new directories are discovered |
| `WorktreeCreate` | Worktree | On git worktree creation |
| `WorktreeRemove` | Worktree | On git worktree deletion |
| `PreCompact` | Context | Before context compaction |
| `PostCompact` | Context | After context compaction |
| `Elicitation` | MCP | On MCP elicitation request |
| `ElicitationResult` | MCP | On MCP elicitation completion |
| `InstructionsLoaded`| Rules | When `CLAUDE.md` / rules are loaded |
| `TeammateIdle` | Multi-Agent | When team agent is waiting |
| `TaskCreated` | Tasks | When task is registered |
| `TaskCompleted` | Tasks | When task is finished |

---

## 3. Path Portability
Claude Code uses the `${CLAUDE_PLUGIN_ROOT}` variable in hook commands, arguments, and scripts to locate assets relative to the installed plugin root.
When converting to other agent runtimes, this variable must be expanded to the absolute installation directory.
