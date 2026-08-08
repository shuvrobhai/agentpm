import type { PortableCoreIR, ConversionResult } from '../ir/types.js';

export interface AgentAdapterPaths {
  skillsWorkspace: string;
  skillsGlobal: string;
  rulesWorkspace: string;
  rulesGlobal: string;
  hooksWorkspace: string;
  hooksGlobal: string;
  mcpConfig: string;
  contextFile: string;
}

export interface AgentAdapter {
  name: string;
  displayName?: string;
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

  /**
   * Per-agent conversion (ADR 0013 Q14): `convert(portableCore)` emits the
   * native package layout, `materialize(enable/disable)` installs it. Every
   * registered adapter implements the emitter.
   */
  paths?: AgentAdapterPaths;
  convert(ir: PortableCoreIR, scope: 'workspace' | 'global'): ConversionResult;
}
