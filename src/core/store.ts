import path from 'node:path';
import fs from 'node:fs/promises';
import {
  agentpmStorePluginsDir,
  agentpmStoreAdaptedDir,
  agentpmReposDir,
  agentpmCleanPluginsDir,
  agentpmRegistryPath,
} from './config.js';

export interface ParsedRepo {
  namespace: string;
  pluginName: string;
  ref?: string | undefined;
  cloneUrl: string;
  subfolder?: string | undefined;
}

export interface StoredPlugin {
  namespace: string;
  pluginName: string;
  version: string;
  fullPath: string;
  vendor?: string;
}

export interface SourceRegistryEntry {
  source: string;
  ref?: string;
  subfolder?: string;
  resolved_commit: string;
  content_hash: string;
  source_vendor: string;
  installed_at: string;
  clone_path?: string;
  extracted_path?: string;
  deployed_files: string[];
}

export interface SourceRegistry {
  version: string;
  packages: Record<string, SourceRegistryEntry>;
}


const SAFE_PATH_COMPONENT = /^[a-zA-Z0-9_.-]+$/;

export class GlobalStore {
  static getStorePath(): string {
    return agentpmStorePluginsDir();
  }

  static getReposPath(): string {
    return agentpmReposDir();
  }

  static getAdaptedStorePath(): string {
    return agentpmStoreAdaptedDir();
  }

  static getRepoClonePath(namespace: string, pluginName: string): string {
    this.validatePathComponent(namespace, 'namespace');
    this.validatePathComponent(pluginName, 'pluginName');
    return path.join(this.getReposPath(), namespace, pluginName);
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

  static getPluginPath(namespace: string, pluginName: string, version: string, vendor?: string): string {
    this.validatePathComponent(namespace, 'namespace');
    this.validatePathComponent(pluginName, 'pluginName');
    this.validatePathComponent(version, 'version');
    if (vendor) {
      this.validatePathComponent(vendor, 'vendor');
      return path.join(this.getStorePath(), vendor, namespace, pluginName, version);
    }
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
        if (validVersions.length > 0 && validVersions[0]) {
          return path.join(pluginDir, validVersions[0]);
        }
      }
      return null;
    };

    let targetNamespace: string | undefined;
    let targetPluginName = pluginIdentifier;
    let targetVersion = version;

    if (pluginIdentifier.includes('/') || pluginIdentifier.includes('#')) {
      try {
        const parsed = this.parseRepoIdentifier(pluginIdentifier);
        targetNamespace = parsed.namespace;
        targetPluginName = parsed.pluginName;
        if (parsed.ref && version === 'latest') {
          targetVersion = parsed.ref;
        }
      } catch {
        if (pluginIdentifier.includes('/')) {
          const parts = pluginIdentifier.split('/');
          targetNamespace = parts[0];
          targetPluginName = parts[1] || pluginIdentifier;
        }
      }
    }

    const storePath = this.getStorePath();

    if (targetNamespace) {
      // 1. Check direct namespace/pluginName
      const directDir = path.join(storePath, targetNamespace, targetPluginName);
      const directResolved = await resolveVersionFromPluginDir(directDir, targetVersion);
      if (directResolved) return directResolved;

      // 2. Check vendor/namespace/pluginName
      const topEntries = await fs.readdir(storePath).catch(() => []);
      for (const vendor of topEntries) {
        if (vendor.startsWith('.')) continue;
        const vendorPluginDir = path.join(storePath, vendor, targetNamespace, targetPluginName);
        const resolved = await resolveVersionFromPluginDir(vendorPluginDir, targetVersion);
        if (resolved) return resolved;
      }

      throw new Error(`Plugin "${pluginIdentifier}@${targetVersion}" not found in global store at ${directDir}`);
    }

    // Search all namespaces and vendor tiers
    const topDirs = await fs.readdir(storePath).catch(() => []);
    for (const top of topDirs) {
      if (top.startsWith('.')) continue;
      const topPath = path.join(storePath, top);
      const statTop = await fs.stat(topPath).catch(() => null);
      if (!statTop || !statTop.isDirectory()) continue;

      // Check top/targetPluginName
      const candidateDir = path.join(topPath, targetPluginName);
      const directResolved = await resolveVersionFromPluginDir(candidateDir, targetVersion);
      if (directResolved) return directResolved;

      // Check top/subNamespace/targetPluginName (vendor-tiered)
      const subDirs = await fs.readdir(topPath).catch(() => []);
      for (const sub of subDirs) {
        if (sub.startsWith('.')) continue;
        const subPluginDir = path.join(topPath, sub, targetPluginName);
        const subResolved = await resolveVersionFromPluginDir(subPluginDir, targetVersion);
        if (subResolved) return subResolved;
      }
    }

    throw new Error(`Plugin "${pluginIdentifier}@${targetVersion}" not found in any namespace in global store (${storePath})`);
  }

  static async listGlobalPlugins(): Promise<StoredPlugin[]> {
    const storePath = this.getStorePath();
    const plugins: StoredPlugin[] = [];

    const topEntries = await fs.readdir(storePath).catch(() => []);

    for (const top of topEntries) {
      if (top.startsWith('.')) continue;
      const topPath = path.join(storePath, top);
      const statTop = await fs.stat(topPath).catch(() => null);
      if (!statTop || !statTop.isDirectory()) continue;

      const subEntries = await fs.readdir(topPath).catch(() => []);
      for (const sub of subEntries) {
        if (sub.startsWith('.')) continue;
        const subPath = path.join(topPath, sub);
        const statSub = await fs.stat(subPath).catch(() => null);
        if (!statSub || !statSub.isDirectory()) continue;

        const leafEntries = await fs.readdir(subPath).catch(() => []);
        for (const leaf of leafEntries) {
          if (leaf.startsWith('.')) continue;
          const leafPath = path.join(subPath, leaf);
          const statLeaf = await fs.stat(leafPath).catch(() => null);
          if (!statLeaf || !statLeaf.isDirectory()) continue;

          // Check if leaf is a version dir (e.g. namespace/plugin/version)
          const isVersion = leaf === 'latest' || leaf === 'main' || leaf === 'master' || /^v?\d+/.test(leaf);
          if (isVersion) {
            plugins.push({
              namespace: top,
              pluginName: sub,
              version: leaf,
              fullPath: leafPath,
            });
          } else {
            // Vendor-tiered: top=vendor, sub=namespace, leaf=pluginName
            const versionEntries = await fs.readdir(leafPath).catch(() => []);
            for (const ver of versionEntries) {
              if (ver.startsWith('.')) continue;
              const verPath = path.join(leafPath, ver);
              const statVer = await fs.stat(verPath).catch(() => null);
              if (statVer?.isDirectory()) {
                plugins.push({
                  vendor: top,
                  namespace: sub,
                  pluginName: leaf,
                  version: ver,
                  fullPath: verPath,
                });
              }
            }
          }
        }
      }
    }

    return plugins;
  }

  static async readRegistry(): Promise<SourceRegistry> {
    const regPath = agentpmRegistryPath();
    try {
      const raw = await fs.readFile(regPath, 'utf8');
      return JSON.parse(raw) as SourceRegistry;
    } catch {
      return { version: '1.0.0', packages: {} };
    }
  }

  static async updateRegistry(packageName: string, entry: SourceRegistryEntry): Promise<void> {
    const registry = await this.readRegistry();
    registry.packages[packageName] = entry;
    const regPath = agentpmRegistryPath();
    await fs.mkdir(path.dirname(regPath), { recursive: true });
    await fs.writeFile(regPath, JSON.stringify(registry, null, 2) + '\n', 'utf8');
  }

  static async removePlugin(pluginIdentifier: string): Promise<string[]> {
    const removedPaths: string[] = [];

    const [namespace, pluginName] = this.splitIdentifier(pluginIdentifier);

    // Purge every store tier: portable packages (plugins/), pristine clones
    // (repos/), and adapted materializations (adapted/<adapter>/...).
    await this.removeTierMatches(this.getStorePath(), namespace, pluginName, removedPaths);
    await this.removeTierMatches(this.getReposPath(), namespace, pluginName, removedPaths);
    await this.removeTierMatches(this.getAdaptedStorePath(), namespace, pluginName, removedPaths);

    // Drop now-empty namespace dirs (e.g. plugins/mattpocock) even when the
    // plugin subdir was already gone before this remove call.
    if (namespace) {
      const tierRoots = [this.getStorePath(), this.getReposPath(), this.getAdaptedStorePath()];
      for (const root of tierRoots) {
        const candidates = [path.join(root, namespace)];
        const topEntries = await fs.readdir(root).catch(() => []);
        for (const top of topEntries) {
          if (top.startsWith('.')) continue;
          candidates.push(path.join(root, top, namespace));
        }
        for (const candidate of candidates) {
          if (await this.isDirEmpty(candidate)) {
            await fs.rmdir(candidate).catch(() => {});
            removedPaths.push(candidate);
          }
        }
      }
    }

    const registryChanged = await this.removeRegistryEntry(namespace, pluginName);

    if (removedPaths.length === 0 && !registryChanged) {
      throw new Error(`Plugin "${pluginIdentifier}" not found in global store.`);
    }

    // Clean up now-empty ancestor dirs (e.g. plugins/mattpocock).
    await this.pruneEmptyParents(
      removedPaths,
      [this.getStorePath(), this.getReposPath(), this.getAdaptedStorePath()],
    );

    return removedPaths;
  }

  private static splitIdentifier(pluginIdentifier: string): [string | undefined, string] {
    const parts = pluginIdentifier.split('/');
    if (parts.length >= 2 && parts[0] && parts[1]) {
      return [parts[0] as string, parts[1] as string];
    }
    return [undefined, pluginIdentifier];
  }

  /**
   * Removes matching plugin dirs under a store tier root. With a namespace this
   * covers both the direct layout (plugins/<ns>/<plugin>) and vendor-tiered
   * layouts (plugins/<vendor>/<ns>/<plugin>). Without one it scans every
   * namespace like the legacy bare-name search.
   */
  private static async removeTierMatches(
    root: string,
    namespace: string | undefined,
    pluginName: string,
    removed: string[],
  ): Promise<void> {
    const rmPath = async (p: string): Promise<void> => {
      const exists = await fs.access(p).then(() => true).catch(() => false);
      if (!exists) return;
      await fs.rm(p, { recursive: true, force: true });
      removed.push(p);
    };

    if (namespace) {
      await rmPath(path.join(root, namespace, pluginName));
      const topEntries = await fs.readdir(root).catch(() => []);
      for (const top of topEntries) {
        if (top.startsWith('.')) continue;
        await rmPath(path.join(root, top, namespace, pluginName));
      }
      return;
    }

    const topEntries = await fs.readdir(root).catch(() => []);
    for (const top of topEntries) {
      if (top.startsWith('.')) continue;
      const topPath = path.join(root, top);
      const statTop = await fs.stat(topPath).catch(() => null);
      if (!statTop || !statTop.isDirectory()) continue;

      await rmPath(path.join(topPath, pluginName));

      const subEntries = await fs.readdir(topPath).catch(() => []);
      for (const sub of subEntries) {
        if (sub.startsWith('.')) continue;
        await rmPath(path.join(topPath, sub, pluginName));
      }
    }
  }

  private static async removeRegistryEntry(
    namespace: string | undefined,
    pluginName: string,
  ): Promise<boolean> {
    const registry = await this.readRegistry();
    let changed = false;

    for (const key of Object.keys(registry.packages)) {
      const matches = namespace
        ? key === `${namespace}/${pluginName}`
        : key === pluginName || key.endsWith(`/${pluginName}`);
      if (matches) {
        delete registry.packages[key];
        changed = true;
      }
    }

    if (!changed) return false;

    const regPath = agentpmRegistryPath();
    await fs.mkdir(path.dirname(regPath), { recursive: true });
    await fs.writeFile(regPath, JSON.stringify(registry, null, 2) + '\n', 'utf8');
    return true;
  }

  private static async isDirEmpty(p: string): Promise<boolean> {
    const entries = await fs.readdir(p).catch(() => null);
    return entries !== null && entries.length === 0;
  }

  /** Removes empty ancestor dirs of the removed paths up to (not including) roots. */
  private static async pruneEmptyParents(paths: string[], roots: string[]): Promise<void> {
    const rootResolved = new Set(roots.map(r => path.resolve(r)));
    for (const removed of paths) {
      let current = path.dirname(removed);
      while (current && path.dirname(current) !== current) {
        if (path.basename(current).startsWith('.')) break;
        if (rootResolved.has(path.resolve(current))) break;
        const entries = await fs.readdir(current).catch(() => null);
        if (entries === null || entries.length > 0) break;
        await fs.rmdir(current).catch(() => {});
        current = path.dirname(current);
      }
    }
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
      raw = parts[0] || raw;
      ref = parts[1];
    }

    raw = raw.replace(/\/+$/, '');

    let namespace = '';
    let pluginName = '';
    let cloneUrl = '';
    let subfolder: string | undefined;

    if (raw.startsWith('http://') || raw.startsWith('https://') || raw.startsWith('git@') || raw.startsWith('file://')) {
      const cleaned = raw.replace(/\.git$/, '');
      if (cleaned.includes('/tree/')) {
        const [repoBase, treePath] = cleaned.split('/tree/');
        const urlParts = (repoBase || '').split('/');
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
            pluginName = treeParts[treeParts.length - 1] || rootRepoName;
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
        if (raw.startsWith('file://')) {
          cloneUrl = raw;
        } else {
          cloneUrl = raw.endsWith('.git') ? raw : `${raw}.git`;
        }
      }
    } else {
      const parts = raw.split('/');
      if (parts.length !== 2) {
        throw new Error(`Invalid package repository identifier: "${identifier}". Expected format "owner/repo" or GitHub URL.`);
      }
      namespace = parts[0] || '';
      pluginName = parts[1] || '';
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
