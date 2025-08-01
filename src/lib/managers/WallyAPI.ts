import { WallySearchResult, WallyPackageInfo, WallyPackage, JellyConfig } from '../../types';
import { fetch } from '../utils/fetch';
import * as fs from 'fs-extra';
import * as path from 'path';

// Common HTTP headers for Jelly requests
export const HTTP_HEADERS = {
  'User-Agent': 'jelly-cli/0.3.3',
  'Accept': 'application/json',
  'Content-Type': 'application/json'
} as const;

// Headers for package downloads
export const DOWNLOAD_HEADERS = {
  'User-Agent': 'jelly-cli/0.3.3',
  'Accept': 'application/zip',
  'Wally-Version': '0.3.2'
} as const;

export class WallyAPI {
  private static readonly DEFAULT_BASE_URL = 'https://api.wally.run';

  private static async getRegistryApiUrl(registry?: string): Promise<string> {
    if (registry) {
      // If a specific registry is provided, try to resolve its API URL
      try {
        const config = await this.readProjectConfig();
        if (config?.registry && registry === config.registry) {
          // For now, we'll parse the registry URL to derive the API URL
          // In a future implementation, this should fetch registry config
          return this.DEFAULT_BASE_URL; // Fallback for now
        }
      } catch (error) {
        // Ignore config read errors and use default
      }
    }

    // Try to read project config for default registry
    try {
      const config = await this.readProjectConfig();
      if (config?.registry) {
        // For now, we'll keep using the default API URL
        // TODO: Implement proper registry-to-API-URL resolution
        return this.DEFAULT_BASE_URL;
      }
    } catch (error) {
      // Ignore config read errors and use default
    }

    return this.DEFAULT_BASE_URL;
  }

  private static async readProjectConfig(): Promise<JellyConfig | null> {
    try {
      const configPath = path.join(process.cwd(), 'jelly.json');
      if (await fs.pathExists(configPath)) {
        return await fs.readJson(configPath);
      }
    } catch (error) {
      // Ignore errors and return null
    }
    return null;
  }

  static async searchPackages(query: string, registry?: string): Promise<WallySearchResult[]> {
    const baseUrl = await this.getRegistryApiUrl(registry);
    try {
      const response = await fetch(`${baseUrl}/v1/package-search?query=${encodeURIComponent(query)}`, {
        headers: HTTP_HEADERS
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

  static async getPackageInfo(scope: string, name: string, registry?: string): Promise<WallyPackageInfo> {
    const baseUrl = await this.getRegistryApiUrl(registry);
    try {
      const response = await fetch(`${baseUrl}/v1/package-metadata/${scope}/${name}`, {
        headers: HTTP_HEADERS
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

  static async getLatestVersion(scope: string, name: string, registry?: string): Promise<string> {
    try {
      const packageInfo = await this.getPackageInfo(scope, name, registry);
      
      if (!packageInfo.versions || packageInfo.versions.length === 0) {
        throw new Error(`No versions found for ${scope}/${name}`);
      }

      // Get the latest version (first in array, as they're sorted in descending order)
      return packageInfo.versions[0].package.version;
    } catch (error) {
      throw new Error(`Failed to get latest version: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  static getDownloadUrl(scope: string, name: string, version: string, registry?: string): string {
    // TODO: In the future, this should resolve the download URL based on the registry
    // For now, we'll use the default Wally API
    return `https://api.wally.run/v1/package-contents/${scope}/${name}/${version}`;
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
