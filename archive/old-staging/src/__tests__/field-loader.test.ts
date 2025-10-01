/**
 * Tests for EnhancedFieldLoader - focusing on fs compatibility
 * These tests verify the field loader works with native fs modules in MCP environments
 */
// TESTGUARD-APPROVED: Complete Vitest migration with consistent API usage

// Context7: consulted for fs
import { promises as fs } from 'fs';
import { existsSync } from 'fs';
// Context7: consulted for path
import * as path from 'path';

// Context7: consulted for js-yaml
import * as yaml from 'js-yaml';
// Context7: consulted for vitest
import { describe, it, expect, beforeEach, vi } from 'vitest';

import { EnhancedFieldLoader } from '../field-loader.js';

// Mock fs modules
vi.mock('fs', () => ({
  existsSync: vi.fn(),
  promises: {
    readdir: vi.fn(),
    readFile: vi.fn(),
  },
}));

vi.mock('js-yaml');

const mockExistsSync = vi.mocked(existsSync);
const mockReaddir = vi.mocked(fs.readdir);
const mockReadFile = vi.mocked(fs.readFile);
const mockYamlLoad = vi.mocked(yaml.load);

describe('EnhancedFieldLoader', () => {
  let fieldLoader: EnhancedFieldLoader;

  beforeEach(() => {
    fieldLoader = new EnhancedFieldLoader();
    vi.clearAllMocks();
  });

  describe('loadMappingsWithFallback', () => {
    it('should handle directory existence check using native fs', async () => {
      // Arrange
      const baseDir = '/test/mappings';
      mockExistsSync.mockReturnValue(false);

      // Act
      const result = await fieldLoader.loadMappingsWithFallback(baseDir);

      // Assert
      expect(mockExistsSync).toHaveBeenCalledWith(baseDir);
      expect(result.source).toBe('none');
      expect(result.mappings.size).toBe(0);
      expect(result.warnings).toContain('No field mappings found in any location.');
    });

    it('should load local mappings when available', async () => {
      // Arrange
      const baseDir = '/test/mappings';
      const mockMapping = { field1: 'Field One', field2: 'Field Two' };
      mockExistsSync.mockReturnValue(true);
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
      mockReaddir.mockResolvedValue(['table1.yaml', 'table2.json'] as any);
      mockReadFile.mockResolvedValue('field1: Field One\nfield2: Field Two');
      mockYamlLoad.mockReturnValue(mockMapping);

      // Act
      const result = await fieldLoader.loadMappingsWithFallback(baseDir);

      // Assert
      expect(mockReaddir).toHaveBeenCalledWith(baseDir);
      expect(mockReadFile).toHaveBeenCalledWith(path.join(baseDir, 'table1.yaml'), 'utf8');
      expect(result.source).toBe('local');
      expect(result.mappings.size).toBe(1);
      expect(result.mappings.get('table1')).toEqual(mockMapping);
    });

    it('should fall back to examples when no local mappings exist', async () => {
      // Arrange
      const baseDir = '/test/mappings';
      const mockMapping = { field1: 'Example Field' };
      // Mock local directory doesn't exist
      mockExistsSync
        .mockReturnValueOnce(true)   // local dir exists
        .mockReturnValueOnce(true);  // examples dir exists
      // Local returns no YAML files, examples has files
      mockReaddir
        .mockResolvedValueOnce([])                                    // local: no .yaml files
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
        .mockResolvedValueOnce(['table1.example.yaml'] as any);      // examples: has .example.yaml
      mockReadFile.mockResolvedValue('field1: Example Field');
      mockYamlLoad.mockReturnValue(mockMapping);

      // Act
      const result = await fieldLoader.loadMappingsWithFallback(baseDir);

      // Assert
      expect(result.source).toBe('example');
      expect(result.mappings.get('table1')).toEqual(mockMapping);
      expect(result.warnings[0]).toContain('No local field mappings found');
    });

    it('should handle file read errors gracefully', async () => {
      // Arrange
      const baseDir = '/test/mappings';

      mockExistsSync.mockReturnValue(true);
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
      mockReaddir.mockResolvedValue(['corrupted.yaml'] as any);
      mockReadFile.mockRejectedValue(new Error('Permission denied'));

      // Act
      const result = await fieldLoader.loadMappingsWithFallback(baseDir);

      // Assert
      expect(result.source).toBe('none');
      expect(result.mappings.size).toBe(0);
    });
  });

  describe('getMappings', () => {
    it('should return empty map initially', () => {
      // Act
      const mappings = fieldLoader.getMappings();

      // Assert
      expect(mappings.size).toBe(0);
    });
  });

  describe('getSourcePath', () => {
    it('should return undefined for unknown table', () => {
      // Act
      const sourcePath = fieldLoader.getSourcePath('unknown');

      // Assert
      expect(sourcePath).toBeUndefined();
    });
  });
});
