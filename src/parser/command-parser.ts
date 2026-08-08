import path from 'node:path';
import { readFile, listFilesByExtension, exists } from '../utils/fs.js';
import { parseFrontmatter, detectVariables, detectDynamicInjections } from '../utils/yaml.js';
import type { CommandIR } from '../ir/types.js';

export async function parseCommands(pluginDir: string): Promise<CommandIR[]> {
  const commandsDir = path.join(pluginDir, 'commands');
  if (!await exists(commandsDir)) return [];

  const mdFiles = await listFilesByExtension(commandsDir, '.md');
  const commands: CommandIR[] = [];

  for (const file of mdFiles) {
    const filePath = path.join(commandsDir, file);
    const raw = await readFile(filePath);
    if (!raw) continue;

    const { data, content } = parseFrontmatter(raw);
    const name = path.basename(file, '.md');

    commands.push({
      name,
      description: (data.description as string) || '',
      body: content,
      rawFrontmatter: data,
      variables: detectVariables(content),
      dynamicInjections: detectDynamicInjections(content),
      sourcePath: filePath,
    });
  }

  return commands;
}
