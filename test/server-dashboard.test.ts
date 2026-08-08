import test, { describe } from 'node:test';
import assert from 'node:assert/strict';
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
});
