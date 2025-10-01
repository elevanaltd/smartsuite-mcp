// Context7: consulted for vitest
// Test-Methodology-Guardian: approved TDD RED-GREEN-REFACTOR cycle
// Technical-Architect: function module pattern for tool extraction

import { describe, it, expect, beforeEach, vi } from 'vitest';

import { handleDiscover } from './discover.js';
import type { ToolContext } from './types.js';

describe('handleDiscover', () => {
  let mockContext: ToolContext;
  let mockClient: any;
  let mockAuditLogger: any;
  let mockTableResolver: any;
  let mockFieldTranslator: any;

  beforeEach(() => {
    vi.clearAllMocks();

    mockClient = {};
    mockAuditLogger = {};

    mockTableResolver = {
      getAvailableTables: vi.fn(),
      resolveTableId: vi.fn(),
      getSuggestionsForUnknown: vi.fn(),
      getAllTableNames: vi.fn(),
      getTableByName: vi.fn(),
    };

    mockFieldTranslator = {
      hasMappings: vi.fn(),
      mappings: new Map(),
    };

    mockContext = {
      client: mockClient,
      fieldTranslator: mockFieldTranslator,
      tableResolver: mockTableResolver,
      auditLogger: mockAuditLogger,
    };
  });

  describe('tables scope', () => {
    it('should return available tables', async () => {
      const mockTables = [
        { id: 'table1', name: 'Projects' },
        { id: 'table2', name: 'Tasks' },
      ];
      mockTableResolver.getAvailableTables.mockReturnValue(mockTables);

      const result = await handleDiscover(mockContext, { scope: 'tables' });

      expect(result).toEqual({
        tables: mockTables,
        count: 2,
        message: 'Found 2 available tables. Use table names directly in queries.',
      });
      expect(mockTableResolver.getAvailableTables).toHaveBeenCalledTimes(1);
    });

    it('should handle single table correctly', async () => {
      const mockTables = [{ id: 'table1', name: 'Projects' }];
      mockTableResolver.getAvailableTables.mockReturnValue(mockTables);

      const result = await handleDiscover(mockContext, { scope: 'tables' });

      expect(result).toEqual({
        tables: mockTables,
        count: 1,
        message: 'Found 1 available table. Use table names directly in queries.',
      });
    });
  });

  describe('fields scope', () => {
    it('should throw error when tableId is missing', async () => {
      await expect(handleDiscover(mockContext, { scope: 'fields' }))
        .rejects.toThrow('tableId is required when scope is "fields"');
    });

    it('should throw error for unknown table', async () => {
      mockTableResolver.resolveTableId.mockReturnValue(null);
      mockTableResolver.getSuggestionsForUnknown.mockReturnValue(['Projects', 'Tasks']);
      mockTableResolver.getAllTableNames.mockReturnValue(['Projects', 'Tasks', 'Users']);

      await expect(handleDiscover(mockContext, { scope: 'fields', tableId: 'unknown' }))
        .rejects.toThrow('Unknown table \'unknown\'. Did you mean: Projects, Tasks?');
    });

    it('should throw error for unknown table with no suggestions', async () => {
      mockTableResolver.resolveTableId.mockReturnValue(null);
      mockTableResolver.getSuggestionsForUnknown.mockReturnValue([]);
      mockTableResolver.getAllTableNames.mockReturnValue(['Projects', 'Tasks']);

      await expect(handleDiscover(mockContext, { scope: 'fields', tableId: 'unknown' }))
        .rejects.toThrow('Unknown table \'unknown\'. Available tables: Projects, Tasks');
    });

    it('should return fields with mappings when available', async () => {
      const tableId = 'projects';
      const resolvedId = 'table123';
      const mockTableInfo = { id: resolvedId, name: 'Projects' };
      const mockFields = {
        title: { apiCode: 'field_abc', type: 'text' },
        status: { apiCode: 'field_def', type: 'select' },
      };

      mockTableResolver.resolveTableId.mockReturnValue(resolvedId);
      mockTableResolver.getTableByName.mockReturnValue(mockTableInfo);
      mockFieldTranslator.hasMappings.mockReturnValue(true);
      mockFieldTranslator.mappings.set(resolvedId, { fields: mockFields });

      const result = await handleDiscover(mockContext, { scope: 'fields', tableId });

      expect(result).toEqual({
        table: mockTableInfo,
        fields: mockFields,
        fieldCount: 2,
        message: 'Table \'Projects\' has 2 mapped fields. Use these human-readable names in your queries.',
      });
      expect(mockTableResolver.resolveTableId).toHaveBeenCalledWith(tableId);
      expect(mockFieldTranslator.hasMappings).toHaveBeenCalledWith(resolvedId);
    });

    it('should return empty fields when no mappings available', async () => {
      const tableId = 'projects';
      const resolvedId = 'table123';
      const mockTableInfo = { id: resolvedId, name: 'Projects' };

      mockTableResolver.resolveTableId.mockReturnValue(resolvedId);
      mockTableResolver.getTableByName.mockReturnValue(mockTableInfo);
      mockFieldTranslator.hasMappings.mockReturnValue(false);

      const result = await handleDiscover(mockContext, { scope: 'fields', tableId });

      expect(result).toEqual({
        table: mockTableInfo,
        fields: {},
        fieldCount: 0,
        message: 'Table \'Projects\' has no field mappings configured. Use raw API field codes or configure mappings.',
      });
    });

    it('should fallback to available tables when getTableByName returns null', async () => {
      const tableId = 'projects';
      const resolvedId = 'table123';
      const mockTableInfo = { id: resolvedId, name: 'Projects' };

      mockTableResolver.resolveTableId.mockReturnValue(resolvedId);
      mockTableResolver.getTableByName.mockReturnValue(null);
      mockTableResolver.getAvailableTables.mockReturnValue([mockTableInfo]);
      mockFieldTranslator.hasMappings.mockReturnValue(false);

      const result = await handleDiscover(mockContext, { scope: 'fields', tableId });

      expect(result).toEqual({
        table: mockTableInfo,
        fields: {},
        fieldCount: 0,
        message: 'Table \'Projects\' has no field mappings configured. Use raw API field codes or configure mappings.',
      });
    });

    it('should handle mappings with no fields property', async () => {
      const tableId = 'projects';
      const resolvedId = 'table123';
      const mockTableInfo = { id: resolvedId, name: 'Projects' };

      mockTableResolver.resolveTableId.mockReturnValue(resolvedId);
      mockTableResolver.getTableByName.mockReturnValue(mockTableInfo);
      mockFieldTranslator.hasMappings.mockReturnValue(true);
      mockFieldTranslator.mappings.set(resolvedId, {}); // No fields property

      const result = await handleDiscover(mockContext, { scope: 'fields', tableId });

      expect(result).toEqual({
        table: mockTableInfo,
        fields: {},
        fieldCount: 0,
        message: 'Table \'Projects\' has no field mappings configured. Use raw API field codes or configure mappings.',
      });
    });
  });

  describe('invalid scope', () => {
    it('should throw error for invalid scope', async () => {
      await expect(handleDiscover(mockContext, { scope: 'invalid' }))
        .rejects.toThrow('Invalid scope: invalid. Must be \'tables\' or \'fields\'');
    });
  });
});
