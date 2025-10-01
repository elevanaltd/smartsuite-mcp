// Context7: consulted for winston
// Context7: consulted for vitest
// Critical-Engineer: consulted for Logging strategy and stdio protocol safety
// Test file for logger module - ensuring stdout/stderr separation for MCP protocol safety

import { describe, it, expect, beforeEach, afterEach, vi, Mock } from 'vitest';
import winston from 'winston';

// Mock winston before importing logger
vi.mock('winston', () => ({
  default: {
    createLogger: vi.fn(),
    format: {
      json: vi.fn(() => 'json-format'),
    },
    transports: {
      Console: vi.fn(),
    },
  },
}));

describe('Logger Configuration', () => {
  let originalConsoleLog: typeof console.log;
  let originalConsoleInfo: typeof console.info;
  let originalConsoleWarn: typeof console.warn;
  let originalConsoleError: typeof console.error;
  let mockLogger: any;

  beforeEach(() => {
    // Store original console methods
    originalConsoleLog = console.log;
    originalConsoleInfo = console.info;
    originalConsoleWarn = console.warn;
    originalConsoleError = console.error;

    // Setup mock logger
    mockLogger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    };

    // Configure winston.createLogger mock
    (winston.createLogger as Mock).mockReturnValue(mockLogger);

    // Clear module cache to force re-import
    vi.resetModules();
  });

  afterEach(() => {
    // Restore original console methods
    console.log = originalConsoleLog;
    console.info = originalConsoleInfo;
    console.warn = originalConsoleWarn;
    console.error = originalConsoleError;

    vi.clearAllMocks();
  });

  it('should create a winston logger with correct configuration', async () => {
    // Import logger (this will trigger winston.createLogger)
    await import('./logger.js');

    // Verify winston.createLogger was called with correct config
    expect(winston.createLogger).toHaveBeenCalledWith({
      level: 'info', // Default when LOG_LEVEL not set
      format: 'json-format',
      transports: expect.any(Array),
      exitOnError: false,
    });
  });

  it('should configure Console transport to use stderr for all levels', async () => {
    await import('./logger.js');

    // Get the transport configuration passed to Console constructor
    const ConsoleConstructor = winston.transports.Console as unknown as Mock;
    expect(ConsoleConstructor).toHaveBeenCalledWith({
      stderrLevels: ['error', 'warn', 'info', 'http', 'verbose', 'debug', 'silly'],
    });
  });

  it('should respect LOG_LEVEL environment variable', async () => {
    process.env.LOG_LEVEL = 'debug';

    await import('./logger.js');

    expect(winston.createLogger).toHaveBeenCalledWith(
      expect.objectContaining({
        level: 'debug',
      }),
    );

    delete process.env.LOG_LEVEL;
  });

  it('should redirect console.log to logger.info', async () => {
    await import('./logger.js');

    // Test that console.log has been replaced
    console.log('test message', 'arg2');

    expect(mockLogger.info).toHaveBeenCalledWith('test message', { metadata: ['arg2'] });
  });

  it('should redirect console.info to logger.info', async () => {
    await import('./logger.js');

    console.info('info message');

    expect(mockLogger.info).toHaveBeenCalledWith('info message');
  });

  it('should redirect console.warn to logger.warn', async () => {
    await import('./logger.js');

    console.warn('warning message');

    expect(mockLogger.warn).toHaveBeenCalledWith('warning message');
  });

  it('should redirect console.error to logger.error', async () => {
    await import('./logger.js');

    console.error('error message', { error: 'details' });

    expect(mockLogger.error).toHaveBeenCalledWith('error message', { metadata: [{ error: 'details' }] });
  });

  it('should export the logger instance as default', async () => {
    const loggerModule = await import('./logger.js');

    expect(loggerModule.default).toBe(mockLogger);
  });

  it('should handle multiple arguments in console redirects', async () => {
    await import('./logger.js');

    const obj = { key: 'value' };
    const num = 42;
    console.log('multiple', 'args', obj, num);

    expect(mockLogger.info).toHaveBeenCalledWith('multiple', { metadata: ['args', obj, num] });
  });

  describe('MCP Protocol Safety', () => {
    it('should never write to stdout (all levels go to stderr)', async () => {
      await import('./logger.js');

      // The key test: verify that stderrLevels includes ALL log levels
      // This ensures stdout remains clean for MCP protocol messages
      const ConsoleConstructor = winston.transports.Console as unknown as Mock;
      const callArgs = ConsoleConstructor.mock.calls?.[0]?.[0];

      // All winston log levels should be in stderrLevels
      const allLevels = ['error', 'warn', 'info', 'http', 'verbose', 'debug', 'silly'];
      expect(callArgs.stderrLevels).toEqual(expect.arrayContaining(allLevels));
      expect(callArgs.stderrLevels).toHaveLength(allLevels.length);
    });

    it('should use JSON format for structured logging', async () => {
      await import('./logger.js');

      expect(winston.format.json).toHaveBeenCalled();
      expect(winston.createLogger).toHaveBeenCalledWith(
        expect.objectContaining({
          format: 'json-format',
        }),
      );
    });
  });
});
