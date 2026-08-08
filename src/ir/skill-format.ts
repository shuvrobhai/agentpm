import type { PortableSkillIR } from './types.js';

/**
 * Formats a portable skill as an Agent Skills `SKILL.md` (frontmatter + body).
 * Shared by the portable v1 writer and the native emitters that consume
 * `skills/<name>/SKILL.md` in the Agent Skills directory form (claude-code,
 * codex, opencode).
 */
export function formatAgentSkill(skill: PortableSkillIR): string {
  const lines: string[] = ['---'];
  const frontmatter: Record<string, unknown> = {
    name: skill.name,
    description: skill.description,
  };
  for (const [key, value] of Object.entries(skill.rawFrontmatter)) {
    if (key === 'name' || key === 'description') continue;
    frontmatter[key] = value;
  }
  lines.push(JSON.stringify(frontmatter, null, 2));
  lines.push('---');
  lines.push('');
  lines.push(skill.body);
  return lines.join('\n');
}

/**
 * Emits a supported-files warning for emitters that only write SKILL.md text
 * (the `FileOutput` surface cannot carry the skill's sibling scripts/assets).
 */
export function skillSupportingFilesWarning(skill: PortableSkillIR): string | undefined {
  if (skill.supportingFiles.length === 0) return undefined;
  return (
    `Skill "${skill.name}": supporting files (${skill.supportingFiles.join(', ')}) ` +
    'must be copied into the target skill directory — this emitter writes SKILL.md only'
  );
}
