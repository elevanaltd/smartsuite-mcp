// TDD RED PHASE: Tests written BEFORE implementation
// Test-Methodology-Guardian: approved RED-GREEN-REFACTOR cycle
// Context: Extracting handleUndo function module from mcp-server.ts
// Context7: consulted for vitest

import { describe, it, expect, beforeEach, vi } from 'vitest';

import type { AuditLogEntry } from '../audit/audit-logger.js';

import type { ToolContext } from './types.js';
import { handleUndo } from './undo.js';

describe('handleUndo Function Module', () => {
  let mockContext: ToolContext;
  let mockClient: any;
  let mockAuditLogger: any;

  beforeEach(() => {
    // Mock SmartSuite client methods
    mockClient = {
      createRecord: vi.fn(),
      updateRecord: vi.fn(),
      deleteRecord: vi.fn(),
    };

    // Mock audit logger with getEntries method
    mockAuditLogger = {
      getEntries: vi.fn(),
      logMutation: vi.fn(),
    };

    // Create mock context
    mockContext = {
      client: mockClient,
      fieldTranslator: {} as any,
      tableResolver: {} as any,
      auditLogger: mockAuditLogger,
    };
  });

  describe('Transaction ID Validation', () => {
    it('should reject invalid transaction ID format', async () => {
      // FAILING TEST: Function doesn't exist yet
      await expect(handleUndo(mockContext, {
        transaction_id: 'invalid-format',
      })).rejects.toThrow('Invalid transaction ID format');
    });

    it('should reject empty transaction ID', async () => {
      await expect(handleUndo(mockContext, {
        transaction_id: '',
      })).rejects.toThrow('Transaction ID is required');
    });

    it('should reject missing transaction ID', async () => {
      await expect(handleUndo(mockContext, {})).rejects.toThrow('Transaction ID is required');
    });
  });

  describe('Transaction Lookup', () => {
    it('should handle transaction not found', async () => {
      // Mock empty audit entries
      mockAuditLogger.getEntries.mockResolvedValue([]);

      await expect(handleUndo(mockContext, {
        transaction_id: 'audit-1234567890123-abcd1234',
      })).rejects.toThrow('Transaction audit-1234567890123-abcd1234 not found');
    });

    it('should find transaction by ID in audit log', async () => {
      // Mock audit entries with matching transaction
      const mockEntries: AuditLogEntry[] = [
        {
          id: 'audit-1234567890123-abcd1234',
          timestamp: new Date(),
          operation: 'create',
          tableId: 'table123',
          recordId: 'rec123',
          payload: { name: 'Test Record' },
          result: { id: 'rec123', name: 'Test Record' },
          reversalInstructions: {
            operation: 'delete',
            tableId: 'table123',
            recordId: 'rec123',
          },
          hash: 'test-hash',
        },
      ];

      mockAuditLogger.getEntries.mockResolvedValue(mockEntries);
      mockClient.deleteRecord.mockResolvedValue({ deleted: 'rec123' });

      const result = await handleUndo(mockContext, {
        transaction_id: 'audit-1234567890123-abcd1234',
      });

      expect(result).toBeDefined();
      expect(mockClient.deleteRecord).toHaveBeenCalledWith('table123', 'rec123');
    });
  });

  describe('Undo CREATE Operations', () => {
    it('should undo create operation by deleting the record', async () => {
      const mockEntries: AuditLogEntry[] = [
        {
          id: 'audit-1234567890123-abcd1234',
          timestamp: new Date(),
          operation: 'create',
          tableId: 'table123',
          recordId: 'rec123',
          payload: { name: 'Test Record' },
          result: { id: 'rec123', name: 'Test Record' },
          reversalInstructions: {
            operation: 'delete',
            tableId: 'table123',
            recordId: 'rec123',
          },
          hash: 'test-hash',
        },
      ];

      mockAuditLogger.getEntries.mockResolvedValue(mockEntries);
      mockClient.deleteRecord.mockResolvedValue({ deleted: 'rec123' });

      const result = await handleUndo(mockContext, {
        transaction_id: 'audit-1234567890123-abcd1234',
      });

      expect(result).toEqual({
        success: true,
        originalOperation: 'create',
        undoOperation: 'delete',
        tableId: 'table123',
        recordId: 'rec123',
        message: 'Successfully undid create operation by deleting record rec123',
      });

      expect(mockClient.deleteRecord).toHaveBeenCalledWith('table123', 'rec123');
    });
  });

  describe('Undo UPDATE Operations', () => {
    it('should undo update operation by restoring previous values', async () => {
      const mockEntries: AuditLogEntry[] = [
        {
          id: 'audit-1234567890123-abcd1234',
          timestamp: new Date(),
          operation: 'update',
          tableId: 'table123',
          recordId: 'rec123',
          payload: { name: 'Updated Name' },
          result: { id: 'rec123', name: 'Updated Name' },
          beforeData: { id: 'rec123', name: 'Original Name' },
          reversalInstructions: {
            operation: 'update',
            tableId: 'table123',
            recordId: 'rec123',
            payload: { id: 'rec123', name: 'Original Name' },
          },
          hash: 'test-hash',
        },
      ];

      mockAuditLogger.getEntries.mockResolvedValue(mockEntries);
      mockClient.updateRecord.mockResolvedValue({ id: 'rec123', name: 'Original Name' });

      const result = await handleUndo(mockContext, {
        transaction_id: 'audit-1234567890123-abcd1234',
      });

      expect(result).toEqual({
        success: true,
        originalOperation: 'update',
        undoOperation: 'update',
        tableId: 'table123',
        recordId: 'rec123',
        message: 'Successfully undid update operation by restoring previous values for record rec123',
      });

      expect(mockClient.updateRecord).toHaveBeenCalledWith(
        'table123',
        'rec123',
        { id: 'rec123', name: 'Original Name' },
      );
    });
  });

  describe('Undo DELETE Operations', () => {
    it('should undo delete operation by recreating the record', async () => {
      const mockEntries: AuditLogEntry[] = [
        {
          id: 'audit-1234567890123-abcd1234',
          timestamp: new Date(),
          operation: 'delete',
          tableId: 'table123',
          recordId: 'rec123',
          result: { deleted: 'rec123' },
          beforeData: { id: 'rec123', name: 'Deleted Record', value: 42 },
          reversalInstructions: {
            operation: 'create',
            tableId: 'table123',
            payload: { id: 'rec123', name: 'Deleted Record', value: 42 },
          },
          hash: 'test-hash',
        },
      ];

      mockAuditLogger.getEntries.mockResolvedValue(mockEntries);
      mockClient.createRecord.mockResolvedValue({ id: 'rec123', name: 'Deleted Record', value: 42 });

      const result = await handleUndo(mockContext, {
        transaction_id: 'audit-1234567890123-abcd1234',
      });

      expect(result).toEqual({
        success: true,
        originalOperation: 'delete',
        undoOperation: 'create',
        tableId: 'table123',
        recordId: 'rec123',
        message: 'Successfully undid delete operation by recreating record rec123',
      });

      expect(mockClient.createRecord).toHaveBeenCalledWith(
        'table123',
        { id: 'rec123', name: 'Deleted Record', value: 42 },
      );
    });
  });

  describe('Error Handling', () => {
    it('should handle SmartSuite API errors during undo', async () => {
      const mockEntries: AuditLogEntry[] = [
        {
          id: 'audit-1234567890123-abcd1234',
          timestamp: new Date(),
          operation: 'create',
          tableId: 'table123',
          recordId: 'rec123',
          payload: { name: 'Test Record' },
          result: { id: 'rec123', name: 'Test Record' },
          reversalInstructions: {
            operation: 'delete',
            tableId: 'table123',
            recordId: 'rec123',
          },
          hash: 'test-hash',
        },
      ];

      mockAuditLogger.getEntries.mockResolvedValue(mockEntries);
      mockClient.deleteRecord.mockRejectedValue(new Error('Record not found'));

      await expect(handleUndo(mockContext, {
        transaction_id: 'audit-1234567890123-abcd1234',
      })).rejects.toThrow('Failed to undo transaction: Record not found');
    });

    it('should handle missing reversal instructions', async () => {
      const mockEntries: AuditLogEntry[] = [
        {
          id: 'audit-1234567890123-abcd1234',
          timestamp: new Date(),
          operation: 'create',
          tableId: 'table123',
          recordId: 'rec123',
          payload: { name: 'Test Record' },
          result: { id: 'rec123', name: 'Test Record' },
          reversalInstructions: null as any, // Invalid reversal instructions
          hash: 'test-hash',
        },
      ];

      mockAuditLogger.getEntries.mockResolvedValue(mockEntries);

      await expect(handleUndo(mockContext, {
        transaction_id: 'audit-1234567890123-abcd1234',
      })).rejects.toThrow('Transaction audit-1234567890123-abcd1234 has invalid reversal instructions');
    });

    it('should handle audit logger errors', async () => {
      mockAuditLogger.getEntries.mockRejectedValue(new Error('Audit file corrupted'));

      await expect(handleUndo(mockContext, {
        transaction_id: 'audit-1234567890123-abcd1234',
      })).rejects.toThrow('Failed to retrieve audit entries: Audit file corrupted');
    });
  });

  describe('Transaction Expiry', () => {
    it('should reject expired transactions (older than 30 days)', async () => {
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 31); // 31 days ago

      const mockEntries: AuditLogEntry[] = [
        {
          id: 'audit-1234567890123-abcd1234',
          timestamp: oldDate,
          operation: 'create',
          tableId: 'table123',
          recordId: 'rec123',
          payload: { name: 'Test Record' },
          result: { id: 'rec123', name: 'Test Record' },
          reversalInstructions: {
            operation: 'delete',
            tableId: 'table123',
            recordId: 'rec123',
          },
          hash: 'test-hash',
        },
      ];

      mockAuditLogger.getEntries.mockResolvedValue(mockEntries);

      await expect(handleUndo(mockContext, {
        transaction_id: 'audit-1234567890123-abcd1234',
      })).rejects.toThrow('Transaction audit-1234567890123-abcd1234 has expired (older than 30 days)');
    });
  });

  describe('Audit Logging of Undo Operations', () => {
    it('should log the undo operation itself to audit trail', async () => {
      const mockEntries: AuditLogEntry[] = [
        {
          id: 'audit-1234567890123-abcd1234',
          timestamp: new Date(),
          operation: 'create',
          tableId: 'table123',
          recordId: 'rec123',
          payload: { name: 'Test Record' },
          result: { id: 'rec123', name: 'Test Record' },
          reversalInstructions: {
            operation: 'delete',
            tableId: 'table123',
            recordId: 'rec123',
          },
          hash: 'test-hash',
        },
      ];

      mockAuditLogger.getEntries.mockResolvedValue(mockEntries);
      mockClient.deleteRecord.mockResolvedValue({ deleted: 'rec123' });

      await handleUndo(mockContext, {
        transaction_id: 'audit-1234567890123-abcd1234',
      });

      // Verify that the undo operation itself was logged
      expect(mockAuditLogger.logMutation).toHaveBeenCalledWith({
        operation: 'delete',
        tableId: 'table123',
        recordId: 'rec123',
        result: { deleted: 'rec123' },
        reversalInstructions: {
          operation: 'undo-undo',
          originalTransactionId: 'audit-1234567890123-abcd1234',
          message: 'This undo operation cannot be undone',
        },
      });
    });
  });
});
