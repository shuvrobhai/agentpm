# Google Antigravity / Gemini CLI Agent Specifications

> **Target Directory:** `~/.gemini/config/plugins/<plugin>` (Global) / `.agents/plugins/<plugin>` (Workspace Primary)  
> **Manifest Location:** `plugin.json`  
> **Active Skills:** `.agents/skills/<name>/SKILL.md`  
> **Active Rules:** `.agents/rules/<plugin>-<name>.md`  
> **Hooks Definition:** `.agents/hooks.json`  
> **MCP Configuration:** `.agents/mcp_config.json`  
> **Project Context:** `.agents/AGENTS.md`  

---

## 1. Directory Structure

```
<workspace>/
├── .agents/                         # PRIMARY Canonical Target
│   ├── plugins/                     # Direct symlinks to clean bundles in store
│   │   └── <plugin-name>/
│   ├── skills/                      # Active discovered skills
│   │   └── <skill-name>/
│   │       └── SKILL.md
│   ├── rules/                       # Behavioral rules with trigger frontmatter
│   │   └── <plugin-name>-<rule>.md
│   ├── agents/                      # Subagent YAML frontmatter definitions
│   │   └── <agent-name>.md
│   ├── workflows/                   # Multi-step task flows (/workflow)
│   │   └── <workflow-name>.md
│   ├── mcp_config.json              # MCP server configurations
│   ├── hooks.json                   # Named declarative lifecycle hooks
│   └── AGENTS.md                    # Project-level context & guidance
```

---

## 2. Named Hooks Schema (`hooks.json`)

Antigravity uses a named object structure where each hook has a unique identifier, regex tool matchers, and explicit execution targets:

```json
{
  "safety-guard": {
    "enabled": true,
    "PreToolUse": [
      {
        "matcher": "run_command",
        "hooks": [
          {
            "type": "command",
            "command": "./scripts/safety_check.sh",
            "timeout": 15
          }
        ]
      }
    ]
  }
}
```

### PreToolUse Decision Protocol
`PreToolUse` hooks receive JSON over `stdin` and return:
```json
{
  "decision": "allow",
  "reason": "Command conforms to policy rules"
}
```
Supported decisions: `"allow"`, `"deny"`, `"ask"`, `"force_ask"`, `"deny_unless_prior_grant"`.

---

## 3. Subagent Definition Schema

```yaml
---
name: code-reviewer
description: Specialized subagent for code quality audits
tools:
  - view_file
  - grep_search
  - run_command
subagent: true
mainAgent: false
model: pro
commandExecutionPolicy: sandbox
skills:
  - skills/code-review
---

# System Prompt
You are an expert code reviewer...
```
