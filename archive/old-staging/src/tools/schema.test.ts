// Test-Methodology-Guardian: approved TDD RED-GREEN-REFACTOR cycle
// Critical-Engineer: consulted for schema caching patterns
// Context7: consulted for vitest

// Context7: consulted for vitest
import { describe, it, expect, vi } from 'vitest';

import { handleSchema } from './schema.js';
import type { ToolContext } from './types.js';

// Mock ToolContext
const createMockContext = (): ToolContext => ({
  client: {
    getSchema: vi.fn(),
    getApplicationStructure: vi.fn(),
  } as any,
  fieldTranslator: {
    hasMappings: vi.fn(),
    translateFieldsToApi: vi.fn(),
    translateFieldsFromApi: vi.fn(),
  } as any,
  tableResolver: {
    resolveTableId: vi.fn(),
    listAvailableTables: vi.fn(),
    getSuggestionsForUnknown: vi.fn().mockReturnValue([]),
    getAllTableNames: vi.fn().mockReturnValue(['table1', 'table2']),
  } as any,
  auditLogger: {
    logOperation: vi.fn(),
  } as any,
});

describe('handleSchema', () => {
  describe('output_mode: summary', () => {
    it('should return table summary with field counts', async () => {
      const context = createMockContext();
      const mockSchema = {
        id: 'test-app-id',
        name: 'Test Table',
        structure: [
          { slug: 'field1', field_type: 'text', label: 'Field 1' },
          { slug: 'field2', field_type: 'number', label: 'Field 2' },
          { slug: 'field3', field_type: 'text', label: 'Field 3' },
        ],
      };

      context.tableResolver.resolveTableId = vi.fn().mockReturnValue('test-app-id');
      context.client.getSchema = vi.fn().mockResolvedValue(mockSchema);

      const result = await handleSchema(context, {
        appId: 'test-app-id',
        output_mode: 'summary',
      }, new Map());

      expect(result).toEqual({
        id: 'test-app-id',
        name: 'Test Table',
        field_count: 3,
        field_types: {
          text: 2,
          number: 1,
        },
      });
    });
  });

  describe('output_mode: fields', () => {
    it('should return field details without full schema', async () => {
      const context = createMockContext();
      const mockSchema = {
        id: 'test-app-id',
        name: 'Test Table',
        structure: [
          {
            slug: 'field1',
            field_type: 'text',
            label: 'Field 1',
            params: { required: true },
          },
          {
            slug: 'field2',
            field_type: 'number',
            label: 'Field 2',
            params: { required: false },
          },
        ],
      };

      context.tableResolver.resolveTableId = vi.fn().mockReturnValue('test-app-id');
      context.client.getSchema = vi.fn().mockResolvedValue(mockSchema);

      const result = await handleSchema(context, {
        appId: 'test-app-id',
        output_mode: 'fields',
      }, new Map());

      expect(result).toEqual({
        id: 'test-app-id',
        name: 'Test Table',
        field_count: 2,
        fields: [
          {
            slug: 'field1',
            field_type: 'text',
            label: 'Field 1',
            required: true,
          },
          {
            slug: 'field2',
            field_type: 'number',
            label: 'Field 2',
            required: false,
          },
        ],
        conditionalFieldsSupported: true,
      });
    });
  });

  describe('output_mode: detailed', () => {
    it('should return full schema with field mappings when available', async () => {
      const context = createMockContext();
      const mockSchema = {
        id: 'test-app-id',
        name: 'Test Table',
        structure: [
          { slug: 'field1', field_type: 'text', label: 'Field 1' },
        ],
      };

      context.tableResolver.resolveTableId = vi.fn().mockReturnValue('test-app-id');
      context.client.getSchema = vi.fn().mockResolvedValue(mockSchema);
      context.fieldTranslator.hasMappings = vi.fn().mockReturnValue(true);

      const result = await handleSchema(context, {
        appId: 'test-app-id',
        output_mode: 'detailed',
      }, new Map());

      expect(result).toEqual({
        id: 'test-app-id',
        name: 'Test Table',
        structure: [
          { slug: 'field1', field_type: 'text', label: 'Field 1' },
        ],
        conditionalFieldsSupported: true,
        fieldMappings: {
          hasCustomMappings: true,
          message: 'This table supports human-readable field names. Use field names from the mappings below instead of API codes.',
        },
      });
    });

    it('should return full schema without field mappings when not available', async () => {
      const context = createMockContext();
      const mockSchema = {
        id: 'test-app-id',
        name: 'Test Table',
        structure: [
          { slug: 'field1', field_type: 'text', label: 'Field 1' },
        ],
      };

      context.tableResolver.resolveTableId = vi.fn().mockReturnValue('test-app-id');
      context.client.getSchema = vi.fn().mockResolvedValue(mockSchema);
      context.fieldTranslator.hasMappings = vi.fn().mockReturnValue(false);

      const result = await handleSchema(context, {
        appId: 'test-app-id',
        output_mode: 'detailed',
      }, new Map());

      expect(result).toEqual({
        id: 'test-app-id',
        name: 'Test Table',
        structure: [
          { slug: 'field1', field_type: 'text', label: 'Field 1' },
        ],
        conditionalFieldsSupported: true,
        fieldMappings: {
          hasCustomMappings: false,
          message: 'This table uses raw API field codes. Custom field mappings not available.',
        },
      });
    });
  });

  describe('error cases', () => {
    it('should throw error for invalid output_mode', async () => {
      const context = createMockContext();
      context.tableResolver.resolveTableId = vi.fn().mockReturnValue('test-app-id');

      await expect(
        handleSchema(context, {
          appId: 'test-app-id',
          output_mode: 'invalid',
        }, new Map()),
      ).rejects.toThrow('Invalid output_mode');
    });

    it('should handle table resolution errors', async () => {
      const context = createMockContext();
      context.tableResolver.resolveTableId = vi.fn().mockReturnValue(null);

      await expect(
        handleSchema(context, {
          appId: 'invalid-id',
          output_mode: 'summary',
        }, new Map()),
      ).rejects.toThrow('Unknown table');
    });

    it('should fallback to detailed mode when structure is missing', async () => {
      const context = createMockContext();
      const mockSchema = {
        id: 'test-app-id',
        name: 'Test Table',
        // Missing structure property - old format
      };

      context.tableResolver.resolveTableId = vi.fn().mockReturnValue('test-app-id');
      context.client.getSchema = vi.fn().mockResolvedValue(mockSchema);
      context.fieldTranslator.hasMappings = vi.fn().mockReturnValue(false);

      const result = await handleSchema(context, {
        appId: 'test-app-id',
        output_mode: 'summary', // Requested summary but should fallback to detailed
      }, new Map());

      expect(result).toEqual({
        id: 'test-app-id',
        name: 'Test Table',
        fieldMappings: {
          hasCustomMappings: false,
          message: 'This table uses raw API field codes. Custom field mappings not available.',
        },
      });
    });
  });

  describe('default behavior', () => {
    it('should default to summary mode when output_mode not specified', async () => {
      const context = createMockContext();
      const mockSchema = {
        id: 'test-app-id',
        name: 'Test Table',
        structure: [
          { slug: 'field1', field_type: 'text', label: 'Field 1' },
        ],
      };

      context.tableResolver.resolveTableId = vi.fn().mockReturnValue('test-app-id');
      context.client.getSchema = vi.fn().mockResolvedValue(mockSchema);

      const result = await handleSchema(context, {
        appId: 'test-app-id',
        // output_mode not specified
      }, new Map());

      expect(result).toEqual({
        id: 'test-app-id',
        name: 'Test Table',
        field_count: 1,
        field_types: {
          text: 1,
        },
      });
    });
  });
});
