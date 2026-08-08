import type {
  PluginIR,
  PortableCoreIR,
  PortableMCPServerIR,
  PortableSkillIR,
} from './types.js';

/**
 * The single narrowing seam (ADR 0013). `parsePlugin` keeps producing the full
 * 9-type PluginIR for inspection; `toPortableCore` narrows it to the portable
 * v1 core — Agent Skills + MCP servers — with every other component preserved
 * in the three-tier extensions bag.
 */
export function toPortableCore(ir: PluginIR): PortableCoreIR {
  return {
    source: ir.source,
    metadata: ir.metadata,
    skills: ir.skills.map(narrowSkill),
    mcpServers: ir.mcpServers.map(narrowMcpServer),
    extensions: {
      hooks: ir.hooks,
      agents: ir.agents,
      commands: ir.commands,
      rules: ir.rules,
      ...(ir.contextFile !== undefined ? { contextFile: ir.contextFile } : {}),
      outputStyles: ir.outputStyles,
      workflows: ir.workflows,
      opaque: {},
    },
    warnings: ir.warnings,
  };
}

function narrowSkill(skill: PluginIR['skills'][number]): PortableSkillIR {
  return {
    name: skill.name,
    description: skill.description,
    body: skill.body,
    rawFrontmatter: skill.rawFrontmatter,
    supportingFiles: skill.supportingFiles,
    sourcePath: skill.sourcePath,
    sourceDir: skill.sourceDir,
  };
}

function narrowMcpServer(server: PluginIR['mcpServers'][number]): PortableMCPServerIR {
  return {
    name: server.name,
    // The parser models remote servers as `type: 'url'`; the portable core
    // requires an explicit transport, so map to streamable-http.
    type: server.type === 'url' ? 'streamable-http' : server.type || 'stdio',
    ...(server.command !== undefined ? { command: server.command } : {}),
    ...(server.args !== undefined ? { args: server.args } : {}),
    ...(server.env !== undefined ? { env: server.env } : {}),
    ...(server.url !== undefined ? { url: server.url } : {}),
    ...(server.headers !== undefined ? { headers: server.headers } : {}),
    ...(server.cwd !== undefined ? { cwd: portableCwd(server.cwd) } : {}),
    ...(server.disabled !== undefined ? { disabled: server.disabled } : {}),
    sourcePath: server.sourcePath,
  };
}

/**
 * Portable cwd: keep PLUGIN_ROOT/PLUGIN_DATA-relative and ./-relative paths,
 * otherwise prefix ./ so the value is unambiguous inside the portable package.
 */
function portableCwd(value: string): string {
  const trimmed = value.trim();
  if (trimmed === '' || trimmed === '.') return './';
  if (trimmed.startsWith('${PLUGIN_ROOT}') || trimmed.startsWith('${PLUGIN_DATA}')) {
    return trimmed;
  }
  if (trimmed.startsWith('./')) return trimmed;
  return `./${trimmed.replace(/^\.\//, '')}`;
}
