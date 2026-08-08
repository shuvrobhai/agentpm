import test, { describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {
  Acquirer,
  contentHashOfDir,
  serializeApmLockfile,
  readApmLockfile,
  writeApmLockfile,
} from '../src/core/acquirer.js';

describe('Acquirer Unit Tests', () => {
  test('Acquirer acquires local directory as workspace package', async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'acquirer-test-local-'));
    try {
      const res = await Acquirer.acquire(tempDir);
      assert.equal(res.sourceType, 'local');
      assert.equal(res.namespace, 'local');
      assert.equal(res.version, 'workspace');
      assert.equal(res.alreadyExisted, true);
    } finally {
      await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
    }
  });

  test('Acquirer rejects git flag injection in refs', async () => {
    await assert.rejects(
      async () => {
        await Acquirer.acquire('owner/repo', { ref: '-o' });
      },
      (err: any) => {
        return err.message.includes('refs must not start with a dash');
      }
    );
  });

  test('Acquirer rejects path traversal in subfolder option', async () => {
    await assert.rejects(
      async () => {
        await Acquirer.acquire('owner/repo', { subfolder: '../secret' });
      },
      (err: any) => {
        return err.message.includes('path traversal forbidden');
      }
    );
  });

  test('contentHashOfDir computes deterministic SHA-256 hash', async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'acquirer-hash-test-'));
    try {
      await fs.writeFile(path.join(tempDir, 'file1.txt'), 'hello world', 'utf8');
      await fs.mkdir(path.join(tempDir, 'sub'));
      await fs.writeFile(path.join(tempDir, 'sub', 'file2.txt'), 'foo bar', 'utf8');

      const hash1 = await contentHashOfDir(tempDir);
      const hash2 = await contentHashOfDir(tempDir);

      assert.ok(hash1.length === 64);
      assert.equal(hash1, hash2);
    } finally {
      await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
    }
  });

  test('readApmLockfile and writeApmLockfile serialize correctly', async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'acquirer-lock-test-'));
    try {
      await fs.writeFile(path.join(tempDir, 'plugin.json'), '{}', 'utf8');
      const lockPath = path.join(tempDir, 'apm.lock.yaml');

      await writeApmLockfile(
        lockPath,
        'my-plugin',
        'https://github.com/owner/my-plugin',
        'v1.0.0',
        'a'.repeat(40),
        tempDir
      );

      const content = await fs.readFile(lockPath, 'utf8');
      const lock = readApmLockfile(content);

      assert.ok(lock !== null);
      assert.equal(lock.version, '0.2');
      assert.ok(lock.packages['my-plugin']);
      assert.equal(lock.packages['my-plugin'].source, 'https://github.com/owner/my-plugin');
      assert.equal(lock.packages['my-plugin'].ref, 'v1.0.0');
    } finally {
      await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
    }
  });
});
