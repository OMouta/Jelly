#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import figlet from 'figlet';
import { JellyManager } from '../lib/JellyManager';
import { InstallOptions, InitOptions } from '../types';
import { version } from '../../package.json';

const program = new Command();

// Custom help formatter
program.configureHelp({
  formatHelp: (cmd, helper) => {
    let helpStr = '';

    helpStr += chalk.cyan(figlet.textSync('🪼 Jelly', { horizontalLayout: 'fitted' })) + '\n\n';

    // Description
    const description = cmd.description();
    if (description) {
      helpStr += chalk.blue(description) + '\n\n';
    }
    
    // Usage
    const usage = cmd.usage();
    if (usage) {
      helpStr += chalk.bold('Usage:') + '\n  ' + chalk.cyan(`${cmd.name()} ${usage}`) + '\n\n';
    }

    // Options
    const options = cmd.options;
    if (options.length > 0) {
      helpStr += chalk.bold('Options:') + '\n';
      for (const option of options) {
        const flags = option.flags;
        const desc = option.description;
        helpStr += `  ${chalk.cyan('→')} ${chalk.cyan(flags.padEnd(35))} ${chalk.gray(desc)}\n`;
      }
      helpStr += '\n';
    }

    // Commands
    const commands = cmd.commands;
    if (commands.length > 0) {
      helpStr += chalk.bold('Commands:') + '\n';
      for (const command of commands) {
        const name = command.name();
        const aliases = command.aliases();
        const nameAndAliases = aliases.length > 0 ? `${name} | ${aliases.join(' | ')}` : name;
        const args = command.usage();
        const fullName = args ? `${nameAndAliases} ${args}` : nameAndAliases;
        const desc = command.description();
        helpStr += `  ${chalk.cyan('→')} ${chalk.cyan(fullName.padEnd(35))} ${chalk.gray(desc)}\n`;
      }
      helpStr += '\n';
    }

    helpStr += chalk.gray('🪼 Made with love for the Roblox community\n');
    return helpStr;
  }
});

program
  .name('jelly')
  .description('🪼 A modern package manager for Roblox, built on top of Wally')
  .version(version, '-v, --version', 'display version number')
  .option('--about', 'show about information')
  .action((options) => {
    if (options.about) {
      console.log(chalk.cyan(figlet.textSync('🪼 Jelly', { horizontalLayout: 'fitted' })));
      console.log(chalk.gray('  A modern package manager for Roblox developers'));
      console.log(chalk.gray(`  Version: ${version}`));
      console.log(chalk.gray('  Built with ❤️  for the Roblox community\n'));
    } else {
      program.help();
    }
  });

program
  .command('install [packages...]')
  .alias('i')
  .description('Install packages from Wally registry')
  .option('-D, --dev', 'Install as dev dependency')
  .option('--save', 'Save to project.json dependencies (default)')
  .action(async (packages: string[], options: InstallOptions) => {
    const jelly = new JellyManager();
    try {
      if (packages.length === 0) {
        // Install all dependencies from project.json
        console.log(chalk.cyan('🪼 ') + chalk.bold('Installing dependencies from project.json...'));
        await jelly.installAll();
      } else {
        // Install specific packages
        console.log(chalk.cyan('🪼 ') + chalk.bold(`Installing ${packages.join(', ')}...`));
        await jelly.install(packages, options);
      }
      console.log(chalk.green('✨ Installation complete!'));
    } catch (error) {
      console.error(chalk.red('💥 Installation failed:'), (error as Error).message);
      process.exit(1);
    }
  });

program
  .command('add <packages...>')
  .alias('a')
  .description('Add packages to project.json and install them')
  .option('-D, --dev', 'Add as dev dependency')
  .action(async (packages: string[], options: InstallOptions) => {
    const jelly = new JellyManager();
    try {
      console.log(chalk.cyan('🪼 ') + chalk.bold(`Adding ${packages.join(', ')} to project...`));
      await jelly.add(packages, options);
      console.log(chalk.green('✨ Packages added and installed!'));
    } catch (error) {
      console.error(chalk.red('💥 Failed to add packages:'), (error as Error).message);
      process.exit(1);
    }
  });

program
  .command('remove <packages...>')
  .alias('rm')
  .description('Remove packages from project.json and uninstall them')
  .action(async (packages: string[]) => {
    const jelly = new JellyManager();
    try {
      console.log(chalk.cyan('🪼 ') + chalk.bold(`Removing ${packages.join(', ')}...`));
      await jelly.remove(packages);
      console.log(chalk.green('✨ Packages removed!'));
    } catch (error) {
      console.error(chalk.red('💥 Failed to remove packages:'), (error as Error).message);
      process.exit(1);
    }
  });

program
  .command('init')
  .description('Initialize a new Rojo project with Jelly support')
  .option('-n, --name <name>', 'Project name')
  .option('-d, --description <desc>', 'Project description')
  .action(async (options: InitOptions) => {
    const jelly = new JellyManager();
    try {
      console.log(chalk.cyan('🪼 ') + chalk.bold('Initializing new Jelly project...'));
      await jelly.init(options);
      console.log(chalk.green('✨ Project initialized! Welcome to the Jelly ecosystem! 🪼'));
    } catch (error) {
      console.error(chalk.red('💥 Failed to initialize project:'), (error as Error).message);
      process.exit(1);
    }
  });

program
  .command('search <query>')
  .alias('s')
  .description('Search for packages in the Wally registry')
  .option('-l, --limit <number>', 'maximum number of results to show', '10')
  .action(async (query: string, options: { limit: string }) => {
    const jelly = new JellyManager();
    try {
      console.log(chalk.cyan('🪼 ') + chalk.bold(`Searching for "${query}"...`));
      await jelly.search(query, { limit: parseInt(options.limit) });
    } catch (error) {
      console.error(chalk.red('💥 Search failed:'), (error as Error).message);
      process.exit(1);
    }
  });

program
  .command('info <package>')
  .description('Show information about a package')
  .action(async (packageName: string) => {
    const jelly = new JellyManager();
    try {
      console.log(chalk.cyan('🪼 ') + chalk.bold(`Getting info for "${packageName}"...`));
      await jelly.info(packageName);
    } catch (error) {
      console.error(chalk.red('💥 Failed to get package info:'), (error as Error).message);
      process.exit(1);
    }
  });

program
  .command('list')
  .alias('ls')
  .description('List installed packages')
  .action(async () => {
    const jelly = new JellyManager();
    try {
      await jelly.list();
    } catch (error) {
      console.error(chalk.red('💥 Failed to list packages:'), (error as Error).message);
      process.exit(1);
    }
  });

program
  .command('outdated')
  .description('Check for outdated packages')
  .action(async () => {
    const jelly = new JellyManager();
    try {
      await jelly.outdated();
    } catch (error) {
      console.error(chalk.red('💥 Failed to check outdated packages:'), (error as Error).message);
      process.exit(1);
    }
  });

program
  .command('update [packages...]')
  .description('Update packages to their latest versions')
  .action(async (packages: string[]) => {
    const jelly = new JellyManager();
    try {
      if (packages.length === 0) {
        console.log(chalk.cyan('🪼 ') + chalk.bold('Updating all outdated packages...'));
      } else {
        console.log(chalk.cyan('🪼 ') + chalk.bold(`Updating ${packages.join(', ')}...`));
      }
      await jelly.update(packages.length > 0 ? packages : undefined);
      console.log(chalk.green('✨ Update complete!'));
    } catch (error) {
      console.error(chalk.red('💥 Update failed:'), (error as Error).message);
      process.exit(1);
    }
  });

program
  .command('clean')
  .description('Remove unused packages from the project')
  .action(async () => {
    const jelly = new JellyManager();
    try {
      console.log(chalk.cyan('🪼 ') + chalk.bold('Cleaning unused packages...'));
      await jelly.clean();
      console.log(chalk.green('✨ Clean complete!'));
    } catch (error) {
      console.error(chalk.red('💥 Clean failed:'), (error as Error).message);
      process.exit(1);
    }
  });

program
  .command('cache clean')
  .description('Clean the package cache')
  .action(async () => {
    const jelly = new JellyManager();
    try {
      console.log(chalk.cyan('🪼 ') + chalk.bold('Cleaning package cache...'));
      await jelly.cacheClean();
      console.log(chalk.green('✨ Cache cleaned!'));
    } catch (error) {
      console.error(chalk.red('💥 Cache clean failed:'), (error as Error).message);
      process.exit(1);
    }
  });

program
  .command('run <script>')
  .description('Run a script defined in jelly.json')
  .allowUnknownOption()
  .action(async (scriptName: string, command) => {
    const jelly = new JellyManager();
    try {
      // Get any additional args passed to the script
      const args = process.argv.slice(process.argv.indexOf(scriptName) + 1);
      await jelly.run(scriptName, args);
    } catch (error) {
      console.error(chalk.red('💥 Script failed:'), (error as Error).message);
      process.exit(1);
    }
  });

program
  .command('scripts')
  .description('List all available scripts')
  .action(async () => {
    const jelly = new JellyManager();
    try {
      await jelly.listScripts();
    } catch (error) {
      console.error(chalk.red('💥 Failed to list scripts:'), (error as Error).message);
      process.exit(1);
    }
  });

program.parse(process.argv);
