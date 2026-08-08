import fs from 'node:fs/promises';
import path from 'node:path';
import { GlobalStore } from './store.js';
import { parsePlugin } from '../parser/index.js';
import { toPortableCore } from '../ir/to-portable-core.js';
import { getAdapter } from '../adapters/index.js';

export interface MaterializationOptions {
  adapterName: string;
  pluginName: string;
  version?: string | undefined;
  sourcePath?: string | undefined;
  scope: 'global' | 'local';
  targetBaseDir: string;
  copy?: boolean | undefined;
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

    const adaptedFilesCount = await this.adaptToNative(rawSourcePath, adaptedDir, options.adapterName);

    const targetSourcePath = options.sourcePath || (adaptedFilesCount > 0 ? adaptedDir : rawSourcePath);
    const linkPath = path.join(options.targetBaseDir, pluginDirName);

    if (path.resolve(targetSourcePath) === path.resolve(linkPath)) {
      // Converted files already exist in-place in local workspace directory
      return {
        pluginDirName,
        materializedPath: linkPath,
        sourcePath: targetSourcePath,
        isCopy: false,
        adaptedFilesCount,
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
      adaptedFilesCount,
    };
  }

  /**
   * Derive a native layout from the portable core (ADR 0013 Q8/Q11). Parses the
   * stored package, narrows to PortableCoreIR, and runs the per-agent emitter.
   */
  private static async adaptToNative(
    sourceDir: string,
    adaptedDir: string,
    adapterName: string,
  ): Promise<number> {
    const adapter = getAdapter(adapterName);

    const ir = await parsePlugin(sourceDir);
    const result = adapter.convert(toPortableCore(ir), 'workspace');

    await fs.mkdir(adaptedDir, { recursive: true });
    for (const file of result.files) {
      const filePath = path.join(adaptedDir, file.relativePath);
      await fs.mkdir(path.dirname(filePath), { recursive: true });
      await fs.writeFile(filePath, file.content, 'utf-8');
    }

    return result.files.length;
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
