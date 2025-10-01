// Context7: consulted for vitest
import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest';

import type { SmartSuiteClient } from '../smartsuite-client.js';

import { SmartSuiteAPIProxy } from './api-proxy.js';
import { KnowledgeLibrary } from './knowledge-library.js';
import { SafetyEngine } from './safety-engine.js';
import type { IntelligentToolInput } from './types.js';

describe('SmartSuiteAPIProxy', () => {
  let proxy: SmartSuiteAPIProxy;
  let mockClient: Partial<SmartSuiteClient>;
  let mockKnowledgeLibrary: Partial<KnowledgeLibrary>;
  let mockSafetyEngine: Partial<SafetyEngine>;

  beforeEach(() => {
    // Mock SmartSuiteClient
    mockClient = {
      request: vi.fn(),
    };

    // Mock KnowledgeLibrary
    mockKnowledgeLibrary = {
      findRelevantKnowledge: vi.fn().mockReturnValue([]),
    };

    // Mock SafetyEngine
    mockSafetyEngine = {
      assess: vi.fn().mockReturnValue({
        level: 'GREEN',
        warnings: [],
        recommendations: [],
      }),
    };

    proxy = new SmartSuiteAPIProxy(
      mockClient as SmartSuiteClient,
      mockKnowledgeLibrary as KnowledgeLibrary,
      mockSafetyEngine as SafetyEngine,
    );
  });

  describe('executeOperation', () => {
    it('should execute API call directly for GREEN safety level', async () => {
      const input: IntelligentToolInput = {
        mode: 'execute',
        endpoint: '/applications/{id}/records/list/',
        method: 'POST',
        tableId: 'test-table-id',
        payload: { filter: {} },
        operation_description: 'List records',
      };

      (mockClient.request as Mock).mockResolvedValue({ items: [] });

      const result = await proxy.executeOperation(input);

      expect(result.success).toBe(true);
      expect(result.mode).toBe('execute');
      expect(result.result).toEqual({ items: [] });
      expect(mockClient.request).toHaveBeenCalledWith({
        method: 'POST',
        endpoint: '/applications/test-table-id/records/list/',
        data: { filter: {} },
      });
    });

    it('should require confirmation for RED safety level', async () => {
      const input: IntelligentToolInput = {
        mode: 'execute',
        endpoint: '/applications/{id}/delete/',
        method: 'DELETE',
        tableId: 'test-table-id',
        operation_description: 'Delete table',
        confirmed: false,
      };

      (mockSafetyEngine.assess as Mock).mockReturnValue({
        level: 'RED',
        warnings: ['This will permanently delete the table'],
        recommendations: ['Ensure you have a backup'],
      });

      const result = await proxy.executeOperation(input);

      expect(result.success).toBe(false);
      expect(result.error).toContain('requires confirmation');
      expect(result.analysis?.requiresConfirmation).toBe(true);
      expect(mockClient.request).not.toHaveBeenCalled();
    });

    it('should apply knowledge-based corrections', async () => {
      const input: IntelligentToolInput = {
        mode: 'execute',
        endpoint: '/applications/{id}/records',
        method: 'GET', // Wrong method
        tableId: 'test-table-id',
        operation_description: 'List records',
      };

      // Mock knowledge with correction
      (mockKnowledgeLibrary.findRelevantKnowledge as Mock).mockReturnValue([
        {
          entry: {
            pattern: 'GET.*/records',
            safetyLevel: 'YELLOW',
            correction: {
              method: { from: 'GET', to: 'POST' },
              endpoint: { from: '/records', to: '/records/list/' },
            },
          },
          score: 1.0,
        },
      ]);

      (mockClient.request as Mock).mockResolvedValue({ items: [] });

      const result = await proxy.executeOperation(input);

      expect(result.success).toBe(true);
      expect(result.analysis?.appliedCorrections).toContain('HTTP method: GET → POST');
      expect(mockClient.request).toHaveBeenCalledWith({
        method: 'POST',
        endpoint: '/applications/test-table-id/records/list/',
        data: undefined,
      });
    });

    it('should handle API errors gracefully', async () => {
      const input: IntelligentToolInput = {
        mode: 'execute',
        endpoint: '/invalid/endpoint',
        method: 'POST',
        operation_description: 'Invalid operation',
      };

      (mockClient.request as Mock).mockRejectedValue(new Error('404 Not Found'));

      const result = await proxy.executeOperation(input);

      expect(result.success).toBe(false);
      expect(result.error).toBe('404 Not Found');
      expect(result.analysis?.failureMode).toBe('ENDPOINT_NOT_FOUND');
    });

    it('should apply parameter corrections for UUID preservation', async () => {
      const input: IntelligentToolInput = {
        mode: 'execute',
        endpoint: '/applications/{id}/change_field/',
        method: 'POST',
        tableId: 'test-table-id',
        payload: {
          field_id: 'status',
          options: ['Option1', 'Option2'], // Wrong parameter
        },
        operation_description: 'Update status field',
      };

      // Mock knowledge with parameter correction
      (mockKnowledgeLibrary.findRelevantKnowledge as Mock).mockReturnValue([
        {
          entry: {
            pattern: '/change_field.*singleselectfield',
            safetyLevel: 'RED',
            correction: {
              parameters: { from: 'options', to: 'choices' },
            },
          },
          score: 1.0,
        },
      ]);

      (mockClient.request as Mock).mockResolvedValue({ success: true });

      const result = await proxy.executeOperation(input);

      expect(result.success).toBe(true);
      expect(mockClient.request).toHaveBeenCalledWith({
        method: 'POST',
        endpoint: '/applications/test-table-id/change_field/',
        data: {
          field_id: 'status',
          choices: ['Option1', 'Option2'], // Corrected parameter
        },
      });
    });
  });

  describe('performDryRun', () => {
    it('should validate operation without executing', async () => {
      const input: IntelligentToolInput = {
        mode: 'dry_run',
        endpoint: '/applications/{id}/records/list/',
        method: 'POST',
        tableId: 'test-table-id',
        operation_description: 'List records',
      };

      // Mock connectivity check
      (mockClient.request as Mock).mockResolvedValue({});

      const result = await proxy.performDryRun(input);

      expect(result.success).toBe(true);
      expect(result.mode).toBe('dry_run');
      expect(result.analysis?.connectivityValid).toBe(true);
      expect(result.analysis?.wouldExecute).toBe(true);

      // Should only call for connectivity check, not actual operation
      expect(mockClient.request).toHaveBeenCalledTimes(1);
      expect(mockClient.request).toHaveBeenCalledWith({
        method: 'GET',
        endpoint: '/solutions/',
      });
    });

    it('should indicate when operation would be blocked', async () => {
      const input: IntelligentToolInput = {
        mode: 'dry_run',
        endpoint: '/applications/{id}/delete/',
        method: 'DELETE',
        tableId: 'test-table-id',
        operation_description: 'Delete table',
        confirmed: false,
      };

      (mockSafetyEngine.assess as Mock).mockReturnValue({
        level: 'RED',
        warnings: ['Destructive operation'],
        recommendations: ['Ensure backup exists'],
      });

      (mockClient.request as Mock).mockResolvedValue({});

      const result = await proxy.performDryRun(input);

      expect(result.success).toBe(true);
      expect(result.analysis?.wouldExecute).toBe(false);
      expect(result.analysis?.warnings).toContain('Destructive operation');
    });
  });

  describe('edge cases', () => {
    it('should handle missing tableId in endpoint', async () => {
      const input: IntelligentToolInput = {
        mode: 'execute',
        endpoint: '/solutions/',
        method: 'GET',
        operation_description: 'List solutions',
      };

      (mockClient.request as Mock).mockResolvedValue({ solutions: [] });

      const result = await proxy.executeOperation(input);

      expect(result.success).toBe(true);
      expect(mockClient.request).toHaveBeenCalledWith({
        method: 'GET',
        endpoint: '/solutions/',
        data: undefined,
      });
    });

    it('should add leading slash if missing', async () => {
      const input: IntelligentToolInput = {
        mode: 'execute',
        endpoint: 'applications/{id}/records/list/',
        method: 'POST',
        tableId: 'test-table-id',
        operation_description: 'List records',
      };

      (mockClient.request as Mock).mockResolvedValue({ items: [] });

      await proxy.executeOperation(input);

      expect(mockClient.request).toHaveBeenCalledWith({
        method: 'POST',
        endpoint: '/applications/test-table-id/records/list/',
        data: undefined,
      });
    });
  });
});

