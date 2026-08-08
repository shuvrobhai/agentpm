import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs/promises';

export interface ParsedRepo {
  namespace: string;
  pluginName: string;
  ref?: string;
  cloneUrl: string;
}

const SAFE_PATH_COMPONENT = /^[a-zA-Z0-9_.-]+$/;

export class GlobalStore {
  static getStorePath(): string {
    return path.join(os.homedir(), '.agentplugins', 'plugins');
  }

  static getPluginPath(namespace: string, pluginName: string, version: string): string {
    this.validatePathComponent(namespace, 'namespace');
    this.validatePathComponent(pluginName, 'pluginName');
    this.validatePathComponent(version, 'version');
    return path.join(this.getStorePath(), namespace, pluginName, version);
  }

  static validatePathComponent(component: string, name: string): void {
    if (!component || component === '.' || component === '..' || !SAFE_PATH_COMPONENT.test(component)) {
      throw new Error(`Invalid or unsafe ${name}: "${component}". Must contain only alphanumeric characters, underscores, hyphens, or dots.`);
    }
  }

  static async ensureDir(dirPath: string): Promise<void> {
    await fs.mkdir(dirPath, { recursive: true });
  }

  static parseRepoIdentifier(identifier: string): ParsedRepo {
    let raw = identifier.trim();
    let ref: string | undefined;

    if (raw.includes('#')) {
      const parts = raw.split('#');
      raw = parts[0];
      ref = parts[1];
    }

    // Strip trailing slashes to prevent empty component errors
    raw = raw.replace(/\/+$/, '');

    let namespace: string;
    let pluginName: string;
    let cloneUrl: string;

    // Handle full URLs vs owner/repo format
    if (raw.startsWith('http://') || raw.startsWith('https://') || raw.startsWith('git@')) {
      const cleaned = raw.replace(/\.git$/, '');
      const urlParts = cleaned.split('/');
      pluginName = urlParts.pop() || '';
      namespace = urlParts.pop() || '';
      cloneUrl = raw.endsWith('.git') ? raw : `${raw}.git`;
    } else {
      const parts = raw.split('/');
      if (parts.length !== 2) {
        throw new Error(`Invalid package repository identifier: "${identifier}". Expected format "owner/repo" or GitHub URL.`);
      }
      [namespace, pluginName] = parts;
      cloneUrl = `https://github.com/${namespace}/${pluginName}.git`;
    }

    this.validatePathComponent(namespace, 'namespace');
    this.validatePathComponent(pluginName, 'pluginName');

    if (ref) {
      if (ref.startsWith('-')) {
        throw new Error(`Invalid git reference "${ref}". References cannot start with '-'.`);
      }
      this.validatePathComponent(ref, 'ref');
    }

    return {
      namespace,
      pluginName,
      ref,
      cloneUrl,
    };
  }
}
