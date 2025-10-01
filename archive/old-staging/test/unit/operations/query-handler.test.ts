// Phoenix Test Contract: QUERY-001
// Contract: List records by table ID
// Status: GREEN (implementation complete)
// Source: docs/412-DOC-TEST-CONTRACTS.md
// TDD Phase: RED → GREEN (minimal implementation to pass tests)

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { SmartSuiteClient } from '../../../src/smartsuite-client.js';

describe('QueryHandler', () => {
  let mockClient: SmartSuiteClient;

  beforeEach(() => {
    // Create mock SmartSuite client with all required methods
    mockClient = {
      apiKey: 'test-key',
      workspaceId: 'test-workspace',
      listRecords: vi.fn(),
      getRecord: vi.fn(),
      countRecords: vi.fn(),
      createRecord: vi.fn(),
      updateRecord: vi.fn(),
      deleteRecord: vi.fn(),
      getSchema: vi.fn(),
      request: vi.fn(),
    };
  });

  describe('listRecords', () => {
    it('should return records for valid table ID', async () => {
      // CONTRACT: Given a valid table ID, return array of records

      // Arrange
      const { QueryHandler } = await import('../../../src/operations/query-handler.js');
      const tableId = '68a8ff5237fde0bf797c05b3'; // Primary test table

      vi.mocked(mockClient.listRecords).mockResolvedValue({
        items: [{ id: '1', title: 'Test Record' }],
        total: 1,
        offset: 0,
        limit: 5,
      });

      // Act
      const handler = new QueryHandler();
      handler.setClient(mockClient);
      const result = await handler.execute({
        operation: 'list',
        tableId,
      });

      // Assert
      expect(result).toBeDefined();
      expect(result.records).toBeInstanceOf(Array);
      expect(result.operation).toBe('list');
      expect(result.tableId).toBe(tableId);
    });

    it('should respect limit parameter for token safety', async () => {
      // CONTRACT: Default limit is 5 for MCP context optimization

      // Arrange
      const { QueryHandler } = await import('../../../src/operations/query-handler.js');
      const tableId = '68a8ff5237fde0bf797c05b3';

      vi.mocked(mockClient.listRecords).mockResolvedValue({
        items: [
          { id: '1', title: 'Record 1' },
          { id: '2', title: 'Record 2' },
          { id: '3', title: 'Record 3' },
        ],
        total: 3,
        offset: 0,
        limit: 5,
      });

      // Act
      const handler = new QueryHandler();
      handler.setClient(mockClient);
      const result = await handler.execute({
        operation: 'list',
        tableId,
        limit: 5,
      });

      // Assert
      expect(result.records!.length).toBeLessThanOrEqual(5);
      expect(result.limit).toBe(5);
    });

    it('should support offset for pagination', async () => {
      // CONTRACT: Offset/limit pagination support

      // Arrange
      const { QueryHandler } = await import('../../../src/operations/query-handler.js');
      const tableId = '68a8ff5237fde0bf797c05b3';

      vi.mocked(mockClient.listRecords).mockResolvedValue({
        items: [
          { id: '11', title: 'Record 11' },
          { id: '12', title: 'Record 12' },
          { id: '13', title: 'Record 13' },
        ],
        total: 100,
        offset: 10,
        limit: 3,
      });

      // Act
      const handler = new QueryHandler();
      handler.setClient(mockClient);
      const result = await handler.execute({
        operation: 'list',
        tableId,
        limit: 3,
        offset: 10,
      });

      // Assert
      expect(result.offset).toBe(10);
      expect(result.limit).toBe(3);
    });

    it('should throw error for invalid table ID', async () => {
      // CONTRACT: Fail fast for non-existent tables

      // Arrange
      const { QueryHandler } = await import('../../../src/operations/query-handler.js');
      const invalidTableId = 'nonexistent-table-id';

      vi.mocked(mockClient.listRecords).mockRejectedValue(
        new Error('Failed to list records: Table not found'),
      );

      // Act & Assert
      const handler = new QueryHandler();
      handler.setClient(mockClient);
      await expect(
        handler.execute({
          operation: 'list',
          tableId: invalidTableId,
        }),
      ).rejects.toThrow(/table.*not found/i);
    });
  });

  describe('getRecord', () => {
    it('should retrieve single record by ID', async () => {
      // CONTRACT: Get operation returns one record

      // Arrange
      const { QueryHandler } = await import('../../../src/operations/query-handler.js');
      const tableId = '68a8ff5237fde0bf797c05b3';
      const recordId = 'test-record-id';

      vi.mocked(mockClient.getRecord).mockResolvedValue({
        id: recordId,
        title: 'Test Record',
        status: 'active',
      });

      // Act
      const handler = new QueryHandler();
      handler.setClient(mockClient);
      const result = await handler.execute({
        operation: 'get',
        tableId,
        recordId,
      });

      // Assert
      expect(result.record).toBeDefined();
      expect(result.record).toHaveProperty('id', recordId);
      expect(result.operation).toBe('get');
    });
  });

  describe('searchRecords', () => {
    it('should filter records by search criteria', async () => {
      // CONTRACT: Search operation applies filters

      // Arrange
      const { QueryHandler } = await import('../../../src/operations/query-handler.js');
      const tableId = '68a8ff5237fde0bf797c05b3';
      const filters = {
        projectName: 'Phoenix',
      };

      vi.mocked(mockClient.listRecords).mockResolvedValue({
        items: [
          { id: '1', projectName: 'Phoenix', title: 'Phoenix Task 1' },
          { id: '2', projectName: 'Phoenix', title: 'Phoenix Task 2' },
        ],
        total: 2,
        offset: 0,
        limit: 5,
      });

      // Act
      const handler = new QueryHandler();
      handler.setClient(mockClient);
      const result = await handler.execute({
        operation: 'search',
        tableId,
        filters,
      });

      // Assert
      expect(result.records).toBeInstanceOf(Array);
      expect(result.operation).toBe('search');
      expect(result.filters).toEqual(filters);
    });
  });

  describe('countRecords', () => {
    it('should return total record count', async () => {
      // CONTRACT: Count operation returns number

      // Arrange
      const { QueryHandler } = await import('../../../src/operations/query-handler.js');
      const tableId = '68a8ff5237fde0bf797c05b3';

      vi.mocked(mockClient.countRecords).mockResolvedValue(42);

      // Act
      const handler = new QueryHandler();
      handler.setClient(mockClient);
      const result = await handler.execute({
        operation: 'count',
        tableId,
      });

      // Assert
      expect(result.count).toBeTypeOf('number');
      expect(result.count).toBeGreaterThanOrEqual(0);
      expect(result.operation).toBe('count');
    });
  });
});
