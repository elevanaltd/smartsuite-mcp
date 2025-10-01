// ERROR-ARCHITECT-APPROVED: ERROR-ARCHITECT-20250910-39aa03d2
// TRACED: Tests for CLI audit report generation
// Context7: consulted for vitest
// Context7: consulted for fs-extra
// Context7: consulted for path
import * as path from 'path';

import * as fs from 'fs-extra';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import { AuditLogger } from '../audit/audit-logger.js';

import { generateComplianceReport } from './audit-reports.js';

describe('CLI Audit Reports', () => {
  let testAuditFile: string;
  let consoleSpy: ReturnType<typeof vi.spyOn>;
  let processExitSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    testAuditFile = path.join(process.cwd(), 'test-cli-audit.ndjson');

    // Mock console output for testing
    consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    processExitSpy = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never) as any;

    // Create test audit data
    const auditLogger = new AuditLogger(testAuditFile);
    await auditLogger.logMutation({
      operation: 'create',
      tableId: 'users',
      recordId: 'user1',
      payload: { name: 'John Doe', email: 'john@example.com' },
      result: { id: 'user1' },
      reversalInstructions: { operation: 'delete', tableId: 'users', recordId: 'user1' },
    });
  });

  afterEach(async () => {
    if (await fs.pathExists(testAuditFile)) {
      await fs.remove(testAuditFile);
    }
    vi.restoreAllMocks();
  });

  describe('SOC2 Report Generation', () => {
    it('should generate SOC2 compliance report in text format', async () => {
      // FAILING TEST: generateComplianceReport function doesn't exist yet
      await generateComplianceReport('SOC2', testAuditFile, 'text');

      expect(consoleSpy).toHaveBeenCalled();
      const output = consoleSpy.mock.calls.map(call => call[0]).join('\n');

      expect(output).toContain('SOC2 COMPLIANCE REPORT');
      expect(output).toContain('Total Operations: 1');
      expect(output).toContain('Create: 1');
      expect(output).toContain('Affected Tables: users');
    });

    it('should generate SOC2 compliance report in JSON format', async () => {
      // FAILING TEST: JSON output format
      await generateComplianceReport('SOC2', testAuditFile, 'json');

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('"standard": "SOC2"'));
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('"totalOperations": 1'));
    });
  });

  describe('GDPR Report Generation', () => {
    it('should generate GDPR compliance report with personal data analysis', async () => {
      // FAILING TEST: GDPR-specific reporting
      await generateComplianceReport('GDPR', testAuditFile, 'text');

      const output = consoleSpy.mock.calls.map(call => call[0]).join('\n');

      expect(output).toContain('GDPR COMPLIANCE REPORT');
      expect(output).toContain('GDPR-Specific Analysis');
      expect(output).toContain('Personal Data Operations');
      expect(output).toContain('Data Subjects');
      expect(output).toContain('Right to Erasure Records');
    });
  });

  describe('Error Handling', () => {
    it('should handle missing audit file gracefully', async () => {
      // TESTGUARD-APPROVED: TEST-METHODOLOGY-GUARDIAN-20250910-78ab647c
      // Fix: Missing file returns empty report, not error
      const nonExistentFile = '/path/that/does/not/exist/audit.ndjson';

      await generateComplianceReport('SOC2', nonExistentFile, 'text');

      // Should print empty report, not exit with error
      expect(processExitSpy).not.toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('COMPLIANCE REPORT'));
    });

    it('should handle invalid audit data gracefully', async () => {
      // TESTGUARD-APPROVED: TEST-METHODOLOGY-GUARDIAN-20250910-78ab647c
      // Fix: Invalid NDJSON lines are now silently skipped, resulting in empty report
      const invalidFile = path.join(process.cwd(), 'invalid-audit.ndjson');
      await fs.writeFile(invalidFile, 'invalid json');

      await generateComplianceReport('SOC2', invalidFile, 'text');

      // Should print empty report, not exit with error (invalid lines are skipped)
      expect(processExitSpy).not.toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('COMPLIANCE REPORT'));
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Total Operations: 0'));

      // Clean up
      await fs.remove(invalidFile);
    });
  });

  describe('Default Parameters', () => {
    it('should use default audit file path when not specified', async () => {
      // FAILING TEST: Default parameter handling
      // Create audit file at default location
      const defaultPath = path.join(process.cwd(), 'audit-trail.ndjson');
      const auditLogger = new AuditLogger(defaultPath);
      await auditLogger.logMutation({
        operation: 'create',
        tableId: 'test',
        recordId: 'test1',
        payload: { test: true },
        result: { id: 'test1' },
        reversalInstructions: { operation: 'delete', tableId: 'test', recordId: 'test1' },
      });

      await generateComplianceReport('SOC2');

      expect(consoleSpy).toHaveBeenCalled();
      const output = consoleSpy.mock.calls.map(call => call[0]).join('\n');
      expect(output).toContain('SOC2 COMPLIANCE REPORT');

      // Clean up default file
      await fs.remove(defaultPath);
    });

    it('should default to text format when format not specified', async () => {
      // FAILING TEST: Default format handling
      await generateComplianceReport('SOC2', testAuditFile);

      const output = consoleSpy.mock.calls.map(call => call[0]).join('\n');
      expect(output).toContain('=== SOC2 COMPLIANCE REPORT ===');
      expect(output).not.toContain('"standard":'); // Should not be JSON
    });
  });

  describe('Report Content Validation', () => {
    beforeEach(async () => {
      // Create more comprehensive test data
      const auditLogger = new AuditLogger(testAuditFile);

      // Clear existing data
      if (await fs.pathExists(testAuditFile)) {
        await fs.remove(testAuditFile);
      }

      const operations = [
        {
          operation: 'create' as const,
          tableId: 'users',
          recordId: 'user1',
          payload: { name: 'John Doe', email: 'john@example.com' },
          result: { id: 'user1' },
          reversalInstructions: { operation: 'delete' as const, tableId: 'users', recordId: 'user1' },
        },
        {
          operation: 'update' as const,
          tableId: 'users',
          recordId: 'user1',
          payload: { email: 'john.doe@example.com' },
          result: { id: 'user1' },
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
          tableId: 'orders',
          recordId: 'order1',
          result: { deleted: 'order1' },
          beforeData: { id: 'order1', amount: 100 },
          reversalInstructions: {
            operation: 'create' as const,
            tableId: 'orders',
            payload: { id: 'order1', amount: 100 },
          },
        },
      ];

      // Sequential processing required for audit order
      await operations.reduce(async (prev, op) => {
        await prev;
        return auditLogger.logMutation(op);
      }, Promise.resolve());
    });

    it('should include all required fields in SOC2 report', async () => {
      // FAILING TEST: Complete SOC2 report validation
      await generateComplianceReport('SOC2', testAuditFile, 'text');

      const output = consoleSpy.mock.calls.map(call => call[0]).join('\n');

      expect(output).toContain('Total Operations: 3');
      expect(output).toContain('Create: 1');
      expect(output).toContain('Update: 1');
      expect(output).toContain('Delete: 1');
      expect(output).toContain('Affected Tables: users, orders');
      expect(output).toContain('Date Range:');
      expect(output).toContain('Retention Analysis:');
    });

    it('should identify personal data correctly in GDPR report', async () => {
      // FAILING TEST: GDPR personal data detection
      await generateComplianceReport('GDPR', testAuditFile, 'text');

      const output = consoleSpy.mock.calls.map(call => call[0]).join('\n');

      expect(output).toContain('Personal Data Operations: 2'); // create and update with email/name
      expect(output).toContain('Data Subjects: 2'); // user1 and order1
    });
  });
});
