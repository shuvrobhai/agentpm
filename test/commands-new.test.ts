import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs/promises';
import { initCommand } from '../src/commands/init.js';
import { useCommand } from '../src/commands/use.js';
import { installCommand, DEFAULT_INSTALL_TARGET } from '../src/commands/add.js';
import { GlobalStore } from '../src/core/store.js';
import { isolateAgentStore } from './helpers.js';

isolateAgentStore();

describe('plugins CLI commands', () => {
  test('initCommand scaffolds a valid portable plugin', async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'plugins-init-test-'));
    const outDir = path.join(tmpDir, 'scaffolded');
    try {
      await initCommand('my-demo', { out: outDir });

      const pluginJson = JSON.parse(await fs.readFile(path.join(outDir, 'plugin.json'), 'utf8'));
      assert.equal(pluginJson.name, 'my-demo');
      assert.equal(pluginJson.$schema, 'https://agent-plugins.org/schemas/1.0.0/plugin.schema.json');
      assert.equal(pluginJson.version, '0.1.0');
      assert.equal(pluginJson.hooks, undefined, 'scaffold must not add non-portable fields');

      const skillMd = await fs.readFile(path.join(outDir, 'skills', 'my-demo', 'SKILL.md'), 'utf8');
      assert.ok(skillMd.includes('name: my-demo'));
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true });
    }
  });

  test('useCommand prints a prompt for a local plugin', async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'plugins-use-test-'));
    const pluginDir = path.join(tmpDir, 'sample');
    await fs.mkdir(path.join(pluginDir, 'skills', 'greet'), { recursive: true });
    await fs.writeFile(
      path.join(pluginDir, 'plugin.json'),
      JSON.stringify({ $schema: 'https://agent-plugins.org/schemas/1.0.0/plugin.schema.json', name: 'sample', version: '1.0.0', description: 'A sample plugin' }),
      'utf8'
    );
    await fs.writeFile(
      path.join(pluginDir, 'skills', 'greet', 'SKILL.md'),
      '---\nname: greet\ndescription: Says hello\n---\n\n# Greet\nSay hello.',
      'utf8'
    );

    try {
      const originalLog = console.log;
      const lines: string[] = [];
      console.log = (...args: unknown[]) => lines.push(args.map(String).join(' '));
      try {
        await useCommand(pluginDir);
      } finally {
        console.log = originalLog;
      }

      const output = lines.join('\n');
      assert.ok(output.includes('# Use Plugin: sample'));
      assert.ok(output.includes('Skills: greet'));
      assert.ok(output.includes('Say hello.'));
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true });
    }
  });

  test('installCommand defaults to the portable agent-plugins target', async () => {
    assert.equal(DEFAULT_INSTALL_TARGET, 'agent-plugins');

    const storePath = GlobalStore.getStorePath();
    const mockDir = path.join(storePath, 'install-test-owner', 'install-test-plugin', 'latest');
    await fs.mkdir(mockDir, { recursive: true });
    await fs.writeFile(
      path.join(mockDir, 'plugin.json'),
      JSON.stringify({ name: 'install-test-plugin', version: '1.0.0' }),
      'utf8'
    );

    try {
      const originalLog = console.log;
      const lines: string[] = [];
      console.log = (...args: unknown[]) => lines.push(args.map(String).join(' '));
      try {
        await installCommand('install-test-owner/install-test-plugin', {});
      } finally {
        console.log = originalLog;
      }

      const output = lines.join('\n');
      assert.ok(output.includes('plugins enable'), `expected renamed CLI hint, got: ${output}`);
    } finally {
      await fs.rm(path.join(storePath, 'install-test-owner'), { recursive: true, force: true }).catch(() => {});
    }
  });
});
