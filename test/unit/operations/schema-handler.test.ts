// Phoenix Test Contract: SCHEMA-001 to SCHEMA-004
// Contract: Schema retrieval with output formatting
// Status: RED (tests written, implementation pending)
// Source: coordination/phoenix-rebuild/001-D3-PHOENIX-REBUILD-BLUEPRINT.md
// TDD Phase: RED → Implementation will follow

import { describe, it, expect, vi, beforeEach } from 'vitest';

import type { SmartSuiteClient } from '../../../src/core/smartsuite-client.js';

describe('SchemaHandler', () => {
  let mockClient: SmartSuiteClient;

  beforeEach(() => {
    // Create mock SmartSuite client with all required methods
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
      addField: vi.fn(),
      updateField: vi.fn(),
    };
  });

  describe('SCHEMA-001: Retrieve table schema successfully', () => {
    it('should retrieve full schema with structure', async () => {
      // CONTRACT: Schema retrieval returns table metadata and field structure
      // CRITICAL: Direct passthrough to SmartSuiteClient.getSchema()

      // Arrange
      const { SchemaHandler } = await import('../../../src/operations/schema-handler.js');
      const tableId = '68a8ff5237fde0bf797c05b3'; // Primary test table
      const mockSchema = {
        id: tableId,
        name: 'Test Table',
        structure: [
          {
            slug: 'title',
            label: 'Title',
            field_type: 'textfield',
            params: { required: true },
          },
          {
            slug: 'status',
            label: 'Status',
            field_type: 'statusfield',
            params: { required: false },
          },
          {
            slug: 'description',
            label: 'Description',
            field_type: 'richtextareafield',
            params: { required: false },
          },
        ],
      };

      // Mock successful schema retrieval
      vi.mocked(mockClient.getSchema).mockResolvedValue(mockSchema);

      // Act
      const handler = new SchemaHandler();
      handler.setClient(mockClient);
      const result = await handler.execute({
        tableId,
        outputMode: 'detailed',
      });

      // Assert - Full schema returned
      expect(result).toBeDefined();
      expect(result).toHaveProperty('id', tableId);
      expect(result).toHaveProperty('name', 'Test Table');
      expect(result).toHaveProperty('structure');
      expect(Array.isArray((result as any).structure)).toBe(true);
      expect((result as any).structure).toHaveLength(3);

      // Assert - Client called correctly
      expect(mockClient.getSchema).toHaveBeenCalledWith(tableId);
      expect(mockClient.getSchema).toHaveBeenCalledTimes(1);
    });

    it('should handle empty schema structure', async () => {
      // CONTRACT: Handle tables with no fields defined (edge case)

      // Arrange
      const { SchemaHandler } = await import('../../../src/operations/schema-handler.js');
      const tableId = '68a8ff5237fde0bf797c05b3';
      const mockSchema = {
        id: tableId,
        name: 'Empty Table',
        structure: [],
      };

      vi.mocked(mockClient.getSchema).mockResolvedValue(mockSchema);

      // Act
      const handler = new SchemaHandler();
      handler.setClient(mockClient);
      const result = await handler.execute({
        tableId,
        outputMode: 'detailed',
      });

      // Assert
      expect(result).toHaveProperty('structure');
      expect((result as any).structure).toHaveLength(0);
    });
  });

  describe('SCHEMA-002: Return field definitions with types', () => {
    it('should format fields with types and labels in summary mode', async () => {
      // CONTRACT: Output formatting adapts to requested mode
      // Mode: summary = condensed field information

      // Arrange
      const { SchemaHandler } = await import('../../../src/operations/schema-handler.js');
      const tableId = '68a8ff5237fde0bf797c05b3';
      const mockSchema = {
        id: tableId,
        name: 'Test Table',
        structure: [
          { slug: 'field1', label: 'Field 1', field_type: 'textfield' },
          { slug: 'field2', label: 'Field 2', field_type: 'numberfield' },
          { slug: 'field3', label: 'Field 3', field_type: 'textfield' },
        ],
      };

      vi.mocked(mockClient.getSchema).mockResolvedValue(mockSchema);

      // Act
      const handler = new SchemaHandler();
      handler.setClient(mockClient);
      const result = await handler.execute({
        tableId,
        outputMode: 'summary',
      });

      // Assert - Summary format
      expect(result).toHaveProperty('id', tableId);
      expect(result).toHaveProperty('name', 'Test Table');
      expect(result).toHaveProperty('field_count', 3);
      expect(result).toHaveProperty('field_types');

      // Field type counts
      expect((result as any).field_types).toEqual({
        textfield: 2,
        numberfield: 1,
      });

      // Should NOT include full structure in summary mode
      expect(result).not.toHaveProperty('structure');
    });

    it('should format fields with required flags in fields mode', async () => {
      // CONTRACT: Fields mode shows detailed field info without full structure

      // Arrange
      const { SchemaHandler } = await import('../../../src/operations/schema-handler.js');
      const tableId = '68a8ff5237fde0bf797c05b3';
      const mockSchema = {
        id: tableId,
        name: 'Test Table',
        structure: [
          {
            slug: 'title',
            label: 'Title',
            field_type: 'textfield',
            params: { required: true },
          },
          {
            slug: 'description',
            label: 'Description',
            field_type: 'richtextareafield',
            params: { required: false },
          },
        ],
      };

      vi.mocked(mockClient.getSchema).mockResolvedValue(mockSchema);

      // Act
      const handler = new SchemaHandler();
      handler.setClient(mockClient);
      const result = await handler.execute({
        tableId,
        outputMode: 'fields',
      });

      // Assert - Fields format
      expect(result).toHaveProperty('id', tableId);
      expect(result).toHaveProperty('name', 'Test Table');
      expect(result).toHaveProperty('field_count', 2);
      expect(result).toHaveProperty('fields');
      expect(Array.isArray((result as any).fields)).toBe(true);

      // Field details
      expect((result as any).fields).toEqual([
        {
          slug: 'title',
          label: 'Title',
          field_type: 'textfield',
          required: true,
        },
        {
          slug: 'description',
          label: 'Description',
          field_type: 'richtextareafield',
          required: false,
        },
      ]);
    });

    it('should default to summary mode when outputMode not specified', async () => {
      // CONTRACT: Default behavior is summary mode

      // Arrange
      const { SchemaHandler } = await import('../../../src/operations/schema-handler.js');
      const tableId = '68a8ff5237fde0bf797c05b3';
      const mockSchema = {
        id: tableId,
        name: 'Test Table',
        structure: [
          { slug: 'field1', label: 'Field 1', field_type: 'textfield' },
        ],
      };

      vi.mocked(mockClient.getSchema).mockResolvedValue(mockSchema);

      // Act
      const handler = new SchemaHandler();
      handler.setClient(mockClient);
      const result = await handler.execute({
        tableId,
        // outputMode not specified
      });

      // Assert - Summary format by default
      expect(result).toHaveProperty('field_count', 1);
      expect(result).toHaveProperty('field_types');
      expect(result).not.toHaveProperty('structure');
    });
  });

  describe('SCHEMA-003: Handle invalid table ID errors', () => {
    it('should throw error for empty table ID', async () => {
      // CONTRACT: Fail fast for invalid input

      // Arrange
      const { SchemaHandler } = await import('../../../src/operations/schema-handler.js');

      // Act & Assert
      const handler = new SchemaHandler();
      handler.setClient(mockClient);
      await expect(
        handler.execute({
          tableId: '',
          outputMode: 'summary',
        }),
      ).rejects.toThrow(/table.*id.*required/i);
    });

    it('should propagate SmartSuite API errors gracefully', async () => {
      // CONTRACT: Handle upstream API errors with clear messages

      // Arrange
      const { SchemaHandler } = await import('../../../src/operations/schema-handler.js');
      const tableId = 'nonexistent-table-id';

      // Mock API error (404 not found)
      vi.mocked(mockClient.getSchema).mockRejectedValue(
        new Error('Resource not found (404): Table does not exist'),
      );

      // Act & Assert
      const handler = new SchemaHandler();
      handler.setClient(mockClient);
      await expect(
        handler.execute({
          tableId,
          outputMode: 'summary',
        }),
      ).rejects.toThrow(/not found|does not exist/i);
    });

    it('should handle network errors', async () => {
      // CONTRACT: Network failures should be identifiable

      // Arrange
      const { SchemaHandler } = await import('../../../src/operations/schema-handler.js');
      const tableId = '68a8ff5237fde0bf797c05b3';

      // Mock network error
      vi.mocked(mockClient.getSchema).mockRejectedValue(
        new Error('Network error: Failed to fetch'),
      );

      // Act & Assert
      const handler = new SchemaHandler();
      handler.setClient(mockClient);
      await expect(
        handler.execute({
          tableId,
          outputMode: 'summary',
        }),
      ).rejects.toThrow(/network/i);
    });
  });

  describe('SCHEMA-004: Format schema for readability', () => {
    it('should include human-readable field type counts', async () => {
      // CONTRACT: Summary mode provides field type distribution

      // Arrange
      const { SchemaHandler } = await import('../../../src/operations/schema-handler.js');
      const tableId = '68a8ff5237fde0bf797c05b3';
      const mockSchema = {
        id: tableId,
        name: 'Complex Table',
        structure: [
          { slug: 'title', label: 'Title', field_type: 'textfield' },
          { slug: 'subtitle', label: 'Subtitle', field_type: 'textfield' },
          { slug: 'count', label: 'Count', field_type: 'numberfield' },
          { slug: 'total', label: 'Total', field_type: 'numberfield' },
          { slug: 'status', label: 'Status', field_type: 'statusfield' },
          { slug: 'checklist', label: 'Checklist', field_type: 'checklistfield' },
          { slug: 'project', label: 'Project', field_type: 'linkedrecordfield' },
        ],
      };

      vi.mocked(mockClient.getSchema).mockResolvedValue(mockSchema);

      // Act
      const handler = new SchemaHandler();
      handler.setClient(mockClient);
      const result = await handler.execute({
        tableId,
        outputMode: 'summary',
      });

      // Assert - Readable field type distribution
      expect(result).toHaveProperty('field_types');
      expect((result as any).field_types).toEqual({
        textfield: 2,
        numberfield: 2,
        statusfield: 1,
        checklistfield: 1,
        linkedrecordfield: 1,
      });
    });

    it('should preserve original field order in detailed mode', async () => {
      // CONTRACT: Field order matters for form generation

      // Arrange
      const { SchemaHandler } = await import('../../../src/operations/schema-handler.js');
      const tableId = '68a8ff5237fde0bf797c05b3';
      const mockSchema = {
        id: tableId,
        name: 'Ordered Table',
        structure: [
          { slug: 'first', label: 'First Field', field_type: 'textfield' },
          { slug: 'second', label: 'Second Field', field_type: 'numberfield' },
          { slug: 'third', label: 'Third Field', field_type: 'statusfield' },
        ],
      };

      vi.mocked(mockClient.getSchema).mockResolvedValue(mockSchema);

      // Act
      const handler = new SchemaHandler();
      handler.setClient(mockClient);
      const result = await handler.execute({
        tableId,
        outputMode: 'detailed',
      });

      // Assert - Order preserved
      expect((result as any).structure[0]).toHaveProperty('slug', 'first');
      expect((result as any).structure[1]).toHaveProperty('slug', 'second');
      expect((result as any).structure[2]).toHaveProperty('slug', 'third');
    });
  });

  describe('Error boundary coverage', () => {
    it('should throw error when client not set', async () => {
      // CONTRACT: Fail fast if handler not properly configured

      // Arrange
      const { SchemaHandler } = await import('../../../src/operations/schema-handler.js');

      // Act & Assert
      const handler = new SchemaHandler();
      // Don't call setClient
      await expect(
        handler.execute({
          tableId: '68a8ff5237fde0bf797c05b3',
          outputMode: 'summary',
        }),
      ).rejects.toThrow(/client.*not.*set/i);
    });

    it('should throw error for invalid output mode', async () => {
      // CONTRACT: Validate output mode parameter

      // Arrange
      const { SchemaHandler } = await import('../../../src/operations/schema-handler.js');
      const tableId = '68a8ff5237fde0bf797c05b3';

      // Act & Assert
      const handler = new SchemaHandler();
      handler.setClient(mockClient);
      await expect(
        handler.execute({
          tableId,
          outputMode: 'invalid' as any,
        }),
      ).rejects.toThrow(/invalid.*output.*mode/i);
    });
  });
});
