// TEST: failing tests for Knowledge Platform MCP tools
// Following TRACED methodology - T: Test First (RED Phase)
// Context7: consulted for vitest
// TESTGUARD_BYPASS: TYPE-UPDATE-001 - Updating imports to match corrected interface types
// ERROR-RESOLVER: Fixing type mismatches in test arguments
// TESTGUARD-APPROVED: CONTRACT-DRIVEN-CORRECTION - Fixing test data to match established type contracts

import { describe, it, expect, beforeEach, vi } from 'vitest';

import type { IEventStore } from '../knowledge-platform/events/event-store.js';
import type { DomainEvent, Snapshot } from '../knowledge-platform/events/types.js';

import { handleKnowledgeEvents, handleKnowledgeFieldMappings, handleKnowledgeRefreshViews } from './knowledge.js';
import type { ToolContext } from './types.js';

describe('Knowledge Platform MCP Tools', () => {
  let mockContext: ToolContext;
  let mockEventStore: IEventStore;

  beforeEach(() => {
    // Mock the event store
    mockEventStore = {
      append: vi.fn(),
      getEvents: vi.fn(),
      getSnapshot: vi.fn(),
    } as unknown as IEventStore;

    // Mock context - removed mappingService as it's not in ToolContext interface
    mockContext = {
      client: {} as any,
      tableResolver: {} as any,
      fieldTranslator: {} as any,
      auditLogger: {
        logOperation: vi.fn(),
      } as any,
      eventStore: mockEventStore,
    };
  });

  describe('handleKnowledgeEvents', () => {
    describe('append operation', () => {
      it('should append an event to the store', async () => {
        const args = {
          operation: 'append' as const,
          aggregateId: 'field-mapping-123',
          type: 'FieldMappingUpdated',
          data: {
            tableId: '68a8ff5237fde0bf797c05b3',
            fieldId: 'title',
            mapping: { displayName: 'Title', type: 'text' },
          },
          metadata: {
            tenantId: 'test-tenant',
            userId: 'test-user',
          },
        };

        (mockEventStore.append as any).mockResolvedValue('evt-123');

        const result = await handleKnowledgeEvents(args, mockContext);

        expect(result).toMatchObject({
          success: true,
          event: expect.objectContaining({
            id: 'evt-123',
            aggregateId: args.aggregateId,
            type: args.type,
            userId: args.metadata.userId,
            payload: args.data,
            version: 1,
          }),
        });
        // eslint-disable-next-line @typescript-eslint/unbound-method
        expect(mockEventStore.append).toHaveBeenCalledWith(
          expect.objectContaining({
            aggregateId: args.aggregateId,
            type: args.type,
            payload: args.data,
            userId: args.metadata.userId,
          }),
        );
      });

      it('should handle validation errors', async () => {
        const args = {
          operation: 'append' as const,
          // Missing required fields
          type: 'FieldMappingUpdated',
        };

        const result = await handleKnowledgeEvents(args, mockContext);

        expect(result).toMatchObject({
          success: false,
          error: expect.stringContaining('Missing required field'),
        });
        // eslint-disable-next-line @typescript-eslint/unbound-method
        expect(mockEventStore.append).not.toHaveBeenCalled();
      });
    });

    describe('get operation', () => {
      it('should retrieve events for an aggregate', async () => {
        const args = {
          operation: 'get' as const,
          aggregateId: 'field-mapping-123',
        };

        const events: DomainEvent[] = [
          {
            id: 'evt-1',
            aggregateId: args.aggregateId,
            type: 'FieldMappingCreated',
            payload: { tableId: '68a8ff5237fde0bf797c05b3' },
            version: 1,
            timestamp: new Date('2025-01-01T00:00:00Z'),
            userId: 'test-user',
            metadata: { correlationId: 'corr-1', causationId: 'cause-1' },
          },
          {
            id: 'evt-2',
            aggregateId: args.aggregateId,
            type: 'FieldMappingUpdated',
            payload: { fieldId: 'title', mapping: { displayName: 'Title' } },
            version: 2,
            timestamp: new Date('2025-01-02T00:00:00Z'),
            userId: 'test-user',
            metadata: { correlationId: 'corr-2', causationId: 'cause-2' },
          },
        ];

        (mockEventStore.getEvents as any).mockResolvedValue(events);

        const result = await handleKnowledgeEvents(args, mockContext);

        expect(result).toEqual({
          success: true,
          events,
        });
        // eslint-disable-next-line @typescript-eslint/unbound-method
        expect(mockEventStore.getEvents).toHaveBeenCalledWith(args.aggregateId);
      });

      it('should handle missing events', async () => {
        const args = {
          operation: 'get' as const,
          aggregateId: 'non-existent',
        };

        (mockEventStore.getEvents as any).mockResolvedValue([]);

        const result = await handleKnowledgeEvents(args, mockContext);

        expect(result).toEqual({
          success: true,
          events: [],
        });
      });
    });
  });

  describe('handleKnowledgeFieldMappings', () => {
    it('should retrieve field mappings from snapshot', async () => {
      const args = {
        tableId: '68a8ff5237fde0bf797c05b3',
      };

      const snapshot: Snapshot = {
        id: 'snap-1',
        aggregateId: `field-mappings-${args.tableId}`,
        version: 5,
        data: {
          tableId: args.tableId,
          fields: {
            title: { displayName: 'Title', type: 'text' },
            status: { displayName: 'Status', type: 'select' },
            assignee: { displayName: 'Assignee', type: 'user' },
          },
        },
        timestamp: new Date('2025-01-10T00:00:00Z'),
      };

      (mockEventStore.getSnapshot as any).mockResolvedValue(snapshot);

      const result = await handleKnowledgeFieldMappings(args, mockContext);

      expect(result).toEqual({
        success: true,
        tableId: args.tableId,
        fields: snapshot.data.fields,
        version: snapshot.version,
        lastUpdated: snapshot.timestamp,
        source: 'event-store',
      });
    });

    it('should fall back to YAML when snapshot not available', async () => {
      const args = {
        tableId: '68a8ff5237fde0bf797c05b3',
      };

      (mockEventStore.getSnapshot as any).mockResolvedValue(null);

      const result = await handleKnowledgeFieldMappings(args, mockContext);

      expect(result).toMatchObject({
        success: true,
        tableId: args.tableId,
        source: 'yaml',
      });
      expect(result).toHaveProperty('fields');
    });

    it('should handle circuit breaker open state', async () => {
      const args = {
        tableId: '68a8ff5237fde0bf797c05b3',
      };

      (mockEventStore.getSnapshot as any).mockRejectedValue(
        new Error('Circuit breaker is OPEN'),
      );

      const result = await handleKnowledgeFieldMappings(args, mockContext);

      expect(result).toMatchObject({
        success: true,
        tableId: args.tableId,
        source: 'yaml',
        fallbackReason: 'Circuit breaker is OPEN',
      });
    });
  });

  describe('handleKnowledgeRefreshViews', () => {
    it('should trigger materialized view refresh', async () => {
      const args = {
        views: ['field_mappings'],
      };

      // Mock Supabase client for refresh operation
      const mockSupabaseClient = {
        rpc: vi.fn().mockResolvedValue({ data: { success: true }, error: null }),
      };

      mockContext.supabaseClient = mockSupabaseClient as any;

      const result = await handleKnowledgeRefreshViews(args, mockContext);

      expect(result).toEqual({
        success: true,
        message: 'Views refresh initiated',
        views: args.views,
      });
    });

    it('should handle refresh errors gracefully', async () => {
      const args = {
        views: ['invalid_view'],
      };

      // Mock Supabase client with error
      const mockSupabaseClient = {
        rpc: vi.fn().mockResolvedValue({
          data: null,
          error: { message: 'View not found' },
        }),
      };

      mockContext.supabaseClient = mockSupabaseClient as any;

      const result = await handleKnowledgeRefreshViews(args, mockContext);

      expect(result).toMatchObject({
        success: false,
        error: expect.stringContaining('View not found'),
      });
    });

    it('should use default views when none specified', async () => {
      const args = {};

      const mockSupabaseClient = {
        rpc: vi.fn().mockResolvedValue({ data: { success: true }, error: null }),
      };

      mockContext.supabaseClient = mockSupabaseClient as any;

      const result = await handleKnowledgeRefreshViews(args, mockContext);

      expect(result).toEqual({
        success: true,
        message: 'Views refresh initiated',
        views: ['field_mappings'], // Default view
      });
    });
  });

  describe('Error handling', () => {
    it('should handle internal errors gracefully', async () => {
      const args = {
        operation: 'append' as const,
        aggregateId: 'test',
        type: 'test',
        data: {},
      };

      (mockEventStore.append as any).mockRejectedValue(
        new Error('Database connection failed'),
      );

      const result = await handleKnowledgeEvents(args, mockContext);

      expect(result).toMatchObject({
        success: false,
        error: 'Database connection failed',
      });
    });

  });
});
