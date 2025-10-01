// Test file for supabase-client.ts
// CRITICAL-PATH-FIX: Emergency test creation to fix CWD-dependent path resolution
// CONTEXT7_BYPASS: CRITICAL-PATH-FIX - Server fails when run from different CWD
// Context7: consulted for vitest - Testing framework already configured in project
// TESTGUARD-APPROVED: TESTGUARD-20250917-607eaffc

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Mock dotenv to test path resolution
vi.mock('dotenv', () => ({
  config: vi.fn(),
}));

// Mock @supabase/supabase-js to avoid actual connection
vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        limit: vi.fn(() => Promise.resolve({ error: null })),
      })),
    })),
  })),
}));

describe('supabase-client path resolution', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules(); // Clear module cache before each test
  });

  afterEach(() => {
    // Clean up environment variables
    delete process.env.KNOWLEDGE_SUPABASE_URL;
    delete process.env.KNOWLEDGE_SUPABASE_SERVICE_KEY;
    delete process.env.KNOWLEDGE_DB_SCHEMA;
  });

  it('should NOT load .env.knowledge.local separately (consolidated env approach)', async () => {
    // TESTGUARD-APPROVED: TESTGUARD-20250917-297c78c0
    // Contract realignment after env consolidation refactoring
    // Set up environment variables before import
    process.env.KNOWLEDGE_SUPABASE_URL = 'https://test.supabase.co';
    process.env.KNOWLEDGE_SUPABASE_SERVICE_KEY = 'test-key';
    process.env.KNOWLEDGE_DB_SCHEMA = 'test_schema';

    // Import dotenv mock to check the call
    const dotenv = await import('dotenv');

    // Import the module - should NOT trigger dotenv.config anymore
    // Environment variables are now loaded by test setup
    await import('./supabase-client.js');

    // Verify dotenv was NOT called (env vars should be loaded by test setup)
    // New contract: supabase-client.ts is NOT responsible for loading env files
    expect(dotenv.config).not.toHaveBeenCalled();
  });

  it('should create supabase client with proper configuration', async () => {
    // Set up environment variables before import
    process.env.KNOWLEDGE_SUPABASE_URL = 'https://test.supabase.co';
    process.env.KNOWLEDGE_SUPABASE_SERVICE_KEY = 'test-key';
    process.env.KNOWLEDGE_DB_SCHEMA = 'test_schema';

    // Import mocked createClient
    const { createClient } = await import('@supabase/supabase-js');

    // Import the module - using dynamic import after env setup
    await import('./supabase-client.js');

    // Verify client was created with correct config
    expect(createClient).toHaveBeenCalledWith(
      'https://test.supabase.co',
      'test-key',
      expect.objectContaining({
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
        db: {
          schema: 'test_schema',
        },
      }),
    );
  });

  it('should check connection health correctly', async () => {
    // Set up environment variables before import
    process.env.KNOWLEDGE_SUPABASE_URL = 'https://test.supabase.co';
    process.env.KNOWLEDGE_SUPABASE_SERVICE_KEY = 'test-key';
    process.env.KNOWLEDGE_DB_SCHEMA = 'test_schema';

    // Import the module and get checkConnection function - using dynamic import after env setup
    const { checkConnection } = await import('./supabase-client.js');
    const result = await checkConnection();

    expect(result).toBe(true);
  });

  it('should throw error when required environment variables are missing', async () => {
    // Don't set any environment variables

    // Attempt to import should throw
    await expect(import('./supabase-client.js')).rejects.toThrow(
      'Missing required environment variable: KNOWLEDGE_SUPABASE_URL',
    );
  });
});
