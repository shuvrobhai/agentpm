import path from 'node:path';
import { readFile, listFilesByExtension, exists } from '../utils/fs.js';
import { parseFrontmatter } from '../utils/yaml.js';
import type { AgentIR } from '../ir/types.js';

export async function parseAgents(pluginDir: string): Promise<AgentIR[]> {
  const agentsDir = path.join(pluginDir, 'agents');
  if (!await exists(agentsDir)) return [];

  const mdFiles = await listFilesByExtension(agentsDir, '.md');
  const agents: AgentIR[] = [];

  for (const file of mdFiles) {
    const filePath = path.join(agentsDir, file);
    const raw = await readFile(filePath);
    if (!raw) continue;

    const { data, content } = parseFrontmatter(raw);
    const name = (data.name as string) || path.basename(file, '.md');

    const hooks = data.hooks as Record<string, unknown> | undefined;
    const skills = data.skills as string[] | undefined;
    const memory = data.memory as string | undefined;
    const model = data.model as string | undefined;
    const background = data.background as boolean | undefined;

    agents.push({
      name,
      description: (data.description as string) || '',
      body: content,
      tools: (data.tools as string[]) || [],
      ...(model !== undefined ? { model } : {}),
      ...(hooks !== undefined ? { hooks } : {}),
      ...(memory !== undefined ? { memory } : {}),
      ...(skills !== undefined ? { skills } : {}),
      ...(background !== undefined ? { background } : {}),
      rawFrontmatter: data,
      sourcePath: filePath,
    });
  }

  return agents;
}
