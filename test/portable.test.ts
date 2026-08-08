import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs/promises';
import { convertDirToPortableCore } from '../src/core/portable-writer.js';
import {
  buildPortablePluginManifest,
  buildPortableMcp,
  sanitizePluginName,
  isValidPluginName,
  PLUGIN_SCHEMA_URL,
  MCP_SCHEMA_URL,
} from '../src/core/v1-manifest.js';

describe('Portable Agent Plugins v1 output', () => {
  test('sanitizePluginName produces spec-valid lowercase names', () => {
    const cases: Array<[string, string, string]> = [
      ['My Cool Plugin', 'fallback', 'my-cool-plugin'],
      ['  PDF Viewer  ', 'fallback', 'pdf-viewer'],
      ['UPPER.Case', 'fallback', 'upper.case'],
      ['', 'Fallback Name', 'fallback-name'],
      ['--double--dash--', 'fallback', 'double-dash'],
      ['..dots..', 'fallback', 'dots'],
      ['', '', 'plugin'],
    ];
    for (const [input, fallback, expected] of cases) {
      const name = sanitizePluginName(input, fallback);
      assert.equal(name, expected);
      assert.ok(isValidPluginName(name), `"${name}" must be spec-valid`);
    }
  });

  test('buildPortablePluginManifest emits a closed-schema manifest', () => {
    const manifest = buildPortablePluginManifest(
      {
        name: 'Demo',
        version: '1.2.3',
        description: 'A demo plugin',
        author: { name: 'Ray', email: 'r@x.io', url: 'https://x.io' },
        homepage: 'https://example.com',
        repository: 'https://github.com/x/y',
        license: 'MIT',
        keywords: ['demo', 'mcp'],
        hooks: { PreToolUse: [] },
        mcpServers: { stray: {} },
        $schema: 'https://agent-plugins.org/schemas/1.0.0/plugin.schema.json',
      },
      'demo'
    );

    assert.equal(manifest.$schema, PLUGIN_SCHEMA_URL);
    assert.equal(manifest.name, 'demo');
    assert.equal(manifest.version, '1.2.3');
    assert.deepEqual(manifest.keywords, ['demo', 'mcp']);
    assert.equal(manifest.hooks, undefined);
    assert.equal(manifest.mcpServers, undefined);
    assert.ok(!('$schema' in Object.keys(manifest).filter((k) => k === '$schema')) || manifest.$schema === PLUGIN_SCHEMA_URL);
  });

  test('buildPortableMcp infers transports and keeps portable cwd', () => {
    const warnings: string[] = [];
    const mcp = buildPortableMcp(
      {
        mcpServers: {
          std: { command: 'node', args: ['srv.js'], cwd: './server', env: { FOO: 'bar' } },
          http: { url: 'https://mcp.example.com', headers: { Authorization: 'Bearer x' } },
          typed: { type: 'sse', url: 'https://sse.example.com' },
          broken: { },
        },
      },
      warnings
    );

    assert.equal(mcp.$schema, MCP_SCHEMA_URL);
    const std = mcp.mcpServers.std as any;
    assert.equal(std.type, 'stdio');
    assert.equal(std.command, 'node');
    assert.equal(std.cwd, './server');
    assert.deepEqual(std.env, { FOO: 'bar' });

    const http = mcp.mcpServers.http as any;
    assert.equal(http.type, 'streamable-http');
    assert.equal(http.url, 'https://mcp.example.com');

    const typed = mcp.mcpServers.typed as any;
    assert.equal(typed.type, 'sse');

    assert.equal(mcp.mcpServers.broken, undefined);
    assert.ok(warnings.length >= 1);
  });

  test('convertDirToPortableCore emits closed plugin.json, skills/, and portable mcp.json', async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'agentpm-portable-src-'));
    const destDir = await fs.mkdtemp(path.join(os.tmpdir(), 'agentpm-portable-dest-'));

    try {
      const skillDir = path.join(tmpDir, 'skills', 'demo');
      await fs.mkdir(skillDir, { recursive: true });
      await fs.writeFile(
        path.join(skillDir, 'SKILL.md'),
        '---\nname: demo\ndescription: Demo\n---\n\nRun ${CLAUDE_PLUGIN_ROOT}/bin/demo.js',
        'utf8'
      );

      const claudePluginDir = path.join(tmpDir, '.claude-plugin');
      await fs.mkdir(claudePluginDir, { recursive: true });
      await fs.writeFile(
        path.join(claudePluginDir, 'plugin.json'),
        JSON.stringify({
          name: 'Demo Plugin',
          version: '2.0.0',
          description: 'Demo',
          author: { name: 'Ray' },
          homepage: 'https://example.com',
          license: 'MIT',
          keywords: ['demo'],
          hooks: { PreToolUse: [{ matcher: 'Bash', command: './check.sh' }] },
          mcpServers: { stray: { command: 'nope' } },
        }, null, 2),
        'utf8'
      );

      await fs.writeFile(
        path.join(tmpDir, '.mcp.json'),
        JSON.stringify({
          mcpServers: {
            demo: { command: 'node', args: ['srv.js'], cwd: './server' },
          },
        }, null, 2),
        'utf8'
      );

      await convertDirToPortableCore(tmpDir, destDir);

      const pluginJson = JSON.parse(await fs.readFile(path.join(destDir, 'plugin.json'), 'utf8'));
      assert.equal(pluginJson.$schema, PLUGIN_SCHEMA_URL);
      assert.equal(pluginJson.name, 'demo-plugin');
      assert.ok(isValidPluginName(pluginJson.name));
      assert.equal(pluginJson.hooks, undefined);
      assert.equal(pluginJson.mcpServers, undefined);
      assert.equal(pluginJson.description, 'Demo');

      const mcpJson = JSON.parse(await fs.readFile(path.join(destDir, 'mcp.json'), 'utf8'));
      assert.equal(mcpJson.$schema, MCP_SCHEMA_URL);
      assert.equal(mcpJson.mcpServers.demo.type, 'stdio');
      assert.equal(mcpJson.mcpServers.demo.cwd, './server');

      const skill = await fs.readFile(path.join(destDir, 'skills', 'demo', 'SKILL.md'), 'utf8');
      assert.ok(skill.includes('bin/demo.js'));
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true });
      await fs.rm(destDir, { recursive: true, force: true });
    }
  });
});
