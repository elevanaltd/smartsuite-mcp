// Context7: consulted for vitest
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { discoverFields, labelToCamelCase } from '../../scripts/discover-fields.js';
import type { SmartSuiteClient } from '../../src/smartsuite-client.js';
// Mock the SmartSuite client module to prevent real API calls in CI
vi.mock('../../src/smartsuite-client.js', () => ({
  createAuthenticatedClient: vi.fn(),
}));

// Mock fs-extra to prevent file system operations
vi.mock('fs-extra', () => ({
  default: {
    pathExists: vi.fn(),
    readFile: vi.fn(),
    ensureDir: vi.fn(),
    writeFile: vi.fn(),
  },
  pathExists: vi.fn(),
  readFile: vi.fn(),
  ensureDir: vi.fn(),
  writeFile: vi.fn(),
}));

describe('Field Discovery Script', () => {
  // Store original values
  const originalConsoleLog = console.log;
  const originalConsoleError = console.error;
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.clearAllMocks();
    // Mock console to prevent output during tests
    console.log = vi.fn();
    console.error = vi.fn();
    // Clear env vars to simulate CI environment
    delete process.env.SMARTSUITE_API_TOKEN;
    delete process.env.SMARTSUITE_WORKSPACE_ID;
  });

  afterEach(() => {
    // Restore console methods
    console.log = originalConsoleLog;
    console.error = originalConsoleError;
    // Restore env vars
    process.env = originalEnv;
  });

  describe('discoverFields', () => {
    it('should fetch schema from SmartSuite API', async () => {
      // Import mocked modules
      const { createAuthenticatedClient } = await import('../../src/smartsuite-client.js');
      const fs = await import('fs-extra');

      // Setup mock client with getSchema method using type-safe partial mock
      const mockClient: Partial<SmartSuiteClient> = {
        getSchema: vi.fn().mockResolvedValue({
          id: '68a8ff5237fde0bf797c05b3',
          name: 'Test Application',
          structure: [
            {
              slug: 'field1',
              label: 'Field One',
              field_type: 'text',
              params: { description: 'Test field' },
            },
            {
              slug: 'field2',
              label: 'Field Two',
              field_type: 'number',
              params: {},
            },
          ],
        }),
      };

      // Mock the client creation with constrained type assertion
      vi.mocked(createAuthenticatedClient).mockResolvedValue(mockClient as SmartSuiteClient);

      // Mock file system operations
      (vi.mocked(fs.pathExists) as any).mockResolvedValue(false);

      // Execute the function
      const mockAppId = '68a8ff5237fde0bf797c05b3';
      await discoverFields(mockAppId);

      // Verify that createAuthenticatedClient was called
      expect(createAuthenticatedClient).toHaveBeenCalledWith({
        apiKey: undefined,
        workspaceId: undefined,
      });

      // Verify that getSchema was called with the correct app ID
      expect(mockClient.getSchema).toHaveBeenCalledWith(mockAppId);
    });

    it('should compare fetched schema with existing mappings', async () => {
      // Import mocked modules
      const { createAuthenticatedClient } = await import('../../src/smartsuite-client.js');
      const fs = await import('fs-extra');

      // Setup mock client using type-safe partial mock
      const mockClient: Partial<SmartSuiteClient> = {
        getSchema: vi.fn().mockResolvedValue({
          id: '68a8ff5237fde0bf797c05b3',
          name: 'Test Application',
          structure: [
            {
              slug: 'smtxva09j',
              label: 'Project Name',
              field_type: 'text',
            },
            {
              slug: 'new_field',
              label: 'New Field',
              field_type: 'text',
            },
          ],
        }),
      };

      vi.mocked(createAuthenticatedClient).mockResolvedValue(mockClient as SmartSuiteClient);

      // Mock existing mapping file
      (vi.mocked(fs.pathExists) as any).mockResolvedValue(true);
      (vi.mocked(fs.readFile) as any).mockResolvedValue(`
tableName: test-application
tableId: 68a8ff5237fde0bf797c05b3
fields:
  projectName: smtxva09j
`);

      const mockAppId = '68a8ff5237fde0bf797c05b3';
      await discoverFields(mockAppId);

      // Verify console output includes analysis of mapped vs unmapped
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('✅ Mapped'));
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('❌ Not Mapped'));
    });

    it('should generate human-readable field names from labels', () => {
      // Test the label to camelCase conversion
      // This defines the contract that the implementation must meet
      const testCases = [
        { label: 'Project Name', expected: 'projectName' },
        { label: 'Initial Cost', expected: 'initialCost' },
        { label: 'Client Contacts', expected: 'clientContacts' },
        { label: 'BOOKING STREAM STATUS', expected: 'bookingStreamStatus' },
      ];

      // Test each case - this enforces the contract
      testCases.forEach((testCase) => {
        const result = labelToCamelCase(testCase.label);
        expect(result).toBe(testCase.expected);
      });
    });

    it('should identify orphaned mappings (fields that no longer exist)', async () => {
      // Import mocked modules
      const { createAuthenticatedClient } = await import('../../src/smartsuite-client.js');
      const fs = await import('fs-extra');

      // Setup mock client with schema missing a field using type-safe partial mock
      const mockClient: Partial<SmartSuiteClient> = {
        getSchema: vi.fn().mockResolvedValue({
          id: '68a8ff5237fde0bf797c05b3',
          name: 'Test Application',
          structure: [
            {
              slug: 'field1',
              label: 'Field One',
              field_type: 'text',
            },
          ],
        }),
      };

      vi.mocked(createAuthenticatedClient).mockResolvedValue(mockClient as SmartSuiteClient);

      // Mock existing mapping with orphaned field
      (vi.mocked(fs.pathExists) as any).mockResolvedValue(true);
      (vi.mocked(fs.readFile) as any).mockResolvedValue(`
tableName: test-application
tableId: 68a8ff5237fde0bf797c05b3
fields:
  fieldOne: field1
  orphanedField: field_that_doesnt_exist
`);

      await discoverFields('68a8ff5237fde0bf797c05b3');

      // Verify warning about orphaned mappings
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Warning'));
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('field_that_doesnt_exist'));
    });

    it('should generate YAML output for new mappings', async () => {
      // Import mocked modules
      const { createAuthenticatedClient } = await import('../../src/smartsuite-client.js');
      const fs = await import('fs-extra');

      // Setup mock client using type-safe partial mock
      const mockClient: Partial<SmartSuiteClient> = {
        getSchema: vi.fn().mockResolvedValue({
          id: '68a8ff5237fde0bf797c05b3',
          name: 'Test Application',
          structure: [
            {
              slug: 'proj_name',
              label: 'Project Name',
              field_type: 'text',
            },
            {
              slug: 'init_cost',
              label: 'Initial Cost',
              field_type: 'currency',
            },
          ],
        }),
      };

      vi.mocked(createAuthenticatedClient).mockResolvedValue(mockClient as SmartSuiteClient);
      (vi.mocked(fs.pathExists) as any).mockResolvedValue(false);

      // Mock process.argv to include --generate flag
      const originalArgv = process.argv;
      process.argv = [...process.argv, '--generate'];

      await discoverFields('68a8ff5237fde0bf797c05b3');

      // Restore argv
      process.argv = originalArgv;

      // Verify YAML generation output
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('Complete YAML mapping file:'),
      );
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('projectName: proj_name'));
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('initialCost: init_cost'));
    });
  });
});
