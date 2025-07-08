import * as semver from 'semver';
import { WallyAPI } from './WallyAPI';
import { WallyPackageInfo } from '../types';

export interface ResolvedVersion {
  version: string;
  packageInfo: WallyPackageInfo;
}

export interface DependencyConflict {
  packageName: string;
  conflicts: Array<{
    requiredBy: string;
    versionRange: string;
  }>;
  resolvedVersion?: string;
}

export class VersionResolver {
  private packageCache = new Map<string, WallyPackageInfo>();

  async resolveVersion(scope: string, name: string, versionRange: string): Promise<ResolvedVersion> {
    const packageName = `${scope}/${name}`;
    
    // Get package info (with caching)
    let packageInfo = this.packageCache.get(packageName);
    if (!packageInfo) {
      packageInfo = await WallyAPI.getPackageInfo(scope, name);
      this.packageCache.set(packageName, packageInfo);
    }

    // Extract version numbers from package info
    const availableVersions = packageInfo.versions.map(v => v.package.version);
    
    // Resolve the best matching version
    const resolvedVersion = this.findBestMatch(versionRange, availableVersions);
    
    if (!resolvedVersion) {
      throw new Error(`No version of ${packageName} satisfies range ${versionRange}. Available: ${availableVersions.join(', ')}`);
    }

    return {
      version: resolvedVersion,
      packageInfo
    };
  }

  private findBestMatch(versionRange: string, availableVersions: string[]): string | null {
    // Clean the version range
    const cleanRange = this.normalizeVersionRange(versionRange);
    
    // Filter versions that satisfy the range
    const satisfyingVersions = availableVersions.filter(version => {
      try {
        return semver.satisfies(version, cleanRange);
      } catch (error) {
        // If semver parsing fails, try exact match
        return version === cleanRange;
      }
    });

    if (satisfyingVersions.length === 0) {
      return null;
    }

    // Return the highest satisfying version
    return semver.maxSatisfying(satisfyingVersions, cleanRange) || satisfyingVersions[0];
  }

  private normalizeVersionRange(versionRange: string): string {
    // Handle common Wally version patterns
    if (versionRange.startsWith('^')) {
      return versionRange; // semver handles this
    }
    
    if (versionRange.startsWith('~')) {
      return versionRange; // semver handles this
    }
    
    if (versionRange.startsWith('>=')) {
      return versionRange; // semver handles this
    }
    
    if (versionRange.startsWith('<=')) {
      return versionRange; // semver handles this
    }
    
    if (versionRange.includes(' - ')) {
      return versionRange; // semver range syntax
    }
    
    if (versionRange.includes('||')) {
      return versionRange; // semver OR syntax
    }
    
    // If it looks like a version number, treat as exact match
    if (semver.valid(versionRange)) {
      return versionRange;
    }
    
    // Default to exact match if we can't parse it
    return versionRange;
  }

  async resolveDependencyTree(
    dependencies: Record<string, string>,
    visited: Set<string> = new Set(),
    dependencyTree: Map<string, ResolvedVersion> = new Map(),
    parentChain: string[] = []
  ): Promise<{
    resolved: Map<string, ResolvedVersion>;
    conflicts: DependencyConflict[];
  }> {
    const conflicts: DependencyConflict[] = [];

    for (const [packageName, versionRange] of Object.entries(dependencies)) {
      if (visited.has(packageName)) {
        // Check for version conflicts
        const existing = dependencyTree.get(packageName);
        if (existing && !this.isVersionCompatible(existing.version, versionRange)) {
          // Find or create conflict entry
          let conflict = conflicts.find(c => c.packageName === packageName);
          if (!conflict) {
            conflict = {
              packageName,
              conflicts: [],
              resolvedVersion: existing.version
            };
            conflicts.push(conflict);
          }
          conflict.conflicts.push({
            requiredBy: parentChain.join(' -> '),
            versionRange
          });
        }
        continue;
      }

      visited.add(packageName);

      try {
        const parsed = WallyAPI.parsePackageName(packageName);
        const resolved = await this.resolveVersion(parsed.scope, parsed.name, versionRange);
        
        // Check if this conflicts with an existing resolution
        const existing = dependencyTree.get(packageName);
        if (existing && existing.version !== resolved.version) {
          // Try to find a version that satisfies both ranges
          const compatibleVersion = await this.findCompatibleVersion(
            parsed.scope, 
            parsed.name, 
            [versionRange, this.getVersionRange(existing.version)]
          );
          
          if (compatibleVersion) {
            // Update to compatible version
            const compatibleResolved = await this.resolveVersion(parsed.scope, parsed.name, compatibleVersion);
            dependencyTree.set(packageName, compatibleResolved);
          } else {
            // Record conflict
            let conflict = conflicts.find(c => c.packageName === packageName);
            if (!conflict) {
              conflict = {
                packageName,
                conflicts: [],
                resolvedVersion: existing.version
              };
              conflicts.push(conflict);
            }
            conflict.conflicts.push({
              requiredBy: parentChain.join(' -> '),
              versionRange
            });
          }
        } else {
          dependencyTree.set(packageName, resolved);
        }

        // Recursively resolve sub-dependencies
        const versionInfo = resolved.packageInfo.versions.find(v => v.package.version === resolved.version);
        if (versionInfo) {
          const subDeps = {
            ...versionInfo.dependencies,
            ...versionInfo['server-dependencies']
          };

          if (Object.keys(subDeps).length > 0) {
            const subResult = await this.resolveDependencyTree(
              subDeps,
              visited,
              dependencyTree,
              [...parentChain, packageName]
            );
            conflicts.push(...subResult.conflicts);
          }
        }

      } catch (error) {
        console.warn(`Failed to resolve ${packageName}@${versionRange}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    return {
      resolved: dependencyTree,
      conflicts
    };
  }

  private isVersionCompatible(resolvedVersion: string, requiredRange: string): boolean {
    try {
      const cleanRange = this.normalizeVersionRange(requiredRange);
      return semver.satisfies(resolvedVersion, cleanRange);
    } catch {
      return resolvedVersion === requiredRange;
    }
  }

  private getVersionRange(version: string): string {
    // Convert exact version back to a reasonable range
    return `^${version}`;
  }

  private async findCompatibleVersion(
    scope: string, 
    name: string, 
    ranges: string[]
  ): Promise<string | null> {
    try {
      const packageName = `${scope}/${name}`;
      let packageInfo = this.packageCache.get(packageName);
      if (!packageInfo) {
        packageInfo = await WallyAPI.getPackageInfo(scope, name);
        this.packageCache.set(packageName, packageInfo);
      }

      const availableVersions = packageInfo.versions.map(v => v.package.version);
      
      // Find versions that satisfy ALL ranges
      for (const version of availableVersions) {
        const satisfiesAll = ranges.every(range => {
          try {
            const cleanRange = this.normalizeVersionRange(range);
            return semver.satisfies(version, cleanRange);
          } catch {
            return version === range;
          }
        });
        
        if (satisfiesAll) {
          return version;
        }
      }

      return null;
    } catch {
      return null;
    }
  }

  clearCache(): void {
    this.packageCache.clear();
  }

  getCacheStats(): { size: number; packages: string[] } {
    return {
      size: this.packageCache.size,
      packages: Array.from(this.packageCache.keys())
    };
  }
}
