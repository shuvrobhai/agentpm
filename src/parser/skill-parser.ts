import path from 'node:path';
import { readFile, listSubdirs, listFilesRecursive, exists } from '../utils/fs.js';
import { parseFrontmatter, detectVariables, detectDynamicInjections } from '../utils/yaml.js';
import type { SkillIR } from '../ir/types.js';

export async function parseSkills(pluginDir: string): Promise<SkillIR[]> {
  const skillsDir = path.join(pluginDir, 'skills');
  if (!await exists(skillsDir)) return [];

  const skillDirs = await listSubdirs(skillsDir);
  const skills: SkillIR[] = [];

  for (const dirName of skillDirs) {
    const skillDir = path.join(skillsDir, dirName);
    const skillMdPath = path.join(skillDir, 'SKILL.md');

    const raw = await readFile(skillMdPath);
    if (!raw) continue;

    const { data, content } = parseFrontmatter(raw);
    const variables = detectVariables(content);
    const dynamicInjections = detectDynamicInjections(content);

    const allFiles = await listFilesRecursive(skillDir);
    const supportingFiles = allFiles.filter(f => f !== 'SKILL.md');

    skills.push({
      name: (data.name as string) || dirName,
      description: (data.description as string) || '',
      body: content,
      rawFrontmatter: data,
      supportingFiles,
      variables,
      dynamicInjections,
      sourcePath: skillMdPath,
      sourceDir: skillDir,
    });
  }

  return skills;
}
