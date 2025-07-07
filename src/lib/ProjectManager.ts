import * as fs from 'fs-extra';
import * as path from 'path';
import { RojoProject } from '../types';

export class ProjectManager {
  private projectPath: string;
  private rojoConfigPath: string;

  constructor(projectPath: string = process.cwd()) {
    this.projectPath = projectPath;
    this.rojoConfigPath = this.findRojoConfig();
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
      
      // Ensure dependencies object exists
      if (!project.dependencies) {
        project.dependencies = {};
      }
      if (!project.devDependencies) {
        project.devDependencies = {};
      }

      return project;
    } catch (error) {
      throw new Error(`Failed to read project file: ${error instanceof Error ? error.message : 'Unknown error'}`);
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

  async addDependency(packageName: string, version: string, isDev: boolean = false): Promise<void> {
    const project = await this.readProject();
    
    if (isDev) {
      project.devDependencies![packageName] = version;
    } else {
      project.dependencies![packageName] = version;
    }

    await this.writeProject(project);
  }

  async removeDependency(packageName: string): Promise<void> {
    const project = await this.readProject();
    
    delete project.dependencies![packageName];
    delete project.devDependencies![packageName];

    await this.writeProject(project);
  }

  async createProject(options: { name?: string } = {}): Promise<void> {
    const projectName = options.name || path.basename(this.projectPath);
    
    const defaultProject: RojoProject = {
      name: projectName,
      version: "0.1.0",
      description: `A Roblox project created with Jelly`,
      dependencies: {},
      devDependencies: {},
      tree: {
        $className: "DataModel",
        ReplicatedStorage: {
          Shared: {
            $path: "src/shared"
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

    await this.writeProject(defaultProject);
  }

  getProjectPath(): string {
    return this.projectPath;
  }

  getRojoConfigPath(): string {
    return this.rojoConfigPath;
  }

  async projectExists(): Promise<boolean> {
    return fs.existsSync(this.rojoConfigPath);
  }
}
