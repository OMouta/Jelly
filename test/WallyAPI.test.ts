import { WallyAPI } from '../src/lib/WallyAPI';

describe('WallyAPI', () => {
  describe('parsePackageName', () => {
    it('should parse scope/name format', () => {
      const result = WallyAPI.parsePackageName('roblox/roact');
      expect(result).toEqual({
        scope: 'roblox',
        name: 'roact',
        version: undefined
      });
    });

    it('should parse scope/name@version format', () => {
      const result = WallyAPI.parsePackageName('roblox/roact@1.4.0');
      expect(result).toEqual({
        scope: 'roblox',
        name: 'roact',
        version: '1.4.0'
      });
    });

    it('should parse scope/name@^version format', () => {
      const result = WallyAPI.parsePackageName('roblox/roact@^1.4.0');
      expect(result).toEqual({
        scope: 'roblox',
        name: 'roact',
        version: '^1.4.0'
      });
    });

    it('should throw error for invalid format', () => {
      expect(() => WallyAPI.parsePackageName('invalid-package')).toThrow(
        'Invalid package name format'
      );
    });
  });

  describe('formatPackageName', () => {
    it('should format without version', () => {
      const result = WallyAPI.formatPackageName('roblox', 'roact');
      expect(result).toBe('roblox/roact');
    });

    it('should format with version', () => {
      const result = WallyAPI.formatPackageName('roblox', 'roact', '1.4.0');
      expect(result).toBe('roblox/roact@1.4.0');
    });
  });
});
