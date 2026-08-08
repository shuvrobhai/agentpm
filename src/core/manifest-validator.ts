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

export function validateCodexManifest(manifest: unknown): ValidationResult {
  const errors: string[] = [];

  if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)) {
    return { valid: false, errors: ['Manifest must be a JSON object'] };
  }

  const obj = manifest as Record<string, unknown>;

  // 1. Validate top-level required fields
  if (typeof obj.name !== 'string' || !obj.name.trim()) {
    errors.push('plugin.json field `name` must be a non-empty string');
  } else if (!/^[a-z0-9._-]+$/i.test(obj.name)) {
    errors.push('plugin.json field `name` contains invalid characters');
  }

  if (typeof obj.version !== 'string' || !obj.version.trim()) {
    errors.push('plugin.json field `version` must be a non-empty string');
  }

  if (typeof obj.description !== 'string' || !obj.description.trim()) {
    errors.push('plugin.json field `description` must be a non-empty string');
  }

  // 2. Strict rejection of top-level hooks
  if ('hooks' in obj) {
    errors.push('plugin.json field `hooks` is not supported at root level in Codex manifests');
  }

  // 3. Validate interface object
  const ui = obj.interface;
  if (!ui || typeof ui !== 'object' || Array.isArray(ui)) {
    errors.push('plugin.json field `interface` must be an object');
  } else {
    const uiObj = ui as Record<string, unknown>;

    for (const field of ['displayName', 'shortDescription', 'longDescription', 'developerName', 'category']) {
      if (typeof uiObj[field] !== 'string' || !(uiObj[field] as string).trim()) {
        errors.push(`plugin.json field \`interface.${field}\` must be a non-empty string`);
      }
    }

    const caps = uiObj.capabilities;
    if (!Array.isArray(caps) || caps.length === 0 || !caps.every((c) => typeof c === 'string' && c.trim())) {
      errors.push('plugin.json field `interface.capabilities` must be an array of non-empty strings');
    }

    const defaultPrompt = uiObj.defaultPrompt ?? uiObj.default_prompt;
    if (!defaultPrompt) {
      errors.push('plugin.json field `interface.defaultPrompt` is required');
    } else if (Array.isArray(defaultPrompt)) {
      if (!defaultPrompt.every((p) => typeof p === 'string' && p.trim())) {
        errors.push('plugin.json field `interface.defaultPrompt` array entries must be non-empty strings');
      }
    } else if (typeof defaultPrompt !== 'string' || !defaultPrompt.trim()) {
      errors.push('plugin.json field `interface.defaultPrompt` must be a string or array of strings');
    }
  }

  // 4. Validate skills path if present
  if ('skills' in obj && typeof obj.skills !== 'string') {
    errors.push('plugin.json field `skills` must be a relative directory string (e.g. `./skills/`)');
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

/**
 * Unified Deep Manifest Validator Module.
 * Exposes a clean, deep interface surface for all target agent platforms.
 */
export class ManifestValidator {
  static validate(manifest: unknown, provider: string): ValidationResult {
    return validateManifestForProvider(provider, manifest);
  }

  static validatePortable(manifest: unknown): ValidationResult {
    return validatePortableManifest(manifest);
  }

  static validateClaude(manifest: unknown): ValidationResult {
    return validateClaudeManifest(manifest);
  }

  static validateOpenCode(manifest: unknown): ValidationResult {
    return validateOpenCodeManifest(manifest);
  }

  static validateAntigravity(manifest: unknown): ValidationResult {
    return validateAntigravityManifest(manifest);
  }

  static validateCodex(manifest: unknown): ValidationResult {
    return validateCodexManifest(manifest);
  }
}
