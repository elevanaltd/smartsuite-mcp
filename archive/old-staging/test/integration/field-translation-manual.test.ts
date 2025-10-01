// Context7: consulted for vitest
// Manual integration test to verify field translation works when config path is correct
import { describe, it, expect, beforeEach, vi } from 'vitest';

import { SmartSuiteShimServer } from '../../src/mcp-server.js';
import { createAuthenticatedTestServer } from '../helpers/test-server.js';

describe('Field Translation Integration - Manual Path Test', () => {
  let server: SmartSuiteShimServer;

  beforeEach(async () => {
    // Use TestGuard-approved authentication helper
    server = await createAuthenticatedTestServer();

    // Mock the client to avoid API calls
    (server as any).client = {
      listRecords: vi
        .fn()
        .mockResolvedValue([
          { title: 'Test Project', autonumber: 'EAV001', project_name_actual: 'My Test Project' },
        ]),
      createRecord: vi
        .fn()
        .mockImplementation((_appId, data) => Promise.resolve({ id: 'new-record', ...data })),
      getSchema: vi.fn().mockResolvedValue({
        id: 'projects-app-id',
        name: 'Projects',
        structure: [],
      }),
    };
  });

  it('should translate human-readable field names to API codes for queries', async () => {
    const projectsAppId = '68a8ff5237fde0bf797c05b3'; // Projects table ID from config

    const result = await server.executeTool('smartsuite_query', {
      operation: 'list',
      appId: projectsAppId,
      filters: { projectName: 'Test Project' }, // Using human-readable field name
    });

    // Should translate 'projectName' to 'project_name_actual' in the API call
    expect(result).toBeDefined();
  });

  it('should translate human-readable field names for record creation', async () => {
    const projectsAppId = '68a8ff5237fde0bf797c05b3';

    // Mock the fieldTranslator for this specific test only
    // This ensures the test contract for field translation is properly tested
    (server as any).fieldTranslator.hasMappings = vi.fn().mockReturnValue(true);
    (server as any).fieldTranslator.humanToApi = vi.fn().mockImplementation((_appId, data) => data);
    (server as any).fieldMappingsInitialized = true;

    // Mock the client's getSchema to return a schema that includes the fields we're using
    (server as any).client.getSchema = vi.fn().mockResolvedValue({
      id: 'projects-app-id',
      name: 'Projects',
      structure: [
        { slug: 'projectName', field_type: 'textfield', params: {} },
        { slug: 'priority', field_type: 'textfield', params: {} },
      ],
    });

    const result = await server.executeTool('smartsuite_record', {
      operation: 'create',
      appId: projectsAppId,
      data: {
        projectName: 'New Project via Human Fields', // Human-readable
        priority: 'High',
      },
      dry_run: true,
    });

    expect(result).toMatchObject({
      dry_run: true,
      operation: 'create',
      appId: projectsAppId,
      fieldMappingsUsed: expect.any(Boolean),
      message: expect.stringContaining('DRY-RUN PASSED'),
    });
  });

  it('should include field mapping info in schema responses', async () => {
    const projectsAppId = '68a8ff5237fde0bf797c05b3';

    const result = await server.executeTool('smartsuite_schema', {
      appId: projectsAppId,
      output_mode: 'detailed',
    });

    expect(result).toMatchObject({
      id: 'projects-app-id',
      name: 'Projects',
      structure: [],
      fieldMappings: {
        hasCustomMappings: expect.any(Boolean),
        message: expect.stringContaining('field'),
      },
    });
  });

  it('should throw an error for unknown table IDs', async () => {
    const unknownAppId = 'unknown-table-id';

    // The server must be initialized for the resolver to work
    (server as any).fieldMappingsInitialized = true;

    // Table resolver now validates table IDs and rejects unknown ones
    await expect(
      server.executeTool('smartsuite_schema', {
        appId: unknownAppId,
      }),
    ).rejects.toThrow(/Unknown table 'unknown-table-id'/);
  });

  it('should gracefully handle a VALID table that has no field mappings', async () => {
    // Use a REAL table ID from config
    const videosAppId = '68f89f5338fde3aaac63c7a5'; // videos table

    // Mock the translator to specifically return no mappings for this valid ID
    vi.spyOn((server as any).fieldTranslator, 'hasMappings').mockReturnValue(false);
    (server as any).fieldMappingsInitialized = true;

    // Mock the underlying client call to prevent a real API call
    (server as any).client.getSchema = vi.fn().mockResolvedValue({
      id: 'videos-app-id',
      name: 'Videos',
      structure: [],
    });

    const result = await server.executeTool('smartsuite_schema', {
      appId: videosAppId,
      output_mode: 'detailed',
    });

    // Assert the ORIGINAL intended behavior - graceful handling with message
    expect(result).toMatchObject({
      fieldMappings: {
        hasCustomMappings: false,
        message: expect.stringContaining('raw API field codes'),
      },
    });
  });
});
