import { AgentAdapter } from './base.js';

export class AntigravityAdapter implements AgentAdapter {
  name = 'antigravity';

  async detect(): Promise<boolean> {
    // Stub implementation: check for .agents or ~/.gemini
    return true;
  }

  capabilities(): string[] {
    return ['skills', 'mcp', 'hooks'];
  }

  async install(pluginPath: string, scope: 'global' | 'local'): Promise<void> {
    console.log(`[AntigravityAdapter] Installing plugin from ${pluginPath} (${scope})`);
  }

  async uninstall(pluginName: string, scope: 'global' | 'local'): Promise<void> {
    console.log(`[AntigravityAdapter] Uninstalling plugin ${pluginName} (${scope})`);
  }

  async enable(pluginName: string, version: string, scope: 'global' | 'local'): Promise<void> {
    console.log(`[AntigravityAdapter] Symlinking plugin ${pluginName}@${version} (${scope})`);
  }

  async disable(pluginName: string, scope: 'global' | 'local'): Promise<void> {
    console.log(`[AntigravityAdapter] Removing symlinks for plugin ${pluginName} (${scope})`);
  }
}
