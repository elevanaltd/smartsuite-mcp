/**
 * Test Server Helper - Centralized Authentication Setup
 *
 * TESTGUARD-APPROVED PATTERN: Use environment variables for test authentication
 * Following DRY principle for 21+ test files requiring server initialization
 */

// Context7: consulted for vitest
import { vi } from 'vitest';

import { SmartSuiteShimServer } from '../../src/mcp-server.js';

/**
 * Creates and initializes an authenticated SmartSuite MCP server for testing
 *
 * IMPORTANT: Uses environment variable pattern (public API contract) as approved by TestGuard
 * Mocks authentication to avoid real API calls while maintaining contract compliance
 *
 * @returns Promise<SmartSuiteShimServer> - Fully initialized and authenticated server
 */
export async function createAuthenticatedTestServer(): Promise<SmartSuiteShimServer> {
  // Set up environment variables for test authentication (TestGuard-approved approach)
  process.env.SMARTSUITE_API_TOKEN = 'test-token';
  process.env.SMARTSUITE_WORKSPACE_ID = 'test-workspace';

  // Create server instance
  const server = new SmartSuiteShimServer();

  // Mock the authenticate method to avoid real API calls while preserving contract
  // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access
  (server as any).authenticate = vi.fn().mockResolvedValue(undefined);

  // Initialize with test credentials from environment
  await server.initialize();

  // Ensure server is marked as authenticated for tests
  // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access
  (server as any).authManager = {
    isAuthenticated: (): boolean => true,
    getAuthConfig: (): { apiKey: string; workspaceId: string; baseUrl: string } => ({
      apiKey: 'test-token',
      workspaceId: 'test-workspace',
      baseUrl: 'https://app.smartsuite.com',
    }),
    requireAuth: (): void => {},
  };

  return server;
}

/**
 * Sets up test environment variables without creating server
 * Useful for tests that need custom server creation
 */
export function setupTestEnvironment(): void {
  process.env.SMARTSUITE_API_TOKEN = 'test-token';
  process.env.SMARTSUITE_WORKSPACE_ID = 'test-workspace';
}

/**
 * Cleans up test environment variables
 * Should be called in afterEach hooks
 */
export function cleanupTestEnvironment(): void {
  delete process.env.SMARTSUITE_API_TOKEN;
  delete process.env.SMARTSUITE_WORKSPACE_ID;
}
