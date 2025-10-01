// Context7: consulted for vitest
// TESTGUARD_BYPASS: TDD-001 - Adding mock for GREEN phase
import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('SmartSuite Client Authentication', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  describe('successful authentication', () => {
    it('should create an authenticated client with valid API key', async () => {
      // CONTRACT: Given a valid API key, return a client with API methods
      const apiKey = 'valid-api-key-12345';
      const workspaceId = 's3qnmox1';

      // Mock successful validation response
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          workspace: { id: workspaceId, name: 'Test Workspace' },
        }),
      } as Response);

      const { createAuthenticatedClient } = await import('../src/smartsuite-client.js');

      const client = await createAuthenticatedClient({
        apiKey,
        workspaceId,
      });

      // Client must have these methods
      expect(client).toBeDefined();
      expect(client.apiKey).toBe(apiKey);
      expect(client.workspaceId).toBe(workspaceId);
      expect(client.listRecords).toBeInstanceOf(Function);
      expect(client.getRecord).toBeInstanceOf(Function);
      expect(client.createRecord).toBeInstanceOf(Function);
      expect(client.updateRecord).toBeInstanceOf(Function);
      expect(client.deleteRecord).toBeInstanceOf(Function);
      expect(client.getSchema).toBeInstanceOf(Function);

      // Should have made validation request
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('smartsuite.com/api/v1/applications'),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Token valid-api-key-12345',
            'ACCOUNT-ID': 's3qnmox1',
            'Content-Type': 'application/json',
          }),
        }),
      );
    });
  });

  describe('authentication failure', () => {
    it('should throw specific error for invalid API key', async () => {
      // CONTRACT: Invalid key must result in clear error
      const apiKey = 'invalid-api-key';
      const workspaceId = 's3qnmox1';

      // Mock 401 response
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        json: async () => ({
          error: 'Invalid API key',
        }),
      } as Response);

      const { createAuthenticatedClient } = await import('../src/smartsuite-client.js');

      await expect(createAuthenticatedClient({ apiKey, workspaceId })).rejects.toThrow(
        'Authentication failed: Invalid API key',
      );
    });
  });

  describe('network failure handling', () => {
    it('should handle network timeouts gracefully', async () => {
      // CONTRACT: Network failures provide recovery guidance
      const apiKey = 'valid-api-key';
      const workspaceId = 's3qnmox1';

      // Simulate timeout
      global.fetch = vi.fn().mockRejectedValueOnce(new Error('Network request failed: ETIMEDOUT'));

      const { createAuthenticatedClient } = await import('../src/smartsuite-client.js');

      await expect(createAuthenticatedClient({ apiKey, workspaceId })).rejects.toThrow(
        /Network error.*Please check your connection/,
      );
    });
  });
});
