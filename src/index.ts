#!/usr/bin/env node

import { Command } from 'commander';
import { installCommand } from './commands/install.js';
import { enableCommand } from './commands/enable.js';

const program = new Command();

program
  .name('agentpm')
  .description('Universal Agent Extension Manager')
  .version('0.1.0');

program
  .command('install')
  .description('Install a plugin package into the global store')
  .argument('<repo>', 'GitHub repository or package identifier (e.g. user/repo)')
  .option('-g, --global', 'Install globally')
  .action(installCommand);

program
  .command('enable')
  .description('Enable/materialize a plugin for an AI agent context')
  .argument('<plugin>', 'Plugin name')
  .option('-g, --global', 'Enable globally across all detected agents')
  .option('-t, --target <agent>', 'Specific target agent adapter (e.g., antigravity, claude-code)')
  .action(enableCommand);

program.parse(process.argv);
