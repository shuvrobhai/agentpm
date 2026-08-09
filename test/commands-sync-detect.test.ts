import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { syncCommand } from '../src/commands/sync.js';
import { detectCommand } from '../src/commands/detect.js';

describe('CLI Commands: Sync & Detect', () => {
  it('syncCommand runs in json mode without throwing', async () => {
    await syncCommand({ json: true });
  });

  it('syncCommand runs in dry-run mode without throwing', async () => {
    await syncCommand({ dryRun: true });
  });

  it('detectCommand runs in json mode without throwing', async () => {
    await detectCommand({ json: true });
  });

  it('detectCommand runs in verbose mode without throwing', async () => {
    await detectCommand({ verbose: true });
  });
});
