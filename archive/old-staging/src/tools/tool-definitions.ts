// Critical-Engineer: consulted for Architecture pattern selection
// Type-safe tool definitions for all 9 MCP tools
// Context7: consulted for zod
import { z } from 'zod';

import { handleDiscover } from './discover.js';
import { handleIntelligent } from './intelligent.js';
import {
  handleKnowledgeEvents,
  handleKnowledgeFieldMappings,
  handleKnowledgeRefreshViews,
  type KnowledgeEventsArgs,
  type KnowledgeFieldMappingsArgs,
  type KnowledgeRefreshViewsArgs,
} from './knowledge.js';
import { handleQuery } from './query.js';
import { handleRecord } from './record.js';
import { handleSchema } from './schema.js';
import { defaultToolRegistry, type Tool } from './tool-registry.js';
import type { ToolContext } from './types.js';
import { handleUndo } from './undo.js';

// Tool validation schemas (moved from mcp-server.ts)
const QueryToolSchema = z.object({
  // Allow any string for operation so business logic can provide custom error messages
  operation: z.string().min(1),
  appId: z.string().min(1),
  filters: z.record(z.unknown()).optional(),
  sort: z.record(z.unknown()).optional(),
  limit: z.number().optional(),
  offset: z.number().optional(),
  recordId: z.string().optional(),
});

const RecordToolSchema = z.object({
  // Allow any string for operation so business logic can provide custom error messages
  operation: z.string().min(1),
  appId: z.string().min(1),
  recordId: z.string().optional(),
  // Data can be object for single operations or array for bulk operations
  data: z.union([z.record(z.unknown()), z.array(z.unknown())]).optional(),
  // Make dry_run optional so business logic can enforce the requirement with custom message
  dry_run: z.boolean().optional(),
});

const SchemaToolSchema = z.object({
  appId: z.string().min(1),
  // Allow any string for output_mode so business logic can provide custom error messages
  output_mode: z.string().optional(),
});

const UndoToolSchema = z.object({
  // Allow any string (including empty) so business logic can provide custom error messages
  transaction_id: z.string().optional(),
});

const DiscoverToolSchema = z.object({
  scope: z.enum(['tables', 'fields']),
  tableId: z.string().optional(),
});

const IntelligentToolSchema = z.object({
  endpoint: z.string().min(1),
  method: z.enum(['GET', 'POST', 'PUT', 'DELETE', 'PATCH']),
  operation_description: z.string().min(1),
  payload: z.record(z.unknown()).optional(),
  tableId: z.string().optional(),
  mode: z.enum(['learn', 'dry_run', 'execute']).optional(),
  confirmed: z.boolean().optional(),
});

const KnowledgeEventsSchema = z.object({
  operation: z.enum(['append', 'get']),
  aggregateId: z.string().optional(),
  event: z.record(z.unknown()).optional(),
  limit: z.number().optional(),
});

const KnowledgeFieldMappingsSchema = z.object({
  tableId: z.string().min(1),
});

const KnowledgeRefreshViewsSchema = z.object({
  views: z.array(z.string()).optional(),
});

// Type-safe tool definitions
const QueryTool: Tool<typeof QueryToolSchema> = {
  name: 'smartsuite_query',
  description: 'Query SmartSuite records with filtering, sorting, and pagination',
  schema: QueryToolSchema,
  execute: async (context: ToolContext, args) => {
    // Args are fully typed from schema inference
    return handleQuery(context, args as Record<string, unknown>);
  },
};

const RecordTool: Tool<typeof RecordToolSchema> = {
  name: 'smartsuite_record',
  description: 'Create, update, or delete SmartSuite records with DRY-RUN safety',
  schema: RecordToolSchema,
  execute: async (context: ToolContext, args) => {
    return handleRecord(context, args as Record<string, unknown>);
  },
};

const SchemaTool: Tool<typeof SchemaToolSchema> = {
  name: 'smartsuite_schema',
  description: 'Get SmartSuite application schema and field definitions',
  schema: SchemaToolSchema,
  execute: async (context: ToolContext, args) => {
    return handleSchema(context, args as Record<string, unknown>);
  },
};

const UndoTool: Tool<typeof UndoToolSchema> = {
  name: 'smartsuite_undo',
  description: 'Undo a previous SmartSuite operation using transaction history',
  schema: UndoToolSchema,
  execute: async (context: ToolContext, args) => {
    return handleUndo(context, args as Record<string, unknown>);
  },
};

const DiscoverTool: Tool<typeof DiscoverToolSchema> = {
  name: 'smartsuite_discover',
  description: 'Discover available tables and their fields',
  schema: DiscoverToolSchema,
  execute: async (context: ToolContext, args) => {
    return handleDiscover(context, args as Record<string, unknown>);
  },
};

const IntelligentTool: Tool<typeof IntelligentToolSchema> = {
  name: 'smartsuite_intelligent',
  description: 'AI-guided access to any SmartSuite API with knowledge-driven safety',
  schema: IntelligentToolSchema,
  execute: async (context: ToolContext, args) => {
    return handleIntelligent(context, args as Record<string, unknown>);
  },
};

const KnowledgeEventsTool: Tool<typeof KnowledgeEventsSchema> = {
  name: 'smartsuite_knowledge_events',
  description: 'Knowledge Platform event operations (append/get events)',
  schema: KnowledgeEventsSchema,
  execute: async (context: ToolContext, args) => {
    return handleKnowledgeEvents(args as KnowledgeEventsArgs, context);
  },
};

const KnowledgeFieldMappingsTool: Tool<typeof KnowledgeFieldMappingsSchema> = {
  name: 'smartsuite_knowledge_field_mappings',
  description: 'Get field mappings from Knowledge Platform',
  schema: KnowledgeFieldMappingsSchema,
  execute: async (context: ToolContext, args) => {
    return handleKnowledgeFieldMappings(args as KnowledgeFieldMappingsArgs, context);
  },
};

const KnowledgeRefreshViewsTool: Tool<typeof KnowledgeRefreshViewsSchema> = {
  name: 'smartsuite_knowledge_refresh_views',
  description: 'Refresh Knowledge Platform materialized views',
  schema: KnowledgeRefreshViewsSchema,
  execute: async (context: ToolContext, args) => {
    return handleKnowledgeRefreshViews(args as KnowledgeRefreshViewsArgs, context);
  },
};

// Register all tools with the default registry (error-resistant implementation)
export function registerAllTools(): void {
  // Clear registry first to support development hot-reload scenarios
  defaultToolRegistry.clear();

  // Register tools individually to avoid TypeScript union type issues
  const failedRegistrations: Array<{ toolName: string; error: string }> = [];

  const toolsToRegister = [
    { tool: QueryTool, name: 'QueryTool' },
    { tool: RecordTool, name: 'RecordTool' },
    { tool: SchemaTool, name: 'SchemaTool' },
    { tool: UndoTool, name: 'UndoTool' },
    { tool: DiscoverTool, name: 'DiscoverTool' },
    { tool: IntelligentTool, name: 'IntelligentTool' },
    { tool: KnowledgeEventsTool, name: 'KnowledgeEventsTool' },
    { tool: KnowledgeFieldMappingsTool, name: 'KnowledgeFieldMappingsTool' },
    { tool: KnowledgeRefreshViewsTool, name: 'KnowledgeRefreshViewsTool' },
  ];

  for (const { tool, name } of toolsToRegister) {
    try {
      // Type assertion to work around TypeScript's strict union type checking
      defaultToolRegistry.register(tool as unknown as Tool);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      failedRegistrations.push({ toolName: tool.name, error: errorMessage });
      console.error(`Failed to register ${name} ('${tool.name}'):`, errorMessage);
    }
  }

  // Fail-fast if any tool registration failed
  if (failedRegistrations.length > 0) {
    const failedToolNames = failedRegistrations.map(f => f.toolName).join(', ');
    throw new Error(
      `Failed to register ${failedRegistrations.length} tool(s): ${failedToolNames}. ` +
      'Tool system is in an inconsistent state and cannot start safely.',
    );
  }

  const registeredToolNames = toolsToRegister.map(({ tool }) => tool.name);
  console.log(`Successfully registered ${toolsToRegister.length} tools: ${registeredToolNames.join(', ')}`);
}

// Export individual tools for testing
export {
  QueryTool,
  RecordTool,
  SchemaTool,
  UndoTool,
  DiscoverTool,
  IntelligentTool,
  KnowledgeEventsTool,
  KnowledgeFieldMappingsTool,
  KnowledgeRefreshViewsTool,
};

// Export schemas for backward compatibility
export {
  QueryToolSchema,
  RecordToolSchema,
  SchemaToolSchema,
  UndoToolSchema,
  DiscoverToolSchema,
  IntelligentToolSchema,
  KnowledgeEventsSchema,
  KnowledgeFieldMappingsSchema,
  KnowledgeRefreshViewsSchema,
};

// Re-export the default registry for external use
export { defaultToolRegistry } from './tool-registry.js';
