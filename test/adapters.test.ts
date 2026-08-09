import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs/promises';
import { AntigravityAdapter } from '../src/adapters/antigravity.js';
import { ClaudeCodeAdapter } from '../src/adapters/claudecode.js';
import { CodexAdapter } from '../src/adapters/codex.js';
import { OpenCodeAdapter } from '../src/adapters/opencode.js';
import { BaseAgentAdapter } from '../src/adapters/base.js';
import { GlobalStore } from '../src/core/store.js';
import { isolateAgentStore } from './helpers.js';

isolateAgentStore();

describe('Agent Adapters Unit Tests', () => {
  test('AntigravityAdapter properties & detection', async () => {
    const adapter = new AntigravityAdapter();
    assert.equal(adapter.name, 'antigravity');
    assert.deepEqual(adapter.capabilities(), ['skills', 'mcp', 'hooks', 'agents', 'rules', 'workflows']);

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

  test('detectProbes probe agent home dirs (not plugins subdirs)', () => {
    const home = os.homedir();
    const cwd = process.cwd();

    const antigravity = new AntigravityAdapter();
    assert.deepEqual(antigravity.detectProbes.global, [path.join(home, '.gemini')]);
    assert.deepEqual(antigravity.detectProbes.local, [path.join(cwd, '.agents')]);

    const claude = new ClaudeCodeAdapter();
    assert.deepEqual(claude.detectProbes.global, [path.join(home, '.claude')]);
    assert.deepEqual(claude.detectProbes.local, [path.join(cwd, '.claudecode')]);

    const codex = new CodexAdapter();
    assert.deepEqual(codex.detectProbes.global, [path.join(home, '.codex')]);
    assert.deepEqual(codex.detectProbes.local, [
      path.join(cwd, '.codex'),
      path.join(cwd, '.codex-plugin'),
      path.join(cwd, '.agents', 'plugins', 'marketplace.json'),
    ]);

    const opencode = new OpenCodeAdapter();
    assert.deepEqual(opencode.detectProbes.global, [path.join(home, '.config', 'opencode')]);
    assert.deepEqual(opencode.detectProbes.local, [path.join(cwd, '.opencode')]);
  });

  test('detect returns true when any probe exists, else false', async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'agentpm-detect-'));
    const probeDir = path.join(tmpDir, 'probe');
    try {
      class ProbeAdapter extends BaseAgentAdapter {
        name = 'probe';
        displayName = 'Probe';
        override get detectProbes() {
          return { global: [probeDir], local: [path.join(tmpDir, 'nope')] };
        }
        get globalPluginDir(): string { return path.join(tmpDir, 'global-plugins'); }
        get localPluginDir(): string { return path.join(tmpDir, 'local-plugins'); }
        capabilities(): string[] { return []; }
        convert(): any { return { files: [] }; }
      }

      const adapter = new ProbeAdapter();
      assert.equal(await adapter.detect('global'), false);
      assert.equal(await adapter.detect('local'), false);

      await fs.mkdir(probeDir, { recursive: true });
      assert.equal(await adapter.detect('global'), true);
      assert.equal(await adapter.detect('local'), false);
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true });
    }
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
      assert.equal(realPath, await fs.realpath(mockSource));

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
