import path from 'node:path';
import { readFile, listFilesByExtension, exists } from '../utils/fs.js';
import type { OutputStyleIR } from '../ir/types.js';

export async function parseOutputStyles(pluginDir: string): Promise<OutputStyleIR[]> {
  const stylesDir = path.join(pluginDir, 'output-styles');
  if (!await exists(stylesDir)) return [];

  const mdFiles = await listFilesByExtension(stylesDir, '.md');
  const styles: OutputStyleIR[] = [];

  for (const file of mdFiles) {
    const filePath = path.join(stylesDir, file);
    const raw = await readFile(filePath);
    if (!raw) continue;

    styles.push({
      name: path.basename(file, '.md'),
      content: raw,
      sourcePath: filePath,
    });
  }

  return styles;
}
