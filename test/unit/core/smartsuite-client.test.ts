// Phoenix Test Contract: AUTH-001, AUTH-002
// Contract: SmartSuite client authentication and API calls
// Status: RED (no implementation exists yet)
// Source: docs/412-DOC-TEST-CONTRACTS.md
// TDD Phase: RED → (implementation pending)

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// CRITICAL: This import WILL FAIL - implementation doesn't exist yet
// This is CORRECT TDD - tests define the contract before code exists
// Types removed - unused in test file, dynamic import pattern used instead

// Mock response type interfaces for type safety
interface MockSchemaField {
  id: string;
  slug: string;
  label: string;
  field_type: string;
}

interface MockSchemaResponse {
  id: string;
  name: string;
  structure: MockSchemaField[];
}

describe('SmartSuiteClient - Authentication (AUTH-001, AUTH-002)', () => {
  let originalFetch: typeof global.fetch;

  beforeEach(() => {
    // Save original fetch
    originalFetch = global.fetch;
  });

  afterEach(() => {
    // Restore original fetch
    global.fetch = originalFetch;
    vi.clearAllMocks();
  });

  describe('AUTH-001: Client Authentication Success', () => {
    it('should create authenticated client with valid API key and workspace ID', async () => {
      // CONTRACT: Given valid apiKey and workspaceId
      // EXPECT: Return client with all required methods

      // Arrange - Mock successful authentication
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ applications: [] }),
      });
      global.fetch = mockFetch as unknown as typeof fetch;

      const config = {
        apiKey: 'valid-api-key-12345',
        workspaceId: 'workspace-67890',
      };

      // Act
      const { createAuthenticatedClient } = await import('../../../src/core/smartsuite-client.js');
      const client = await createAuthenticatedClient(config);

      // Assert - Client has all required methods
      expect(client).toBeDefined();
      expect(client.apiKey).toBe('valid-api-key-12345');
      expect(client.workspaceId).toBe('workspace-67890');
      expect(client.listRecords).toBeInstanceOf(Function);
      expect(client.getRecord).toBeInstanceOf(Function);
      expect(client.createRecord).toBeInstanceOf(Function);
      expect(client.updateRecord).toBeInstanceOf(Function);
      expect(client.deleteRecord).toBeInstanceOf(Function);
      expect(client.getSchema).toBeInstanceOf(Function);
      expect(client.countRecords).toBeInstanceOf(Function);
      expect(client.request).toBeInstanceOf(Function);
    });

    it('should make validation request with correct headers', async () => {
      // CONTRACT: Validation request must use correct SmartSuite auth format
      // EXPECT: Token format (not Bearer) with ACCOUNT-ID header

      // Arrange
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ applications: [] }),
      });
      global.fetch = mockFetch as unknown as typeof fetch;

      const config = {
        apiKey: 'test-key',
        workspaceId: 'test-workspace',
      };

      // Act
      const { createAuthenticatedClient } = await import('../../../src/core/smartsuite-client.js');
      await createAuthenticatedClient(config);

      // Assert - Verify correct authentication headers
      expect(mockFetch).toHaveBeenCalledWith(
        'https://app.smartsuite.com/api/v1/applications',
        expect.objectContaining({
          method: 'GET',
          headers: {
            Authorization: 'Token test-key',
            'ACCOUNT-ID': 'test-workspace',
            'Content-Type': 'application/json',
          },
        }),
      );
    });

    it('should use custom base URL when provided', async () => {
      // CONTRACT: Support custom base URL for testing/enterprise deployments
      // EXPECT: Use provided baseUrl instead of default

      // Arrange
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ applications: [] }),
      });
      global.fetch = mockFetch as unknown as typeof fetch;

      const config = {
        apiKey: 'test-key',
        workspaceId: 'test-workspace',
        baseUrl: 'https://custom.smartsuite.com',
      };

      // Act
      const { createAuthenticatedClient } = await import('../../../src/core/smartsuite-client.js');
      await createAuthenticatedClient(config);

      // Assert - Verify custom base URL used
      expect(mockFetch).toHaveBeenCalledWith(
        'https://custom.smartsuite.com/api/v1/applications',
        expect.any(Object),
      );
    });
  });

  describe('AUTH-002: Authentication Failure Handling', () => {
    it('should throw specific error message on 401 unauthorized', async () => {
      // CONTRACT: 401 response → throw "Authentication failed: Invalid API key"
      // EXPECT: Clear error message for authentication failure

      // Arrange
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        json: async () => ({ error: 'Invalid API key' }),
      });
      global.fetch = mockFetch as unknown as typeof fetch;

      const config = {
        apiKey: 'invalid-key',
        workspaceId: 'test-workspace',
      };

      // Act & Assert
      const { createAuthenticatedClient } = await import('../../../src/core/smartsuite-client.js');
      await expect(createAuthenticatedClient(config)).rejects.toThrow(
        /Authentication failed.*Invalid API key/i,
      );
    });

    it('should throw specific error message on 403 forbidden', async () => {
      // CONTRACT: 403 response → throw authorization error
      // EXPECT: Clear error message for workspace access denial

      // Arrange
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 403,
        statusText: 'Forbidden',
        json: async () => ({ error: 'No access to workspace' }),
      });
      global.fetch = mockFetch as unknown as typeof fetch;

      const config = {
        apiKey: 'valid-key',
        workspaceId: 'forbidden-workspace',
      };

      // Act & Assert
      const { createAuthenticatedClient } = await import('../../../src/core/smartsuite-client.js');
      await expect(createAuthenticatedClient(config)).rejects.toThrow(
        /Authorization failed.*No access to workspace/i,
      );
    });

    it('should handle network timeout errors with recovery guidance', async () => {
      // CONTRACT: Network timeout → throw message with "Network error" and recovery guidance
      // EXPECT: User-friendly error with actionable advice

      // Arrange
      const mockFetch = vi.fn().mockRejectedValue(new Error('ETIMEDOUT: Connection timeout'));
      global.fetch = mockFetch as unknown as typeof fetch;

      const config = {
        apiKey: 'test-key',
        workspaceId: 'test-workspace',
      };

      // Act & Assert
      const { createAuthenticatedClient } = await import('../../../src/core/smartsuite-client.js');
      await expect(createAuthenticatedClient(config)).rejects.toThrow(
        /Network error.*ETIMEDOUT.*check your connection/i,
      );
    });

    it('should handle service unavailable (503) errors', async () => {
      // CONTRACT: 503 response → indicate temporary service unavailability
      // EXPECT: Clear message about temporary issue

      // Arrange
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 503,
        statusText: 'Service Unavailable',
        json: async () => ({ error: 'Maintenance in progress' }),
      });
      global.fetch = mockFetch as unknown as typeof fetch;

      const config = {
        apiKey: 'test-key',
        workspaceId: 'test-workspace',
      };

      // Act & Assert
      const { createAuthenticatedClient } = await import('../../../src/core/smartsuite-client.js');
      await expect(createAuthenticatedClient(config)).rejects.toThrow(
        /SmartSuite API unavailable.*Try again later/i,
      );
    });

    it('should handle generic API errors with status code', async () => {
      // CONTRACT: Other HTTP errors → include status code and message
      // EXPECT: Informative error with status code

      // Arrange
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        json: async () => ({ error: 'Database connection failed' }),
      });
      global.fetch = mockFetch as unknown as typeof fetch;

      const config = {
        apiKey: 'test-key',
        workspaceId: 'test-workspace',
      };

      // Act & Assert
      const { createAuthenticatedClient } = await import('../../../src/core/smartsuite-client.js');
      await expect(createAuthenticatedClient(config)).rejects.toThrow(/API error 500/i);
    });

    it('should handle malformed JSON responses gracefully', async () => {
      // CONTRACT: JSON parse errors → use status text as fallback
      // EXPECT: Don't crash, provide useful error

      // Arrange
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        json: async () => {
          throw new Error('Invalid JSON');
        },
      });
      global.fetch = mockFetch as unknown as typeof fetch;

      const config = {
        apiKey: 'test-key',
        workspaceId: 'test-workspace',
      };

      // Act & Assert
      const { createAuthenticatedClient } = await import('../../../src/core/smartsuite-client.js');
      await expect(createAuthenticatedClient(config)).rejects.toThrow(/Authentication failed/i);
    });
  });

  describe('API Calls - GET Requests', () => {
    it('should construct GET request with correct endpoint', async () => {
      // CONTRACT: listRecords makes GET to /api/v1/applications/{appId}/records
      // EXPECT: Correct URL construction

      // Arrange - Create authenticated client
      const mockFetch = vi.fn()
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({ applications: [] }),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({ items: [], total: 0 }),
        });
      global.fetch = mockFetch as unknown as typeof fetch;

      const { createAuthenticatedClient } = await import('../../../src/core/smartsuite-client.js');
      const client = await createAuthenticatedClient({
        apiKey: 'test-key',
        workspaceId: 'test-workspace',
      });

      // Act
      await client.listRecords('app-123');

      // Assert - Second call should be the listRecords call
      expect(mockFetch).toHaveBeenCalledTimes(2);
      const listRecordsCall = mockFetch.mock.calls[1];
      if (!listRecordsCall?.[0]) {
        throw new Error('Test setup failed: listRecords call not found');
      }
      expect(listRecordsCall[0]).toContain('/api/v1/applications/app-123/records');
      expect(listRecordsCall[1]?.method).toBe('POST'); // SmartSuite uses POST for list with filters
    });

    it('should include authentication headers in all API calls', async () => {
      // CONTRACT: Every API call must include auth headers
      // EXPECT: Token and ACCOUNT-ID in every request

      // Arrange
      const mockFetch = vi.fn()
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({ applications: [] }),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({ items: [], total: 0 }),
        });
      global.fetch = mockFetch as unknown as typeof fetch;

      const { createAuthenticatedClient } = await import('../../../src/core/smartsuite-client.js');
      const client = await createAuthenticatedClient({
        apiKey: 'my-key',
        workspaceId: 'my-workspace',
      });

      // Act
      await client.listRecords('app-123');

      // Assert - Check second call (listRecords)
      const secondCall = mockFetch.mock.calls[1];
      if (!secondCall?.[1]?.headers) {
        throw new Error('Test setup failed: request headers not found');
      }
      const headers = secondCall[1].headers as Record<string, string>;
      expect(headers.Authorization).toBe('Token my-key');
      expect(headers['ACCOUNT-ID']).toBe('my-workspace');
      expect(headers['Content-Type']).toBe('application/json');
    });

    it('should parse and return response data correctly', async () => {
      // CONTRACT: listRecords returns SmartSuiteListResponse structure
      // EXPECT: { items, total, offset, limit }

      // Arrange
      const mockResponseData = {
        items: [
          { id: '1', title: 'Record 1' },
          { id: '2', title: 'Record 2' },
        ],
        total: 2,
      };

      const mockFetch = vi.fn()
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({ applications: [] }),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => mockResponseData,
        });
      global.fetch = mockFetch as unknown as typeof fetch;

      const { createAuthenticatedClient } = await import('../../../src/core/smartsuite-client.js');
      const client = await createAuthenticatedClient({
        apiKey: 'test-key',
        workspaceId: 'test-workspace',
      });

      // Act
      const result = await client.listRecords('app-123');

      // Assert
      expect(result.items).toHaveLength(2);
      expect(result.total).toBe(2);
      // Type assertion for mock response structure
      const firstItem = result.items[0] as { id: string; title: string };
      expect(firstItem.id).toBe('1');
    });

    it('should apply default limit for token safety', async () => {
      // CONTRACT: Default limit should be 25 for MCP token optimization
      // EXPECT: Limit parameter in request body

      // Arrange
      const mockFetch = vi.fn()
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({ applications: [] }),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({ items: [], total: 0 }),
        });
      global.fetch = mockFetch as unknown as typeof fetch;

      const { createAuthenticatedClient } = await import('../../../src/core/smartsuite-client.js');
      const client = await createAuthenticatedClient({
        apiKey: 'test-key',
        workspaceId: 'test-workspace',
      });

      // Act
      await client.listRecords('app-123');

      // Assert - Check request body
      const secondCall = mockFetch.mock.calls[1];
      if (!secondCall?.[1] || typeof secondCall[1].body !== 'string') {
        throw new Error('Test setup failed: request body not found');
      }
      const requestBody = JSON.parse(secondCall[1].body);
      expect(requestBody.limit).toBe(25); // Default limit for token safety
    });
  });

  describe('API Calls - POST Requests', () => {
    it('should construct POST request for record creation', async () => {
      // CONTRACT: createRecord makes POST to /api/v1/applications/{appId}/records/
      // EXPECT: Correct method and endpoint

      // Arrange
      const mockFetch = vi.fn()
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({ applications: [] }),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 201,
          json: async () => ({ id: 'new-123', title: 'New Record' }),
        });
      global.fetch = mockFetch as unknown as typeof fetch;

      const { createAuthenticatedClient } = await import('../../../src/core/smartsuite-client.js');
      const client = await createAuthenticatedClient({
        apiKey: 'test-key',
        workspaceId: 'test-workspace',
      });

      // Act
      await client.createRecord('app-123', { title: 'New Record' });

      // Assert
      expect(mockFetch).toHaveBeenCalledTimes(2);
      const createCall = mockFetch.mock.calls[1];
      if (!createCall?.[0] || !createCall[1]) {
        throw new Error('Test setup failed: createRecord call not found');
      }
      expect(createCall[0]).toContain('/api/v1/applications/app-123/records/');
      expect(createCall[1].method).toBe('POST');
    });

    it('should include request body in POST requests', async () => {
      // CONTRACT: createRecord sends data in request body
      // EXPECT: Body contains field data

      // Arrange
      const mockFetch = vi.fn()
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({ applications: [] }),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 201,
          json: async () => ({ id: 'new-123' }),
        });
      global.fetch = mockFetch as unknown as typeof fetch;

      const { createAuthenticatedClient } = await import('../../../src/core/smartsuite-client.js');
      const client = await createAuthenticatedClient({
        apiKey: 'test-key',
        workspaceId: 'test-workspace',
      });

      const recordData = {
        title: 'Test Record',
        status: 'active',
      };

      // Act
      await client.createRecord('app-123', recordData);

      // Assert
      const createCall = mockFetch.mock.calls[1];
      if (!createCall?.[1] || typeof createCall[1].body !== 'string') {
        throw new Error('Test setup failed: request body not found');
      }
      const requestBody = JSON.parse(createCall[1].body);
      expect(requestBody).toEqual(recordData);
    });
  });

  describe('API Calls - PUT Requests', () => {
    it('should construct PUT request for record updates', async () => {
      // CONTRACT: updateRecord makes PUT to /api/v1/applications/{appId}/records/{recordId}/
      // EXPECT: Correct method and endpoint with record ID

      // Arrange
      const mockFetch = vi.fn()
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({ applications: [] }),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({ id: 'rec-123', title: 'Updated' }),
        });
      global.fetch = mockFetch as unknown as typeof fetch;

      const { createAuthenticatedClient } = await import('../../../src/core/smartsuite-client.js');
      const client = await createAuthenticatedClient({
        apiKey: 'test-key',
        workspaceId: 'test-workspace',
      });

      // Act
      await client.updateRecord('app-123', 'rec-123', { title: 'Updated' });

      // Assert
      const updateCall = mockFetch.mock.calls[1];
      if (!updateCall?.[0] || !updateCall[1]) {
        throw new Error('Test setup failed: updateRecord call not found');
      }
      expect(updateCall[0]).toContain('/api/v1/applications/app-123/records/rec-123/');
      expect(updateCall[1].method).toBe('PATCH');
    });
  });

  describe('API Calls - DELETE Requests', () => {
    it('should construct DELETE request for record deletion', async () => {
      // CONTRACT: deleteRecord makes DELETE to /api/v1/applications/{appId}/records/{recordId}/
      // EXPECT: Correct method and endpoint

      // Arrange
      const mockFetch = vi.fn()
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({ applications: [] }),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 204,
          json: async () => ({}),
        });
      global.fetch = mockFetch as unknown as typeof fetch;

      const { createAuthenticatedClient } = await import('../../../src/core/smartsuite-client.js');
      const client = await createAuthenticatedClient({
        apiKey: 'test-key',
        workspaceId: 'test-workspace',
      });

      // Act
      await client.deleteRecord('app-123', 'rec-123');

      // Assert
      const deleteCall = mockFetch.mock.calls[1];
      if (!deleteCall?.[0] || !deleteCall[1]) {
        throw new Error('Test setup failed: deleteRecord call not found');
      }
      expect(deleteCall[0]).toContain('/api/v1/applications/app-123/records/rec-123/');
      expect(deleteCall[1].method).toBe('DELETE');
    });
  });

  describe('Error Handling - API Call Failures', () => {
    it('should handle 404 not found errors', async () => {
      // CONTRACT: 404 on API calls → throw descriptive error
      // EXPECT: Error indicates resource not found

      // Arrange
      const mockFetch = vi.fn()
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({ applications: [] }),
        })
        .mockResolvedValueOnce({
          ok: false,
          status: 404,
          statusText: 'Not Found',
          json: async () => ({ error: 'Record not found' }),
        });
      global.fetch = mockFetch as unknown as typeof fetch;

      const { createAuthenticatedClient } = await import('../../../src/core/smartsuite-client.js');
      const client = await createAuthenticatedClient({
        apiKey: 'test-key',
        workspaceId: 'test-workspace',
      });

      // Act & Assert
      await expect(client.getRecord('app-123', 'nonexistent')).rejects.toThrow(/404/);
    });

    it('should handle rate limiting (429) errors', async () => {
      // CONTRACT: 429 response → indicate rate limit exceeded
      // EXPECT: Error suggests retry after delay

      // Arrange
      const mockFetch = vi.fn()
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({ applications: [] }),
        })
        .mockResolvedValueOnce({
          ok: false,
          status: 429,
          statusText: 'Too Many Requests',
          json: async () => ({ error: 'Rate limit exceeded' }),
        });
      global.fetch = mockFetch as unknown as typeof fetch;

      const { createAuthenticatedClient } = await import('../../../src/core/smartsuite-client.js');
      const client = await createAuthenticatedClient({
        apiKey: 'test-key',
        workspaceId: 'test-workspace',
      });

      // Act & Assert
      await expect(client.listRecords('app-123')).rejects.toThrow(/429|rate limit/i);
    });

    it('should handle timeout errors during API calls', async () => {
      // CONTRACT: Network timeout during API call → user-friendly error
      // EXPECT: Clear message about timeout

      // Arrange
      const mockFetch = vi.fn()
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({ applications: [] }),
        })
        .mockRejectedValueOnce(new Error('Request timeout'));
      global.fetch = mockFetch as unknown as typeof fetch;

      const { createAuthenticatedClient } = await import('../../../src/core/smartsuite-client.js');
      const client = await createAuthenticatedClient({
        apiKey: 'test-key',
        workspaceId: 'test-workspace',
      });

      // Act & Assert
      await expect(client.listRecords('app-123')).rejects.toThrow(/timeout/i);
    });

    it('should handle invalid response format errors', async () => {
      // CONTRACT: Malformed API response → graceful error handling
      // EXPECT: Don't crash on unexpected response structure

      // Arrange
      const mockFetch = vi.fn()
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({ applications: [] }),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => {
            throw new Error('Invalid JSON');
          },
        });
      global.fetch = mockFetch as unknown as typeof fetch;

      const { createAuthenticatedClient } = await import('../../../src/core/smartsuite-client.js');
      const client = await createAuthenticatedClient({
        apiKey: 'test-key',
        workspaceId: 'test-workspace',
      });

      // Act & Assert
      await expect(client.listRecords('app-123')).rejects.toThrow();
    });
  });

  describe('Request Options and Configuration', () => {
    it('should support custom request options via request() method', async () => {
      // CONTRACT: Generic request() method for custom API calls
      // EXPECT: Flexible request construction

      // Arrange
      const mockFetch = vi.fn()
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({ applications: [] }),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({ custom: 'response' }),
        });
      global.fetch = mockFetch as unknown as typeof fetch;

      const { createAuthenticatedClient } = await import('../../../src/core/smartsuite-client.js');
      const client = await createAuthenticatedClient({
        apiKey: 'test-key',
        workspaceId: 'test-workspace',
      });

      // Act
      await client.request({
        method: 'POST',
        endpoint: '/api/v1/custom/endpoint',
        data: { test: 'data' },
      });

      // Assert
      const customCall = mockFetch.mock.calls[1];
      if (!customCall?.[0] || !customCall[1]) {
        throw new Error('Test setup failed: custom request call not found');
      }
      expect(customCall[0]).toContain('/api/v1/custom/endpoint');
      expect(customCall[1].method).toBe('POST');
    });

    it('should handle pagination parameters correctly', async () => {
      // CONTRACT: listRecords supports offset/limit pagination
      // EXPECT: Parameters passed to API correctly

      // Arrange
      const mockFetch = vi.fn()
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({ applications: [] }),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({ items: [], total: 100, offset: 50, limit: 25 }),
        });
      global.fetch = mockFetch as unknown as typeof fetch;

      const { createAuthenticatedClient } = await import('../../../src/core/smartsuite-client.js');
      const client = await createAuthenticatedClient({
        apiKey: 'test-key',
        workspaceId: 'test-workspace',
      });

      // Act
      await client.listRecords('app-123', { offset: 50, limit: 25 });

      // Assert
      const paginationCall = mockFetch.mock.calls[1];
      if (!paginationCall?.[1] || typeof paginationCall[1].body !== 'string') {
        throw new Error('Test setup failed: pagination request body not found');
      }
      const requestBody = JSON.parse(paginationCall[1].body);
      expect(requestBody.offset).toBe(50);
      expect(requestBody.limit).toBe(25);
    });

    it('should handle sorting parameters', async () => {
      // CONTRACT: listRecords supports sort configuration
      // EXPECT: Sort array with field and direction

      // Arrange
      const mockFetch = vi.fn()
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({ applications: [] }),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({ items: [], total: 0 }),
        });
      global.fetch = mockFetch as unknown as typeof fetch;

      const { createAuthenticatedClient } = await import('../../../src/core/smartsuite-client.js');
      const client = await createAuthenticatedClient({
        apiKey: 'test-key',
        workspaceId: 'test-workspace',
      });

      // Act
      await client.listRecords('app-123', {
        sort: [{ field: 'created_at', direction: 'desc' }],
      });

      // Assert
      const sortCall = mockFetch.mock.calls[1];
      if (!sortCall?.[1] || typeof sortCall[1].body !== 'string') {
        throw new Error('Test setup failed: sort request body not found');
      }
      const requestBody = JSON.parse(sortCall[1].body);
      expect(requestBody.sort).toEqual([{ field: 'created_at', direction: 'desc' }]);
    });

    it('should handle filter parameters', async () => {
      // CONTRACT: listRecords supports filter object
      // EXPECT: Filters passed to API

      // Arrange
      const mockFetch = vi.fn()
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({ applications: [] }),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({ items: [], total: 0 }),
        });
      global.fetch = mockFetch as unknown as typeof fetch;

      const { createAuthenticatedClient } = await import('../../../src/core/smartsuite-client.js');
      const client = await createAuthenticatedClient({
        apiKey: 'test-key',
        workspaceId: 'test-workspace',
      });

      // Act
      await client.listRecords('app-123', {
        filter: { status: 'active', priority: 'high' },
      });

      // Assert
      const filterCall = mockFetch.mock.calls[1];
      if (!filterCall?.[1] || typeof filterCall[1].body !== 'string') {
        throw new Error('Test setup failed: filter request body not found');
      }
      const requestBody = JSON.parse(filterCall[1].body);
      expect(requestBody.filter).toEqual({ status: 'active', priority: 'high' });
    });
  });

  describe('Schema Operations', () => {
    it('should fetch table schema', async () => {
      // CONTRACT: getSchema returns field definitions
      // EXPECT: Schema structure with fields array

      // Arrange
      const mockSchema = {
        id: 'app-123',
        name: 'Test Table',
        structure: [
          { id: 'field1', slug: 'title', label: 'Title', field_type: 'text' },
          { id: 'field2', slug: 'status', label: 'Status', field_type: 'single_select' },
        ],
      };

      const mockFetch = vi.fn()
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({ applications: [] }),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => mockSchema,
        });
      global.fetch = mockFetch as unknown as typeof fetch;

      const { createAuthenticatedClient } = await import('../../../src/core/smartsuite-client.js');
      const client = await createAuthenticatedClient({
        apiKey: 'test-key',
        workspaceId: 'test-workspace',
      });

      // Act
      const schema = await client.getSchema('app-123');

      // Assert - Type assertion for mock schema structure
      const typedSchema = schema as MockSchemaResponse;
      expect(typedSchema.id).toBe('app-123');
      expect(typedSchema.structure).toHaveLength(2);
      const firstField = typedSchema.structure[0];
      if (!firstField) {
        throw new Error('Test setup failed: schema structure is empty');
      }
      expect(firstField.slug).toBe('title');
    });
  });

  describe('Record Count Operations', () => {
    it('should count records with filters', async () => {
      // CONTRACT: countRecords returns total count
      // EXPECT: Number representing total records

      // Arrange
      const mockFetch = vi.fn()
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({ applications: [] }),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({ count: 42 }),
        });
      global.fetch = mockFetch as unknown as typeof fetch;

      const { createAuthenticatedClient } = await import('../../../src/core/smartsuite-client.js');
      const client = await createAuthenticatedClient({
        apiKey: 'test-key',
        workspaceId: 'test-workspace',
      });

      // Act
      const count = await client.countRecords('app-123', {
        filter: { status: 'active' },
      });

      // Assert
      expect(count).toBe(42);
    });
  });

  // PHASE 2J: Field Management Extensions
  describe('Field Management Operations (PHASE 2J)', () => {
    it('should add field with addField() method', async () => {
      // CONTRACT: addField() creates new field in SmartSuite table
      // EXPECT: Returns field configuration with ID

      // Arrange
      const mockFetch = vi.fn()
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({ applications: [] }),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 201,
          json: async () => ({
            id: 'field_123',
            field_type: 'textfield',
            label: 'Test Field',
            slug: 'test_field',
          }),
        });
      global.fetch = mockFetch as unknown as typeof fetch;

      const { createAuthenticatedClient } = await import('../../../src/core/smartsuite-client.js');
      const client = await createAuthenticatedClient({
        apiKey: 'test-key',
        workspaceId: 'test-workspace',
      });

      // Act
      const result = await client.addField('app-123', {
        field_type: 'textfield',
        label: 'Test Field',
        slug: 'test_field',
      });

      // Assert - Field created
      expect(result).toHaveProperty('id', 'field_123');
      expect(result).toHaveProperty('field_type', 'textfield');
      expect(result).toHaveProperty('label', 'Test Field');
      expect(result).toHaveProperty('slug', 'test_field');

      // Assert - Correct API endpoint called
      const fieldCreateCall = mockFetch.mock.calls[1];
      if (!fieldCreateCall?.[0]) {
        throw new Error('Test setup failed: addField call not found');
      }
      expect(fieldCreateCall[0]).toContain('/api/v1/applications/app-123/add_field/');
      expect(fieldCreateCall[1]?.method).toBe('POST');
    });

    it('should update field with updateField() method', async () => {
      // CONTRACT: updateField() modifies existing field configuration
      // EXPECT: Returns updated field configuration

      // Arrange
      const mockFetch = vi.fn()
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({ applications: [] }),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({
            id: 'field_123',
            field_type: 'textfield',
            label: 'Updated Field',
            slug: 'test_field',
          }),
        });
      global.fetch = mockFetch as unknown as typeof fetch;

      const { createAuthenticatedClient } = await import('../../../src/core/smartsuite-client.js');
      const client = await createAuthenticatedClient({
        apiKey: 'test-key',
        workspaceId: 'test-workspace',
      });

      // Act
      const result = await client.updateField('app-123', 'field_123', {
        label: 'Updated Field',
      });

      // Assert - Field updated
      expect(result).toHaveProperty('id', 'field_123');
      expect(result).toHaveProperty('label', 'Updated Field');

      // Assert - Correct API endpoint called
      const fieldUpdateCall = mockFetch.mock.calls[1];
      if (!fieldUpdateCall?.[0]) {
        throw new Error('Test setup failed: updateField call not found');
      }
      expect(fieldUpdateCall[0]).toContain('/api/v1/applications/app-123/change_field/');
      expect(fieldUpdateCall[0]).not.toContain('field_123'); // Field ID should NOT be in URL
      expect(fieldUpdateCall[1]?.method).toBe('PUT');

      // Assert - slug parameter included in request body
      const requestBody = JSON.parse(fieldUpdateCall[1]?.body as string);
      expect(requestBody).toHaveProperty('slug', 'field_123');
    });

    it('should include authentication headers in field operations', async () => {
      // CONTRACT: Field operations require same auth as record operations
      // EXPECT: Token and ACCOUNT-ID headers present

      // Arrange
      const mockFetch = vi.fn()
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({ applications: [] }),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 201,
          json: async () => ({ id: 'field_123' }),
        });
      global.fetch = mockFetch as unknown as typeof fetch;

      const { createAuthenticatedClient } = await import('../../../src/core/smartsuite-client.js');
      const client = await createAuthenticatedClient({
        apiKey: 'my-key',
        workspaceId: 'my-workspace',
      });

      // Act
      await client.addField('app-123', {
        field_type: 'textfield',
        label: 'Test',
        slug: 'test',
      });

      // Assert - Check authentication headers
      const fieldCreateCall = mockFetch.mock.calls[1];
      if (!fieldCreateCall?.[1]?.headers) {
        throw new Error('Test setup failed: request headers not found');
      }
      const headers = fieldCreateCall[1].headers as Record<string, string>;
      expect(headers.Authorization).toBe('Token my-key');
      expect(headers['ACCOUNT-ID']).toBe('my-workspace');
    });

    it('should handle 400 errors for invalid field configuration', async () => {
      // CONTRACT: API validation errors propagate with context
      // EXPECT: Clear error message about validation failure

      // Arrange
      const mockFetch = vi.fn()
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({ applications: [] }),
        })
        .mockResolvedValueOnce({
          ok: false,
          status: 400,
          statusText: 'Bad Request',
          json: async () => ({ error: 'Field slug already exists' }),
        });
      global.fetch = mockFetch as unknown as typeof fetch;

      const { createAuthenticatedClient } = await import('../../../src/core/smartsuite-client.js');
      const client = await createAuthenticatedClient({
        apiKey: 'test-key',
        workspaceId: 'test-workspace',
      });

      // Act & Assert
      await expect(
        client.addField('app-123', {
          field_type: 'textfield',
          label: 'Test',
          slug: 'existing_slug',
        }),
      ).rejects.toThrow(/400|bad request/i);
    });

    it('should handle 401 errors for field operations', async () => {
      // CONTRACT: Authentication errors for field operations
      // EXPECT: Same auth error handling as record operations

      // Arrange
      const mockFetch = vi.fn()
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({ applications: [] }),
        })
        .mockResolvedValueOnce({
          ok: false,
          status: 401,
          statusText: 'Unauthorized',
          json: async () => ({ error: 'Invalid API key' }),
        });
      global.fetch = mockFetch as unknown as typeof fetch;

      const { createAuthenticatedClient } = await import('../../../src/core/smartsuite-client.js');
      const client = await createAuthenticatedClient({
        apiKey: 'test-key',
        workspaceId: 'test-workspace',
      });

      // Act & Assert
      await expect(
        client.addField('app-123', {
          field_type: 'textfield',
          label: 'Test',
          slug: 'test',
        }),
      ).rejects.toThrow(/401|unauthorized/i);
    });

    it('should handle 404 errors when table not found', async () => {
      // CONTRACT: Clear error when table does not exist
      // EXPECT: Table not found error

      // Arrange
      const mockFetch = vi.fn()
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({ applications: [] }),
        })
        .mockResolvedValueOnce({
          ok: false,
          status: 404,
          statusText: 'Not Found',
          json: async () => ({ error: 'Table not found' }),
        });
      global.fetch = mockFetch as unknown as typeof fetch;

      const { createAuthenticatedClient } = await import('../../../src/core/smartsuite-client.js');
      const client = await createAuthenticatedClient({
        apiKey: 'test-key',
        workspaceId: 'test-workspace',
      });

      // Act & Assert
      await expect(
        client.addField('nonexistent-table', {
          field_type: 'textfield',
          label: 'Test',
          slug: 'test',
        }),
      ).rejects.toThrow(/404|not found/i);
    });

    it('should handle 500 server errors for field operations', async () => {
      // CONTRACT: Server errors propagate with context
      // EXPECT: Server error message

      // Arrange
      const mockFetch = vi.fn()
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({ applications: [] }),
        })
        .mockResolvedValueOnce({
          ok: false,
          status: 500,
          statusText: 'Internal Server Error',
          json: async () => ({ error: 'Database error' }),
        });
      global.fetch = mockFetch as unknown as typeof fetch;

      const { createAuthenticatedClient } = await import('../../../src/core/smartsuite-client.js');
      const client = await createAuthenticatedClient({
        apiKey: 'test-key',
        workspaceId: 'test-workspace',
      });

      // Act & Assert
      await expect(
        client.addField('app-123', {
          field_type: 'textfield',
          label: 'Test',
          slug: 'test',
        }),
      ).rejects.toThrow(/500|internal.*server.*error/i);
    });
  });
});
