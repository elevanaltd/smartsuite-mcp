// Phoenix Rebuild: SmartSuite Client Implementation (GREEN Phase)
// Contract: AUTH-001, AUTH-002 - Client authentication and API calls
// TDD Phase: RED → GREEN (minimal code to pass tests)
// TEST-FIRST-BYPASS: Test exists at test/unit/core/smartsuite-client.test.ts (27 failing tests)
// Hook needs update to check test/ directory

/**
 * SmartSuite authentication configuration
 */
export interface SmartSuiteAuthConfig {
  apiKey: string;
  workspaceId: string;
  baseUrl?: string;
}

/**
 * List options for query operations
 */
export interface SmartSuiteListOptions {
  limit?: number;
  offset?: number;
  filter?: Record<string, unknown>;
  sort?: Array<{ field: string; direction: 'asc' | 'desc' }>;
}

/**
 * List response structure
 */
export interface SmartSuiteListResponse {
  items: unknown[];
  total: number;
  offset?: number;
  limit?: number;
}

/**
 * Generic request options
 */
export interface SmartSuiteRequestOptions {
  method: string;
  endpoint: string;
  data?: unknown;
}

/**
 * SmartSuite client interface
 * Provides authenticated access to SmartSuite API
 */
export interface SmartSuiteClient {
  apiKey: string;
  workspaceId: string;
  apiUrl?: string;
  listRecords(appId: string, options?: SmartSuiteListOptions): Promise<SmartSuiteListResponse>;
  getRecord(appId: string, recordId: string): Promise<unknown>;
  createRecord(appId: string, data: Record<string, unknown>): Promise<unknown>;
  updateRecord(appId: string, recordId: string, data: Record<string, unknown>): Promise<unknown>;
  deleteRecord(appId: string, recordId: string): Promise<void>;
  getSchema(appId: string): Promise<unknown>;
  countRecords(appId: string, options?: SmartSuiteListOptions): Promise<number>;
  request(options: SmartSuiteRequestOptions): Promise<unknown>;
  addField(appId: string, fieldConfig: Record<string, unknown>): Promise<unknown>;
  updateField(appId: string, fieldId: string, updates: Record<string, unknown>): Promise<unknown>;
}

/**
 * Default base URL for SmartSuite API
 */
const DEFAULT_BASE_URL = 'https://app.smartsuite.com/api/v1';

/**
 * Default limit for list operations (MCP token safety)
 */
const DEFAULT_LIMIT = 25;

/**
 * Create authenticated SmartSuite client
 * Validates credentials by making a test API call
 */
export async function createAuthenticatedClient(
  config: SmartSuiteAuthConfig,
): Promise<SmartSuiteClient> {
  const { apiKey, workspaceId, baseUrl = DEFAULT_BASE_URL } = config;

  // Ensure baseUrl ends with /api/v1 for backward compatibility
  const normalizedBaseUrl = baseUrl.endsWith('/api/v1') ? baseUrl : `${baseUrl}/api/v1`;

  // Validate credentials with GET /applications
  try {
    const response = await fetch(`${normalizedBaseUrl}/applications`, {
      method: 'GET',
      headers: {
        Authorization: `Token ${apiKey}`,
        'ACCOUNT-ID': workspaceId,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      await handleAuthError(response);
    }

    // Validation successful, create client
    return createClient(apiKey, workspaceId, baseUrl);
  } catch (error) {
    // Handle network errors
    if (error instanceof Error && !('status' in error)) {
      throw new Error(
        `Network error: ${error.message}. Please check your connection and try again.`,
      );
    }
    throw error;
  }
}

/**
 * Handle authentication errors with specific messages
 */
async function handleAuthError(response: Response): Promise<never> {
  const status = response.status;
  let errorMessage = '';

  try {
    const errorData = await response.json() as { error?: string };
    errorMessage = errorData.error ?? response.statusText;
  } catch {
    // If JSON parsing fails, use statusText
    errorMessage = response.statusText;
  }

  if (status === 401) {
    throw new Error(`Authentication failed: Invalid API key - ${errorMessage}`);
  } else if (status === 403) {
    throw new Error(`Authorization failed: No access to workspace - ${errorMessage}`);
  } else if (status === 503) {
    throw new Error(`SmartSuite API unavailable. Try again later - ${errorMessage}`);
  } else {
    throw new Error(`API error ${status}: ${errorMessage}`);
  }
}

/**
 * Create SmartSuite client instance without authentication validation
 * Used by MCP server for synchronous initialization
 */
export function createClient(apiKey: string, workspaceId: string, baseUrl: string): SmartSuiteClient {
  // Ensure baseUrl ends with /api/v1 for backward compatibility
  const normalizedBaseUrl = baseUrl.endsWith('/api/v1') ? baseUrl : `${baseUrl}/api/v1`;

  // Create base request function
  const makeRequest = async (
    endpoint: string,
    method: string,
    data?: unknown,
  ): Promise<unknown> => {
    try {
      const url = endpoint.startsWith('http') ? endpoint : `${normalizedBaseUrl}${endpoint}`;

      const options: RequestInit = {
        method,
        headers: {
          Authorization: `Token ${apiKey}`,
          'ACCOUNT-ID': workspaceId,
          'Content-Type': 'application/json',
        },
      };

      if (data !== undefined) {
        options.body = JSON.stringify(data);
      }

      const response = await fetch(url, options);

      if (!response.ok) {
        await handleApiError(response);
      }

      // Handle 204 No Content
      if (response.status === 204) {
        return {};
      }

      // Handle 200 with empty body (field creation returns this)
      const contentLength = response.headers?.get('content-length');
      const contentType = response.headers?.get('content-type');

      // If content-length is 0 or no JSON content-type, return empty object
      if (contentLength === '0' || (contentType && !contentType.includes('application/json'))) {
        return {};
      }

      // Try to parse JSON
      return await response.json();
    } catch (error) {
      // Network errors
      if (error instanceof Error && !('status' in error) && error.message.includes('timeout')) {
        throw new Error(`Request timeout: ${error.message}`);
      }
      throw error;
    }
  };

  /**
   * Handle API call errors
   */
  const handleApiError = async (response: Response): Promise<never> => {
    const status = response.status;
    let errorMessage = '';

    try {
      const errorData = await response.json() as { error?: string; message?: string; detail?: string };
      errorMessage = errorData.error ?? errorData.message ?? errorData.detail ?? response.statusText;
    } catch {
      errorMessage = response.statusText;
    }

    if (status === 404) {
      throw new Error(`Resource not found (404): ${errorMessage}`);
    } else if (status === 429) {
      throw new Error(`Rate limit exceeded (429): ${errorMessage}. Please retry after a delay.`);
    } else {
      throw new Error(`API error ${status}: ${errorMessage}`);
    }
  };

  // Return client interface
  return {
    apiKey,
    workspaceId,
    apiUrl: normalizedBaseUrl,

    async listRecords(appId: string, options?: SmartSuiteListOptions): Promise<SmartSuiteListResponse> {
      const requestData = {
        limit: options?.limit ?? DEFAULT_LIMIT,
        offset: options?.offset ?? 0,
        ...(options?.filter && { filter: options.filter }),
        ...(options?.sort && { sort: options.sort }),
      };

      const result = await makeRequest(
        `/applications/${appId}/records/list/`,
        'POST',
        requestData,
      );

      return result as SmartSuiteListResponse;
    },

    async getRecord(appId: string, recordId: string): Promise<unknown> {
      return makeRequest(`/applications/${appId}/records/${recordId}/`, 'GET');
    },

    async createRecord(appId: string, data: Record<string, unknown>): Promise<unknown> {
      return makeRequest(`/applications/${appId}/records/`, 'POST', data);
    },

    async updateRecord(
      appId: string,
      recordId: string,
      data: Record<string, unknown>,
    ): Promise<unknown> {
      return makeRequest(`/applications/${appId}/records/${recordId}/`, 'PATCH', data);
    },

    async deleteRecord(appId: string, recordId: string): Promise<void> {
      await makeRequest(`/applications/${appId}/records/${recordId}/`, 'DELETE');
    },

    async getSchema(appId: string): Promise<unknown> {
      return makeRequest(`/applications/${appId}/`, 'GET');
    },

    async countRecords(appId: string, options?: SmartSuiteListOptions): Promise<number> {
      const requestData = {
        ...(options?.filter && { filter: options.filter }),
      };

      const result = await makeRequest(
        `/applications/${appId}/records/count/`,
        'POST',
        requestData,
      );

      return (result as { count: number }).count;
    },

    async request(options: SmartSuiteRequestOptions): Promise<unknown> {
      return makeRequest(options.endpoint, options.method, options.data);
    },

    async addField(appId: string, fieldConfig: Record<string, unknown>): Promise<unknown> {
      // Wrap field config in required API structure
      const apiPayload = {
        field: {
          ...fieldConfig,
          params: fieldConfig.params ?? {},  // params is required, even if empty
          is_new: true,  // Required for new fields per FIELD-OPERATIONS-TRUTH.md
        },
        field_position: {
          prev_sibling_slug: fieldConfig.prev_sibling_slug ?? '',  // Empty string for first position
        },
        auto_fill_structure_layout: true,
      };

      // Remove prev_sibling_slug from field object if it was included
      if ('prev_sibling_slug' in apiPayload.field) {
        delete apiPayload.field.prev_sibling_slug;
      }

      return makeRequest(`/applications/${appId}/add_field/`, 'POST', apiPayload);
    },

    async updateField(appId: string, fieldId: string, updates: Record<string, unknown>): Promise<unknown> {
      return makeRequest(`/applications/${appId}/change_field/`, 'PUT', { slug: fieldId, ...updates });
    },
  };
}
