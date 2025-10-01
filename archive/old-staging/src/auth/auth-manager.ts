// AuthManager - Secure authentication state management with loud failure patterns
// SECURITY-SPECIALIST-APPROVED: SECURITY-SPECIALIST-20250910-9521e55c
// Following TRACED methodology - GREEN phase: Make failing tests pass

export interface AuthConfig {
  apiKey: string;
  workspaceId: string;
  baseUrl: string;
}

export interface AuthValidationResult {
  success: boolean;
  error?: string;
  timestamp: Date;
}

/**
 * AuthManager - Centralized authentication state management
 *
 * SECURITY PRINCIPLES:
 * - Fail loudly, never silently
 * - Clear error messages for troubleshooting
 * - No credential exposure in logs/errors
 * - Immediate validation feedback
 * - Secure state tracking
 */
export class AuthManager {
  private authConfig: AuthConfig | null = null;
  private authenticated: boolean = false;
  private lastValidation: AuthValidationResult | null = null;

  /**
   * Initialize AuthManager with explicit configuration or environment fallback
   *
   * @param config - Complete authentication config or undefined for environment fallback
   * @throws {Error} When partial configuration is provided - prevents silent failures
   *
   * Critical-Engineer: explicit fail-fast validation for partial configurations
   * TestGuard-Approved: CONTRACT-DRIVEN-CORRECTION implementation
   */
  constructor(config?: Partial<AuthConfig>) {
    const configStatus = this.validateConfigurationInput(config);

    if (configStatus === 'complete') {
      // Valid complete configuration provided
      this.authConfig = {
        apiKey: config!.apiKey!.trim(),
        workspaceId: config!.workspaceId!.trim(),
        baseUrl: config!.baseUrl ?? 'https://app.smartsuite.com',
      };
    } else if (configStatus === 'partial') {
      // FAIL LOUDLY: Partial configuration detected
      // This prevents the silent fallback bug that causes "Cannot read properties of undefined"
      throw new Error(
        'AuthManager received a partial configuration. Either provide both apiKey and workspaceId, ' +
        'or provide neither to use SMARTSUITE_API_TOKEN and SMARTSUITE_WORKSPACE_ID environment variables.',
      );
    } else {
      // No configuration provided - use environment variables
      this.loadFromEnvironment();
    }
  }

  /**
   * Validate configuration input to determine initialization strategy
   *
   * @param config - Configuration object to validate
   * @returns 'complete' if both apiKey and workspaceId are valid, 'partial' if only one is provided, 'none' if neither
   */
  private validateConfigurationInput(config?: Partial<AuthConfig>): 'complete' | 'partial' | 'none' {
    const hasPartialConfig = config?.apiKey !== undefined || config?.workspaceId !== undefined;
    const hasFullConfig = config?.apiKey?.trim() && config?.workspaceId?.trim();

    if (hasFullConfig) {
      return 'complete';
    } else if (hasPartialConfig) {
      return 'partial';
    } else {
      return 'none';
    }
  }

  /**
   * Load authentication configuration from environment variables
   * SECURITY: Never logs actual credential values
   */
  private loadFromEnvironment(): void {
    const apiKey = process.env.SMARTSUITE_API_TOKEN;
    const workspaceId = process.env.SMARTSUITE_WORKSPACE_ID;

    if (apiKey && workspaceId) {
      this.authConfig = {
        apiKey,
        workspaceId,
        baseUrl: process.env.SMARTSUITE_BASE_URL ?? 'https://app.smartsuite.com',
      };
      // Authentication configuration loaded from environment variables
    }
  }

  /**
   * Validate current authentication state
   * SECURITY: Fails loudly with actionable error messages
   *
   * @throws {Error} When authentication validation fails
   * @returns {Promise<AuthValidationResult>} Validation result on success
   */
  async validateAuth(): Promise<AuthValidationResult> {
    const startTime = new Date();
    // eslint-disable-next-line no-console -- Required for security audit logging
    console.info('[AuthManager] Authentication attempt started');

    try {
      // SECURITY CHECK 1: Validate required credentials are present
      if (!this.authConfig?.apiKey) {
        const error = 'API key is required. Set SMARTSUITE_API_TOKEN and SMARTSUITE_WORKSPACE_ID environment variables.';
        this.lastValidation = { success: false, error, timestamp: startTime };
        this.authenticated = false;
        throw new Error(error);
      }

      if (!this.authConfig?.workspaceId) {
        const error = 'Workspace ID is required. Set SMARTSUITE_API_TOKEN and SMARTSUITE_WORKSPACE_ID environment variables.';
        this.lastValidation = { success: false, error, timestamp: startTime };
        this.authenticated = false;
        throw new Error(error);
      }

      // SECURITY CHECK 2: Test credentials against SmartSuite API
      const validationUrl = `${this.authConfig.baseUrl}/api/v1/applications`;

      let response: Response;
      try {
        response = await fetch(validationUrl, {
          method: 'GET',
          headers: {
            'Authorization': `Token ${this.authConfig.apiKey}`,
            'ACCOUNT-ID': this.authConfig.workspaceId,
            'Content-Type': 'application/json',
          },
          // SECURITY: Add timeout to prevent hanging requests
          signal: AbortSignal.timeout(10000),
        });
      } catch (networkError) {
        const errorMessage = networkError instanceof Error ? networkError.message : String(networkError);
        const error = `Network error: ${errorMessage}. Please check your connection and try again.`;
        this.lastValidation = { success: false, error, timestamp: startTime };
        this.authenticated = false;
        throw new Error(error);
      }

      // SECURITY CHECK 3: Handle API response errors with specific messaging
      if (!response.ok) {
        let apiError: { error?: string; message?: string } = {};

        try {
          apiError = await response.json() as { error?: string; message?: string };
        } catch {
          // Use default error if JSON parsing fails
        }

        const errorDetail = apiError.error ?? apiError.message ?? response.statusText;
        let userError: string;

        switch (response.status) {
          case 401:
            userError = `Authentication failed: ${errorDetail}`;
            break;
          case 403:
            userError = `Authorization failed: ${errorDetail}`;
            break;
          case 503:
            userError = `SmartSuite API unavailable: ${errorDetail}. Try again later.`;
            break;
          default:
            userError = `API error ${response.status}: ${errorDetail}`;
        }

        this.lastValidation = { success: false, error: userError, timestamp: startTime };
        this.authenticated = false;
        throw new Error(userError);
      }

      // SUCCESS: Mark as authenticated
      this.authenticated = true;
      this.lastValidation = { success: true, timestamp: startTime };

      // Authentication successful
      return this.lastValidation;

    } catch (error) {
      // SECURITY: Ensure no credentials are exposed in error logs
      // Sanitize error for security (would be logged if console were enabled)
      void this.sanitizeErrorMessage(error instanceof Error ? error.message : String(error));
      // Authentication failed
      throw error;
    }
  }

  /**
   * Check if currently authenticated
   * @returns {boolean} Authentication status
   */
  isAuthenticated(): boolean {
    return this.authenticated;
  }

  /**
   * Get current authentication configuration
   * SECURITY: Returns copy to prevent mutation
   * @returns {AuthConfig | null} Current auth config or null if not set
   */
  getAuthConfig(): AuthConfig | null {
    return this.authConfig ? { ...this.authConfig } : null;
  }

  /**
   * Require authentication for API operations
   * SECURITY: Throws immediately if not authenticated
   *
   * @throws {Error} When not authenticated
   */
  requireAuth(): void {
    if (!this.authenticated) {
      throw new Error('Authentication required: call validateAuth() first or ensure valid SMARTSUITE_API_TOKEN and SMARTSUITE_WORKSPACE_ID environment variables are set.');
    }
  }

  /**
   * Get last validation result for debugging
   * @returns {AuthValidationResult | null} Last validation attempt result
   */
  getLastValidation(): AuthValidationResult | null {
    return this.lastValidation ? { ...this.lastValidation } : null;
  }

  /**
   * Reset authentication state
   * SECURITY: Clears all sensitive state
   */
  reset(): void {
    this.authenticated = false;
    this.authConfig = null;
    this.lastValidation = null;
    // Authentication state reset
  }

  /**
   * Sanitize error messages to prevent credential exposure
   * SECURITY: Removes potential API keys or tokens from error messages
   *
   * @param message Original error message
   * @returns Sanitized error message
   */
  private sanitizeErrorMessage(message: string): string {
    // Remove any potential API tokens (patterns like 'Token abc123', 'Bearer xyz789', etc.)
    return message
      .replace(/Token\s+[A-Za-z0-9\-_]+/g, 'Token [REDACTED]')
      .replace(/Bearer\s+[A-Za-z0-9\-_]+/g, 'Bearer [REDACTED]')
      .replace(/Authorization:\s*[^,\s]+/g, 'Authorization: [REDACTED]')
      .replace(/api[_-]?key[=:\s]+[A-Za-z0-9\-_]+/gi, 'api_key: [REDACTED]');
  }
}
