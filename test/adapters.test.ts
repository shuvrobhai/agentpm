import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import fs from 'node:fs/promises';
import os from 'node:os';
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
    const localSkillsDir = path.join(process.cwd(), '.agents', 'skills');
    const linkPath = path.join(localSkillsDir, 'test-adapter-plugin');

    try {
      // Test Enable
      await adapter.enable('test-adapter-plugin', 'latest', 'local');
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

  test('ClaudeCodeAdapter enable and disable symlink lifecycle', async () => {
    const storePath = GlobalStore.getStorePath();
    const mockSource = path.join(storePath, 'test-claude-ns', 'test-claude-plugin', 'latest');
    await fs.mkdir(mockSource, { recursive: true });

    const adapter = new ClaudeCodeAdapter();
    const localSkillsDir = path.join(process.cwd(), '.claudecode', 'skills');
    const linkPath = path.join(localSkillsDir, 'test-claude-plugin');

    try {
      // Test Enable
      await adapter.enable('test-claude-plugin', 'latest', 'local');
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
});
