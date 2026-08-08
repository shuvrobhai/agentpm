import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs/promises';
import { PluginConverter } from '../src/core/converter.js';

describe('PluginConverter Unit Tests', () => {
  test('convertPlugin rewrites plugin variables and memory files', async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'agentpm-test-src-'));
    const destDir = await fs.mkdtemp(path.join(os.tmpdir(), 'agentpm-test-dest-'));

    try {
      // 1. Create a mock vendor plugin structure
      const skillDir = path.join(tmpDir, 'skills');
      await fs.mkdir(skillDir, { recursive: true });

      const claudeMdPath = path.join(tmpDir, 'CLAUDE.md');
      await fs.writeFile(claudeMdPath, '# Memory\n- Ask Claude to do the task.', 'utf8');

      const skillPath = path.join(skillDir, 'SKILL.md');
      await fs.writeFile(
        skillPath,
        'Copy dashboard from ${CLAUDE_PLUGIN_ROOT}/skills/dashboard.html to local folder. Ask Claude Code to run it.',
        'utf8'
      );

      const mcpPath = path.join(tmpDir, '.mcp.json');
      await fs.writeFile(
        mcpPath,
        JSON.stringify({
          mcpServers: {
            testServer: {
              command: 'node',
              args: ['index.js'],
              cwd: './server'
            }
          }
        }, null, 2),
        'utf8'
      );

      // 2. Run conversion
      const result = await PluginConverter.convertPlugin(tmpDir, destDir, {
        targetAdapter: 'antigravity',
        memoryFilename: 'AGENTS.md',
        rootVarName: 'PLUGIN_ROOT',
        expandMcpPaths: true,
        neutralizeTerms: true,
      });

      assert.ok(result.filesProcessed >= 3);
      assert.ok(result.filesModified >= 2);
      assert.ok(result.variablesRewritten >= 1);
      assert.ok(result.mcpPathsExpanded >= 1);
      assert.equal(result.rulesTranspiled, 1);

      // 3. Verify output files
      const destAgentsMd = path.join(destDir, 'AGENTS.md');
      const agentsContent = await fs.readFile(destAgentsMd, 'utf8');
      assert.ok(agentsContent.includes('coding agent'));
      assert.ok(!agentsContent.includes('Claude'));

      const destSkillMd = path.join(destDir, 'skills', 'SKILL.md');
      const skillContent = await fs.readFile(destSkillMd, 'utf8');
      assert.ok(skillContent.includes('${PLUGIN_ROOT}/skills/dashboard.html'));
      assert.ok(!skillContent.includes('${CLAUDE_PLUGIN_ROOT}'));
      assert.ok(skillContent.includes('coding agent'));

      const destMcpJson = path.join(destDir, '.mcp.json');
      const mcpContent = JSON.parse(await fs.readFile(destMcpJson, 'utf8'));
      const expandedCwd = mcpContent.mcpServers.testServer.cwd;
      assert.equal(expandedCwd, path.resolve(tmpDir, './server'));
      assert.ok(path.isAbsolute(expandedCwd));

    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true });
      await fs.rm(destDir, { recursive: true, force: true });
    }
  });
});
