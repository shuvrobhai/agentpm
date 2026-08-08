import test, { describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  ManifestValidator,
  validatePortableManifest,
  validateClaudeManifest,
  validateOpenCodeManifest,
  validateAntigravityManifest,
  validateManifestForProvider,
} from '../src/core/manifest-validator.js';

describe('Multi-Client Manifest Validator Unit Tests', () => {
  test('ManifestValidator class validates portable v1 manifest for closed schema', () => {
    const valid = {
      $schema: 'https://agentplugins.org/schemas/1.0.0/plugin.schema.json',
      name: 'superpowers',
      version: '1.0.0',
      description: 'Core skills library',
      author: 'Jesse Vincent',
    };
    const res = ManifestValidator.validatePortable(valid);
    assert.equal(res.valid, true);
    assert.equal(res.errors.length, 0);
  });

  test('ManifestValidator class rejects invalid portable manifest with unknown keys', () => {
    const invalid = {
      name: 'superpowers',
      version: '1.0.0',
      description: 'Core skills library',
      unknown_field: 'not allowed in closed schema',
    };
    const res = ManifestValidator.validate(invalid, 'portable');
    assert.equal(res.valid, false);
    assert.ok(res.errors.some((e) => e.includes('closed schema')));
  });

  test('Claude Code manifest validation accepts valid plugin', () => {
    const valid = {
      name: 'superpowers',
      version: '6.2.0',
      description: 'Claude Code skills',
      hooks: './hooks/hooks.json',
    };
    const res = ManifestValidator.validateClaude(valid);
    assert.equal(res.valid, true);
  });

  test('Claude Code manifest validation rejects missing name', () => {
    const invalid = {
      description: 'Missing name',
    };
    const res = validateClaudeManifest(invalid);
    assert.equal(res.valid, false);
    assert.ok(res.errors.some((e) => e.includes('field `name` must be a non-empty string')));
  });

  test('OpenCode AI manifest validation evaluates plugins and skills arrays', () => {
    const valid = {
      $schema: 'https://opencode.ai/config.json',
      name: 'superpowers',
      description: 'OpenCode skills',
      skills: ['./.opencode/skills/'],
      plugins: ['opencode-plugin-demo'],
    };
    const res = ManifestValidator.validateOpenCode(valid);
    assert.equal(res.valid, true);
  });

  test('Google Antigravity manifest validation checks required fields', () => {
    const valid = {
      name: 'superpowers',
      description: 'Antigravity plugin bundle',
      version: '1.0.0',
    };
    const res = validateAntigravityManifest(valid);
    assert.equal(res.valid, true);
  });

  test('ManifestValidator.validate dispatches to correct provider validator', () => {
    const codexValid = {
      name: 'superpowers',
      version: '1.0.0',
      description: 'Codex skills',
      interface: {
        displayName: 'Superpowers',
        shortDescription: 'Short desc',
        longDescription: 'Long desc',
        developerName: 'Dev',
        category: 'Coding',
        capabilities: ['Write'],
        defaultPrompt: 'Help me',
      },
    };
    const codexRes = ManifestValidator.validate(codexValid, 'codex');
    assert.equal(codexRes.valid, true);

    const claudeRes = validateManifestForProvider('claude', { name: 'demo', description: 'desc' });
    assert.equal(claudeRes.valid, true);
  });
});
