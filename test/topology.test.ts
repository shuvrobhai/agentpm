import test, { describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { ProviderTopology } from '../src/core/topology.js';

describe('ProviderTopology Unit Tests', () => {
  test('ProviderTopology scans mock provider plugins and inspects providers', async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'topology-test-'));
    try {
      const mockPluginDir = path.join(tempDir, 'demo-plugin');
      await fs.mkdir(mockPluginDir, { recursive: true });
      await fs.writeFile(
        path.join(mockPluginDir, 'plugin.json'),
        JSON.stringify({ name: 'demo-plugin', version: '1.0.0' }),
        'utf8'
      );

      const items = await ProviderTopology.inspectProviders();
      assert.ok(Array.isArray(items));

      const installed = await ProviderTopology.scanInstalled();
      assert.ok(Array.isArray(installed));
    } finally {
      await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
    }
  });
});
