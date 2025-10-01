// GREEN PHASE: Implementation to make tests pass
// Test-Methodology-Guardian: approved TDD RED-GREEN-REFACTOR cycle
// Technical-Architect: function module pattern for tool extraction

import type { AuditLogEntry } from '../audit/audit-logger.js';

import type { ToolContext } from './types.js';

/**
 * Response format for undo operations
 */
interface UndoResponse {
  success: boolean;
  originalOperation: string;
  undoOperation: string;
  tableId: string;
  recordId: string;
  message: string;
}

/**
 * Validate transaction ID format
 */
function validateTransactionId(transactionId: string): void {
  if (!transactionId) {
    throw new Error('Transaction ID is required');
  }

  if (transactionId === '') {
    throw new Error('Transaction ID is required');
  }

  // Check format: audit-{timestamp}-{randomHex}
  const transactionIdPattern = /^audit-\d{13}-[a-f0-9]{8}$/;
  if (!transactionIdPattern.test(transactionId)) {
    throw new Error('Invalid transaction ID format');
  }
}

/**
 * Check if transaction has expired (older than 30 days)
 */
function checkTransactionExpiry(entry: AuditLogEntry): void {
  const now = new Date();
  const transactionDate = entry.timestamp;
  const thirtyDaysAgo = new Date(now.getTime() - (30 * 24 * 60 * 60 * 1000));

  if (transactionDate < thirtyDaysAgo) {
    throw new Error(`Transaction ${entry.id} has expired (older than 30 days)`);
  }
}

/**
 * Validate reversal instructions
 */
function validateReversalInstructions(entry: AuditLogEntry): void {
  if (!entry.reversalInstructions) {
    throw new Error(`Transaction ${entry.id} has invalid reversal instructions`);
  }
}

/**
 * Execute undo operation based on reversal instructions
 */
async function executeUndoOperation(
  context: ToolContext,
  entry: AuditLogEntry,
): Promise<unknown> {
  const { client } = context;
  const { reversalInstructions } = entry;

  try {
    switch (reversalInstructions.operation) {
      case 'create':
        // Undo a delete by recreating the record
        return await client.createRecord(
          reversalInstructions.tableId,
          reversalInstructions.payload!,
        );

      case 'update':
        // Undo an update by restoring previous values
        return await client.updateRecord(
          reversalInstructions.tableId,
          reversalInstructions.recordId!,
          reversalInstructions.payload!,
        );

      case 'delete':
        // Undo a create by deleting the record
        return await client.deleteRecord(
          reversalInstructions.tableId,
          reversalInstructions.recordId!,
        );

      default: {
        const op = reversalInstructions.operation as string;
        throw new Error(`Unsupported undo operation: ${op}`);
      }
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to undo transaction: ${errorMessage}`);
  }
}

/**
 * Log the undo operation to audit trail
 */
async function logUndoOperation(
  context: ToolContext,
  entry: AuditLogEntry,
  result: unknown,
): Promise<void> {
  const { auditLogger } = context;
  const { reversalInstructions } = entry;

  await auditLogger.logMutation({
    operation: reversalInstructions.operation,
    tableId: reversalInstructions.tableId,
    recordId: reversalInstructions.recordId || entry.recordId,
    result: result as Record<string, unknown>,
    reversalInstructions: {
      operation: 'undo-undo' as any,  // Special non-executable operation type
      originalTransactionId: entry.id,
      message: 'This undo operation cannot be undone',
    } as any,
  });
}

/**
 * Generate response message based on operation type
 */
function generateResponseMessage(entry: AuditLogEntry): string {
  const { operation, recordId } = entry;

  switch (operation) {
    case 'create':
      return `Successfully undid create operation by deleting record ${recordId}`;
    case 'update':
      return `Successfully undid update operation by restoring previous values for record ${recordId}`;
    case 'delete':
      return `Successfully undid delete operation by recreating record ${recordId}`;
    default: {
      const op = operation as string;
      return `Successfully undid ${op} operation for record ${recordId}`;
    }
  }
}

/**
 * Handle undo operations for SmartSuite records
 * Reverses a previous operation using audit trail transaction history
 */
export async function handleUndo(
  context: ToolContext,
  args: Record<string, unknown>,
): Promise<UndoResponse> {
  const { auditLogger } = context;
  const transactionId = args.transaction_id as string;

  // Validate transaction ID format
  validateTransactionId(transactionId);

  let entries: AuditLogEntry[];

  // Retrieve audit entries
  try {
    entries = await auditLogger.getEntries();
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to retrieve audit entries: ${errorMessage}`);
  }

  // Find the transaction by ID
  const entry = entries.find(e => e.id === transactionId);
  if (!entry) {
    throw new Error(`Transaction ${transactionId} not found`);
  }

  // Check transaction expiry
  checkTransactionExpiry(entry);

  // Validate reversal instructions
  validateReversalInstructions(entry);

  // Execute the undo operation
  const result = await executeUndoOperation(context, entry);

  // Log the undo operation itself to audit trail
  await logUndoOperation(context, entry, result);

  // Return structured response
  return {
    success: true,
    originalOperation: entry.operation,
    undoOperation: entry.reversalInstructions.operation,
    tableId: entry.tableId,
    recordId: entry.recordId,
    message: generateResponseMessage(entry),
  };
}
