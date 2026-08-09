import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { convertHooks } from '../src/ir/hook-converter.js';
import type { HookIR } from '../src/ir/types.js';

describe('HookConverter', () => {
  const sampleHooks: HookIR[] = [
    {
      event: 'PreToolUse',
      matcher: 'bash',
      type: 'command',
      command: './scripts/check.sh',
      raw: {},
      sourcePath: 'hooks.json',
    },
    {
      event: 'SessionStart',
      type: 'command',
      command: './scripts/start.sh',
      raw: {},
      sourcePath: 'hooks.json',
    },
  ];

  it('converts hooks for Antigravity, mapping matchers and structuring schema', () => {
    const res = convertHooks(sampleHooks, 'antigravity', 'test-plugin');
    assert.equal(res.antigravitySchema !== undefined, true);
    assert.equal(res.convertedHooks.length, 1); // PreToolUse is supported, SessionStart is skipped with warning
    assert.equal(res.warnings.length, 1);
    assert.match(res.warnings[0]!, /SessionStart/);

    const schema = res.antigravitySchema!['test-plugin']!;
    assert.equal(schema.PreToolUse !== undefined, true);
    assert.equal(schema.PreToolUse![0]!.matcher, 'run_command');
    assert.equal(schema.PreToolUse![0]!.hooks[0]!.command, './scripts/check.sh');
  });

  it('passes through hooks for generic targets with matcher mapping', () => {
    const res = convertHooks(sampleHooks, 'opencode', 'test-plugin');
    assert.equal(res.convertedHooks.length, 2);
    assert.equal(res.convertedHooks[0]!.matcher, 'bash');
  });
});
