import path from 'node:path';
import fs from 'node:fs/promises';
import { readFile, exists } from '../utils/fs.js';
import type { WorkflowIR } from '../ir/types.js';

export async function parseWorkflows(pluginDir: string): Promise<WorkflowIR[]> {
  const workflowsDir = path.join(pluginDir, 'workflows');
  if (!await exists(workflowsDir)) return [];

  let entries: string[];
  try {
    entries = await fs.readdir(workflowsDir);
  } catch {
    return [];
  }
  const workflows: WorkflowIR[] = [];

  for (const file of entries) {
    const ext = path.extname(file);
    if (!['.js', '.ts', '.mjs'].includes(ext)) continue;

    const filePath = path.join(workflowsDir, file);
    const raw = await readFile(filePath);
    if (!raw) continue;

    workflows.push({
      name: path.basename(file, ext),
      content: raw,
      extension: ext,
      sourcePath: filePath,
    });
  }

  return workflows;
}
