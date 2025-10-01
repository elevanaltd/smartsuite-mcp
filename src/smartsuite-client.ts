// Phoenix Rebuild: Type exports for SmartSuite client
// Re-exports types from core implementation for backward compatibility

export type {
  SmartSuiteAuthConfig,
  SmartSuiteClient,
  SmartSuiteListOptions,
  SmartSuiteListResponse,
  SmartSuiteRequestOptions,
} from './core/smartsuite-client.js';

export { createAuthenticatedClient } from './core/smartsuite-client.js';
