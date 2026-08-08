import fs from 'node:fs/promises';
import path from 'node:path';
import { GlobalStore } from '../core/store.js';

export interface PluginInfoReport {
  pluginIdentifier: string;
  storePath: string;
  manifest?: any;
  skills: string[];
  activeInWorkspace: {
    antigravity: boolean;
    claudeCode: boolean;
  };
}

export async function infoCommand(plugin: string, options: { json?: boolean }): Promise<void> {
  try {
    const storePath = await GlobalStore.findPluginPath(plugin);

    // Check for manifest plugin.json
    let manifest: any = undefined;
    const manifestPath = path.join(storePath, 'plugin.json');
    const hasManifest = await fs.access(manifestPath).then(() => true).catch(() => false);
    if (hasManifest) {
      const content = await fs.readFile(manifestPath, 'utf-8');
      manifest = JSON.parse(content);
    }

    // Discover skills contained in package
    const skills: string[] = [];
    const skillsDir = path.join(storePath, 'skills');
    const hasSkillsDir = await fs.access(skillsDir).then(() => true).catch(() => false);
    if (hasSkillsDir) {
      const entries = await fs.readdir(skillsDir).catch(() => []);
      for (const entry of entries) {
        if (!entry.startsWith('.')) skills.push(entry);
      }
    } else {
      const rootSkill = path.join(storePath, 'SKILL.md');
      const hasRootSkill = await fs.access(rootSkill).then(() => true).catch(() => false);
      if (hasRootSkill) {
        skills.push('SKILL.md');
      }
    }

    // Check workspace materialization status
    const pluginDirName = path.basename(storePath) === 'latest'
      ? path.basename(path.dirname(storePath))
      : path.basename(storePath);

    const antigravityPath = path.join(process.cwd(), '.agents', 'skills', pluginDirName);
    const claudePath = path.join(process.cwd(), '.claudecode', 'skills', pluginDirName);

    const isAntigravityActive = await fs.lstat(antigravityPath).then(() => true).catch(() => false);
    const isClaudeActive = await fs.lstat(claudePath).then(() => true).catch(() => false);

    const report: PluginInfoReport = {
      pluginIdentifier: plugin,
      storePath,
      manifest,
      skills,
      activeInWorkspace: {
        antigravity: isAntigravityActive,
        claudeCode: isClaudeActive,
      },
    };

    if (options.json) {
      console.log(JSON.stringify(report, null, 2));
      return;
    }

    console.log(`\n🔍 Plugin Information: ${plugin}\n`);
    console.log(`  • Store Location: ${storePath}`);
    if (manifest?.description) {
      console.log(`  • Description:    ${manifest.description}`);
    }
    if (manifest?.version) {
      console.log(`  • Version:        ${manifest.version}`);
    }

    console.log(`  • Contained Skills: ${skills.length > 0 ? skills.join(', ') : 'None detected'}`);
    console.log('  • Workspace Materialization Status:');
    console.log(`     - Antigravity: ${isAntigravityActive ? 'Active (symlinked)' : 'Inactive'}`);
    console.log(`     - Claude Code: ${isClaudeActive ? 'Active (symlinked)' : 'Inactive'}`);
    console.log('');
  } catch (err: any) {
    console.error(`Error fetching info for plugin: ${err.message}`);
    process.exitCode = 1;
  }
}
