// ERROR-ARCHITECT-APPROVED: CRITICAL-PRODUCTION-FIX-NDJSON-20250114
// ERROR-ARCHITECT-APPROVED: ERROR-ARCHITECT-20250910-39aa03d2
// TRACED: T - TEST_FIRST - Red state enforcement for audit logging functionality
// Tests updated to match NDJSON append-only architecture (P0 production fix)
// Context7: consulted for vitest
// Context7: consulted for fs-extra
// Context7: consulted for path
import * as path from 'path';

import * as fs from 'fs-extra';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';


import { AuditLogger } from './audit-logger.js';

describe('AuditLogger', () => {
  let auditLogger: AuditLogger;
  let testAuditFile: string;
  let ndjsonFile: string;

  beforeEach(async () => {
    // Use JSON extension in constructor (AuditLogger converts to NDJSON internally)
    testAuditFile = path.join(process.cwd(), 'test-audit-trail.json');
    ndjsonFile = path.join(process.cwd(), 'test-audit-trail.ndjson');

    // Clean up any existing files BEFORE creating new instance
    if (await fs.pathExists(ndjsonFile)) {
      await fs.remove(ndjsonFile);
    }
    if (await fs.pathExists(testAuditFile)) {
      await fs.remove(testAuditFile);
    }

    auditLogger = new AuditLogger(testAuditFile);
  });

  afterEach(async () => {
    // Clean up both JSON and NDJSON test audit files
    if (await fs.pathExists(ndjsonFile)) {
      await fs.remove(ndjsonFile);
    }
    if (await fs.pathExists(testAuditFile)) {
      await fs.remove(testAuditFile);
    }
    vi.restoreAllMocks();
  });

  describe('Audit Entry Creation', () => {
    it('should log create operation with full context', async () => {
      // FAILING TEST: AuditLogger class doesn't exist yet
      const payload = { name: 'Test Record', value: 123 };
      const result = { id: 'rec123', ...payload };

      await auditLogger.logMutation({
        operation: 'create',
        tableId: 'table123',
        recordId: 'rec123',
        payload,
        result,
        reversalInstructions: {
          operation: 'delete',
          tableId: 'table123',
          recordId: 'rec123',
        },
      });

      const entries = await auditLogger.getEntries();
      expect(entries).toHaveLength(1);

      const entry = entries[0]!;
      expect(entry.timestamp).toBeInstanceOf(Date);
      expect(entry.operation).toBe('create');
      expect(entry.tableId).toBe('table123');
      expect(entry.recordId).toBe('rec123');
      expect(entry.payload).toEqual(payload);
      expect(entry.result).toEqual(result);
      expect(entry.reversalInstructions).toBeDefined();
      expect(entry.id).toMatch(/^audit-\d{13}-[a-f0-9]{8}$/);
    });

    it('should log update operation with before/after context', async () => {
      // FAILING TEST: Testing update operation logging
      const beforeData = { name: 'Old Name', value: 100 };
      const payload = { name: 'New Name', value: 200 };
      const result = { id: 'rec123', ...payload };

      await auditLogger.logMutation({
        operation: 'update',
        tableId: 'table123',
        recordId: 'rec123',
        payload,
        result,
        beforeData,
        reversalInstructions: {
          operation: 'update',
          tableId: 'table123',
          recordId: 'rec123',
          payload: beforeData,
        },
      });

      const entries = await auditLogger.getEntries();
      const entry = entries[0]!;

      expect(entry.operation).toBe('update');
      expect(entry.beforeData).toEqual(beforeData);
      expect(entry.payload).toEqual(payload);
      expect(entry.reversalInstructions.payload).toEqual(beforeData);
    });

    it('should log delete operation with recovery data', async () => {
      // FAILING TEST: Testing delete operation logging
      const deletedData = { id: 'rec123', name: 'Deleted Record', value: 456 };

      await auditLogger.logMutation({
        operation: 'delete',
        tableId: 'table123',
        recordId: 'rec123',
        result: { deleted: 'rec123' },
        beforeData: deletedData,
        reversalInstructions: {
          operation: 'create',
          tableId: 'table123',
          payload: deletedData,
        },
      });

      const entries = await auditLogger.getEntries();
      const entry = entries[0]!;

      expect(entry.operation).toBe('delete');
      expect(entry.beforeData).toEqual(deletedData);
      expect(entry.reversalInstructions.operation).toBe('create');
      expect(entry.reversalInstructions.payload).toEqual(deletedData);
    });
  });

  describe('Audit Trail Persistence', () => {
    it('should persist audit entries to file system', async () => {
      // File persistence mechanism - now using NDJSON format
      await auditLogger.logMutation({
        operation: 'create',
        tableId: 'table123',
        recordId: 'rec123',
        payload: { test: true },
        result: { id: 'rec123', test: true },
        reversalInstructions: {
          operation: 'delete',
          tableId: 'table123',
          recordId: 'rec123',
        },
      });

      // Check that NDJSON file exists (not the JSON file)
      expect(await fs.pathExists(ndjsonFile)).toBe(true);
      expect(await fs.pathExists(testAuditFile)).toBe(false);

      // Read and parse NDJSON format (one JSON object per line)
      const fileContent = await fs.readFile(ndjsonFile, 'utf8');
      const lines = fileContent.trim().split('\n').filter(line => line.trim() !== '');
      expect(lines).toHaveLength(1);

      const entry = JSON.parse(lines[0]!);
      expect(entry.operation).toBe('create');
    });

    it('should append new entries without overwriting existing ones', async () => {
      // FAILING TEST: Append-only behavior
      await auditLogger.logMutation({
        operation: 'create',
        tableId: 'table1',
        recordId: 'rec1',
        payload: { test: 1 },
        result: { id: 'rec1' },
        reversalInstructions: { operation: 'delete', tableId: 'table1', recordId: 'rec1' },
      });

      await auditLogger.logMutation({
        operation: 'update',
        tableId: 'table2',
        recordId: 'rec2',
        payload: { test: 2 },
        result: { id: 'rec2' },
        reversalInstructions: { operation: 'update', tableId: 'table2', recordId: 'rec2', payload: {} },
      });

      const entries = await auditLogger.getEntries();
      expect(entries).toHaveLength(2);
      expect(entries[0]!.operation).toBe('create');
      expect(entries[1]!.operation).toBe('update');
    });

    it('should survive application crashes and restarts', async () => {
      // FAILING TEST: Crash resilience
      await auditLogger.logMutation({
        operation: 'create',
        tableId: 'table123',
        recordId: 'rec123',
        payload: { test: true },
        result: { id: 'rec123' },
        reversalInstructions: { operation: 'delete', tableId: 'table123', recordId: 'rec123' },
      });

      // Simulate crash - create new instance
      const newAuditLogger = new AuditLogger(testAuditFile);
      const entries = await newAuditLogger.getEntries();

      expect(entries).toHaveLength(1);
      expect(entries[0]!.operation).toBe('create');
    });
  });

  describe('Audit Entry Immutability', () => {
    it('should prevent modification of audit entries after creation', async () => {
      // FAILING TEST: Immutability enforcement
      await auditLogger.logMutation({
        operation: 'create',
        tableId: 'table123',
        recordId: 'rec123',
        payload: { test: true },
        result: { id: 'rec123' },
        reversalInstructions: { operation: 'delete', tableId: 'table123', recordId: 'rec123' },
      });

      const entries = await auditLogger.getEntries();
      const originalEntry = { ...entries[0] };

      // Attempt to modify entry
      entries[0]!.operation = 'update' as any;
      entries[0]!.payload = { modified: true };

      // Verify original data is preserved
      const freshEntries = await auditLogger.getEntries();
      expect(freshEntries[0]).toEqual(originalEntry);
    });

    it('should include hash verification for entry integrity', async () => {
      // FAILING TEST: Hash-based integrity verification
      await auditLogger.logMutation({
        operation: 'create',
        tableId: 'table123',
        recordId: 'rec123',
        payload: { test: true },
        result: { id: 'rec123' },
        reversalInstructions: { operation: 'delete', tableId: 'table123', recordId: 'rec123' },
      });

      const entries = await auditLogger.getEntries();
      expect(entries[0]!.hash).toBeDefined();
      expect(typeof entries[0]!.hash).toBe('string');
      expect(entries[0]!.hash).toHaveLength(64); // SHA-256 hex length
    });
  });

  describe('Compliance Reporting', () => {
    beforeEach(async () => {
      // Create test data for compliance reports
      const testOperations = [
        {
          operation: 'create' as const,
          tableId: 'users',
          recordId: 'user1',
          payload: { name: 'John Doe', email: 'john@example.com' },
          result: { id: 'user1', name: 'John Doe', email: 'john@example.com' },
          reversalInstructions: { operation: 'delete' as const, tableId: 'users', recordId: 'user1' },
        },
        {
          operation: 'update' as const,
          tableId: 'users',
          recordId: 'user1',
          payload: { email: 'john.doe@example.com' },
          result: { id: 'user1', name: 'John Doe', email: 'john.doe@example.com' },
          beforeData: { name: 'John Doe', email: 'john@example.com' },
          reversalInstructions: {
            operation: 'update' as const,
            tableId: 'users',
            recordId: 'user1',
            payload: { email: 'john@example.com' },
          },
        },
        {
          operation: 'delete' as const,
          tableId: 'users',
          recordId: 'user1',
          result: { deleted: 'user1' },
          beforeData: { id: 'user1', name: 'John Doe', email: 'john.doe@example.com' },
          reversalInstructions: {
            operation: 'create' as const,
            tableId: 'users',
            payload: { id: 'user1', name: 'John Doe', email: 'john.doe@example.com' },
          },
        },
      ];

      // Sequential processing required for audit order
      await testOperations.reduce(async (prev, op) => {
        await prev;
        return auditLogger.logMutation(op);
      }, Promise.resolve());
    });

    it('should generate SOC2 compliance report', async () => {
      // FAILING TEST: SOC2 compliance reporting
      const report = await auditLogger.generateComplianceReport('SOC2');

      expect(report.standard).toBe('SOC2');
      expect(report.reportDate).toBeInstanceOf(Date);
      expect(report.totalOperations).toBe(3);
      expect(report.operationsByType.create).toBe(1);
      expect(report.operationsByType.update).toBe(1);
      expect(report.operationsByType.delete).toBe(1);
      expect(report.affectedTables).toEqual(['users']);
      expect(report.dateRange.from).toBeInstanceOf(Date);
      expect(report.dateRange.to).toBeInstanceOf(Date);
    });

    it('should generate GDPR compliance report', async () => {
      // FAILING TEST: GDPR compliance reporting
      const report = await auditLogger.generateComplianceReport('GDPR');

      expect(report.standard).toBe('GDPR');
      expect(report.personalDataOperations).toBeDefined();
      expect(report.personalDataOperations!.length).toBeGreaterThan(0);
      expect(report.dataSubjects).toContain('user1');
      expect(report.rightToErasure).toEqual([{ recordId: 'user1', tableId: 'users', reversible: true }]);
    });

    it('should include data retention analysis in compliance reports', async () => {
      // FAILING TEST: Data retention analysis
      const report = await auditLogger.generateComplianceReport('SOC2');

      expect(report.retentionAnalysis).toBeDefined();
      expect(report.retentionAnalysis.oldestEntry).toBeInstanceOf(Date);
      expect(report.retentionAnalysis.newestEntry).toBeInstanceOf(Date);
      expect(report.retentionAnalysis.totalEntries).toBe(3);
    });
  });

  describe('Error Handling', () => {
    it('should handle file system errors gracefully', async () => {
      // FAILING TEST: Error resilience
      const invalidPath = '/invalid/path/that/does/not/exist/audit.json';
      const logger = new AuditLogger(invalidPath);

      await expect(logger.logMutation({
        operation: 'create',
        tableId: 'table123',
        recordId: 'rec123',
        payload: { test: true },
        result: { id: 'rec123' },
        reversalInstructions: { operation: 'delete', tableId: 'table123', recordId: 'rec123' },
      })).rejects.toThrow();
    });

    it('should validate required fields in audit entries', async () => {
      // FAILING TEST: Input validation
      await expect(auditLogger.logMutation({
        operation: 'create',
        tableId: '',
        recordId: 'rec123',
        payload: { test: true },
        result: { id: 'rec123' },
        reversalInstructions: { operation: 'delete', tableId: 'table123', recordId: 'rec123' },
      })).rejects.toThrow('tableId is required');

      await expect(auditLogger.logMutation({
        operation: 'update',
        tableId: 'table123',
        recordId: '',
        payload: { test: true },
        result: { id: 'rec123' },
        reversalInstructions: { operation: 'update', tableId: 'table123', recordId: 'rec123', payload: {} },
      })).rejects.toThrow('recordId is required');
    });
  });

  describe('Performance', () => {
    it('should handle concurrent mutations without corruption', async () => {
      // FAILING TEST: Concurrency safety
      const promises = [];

      for (let i = 0; i < 10; i++) {
        promises.push(auditLogger.logMutation({
          operation: 'create',
          tableId: `table${i}`,
          recordId: `rec${i}`,
          payload: { test: i },
          result: { id: `rec${i}`, test: i },
          reversalInstructions: { operation: 'delete', tableId: `table${i}`, recordId: `rec${i}` },
        }));
      }

      await Promise.all(promises);

      const entries = await auditLogger.getEntries();
      expect(entries).toHaveLength(10);

      // Verify all entries are unique
      const recordIds = entries.map(e => e.recordId);
      const uniqueRecordIds = new Set(recordIds);
      expect(uniqueRecordIds.size).toBe(10);
    });
  });
});
