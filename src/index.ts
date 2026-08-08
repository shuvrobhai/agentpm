#!/usr/bin/env node

import { Command } from 'commander';
import { installCommand } from './commands/install.js';
import { enableCommand } from './commands/enable.js';
import { disableCommand } from './commands/disable.js';

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
  .action(enableCommand);

program
  .command('disable')
  .description('Disable/dematerialize a plugin for an AI agent context')
  .argument('<plugin>', 'Plugin name')
  .option('-g, --global', 'Disable globally across all detected agents')
  .option('-t, --target <agent>', 'Specific target agent adapter (e.g., antigravity, claude-code)')
  .action(disableCommand);

program.parse(process.argv);
