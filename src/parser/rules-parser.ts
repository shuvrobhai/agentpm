import path from 'node:path';
import { readFile, listFilesByExtension, exists } from '../utils/fs.js';
import { parseFrontmatter } from '../utils/yaml.js';
import type { RuleIR, ContextFileIR, ContextSection } from '../ir/types.js';

export async function parseRules(pluginDir: string): Promise<RuleIR[]> {
  const rulesDir = path.join(pluginDir, 'rules');
  if (!await exists(rulesDir)) return [];

  const mdFiles = await listFilesByExtension(rulesDir, '.md');
  const rules: RuleIR[] = [];

  for (const file of mdFiles) {
    const filePath = path.join(rulesDir, file);
    const raw = await readFile(filePath);
    if (!raw) continue;

    const { data } = parseFrontmatter(raw);
    const name = path.basename(file, '.md');
    const paths = data.paths as string[] | undefined;

    rules.push({
      name,
      content: raw,
      ...(paths !== undefined ? { paths } : {}),
      sourcePath: filePath,
    });
  }

  return rules;
}

export async function parseContextFile(pluginDir: string): Promise<ContextFileIR | undefined> {
  const claudeMdPath = path.join(pluginDir, 'CLAUDE.md');
  const raw = await readFile(claudeMdPath);
  if (!raw) return undefined;

  const sections = splitIntoSections(raw);

  return {
    filename: 'CLAUDE.md',
    content: raw,
    sections,
    sourcePath: claudeMdPath,
  };
}

function splitIntoSections(content: string): ContextSection[] {
  const lines = content.split('\n');
  const sections: ContextSection[] = [];
  let currentHeading = '';
  let currentLevel = 0;
  let currentLines: string[] = [];

  for (const line of lines) {
    const headingMatch = line.match(/^(#{1,6})\s+(.+)/);

    if (headingMatch) {
      if (currentHeading || currentLines.length > 0) {
        sections.push({
          heading: currentHeading,
          content: currentLines.join('\n').trim(),
          level: currentLevel,
        });
      }

      currentLevel = (headingMatch[1] as string).length;
      currentHeading = (headingMatch[2] as string).trim();
      currentLines = [];
    } else {
      currentLines.push(line);
    }
  }

  if (currentHeading || currentLines.length > 0) {
    sections.push({
      heading: currentHeading,
      content: currentLines.join('\n').trim(),
      level: currentLevel,
    });
  }

  return sections;
}
