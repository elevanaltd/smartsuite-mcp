// ERROR-ARCHITECT-APPROVED: CRITICAL-PRODUCTION-FIX-NDJSON-20250114
// ERROR-ARCHITECT: Test file for NDJSON audit logger architecture
// Tests the O(1) append-only implementation that fixes production deadlock issues
// Context7: consulted for path
// Context7: consulted for fs-extra
// Context7: consulted for vitest
import * as path from 'path';

import * as fs from 'fs-extra';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import { AuditLogger } from './audit-logger.js';

describe('AuditLogger NDJSON Format', () => {
  let auditLogger: AuditLogger;
  let testAuditFile: string;
  let ndjsonFile: string;

  beforeEach(() => {
    testAuditFile = path.join(process.cwd(), 'test-ndjson-audit.json');
    ndjsonFile = testAuditFile.replace(/\.json$/, '.ndjson');
    auditLogger = new AuditLogger(testAuditFile);
  });

  afterEach(async () => {
    // Clean up all test files
    const filesToClean = [
      testAuditFile,
      ndjsonFile,
      `${testAuditFile}.backup`,
      `${testAuditFile}.lock`, // Should not exist but clean up just in case
    ];

    // Sequential file cleanup required for test isolation
    // eslint-disable-next-line no-await-in-loop
    for (const file of filesToClean) {
      if (await fs.pathExists(file)) {
        await fs.remove(file);
      }
    }
    vi.restoreAllMocks();
  });

  describe('NDJSON Persistence', () => {
    it('should persist entries in NDJSON format (one JSON object per line)', async () => {
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

      // Verify NDJSON format
      const fileContent = await fs.readFile(ndjsonFile, 'utf8');
      const lines = fileContent.trim().split('\n');
      expect(lines).toHaveLength(1);

      // Each line should be valid JSON
      const firstLine = lines[0];
      expect(firstLine).toBeDefined();
      const entry = JSON.parse(firstLine!);
      expect(entry.operation).toBe('create');
      expect(entry.tableId).toBe('table123');
    });

    it('should append entries in O(1) time without reading existing data', async () => {
      // First entry
      await auditLogger.logMutation({
        operation: 'create',
        tableId: 'table1',
        recordId: 'rec1',
        payload: { test: 1 },
        result: { id: 'rec1' },
        reversalInstructions: { operation: 'delete', tableId: 'table1', recordId: 'rec1' },
      });

      // Get initial file size to verify append-only behavior
      const stats1 = await fs.stat(ndjsonFile);
      const size1 = stats1.size;

      // Second entry - should append without reading
      await auditLogger.logMutation({
        operation: 'update',
        tableId: 'table2',
        recordId: 'rec2',
        payload: { test: 2 },
        result: { id: 'rec2' },
        reversalInstructions: { operation: 'update', tableId: 'table2', recordId: 'rec2', payload: {} },
      });

      // Verify file size increased (append happened)
      const stats2 = await fs.stat(ndjsonFile);
      const size2 = stats2.size;
      expect(size2).toBeGreaterThan(size1);

      // Verify both entries exist
      const entries = await auditLogger.getEntries();
      expect(entries).toHaveLength(2);
      expect(entries[0]!.operation).toBe('create');
      expect(entries[1]!.operation).toBe('update');
    });

    it('should handle concurrent writes without file locking', async () => {
      // No file locks should be created
      const lockFile = `${ndjsonFile}.lock`;

      const promises = [];
      for (let i = 0; i < 20; i++) {
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

      // No lock file should exist
      expect(await fs.pathExists(lockFile)).toBe(false);

      // All entries should be present
      const entries = await auditLogger.getEntries();
      expect(entries).toHaveLength(20);

      // Verify all entries are unique and uncorrupted
      const recordIds = entries.map(e => e.recordId);
      const uniqueRecordIds = new Set(recordIds);
      expect(uniqueRecordIds.size).toBe(20);
    });
  });

  describe('Legacy JSON Migration', () => {
    it('should automatically migrate legacy JSON format to NDJSON', async () => {
      // Create a legacy JSON file
      const legacyData = [
        {
          id: 'audit-1234567890123-abcdef12',
          timestamp: new Date().toISOString(),
          operation: 'create',
          tableId: 'legacy_table',
          recordId: 'legacy_rec',
          payload: { legacy: true },
          reversalInstructions: { operation: 'delete', tableId: 'legacy_table', recordId: 'legacy_rec' },
          hash: 'legacyhash',
        },
      ];
      await fs.writeJson(testAuditFile, legacyData);

      // First operation should trigger migration
      await auditLogger.logMutation({
        operation: 'update',
        tableId: 'new_table',
        recordId: 'new_rec',
        payload: { new: true },
        result: { id: 'new_rec' },
        reversalInstructions: { operation: 'update', tableId: 'new_table', recordId: 'new_rec', payload: {} },
      });

      // Check migration happened
      expect(await fs.pathExists(ndjsonFile)).toBe(true);
      expect(await fs.pathExists(`${testAuditFile}.backup`)).toBe(true);

      // Verify all entries (legacy + new)
      const entries = await auditLogger.getEntries();
      expect(entries).toHaveLength(2);
      expect(entries[0]!.recordId).toBe('legacy_rec');
      expect(entries[1]!.recordId).toBe('new_rec');
    });

    it('should read NDJSON format correctly', async () => {
      // Manually create NDJSON file
      const ndjsonContent = [
        JSON.stringify({
          id: 'audit-1111111111111-aaa',
          timestamp: new Date().toISOString(),
          operation: 'create',
          tableId: 'table1',
          recordId: 'rec1',
          hash: 'hash1',
          reversalInstructions: { operation: 'delete', tableId: 'table1', recordId: 'rec1' },
        }),
        JSON.stringify({
          id: 'audit-2222222222222-bbb',
          timestamp: new Date().toISOString(),
          operation: 'update',
          tableId: 'table2',
          recordId: 'rec2',
          hash: 'hash2',
          reversalInstructions: { operation: 'update', tableId: 'table2', recordId: 'rec2', payload: {} },
        }),
      ].join('\n') + '\n';

      await fs.writeFile(ndjsonFile, ndjsonContent, 'utf8');

      const entries = await auditLogger.getEntries();
      expect(entries).toHaveLength(2);
      expect(entries[0]!.operation).toBe('create');
      expect(entries[1]!.operation).toBe('update');
    });

    it('should handle malformed lines gracefully', async () => {
      // Create NDJSON with some malformed lines
      const ndjsonContent = [
        JSON.stringify({ id: 'valid1', timestamp: new Date().toISOString(), operation: 'create', tableId: 't1', recordId: 'r1', hash: 'h1', reversalInstructions: { operation: 'delete', tableId: 't1', recordId: 'r1' } }),
        'malformed json {',
        JSON.stringify({ id: 'valid2', timestamp: new Date().toISOString(), operation: 'update', tableId: 't2', recordId: 'r2', hash: 'h2', reversalInstructions: { operation: 'update', tableId: 't2', recordId: 'r2', payload: {} } }),
        '',  // Empty line
        '   ',  // Whitespace only
      ].join('\n') + '\n';

      await fs.writeFile(ndjsonFile, ndjsonContent, 'utf8');

      const entries = await auditLogger.getEntries();
      // Should only get the valid entries
      expect(entries).toHaveLength(2);
      expect(entries[0]!.id).toBe('valid1');
      expect(entries[1]!.id).toBe('valid2');
    });
  });

  describe('Performance Characteristics', () => {
    it('should maintain O(1) append performance with large audit logs', async () => {
      // Create a large existing NDJSON file
      const largeContent = [];
      for (let i = 0; i < 1000; i++) {
        largeContent.push(JSON.stringify({
          id: `audit-old-${i}`,
          timestamp: new Date().toISOString(),
          operation: 'create',
          tableId: `table${i}`,
          recordId: `rec${i}`,
          hash: `hash${i}`,
          reversalInstructions: { operation: 'delete', tableId: `table${i}`, recordId: `rec${i}` },
        }));
      }
      await fs.writeFile(ndjsonFile, largeContent.join('\n') + '\n', 'utf8');

      // Time the append operation
      const startTime = Date.now();
      await auditLogger.logMutation({
        operation: 'create',
        tableId: 'perf_test',
        recordId: 'perf_rec',
        payload: { performance: true },
        result: { id: 'perf_rec' },
        reversalInstructions: { operation: 'delete', tableId: 'perf_test', recordId: 'perf_rec' },
      });
      const appendTime = Date.now() - startTime;

      // Append should be very fast (< 50ms even with large file)
      expect(appendTime).toBeLessThan(50);

      // Verify entry was added
      const fileContent = await fs.readFile(ndjsonFile, 'utf8');
      const lines = fileContent.trim().split('\n');
      expect(lines).toHaveLength(1001);
    });
  });
});
