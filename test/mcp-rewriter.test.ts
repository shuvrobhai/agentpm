import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { expandPathString, rewriteMcpServer, rewriteMcpConfig } from '../src/core/mcp-rewriter.js';

describe('McpRewriter', () => {
  const storePath = '/home/user/.agentplugins/plugins/my-plugin/1.0.0';

  it('expands ${CLAUDE_PLUGIN_ROOT} variable to store path', () => {
    const input = '${CLAUDE_PLUGIN_ROOT}/bin/server.js';
    const result = expandPathString(input, storePath);
    assert.equal(result, '/home/user/.agentplugins/plugins/my-plugin/1.0.0/bin/server.js');
  });

  it('expands relative paths ./ and ../ to absolute paths (ADR 0024)', () => {
    const result = expandPathString('./scripts/start.sh', storePath);
    assert.equal(result, '/home/user/.agentplugins/plugins/my-plugin/1.0.0/scripts/start.sh');
  });

  it('rewriteMcpServer rewrites command, args, and cwd', () => {
    const server = {
      name: 'test-mcp',
      type: 'stdio',
      command: '${CLAUDE_PLUGIN_ROOT}/bin/node',
      args: ['./server.js', 'extra-arg'],
      sourcePath: storePath,
    };

    const rewritten = rewriteMcpServer(server, { pluginStorePath: storePath, targetProvider: 'antigravity' });
    assert.equal(rewritten.command, '/home/user/.agentplugins/plugins/my-plugin/1.0.0/bin/node');
    assert.equal(rewritten.args![0], '/home/user/.agentplugins/plugins/my-plugin/1.0.0/server.js');
    assert.equal(rewritten.args![1], 'extra-arg');
    assert.equal(rewritten.cwd, storePath);
  });

  it('rewriteMcpConfig updates multi-server configuration objects', () => {
    const config = {
      serverA: {
        command: './bin/a',
        args: ['${CLAUDE_PLUGIN_ROOT}/data.json'],
      },
    };

    const rewritten = rewriteMcpConfig(config, { pluginStorePath: storePath, targetProvider: 'codex' });
    const sA = rewritten.serverA as Record<string, unknown>;
    assert.equal(sA.command, '/home/user/.agentplugins/plugins/my-plugin/1.0.0/bin/a');
    assert.equal((sA.args as string[])[0], '/home/user/.agentplugins/plugins/my-plugin/1.0.0/data.json');
    assert.equal(sA.cwd, storePath);
  });
});
