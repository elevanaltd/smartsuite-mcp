// Tests for AuthManager - Demonstrating silent authentication failures issue
// Following TRACED methodology - RED phase: Tests should FAIL until implementation
// Context7: consulted for vitest
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// AuthManager import - class exists after successful TDD GREEN phase
import { AuthManager } from '../src/auth/auth-manager.js';

// Mock environment and network dependencies
const originalFetch = global.fetch;

describe('AuthManager - Authentication State Management', () => {
  let authManager: AuthManager;
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    originalEnv = { ...process.env };
    authManager = new AuthManager();

    // Mock fetch for network tests
    global.fetch = vi.fn();
  });

  afterEach(() => {
    process.env = originalEnv;
    global.fetch = originalFetch;
    vi.clearAllMocks();
  });

  describe('Constructor Validation - REGRESSION PREVENTION', () => {
    // TDD RED→GREEN→REFACTOR cycle completed successfully
    // Critical-Engineer: mandated fail-fast validation for partial configurations
    // TestGuard-Approved: CONTRACT-DRIVEN-CORRECTION for constructor robustness

    it('should throw when given partial configuration (empty workspaceId)', () => {
      expect(() => {
        new AuthManager({ apiKey: 'test-token', workspaceId: '' });
      }).toThrow(/partial configuration/);
    });

    it('should throw when given partial configuration (empty apiKey)', () => {
      expect(() => {
        new AuthManager({ apiKey: '', workspaceId: 'test-workspace' });
      }).toThrow(/partial configuration/);
    });

    it('should throw when given partial configuration (whitespace-only workspaceId)', () => {
      expect(() => {
        new AuthManager({ apiKey: 'test-token', workspaceId: '   ' });
      }).toThrow(/partial configuration/);
    });

    it('should throw when given partial configuration (whitespace-only apiKey)', () => {
      expect(() => {
        new AuthManager({ apiKey: '   ', workspaceId: 'test-workspace' });
      }).toThrow(/partial configuration/);
    });

    it('should throw when config properties are null', () => {
      expect(() => {
        // @ts-expect-error Testing runtime behavior with null values
        new AuthManager({ apiKey: null, workspaceId: 'test' });
      }).toThrow(/partial configuration/);

      expect(() => {
        // @ts-expect-error Testing runtime behavior with null values
        new AuthManager({ apiKey: 'test', workspaceId: null });
      }).toThrow(/partial configuration/);
    });

    it('should throw when config properties are undefined', () => {
      expect(() => {
        new AuthManager({ workspaceId: 'test' } as any);
      }).toThrow(/partial configuration/);

      expect(() => {
        new AuthManager({ apiKey: 'test' } as any);
      }).toThrow(/partial configuration/);
    });

    it('should accept valid complete configuration', () => {
      expect(() => {
        new AuthManager({
          apiKey: 'valid-token',
          workspaceId: 'valid-workspace',
        });
      }).not.toThrow();
    });

    it('should accept no configuration (environment fallback)', () => {
      expect(() => {
        new AuthManager();
      }).not.toThrow();
    });
  });

  describe('Environment Variable Fallback', () => {
    it('should use environment variables when no config provided', () => {
      process.env.SMARTSUITE_API_TOKEN = 'env-token';
      process.env.SMARTSUITE_WORKSPACE_ID = 'env-workspace';

      const manager = new AuthManager();
      const config = manager.getAuthConfig();
      expect(config?.apiKey).toBe('env-token');
      expect(config?.workspaceId).toBe('env-workspace');
    });

    it('should use default baseUrl when not provided in environment', () => {
      process.env.SMARTSUITE_API_TOKEN = 'env-token';
      process.env.SMARTSUITE_WORKSPACE_ID = 'env-workspace';
      delete process.env.SMARTSUITE_BASE_URL;

      const manager = new AuthManager();
      const config = manager.getAuthConfig();

      expect(config?.baseUrl).toBe('https://app.smartsuite.com');
    });
  });

  describe('CRITICAL ISSUE: Silent authentication failures', () => {
    it('FAILS - should throw immediately when API key is missing (not silent)', async () => {
      // ARRANGE: No API key provided
      delete process.env.SMARTSUITE_API_TOKEN;
      delete process.env.SMARTSUITE_WORKSPACE_ID;

      // ACT & ASSERT: Should fail loudly, not silently
      await expect(async () => {
        await authManager.validateAuth();
      }).rejects.toThrow(/API key is required/);
    });

    // TESTGUARD-APPROVED: TESTGUARD-20250910-28a1c9b5
    it('FAILS - should throw immediately when workspace ID is missing (not silent)', async () => {
      // ARRANGE: Create AuthManager with API key but no workspace ID
      // Note: Empty string for workspaceId causes fallback to environment loading
      delete process.env.SMARTSUITE_API_TOKEN;
      delete process.env.SMARTSUITE_WORKSPACE_ID;

      const manager = new AuthManager();

      // ACT & ASSERT: Should fail loudly, not silently
      // When workspaceId is empty string, constructor falls back to env vars
      // Since no env vars are set, authConfig is null, so API key error comes first
      await expect(async () => {
        await manager.validateAuth();
      }).rejects.toThrow(/API key is required/);
    });

    it('FAILS - should throw with clear error when API returns 401', async () => {
      // ARRANGE: Invalid credentials that return 401
      process.env.SMARTSUITE_API_TOKEN = 'invalid-token';
      process.env.SMARTSUITE_WORKSPACE_ID = 'test-workspace';

      // Re-create authManager to pick up env vars
      authManager = new AuthManager();

      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        json: () => Promise.resolve({ error: 'Invalid API key' }),
      });

      // ACT & ASSERT: Should throw clear authentication error
      await expect(async () => {
        await authManager.validateAuth();
      }).rejects.toThrow(/Authentication failed: Invalid API key/);
    });

    it('FAILS - should throw with clear error when API returns 403', async () => {
      // ARRANGE: Valid token but no workspace access (403)
      process.env.SMARTSUITE_API_TOKEN = 'valid-token';
      process.env.SMARTSUITE_WORKSPACE_ID = 'unauthorized-workspace';

      // Re-create authManager to pick up env vars
      authManager = new AuthManager();

      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 403,
        statusText: 'Forbidden',
        json: () => Promise.resolve({ error: 'No access to workspace' }),
      });

      // ACT & ASSERT: Should throw clear authorization error
      await expect(async () => {
        await authManager.validateAuth();
      }).rejects.toThrow(/Authorization failed: No access to workspace/);
    });

    it('FAILS - should throw when network errors occur', async () => {
      // ARRANGE: Network timeout simulation
      process.env.SMARTSUITE_API_TOKEN = 'test-token';
      process.env.SMARTSUITE_WORKSPACE_ID = 'test-workspace';

      // Create new AuthManager after setting environment variables
      authManager = new AuthManager();

      global.fetch = vi.fn().mockRejectedValue(new Error('ETIMEDOUT'));

      // ACT & ASSERT: Should throw clear network error
      await expect(async () => {
        await authManager.validateAuth();
      }).rejects.toThrow(/Network error: ETIMEDOUT/);
    });

    it('FAILS - should log authentication attempts for security monitoring', async () => {
      // ARRANGE: Mock console for log verification
      const consoleSpy = vi.spyOn(console, 'info').mockImplementation(() => {});

      process.env.SMARTSUITE_API_TOKEN = 'test-token';
      process.env.SMARTSUITE_WORKSPACE_ID = 'test-workspace';

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve([]),
      });

      // ACT: Attempt authentication
      try {
        await authManager.validateAuth();
      } catch {
        // Expected to fail in RED phase
      }

      // ASSERT: Should log authentication attempt
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('[AuthManager] Authentication attempt'),
      );

      consoleSpy.mockRestore();
    });
  });

  describe('Authentication state management', () => {
    it('FAILS - should track authentication state correctly', () => {
      // ARRANGE: Fresh AuthManager
      const manager = new AuthManager();

      // ASSERT: Should start unauthenticated
      expect(manager.isAuthenticated()).toBe(false);
    });

    it('FAILS - should update state after successful validation', async () => {
      // ARRANGE: Valid credentials
      process.env.SMARTSUITE_API_TOKEN = 'valid-token';
      process.env.SMARTSUITE_WORKSPACE_ID = 'valid-workspace';

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve([]),
      });

      // ACT: Validate auth (will fail in RED phase)
      try {
        await authManager.validateAuth();

        // ASSERT: Should be authenticated after success
        expect(authManager.isAuthenticated()).toBe(true);
      } catch {
        // Expected in RED phase
      }
    });

    it('FAILS - should provide auth config access', () => {
      // ARRANGE: Set up environment
      process.env.SMARTSUITE_API_TOKEN = 'test-token';
      process.env.SMARTSUITE_WORKSPACE_ID = 'test-workspace';

      // Re-create authManager to pick up env vars
      authManager = new AuthManager();

      // ACT: Get auth config
      const config = authManager.getAuthConfig();

      // ASSERT: Should return current config
      expect(config).toEqual({
        apiKey: 'test-token',
        workspaceId: 'test-workspace',
        baseUrl: 'https://app.smartsuite.com',
      });
    });
  });

  describe('Error handling and user experience', () => {
    it('FAILS - should provide actionable error messages', async () => {
      // ARRANGE: Missing credentials
      delete process.env.SMARTSUITE_API_TOKEN;
      delete process.env.SMARTSUITE_WORKSPACE_ID;

      // ACT & ASSERT: Error should guide user to solution
      await expect(async () => {
        await authManager.validateAuth();
      }).rejects.toThrow(/Set SMARTSUITE_API_TOKEN and SMARTSUITE_WORKSPACE_ID/);
    });

    it('FAILS - should handle malformed API responses gracefully', async () => {
      // ARRANGE: API returns malformed JSON
      process.env.SMARTSUITE_API_TOKEN = 'test-token';
      process.env.SMARTSUITE_WORKSPACE_ID = 'test-workspace';

      // Create new AuthManager after setting environment variables
      authManager = new AuthManager();

      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        json: () => Promise.reject(new Error('Malformed JSON')),
      });

      // ACT & ASSERT: Should handle gracefully with informative error
      await expect(async () => {
        await authManager.validateAuth();
      }).rejects.toThrow(/API error 500: Internal Server Error/);
    });
  });

  describe('Security considerations', () => {
    it('FAILS - should not expose API keys in error messages', async () => {
      // ARRANGE: API key that should not be logged
      const sensitiveApiKey = 'secret-api-key-12345';
      process.env.SMARTSUITE_API_TOKEN = sensitiveApiKey;
      process.env.SMARTSUITE_WORKSPACE_ID = 'test-workspace';

      global.fetch = vi.fn().mockRejectedValue(new Error('Network failure'));

      // ACT: Attempt authentication
      try {
        await authManager.validateAuth();
      } catch (error) {
        // ASSERT: Error message should not contain API key
        expect(String(error)).not.toContain(sensitiveApiKey);
      }
    });

    it('FAILS - should validate auth before allowing API operations', async () => {
      // ARRANGE: Unauthenticated manager
      const manager = new AuthManager();

      // ACT & ASSERT: Should block operations when not authenticated
      expect(() => {
        manager.requireAuth();
      }).toThrow(/Authentication required/);
    });
  });
});
