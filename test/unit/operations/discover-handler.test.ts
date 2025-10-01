// Phoenix Test Contract: DISCOVER-001 to DISCOVER-004
// Contract: Field mapping discovery and table enumeration
// Status: RED (tests written, implementation pending)
// Source: coordination/phoenix-rebuild/001-D3-PHOENIX-REBUILD-BLUEPRINT.md
// TDD Phase: RED → Implementation will follow
// Note: DiscoverHandler is a thin facade over FieldTranslator

import { describe, it, expect, vi, beforeEach } from 'vitest';


import type { FieldTranslator } from '../../../src/core/field-translator.js';
import type { SmartSuiteClient } from '../../../src/core/smartsuite-client.js';

describe('DiscoverHandler', () => {
  let mockClient: SmartSuiteClient;
  let mockTranslator: FieldTranslator;

  beforeEach(() => {
    // Create mock SmartSuite client
    mockClient = {
      apiKey: 'test-key',
      workspaceId: 'test-workspace',
      listRecords: vi.fn(),
      getRecord: vi.fn(),
      countRecords: vi.fn(),
      createRecord: vi.fn(),
      updateRecord: vi.fn(),
      deleteRecord: vi.fn(),
      getSchema: vi.fn(),
      request: vi.fn(),
    };

    // Create mock FieldTranslator with discovery methods
    mockTranslator = {
      hasMappings: vi.fn(),
      loadMappingsForTable: vi.fn(),
      translateFields: vi.fn(),
      reverseTranslateFields: vi.fn(),
      resolveTableId: vi.fn(),
      getTableName: vi.fn(),
    } as unknown as FieldTranslator;
  });

  describe('DISCOVER-001: Get field mappings for a table', () => {
    it('should retrieve field mappings via FieldTranslator', async () => {
      // CONTRACT: Discover operation loads schema and exposes field mappings
      // CRITICAL: Delegates to FieldTranslator.loadMappingsForTable()

      // Arrange
      const { DiscoverHandler } = await import('../../../src/operations/discover-handler.js');
      const tableId = '68a8ff5237fde0bf797c05b3';

      // Mock schema structure that will be cached
      const mockSchema = {
        id: tableId,
        name: 'Test Table',
        structure: [
          { slug: 's6e3a9f8cd', label: 'Title', field_type: 'textfield' },
          { slug: 's8b2c1d4ef', label: 'Status', field_type: 'statusfield' },
          { slug: 's1a5f7g9hi', label: 'Description', field_type: 'richtextareafield' },
        ],
      };

      vi.mocked(mockClient.getSchema).mockResolvedValue(mockSchema);
      vi.mocked(mockTranslator.loadMappingsForTable).mockResolvedValue(undefined);

      // Act
      const handler = new DiscoverHandler();
      handler.setClient(mockClient);
      handler.setFieldTranslator(mockTranslator);

      const result = await handler.execute({
        operation: 'fields',
        tableId,
      });

      // Assert - Field mappings returned
      expect(result).toBeDefined();
      expect(result).toHaveProperty('tableId', tableId);
      expect(result).toHaveProperty('fields');
      expect(Array.isArray((result as any).fields)).toBe(true);

      // Assert - FieldTranslator called
      expect(mockTranslator.loadMappingsForTable).toHaveBeenCalledWith(tableId);
    });

    it('should include field slugs, labels, and types', async () => {
      // CONTRACT: Discovery output includes all field metadata

      // Arrange
      const { DiscoverHandler } = await import('../../../src/operations/discover-handler.js');
      const tableId = '68a8ff5237fde0bf797c05b3';

      const mockSchema = {
        id: tableId,
        name: 'Projects',
        structure: [
          { slug: 's6e3a9f8cd', label: 'Project Name', field_type: 'textfield' },
          { slug: 's8b2c1d4ef', label: 'Priority', field_type: 'statusfield' },
        ],
      };

      vi.mocked(mockClient.getSchema).mockResolvedValue(mockSchema);
      vi.mocked(mockTranslator.loadMappingsForTable).mockResolvedValue(undefined);

      // Act
      const handler = new DiscoverHandler();
      handler.setClient(mockClient);
      handler.setFieldTranslator(mockTranslator);

      const result = await handler.execute({
        operation: 'fields',
        tableId,
      });

      // Assert - Field metadata complete
      const fields = (result as any).fields;
      expect(fields).toHaveLength(2);
      expect(fields[0]).toHaveProperty('slug', 's6e3a9f8cd');
      expect(fields[0]).toHaveProperty('label', 'Project Name');
      expect(fields[0]).toHaveProperty('field_type', 'textfield');
    });

    it('should use cached mappings if available', async () => {
      // CONTRACT: Leverage FieldTranslator caching for performance

      // Arrange
      const { DiscoverHandler } = await import('../../../src/operations/discover-handler.js');
      const tableId = '68a8ff5237fde0bf797c05b3';

      // Simulate cached mappings
      vi.mocked(mockTranslator.hasMappings).mockReturnValue(true);

      const mockSchema = {
        id: tableId,
        name: 'Cached Table',
        structure: [
          { slug: 'field1', label: 'Field 1', field_type: 'textfield' },
        ],
      };

      vi.mocked(mockClient.getSchema).mockResolvedValue(mockSchema);
      vi.mocked(mockTranslator.loadMappingsForTable).mockResolvedValue(undefined);

      // Act
      const handler = new DiscoverHandler();
      handler.setClient(mockClient);
      handler.setFieldTranslator(mockTranslator);

      const result = await handler.execute({
        operation: 'fields',
        tableId,
      });

      // Assert - Cache check performed
      expect(mockTranslator.hasMappings).toHaveBeenCalledWith(tableId);
      expect(result).toBeDefined();
    });
  });

  describe('DISCOVER-002: Resolve table name to ID', () => {
    it('should resolve table display name via FieldTranslator', async () => {
      // CONTRACT: Support table discovery by name

      // Arrange
      const { DiscoverHandler } = await import('../../../src/operations/discover-handler.js');
      const tableName = 'Projects';
      const tableId = '68a8ff5237fde0bf797c05b3';

      vi.mocked(mockTranslator.resolveTableId).mockResolvedValue(tableId);

      const mockSchema = {
        id: tableId,
        name: tableName,
        structure: [],
      };

      vi.mocked(mockClient.getSchema).mockResolvedValue(mockSchema);
      vi.mocked(mockTranslator.loadMappingsForTable).mockResolvedValue(undefined);

      // Act
      const handler = new DiscoverHandler();
      handler.setClient(mockClient);
      handler.setFieldTranslator(mockTranslator);

      const result = await handler.execute({
        operation: 'fields',
        tableName,
      });

      // Assert - Table resolved by name
      expect(mockTranslator.resolveTableId).toHaveBeenCalledWith(tableName);
      expect(result).toHaveProperty('tableId', tableId);
      expect(result).toHaveProperty('tableName', tableName);
    });

    it('should handle case-insensitive table name matching', async () => {
      // CONTRACT: Table resolution is case-insensitive

      // Arrange
      const { DiscoverHandler } = await import('../../../src/operations/discover-handler.js');
      const tableName = 'PROJECTS'; // Uppercase
      const tableId = '68a8ff5237fde0bf797c05b3';

      vi.mocked(mockTranslator.resolveTableId).mockResolvedValue(tableId);

      const mockSchema = {
        id: tableId,
        name: 'Projects', // Mixed case in schema
        structure: [],
      };

      vi.mocked(mockClient.getSchema).mockResolvedValue(mockSchema);
      vi.mocked(mockTranslator.loadMappingsForTable).mockResolvedValue(undefined);

      // Act
      const handler = new DiscoverHandler();
      handler.setClient(mockClient);
      handler.setFieldTranslator(mockTranslator);

      const result = await handler.execute({
        operation: 'fields',
        tableName,
      });

      // Assert - Case handled correctly
      expect(mockTranslator.resolveTableId).toHaveBeenCalledWith(tableName);
      expect(result).toBeDefined();
    });
  });

  describe('DISCOVER-003: Get table name from ID', () => {
    it('should retrieve table metadata with name', async () => {
      // CONTRACT: Discovery includes table metadata

      // Arrange
      const { DiscoverHandler } = await import('../../../src/operations/discover-handler.js');
      const tableId = '68a8ff5237fde0bf797c05b3';
      const tableName = 'Projects';

      const mockSchema = {
        id: tableId,
        name: tableName,
        structure: [
          { slug: 'field1', label: 'Field 1', field_type: 'textfield' },
        ],
      };

      vi.mocked(mockClient.getSchema).mockResolvedValue(mockSchema);
      vi.mocked(mockTranslator.loadMappingsForTable).mockResolvedValue(undefined);

      // Act
      const handler = new DiscoverHandler();
      handler.setClient(mockClient);
      handler.setFieldTranslator(mockTranslator);

      const result = await handler.execute({
        operation: 'fields',
        tableId,
      });

      // Assert - Table name included
      expect(result).toHaveProperty('tableId', tableId);
      expect(result).toHaveProperty('tableName', tableName);
    });
  });

  describe('DISCOVER-004: Handle unknown table errors', () => {
    it('should throw clear error for unknown table ID', async () => {
      // CONTRACT: Fail fast for invalid table references

      // Arrange
      const { DiscoverHandler } = await import('../../../src/operations/discover-handler.js');
      const tableId = 'nonexistent-table-id';

      // Mock API error
      vi.mocked(mockClient.getSchema).mockRejectedValue(
        new Error('Resource not found (404): Table does not exist'),
      );
      vi.mocked(mockTranslator.loadMappingsForTable).mockRejectedValue(
        new Error('Failed to load schema for table nonexistent-table-id: Resource not found'),
      );

      // Act & Assert
      const handler = new DiscoverHandler();
      handler.setClient(mockClient);
      handler.setFieldTranslator(mockTranslator);

      await expect(
        handler.execute({
          operation: 'fields',
          tableId,
        }),
      ).rejects.toThrow(/not found|does not exist/i);
    });

    it('should throw error for unknown table name', async () => {
      // CONTRACT: Table name resolution failures are clear

      // Arrange
      const { DiscoverHandler } = await import('../../../src/operations/discover-handler.js');
      const tableName = 'NonExistentTable';

      // Mock resolution failure
      vi.mocked(mockTranslator.resolveTableId).mockRejectedValue(
        new Error(`Unknown table: ${tableName} not found in workspace`),
      );

      // Act & Assert
      const handler = new DiscoverHandler();
      handler.setClient(mockClient);
      handler.setFieldTranslator(mockTranslator);

      await expect(
        handler.execute({
          operation: 'fields',
          tableName,
        }),
      ).rejects.toThrow(/unknown table|not found/i);
    });

    it('should throw error for empty table ID', async () => {
      // CONTRACT: Validate input parameters

      // Arrange
      const { DiscoverHandler } = await import('../../../src/operations/discover-handler.js');

      // Act & Assert
      const handler = new DiscoverHandler();
      handler.setClient(mockClient);
      handler.setFieldTranslator(mockTranslator);

      await expect(
        handler.execute({
          operation: 'fields',
          tableId: '',
        }),
      ).rejects.toThrow(/table.*id.*required|cannot.*be.*empty/i);
    });

    it('should throw error when neither tableId nor tableName provided', async () => {
      // CONTRACT: Require table identifier

      // Arrange
      const { DiscoverHandler } = await import('../../../src/operations/discover-handler.js');

      // Act & Assert
      const handler = new DiscoverHandler();
      handler.setClient(mockClient);
      handler.setFieldTranslator(mockTranslator);

      await expect(
        handler.execute({
          operation: 'fields',
          // No tableId or tableName
        }),
      ).rejects.toThrow(/table.*id.*name.*required/i);
    });
  });

  describe('Error boundary coverage', () => {
    it('should throw error when client not set', async () => {
      // CONTRACT: Fail fast if handler not properly configured

      // Arrange
      const { DiscoverHandler } = await import('../../../src/operations/discover-handler.js');

      // Act & Assert
      const handler = new DiscoverHandler();
      handler.setFieldTranslator(mockTranslator);
      // Don't call setClient

      await expect(
        handler.execute({
          operation: 'fields',
          tableId: '68a8ff5237fde0bf797c05b3',
        }),
      ).rejects.toThrow(/client.*not.*set/i);
    });

    it('should throw error when FieldTranslator not set', async () => {
      // CONTRACT: Fail fast if dependencies not configured

      // Arrange
      const { DiscoverHandler } = await import('../../../src/operations/discover-handler.js');

      // Act & Assert
      const handler = new DiscoverHandler();
      handler.setClient(mockClient);
      // Don't call setFieldTranslator

      await expect(
        handler.execute({
          operation: 'fields',
          tableId: '68a8ff5237fde0bf797c05b3',
        }),
      ).rejects.toThrow(/translator.*not.*set/i);
    });

    it('should throw error for invalid operation', async () => {
      // CONTRACT: Validate operation parameter

      // Arrange
      const { DiscoverHandler } = await import('../../../src/operations/discover-handler.js');

      // Act & Assert
      const handler = new DiscoverHandler();
      handler.setClient(mockClient);
      handler.setFieldTranslator(mockTranslator);

      await expect(
        handler.execute({
          operation: 'invalid' as any,
          tableId: '68a8ff5237fde0bf797c05b3',
        }),
      ).rejects.toThrow(/invalid.*operation/i);
    });
  });
});
