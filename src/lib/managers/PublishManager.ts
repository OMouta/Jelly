import fs from 'fs-extra';
import path from 'path';
import chalk from 'chalk';
import ora from 'ora';
import archiver from 'archiver';
import { minimatch } from 'minimatch';
import { AuthManager } from './AuthManager';
import { ProjectManager } from './ProjectManager';
import { PublishOptions, WallyManifest, JellyConfig } from '../../types';
import { fetch } from '../utils/fetch';

export class PublishManager {
  private projectManager: ProjectManager;
  private authManager: AuthManager;

  constructor(projectPath?: string) {
    this.projectManager = new ProjectManager(projectPath);
    this.authManager = new AuthManager();
  }

  /**
   * Publish the current package to the Wally registry
   */
  async publish(options: PublishOptions = {}): Promise<void> {
    const spinner = ora('Preparing to publish...').start();

    try {
      const { config, wallyManifest } = await this.preparePackage(spinner);

      if (options.dryRun) {
        spinner.succeed('Dry run completed successfully!');
        console.log(chalk.blue('📦 Package would be published with the following manifest:'));
        console.log(chalk.gray(JSON.stringify(wallyManifest, null, 2)));
        return;
      }

      // Get registry configuration
      spinner.text = 'Fetching registry configuration...';
      const registryConfig = await this.getRegistryConfig(options.registry);

      // Get authentication token
      spinner.text = 'Checking authentication...';
      const token = options.token || await this.authManager.getAuthToken(registryConfig.githubRepo);

      // Create package ZIP
      spinner.text = 'Creating package archive...';
      const zipPath = await this.createPackageZip(config, wallyManifest);

      try {
        // Publish to registry
        spinner.text = `Publishing ${wallyManifest.package.name}@${wallyManifest.package.version}...`;
        await this.publishToRegistry(zipPath, token, registryConfig.apiUrl);

        spinner.succeed('Package published successfully!');
        console.log(chalk.green(`✨ Published ${wallyManifest.package.name}@${wallyManifest.package.version}`));
        
        if (registryConfig.githubRepo !== 'https://github.com/UpliftGames/wally-index') {
          console.log(chalk.blue(`📡 Registry: ${registryConfig.githubRepo}`));
        }
      } finally {
        // Clean up temporary ZIP file
        await fs.remove(zipPath);
      }

      // Clean up temporary wally.toml
      await this.cleanupTempFiles();

    } catch (error) {
      spinner.fail('Publishing failed');
      throw error;
    }
  }

  /**
   * Create a package archive without publishing (similar to wally package)
   */
  async package(options: { output?: string; list?: boolean } = {}): Promise<void> {
    const spinner = ora('Preparing package...').start();

    try {
      const { config, wallyManifest } = await this.preparePackage(spinner);

      if (options.list) {
        spinner.stop();
        console.log(chalk.blue('📦 Files that would be included in the package:'));
        await this.listPackageFiles(config, wallyManifest);
        return;
      }

      // Create package ZIP
      spinner.text = 'Creating package archive...';
      const outputPath = options.output || `${config.name.replace('/', '_')}-${config.version}.zip`;
      const zipPath = await this.createPackageZip(config, wallyManifest, outputPath);

      spinner.succeed('Package created successfully!');
      console.log(chalk.green(`✨ Package created: ${zipPath}`));
      
      const stats = await fs.stat(zipPath);
      console.log(chalk.gray(`📊 Package size: ${(stats.size / 1024).toFixed(1)} KB`));

      // Clean up temporary wally.toml
      await this.cleanupTempFiles();

    } catch (error) {
      spinner.fail('Packaging failed');
      // Always cleanup on error too
      await this.cleanupTempFiles();
      throw error;
    }
  }

  /**
   * Convert jelly.json to wally.toml format and output as JSON
   */
  async manifestToJson(): Promise<void> {
    try {
      // Verify we have a jelly.json file
      if (!(await this.projectManager.jellyConfigExists())) {
        throw new Error('No jelly.json found in current directory. Run "jelly init" first.');
      }

      // Read project configuration and generate manifest
      const config = await this.projectManager.readJellyConfig();
      const wallyManifest = this.generateWallyManifest(config);

      // Output as JSON
      console.log(JSON.stringify(wallyManifest, null, 2));
    } catch (error) {
      throw error;
    }
  }

  /**
   * Generate wally.toml content from jelly.json
   */
  private generateWallyManifest(config: JellyConfig): WallyManifest {
    const manifest: WallyManifest = {
      package: {
        name: config.name,
        version: config.version,
        description: config.description,
        registry: config.registry || 'https://github.com/UpliftGames/wally',
        realm: config.realm || 'shared',
        license: config.license || 'MIT',
        authors: config.authors || ['Unknown'],
        repository: config.repository,
        homepage: config.homepage,
        exclude: config.exclude,
        private: config.private,
      }
    };

    // Add dependencies if they exist
    if (config.dependencies && Object.keys(config.dependencies).length > 0) {
      manifest.dependencies = config.dependencies;
    }

    if (config.devDependencies && Object.keys(config.devDependencies).length > 0) {
      manifest['dev-dependencies'] = config.devDependencies;
    }

    // Add server dependencies if they exist
    if (config.serverDependencies && Object.keys(config.serverDependencies).length > 0) {
      manifest['server-dependencies'] = config.serverDependencies;
    }

    return manifest;
  }

  /**
   * Write wally.toml file
   */
  private async writeWallyToml(manifest: WallyManifest): Promise<void> {
    const wallyTomlPath = path.join(this.projectManager.getProjectPath(), 'wally.toml');
    
    let tomlContent = '[package]\n';
    tomlContent += `name = "${manifest.package.name}"\n`;
    tomlContent += `version = "${manifest.package.version}"\n`;
    
    if (manifest.package.description) {
      tomlContent += `description = "${manifest.package.description}"\n`;
    }
    
    if (manifest.package.registry) {
      tomlContent += `registry = "${manifest.package.registry}"\n`;
    }
    
    if (manifest.package.realm) {
      tomlContent += `realm = "${manifest.package.realm}"\n`;
    }
    
    if (manifest.package.license) {
      tomlContent += `license = "${manifest.package.license}"\n`;
    }
    
    if (manifest.package.authors && manifest.package.authors.length > 0) {
      tomlContent += `authors = [${manifest.package.authors.map(a => `"${a}"`).join(', ')}]\n`;
    }
    
    if (manifest.package.repository) {
      tomlContent += `repository = "${manifest.package.repository}"\n`;
    }
    
    if (manifest.package.homepage) {
      tomlContent += `homepage = "${manifest.package.homepage}"\n`;
    }

    if (manifest.package.exclude && manifest.package.exclude.length > 0) {
      tomlContent += `exclude = [${manifest.package.exclude.map(e => `"${e}"`).join(', ')}]\n`;
    }

    if (manifest.package.private) {
      tomlContent += `private = ${manifest.package.private}\n`;
    }

    // Add dependencies
    if (manifest.dependencies && Object.keys(manifest.dependencies).length > 0) {
      tomlContent += '\n[dependencies]\n';
      for (const [fullName, version] of Object.entries(manifest.dependencies)) {
        const alias = this.getPackageAlias(fullName);
        tomlContent += `${alias} = "${fullName}@${version}"\n`;
      }
    }

    // Add server dependencies
    if (manifest['server-dependencies'] && Object.keys(manifest['server-dependencies']).length > 0) {
      tomlContent += '\n[server-dependencies]\n';
      for (const [fullName, version] of Object.entries(manifest['server-dependencies'])) {
        const alias = this.getPackageAlias(fullName);
        tomlContent += `${alias} = "${fullName}@${version}"\n`;
      }
    }

    // Add dev dependencies
    if (manifest['dev-dependencies'] && Object.keys(manifest['dev-dependencies']).length > 0) {
      tomlContent += '\n[dev-dependencies]\n';
      for (const [fullName, version] of Object.entries(manifest['dev-dependencies'])) {
        const alias = this.getPackageAlias(fullName);
        tomlContent += `${alias} = "${fullName}@${version}"\n`;
      }
    }

    // Add place configuration
    if (manifest.place) {
      tomlContent += '\n[place]\n';
      if (manifest.place.shared_packages) {
        tomlContent += `shared-packages = "${manifest.place.shared_packages}"\n`;
      }
      if (manifest.place.server_packages) {
        tomlContent += `server-packages = "${manifest.place.server_packages}"\n`;
      }
    }

    await fs.writeFile(wallyTomlPath, tomlContent);
  }

  /**
   * Shared method to prepare package for publishing/packaging
   */
  private async preparePackage(spinner: any): Promise<{ config: JellyConfig, wallyManifest: WallyManifest }> {
    // Verify we have a jelly.json file
    if (!(await this.projectManager.jellyConfigExists())) {
      spinner.fail('No jelly.json found in current directory');
      throw new Error('Cannot proceed: No jelly.json file found. Run "jelly init" first.');
    }

    // Read project configuration
    const config = await this.projectManager.readJellyConfig();
    
    // Generate wally.toml from jelly.json
    spinner.text = 'Generating wally.toml...'
    const wallyManifest = this.generateWallyManifest(config);
    await this.writeWallyToml(wallyManifest);

    // Validate package before proceeding
    spinner.text = 'Validating package...'
    await this.validatePackage(config, wallyManifest);

    return { config, wallyManifest };
  }

  /**
   * Cleanup temporary files created during packaging/publishing
   */
  private async cleanupTempFiles(): Promise<void> {
    const wallyTomlPath = path.join(this.projectManager.getProjectPath(), 'wally.toml');
    if (await fs.pathExists(wallyTomlPath)) {
      await fs.remove(wallyTomlPath);
    }
  }

  /**
   * Validate package before publishing
   */
  private async validatePackage(config: JellyConfig, manifest: WallyManifest): Promise<void> {
    const errors: string[] = [];

    // Check required fields
    if (!manifest.package.name) {
      errors.push('Package name is required');
    }

    if (!manifest.package.version) {
      errors.push('Package version is required');
    }

    // Validate package name format (scope/name)
    if (manifest.package.name && !manifest.package.name.includes('/')) {
      errors.push('Package name must be in format "scope/name"');
    }

    // Validate version format (SemVer)
    const versionRegex = /^\d+\.\d+\.\d+(-[a-zA-Z0-9-]+)?$/;
    if (manifest.package.version && !versionRegex.test(manifest.package.version)) {
      errors.push('Package version must be valid SemVer (e.g., 1.0.0, 1.0.0-beta)');
    }

    // Check if src directory exists
    const srcPath = path.join(this.projectManager.getProjectPath(), 'src');
    if (!(await fs.pathExists(srcPath))) {
      errors.push('src/ directory is required for publishing');
    }

    if (errors.length > 0) {
      throw new Error(`Package validation failed:\n${errors.map(e => `  - ${e}`).join('\n')}`);
    }
  }

  /**
   * Create a ZIP archive of the package
   */
  private async createPackageZip(config: JellyConfig, manifest: WallyManifest, outputPath?: string): Promise<string> {
    const projectPath = this.projectManager.getProjectPath();
    const zipPath = outputPath ? path.resolve(projectPath, outputPath) : path.join(projectPath, `${config.name.replace('/', '_')}-${config.version}.zip`);

    return new Promise(async (resolve, reject) => {
      const output = fs.createWriteStream(zipPath);
      const archive = archiver('zip', { zlib: { level: 9 } });

      output.on('close', () => resolve(zipPath));
      archive.on('error', reject);

      archive.pipe(output);

      try {
        // Get all files that should be included
        const files = await this.getPackageFiles(config);

        for (const file of files) {
          const filePath = path.join(projectPath, file);
          
          if (await fs.pathExists(filePath)) {
            const stats = await fs.stat(filePath);
            
            if (stats.isFile()) {
              archive.file(filePath, { name: file });
            }
          }
        }

        archive.finalize();
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Check if a file should be included based on include/exclude patterns
   */
  private shouldIncludeFile(filePath: string, config: JellyConfig): boolean {
    // Always exclude packages directory
    const packagesPath = config.jelly?.packagesPath || 'Packages';
    if (filePath.startsWith(packagesPath + '/') || filePath === packagesPath) {
      return false;
    }

    // If include patterns are specified, file must match at least one include pattern
    if (config.include && config.include.length > 0) {
      const included = config.include.some(pattern => minimatch(filePath, pattern));
      if (!included) {
        return false;
      }
    }

    // If exclude patterns are specified, file must not match any exclude pattern
    if (config.exclude && config.exclude.length > 0) {
      const excluded = config.exclude.some(pattern => minimatch(filePath, pattern));
      if (excluded) {
        return false;
      }
    }

    return true;
  }

  /**
   * Get all files in the project directory that should be included in the package
   */
  private async getPackageFiles(config: JellyConfig): Promise<string[]> {
    const projectPath = this.projectManager.getProjectPath();
    const allFiles = await this.getAllProjectFiles(projectPath);
    
    const includedFiles: string[] = [];
    
    for (const file of allFiles) {
      if (this.shouldIncludeFile(file, config)) {
        includedFiles.push(file);
      }
    }

    // Always include wally.toml if it will be generated
    if (!includedFiles.includes('wally.toml')) {
      includedFiles.push('wally.toml');
    }

    return includedFiles.sort();
  }

  /**
   * Recursively get all files in the project directory
   */
  private async getAllProjectFiles(projectPath: string, currentPath: string = ''): Promise<string[]> {
    const files: string[] = [];
    const fullPath = currentPath ? path.join(projectPath, currentPath) : projectPath;
    
    try {
      const entries = await fs.readdir(fullPath, { withFileTypes: true });

      for (const entry of entries) {
        const relativePath = currentPath ? `${currentPath}/${entry.name}` : entry.name;
        
        if (entry.isDirectory()) {
          const subFiles = await this.getAllProjectFiles(projectPath, relativePath);
          files.push(...subFiles);
        } else {
          files.push(relativePath);
        }
      }
    } catch (error) {
      // Skip directories that can't be read
    }

    return files;
  }

  /**
   * Publish package ZIP to the registry
   */
  private async publishToRegistry(zipPath: string, token: string, registry?: string): Promise<void> {
    const registryUrl = registry || 'https://api.wally.run';
    const publishUrl = `${registryUrl}/v1/publish`;

    const zipBuffer = await fs.readFile(zipPath);

    const response = await fetch(publishUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json',
        'Content-Type': 'application/octet-stream',
        'User-Agent': 'jelly-cli/0.3.0',
        'Wally-Version': '0.3.2'
      },
      body: zipBuffer
    });

    if (!response.ok) {
      let errorMessage = `Publishing failed: ${response.status} ${response.statusText}`;
      
      try {
        const errorData = await response.text();
        if (errorData) {
          errorMessage += `\n${errorData}`;
        }
      } catch {
        // Ignore error parsing response
      }

      if (response.status === 401) {
        errorMessage = 'Authentication failed. Please run "jelly login" or check your token.';
      } else if (response.status === 409) {
        errorMessage = 'Package version already exists. Please increment the version in jelly.json.';
      }

      throw new Error(errorMessage);
    }
  }

  /**
   * List files that would be included in the package
   */
  private async listPackageFiles(config: JellyConfig, manifest: WallyManifest): Promise<void> {
    const files = await this.getPackageFiles(config);
    
    for (const file of files) {
      if (file === 'wally.toml') {
        console.log(chalk.cyan(`  → ${file}`) + chalk.gray(' (generated)'));
      } else {
        console.log(chalk.cyan(`  → ${file}`));
      }
    }
  }

  /**
   * Recursively get all files in a directory
   */
  private async getDirectoryFiles(dirPath: string, prefix: string = ''): Promise<string[]> {
    const files: string[] = [];
    const entries = await fs.readdir(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);
      const relativePath = prefix ? `${prefix}/${entry.name}` : entry.name;

      if (entry.isDirectory()) {
        const subFiles = await this.getDirectoryFiles(fullPath, relativePath);
        files.push(...subFiles);
      } else {
        files.push(relativePath);
      }
    }

    return files;
  }

  /**
   * Get registry configuration from GitHub repository
   */
  private async getRegistryConfig(registryRepo?: string): Promise<{ apiUrl: string; githubRepo: string }> {
    const defaultRepo = 'https://github.com/UpliftGames/wally-index';
    const githubRepo = registryRepo || defaultRepo;
    
    try {
      // Extract owner/repo from GitHub URL
      const repoPath = this.extractGithubRepo(githubRepo);
      
      if (!repoPath) {
        throw new Error('Invalid GitHub repository URL');
      }

      const configUrl = `https://raw.githubusercontent.com/${repoPath}/refs/heads/main/config.json`;
      const response = await fetch(configUrl, {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'jelly-cli/0.3.0'
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const config = await response.json() as { api: string };
      return {
        apiUrl: config.api,
        githubRepo: githubRepo
      };
    } catch (error) {
      // Return fallback config for default wally registry
      return {
        apiUrl: 'https://api.wally.run',
        githubRepo: githubRepo
      };
    }
  }

  /**
   * Extract owner/repo from GitHub URL
   */
  private extractGithubRepo(url: string): string | null {
    try {
      const urlObj = new URL(url);
      if (urlObj.hostname !== 'github.com') {
        return null;
      }
      
      const pathParts = urlObj.pathname.split('/').filter(part => part.length > 0);
      if (pathParts.length >= 2) {
        return `${pathParts[0]}/${pathParts[1]}`;
      }
      
      return null;
    } catch {
      return null;
    }
  }

  /**
   * Get package alias from full package name
   * Converts "roblox/roact" to "roact", "omouta/rex" to "rex", etc.
   */
  private getPackageAlias(fullName: string): string {
    // Split scope/name and return just the name part
    const parts = fullName.split('/');
    if (parts.length !== 2) {
      throw new Error(`Invalid package name format: ${fullName}`);
    }
    return parts[1]; // Return just the package name without scope
  }
}
