import fs from 'node:fs/promises';
import path from 'node:path';

export async function exists(p: string): Promise<boolean> {
  return fs.access(p).then(() => true).catch(() => false);
}

export async function readFile(p: string): Promise<string | null> {
  try {
    return await fs.readFile(p, 'utf-8');
  } catch {
    return null;
  }
}

export async function readJson<T = Record<string, unknown>>(p: string): Promise<T | null> {
  try {
    const raw = await fs.readFile(p, 'utf-8');
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export async function listFilesRecursive(dir: string, base?: string): Promise<string[]> {
  const baseDir = base ?? dir;
  let entries;
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return [];
  }
  const files: string[] = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    const relativePath = path.relative(baseDir, fullPath);

    if (entry.isDirectory()) {
      if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;
      files.push(...await listFilesRecursive(fullPath, baseDir));
    } else {
      files.push(relativePath);
    }
  }

  return files;
}

export async function listSubdirs(dir: string): Promise<string[]> {
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    return entries.filter(e => e.isDirectory() && !e.name.startsWith('.')).map(e => e.name);
  } catch {
    return [];
  }
}

export async function listFilesByExtension(dir: string, ext: string): Promise<string[]> {
  try {
    const entries = await fs.readdir(dir);
    return entries.filter(f => f.endsWith(ext));
  } catch {
    return [];
  }
}
