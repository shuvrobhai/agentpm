/**
 * Simple TOML serializer for converting Markdown Agent definitions into Codex agent TOML specs.
 */
export function stringifyAgentToml(agent: { name: string; description?: string; prompt?: string; tools?: string[]; model?: string }): string {
  const lines: string[] = [];
  lines.push(`name = ${JSON.stringify(agent.name)}`);
  if (agent.description) {
    lines.push(`description = ${JSON.stringify(agent.description)}`);
  }
  if (agent.model) {
    lines.push(`model = ${JSON.stringify(agent.model)}`);
  }
  if (agent.tools && agent.tools.length > 0) {
    lines.push(`tools = ${JSON.stringify(agent.tools)}`);
  }
  if (agent.prompt) {
    lines.push(`prompt = """\n${agent.prompt.trim()}\n"""`);
  }
  return lines.join('\n') + '\n';
}

/** @deprecated Use stringifyAgentToml */
export const TomlBuilder = {
  stringifyAgent: stringifyAgentToml,
};

