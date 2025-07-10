import fs from 'fs-extra';
import path from 'path';
import os from 'os';
import ora from 'ora';
import { HTTP_HEADERS } from './WallyAPI';
import { DeviceCodeResponse, AccessTokenResponse, RegistryTokenStore, RegistryConfig, AuthTokenStore } from '../../types';
import { Output } from '../utils/Output';

export class AuthManager {
  private static readonly DEFAULT_REGISTRY = 'https://github.com/UpliftGames/wally-index';
  private static readonly FALLBACK_CLIENT_ID = 'Iv23ctT8TxYJkyGLMk4u'; // Wally's GitHub OAuth app client ID
  private static readonly SCOPES = 'read:user';
  private static readonly TOKEN_FILE = path.join(os.homedir(), '.jelly', 'auth.json');

  /**
   * Initiate GitHub OAuth device flow for authentication
   */
  async login(token?: string, registry?: string): Promise<void> {
    const targetRegistry = registry || AuthManager.DEFAULT_REGISTRY;
    
    if (token) {
      // Direct token provided
      await this.storeToken(token, targetRegistry);
      Output.success(`Token stored successfully for ${targetRegistry}!`);
      return;
    }

    const spinner = ora(`Starting authentication for ${targetRegistry}...`).start();

    try {
      // Step 1: Get registry configuration
      spinner.text = 'Fetching registry configuration...';
      const config = await this.getRegistryConfig(targetRegistry);
      
      // Check if we're using fallback config and show warning
      if (config.github_oauth_id === AuthManager.FALLBACK_CLIENT_ID) {
        spinner.stop();
        Output.warning('Could not fetch registry configuration from GitHub');
        Output.info('Using fallback GitHub OAuth client ID');
        Output.newLine();
        spinner.start('Requesting device authorization...');
      } else {
        spinner.text = 'Requesting device authorization...';
      }
      
      // Step 2: Request device and user codes
      const deviceResponse = await this.requestDeviceCode(config.github_oauth_id);

      spinner.stop();
      
      // Step 3: Show user instructions with our professional interface
      Output.authStart(targetRegistry);
      Output.authCode(deviceResponse.verification_uri, deviceResponse.user_code);

      // Step 4: Poll for access token
      const spinner2 = ora('Waiting for authorization...').start();
      const accessToken = await this.pollForToken(deviceResponse, config.github_oauth_id);
      
      // Step 5: Store token
      await this.storeToken(accessToken, targetRegistry);
      
      spinner2.succeed(`Authentication successful for ${targetRegistry}!`);
      Output.success('You are now logged in!');
    } catch (error) {
      spinner.fail('Authentication failed');
      throw error;
    }
  }

  /**
   * Remove stored authentication token
   */
  async logout(registry?: string): Promise<void> {
    const targetRegistry = registry || AuthManager.DEFAULT_REGISTRY;
    
    try {
      if (await fs.pathExists(AuthManager.TOKEN_FILE)) {
        const tokenStore = await this.readTokenStore();
        
        if (tokenStore.tokens[targetRegistry]) {
          delete tokenStore.tokens[targetRegistry];
          await this.writeTokenStore(tokenStore);
          Output.success(`Successfully logged out from ${targetRegistry}!`);
        } else {
          Output.warning(`You are not currently logged in to ${targetRegistry}.`);
        }
      } else {
        Output.warning('You are not currently logged in to any registry.');
      }
    } catch (error) {
      throw new Error(`Failed to logout: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get stored authentication token for a specific registry
   */
  async getToken(registry?: string): Promise<string | null> {
    const targetRegistry = registry || AuthManager.DEFAULT_REGISTRY;
    
    try {
      if (!(await fs.pathExists(AuthManager.TOKEN_FILE))) {
        return null;
      }

      const tokenStore = await this.readTokenStore();
      const authData = tokenStore.tokens[targetRegistry];
      
      if (!authData) {
        return null;
      }
      
      // Check if token is expired (if expiration is set)
      if (authData.expiresAt && Date.now() > authData.expiresAt) {
        delete tokenStore.tokens[targetRegistry];
        await this.writeTokenStore(tokenStore);
        return null;
      }

      return authData.token;
    } catch (error) {
      // If there's any error reading the token file, treat as not authenticated
      return null;
    }
  }

  /**
   * Check if user is currently authenticated for a specific registry
   */
  async isAuthenticated(registry?: string): Promise<boolean> {
    const token = await this.getToken(registry);
    return token !== null;
  }

  /**
   * Get token with environment variable override
   */
  async getAuthToken(registry?: string): Promise<string> {
    const targetRegistry = registry || AuthManager.DEFAULT_REGISTRY;
    
    // Check environment variable first
    const envToken = process.env.WALLY_AUTH_TOKEN;
    if (envToken) {
      return envToken;
    }

    // Check stored token
    const storedToken = await this.getToken(targetRegistry);
    if (storedToken) {
      return storedToken;
    }

    throw new Error(`Not authenticated for ${targetRegistry}. Please run "jelly login" first.`);
  }

  /**
   * Get registry configuration from GitHub repository
   */
  private async getRegistryConfig(registry: string): Promise<RegistryConfig> {
    try {
      // Extract owner/repo from GitHub URL
      const githubRepo = this.extractGithubRepo(registry);
      
      if (!githubRepo) {
        throw new Error('Invalid GitHub repository URL');
      }

      const configUrl = `https://raw.githubusercontent.com/${githubRepo}/refs/heads/main/config.json`;
      const response = await fetch(configUrl, {
        headers: HTTP_HEADERS
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const config = await response.json() as RegistryConfig;
      return config;
    } catch (error) {
      // Return fallback config
      return {
        api: 'https://api.wally.run', // Default API for fallback
        api_url: 'https://api.wally.run',
        github_oauth_id: AuthManager.FALLBACK_CLIENT_ID
      };
    }
  }

  /**
   * Extract owner/repo from GitHub URL
   * Example: "https://github.com/UpliftGames/wally-index" -> "UpliftGames/wally-index"
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

  private async requestDeviceCode(clientId: string): Promise<DeviceCodeResponse> {
    const response = await fetch('https://github.com/login/device/code', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'jelly-cli/0.3.0'
      },
      body: new URLSearchParams({
        client_id: clientId,
        scope: AuthManager.SCOPES
      })
    });

    if (!response.ok) {
      throw new Error(`Device authorization failed: ${response.status} ${response.statusText}`);
    }

    return await response.json() as DeviceCodeResponse;
  }

  private async pollForToken(deviceResponse: DeviceCodeResponse, clientId: string): Promise<string> {
    const { device_code, interval, expires_in } = deviceResponse;
    const expiresAt = Date.now() + (expires_in * 1000);

    while (Date.now() < expiresAt) {
      await new Promise(resolve => setTimeout(resolve, interval * 1000));

      try {
        const response = await fetch('https://github.com/login/oauth/access_token', {
          method: 'POST',
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/x-www-form-urlencoded',
            'User-Agent': 'jelly-cli/0.3.0'
          },
          body: new URLSearchParams({
            client_id: clientId,
            device_code: device_code,
            grant_type: 'urn:ietf:params:oauth:grant-type:device_code'
          })
        });

        if (!response.ok) {
          throw new Error(`Token request failed: ${response.status} ${response.statusText}`);
        }

        const tokenResponse: AccessTokenResponse = await response.json();

        if (tokenResponse.access_token) {
          return tokenResponse.access_token;
        }

        if (tokenResponse.error) {
          if (tokenResponse.error === 'authorization_pending') {
            // Continue polling
            continue;
          } else if (tokenResponse.error === 'slow_down') {
            // Increase polling interval
            await new Promise(resolve => setTimeout(resolve, interval * 1000));
            continue;
          } else if (tokenResponse.error === 'expired_token') {
            throw new Error('Device code expired. Please try logging in again.');
          } else if (tokenResponse.error === 'access_denied') {
            throw new Error('Access denied by user.');
          } else {
            throw new Error(`Authentication error: ${tokenResponse.error_description || tokenResponse.error}`);
          }
        }
      } catch (error) {
        if (error instanceof Error && error.message.includes('Authentication error')) {
          throw error;
        }
        // Continue polling on network errors
        continue;
      }
    }

    throw new Error('Authentication timed out. Please try again.');
  }

  private async storeToken(token: string, registry: string): Promise<void> {
    const authDir = path.dirname(AuthManager.TOKEN_FILE);
    await fs.ensureDir(authDir);

    const tokenStore = await this.readTokenStore();
    
    tokenStore.tokens[registry] = {
      token: token
      // Note: GitHub OAuth tokens don't expire, but we could add expiration logic here if needed
    };

    await this.writeTokenStore(tokenStore);
  }

  private async readTokenStore(): Promise<RegistryTokenStore> {
    try {
      if (await fs.pathExists(AuthManager.TOKEN_FILE)) {
        const data = await fs.readJson(AuthManager.TOKEN_FILE);
        
        // Migrate old token format if needed
        if (data.token && typeof data.token === 'string') {
          return {
            tokens: {
              [AuthManager.DEFAULT_REGISTRY]: {
                token: data.token,
                expiresAt: data.expiresAt
              }
            }
          };
        }
        
        return data as RegistryTokenStore;
      }
    } catch (error) {
      // If there's any error reading the file, start fresh
    }

    return { tokens: {} };
  }

  private async writeTokenStore(tokenStore: RegistryTokenStore): Promise<void> {
    await fs.writeJson(AuthManager.TOKEN_FILE, tokenStore, { spaces: 2 });
  }
}
