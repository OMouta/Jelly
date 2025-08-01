export interface RojoProject {
  name: string;
  version?: string;
  description?: string;
  tree: {
    $className: string;
    [key: string]: any;
  };
}

export interface BinaryPackageTarget {
  environment: string;
  bin: string;
  args?: string[];
}

export interface JellyConfig {
  name: string;
  version: string;
  description?: string;
  license?: string;
  authors?: string[];
  realm?: 'shared' | 'server';
  registry?: string;
  homepage?: string;
  repository?: string;
  exclude?: string[];
  include?: string[];
  private?: boolean;
  dependencies: Record<string, string>;
  devDependencies: Record<string, string>;
  serverDependencies?: Record<string, string>;
  scripts?: Record<string, string>;
  target?: BinaryPackageTarget; // Binary package configuration
  jelly?: {
    cleanup?: boolean;
    optimize?: boolean;
    packagesPath?: string;
    updateProjectFile?: boolean; // Whether to automatically update Rojo project files
  };
}

export interface WallyPackage {
  scope: string;
  name: string;
  version: string;
  registry?: string;
}

export interface WallySearchResult {
  scope: string;
  name: string;
  versions: string[];
  description?: string;
  repository?: string;
  license?: string;
  keywords?: string[];
}

export interface WallyPackageInfo {
  versions: Array<{
    package: {
      scope: string;
      name: string;
      version: string;
      registry?: string;
      realm?: string;
      description?: string;
      license?: string;
      authors?: string[];
      repository?: string;
      homepage?: string;
    };
    dependencies?: Record<string, any>;
    "server-dependencies"?: Record<string, any>;
    "dev-dependencies"?: Record<string, any>;
    place?: {
      shared_packages?: string;
      server_packages?: string;
    };
  }>;
}

export interface InstallOptions {
  dev?: boolean;
  save?: boolean;
}

export interface InitOptions {
  name?: string;
  description?: string;
}

export interface LockfileEntry {
  version: string;
  resolved: string;
  integrity?: string;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}

export interface JellyLockfile {
  lockfileVersion: number;
  name: string;
  version: string;
  packages: Record<string, LockfileEntry>;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}

export interface PublishOptions {
  token?: string;
  registry?: string;
  dryRun?: boolean;
}

export interface AuthTokenStore {
  token: string;
  expiresAt?: number;
}

export interface RegistryTokenStore {
  tokens: Record<string, AuthTokenStore>;
}

export interface RegistryConfig {
  api: string;
  api_url: string;
  github_oauth_id: string;
}

export interface DeviceCodeResponse {
  device_code: string;
  user_code: string;
  verification_uri: string;
  expires_in: number;
  interval: number;
}

export interface AccessTokenResponse {
  access_token: string;
  token_type: string;
  scope: string;
  error?: string;
  error_description?: string;
}

export interface WallyManifest {
  package: {
    name: string;
    version: string;
    registry?: string;
    realm?: 'shared' | 'server';
    description?: string;
    license?: string;
    authors?: string[];
    repository?: string;
    homepage?: string;
    private?: boolean;
    exclude?: string[];
  };
  dependencies?: Record<string, any>;
  'server-dependencies'?: Record<string, any>;
  'dev-dependencies'?: Record<string, any>;
  place?: {
    shared_packages?: string;
    server_packages?: string;
  };
}
