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
 * Validation result for routing ambiguity detection
 */
export interface RoutingValidationResult {
  isAmbiguous: boolean;
  matchedHandlers: string[];
  suggestion: string | undefined;
}

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
   * @throws Error if handler cannot be determined or is ambiguous
   */
  route(args: FacadeArgs): OperationHandler {
    // Explicit routing via tool_name parameter (primary path)
    if (args.tool_name && this.handlers.has(args.tool_name)) {
      return this.handlers.get(args.tool_name)!;
    }

    // Validate for ambiguity before inferring
    const validation = this.validateRouting(args);
    if (validation.isAmbiguous) {
      throw new Error(
        `Ambiguous operation: description matches multiple handlers [${validation.matchedHandlers.join(', ')}]. ` +
        'Use tool_name for explicit routing.',
      );
    }

    // Inferred routing from operation description (fallback)
    return this.inferFromDescription(args.operation_description);
  }

  /**
   * Validate routing to detect ambiguous operations
   *
   * @param args - Facade arguments to validate
   * @returns Validation result with ambiguity detection
   */
  validateRouting(args: FacadeArgs): RoutingValidationResult {
    // Skip validation if explicit tool_name provided
    if (args.tool_name && this.handlers.has(args.tool_name)) {
      return {
        isAmbiguous: false,
        matchedHandlers: [args.tool_name],
        suggestion: undefined,
      };
    }

    const matchedHandlers = this.detectMatchingHandlers(args.operation_description);

    return {
      isAmbiguous: matchedHandlers.length > 1,
      matchedHandlers,
      suggestion: matchedHandlers.length > 1
        ? 'Use tool_name parameter for explicit routing'
        : undefined,
    };
  }

  /**
   * Detect which handlers match the operation description
   *
   * @param description - Natural language operation description
   * @returns Array of handler names that match
   */
  private detectMatchingHandlers(description: string): string[] {
    const lower = description.toLowerCase();
    const matches: string[] = [];

    // Define keywords for each handler
    const handlerKeywords = {
      // Check discover first as it's most specific
      discover: ['discover', 'mapping', 'translate', 'lookup'],
      // Record operations - CRUD operations on individual records
      record: ['create', 'update', 'delete', 'modify', 'add', 'remove', 'record'],
      // Schema operations
      schema: ['schema', 'structure', 'column'],
      // Query operations - searching/listing multiple records
      query: ['list', 'search', 'find', 'records', 'get', 'count', 'filter'],
    };

    // Special case: 'field' only counts for schema if not preceded by 'discover'
    if (lower.includes('field') && !lower.includes('discover')) {
      if (lower.includes('table') || lower.includes('schema')) {
        matches.push('schema');
      }
    }

    // Check each handler's keywords
    for (const [handler, keywords] of Object.entries(handlerKeywords)) {
      for (const keyword of keywords) {
        if (lower.includes(keyword)) {
          if (!matches.includes(handler)) {
            matches.push(handler);
          }
          break; // Found a match for this handler, no need to check more keywords
        }
      }
    }

    return matches;
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
    const matches = this.detectMatchingHandlers(description);

    if (matches.length === 0) {
      throw new Error(`Cannot determine handler from description: "${description}"`);
    }

    if (matches.length > 1) {
      // This should have been caught by validateRouting, but double-check
      throw new Error(
        `Ambiguous operation: description matches multiple handlers [${matches.join(', ')}]`,
      );
    }

    const handler = this.handlers.get(matches[0]);
    if (!handler) {
      throw new Error(`Handler not found for type: ${matches[0]}`);
    }
    return handler;
  }
}
