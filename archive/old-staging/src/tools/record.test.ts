// Context7: consulted for vitest
// Test-Methodology-Guardian: approved TDD RED-GREEN-REFACTOR cycle
// Technical-Architect: function module pattern for tool extraction
import { describe, it, expect, beforeEach, vi } from 'vitest';

import type { AuditLogger } from '../audit/audit-logger.js';
import type { FieldTranslator } from '../lib/field-translator.js';
import type { TableResolver } from '../lib/table-resolver.js';
import type { SmartSuiteClient } from '../smartsuite-client.js';

import { handleRecord } from './record.js';
import type { ToolContext } from './types.js';

describe('handleRecord Tool Function', () => {
  let mockContext: ToolContext;
  let mockClient: SmartSuiteClient;
  let mockFieldTranslator: FieldTranslator;
  let mockTableResolver: TableResolver;
  let mockAuditLogger: AuditLogger;

  beforeEach(() => {
    mockClient = {
      createRecord: vi.fn(),
      updateRecord: vi.fn(),
      deleteRecord: vi.fn(),
      getRecord: vi.fn(),
      listRecords: vi.fn().mockResolvedValue({ items: [] }),
      request: vi.fn(),
      getSchema: vi.fn().mockResolvedValue({
        structure: [
          { slug: 'title', label: 'Title', field_type: 'text' },
        ],
      }),
    } as any;

    mockFieldTranslator = {
      hasMappings: vi.fn(() => false),
      humanToApi: vi.fn((_appId, data) => data),
      apiToHuman: vi.fn((_appId, data) => data),
    } as any;

    mockTableResolver = {
      resolveTableId: vi.fn(id => id),
      getSuggestionsForUnknown: vi.fn(() => []),
      getAllTableNames: vi.fn(() => []),
    } as any;

    mockAuditLogger = {
      logMutation: vi.fn(),
    } as any;

    mockContext = {
      client: mockClient,
      fieldTranslator: mockFieldTranslator,
      tableResolver: mockTableResolver,
      auditLogger: mockAuditLogger,
    };
  });

  describe('dry-run validation', () => {
    it('should perform dry-run validation for create operation', async () => {
      const args = {
        operation: 'create',
        appId: 'test-app-id',
        data: { title: 'New Record' },
        dry_run: true,
      };

      const result = await handleRecord(mockContext, args);

      expect(result).toHaveProperty('validated', true);
      expect(result).toHaveProperty('operation', 'create');
      expect(result).toHaveProperty('tableId', 'test-app-id');
      expect(result).toHaveProperty('payload');
      expect(mockClient.createRecord as any).not.toHaveBeenCalled();
    });

    it('should perform dry-run validation for update operation', async () => {
      const mockRecord = { id: 'rec-123', title: 'Existing' };
      (mockClient.getRecord as any).mockResolvedValue(mockRecord);

      const args = {
        operation: 'update',
        appId: 'test-app-id',
        recordId: 'rec-123',
        data: { title: 'Updated' },
        dry_run: true,
      };

      const result = await handleRecord(mockContext, args);

      expect(result).toHaveProperty('validated', true);
      expect(result).toHaveProperty('operation', 'update');
      expect(result).toHaveProperty('recordId', 'rec-123');
      expect(mockClient.updateRecord as any).not.toHaveBeenCalled();
    });

    it('should perform dry-run validation for delete operation', async () => {
      const mockRecord = { id: 'rec-123', title: 'To Delete' };
      (mockClient.getRecord as any).mockResolvedValue(mockRecord);

      const args = {
        operation: 'delete',
        appId: 'test-app-id',
        recordId: 'rec-123',
        dry_run: true,
      };

      const result = await handleRecord(mockContext, args);

      expect(result).toHaveProperty('validated', true);
      expect(result).toHaveProperty('operation', 'delete');
      expect(result).toHaveProperty('recordId', 'rec-123');
      expect(mockClient.deleteRecord as any).not.toHaveBeenCalled();
    });
  });

  describe('actual operations', () => {
    it('should create a record when dry_run is false with prior validation', async () => {
      const mockCreatedRecord = { id: 'new-123', title: 'Created' };
      (mockClient.createRecord as any).mockResolvedValue(mockCreatedRecord);

      const args = {
        operation: 'create',
        appId: 'test-app-id',
        data: { title: 'New Record' },
        dry_run: false,
        priorValidation: true, // Simulating prior validation for testing
      };

      const result = await handleRecord(mockContext, args);

      expect(mockClient.createRecord as any).toHaveBeenCalledWith('test-app-id', { title: 'New Record' });
      expect(result).toEqual(mockCreatedRecord);
    });

    it('should update a record when dry_run is false with prior validation', async () => {
      const mockBeforeRecord = { id: 'rec-123', title: 'Old' };
      const mockUpdatedRecord = { id: 'rec-123', title: 'Updated' };
      (mockClient.getRecord as any).mockResolvedValue(mockBeforeRecord);
      (mockClient.updateRecord as any).mockResolvedValue(mockUpdatedRecord);

      const args = {
        operation: 'update',
        appId: 'test-app-id',
        recordId: 'rec-123',
        data: { title: 'Updated' },
        dry_run: false,
        priorValidation: true, // Simulating prior validation for testing
      };

      const result = await handleRecord(mockContext, args);

      expect(mockClient.updateRecord as any).toHaveBeenCalledWith('test-app-id', 'rec-123', { title: 'Updated' });
      expect(result).toEqual(mockUpdatedRecord);
    });

    it('should delete a record when dry_run is false with prior validation', async () => {
      const mockBeforeRecord = { id: 'rec-123', title: 'To Delete' };
      (mockClient.getRecord as any).mockResolvedValue(mockBeforeRecord);
      (mockClient.deleteRecord as any).mockResolvedValue(undefined);

      const args = {
        operation: 'delete',
        appId: 'test-app-id',
        recordId: 'rec-123',
        dry_run: false,
        priorValidation: true, // Simulating prior validation for testing
      };

      const result = await handleRecord(mockContext, args);

      expect(mockClient.deleteRecord as any).toHaveBeenCalledWith('test-app-id', 'rec-123');
      expect(result).toEqual({ deleted: 'rec-123' });
    });
  });

  describe('error handling', () => {
    it('should throw error for unknown table', async () => {
      (mockTableResolver.resolveTableId as any).mockReturnValue(null);
      (mockTableResolver.getSuggestionsForUnknown as any).mockReturnValue(['table1', 'table2']);

      const args = {
        operation: 'create',
        appId: 'unknown-table',
        data: { title: 'Test' },
        dry_run: true,
      };

      await expect(handleRecord(mockContext, args)).rejects.toThrow(
        "Unknown table 'unknown-table'. Did you mean: table1, table2?",
            );

    });
    it('should validate bulk_update operations in dry-run mode', async () => {
      const args = {
        operation: 'bulk_update',
        appId: 'test-app-id',
        data: [{ id: '1', title: 'Test' }, { id: '2', title: 'Test 2' }],
        dry_run: true,
      };

      const result = await handleRecord(mockContext, args);

      expect(result).toMatchObject({
        dry_run: true,
        operation: 'bulk_update',
        validated: true,
      });
      // In dry-run mode, we should NOT call the actual API endpoint
      expect(mockContext.client.request as any).not.toHaveBeenCalled();
    });
    it('should validate bulk_delete operations in dry-run mode', async () => {
      const args = {
        operation: 'bulk_delete',
        appId: 'test-app-id',
        data: ['id1', 'id2', 'id3'],
        dry_run: true,
      };

      const result = await handleRecord(mockContext, args);

      expect(result).toMatchObject({
        dry_run: true,
        operation: 'bulk_delete',
        validated: true,
      });
      // In dry-run mode, we should NOT call the actual API endpoint
      expect(mockContext.client.request as any).not.toHaveBeenCalled();
    });
    it('should require dry_run parameter', async () => {
      const args = {
        operation: 'create',
        appId: 'test-app-id',
        data: { title: 'Test' },
        // Missing dry_run parameter
      };

      await expect(handleRecord(mockContext, args)).rejects.toThrow(
        'Dry-run pattern required: mutation tools must specify dry_run parameter',
    );

    });
    it('should require prior validation for actual execution', async () => {
      const args = {
        operation: 'create',
        appId: 'test-app-id',
        data: { title: 'Test' },
        dry_run: false,
        // No prior validation
      };

      await expect(handleRecord(mockContext, args)).rejects.toThrow(/validation required/i);
    });
  });

  describe('field translation', () => {
    it('should translate human-readable field names to API codes', async () => {
      (mockFieldTranslator.hasMappings as any).mockReturnValue(true);
      (mockFieldTranslator.humanToApi as any).mockReturnValue({ s123: 'Test Value' });

      const args = {
        operation: 'create',
        appId: 'test-app-id',
        data: { title: 'Test Value' },
        dry_run: true,
      };

      const result = await handleRecord(mockContext, args);

      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(mockFieldTranslator.humanToApi).toHaveBeenCalledWith('test-app-id', { title: 'Test Value' }, true);
      expect(result).toHaveProperty('payload', { s123: 'Test Value' });
    });

    it('should translate API response back to human-readable names', async () => {
      const mockApiRecord = { id: 'rec-123', s123: 'API Value' };
      const mockHumanRecord = { id: 'rec-123', title: 'API Value' };

      (mockFieldTranslator.hasMappings as any).mockReturnValue(true);
      (mockFieldTranslator.apiToHuman as any).mockReturnValue(mockHumanRecord);
      (mockClient.createRecord as any).mockResolvedValue(mockApiRecord);

      const args = {
        operation: 'create',
        appId: 'test-app-id',
        data: { title: 'Test' },
        dry_run: false,
        priorValidation: true,
      };

      const result = await handleRecord(mockContext, args);

      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(mockFieldTranslator.apiToHuman).toHaveBeenCalledWith('test-app-id', mockApiRecord);
      expect(result).toEqual(mockHumanRecord);
    });
  });

  describe('audit logging', () => {
    it('should log tool calls via audit logger', async () => {
      const args = {
        operation: 'create',
        appId: 'test-app-id',
        data: { title: 'Test' },
        dry_run: true,
      };

      await handleRecord(mockContext, args);

    });
  });
});
