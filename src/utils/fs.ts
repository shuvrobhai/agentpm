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

// ponytail: stdlib native recursive readdir replaces custom recursive walker
export async function listFilesRecursive(dir: string, base?: string): Promise<string[]> {
  try {
    const entries = await fs.readdir(dir, { recursive: true, withFileTypes: true });
    return entries
      .filter((e) => e.isFile() && !e.name.startsWith('.'))
      .map((e) => {
        const parent = (e as any).parentPath ?? (e as any).path ?? dir;
        return path.relative(base ?? dir, path.join(parent, e.name));
      });
  } catch {
    return [];
  }
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
