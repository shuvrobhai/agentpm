import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs/promises';
import { MaterializationEngine } from '../src/core/materialization.js';
import { GlobalStore } from '../src/core/store.js';

describe('MaterializationEngine Unit Tests', () => {
  test('MaterializationEngine materializes symlink and dematerializes cleanly', async () => {
    const storePath = GlobalStore.getStorePath();
    const mockPluginDir = path.join(storePath, 'test-mat-ns', 'test-mat-plugin', 'main');
    await fs.mkdir(mockPluginDir, { recursive: true });
    await fs.writeFile(path.join(mockPluginDir, 'test.txt'), 'hello mat', 'utf8');

    const tmpTargetBase = await fs.mkdtemp(path.join(os.tmpdir(), 'agentpm-mat-target-'));
    const linkPath = path.join(tmpTargetBase, 'test-mat-plugin');

    try {
      // 1. Test Symlink Materialize
      const result = await MaterializationEngine.materialize({
        adapterName: 'antigravity',
        pluginName: 'test-mat-plugin',
        version: 'main',
        scope: 'local',
        targetBaseDir: tmpTargetBase,
        copy: false,
      });

      assert.equal(result.pluginDirName, 'test-mat-plugin');
      assert.ok(result.materializedPath.endsWith('test-mat-plugin'));

      const lstat = await fs.lstat(linkPath);
      assert.ok(lstat.isSymbolicLink());

      // 2. Test Dematerialize
      const removed = await MaterializationEngine.dematerialize({
        pluginName: 'test-mat-plugin',
        targetBaseDirs: [tmpTargetBase],
      });

      assert.equal(removed.length, 1);
      const exists = await fs.access(linkPath).then(() => true).catch(() => false);
      assert.equal(exists, false);
    } finally {
      await fs.rm(path.join(storePath, 'test-mat-ns'), { recursive: true, force: true }).catch(() => {});
      await fs.rm(tmpTargetBase, { recursive: true, force: true }).catch(() => {});
    }
  });

  test('MaterializationEngine materializes in copy mode', async () => {
    const storePath = GlobalStore.getStorePath();
    const mockPluginDir = path.join(storePath, 'test-mat-copy-ns', 'test-copy-mat', 'v1.0.0');
    await fs.mkdir(mockPluginDir, { recursive: true });
    await fs.writeFile(path.join(mockPluginDir, 'test.txt'), 'hello copy mat', 'utf8');

    const tmpTargetBase = await fs.mkdtemp(path.join(os.tmpdir(), 'agentpm-mat-copy-target-'));
    const linkPath = path.join(tmpTargetBase, 'test-copy-mat');

    try {
      const result = await MaterializationEngine.materialize({
        adapterName: 'antigravity',
        pluginName: 'test-copy-mat',
        version: 'v1.0.0',
        scope: 'local',
        targetBaseDir: tmpTargetBase,
        copy: true,
      });

      assert.equal(result.isCopy, true);
      const lstat = await fs.lstat(linkPath);
      assert.ok(lstat.isDirectory());
      assert.ok(!lstat.isSymbolicLink());

      const content = await fs.readFile(path.join(linkPath, 'test.txt'), 'utf8');
      assert.equal(content, 'hello copy mat');
    } finally {
      await fs.rm(path.join(storePath, 'test-mat-copy-ns'), { recursive: true, force: true }).catch(() => {});
      await fs.rm(tmpTargetBase, { recursive: true, force: true }).catch(() => {});
    }
  });
});
