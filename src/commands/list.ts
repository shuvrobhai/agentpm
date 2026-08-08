import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { GlobalStore } from '../core/store.js';

export interface ActiveSymlinkInfo {
  agent: string;
  scope: 'local' | 'global';
  pluginName: string;
  symlinkPath: string;
  targetPath?: string;
}

export async function listCommand(options: { global?: boolean; json?: boolean }): Promise<void> {
  try {
    if (options.global) {
      const stored = await GlobalStore.listGlobalPlugins();
      if (options.json) {
        console.log(JSON.stringify(stored, null, 2));
        return;
      }

      console.log(`\n📦 Global Plugin Store (${GlobalStore.getStorePath()}):\n`);
      if (stored.length === 0) {
        console.log('  (No plugins installed in global store)');
        return;
      }

      for (const item of stored) {
        console.log(`  • ${item.namespace}/${item.pluginName} (${item.version}) -> ${item.fullPath}`);
      }
      console.log('');
      return;
    }

    // Default: Inspect local workspace materializations
    const symlinks: ActiveSymlinkInfo[] = [];
    const targets = [
      { agent: 'antigravity', scope: 'local' as const, dir: path.join(process.cwd(), '.agents', 'skills') },
      { agent: 'claude-code', scope: 'local' as const, dir: path.join(process.cwd(), '.claudecode', 'skills') },
    ];

    for (const target of targets) {
      const exists = await fs.access(target.dir).then(() => true).catch(() => false);
      if (!exists) continue;

      const entries = await fs.readdir(target.dir).catch(() => []);
      for (const entry of entries) {
        if (entry.startsWith('.')) continue;
        const symlinkPath = path.join(target.dir, entry);
        const lstat = await fs.lstat(symlinkPath).catch(() => null);

        let targetPath: string | undefined;
        if (lstat?.isSymbolicLink()) {
          targetPath = await fs.readlink(symlinkPath).catch(() => undefined);
        }

        symlinks.push({
          agent: target.agent,
          scope: target.scope,
          pluginName: entry,
          symlinkPath,
          targetPath,
        });
      }
    }

    if (options.json) {
      console.log(JSON.stringify(symlinks, null, 2));
      return;
    }

    console.log(`\n🔗 Active Workspace Plugins (${process.cwd()}):\n`);
    if (symlinks.length === 0) {
      console.log('  (No plugins materialized in active workspace)');
      console.log('  Tip: Run `agentpm list --global` to see installed global store plugins.');
      return;
    }

    for (const link of symlinks) {
      const targetDisplay = link.targetPath ? ` -> ${link.targetPath}` : '';
      console.log(`  • [${link.agent}] ${link.pluginName}${targetDisplay}`);
    }
    console.log('');
  } catch (err: any) {
    console.error(`Error listing plugins: ${err.message}`);
    process.exitCode = 1;
  }
}
