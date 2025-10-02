// Phoenix Test Contract: INTELLIGENT-002
// Contract: Intelligent Handler Analysis and Safety Assessment
// Status: RED (no implementation - TDD RED phase)
// Phase: Phase 2G - Intelligent Tool Handler
// Critical-Engineer Analysis: 002-PHASE-2G-INTELLIGENT-TOOL-ANALYSIS.md

import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('IntelligentHandler', () => {
  describe('dependency injection', () => {
    it('should accept knowledge base via constructor', async () => {
      // CONTRACT: Support dependency injection for testing
      // CRITICAL-ENGINEER: "Dependency injection for knowledge base"

      // Arrange
      const { IntelligentHandler } = await import('../../../src/operations/intelligent-handler.js');
      const { KnowledgeBase } = await import('../../../src/operations/knowledge-base.js');
      const mockKB = new KnowledgeBase([]);

      // Act
      const handler = new IntelligentHandler(mockKB);

      // Assert
      expect(handler).toBeDefined();
      expect(handler.getKnowledgeBase()).toBe(mockKB);
    });

    it('should load default knowledge base when none provided', async () => {
      // CONTRACT: Auto-load from files if no KB injected

      // Arrange
      const { IntelligentHandler } = await import('../../../src/operations/intelligent-handler.js');

      // Act
      const handler = new IntelligentHandler();

      // Assert
      expect(handler).toBeDefined();
      expect(handler.getKnowledgeBase()).toBeDefined();
      expect(handler.getKnowledgeBase().getPatternCount()).toBeGreaterThan(0);
    });
  });

  describe('safety check 1: UUID corruption detection', () => {
    let handler: any;

    beforeEach(async () => {
      const { IntelligentHandler } = await import('../../../src/operations/intelligent-handler.js');
      handler = new IntelligentHandler();
    });

    it('should detect UUID corruption risk with RED safety level', () => {
      // CONTRACT: Detect "options" vs "choices" disaster (EAV September 2025 incident)
      // CRITICAL-ENGINEER: "UUID corruption detection" - SAFETY CHECK #1

      // Arrange
      const operation = {
        endpoint: '/applications/123/change_field/',
        method: 'PUT' as const,
        operation_description: 'Update status field options',
        payload: {
          field_type: 'singleselectfield',
          slug: 'status_field',
          options: ['New Status', 'Another Status'], // ⚠️ DESTROYS UUIDs
        },
      };

      // Act
      const result = handler.analyze(operation);

      // Assert
      expect(result.safety_level).toBe('RED');
      expect(result.warnings).toContain('UUID corruption risk detected');
      expect(result.blockers).toContain('Using "options" parameter will destroy all existing UUIDs');
      expect(result.guidance).toContain('🔴');
      expect(result.guidance).toContain('CRITICAL');
    });

    it('should provide correction for UUID corruption', () => {
      // CONTRACT: Suggest using "choices" parameter with preserved UUIDs

      // Arrange
      const operation = {
        endpoint: '/applications/123/change_field/',
        method: 'PUT' as const,
        operation_description: 'Update status field',
        payload: {
          field_type: 'singleselectfield',
          options: ['Status 1'],
        },
      };

      // Act
      const result = handler.analyze(operation);

      // Assert
      expect(result.suggested_corrections).toBeDefined();
      expect(result.suggested_corrections.length).toBeGreaterThan(0);
      expect(result.suggested_corrections[0].issue).toContain('options');
      expect(result.suggested_corrections[0].fix).toContain('choices');
      expect(result.suggested_corrections[0].corrected_payload).toHaveProperty('choices');
      expect(result.suggested_corrections[0].corrected_payload).not.toHaveProperty('options');
    });

    it('should pass when using correct "choices" parameter', () => {
      // CONTRACT: GREEN when choices parameter used correctly

      // Arrange
      const operation = {
        endpoint: '/applications/123/change_field/',
        method: 'PUT' as const,
        operation_description: 'Update status field correctly',
        payload: {
          field_type: 'singleselectfield',
          choices: [
            { value: 'existing_uuid_1', label: 'Status 1' },
          ],
        },
      };

      // Act
      const result = handler.analyze(operation);

      // Assert
      expect(result.safety_level).not.toBe('RED');
      expect(result.warnings).not.toContain('UUID corruption');
    });
  });

  describe('safety check 2: bulk operation limits', () => {
    let handler: any;

    beforeEach(async () => {
      const { IntelligentHandler } = await import('../../../src/operations/intelligent-handler.js');
      handler = new IntelligentHandler();
    });

    it('should detect bulk operation over 100 records with YELLOW warning', () => {
      // CONTRACT: Warn when >100 records in single operation
      // CRITICAL-ENGINEER: "Bulk operation limits (>100 records warning)" - SAFETY CHECK #2

      // Arrange
      const operation = {
        endpoint: '/applications/123/records/bulk/',
        method: 'POST' as const,
        operation_description: 'Bulk update 150 records',
        payload: {
          records: new Array(150).fill({ id: '123', status: 'active' }),
        },
      };

      // Act
      const result = handler.analyze(operation);

      // Assert
      expect(result.safety_level).toBe('YELLOW');
      expect(result.warnings).toContain('150 records exceeds recommended limit of 100');
      expect(result.guidance).toContain('🟡');
      expect(result.guidance).toContain('CAUTION');
    });

    it('should suggest batching for large bulk operations', () => {
      // CONTRACT: Provide batch splitting recommendations

      // Arrange
      const operation = {
        endpoint: '/applications/123/records/bulk/',
        method: 'POST' as const,
        operation_description: 'Bulk operation',
        payload: {
          records: new Array(250).fill({ id: '123' }),
        },
      };

      // Act
      const result = handler.analyze(operation);

      // Assert
      expect(result.suggested_corrections).toBeDefined();
      expect(result.suggested_corrections[0].issue).toContain('250 records');
      expect(result.suggested_corrections[0].fix).toContain('batch');
      expect(result.suggested_corrections[0].batches).toBeDefined();
      expect(result.suggested_corrections[0].batches.length).toBeGreaterThan(1);
      expect(result.suggested_corrections[0].batches[0].length).toBeLessThanOrEqual(100);
    });

    it('should pass for operations under 100 records', () => {
      // CONTRACT: No warning for reasonable batch sizes

      // Arrange
      const operation = {
        endpoint: '/applications/123/records/bulk/',
        method: 'POST' as const,
        operation_description: 'Small bulk update',
        payload: {
          records: new Array(50).fill({ id: '123', status: 'active' }),
        },
      };

      // Act
      const result = handler.analyze(operation);

      // Assert
      expect(result.safety_level).not.toBe('YELLOW');
      expect(result.warnings).not.toContain('exceeds');
    });

    it('should detect bulk operations in different payload formats', () => {
      // CONTRACT: Detect bulk in "records", "items", "fields" arrays

      // Arrange - using "items" array
      const operation = {
        endpoint: '/applications/123/records/',
        method: 'POST' as const,
        operation_description: 'Bulk create',
        payload: {
          items: new Array(120).fill({ name: 'Test' }),
        },
      };

      // Act
      const result = handler.analyze(operation);

      // Assert
      expect(result.safety_level).toBe('YELLOW');
      expect(result.warnings.some((w: string) => w.includes('120'))).toBe(true);
    });
  });

  describe('safety check 3: HTTP method validation', () => {
    let handler: any;

    beforeEach(async () => {
      const { IntelligentHandler } = await import('../../../src/operations/intelligent-handler.js');
      handler = new IntelligentHandler();
    });

    it('should detect wrong HTTP method with RED safety level', () => {
      // CONTRACT: Detect GET /records (should be POST /records/list/)
      // CRITICAL-ENGINEER: "HTTP method validation" - SAFETY CHECK #3

      // Arrange
      const operation = {
        endpoint: '/applications/123/records',
        method: 'GET' as const,
        operation_description: 'List all records',
      };

      // Act
      const result = handler.analyze(operation);

      // Assert
      expect(result.safety_level).toBe('RED');
      expect(result.warnings).toContain('Wrong HTTP method for records endpoint');
      expect(result.blockers).toContain('GET /records returns 405 Method Not Allowed');
      expect(result.guidance).toContain('🔴');
    });

    it('should provide method correction', () => {
      // CONTRACT: Suggest correct method and endpoint

      // Arrange
      const operation = {
        endpoint: '/applications/123/records',
        method: 'GET' as const,
        operation_description: 'Get records',
      };

      // Act
      const result = handler.analyze(operation);

      // Assert
      expect(result.suggested_corrections).toBeDefined();
      expect(result.suggested_corrections[0].fix).toContain('POST');
      expect(result.suggested_corrections[0].corrected_endpoint).toBe('/applications/123/records/list/');
      expect(result.suggested_corrections[0].corrected_method).toBe('POST');
    });

    it('should pass for correct HTTP methods', () => {
      // CONTRACT: GREEN for correct method/endpoint combinations

      // Arrange
      const operation = {
        endpoint: '/applications/123/records/list/',
        method: 'POST' as const,
        operation_description: 'List records',
      };

      // Act
      const result = handler.analyze(operation);

      // Assert
      expect(result.safety_level).not.toBe('RED');
      expect(result.warnings).not.toContain('Wrong HTTP method');
    });

    it('should validate DELETE method requirements', () => {
      // CONTRACT: DELETE requires trailing slash and record ID

      // Arrange
      const operation = {
        endpoint: '/applications/123/records/rec123',
        method: 'DELETE' as const,
        operation_description: 'Delete record',
      };

      // Act
      const result = handler.analyze(operation);

      // Assert
      expect(result.safety_level).toBe('RED');
      expect(result.warnings.some((w: string) => w.includes('trailing slash'))).toBe(true);
      expect(result.suggested_corrections[0].corrected_endpoint).toBe('/applications/123/records/rec123/');
    });
  });

  describe('safety check 4: SmartDoc format validation', () => {
    let handler: any;

    beforeEach(async () => {
      const { IntelligentHandler } = await import('../../../src/operations/intelligent-handler.js');
      handler = new IntelligentHandler();
    });

    it('should detect simple string for rich text field with RED level', () => {
      // CONTRACT: Detect plain strings for richtextareafield (silent failure)
      // CRITICAL-ENGINEER: "SmartDoc format validation" - SAFETY CHECK #4

      // Arrange
      const operation = {
        endpoint: '/applications/123/records/',
        method: 'POST' as const,
        operation_description: 'Create record with description',
        payload: {
          title: 'Test',
          description: 'Just a plain string', // ⚠️ WRONG for rich text
        },
        fieldTypes: {
          description: 'richtextareafield',
        },
      };

      // Act
      const result = handler.analyze(operation);

      // Assert
      expect(result.safety_level).toBe('RED');
      expect(result.warnings).toContain('Invalid format for rich text field');
      expect(result.blockers).toContain('Rich text fields require SmartDoc structure');
      expect(result.guidance).toContain('SmartDoc');
    });

    it('should provide SmartDoc structure correction', () => {
      // CONTRACT: Suggest full SmartDoc format with data/html/preview

      // Arrange
      const operation = {
        endpoint: '/applications/123/records/',
        method: 'POST' as const,
        operation_description: 'Create record',
        payload: {
          description: 'Simple text',
        },
        fieldTypes: {
          description: 'richtextareafield',
        },
      };

      // Act
      const result = handler.analyze(operation);

      // Assert
      expect(result.suggested_corrections).toBeDefined();
      expect(result.suggested_corrections[0].issue).toContain('plain string');
      expect(result.suggested_corrections[0].fix).toContain('SmartDoc');
      expect(result.suggested_corrections[0].corrected_payload.description).toHaveProperty('data');
      expect(result.suggested_corrections[0].corrected_payload.description).toHaveProperty('html');
      expect(result.suggested_corrections[0].corrected_payload.description).toHaveProperty('preview');
    });

    it('should pass for correct SmartDoc structure', () => {
      // CONTRACT: GREEN when SmartDoc structure is correct

      // Arrange
      const operation = {
        endpoint: '/applications/123/records/',
        method: 'POST' as const,
        operation_description: 'Create with SmartDoc',
        payload: {
          description: {
            data: { type: 'doc', content: [] },
            html: '<p>Test</p>',
            preview: 'Test',
          },
        },
        fieldTypes: {
          description: 'richtextareafield',
        },
      };

      // Act
      const result = handler.analyze(operation);

      // Assert
      expect(result.safety_level).not.toBe('RED');
      expect(result.warnings).not.toContain('Invalid format');
    });

    it('should validate checklist field format', () => {
      // CONTRACT: Detect simple arrays for checklist fields (silent failure)

      // Arrange
      const operation = {
        endpoint: '/applications/123/records/',
        method: 'POST' as const,
        operation_description: 'Create with checklist',
        payload: {
          tasks: ['Task 1', 'Task 2'], // ⚠️ WRONG - needs SmartDoc
        },
        fieldTypes: {
          tasks: 'checklistfield',
        },
      };

      // Act
      const result = handler.analyze(operation);

      // Assert
      expect(result.safety_level).toBe('RED');
      expect(result.warnings.some((w: string) => w.includes('checklist'))).toBe(true);
      expect(result.suggested_corrections[0].corrected_payload.tasks).toHaveProperty('data');
    });
  });

  describe('safety check 5: field name vs ID detection', () => {
    let handler: any;

    beforeEach(async () => {
      const { IntelligentHandler } = await import('../../../src/operations/intelligent-handler.js');
      handler = new IntelligentHandler();
    });

    it('should detect display names instead of field IDs with YELLOW warning', () => {
      // CONTRACT: Detect human-readable field names (should use 10-char IDs)
      // CRITICAL-ENGINEER: "Field name vs ID detection" - SAFETY CHECK #5

      // Arrange
      const operation = {
        endpoint: '/applications/123/records/',
        method: 'POST' as const,
        operation_description: 'Create record',
        payload: {
          'Project Name': 'Test Project', // ⚠️ Display name
          'Status': 'Active',              // ⚠️ Display name
          'Assigned To': 'John Doe',        // ⚠️ Display name
        },
      };

      // Act
      const result = handler.analyze(operation);

      // Assert
      expect(result.safety_level).toBe('YELLOW');
      expect(result.warnings.some((w: string) => w.includes('display name'))).toBe(true);
      expect(result.guidance).toContain('field ID');
    });

    it('should recommend using discover tool for field mapping', () => {
      // CONTRACT: Suggest smartsuite_discover to get field IDs

      // Arrange
      const operation = {
        endpoint: '/applications/123/records/',
        method: 'POST' as const,
        operation_description: 'Create record',
        payload: {
          'Title': 'Test',
        },
      };

      // Act
      const result = handler.analyze(operation);

      // Assert
      expect(result.suggested_corrections).toBeDefined();
      expect(result.suggested_corrections[0].fix).toContain('discover');
      expect(result.suggested_corrections[0].recommendation).toContain('smartsuite_discover');
      expect(result.suggested_corrections[0].recommendation).toContain('field mapping');
    });

    it('should pass for correct 10-character field IDs', () => {
      // CONTRACT: GREEN when using cryptic field IDs

      // Arrange
      const operation = {
        endpoint: '/applications/123/records/',
        method: 'POST' as const,
        operation_description: 'Create with field IDs',
        payload: {
          's1a2b3c4d5': 'Test Project',  // ✅ Correct field ID format
          's9z8y7x6w5': 'Active',         // ✅ Correct field ID format
        },
      };

      // Act
      const result = handler.analyze(operation);

      // Assert
      expect(result.safety_level).not.toBe('YELLOW');
      expect(result.warnings).not.toContain('display name');
    });

    it('should detect mixed field name and ID usage', () => {
      // CONTRACT: Warn when mixing display names and field IDs

      // Arrange
      const operation = {
        endpoint: '/applications/123/records/',
        method: 'POST' as const,
        operation_description: 'Mixed field usage',
        payload: {
          's1a2b3c4d5': 'Value 1',  // ✅ Field ID
          'Project Name': 'Value 2', // ⚠️ Display name
        },
      };

      // Act
      const result = handler.analyze(operation);

      // Assert
      expect(result.safety_level).toBe('YELLOW');
      expect(result.warnings.some((w: string) => w.includes('mixed'))).toBe(true);
    });
  });

  describe('unknown operations - default to YELLOW', () => {
    let handler: any;

    beforeEach(async () => {
      const { IntelligentHandler } = await import('../../../src/operations/intelligent-handler.js');
      handler = new IntelligentHandler();
    });

    it('should return YELLOW for unknown operation patterns', () => {
      // CONTRACT: Default to YELLOW (caution) for unknown operations
      // CRITICAL-ENGINEER: "Default to YELLOW for unknown operations"

      // Arrange
      const operation = {
        endpoint: '/applications/123/unknown_endpoint/',
        method: 'POST' as const,
        operation_description: 'Unknown operation type',
      };

      // Act
      const result = handler.analyze(operation);

      // Assert
      expect(result.safety_level).toBe('YELLOW');
      expect(result.guidance).toContain('🟡');
      expect(result.guidance).toContain('unknown operation');
      expect(result.warnings).toContain('No knowledge base match found');
    });

    it('should suggest caution for unknown endpoints', () => {
      // CONTRACT: Provide conservative guidance for unknown patterns

      // Arrange
      const operation = {
        endpoint: '/api/v2/new_feature/',
        method: 'POST' as const,
        operation_description: 'New API feature',
      };

      // Act
      const result = handler.analyze(operation);

      // Assert
      expect(result.safety_level).toBe('YELLOW');
      expect(result.guidance).toContain('Proceed with caution');
      expect(result.guidance).toContain('Test in development environment first');
    });
  });

  describe('guidance generation with emojis', () => {
    let handler: any;

    beforeEach(async () => {
      const { IntelligentHandler } = await import('../../../src/operations/intelligent-handler.js');
      handler = new IntelligentHandler();
    });

    it('should include RED emoji for critical operations', () => {
      // CONTRACT: Use 🔴 for RED safety level

      // Arrange
      const operation = {
        endpoint: '/applications/123/change_field/',
        method: 'PUT' as const,
        operation_description: 'Critical operation',
        payload: {
          field_type: 'singleselectfield',
          options: ['Test'],
        },
      };

      // Act
      const result = handler.analyze(operation);

      // Assert
      expect(result.guidance).toContain('🔴');
      expect(result.guidance).toContain('CRITICAL');
    });

    it('should include YELLOW emoji for caution operations', () => {
      // CONTRACT: Use 🟡 for YELLOW safety level

      // Arrange
      const operation = {
        endpoint: '/applications/123/records/bulk/',
        method: 'POST' as const,
        operation_description: 'Bulk operation',
        payload: {
          records: new Array(150).fill({}),
        },
      };

      // Act
      const result = handler.analyze(operation);

      // Assert
      expect(result.guidance).toContain('🟡');
      expect(result.guidance).toContain('CAUTION');
    });

    it('should include GREEN emoji for safe operations', () => {
      // CONTRACT: Use 🟢 for GREEN safety level

      // Arrange
      const operation = {
        endpoint: '/applications/123/records/list/',
        method: 'POST' as const,
        operation_description: 'List records',
        payload: {
          limit: 10,
        },
      };

      // Act
      const result = handler.analyze(operation);

      // Assert
      expect(result.guidance).toContain('🟢');
      expect(result.guidance).toMatch(/safe|appears safe/i);
    });

    it('should structure guidance with clear sections', () => {
      // CONTRACT: Organized guidance with safety, warnings, recommendations

      // Arrange
      const operation = {
        endpoint: '/applications/123/records/',
        method: 'POST' as const,
        operation_description: 'Create record',
        payload: {
          'Title': 'Test',
        },
      };

      // Act
      const result = handler.analyze(operation);

      // Assert
      expect(result.guidance).toContain('⚠️'); // Warning section
      expect(result.guidance).toContain('Prevention:');
      expect(result.guidance).toContain('•'); // Bullet points
      expect(result.guidance.length).toBeGreaterThan(50); // Substantial content
    });
  });

  describe('observability hooks', () => {
    let handler: any;
    let logSpy: any;

    beforeEach(async () => {
      const { IntelligentHandler } = await import('../../../src/operations/intelligent-handler.js');
      handler = new IntelligentHandler();
      logSpy = vi.fn();
      handler.setLogger(logSpy);
    });

    it('should log safety decision with operation details', () => {
      // CONTRACT: Log safety level determination for observability
      // CRITICAL-ENGINEER: "Observability hooks (logging decisions)"

      // Arrange
      const operation = {
        endpoint: '/applications/123/records/list/',
        method: 'POST' as const,
        operation_description: 'List records',
      };

      // Act
      handler.analyze(operation);

      // Assert
      expect(logSpy).toHaveBeenCalled();
      const logCall = logSpy.mock.calls[0][0];
      expect(logCall).toHaveProperty('operation');
      expect(logCall).toHaveProperty('safety_level');
      expect(logCall).toHaveProperty('patterns_matched');
      expect(logCall).toHaveProperty('timestamp');
    });

    it('should log warnings and blockers', () => {
      // CONTRACT: Capture all warnings and blockers in logs

      // Arrange
      const operation = {
        endpoint: '/applications/123/change_field/',
        method: 'PUT' as const,
        operation_description: 'Update field',
        payload: {
          field_type: 'singleselectfield',
          options: ['Test'],
        },
      };

      // Act
      handler.analyze(operation);

      // Assert
      const logCall = logSpy.mock.calls[0][0];
      expect(logCall.warnings).toBeDefined();
      expect(logCall.blockers).toBeDefined();
      expect(logCall.warnings.length).toBeGreaterThan(0);
    });

    it('should log knowledge base matches', () => {
      // CONTRACT: Track which patterns matched

      // Arrange
      const operation = {
        endpoint: '/applications/123/records',
        method: 'GET' as const,
        operation_description: 'Wrong method',
      };

      // Act
      handler.analyze(operation);

      // Assert
      const logCall = logSpy.mock.calls[0][0];
      expect(logCall.patterns_matched).toBeDefined();
      expect(logCall.patterns_matched).toContain('WRONG_HTTP_METHOD');
    });

    it('should support custom log level based on safety', () => {
      // CONTRACT: ERROR for RED, WARN for YELLOW, INFO for GREEN

      // Arrange
      const redOperation = {
        endpoint: '/applications/123/change_field/',
        method: 'PUT' as const,
        operation_description: 'Critical',
        payload: { field_type: 'singleselectfield', options: ['Test'] },
      };

      // Act
      handler.analyze(redOperation);

      // Assert
      const logCall = logSpy.mock.calls[0][0];
      expect(logCall.log_level).toBe('ERROR');
    });
  });

  describe('integration scenarios', () => {
    let handler: any;

    beforeEach(async () => {
      const { IntelligentHandler } = await import('../../../src/operations/intelligent-handler.js');
      handler = new IntelligentHandler();
    });

    it('should handle multiple simultaneous safety issues', () => {
      // CONTRACT: Aggregate all issues, use highest severity level

      // Arrange - UUID risk + bulk limit + wrong method
      const operation = {
        endpoint: '/applications/123/records',
        method: 'GET' as const,
        operation_description: 'Multiple issues',
        payload: {
          field_type: 'singleselectfield',
          options: ['Test'],
          records: new Array(150).fill({}),
        },
      };

      // Act
      const result = handler.analyze(operation);

      // Assert
      expect(result.safety_level).toBe('RED'); // Highest severity wins
      expect(result.warnings.length).toBeGreaterThanOrEqual(2);
      expect(result.blockers.length).toBeGreaterThan(0);
      expect(result.suggested_corrections.length).toBeGreaterThan(1);
    });

    it('should provide actionable next steps', () => {
      // CONTRACT: Every result includes what to do next

      // Arrange
      const operation = {
        endpoint: '/applications/123/records/',
        method: 'POST' as const,
        operation_description: 'Need guidance',
        payload: {
          'Title': 'Test',
        },
      };

      // Act
      const result = handler.analyze(operation);

      // Assert
      expect(result.next_steps).toBeDefined();
      expect(Array.isArray(result.next_steps)).toBe(true);
      expect(result.next_steps.length).toBeGreaterThan(0);
      expect(result.next_steps[0]).toMatch(/^(Use|Run|Check|Verify)/);
    });

    it('should handle operations with table context', () => {
      // CONTRACT: Use tableId for enhanced validation when provided

      // Arrange
      const operation = {
        endpoint: '/applications/123/records/',
        method: 'POST' as const,
        operation_description: 'Create record',
        tableId: '68a8ff5237fde0bf797c05b3',
        payload: {
          title: 'Test',
        },
      };

      // Act
      const result = handler.analyze(operation);

      // Assert
      expect(result).toBeDefined();
      expect(result.table_context).toBe('68a8ff5237fde0bf797c05b3');
    });
  });
});
