// Context7: consulted for node fetch
// Context7: consulted for URL (built-in)
// SECURITY-SPECIALIST-APPROVED: SECURITY-SPECIALIST-20250905-ad1233d9
// GREEN phase implementation to make authentication tests pass

import { FilterValidator } from './lib/filter-validator.js';

export interface SmartSuiteClientConfig {
  apiKey: string;
  workspaceId: string;
  baseUrl?: string;
}

// SECURITY-SPECIALIST-APPROVED: SECURITY-SPECIALIST-20250905-arch-175

export interface SmartSuiteRecord {
  id: string;
  [fieldId: string]: unknown;
}

export interface SmartSuiteListOptions {
  limit?: number;
  offset?: number;
  sort?: Array<{
    field: string;
    direction: 'asc' | 'desc';
  }>;
  filter?: Record<string, unknown>;
}

export interface SmartSuiteApiError {
  error?: string;
  message?: string;
  details?: unknown;
}

export interface SmartSuiteSchema {
  id: string;
  name: string;
  structure: Array<{
    id: string;
    slug: string;
    label: string;
    field_type: string;
    params?: Record<string, unknown>;
  }>;
}

export interface SmartSuiteListResponse {
  items: SmartSuiteRecord[];
  total: number;
  offset: number;
  limit: number;
}

export interface SmartSuiteRequestOptions {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  endpoint: string;
  data?: Record<string, unknown>;
}

export type SmartSuiteRequestResponse =
  | { success: true; status: string; rawResponse?: string }
  | Record<string, unknown>
  | unknown[];

export interface SmartSuiteClient {
  apiKey: string;
  workspaceId: string;
  listRecords: (appId: string, options?: SmartSuiteListOptions) => Promise<SmartSuiteListResponse>;
  countRecords: (appId: string, options?: SmartSuiteListOptions) => Promise<number>;
  getRecord: (appId: string, recordId: string) => Promise<SmartSuiteRecord>;
  createRecord: (appId: string, data: Record<string, unknown>) => Promise<SmartSuiteRecord>;
  updateRecord: (
    appId: string,
    recordId: string,
    data: Record<string, unknown>,
  ) => Promise<SmartSuiteRecord>;
  deleteRecord: (appId: string, recordId: string) => Promise<void>;
  getSchema: (appId: string) => Promise<SmartSuiteSchema>;
  request: (options: SmartSuiteRequestOptions) => Promise<SmartSuiteRequestResponse>;
}

export async function createAuthenticatedClient(
  config: SmartSuiteClientConfig,
): Promise<SmartSuiteClient> {
  const apiKey = config.apiKey;
  const workspaceId = config.workspaceId;
  const baseUrl = config.baseUrl ?? 'https://app.smartsuite.com';

  // Validate API key by making a test request
  // SmartSuite uses "Token" format and "ACCOUNT-ID" header, not Bearer
  try {
    const validationUrl = baseUrl + '/api/v1/applications';
    const response = await fetch(validationUrl, {
      method: 'GET',
      headers: {
        Authorization: 'Token ' + apiKey,
        'ACCOUNT-ID': workspaceId,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      let errorData: Record<string, unknown> = { error: response.statusText };
      try {
        errorData = (await response.json()) as Record<string, unknown>;
      } catch {
        // Use default error if JSON parsing fails
      }

      if (response.status === 401) {
        const message = `Authentication failed: ${String(errorData.error || 'Invalid API key')}`;
        throw new Error(message);
      } else if (response.status === 403) {
        const message = `Authorization failed: ${String(errorData.error || 'No access to workspace')}`;
        throw new Error(message);
      } else if (response.status === 503) {
        const message = `SmartSuite API unavailable: ${String(errorData.error || 'Service temporarily unavailable')}. Try again later.`;
        throw new Error(message);
      } else {
        const message = `API error ${response.status}: ${String(errorData.error || response.statusText)}`;
        throw new Error(message);
      }
    }
  } catch (error: unknown) {
    // Handle network errors
    const errorMessage = error instanceof Error ? error.message : String(error);
    if (
      errorMessage &&
      (errorMessage.includes('ETIMEDOUT') || errorMessage.includes('Network request failed'))
    ) {
      const message =
        'Network error: ' + errorMessage + '. Please check your connection and try again.';
      throw new Error(message);
    }
    // Re-throw other errors (including our custom auth errors)
    throw error;
  }

  // Create and return the client with all required methods
  const client: SmartSuiteClient = {
    apiKey: apiKey,
    workspaceId: workspaceId,

    async listRecords(appId: string, options?: SmartSuiteListOptions): Promise<SmartSuiteListResponse> {
      // Apply defaults and constraints for MCP token optimization
      const limit = Math.min(options?.limit ?? 25, 1000); // REDUCED DEFAULT from 200 to 25
      const offset = options?.offset ?? 0;

      // Build URL with query parameters (SmartSuite requirement)
      const url = new URL(baseUrl + '/api/v1/applications/' + appId + '/records/list/');
      url.searchParams.set('limit', limit.toString());
      url.searchParams.set('offset', offset.toString());

      // Build request body with filters/sort and optimization settings
      const requestBody: Record<string, unknown> = {
        hydrated: false, // Reduce payload size for token optimization
        // CONTEXT OPTIMIZATION: Request minimal fields when possible
        fields_to_include: options?.filter ? undefined : ['id', 'title', 'status'], // Basic fields only when no filter
      };

      if (options?.filter) {
        // Transform simple filters to SmartSuite's nested structure
        const transformedFilter = FilterValidator.transformFilter(options.filter);

        // Validate transformed filter structure before sending
        const filterError = FilterValidator.validate(transformedFilter);
        if (filterError) {
          throw new Error(`Invalid filter structure: ${filterError}\nOriginal Filter: ${FilterValidator.format(options.filter)}\nTransformed Filter: ${FilterValidator.format(transformedFilter)}`);
        }
        requestBody.filter = transformedFilter;
      }
      if (options?.sort) {
        requestBody.sort = options.sort;
      }

      const response = await fetch(url.toString(), {
        method: 'POST',
        headers: {
          Authorization: 'Token ' + apiKey,
          'ACCOUNT-ID': workspaceId,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        let errorMessage = 'Failed to list records: ' + response.statusText;
        try {
          const errorData = await response.json() as SmartSuiteApiError;
          if (errorData.error) {
            errorMessage += ' - ' + errorData.error;
          } else if (errorData.message) {
            errorMessage += ' - ' + errorData.message;
          }
          if (errorData.details) {
            errorMessage += ' (Details: ' + JSON.stringify(errorData.details) + ')';
          }
        } catch {
          // If we can't parse the error response, stick with statusText
        }
        throw new Error(errorMessage);
      }

      return await response.json() as SmartSuiteListResponse;
    },

    async countRecords(appId: string, options?: SmartSuiteListOptions): Promise<number> {
      // Build URL with query parameters for minimal request
      const url = new URL(baseUrl + '/api/v1/applications/' + appId + '/records/list/');
      url.searchParams.set('limit', '1'); // Minimal limit for count
      url.searchParams.set('offset', '0');

      // Build request body with only filters (no sort needed for count)
      const requestBody: Record<string, unknown> = {
        hydrated: false, // Reduce payload size
      };

      if (options?.filter) {
        // Transform simple filters to SmartSuite's nested structure
        const transformedFilter = FilterValidator.transformFilter(options.filter);

        // Validate transformed filter structure before sending
        const filterError = FilterValidator.validate(transformedFilter);
        if (filterError) {
          throw new Error(`Invalid filter structure: ${filterError}\nOriginal Filter: ${FilterValidator.format(options.filter)}\nTransformed Filter: ${FilterValidator.format(transformedFilter)}`);
        }
        requestBody.filter = transformedFilter;
      }

      const response = await fetch(url.toString(), {
        method: 'POST',
        headers: {
          Authorization: 'Token ' + apiKey,
          'ACCOUNT-ID': workspaceId,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        let errorMessage = 'Failed to count records: ' + response.statusText;
        try {
          const errorData = await response.json() as SmartSuiteApiError;
          if (errorData.error) {
            errorMessage += ' - ' + errorData.error;
          } else if (errorData.message) {
            errorMessage += ' - ' + errorData.message;
          }
          if (errorData.details) {
            errorMessage += ' (Details: ' + JSON.stringify(errorData.details) + ')';
          }
        } catch {
          // If we can't parse the error response, stick with statusText
        }
        throw new Error(errorMessage);
      }

      const data = await response.json() as SmartSuiteListResponse;
      return data.total;
    },

    async getRecord(appId: string, recordId: string): Promise<SmartSuiteRecord> {
      const url = baseUrl + '/api/v1/applications/' + appId + '/records/' + recordId + '/';
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          Authorization: 'Token ' + apiKey,
          'ACCOUNT-ID': workspaceId,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        let errorMessage = 'Failed to get record: ' + response.statusText;
        try {
          const errorData = await response.json() as SmartSuiteApiError;
          if (errorData.error) {
            errorMessage += ' - ' + errorData.error;
          } else if (errorData.message) {
            errorMessage += ' - ' + errorData.message;
          }
          if (errorData.details) {
            errorMessage += ' (Details: ' + JSON.stringify(errorData.details) + ')';
          }
        } catch {
          // If we can't parse the error response, stick with statusText
        }
        throw new Error(errorMessage);
      }

      return response.json() as Promise<SmartSuiteRecord>;
    },

    async createRecord(appId: string, data: Record<string, unknown>): Promise<SmartSuiteRecord> {
      const url = baseUrl + '/api/v1/applications/' + appId + '/records/';
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: 'Token ' + apiKey,
          'ACCOUNT-ID': workspaceId,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        let errorMessage = 'Failed to create record: ' + response.statusText;
        try {
          const errorData = await response.json() as SmartSuiteApiError;
          if (errorData.error) {
            errorMessage += ' - ' + errorData.error;
          } else if (errorData.message) {
            errorMessage += ' - ' + errorData.message;
          }
          if (errorData.details) {
            errorMessage += ' (Details: ' + JSON.stringify(errorData.details) + ')';
          }
        } catch {
          // If we can't parse the error response, stick with statusText
        }
        throw new Error(errorMessage);
      }

      return response.json() as Promise<SmartSuiteRecord>;
    },

    async updateRecord(appId: string, recordId: string, data: Record<string, unknown>): Promise<SmartSuiteRecord> {
      const url = baseUrl + '/api/v1/applications/' + appId + '/records/' + recordId + '/';
      const response = await fetch(url, {
        method: 'PATCH',
        headers: {
          Authorization: 'Token ' + apiKey,
          'ACCOUNT-ID': workspaceId,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        let errorMessage = 'Failed to update record: ' + response.statusText;
        try {
          const errorData = await response.json() as SmartSuiteApiError;
          if (errorData.error) {
            errorMessage += ' - ' + errorData.error;
          } else if (errorData.message) {
            errorMessage += ' - ' + errorData.message;
          }
          if (errorData.details) {
            errorMessage += ' (Details: ' + JSON.stringify(errorData.details) + ')';
          }
        } catch {
          // If we can't parse the error response, stick with statusText
        }
        throw new Error(errorMessage);
      }

      return response.json() as Promise<SmartSuiteRecord>;
    },

    async deleteRecord(appId: string, recordId: string): Promise<void> {
      const url = baseUrl + '/api/v1/applications/' + appId + '/records/' + recordId + '/';
      const response = await fetch(url, {
        method: 'DELETE',
        headers: {
          Authorization: 'Token ' + apiKey,
          'ACCOUNT-ID': workspaceId,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        let errorMessage = 'Failed to delete record: ' + response.statusText;
        try {
          const errorData = await response.json() as SmartSuiteApiError;
          if (errorData.error) {
            errorMessage += ' - ' + errorData.error;
          } else if (errorData.message) {
            errorMessage += ' - ' + errorData.message;
          }
          if (errorData.details) {
            errorMessage += ' (Details: ' + JSON.stringify(errorData.details) + ')';
          }
        } catch {
          // If we can't parse the error response, stick with statusText
        }
        throw new Error(errorMessage);
      }
    },

    async getSchema(appId: string): Promise<SmartSuiteSchema> {
      const url = baseUrl + '/api/v1/applications/' + appId + '/';
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          Authorization: 'Token ' + apiKey,
          'ACCOUNT-ID': workspaceId,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        let errorMessage = 'Failed to get schema: ' + response.statusText;
        try {
          const errorData = await response.json() as SmartSuiteApiError;
          if (errorData.error) {
            errorMessage += ' - ' + errorData.error;
          } else if (errorData.message) {
            errorMessage += ' - ' + errorData.message;
          }
          if (errorData.details) {
            errorMessage += ' (Details: ' + JSON.stringify(errorData.details) + ')';
          }
        } catch {
          // If we can't parse the error response, stick with statusText
        }
        throw new Error(errorMessage);
      }

      return response.json() as Promise<SmartSuiteSchema>;
    },

    async request(options: SmartSuiteRequestOptions): Promise<SmartSuiteRequestResponse> {
      const url = baseUrl + '/api/v1' + options.endpoint;
      const fetchOptions: RequestInit = {
        method: options.method,
        headers: {
          Authorization: 'Token ' + apiKey,
          'ACCOUNT-ID': workspaceId,
          'Content-Type': 'application/json',
        },
      };
      if (options.data) {
        fetchOptions.body = JSON.stringify(options.data);
      }
      const response = await fetch(url, fetchOptions);

      if (!response.ok) {
        let errorMessage = `API error ${response.status}: ${response.statusText}`;
        try {
          const errorData = (await response.json()) as SmartSuiteApiError;
          if (errorData.error) {
            errorMessage = `API error ${response.status}: ${errorData.error}`;
          } else if (errorData.message) {
            errorMessage = `API error ${response.status}: ${errorData.message}`;
          }
        } catch {
          // Use default error message
        }
        throw new Error(errorMessage);
      }

      // Handle 204 No Content - Critical-Engineer: consulted for API client reliability and error handling
      if (response.status === 204) {
        return { success: true, status: 'executed' };
      }

      // Robust response parsing with comprehensive diagnostics
      const contentLength = response.headers.get('content-length');
      const contentType = response.headers.get('content-type') ?? 'unknown';
      // Handle explicit empty responses
      if (contentLength === '0') {
        return { success: true, status: 'executed' };
      }

      // Parse response text first to handle all edge cases
      const responseText = await response.text();
      if (!responseText || responseText.trim().length === 0) {
        return { success: true, status: 'executed' };
      }

      // Only attempt JSON parsing for JSON content types
      if (!contentType.includes('application/json')) {
        console.warn('[SmartSuite Client] Non-JSON response received:', {
          status: response.status,
          contentType,
          url: options.endpoint,
          method: options.method,
          bodyPreview: responseText.substring(0, 200),
        });
        // Return success for non-JSON responses if status was OK
        return { success: true, status: 'executed', rawResponse: responseText };
      }

      try {
        return JSON.parse(responseText) as SmartSuiteRequestResponse;
      } catch (parseError) {
        // Critical diagnostic information for debugging JSON parse failures
        console.error('[SmartSuite Client] JSON Parse Error:', {
          status: response.status,
          statusText: response.statusText,
          contentType,
          contentLength,
          url: options.endpoint,
          method: options.method,
          bodyPreview: responseText.substring(0, 500),
          error: parseError instanceof Error ? parseError.message : String(parseError),
        });
        throw new Error(
          `Failed to parse API response as JSON. Status: ${response.status}, ` +
          `Content-Type: ${contentType}, Endpoint: ${options.endpoint}. ` +
          `Response preview: ${responseText.substring(0, 100)}`,
        );
      }
    },
  };

  return client;
}
