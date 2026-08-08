import test, { describe } from 'node:test';
import assert from 'node:assert/strict';
import { validateCodexManifest } from '../src/core/codex-validator.js';

describe('Codex Native TypeScript Validator Unit Tests', () => {
  test('valid manifest with interface and capabilities passes validation', () => {
    const validManifest = {
      name: 'superpowers',
      version: '6.2.0',
      description: 'Core skills library for coding agents',
      interface: {
        displayName: 'Superpowers',
        shortDescription: 'TDD and debugging skills',
        longDescription: 'Comprehensive skills library covering test-driven development.',
        developerName: 'Jesse Vincent',
        category: 'Coding',
        capabilities: ['Interactive', 'Write'],
        defaultPrompt: [
          'Help me test and debug with TDD.',
          'Review my code changes.',
        ],
      },
      skills: './skills/',
    };

    const result = validateCodexManifest(validManifest);
    assert.equal(result.valid, true);
    assert.deepEqual(result.errors, []);
  });

  test('manifest missing interface block fails validation', () => {
    const missingInterface = {
      name: 'broken-plugin',
      version: '1.0.0',
      description: 'Missing interface',
      skills: './skills/',
    };

    const result = validateCodexManifest(missingInterface);
    assert.equal(result.valid, false);
    assert.ok(result.errors.some((e) => e.includes('`interface` must be an object')));
  });

  test('manifest with root hooks field is rejected', () => {
    const invalidHooksManifest = {
      name: 'hook-plugin',
      version: '1.0.0',
      description: 'Contains root hooks',
      interface: {
        displayName: 'Hook Plugin',
        shortDescription: 'Short desc',
        longDescription: 'Long desc',
        developerName: 'Dev',
        category: 'Coding',
        capabilities: ['Write'],
        defaultPrompt: 'Run prompt',
      },
      hooks: './hooks/hooks.json',
      skills: './skills/',
    };

    const result = validateCodexManifest(invalidHooksManifest);
    assert.equal(result.valid, false);
    assert.ok(result.errors.some((e) => e.includes('`hooks` is not supported at root level')));
  });

  test('manifest with missing capabilities in interface fails validation', () => {
    const missingCaps = {
      name: 'caps-plugin',
      version: '1.0.0',
      description: 'Missing capabilities',
      interface: {
        displayName: 'Caps Plugin',
        shortDescription: 'Short desc',
        longDescription: 'Long desc',
        developerName: 'Dev',
        category: 'Coding',
        defaultPrompt: 'Run prompt',
      },
      skills: './skills/',
    };

    const result = validateCodexManifest(missingCaps);
    assert.equal(result.valid, false);
    assert.ok(result.errors.some((e) => e.includes('`interface.capabilities` must be an array of non-empty strings')));
  });
});
