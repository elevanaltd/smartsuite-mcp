// Context7: consulted for vitest
import { describe, it, expect, beforeEach, vi } from 'vitest';

import type { SmartSuiteClient } from '../smartsuite-client.js';

import { IntelligentOperationHandler } from './intelligent-operation-handler.js';
import { KnowledgeLibrary } from './knowledge-library.js';
import { SafetyEngine } from './safety-engine.js';
// TESTGUARD_BYPASS: Fixing TypeScript compilation - removing unused OperationMode, adding KnowledgeMatch for proper typing
import type { IntelligentToolInput, KnowledgeMatch } from './types.js';

describe('IntelligentOperationHandler', () => {
  let handler: IntelligentOperationHandler;
  let mockKnowledgeLibrary: KnowledgeLibrary;
  let mockSafetyEngine: SafetyEngine;

  beforeEach(() => {
    // TESTGUARD-APPROVED: TESTGUARD-20250909-379dd489
    // Fixing mock to match KnowledgeVersion interface - contract compliance
    mockKnowledgeLibrary = {
      findRelevantKnowledge: vi.fn().mockReturnValue([]),
      learnFromOperation: vi.fn(),
      getVersion: vi.fn().mockReturnValue({
        version: '1.0.0',
        patternCount: 14,
        lastUpdated: new Date().toISOString(),
        compatibility: 'v1',
      }),
      getPatternCount: vi.fn().mockReturnValue(14),
    } as any;

    mockSafetyEngine = {
      assess: vi.fn().mockReturnValue({
        level: 'GREEN',
        warnings: [],
        canProceed: true,
        requiresConfirmation: false,
        protocols: [],
      }),
      validateCriticalProtocols: vi.fn(),
      generateWarnings: vi.fn(),
    } as any;

    handler = new IntelligentOperationHandler(mockKnowledgeLibrary, mockSafetyEngine);
  });

  describe('handleIntelligentOperation', () => {
    describe('learn mode', () => {
      it('should return learning response for known patterns', async () => {
        const input: IntelligentToolInput = {
          mode: 'learn',
          endpoint: '/applications/123/records/list/',
          method: 'GET',
          operation_description: 'List all records',
        };

        const mockKnowledge: KnowledgeMatch[] = [{
          entry: {
            pattern: /GET.*\/records/,
            safetyLevel: 'RED' as const,
            failureModes: [{
              description: 'Wrong HTTP method for record listing',
              cause: 'Using GET instead of POST for /records/list/',
              prevention: 'Always use POST /applications/{id}/records/list/',
              exampleError: '404 Not Found',
            }],
            protocols: [],
            examples: [],
            validationRules: [],
            templates: [],
          },
          confidence: 0.9,
          matchReason: 'Wrong HTTP method detected',
        }];

        const mockAssessment = {
          level: 'RED' as const,
          warnings: ['CRITICAL: Wrong HTTP method detected'],
          canProceed: false,
          requiresConfirmation: false,
          protocols: [],
        };

        // TEST-METHODOLOGY-GUARDIAN-20250909-17574053
        vi.spyOn(mockKnowledgeLibrary, 'findRelevantKnowledge').mockReturnValue(mockKnowledge);
        vi.spyOn(mockSafetyEngine, 'assess').mockReturnValue(mockAssessment);

        // TESTGUARD-APPROVED: TESTGUARD-20250909-4e46140e
        const result = await handler.handleIntelligentOperation(input);

        expect(result.mode).toBe('learn');
        expect(result.status).toBe('analyzed');
        expect(result.knowledge_applied).toBe(true);
        expect(result.safety_assessment?.level).toBe('RED');
        expect(result.guidance).toContain('POST');
        expect(result.suggested_correction).toBeDefined();
        expect(result.suggested_correction?.method).toBe('POST');
      });

      it('should provide guidance for unknown patterns', async () => {
        const input: IntelligentToolInput = {
          mode: 'learn',
          endpoint: '/unknown/endpoint',
          method: 'POST',
          operation_description: 'Unknown operation',
        };

        // TEST-METHODOLOGY-GUARDIAN-20250909-17574053
        vi.spyOn(mockKnowledgeLibrary, 'findRelevantKnowledge').mockReturnValue([]);
        vi.spyOn(mockSafetyEngine, 'assess').mockReturnValue({
          level: 'GREEN' as const,
          warnings: [],
          canProceed: true,
          requiresConfirmation: false,
          protocols: [],
        });

        // TESTGUARD-APPROVED: TESTGUARD-20250909-4e46140e
        const result = await handler.handleIntelligentOperation(input);

        expect(result.mode).toBe('learn');
        expect(result.status).toBe('analyzed');
        expect(result.knowledge_applied).toBe(false);
        expect(result.guidance).toContain('No known patterns');
      });

      it('should include performance metrics', async () => {
        const input: IntelligentToolInput = {
          mode: 'learn',
          endpoint: '/test',
          method: 'GET',
          operation_description: 'Test operation',
        };

        // TEST-METHODOLOGY-GUARDIAN-20250909-17574053
        vi.spyOn(mockKnowledgeLibrary, 'findRelevantKnowledge').mockReturnValue([]);
        vi.spyOn(mockSafetyEngine, 'assess').mockReturnValue({
          level: 'GREEN' as const,
          warnings: [],
          canProceed: true,
          requiresConfirmation: false,
          protocols: [],
        });

        // TESTGUARD-APPROVED: TESTGUARD-20250909-4e46140e
        const result = await handler.handleIntelligentOperation(input);

        expect(result.performance_ms).toBeDefined();
        expect(result.performance_ms).toBeLessThan(100);
      });

      it('should handle UUID corruption prevention', async () => {
        const input: IntelligentToolInput = {
          mode: 'learn',
          endpoint: '/applications/123/fields/status/change_field',
          method: 'PUT',
          payload: {
            type: 'singleselectfield',
            options: ['Option1', 'Option2'],
          },
          operation_description: 'Update status field options',
        };

        const mockKnowledge: KnowledgeMatch[] = [{
          entry: {
            pattern: /singleselectfield.*options/,
            safetyLevel: 'RED' as const,
            failureModes: [{
              description: 'UUID Corruption',
              cause: 'Using "options" parameter destroys existing UUIDs',
              prevention: 'Use "choices" parameter instead of "options"',
              safeAlternative: 'payload.choices = [...]; delete payload.options;',
            }],
            protocols: [],
            examples: [],
            validationRules: [],
            templates: [],
          },
          confidence: 1.0,
          matchReason: 'Critical UUID corruption risk detected',
        }];
        // TEST-METHODOLOGY-GUARDIAN-20250909-17574053
        vi.spyOn(mockKnowledgeLibrary, 'findRelevantKnowledge').mockReturnValue(mockKnowledge);
        vi.spyOn(mockSafetyEngine, 'assess').mockReturnValue({
          level: 'RED' as const,
          warnings: ['CRITICAL: UUID corruption risk detected'],
          canProceed: false,
          requiresConfirmation: false,
          protocols: [],
        });

        // TESTGUARD-APPROVED: TESTGUARD-20250909-4e46140e
        const result = await handler.handleIntelligentOperation(input);

        expect(result.safety_assessment?.level).toBe('RED');
        expect(result.guidance).toContain('UUID');
        expect(result.suggested_correction?.payload).toHaveProperty('choices');
        expect(result.suggested_correction?.payload).not.toHaveProperty('options');
      });

      it('should handle bulk operation limits', async () => {
        const input: IntelligentToolInput = {
          mode: 'learn',
          endpoint: '/applications/123/records/bulk',
          method: 'POST',
          payload: {
            records: new Array(30).fill({}),
          },
          operation_description: 'Bulk update 30 records',
        };

        const mockKnowledge: KnowledgeMatch[] = [{
          entry: {
            pattern: /\/bulk/,
            safetyLevel: 'YELLOW' as const,
            failureModes: [{
              description: 'Bulk operation limit exceeded',
              cause: 'API limits bulk operations to 25 records',
              prevention: 'Split into batches of 25 or fewer records',
            }],
            protocols: [],
            examples: [],
            validationRules: [],
            templates: [],
          },
          confidence: 0.8,
          matchReason: 'Bulk operation limit warning',
        }];
        // TEST-METHODOLOGY-GUARDIAN-20250909-17574053
        vi.spyOn(mockKnowledgeLibrary, 'findRelevantKnowledge').mockReturnValue(mockKnowledge);
        vi.spyOn(mockSafetyEngine, 'assess').mockReturnValue({
          level: 'YELLOW' as const,
          warnings: ['Bulk operation exceeds 25 record limit'],
          canProceed: false,
          requiresConfirmation: false,
          protocols: [],
        });

        // TESTGUARD-APPROVED: TESTGUARD-20250909-4e46140e
        const result = await handler.handleIntelligentOperation(input);

        expect(result.safety_assessment?.level).toBe('YELLOW');
        expect(result.guidance).toContain('25');
        expect(result.suggested_correction).toBeDefined();
      });
    });

    describe('dry_run mode', () => {
      it('should process dry_run mode successfully', async () => {
        // TESTGUARD-APPROVED: TESTGUARD-20250909-b0203b3c
        // Create mock client for dry_run/execute modes
        const mockClient = {
          request: vi.fn().mockResolvedValue({}),
        } as unknown as SmartSuiteClient;

        // Create handler with client to initialize apiProxy
        const handlerWithClient = new IntelligentOperationHandler(
          mockKnowledgeLibrary,
          mockSafetyEngine,
          mockClient,
        );

        const input: IntelligentToolInput = {
          mode: 'dry_run',
          endpoint: '/test',
          method: 'GET',
          operation_description: 'Test dry run',
        };

        const result = await handlerWithClient.handleIntelligentOperation(input);

        expect(result.success).toBe(true);
        expect(result.mode).toBe('dry_run');
      });
    });

    describe('execute mode', () => {
      it('should process execute mode successfully', async () => {
        // TESTGUARD-APPROVED: TESTGUARD-20250909-93cefbba
        // Create mock client for execute mode
        const mockClient = {
          request: vi.fn().mockResolvedValue({ success: true }),
        } as unknown as SmartSuiteClient;

        // Create handler with client to initialize apiProxy
        const handlerWithClient = new IntelligentOperationHandler(
          mockKnowledgeLibrary,
          mockSafetyEngine,
          mockClient,
        );

        const input: IntelligentToolInput = {
          mode: 'execute',
          endpoint: '/test',
          method: 'GET',
          operation_description: 'Test execute',
        };

        const result = await handlerWithClient.handleIntelligentOperation(input);

        expect(result.success).toBe(true);
        expect(result.mode).toBe('execute');
      });
    });
  });

  describe('generateLearningResponse', () => {
    it('should format response with all required fields', async () => {
      const input: IntelligentToolInput = {
        mode: 'learn',
        endpoint: '/test',
        method: 'GET',
        operation_description: 'Test',
      };

      // TEST-METHODOLOGY-GUARDIAN-20250909-17574053
      vi.spyOn(mockKnowledgeLibrary, 'findRelevantKnowledge').mockReturnValue([]);
      vi.spyOn(mockSafetyEngine, 'assess').mockReturnValue({
        level: 'GREEN' as const,
        warnings: [],
        canProceed: true,
        requiresConfirmation: false,
        protocols: [],
      });

      // TESTGUARD-APPROVED: TESTGUARD-20250909-d7ed17f1
      const result = await handler.handleIntelligentOperation(input);

      expect(result).toHaveProperty('mode');
      expect(result).toHaveProperty('status');
      expect(result).toHaveProperty('endpoint');
      expect(result).toHaveProperty('method');
      expect(result).toHaveProperty('operation_description');
      expect(result).toHaveProperty('knowledge_applied');
      expect(result).toHaveProperty('safety_assessment');
      expect(result).toHaveProperty('guidance');
      expect(result).toHaveProperty('performance_ms');
      expect(result).toHaveProperty('knowledge_version');
    });
  });
});
