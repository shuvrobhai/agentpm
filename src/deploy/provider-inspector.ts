import fs from 'node:fs/promises';
import path from 'node:path';
import { AdapterRegistry } from '../adapters/index.js';
import { getProviderSpec, PROVIDER_SPECS } from './provider-specs.js';

export interface InstalledItem {
  name: string;
  type: string;
  path: string;
}
export class ProviderInspector {
  async inspect(provider?: string): Promise<InstalledItem[]> {
    const allAdapters = AdapterRegistry.all();
    const targetAdapters = provider
      ? allAdapters.filter(
          (a) =>
            a.name === provider.toLowerCase() ||
            a.displayName?.toLowerCase() === provider.toLowerCase() ||
            (provider.toLowerCase() === 'claude' && a.name === 'claude-code')
        )
      : allAdapters;

    const allItems: InstalledItem[] = [];

    for (const adapter of targetAdapters) {
      console.log(`┌── Provider: ${(adapter.displayName || adapter.name).toUpperCase()}`);
      let found = 0;

      for (const scope of ['global', 'local'] as const) {
        const dirs = adapter.getMaterializationPaths(scope);
        for (const dir of dirs) {
          const label = `${path.basename(dir)} (${scope})`;
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
      }

      if (found === 0) {
        console.log(`│   (No plugins or MCP servers found on disk)`);
      }
      console.log(`└───\n`);
    }

    return allItems;
  }
}
