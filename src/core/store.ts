import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs/promises';

export interface ParsedRepo {
  namespace: string;
  pluginName: string;
  ref?: string;
  cloneUrl: string;
}

export class GlobalStore {
  static getStorePath(): string {
    return path.join(os.homedir(), '.agentplugins', 'plugins');
  }

  static getPluginPath(namespace: string, pluginName: string, version: string): string {
    return path.join(this.getStorePath(), namespace, pluginName, version);
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

    // Handle full URLs vs owner/repo format
    if (raw.startsWith('http://') || raw.startsWith('https://') || raw.startsWith('git@')) {
      const urlParts = raw.replace(/\.git$/, '').split('/');
      const pluginName = urlParts.pop() || 'unknown';
      const namespace = urlParts.pop() || 'unknown';
      return {
        namespace,
        pluginName,
        ref,
        cloneUrl: raw.endsWith('.git') ? raw : `${raw}.git`,
      };
    } else {
      const parts = raw.split('/');
      if (parts.length !== 2) {
        throw new Error(`Invalid package repository identifier: "${identifier}". Expected format "owner/repo" or GitHub URL.`);
      }
      const [namespace, pluginName] = parts;
      return {
        namespace,
        pluginName,
        ref,
        cloneUrl: `https://github.com/${namespace}/${pluginName}.git`,
      };
    }
  }
}
