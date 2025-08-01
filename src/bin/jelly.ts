#!/usr/bin/env node

import { Command } from 'commander';
import { JellyManager } from '../lib/managers/JellyManager';
import { AuthManager } from '../lib/managers/AuthManager';
import { PublishManager } from '../lib/managers/PublishManager';
import { RuntimeManager } from '../lib/managers/RuntimeManager';
import { InstallOptions, InitOptions, PublishOptions } from '../types';
import { version } from '../../package.json';
import { Output } from '../lib/utils/Output';

const program = new Command();

program.configureHelp({
  formatHelp: (cmd, helper) => {
    Output.jellyHeader();
    
    // Usage
    const usage = cmd.usage();
    if (usage) {
      Output.section('Usage');
      Output.usage(`${cmd.name()} ${usage}`);
    }

    // Options
    const options = cmd.options;
    if (options.length > 0) {
      Output.section('Options');
      for (const option of options) {
        Output.listItem(option.flags, option.description);
      }
    }

    // Commands
    const commands = cmd.commands;
    if (commands.length > 0) {
      Output.section('Commands');
      for (const command of commands) {
        const name = command.name();
        const aliases = command.aliases();
        const nameAndAliases = aliases.length > 0 ? `${name} | ${aliases.join(' | ')}` : name;
        const args = command.usage();
        const fullName = args ? `${nameAndAliases} ${args}` : nameAndAliases;
        Output.listItem(fullName, command.description());
      }
    }

    Output.newLine();
    console.log('🪼 Made with ❤️ for the Roblox community');
    return '';
  }
});

program
  .name('jelly')
  .description('A modern package manager for Roblox, built on top of Wally')
  .version(version, '-v, --version', 'display version number')
  .option('--about', 'show about information')
  .action((options) => {
    if (options.about) {
      Output.version(version);
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
        Output.action('Installing dependencies from project.json...');
        await jelly.installAll();
      } else {
        // Install specific packages
        Output.action(`Installing ${packages.join(', ')}...`);
        await jelly.install(packages, options);
      }
      Output.success('Installation complete!');
    } catch (error) {
      Output.error('Installation failed', (error as Error).message);
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
      Output.action(`Adding ${packages.join(', ')} to project...`);
      await jelly.add(packages, options);
      Output.success('Packages added and installed!');
    } catch (error) {
      Output.error('Failed to add packages', (error as Error).message);
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
      Output.action(`Removing ${packages.join(', ')}...`);
      await jelly.remove(packages);
      Output.success('Packages removed!');
    } catch (error) {
      Output.error('Failed to remove packages', (error as Error).message);
      process.exit(1);
    }
  });

program
  .command('init')
  .description('Initialize Jelly package management in current directory')
  .option('-n, --name <name>', 'Project name')
  .option('-d, --description <desc>', 'Project description')
  .action(async (options: InitOptions) => {
    const jelly = new JellyManager();
    try {
      Output.action('Initializing Jelly in current directory...');
      await jelly.init(options);
      Output.success('Jelly initialized! Welcome to the Jelly ecosystem! 🪼');
    } catch (error) {
      Output.error('Failed to initialize Jelly', (error as Error).message);
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
      Output.action(`Searching for "${query}"...`);
      await jelly.search(query, { limit: parseInt(options.limit) });
    } catch (error) {
      Output.error('Search failed', (error as Error).message);
      process.exit(1);
    }
  });

program
  .command('info <package>')
  .description('Show information about a package')
  .action(async (packageName: string) => {
    const jelly = new JellyManager();
    try {
      Output.action(`Getting info for "${packageName}"...`);
      await jelly.info(packageName);
    } catch (error) {
      Output.error('Failed to get package info', (error as Error).message);
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
      Output.error('Failed to list packages', (error as Error).message);
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
      Output.error('Failed to check outdated packages', (error as Error).message);
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
        Output.action('Updating all outdated packages...');
      } else {
        Output.action(`Updating ${packages.join(', ')}...`);
      }
      await jelly.update(packages.length > 0 ? packages : undefined);
      Output.success('Update complete!');
    } catch (error) {
      Output.error('Update failed', (error as Error).message);
      process.exit(1);
    }
  });

program
  .command('clean')
  .description('Remove unused packages from the project')
  .action(async () => {
    const jelly = new JellyManager();
    try {
      Output.action('Cleaning unused packages...');
      await jelly.clean();
      Output.success('Clean complete!');
    } catch (error) {
      Output.error('Clean failed', (error as Error).message);
      process.exit(1);
    }
  });

program
  .command('cache clean')
  .description('Clean the package cache')
  .action(async () => {
    const jelly = new JellyManager();
    try {
      Output.action('Cleaning package cache...');
      await jelly.cacheClean();
      Output.success('Cache cleaned!');
    } catch (error) {
      Output.error('Cache clean failed', (error as Error).message);
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
      Output.error('Script failed', (error as Error).message);
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
      Output.error('Failed to list scripts', (error as Error).message);
      process.exit(1);
    }
  });

program
  .command('lockfile')
  .description('Manage lockfile')
  .option('--verify', 'Verify lockfile integrity')
  .option('--regenerate', 'Regenerate lockfile from jelly.json')
  .action(async (options) => {
    const jelly = new JellyManager();
    try {
      if (options.verify) {
        Output.action('Verifying lockfile...');
        await jelly.verifyLockfile();
      } else if (options.regenerate) {
        Output.action('Regenerating lockfile...');
        await jelly.regenerateLockfile();
      } else {
        Output.warning('Please specify --verify or --regenerate');
        process.exit(1);
      }
    } catch (error) {
      Output.error('Lockfile operation failed', (error as Error).message);
      process.exit(1);
    }
  });



program
  .command('analyze')
  .alias('deps')
  .description('Analyze dependency tree and show version conflicts')
  .action(async () => {
    const jelly = new JellyManager();
    try {
      Output.action('Analyzing dependencies...');
      await jelly.analyzeDependencies();
    } catch (error) {
      Output.error('Failed to analyze dependencies', (error as Error).message);
      process.exit(1);
    }
  });

program
  .command('login')
  .description('Login to Wally registry using GitHub OAuth')
  .option('-t, --token <token>', 'Use a specific token instead of OAuth flow')
  .option('-r, --registry <url>', 'Registry GitHub repository (default: https://github.com/UpliftGames/wally-index)')
  .action(async (options) => {
    const authManager = new AuthManager();
    try {
      Output.action('Logging in to Wally...');
      await authManager.login(options.token, options.registry);
    } catch (error) {
      Output.error('Login failed', (error as Error).message);
      process.exit(1);
    }
  });

program
  .command('logout')
  .description('Logout from Wally registry')
  .option('-r, --registry <url>', 'Registry GitHub repository (default: https://github.com/UpliftGames/wally-index)')
  .action(async (options) => {
    const authManager = new AuthManager();
    try {
      await authManager.logout(options.registry);
    } catch (error) {
      Output.error('Logout failed', (error as Error).message);
      process.exit(1);
    }
  });

program
  .command('publish')
  .description('Publish package to Wally registry')
  .option('-t, --token <token>', 'Authentication token (overrides stored token)')
  .option('-r, --registry <url>', 'Registry GitHub repository (default: https://github.com/UpliftGames/wally-index)')
  .option('--dry-run', 'Perform a dry run without actually publishing')
  .action(async (options: PublishOptions) => {
    const publishManager = new PublishManager();
    try {
      Output.action('Publishing package...');
      await publishManager.publish(options);
    } catch (error) {
      Output.error('Publishing failed', (error as Error).message);
      process.exit(1);
    }
  });

program
  .command('package')
  .description('Create a package archive without publishing')
  .option('-o, --output <path>', 'Output path for the package archive')
  .option('--list', 'List files that would be included in the package')
  .action(async (options: { output?: string; list?: boolean }) => {
    const publishManager = new PublishManager();
    try {
      if (options.list) {
        Output.action('Listing package contents...');
      } else {
        Output.action('Creating package archive...');
      }
      await publishManager.package(options);
    } catch (error) {
      Output.error('Package creation failed', (error as Error).message);
      process.exit(1);
    }
  });

program
  .command('manifest-to-json')
  .description('Convert jelly.json to Wally manifest format (JSON)')
  .action(async () => {
    const publishManager = new PublishManager();
    try {
      await publishManager.manifestToJson();
    } catch (error) {
      Output.error('Manifest conversion failed', (error as Error).message);
      process.exit(1);
    }
  });

program
  .command('exec <package>')
  .alias('x')
  .description('Execute a binary package (checks local first, then downloads if needed)')
  .option('-y, --yes', 'skip confirmation prompt for remote packages')
  .allowUnknownOption()
  .action(async (packageName: string, options) => {
    const runtimeManager = new RuntimeManager();
    try {
      // Get any additional args passed to the package
      const args = process.argv.slice(process.argv.indexOf(packageName) + 1);
      await runtimeManager.executePackageAuto(packageName, args, options.yes);
    } catch (error) {
      Output.error('Failed to execute package', (error as Error).message);
      process.exit(1);
    }
  });

program
  .command('runtimes')
  .description('List available runtimes for binary packages')
  .action(async () => {
    const runtimeManager = new RuntimeManager();
    try {
      Output.action('Checking available runtimes...');
      const available = await runtimeManager.listAvailableRuntimes();
      
      if (available.length > 0) {
        Output.newLine();
        Output.success(`Found ${available.length} available runtime(s)`);
        Output.section('Available Runtimes');
        available.forEach(runtime => {
          Output.listItem(runtime);
        });
      } else {
        Output.warning('No common runtimes found');
        Output.info('Consider installing: lune, luau, node, python, or deno');
      }
    } catch (error) {
      Output.error('Failed to check runtimes', (error as Error).message);
      process.exit(1);
    }
  });

program.parse(process.argv);
