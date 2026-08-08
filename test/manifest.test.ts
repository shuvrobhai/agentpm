import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs/promises';
import { parsePlugin } from '../src/parser/index.js';
import { isValidPluginName, buildPortablePluginManifest } from '../src/core/v1-manifest.js';

describe('Plugin Parser & Manifest Inspection Unit Tests', () => {
  test('parsePlugin parses root plugin.json and discovers full 9 components', async () => {
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
      await fs.writeFile(path.join(tmpDir, 'CLAUDE.md'), '# Working Memory', 'utf8');

      const ir = await parsePlugin(tmpDir);

      assert.equal(ir.metadata.name, 'test-plugin');
      assert.equal(ir.metadata.version, '1.2.3');
      assert.equal(ir.metadata.description, 'A test plugin for manifest loading');
      assert.equal((ir.metadata.author as any)?.name, 'Test Author');
      assert.equal(ir.skills.length, 1);
      assert.equal(ir.skills[0]?.name, 'my-skill');
      assert.equal(ir.mcpServers.length, 1);
      assert.equal(ir.mcpServers[0]?.name, 'myMcp');
      assert.equal(ir.contextFile?.filename, 'CLAUDE.md');
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true });
    }
  });

  test('parsePlugin falls back to .claude-plugin/plugin.json', async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'agentpm-manifest-claude-'));

    try {
      const claudeDir = path.join(tmpDir, '.claude-plugin');
      await fs.mkdir(claudeDir, { recursive: true });
      await fs.writeFile(
        path.join(claudeDir, 'plugin.json'),
        JSON.stringify({ name: 'claude-vendor-plugin', version: '0.9.0' }),
        'utf8'
      );

      const ir = await parsePlugin(tmpDir);

      assert.equal(ir.metadata.name, 'claude-vendor-plugin');
      assert.equal(ir.metadata.version, '0.9.0');
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true });
    }
  });

  test('v1-manifest validates plugin names and builds portable manifest', () => {
    assert.equal(isValidPluginName('test-plugin'), true);
    assert.equal(isValidPluginName('invalid--name'), false);

    const manifest = buildPortablePluginManifest(
      { name: 'test-plugin', version: '1.0.0', description: 'Test' },
      'fallback'
    );
    assert.equal(manifest.name, 'test-plugin');
    assert.equal(manifest.version, '1.0.0');
  });
});
