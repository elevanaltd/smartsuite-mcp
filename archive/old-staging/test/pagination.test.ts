// Context7: consulted for vitest
// Test pagination behavior - must pass limit/offset as URL params
// TESTGUARD: Critical behavior test for MCP token limitation handling
import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('SmartSuite API Pagination', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  describe('URL parameter handling', () => {
    it('should send limit and offset as URL query parameters, not in request body', async () => {
      // CONTRACT: SmartSuite API requires limit/offset as URL params
      const apiKey = 'test-key';
      const workspaceId = 'test-workspace';
      const appId = 'test-app-id';

      // Mock successful auth
      const mockFetch = vi.fn();
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({ workspace: { id: workspaceId } }),
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({
            items: [{ id: '1' }, { id: '2' }],
            total: 100,
            offset: 50,
            limit: 25,
          }),
        } as Response);

      global.fetch = mockFetch;

      const { createAuthenticatedClient } = await import('../src/smartsuite-client.js');
      const client = await createAuthenticatedClient({ apiKey, workspaceId });

      // Test listRecords with pagination options
      await client.listRecords(appId, {
        limit: 25,
        offset: 50,
        filter: { status: 'active' },
        sort: [{ field: 'name', direction: 'asc' }],
      });

      // Should have made 2 calls: auth + listRecords
      expect(mockFetch).toHaveBeenCalledTimes(2);

      const listRecordsCall = mockFetch.mock.calls[1];
      if (!listRecordsCall) {
        throw new Error('Expected listRecords call not found');
      }
      const [url, options] = listRecordsCall;

      // URL should contain limit and offset as query parameters
      expect(url).toContain('limit=25');
      expect(url).toContain('offset=50');
      expect(url).toMatch(/\/records\/list\/\?.*limit=25.*offset=50/);

      // Request body should NOT contain limit/offset
      const requestBody = JSON.parse(options.body as string);
      expect(requestBody).not.toHaveProperty('limit');
      expect(requestBody).not.toHaveProperty('offset');

      // Request body SHOULD contain filter/sort
      // TESTGUARD-APPROVED: FILTER-TRANSFORMATION-UPDATE-20250910
      // Test updated to match current filter transformation behavior
      expect(requestBody).toHaveProperty('filter', {
        operator: 'and',
        fields: [{ field: 'status', comparison: 'is', value: 'active' }],
      });
      expect(requestBody).toHaveProperty('sort', [{ field: 'name', direction: 'asc' }]);
    });

    it('should add hydrated=false by default to reduce payload size', async () => {
      const apiKey = 'test-key';
      const workspaceId = 'test-workspace';
      const appId = 'test-app-id';

      const mockFetch = vi.fn();
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({ workspace: { id: workspaceId } }),
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({
            items: [{ id: '1' }],
            total: 1,
            offset: 0,
            limit: 200,
          }),
        } as Response);

      global.fetch = mockFetch;

      const { createAuthenticatedClient } = await import('../src/smartsuite-client.js');
      const client = await createAuthenticatedClient({ apiKey, workspaceId });

      await client.listRecords(appId);

      const listRecordsCall = mockFetch.mock.calls[1];
      if (!listRecordsCall) {
        throw new Error('Expected listRecords call not found');
      }
      const requestBody = JSON.parse(listRecordsCall[1].body as string);

      // Should set hydrated=false to reduce token usage
      expect(requestBody).toHaveProperty('hydrated', false);
    });
  });

  describe('return value handling', () => {
    it('should return full response structure for cursor-based pagination', async () => {
      const apiKey = 'test-key';
      const workspaceId = 'test-workspace';
      const appId = 'test-app-id';

      const mockResponse = {
        items: [{ id: '1' }, { id: '2' }],
        total: 5000,
        offset: 200,
        limit: 200,
      };

      const mockFetch = vi.fn();
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({ workspace: { id: workspaceId } }),
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => mockResponse,
        } as Response);

      global.fetch = mockFetch;

      const { createAuthenticatedClient } = await import('../src/smartsuite-client.js');
      const client = await createAuthenticatedClient({ apiKey, workspaceId });

      const result = await client.listRecords(appId, { limit: 200, offset: 200 });

      // Should return full structure, not just items
      expect(result).toEqual(mockResponse);
      expect(result).toHaveProperty('items');
      expect(result).toHaveProperty('total', 5000);
      expect(result).toHaveProperty('offset', 200);
      expect(result).toHaveProperty('limit', 200);
    });
  });

  describe('MCP token limit defaults', () => {
    it('should default to limit=25 for MCP token optimization', async () => {
      const apiKey = 'test-key';
      const workspaceId = 'test-workspace';
      const appId = 'test-app-id';

      const mockFetch = vi.fn();
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({ workspace: { id: workspaceId } }),
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({
            items: [],
            total: 0,
            offset: 0,
            limit: 200,
          }),
        } as Response);

      global.fetch = mockFetch;

      const { createAuthenticatedClient } = await import('../src/smartsuite-client.js');
      const client = await createAuthenticatedClient({ apiKey, workspaceId });

      // Call without explicit limit
      await client.listRecords(appId);

      const listRecordsCall = mockFetch.mock.calls[1];
      if (!listRecordsCall) {
        throw new Error('Expected listRecords call not found');
      }
      const [url] = listRecordsCall;

      // Should default to limit=25 (optimized for MCP token limits)
      expect(url).toContain('limit=25');
    });

    it('should cap limit at 1000 (SmartSuite maximum)', async () => {
      const apiKey = 'test-key';
      const workspaceId = 'test-workspace';
      const appId = 'test-app-id';

      const mockFetch = vi.fn();
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({ workspace: { id: workspaceId } }),
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({
            items: [],
            total: 0,
            offset: 0,
            limit: 1000,
          }),
        } as Response);

      global.fetch = mockFetch;

      const { createAuthenticatedClient } = await import('../src/smartsuite-client.js');
      const client = await createAuthenticatedClient({ apiKey, workspaceId });

      // Try to request more than SmartSuite allows
      await client.listRecords(appId, { limit: 5000 });

      const listRecordsCall = mockFetch.mock.calls[1];
      if (!listRecordsCall) {
        throw new Error('Expected listRecords call not found');
      }
      const [url] = listRecordsCall;

      // Should cap at 1000
      expect(url).toContain('limit=1000');
    });
  });
});
