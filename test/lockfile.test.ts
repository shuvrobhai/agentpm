import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { LockfileEngine } from '../src/core/lockfile.js';

describe('LockfileEngine Unit Tests', () => {
  it('reads empty lockfile schema if .agentpm.lock does not exist', async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'lockfile-test-'));
    try {
      const lock = await LockfileEngine.readLockfile(tmpDir);
      assert.equal(lock.version, 1);
      assert.deepEqual(lock.installs, {});
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true });
    }
  });

  it('records materialization and writes .agentpm.lock file', async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'lockfile-test-'));
    try {
      const sampleFile = path.join(tmpDir, '.agents/skills/my-skill/SKILL.md');
      await fs.mkdir(path.dirname(sampleFile), { recursive: true });
      await fs.writeFile(sampleFile, '# My Skill', 'utf-8');

      await LockfileEngine.recordMaterialization({
        pluginName: 'demo-plugin',
        source: 'github:user/demo-plugin',
        version: '1.0.0',
        agent: 'antigravity',
        files: [
          {
            path: '.agents/skills/my-skill/SKILL.md',
            type: 'skill',
            managed: true,
          },
        ],
        workspaceRoot: tmpDir,
      });

      const lock = await LockfileEngine.readLockfile(tmpDir);
      assert.equal(lock.installs['demo-plugin'] !== undefined, true);
      const install = lock.installs['demo-plugin']!;
      assert.equal(install.version, '1.0.0');
      assert.equal(install.agents['antigravity'] !== undefined, true);
      assert.equal(install.agents['antigravity']!.files[0]!.type, 'skill');
      assert.match(install.agents['antigravity']!.files[0]!.hash!, /^sha256:/);
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true });
    }
  });

  it('detects file drift when tracked file is missing or modified', async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'lockfile-test-'));
    try {
      const sampleFile = path.join(tmpDir, '.agents/rules/test.md');
      await fs.mkdir(path.dirname(sampleFile), { recursive: true });
      await fs.writeFile(sampleFile, 'initial content', 'utf-8');

      await LockfileEngine.recordMaterialization({
        pluginName: 'rule-plugin',
        source: 'local',
        version: '1.0.0',
        agent: 'antigravity',
        files: [
          {
            path: '.agents/rules/test.md',
            type: 'rule',
            managed: true,
          },
        ],
        workspaceRoot: tmpDir,
      });

      let drift = await LockfileEngine.detectDrift(tmpDir);
      assert.equal(drift.hasDrift, false);

      // Modify file content
      await fs.writeFile(sampleFile, 'modified content', 'utf-8');
      drift = await LockfileEngine.detectDrift(tmpDir);
      assert.equal(drift.hasDrift, true);
      assert.equal(drift.issues[0]!.type, 'modified');
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true });
    }
  });

  it('removes materialization cleanly and deletes recorded files', async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'lockfile-test-'));
    try {
      const sampleFile = path.join(tmpDir, '.agents/plugins/to-delete');
      await fs.mkdir(sampleFile, { recursive: true });

      await LockfileEngine.recordMaterialization({
        pluginName: 'to-delete',
        source: 'local',
        version: '1.0.0',
        agent: 'antigravity',
        files: [
          {
            path: '.agents/plugins/to-delete',
            type: 'other',
            managed: true,
          },
        ],
        workspaceRoot: tmpDir,
      });

      const removed = await LockfileEngine.removeMaterialization('to-delete', 'antigravity', tmpDir);
      assert.equal(removed.length, 1);

      const lock = await LockfileEngine.readLockfile(tmpDir);
      assert.equal(lock.installs['to-delete'], undefined);
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true });
    }
  });
});
