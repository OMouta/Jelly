import * as fs from 'fs-extra';
import * as path from 'path';
import { WallyAPI, HTTP_HEADERS, DOWNLOAD_HEADERS } from './WallyAPI';
import { LockfileEntry } from '../types';

export interface PackageDownloadInfo {
  scope: string;
  name: string;
  version: string;
  downloadUrl: string;
}

export class PackageDownloader {
  private projectPath: string;
  private packagesDir: string;

  constructor(projectPath: string = process.cwd()) {
    this.projectPath = projectPath;
    this.packagesDir = path.join(projectPath, 'Packages');
  }

  async downloadPackage(scope: string, name: string, version: string): Promise<void> {
    const downloadUrl = `https://api.wally.run/v1/package-contents/${scope}/${name}/${version}`;
    
    try {
      // Create packages directory structure
      await fs.ensureDir(this.packagesDir);
      
      const packageDir = path.join(this.packagesDir, `${scope}_${name}`);
      await fs.ensureDir(packageDir);

      // Download the package ZIP
      const response = await fetch(downloadUrl, {
        headers: DOWNLOAD_HEADERS
      });

      if (!response.ok) {
        throw new Error(`Failed to download package: ${response.status} ${response.statusText}`);
      }

      const zipPath = path.join(packageDir, `${name}.zip`);
      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      await fs.writeFile(zipPath, buffer);

      // Extract the ZIP file
      await this.extractPackage(zipPath, packageDir);
      
      // Process the extracted package (clean up and find main module)
      await this.processExtractedPackage(packageDir, scope, name);
      
      // Clean up the ZIP file
      await fs.remove(zipPath);

      console.log(`\n🪼 Downloaded and extracted ${scope}/${name}@${version}`);
    } catch (error) {
      throw new Error(`Failed to download ${scope}/${name}@${version}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async downloadFromLockfile(lockfileEntry: LockfileEntry, scope: string, name: string): Promise<void> {
    try {
      // Create packages directory structure
      await fs.ensureDir(this.packagesDir);
      
      const packageDir = path.join(this.packagesDir, `${scope}_${name}`);
      await fs.ensureDir(packageDir);

      // Download the package ZIP from the resolved URL
      const response = await fetch(lockfileEntry.resolved, {
        headers: DOWNLOAD_HEADERS
      });

      if (!response.ok) {
        throw new Error(`Failed to download package: ${response.status} ${response.statusText}`);
      }

      const zipPath = path.join(packageDir, `${name}.zip`);
      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      await fs.writeFile(zipPath, buffer);

      // Extract the ZIP file
      await this.extractPackage(zipPath, packageDir);
      
      // Process the extracted package (clean up and find main module)
      await this.processExtractedPackage(packageDir, scope, name);
      
      // Clean up the ZIP file
      await fs.remove(zipPath);

      console.log(`\n🪼 Downloaded and extracted ${scope}/${name}@${lockfileEntry.version} (from lockfile)`);
    } catch (error) {
      throw new Error(`Failed to download ${scope}/${name}@${lockfileEntry.version}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async extractPackage(zipPath: string, extractDir: string): Promise<void> {
    // For now, we'll use a simple implementation
    // In a real implementation, you'd want to use a proper ZIP library like yauzl or node-stream-zip
    const AdmZip = require('adm-zip');
    
    try {
      const zip = new AdmZip(zipPath);
      zip.extractAllTo(extractDir, true);
    } catch (error) {
      throw new Error(`Failed to extract package: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async processExtractedPackage(packageDir: string, scope: string, name: string): Promise<void> {
    // Check if there's a default.project.json to determine the main module path
    const projectJsonPath = path.join(packageDir, 'default.project.json');
    let mainModulePath = '';
    
    if (await fs.pathExists(projectJsonPath)) {
      try {
        const projectJson = await fs.readJson(projectJsonPath);
        
        // Check if there's a tree.$path that points to the main module
        if (projectJson.tree && projectJson.tree.$path) {
          mainModulePath = projectJson.tree.$path;
        }
      } catch (error) {
        console.warn(`Warning: Could not parse ${scope}/${name} project.json`);
      }
    }
    
    // If we found a main module path, reorganize the package
    if (mainModulePath) {
      const mainModuleSource = path.join(packageDir, mainModulePath);
      const tempDir = path.join(packageDir, '_temp');
      
      if (await fs.pathExists(mainModuleSource)) {
        // Copy the contents of the main module to temp
        await fs.copy(mainModuleSource, tempDir);
        
        // Remove all files in the package directory
        const items = await fs.readdir(packageDir);
        for (const item of items) {
          if (item !== '_temp') {
            await fs.remove(path.join(packageDir, item));
          }
        }
        
        // Move the contents of temp to the root
        const tempContents = await fs.readdir(tempDir);
        for (const item of tempContents) {
          await fs.move(path.join(tempDir, item), path.join(packageDir, item));
        }
        
        // Remove the temp directory
        await fs.remove(tempDir);
        
        console.log(`\n   📁 Cleaned up ${scope}/${name} (main module: ${mainModulePath})`);
      }
    } else {
      // Check if there's already an init.lua or init.luau at the root
      const hasInit = await fs.pathExists(path.join(packageDir, 'init.lua')) || 
                     await fs.pathExists(path.join(packageDir, 'init.luau'));
      
      if (!hasInit) {
        // Look for common module file patterns
        const items = await fs.readdir(packageDir);
        const moduleFiles = items.filter(item => 
          item.endsWith('.lua') || item.endsWith('.luau')
        );
        
        if (moduleFiles.length === 1) {
          // If there's only one Lua file, assume it's the main module
          const moduleFile = moduleFiles[0];
          await fs.move(
            path.join(packageDir, moduleFile), 
            path.join(packageDir, 'init.lua')
          );
          console.log(`\n   📁 Renamed ${moduleFile} to init.lua for ${scope}/${name}`);
        }
      }
      
      // Clean up common unnecessary files
      const unnecessaryFiles = [
        'README.md', 'README.txt', 'LICENSE', 'LICENSE.txt', 'LICENSE.md',
        '.gitignore', '.gitattributes', '.github', '.git',
        'package.json', 'package-lock.json', 'yarn.lock',
        'wally.toml', 'selene.toml', 'stylua.toml',
        'docs', 'documentation', 'examples', 'test', 'tests',
        '.travis.yml', '.vscode', 'rotriever.toml'
      ];
      
      for (const file of unnecessaryFiles) {
        const filePath = path.join(packageDir, file);
        if (await fs.pathExists(filePath)) {
          await fs.remove(filePath);
        }
      }
    }
  }

  async generatePackageIndex(): Promise<void> {
    // Generate Wally-compatible package structure
    const packages = await this.getInstalledPackages();
    
    // Create _Index directory if it doesn't exist
    const indexDir = path.join(this.packagesDir, '_Index');
    await fs.ensureDir(indexDir);
    
    // Remove old init.lua if it exists (from previous Jelly versions)
    const oldInitPath = path.join(this.packagesDir, 'init.lua');
    if (await fs.pathExists(oldInitPath)) {
      await fs.remove(oldInitPath);
    }

    // Clean up existing alias files before regenerating
    if (await fs.pathExists(this.packagesDir)) {
      const existingFiles = await fs.readdir(this.packagesDir);
      for (const file of existingFiles) {
        if (file.endsWith('.lua') && file !== 'init.lua') {
          const filePath = path.join(this.packagesDir, file);
          await fs.remove(filePath);
        }
      }
    }

    // Group packages by name to detect version conflicts
    const packagesByName = new Map<string, Array<{scope: string, name: string, version?: string, requirePath: string, packageDir: string}>>();
    
    for (const pkg of packages) {
      const packageDir = `${pkg.scope}_${pkg.name}`;
      const version = await this.extractVersionFromPackageDir(packageDir);
      
      if (!packagesByName.has(pkg.name)) {
        packagesByName.set(pkg.name, []);
      }
      
      packagesByName.get(pkg.name)!.push({
        ...pkg,
        version,
        packageDir
      });
    }

    // Generate alias files
    for (const [packageName, packageVersions] of packagesByName.entries()) {
      if (packageVersions.length === 1) {
        // Single version - use simple alias
        const pkg = packageVersions[0];
        const aliasFileName = `${packageName}.lua`;
        const aliasFilePath = path.join(this.packagesDir, aliasFileName);
        
        const aliasContent = `-- 🪼 Auto-generated by Jelly\n` +
                            `-- Package alias for ${pkg.scope}/${pkg.name}\n` +
                            `return require('./_Index/${pkg.packageDir}')\n`;
        
        await fs.writeFile(aliasFilePath, aliasContent);
      } else {
        // Multiple versions - create versioned aliases
        for (const pkg of packageVersions) {
          const versionSuffix = pkg.version ? `_${pkg.version.replace(/[^a-zA-Z0-9]/g, '_')}` : '_unknown';
          const aliasFileName = `${packageName}${versionSuffix}.lua`;
          const aliasFilePath = path.join(this.packagesDir, aliasFileName);
          
          const aliasContent = `-- 🪼 Auto-generated by Jelly\n` +
                              `-- Package alias for ${pkg.scope}/${pkg.name}@${pkg.version || 'unknown'}\n` +
                              `return require('./_Index/${pkg.packageDir}')\n`;
          
          await fs.writeFile(aliasFilePath, aliasContent);
        }
        
        // Also create a default alias pointing to the latest version (highest semver)
        const latestPkg = this.getLatestVersion(packageVersions);
        const defaultAliasFileName = `${packageName}.lua`;
        const defaultAliasFilePath = path.join(this.packagesDir, defaultAliasFileName);
        
        const defaultAliasContent = `-- 🪼 Auto-generated by Jelly\n` +
                                   `-- Package alias for ${latestPkg.scope}/${latestPkg.name} (latest: ${latestPkg.version || 'unknown'})\n` +
                                   `return require('./_Index/${latestPkg.packageDir}')\n`;
        
        await fs.writeFile(defaultAliasFilePath, defaultAliasContent);
      }

      // Move packages to _Index if needed
      for (const pkg of packageVersions) {
        const currentPackagePath = path.join(this.packagesDir, pkg.packageDir);
        const indexPackagePath = path.join(indexDir, pkg.packageDir);
        
        if (await fs.pathExists(currentPackagePath) && !await fs.pathExists(indexPackagePath)) {
          await fs.move(currentPackagePath, indexPackagePath);
        }
      }
    }
  }

  private async getInstalledPackages(): Promise<Array<{scope: string, name: string, requirePath: string}>> {
    const packages: Array<{scope: string, name: string, requirePath: string}> = [];
    
    if (!await fs.pathExists(this.packagesDir)) {
      return packages;
    }

    // Check for packages in the new _Index structure
    const indexDir = path.join(this.packagesDir, '_Index');
    if (await fs.pathExists(indexDir)) {
      const indexItems = await fs.readdir(indexDir);
      
      for (const item of indexItems) {
        const itemPath = path.join(indexDir, item);
        const stat = await fs.stat(itemPath);
        
        if (stat.isDirectory() && item.includes('_')) {
          const [scope, name] = item.split('_', 2);
          const requirePath = await this.determineRequirePath(itemPath, item);
          packages.push({ scope, name, requirePath });
        }
      }
    }

    // Also check for packages in the old structure (for migration)
    const items = await fs.readdir(this.packagesDir);
    
    for (const item of items) {
      if (item === 'init.lua' || item === '_Index') continue;
      
      const itemPath = path.join(this.packagesDir, item);
      const stat = await fs.stat(itemPath);
      
      if (stat.isDirectory() && item.includes('_')) {
        const [scope, name] = item.split('_', 2);
        // Check if this package is already handled by the new structure
        const existingPackage = packages.find(p => p.scope === scope && p.name === name);
        if (!existingPackage) {
          const requirePath = await this.determineRequirePath(itemPath, item);
          packages.push({ scope, name, requirePath });
        }
      }
    }

    return packages;
  }

  private async determineRequirePath(packageDir: string, moduleName: string): Promise<string> {
    // Check if there's an init.lua or init.luau at the root
    if (await fs.pathExists(path.join(packageDir, 'init.lua')) || 
        await fs.pathExists(path.join(packageDir, 'init.luau'))) {
      return `@self/${moduleName}`;
    }
    
    // Check if there's a default.project.json that defines a different path
    const projectJsonPath = path.join(packageDir, 'default.project.json');
    if (await fs.pathExists(projectJsonPath)) {
      try {
        const projectJson = await fs.readJson(projectJsonPath);
        if (projectJson.tree && projectJson.tree.$path) {
          return `@self/${moduleName}/${projectJson.tree.$path}`;
        }
      } catch (error) {
        // If we can't parse it, fall back to default
      }
    }
    
    // Look for any .lua or .luau files in subdirectories
    const items = await fs.readdir(packageDir);
    for (const item of items) {
      const itemPath = path.join(packageDir, item);
      const stat = await fs.stat(itemPath);
      if (stat.isDirectory()) {
        const subFiles = await fs.readdir(itemPath);
        if (subFiles.some(f => f === 'init.lua' || f === 'init.luau')) {
          return `@self/${moduleName}/${item}`;
        }
      }
    }
    
    // Default fallback
    return `@self/${moduleName}`;
  }

  async updateProjectFile(projectManager: any): Promise<void> {
    // Update the Rojo project file to include the Packages directory
    const project = await projectManager.readProject();
    
    if (!project.tree.ReplicatedStorage) {
      project.tree.ReplicatedStorage = {};
    }

    // Add Packages to ReplicatedStorage so they're accessible from both client and server
    project.tree.ReplicatedStorage.Packages = {
      "$path": "Packages"
    };

    await projectManager.writeProject(project);
  }

  getPackagesPath(): string {
    return this.packagesDir;
  }

  /**
   * Extract version from package directory name (e.g., "roblox_roact@1.4.4" -> "1.4.4")
   */
  private async extractVersionFromPackageDir(packageDir: string): Promise<string | undefined> {
    // Check if the package directory has a version suffix
    if (packageDir.includes('@')) {
      return packageDir.split('@')[1];
    }
    
    // Try to read version from package.json or wally.toml if available
    const packagePath = path.join(this.packagesDir, '_Index', packageDir);
    if (!await fs.pathExists(packagePath)) {
      const fallbackPath = path.join(this.packagesDir, packageDir);
      if (await fs.pathExists(fallbackPath)) {
        return await this.readVersionFromPackageFiles(fallbackPath);
      }
    } else {
      return await this.readVersionFromPackageFiles(packagePath);
    }
    
    return undefined;
  }

  /**
   * Read version from package files (wally.toml, package.json, etc.)
   */
  private async readVersionFromPackageFiles(packagePath: string): Promise<string | undefined> {
    // Try wally.toml first
    const wallyTomlPath = path.join(packagePath, 'wally.toml');
    if (await fs.pathExists(wallyTomlPath)) {
      try {
        const content = await fs.readFile(wallyTomlPath, 'utf-8');
        const versionMatch = content.match(/version\s*=\s*"([^"]+)"/);
        if (versionMatch) {
          return versionMatch[1];
        }
      } catch (error) {
        // Ignore parse errors
      }
    }
    
    // Try package.json
    const packageJsonPath = path.join(packagePath, 'package.json');
    if (await fs.pathExists(packageJsonPath)) {
      try {
        const packageJson = await fs.readJson(packageJsonPath);
        if (packageJson.version) {
          return packageJson.version;
        }
      } catch (error) {
        // Ignore parse errors
      }
    }
    
    return undefined;
  }

  /**
   * Get the latest version from a list of package versions
   */
  private getLatestVersion(packages: Array<{scope: string, name: string, version?: string, requirePath: string, packageDir: string}>): {scope: string, name: string, version?: string, requirePath: string, packageDir: string} {
    if (packages.length === 1) {
      return packages[0];
    }
    
    // Sort by version (basic semver sorting)
    const sorted = packages.sort((a, b) => {
      if (!a.version && !b.version) return 0;
      if (!a.version) return -1;
      if (!b.version) return 1;
      
      return this.compareVersions(b.version, a.version); // Descending order
    });
    
    return sorted[0];
  }

  /**
   * Compare two semver versions (returns positive if a > b, negative if a < b, 0 if equal)
   */
  private compareVersions(a: string, b: string): number {
    const aParts = a.split('.').map(x => parseInt(x, 10) || 0);
    const bParts = b.split('.').map(x => parseInt(x, 10) || 0);
    
    const maxLength = Math.max(aParts.length, bParts.length);
    
    for (let i = 0; i < maxLength; i++) {
      const aPart = aParts[i] || 0;
      const bPart = bParts[i] || 0;
      
      if (aPart > bPart) return 1;
      if (aPart < bPart) return -1;
    }
    
    return 0;
  }
}
