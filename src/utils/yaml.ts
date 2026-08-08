import matter from 'gray-matter';

export interface ParsedFrontmatter {
  data: Record<string, unknown>;
  content: string;
}

export function parseFrontmatter(raw: string): ParsedFrontmatter {
  try {
    const { data, content } = matter(raw);
    return { data: data as Record<string, unknown>, content: content.trim() };
  } catch {
    return { data: {}, content: raw.trim() };
  }
}

export function detectVariables(text: string): string[] {
  const patterns = [
    /\$ARGUMENTS/g,
    /\$ARGUMENTS\[\d+\]/g,
    /\$\d+/g,
    /\$\{CLAUDE_[A-Z_]+\}/g,
    /\$[a-z_]+/g,
  ];

  const found = new Set<string>();
  for (const pattern of patterns) {
    const matches = text.match(pattern);
    if (matches) {
      matches.forEach(m => found.add(m));
    }
  }
  return [...found];
}

export function detectDynamicInjections(text: string): string[] {
  const singleLine = /!`([^`]+)`/g;
  const multiLine = /!```[\s\S]*?```/g;

  const commands: string[] = [];

  let match;
  while ((match = singleLine.exec(text)) !== null) {
    commands.push(match[1] as string);
  }
  while ((match = multiLine.exec(text)) !== null) {
    commands.push(match[0]);
  }

  return commands;
}
