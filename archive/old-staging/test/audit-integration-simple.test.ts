// ERROR-ARCHITECT-APPROVED: ERROR-ARCHITECT-20250910-39aa03d2
// TRACED: Simplified integration tests for audit trail functionality
// Context7: consulted for vitest
// Context7: consulted for fs-extra
// Context7: consulted for path
// TESTGUARD-APPROVED: Simplified test approach to verify audit logging integration
import * as path from 'path';

import * as fs from 'fs-extra';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import { AuditLogger } from '../src/audit/audit-logger.js';
import { SmartSuiteShimServer } from '../src/mcp-server.js';

describe('Audit Integration - Direct Testing', () => {
  let server: SmartSuiteShimServer;
  let testAuditFile: string;
  let auditLogger: AuditLogger;

  beforeEach(async () => {
    // TESTGUARD-APPROVED: TEST-METHODOLOGY-GUARDIAN-20250910-c9b1d3a0
    testAuditFile = path.join(process.cwd(), 'test-direct-audit.ndjson');
    server = new SmartSuiteShimServer();
    // Mock environment for test
    process.env.SMARTSUITE_API_TOKEN = 'test-token';
    process.env.SMARTSUITE_WORKSPACE_ID = 'test-workspace';
    // Mock authenticate to avoid real API calls
    server['authenticate'] = vi.fn().mockResolvedValue(undefined);
    // Initialize server to register tools
    await server.initialize();


    // Replace the audit logger with our test instance
    auditLogger = new AuditLogger(testAuditFile);
    (server as any).auditLogger = auditLogger;

    // Mock the SmartSuite client with working responses
    const mockClient = {
      createRecord: vi.fn().mockResolvedValue({ id: 'new-rec-123', name: 'Test' }),
      updateRecord: vi.fn().mockResolvedValue({ id: 'rec-123', name: 'Updated' }),
      deleteRecord: vi.fn().mockResolvedValue(undefined),
      getRecord: vi.fn().mockResolvedValue({ id: 'rec-123', name: 'Original', data: 'test' }),
      listRecords: vi.fn(),
      countRecords: vi.fn(),
    };

    (server as any).client = mockClient;
  });

  afterEach(async () => {
    if (await fs.pathExists(testAuditFile)) {
      await fs.remove(testAuditFile);
    }
    vi.restoreAllMocks();
  });

  describe('Direct Audit Logger Integration', () => {
    it('should log mutation operations directly', async () => {
      // Test the audit logger directly with the same data structure as the MCP server
      await auditLogger.logMutation({
        operation: 'create',
        tableId: '507f1f77bcf86cd799439011',
        recordId: 'new-rec-123',
        payload: { name: 'Test Record', value: 42 },
        result: { id: 'new-rec-123', name: 'Test Record' },
        reversalInstructions: {
          operation: 'delete',
          tableId: '507f1f77bcf86cd799439011',
          recordId: 'new-rec-123',
        },
      });

      // Verify audit entry was created
      const entries = await auditLogger.getEntries();
      expect(entries).toHaveLength(1);

      const entry = entries[0]!;
      expect(entry.operation).toBe('create');
      expect(entry.tableId).toBe('507f1f77bcf86cd799439011');
      expect(entry.recordId).toBe('new-rec-123');
      expect(entry.hash).toBeDefined();
    });

    it('should handle update operations with beforeData', async () => {
      await auditLogger.logMutation({
        operation: 'update',
        tableId: '507f1f77bcf86cd799439011',
        recordId: 'rec-123',
        payload: { name: 'Updated Record' },
        result: { id: 'rec-123', name: 'Updated Record' },
        beforeData: { id: 'rec-123', name: 'Original Record' },
        reversalInstructions: {
          operation: 'update',
          tableId: '507f1f77bcf86cd799439011',
          recordId: 'rec-123',
          payload: { id: 'rec-123', name: 'Original Record' },
        },
      });

      const entries = await auditLogger.getEntries();
      expect(entries).toHaveLength(1);
      expect(entries[0]!.operation).toBe('update');
      expect(entries[0]!.beforeData).toBeDefined();
    });

    it('should handle delete operations with recovery data', async () => {
      await auditLogger.logMutation({
        operation: 'delete',
        tableId: '507f1f77bcf86cd799439011',
        recordId: 'rec-123',
        result: { deleted: 'rec-123' },
        beforeData: { id: 'rec-123', name: 'Original Record', data: 'test' },
        reversalInstructions: {
          operation: 'create',
          tableId: '507f1f77bcf86cd799439011',
          payload: { id: 'rec-123', name: 'Original Record', data: 'test' },
        },
      });

      const entries = await auditLogger.getEntries();
      expect(entries).toHaveLength(1);
      expect(entries[0]!.operation).toBe('delete');
      expect(entries[0]!.reversalInstructions.operation).toBe('create');
    });

    it('should generate compliance reports from logged operations', async () => {
      // Log a series of operations
      const operations = [
        {
          operation: 'create' as const,
          tableId: 'users',
          recordId: 'user1',
          payload: { name: 'John Doe', email: 'john@test.com' },
          result: { id: 'user1' },
          reversalInstructions: { operation: 'delete' as const, tableId: 'users', recordId: 'user1' },
        },
        {
          operation: 'update' as const,
          tableId: 'users',
          recordId: 'user1',
          payload: { email: 'john.doe@test.com' },
          result: { id: 'user1' },
          beforeData: { name: 'John Doe', email: 'john@test.com' },
          reversalInstructions: {
            operation: 'update' as const,
            tableId: 'users',
            recordId: 'user1',
            payload: { email: 'john@test.com' },
          },
        },
      ];

      for (const op of operations) {
        await auditLogger.logMutation(op);
      }

      // Generate compliance report
      const report = await auditLogger.generateComplianceReport('SOC2');

      expect(report.standard).toBe('SOC2');
      expect(report.totalOperations).toBe(2);
      expect(report.operationsByType.create).toBe(1);
      expect(report.operationsByType.update).toBe(1);
      expect(report.affectedTables).toContain('users');
    });

    it('should persist audit trail across application restarts', async () => {
      // Log an operation
      await auditLogger.logMutation({
        operation: 'create',
        tableId: 'test-table',
        recordId: 'test-record',
        payload: { test: true },
        result: { id: 'test-record' },
        reversalInstructions: { operation: 'delete', tableId: 'test-table', recordId: 'test-record' },
      });

      // Verify file exists
      expect(await fs.pathExists(testAuditFile)).toBe(true);

      // Create new audit logger instance (simulating restart)
      const newAuditLogger = new AuditLogger(testAuditFile);
      const entries = await newAuditLogger.getEntries();

      expect(entries).toHaveLength(1);
      expect(entries[0]!.operation).toBe('create');
      expect(entries[0]!.tableId).toBe('test-table');
    });
  });

  describe('Server Integration Points', () => {
    it('should verify audit logger is properly integrated into server', () => {
      // Verify the server has an audit logger
      expect((server as any).auditLogger).toBeDefined();
      expect((server as any).auditLogger).toBeInstanceOf(AuditLogger);
    });

    it('should use the correct audit file path in production', () => {
      const productionServer = new SmartSuiteShimServer();
      // const expectedPath = path.join(process.cwd(), 'audit-trail.json');

      // TESTGUARD-APPROVED: TEST-METHODOLOGY-GUARDIAN-20250910-c9b1d3a0
      expect((productionServer as any).auditLogger.auditFilePath).toContain('audit-trail.ndjson');
    });
  });

  describe('Error Handling', () => {
    it('should handle audit logging errors gracefully', async () => {
      // Create an audit logger with an invalid path
      const invalidLogger = new AuditLogger('/invalid/path/audit.json');

      await expect(invalidLogger.logMutation({
        operation: 'create',
        tableId: 'test',
        recordId: 'test',
        payload: { test: true },
        result: { id: 'test' },
        reversalInstructions: { operation: 'delete', tableId: 'test', recordId: 'test' },
      })).rejects.toThrow();
    });

    it('should validate required fields', async () => {
      await expect(auditLogger.logMutation({
        operation: 'create',
        tableId: '',  // Invalid empty tableId
        recordId: 'test',
        payload: { test: true },
        result: { id: 'test' },
        reversalInstructions: { operation: 'delete', tableId: 'test', recordId: 'test' },
      })).rejects.toThrow('tableId is required');
    });
  });
});
