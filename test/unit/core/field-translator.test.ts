// Phoenix Test Contract: FIELD-001, FIELD-002, TABLE-001
// Contract: Field translation (human ↔ API) and table resolution
// Status: RED (no implementation exists yet)
// Source: docs/412-DOC-TEST-CONTRACTS.md
// TDD Phase: RED → (implementation pending)
// TEST-METHODOLOGY-GUARDIAN: Approved RED state test creation

import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { SmartSuiteClient } from '../../../src/core/smartsuite-client.js';

// CRITICAL: This import WILL FAIL - implementation doesn't exist yet
// This is CORRECT TDD - tests define the contract before code exists
// Types defined below for test clarity

/**
 * Field mapping structure from SmartSuite schema
 * Example: { "slug": "s9a4d6f2", "label": "Customer Name", "field_type": "textfield" }
 */
interface FieldSchema {
  slug: string;
  label: string;
  field_type: string;
}

/**
 * Table schema structure from SmartSuite API
 */
interface TableSchema {
  id: string;
  name: string;
  structure: FieldSchema[];
}

/**
 * Field mapping cache entry
 * Maps human-friendly names to cryptic SmartSuite field IDs
 * Note: Types defined for documentation, not actively used in tests
 */
// @ts-expect-error - Type defined for documentation purposes
interface FieldMapping {
  [humanName: string]: string; // e.g., "Customer Name" -> "s9a4d6f2"
}

/**
 * Table resolution cache entry
 * Maps table display names to table IDs
 * Note: Types defined for documentation, not actively used in tests
 */
// @ts-expect-error - Type defined for documentation purposes
interface TableMapping {
  [tableName: string]: string; // e.g., "Projects" -> "65abc123def456"
}

describe('FieldTranslator - FIELD-001, FIELD-002 (Field Translation)', () => {
  describe('Construction and Initialization', () => {
    it('should create translator with SmartSuite client', async () => {
      // CONTRACT: FieldTranslator requires SmartSuite client for schema operations
      // EXPECT: Constructor accepts client and initializes empty caches

      // Arrange - Create mock client
      const mockClient = {
        apiKey: 'test-key',
        workspaceId: 'test-workspace',
        getSchema: vi.fn(),
      } as unknown as SmartSuiteClient;

      // Act - Import will fail (RED state)
      const { FieldTranslator } = await import('../../../src/core/field-translator.js');
      const translator = new FieldTranslator(mockClient);

      // Assert
      expect(translator).toBeDefined();
      expect(translator).toBeInstanceOf(FieldTranslator);
    });

    it('should initialize with empty field mapping cache', async () => {
      // CONTRACT: Fresh translator has no cached mappings
      // EXPECT: hasMappings returns false for any table

      // Arrange
      const mockClient = {} as SmartSuiteClient;

      // Act
      const { FieldTranslator } = await import('../../../src/core/field-translator.js');
      const translator = new FieldTranslator(mockClient);

      // Assert - No mappings cached yet
      expect(translator.hasMappings('any-table-id')).toBe(false);
    });

    it('should initialize with empty table resolution cache', async () => {
      // CONTRACT: Fresh translator has no table name→ID mappings
      // EXPECT: resolveTableId throws or returns null for unknown tables

      // Arrange - Mock client with empty applications list
      const mockClient = {
        request: vi.fn().mockResolvedValue([]), // Empty workspace
      } as unknown as SmartSuiteClient;

      // Act
      const { FieldTranslator } = await import('../../../src/core/field-translator.js');
      const translator = new FieldTranslator(mockClient);

      // Assert - Unknown table should not resolve
      await expect(translator.resolveTableId('Unknown Table')).rejects.toThrow(/not found|unknown/i);
    });
  });

  describe('Schema Loading and Field Discovery', () => {
    let mockClient: SmartSuiteClient;
    const mockTableSchema: TableSchema = {
      id: '65abc123def456',
      name: 'Projects',
      structure: [
        { slug: 's9a4d6f2', label: 'Project Name', field_type: 'textfield' },
        { slug: 's1b8c3e4', label: 'Status', field_type: 'statusfield' },
        { slug: 's7f2a9d1', label: 'Customer', field_type: 'linkedrecordfield' },
        { slug: 's3e5c7b2', label: 'Start Date', field_type: 'duedatefield' },
      ],
    };

    beforeEach(() => {
      mockClient = {
        apiKey: 'test-key',
        workspaceId: 'test-workspace',
        getSchema: vi.fn().mockResolvedValue(mockTableSchema),
      } as unknown as SmartSuiteClient;
    });

    it('should load field mappings from SmartSuite schema', async () => {
      // CONTRACT: loadMappingsForTable fetches schema and builds field mapping cache
      // EXPECT: SmartSuite client called, mappings cached

      // Arrange
      const { FieldTranslator } = await import('../../../src/core/field-translator.js');
      const translator = new FieldTranslator(mockClient);

      // Act
      await translator.loadMappingsForTable('65abc123def456');

      // Assert - Schema was fetched
      expect(mockClient.getSchema).toHaveBeenCalledWith('65abc123def456');

      // Assert - Mappings now exist
      expect(translator.hasMappings('65abc123def456')).toBe(true);
    });

    it('should cache field mappings for performance', async () => {
      // CONTRACT: Subsequent translations don't re-fetch schema
      // EXPECT: getSchema called once, then cached

      // Arrange
      const { FieldTranslator } = await import('../../../src/core/field-translator.js');
      const translator = new FieldTranslator(mockClient);

      // Act - Load mappings once
      await translator.loadMappingsForTable('65abc123def456');

      // Act - Translate multiple times (intentionally not awaited for caching test)
      void translator.translateFields('65abc123def456', { 'Project Name': 'Test 1' });
      void translator.translateFields('65abc123def456', { 'Project Name': 'Test 2' });
      void translator.translateFields('65abc123def456', { 'Project Name': 'Test 3' });

      // Assert - Schema fetched only once
      expect(mockClient.getSchema).toHaveBeenCalledTimes(1);
    });

    it('should build bidirectional mapping (human ↔ API)', async () => {
      // CONTRACT: Cache supports both forward (human→API) and reverse (API→human) translation
      // EXPECT: Can translate in both directions

      // Arrange
      const { FieldTranslator } = await import('../../../src/core/field-translator.js');
      const translator = new FieldTranslator(mockClient);
      await translator.loadMappingsForTable('65abc123def456');

      // Act - Forward translation
      const apiFields = await translator.translateFields('65abc123def456', {
        'Project Name': 'My Project',
      });

      // Act - Reverse translation
      const humanFields = translator.reverseTranslateFields('65abc123def456', {
        s9a4d6f2: 'My Project',
      });

      // Assert
      expect(apiFields).toHaveProperty('s9a4d6f2', 'My Project');
      expect(humanFields).toHaveProperty('Project Name', 'My Project');
    });

    it('should handle multiple tables with separate caches', async () => {
      // CONTRACT: Different tables have different field schemas
      // EXPECT: Mappings isolated per table

      // Arrange - Second table schema
      const mockTableSchema2: TableSchema = {
        id: '78xyz456abc789',
        name: 'Customers',
        structure: [
          { slug: 'sc4b7e9f', label: 'Company Name', field_type: 'textfield' },
          { slug: 'sd2f8a1c', label: 'Industry', field_type: 'singleselectfield' },
        ],
      };

      mockClient.getSchema = vi
        .fn()
        .mockImplementation(async (tableId: string) => {
          if (tableId === '65abc123def456') return mockTableSchema;
          if (tableId === '78xyz456abc789') return mockTableSchema2;
          throw new Error('Unknown table');
        });

      const { FieldTranslator } = await import('../../../src/core/field-translator.js');
      const translator = new FieldTranslator(mockClient);

      // Act - Load both tables
      await translator.loadMappingsForTable('65abc123def456');
      await translator.loadMappingsForTable('78xyz456abc789');

      // Act - Translate with different schemas
      const projectFields = await translator.translateFields('65abc123def456', {
        'Project Name': 'Test Project',
      });

      const customerFields = await translator.translateFields('78xyz456abc789', {
        'Company Name': 'ACME Corp',
      });

      // Assert - Different field IDs for different tables
      expect(projectFields).toHaveProperty('s9a4d6f2', 'Test Project');
      expect(customerFields).toHaveProperty('sc4b7e9f', 'ACME Corp');
    });

    it('should handle schema fetch errors gracefully', async () => {
      // CONTRACT: Network/API errors during schema fetch throw meaningful errors
      // EXPECT: Clear error message about schema retrieval failure

      // Arrange
      mockClient.getSchema = vi
        .fn()
        .mockRejectedValue(new Error('Network error: timeout'));

      const { FieldTranslator } = await import('../../../src/core/field-translator.js');
      const translator = new FieldTranslator(mockClient);

      // Act & Assert
      await expect(translator.loadMappingsForTable('65abc123def456')).rejects.toThrow(
        /schema|network/i,
      );
    });

    it('should handle empty schema structure', async () => {
      // CONTRACT: Tables with no fields return empty mapping
      // EXPECT: No translations possible, but doesn't crash

      // Arrange
      mockClient.getSchema = vi.fn().mockResolvedValue({
        id: '65abc123def456',
        name: 'Empty Table',
        structure: [],
      });

      const { FieldTranslator } = await import('../../../src/core/field-translator.js');
      const translator = new FieldTranslator(mockClient);

      // Act
      await translator.loadMappingsForTable('65abc123def456');

      // Assert - Mappings exist but empty
      expect(translator.hasMappings('65abc123def456')).toBe(true);

      // Attempting translation with ignoreUnknown returns empty result
      const result = await translator.translateFields(
        '65abc123def456',
        { 'Unknown Field': 'Value' },
        { ignoreUnknown: true },
      );
      expect(Object.keys(result)).toHaveLength(0);
    });
  });

  describe('Forward Translation (Human → API)', () => {
    let mockClient: SmartSuiteClient;
    const mockTableSchema: TableSchema = {
      id: '65abc123def456',
      name: 'Projects',
      structure: [
        { slug: 's9a4d6f2', label: 'Project Name', field_type: 'textfield' },
        { slug: 's1b8c3e4', label: 'Status', field_type: 'statusfield' },
        { slug: 's7f2a9d1', label: 'Customer', field_type: 'linkedrecordfield' },
        { slug: 's3e5c7b2', label: 'Start Date', field_type: 'duedatefield' },
      ],
    };

    beforeEach(async () => {
      mockClient = {
        apiKey: 'test-key',
        workspaceId: 'test-workspace',
        getSchema: vi.fn().mockResolvedValue(mockTableSchema),
      } as unknown as SmartSuiteClient;
    });

    it('should translate human field names to API codes', async () => {
      // CONTRACT: Given human-friendly field names, return cryptic SmartSuite field IDs
      // EXPECT: Field labels mapped to slugs

      // Arrange
      const { FieldTranslator } = await import('../../../src/core/field-translator.js');
      const translator = new FieldTranslator(mockClient);
      await translator.loadMappingsForTable('65abc123def456');

      const humanFields = {
        'Project Name': 'Q1 Initiative',
        Status: 'In Progress',
        Customer: ['customer-id-123'],
      };

      // Act
      const apiFields = await translator.translateFields('65abc123def456', humanFields);

      // Assert
      expect(apiFields).toEqual({
        s9a4d6f2: 'Q1 Initiative',
        s1b8c3e4: 'In Progress',
        s7f2a9d1: ['customer-id-123'],
      });
    });

    it('should throw error for unknown field by default (fail-fast)', async () => {
      // CONTRACT: Fail-fast prevents typo-induced data loss
      // EXPECT: Error with available field names for developer guidance

      // Arrange
      const { FieldTranslator } = await import('../../../src/core/field-translator.js');
      const translator = new FieldTranslator(mockClient);
      await translator.loadMappingsForTable('65abc123def456');

      // Act & Assert - Unknown field should throw
      await expect(
        translator.translateFields('65abc123def456', {
          'Project Name': 'Test',
          'Unknown Field': 'Should throw error',
          Status: 'Active',
        }),
      ).rejects.toThrow(/Unknown field label: "Unknown Field"/);
    });

    it('should allow unknown fields with ignoreUnknown option', async () => {
      // CONTRACT: Opt-in permissive mode for backward compatibility
      // EXPECT: Unknown fields silently omitted when explicitly requested

      // Arrange
      const { FieldTranslator } = await import('../../../src/core/field-translator.js');
      const translator = new FieldTranslator(mockClient);
      await translator.loadMappingsForTable('65abc123def456');

      const humanFields = {
        'Project Name': 'Test',
        'Unknown Field': 'Should be ignored',
        Status: 'Active',
      };

      // Act - Explicitly allow unknown fields
      const apiFields = await translator.translateFields('65abc123def456', humanFields, {
        ignoreUnknown: true,
      });

      // Assert - Only known fields translated
      expect(apiFields).toHaveProperty('s9a4d6f2', 'Test');
      expect(apiFields).toHaveProperty('s1b8c3e4', 'Active');
      expect(apiFields).not.toHaveProperty('Unknown Field');
    });

    it('should handle complex field values (arrays, objects)', async () => {
      // CONTRACT: Field values can be strings, numbers, arrays, or objects
      // EXPECT: Value structure preserved, only field names translated

      // Arrange
      const { FieldTranslator } = await import('../../../src/core/field-translator.js');
      const translator = new FieldTranslator(mockClient);
      await translator.loadMappingsForTable('65abc123def456');

      const humanFields = {
        Customer: ['id-1', 'id-2', 'id-3'], // Linked record array
        'Start Date': { from_date: '2025-01-01', to_date: '2025-12-31' }, // Date range
      };

      // Act
      const apiFields = await translator.translateFields('65abc123def456', humanFields);

      // Assert - Complex values preserved
      expect(apiFields.s7f2a9d1).toEqual(['id-1', 'id-2', 'id-3']);
      expect(apiFields.s3e5c7b2).toEqual({ from_date: '2025-01-01', to_date: '2025-12-31' });
    });

    it('should handle empty input gracefully', async () => {
      // CONTRACT: Empty input object returns empty output
      // EXPECT: No errors, empty result

      // Arrange
      const { FieldTranslator } = await import('../../../src/core/field-translator.js');
      const translator = new FieldTranslator(mockClient);
      await translator.loadMappingsForTable('65abc123def456');

      // Act
      const apiFields = await translator.translateFields('65abc123def456', {});

      // Assert
      expect(apiFields).toEqual({});
    });

    it('should auto-load mappings if not cached (convenience)', async () => {
      // CONTRACT: translateFields can auto-load schema if not already cached
      // EXPECT: First translation triggers schema fetch automatically

      // Arrange
      const { FieldTranslator } = await import('../../../src/core/field-translator.js');
      const translator = new FieldTranslator(mockClient);
      // Note: NOT calling loadMappingsForTable explicitly

      // Act - Should auto-load
      const apiFields = await translator.translateFields('65abc123def456', {
        'Project Name': 'Auto-loaded',
      });

      // Assert - Schema was fetched automatically
      expect(mockClient.getSchema).toHaveBeenCalledWith('65abc123def456');
      expect(apiFields).toHaveProperty('s9a4d6f2', 'Auto-loaded');
    });

    it('should throw error for unknown table ID', async () => {
      // CONTRACT: Invalid table ID during translation throws error
      // EXPECT: Clear error message about table not found

      // Arrange
      mockClient.getSchema = vi.fn().mockRejectedValue(new Error('Resource not found (404)'));

      const { FieldTranslator } = await import('../../../src/core/field-translator.js');
      const translator = new FieldTranslator(mockClient);

      // Act & Assert
      await expect(
        translator.translateFields('nonexistent-table', { 'Some Field': 'Value' }),
      ).rejects.toThrow(/not found|404/i);
    });

    it('should handle case-sensitive field name matching', async () => {
      // CONTRACT: Field labels are case-sensitive
      // EXPECT: Exact match required for translation, throws error for wrong case

      // Arrange
      const { FieldTranslator } = await import('../../../src/core/field-translator.js');
      const translator = new FieldTranslator(mockClient);
      await translator.loadMappingsForTable('65abc123def456');

      // Act & Assert - Incorrect case should throw
      await expect(
        translator.translateFields('65abc123def456', {
          'project name': 'Lower Case', // Wrong case
        }),
      ).rejects.toThrow(/Unknown field label: "project name"/);

      // Act - Correct case
      const apiFields2 = await translator.translateFields('65abc123def456', {
        'Project Name': 'Correct Case',
      });

      // Assert
      expect(apiFields2).toHaveProperty('s9a4d6f2', 'Correct Case');
    });
  });

  describe('Reverse Translation (API → Human)', () => {
    let mockClient: SmartSuiteClient;
    const mockTableSchema: TableSchema = {
      id: '65abc123def456',
      name: 'Projects',
      structure: [
        { slug: 's9a4d6f2', label: 'Project Name', field_type: 'textfield' },
        { slug: 's1b8c3e4', label: 'Status', field_type: 'statusfield' },
        { slug: 's7f2a9d1', label: 'Customer', field_type: 'linkedrecordfield' },
      ],
    };

    beforeEach(() => {
      mockClient = {
        apiKey: 'test-key',
        workspaceId: 'test-workspace',
        getSchema: vi.fn().mockResolvedValue(mockTableSchema),
      } as unknown as SmartSuiteClient;
    });

    it('should translate API codes back to human-readable names', async () => {
      // CONTRACT: Given API response with field slugs, return human-friendly labels
      // EXPECT: Slugs mapped to labels

      // Arrange
      const { FieldTranslator } = await import('../../../src/core/field-translator.js');
      const translator = new FieldTranslator(mockClient);
      await translator.loadMappingsForTable('65abc123def456');

      const apiFields = {
        s9a4d6f2: 'Q1 Initiative',
        s1b8c3e4: 'In Progress',
        s7f2a9d1: ['customer-id-123'],
      };

      // Act
      const humanFields = translator.reverseTranslateFields('65abc123def456', apiFields);

      // Assert
      expect(humanFields).toEqual({
        'Project Name': 'Q1 Initiative',
        Status: 'In Progress',
        Customer: ['customer-id-123'],
      });
    });

    it('should pass through unknown API field codes', async () => {
      // CONTRACT: Unknown slugs preserved in output (SmartSuite may add fields)
      // EXPECT: Unknown codes kept as-is

      // Arrange
      const { FieldTranslator } = await import('../../../src/core/field-translator.js');
      const translator = new FieldTranslator(mockClient);
      await translator.loadMappingsForTable('65abc123def456');

      const apiFields = {
        s9a4d6f2: 'Known Field',
        unknown_slug_123: 'Unknown Field Value',
        s1b8c3e4: 'Another Known',
      };

      // Act
      const humanFields = translator.reverseTranslateFields('65abc123def456', apiFields);

      // Assert - Known fields translated, unknown preserved
      expect(humanFields).toHaveProperty('Project Name', 'Known Field');
      expect(humanFields).toHaveProperty('Status', 'Another Known');
      expect(humanFields).toHaveProperty('unknown_slug_123', 'Unknown Field Value');
    });

    it('should handle response arrays (list operations)', async () => {
      // CONTRACT: SmartSuite list responses contain array of records
      // EXPECT: Translate each record in array

      // Arrange
      const { FieldTranslator } = await import('../../../src/core/field-translator.js');
      const translator = new FieldTranslator(mockClient);
      await translator.loadMappingsForTable('65abc123def456');

      const apiResponse = [
        { s9a4d6f2: 'Project 1', s1b8c3e4: 'Active' },
        { s9a4d6f2: 'Project 2', s1b8c3e4: 'Completed' },
        { s9a4d6f2: 'Project 3', s1b8c3e4: 'On Hold' },
      ];

      // Act
      const humanResponse = apiResponse.map((record) =>
        translator.reverseTranslateFields('65abc123def456', record),
      );

      // Assert - All records translated
      expect(humanResponse).toHaveLength(3);
      expect(humanResponse[0]).toHaveProperty('Project Name', 'Project 1');
      expect(humanResponse[1]).toHaveProperty('Status', 'Completed');
      expect(humanResponse[2]).toHaveProperty('Project Name', 'Project 3');
    });

    it('should preserve system metadata fields', async () => {
      // CONTRACT: SmartSuite includes system fields (id, created_date, etc.)
      // EXPECT: System fields preserved even if not in schema

      // Arrange
      const { FieldTranslator } = await import('../../../src/core/field-translator.js');
      const translator = new FieldTranslator(mockClient);
      await translator.loadMappingsForTable('65abc123def456');

      const apiFields = {
        id: 'rec-abc-123',
        s9a4d6f2: 'My Project',
        created_date: '2025-10-01T00:00:00Z',
        updated_date: '2025-10-01T12:00:00Z',
      };

      // Act
      const humanFields = translator.reverseTranslateFields('65abc123def456', apiFields);

      // Assert - System fields preserved
      expect(humanFields).toHaveProperty('id', 'rec-abc-123');
      expect(humanFields).toHaveProperty('created_date');
      expect(humanFields).toHaveProperty('Project Name', 'My Project');
    });
  });

  describe('Table Resolution (TABLE-001)', () => {
    let mockClient: SmartSuiteClient;
    const mockWorkspaceApplications = [
      { id: '65abc123def456', name: 'Projects' },
      { id: '78xyz456abc789', name: 'Customers' },
      { id: '99pqr789xyz123', name: 'Invoices' },
    ];

    beforeEach(() => {
      // Mock workspace applications list
      mockClient = {
        apiKey: 'test-key',
        workspaceId: 'test-workspace',
        request: vi.fn().mockResolvedValue(mockWorkspaceApplications),
      } as unknown as SmartSuiteClient;
    });

    it('should resolve table display name to table ID', async () => {
      // CONTRACT: Given table name, return table ID for API calls
      // EXPECT: Name→ID lookup from workspace applications

      // Arrange
      const { FieldTranslator } = await import('../../../src/core/field-translator.js');
      const translator = new FieldTranslator(mockClient);

      // Act
      const tableId = await translator.resolveTableId('Projects');

      // Assert
      expect(tableId).toBe('65abc123def456');
    });

    it('should cache table ID lookups for performance', async () => {
      // CONTRACT: Subsequent table resolutions use cache
      // EXPECT: API called once, then cached

      // Arrange
      const { FieldTranslator } = await import('../../../src/core/field-translator.js');
      const translator = new FieldTranslator(mockClient);

      // Act - Resolve same table multiple times
      await translator.resolveTableId('Projects');
      await translator.resolveTableId('Projects');
      await translator.resolveTableId('Projects');

      // Assert - API called only once
      expect(mockClient.request).toHaveBeenCalledTimes(1);
    });

    it('should handle reverse table resolution (ID → name)', async () => {
      // CONTRACT: Given table ID, return display name
      // EXPECT: ID→name lookup from cache

      // Arrange
      const { FieldTranslator } = await import('../../../src/core/field-translator.js');
      const translator = new FieldTranslator(mockClient);

      // Load cache first
      await translator.resolveTableId('Projects');

      // Act
      const tableName = translator.getTableName('65abc123def456');

      // Assert
      expect(tableName).toBe('Projects');
    });

    it('should throw error for unknown table name', async () => {
      // CONTRACT: Unknown table name throws descriptive error
      // EXPECT: Clear message about table not found

      // Arrange
      const { FieldTranslator } = await import('../../../src/core/field-translator.js');
      const translator = new FieldTranslator(mockClient);

      // Act & Assert
      await expect(translator.resolveTableId('Nonexistent Table')).rejects.toThrow(
        /not found|unknown table/i,
      );
    });

    it('should handle case-insensitive table name matching', async () => {
      // CONTRACT: Table names should match case-insensitively for convenience
      // EXPECT: "projects", "Projects", "PROJECTS" all resolve to same ID

      // Arrange
      const { FieldTranslator } = await import('../../../src/core/field-translator.js');
      const translator = new FieldTranslator(mockClient);

      // Act
      const id1 = await translator.resolveTableId('Projects');
      const id2 = await translator.resolveTableId('projects');
      const id3 = await translator.resolveTableId('PROJECTS');

      // Assert - All resolve to same ID
      expect(id1).toBe('65abc123def456');
      expect(id2).toBe('65abc123def456');
      expect(id3).toBe('65abc123def456');
    });

    it('should support table ID pass-through (if already an ID)', async () => {
      // CONTRACT: If input is already a table ID, return as-is
      // EXPECT: No API call needed for IDs

      // Arrange
      const { FieldTranslator } = await import('../../../src/core/field-translator.js');
      const translator = new FieldTranslator(mockClient);

      // Act - Pass table ID directly
      const tableId = await translator.resolveTableId('65abc123def456');

      // Assert - No API call made, ID returned as-is
      expect(tableId).toBe('65abc123def456');
      expect(mockClient.request).not.toHaveBeenCalled();
    });

    it('should handle workspace applications fetch error', async () => {
      // CONTRACT: Network/API errors during table discovery throw meaningful errors
      // EXPECT: Clear error message

      // Arrange
      mockClient.request = vi.fn().mockRejectedValue(new Error('Network timeout'));

      const { FieldTranslator } = await import('../../../src/core/field-translator.js');
      const translator = new FieldTranslator(mockClient);

      // Act & Assert
      await expect(translator.resolveTableId('Projects')).rejects.toThrow(/network|timeout/i);
    });
  });

  describe('Error Handling and Edge Cases', () => {
    let mockClient: SmartSuiteClient;

    beforeEach(() => {
      mockClient = {
        apiKey: 'test-key',
        workspaceId: 'test-workspace',
        getSchema: vi.fn(),
      } as unknown as SmartSuiteClient;
    });

    it('should handle malformed schema structure', async () => {
      // CONTRACT: Invalid schema structure from API throws descriptive error
      // EXPECT: Clear error about schema format

      // Arrange - Schema missing structure field
      mockClient.getSchema = vi.fn().mockResolvedValue({
        id: '65abc123def456',
        name: 'Broken Table',
        // Missing 'structure' field
      });

      const { FieldTranslator } = await import('../../../src/core/field-translator.js');
      const translator = new FieldTranslator(mockClient);

      // Act & Assert
      await expect(translator.loadMappingsForTable('65abc123def456')).rejects.toThrow(
        /invalid schema|structure/i,
      );
    });

    it('should handle null or undefined field values', async () => {
      // CONTRACT: Null/undefined values preserved during translation
      // EXPECT: Field names translated, values preserved

      // Arrange
      const mockTableSchema: TableSchema = {
        id: '65abc123def456',
        name: 'Test',
        structure: [{ slug: 's9a4d6f2', label: 'Field1', field_type: 'textfield' }],
      };

      mockClient.getSchema = vi.fn().mockResolvedValue(mockTableSchema);

      const { FieldTranslator } = await import('../../../src/core/field-translator.js');
      const translator = new FieldTranslator(mockClient);
      await translator.loadMappingsForTable('65abc123def456');

      // Act
      const apiFields = await translator.translateFields('65abc123def456', {
        Field1: null,
      });

      // Assert
      expect(apiFields).toHaveProperty('s9a4d6f2', null);
    });

    it('should handle duplicate field labels gracefully', async () => {
      // CONTRACT: If schema has duplicate labels, use first occurrence
      // EXPECT: Warning logged, first mapping used

      // Arrange - Schema with duplicate labels
      const mockTableSchema: TableSchema = {
        id: '65abc123def456',
        name: 'Test',
        structure: [
          { slug: 's9a4d6f2', label: 'Name', field_type: 'textfield' },
          { slug: 's1b8c3e4', label: 'Name', field_type: 'textfield' }, // Duplicate!
        ],
      };

      mockClient.getSchema = vi.fn().mockResolvedValue(mockTableSchema);

      const { FieldTranslator } = await import('../../../src/core/field-translator.js');
      const translator = new FieldTranslator(mockClient);

      // Act
      await translator.loadMappingsForTable('65abc123def456');

      const apiFields = await translator.translateFields('65abc123def456', {
        Name: 'Test Value',
      });

      // Assert - First occurrence used
      expect(apiFields).toHaveProperty('s9a4d6f2', 'Test Value');
      expect(apiFields).not.toHaveProperty('s1b8c3e4');
    });

    it('should validate table ID format', async () => {
      // CONTRACT: Table IDs follow SmartSuite format (alphanumeric, specific length)
      // EXPECT: Invalid format throws error

      // Arrange
      const { FieldTranslator } = await import('../../../src/core/field-translator.js');
      const translator = new FieldTranslator(mockClient);

      // Act & Assert - Invalid table ID formats
      await expect(translator.loadMappingsForTable('')).rejects.toThrow(/invalid.*table.*id/i);
      await expect(translator.loadMappingsForTable('   ')).rejects.toThrow(/invalid.*table.*id/i);
    });

    it('should handle concurrent translation requests', async () => {
      // CONTRACT: Multiple simultaneous translations should not cause race conditions
      // EXPECT: All translations complete successfully

      // Arrange
      const mockTableSchema: TableSchema = {
        id: '65abc123def456',
        name: 'Test',
        structure: [
          { slug: 's9a4d6f2', label: 'Field1', field_type: 'textfield' },
          { slug: 's1b8c3e4', label: 'Field2', field_type: 'textfield' },
        ],
      };

      mockClient.getSchema = vi.fn().mockResolvedValue(mockTableSchema);

      const { FieldTranslator } = await import('../../../src/core/field-translator.js');
      const translator = new FieldTranslator(mockClient);

      // Act - Concurrent auto-loading translations
      const promises = [
        translator.translateFields('65abc123def456', { Field1: 'Value1' }),
        translator.translateFields('65abc123def456', { Field2: 'Value2' }),
        translator.translateFields('65abc123def456', { Field1: 'Value3' }),
      ];

      const results = await Promise.all(promises);

      // Assert - All succeed, schema fetched only once
      expect(results).toHaveLength(3);
      expect(mockClient.getSchema).toHaveBeenCalledTimes(1); // No duplicate loads
    });
  });

  describe('Integration Patterns', () => {
    it('should integrate with query operations', async () => {
      // CONTRACT: Translator used as middleware for query operations
      // EXPECT: Human input → translated query → API → translated response

      // Arrange
      const mockTableSchema: TableSchema = {
        id: '65abc123def456',
        name: 'Projects',
        structure: [
          { slug: 's9a4d6f2', label: 'Project Name', field_type: 'textfield' },
          { slug: 's1b8c3e4', label: 'Status', field_type: 'statusfield' },
        ],
      };

      const mockClient = {
        apiKey: 'test-key',
        workspaceId: 'test-workspace',
        getSchema: vi.fn().mockResolvedValue(mockTableSchema),
        listRecords: vi.fn().mockResolvedValue({
          items: [
            { s9a4d6f2: 'Project 1', s1b8c3e4: 'Active' },
            { s9a4d6f2: 'Project 2', s1b8c3e4: 'Completed' },
          ],
          total: 2,
        }),
      } as unknown as SmartSuiteClient;

      const { FieldTranslator } = await import('../../../src/core/field-translator.js');
      const translator = new FieldTranslator(mockClient);

      // Act - User provides human-friendly filter
      const humanFilter = { Status: 'Active' };
      const apiFilter = await translator.translateFields('65abc123def456', humanFilter);

      // Query with translated filter
      const response = await mockClient.listRecords('65abc123def456', { filter: apiFilter });

      // Translate response back to human
      const humanRecords = response.items.map((record) =>
        translator.reverseTranslateFields('65abc123def456', record as Record<string, unknown>),
      );

      // Assert - Complete translation cycle
      expect(apiFilter).toHaveProperty('s1b8c3e4', 'Active');
      expect(humanRecords[0]).toHaveProperty('Project Name', 'Project 1');
      expect(humanRecords[0]).toHaveProperty('Status', 'Active');
    });

    it('should integrate with record creation operations', async () => {
      // CONTRACT: Translator used for create/update operations
      // EXPECT: Human input → translated data → API → translated response

      // Arrange
      const mockTableSchema: TableSchema = {
        id: '65abc123def456',
        name: 'Projects',
        structure: [
          { slug: 's9a4d6f2', label: 'Project Name', field_type: 'textfield' },
          { slug: 's1b8c3e4', label: 'Status', field_type: 'statusfield' },
        ],
      };

      const mockClient = {
        apiKey: 'test-key',
        workspaceId: 'test-workspace',
        getSchema: vi.fn().mockResolvedValue(mockTableSchema),
        createRecord: vi.fn().mockResolvedValue({
          id: 'rec-new-123',
          s9a4d6f2: 'New Project',
          s1b8c3e4: 'Planning',
        }),
      } as unknown as SmartSuiteClient;

      const { FieldTranslator } = await import('../../../src/core/field-translator.js');
      const translator = new FieldTranslator(mockClient);

      // Act - User provides human-friendly record data
      const humanData = {
        'Project Name': 'New Project',
        Status: 'Planning',
      };

      const apiData = await translator.translateFields('65abc123def456', humanData);
      const createdRecord = await mockClient.createRecord('65abc123def456', apiData);
      const humanRecord = translator.reverseTranslateFields(
        '65abc123def456',
        createdRecord as Record<string, unknown>,
      );

      // Assert
      expect(apiData).toHaveProperty('s9a4d6f2', 'New Project');
      expect(humanRecord).toHaveProperty('Project Name', 'New Project');
      expect(humanRecord).toHaveProperty('id', 'rec-new-123');
    });
  });
});
