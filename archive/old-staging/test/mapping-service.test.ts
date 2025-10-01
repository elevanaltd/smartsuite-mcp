// TEST: MappingService collision detection and centralized loading
// TECHNICAL-ARCHITECT-APPROVED: TECHNICAL-ARCHITECT-20250909-9a54fa8a
// Context7: consulted for vitest
// Context7: consulted for path
// Context7: consulted for fs-extra
// Context7: consulted for os
import os from 'os';
import path from 'path';

import fs from 'fs-extra';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';


import { MappingService } from '../src/lib/mapping-service.js';

describe('MappingService', () => {
  let mappingService: MappingService;
  let tempDir: string;

  beforeEach(async () => {
    mappingService = new MappingService();
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'mapping-test-'));
  });

  afterEach(async () => {
    if (tempDir) {
      await fs.remove(tempDir);
    }
  });

  describe('collision detection', () => {
    it('should detect table name collisions across files', async () => {
      // Create two YAML files with same table name
      const yaml1 = `
tableName: projects
tableId: abc123def456789012345678
fields:
  name: field1
`;
      const yaml2 = `
tableName: Projects
tableId: def456789012345678abc123
fields:
  name: field2
`;
      await fs.writeFile(path.join(tempDir, 'file1.yaml'), yaml1);
      await fs.writeFile(path.join(tempDir, 'file2.yaml'), yaml2);

      await expect(mappingService.loadAllMappings(tempDir))
        .rejects.toThrow(/Duplicate table name 'Projects'/i);
    });

    it('should detect field name collisions within a table', async () => {
      const yaml = `
tableName: projects
tableId: abc123def456789012345678
fields:
  projectName: field1
  ProjectName: field2
  PROJECTNAME: field3
`;
      await fs.writeFile(path.join(tempDir, 'projects.yaml'), yaml);

      await expect(mappingService.loadAllMappings(tempDir))
        .rejects.toThrow(/Duplicate field name/i);
    });
  });

  describe('successful loading', () => {
    it('should load mappings and provide both translators', async () => {
      const yaml = `
tableName: projects
tableId: abc123def456789012345678
fields:
  projectName: proj_name_api
  status: status_field
`;
      await fs.writeFile(path.join(tempDir, 'projects.yaml'), yaml);

      await mappingService.loadAllMappings(tempDir);

      const tableResolver = mappingService.getTableResolver();
      const fieldTranslator = mappingService.getFieldTranslator();

      expect(tableResolver).toBeDefined();
      expect(fieldTranslator).toBeDefined();

      // Test table resolution
      expect(tableResolver.resolveTableId('projects')).toBe('abc123def456789012345678');

      // Test field translation
      const translated = fieldTranslator.humanToApi('abc123def456789012345678', {
        projectName: 'Test Project',
        status: 'active',
      });
      expect(translated).toEqual({
        proj_name_api: 'Test Project',
        status_field: 'active',
      });
    });
  });

  describe('validation completeness', () => {
    it('should validate all mappings before populating translators', async () => {
      const yaml1 = `
tableName: valid
tableId: abc123def456789012345678
fields:
  field1: api_field1
`;
      const yaml2 = `
tableName: invalid
tableId: not_a_valid_hex_id
fields:
  field2: api_field2
`;
      await fs.writeFile(path.join(tempDir, 'valid.yaml'), yaml1);
      await fs.writeFile(path.join(tempDir, 'invalid.yaml'), yaml2);

      await expect(mappingService.loadAllMappings(tempDir))
        .rejects.toThrow(/Invalid table ID/);

      // Ensure no partial loading occurred
      const tableResolver = mappingService.getTableResolver();
      expect(tableResolver.getAvailableTables()).toHaveLength(0);
    });
  });

  describe('getMappingStats', () => {
    it('should provide statistics about loaded mappings', async () => {
      const yaml1 = `
tableName: projects
tableId: abc123def456789012345678
fields:
  field1: api1
  field2: api2
`;
      const yaml2 = `
tableName: videos
tableId: def456789012345678abc123
fields:
  field3: api3
`;
      await fs.writeFile(path.join(tempDir, 'projects.yaml'), yaml1);
      await fs.writeFile(path.join(tempDir, 'videos.yaml'), yaml2);

      await mappingService.loadAllMappings(tempDir);
      const stats = mappingService.getMappingStats();

      expect(stats.tablesLoaded).toBe(2);
      expect(stats.totalFields).toBe(3);
      expect(stats.tables).toContain('projects');
      expect(stats.tables).toContain('videos');
    });
  });
});
