import path from 'node:path';
import { readJson } from '../utils/fs.js';
import { resolveSource } from './source-resolver.js';
import { parseSkills } from './skill-parser.js';
import { parseCommands } from './command-parser.js';
import { parseAgents } from './agent-parser.js';
import { parseRules, parseContextFile } from './rules-parser.js';
import { parseHooks } from './hooks-parser.js';
import { parseMCPServers } from './mcp-parser.js';
import { parseOutputStyles } from './output-style-parser.js';
import { parseWorkflows } from './workflow-parser.js';
import type { PluginIR } from '../ir/types.js';

export async function parsePlugin(input: string): Promise<PluginIR> {
  console.log('\n[1/2] Resolving source...');
  const source = await resolveSource(input);
  console.log(`✅ Found plugin: "${source.pluginName}" at ${source.resolvedPath}`);

  const pluginDir = source.resolvedPath;
  const warnings: string[] = [];

  const manifestPath = path.join(pluginDir, '.claude-plugin', 'plugin.json');
  let metadata = (await readJson(manifestPath)) || {};

  // Portable v1 sources carry their manifest at the root as plugin.json
  // (closed schema). Fall back to it so converting a portable package keeps
  // its name/version/description metadata through the seam.
  if (Object.keys(metadata).length === 0) {
    const portableManifest = await readJson(path.join(pluginDir, 'plugin.json'));
    if (portableManifest && typeof portableManifest === 'object') {
      metadata = portableManifest;
    }
  }

  console.log('\n[2/2] Scanning for components...');

  const [skills, commands, agents, rules, contextFile, hooks, mcpServers, outputStyles, workflows] =
    await Promise.all([
      parseSkills(pluginDir),
      parseCommands(pluginDir),
      parseAgents(pluginDir),
      parseRules(pluginDir),
      parseContextFile(pluginDir),
      parseHooks(pluginDir),
      parseMCPServers(pluginDir),
      parseOutputStyles(pluginDir),
      parseWorkflows(pluginDir),
    ]);

  for (const skill of skills) {
    if (skill.rawFrontmatter['disable-model-invocation']) {
      warnings.push(`Skill "${skill.name}": dropped disable-model-invocation (no equivalent in target agents)`);
    }
    if (skill.rawFrontmatter['allowed-tools']) {
      warnings.push(`Skill "${skill.name}": dropped allowed-tools (noted in body)`);
    }
    if (skill.rawFrontmatter['context'] === 'fork') {
      warnings.push(`Skill "${skill.name}": context:fork → only Antigravity can replicate subagent behavior`);
    }
    if (skill.variables.length > 0) {
      warnings.push(`Skill "${skill.name}": found variables [${skill.variables.join(', ')}] → will convert to user prompts`);
    }
    if (skill.dynamicInjections.length > 0) {
      warnings.push(`Skill "${skill.name}": found ${skill.dynamicInjections.length} dynamic injection(s) → will convert to terminal instructions`);
    }
  }

  for (const agent of agents) {
    if (agent.memory) {
      warnings.push(`Agent "${agent.name}": persistent memory not available in most targets → use Cline Docs / Qwen memory`);
    }
    if (agent.background) {
      warnings.push(`Agent "${agent.name}": background execution → only Antigravity supports subagent orchestration`);
    }
  }

  for (const hook of hooks) {
    if (hook.type === 'http') {
      warnings.push(`Hook "${hook.event}": HTTP hook → may need manual alternative in target agent`);
    }
    if (hook.type === 'mcp_tool') {
      warnings.push(`Hook "${hook.event}": MCP tool hook → verify MCP server is configured in target agent`);
    }
  }

  for (const server of mcpServers) {
    const argsStr = JSON.stringify(server.args || []);
    if (argsStr.includes('${CLAUDE_PLUGIN_ROOT}')) {
      warnings.push(`MCP "${server.name}": contains \${CLAUDE_PLUGIN_ROOT} → will replace with absolute path`);
    }
    if (server.type === 'url') {
      warnings.push(`MCP "${server.name}": type "url" → will convert to "streamableHttp" for Cline`);
    }
  }

  const ir: PluginIR = {
    source,
    skills,
    commands,
    agents,
    rules,
    ...(contextFile !== undefined ? { contextFile } : {}),
    hooks,
    mcpServers,
    outputStyles,
    workflows,
    metadata,
    warnings,
  };

  return ir;
}

export function printIRSummary(ir: PluginIR): void {
  console.log('');
  console.log(`📦 Plugin: ${ir.source.pluginName}`);
  if (ir.source.pluginDescription) {
    console.log(`   ${ir.source.pluginDescription}`);
  }
  console.log(`   Source: ${ir.source.type} → ${ir.source.resolvedPath}`);

  console.log('\n🔍 Detected Components:');

  const components: [string, number, string][] = [
    ['Skills', ir.skills.length, ir.skills.map(s => s.name).join(', ')],
    ['Commands', ir.commands.length, ir.commands.map(c => c.name).join(', ')],
    ['Agents', ir.agents.length, ir.agents.map(a => a.name).join(', ')],
    ['Rules', ir.rules.length, ir.rules.map(r => r.name).join(', ')],
    ['Context', ir.contextFile ? 1 : 0, ir.contextFile ? `${ir.contextFile.filename} (${ir.contextFile.sections.length} sections)` : ''],
    ['Hooks', ir.hooks.length, ir.hooks.map(h => `${h.event}:${h.type}`).join(', ')],
    ['MCP Servers', ir.mcpServers.length, ir.mcpServers.map(m => m.name).join(', ')],
    ['Output Styles', ir.outputStyles.length, ir.outputStyles.map(o => o.name).join(', ')],
    ['Workflows', ir.workflows.length, ir.workflows.map(w => w.name).join(', ')],
  ];

  for (const [label, count, detail] of components) {
    if (count > 0) {
      console.log(`✅ ${label}: ${count} ${detail ? `(${detail})` : ''}`);
    } else {
      console.log(`   ⬜ ${label}: 0`);
    }
  }

  if (ir.skills.length > 0) {
    console.log('\n🧠 Skill Details:');
    for (const skill of ir.skills) {
      console.log(`   ┌─ ${skill.name}`);
      console.log(`   │  Description: ${skill.description.slice(0, 80)}${skill.description.length > 80 ? '...' : ''}`);
      if (skill.variables.length > 0) {
        console.log(`   │  Variables: ${skill.variables.join(', ')}`);
      }
      if (skill.dynamicInjections.length > 0) {
        console.log(`   │  Injections: ${skill.dynamicInjections.join(', ')}`);
      }
      if (skill.supportingFiles.length > 0) {
        console.log(`   │  Files: ${skill.supportingFiles.join(', ')}`);
      }
      const droppedFields = Object.keys(skill.rawFrontmatter).filter(f =>
        !['name', 'description'].includes(f)
      );
      if (droppedFields.length > 0) {
        console.log(`   │  Extra frontmatter: ${droppedFields.join(', ')}`);
      }
      console.log(`   └─`);
    }
  }

  if (ir.agents.length > 0) {
    console.log('\n🤖 Agent Details:');
    for (const agent of ir.agents) {
      console.log(`   ┌─ ${agent.name}`);
      console.log(`   │  Description: ${agent.description.slice(0, 80)}`);
      console.log(`   │  Tools: ${agent.tools.join(', ') || 'none specified'}`);
      if (agent.model) console.log(`   │  Model: ${agent.model}`);
      if (agent.memory) console.log(`   │  Memory: ${agent.memory}`);
      if (agent.background) console.log(`   │  Background: yes`);
      console.log(`   └─`);
    }
  }

  if (ir.warnings.length > 0) {
    console.log('\n⚠️  Conversion Warnings:');
    for (const warning of ir.warnings) {
      console.log(`   ⚠️  ${warning}`);
    }
  }

  console.log('');
}
