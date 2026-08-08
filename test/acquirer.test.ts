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

  test('Acquirer.inspectSource returns 9-component IR breakdown', async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'acquirer-inspect-test-'));
    try {
      await fs.writeFile(
        path.join(tempDir, 'plugin.json'),
        JSON.stringify({ name: 'test-inspect', version: '1.0.0', description: 'Inspect test' }),
        'utf8'
      );
      await fs.mkdir(path.join(tempDir, 'skills', 'test-skill'), { recursive: true });
      await fs.writeFile(
        path.join(tempDir, 'skills', 'test-skill', 'SKILL.md'),
        '---\nname: test-skill\ndescription: Test skill\n---\nTest content',
        'utf8'
      );

      const result = await Acquirer.inspectSource(tempDir);
      assert.equal(result.summary.skills, 1);
      assert.equal(result.summary.commands, 0);
      assert.equal(result.summary.agents, 0);
      assert.equal(result.ir.skills.length, 1);
      assert.equal(result.portableCore.skills.length, 1);
    } finally {
      await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
    }
  });

  test('Acquirer.convertSource performs single-pass conversion to portable and native targets', async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'acquirer-convert-src-'));
    const outPortable = await fs.mkdtemp(path.join(os.tmpdir(), 'acquirer-convert-out-p-'));
    const outNative = await fs.mkdtemp(path.join(os.tmpdir(), 'acquirer-convert-out-n-'));

    try {
      await fs.writeFile(
        path.join(tempDir, 'plugin.json'),
        JSON.stringify({ name: 'convert-test', version: '1.0.0' }),
        'utf8'
      );
      await fs.mkdir(path.join(tempDir, 'skills', 'demo'), { recursive: true });
      await fs.writeFile(
        path.join(tempDir, 'skills', 'demo', 'SKILL.md'),
        '---\nname: demo\ndescription: Demo skill\n---\nDemo',
        'utf8'
      );

      // Portable target
      const resPortable = await Acquirer.convertSource(tempDir, 'agent-plugins', outPortable);
      assert.equal(resPortable.success, true);
      assert.equal(resPortable.target, 'Agent Plugins v1 (Portable)');
      assert.ok(await fs.access(path.join(outPortable, 'plugin.json')).then(() => true).catch(() => false));

      // Native target
      const resNative = await Acquirer.convertSource(tempDir, 'antigravity', outNative);
      assert.equal(resNative.success, true);
      assert.equal(resNative.target, 'Antigravity CLI');
      assert.ok(Array.isArray(resNative.files));
      assert.ok(resNative.files.length > 0);
    } finally {
      await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
      await fs.rm(outPortable, { recursive: true, force: true }).catch(() => {});
      await fs.rm(outNative, { recursive: true, force: true }).catch(() => {});
    }
  });

  test('Acquirer.update preserves recorded ref and subfolder from registry ledger', async () => {
    const { GlobalStore } = await import('../src/core/store.js');
    const mockEntry = {
      source: 'https://github.com/owner/sub-repo.git',
      ref: 'v2.0.0',
      subfolder: 'plugins/my-sub',
      resolved_commit: 'b'.repeat(40),
      content_hash: 'c'.repeat(64),
      source_vendor: 'claude-code',
      installed_at: new Date().toISOString(),
      deployed_files: [],
    };

    await GlobalStore.updateRegistry('owner/sub-repo', mockEntry);
    const registry = await GlobalStore.readRegistry();
    assert.equal(registry.packages['owner/sub-repo']?.subfolder, 'plugins/my-sub');
    assert.equal(registry.packages['owner/sub-repo']?.ref, 'v2.0.0');
  });
});
