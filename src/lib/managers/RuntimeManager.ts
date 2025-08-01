import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs-extra';
import { Output } from '../utils/Output';
import { PackageDownloader } from './PackageDownloader';

export interface BinaryPackageConfig {
  environment: string; // e.g., "lune", "luau", "python", "node", etc.
  bin: string; // Entry point file, e.g., "main.luau", "cli.py", "index.js"
  args?: string[]; // Optional default arguments
}

export interface JellyManifest {
  name: string;
  version: string;
  description?: string;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  scripts?: Record<string, string>;
  target?: BinaryPackageConfig;
  jelly?: {
    cleanup?: boolean;
    optimize?: boolean;
    packagesPath?: string;
  };
}

export class RuntimeManager {
  private downloader: PackageDownloader;
  private tempDir: string;

  constructor() {
    this.downloader = new PackageDownloader();
    this.tempDir = path.join(process.cwd(), '.jelly', 'temp');
  }

  /**
   * Execute a binary package with smart detection of local vs remote packages
   * This combines the functionality of executePackage and executeLocalPackage
   */
  async executePackageAuto(packageSpec: string, args: string[] = [], skipConfirmation: boolean = false): Promise<void> {
    let packagePath: string | null = null;
    
    try {
      // First, try to determine if this is a local package or a remote package spec
      const isRemoteSpec = packageSpec.includes('/') || packageSpec.includes('@');
      
      if (!isRemoteSpec) {
        // Try to find locally first
        const localPath = await this.findLocalPackage(packageSpec);
        if (localPath) {
          Output.action(`Executing local package ${packageSpec}`);
          const manifest = await this.readPackageManifest(localPath);
          
          if (!manifest.target) {
            Output.error('Package is not a binary package', 'No target configuration found in jelly.json');
            return;
          }

          await this.runBinaryPackage(localPath, manifest.target, args);
          return;
        }
      }
      
      // If not found locally or is a remote spec, download and execute
      Output.action(`Executing package ${packageSpec}`);
      
      // Download and extract package to temp directory
      packagePath = await this.downloadPackageToTemp(packageSpec, skipConfirmation);
      
      // Read package manifest
      const manifest = await this.readPackageManifest(packagePath);
      
      if (!manifest.target) {
        Output.error('Package is not a binary package', 'No target configuration found in jelly.json');
        return;
      }

      // Execute the package
      await this.runBinaryPackage(packagePath, manifest.target, args);
      
    } catch (error) {
      throw error;
    } finally {
      // Always cleanup temp directory if it was created
      if (packagePath) {
        await this.cleanupTemp(packagePath);
      }
    }
  }

  /**
   * Find a locally installed package by name
   * Returns the path if found, null otherwise
   */
  private async findLocalPackage(packageName: string): Promise<string | null> {
    const packagesDir = path.join(process.cwd(), 'Packages');
    
    // Try direct match first (e.g., "my-tool" -> "Packages/my-tool")
    const directPath = path.join(packagesDir, packageName);
    if (await fs.pathExists(directPath)) {
      return directPath;
    }
    
    // Try looking in _Index directory for packages with scope
    const indexDir = path.join(packagesDir, '_Index');
    if (await fs.pathExists(indexDir)) {
      const items = await fs.readdir(indexDir);
      
      // Look for packages that end with the package name (e.g., "scope_my-tool")
      for (const item of items) {
        if (item.endsWith(`_${packageName}`)) {
          const indexPath = path.join(indexDir, item);
          if (await fs.pathExists(indexPath)) {
            return indexPath;
          }
        }
      }
      
      // Also check for exact matches in _Index
      const indexPath = path.join(indexDir, packageName);
      if (await fs.pathExists(indexPath)) {
        return indexPath;
      }
    }
    
    return null;
  }

  /**
   * Execute a locally installed binary package
   */
  async executeLocalPackage(packageName: string, args: string[] = []): Promise<void> {
    try {
      const packagesDir = path.join(process.cwd(), 'Packages');
      const packagePath = path.join(packagesDir, packageName);

      if (!await fs.pathExists(packagePath)) {
        Output.error(`Package not found: ${packageName}`, 'Make sure the package is installed locally');
        return;
      }

      const manifest = await this.readPackageManifest(packagePath);
      
      if (!manifest.target) {
        Output.error('Package is not a binary package', 'No target configuration found in jelly.json');
        return;
      }

      await this.runBinaryPackage(packagePath, manifest.target, args);
      
    } catch (error) {
      Output.error('Failed to execute local package', (error as Error).message);
      throw error;
    }
  }

/**
 * Check if a runtime command is available on the system.
 * Tries '--version' first, then '--help' as a fallback.
 */
async checkRuntimeAvailable(command: string): Promise<boolean> {
    // Helper to try running the command with a given argument
    const tryCommand = (arg: string) => {
        return new Promise<boolean>((resolve) => {
            const child = spawn(command, [arg], {
                stdio: 'ignore',
                shell: true,
            });

            child.on('close', (code) => {
                resolve(code === 0);
            });

            child.on('error', () => {
                resolve(false);
            });
        });
    };

    // Try '--version' first
    if (await tryCommand('--version')) {
        return true;
    }
    // Fallback to '--help'
    return await tryCommand('--help');
}

  /**
   * List available runtimes that are commonly used
   */
  async listAvailableRuntimes(): Promise<string[]> {
    const commonRuntimes = ['lune', 'luau', 'lua'];
    const available: string[] = [];
    
    for (const runtime of commonRuntimes) {
      const isAvailable = await this.checkRuntimeAvailable(runtime);
      if (isAvailable) {
        available.push(runtime);
        Output.bulletPoint(`${runtime}`, '#10B981'); // Success green
      } else {
        Output.bulletPoint(`${runtime} (not available)`, '#6B7280'); // Muted gray
      }
    }

    return available;
  }

  private async downloadPackageToTemp(packageSpec: string, skipConfirmation: boolean = false): Promise<string> {
    // Parse package specification (e.g., "scope/name@version" or "scope/name")
    const parts = packageSpec.split('@');
    const packageName = parts[0];
    const version = parts[1] || 'latest';
    
    if (!packageName.includes('/')) {
      throw new Error('Package specification must be in format "scope/name" or "scope/name@version"');
    }
    
    const [scope, name] = packageName.split('/');
    
    // If version is "latest", we need to resolve it first for the confirmation message
    let resolvedVersion = version;
    if (version === 'latest') {
      try {
        const { WallyAPI } = await import('./WallyAPI');
        resolvedVersion = await WallyAPI.getLatestVersion(scope, name);
      } catch (error) {
        throw new Error(`Failed to resolve latest version for ${scope}/${name}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
    
    // Show confirmation prompt (similar to npx)
    if (!skipConfirmation) {
      const packageDisplayName = `${scope}/${name}@${resolvedVersion}`;
      
      Output.newLine();
      Output.warning('This command will download and execute a package from the Wally registry:');
      Output.log(`  Package: ${packageDisplayName}`);
      Output.log(`  Registry: https://api.wally.run`);
      Output.newLine();
      
      // Use readline to prompt for confirmation
      const readline = require('readline');
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
      });
      
      const confirmed = await new Promise<boolean>((resolve) => {
        rl.question('Do you want to continue? (y/N): ', (answer: string) => {
          rl.close();
          resolve(answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes');
        });
      });
      
      if (!confirmed) {
        Output.info('Operation cancelled by user.');
        throw new Error('Operation cancelled by user');
      }
      
      Output.newLine();
    }
    
    // Ensure temp directory exists
    await fs.ensureDir(this.tempDir);
    
    Output.info(`Downloading ${scope}/${name}@${resolvedVersion} to temporary directory...`);
    
    try {
      // Use the PackageDownloader's modular download method
      const tempPackageDir = await this.downloader.downloadToTemp(scope, name, resolvedVersion, this.tempDir);
      
      Output.success(`Downloaded and extracted ${scope}/${name}@${resolvedVersion}`);
      
      return tempPackageDir;
      
    } catch (error) {
      throw new Error(`Failed to download ${packageSpec}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async readPackageManifest(packagePath: string): Promise<JellyManifest> {
    const manifestPath = path.join(packagePath, 'jelly.json');
    
    if (!await fs.pathExists(manifestPath)) {
      throw new Error('jelly.json not found in package');
    }

    const manifestContent = await fs.readJson(manifestPath);
    return manifestContent as JellyManifest;
  }

  private async runBinaryPackage(packagePath: string, target: BinaryPackageConfig, args: string[]): Promise<void> {
    const { environment, bin, args: defaultArgs = [] } = target;
    
    // Check if runtime is available
    const isRuntimeAvailable = await this.checkRuntimeAvailable(environment);
    if (!isRuntimeAvailable) {
      Output.error(
        `Runtime '${environment}' is not available`,
        `Please install ${environment} or make sure it's in your PATH`
      );
      return;
    }

    // Construct the command
    const binPath = path.join(packagePath, bin);
    
    if (!await fs.pathExists(binPath)) {
      Output.error(`Binary file not found: ${bin}`, `Expected at ${binPath}`);
      return;
    }

    // Combine default args with user-provided args
    const allArgs = [...defaultArgs, ...args];

    Output.action(`Running ${environment} ${bin}${allArgs.length > 0 ? ' ' + allArgs.join(' ') : ''}`);

    // Execute the command
    return new Promise((resolve, reject) => {
      const child = spawn(environment, [binPath, ...allArgs], {
        stdio: 'inherit', // This allows the child process to use the parent's stdin/stdout/stderr
        shell: true,
        cwd: packagePath, // Run in the package directory
        env: {
          ...process.env,
          JELLY_ROOT: packagePath, // Provide package root to the script
          JELLY_PACKAGE_NAME: path.basename(packagePath),
        }
      });

      child.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`Process exited with code ${code}`));
        }
      });

      child.on('error', (error) => {
        Output.error('Failed to start process', error.message);
        reject(error);
      });
    });
  }

  private async cleanupTemp(packagePath: string): Promise<void> {
    try {
      await fs.remove(packagePath);
      Output.info('Cleaned up temporary files');
    } catch (error) {
      // Don't fail the whole operation if cleanup fails
      Output.warning('Failed to cleanup temporary files', (error as Error).message);
    }
  }
}
