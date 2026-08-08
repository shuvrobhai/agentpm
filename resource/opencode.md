# OpenCode AI Agent Specifications

> **Target Directory:** `~/.config/opencode/plugins/<plugin>` (Global) / `.agents/plugins/<plugin>` or `.opencode/plugins/` (Workspace)  
> **Manifest Location:** `opencode.json`  
> **Active Skills:** `.opencode/skills/<name>/SKILL.md`  
> **Rules:** `.opencode/rules/`  
> **Agents:** `.opencode/agents/`  
> **TypeScript Plugins:** `@opencode-ai/plugin`  

---

## 1. Manifest Schema (`opencode.json`)

```json
{
  "$schema": "https://opencode.ai/schemas/v1/plugin.json",
  "name": "superpowers",
  "version": "1.0.0",
  "description": "Core skills library for OpenCode AI",
  "skills": "./.opencode/skills/",
  "mcpServers": [
    {
      "name": "dev-tools",
      "type": "stdio",
      "command": "node",
      "args": ["./dist/server.js"],
      "env": {
        "NODE_ENV": "production"
      }
    }
  ]
}
```

---

## 2. In-Process Plugin SDK (`@opencode-ai/plugin`)

OpenCode can execute TypeScript plugins in-process within Bun / Node:

```typescript
import { definePlugin } from '@opencode-ai/plugin';

export default definePlugin({
  name: 'audit-plugin',
  hooks: {
    'session.created': async (session) => {
      console.log('Session started:', session.id);
    },
    'tool.execute.before': async (event) => {
      if (event.tool === 'run_command' && event.args.includes('rm -rf /')) {
        throw new Error('Blocked destructive command');
      }
    }
  }
});
```
