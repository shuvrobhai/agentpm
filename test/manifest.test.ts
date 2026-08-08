import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs/promises';
import { PackageManifest } from '../src/core/manifest.js';

describe('PackageManifest Unit Tests', () => {
  test('PackageManifest.load parses root plugin.json and discovers capabilities', async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'agentpm-manifest-test-'));

    try {
      await fs.writeFile(
        path.join(tmpDir, 'plugin.json'),
        JSON.stringify({
          name: 'test-plugin',
          version: '1.2.3',
          description: 'A test plugin for manifest loading',
          author: { name: 'Test Author' }
        }, null, 2),
        'utf8'
      );

      const skillsDir = path.join(tmpDir, 'skills', 'my-skill');
      await fs.mkdir(skillsDir, { recursive: true });
      await fs.writeFile(path.join(skillsDir, 'SKILL.md'), '# Skill', 'utf8');

      await fs.writeFile(
        path.join(tmpDir, '.mcp.json'),
        JSON.stringify({ mcpServers: { myMcp: { command: 'node' } } }),
        'utf8'
      );

      await fs.writeFile(path.join(tmpDir, 'hooks.json'), JSON.stringify({ hooks: [] }), 'utf8');
      await fs.writeFile(path.join(tmpDir, 'AGENTS.md'), '# Working Memory', 'utf8');

      const manifest = await PackageManifest.load(tmpDir);

      assert.equal(manifest.name, 'test-plugin');
      assert.equal(manifest.version, '1.2.3');
      assert.equal(manifest.description, 'A test plugin for manifest loading');
      assert.equal(manifest.author.name, 'Test Author');
      assert.deepEqual(manifest.capabilities.skills, ['my-skill']);
      assert.deepEqual(manifest.capabilities.mcpServers, ['myMcp']);
      assert.equal(manifest.capabilities.hooks, true);
      assert.ok(manifest.capabilities.rules.includes('AGENTS.md'));
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true });
    }
  });

  test('PackageManifest.load falls back to .claude-plugin/plugin.json', async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'agentpm-manifest-claude-'));

    try {
      const claudeDir = path.join(tmpDir, '.claude-plugin');
      await fs.mkdir(claudeDir, { recursive: true });
      await fs.writeFile(
        path.join(claudeDir, 'plugin.json'),
        JSON.stringify({ name: 'claude-vendor-plugin', version: '0.9.0' }),
        'utf8'
      );

      const manifest = await PackageManifest.load(tmpDir);

      assert.equal(manifest.name, 'claude-vendor-plugin');
      assert.equal(manifest.version, '0.9.0');
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true });
    }
  });
});
