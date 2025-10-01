// Context7: consulted for vitest
// Test for index.ts entry point
// TESTGUARD-APPROVED: REFACTOR-API-001 - Test update to match refactored main() API
// Critical-Engineer: consulted for Node.js ESM module resolution strategy
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('index.ts entry point', () => {
  let consoleLogSpy: any;

  beforeEach(() => {
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    // Clear module cache to ensure fresh imports
    vi.resetModules();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env.MCP_VALIDATE_AND_EXIT;
    vi.resetModules();
  });

  it('should export SmartSuiteShimServer class and main function', async () => {
    const indexModule = await import('../src/index.js');
    expect(indexModule.SmartSuiteShimServer).toBeDefined();
    expect(indexModule.main).toBeDefined();
    expect(typeof indexModule.main).toBe('function');
  });

  it('should initialize server and log available tools when main() runs', async () => {
    const { main } = await import('../src/index.js');

    // Set validation mode to return cleanly
    process.env.MCP_VALIDATE_AND_EXIT = 'true';

    const exitCode = await main();
    expect(exitCode).toBe(0);

    // Verify startup logs include tool information
    expect(consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining('SmartSuite API Shim MCP Server starting'),
    );
    // ERROR-RESOLVER: Updated for Knowledge Platform integration (9 tools total)
    // Following CONTRACT-DRIVEN-CORRECTION principle
    expect(consoleLogSpy).toHaveBeenCalledWith('Server ready with 9 tools:', [
      'smartsuite_query',
      'smartsuite_record',
      'smartsuite_schema',
      'smartsuite_undo',
      'smartsuite_discover',
      'smartsuite_intelligent',
      'smartsuite_knowledge_events',
      'smartsuite_knowledge_field_mappings',
      'smartsuite_knowledge_refresh_views',
    ]);
  });

  it('should exit cleanly in validation mode after startup validation', async () => {
    process.env.MCP_VALIDATE_AND_EXIT = 'true';
    const { main } = await import('../src/index.js');

    const exitCode = await main();
    expect(exitCode).toBe(0);

    // Verify validation mode behavior
    expect(consoleLogSpy).toHaveBeenCalledWith('CI startup validation successful');
    // processExitSpy no longer needed as main() returns exit code
  });

  it('should handle startup errors gracefully', async () => {
    // Mock the server to throw an error
    vi.doMock('../src/mcp-server', () => ({
      SmartSuiteShimServer: vi.fn().mockImplementation(() => {
        throw new Error('Initialization failed');
      }),
    }));

    const { main } = await import('../src/index.js');

    // Now main() should throw the error directly (no process.exit in main())
    await expect(main()).rejects.toThrow('Initialization failed');

    vi.doUnmock('../src/mcp-server');
  });
});
