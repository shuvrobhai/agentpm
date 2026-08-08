import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import fs from 'node:fs/promises';
import os from 'node:os';
import { parsePlugin, printIRSummary } from '../src/parser/index.js';
import { toPortableCore } from '../src/ir/to-portable-core.js';
import { getAdapter, listAdapters } from '../src/adapters/index.js';
import { OpenCodeAdapter } from '../src/adapters/opencode.js';

async function makeFixturePlugin(dir: string): Promise<void> {
  const skillsDir = path.join(dir, 'skills', 'demo');
  await fs.mkdir(skillsDir, { recursive: true });
  await fs.writeFile(
    path.join(skillsDir, 'SKILL.md'),
    '---\nname: demo\ndescription: Demo skill\n---\n\nDo the thing with $ARGUMENTS.\n',
    'utf8',
  );
  await fs.writeFile(
    path.join(dir, '.mcp.json'),
    JSON.stringify({ mcpServers: { 'demo-mcp': { command: 'npx', args: ['-y', 'demo'] } } }, null, 2),
    'utf8',
  );
  await fs.writeFile(path.join(dir, 'CLAUDE.md'), '# Plugin\n\n## Section One\n\ncontent\n', 'utf8');
}

describe('Parser + IR (ported from agentport)', () => {
  test('parsePlugin detects skills, MCP servers, and context file', async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'agentpm-parser-'));
    try {
      await makeFixturePlugin(tmpDir);
      const ir = await parsePlugin(tmpDir);

      assert.equal(ir.source.type, 'local');
      assert.equal(ir.skills.length, 1);
      assert.equal(ir.skills[0].name, 'demo');
      assert.deepEqual(ir.skills[0].variables, ['$ARGUMENTS']);
      assert.equal(ir.mcpServers.length, 1);
      assert.equal(ir.mcpServers[0].name, 'demo-mcp');
      assert.ok(ir.contextFile);
      assert.ok(ir.contextFile.sections.some(s => s.heading === 'Section One'));
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true });
    }
  });

  test('printIRSummary runs without throwing', async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'agentpm-summary-'));
    try {
      await makeFixturePlugin(tmpDir);
      const ir = await parsePlugin(tmpDir);
      assert.doesNotThrow(() => printIRSummary(ir));
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true });
    }
  });
});

describe('IR adapters (ported from agentport)', () => {
  test('opencode adapter converts MCP servers to array format', async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'agentpm-oc-'));
    try {
      await makeFixturePlugin(tmpDir);
      const ir = await parsePlugin(tmpDir);
      const result = getAdapter('opencode').convert(toPortableCore(ir), 'workspace');

      const mcpFile = result.files.find(f => f.relativePath === 'opencode.json');
      assert.ok(mcpFile, 'opencode.json should be emitted');
      const parsed = JSON.parse(mcpFile.content) as Record<string, unknown>;
      const mcp = (parsed.mcp as Record<string, Record<string, unknown>>)['demo-mcp'];
      assert.deepEqual(mcp.command, ['npx', '-y', 'demo']);
      assert.equal(mcp.type, 'local');
      assert.equal(mcp.enabled, true);

      const skillFile = result.files.find(f => f.relativePath === '.opencode/skills/demo/SKILL.md');
      assert.ok(skillFile);
      assert.ok(skillFile.content.includes('Do the thing with $ARGUMENTS.'));

      const contextFile = result.files.find(f => f.relativePath === 'AGENTS.md');
      assert.ok(contextFile);
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true });
    }
  });

  test('antigravity adapter emits skills and context', async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'agentpm-agy-'));
    try {
      await makeFixturePlugin(tmpDir);
      const ir = await parsePlugin(tmpDir);
      const result = getAdapter('antigravity').convert(toPortableCore(ir), 'workspace');

      const skillFile = result.files.find(f => f.relativePath === 'skills/demo.md');
      assert.ok(skillFile);
      assert.ok(skillFile.content.startsWith('# demo'));

      const contextFile = result.files.find(f => f.relativePath === 'AGENTS.md');
      assert.ok(contextFile);
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true });
    }
  });

  test('adapter registry exposes merged lifecycle+conversion adapters', () => {
    assert.deepEqual(listAdapters().sort(), ['antigravity', 'claude-code', 'claudecode', 'codex', 'opencode']);
    assert.ok(getAdapter('opencode').convert);
    assert.ok(getAdapter('antigravity').convert);
    assert.ok(getAdapter('claude-code').convert);
    assert.ok(getAdapter('codex').convert);
    assert.throws(() => getAdapter('nope'));
  });

  test('claude-code adapter emits a native .claude-plugin layout', async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'agentpm-cc-'));
    try {
      await makeFixturePlugin(tmpDir);
      const ir = await parsePlugin(tmpDir);
      const result = getAdapter('claude-code').convert(toPortableCore(ir), 'workspace');

      const manifestFile = result.files.find(f => f.relativePath === '.claude-plugin/plugin.json');
      assert.ok(manifestFile, 'plugin manifest should be emitted');
      const manifest = JSON.parse(manifestFile.content) as Record<string, unknown>;
      assert.equal(typeof manifest.name, 'string');
      assert.equal(manifest.name.length > 0, true);
      assert.equal(manifest.mcpServers, './.mcp.json');

      const skillFile = result.files.find(f => f.relativePath === 'skills/demo/SKILL.md');
      assert.ok(skillFile);
      assert.ok(skillFile.content.includes('Do the thing with $ARGUMENTS.'));

      const mcpFile = result.files.find(f => f.relativePath === '.mcp.json');
      assert.ok(mcpFile);
      const mcp = JSON.parse(mcpFile.content) as { mcpServers: Record<string, unknown> };
      assert.deepEqual(mcp.mcpServers['demo-mcp'], { command: 'npx', args: ['-y', 'demo'] });

      const contextFile = result.files.find(f => f.relativePath === 'CLAUDE.md');
      assert.ok(contextFile);
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true });
    }
  });

  test('codex adapter emits a native .codex-plugin layout', async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'agentpm-cx-'));
    try {
      await makeFixturePlugin(tmpDir);
      const ir = await parsePlugin(tmpDir);
      const result = getAdapter('codex').convert(toPortableCore(ir), 'workspace');

      const manifestFile = result.files.find(f => f.relativePath === '.codex-plugin/plugin.json');
      assert.ok(manifestFile, 'plugin manifest should be emitted');
      const manifest = JSON.parse(manifestFile.content) as Record<string, unknown>;
      assert.equal(typeof manifest.name, 'string');
      assert.equal(manifest.name.length > 0, true);
      assert.equal(manifest.skills, './skills/');
      assert.equal(manifest.mcpServers, './.mcp.json');

      const skillFile = result.files.find(f => f.relativePath === 'skills/demo/SKILL.md');
      assert.ok(skillFile);
      assert.ok(skillFile.content.includes('Do the thing with $ARGUMENTS.'));

      const mcpFile = result.files.find(f => f.relativePath === '.mcp.json');
      assert.ok(mcpFile);
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true });
    }
  });

  test('OpenCode lifecycle adapter properties & detection', async () => {
    const adapter = new OpenCodeAdapter();
    assert.equal(adapter.name, 'opencode');
    assert.deepEqual(adapter.capabilities(), ['skills', 'mcp', 'rules', 'agents', 'commands']);
    const isDetected = await adapter.detect();
    assert.equal(typeof isDetected, 'boolean');
  });
});
