import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { VariableRewriteStep, MemoryTranspileStep, TerminologyNeutralizeStep } from '../src/core/pipeline/steps.js';
import { ConversionPipeline } from '../src/core/pipeline/pipeline.js';
import { ConversionContext } from '../src/core/pipeline/context.js';

describe('ConversionPipeline Unit Tests', () => {
  test('VariableRewriteStep rewrites vendor root placeholders', async () => {
    const step = new VariableRewriteStep();
    const ctx: ConversionContext = {
      srcPath: '/foo/SKILL.md',
      destPath: '/bar/SKILL.md',
      sourceRoot: '/foo',
      targetRoot: '/bar',
      ext: '.md',
      basename: 'SKILL.md',
      content: 'Copy dashboard from ${CLAUDE_PLUGIN_ROOT}/dashboard.html',
      options: {
        targetAdapter: 'antigravity',
        memoryFilename: 'AGENTS.md',
        rootVarName: 'PLUGIN_ROOT',
        expandMcpPaths: true,
        neutralizeTerms: true,
      },
      result: {
        filesProcessed: 1,
        filesModified: 0,
        variablesRewritten: 0,
        mcpPathsExpanded: 0,
        rulesTranspiled: 0,
      },
    };

    const res = await step.transform(ctx);
    assert.equal(res.modified, true);
    assert.ok(res.content.includes('${PLUGIN_ROOT}/dashboard.html'));
    assert.ok(!res.content.includes('${CLAUDE_PLUGIN_ROOT}'));
  });

  test('MemoryTranspileStep rewrites memory file names and references', async () => {
    const step = new MemoryTranspileStep();
    const ctx: ConversionContext = {
      srcPath: '/foo/CLAUDE.md',
      destPath: '/bar/AGENTS.md',
      sourceRoot: '/foo',
      targetRoot: '/bar',
      ext: '.md',
      basename: 'CLAUDE.md',
      content: 'Read CLAUDE.md and update claudeMd file.',
      options: {
        targetAdapter: 'antigravity',
        memoryFilename: 'AGENTS.md',
        rootVarName: 'PLUGIN_ROOT',
        expandMcpPaths: true,
        neutralizeTerms: true,
      },
      result: {
        filesProcessed: 1,
        filesModified: 0,
        variablesRewritten: 0,
        mcpPathsExpanded: 0,
        rulesTranspiled: 0,
      },
    };

    const res = await step.transform(ctx);
    assert.equal(res.modified, true);
    assert.ok(res.content.includes('AGENTS.md'));
    assert.ok(res.content.includes('agentsMd'));
  });

  test('TerminologyNeutralizeStep replaces vendor brand terms', async () => {
    const step = new TerminologyNeutralizeStep();
    const ctx: ConversionContext = {
      srcPath: '/foo/doc.md',
      destPath: '/bar/doc.md',
      sourceRoot: '/foo',
      targetRoot: '/bar',
      ext: '.md',
      basename: 'doc.md',
      content: 'Ask Claude Code or Claude to manage Cowork tasks.',
      options: {
        targetAdapter: 'antigravity',
        memoryFilename: 'AGENTS.md',
        rootVarName: 'PLUGIN_ROOT',
        expandMcpPaths: true,
        neutralizeTerms: true,
      },
      result: {
        filesProcessed: 1,
        filesModified: 0,
        variablesRewritten: 0,
        mcpPathsExpanded: 0,
        rulesTranspiled: 0,
      },
    };

    const res = await step.transform(ctx);
    assert.equal(res.modified, true);
    assert.ok(res.content.includes('coding agent'));
    assert.ok(res.content.includes('agent environment'));
    assert.ok(!res.content.includes('Claude'));
  });

  test('ConversionPipeline executes step chain in order', async () => {
    const pipeline = new ConversionPipeline([
      new VariableRewriteStep(),
      new MemoryTranspileStep(),
      new TerminologyNeutralizeStep(),
    ]);

    const ctx: ConversionContext = {
      srcPath: '/foo/SKILL.md',
      destPath: '/bar/SKILL.md',
      sourceRoot: '/foo',
      targetRoot: '/bar',
      ext: '.md',
      basename: 'SKILL.md',
      content: 'Use ${CLAUDE_PLUGIN_ROOT} with CLAUDE.md. Ask Claude Code to run.',
      options: {
        targetAdapter: 'antigravity',
        memoryFilename: 'AGENTS.md',
        rootVarName: 'PLUGIN_ROOT',
        expandMcpPaths: true,
        neutralizeTerms: true,
      },
      result: {
        filesProcessed: 1,
        filesModified: 0,
        variablesRewritten: 0,
        mcpPathsExpanded: 0,
        rulesTranspiled: 0,
      },
    };

    const res = await pipeline.execute(ctx);
    assert.equal(res.modified, true);
    assert.ok(res.content.includes('${PLUGIN_ROOT}'));
    assert.ok(res.content.includes('AGENTS.md'));
    assert.ok(res.content.includes('coding agent'));
  });
});
