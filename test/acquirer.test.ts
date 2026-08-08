import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs/promises';
import {
  contentHashOfDir,
  writeApmLockfile,
  readApmLockfile,
  serializeApmLockfile,
  parseYamlish,
  APM_LOCKFILE,
} from '../src/core/acquirer.js';
import { agentpmCacheRoot } from '../src/core/config.js';

describe('Acquirer + APM-shaped lockfile (ADR 0013)', () => {
  test('contentHashOfDir hashes files deterministically and ignores .git', async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'agentpm-hash-'));
    try {
      await fs.mkdir(path.join(tmpDir, 'skills', 'demo'), { recursive: true });
      await fs.writeFile(path.join(tmpDir, 'skills', 'demo', 'SKILL.md'), 'hello', 'utf8');
      await fs.writeFile(path.join(tmpDir, 'plugin.json'), '{}', 'utf8');
      await fs.mkdir(path.join(tmpDir, '.git'), { recursive: true });
      await fs.writeFile(path.join(tmpDir, '.git', 'HEAD'), 'ref: refs/heads/main', 'utf8');

      const hash1 = await contentHashOfDir(tmpDir);
      const hash2 = await contentHashOfDir(tmpDir);
      assert.equal(hash1, hash2);

      await fs.writeFile(path.join(tmpDir, '.git', 'index'), 'CHANGED', 'utf8');
      const hash3 = await contentHashOfDir(tmpDir);
      assert.equal(hash1, hash3, 'changes under .git must not affect content hash');
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true });
    }
  });

  test('writeApmLockfile + readApmLockfile round-trips resolved commit and deployed files', async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'agentpm-lock-'));
    try {
      await fs.writeFile(path.join(tmpDir, 'plugin.json'), '{}', 'utf8');
      await fs.mkdir(path.join(tmpDir, 'skills', 'demo'), { recursive: true });
      await fs.writeFile(path.join(tmpDir, 'skills', 'demo', 'SKILL.md'), 'hi', 'utf8');

      const lockPath = path.join(tmpDir, APM_LOCKFILE);
      await writeApmLockfile(lockPath, 'demo', 'https://github.com/a/b.git', 'v1.0.0', 'a'.repeat(40), tmpDir);

      const raw = await fs.readFile(lockPath, 'utf8');
      assert.match(raw, /^version: 0\.2/m);
      assert.match(raw, /resolved_commit: a{40}/);
      assert.match(raw, /- skills\/demo\/SKILL\.md/);

      const parsed = readApmLockfile(raw);
      assert.ok(parsed);
      const pkg = parsed.packages['demo'];
      assert.ok(pkg);
      assert.equal(pkg.resolved_commit, 'a'.repeat(40));
      assert.equal(pkg.ref, 'v1.0.0');
      assert.ok(pkg.content_hash.length >= 64);
      assert.ok(pkg.deployed_files.includes('skills/demo/SKILL.md'));
      assert.ok(pkg.deployed_files.includes('plugin.json'));
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true });
    }
  });

  test('serializeApmLockfile is stable and parseable', () => {
    const lock = {
      version: '0.2' as const,
      packages: {
        demo: {
          source: 'https://github.com/a/b.git',
          ref: 'main',
          resolved_commit: 'b'.repeat(40),
          content_hash: 'c'.repeat(64),
          deployed_files: ['plugin.json', 'skills/demo/SKILL.md'],
          installed_at: '2026-08-08T00:00:00.000Z',
        },
      },
    };
    const yaml = serializeApmLockfile(lock);
    const parsed = parseYamlish(yaml);
    assert.equal(parsed?.version, '0.2');
    assert.equal((parsed.packages as any).demo.ref, 'main');
    assert.deepEqual((parsed.packages as any).demo.deployed_files, ['plugin.json', 'skills/demo/SKILL.md']);
    assert.equal((parsed.packages as any).demo.resolved_commit, 'b'.repeat(40));
  });

  test('AGENTPM_CACHE routes fetch cache under the injectable cache root', async () => {
    const tempCache = await fs.mkdtemp(path.join(os.tmpdir(), 'agentpm-cache-test-'));
    const prev = process.env.AGENTPM_CACHE;
    process.env.AGENTPM_CACHE = path.join(tempCache, 'cache');
    try {
      assert.ok(agentpmCacheRoot().startsWith(tempCache));
    } finally {
      if (prev === undefined) delete process.env.AGENTPM_CACHE;
      else process.env.AGENTPM_CACHE = prev;
      await fs.rm(tempCache, { recursive: true, force: true });
    }
  });
});
