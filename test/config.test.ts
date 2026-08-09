import { describe, it } from 'node:test';
import assert from 'node:assert';
import path from 'node:path';
import fs from 'node:fs/promises';
import os from 'node:os';
import { findWorkspaceRoot } from '../src/core/config.js';

describe('findWorkspaceRoot Unit Tests', () => {
  it('locates workspace root from nested subdirectory', async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'agentpm-test-root-'));
    try {
      const nestedDir = path.join(tmpDir, 'src', 'components', 'button');
      await fs.mkdir(nestedDir, { recursive: true });
      await fs.mkdir(path.join(tmpDir, '.agents'), { recursive: true });

      const resolved = findWorkspaceRoot(nestedDir);
      assert.strictEqual(resolved, tmpDir);
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true });
    }
  });

  it('falls back to startDir if no workspace markers exist', async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'agentpm-test-noroot-'));
    try {
      const resolved = findWorkspaceRoot(tmpDir);
      assert.strictEqual(resolved, tmpDir);
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true });
    }
  });
});
