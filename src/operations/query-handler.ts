// Phoenix Rebuild: QueryHandler Implementation (GREEN Phase)
// Contract: QUERY-001 - List records by table ID
// TDD Phase: RED → GREEN (minimal code to pass tests)

import type { SmartSuiteClient, SmartSuiteListOptions } from '../smartsuite-client.js';
// TEST-FIRST-BYPASS: Test exists at test/unit/operations/query-handler.test.ts (7 tests GREEN)

/**
 * Operation context for query execution
 * Mirrors the test contract expectations
 */
export interface QueryContext {
  operation: 'list' | 'get' | 'search' | 'count';
  tableId: string;
  recordId?: string;
  limit?: number;
  offset?: number;
  filters?: Record<string, unknown>;
}

/**
 * Query result structure matching test expectations
 * Tests expect operation/tableId to be echoed back
 */
export interface QueryResult {
  operation: string;
  tableId: string;
  records?: unknown[];
  record?: unknown;
  count?: number;
  limit?: number | undefined;
  offset?: number | undefined;
  filters?: Record<string, unknown> | undefined;
}

/**
 * QueryHandler - Minimal implementation for QUERY-001 contract
 *
 * Architecture: QueryHandler → SmartSuiteClient → SmartSuite API
 *
 * Responsibilities:
 * - Transform operation context to SmartSuite client calls
 * - Echo operation metadata back to caller (test requirement)
 * - Delegate all API communication to SmartSuiteClient
 */
export class QueryHandler {
  private client: SmartSuiteClient | null = null;

  /**
   * Execute query operation based on context
   * Minimal implementation to satisfy test contract
   */
  async execute(context: QueryContext): Promise<QueryResult> {
    const { operation, tableId, recordId, limit, offset, filters } = context;

    // Validate required parameters
    if (!tableId || typeof tableId !== 'string') {
      throw new Error('Invalid table ID');
    }

    // Lazy load client (allows tests to run without real auth)
    if (!this.client) {
      // In production, this would inject real SmartSuiteClient
      // For now, tests will mock this or we'll get runtime error
      throw new Error('SmartSuiteClient not initialized');
    }

    // Route to appropriate operation
    switch (operation) {
      case 'get':
        return this.handleGet(tableId, recordId);

      case 'count':
        return this.handleCount(tableId, filters);

      case 'search':
        return this.handleSearch(tableId, limit, offset, filters);

      case 'list':
      default:
        return this.handleList(tableId, limit, offset);
    }
  }

  /**
   * Handle list operation - return array of records
   */
  private async handleList(tableId: string, limit?: number, offset?: number): Promise<QueryResult> {
    const options: SmartSuiteListOptions = {
      limit: limit ?? 5, // Default to 5 for token safety
      offset: offset ?? 0,
    };

    const response = await this.client!.listRecords(tableId, options);

    return {
      operation: 'list',
      tableId,
      records: response.items,
      limit: options.limit,
      offset: options.offset,
    };
  }

  /**
   * Handle get operation - return single record
   */
  private async handleGet(tableId: string, recordId?: string): Promise<QueryResult> {
    if (!recordId) {
      throw new Error('Record ID required for get operation');
    }

    const record = await this.client!.getRecord(tableId, recordId);

    return {
      operation: 'get',
      tableId,
      record,
    };
  }

  /**
   * Handle search operation - filter records by criteria
   */
  private async handleSearch(
    tableId: string,
    limit?: number,
    offset?: number,
    filters?: Record<string, unknown>,
  ): Promise<QueryResult> {
    const options: SmartSuiteListOptions = {
      limit: limit ?? 5,
      offset: offset ?? 0,
      ...(filters && { filter: filters }),
    };

    const response = await this.client!.listRecords(tableId, options);

    return {
      operation: 'search',
      tableId,
      records: response.items,
      filters,
    };
  }

  /**
   * Handle count operation - return total record count
   */
  private async handleCount(
    tableId: string,
    filters?: Record<string, unknown>,
  ): Promise<QueryResult> {
    const options: SmartSuiteListOptions | undefined = filters ? { filter: filters } : undefined;
    const count = await this.client!.countRecords(tableId, options);

    return {
      operation: 'count',
      tableId,
      count,
    };
  }

  /**
   * Set SmartSuite client (for dependency injection)
   * Allows tests to inject mocks
   */
  setClient(client: SmartSuiteClient): void {
    this.client = client;
  }
}
