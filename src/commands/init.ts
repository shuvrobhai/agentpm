import fs from 'node:fs/promises';
import path from 'node:path';
import { sanitizePluginName, PLUGIN_SCHEMA_URL } from '../core/v1-manifest.js';

export interface InitOptions {
  out?: string;
}

export async function initCommand(name: string | undefined, options: InitOptions = {}): Promise<void> {
  try {
    const dirName = name ? sanitizePluginName(name, 'my-plugin') : 'my-plugin';
    const targetDir = options.out ? path.resolve(options.out) : path.resolve(process.cwd(), dirName);
    const skillName = name ? sanitizePluginName(name, 'my-plugin') : 'my-plugin';

    const pluginJson = {
      $schema: PLUGIN_SCHEMA_URL,
      name: skillName,
      version: '0.1.0',
      description: 'New Agent Plugin scaffolded with the plugins CLI.',
      author: { name: '', url: '' },
      homepage: '',
      repository: '',
      license: 'MIT',
      keywords: ['agent-plugins'],
    };

    const skillDir = path.join(targetDir, 'skills', skillName);
    await fs.mkdir(skillDir, { recursive: true });

    await fs.writeFile(path.join(targetDir, 'plugin.json'), JSON.stringify(pluginJson, null, 2) + '\n', 'utf8');

    const skillMd = `---
name: ${skillName}
description: What this skill does.
---

# ${skillName}

Describe the skill's purpose, trigger conditions, and workflow here.
`;
    await fs.writeFile(path.join(skillDir, 'SKILL.md'), skillMd, 'utf8');

    console.log(`\n✨ Created plugin skeleton:\n`);
    console.log(`  ${path.join(targetDir, 'plugin.json')}`);
    console.log(`  ${path.join(skillDir, 'SKILL.md')}`);
    console.log(`\nNext steps:`);
    console.log(`  - Fill in plugin.json (description, author, homepage, repository).`);
    console.log(`  - Write your skill at skills/${skillName}/SKILL.md.`);
    console.log(`  - Validate: npx ajv-cli validate --spec=draft2020 -s <plugin.schema.json> -d ${path.join(targetDir, 'plugin.json')}`);
    console.log(`  - Convert/install with: plugins add ${targetDir}`);
  } catch (err: any) {
    console.error(`Error initializing plugin: ${err.message}`);
    process.exitCode = 1;
  }
}
