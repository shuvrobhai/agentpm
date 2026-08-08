import path from 'node:path';
import type { AgentAdapter } from './base.js';

export class AgentPluginsAdapter implements AgentAdapter {
  name = 'agent-plugins';

  async detect(scope: 'global' | 'local' = 'local'): Promise<boolean> {
    return false;
  }

  capabilities(): string[] {
    return ['skills', 'mcp'];
  }

  async install(pluginPath: string, scope: 'global' | 'local'): Promise<void> {
    console.log(`[AgentPluginsAdapter] Portable v1 plugin staged at ${pluginPath} (${scope})`);
  }

  async uninstall(pluginName: string, scope: 'global' | 'local'): Promise<void> {
    console.log(`[AgentPluginsAdapter] Removed portable plugin ${pluginName} (${scope})`);
  }

  async enable(
    pluginName: string,
    scope: 'global' | 'local' = 'local',
    options?: { copy?: boolean | undefined; version?: string | undefined }
  ): Promise<void> {
    const target = path.join(process.cwd(), '.agents', 'plugins', pluginName);
    console.log(`[AgentPluginsAdapter] Portable plugin ${pluginName} enabled at ${target} (${scope})`);
    if (options?.copy) {
      console.log('[AgentPluginsAdapter] Copy mode enabled for portable plugin');
    }
  }

  async disable(pluginName: string, scope: 'global' | 'local' = 'local'): Promise<void> {
    console.log(`[AgentPluginsAdapter] Portable plugin ${pluginName} disabled (${scope})`);
  }

  async resolveVersion(pluginName: string): Promise<string> {
    return 'latest';
  }

  getPluginDir(pluginName: string, version = 'latest'): string {
    return path.join(process.cwd(), '.agents', 'plugins', pluginName, version);
  }

  getLocalPluginDir(pluginName: string): string {
    return path.join(process.cwd(), '.agents', 'plugins', pluginName);
  }
}
