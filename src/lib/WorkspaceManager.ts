import * as fs from 'fs-extra';
import * as path from 'path';
import { glob } from 'glob';
import { JellyConfig, WorkspaceInfo } from '../types';
import { ProjectManager } from './ProjectManager';

export class WorkspaceManager {
  private rootPath: string;
  private rootProjectManager: ProjectManager;

  constructor(rootPath: string = process.cwd()) {
    this.rootPath = rootPath;
    this.rootProjectManager = new ProjectManager(rootPath);
  }

  async isWorkspace(): Promise<boolean> {
    try {
      const config = await this.rootProjectManager.readJellyConfig();
      return !!config.workspaces;
    } catch {
      return false;
    }
  }

  async getWorkspaces(): Promise<WorkspaceInfo[]> {
    const config = await this.rootProjectManager.readJellyConfig();
    
    if (!config.workspaces) {
      throw new Error('No workspaces defined in root jelly.json');
    }

    const workspacePatterns = Array.isArray(config.workspaces) 
      ? config.workspaces 
      : config.workspaces.packages;

    const workspaces: WorkspaceInfo[] = [];

    // Add root workspace
    workspaces.push({
      name: config.name,
      path: this.rootPath,
      config,
      isRoot: true
    });

    // Find workspace packages
    for (const pattern of workspacePatterns) {
      const matches = await glob(pattern, {
        cwd: this.rootPath,
        absolute: true
      });

      for (const match of matches) {
        const matchPath = path.resolve(match);
        const stat = await fs.stat(matchPath).catch(() => null);
        
        if (!stat || !stat.isDirectory()) {
          continue;
        }

        try {
          const projectManager = new ProjectManager(matchPath);
          
          if (await projectManager.jellyConfigExists()) {
            const workspaceConfig = await projectManager.readJellyConfig();
            workspaces.push({
              name: workspaceConfig.name,
              path: matchPath,
              config: workspaceConfig,
              isRoot: false
            });
          }
        } catch (error) {
          // Skip invalid workspaces
          console.warn(`Warning: Invalid workspace at ${matchPath}`);
        }
      }
    }

    return workspaces;
  }

  async getWorkspaceByName(name: string): Promise<WorkspaceInfo | null> {
    const workspaces = await this.getWorkspaces();
    return workspaces.find(ws => ws.name === name) || null;
  }

  async getWorkspaceByPath(workspacePath: string): Promise<WorkspaceInfo | null> {
    const workspaces = await this.getWorkspaces();
    const normalizedPath = path.resolve(workspacePath);
    return workspaces.find(ws => path.resolve(ws.path) === normalizedPath) || null;
  }

  async createWorkspace(workspacePath: string, options: { name?: string } = {}): Promise<void> {
    const fullPath = path.resolve(this.rootPath, workspacePath);
    const workspaceName = options.name || path.basename(fullPath);

    // Ensure we're in a workspace root
    if (!(await this.isWorkspace())) {
      throw new Error('Not in a workspace root. Run "jelly workspace init" first.');
    }

    // Create workspace directory
    await fs.ensureDir(fullPath);

    // Create workspace project
    const projectManager = new ProjectManager(fullPath);
    await projectManager.createProject({ name: workspaceName });

    console.log(`📦 Created workspace: ${workspaceName} at ${workspacePath}`);
  }

  async initWorkspace(options: { name?: string } = {}): Promise<void> {
    const config = await this.rootProjectManager.readJellyConfig().catch(() => null);
    
    if (!config) {
      throw new Error('No jelly.json found. Run "jelly init" first.');
    }

    if (config.workspaces) {
      throw new Error('Already a workspace root.');
    }

    // Convert existing project to workspace root
    config.workspaces = ['packages/*', 'apps/*'];
    await this.rootProjectManager.writeJellyConfig(config);

    // Create workspace directories
    await fs.ensureDir(path.join(this.rootPath, 'packages'));
    await fs.ensureDir(path.join(this.rootPath, 'apps'));

    console.log('🏢 Initialized workspace root');
    console.log('📁 Created directories: packages/, apps/');
    console.log('💡 Add workspaces with: jelly workspace create <path>');
  }

  async listWorkspaces(): Promise<void> {
    const workspaces = await this.getWorkspaces();

    console.log('🏢 Workspace packages:\n');

    for (const workspace of workspaces) {
      const relativePath = path.relative(this.rootPath, workspace.path);
      const displayPath = relativePath || '.';
      
      if (workspace.isRoot) {
        console.log(`📦 ${workspace.name} (root)`);
        console.log(`   ${displayPath}`);
      } else {
        console.log(`📦 ${workspace.name}`);
        console.log(`   ${displayPath}`);
        
        // Show dependencies count
        const depCount = Object.keys(workspace.config.dependencies || {}).length;
        const devDepCount = Object.keys(workspace.config.devDependencies || {}).length;
        
        if (depCount > 0 || devDepCount > 0) {
          console.log(`   ${depCount} dependencies, ${devDepCount} devDependencies`);
        }
      }
      console.log();
    }

    console.log(`Total: ${workspaces.length} workspace(s)`);
  }

  async runInWorkspaces(
    command: (workspace: WorkspaceInfo) => Promise<void>,
    options: { filter?: string[]; exclude?: string[]; parallel?: boolean } = {}
  ): Promise<void> {
    const workspaces = await this.getWorkspaces();
    let targetWorkspaces = workspaces;

    // Apply filters
    if (options.filter && options.filter.length > 0) {
      targetWorkspaces = workspaces.filter(ws => 
        options.filter!.some(filter => 
          ws.name.includes(filter) || ws.path.includes(filter)
        )
      );
    }

    // Apply exclusions
    if (options.exclude && options.exclude.length > 0) {
      targetWorkspaces = targetWorkspaces.filter(ws =>
        !options.exclude!.some(exclude =>
          ws.name.includes(exclude) || ws.path.includes(exclude)
        )
      );
    }

    if (options.parallel) {
      // Run in parallel
      await Promise.all(targetWorkspaces.map(workspace => command(workspace)));
    } else {
      // Run sequentially
      for (const workspace of targetWorkspaces) {
        await command(workspace);
      }
    }
  }

  async installAllWorkspaces(options: { parallel?: boolean } = {}): Promise<void> {
    console.log('🏢 Installing dependencies for all workspaces...\n');

    await this.runInWorkspaces(async (workspace) => {
      console.log(`📦 Installing dependencies for ${workspace.name}...`);
      
      const { JellyManager } = await import('./JellyManager');
      const jelly = new JellyManager(workspace.path);
      await jelly.installAll();
      
      console.log(`✅ Completed ${workspace.name}\n`);
    }, options);

    console.log('🎉 All workspaces installed successfully!');
  }

  async addToWorkspace(workspaceName: string, packages: string[], options: { dev?: boolean } = {}): Promise<void> {
    const workspace = await this.getWorkspaceByName(workspaceName);
    
    if (!workspace) {
      throw new Error(`Workspace "${workspaceName}" not found`);
    }

    console.log(`📦 Adding packages to workspace: ${workspaceName}`);
    
    const { JellyManager } = await import('./JellyManager');
    const jelly = new JellyManager(workspace.path);
    await jelly.add(packages, options);
  }

  async runScriptInWorkspaces(
    scriptName: string, 
    args: string[] = [], 
    options: { filter?: string[]; exclude?: string[]; parallel?: boolean } = {}
  ): Promise<void> {
    console.log(`🏢 Running script "${scriptName}" in workspaces...\n`);

    await this.runInWorkspaces(async (workspace) => {
      const hasScript = workspace.config.scripts && workspace.config.scripts[scriptName];
      
      if (!hasScript) {
        console.log(`⏭️ Skipping ${workspace.name} (no "${scriptName}" script)`);
        return;
      }

      console.log(`📦 Running "${scriptName}" in ${workspace.name}...`);
      
      const { JellyManager } = await import('./JellyManager');
      const jelly = new JellyManager(workspace.path);
      await jelly.run(scriptName, args);
      
      console.log(`✅ Completed ${workspace.name}\n`);
    }, options);

    console.log(`🎉 Script "${scriptName}" completed in all workspaces!`);
  }

  async findWorkspaceRoot(startPath: string = process.cwd()): Promise<string | null> {
    let currentPath = path.resolve(startPath);
    
    while (currentPath !== path.dirname(currentPath)) {
      const projectManager = new ProjectManager(currentPath);
      
      try {
        const config = await projectManager.readJellyConfig();
        if (config.workspaces) {
          return currentPath;
        }
      } catch {
        // Continue searching up
      }
      
      currentPath = path.dirname(currentPath);
    }

    return null;
  }

  async getCurrentWorkspace(): Promise<WorkspaceInfo | null> {
    const workspaceRoot = await this.findWorkspaceRoot();
    
    if (!workspaceRoot) {
      return null;
    }

    const workspaceManager = new WorkspaceManager(workspaceRoot);
    return await workspaceManager.getWorkspaceByPath(process.cwd());
  }

  getRootPath(): string {
    return this.rootPath;
  }
}
