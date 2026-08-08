#!/usr/bin/env node

import { Command } from 'commander';
import { installCommand } from './commands/install.js';
import { enableCommand } from './commands/enable.js';
import { disableCommand } from './commands/disable.js';
import { listCommand } from './commands/list.js';
import { infoCommand } from './commands/info.js';
import { uninstallCommand } from './commands/uninstall.js';
import { convertCommand } from './commands/convert.js';

const program = new Command();

program
  .name('agentpm')
  .description('Universal Agent Extension Manager')
  .version('0.1.0');

program
  .command('install')
  .description('Install a plugin package into the global store')
  .argument('<repo>', 'GitHub repository or package identifier (e.g. user/repo or user/repo#v1.0.0)')
  .option('-g, --global', 'Install globally')
  .option('-f, --force', 'Force re-download if package already exists')
  .action(installCommand);

program
  .command('enable')
  .description('Enable/materialize a plugin for an AI agent context')
  .argument('<plugin>', 'Plugin name or owner/plugin')
  .option('-g, --global', 'Enable globally across all detected agents')
  .option('-t, --target <agent>', 'Specific target agent adapter (e.g., antigravity, claude-code)')
  .option('-c, --copy', 'Copy plugin files into workspace instead of directory symlinking (isolated edit mode)')
  .action(enableCommand);

program
  .command('disable')
  .description('Disable/dematerialize a plugin for an AI agent context')
  .argument('<plugin>', 'Plugin name')
  .option('-g, --global', 'Disable globally across all detected agents')
  .option('-t, --target <agent>', 'Specific target agent adapter (e.g., antigravity, claude-code)')
  .action(disableCommand);

program
  .command('list')
  .description('List materialized workspace plugins or global store inventory')
  .option('-g, --global', 'List all installed plugins in central global store')
  .option('--json', 'Output results formatted as JSON')
  .action(listCommand);

program
  .command('info')
  .description('Inspect plugin capabilities, manifest headers, and materialization state')
  .argument('<plugin>', 'Plugin name or owner/plugin')
  .option('--json', 'Output details formatted as JSON')
  .action(infoCommand);

program
  .command('uninstall')
  .alias('remove')
  .description('Dematerialize active symlinks and purge plugin from global store')
  .argument('<plugin>', 'Plugin name or owner/plugin')
  .option('-g, --global', 'Also dematerialize from global agent directories')
  .action(uninstallCommand);

program
  .command('convert')
  .description('Convert vendor-specific plugin files to target agent-agnostic specs')
  .argument('<plugin>', 'Plugin directory path or installed plugin identifier')
  .option('-t, --target <agent>', 'Target agent adapter (e.g., antigravity, claude-code)', 'antigravity')
  .option('-m, --memory <filename>', 'Memory filename (AGENTS.md or CLAUDE.md)', 'AGENTS.md')
  .option('-v, --var-prefix <prefix>', 'Root variable placeholder prefix', 'PLUGIN_ROOT')
  .option('-o, --out <dir>', 'Output destination directory')
  .action(convertCommand);

program.parse(process.argv);
