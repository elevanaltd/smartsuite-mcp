// Test-first approach for auth context propagation in audit logs
// Following strategic plan Week 1, Day 1-2: Auth Context Implementation
// TESTGUARD_BYPASS: ESLint-FIX-001 - ESLint compliance fixes only

// Context7: consulted for fs - Node.js built-in for file system operations
import * as fs from 'fs';
// Context7: consulted for node:async_hooks - Node.js built-in for AsyncLocalStorage
import { AsyncLocalStorage } from 'node:async_hooks';
// Context7: consulted for path - Node.js built-in for path manipulation
import * as path from 'path';

// Context7: consulted for vitest - testing framework
import { vi } from 'vitest';

import { AuditContext, auditContextStorage, withAuditContext } from './audit-context.js';
import { AuditLogger } from './audit-logger.js';

describe('AuditContext - Auth Context Propagation', () => {
  const testAuditFile = path.join(process.cwd(), 'test-audit.ndjson');
  let auditLogger: AuditLogger;

  beforeEach(() => {
    // Clean up test file
    if (fs.existsSync(testAuditFile)) {
      fs.unlinkSync(testAuditFile);
    }
    auditLogger = new AuditLogger(testAuditFile);
  });

  afterEach(() => {
    // Clean up test file
    if (fs.existsSync(testAuditFile)) {
      fs.unlinkSync(testAuditFile);
    }
  });

  describe('Context Storage', () => {
    it('should create AsyncLocalStorage for audit context', () => {
      expect(auditContextStorage).toBeDefined();
      expect(auditContextStorage).toBeInstanceOf(AsyncLocalStorage);
    });

    it('should store and retrieve audit context', async () => {
      const testContext: AuditContext = {
        userId: 'user-123',
        sessionId: 'session-456',
        requestId: 'req-789',
        ipAddress: '192.168.1.1',
        timestamp: new Date(),
      };

      // eslint-disable-next-line @typescript-eslint/require-await -- async callback required by withAuditContext API for context propagation
      await withAuditContext(testContext, async () => {
        const currentContext = auditContextStorage.getStore();
        expect(currentContext).toEqual(testContext);
      });
    });

    it('should isolate context between concurrent requests', async () => {
      const context1: AuditContext = {
        userId: 'user-1',
        sessionId: 'session-1',
        requestId: 'req-1',
        ipAddress: '10.0.0.1',
        timestamp: new Date(),
      };

      const context2: AuditContext = {
        userId: 'user-2',
        sessionId: 'session-2',
        requestId: 'req-2',
        ipAddress: '10.0.0.2',
        timestamp: new Date(),
      };

      const results: string[] = [];

      await Promise.all([
        // eslint-disable-next-line @typescript-eslint/require-await -- async callback required by withAuditContext API for context propagation
        withAuditContext(context1, async () => {
          await new Promise(resolve => setTimeout(resolve, 10));
          const ctx = auditContextStorage.getStore();
          results.push(ctx?.userId ?? 'none');
        }),
        // eslint-disable-next-line @typescript-eslint/require-await -- async callback required by withAuditContext API for context propagation
        withAuditContext(context2, async () => {
          const ctx = auditContextStorage.getStore();
          results.push(ctx?.userId ?? 'none');
        }),
      ]);

      expect(results).toContain('user-1');
      expect(results).toContain('user-2');
    });
  });

  describe('Audit Logger Integration', () => {
    it('should include auth context in audit log entries', async () => {
      const authContext: AuditContext = {
        userId: 'test-user',
        sessionId: 'test-session',
        requestId: 'test-request',
        ipAddress: '127.0.0.1',
        timestamp: new Date(),
      };

      const auditEntry = {
        tableId: 'test-table',
        recordId: 'test-record',
        operation: 'create' as const,
        payload: { test: 'data' },
      };

      await withAuditContext(authContext, async () => {
        const result = await auditLogger.logWithContext(
          auditEntry.tableId,
          auditEntry.recordId,
          auditEntry.operation,
          auditEntry.payload,
        );

        expect(result).toBeDefined();
        expect(result.authContext).toEqual(authContext);
      });

      // Verify the log was written with context
      const logContent = fs.readFileSync(testAuditFile, 'utf-8');
      const logLines = logContent.trim().split('\n').filter(line => line.length > 0);

      expect(logLines.length).toBeGreaterThan(0);
      const lastLine = logLines[logLines.length - 1];
      expect(lastLine).toBeDefined();
      const lastEntry = JSON.parse(lastLine!);

      expect(lastEntry.authContext).toBeDefined();
      expect(lastEntry.authContext.userId).toBe('test-user');
      expect(lastEntry.authContext.sessionId).toBe('test-session');
      expect(lastEntry.authContext.requestId).toBe('test-request');
      expect(lastEntry.authContext.ipAddress).toBe('127.0.0.1');
    });

    it('should handle missing auth context gracefully', async () => {
      // Without context wrapper
      const result = await auditLogger.logWithContext(
        'test-table',
        'test-record',
        'create',
        { test: 'data' },
      );

      expect(result).toBeDefined();
      expect(result.authContext).toBeUndefined();
    });

    it('should propagate context through nested async operations', async () => {
      const authContext: AuditContext = {
        userId: 'nested-user',
        sessionId: 'nested-session',
        requestId: 'nested-request',
        ipAddress: '192.168.1.100',
        timestamp: new Date(),
      };

      await withAuditContext(authContext, async () => {
        // Simulate nested async operations
        await Promise.resolve();

        const performOperation = async (): Promise<AuditContext | undefined> => {
          await new Promise(resolve => setTimeout(resolve, 5));
          const ctx = auditContextStorage.getStore();
          return ctx;
        };

        const nestedContext = await performOperation();
        expect(nestedContext).toEqual(authContext);

        // Even deeper nesting
        const deepOperation = async (): Promise<AuditContext | undefined> => {
          return await performOperation();
        };

        const deepContext = await deepOperation();
        expect(deepContext).toEqual(authContext);
      });
    });
  });
  describe('MCP Tool Handler Integration', () => {
    it('should wrap MCP tool handlers with auth context', async () => {
      // eslint-disable-next-line @typescript-eslint/require-await -- async callback required by withAuditContext API for context propagation
      const mockHandler = vi.fn(async () => {
        const context = auditContextStorage.getStore();
        return { success: true, context };
      });

      const authContext: AuditContext = {
        userId: 'mcp-user',
        sessionId: 'mcp-session',
        requestId: 'mcp-request',
        ipAddress: '10.10.10.10',
        timestamp: new Date(),
      };

      const wrappedHandler = withAuditContextWrapper(authContext, mockHandler);
      const result = await wrappedHandler();

      expect(mockHandler).toHaveBeenCalled();
      expect(result.context).toEqual(authContext);
    });
  });

  describe('Security Requirements', () => {
    it('should not leak context between different request handlers', async () => {
      const leakedContexts: (AuditContext | undefined)[] = [];

      const handler1 = withAuditContext({
        userId: 'handler1',
        sessionId: 'session1',
        requestId: 'req1',
        ipAddress: '1.1.1.1',
        timestamp: new Date(),
      }, async () => {
        await new Promise(resolve => setTimeout(resolve, 20));
        leakedContexts.push(auditContextStorage.getStore());
      });

      const handler2 = withAuditContext({
        userId: 'handler2',
        sessionId: 'session2',
        requestId: 'req2',
        ipAddress: '2.2.2.2',
        timestamp: new Date(),
      }, async () => {
        await new Promise(resolve => setTimeout(resolve, 10));
        leakedContexts.push(auditContextStorage.getStore());
      });

      // eslint-disable-next-line @typescript-eslint/require-await -- async callback required for Promise.all compatibility
      const noContextHandler = async (): Promise<void> => {
        leakedContexts.push(auditContextStorage.getStore());
      };

      await Promise.all([handler1, handler2, noContextHandler()]);

      // Each handler should only see its own context
      const userIds = leakedContexts.map(ctx => ctx?.userId);
      expect(userIds).toContain('handler1');
      expect(userIds).toContain('handler2');
      expect(userIds).toContain(undefined);

      // No handler should see another's context
      expect(leakedContexts.filter(ctx => ctx?.userId === 'handler1').length).toBe(1);
      expect(leakedContexts.filter(ctx => ctx?.userId === 'handler2').length).toBe(1);
    });

    it('should clear context after handler completion', async () => {
      await withAuditContext({
        userId: 'temp-user',
        sessionId: 'temp-session',
        requestId: 'temp-request',
        ipAddress: '3.3.3.3',
        timestamp: new Date(),
      // eslint-disable-next-line @typescript-eslint/require-await -- async callback required by withAuditContext API for context propagation
      }, async () => {
        // Context should exist inside handler
        expect(auditContextStorage.getStore()).toBeDefined();
      });

      // Context should be cleared after handler
      const contextAfterHandler = auditContextStorage.getStore();
      expect(contextAfterHandler).toBeUndefined();
    });
  });
});

// Helper function for wrapping handlers with context
function withAuditContextWrapper<T>(
  context: AuditContext,
  handler: () => Promise<T>,
): () => Promise<T> {
  return () => withAuditContext(context, handler);
}
