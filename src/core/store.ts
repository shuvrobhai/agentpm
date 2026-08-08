import path from 'node:path';
import os from 'node:os';

export class GlobalStore {
  static getStorePath(): string {
    return path.join(os.homedir(), '.agentplugins', 'plugins');
  }

  static getPluginPath(namespace: string, pluginName: string, version: string): string {
    return path.join(this.getStorePath(), namespace, pluginName, version);
  }
}
