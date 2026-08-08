export interface AgentAdapter {
  name: string;
  detect(scope?: 'global' | 'local'): Promise<boolean>;
  capabilities(): string[];
  install(pluginPath: string, scope: 'global' | 'local'): Promise<void>;
  uninstall(pluginName: string, scope: 'global' | 'local'): Promise<void>;
  enable(pluginName: string, version: string, scope: 'global' | 'local'): Promise<void>;
  disable(pluginName: string, scope: 'global' | 'local'): Promise<void>;
  supportsDirectSymlink?(): boolean;
}
