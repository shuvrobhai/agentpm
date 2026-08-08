import test, { describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { createDashboardApiRouter } from '../src/deploy/dashboard-api.js';
import { renderDashboardHtml } from '../src/deploy/dashboard-ui.js';

describe('Web Dashboard & API Router Unit Tests', () => {
  test('createDashboardApiRouter exports a valid Express router', () => {
    const router = createDashboardApiRouter();
    assert.equal(typeof router, 'function');
    assert.equal(typeof (router as any).get, 'function');
    assert.equal(typeof (router as any).post, 'function');
  });

  test('renderDashboardHtml returns complete HTML dashboard markup', () => {
    const html = renderDashboardHtml();
    assert.ok(html.includes('<!DOCTYPE html>'));
    assert.ok(html.includes('AgentPM — Cross-Agent Plugin Manager'));
    assert.ok(html.includes('Plugin Inspector (9-IR)'));
    assert.ok(html.includes('Conversion Studio'));
    assert.ok(html.includes('Doctor Diagnostics'));
    assert.ok(html.includes('Provider Matrix'));
  });

  test('router /inspect and /convert endpoints invoke Acquirer seam', async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'dash-router-test-'));
    try {
      await fs.writeFile(
        path.join(tempDir, 'plugin.json'),
        JSON.stringify({ name: 'router-test', version: '1.0.0' }),
        'utf8'
      );

      const router = createDashboardApiRouter();
      const inspectLayer = (router as any).stack.find((layer: any) => layer.route?.path === '/inspect');
      assert.ok(inspectLayer);
      const inspectHandler = inspectLayer.route.stack[0].handle;

      let inspectData: any;
      const mockInspectReq = { body: { source: tempDir } };
      const mockInspectRes = {
        json: (data: any) => { inspectData = data; return mockInspectRes; },
        status: () => mockInspectRes,
      };
      await inspectHandler(mockInspectReq, mockInspectRes);

      assert.ok(inspectData);
      assert.equal(inspectData.source, tempDir);
      assert.ok(inspectData.ir);
      assert.ok(inspectData.summary);

      const convertLayer = (router as any).stack.find((layer: any) => layer.route?.path === '/convert');
      assert.ok(convertLayer);
      const convertHandler = convertLayer.route.stack[0].handle;

      let convertData: any;
      const mockConvertReq = { body: { source: tempDir, target: 'antigravity' } };
      const mockConvertRes = {
        json: (data: any) => { convertData = data; return mockConvertRes; },
        status: () => mockConvertRes,
      };
      await convertHandler(mockConvertReq, mockConvertRes);

      assert.ok(convertData);
      assert.equal(convertData.success, true);
      assert.equal(convertData.target, 'Antigravity CLI');
      assert.ok(Array.isArray(convertData.files));
    } finally {
      await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
    }
  });
});
