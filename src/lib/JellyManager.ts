import chalk from 'chalk';
import ora from 'ora';
import { ProjectManager } from './ProjectManager';
import { WallyAPI } from './WallyAPI';
import { PackageDownloader } from './PackageDownloader';
import { LockfileManager } from './LockfileManager';
import { WorkspaceManager } from './WorkspaceManager';
import { VersionResolver, DependencyConflict } from './VersionResolver';
import { InstallOptions, InitOptions, LockfileEntry } from '../types';

export class JellyManager {
  private projectManager: ProjectManager;
  private packageDownloader: PackageDownloader;
  private lockfileManager: LockfileManager;
  private workspaceManager: WorkspaceManager;
  private versionResolver: VersionResolver;

  constructor(projectPath?: string) {
    this.projectManager = new ProjectManager(projectPath);
    this.packageDownloader = new PackageDownloader(projectPath);
    this.lockfileManager = new LockfileManager(projectPath);
    this.workspaceManager = new WorkspaceManager(projectPath);
    this.versionResolver = new VersionResolver();
  }

  async install(packages: string[], options: InstallOptions = {}): Promise<void> {
    const spinner = ora('Installing packages...').start();

    try {
      // Update jelly.json with new packages
      for (const packageName of packages) {
        const parsed = WallyAPI.parsePackageName(packageName);
        let version = parsed.version;

        if (!version) {
          spinner.text = `Resolving latest version for ${parsed.scope}/${parsed.name}...`;
          // Use version resolver to get the latest version
          const resolved = await this.versionResolver.resolveVersion(parsed.scope, parsed.name, '*');
          version = resolved.version;
        }

        spinner.text = `Adding ${parsed.scope}/${parsed.name}@${version} to project...`;
        await this.projectManager.addDependency(
          `${parsed.scope}/${parsed.name}`,
          version,
          options.dev || false
        );
      }

      // Read updated config and update/generate lockfile
      const config = await this.projectManager.readJellyConfig();
      spinner.text = 'Updating lockfile...';
      const { lockfile, conflicts } = await this.lockfileManager.updateLockfile(config);
      
      // Display version conflicts if any
      if (conflicts.length > 0) {
        spinner.stop();
        this.displayVersionConflicts(conflicts);
        spinner.start();
      }
      
      await this.lockfileManager.writeLockfile(lockfile);

      // Download packages from lockfile
      spinner.text = 'Downloading packages...';
      for (const [packageName, lockfileEntry] of Object.entries(lockfile.packages)) {
        const parsed = WallyAPI.parsePackageName(packageName);
        const entry = lockfileEntry as LockfileEntry;
        spinner.text = `Downloading ${packageName}@${entry.version}...`;
        await this.packageDownloader.downloadFromLockfile(entry, parsed.scope, parsed.name);
      }

      // Generate package index and update project file
      spinner.text = 'Updating package index...';
      await this.packageDownloader.generatePackageIndex();
      await this.packageDownloader.updateProjectFile(this.projectManager);

      spinner.succeed('Packages installed successfully!');
      console.log(chalk.blue(`📁 Packages installed to: ${this.packageDownloader.getPackagesPath()}`));
      console.log(chalk.green(`📋 Lockfile updated: ${this.lockfileManager.getLockfilePath()}`));
      
      // Show outdated packages summary
      await this.showOutdatedSummary();
    } catch (error) {
      spinner.fail('Installation failed');
      throw error;
    }
  }

  async installAll(): Promise<void> {
    const spinner = ora('Installing all dependencies...').start();

    try {
      if (!(await this.projectManager.jellyConfigExists())) {
        spinner.fail('No jelly.json found. Run "jelly init" first.');
        return;
      }

      const config = await this.projectManager.readJellyConfig();
      const allDeps = {
        ...config.dependencies,
        ...config.devDependencies
      };

      if (Object.keys(allDeps).length === 0) {
        spinner.info('No dependencies to install');
        return;
      }

      // Check if lockfile exists and is valid
      const lockfileExists = await this.lockfileManager.lockfileExists();
      const lockfileValid = lockfileExists ? await this.lockfileManager.validateLockfile(config) : false;

      if (!lockfileExists || !lockfileValid) {
        spinner.text = 'Generating lockfile...';
        const { lockfile, conflicts } = await this.lockfileManager.generateLockfile(config);
        
        // Display version conflicts if any
        if (conflicts.length > 0) {
          spinner.stop();
          this.displayVersionConflicts(conflicts);
          spinner.start();
        }
        
        await this.lockfileManager.writeLockfile(lockfile);
        spinner.stop();
        console.log(chalk.green('📋 Generated jelly-lock.json'));
        spinner.start();
      }

      // Read lockfile and install packages
      const lockfile = await this.lockfileManager.readLockfile();
      if (!lockfile) {
        throw new Error('Failed to read lockfile');
      }

      spinner.text = `Installing ${Object.keys(lockfile.packages).length} packages...`;

      // Download and install each package from lockfile
      for (const [packageName, lockfileEntry] of Object.entries(lockfile.packages)) {
        const parsed = WallyAPI.parsePackageName(packageName);
        const entry = lockfileEntry as LockfileEntry;
        spinner.text = `Downloading ${packageName}@${entry.version}...`;
        
        try {
          await this.packageDownloader.downloadFromLockfile(entry, parsed.scope, parsed.name);
        } catch (error) {
          // If package download fails, log but continue with other packages
          spinner.text = `⚠ Could not download ${packageName}@${entry.version} (${(error as Error).message})`;
          await new Promise(resolve => setTimeout(resolve, 1500)); // Brief pause to show message
        }
      }

      // Generate package index and update project file
      spinner.text = 'Generating package index...';
      await this.packageDownloader.generatePackageIndex();
      await this.packageDownloader.updateProjectFile(this.projectManager);

      spinner.succeed(`Successfully installed ${Object.keys(lockfile.packages).length} packages!`);
      console.log(chalk.blue(`📁 Packages installed to: ${this.packageDownloader.getPackagesPath()}`));
      console.log(chalk.green(`📋 Using lockfile: ${this.lockfileManager.getLockfilePath()}`));
      
      // Show outdated packages summary
      await this.showOutdatedSummary();
    } catch (error) {
      spinner.fail('Installation failed');
      throw error;
    }
  }

  async add(packages: string[], options: InstallOptions = {}): Promise<void> {
    await this.install(packages, { ...options, save: true });
  }

  async remove(packages: string[]): Promise<void> {
    const spinner = ora('Removing packages...').start();

    try {
      for (const packageName of packages) {
        const parsed = WallyAPI.parsePackageName(packageName);
        const fullName = `${parsed.scope}/${parsed.name}`;
        
        spinner.text = `Removing ${fullName}...`;
        await this.projectManager.removeDependency(fullName);
      }

      // Update lockfile after removing packages
      const config = await this.projectManager.readJellyConfig();
      spinner.text = 'Updating lockfile...';
      const { lockfile, conflicts } = await this.lockfileManager.updateLockfile(config);
      
      // Display version conflicts if any
      if (conflicts.length > 0) {
        spinner.stop();
        this.displayVersionConflicts(conflicts);
        spinner.start();
      }
      
      await this.lockfileManager.writeLockfile(lockfile);

      // Clean up package files using the existing clean method
      spinner.stop();
      await this.clean();

      console.log(chalk.green(`📋 Lockfile updated: ${this.lockfileManager.getLockfilePath()}`));
    } catch (error) {
      spinner.fail('Removal failed');
      throw error;
    }
  }

  private displayVersionConflicts(conflicts: DependencyConflict[]): void {
    if (conflicts.length === 0) return;

    console.log(chalk.yellow('\n⚠️  Version conflicts detected:'));
    for (const conflict of conflicts) {
      console.log(chalk.yellow(`  ${conflict.packageName}:`));
      for (const c of conflict.conflicts) {
        console.log(chalk.gray(`    ${c.requiredBy} requires ${c.versionRange}`));
      }
      if (conflict.resolvedVersion) {
        console.log(chalk.green(`    → Resolved to ${conflict.resolvedVersion}`));
      }
    }
    console.log();
  }

  async init(options: InitOptions = {}): Promise<void> {
    const spinner = ora('Initializing Jelly project...').start();

    try {
      if (await this.projectManager.jellyConfigExists()) {
        spinner.warn('Jelly project already exists! (jelly.json found)');
        return;
      }

      await this.projectManager.createJellyConfig(options);
      spinner.succeed('Jelly project initialized successfully!');
      
      console.log(chalk.cyan('\n🪼 Created file:'));
      console.log(chalk.blue('  → jelly.json') + chalk.gray(' (Jelly dependencies and scripts)'));
      console.log(chalk.gray('\nNext steps:'));
      console.log(chalk.gray('  → Add packages: ') + chalk.cyan('jelly add <package>'));
      console.log(chalk.gray('  → Install dependencies: ') + chalk.cyan('jelly install'));
      console.log(chalk.gray('  → Run scripts: ') + chalk.cyan('jelly run <script>'));
      console.log(chalk.gray('  → List scripts: ') + chalk.cyan('jelly scripts'));
      
      // Check if Rojo project exists and give relevant advice
      if (await this.projectManager.projectExists()) {
        console.log(chalk.gray('  → Build with Rojo: ') + chalk.cyan('jelly run build'));
      } else {
        console.log(chalk.gray('  → Initialize Rojo: ') + chalk.cyan('rojo init'));
        console.log(chalk.gray('  → Then build: ') + chalk.cyan('jelly run build'));
      }
    } catch (error) {
      spinner.fail('Initialization failed');
      throw error;
    }
  }

  async search(query: string, options: { limit?: number } = {}): Promise<void> {
    const spinner = ora('Searching packages...').start();

    try {
      const results = await WallyAPI.searchPackages(query);
      spinner.stop();

      if (results.length === 0) {
        console.log(chalk.yellow('No packages found matching your query.'));
        return;
      }

      const limit = options.limit || 10;
      const limitedResults = results.slice(0, limit);
      
      console.log(chalk.cyan(`\n🪼 Found ${results.length} package(s)${results.length > limit ? `, showing top ${limit}` : ''}:\n`));

      for (const result of limitedResults) {
        console.log(chalk.bold.cyan(`→ ${result.scope}/${result.name}`));
        if (result.description) {
          console.log(chalk.gray(`   ${result.description}`));
        }
        console.log(chalk.blue(`   Latest: ${result.versions[result.versions.length - 1]}`));
        if (result.keywords && result.keywords.length > 0) {
          console.log(chalk.gray(`   Keywords: ${result.keywords.join(', ')}`));
        }
        console.log();
      }
      
      if (results.length > limit) {
        console.log(chalk.gray(`... and ${results.length - limit} more results. Use --limit ${results.length} to see all.`));
      }
    } catch (error) {
      spinner.fail('Search failed');
      throw error;
    }
  }

  async info(packageName: string): Promise<void> {
    const spinner = ora('Getting package info...').start();

    try {
      const parsed = WallyAPI.parsePackageName(packageName);
      const info = await WallyAPI.getPackageInfo(parsed.scope, parsed.name);
      spinner.stop();

      const latestVersion = info.versions[0]; // Versions should be sorted with latest first
      const packageInfo = latestVersion.package;

      console.log(chalk.cyan(`\n→ ${parsed.scope}/${parsed.name}\n`));

      if (packageInfo.description) {
        console.log(chalk.bold('Description:'));
        console.log(`  ${packageInfo.description}\n`);
      }

      if (packageInfo.license) {
        console.log(chalk.bold('License:'));
        console.log(`  ${packageInfo.license}\n`);
      }

      if (packageInfo.repository) {
        console.log(chalk.bold('Repository:'));
        console.log(`  ${packageInfo.repository}\n`);
      }

      if (packageInfo.homepage) {
        console.log(chalk.bold('Homepage:'));
        console.log(`  ${packageInfo.homepage}\n`);
      }

      if (packageInfo.authors && packageInfo.authors.length > 0) {
        console.log(chalk.bold('Authors:'));
        console.log(`  ${packageInfo.authors.join(', ')}\n`);
      }

      if (packageInfo.realm) {
        console.log(chalk.bold('Realm:'));
        console.log(`  ${packageInfo.realm}\n`);
      }

      if (info.versions && info.versions.length > 0) {
        console.log(chalk.bold('Versions:'));
        const latestVersions = info.versions.slice(0, 5); // Show first 5 versions (latest)
        for (const versionInfo of latestVersions) {
          console.log(`  ${versionInfo.package.version}`);
        }
        if (info.versions.length > 5) {
          console.log(chalk.gray(`  ... and ${info.versions.length - 5} more`));
        }
        console.log();
      }

      // Show dependencies if they exist
      if (latestVersion.dependencies && Object.keys(latestVersion.dependencies).length > 0) {
        console.log(chalk.bold('Dependencies:'));
        for (const [depName, depValue] of Object.entries(latestVersion.dependencies)) {
          console.log(`  ${depName}: ${depValue}`);
        }
        console.log();
      }

      if (latestVersion["server-dependencies"] && Object.keys(latestVersion["server-dependencies"]).length > 0) {
        console.log(chalk.bold('Server Dependencies:'));
        for (const [depName, depValue] of Object.entries(latestVersion["server-dependencies"])) {
          console.log(`  ${depName}: ${depValue}`);
        }
        console.log();
      }

      if (latestVersion["dev-dependencies"] && Object.keys(latestVersion["dev-dependencies"]).length > 0) {
        console.log(chalk.bold('Dev Dependencies:'));
        for (const [depName, depValue] of Object.entries(latestVersion["dev-dependencies"])) {
          console.log(`  ${depName}: ${depValue}`);
        }
        console.log();
      }

    } catch (error) {
      spinner.fail('Failed to get package info');
      throw error;
    }
  }

  async list(): Promise<void> {
    try {
      if (!(await this.projectManager.jellyConfigExists())) {
        console.log(chalk.yellow('No jelly.json found. Run "jelly init" first.'));
        return;
      }

      const config = await this.projectManager.readJellyConfig();
      const allDeps = {
        ...config.dependencies,
        ...config.devDependencies
      };

      if (Object.keys(allDeps).length === 0) {
        console.log(chalk.yellow('No dependencies found in jelly.json'));
        return;
      }

      console.log(chalk.cyan('\n🪼 Installed packages:\n'));

      // Show regular dependencies
      if (config.dependencies && Object.keys(config.dependencies).length > 0) {
        console.log(chalk.bold('Dependencies:'));
        for (const [packageName, version] of Object.entries(config.dependencies)) {
          console.log(chalk.blue(`  → ${packageName}@${version}`));
        }
        console.log();
      }

      // Show dev dependencies
      if (config.devDependencies && Object.keys(config.devDependencies).length > 0) {
        console.log(chalk.bold('Dev Dependencies:'));
        for (const [packageName, version] of Object.entries(config.devDependencies)) {
          console.log(chalk.gray(`  → ${packageName}@${version}`));
        }
        console.log();
      }

      console.log(chalk.gray(`Total: ${Object.keys(allDeps).length} packages`));
    } catch (error) {
      throw new Error(`Failed to list packages: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async outdated(): Promise<{ outdated: any[], upToDate: any[] }> {
    const spinner = ora('Checking for outdated packages...').start();

    try {
      if (!(await this.projectManager.jellyConfigExists())) {
        spinner.fail('No jelly.json found. Run "jelly init" first.');
        return { outdated: [], upToDate: [] };
      }

      const config = await this.projectManager.readJellyConfig();
      const allDeps = {
        ...config.dependencies,
        ...config.devDependencies
      };

      if (Object.keys(allDeps).length === 0) {
        spinner.info('No dependencies to check');
        return { outdated: [], upToDate: [] };
      }

      const outdated: any[] = [];
      const upToDate: any[] = [];

      for (const [packageName, currentVersion] of Object.entries(allDeps)) {
        const parsed = WallyAPI.parsePackageName(packageName);
        spinner.text = `Checking ${packageName}...`;

        try {
          const latestVersion = await WallyAPI.getLatestVersion(parsed.scope, parsed.name);
          
          if (currentVersion !== latestVersion) {
            outdated.push({
              name: packageName,
              current: currentVersion,
              latest: latestVersion,
              isDev: config.devDependencies?.[packageName] !== undefined
            });
          } else {
            upToDate.push({
              name: packageName,
              version: currentVersion,
              isDev: config.devDependencies?.[packageName] !== undefined
            });
          }
        } catch (error) {
          // If we can't get version info, assume it's up to date
          upToDate.push({
            name: packageName,
            version: currentVersion,
            isDev: config.devDependencies?.[packageName] !== undefined,
            error: (error as Error).message
          });
        }
      }

      spinner.stop();

      if (outdated.length === 0) {
        console.log(chalk.green('\n🪼 All packages are up to date! ✨\n'));
      } else {
        console.log(chalk.yellow(`\n🪼 Found ${outdated.length} outdated package(s):\n`));

        for (const pkg of outdated) {
          const color = pkg.isDev ? chalk.gray : chalk.blue;
          console.log(color(`  → ${pkg.name}: ${pkg.current} → ${pkg.latest}${pkg.isDev ? ' (dev)' : ''}`));
        }

        console.log(chalk.cyan(`\nRun ${chalk.bold('jelly update')} to update all packages, or ${chalk.bold('jelly update <package>')} to update specific packages.\n`));
      }

      return { outdated, upToDate };
    } catch (error) {
      spinner.fail('Failed to check for outdated packages');
      throw error;
    }
  }

  async update(packages?: string[]): Promise<void> {
    const spinner = ora('Updating packages...').start();

    try {
      if (!(await this.projectManager.jellyConfigExists())) {
        spinner.fail('No jelly.json found. Run "jelly init" first.');
        return;
      }

      const config = await this.projectManager.readJellyConfig();
      const allDeps = {
        ...config.dependencies,
        ...config.devDependencies
      };

      if (Object.keys(allDeps).length === 0) {
        spinner.info('No dependencies to update');
        return;
      }

      let packagesToUpdate: string[];

      if (packages && packages.length > 0) {
        // Update specific packages
        packagesToUpdate = packages;
      } else {
        // Check for outdated packages without showing output
        spinner.text = 'Checking for outdated packages...';
        const outdated: any[] = [];

        for (const [packageName, currentVersion] of Object.entries(allDeps)) {
          const parsed = WallyAPI.parsePackageName(packageName);
          try {
            const latestVersion = await WallyAPI.getLatestVersion(parsed.scope, parsed.name);
            if (currentVersion !== latestVersion) {
              outdated.push({ name: packageName, current: currentVersion, latest: latestVersion });
            }
          } catch (error) {
            // Skip packages we can't check
          }
        }
        
        if (outdated.length === 0) {
          spinner.succeed('All packages are already up to date!');
          return;
        }

        packagesToUpdate = outdated.map(pkg => pkg.name);
      }

      let updatedCount = 0;
      for (const packageName of packagesToUpdate) {
        if (!allDeps[packageName]) {
          spinner.text = `⚠ Package ${packageName} not found in dependencies`;
          await new Promise(resolve => setTimeout(resolve, 1000));
          continue;
        }

        const parsed = WallyAPI.parsePackageName(packageName);
        spinner.text = `Getting latest version for ${packageName}...`;

        try {
          const latestVersion = await WallyAPI.getLatestVersion(parsed.scope, parsed.name);
          const currentVersion = allDeps[packageName];

          if (currentVersion === latestVersion) {
            spinner.text = `${packageName} is already up to date (${currentVersion})`;
            await new Promise(resolve => setTimeout(resolve, 500));
            continue;
          }

          const isDev = config.devDependencies?.[packageName] !== undefined;

          spinner.text = `Updating ${packageName}: ${currentVersion} → ${latestVersion}...`;
          
          // Update in project file
          await this.projectManager.addDependency(packageName, latestVersion, isDev);
          
          // Download new version
          await this.packageDownloader.downloadPackage(parsed.scope, parsed.name, latestVersion);
          
          updatedCount++;
        } catch (error) {
          spinner.text = `⚠ Failed to update ${packageName}: ${(error as Error).message}`;
          await new Promise(resolve => setTimeout(resolve, 1500));
        }
      }

      if (updatedCount > 0) {
        // Generate package index and update project file
        spinner.text = 'Updating package index...';
        await this.packageDownloader.generatePackageIndex();
        await this.packageDownloader.updateProjectFile(this.projectManager);
      }

      spinner.succeed(`Successfully updated ${updatedCount} package(s)!`);
      
      if (updatedCount > 0) {
        console.log(chalk.blue(`📁 Updated packages in: ${this.packageDownloader.getPackagesPath()}`));
      }
    } catch (error) {
      spinner.fail('Update failed');
      throw error;
    }
  }

  async clean(): Promise<void> {
    const spinner = ora('Cleaning unused packages...').start();

    try {
      if (!(await this.projectManager.jellyConfigExists())) {
        spinner.fail('No jelly.json found. Run "jelly init" first.');
        return;
      }

      const config = await this.projectManager.readJellyConfig();
      const allDeps = {
        ...config.dependencies,
        ...config.devDependencies,
        ...(config.serverDependencies || {})
      };

      const packagesPath = this.packageDownloader.getPackagesPath();
      const fs = await import('fs');
      const path = await import('path');

      if (!fs.existsSync(packagesPath)) {
        spinner.info('No packages directory found');
        return;
      }

      // Get list of dependencies that should exist
      const expectedPackages = new Set<string>();
      for (const depName of Object.keys(allDeps)) {
        const parsed = WallyAPI.parsePackageName(depName);
        expectedPackages.add(`${parsed.scope}_${parsed.name}`); // Package directory name
        expectedPackages.add(parsed.name); // Alias file name (without .lua extension)
      }

      const unusedPackages: string[] = [];
      const unusedAliases: string[] = [];

      // Check for unused packages in _Index directory
      const indexPath = path.join(packagesPath, '_Index');
      if (fs.existsSync(indexPath)) {
        const indexPackages = fs.readdirSync(indexPath, { withFileTypes: true })
          .filter(dirent => dirent.isDirectory())
          .map(dirent => dirent.name);

        for (const installedPkg of indexPackages) {
          if (!expectedPackages.has(installedPkg)) {
            unusedPackages.push(installedPkg);
          }
        }
      }

      // Check for unused packages in root directory (old structure)
      const rootItems = fs.readdirSync(packagesPath, { withFileTypes: true })
        .filter(dirent => dirent.isDirectory())
        .map(dirent => dirent.name)
        .filter(name => name !== '_Index'); // Exclude _Index directory

      for (const installedPkg of rootItems) {
        if (!expectedPackages.has(installedPkg)) {
          unusedPackages.push(installedPkg);
        }
      }

      // Check for unused alias files
      const aliasFiles = fs.readdirSync(packagesPath, { withFileTypes: true })
        .filter(dirent => dirent.isFile() && dirent.name.endsWith('.lua'))
        .map(dirent => dirent.name.replace('.lua', ''));

      for (const aliasName of aliasFiles) {
        // Check if this alias corresponds to a current dependency
        const isNeeded = Object.keys(allDeps).some(depName => {
          const parsed = WallyAPI.parsePackageName(depName);
          return parsed.name === aliasName;
        });

        if (!isNeeded) {
          unusedAliases.push(aliasName);
        }
      }

      const totalUnused = unusedPackages.length + unusedAliases.length;

      if (totalUnused === 0) {
        spinner.succeed('No unused packages found!');
        return;
      }

      spinner.text = `Removing ${totalUnused} unused item(s)...`;

      // Remove unused packages from _Index
      for (const unusedPkg of unusedPackages) {
        const packagePath = path.join(indexPath, unusedPkg);
        if (fs.existsSync(packagePath)) {
          fs.rmSync(packagePath, { recursive: true, force: true });
        }
        
        // Also check and remove from root directory (old structure)
        const oldPackagePath = path.join(packagesPath, unusedPkg);
        if (fs.existsSync(oldPackagePath)) {
          fs.rmSync(oldPackagePath, { recursive: true, force: true });
        }
      }

      // Remove unused alias files
      for (const unusedAlias of unusedAliases) {
        const aliasPath = path.join(packagesPath, `${unusedAlias}.lua`);
        if (fs.existsSync(aliasPath)) {
          fs.unlinkSync(aliasPath);
        }
      }

      // Regenerate package index to ensure consistency
      await this.packageDownloader.generatePackageIndex();

      spinner.succeed(`Cleaned ${totalUnused} unused item(s)!`);
      
      if (unusedPackages.length > 0) {
        console.log(chalk.gray(`Removed packages: ${unusedPackages.join(', ')}`));
      }
      if (unusedAliases.length > 0) {
        console.log(chalk.gray(`Removed aliases: ${unusedAliases.map(a => a + '.lua').join(', ')}`));
      }
    } catch (error) {
      spinner.fail('Clean failed');
      throw error;
    }
  }

  async cacheClean(): Promise<void> {
    const spinner = ora('Cleaning package cache...').start();

    try {
      const os = await import('os');
      const path = await import('path');
      const fs = await import('fs');

      // Define cache directory (similar to how npm/pnpm store cache)
      const cacheDir = path.join(os.homedir(), '.jelly', 'cache');

      if (!fs.existsSync(cacheDir)) {
        spinner.info('No cache directory found');
        return;
      }

      // Remove all cached files
      fs.rmSync(cacheDir, { recursive: true, force: true });

      spinner.succeed('Package cache cleaned!');
      console.log(chalk.gray(`Removed cache directory: ${cacheDir}`));
    } catch (error) {
      spinner.fail('Cache clean failed');
      throw error;
    }
  }

  async verifyLockfile(): Promise<void> {
    const spinner = ora('Verifying lockfile...').start();

    try {
      if (!(await this.projectManager.jellyConfigExists())) {
        spinner.fail('No jelly.json found. Run "jelly init" first.');
        return;
      }

      if (!(await this.lockfileManager.lockfileExists())) {
        spinner.fail('No jelly-lock.json found. Run "jelly install" to generate one.');
        return;
      }

      const config = await this.projectManager.readJellyConfig();
      const isValid = await this.lockfileManager.validateLockfile(config);

      if (isValid) {
        spinner.succeed('Lockfile is valid and up to date!');
        console.log(chalk.green(`📋 ${this.lockfileManager.getLockfilePath()}`));
      } else {
        spinner.fail('Lockfile is outdated or invalid.');
        console.log(chalk.yellow('Run "jelly install" to update the lockfile.'));
      }
    } catch (error) {
      spinner.fail('Lockfile verification failed');
      throw error;
    }
  }

  async regenerateLockfile(): Promise<void> {
    const spinner = ora('Regenerating lockfile...').start();

    try {
      if (!(await this.projectManager.jellyConfigExists())) {
        spinner.fail('No jelly.json found. Run "jelly init" first.');
        return;
      }

      const config = await this.projectManager.readJellyConfig();
      
      // Delete existing lockfile
      await this.lockfileManager.deleteLockfile();
      
      // Generate new lockfile
      const { lockfile, conflicts } = await this.lockfileManager.generateLockfile(config);
      
      // Display version conflicts if any
      if (conflicts.length > 0) {
        this.displayVersionConflicts(conflicts);
      }
      
      await this.lockfileManager.writeLockfile(lockfile);

      spinner.succeed('Lockfile regenerated successfully!');
      console.log(chalk.green(`📋 Created new lockfile: ${this.lockfileManager.getLockfilePath()}`));
      console.log(chalk.blue(`📦 Resolved ${Object.keys(lockfile.packages).length} packages`));
    } catch (error) {
      spinner.fail('Lockfile regeneration failed');
      throw error;
    }
  }

  async showOutdatedSummary(): Promise<void> {
    try {
      const { outdated } = await this.outdated();
      
      if (outdated.length > 0) {
        console.log(chalk.yellow(`\n⚠ ${outdated.length} package(s) are outdated. Run ${chalk.bold('jelly outdated')} for details.\n`));
      }
    } catch (error) {
      // Silently fail - don't interrupt the main installation process
    }
  }

  async run(scriptName: string, args: string[] = []): Promise<void> {
    return new Promise(async (resolve, reject) => {
      try {
        if (!(await this.projectManager.jellyConfigExists())) {
          console.log(chalk.red('No jelly.json found. Run "jelly init" first.'));
          resolve();
          return;
        }

        const config = await this.projectManager.readJellyConfig();
        
        if (!config.scripts || !config.scripts[scriptName]) {
          console.log(chalk.red(`Script "${scriptName}" not found in jelly.json`));
          
          if (config.scripts && Object.keys(config.scripts).length > 0) {
            console.log(chalk.cyan('\nAvailable scripts:'));
            for (const [name, command] of Object.entries(config.scripts)) {
              console.log(chalk.blue(`  → ${name}: `) + chalk.gray(command));
            }
          } else {
            console.log(chalk.gray('\nNo scripts defined in jelly.json'));
          }
          resolve();
          return;
        }

        const command = config.scripts[scriptName];
        const fullCommand = args.length > 0 ? `${command} ${args.join(' ')}` : command;
        
        console.log(chalk.cyan(`🪼 Running script: ${scriptName}`));
        console.log(chalk.gray(`> ${fullCommand}\n`));

        const { spawn } = await import('child_process');
        const isWindows = process.platform === 'win32';
        const shell = isWindows ? 'cmd' : 'sh';
        const shellFlag = isWindows ? '/c' : '-c';

        const childProcess = spawn(shell, [shellFlag, fullCommand], {
          stdio: 'inherit',
          cwd: this.projectManager.getProjectPath()
        });

        childProcess.on('close', (code) => {
          if (code === 0) {
            console.log(chalk.green(`\n✨ Script "${scriptName}" completed successfully!`));
            resolve();
          } else {
            console.log(chalk.red(`\n💥 Script "${scriptName}" failed with exit code ${code}`));
            reject(new Error(`Script failed with exit code ${code}`));
          }
        });

        childProcess.on('error', (error) => {
          console.error(chalk.red(`Failed to run script: ${error.message}`));
          reject(error);
        });

      } catch (error) {
        console.error(chalk.red(`Error running script: ${error instanceof Error ? error.message : 'Unknown error'}`));
        reject(error);
      }
    });
  }

  async listScripts(): Promise<void> {
    try {
      if (!(await this.projectManager.jellyConfigExists())) {
        console.log(chalk.yellow('No jelly.json found. Run "jelly init" first.'));
        return;
      }

      const config = await this.projectManager.readJellyConfig();
      
      if (!config.scripts || Object.keys(config.scripts).length === 0) {
        console.log(chalk.yellow('No scripts defined in jelly.json'));
        console.log(chalk.gray('\nTo add scripts, edit your jelly.json file:'));
        console.log(chalk.gray('{\n  "scripts": {\n    "build": "rojo build",\n    "serve": "rojo serve"\n  }\n}'));
        return;
      }

      console.log(chalk.cyan('\n🪼 Available scripts:\n'));
      
      for (const [name, command] of Object.entries(config.scripts)) {
        console.log(chalk.blue(`  → ${name}`));
        console.log(chalk.gray(`    ${command}`));
        console.log();
      }

      console.log(chalk.gray(`Run a script with: ${chalk.cyan('jelly run <script-name>')}`));
    } catch (error) {
      console.error(chalk.red(`Error listing scripts: ${error instanceof Error ? error.message : 'Unknown error'}`));
    }
  }

  // Workspace methods
  async initWorkspace(options: InitOptions = {}): Promise<void> {
    return await this.workspaceManager.initWorkspace(options);
  }

  async createWorkspace(workspacePath: string, options: { name?: string } = {}): Promise<void> {
    return await this.workspaceManager.createWorkspace(workspacePath, options);
  }

  async listWorkspaces(): Promise<void> {
    return await this.workspaceManager.listWorkspaces();
  }

  async installAllWorkspaces(options: { parallel?: boolean } = {}): Promise<void> {
    return await this.workspaceManager.installAllWorkspaces(options);
  }

  async addToWorkspace(workspaceName: string, packages: string[], options: { dev?: boolean } = {}): Promise<void> {
    return await this.workspaceManager.addToWorkspace(workspaceName, packages, options);
  }

  async runScriptInWorkspaces(
    scriptName: string, 
    args: string[] = [], 
    options: { filter?: string[]; exclude?: string[]; parallel?: boolean } = {}
  ): Promise<void> {
    return await this.workspaceManager.runScriptInWorkspaces(scriptName, args, options);
  }

  async isWorkspace(): Promise<boolean> {
    return await this.workspaceManager.isWorkspace();
  }

  async getCurrentWorkspace() {
    return await this.workspaceManager.getCurrentWorkspace();
  }

  async analyzeDependencies(): Promise<void> {
    const spinner = ora('Analyzing dependencies...').start();

    try {
      if (!(await this.projectManager.jellyConfigExists())) {
        spinner.fail('No jelly.json found. Run "jelly init" first.');
        return;
      }

      const config = await this.projectManager.readJellyConfig();
      const allDeps = {
        ...config.dependencies,
        ...config.devDependencies
      };

      if (Object.keys(allDeps).length === 0) {
        spinner.info('No dependencies to analyze');
        return;
      }

      spinner.text = 'Resolving dependency tree...';
      const resolutionResult = await this.versionResolver.resolveDependencyTree(allDeps);

      spinner.succeed('Dependency analysis complete!');

      // Display resolved packages
      console.log(chalk.blue('\n📦 Resolved packages:'));
      for (const [packageName, resolved] of resolutionResult.resolved) {
        console.log(chalk.gray(`  ${packageName}@${resolved.version}`));
      }

      // Display conflicts if any
      if (resolutionResult.conflicts.length > 0) {
        this.displayVersionConflicts(resolutionResult.conflicts);
      } else {
        console.log(chalk.green('\n✅ No version conflicts detected!'));
      }

      // Show resolution statistics
      console.log(chalk.blue(`\n📊 Resolution statistics:`));
      console.log(chalk.gray(`  Total packages: ${resolutionResult.resolved.size}`));
      console.log(chalk.gray(`  Conflicts: ${resolutionResult.conflicts.length}`));
      
      const cacheStats = this.versionResolver.getCacheStats();
      console.log(chalk.gray(`  Cache size: ${cacheStats.size} packages`));

    } catch (error) {
      spinner.fail('Dependency analysis failed');
      throw error;
    }
  }
}
