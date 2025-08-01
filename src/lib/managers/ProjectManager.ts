import * as fs from 'fs-extra';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import { RojoProject, JellyConfig } from '../../types';

const execAsync = promisify(exec);

export class ProjectManager {
  private projectPath: string;
  private rojoConfigPath: string;
  private jellyConfigPath: string;

  constructor(projectPath: string = process.cwd()) {
    this.projectPath = projectPath;
    this.rojoConfigPath = this.findRojoConfig();
    this.jellyConfigPath = path.join(this.projectPath, 'jelly.json');
  }

  private findRojoConfig(): string {
    // Look for common Rojo config file names
    const possibleNames = [
      'default.project.json',
      'project.json',
      'rojo.json'
    ];

    for (const name of possibleNames) {
      const configPath = path.join(this.projectPath, name);
      if (fs.existsSync(configPath)) {
        return configPath;
      }
    }

    // Default to default.project.json if none found
    return path.join(this.projectPath, 'default.project.json');
  }

  async readProject(): Promise<RojoProject> {
    if (!fs.existsSync(this.rojoConfigPath)) {
      throw new Error(`Rojo project file not found at ${this.rojoConfigPath}`);
    }

    try {
      const content = await fs.readFile(this.rojoConfigPath, 'utf-8');
      const project = JSON.parse(content) as RojoProject;
      return project;
    } catch (error) {
      throw new Error(`Failed to read project file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async readJellyConfig(): Promise<JellyConfig> {
    if (!fs.existsSync(this.jellyConfigPath)) {
      throw new Error(`Jelly config file not found at ${this.jellyConfigPath}`);
    }

    try {
      const content = await fs.readFile(this.jellyConfigPath, 'utf-8');
      const config = JSON.parse(content) as JellyConfig;
      
      // Ensure dependencies objects exist
      if (!config.dependencies) {
        config.dependencies = {};
      }
      if (!config.devDependencies) {
        config.devDependencies = {};
      }

      return config;
    } catch (error) {
      throw new Error(`Failed to read jelly config: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async writeProject(project: RojoProject): Promise<void> {
    try {
      // Ensure the directory exists
      await fs.ensureDir(path.dirname(this.rojoConfigPath));
      
      // Write with proper formatting
      const content = JSON.stringify(project, null, 2);
      await fs.writeFile(this.rojoConfigPath, content, 'utf-8');
    } catch (error) {
      throw new Error(`Failed to write project file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async writeJellyConfig(config: JellyConfig): Promise<void> {
    try {
      // Ensure the directory exists
      await fs.ensureDir(path.dirname(this.jellyConfigPath));
      
      // Write with proper formatting
      const content = JSON.stringify(config, null, 2);
      await fs.writeFile(this.jellyConfigPath, content, 'utf-8');
    } catch (error) {
      throw new Error(`Failed to write jelly config: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async addDependency(packageName: string, version: string, isDev: boolean = false): Promise<void> {
    const config = await this.readJellyConfig();
    
    if (isDev) {
      config.devDependencies[packageName] = version;
    } else {
      config.dependencies[packageName] = version;
    }

    await this.writeJellyConfig(config);
  }

  async removeDependency(packageName: string): Promise<void> {
    const config = await this.readJellyConfig();
    
    delete config.dependencies[packageName];
    delete config.devDependencies[packageName];

    await this.writeJellyConfig(config);
  }

  async createProject(options: { name?: string; description?: string } = {}): Promise<void> {
    const projectName = options.name || await this.getProjectName();
    const authorInfo = await this.getGitAuthor();
    
    // Create clean Rojo project file
    const rojoProject: RojoProject = {
      name: projectName,
      tree: {
        $className: "DataModel",
        ReplicatedStorage: {
          Shared: {
            $path: "src/shared"
          },
          Packages: {
            $path: "Packages"
          }
        },
        ServerScriptService: {
          Server: {
            $path: "src/server"
          }
        },
        StarterPlayer: {
          StarterPlayerScripts: {
            Client: {
              $path: "src/client"
            }
          }
        }
      }
    };

    // Create Jelly config file
    const jellyConfig: JellyConfig = {
      name: projectName,
      version: "0.1.0",
      description: options.description || `A Roblox project created with Jelly`,
      license: "MIT",
      authors: [authorInfo],
      realm: "shared",
      dependencies: {},
      devDependencies: {},
      scripts: {
        "build": "rojo build",
        "serve": "rojo serve",
        "build:release": "rojo build --output game.rbxl"
      },
      jelly: {
        cleanup: true,
        optimize: true,
        packagesPath: "Packages",
        updateProjectFile: true // Can be disabled by users who don't use Rojo or Argon
      }
    };

    // Create directory structure
    await fs.ensureDir(path.join(this.projectPath, 'src', 'shared'));
    await fs.ensureDir(path.join(this.projectPath, 'src', 'server'));
    await fs.ensureDir(path.join(this.projectPath, 'src', 'client'));

    // Create basic files
    await fs.writeFile(
      path.join(this.projectPath, 'src', 'shared', 'Hello.luau'),
      '-- This is a shared module\nlocal Hello = {}\n\nfunction Hello.sayHello(name: string): string\n\treturn "Hello, " .. name .. "!"\nend\n\nreturn Hello'
    );

    await fs.writeFile(
      path.join(this.projectPath, 'src', 'server', 'init.server.luau'),
      '-- Server script\nlocal Hello = require(game.ReplicatedStorage.Shared.Hello)\n\nprint(Hello.sayHello("Server"))'
    );

    await fs.writeFile(
      path.join(this.projectPath, 'src', 'client', 'init.client.luau'),
      '-- Client script\nlocal Hello = require(game.ReplicatedStorage.Shared.Hello)\n\nprint(Hello.sayHello("Client"))'
    );

    // Write both config files
    await this.writeProject(rojoProject);
    await this.writeJellyConfig(jellyConfig);
  }

  async createJellyConfig(options: { name?: string; description?: string } = {}): Promise<void> {
    const projectName = options.name || await this.getProjectName();
    const authorInfo = await this.getGitAuthor();
    
    // Create Jelly config file only
    const jellyConfig: JellyConfig = {
      name: projectName,
      version: "0.1.0",
      description: options.description || `A Roblox project managed with Jelly`,
      license: "MIT",
      authors: [authorInfo],
      realm: "shared",
      registry: "https://github.com/upliftgames/wally-index",
      include: [
        "README.md",
        "src/**",
        "default.project.json",
        "jelly.json"
      ],
      exclude: [],
      dependencies: {},
      devDependencies: {},
      scripts: {
        "build": "rojo build",
        "serve": "rojo serve",
        "build:release": "rojo build --output game.rbxl"
      },
      jelly: {
        cleanup: true,
        optimize: true,
        packagesPath: "Packages",
        updateProjectFile: true // Can be disabled by users who don't use Rojo
      }
    };

    await this.writeJellyConfig(jellyConfig);
  }

  /**
   * Get author information from git config
   */
  private async getGitAuthor(): Promise<string> {
    try {
      const { stdout: name } = await execAsync('git config user.name');
      const { stdout: email } = await execAsync('git config user.email');
      
      const authorName = name.trim();
      const authorEmail = email.trim();
      
      if (authorName && authorEmail) {
        return `${authorName} <${authorEmail}>`;
      } else if (authorName) {
        return authorName;
      } else {
        return 'Unknown Author';
      }
    } catch (error) {
      // Git not available or not configured
      return 'Unknown Author';
    }
  }

  /**
   * Get project name from directory or git config
   */
  private async getProjectName(): Promise<string> {
    try {
      // Try to get GitHub username from git config
      const { stdout: remoteUrl } = await execAsync('git config remote.origin.url');
      const match = remoteUrl.match(/github\.com[:/]([^/]+)\//);
      if (match) {
        const username = match[1];
        const dirName = path.basename(this.projectPath);
        return `${username}/${dirName.toLowerCase()}`;
      }
    } catch (error) {
      // Git not available or no remote configured
    }
    
    // Fallback to directory name
    const dirName = path.basename(this.projectPath);
    return `yourname/${dirName.toLowerCase()}`;
  }

  getProjectPath(): string {
    return this.projectPath;
  }

  getRojoConfigPath(): string {
    return this.rojoConfigPath;
  }

  getJellyConfigPath(): string {
    return this.jellyConfigPath;
  }

  async projectExists(): Promise<boolean> {
    return fs.existsSync(this.rojoConfigPath);
  }

  async jellyConfigExists(): Promise<boolean> {
    return fs.existsSync(this.jellyConfigPath);
  }
}
