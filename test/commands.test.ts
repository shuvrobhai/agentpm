import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import fs from 'node:fs/promises';
import { GlobalStore } from '../src/core/store.js';
import { listCommand } from '../src/commands/list.js';
import { infoCommand } from '../src/commands/info.js';
import { uninstallCommand } from '../src/commands/uninstall.js';

describe('Command Handlers Unit Tests', () => {
  test('listCommand executes without error (workspace & global scopes)', async () => {
    await assert.doesNotReject(async () => {
      await listCommand({ json: true });
    });

    await assert.doesNotReject(async () => {
      await listCommand({ global: true, json: true });
    });
  });

  test('infoCommand fetches manifest details for existing plugin', async () => {
    const storePath = GlobalStore.getStorePath();
    const mockDir = path.join(storePath, 'test-cmd-owner', 'test-cmd-plugin', 'latest');
    await fs.mkdir(mockDir, { recursive: true });

    const manifest = { name: 'test-cmd-plugin', description: 'Test plugin info', version: '1.0.0' };
    await fs.writeFile(path.join(mockDir, 'plugin.json'), JSON.stringify(manifest), 'utf-8');

    try {
      await assert.doesNotReject(async () => {
        await infoCommand('test-cmd-plugin', { json: true });
      });
    } finally {
      await fs.rm(path.join(storePath, 'test-cmd-owner'), { recursive: true, force: true }).catch(() => {});
    }
  });

  test('uninstallCommand safely unlinks and purges stored plugin', async () => {
    const storePath = GlobalStore.getStorePath();
    const mockDir = path.join(storePath, 'test-purge-owner', 'test-purge-plugin', 'latest');
    await fs.mkdir(mockDir, { recursive: true });

    try {
      await uninstallCommand('test-purge-plugin', {});
      const exists = await fs.access(mockDir).then(() => true).catch(() => false);
      assert.equal(exists, false, 'Store directory should be removed after uninstall');
    } finally {
      await fs.rm(path.join(storePath, 'test-purge-owner'), { recursive: true, force: true }).catch(() => {});
    }
  });
});
