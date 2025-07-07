import * as fs from 'fs-extra';
import * as path from 'path';
import { WallyAPI } from './WallyAPI';

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
        headers: {
          'User-Agent': 'jelly-cli/0.0.1',
          'Accept': 'application/zip',
          'Wally-Version': '0.3.2'
        }
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
    // Generate an index.lua file that can be used by Roblox to require packages
    const indexPath = path.join(this.packagesDir, 'init.lua');
    
    const packages = await this.getInstalledPackages();
    
    let indexContent = '-- 🪼 Auto-generated by Jelly\n';
    indexContent += '-- This file provides access to installed packages\n\n';
    indexContent += 'local Packages = {}\n\n';

    for (const pkg of packages) {
      indexContent += `Packages["${pkg.scope}/${pkg.name}"] = require("${pkg.requirePath}")\n`;
    }

    indexContent += '\nreturn Packages\n';

    await fs.writeFile(indexPath, indexContent);
  }

  private async getInstalledPackages(): Promise<Array<{scope: string, name: string, requirePath: string}>> {
    const packages: Array<{scope: string, name: string, requirePath: string}> = [];
    
    if (!await fs.pathExists(this.packagesDir)) {
      return packages;
    }

    const items = await fs.readdir(this.packagesDir);
    
    for (const item of items) {
      if (item === 'init.lua') continue;
      
      const itemPath = path.join(this.packagesDir, item);
      const stat = await fs.stat(itemPath);
      
      if (stat.isDirectory() && item.includes('_')) {
        const [scope, name] = item.split('_', 2);
        const requirePath = await this.determineRequirePath(itemPath, `${scope}_${name}`);
        packages.push({ scope, name, requirePath });
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
}
