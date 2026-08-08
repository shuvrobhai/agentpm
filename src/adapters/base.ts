export interface AgentAdapter {
  name: string;
  detect(scope?: 'global' | 'local'): Promise<boolean>;
  capabilities(): string[];
  install(pluginPath: string, scope: 'global' | 'local'): Promise<void>;
  uninstall(pluginName: string, scope: 'global' | 'local'): Promise<void>;
  enable(
    pluginName: string,
    scope?: 'global' | 'local',
    options?: { copy?: boolean | undefined; version?: string | undefined }
  ): Promise<void>;
  disable(pluginName: string, scope?: 'global' | 'local'): Promise<void>;
  resolveVersion(pluginName: string): Promise<string>;
  getPluginDir(pluginName: string, version?: string): string;
  getLocalPluginDir(pluginName: string): string;
  supportsDirectSymlink?(): boolean;
}
