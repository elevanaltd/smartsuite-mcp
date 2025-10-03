import { describe, it, expect, beforeEach } from 'vitest';

import { DiscoverHandler } from '../../../src/operations/discover-handler.js';
import { OperationRouter } from '../../../src/operations/operation-router.js';
import { QueryHandler } from '../../../src/operations/query-handler.js';
import { RecordHandler } from '../../../src/operations/record-handler.js';
import { SchemaHandler } from '../../../src/operations/schema-handler.js';

describe('OperationRouter', () => {
  let router: OperationRouter;
  let queryHandler: QueryHandler;
  let recordHandler: RecordHandler;
  let schemaHandler: SchemaHandler;
  let discoverHandler: DiscoverHandler;

  beforeEach(() => {
    queryHandler = new QueryHandler();
    recordHandler = new RecordHandler();
    schemaHandler = new SchemaHandler();
    discoverHandler = new DiscoverHandler();

    router = new OperationRouter(
      queryHandler,
      recordHandler,
      schemaHandler,
      discoverHandler,
    );
  });

  describe('explicit routing via tool_name', () => {
    it('should route to QueryHandler when tool_name is "query"', () => {
      const handler = router.route({
        tool_name: 'query',
        operation_description: 'list records',
      });
      expect(handler).toBe(queryHandler);
    });

    it('should route to RecordHandler when tool_name is "record"', () => {
      const handler = router.route({
        tool_name: 'record',
        operation_description: 'create record',
      });
      expect(handler).toBe(recordHandler);
    });

    it('should route to SchemaHandler when tool_name is "schema"', () => {
      const handler = router.route({
        tool_name: 'schema',
        operation_description: 'get schema',
      });
      expect(handler).toBe(schemaHandler);
    });

    it('should route to DiscoverHandler when tool_name is "discover"', () => {
      const handler = router.route({
        tool_name: 'discover',
        operation_description: 'get field mappings',
      });
      expect(handler).toBe(discoverHandler);
    });
  });

  describe('inferred routing from operation_description', () => {
    it('should infer QueryHandler from "list records" description', () => {
      const handler = router.route({ operation_description: 'list all records in table' });
      expect(handler).toBe(queryHandler);
    });

    it('should infer RecordHandler from "create record" description', () => {
      const handler = router.route({ operation_description: 'create a new record' });
      expect(handler).toBe(recordHandler);
    });

    it('should infer SchemaHandler from "get schema" description', () => {
      const handler = router.route({ operation_description: 'retrieve table schema' });
      expect(handler).toBe(schemaHandler);
    });

    it('should infer DiscoverHandler from "discover fields" description', () => {
      const handler = router.route({ operation_description: 'discover field mappings' });
      expect(handler).toBe(discoverHandler);
    });

    it('should infer QueryHandler from "search" description', () => {
      const handler = router.route({ operation_description: 'search for records matching criteria' });
      expect(handler).toBe(queryHandler);
    });

    it('should infer RecordHandler from "update" description', () => {
      const handler = router.route({ operation_description: 'update existing record' });
      expect(handler).toBe(recordHandler);
    });

    it('should infer RecordHandler from "delete" description', () => {
      const handler = router.route({ operation_description: 'delete record from table' });
      expect(handler).toBe(recordHandler);
    });

    it('should infer SchemaHandler from "table structure" description', () => {
      const handler = router.route({ operation_description: 'get table structure and fields' });
      expect(handler).toBe(schemaHandler);
    });

    it('should infer DiscoverHandler from "field mapping" description', () => {
      const handler = router.route({ operation_description: 'translate field names to IDs' });
      expect(handler).toBe(discoverHandler);
    });

    it('should throw error for ambiguous description', () => {
      expect(() => {
        router.route({ operation_description: 'do something' });
      }).toThrow('Cannot determine handler');
    });
  });

  describe('explicit routing takes precedence over inference', () => {
    it('should use tool_name even when description suggests different handler', () => {
      const handler = router.route({
        tool_name: 'query',
        operation_description: 'create a new record',  // Suggests RecordHandler
      });
      expect(handler).toBe(queryHandler);  // But tool_name wins
    });
  });
});
