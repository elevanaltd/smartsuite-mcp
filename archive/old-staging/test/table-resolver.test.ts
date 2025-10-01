// Context7: consulted for vitest
// Context7: consulted for path
import * as path from 'path';

import { describe, it, expect, beforeEach } from 'vitest';

import { TableResolver } from '../src/lib/table-resolver.js';

describe('TableResolver', () => {
  let resolver: TableResolver;
  let testMappingsDir: string;

  beforeEach(async () => {
    resolver = new TableResolver();
    // Determine the appropriate directory based on environment
    const baseDir = path.resolve(__dirname, '../config/field-mappings');
    const examplesDir = path.resolve(__dirname, '../config/field-mappings/examples');

    // Check if base directory has YAML files (excluding examples subdirectory)
    const fs = await import('fs-extra');
    let hasMainDirFiles = false;

    try {
      if (await fs.pathExists(baseDir)) {
        const files = await fs.readdir(baseDir);
        hasMainDirFiles = files.some(f => (f.endsWith('.yaml') || f.endsWith('.yml')) && !f.includes('example'));
      }
    } catch {
      // Ignore errors
    }

    // Use main directory if it has YAML files, otherwise use examples
    testMappingsDir = hasMainDirFiles ? baseDir : examplesDir;
  });

  describe('loadFromMappings', () => {
    it('should load table mappings from YAML files', async () => {
      await resolver.loadFromMappings(testMappingsDir);

      // Should have loaded at least one mapping
      const tables = resolver.getAvailableTables();
      expect(tables.length).toBeGreaterThan(0);
    });

    it('should extract tableName and tableId from YAML files', async () => {
      await resolver.loadFromMappings(testMappingsDir);

      const tables = resolver.getAvailableTables();
      const projectsTable = tables.find(t => t.name === 'projects');

      expect(projectsTable).toBeDefined();
      expect(projectsTable?.id).toBe('68a8ff5237fde0bf797c05b3');
      expect(projectsTable?.solutionId).toBe('68b6d66b33630eb365ae54cb');
    });

    it('should throw error if directory does not exist', async () => {
      const invalidDir = '/nonexistent/directory';

      await expect(resolver.loadFromMappings(invalidDir))
        .rejects
        .toThrow(/Failed to load mappings from directory/);
    });

    it('should throw error if no YAML files found', async () => {
      const emptyDir = path.resolve(__dirname, '../test/fixtures/empty');

      // Create empty directory for test
      const fs = await import('fs-extra');
      await fs.ensureDir(emptyDir);

      await expect(resolver.loadFromMappings(emptyDir))
        .rejects
        .toThrow(/No YAML mapping files found/);

      // Clean up
      await fs.remove(emptyDir);
    });
  });

  describe('resolveTableId', () => {
    beforeEach(async () => {
      await resolver.loadFromMappings(testMappingsDir);
    });

    it('should resolve table name to table ID', () => {
      const tableId = resolver.resolveTableId('projects');
      expect(tableId).toBe('68a8ff5237fde0bf797c05b3');
    });

    it('should return original value if it looks like a table ID (24-char hex)', () => {
      const hexId = '68a8ff5237fde0bf797c05b3';
      const result = resolver.resolveTableId(hexId);
      expect(result).toBe(hexId);
    });

    it('should be case-insensitive for table names', () => {
      const tableId1 = resolver.resolveTableId('projects');
      const tableId2 = resolver.resolveTableId('Projects');
      const tableId3 = resolver.resolveTableId('PROJECTS');

      expect(tableId1).toBe(tableId2);
      expect(tableId2).toBe(tableId3);
    });

    it('should return null for unknown table names', () => {
      const result = resolver.resolveTableId('nonexistent_table');
      expect(result).toBeNull();
    });
  });

  describe('getAvailableTables', () => {
    it('should return empty array when no mappings loaded', () => {
      const tables = resolver.getAvailableTables();
      expect(tables).toEqual([]);
    });

    it('should return all loaded table mappings', async () => {
      await resolver.loadFromMappings(testMappingsDir);

      const tables = resolver.getAvailableTables();

      expect(tables.length).toBeGreaterThan(0);
      expect(tables[0]).toHaveProperty('name');
      expect(tables[0]).toHaveProperty('id');
      expect(tables[0]).toHaveProperty('solutionId');
    });
  });

  describe('getTableByName', () => {
    beforeEach(async () => {
      await resolver.loadFromMappings(testMappingsDir);
    });

    it('should return table info for valid table name', () => {
      const table = resolver.getTableByName('projects');

      expect(table).toBeDefined();
      expect(table?.name).toBe('projects');
      expect(table?.id).toBe('68a8ff5237fde0bf797c05b3');
      expect(table?.solutionId).toBe('68b6d66b33630eb365ae54cb');
    });

    it('should return null for unknown table name', () => {
      const table = resolver.getTableByName('unknown_table');
      expect(table).toBeNull();
    });

    it('should be case-insensitive', () => {
      const table1 = resolver.getTableByName('projects');
      const table2 = resolver.getTableByName('PROJECTS');

      expect(table1).toEqual(table2);
    });
  });

  describe('getSuggestionsForUnknown', () => {
    beforeEach(async () => {
      await resolver.loadFromMappings(testMappingsDir);
    });

    it('should suggest similar table names for typos', () => {
      const suggestions = resolver.getSuggestionsForUnknown('project'); // Missing 's'

      expect(suggestions).toContain('projects');
    });

    it('should return empty array for completely unrelated names', () => {
      const suggestions = resolver.getSuggestionsForUnknown('xyz123');

      expect(suggestions).toEqual([]);
    });

    it('should handle partial matches', () => {
      const suggestions = resolver.getSuggestionsForUnknown('proj');

      expect(suggestions).toContain('projects');
    });
  });
});
