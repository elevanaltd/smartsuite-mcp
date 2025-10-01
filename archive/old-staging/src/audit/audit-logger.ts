// TRACED: Implementation after failing tests - GREEN state
// Context7: consulted for fs-extra -> MIGRATED to native fs/promises for MCP compatibility
// Context7: consulted for path
// Context7: consulted for crypto
// Context7: consulted for audit-context - internal module for auth context propagation
// Context7: consulted for stream
// Context7: consulted for stream/promises
// Critical-Engineer: consulted for concurrent file-system access, atomicity, and scaling patterns
// ERROR-ARCHITECT: CRITICAL FIX - Migrated to NDJSON append-only architecture for O(1) performance
// PRODUCTION-CRITICAL: Previous O(N) read-modify-write pattern would deadlock under concurrent load
// SOLUTION: Append-only NDJSON format - each entry is a single line, no locking needed for writes
// CONTEXT7_BYPASS: PROD-CRITICAL-NDJSON - Removing unused imports after NDJSON migration
import { createHash } from 'crypto';
// Context7: consulted for fs
// Context7: consulted for path
import { promises as fs } from 'fs';
import { existsSync } from 'fs';
import * as path from 'path';

import { getCurrentAuditContext } from './audit-context.js';

export interface AuditLogEntry {
  id: string;
  timestamp: Date;
  operation: 'create' | 'update' | 'delete';
  tableId: string;
  recordId: string;
  payload?: Record<string, unknown>;
  result?: Record<string, unknown>;
  beforeData?: Record<string, unknown>;
  reversalInstructions: {
    operation: 'create' | 'update' | 'delete';
    tableId: string;
    recordId?: string;
    payload?: Record<string, unknown>;
  };
  hash: string;
  // Auth context fields - populated from AsyncLocalStorage when available
  authContext?: {
    userId: string;
    sessionId: string;
    requestId: string;
    ipAddress: string;
    timestamp: Date;
  };
}

export interface ComplianceReport {
  standard: 'SOC2' | 'GDPR';
  reportDate: Date;
  totalOperations: number;
  operationsByType: {
    create: number;
    update: number;
    delete: number;
  };
  affectedTables: string[];
  dateRange: {
    from: Date;
    to: Date;
  };
  retentionAnalysis: {
    oldestEntry: Date;
    newestEntry: Date;
    totalEntries: number;
  };
  // GDPR specific fields
  personalDataOperations?: AuditLogEntry[];
  dataSubjects?: string[];
  rightToErasure?: Array<{ recordId: string; tableId: string; reversible: boolean }>;
}

export interface MutationLogInput {
  operation: 'create' | 'update' | 'delete';
  tableId: string;
  recordId: string;
  payload?: Record<string, unknown>;
  result?: Record<string, unknown>;
  beforeData?: Record<string, unknown>;
  reversalInstructions: {
    operation: 'create' | 'update' | 'delete';
    tableId: string;
    recordId?: string;
    payload?: Record<string, unknown>;
  };
}

export class AuditLogger {
  private readonly auditFilePath: string;
  private readonly legacyJsonPath: string;

  constructor(auditFilePath: string) {
    // Use .ndjson extension for new format
    this.auditFilePath = auditFilePath.replace(/\.json$/, '.ndjson');
    // Keep track of legacy JSON file for migration
    this.legacyJsonPath = auditFilePath;
  }

  async logMutation(input: MutationLogInput): Promise<void> {
    this.validateInput(input);

    // Get auth context from AsyncLocalStorage if available
    const authContext = getCurrentAuditContext();

    const entry: AuditLogEntry = {
      id: this.generateEntryId(),
      timestamp: new Date(),
      operation: input.operation,
      tableId: input.tableId,
      recordId: input.recordId,
      ...(input.payload !== undefined && { payload: input.payload }),
      ...(input.result !== undefined && { result: input.result }),
      ...(input.beforeData !== undefined && { beforeData: input.beforeData }),
      reversalInstructions: input.reversalInstructions,
      hash: '', // Will be calculated after serialization
      ...(authContext && { authContext }),
    };

    // Generate hash for integrity verification
    entry.hash = this.calculateEntryHash(entry);

    await this.persistEntry(entry);
  }

  /**
   * Log a mutation with explicit auth context support
   * This method is used by tests and can be called directly when auth context needs to be verified
   */
  async logWithContext(
    tableId: string,
    recordId: string,
    operation: 'create' | 'update' | 'delete',
    payload?: Record<string, unknown>,
    result?: Record<string, unknown>,
    beforeData?: Record<string, unknown>,
  ): Promise<AuditLogEntry> {
    // Get auth context from AsyncLocalStorage
    const authContext = getCurrentAuditContext();

    const entry: AuditLogEntry = {
      id: this.generateEntryId(),
      timestamp: new Date(),
      operation,
      tableId,
      recordId,
      ...(payload !== undefined && { payload }),
      ...(result !== undefined && { result }),
      ...(beforeData !== undefined && { beforeData }),
      reversalInstructions: this.generateReversalInstructions(operation, tableId, recordId, beforeData),
      hash: '',
      ...(authContext && { authContext }),
    };

    // Generate hash for integrity verification
    entry.hash = this.calculateEntryHash(entry);

    await this.persistEntry(entry);
    return entry;
  }

  // TECHNICAL-ARCHITECT-APPROVED: TECHNICAL-ARCHITECT-20250915-arch-175
  private generateReversalInstructions(
    operation: 'create' | 'update' | 'delete',
    tableId: string,
    recordId: string,
    beforeData?: Record<string, unknown>,
  ): AuditLogEntry['reversalInstructions'] {
    switch (operation) {
      case 'create':
        return { operation: 'delete', tableId, recordId };
      case 'update':
        return beforeData
          ? { operation: 'update', tableId, recordId, payload: beforeData }
          : { operation: 'update', tableId, recordId };
      case 'delete':
        return beforeData
          ? { operation: 'create', tableId, recordId, payload: beforeData }
          : { operation: 'create', tableId, recordId };
    }
  }

  async getEntries(): Promise<AuditLogEntry[]> {
    // First, migrate legacy JSON file if it exists
    await this.migrateLegacyIfNeeded();

    if (!existsSync(this.auditFilePath)) {
      return [];
    }

    // Read NDJSON file line by line
    const data = await fs.readFile(this.auditFilePath, 'utf8');
    const lines = data.trim().split('\n').filter(line => line.length > 0);

    const entries: AuditLogEntry[] = [];
    for (const line of lines) {
      try {
        const entry = JSON.parse(line) as unknown;
        entries.push(this.deserializeEntry(entry));
      } catch (_error) {
        // Skip malformed lines (shouldn't happen but handle gracefully)
        // Silently skip to avoid noise in production logs
      }
    }

    return entries;
  }

  async generateComplianceReport(standard: 'SOC2' | 'GDPR'): Promise<ComplianceReport> {
    const entries = await this.getEntries();

    if (entries.length === 0) {
      const now = new Date();
      return {
        standard,
        reportDate: now,
        totalOperations: 0,
        operationsByType: { create: 0, update: 0, delete: 0 },
        affectedTables: [],
        dateRange: { from: now, to: now },
        retentionAnalysis: { oldestEntry: now, newestEntry: now, totalEntries: 0 },
      };
    }

    const operationsByType = entries.reduce(
      (acc, entry) => {
        acc[entry.operation]++;
        return acc;
      },
      { create: 0, update: 0, delete: 0 },
    );

    const affectedTables = Array.from(new Set(entries.map(e => e.tableId)));
    const timestamps = entries.map(e => e.timestamp).sort((a, b) => a.getTime() - b.getTime());
    const firstTimestamp = timestamps[0];
    const lastTimestamp = timestamps[timestamps.length - 1];

    // TypeScript strict mode - ensure timestamps exist before using
    if (!firstTimestamp || !lastTimestamp) {
      throw new Error('Invalid timestamp data in audit entries');
    }

    const baseReport: ComplianceReport = {
      standard,
      reportDate: new Date(),
      totalOperations: entries.length,
      operationsByType,
      affectedTables,
      dateRange: {
        from: firstTimestamp,
        to: lastTimestamp,
      },
      retentionAnalysis: {
        oldestEntry: firstTimestamp,
        newestEntry: lastTimestamp,
        totalEntries: entries.length,
      },
    };

    if (standard === 'GDPR') {
      // Filter for personal data operations (simple heuristic based on common field names)
      const personalDataOperations = entries.filter(entry =>
        this.containsPersonalData(entry.payload) ||
        this.containsPersonalData(entry.beforeData),
      );

      const dataSubjects = Array.from(new Set(entries.map(e => e.recordId)));

      const rightToErasure = entries
        .filter(e => e.operation === 'delete')
        .map(e => ({
          recordId: e.recordId,
          tableId: e.tableId,
          reversible: e.reversalInstructions.operation === 'create',
        }));

      return {
        ...baseReport,
        personalDataOperations,
        dataSubjects,
        rightToErasure,
      };
    }

    return baseReport;
  }

  private validateInput(input: MutationLogInput): void {
    if (!input.tableId || input.tableId.trim() === '') {
      throw new Error('tableId is required');
    }
    if (!input.recordId || input.recordId.trim() === '') {
      throw new Error('recordId is required');
    }
    if (!input.operation || !['create', 'update', 'delete'].includes(input.operation)) {
      throw new Error('operation must be create, update, or delete');
    }
    if (!input.reversalInstructions) {
      throw new Error('reversalInstructions is required');
    }
  }

  private generateEntryId(): string {
    const timestamp = Date.now();
    const randomHex = Math.random().toString(16).substring(2, 10);
    return `audit-${timestamp}-${randomHex}`;
  }

  private calculateEntryHash(entry: Omit<AuditLogEntry, 'hash'>): string {
    const content = JSON.stringify({
      id: entry.id,
      timestamp: entry.timestamp.toISOString(),
      operation: entry.operation,
      tableId: entry.tableId,
      recordId: entry.recordId,
      payload: entry.payload,
      result: entry.result,
      beforeData: entry.beforeData,
      reversalInstructions: entry.reversalInstructions,
    });

    return createHash('sha256').update(content).digest('hex');
  }

  private async persistEntry(entry: AuditLogEntry): Promise<void> {
    // First, migrate legacy JSON file if it exists
    await this.migrateLegacyIfNeeded();

    // Ensure directory exists
    await fs.mkdir(path.dirname(this.auditFilePath), { recursive: true });

    // O(1) append operation - no locking needed!
    // Convert entry to single-line JSON and append with newline
    const line = JSON.stringify(entry) + '\n';

    // Use appendFile for atomic append operation
    await fs.appendFile(this.auditFilePath, line, 'utf8');
  }

  private async migrateLegacyIfNeeded(): Promise<void> {
    // Check if legacy JSON file exists but NDJSON doesn't
    if (existsSync(this.legacyJsonPath) && !existsSync(this.auditFilePath)) {
      try {
        // Read legacy JSON file
        const data = await fs.readFile(this.legacyJsonPath, 'utf8');
        const entries = JSON.parse(data) as unknown[];

        // Convert to NDJSON format
        const ndjsonContent = entries
          .map(entry => JSON.stringify(entry))
          .join('\n') + (entries.length > 0 ? '\n' : '');

        // Write to new NDJSON file
        await fs.writeFile(this.auditFilePath, ndjsonContent, 'utf8');

        // Rename old file to .json.backup to preserve it
        await fs.rename(this.legacyJsonPath, `${this.legacyJsonPath}.backup`);

        // Migration successful - legacy file backed up
      } catch (_error) {
        // Failed to migrate - continue without migration, new entries will use NDJSON
        // Continue without migration - new entries will use NDJSON
      }
    }
  }

  // File locking is no longer needed with append-only NDJSON architecture!
  // The fs.appendFile operation is atomic at the OS level for reasonable append sizes

  private deserializeEntry(rawEntry: unknown): AuditLogEntry {
    const entry = rawEntry as Record<string, unknown>;
    return {
      ...(entry as Omit<AuditLogEntry, 'timestamp'>),
      timestamp: new Date(entry.timestamp as string),
    };
  }

  private containsPersonalData(data?: Record<string, unknown>): boolean {
    if (!data) return false;

    const personalDataFields = ['name', 'email', 'phone', 'address', 'ssn', 'passport', 'dob'];
    const keys = Object.keys(data).map(k => k.toLowerCase());

    return personalDataFields.some(field =>
      keys.some(key => key.includes(field)),
    );
  }
}
