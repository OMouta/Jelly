import { WorkspaceManager } from '../src/lib/WorkspaceManager';
import { ProjectManager } from '../src/lib/ProjectManager';
import { JellyConfig } from '../src/types';
import * as fs from 'fs-extra';
import * as path from 'path';
import * as os from 'os';

describe('WorkspaceManager', () => {
  let tempDir: string;
  let workspaceManager: WorkspaceManager;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'jelly-workspace-test-'));
    workspaceManager = new WorkspaceManager(tempDir);
  });

  afterEach(async () => {
    await fs.remove(tempDir);
  });

  describe('isWorkspace', () => {
    it('should return false when no jelly.json exists', async () => {
      const result = await workspaceManager.isWorkspace();
      expect(result).toBe(false);
    });

    it('should return false when jelly.json has no workspaces', async () => {
      const config: JellyConfig = {
        name: 'test-project',
        version: '1.0.0',
        dependencies: {},
        devDependencies: {}
      };

      const projectManager = new ProjectManager(tempDir);
      await projectManager.writeJellyConfig(config);

      const result = await workspaceManager.isWorkspace();
      expect(result).toBe(false);
    });

    it('should return true when jelly.json has workspaces', async () => {
      const config: JellyConfig = {
        name: 'test-workspace',
        version: '1.0.0',
        dependencies: {},
        devDependencies: {},
        workspaces: ['packages/*']
      };

      const projectManager = new ProjectManager(tempDir);
      await projectManager.writeJellyConfig(config);

      const result = await workspaceManager.isWorkspace();
      expect(result).toBe(true);
    });
  });

  describe('initWorkspace', () => {
    it('should convert existing project to workspace', async () => {
      // Create initial project
      const config: JellyConfig = {
        name: 'test-project',
        version: '1.0.0',
        dependencies: {},
        devDependencies: {}
      };

      const projectManager = new ProjectManager(tempDir);
      await projectManager.writeJellyConfig(config);

      // Initialize as workspace
      await workspaceManager.initWorkspace();

      // Check that it's now a workspace
      const isWorkspace = await workspaceManager.isWorkspace();
      expect(isWorkspace).toBe(true);

      // Check that workspace directories were created
      const packagesDir = path.join(tempDir, 'packages');
      const appsDir = path.join(tempDir, 'apps');
      
      expect(await fs.pathExists(packagesDir)).toBe(true);
      expect(await fs.pathExists(appsDir)).toBe(true);

      // Check that workspaces config was added
      const updatedConfig = await projectManager.readJellyConfig();
      expect(updatedConfig.workspaces).toEqual(['packages/*', 'apps/*']);
    });

    it('should throw error when no jelly.json exists', async () => {
      await expect(workspaceManager.initWorkspace()).rejects.toThrow('No jelly.json found');
    });

    it('should throw error when already a workspace', async () => {
      const config: JellyConfig = {
        name: 'test-workspace',
        version: '1.0.0',
        dependencies: {},
        devDependencies: {},
        workspaces: ['packages/*']
      };

      const projectManager = new ProjectManager(tempDir);
      await projectManager.writeJellyConfig(config);

      await expect(workspaceManager.initWorkspace()).rejects.toThrow('Already a workspace root');
    });
  });

  describe('createWorkspace', () => {
    beforeEach(async () => {
      // Set up workspace root
      const config: JellyConfig = {
        name: 'test-workspace',
        version: '1.0.0',
        dependencies: {},
        devDependencies: {},
        workspaces: ['packages/*']
      };

      const projectManager = new ProjectManager(tempDir);
      await projectManager.writeJellyConfig(config);
    });

    it('should create new workspace package', async () => {
      await workspaceManager.createWorkspace('packages/my-package', { name: 'my-package' });

      const workspacePath = path.join(tempDir, 'packages', 'my-package');
      expect(await fs.pathExists(workspacePath)).toBe(true);

      const workspaceConfigPath = path.join(workspacePath, 'jelly.json');
      expect(await fs.pathExists(workspaceConfigPath)).toBe(true);

      const projectManager = new ProjectManager(workspacePath);
      const config = await projectManager.readJellyConfig();
      expect(config.name).toBe('my-package');
    });

    it('should throw error when not in workspace root', async () => {
      const nonWorkspaceManager = new WorkspaceManager('/tmp/non-workspace');
      
      await expect(
        nonWorkspaceManager.createWorkspace('packages/test')
      ).rejects.toThrow('Not in a workspace root');
    });
  });

  describe('getWorkspaces', () => {
    beforeEach(async () => {
      // Set up workspace root
      const rootConfig: JellyConfig = {
        name: 'my-workspace',
        version: '1.0.0',
        dependencies: {},
        devDependencies: {},
        workspaces: ['packages/*', 'apps/*']
      };

      const projectManager = new ProjectManager(tempDir);
      await projectManager.writeJellyConfig(rootConfig);

      // Create workspace packages
      await fs.ensureDir(path.join(tempDir, 'packages', 'package-a'));
      await fs.ensureDir(path.join(tempDir, 'packages', 'package-b'));
      await fs.ensureDir(path.join(tempDir, 'apps', 'app-1'));

      // Create jelly.json files for workspaces
      const packageAManager = new ProjectManager(path.join(tempDir, 'packages', 'package-a'));
      await packageAManager.writeJellyConfig({
        name: 'package-a',
        version: '1.0.0',
        dependencies: {},
        devDependencies: {}
      });

      const packageBManager = new ProjectManager(path.join(tempDir, 'packages', 'package-b'));
      await packageBManager.writeJellyConfig({
        name: 'package-b',
        version: '1.0.0',
        dependencies: {},
        devDependencies: {}
      });

      const app1Manager = new ProjectManager(path.join(tempDir, 'apps', 'app-1'));
      await app1Manager.writeJellyConfig({
        name: 'app-1',
        version: '1.0.0',
        dependencies: {},
        devDependencies: {}
      });
    });

    it('should return all workspaces including root', async () => {
      const workspaces = await workspaceManager.getWorkspaces();
      
      expect(workspaces).toHaveLength(4); // root + 3 packages
      
      const workspaceNames = workspaces.map(ws => ws.name);
      expect(workspaceNames).toContain('my-workspace');
      expect(workspaceNames).toContain('package-a');
      expect(workspaceNames).toContain('package-b');
      expect(workspaceNames).toContain('app-1');

      const rootWorkspace = workspaces.find(ws => ws.isRoot);
      expect(rootWorkspace).toBeDefined();
      expect(rootWorkspace!.name).toBe('my-workspace');
    });
  });

  describe('getWorkspaceByName', () => {
    beforeEach(async () => {
      // Set up workspace with one package
      const rootConfig: JellyConfig = {
        name: 'my-workspace',
        version: '1.0.0',
        dependencies: {},
        devDependencies: {},
        workspaces: ['packages/*']
      };

      const projectManager = new ProjectManager(tempDir);
      await projectManager.writeJellyConfig(rootConfig);

      await fs.ensureDir(path.join(tempDir, 'packages', 'test-package'));
      const testPackageManager = new ProjectManager(path.join(tempDir, 'packages', 'test-package'));
      await testPackageManager.writeJellyConfig({
        name: 'test-package',
        version: '1.0.0',
        dependencies: {},
        devDependencies: {}
      });
    });

    it('should find workspace by name', async () => {
      const workspace = await workspaceManager.getWorkspaceByName('test-package');
      
      expect(workspace).toBeDefined();
      expect(workspace!.name).toBe('test-package');
      expect(workspace!.isRoot).toBe(false);
    });

    it('should return null for non-existent workspace', async () => {
      const workspace = await workspaceManager.getWorkspaceByName('non-existent');
      expect(workspace).toBeNull();
    });
  });

  describe('findWorkspaceRoot', () => {
    it('should find workspace root from nested directory', async () => {
      // Set up workspace
      const rootConfig: JellyConfig = {
        name: 'my-workspace',
        version: '1.0.0',
        dependencies: {},
        devDependencies: {},
        workspaces: ['packages/*']
      };

      const projectManager = new ProjectManager(tempDir);
      await projectManager.writeJellyConfig(rootConfig);

      // Create nested directory
      const nestedDir = path.join(tempDir, 'packages', 'some-package', 'src');
      await fs.ensureDir(nestedDir);

      // Find workspace root from nested directory
      const workspaceRoot = await workspaceManager.findWorkspaceRoot(nestedDir);
      
      expect(workspaceRoot).toBe(tempDir);
    });

    it('should return null when no workspace root found', async () => {
      const workspaceRoot = await workspaceManager.findWorkspaceRoot('/tmp/non-workspace');
      expect(workspaceRoot).toBeNull();
    });
  });
});
