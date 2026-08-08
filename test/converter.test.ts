import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs/promises';
import { PluginConverter } from '../src/core/converter.js';
import { convertHooks } from '../src/core/hook-converter.js';

describe('PluginConverter & HookConverter Unit Tests', () => {
  test('convertHooks converts Claude Code hooks to Antigravity schema', () => {
    const claudeHooks = {
      hooks: [
        {
          event: 'PreToolUse' as const,
          matcher: { toolName: 'Bash' },
          action: { type: 'command' as const, command: './check.sh' },
        },
        {
          event: 'PostToolUse' as const,
          matcher: { toolName: 'Write' },
          action: { type: 'command' as const, command: './format.sh' },
        },
        {
          event: 'SessionStart' as const,
          action: { type: 'command' as const, command: './init.sh' },
        },
      ],
    };

    const result = convertHooks(claudeHooks, 'test-plugin');
    assert.equal(result.converted, 2);
    assert.equal(result.skipped, 1);

    const keys = Object.keys(result.output);
    assert.ok(keys.length >= 2);

    const preToolHook = Object.values(result.output).find(h => h.PreToolUse);
    assert.ok(preToolHook);
    assert.equal(preToolHook?.PreToolUse?.[0].matcher, 'run_command');
    assert.equal(preToolHook?.PreToolUse?.[0].hooks[0].command, './check.sh');

    const postToolHook = Object.values(result.output).find(h => h.PostToolUse);
    assert.ok(postToolHook);
    assert.equal(postToolHook?.PostToolUse?.[0].matcher, 'write_to_file');
    assert.equal(postToolHook?.PostToolUse?.[0].hooks[0].command, './format.sh');
  });

  test('convertPlugin rewrites plugin variables, memory files, and converts hooks', async () => {
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

      const hooksPath = path.join(tmpDir, 'hooks.json');
      await fs.writeFile(
        hooksPath,
        JSON.stringify({
          hooks: [
            {
              event: 'PreToolUse',
              matcher: { toolName: 'Bash' },
              action: { type: 'command', command: './validate.sh' }
            }
          ]
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

      assert.ok(result.filesProcessed >= 4);
      assert.ok(result.filesModified >= 3);
      assert.ok(result.variablesRewritten >= 1);
      assert.ok(result.mcpPathsExpanded >= 1);
      assert.equal(result.rulesTranspiled, 1);
      assert.equal(result.hooksConverted, 1);

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

      const destHooksJson = JSON.parse(await fs.readFile(path.join(destDir, 'hooks.json'), 'utf8'));
      const hookEntry = Object.values(destHooksJson)[0] as any;
      assert.ok(hookEntry.PreToolUse);
      assert.equal(hookEntry.PreToolUse[0].matcher, 'run_command');
      assert.equal(hookEntry.PreToolUse[0].hooks[0].command, './validate.sh');

    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true });
      await fs.rm(destDir, { recursive: true, force: true });
    }
  });
});
