import * as fs from 'fs-extra';
import * as path from 'path';
import { JellyLockfile, LockfileEntry, JellyConfig } from '../types';
import { WallyAPI } from './WallyAPI';

export class LockfileManager {
  private projectPath: string;
  private lockfilePath: string;

  constructor(projectPath: string = process.cwd()) {
    this.projectPath = projectPath;
    this.lockfilePath = path.join(this.projectPath, 'jelly-lock.json');
  }

  async readLockfile(): Promise<JellyLockfile | null> {
    if (!await fs.pathExists(this.lockfilePath)) {
      return null;
    }

    try {
      const content = await fs.readFile(this.lockfilePath, 'utf-8');
      const lockfile = JSON.parse(content) as JellyLockfile;
      
      // Validate lockfile version
      if (lockfile.lockfileVersion !== 1) {
        console.warn('Lockfile version mismatch. Regenerating lockfile...');
        return null;
      }

      return lockfile;
    } catch (error) {
      console.warn('Invalid lockfile format. Regenerating lockfile...');
      return null;
    }
  }

  async writeLockfile(lockfile: JellyLockfile): Promise<void> {
    try {
      await fs.ensureDir(path.dirname(this.lockfilePath));
      const content = JSON.stringify(lockfile, null, 2);
      await fs.writeFile(this.lockfilePath, content, 'utf-8');
    } catch (error) {
      throw new Error(`Failed to write lockfile: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async generateLockfile(config: JellyConfig): Promise<JellyLockfile> {
    const lockfile: JellyLockfile = {
      lockfileVersion: 1,
      name: config.name,
      version: config.version,
      packages: {},
      dependencies: { ...config.dependencies },
      devDependencies: { ...config.devDependencies }
    };

    // Resolve all dependencies
    const allDeps = {
      ...config.dependencies,
      ...config.devDependencies
    };

    await this.resolveDependencies(allDeps, lockfile.packages);

    return lockfile;
  }

  private async resolveDependencies(
    dependencies: Record<string, string>,
    packages: Record<string, LockfileEntry>,
    visited: Set<string> = new Set()
  ): Promise<void> {
    for (const [packageName, versionRange] of Object.entries(dependencies)) {
      if (visited.has(packageName)) {
        continue; // Avoid circular dependencies
      }

      visited.add(packageName);

      try {
        const parsed = WallyAPI.parsePackageName(packageName);
        const resolvedVersion = await this.resolveVersion(parsed.scope, parsed.name, versionRange);
        
        // Get package info to find dependencies
        const packageInfo = await WallyAPI.getPackageInfo(parsed.scope, parsed.name);
        const versionInfo = packageInfo.versions.find(v => v.package.version === resolvedVersion);

        if (!versionInfo) {
          throw new Error(`Version ${resolvedVersion} not found for ${packageName}`);
        }

        // Create lockfile entry
        const lockfileKey = `${parsed.scope}/${parsed.name}`;
        packages[lockfileKey] = {
          version: resolvedVersion,
          resolved: `https://api.wally.run/v1/package-contents/${parsed.scope}/${parsed.name}/${resolvedVersion}`,
          dependencies: versionInfo.dependencies || {},
          devDependencies: versionInfo['dev-dependencies'] || {}
        };

        // Recursively resolve dependencies
        if (versionInfo.dependencies) {
          await this.resolveDependencies(versionInfo.dependencies, packages, visited);
        }

        // Include server dependencies if they exist
        if (versionInfo['server-dependencies']) {
          await this.resolveDependencies(versionInfo['server-dependencies'], packages, visited);
        }

      } catch (error) {
        console.warn(`Failed to resolve ${packageName}@${versionRange}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
  }

  private async resolveVersion(scope: string, name: string, versionRange: string): Promise<string> {
    // For now, we'll implement basic version resolution
    // In a full implementation, you'd want proper semver range resolution
    
    if (versionRange.startsWith('^') || versionRange.startsWith('~')) {
      // Get the latest compatible version
      const packageInfo = await WallyAPI.getPackageInfo(scope, name);
      const baseVersion = versionRange.substring(1);
      
      // Find the latest version that satisfies the range
      for (const versionInfo of packageInfo.versions) {
        if (this.satisfiesRange(versionInfo.package.version, versionRange)) {
          return versionInfo.package.version;
        }
      }
      
      // Fallback to exact version without range operator
      return baseVersion;
    } else {
      // Exact version
      return versionRange;
    }
  }

  private satisfiesRange(version: string, range: string): boolean {
    // Basic semver range checking
    // In a full implementation, you'd use a proper semver library
    
    if (range.startsWith('^')) {
      const baseVersion = range.substring(1);
      return this.isCompatibleVersion(version, baseVersion, 'caret');
    } else if (range.startsWith('~')) {
      const baseVersion = range.substring(1);
      return this.isCompatibleVersion(version, baseVersion, 'tilde');
    } else {
      return version === range;
    }
  }

  private isCompatibleVersion(version: string, baseVersion: string, type: 'caret' | 'tilde'): boolean {
    const versionParts = version.split('.').map(Number);
    const baseParts = baseVersion.split('.').map(Number);

    if (type === 'caret') {
      // ^1.2.3 allows 1.x.x but not 2.x.x
      return versionParts[0] === baseParts[0] && 
             (versionParts[1] > baseParts[1] || 
              (versionParts[1] === baseParts[1] && versionParts[2] >= baseParts[2]));
    } else if (type === 'tilde') {
      // ~1.2.3 allows 1.2.x but not 1.3.x
      return versionParts[0] === baseParts[0] && 
             versionParts[1] === baseParts[1] && 
             versionParts[2] >= baseParts[2];
    }

    return false;
  }

  async updateLockfile(config: JellyConfig): Promise<JellyLockfile> {
    const existingLockfile = await this.readLockfile();
    
    if (!existingLockfile) {
      return await this.generateLockfile(config);
    }

    // Check if dependencies in jelly.json have changed
    const configDeps = { ...config.dependencies, ...config.devDependencies };
    const lockfileDeps = { ...existingLockfile.dependencies, ...existingLockfile.devDependencies };

    const hasChanges = JSON.stringify(configDeps) !== JSON.stringify(lockfileDeps);

    if (hasChanges) {
      console.log('📋 Dependencies changed, updating lockfile...');
      return await this.generateLockfile(config);
    }

    return existingLockfile;
  }

  async validateLockfile(config: JellyConfig): Promise<boolean> {
    const lockfile = await this.readLockfile();
    
    if (!lockfile) {
      return false;
    }

    // Check if all dependencies from jelly.json are present in lockfile
    const configDeps = { ...config.dependencies, ...config.devDependencies };
    const lockfileDeps = { ...lockfile.dependencies, ...lockfile.devDependencies };

    for (const [packageName, version] of Object.entries(configDeps)) {
      if (!lockfileDeps[packageName]) {
        return false;
      }
    }

    return true;
  }

  async getInstalledPackages(): Promise<Array<{ name: string; version: string; resolved: string }>> {
    const lockfile = await this.readLockfile();
    
    if (!lockfile) {
      return [];
    }

    return Object.entries(lockfile.packages).map(([name, entry]) => ({
      name,
      version: entry.version,
      resolved: entry.resolved
    }));
  }

  getLockfilePath(): string {
    return this.lockfilePath;
  }

  async lockfileExists(): Promise<boolean> {
    return await fs.pathExists(this.lockfilePath);
  }

  async deleteLockfile(): Promise<void> {
    if (await this.lockfileExists()) {
      await fs.remove(this.lockfilePath);
    }
  }
}
