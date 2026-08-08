import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs/promises';

export interface ParsedRepo {
  namespace: string;
  pluginName: string;
  ref?: string;
  cloneUrl: string;
  subfolder?: string;
}

export interface StoredPlugin {
  namespace: string;
  pluginName: string;
  version: string;
  fullPath: string;
}

const SAFE_PATH_COMPONENT = /^[a-zA-Z0-9_.-]+$/;

export class GlobalStore {
  static getStorePath(): string {
    return path.join(os.homedir(), '.agentplugins', 'plugins');
  }

  static getAdaptedStorePath(): string {
    return path.join(os.homedir(), '.agentplugins', 'adapted');
  }

  static getAdaptedPluginPath(adapterName: string, namespace: string, pluginName: string, version: string): string {
    this.validatePathComponent(adapterName, 'adapterName');
    this.validatePathComponent(namespace, 'namespace');
    this.validatePathComponent(pluginName, 'pluginName');
    this.validatePathComponent(version, 'version');
    return path.join(this.getAdaptedStorePath(), adapterName, namespace, pluginName, version);
  }

  static async copyDirectoryDereferenced(sourceDir: string, targetDir: string): Promise<void> {
    await fs.mkdir(targetDir, { recursive: true });
    const entries = await fs.readdir(sourceDir);

    for (const entryName of entries) {
      const srcPath = path.join(sourceDir, entryName);
      const destPath = path.join(targetDir, entryName);

      const stat = await fs.stat(srcPath).catch(() => null);
      if (!stat) continue;

      if (stat.isDirectory()) {
        await this.copyDirectoryDereferenced(srcPath, destPath);
      } else if (stat.isFile()) {
        await fs.copyFile(srcPath, destPath);
      }
    }
  }

  static getPluginPath(namespace: string, pluginName: string, version: string): string {
    this.validatePathComponent(namespace, 'namespace');
    this.validatePathComponent(pluginName, 'pluginName');
    this.validatePathComponent(version, 'version');
    return path.join(this.getStorePath(), namespace, pluginName, version);
  }

  static async findPluginPath(pluginIdentifier: string, version = 'latest'): Promise<string> {
    const resolveVersionFromPluginDir = async (pluginDir: string, requestedVer: string): Promise<string | null> => {
      const exactPath = path.join(pluginDir, requestedVer);
      const exactExists = await fs.access(exactPath).then(() => true).catch(() => false);
      if (exactExists) return exactPath;

      if (requestedVer === 'latest') {
        const availableVersions = await fs.readdir(pluginDir).catch(() => []);
        const validVersions = availableVersions.filter(v => !v.startsWith('.'));
        if (validVersions.length > 0) {
          return path.join(pluginDir, validVersions[0]);
        }
      }
      return null;
    };

    if (pluginIdentifier.includes('/')) {
      const [namespace, pluginName] = pluginIdentifier.split('/');
      const pluginDir = path.join(this.getStorePath(), namespace, pluginName);
      const resolved = await resolveVersionFromPluginDir(pluginDir, version);
      if (resolved) return resolved;
      throw new Error(`Plugin "${pluginIdentifier}@${version}" not found in global store at ${pluginDir}`);
    }

    const storePath = this.getStorePath();
    const namespaces = await fs.readdir(storePath).catch(() => []);

    for (const ns of namespaces) {
      const pluginDir = path.join(storePath, ns, pluginIdentifier);
      const resolved = await resolveVersionFromPluginDir(pluginDir, version);
      if (resolved) return resolved;
    }

    throw new Error(`Plugin "${pluginIdentifier}@${version}" not found in any namespace in global store (${storePath})`);
  }

  static async listGlobalPlugins(): Promise<StoredPlugin[]> {
    const storePath = this.getStorePath();
    const plugins: StoredPlugin[] = [];

    const namespaces = await fs.readdir(storePath).catch(() => []);

    for (const ns of namespaces) {
      if (ns.startsWith('.')) continue;
      const nsPath = path.join(storePath, ns);
      const statNs = await fs.stat(nsPath).catch(() => null);
      if (!statNs || !statNs.isDirectory()) continue;

      const pluginDirs = await fs.readdir(nsPath).catch(() => []);
      for (const pName of pluginDirs) {
        if (pName.startsWith('.')) continue;
        const pPath = path.join(nsPath, pName);
        const statP = await fs.stat(pPath).catch(() => null);
        if (!statP || !statP.isDirectory()) continue;

        const versions = await fs.readdir(pPath).catch(() => []);
        for (const ver of versions) {
          if (ver.startsWith('.')) continue;
          const verPath = path.join(pPath, ver);
          const statVer = await fs.stat(verPath).catch(() => null);
          if (!statVer || !statVer.isDirectory()) continue;

          plugins.push({
            namespace: ns,
            pluginName: pName,
            version: ver,
            fullPath: verPath,
          });
        }
      }
    }

    return plugins;
  }

  static async removePlugin(pluginIdentifier: string): Promise<string[]> {
    const removedPaths: string[] = [];

    if (pluginIdentifier.includes('/')) {
      const targetPath = await this.findPluginPath(pluginIdentifier);
      const parentDir = path.dirname(targetPath);
      await fs.rm(parentDir, { recursive: true, force: true });
      removedPaths.push(parentDir);
    } else {
      const storePath = this.getStorePath();
      const namespaces = await fs.readdir(storePath).catch(() => []);
      for (const ns of namespaces) {
        const candidatePath = path.join(storePath, ns, pluginIdentifier);
        const exists = await fs.access(candidatePath).then(() => true).catch(() => false);
        if (exists) {
          await fs.rm(candidatePath, { recursive: true, force: true });
          removedPaths.push(candidatePath);
        }
      }
    }

    if (removedPaths.length === 0) {
      throw new Error(`Plugin "${pluginIdentifier}" not found in global store.`);
    }

    return removedPaths;
  }

  static validatePathComponent(component: string, name: string): void {
    if (!component || component === '.' || component === '..' || !SAFE_PATH_COMPONENT.test(component)) {
      throw new Error(`Invalid or unsafe ${name}: "${component}". Must contain only alphanumeric characters, underscores, hyphens, or dots.`);
    }
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

    raw = raw.replace(/\/+$/, '');

    let namespace: string;
    let pluginName: string;
    let cloneUrl: string;
    let subfolder: string | undefined;

    if (raw.startsWith('http://') || raw.startsWith('https://') || raw.startsWith('git@')) {
      const cleaned = raw.replace(/\.git$/, '');
      if (cleaned.includes('/tree/')) {
        const [repoBase, treePath] = cleaned.split('/tree/');
        const urlParts = repoBase.split('/');
        const rootRepoName = urlParts.pop() || '';
        namespace = urlParts.pop() || '';
        cloneUrl = `${repoBase}.git`;

        if (treePath) {
          const treeParts = treePath.split('/').filter(Boolean);
          if (!ref) {
            ref = treeParts[0];
          }
          if (treeParts.length > 1) {
            subfolder = treeParts.slice(1).join('/');
            pluginName = treeParts[treeParts.length - 1];
          } else {
            pluginName = rootRepoName;
          }
        } else {
          pluginName = rootRepoName;
        }
      } else {
        const urlParts = cleaned.split('/');
        pluginName = urlParts.pop() || '';
        namespace = urlParts.pop() || '';
        cloneUrl = raw.endsWith('.git') ? raw : `${raw}.git`;
      }
    } else {
      const parts = raw.split('/');
      if (parts.length !== 2) {
        throw new Error(`Invalid package repository identifier: "${identifier}". Expected format "owner/repo" or GitHub URL.`);
      }
      [namespace, pluginName] = parts;
      cloneUrl = `https://github.com/${namespace}/${pluginName}.git`;
    }

    this.validatePathComponent(namespace, 'namespace');
    this.validatePathComponent(pluginName, 'pluginName');

    if (ref) {
      if (ref.startsWith('-')) {
        throw new Error(`Invalid git reference "${ref}". References cannot start with '-'.`);
      }
      this.validatePathComponent(ref, 'ref');
    }

    return {
      namespace,
      pluginName,
      ref,
      cloneUrl,
      subfolder,
    };
  }
}
