import chalk from 'chalk';
import ora from 'ora';
import { ProjectManager } from './ProjectManager';
import { WallyAPI } from './WallyAPI';
import { PackageDownloader } from './PackageDownloader';
import { InstallOptions, InitOptions } from '../types';

export class JellyManager {
  private projectManager: ProjectManager;
  private packageDownloader: PackageDownloader;

  constructor(projectPath?: string) {
    this.projectManager = new ProjectManager(projectPath);
    this.packageDownloader = new PackageDownloader(projectPath);
  }

  async install(packages: string[], options: InstallOptions = {}): Promise<void> {
    const spinner = ora('Installing packages...').start();

    try {
      for (const packageName of packages) {
        const parsed = WallyAPI.parsePackageName(packageName);
        let version = parsed.version;

        if (!version) {
          spinner.text = `Getting latest version for ${parsed.scope}/${parsed.name}...`;
          version = await WallyAPI.getLatestVersion(parsed.scope, parsed.name);
        }

        spinner.text = `Adding ${parsed.scope}/${parsed.name}@${version} to project...`;
        await this.projectManager.addDependency(
          `${parsed.scope}/${parsed.name}`,
          version,
          options.dev || false
        );

        spinner.text = `Downloading ${parsed.scope}/${parsed.name}@${version}...`;
        await this.packageDownloader.downloadPackage(parsed.scope, parsed.name, version);
      }

      // Generate package index and update project file
      spinner.text = 'Updating package index...';
      await this.packageDownloader.generatePackageIndex();
      await this.packageDownloader.updateProjectFile(this.projectManager);

      spinner.succeed('Packages installed successfully!');
      console.log(chalk.blue(`📁 Packages installed to: ${this.packageDownloader.getPackagesPath()}`));
      
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
      const project = await this.projectManager.readProject();
      const allDeps = {
        ...project.dependencies,
        ...project.devDependencies
      };

      if (Object.keys(allDeps).length === 0) {
        spinner.info('No dependencies to install');
        return;
      }

      spinner.text = `Installing ${Object.keys(allDeps).length} dependencies...`;

      // Download and install each package
      for (const [packageName, version] of Object.entries(allDeps)) {
        const parsed = WallyAPI.parsePackageName(packageName);
        spinner.text = `Downloading ${packageName}@${version}...`;
        
        try {
          await this.packageDownloader.downloadPackage(parsed.scope, parsed.name, version);
        } catch (error) {
          // If package download fails, log but continue with other packages
          spinner.text = `⚠ Could not download ${packageName}@${version} (${(error as Error).message})`;
          await new Promise(resolve => setTimeout(resolve, 1500)); // Brief pause to show message
        }
      }

      // Generate package index and update project file
      spinner.text = 'Generating package index...';
      await this.packageDownloader.generatePackageIndex();
      await this.packageDownloader.updateProjectFile(this.projectManager);

      spinner.succeed(`Successfully installed ${Object.keys(allDeps).length} dependencies!`);
      console.log(chalk.blue(`📁 Packages installed to: ${this.packageDownloader.getPackagesPath()}`));
      
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

      spinner.succeed('Packages removed successfully!');
    } catch (error) {
      spinner.fail('Removal failed');
      throw error;
    }
  }

  async init(options: InitOptions = {}): Promise<void> {
    const spinner = ora('Initializing project...').start();

    try {
      if (await this.projectManager.projectExists()) {
        spinner.warn('Project already exists!');
        return;
      }

      await this.projectManager.createProject(options);
      spinner.succeed('Project initialized successfully!');
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
      const project = await this.projectManager.readProject();
      const allDeps = {
        ...project.dependencies,
        ...project.devDependencies
      };

      if (Object.keys(allDeps).length === 0) {
        console.log(chalk.yellow('No dependencies found in project.json'));
        return;
      }

      console.log(chalk.cyan('\n🪼 Installed packages:\n'));

      // Show regular dependencies
      if (project.dependencies && Object.keys(project.dependencies).length > 0) {
        console.log(chalk.bold('Dependencies:'));
        for (const [packageName, version] of Object.entries(project.dependencies)) {
          console.log(chalk.blue(`  → ${packageName}@${version}`));
        }
        console.log();
      }

      // Show dev dependencies
      if (project.devDependencies && Object.keys(project.devDependencies).length > 0) {
        console.log(chalk.bold('Dev Dependencies:'));
        for (const [packageName, version] of Object.entries(project.devDependencies)) {
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
      const project = await this.projectManager.readProject();
      const allDeps = {
        ...project.dependencies,
        ...project.devDependencies
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
              isDev: project.devDependencies?.[packageName] !== undefined
            });
          } else {
            upToDate.push({
              name: packageName,
              version: currentVersion,
              isDev: project.devDependencies?.[packageName] !== undefined
            });
          }
        } catch (error) {
          // If we can't get version info, assume it's up to date
          upToDate.push({
            name: packageName,
            version: currentVersion,
            isDev: project.devDependencies?.[packageName] !== undefined,
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
      const project = await this.projectManager.readProject();
      const allDeps = {
        ...project.dependencies,
        ...project.devDependencies
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

          const isDev = project.devDependencies?.[packageName] !== undefined;

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
      const project = await this.projectManager.readProject();
      const allDeps = {
        ...project.dependencies,
        ...project.devDependencies
      };

      const packagesPath = this.packageDownloader.getPackagesPath();
      const fs = await import('fs');
      const path = await import('path');

      if (!fs.existsSync(packagesPath)) {
        spinner.info('No packages directory found');
        return;
      }

      const installedPackages = fs.readdirSync(packagesPath, { withFileTypes: true })
        .filter(dirent => dirent.isDirectory())
        .map(dirent => dirent.name)
        .filter(name => name !== 'init.lua'); // Exclude the index file

      const unusedPackages: string[] = [];

      for (const installedPkg of installedPackages) {
        // Check if this package is in dependencies
        const isInDeps = Object.keys(allDeps).some(depName => {
          const parsed = WallyAPI.parsePackageName(depName);
          return `${parsed.scope}_${parsed.name}` === installedPkg || parsed.name === installedPkg;
        });

        if (!isInDeps) {
          unusedPackages.push(installedPkg);
        }
      }

      if (unusedPackages.length === 0) {
        spinner.succeed('No unused packages found!');
        return;
      }

      spinner.text = `Removing ${unusedPackages.length} unused package(s)...`;

      for (const unusedPkg of unusedPackages) {
        const packagePath = path.join(packagesPath, unusedPkg);
        fs.rmSync(packagePath, { recursive: true, force: true });
      }

      // Regenerate package index
      await this.packageDownloader.generatePackageIndex();

      spinner.succeed(`Cleaned ${unusedPackages.length} unused package(s)!`);
      console.log(chalk.gray(`Removed: ${unusedPackages.join(', ')}`));
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
}
