import { describe, it } from 'node:test';
import assert from 'node:assert';
import { createDispatcher, type ActionContext } from '../src/core/command-dispatcher.js';

describe('CommandDispatcher Unit Tests', () => {
  it('passes ActionContext to handler and handles successful execution', async () => {
    let executed = false;
    const handler = createDispatcher(async (ctx: ActionContext, arg1: string) => {
      assert.strictEqual(arg1, 'test-pkg');
      assert.strictEqual(typeof ctx.log, 'function');
      assert.strictEqual(typeof ctx.error, 'function');
      executed = true;
    });

    await handler('test-pkg', {});
    assert.strictEqual(executed, true);
    assert.notStrictEqual(process.exitCode, 1);
  });

  it('catches thrown errors and sets process.exitCode = 1 cleanly', async () => {
    const handler = createDispatcher(async () => {
      throw new Error('Simulated failure');
    });

    const prevCode = process.exitCode;
    try {
      await handler({});
      assert.strictEqual(process.exitCode, 1);
    } finally {
      process.exitCode = prevCode;
    }
  });
});
