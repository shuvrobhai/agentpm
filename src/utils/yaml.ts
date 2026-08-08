export interface ParsedFrontmatter {
  data: Record<string, unknown>;
  content: string;
}

export function parseFrontmatter(raw: string): ParsedFrontmatter {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!match) {
    return { data: {}, content: raw.trim() };
  }

  const yamlBlock = match[1] ?? '';
  const content = (match[2] ?? '').trim();
  const data: Record<string, unknown> = {};

  for (const line of yamlBlock.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const colonIdx = trimmed.indexOf(':');
    if (colonIdx > 0) {
      const key = trimmed.slice(0, colonIdx).trim();
      let val: unknown = trimmed.slice(colonIdx + 1).trim();
      if (typeof val === 'string') {
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
          val = val.slice(1, -1);
        } else if (val === 'true') {
          val = true;
        } else if (val === 'false') {
          val = false;
        } else if (!isNaN(Number(val)) && val !== '') {
          val = Number(val);
        }
      }
      data[key] = val;
    }
  }

  return { data, content };
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
