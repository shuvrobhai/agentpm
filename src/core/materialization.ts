import fs from 'node:fs/promises';
import path from 'node:path';
import { GlobalStore } from './store.js';
import { PluginConverter } from './converter.js';
import type { ConversionOptions } from './converter.js';

export interface MaterializationOptions {
  adapterName: string;
  pluginName: string;
  version?: string | undefined;
  sourcePath?: string | undefined;
  scope: 'global' | 'local';
  targetBaseDir: string;
  copy?: boolean | undefined;
  conversionOptions?: ConversionOptions | undefined;
}

export interface MaterializationResult {
  pluginDirName: string;
  materializedPath: string;
  sourcePath: string;
  isCopy: boolean;
  adaptedFilesCount: number;
}

export interface DematerializationOptions {
  pluginName: string;
  targetBaseDirs: string[];
}

export class MaterializationEngine {
  static async materialize(options: MaterializationOptions): Promise<MaterializationResult> {
    const version = options.version || 'latest';
    const rawSourcePath = options.sourcePath || (await GlobalStore.findPluginPath(options.pluginName, version));

    await GlobalStore.ensureDir(options.targetBaseDir);

    const lastSegment = path.basename(rawSourcePath);
    const isVersionSegment = ['latest', 'main', 'master', 'head'].includes(lastSegment.toLowerCase()) || /^v?\d+/.test(lastSegment);

    const pluginDirName = isVersionSegment
      ? path.basename(path.dirname(rawSourcePath))
      : lastSegment;

    const namespace = path.basename(path.dirname(path.dirname(rawSourcePath)));
    const adaptedDir = GlobalStore.getAdaptedPluginPath(
      options.adapterName,
      namespace || 'default',
      pluginDirName,
      version
    );

    const conversionOpts: ConversionOptions = options.conversionOptions || {
      targetAdapter: options.adapterName,
      memoryFilename: 'AGENTS.md',
      rootVarName: 'PLUGIN_ROOT',
      expandMcpPaths: true,
      neutralizeTerms: true,
    };

    const conversionResult = await PluginConverter.convertPlugin(rawSourcePath, adaptedDir, conversionOpts);

    const targetSourcePath = options.sourcePath || (conversionResult.filesModified > 0 ? adaptedDir : rawSourcePath);
    const linkPath = path.join(options.targetBaseDir, pluginDirName);

    if (path.resolve(targetSourcePath) === path.resolve(linkPath)) {
      // Converted files already exist in-place in local workspace directory
      return {
        pluginDirName,
        materializedPath: linkPath,
        sourcePath: targetSourcePath,
        isCopy: false,
        adaptedFilesCount: conversionResult.filesModified,
      };
    }

    const exists = await fs.lstat(linkPath).then(() => true).catch(() => false);
    if (exists) {
      await fs.rm(linkPath, { recursive: true, force: true });
    }

    if (options.copy) {
      await GlobalStore.copyDirectoryDereferenced(targetSourcePath, linkPath);
    } else {
      await fs.symlink(targetSourcePath, linkPath, 'dir');
    }

    return {
      pluginDirName,
      materializedPath: linkPath,
      sourcePath: targetSourcePath,
      isCopy: !!options.copy,
      adaptedFilesCount: conversionResult.filesModified,
    };
  }

  static async dematerialize(options: DematerializationOptions): Promise<string[]> {
    const removedPaths: string[] = [];

    for (const baseDir of options.targetBaseDirs) {
      const linkPath = path.join(baseDir, options.pluginName);
      const exists = await fs.lstat(linkPath).then(() => true).catch(() => false);
      if (exists) {
        await fs.rm(linkPath, { recursive: true, force: true });
        removedPaths.push(linkPath);
      }
    }

    return removedPaths;
  }
}
