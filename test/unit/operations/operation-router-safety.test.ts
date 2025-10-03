import { describe, it, expect } from 'vitest';

import { DiscoverHandler } from '../../../src/operations/discover-handler.js';
import { OperationRouter } from '../../../src/operations/operation-router.js';
import { QueryHandler } from '../../../src/operations/query-handler.js';
import { RecordHandler } from '../../../src/operations/record-handler.js';
import { SchemaHandler } from '../../../src/operations/schema-handler.js';

/**
 * Production safety tests for OperationRouter
 * Critical-Engineer Finding #1: Keyword collision routing
 *
 * These tests verify that ambiguous operations are detected and blocked
 * to prevent wrong handlers from being executed in production.
 */
describe('OperationRouter - Production Safety', () => {
  let router: OperationRouter;

  beforeEach(() => {
    router = new OperationRouter(
      new QueryHandler(),
      new RecordHandler(),
      new SchemaHandler(),
      new DiscoverHandler(),
    );
  });

  describe('Ambiguous routing detection', () => {
    it('should throw error when description matches multiple handlers without explicit tool_name', () => {
      // "list records" could match both query (list) and record (records)
      expect(() =>
        router.route({
          operation_description: 'list records from table',
        }),
      ).toThrow(/Ambiguous operation.*matches multiple handlers/);
    });

    it('should throw error when description contains conflicting keywords', () => {
      // "create schema" has keywords from both record (create) and schema
      expect(() =>
        router.route({
          operation_description: 'create new schema structure',
        }),
      ).toThrow(/Ambiguous operation.*matches multiple handlers/);
    });

    it('should throw error when description has query and record keywords', () => {
      // Both "search" (query) and "update" (record) keywords
      expect(() =>
        router.route({
          operation_description: 'search and update matching records',
        }),
      ).toThrow(/Ambiguous operation.*matches multiple handlers/);
    });

    it('should NOT throw when explicit tool_name provided despite ambiguous description', () => {
      // Even with ambiguous description, explicit tool_name should work
      const handler = router.route({
        tool_name: 'query',
        operation_description: 'list records from table', // ambiguous
      });

      expect(handler).toBeInstanceOf(QueryHandler);
    });

    it('should provide helpful error message listing conflicting handlers', () => {
      try {
        router.route({
          operation_description: 'list records from table',
        });
      } catch (error: any) {
        expect(error.message).toContain('query');
        expect(error.message).toContain('record');
        expect(error.message).toContain('Use tool_name for explicit routing');
      }
    });
  });

  describe('Validation method', () => {
    it('should have validateRouting method that returns validation result', () => {
      const result = router.validateRouting({
        operation_description: 'list records',
      });

      expect(result).toHaveProperty('isAmbiguous', true);
      expect(result).toHaveProperty('matchedHandlers');
      expect(result.matchedHandlers).toContain('query');
      expect(result.matchedHandlers).toContain('record');
    });

    it('should return unambiguous result for clear descriptions', () => {
      const result = router.validateRouting({
        operation_description: 'discover field mappings',
      });

      expect(result.isAmbiguous).toBe(false);
      expect(result.matchedHandlers).toHaveLength(1);
      expect(result.matchedHandlers[0]).toBe('discover');
    });
  });
});
