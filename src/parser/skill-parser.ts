import path from 'node:path';
import { stat } from 'node:fs/promises';
import { readFile, readJson, listSubdirs, listFilesRecursive, exists } from '../utils/fs.js';
import { parseFrontmatter, detectVariables, detectDynamicInjections } from '../utils/yaml.js';
import type { SkillIR } from '../ir/types.js';

/**
 * Discovers skills in a plugin. Two sources, deduped by resolved skill dir:
 *
 * 1. The `.claude-plugin/plugin.json` `skills` array — Claude Code's declaration
 *    mechanism, which also covers nested layouts (`skills/engineering/foo`).
 * 2. The flat Agent Skills convention `skills/<name>/SKILL.md`.
 */
export async function parseSkills(pluginDir: string): Promise<SkillIR[]> {
  const skills: SkillIR[] = [];
  const seen = new Set<string>();

  const addSkillDir = async (skillDir: string): Promise<void> => {
    const key = path.resolve(skillDir);
    if (seen.has(key)) return;
    seen.add(key);

    const skillMdPath = path.join(skillDir, 'SKILL.md');
    const raw = await readFile(skillMdPath);
    if (!raw) return;

    const { data, content } = parseFrontmatter(raw);
    const variables = detectVariables(content);
    const dynamicInjections = detectDynamicInjections(content);

    const allFiles = await listFilesRecursive(skillDir);
    const supportingFiles = allFiles.filter(f => f !== 'SKILL.md');

    skills.push({
      name: (data.name as string) || path.basename(skillDir),
      description: (data.description as string) || '',
      body: content,
      rawFrontmatter: data,
      supportingFiles,
      variables,
      dynamicInjections,
      sourcePath: skillMdPath,
      sourceDir: skillDir,
    });
  };

  const manifest = await readJson<Record<string, unknown>>(
    path.join(pluginDir, '.claude-plugin', 'plugin.json'),
  );
  const declaredSkills = Array.isArray(manifest?.skills)
    ? manifest.skills.filter((s): s is string => typeof s === 'string')
    : [];

  for (const declared of declaredSkills) {
    const skillDir = await resolveSkillDir(path.resolve(pluginDir, declared));
    if (skillDir) await addSkillDir(skillDir);
  }

  const skillsDir = path.join(pluginDir, 'skills');
  if (await exists(skillsDir)) {
    const skillDirs = await listSubdirs(skillsDir);
    for (const dirName of skillDirs) {
      await addSkillDir(path.join(skillsDir, dirName));
    }
  }

  return skills;
}

/**
 * Manifest entries point at skill directories (containing SKILL.md). Accept a
 * direct SKILL.md path too and normalize to its parent dir.
 */
async function resolveSkillDir(candidate: string): Promise<string | null> {
  let st;
  try {
    st = await stat(candidate);
  } catch {
    return null;
  }
  if (st.isDirectory()) return candidate;
  if (st.isFile() && candidate.endsWith('.md')) return path.dirname(candidate);
  return null;
}
