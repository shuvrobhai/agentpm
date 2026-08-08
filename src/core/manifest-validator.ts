import { validateCodexManifest } from './codex-validator.js';

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

const PORTABLE_ALLOWED_KEYS = new Set([
  '$schema',
  'name',
  'version',
  'description',
  'author',
  'homepage',
  'repository',
  'license',
  'keywords',
  'extensions',
]);

export function validatePortableManifest(manifest: unknown): ValidationResult {
  const errors: string[] = [];
  if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)) {
    return { valid: false, errors: ['Manifest must be a JSON object'] };
  }

  const obj = manifest as Record<string, unknown>;

  for (const key of Object.keys(obj)) {
    if (!PORTABLE_ALLOWED_KEYS.has(key)) {
      errors.push(`Field '${key}' is not allowed in closed schema`);
    }
  }

  if (typeof obj.name !== 'string' || !obj.name.trim()) {
    errors.push('field `name` must be a non-empty string');
  }

  if (typeof obj.version !== 'string' || !obj.version.trim()) {
    errors.push('field `version` must be a non-empty string');
  }

  if (typeof obj.description !== 'string' || !obj.description.trim()) {
    errors.push('field `description` must be a non-empty string');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

export function validateClaudeManifest(manifest: unknown): ValidationResult {
  const errors: string[] = [];
  if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)) {
    return { valid: false, errors: ['Manifest must be a JSON object'] };
  }

  const obj = manifest as Record<string, unknown>;

  if (typeof obj.name !== 'string' || !obj.name.trim()) {
    errors.push('field `name` must be a non-empty string');
  }

  if (typeof obj.description !== 'string' || !obj.description.trim()) {
    errors.push('field `description` must be a non-empty string');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

export function validateOpenCodeManifest(manifest: unknown): ValidationResult {
  const errors: string[] = [];
  if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)) {
    return { valid: false, errors: ['Manifest must be a JSON object'] };
  }

  const obj = manifest as Record<string, unknown>;

  if (typeof obj.name !== 'string' || !obj.name.trim()) {
    errors.push('field `name` must be a non-empty string');
  }

  if (typeof obj.description !== 'string' || !obj.description.trim()) {
    errors.push('field `description` must be a non-empty string');
  }

  if (obj.skills !== undefined && !Array.isArray(obj.skills)) {
    errors.push('field `skills` must be an array');
  }

  if (obj.plugins !== undefined && !Array.isArray(obj.plugins)) {
    errors.push('field `plugins` must be an array');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

export function validateAntigravityManifest(manifest: unknown): ValidationResult {
  const errors: string[] = [];
  if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)) {
    return { valid: false, errors: ['Manifest must be a JSON object'] };
  }

  const obj = manifest as Record<string, unknown>;

  if (typeof obj.name !== 'string' || !obj.name.trim()) {
    errors.push('field `name` must be a non-empty string');
  }

  if (typeof obj.description !== 'string' || !obj.description.trim()) {
    errors.push('field `description` must be a non-empty string');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

export function validateManifestForProvider(provider: string, manifest: unknown): ValidationResult {
  const p = provider.toLowerCase();
  if (p === 'codex') {
    return validateCodexManifest(manifest);
  }
  if (p === 'claude' || p === 'claude-code') {
    return validateClaudeManifest(manifest);
  }
  if (p === 'opencode') {
    return validateOpenCodeManifest(manifest);
  }
  if (p === 'antigravity') {
    return validateAntigravityManifest(manifest);
  }
  if (p === 'portable' || p === 'agent-plugins') {
    return validatePortableManifest(manifest);
  }

  return validatePortableManifest(manifest);
}
