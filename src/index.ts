#!/usr/bin/env node

import { Command } from 'commander';
import { addCommand } from './commands/add.js';
import { installCommand } from './commands/install.js';
import { useCommand } from './commands/use.js';
import { uninstallCommand } from './commands/uninstall.js';
import { enableCommand } from './commands/enable.js';
import { disableCommand } from './commands/disable.js';
import { listCommand } from './commands/list.js';
import { infoCommand } from './commands/info.js';
import { findCommand } from './commands/find.js';
import { updateCommand } from './commands/update.js';
import { initCommand } from './commands/init.js';
import { convertCommand } from './commands/convert.js';
import { inspectCommand } from './commands/inspect.js';
import { docsCommand } from './commands/docs.js';
import { providersCommand } from './commands/providers.js';

const program = new Command();

program
  .name('plugins')
  .description('Manage cross-agent Agent Plugins: add, use, remove, list, find, update, init.')
  .version('0.2.0');

program
  .command('add')
  .description('Add a plugin package and enable it (alias: install, a)')
  .aliases(['a', 'install'])
  .argument('<package>', 'GitHub repository or package identifier (e.g. user/repo or user/repo#v1.0.0)')
  .option('-t, --target <agent>', 'Target agent adapter (e.g., antigravity, agent-plugins)', 'agent-plugins')
  .option('-g, --global', 'Enable globally across all detected agents')
  .option('-c, --copy', 'Copy plugin files instead of directory symlinking')
  .option('-f, --force', 'Force re-download if package already exists')
  .option('--no-enable', 'Install into the store without enabling')
  .action(addCommand);

program
  .command('use')
  .description('Generate a prompt for using a plugin without installing it')
  .argument('<package>', 'Package identifier (owner/repo or owner/repo@plugin), or local path')
  .option('-s, --skill <skill>', 'Generate a prompt for one specific skill')
  .action(useCommand);

program
  .command('remove')
  .description('Remove installed plugins (alias: rm, uninstall)')
  .aliases(['rm', 'uninstall'])
  .argument('[plugins...]', 'Plugin names to remove')
  .option('-g, --global', 'Also dematerialize from global agent directories')
  .action(async (plugins: string[], options: { global?: boolean }) => {
    if (plugins.length === 0) {
      console.log('No plugins specified. List installed plugins with: plugins list');
      return;
    }
    for (const plugin of plugins) {
      const opts: { global?: boolean } = {};
      if (options.global !== undefined) opts.global = options.global;
      await uninstallCommand(plugin, opts);
    }
  });

program
  .command('list')
  .alias('ls')
  .description('List installed plugins (workspace or global store)')
  .option('-g, --global', 'List all installed plugins in the central global store')
  .option('--json', 'Output results formatted as JSON')
  .action(listCommand);

program
  .command('find')
  .description('Search GitHub for plugin packages')
  .argument('[query]', 'Search keyword (e.g., pdf, skills, mcp)')
  .option('--owner <owner>', 'Search only repositories from a GitHub owner')
  .action(findCommand);

program
  .command('update')
  .alias('upgrade')
  .description('Update plugins to latest versions')
  .argument('[plugins...]', 'Plugin names to update (default: all installed)')
  .option('-t, --target <agent>', 'Target agent adapter for re-conversion', 'agent-plugins')
  .action(updateCommand);

program
  .command('init')
  .description('Initialize a new plugin skeleton (plugin.json + skills/<name>/SKILL.md)')
  .argument('[name]', 'Plugin name')
  .option('-o, --out <dir>', 'Output destination directory')
  .action(initCommand);

program
  .command('enable')
  .alias('e')
  .description('Enable/materialize a plugin for an AI agent context')
  .argument('<plugin>', 'Plugin name or owner/plugin')
  .option('-g, --global', 'Enable globally across all detected agents')
  .option('-t, --target <agent>', 'Specific target agent adapter (e.g., antigravity, claude-code)')
  .option('-c, --copy', 'Copy plugin files into workspace instead of directory symlinking (isolated edit mode)')
  .action(enableCommand);

program
  .command('disable')
  .alias('d')
  .description('Disable/dematerialize a plugin for an AI agent context')
  .argument('<plugin>', 'Plugin name')
  .option('-g, --global', 'Disable globally across all detected agents')
  .option('-t, --target <agent>', 'Specific target agent adapter (e.g., antigravity, claude-code)')
  .action(disableCommand);

program
  .command('info')
  .alias('i')
  .description('Inspect plugin capabilities, manifest headers, and materialization state')
  .argument('<plugin>', 'Plugin name or owner/plugin')
  .option('--json', 'Output details formatted as JSON')
  .action(infoCommand);

program
  .command('convert')
  .description('Convert a plugin to the portable Agent Plugins v1 core (default) or a native target')
  .argument('<plugin>', 'Plugin directory path or installed plugin identifier')
  .option('-t, --target <agent>', 'Native target adapter (e.g., opencode, antigravity; default emits portable v1 core)', 'agent-plugins')
  .option('-m, --memory <filename>', 'Memory filename (AGENTS.md or CLAUDE.md)', 'AGENTS.md')
  .option('-v, --var-prefix <prefix>', 'Root variable placeholder prefix', 'PLUGIN_ROOT')
  .option('-o, --out <dir>', 'Output destination directory')
  .action(convertCommand);

program
  .command('inspect')
  .description('Deep-parse a plugin into its IR and print a component summary')
  .argument('<source>', 'Plugin source (local path, git URL, GitHub shorthand, or marketplace ref)')
  .option('--json', 'Output the full parsed IR as JSON')
  .action(inspectCommand);

program
  .command('docs')
  .description('Inspect provider capability specs and official documentation')
  .argument('[provider]', 'Provider name (antigravity, opencode, claude, codex)')
  .option('-m, --matrix', 'Display side-by-side provider capability matrix')
  .option('-j, --json', 'Output raw JSON specification')
  .action(docsCommand);

program
  .command('providers')
  .alias('inspect-disk')
  .description('Inspect target provider directories on disk to list active plugins')
  .option('-p, --provider <name>', 'Filter by provider (antigravity, opencode, claude, codex)')
  .action(providersCommand);

program.addHelpText('after', `
Examples:
  $ plugins add octocat/Hello-World
  $ plugins add anthropics/knowledge-work-plugins/tree/main/pdf-viewer --no-enable
  $ plugins use vercel-labs/agent-skills@pdf-viewer
  $ plugins remove pdf-viewer
  $ plugins list --global
  $ plugins find pdf
  $ plugins update
  $ plugins init my-plugin
  $ plugins enable pdf-viewer --target antigravity
  $ plugins disable pdf-viewer
  $ plugins info pdf-viewer
  $ plugins convert ./my-claude-plugin --target agent-plugins
  $ plugins inspect ./my-claude-plugin
  $ plugins docs --matrix
  $ plugins providers
`);

program.parse(process.argv);
