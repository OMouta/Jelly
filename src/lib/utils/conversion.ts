import * as fs from 'fs-extra';
import * as path from 'path';
import { JellyConfig } from '../../types';
import { parse, stringify } from 'smol-toml';

interface TomlParser {
  parse(content: string): any;
  stringify(obj: any): string;
}

// TOML parser using smol-toml
const toml: TomlParser = {
  parse: (content: string) => {
    return parse(content);
  },
  stringify: (obj: any) => {
    return stringify(obj);
  }
};

export interface WallyToml {
  package: {
    name: string;
    description?: string;
    version: string;
    license?: string;
    authors?: string[];
    realm?: 'shared' | 'server';
    registry?: string;
    homepage?: string;
    repository?: string;
    include?: string[];
    exclude?: string[];
    private?: boolean;
  };
  dependencies?: Record<string, string>;
  'server-dependencies'?: Record<string, string>;
  'dev-dependencies'?: Record<string, string>;
}

/**
 * Convert wally.toml to jelly.json format
 */
export function wallyTomlToJellyJson(wallyConfig: WallyToml): JellyConfig {
  const jellyConfig: JellyConfig = {
    name: wallyConfig.package.name,
    version: wallyConfig.package.version,
    dependencies: wallyConfig.dependencies || {},
    devDependencies: wallyConfig['dev-dependencies'] || {},
  };

  // Optional fields
  if (wallyConfig.package.description) {
    jellyConfig.description = wallyConfig.package.description;
  }
  
  if (wallyConfig.package.license) {
    jellyConfig.license = wallyConfig.package.license;
  }
  
  if (wallyConfig.package.authors) {
    jellyConfig.authors = wallyConfig.package.authors;
  }
  
  if (wallyConfig.package.realm) {
    jellyConfig.realm = wallyConfig.package.realm;
  }
  
  if (wallyConfig.package.registry) {
    jellyConfig.registry = wallyConfig.package.registry;
  }
  
  if (wallyConfig.package.homepage) {
    jellyConfig.homepage = wallyConfig.package.homepage;
  }
  
  if (wallyConfig.package.repository) {
    jellyConfig.repository = wallyConfig.package.repository;
  }
  
  if (wallyConfig.package.include) {
    jellyConfig.include = wallyConfig.package.include;
  }
  
  if (wallyConfig.package.exclude) {
    jellyConfig.exclude = wallyConfig.package.exclude;
  }
  
  if (wallyConfig.package.private) {
    jellyConfig.private = wallyConfig.package.private;
  }
  
  if (wallyConfig['server-dependencies']) {
    jellyConfig.serverDependencies = wallyConfig['server-dependencies'];
  }

  return jellyConfig;
}

/**
 * Convert jelly.json to wally.toml format
 */
export function jellyJsonToWallyToml(jellyConfig: JellyConfig): WallyToml {
  const wallyConfig: WallyToml = {
    package: {
      name: jellyConfig.name,
      version: jellyConfig.version,
    },
  };

  // Optional fields
  if (jellyConfig.description) {
    wallyConfig.package.description = jellyConfig.description;
  }
  
  if (jellyConfig.license) {
    wallyConfig.package.license = jellyConfig.license;
  }
  
  if (jellyConfig.authors) {
    wallyConfig.package.authors = jellyConfig.authors;
  }
  
  if (jellyConfig.realm) {
    wallyConfig.package.realm = jellyConfig.realm;
  }
  
  if (jellyConfig.registry) {
    wallyConfig.package.registry = jellyConfig.registry;
  }
  
  if (jellyConfig.homepage) {
    wallyConfig.package.homepage = jellyConfig.homepage;
  }
  
  if (jellyConfig.repository) {
    wallyConfig.package.repository = jellyConfig.repository;
  }
  
  if (jellyConfig.include) {
    wallyConfig.package.include = jellyConfig.include;
  }
  
  if (jellyConfig.exclude) {
    wallyConfig.package.exclude = jellyConfig.exclude;
  }
  
  if (jellyConfig.private) {
    wallyConfig.package.private = jellyConfig.private;
  }

  // Dependencies
  if (Object.keys(jellyConfig.dependencies).length > 0) {
    wallyConfig.dependencies = jellyConfig.dependencies;
  }
  
  if (jellyConfig.devDependencies && Object.keys(jellyConfig.devDependencies).length > 0) {
    wallyConfig['dev-dependencies'] = jellyConfig.devDependencies;
  }
  
  if (jellyConfig.serverDependencies && Object.keys(jellyConfig.serverDependencies).length > 0) {
    wallyConfig['server-dependencies'] = jellyConfig.serverDependencies;
  }

  return wallyConfig;
}

/**
 * Read and parse wally.toml file
 */
export async function readWallyToml(filePath: string): Promise<WallyToml> {
  const content = await fs.readFile(filePath, 'utf-8');
  return toml.parse(content) as WallyToml;
}

/**
 * Write wally.toml file
 */
export async function writeWallyToml(filePath: string, config: WallyToml): Promise<void> {
  const content = toml.stringify(config);
  await fs.writeFile(filePath, content);
}

/**
 * Read and parse jelly.json file
 */
export async function readJellyJson(filePath: string): Promise<JellyConfig> {
  return await fs.readJson(filePath);
}

/**
 * Write jelly.json file
 */
export async function writeJellyJson(filePath: string, config: JellyConfig): Promise<void> {
  await fs.writeJson(filePath, config, { spaces: 2 });
}

/**
 * Convert wally.toml file to jelly.json
 */
export async function convertWallyTomlToJellyJson(inputPath: string, outputPath: string): Promise<void> {
  const wallyConfig = await readWallyToml(inputPath);
  const jellyConfig = wallyTomlToJellyJson(wallyConfig);
  await writeJellyJson(outputPath, jellyConfig);
}

/**
 * Convert jelly.json file to wally.toml
 */
export async function convertJellyJsonToWallyToml(inputPath: string, outputPath: string): Promise<void> {
  const jellyConfig = await readJellyJson(inputPath);
  const wallyConfig = jellyJsonToWallyToml(jellyConfig);
  await writeWallyToml(outputPath, wallyConfig);
}
