import { DiscoverHandler } from './discover-handler.js';
import { QueryHandler } from './query-handler.js';
import { RecordHandler } from './record-handler.js';
import { SchemaHandler } from './schema-handler.js';

/**
 * Facade arguments for intelligent routing
 * Blueprint Line 86-98: Operation Router specification
 */
export interface FacadeArgs {
  tool_name?: string | undefined;
  operation_description: string;
}

/**
 * Union type for all supported operation handlers
 */
export type OperationHandler = QueryHandler | RecordHandler | SchemaHandler | DiscoverHandler;

/**
 * Operation Router - Deterministic routing from facade to core handlers
 *
 * Routes operations to appropriate handlers based on:
 * 1. Explicit tool_name parameter (primary path)
 * 2. Inferred from operation_description (fallback)
 *
 * Design Principle (D3 Blueprint Lines 86-98):
 * - Explicit routing via tool_name takes precedence
 * - Inference provides flexibility for natural language descriptions
 * - Errors on ambiguous descriptions (fail fast, no guessing)
 */
export class OperationRouter {
  private handlers: Map<string, OperationHandler>;

  constructor(
    queryHandler: QueryHandler,
    recordHandler: RecordHandler,
    schemaHandler: SchemaHandler,
    discoverHandler: DiscoverHandler,
  ) {
    this.handlers = new Map<string, OperationHandler>([
      ['query', queryHandler as OperationHandler],
      ['record', recordHandler as OperationHandler],
      ['schema', schemaHandler as OperationHandler],
      ['discover', discoverHandler as OperationHandler],
    ]);
  }

  /**
   * Route facade arguments to appropriate operation handler
   *
   * @param args - Facade arguments containing tool_name and/or operation_description
   * @returns The appropriate handler for the operation
   * @throws Error if handler cannot be determined
   */
  route(args: FacadeArgs): OperationHandler {
    // Explicit routing via tool_name parameter (primary path)
    if (args.tool_name && this.handlers.has(args.tool_name)) {
      return this.handlers.get(args.tool_name)!;
    }

    // Inferred routing from operation description (fallback)
    return this.inferFromDescription(args.operation_description);
  }

  /**
   * Infer handler from operation description using keyword matching
   *
   * Query operations: list, search, find, records (plural)
   * Record operations: create, update, delete, modify
   * Schema operations: schema, structure, table + field
   * Discover operations: discover, mapping, translate
   *
   * @param description - Natural language operation description
   * @returns Inferred handler
   * @throws Error if description is ambiguous
   */
  private inferFromDescription(description: string): OperationHandler {
    const lower = description.toLowerCase();

    // Query operations: list, search, find, get (plural)
    if (lower.includes('list') || lower.includes('search') || lower.includes('find') || lower.includes('records')) {
      return this.handlers.get('query')!;
    }

    // Record operations: create, update, delete, modify
    if (lower.includes('create') || lower.includes('update') || lower.includes('delete') || lower.includes('modify')) {
      return this.handlers.get('record')!;
    }

    // Schema operations: schema, structure, table + field
    if (lower.includes('schema') || lower.includes('structure') || (lower.includes('table') && lower.includes('field'))) {
      return this.handlers.get('schema')!;
    }

    // Discover operations: discover, mapping, translate
    if (lower.includes('discover') || lower.includes('mapping') || lower.includes('translate')) {
      return this.handlers.get('discover')!;
    }

    throw new Error(`Cannot determine handler from description: "${description}"`);
  }
}
