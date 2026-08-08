import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import fs from 'node:fs/promises';
import { AntigravityAdapter } from '../src/adapters/antigravity.js';
import { ClaudeCodeAdapter } from '../src/adapters/claudecode.js';
import { GlobalStore } from '../src/core/store.js';

describe('Agent Adapters Unit Tests', () => {
  test('AntigravityAdapter properties & detection', async () => {
    const adapter = new AntigravityAdapter();
    assert.equal(adapter.name, 'antigravity');
    assert.deepEqual(adapter.capabilities(), ['skills', 'mcp', 'hooks']);

    const isDetected = await adapter.detect();
    assert.equal(typeof isDetected, 'boolean');
  });

  test('ClaudeCodeAdapter properties & detection', async () => {
    const adapter = new ClaudeCodeAdapter();
    assert.equal(adapter.name, 'claude-code');
    assert.deepEqual(adapter.capabilities(), ['skills', 'mcp']);

    const isDetected = await adapter.detect();
    assert.equal(typeof isDetected, 'boolean');
  });

  test('AntigravityAdapter enable and disable symlink lifecycle', async () => {
    const storePath = GlobalStore.getStorePath();
    const mockSource = path.join(storePath, 'test-adapter-ns', 'test-adapter-plugin', 'latest');
    await fs.mkdir(mockSource, { recursive: true });

    const adapter = new AntigravityAdapter();
    const localPluginsDir = path.join(process.cwd(), '.agents', 'plugins');
    const linkPath = path.join(localPluginsDir, 'test-adapter-plugin');

    try {
      // Test Enable (symlink mode)
      await adapter.enable('test-adapter-plugin', 'local', { version: 'latest' });
      const lstat = await fs.lstat(linkPath);
      assert.ok(lstat.isSymbolicLink(), 'Target should be a symbolic link');

      const realPath = await fs.realpath(linkPath);
      assert.equal(realPath, mockSource);

      // Test Disable
      await adapter.disable('test-adapter-plugin', 'local');
      const existsAfterDisable = await fs.lstat(linkPath).then(() => true).catch(() => false);
      assert.equal(existsAfterDisable, false, 'Symlink should be removed after disable');
    } finally {
      await fs.rm(linkPath, { recursive: true, force: true }).catch(() => {});
      await fs.rm(path.join(storePath, 'test-adapter-ns'), { recursive: true, force: true }).catch(() => {});
    }
  });

  test('AntigravityAdapter enable with copy mode', async () => {
    const storePath = GlobalStore.getStorePath();
    const mockSource = path.join(storePath, 'test-copy-ns', 'test-copy-plugin', 'latest');
    await fs.mkdir(mockSource, { recursive: true });
    await fs.writeFile(path.join(mockSource, 'test.txt'), 'hello copy', 'utf8');

    const adapter = new AntigravityAdapter();
    const localPluginsDir = path.join(process.cwd(), '.agents', 'plugins');
    const linkPath = path.join(localPluginsDir, 'test-copy-plugin');

    try {
      // Test Enable (copy mode)
      await adapter.enable('test-copy-plugin', 'local', { copy: true, version: 'latest' });
      const lstat = await fs.lstat(linkPath);
      assert.ok(lstat.isDirectory(), 'Target should be a real directory');
      assert.ok(!lstat.isSymbolicLink(), 'Target should NOT be a symbolic link');

      const fileContent = await fs.readFile(path.join(linkPath, 'test.txt'), 'utf8');
      assert.equal(fileContent, 'hello copy');

      // Test Disable
      await adapter.disable('test-copy-plugin', 'local');
      const existsAfterDisable = await fs.lstat(linkPath).then(() => true).catch(() => false);
      assert.equal(existsAfterDisable, false, 'Copied folder should be removed after disable');
    } finally {
      await fs.rm(linkPath, { recursive: true, force: true }).catch(() => {});
      await fs.rm(path.join(storePath, 'test-copy-ns'), { recursive: true, force: true }).catch(() => {});
    }
  });

  test('ClaudeCodeAdapter enable and disable symlink lifecycle', async () => {
    const storePath = GlobalStore.getStorePath();
    const mockSource = path.join(storePath, 'test-claude-ns', 'test-claude-plugin', 'latest');
    await fs.mkdir(mockSource, { recursive: true });

    const adapter = new ClaudeCodeAdapter();
    const localPluginsDir = path.join(process.cwd(), '.agents', 'plugins');
    const linkPath = path.join(localPluginsDir, 'test-claude-plugin');

    try {
      // Test Enable
      await adapter.enable('test-claude-plugin', 'local', { version: 'latest' });
      const lstat = await fs.lstat(linkPath);
      assert.ok(lstat.isSymbolicLink(), 'Target should be a symbolic link');

      // Test Disable
      await adapter.disable('test-claude-plugin', 'local');
      const existsAfterDisable = await fs.lstat(linkPath).then(() => true).catch(() => false);
      assert.equal(existsAfterDisable, false, 'Symlink should be removed after disable');
    } finally {
      await fs.rm(linkPath, { recursive: true, force: true }).catch(() => {});
      await fs.rm(path.join(storePath, 'test-claude-ns'), { recursive: true, force: true }).catch(() => {});
    }
  });


  test('ClaudeCodeAdapter workspace-first enable (local converted plugin without global install)', async () => {
    const adapter = new ClaudeCodeAdapter();
    const localWorkspacePath = adapter.getLocalPluginDir('test-local-workspace-plugin');
    await fs.mkdir(localWorkspacePath, { recursive: true });

    try {
      await adapter.enable('test-local-workspace-plugin', 'local');
      const lstat = await fs.lstat(localWorkspacePath);
      assert.ok(lstat.isDirectory(), 'Workspace plugin should exist and be enabled');

      await adapter.disable('test-local-workspace-plugin', 'local');
    } finally {
      await fs.rm(localWorkspacePath, { recursive: true, force: true }).catch(() => {});
    }
  });
});
