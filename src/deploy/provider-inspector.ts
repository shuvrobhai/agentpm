import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { getProviderSpec, PROVIDER_SPECS } from './provider-specs.js';

interface InstalledItem {
  name: string;
  type: string;
  path: string;
}

function providerDirs(provider: string): { label: string; dir: string }[] {
  const home = os.homedir();
  const cwd = process.cwd();

  switch (provider) {
    case 'antigravity':
      return [
        { label: 'plugins (global)', dir: path.join(home, '.gemini', 'config', 'plugins') },
        { label: 'skills (global)', dir: path.join(home, '.gemini', 'config', 'skills') },
        { label: 'plugins (workspace)', dir: path.join(cwd, '.agents', 'plugins') },
      ];
    case 'opencode':
      return [
        { label: 'plugins (global)', dir: path.join(home, '.config', 'opencode', 'plugins') },
        { label: 'skills (global)', dir: path.join(home, '.config', 'opencode', 'skills') },
        { label: 'skills (workspace)', dir: path.join(cwd, '.opencode', 'skills') },
      ];
    case 'claude':
      return [
        { label: 'plugins (global)', dir: path.join(home, '.config', 'claude', 'plugins') },
        { label: 'skills (global)', dir: path.join(home, '.claude', 'skills') },
      ];
    case 'codex':
      return [
        { label: 'extensions (global)', dir: path.join(home, '.codex', 'extensions') },
        { label: 'skills (global)', dir: path.join(home, '.codex', 'skills') },
      ];
    default:
      return [];
  }
}

export class ProviderInspector {
  async inspect(provider?: string): Promise<InstalledItem[]> {
    const providers = provider ? [provider.toLowerCase()] : PROVIDER_SPECS.map(s => s.id);
    const allItems: InstalledItem[] = [];

    for (const p of providers) {
      if (!getProviderSpec(p)) continue;

      console.log(`┌── Provider: ${p.toUpperCase()}`);
      let found = 0;
      for (const { label, dir } of providerDirs(p)) {
        let entries: string[];
        try {
          entries = await fs.readdir(dir);
        } catch {
          continue;
        }
        for (const entry of entries) {
          if (entry.startsWith('.')) continue;
          found += 1;
          const itemPath = path.join(dir, entry);
          const item = { name: entry, type: label, path: itemPath };
          allItems.push(item);
          console.log(`├── [${label}] ${entry}`);
          console.log(`│   Path: ${itemPath}`);
        }
      }
      if (found === 0) {
        console.log(`│   (No plugins or MCP servers found on disk)`);
      }
      console.log(`└───\n`);
    }

    return allItems;
  }
}
