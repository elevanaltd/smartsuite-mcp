// Phoenix Test Contract: INTELLIGENT-001
// Contract: Knowledge Base Loading and Pattern Matching
// Status: RED (no implementation - TDD RED phase)
// Phase: Phase 2G - Intelligent Tool Handler
// Critical-Engineer Analysis: 002-PHASE-2G-INTELLIGENT-TOOL-ANALYSIS.md

import { describe, it, expect, beforeEach } from 'vitest';

describe('KnowledgeBase', () => {
  describe('loadFromFiles', () => {
    it('should load knowledge base with versioning from manifest.json', async () => {
      // CONTRACT: Knowledge base must have versioning via manifest.json
      // CRITICAL-ENGINEER REQUIREMENT: "Knowledge base with versioning (manifest.json)"

      // Arrange
      const { KnowledgeBase } = await import('../../../src/operations/knowledge-base.js');

      // Act
      const kb = KnowledgeBase.loadFromFiles('test/fixtures/knowledge');

      // Assert
      expect(kb).toBeDefined();
      expect(kb.getVersion()).toBeDefined();
      expect(kb.getVersion()).toMatch(/^\d+\.\d+\.\d+$/); // Semver format
      expect(kb.getManifest()).toBeDefined();
      expect(kb.getManifest()).toHaveProperty('version');
      expect(kb.getManifest()).toHaveProperty('pattern_index'); // v2.0.0 structure
      expect(kb.getManifest()).toHaveProperty('last_updated');
    });

    it('should load critical safety patterns from knowledge files', async () => {
      // CONTRACT: Load UUID corruption, bulk limits, wrong methods patterns

      // Arrange
      const { KnowledgeBase } = await import('../../../src/operations/knowledge-base.js');

      // Act
      const kb = KnowledgeBase.loadFromFiles('test/fixtures/knowledge');

      // Assert
      expect(kb.getPatternCount()).toBeGreaterThan(0);
      expect(kb.hasPattern('UUID_CORRUPTION')).toBe(true);
      expect(kb.hasPattern('BULK_OPERATION_LIMIT')).toBe(true);
      expect(kb.hasPattern('WRONG_HTTP_METHOD')).toBe(true);
      expect(kb.hasPattern('SMARTDOC_FORMAT')).toBe(true);
      expect(kb.hasPattern('FIELD_NAME_VS_ID')).toBe(true);
    });

    it('should validate manifest structure on load', async () => {
      // CONTRACT: Manifest must have required fields: version, pattern_index, last_updated (v2.0.0)

      // Arrange
      const { KnowledgeBase } = await import('../../../src/operations/knowledge-base.js');

      // Act
      const kb = KnowledgeBase.loadFromFiles('test/fixtures/knowledge');
      const manifest = kb.getManifest();

      // Assert
      expect(manifest).toHaveProperty('version');
      expect(manifest).toHaveProperty('pattern_index'); // v2.0.0 structure
      expect(manifest).toHaveProperty('last_updated');
      expect(manifest.pattern_index).toHaveProperty('red');
      expect(manifest.pattern_index).toHaveProperty('yellow');
      expect(manifest.pattern_index).toHaveProperty('green');
    });

    it('should fail gracefully with descriptive error if manifest missing', async () => {
      // CONTRACT: Clear error message if knowledge base cannot be loaded

      // Arrange
      const { KnowledgeBase } = await import('../../../src/operations/knowledge-base.js');

      // Act & Assert
      expect(() => {
        KnowledgeBase.loadFromFiles('/nonexistent/path');
      }).toThrow(/manifest\.json not found/i);
    });
  });

  describe('pattern matching', () => {
    let knowledgeBase: any;

    beforeEach(async () => {
      const { KnowledgeBase } = await import('../../../src/operations/knowledge-base.js');
      knowledgeBase = KnowledgeBase.loadFromFiles('test/fixtures/knowledge');
    });

    it('should match UUID corruption pattern (options vs choices)', () => {
      // CONTRACT: Detect "options" parameter in singleselectfield operations
      // CRITICAL: This is the EAV September 2025 incident pattern

      // Arrange
      const operation = {
        endpoint: '/applications/123/change_field/',
        method: 'PUT',
        payload: {
          params: {
            options: ['Option1', 'Option2'], // ⚠️ WRONG - destroys UUIDs
          },
        },
      };

      // Act
      const matches = knowledgeBase.match(operation);

      // Assert
      expect(matches.length).toBeGreaterThan(0);
      expect(matches[0].pattern).toBe('UUID_CORRUPTION');
      expect(matches[0].safetyLevel).toBe('RED');
      expect(matches[0].failureModes).toBeDefined();
      expect(matches[0].failureModes[0].description).toContain('UUID');
      expect(matches[0].failureModes[0].prevention).toContain('choices');
    });

    it('should match bulk operation limit pattern', () => {
      // CONTRACT: Detect operations with >100 records (warning threshold)
      // CRITICAL-ENGINEER: "Bulk operation limits (>100 records warning)"

      // Arrange
      const operation = {
        endpoint: '/applications/123/records/bulk/',
        method: 'POST',
        payload: {
          records: new Array(150).fill({ id: '123', status: 'active' }),
        },
      };

      // Act
      const matches = knowledgeBase.match(operation);

      // Assert
      expect(matches.length).toBeGreaterThan(0);
      expect(matches[0].pattern).toBe('BULK_OPERATION_LIMIT');
      expect(matches[0].safetyLevel).toBe('YELLOW');
      expect(matches[0].validationRules).toBeDefined();
      expect(matches[0].validationRules[0].limit).toBe(100);
      expect(matches[0].failureModes[0].description).toMatch(/[Bb]ulk operation/);
    });

    it('should match wrong HTTP method pattern', () => {
      // CONTRACT: Detect GET /records (should be POST /records/list/)
      // CRITICAL: SmartSuite returns 405 Method Not Allowed

      // Arrange
      const operation = {
        endpoint: '/applications/123/records',
        method: 'GET',
      };

      // Act
      const matches = knowledgeBase.match(operation);

      // Assert
      expect(matches.length).toBeGreaterThan(0);
      expect(matches[0].pattern).toBe('WRONG_HTTP_METHOD');
      expect(matches[0].safetyLevel).toBe('RED');
      expect(matches[0].correction).toBeDefined();
      expect(matches[0].correction.method).toBe('POST');
      expect(matches[0].correction.endpoint).toContain('/list/');
    });

    it('should match SmartDoc format validation pattern', () => {
      // CONTRACT: Detect simple string for rich text fields (silent failure)
      // CRITICAL: Must be full SmartDoc structure with data/html/preview

      // Arrange
      const operation = {
        endpoint: '/applications/123/records/',
        method: 'POST',
        payload: {
          title: 'Test',
          description: 'Just a plain string', // ⚠️ WRONG for richtextareafield
        },
        fieldTypes: {
          description: 'richtextareafield',
        },
      };

      // Act
      const matches = knowledgeBase.match(operation);

      // Assert
      expect(matches.length).toBeGreaterThan(0);
      expect(matches[0].pattern).toBe('SMARTDOC_FORMAT');
      expect(matches[0].safetyLevel).toBe('RED');
      expect(matches[0].failureModes[0].description).toContain('SmartDoc');
      expect(matches[0].correction).toBeDefined();
      expect(matches[0].correction.format).toBe('smartdoc');
    });

    it('should match field name vs ID confusion pattern', () => {
      // CONTRACT: Detect display names used instead of field IDs
      // CRITICAL: SmartSuite uses cryptic 10-char alphanumeric IDs

      // Arrange
      const operation = {
        endpoint: '/applications/123/records/',
        method: 'POST',
        payload: {
          'Project Name': 'Test Project', // ⚠️ WRONG - display name
          'Status': 'Active',                // ⚠️ WRONG - display name
        },
      };

      // Act
      const matches = knowledgeBase.match(operation);

      // Assert
      expect(matches.length).toBeGreaterThan(0);
      expect(matches[0].pattern).toBe('FIELD_NAME_VS_ID');
      expect(matches[0].safetyLevel).toBe('YELLOW');
      expect(matches[0].failureModes[0].description).toContain('field ID');
      expect(matches[0].failureModes[0].prevention).toContain('discover');
    });

    it('should return empty array for safe operation', () => {
      // CONTRACT: No matches for operations with no known issues

      // Arrange
      const operation = {
        endpoint: '/applications/123/records/list/',
        method: 'POST',
        payload: {
          filter: { operator: 'and', fields: [] },
          limit: 10,
        },
      };

      // Act
      const matches = knowledgeBase.match(operation);

      // Assert
      expect(matches).toEqual([]);
    });

    it('should match multiple patterns when operation has multiple issues', () => {
      // CONTRACT: Return all matching patterns for comprehensive analysis

      // Arrange
      const operation = {
        endpoint: '/applications/123/records/',
        method: 'POST',
        payload: {
          records: new Array(150).fill({
            'Status': 'Active', // Field name issue + bulk limit issue
          }),
        },
      };

      // Act
      const matches = knowledgeBase.match(operation);

      // Assert
      expect(matches.length).toBeGreaterThanOrEqual(2);
      expect(matches.some((m: any) => m.pattern === 'BULK_OPERATION_LIMIT')).toBe(true);
      expect(matches.some((m: any) => m.pattern === 'FIELD_NAME_VS_ID')).toBe(true);
    });
  });

  describe('pattern retrieval', () => {
    let knowledgeBase: any;

    beforeEach(async () => {
      const { KnowledgeBase } = await import('../../../src/operations/knowledge-base.js');
      knowledgeBase = KnowledgeBase.loadFromFiles('test/fixtures/knowledge');
    });

    it('should retrieve pattern details by name', () => {
      // CONTRACT: Get full pattern definition by pattern name

      // Act
      const pattern = knowledgeBase.getPattern('UUID_CORRUPTION');

      // Assert
      expect(pattern).toBeDefined();
      expect(pattern.pattern).toBe('UUID_CORRUPTION');
      expect(pattern.safetyLevel).toBe('RED');
      expect(pattern.failureModes).toBeDefined();
      expect(pattern.failureModes.length).toBeGreaterThan(0);
    });

    it('should list all available pattern names', () => {
      // CONTRACT: Enumerate all patterns in knowledge base

      // Act
      const patternNames = knowledgeBase.getPatternNames();

      // Assert
      expect(patternNames).toBeDefined();
      expect(Array.isArray(patternNames)).toBe(true);
      expect(patternNames).toContain('UUID_CORRUPTION');
      expect(patternNames).toContain('BULK_OPERATION_LIMIT');
      expect(patternNames).toContain('WRONG_HTTP_METHOD');
      expect(patternNames).toContain('SMARTDOC_FORMAT');
      expect(patternNames).toContain('FIELD_NAME_VS_ID');
    });

    it('should return pattern statistics', () => {
      // CONTRACT: Provide counts by safety level

      // Act
      const stats = knowledgeBase.getStats();

      // Assert
      expect(stats).toBeDefined();
      expect(stats).toHaveProperty('total');
      expect(stats).toHaveProperty('red');
      expect(stats).toHaveProperty('yellow');
      expect(stats).toHaveProperty('green');
      expect(stats.total).toBeGreaterThan(0);
      expect(stats.red).toBeGreaterThan(0);
      expect(stats.yellow).toBeGreaterThan(0);
    });
  });

  describe('dependency injection', () => {
    it('should support custom knowledge directory path', async () => {
      // CONTRACT: Allow custom knowledge base location for testing
      // CRITICAL-ENGINEER: "Dependency injection for knowledge base"

      // Arrange
      const { KnowledgeBase } = await import('../../../src/operations/knowledge-base.js');
      const customPath = './test/fixtures/knowledge';

      // Act
      const kb = KnowledgeBase.loadFromFiles(customPath);

      // Assert
      expect(kb).toBeDefined();
      expect(kb.getManifest()).toBeDefined();
    });

    it('should support providing pre-loaded patterns', async () => {
      // CONTRACT: Allow injecting patterns for unit testing

      // Arrange
      const { KnowledgeBase } = await import('../../../src/operations/knowledge-base.js');
      const mockPatterns = [
        {
          pattern: 'TEST_PATTERN',
          regex: /test/,
          safetyLevel: 'GREEN' as const,
          failureModes: [],
        },
      ];

      // Act
      const kb = new KnowledgeBase(mockPatterns);

      // Assert
      expect(kb.getPatternCount()).toBe(1);
      expect(kb.hasPattern('TEST_PATTERN')).toBe(true);
    });
  });

  describe('trigger-based pattern matching', () => {
    let knowledgeBase: any;

    beforeEach(async () => {
      const { KnowledgeBase } = await import('../../../src/operations/knowledge-base.js');
      knowledgeBase = KnowledgeBase.loadFromFiles('test/fixtures/knowledge');
    });

    it('should match UUID_CORRUPTION via trigger evaluation (endpoint_match)', () => {
      // CONTRACT: Trigger-based matching replaces hardcoded logic
      // TRIGGER: endpoint_match: "/change_field/"
      // MINIMAL_INTERVENTION: Start with simplest trigger (endpoint_match)

      // Arrange
      const operation = {
        endpoint: '/applications/123/change_field/',
        method: 'PUT',
        payload: {
          params: {
            options: ['Option1', 'Option2'], // Trigger: payload.params.options exists
          },
        },
      };

      // Act
      const matches = knowledgeBase.match(operation);

      // Assert
      expect(matches.length).toBeGreaterThan(0);
      expect(matches[0].pattern).toBe('UUID_CORRUPTION');
      expect(matches[0].safetyLevel).toBe('RED');
    });

    it('should match UUID_CORRUPTION via trigger evaluation (parameter_check exists)', () => {
      // CONTRACT: parameter_check.path with "exists" operator
      // TRIGGER: payload.params.options exists AND payload.params.choices not_exists

      // Arrange
      const operation = {
        endpoint: '/applications/123/change_field/',
        method: 'PUT',
        payload: {
          params: {
            options: ['Value1'], // exists
            // choices is missing (not_exists)
          },
        },
      };

      // Act
      const matches = knowledgeBase.match(operation);

      // Assert
      expect(matches.length).toBeGreaterThan(0);
      expect(matches[0].pattern).toBe('UUID_CORRUPTION');
    });

    it('should NOT match UUID_CORRUPTION when choices exists (negated trigger)', () => {
      // CONTRACT: AND condition with not_exists must fail when property exists
      // TRIGGER: payload.params.choices not_exists (should fail if exists)

      // Arrange
      const operation = {
        endpoint: '/applications/123/change_field/',
        method: 'PUT',
        payload: {
          params: {
            options: ['Value1'],
            choices: [{ value: 'uuid1', label: 'Label1' }], // exists (should block match)
          },
        },
      };

      // Act
      const matches = knowledgeBase.match(operation);

      // Assert
      // Should NOT match UUID_CORRUPTION because choices exists
      const uuidMatch = matches.find((m: any) => m.pattern === 'UUID_CORRUPTION');
      expect(uuidMatch).toBeUndefined();
    });

    it('should NOT match UUID_CORRUPTION when endpoint does not match', () => {
      // CONTRACT: endpoint_match must succeed for trigger to fire

      // Arrange
      const operation = {
        endpoint: '/applications/123/records/', // Different endpoint
        method: 'POST',
        payload: {
          params: {
            options: ['Value1'], // Would match parameter_check, but endpoint wrong
          },
        },
      };

      // Act
      const matches = knowledgeBase.match(operation);

      // Assert
      const uuidMatch = matches.find((m: any) => m.pattern === 'UUID_CORRUPTION');
      expect(uuidMatch).toBeUndefined();
    });

    it('should resolve nested paths in parameter_check', () => {
      // CONTRACT: resolvePath helper must navigate "payload.params.options"
      // MINIMAL_INTERVENTION: Test simplest path resolution

      // Arrange
      const operation = {
        endpoint: '/applications/123/change_field/',
        method: 'PUT',
        payload: {
          params: {
            nested: {
              deep: {
                property: 'value',
              },
            },
          },
        },
      };

      // Act
      const matches = knowledgeBase.match(operation);

      // Assert - Should not match UUID_CORRUPTION (wrong path)
      const uuidMatch = matches.find((m: any) => m.pattern === 'UUID_CORRUPTION');
      expect(uuidMatch).toBeUndefined();
    });
  });
});
