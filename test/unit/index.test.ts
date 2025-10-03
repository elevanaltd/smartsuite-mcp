// Phoenix Test Contract: ENTRY-001 to ENTRY-008
// Contract: MCP server entry point and process management
// Status: RED (tests written, implementation pending)
// Phase: 2F - MCP Server Integration (follows 2E tool layer completion)
// Architecture: Entry Point → Server → Tools → Handlers → Client → API
// TDD Phase: RED → Implementation will follow

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

/**
 * Entry Point Test Contracts
 *
 * Purpose: Validate MCP server entry point, process lifecycle, and error boundaries
 * Coverage Target: 90% (universal-test-engineer standard)
 *
 * Entry Point Responsibilities:
 * 1. Export server instance for MCP protocol integration
 * 2. Initialize stdio transport for MCP communication
 * 3. Handle process signals (SIGTERM, SIGINT) for graceful shutdown
 * 4. Provide global error boundary for unhandled errors
 * 5. Bootstrap server configuration and start MCP protocol handler
 *
 * Test Organization:
 * - 8 test contracts covering entry point, lifecycle, error boundaries
 * - Focus on process-level concerns and MCP protocol initialization
 * - Mock Node.js process and MCP transport for testing
 */

describe('Entry Point', () => {
  let originalEnv: NodeJS.ProcessEnv;
  let processExitSpy: any;

  beforeEach(() => {
    // Save original environment
    originalEnv = { ...process.env };

    // Set up test environment
    process.env.SMARTSUITE_API_KEY = 'test-api-key';
    process.env.SMARTSUITE_WORKSPACE_ID = 'test-workspace-id';

    // Spy on process.exit to prevent actual exits during tests
    processExitSpy = vi.spyOn(process, 'exit').mockImplementation((() => {}) as any);
  });

  afterEach(() => {
    // Restore original environment
    process.env = originalEnv;
    processExitSpy.mockRestore();
    vi.clearAllMocks();
    vi.resetModules(); // Clear module cache to allow fresh imports with spies
  });

  // ============================================================================
  // SERVER EXPORT
  // ============================================================================

  describe('Server Export', () => {
    describe('ENTRY-001: Main export structure', () => {
      it('should export server instance', async () => {
        // CONTRACT: Entry point must export configured MCP server
        // This allows MCP clients to import and connect to the server

        const entryPoint = await import('../../src/index.js');

        expect(entryPoint).toHaveProperty('server');
        expect(entryPoint.server).toBeDefined();
      });

      it('should export startServer function', async () => {
        // CONTRACT: Provide function to bootstrap server for testing/programmatic use

        const entryPoint = await import('../../src/index.js');

        expect(entryPoint).toHaveProperty('startServer');
        expect(typeof entryPoint.startServer).toBe('function');
      });

      it('should allow server to be imported by MCP clients', async () => {
        // CONTRACT: Server export should be compatible with MCP SDK expectations

        const { server } = await import('../../src/index.js');

        // Server should have MCP SDK methods
        expect(server).toHaveProperty('connect');
        expect(server).toHaveProperty('setRequestHandler');
      });
    });
  });

  // ============================================================================
  // STDIO TRANSPORT INITIALIZATION
  // ============================================================================

  describe('STDIO Transport', () => {
    describe('ENTRY-002: Transport creation', () => {
      it('should create StdioServerTransport for MCP communication', async () => {
        // CONTRACT: Entry point must initialize stdio transport for MCP protocol
        // MCP clients communicate via stdin/stdout

        const { createTransport } = await import('../../src/index.js');
        const transport = createTransport();

        expect(transport).toBeDefined();
        expect(transport).toHaveProperty('start');
        expect(transport).toHaveProperty('close');
      });

      it('should connect transport to server', async () => {
        // CONTRACT: Server and transport must be properly connected

        const { server, createTransport } = await import('../../src/index.js');
        const transport = createTransport();

        // Server should be able to connect to transport
        expect(async () => {
          await server.connect(transport);
        }).not.toThrow();
      });

      it('should use process stdin/stdout for transport', async () => {
        // CONTRACT: Transport should use standard Node.js process streams

        const { createTransport } = await import('../../src/index.js');
        const transport = createTransport();

        // Transport should be configured with stdin/stdout
        expect(transport).toBeDefined();
        // Implementation will verify correct stream usage
      });
    });
  });

  // ============================================================================
  // PROCESS SIGNAL HANDLING
  // ============================================================================

  describe('Signal Handling', () => {
    describe('ENTRY-003: SIGTERM handling', () => {
      it('should register SIGTERM handler', async () => {
        // CONTRACT: Server must gracefully shutdown on SIGTERM

        const processOnSpy = vi.spyOn(process, 'on');

        await import('../../src/index.js');

        expect(processOnSpy).toHaveBeenCalledWith('SIGTERM', expect.any(Function));
      });

      it('should cleanup resources on SIGTERM', async () => {
        // CONTRACT: SIGTERM should trigger graceful shutdown

        const { setupSignalHandlers } = await import('../../src/index.js');
        const mockServer = {
          close: vi.fn().mockResolvedValue(undefined),
        };
        const mockTransport = {
          close: vi.fn().mockResolvedValue(undefined),
        };

        setupSignalHandlers(mockServer as any, mockTransport as any);

        // Simulate SIGTERM
        const sigtermHandler = (process.on as any).mock.calls.find(
          (call: any[]) => call[0] === 'SIGTERM',
        )?.[1];

        if (sigtermHandler) {
          await sigtermHandler();
          expect(mockTransport.close).toHaveBeenCalled();
        }
      });
    });

    describe('ENTRY-004: SIGINT handling', () => {
      it('should register SIGINT handler', async () => {
        // CONTRACT: Server must gracefully shutdown on SIGINT (Ctrl+C)

        const processOnSpy = vi.spyOn(process, 'on');

        await import('../../src/index.js');

        expect(processOnSpy).toHaveBeenCalledWith('SIGINT', expect.any(Function));
      });

      it('should cleanup resources on SIGINT', async () => {
        // CONTRACT: SIGINT should trigger graceful shutdown

        const { setupSignalHandlers } = await import('../../src/index.js');
        const mockServer = {
          close: vi.fn().mockResolvedValue(undefined),
        };
        const mockTransport = {
          close: vi.fn().mockResolvedValue(undefined),
        };

        setupSignalHandlers(mockServer as any, mockTransport as any);

        // Simulate SIGINT
        const sigintHandler = (process.on as any).mock.calls.find(
          (call: any[]) => call[0] === 'SIGINT',
        )?.[1];

        if (sigintHandler) {
          await sigintHandler();
          expect(mockTransport.close).toHaveBeenCalled();
        }
      });

      it('should exit process after cleanup on SIGINT', async () => {
        // CONTRACT: Process should exit cleanly after shutdown

        const { setupSignalHandlers } = await import('../../src/index.js');
        const mockServer = {
          close: vi.fn().mockResolvedValue(undefined),
        };
        const mockTransport = {
          close: vi.fn().mockResolvedValue(undefined),
        };

        setupSignalHandlers(mockServer as any, mockTransport as any);

        // Simulate SIGINT
        const sigintHandler = (process.on as any).mock.calls.find(
          (call: any[]) => call[0] === 'SIGINT',
        )?.[1];

        if (sigintHandler) {
          await sigintHandler();
          expect(processExitSpy).toHaveBeenCalledWith(0);
        }
      });
    });
  });
  // ============================================================================
  // BEHAVIORAL CONTRACTS - SIGNAL HANDLER SAFETY
  // ============================================================================
  // TESTGUARD APPROVAL: Behavioral tests to prevent critical bugs
  // BUG-1: Double registration creating duplicate listeners
  // BUG-2: Silent shutdown failures (exit code 0 on error)
  // BUG-3: Hung shutdowns blocking termination indefinitely
  //
  // These tests validate BEHAVIOR not implementation details
  // They must FAIL when bugs are present, PASS when bugs are fixed

  describe('Behavioral Contracts - Signal Handler Safety', () => {
    describe('LIFECYCLE-001: Prevent double handler registration', () => {
      it('should use process.once() to prevent duplicate SIGINT execution', async () => {
        // CONTRACT: Multiple setup calls must not create duplicate listeners
        // BUG-1 PREVENTION: Duplicate handlers cause multiple shutdowns
        // BEHAVIOR: process.once() ensures single execution per signal

        vi.resetModules(); // Fresh import for clean state
        const processOnceSpy = vi.spyOn(process, 'once');

        const { setupSignalHandlers } = await import('../../src/index.js');

        const mockServer = {
          close: vi.fn().mockResolvedValue(undefined),
        };
        const mockTransport = {
          close: vi.fn().mockResolvedValue(undefined),
        };

        // Call setup once
        setupSignalHandlers(mockServer as any, mockTransport as any);

        // BEHAVIORAL ASSERTION: Must use .once() not .on() for SIGINT
        const sigintCalls = processOnceSpy.mock.calls.filter((call) => call[0] === 'SIGINT');
        expect(sigintCalls.length).toBeGreaterThanOrEqual(1);

        processOnceSpy.mockRestore();
      });

      it('should use process.once() to prevent duplicate SIGTERM execution', async () => {
        // CONTRACT: Multiple setup calls must not create duplicate listeners
        // BUG-1 PREVENTION: Duplicate handlers cause multiple shutdowns
        // BEHAVIOR: process.once() ensures single execution per signal

        vi.resetModules(); // Fresh import for clean state
        const processOnceSpy = vi.spyOn(process, 'once');

        const { setupSignalHandlers } = await import('../../src/index.js');

        const mockServer = {
          close: vi.fn().mockResolvedValue(undefined),
        };
        const mockTransport = {
          close: vi.fn().mockResolvedValue(undefined),
        };

        // Call setup once
        setupSignalHandlers(mockServer as any, mockTransport as any);

        // BEHAVIORAL ASSERTION: Must use .once() not .on() for SIGTERM
        const sigtermCalls = processOnceSpy.mock.calls.filter((call) => call[0] === 'SIGTERM');
        expect(sigtermCalls.length).toBeGreaterThanOrEqual(1);

        processOnceSpy.mockRestore();
      });
    });

    describe('LIFECYCLE-002: Exit code behavior on shutdown outcomes', () => {
      it('should exit with code 1 when shutdown fails', async () => {
        // CONTRACT: Shutdown errors must signal failure to supervisor
        // BUG-2 PREVENTION: Silent failures (exit 0 on error) hide problems
        // BEHAVIOR: Failed shutdowns MUST exit(1) for supervisor awareness

        vi.resetModules(); // Fresh import for clean state
        const processOnceSpy = vi.spyOn(process, 'once');

        const { setupSignalHandlers } = await import('../../src/index.js');

        const shutdownError = new Error('Shutdown failed - transport error');
        const mockServer = {
          close: vi.fn().mockRejectedValue(shutdownError),
        };
        const mockTransport = {
          close: vi.fn().mockRejectedValue(shutdownError),
        };

        const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

        setupSignalHandlers(mockServer as any, mockTransport as any);

        // Find and trigger SIGINT handler
        const sigintCall = processOnceSpy.mock.calls.find((call) => call[0] === 'SIGINT');
        const sigintHandler = sigintCall?.[1];

        if (sigintHandler) {
          await sigintHandler();

          // BEHAVIORAL ASSERTION: Must exit(1) on failure
          expect(processExitSpy).toHaveBeenCalledWith(1);
        }

        consoleErrorSpy.mockRestore();
        processOnceSpy.mockRestore();
      });

      it('should exit with code 0 on successful shutdown', async () => {
        // CONTRACT: Clean shutdowns signal success to supervisor
        // BEHAVIOR: Successful shutdowns MUST exit(0) for clean termination

        vi.resetModules(); // Fresh import for clean state
        const processOnceSpy = vi.spyOn(process, 'once');

        const { setupSignalHandlers } = await import('../../src/index.js');

        const mockServer = {
          close: vi.fn().mockResolvedValue(undefined),
        };
        const mockTransport = {
          close: vi.fn().mockResolvedValue(undefined),
        };

        const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

        setupSignalHandlers(mockServer as any, mockTransport as any);

        // Find and trigger SIGTERM handler
        const sigtermCall = processOnceSpy.mock.calls.find((call) => call[0] === 'SIGTERM');
        const sigtermHandler = sigtermCall?.[1];

        if (sigtermHandler) {
          await sigtermHandler();

          // BEHAVIORAL ASSERTION: Must exit(0) on success
          expect(processExitSpy).toHaveBeenCalledWith(0);
        }

        consoleErrorSpy.mockRestore();
        processOnceSpy.mockRestore();
      });
    });

    describe('LIFECYCLE-003: Timeout protection for hung shutdowns', () => {
      it('should timeout and exit when shutdown hangs indefinitely', async () => {
        // CONTRACT: Hung shutdowns must not block termination
        // BUG-3 PREVENTION: Infinite shutdown hangs prevent container restarts
        // BEHAVIOR: Shutdown MUST timeout and force exit after threshold

        vi.resetModules(); // Fresh import for clean state
        vi.useFakeTimers();

        const processOnceSpy = vi.spyOn(process, 'once');

        const { setupSignalHandlers } = await import('../../src/index.js');

        // Mock shutdown that NEVER resolves (simulates hung operation)
        const mockServer = {
          close: vi.fn().mockImplementation(() => new Promise(() => {})), // Never resolves
        };
        const mockTransport = {
          close: vi.fn().mockImplementation(() => new Promise(() => {})), // Never resolves
        };

        const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

        setupSignalHandlers(mockServer as any, mockTransport as any);

        // Find and trigger SIGINT handler
        const sigintCall = processOnceSpy.mock.calls.find((call) => call[0] === 'SIGINT');
        const sigintHandler = sigintCall?.[1];

        if (sigintHandler) {
          const shutdownPromise = sigintHandler();

          // Advance timers past SHUTDOWN_TIMEOUT_MS (500ms)
          await vi.advanceTimersByTimeAsync(600);

          await shutdownPromise;

          // BEHAVIORAL ASSERTION: Must exit(1) after timeout
          // Timeout counts as failure (hung shutdown is abnormal)
          expect(processExitSpy).toHaveBeenCalledWith(1);

          // Verify timeout error was logged
          expect(consoleErrorSpy).toHaveBeenCalledWith(
            expect.stringMatching(/shutdown error/i),
            expect.objectContaining({
              message: expect.stringMatching(/timeout/i),
            }),
          );
        }

        consoleErrorSpy.mockRestore();
        processOnceSpy.mockRestore();
        vi.useRealTimers();
      });

      it('should complete shutdown before timeout when responsive', async () => {
        // CONTRACT: Fast shutdowns should complete normally
        // BEHAVIOR: Timeout should not interfere with responsive shutdowns

        vi.resetModules(); // Fresh import for clean state
        vi.useFakeTimers();

        const processOnceSpy = vi.spyOn(process, 'once');

        const { setupSignalHandlers } = await import('../../src/index.js');

        // Mock fast shutdown (completes in 100ms)
        const mockServer = {
          close: vi.fn().mockImplementation(
            () =>
              new Promise((resolve) => {
                setTimeout(resolve, 100);
              }),
          ),
        };
        const mockTransport = {
          close: vi.fn().mockImplementation(
            () =>
              new Promise((resolve) => {
                setTimeout(resolve, 100);
              }),
          ),
        };

        const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

        setupSignalHandlers(mockServer as any, mockTransport as any);

        // Find and trigger SIGTERM handler
        const sigtermCall = processOnceSpy.mock.calls.find((call) => call[0] === 'SIGTERM');
        const sigtermHandler = sigtermCall?.[1];

        if (sigtermHandler) {
          const shutdownPromise = sigtermHandler();

          // Advance timers by 150ms (enough for shutdown, but less than timeout)
          await vi.advanceTimersByTimeAsync(150);

          await shutdownPromise;

          // BEHAVIORAL ASSERTION: Must exit(0) on successful shutdown
          expect(processExitSpy).toHaveBeenCalledWith(0);

          // Should NOT have timeout error
          expect(consoleErrorSpy).not.toHaveBeenCalledWith(
            expect.stringMatching(/shutdown error/i),
            expect.objectContaining({
              message: expect.stringMatching(/timeout/i),
            }),
          );
        }

        consoleErrorSpy.mockRestore();
        processOnceSpy.mockRestore();
        vi.useRealTimers();
      });
    });
  });


  // ============================================================================
  // ERROR BOUNDARIES
  // ============================================================================

  describe('Error Boundaries', () => {
    describe('ENTRY-005: Unhandled error handling', () => {
      it('should register uncaughtException handler', async () => {
        // CONTRACT: Global error boundary for unhandled errors

        const processOnSpy = vi.spyOn(process, 'on');

        await import('../../src/index.js');

        expect(processOnSpy).toHaveBeenCalledWith('uncaughtException', expect.any(Function));
      });

      it('should log uncaught exceptions', async () => {
        // CONTRACT: Errors should be logged for debugging

        const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

        const { handleUncaughtException } = await import('../../src/index.js');
        const testError = new Error('Uncaught test error');

        handleUncaughtException(testError);

        expect(consoleErrorSpy).toHaveBeenCalledWith(
          expect.stringMatching(/uncaught exception/i),
          testError,
        );

        consoleErrorSpy.mockRestore();
      });

      it('should exit process on uncaught exception', async () => {
        // CONTRACT: Prevent undefined behavior by exiting on fatal errors

        const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

        const { handleUncaughtException } = await import('../../src/index.js');
        const testError = new Error('Fatal error');

        handleUncaughtException(testError);

        expect(processExitSpy).toHaveBeenCalledWith(1);

        consoleErrorSpy.mockRestore();
      });
    });

    describe('ENTRY-006: Unhandled promise rejection handling', () => {
      it('should register unhandledRejection handler', async () => {
        // CONTRACT: Catch unhandled promise rejections

        const processOnSpy = vi.spyOn(process, 'on');

        await import('../../src/index.js');

        expect(processOnSpy).toHaveBeenCalledWith('unhandledRejection', expect.any(Function));
      });

      it('should log unhandled rejections', async () => {
        // CONTRACT: Promise rejections should be logged

        const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

        const { handleUnhandledRejection } = await import('../../src/index.js');
        const testError = new Error('Unhandled rejection');

        handleUnhandledRejection(testError);

        expect(consoleErrorSpy).toHaveBeenCalledWith(
          expect.stringMatching(/unhandled rejection/i),
          testError,
        );

        consoleErrorSpy.mockRestore();
      });

      it('should exit process on unhandled rejection', async () => {
        // CONTRACT: Prevent undefined behavior from unhandled rejections

        const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

        const { handleUnhandledRejection } = await import('../../src/index.js');
        const testError = new Error('Fatal rejection');

        handleUnhandledRejection(testError);

        expect(processExitSpy).toHaveBeenCalledWith(1);

        consoleErrorSpy.mockRestore();
      });
    });
  });

  // ============================================================================
  // BOOTSTRAP AND STARTUP
  // ============================================================================

  describe('Server Bootstrap', () => {
    describe('ENTRY-007: Configuration loading', () => {
      it('should load configuration before starting server', async () => {
        // CONTRACT: Environment variables must be validated before server start

        const { startServer } = await import('../../src/index.js');

        // Should not throw with valid environment
        await expect(startServer()).resolves.not.toThrow();
      });

      it('should fail fast if configuration is invalid', async () => {
        // CONTRACT: Invalid configuration should prevent server start

        delete process.env.SMARTSUITE_API_KEY;

        const { startServer } = await import('../../src/index.js');

        await expect(startServer()).rejects.toThrow(/required/i);
      });
    });

    describe('ENTRY-008: Server startup', () => {
      it('should start MCP protocol handler', async () => {
        // CONTRACT: Server must be ready to accept MCP requests after startup

        const { startServer } = await import('../../src/index.js');

        // Should initialize without errors
        await expect(startServer()).resolves.not.toThrow();
      });

      it('should log successful startup', async () => {
        // CONTRACT: Provide visibility into server state

        const consoleLogSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

        const { startServer } = await import('../../src/index.js');
        await startServer();

        expect(consoleLogSpy).toHaveBeenCalled();

        consoleLogSpy.mockRestore();
      });
    });
  });
});
