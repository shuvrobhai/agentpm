import { AgentAdapter } from './base.js';

export class ClaudeCodeAdapter implements AgentAdapter {
  name = 'claude-code';

  async detect(): Promise<boolean> {
    // Stub implementation: check for .claudecode or ~/.claude
    return true;
  }

  capabilities(): string[] {
    return ['skills', 'mcp'];
  }

  async install(pluginPath: string, scope: 'global' | 'local'): Promise<void> {
    console.log(`[ClaudeCodeAdapter] Installing plugin from ${pluginPath} (${scope})`);
  }

  async uninstall(pluginName: string, scope: 'global' | 'local'): Promise<void> {
    console.log(`[ClaudeCodeAdapter] Uninstalling plugin ${pluginName} (${scope})`);
  }

  async enable(pluginName: string, version: string, scope: 'global' | 'local'): Promise<void> {
    console.log(`[ClaudeCodeAdapter] Symlinking plugin ${pluginName}@${version} (${scope})`);
  }

  async disable(pluginName: string, scope: 'global' | 'local'): Promise<void> {
    console.log(`[ClaudeCodeAdapter] Removing symlinks for plugin ${pluginName} (${scope})`);
  }
}
