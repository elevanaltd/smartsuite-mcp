// Critical-Engineer: consulted for complex handler extraction patterns
// Technical-Architect: approved IntelligentOperationHandler function module design
// Test-Methodology-Guardian: confirmed TDD approach for complex extractions

import { IntelligentOperationHandler, KnowledgeLibrary, SafetyEngine } from '../intelligent/index.js';
import type { IntelligentToolInput } from '../intelligent/types.js';
import { resolveKnowledgePath } from '../lib/path-resolver.js';
import type { SmartSuiteClient } from '../smartsuite-client.js';


import type { ToolContext } from './types.js';

// Cache the intelligent handler to avoid re-initialization
// This follows the lazy initialization pattern from the main server
let intelligentHandlerCache: IntelligentOperationHandler | null = null;

/**
 * Initialize the intelligent handler lazily
 * Creates KnowledgeLibrary, SafetyEngine, and IntelligentOperationHandler
 */
async function initializeIntelligentHandler(client: SmartSuiteClient | undefined): Promise<IntelligentOperationHandler> {
  if (!intelligentHandlerCache) {
    const knowledgeLibrary = new KnowledgeLibrary();
    // Use path resolver to handle both development and production environments
    // Development: loads from src/knowledge
    // Production: loads from build/src/knowledge (copied during build)
    const knowledgePath = resolveKnowledgePath(import.meta.url);
    await knowledgeLibrary.loadFromResearch(knowledgePath);
    const safetyEngine = new SafetyEngine(knowledgeLibrary);
    // Pass the SmartSuiteClient to enable execute and dry_run modes
    intelligentHandlerCache = new IntelligentOperationHandler(
      knowledgeLibrary,
      safetyEngine,
      client,  // Pass client for API proxy functionality
    );
  }
  return intelligentHandlerCache;
}

/**
 * Handle intelligent tool operations with knowledge-driven safety
 * Supports learn, dry_run, and execute modes for comprehensive API coverage
 */
export async function handleIntelligent(
  context: ToolContext,
  args: Record<string, unknown>,
): Promise<unknown> {
  const { client } = context;

  // Note: Intelligent operations handle their own audit logging internally

  // Validate required fields
  if (!args.endpoint) {
    throw new Error('endpoint is required');
  }
  if (!args.method) {
    throw new Error('method is required');
  }
  if (!args.operation_description) {
    throw new Error('operation_description is required');
  }

  // Initialize handler if needed
  const intelligentHandler = await initializeIntelligentHandler(client);

  // Validate and transform input
  const input: IntelligentToolInput = {
    mode: (args.mode as 'learn' | 'dry_run' | 'execute') ?? 'learn',
    endpoint: args.endpoint as string,
    method: args.method as 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH',
    operation_description: args.operation_description as string,
  };

  // Add optional fields only if they exist
  if (args.payload !== undefined) {
    input.payload = args.payload as Record<string, unknown>;
  }
  if (args.tableId !== undefined) {
    input.tableId = args.tableId as string;
  }
  if (args.confirmed !== undefined) {
    input.confirmed = args.confirmed as boolean;
  }

  // All modes supported: learn, dry_run, execute
  // Validate client is available for dry_run and execute modes
  if ((input.mode === 'dry_run' || input.mode === 'execute') && !client) {
    throw new Error(`Client not initialized. Cannot use ${input.mode} mode without authentication.`);
  }

  // Use the intelligent handler to process the operation
  const result = await intelligentHandler.handleIntelligentOperation(input);
  return result;
}
