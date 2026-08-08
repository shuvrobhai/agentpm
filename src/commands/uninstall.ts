import { AntigravityAdapter } from '../adapters/antigravity.js';
import { ClaudeCodeAdapter } from '../adapters/claudecode.js';
import { CodexAdapter } from '../adapters/codex.js';
import { OpenCodeAdapter } from '../adapters/opencode.js';
import { GlobalStore } from '../core/store.js';

export async function uninstallCommand(plugin: string, options: { global?: boolean }): Promise<void> {
  try {
    console.log(`Uninstalling plugin "${plugin}"...`);

    const adapters = [new AntigravityAdapter(), new ClaudeCodeAdapter(), new CodexAdapter(), new OpenCodeAdapter()];

    // 1. Dematerialize active symlinks across adapters (local & global scopes)
    for (const adapter of adapters) {
      if (await adapter.detect('local')) {
        await adapter.disable(plugin, 'local');
      }
      if (options.global) {
        await adapter.disable(plugin, 'global');
      }
    }

    // 2. Remove package directory from Global Store
    const removedPaths = await GlobalStore.removePlugin(plugin);
    for (const p of removedPaths) {
      console.log(`Purged package from Global Store: ${p}`);
    }

    console.log(`Successfully uninstalled plugin "${plugin}".`);
  } catch (err: any) {
    console.error(`Error uninstalling plugin: ${err.message}`);
    process.exitCode = 1;
  }
}

