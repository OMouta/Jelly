import * as fs from 'fs-extra';
import * as fsNative from 'fs';
import * as path from 'path';
import { RojoProject, JellyConfig } from '../types';

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
    // Use Bun's optimized file API if available, fallback to Node.js fs
    if (typeof Bun !== 'undefined' && Bun.file) {
      const file = Bun.file(this.rojoConfigPath);
      
      if (!(await file.exists())) {
        throw new Error(`Rojo project file not found at ${this.rojoConfigPath}`);
      }

      try {
        const project = await file.json() as RojoProject;
        return project;
      } catch (error) {
        throw new Error(`Failed to read project file: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    } else {
      // Fallback to fs-extra for Node.js compatibility
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
  }

  async readJellyConfig(): Promise<JellyConfig> {
    // Use Bun's optimized file API if available, fallback to Node.js fs
    if (typeof Bun !== 'undefined' && Bun.file) {
      const file = Bun.file(this.jellyConfigPath);
      
      if (!(await file.exists())) {
        throw new Error(`Jelly config file not found at ${this.jellyConfigPath}`);
      }

      try {
        const config = await file.json() as JellyConfig;
        
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
    } else {
      // Fallback to Node.js fs for compatibility
      if (!fsNative.existsSync(this.jellyConfigPath)) {
        throw new Error(`Jelly config file not found at ${this.jellyConfigPath}`);
      }

      try {
        const content = fsNative.readFileSync(this.jellyConfigPath, 'utf-8');
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
      
      // Use Bun's optimized file API if available, fallback to Node.js fs
      if (typeof Bun !== 'undefined' && Bun.write) {
        await Bun.write(this.jellyConfigPath, content);
      } else {
        // Fallback to fs-extra for Node.js compatibility
        await fs.writeFile(this.jellyConfigPath, content, 'utf-8');
      }
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

  async createProject(options: { name?: string } = {}): Promise<void> {
    const projectName = options.name || path.basename(this.projectPath);
    
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
      description: `A Roblox project created with Jelly`,
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
        packagesPath: "Packages"
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
    // Use Bun's optimized file API if available, fallback to Node.js fs
    if (typeof Bun !== 'undefined' && Bun.file) {
      const file = Bun.file(this.jellyConfigPath);
      return await file.exists();
    } else {
      // Fallback to Node.js fs for compatibility
      return fsNative.existsSync(this.jellyConfigPath);
    }
  }
}
