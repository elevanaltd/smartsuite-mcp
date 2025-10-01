// Auth context propagation for audit logging
// Using AsyncLocalStorage to maintain context across async operations
// Strategic Plan Week 1, Day 1-2: Auth Context Implementation

// Context7: consulted for node:async_hooks - AsyncLocalStorage for context propagation
import { AsyncLocalStorage } from 'node:async_hooks';

/**
 * AuditContext interface containing authentication and request metadata
 * This context will be automatically included in all audit log entries
 */
export interface AuditContext {
  userId: string;
  sessionId: string;
  requestId: string;
  ipAddress: string;
  timestamp: Date;
}

/**
 * AsyncLocalStorage instance for maintaining audit context
 * This ensures context isolation between concurrent requests
 */
export const auditContextStorage = new AsyncLocalStorage<AuditContext>();

/**
 * Execute a function with the provided audit context
 * The context will be available to all async operations within the callback
 *
 * @param context - The audit context to propagate
 * @param callback - The async function to execute with context
 * @returns The result of the callback function
 */
export async function withAuditContext<T>(
  context: AuditContext,
  callback: () => Promise<T>,
): Promise<T> {
  return auditContextStorage.run(context, callback);
}

/**
 * Get the current audit context from AsyncLocalStorage
 * Returns undefined if not running within a context
 */
export function getCurrentAuditContext(): AuditContext | undefined {
  return auditContextStorage.getStore();
}
