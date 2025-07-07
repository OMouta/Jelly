import { WallySearchResult, WallyPackageInfo, WallyPackage } from '../types';

export class WallyAPI {
  private static readonly BASE_URL = 'https://api.wally.run';

  static async searchPackages(query: string): Promise<WallySearchResult[]> {
    try {
      const response = await fetch(`${this.BASE_URL}/v1/package-search?query=${encodeURIComponent(query)}`, {
        headers: {
          'User-Agent': 'jelly-cli/0.0.1',
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        throw new Error(`Search failed: ${response.status} ${response.statusText}`);
      }

      const data = await response.json() as WallySearchResult[];
      return data;
    } catch (error) {
      throw new Error(`Failed to search packages: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  static async getPackageInfo(scope: string, name: string): Promise<WallyPackageInfo> {
    try {
      const response = await fetch(`${this.BASE_URL}/v1/package-metadata/${scope}/${name}`, {
        headers: {
          'User-Agent': 'jelly-cli/0.0.1',
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        if (response.status === 404) {
          throw new Error(`Package ${scope}/${name} not found`);
        }
        throw new Error(`Failed to get package info: ${response.status} ${response.statusText}`);
      }

      const data = await response.json() as WallyPackageInfo;
      return data;
    } catch (error) {
      throw new Error(`Failed to get package info: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  static async getLatestVersion(scope: string, name: string): Promise<string> {
    try {
      const packageInfo = await this.getPackageInfo(scope, name);
      
      if (!packageInfo.versions || packageInfo.versions.length === 0) {
        throw new Error(`No versions found for ${scope}/${name}`);
      }

      // Get the latest version (first in array, as they're sorted in descending order)
      return packageInfo.versions[0].package.version;
    } catch (error) {
      throw new Error(`Failed to get latest version: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  static parsePackageName(packageName: string): { scope: string; name: string; version?: string } {
    // Handle formats like:
    // - scope/name
    // - scope/name@version
    // - scope/name@^version
    const match = packageName.match(/^([^\/]+)\/([^@]+)(?:@(.+))?$/);
    
    if (!match) {
      throw new Error(`Invalid package name format: ${packageName}. Expected format: scope/name[@version]`);
    }

    const [, scope, name, version] = match;
    return { scope, name, version };
  }

  static formatPackageName(scope: string, name: string, version?: string): string {
    if (version) {
      return `${scope}/${name}@${version}`;
    }
    return `${scope}/${name}`;
  }
}
