import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs/promises';
import { GlobalStore } from '../src/core/store.js';

describe('GlobalStore Unit Tests', () => {
  test('validatePathComponent accepts safe strings', () => {
    assert.doesNotThrow(() => GlobalStore.validatePathComponent('octocat', 'namespace'));
    assert.doesNotThrow(() => GlobalStore.validatePathComponent('Hello-World', 'pluginName'));
    assert.doesNotThrow(() => GlobalStore.validatePathComponent('v1.0.0', 'version'));
    assert.doesNotThrow(() => GlobalStore.validatePathComponent('feature_branch.1', 'ref'));
  });

  test('validatePathComponent rejects path traversal and unsafe strings', () => {
    assert.throws(() => GlobalStore.validatePathComponent('.', 'namespace'), /Invalid or unsafe/);
    assert.throws(() => GlobalStore.validatePathComponent('..', 'namespace'), /Invalid or unsafe/);
    assert.throws(() => GlobalStore.validatePathComponent('../etc/passwd', 'namespace'), /Invalid or unsafe/);
    assert.throws(() => GlobalStore.validatePathComponent('foo/bar', 'namespace'), /Invalid or unsafe/);
    assert.throws(() => GlobalStore.validatePathComponent('foo;bar', 'namespace'), /Invalid or unsafe/);
  });

  test('parseRepoIdentifier parses owner/repo format', () => {
    const parsed = GlobalStore.parseRepoIdentifier('octocat/Hello-World');
    assert.equal(parsed.namespace, 'octocat');
    assert.equal(parsed.pluginName, 'Hello-World');
    assert.equal(parsed.cloneUrl, 'https://github.com/octocat/Hello-World.git');
    assert.equal(parsed.ref, undefined);
  });

  test('parseRepoIdentifier parses owner/repo#ref format', () => {
    const parsed = GlobalStore.parseRepoIdentifier('octocat/Hello-World#v2.1.0');
    assert.equal(parsed.namespace, 'octocat');
    assert.equal(parsed.pluginName, 'Hello-World');
    assert.equal(parsed.ref, 'v2.1.0');
  });

  test('parseRepoIdentifier rejects git flag injection in ref', () => {
    assert.throws(
      () => GlobalStore.parseRepoIdentifier('octocat/Hello-World#--upload-pack=touch'),
      /Invalid git reference/
    );
  });

  test('parseRepoIdentifier handles GitHub /tree/ branch URLs', () => {
    const parsed = GlobalStore.parseRepoIdentifier('https://github.com/anthropics/knowledge-work-plugins/tree/main/productivity');
    assert.equal(parsed.namespace, 'anthropics');
    assert.equal(parsed.pluginName, 'knowledge-work-plugins');
    assert.equal(parsed.cloneUrl, 'https://github.com/anthropics/knowledge-work-plugins.git');
    assert.equal(parsed.ref, 'main');
  });

  test('parseRepoIdentifier handles trailing slashes cleanly', () => {
    const parsed = GlobalStore.parseRepoIdentifier('octocat/Hello-World///');
    assert.equal(parsed.namespace, 'octocat');
    assert.equal(parsed.pluginName, 'Hello-World');
  });

  test('listGlobalPlugins discovers mock plugins', async () => {
    const storePath = GlobalStore.getStorePath();
    const mockPluginDir = path.join(storePath, 'test-owner', 'test-plugin', 'v1.0.0');
    await fs.mkdir(mockPluginDir, { recursive: true });

    try {
      const plugins = await GlobalStore.listGlobalPlugins();
      const found = plugins.find(p => p.namespace === 'test-owner' && p.pluginName === 'test-plugin');
      assert.ok(found, 'Should find mock plugin in global store');
      assert.equal(found?.version, 'v1.0.0');
    } finally {
      await fs.rm(path.join(storePath, 'test-owner'), { recursive: true, force: true });
    }
  });
});
