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
import { GlobalStore } from '../src/core/store.js';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

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

  test('PackageAcquirer.acquire acquires local directories directly', async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'agentpm-acq-local-'));
    try {
      const { PackageAcquirer } = await import('../src/core/acquirer.js');
      const acquired = await PackageAcquirer.acquire(tmpDir);
      assert.equal(acquired.sourceType, 'local');
      assert.equal(acquired.version, 'workspace');
      assert.equal(acquired.sourcePath, tmpDir);
      assert.equal(acquired.alreadyExisted, true);
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true });
    }
  });

  test('PackageAcquirer.acquire rejects git ref flag injection', async () => {
    const { PackageAcquirer } = await import('../src/core/acquirer.js');
    await assert.rejects(
      async () => {
        await PackageAcquirer.acquire('owner/repo#-upload-pack');
      },
      (err: Error) => err.message.includes('Invalid git reference') || err.message.includes('Security Violation'),
    );
  });

  test('PackageAcquirer temp mode clones into a disposable dir and cleanup removes it', async () => {
    const { PackageAcquirer } = await import('../src/core/acquirer.js');

    const fixture = await fs.mkdtemp(path.join(os.tmpdir(), 'agentpm-tmprepo-'));
    const repoDir = path.join(fixture, 'fixture-repo');
    await fs.mkdir(repoDir, { recursive: true });
    await fs.writeFile(path.join(repoDir, 'plugin.json'), '{"name":"fixture","version":"1.0.0"}', 'utf8');
    await fs.mkdir(path.join(repoDir, 'skills', 'demo'), { recursive: true });
    await fs.writeFile(path.join(repoDir, 'skills', 'demo', 'SKILL.md'), 'demo', 'utf8');

    try {
      await execFileAsync('git', ['init', repoDir], { cwd: repoDir });
      await execFileAsync('git', ['config', 'user.email', 'test@example.com'], { cwd: repoDir });
      await execFileAsync('git', ['config', 'user.name', 'Test'], { cwd: repoDir });
      await execFileAsync('git', ['add', '.'], { cwd: repoDir });
      await execFileAsync('git', ['commit', '-m', 'init'], { cwd: repoDir });

      const url = `file://${repoDir}`;
      const acquired = await PackageAcquirer.acquire(url, { temp: true });
      assert.equal(acquired.sourceType, 'git');
      assert.ok(acquired.sourcePath.startsWith(os.tmpdir()), 'temp acquire should live under tmp');
      assert.ok(typeof acquired.cleanup === 'function');
      assert.ok(await fs.access(acquired.sourcePath).then(() => true).catch(() => false));

      const tempRoot = acquired.sourcePath.split(path.sep).slice(0, -1).join(path.sep);
      await acquired.cleanup!();
      assert.equal(await fs.access(tempRoot).then(() => true).catch(() => false), false, 'cleanup should remove the temp clone');
    } finally {
      await fs.rm(fixture, { recursive: true, force: true });
    }
  });

  test('parseRepoIdentifier accepts file:// git transports without appending .git', () => {
    const parsed = GlobalStore.parseRepoIdentifier('file:///tmp/some/repo');
    assert.equal(parsed.cloneUrl, 'file:///tmp/some/repo');
    assert.equal(parsed.pluginName, 'repo');
  });

  test('PackageAcquirer fetchPlugin persists pristine clone in repos/<namespace>/<plugin> and converts to portable core in plugins/', async () => {
    const { PackageAcquirer } = await import('../src/core/acquirer.js');

    const fixture = await fs.mkdtemp(path.join(os.tmpdir(), 'agentpm-pristine-test-'));
    const repoDir = path.join(fixture, 'test-repo');
    const prevStore = process.env.AGENTPM_STORE;
    const prevCache = process.env.AGENTPM_CACHE;
    process.env.AGENTPM_STORE = path.join(fixture, 'store');
    process.env.AGENTPM_CACHE = path.join(fixture, 'cache');

    try {
      await fs.mkdir(path.join(repoDir, 'skills', 'greet'), { recursive: true });
      await fs.writeFile(
        path.join(repoDir, 'plugin.json'),
        JSON.stringify({ name: 'pristine-demo', version: '1.0.0', description: 'Test pristine repo' }),
        'utf8'
      );
      await fs.writeFile(path.join(repoDir, 'skills', 'greet', 'SKILL.md'), '---\nname: greet\ndescription: Greet skill\n---\nHello', 'utf8');

      await execFileAsync('git', ['init', repoDir], { cwd: repoDir });
      await execFileAsync('git', ['config', 'user.email', 'test@example.com'], { cwd: repoDir });
      await execFileAsync('git', ['config', 'user.name', 'Test'], { cwd: repoDir });
      await execFileAsync('git', ['add', '.'], { cwd: repoDir });
      await execFileAsync('git', ['commit', '-m', 'init'], { cwd: repoDir });

      const url = `file://${repoDir}`;
      const parsed = GlobalStore.parseRepoIdentifier(url);
      const acquired = await PackageAcquirer.fetchPlugin(parsed, true);

      assert.ok(acquired.clonePath, 'clonePath must be returned');
      assert.ok(await fs.access(path.join(acquired.clonePath, '.git')).then(() => true).catch(() => false), 'pristine clone in repos/ must retain .git');
      assert.ok(await fs.access(path.join(acquired.sourcePath, 'plugin.json')).then(() => true).catch(() => false), 'portable package must exist');
      assert.equal(
        await fs.access(path.join(acquired.sourcePath, '.git')).then(() => true).catch(() => false),
        false,
        'portable package in plugins/ must NOT retain .git'
      );
    } finally {
      if (prevStore === undefined) delete process.env.AGENTPM_STORE;
      else process.env.AGENTPM_STORE = prevStore;
      if (prevCache === undefined) delete process.env.AGENTPM_CACHE;
      else process.env.AGENTPM_CACHE = prevCache;
      await fs.rm(fixture, { recursive: true, force: true });
    }
  });
});
