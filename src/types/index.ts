export interface RojoProject {
  name: string;
  version?: string;
  description?: string;
  tree: {
    $className: string;
    [key: string]: any;
  };
}

export interface JellyConfig {
  name: string;
  version: string;
  description?: string;
  dependencies: Record<string, string>;
  devDependencies: Record<string, string>;
  scripts?: Record<string, string>;
  jelly?: {
    cleanup?: boolean;
    optimize?: boolean;
    packagesPath?: string;
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
