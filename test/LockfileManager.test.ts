import { LockfileManager } from '../src/lib/LockfileManager';
import { JellyConfig } from '../src/types';
import * as fs from 'fs-extra';
import * as path from 'path';
import * as os from 'os';

describe('LockfileManager', () => {
  let tempDir: string;
  let lockfileManager: LockfileManager;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'jelly-test-'));
    lockfileManager = new LockfileManager(tempDir);
  });

  afterEach(async () => {
    await fs.remove(tempDir);
  });

  describe('readLockfile', () => {
    it('should return null when lockfile does not exist', async () => {
      const result = await lockfileManager.readLockfile();
      expect(result).toBeNull();
    });

    it('should read valid lockfile', async () => {
      const mockLockfile = {
        lockfileVersion: 1,
        name: 'test-project',
        version: '1.0.0',
        packages: {
          'roblox/roact': {
            version: '1.4.0',
            resolved: 'https://api.wally.run/v1/package-contents/roblox/roact/1.4.0',
            dependencies: {}
          }
        },
        dependencies: { 'roblox/roact': '^1.4.0' },
        devDependencies: {}
      };

      await fs.writeFile(
        lockfileManager.getLockfilePath(),
        JSON.stringify(mockLockfile, null, 2)
      );

      const result = await lockfileManager.readLockfile();
      expect(result).toEqual(mockLockfile);
    });

    it('should return null for invalid lockfile format', async () => {
      await fs.writeFile(
        lockfileManager.getLockfilePath(),
        'invalid json'
      );

      const result = await lockfileManager.readLockfile();
      expect(result).toBeNull();
    });
  });

  describe('writeLockfile', () => {
    it('should write lockfile to disk', async () => {
      const mockLockfile = {
        lockfileVersion: 1,
        name: 'test-project',
        version: '1.0.0',
        packages: {},
        dependencies: {},
        devDependencies: {}
      };

      await lockfileManager.writeLockfile(mockLockfile);

      const exists = await fs.pathExists(lockfileManager.getLockfilePath());
      expect(exists).toBe(true);

      const content = await fs.readFile(lockfileManager.getLockfilePath(), 'utf-8');
      const parsed = JSON.parse(content);
      expect(parsed).toEqual(mockLockfile);
    });
  });

  describe('validateLockfile', () => {
    it('should return false when lockfile does not exist', async () => {
      const config: JellyConfig = {
        name: 'test',
        version: '1.0.0',
        dependencies: { 'roblox/roact': '^1.4.0' },
        devDependencies: {}
      };

      const result = await lockfileManager.validateLockfile(config);
      expect(result).toBe(false);
    });

    it('should return true when lockfile matches config', async () => {
      const config: JellyConfig = {
        name: 'test',
        version: '1.0.0',
        dependencies: { 'roblox/roact': '^1.4.0' },
        devDependencies: {}
      };

      const lockfile = {
        lockfileVersion: 1,
        name: 'test',
        version: '1.0.0',
        packages: {
          'roblox/roact': {
            version: '1.4.0',
            resolved: 'https://api.wally.run/v1/package-contents/roblox/roact/1.4.0',
            dependencies: {}
          }
        },
        dependencies: { 'roblox/roact': '^1.4.0' },
        devDependencies: {}
      };

      await lockfileManager.writeLockfile(lockfile);
      const result = await lockfileManager.validateLockfile(config);
      expect(result).toBe(true);
    });
  });

  describe('lockfileExists', () => {
    it('should return false when lockfile does not exist', async () => {
      const result = await lockfileManager.lockfileExists();
      expect(result).toBe(false);
    });

    it('should return true when lockfile exists', async () => {
      const lockfile = {
        lockfileVersion: 1,
        name: 'test',
        version: '1.0.0',
        packages: {},
        dependencies: {},
        devDependencies: {}
      };

      await lockfileManager.writeLockfile(lockfile);
      const result = await lockfileManager.lockfileExists();
      expect(result).toBe(true);
    });
  });

  describe('deleteLockfile', () => {
    it('should delete existing lockfile', async () => {
      const lockfile = {
        lockfileVersion: 1,
        name: 'test',
        version: '1.0.0',
        packages: {},
        dependencies: {},
        devDependencies: {}
      };

      await lockfileManager.writeLockfile(lockfile);
      expect(await lockfileManager.lockfileExists()).toBe(true);

      await lockfileManager.deleteLockfile();
      expect(await lockfileManager.lockfileExists()).toBe(false);
    });

    it('should not throw when deleting non-existent lockfile', async () => {
      await expect(lockfileManager.deleteLockfile()).resolves.not.toThrow();
    });
  });
});
