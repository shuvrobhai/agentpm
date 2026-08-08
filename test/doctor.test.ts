import test, { describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { runDoctorDiagnostics, doctorCommand } from '../src/commands/doctor.js';

describe('Doctor Diagnostic Command Unit Tests', () => {
  test('runDoctorDiagnostics detects healthy state when no broken links exist', async () => {
    const report = await runDoctorDiagnostics();
    assert.ok(typeof report.totalChecks === 'number');
    assert.ok(Array.isArray(report.activePlugins));
    assert.ok(Array.isArray(report.issues));
    assert.ok(Array.isArray(report.fixedIssues));
  });

  test('runDoctorDiagnostics detects broken symlinks and cleans them with fix option', async () => {
    const tempDir = path.join(os.tmpdir(), `agentpm-doc-test-${Date.now()}`);
    const localPlugins = path.join(process.cwd(), '.agents', 'plugins');
    await fs.mkdir(localPlugins, { recursive: true });

    const fakeLink = path.join(localPlugins, 'broken-doctor-plugin');
    const nonExistentTarget = path.join(tempDir, 'does-not-exist');

    try {
      // Create broken symlink
      await fs.symlink(nonExistentTarget, fakeLink);

      // Run diagnostics without fix
      const report1 = await runDoctorDiagnostics();
      const hasIssue = report1.issues.some((i) => i.path === fakeLink && i.type === 'broken_symlink');
      assert.equal(hasIssue, true, 'Doctor should flag broken symlink');

      // Run diagnostics WITH fix
      const report2 = await runDoctorDiagnostics({ fix: true });
      assert.ok(report2.fixedIssues.some((f) => f.includes('broken-doctor-plugin')));

      const existsAfterFix = await fs.lstat(fakeLink).then(() => true).catch(() => false);
      assert.equal(existsAfterFix, false, 'Broken symlink should be purged by doctor --fix');
    } finally {
      await fs.unlink(fakeLink).catch(() => {});
    }
  });

  test('doctorCommand runs in JSON mode without throwing', async () => {
    let captured = '';
    const originalLog = console.log;
    console.log = (msg: string) => {
      captured += msg + '\n';
    };

    try {
      await doctorCommand({ json: true });
      const parsed = JSON.parse(captured.trim());
      assert.ok(parsed.timestamp);
      assert.ok(typeof parsed.totalChecks === 'number');
    } finally {
      console.log = originalLog;
    }
  });
});
