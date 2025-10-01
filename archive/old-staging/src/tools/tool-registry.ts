// Critical-Engineer: consulted for Architecture pattern selection (Tool Registry)
// Type-safe tool registry pattern to fix validation integration issues
// Context7: consulted for zod
import { z, ZodType } from 'zod';

import { validateMcpToolInput } from '../validation/input-validator.js';

import type { ToolContext } from './types.js';

// Type-safe tool contract interface
export interface Tool<T extends ZodType = ZodType> {
  name: string;
  description: string;
  schema: T;
  execute: (context: ToolContext, args: z.infer<T>) => Promise<unknown>;
}

// Registry implementation with full type safety and security hardening
export class ToolRegistry {
  private tools = new Map<string, Tool<any>>();

  /**
   * Register a tool with its schema and handler
   * Implements security checks to prevent prototype pollution and duplicate registration
   */
  register<T extends ZodType>(tool: Tool<T>): void {
    // Security check: Prevent prototype pollution attacks
    if (typeof tool.name !== 'string' || tool.name.includes('__proto__') || tool.name.includes('constructor')) {
      throw new Error(`Invalid tool name: ${tool.name}. Tool names cannot contain prototype pollution vectors.`);
    }

    // Duplicate registration check: Fail-fast to prevent silent overwrites
    if (this.tools.has(tool.name)) {
      throw new Error(`Tool '${tool.name}' is already registered. Duplicate registration is not allowed.`);
    }

    // Validate tool structure before registration
    if (!tool.schema || !tool.execute || !tool.description) {
      throw new Error(`Tool '${tool.name}' is missing required properties (schema, execute, or description).`);
    }

    this.tools.set(tool.name, tool);
  }

  /**
   * Execute a tool with type-safe validation, preserved error structure, and observability
   */
  async execute(toolName: string, context: ToolContext, rawArgs: unknown): Promise<unknown> {
    const tool = this.tools.get(toolName);
    if (!tool) {
      throw new Error(`Unknown tool: ${toolName}`);
    }

    // Use existing validation infrastructure to preserve McpValidationError structure
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    const validatedArgs = validateMcpToolInput(toolName, tool.schema, rawArgs);

    // Observability wrapper for production monitoring
    const startTime = Date.now();
    try {
      // Type-safe execution with validated arguments
      const result = await tool.execute(context, validatedArgs);

      // Success metrics and logging
      const duration = Date.now() - startTime;
      this.logToolExecution(toolName, duration, 'success');

      return result;
    } catch (error) {
      // Error metrics and logging
      const duration = Date.now() - startTime;
      this.logToolExecution(toolName, duration, 'failure', error);

      // Re-throw to preserve error handling behavior
      throw error;
    }
  }

  /**
   * Log tool execution for observability (can be extended with metrics)
   */
  private logToolExecution(toolName: string, duration: number, status: 'success' | 'failure', error?: unknown): void {
    // TODO: Replace with proper metrics/observability system (Prometheus, DataDog, etc.)
    // For now, structured logging provides operational insight
    const logData: Record<string, unknown> = {
      tool: toolName,
      duration_ms: duration,
      status,
      timestamp: new Date().toISOString(),
    };

    if (error) {
      logData.error = error instanceof Error ? error.message : String(error);
    }

    // Use console for now (can be replaced with proper logger)
    if (status === 'failure') {
      console.error('Tool execution failed:', logData);
    } else {
      console.log('Tool execution completed:', logData);
    }
  }

  /**
   * Get validation schema for a tool (for backward compatibility)
   */
  getValidationSchema(toolName: string): ZodType | null {
    const tool = this.tools.get(toolName);
    return tool?.schema || null;
  }

  /**
   * Check if a tool is registered
   */
  hasTool(toolName: string): boolean {
    return this.tools.has(toolName);
  }

  /**
   * Get all registered tool names
   */
  getToolNames(): string[] {
    return Array.from(this.tools.keys());
  }

  /**
   * Clear all registered tools (for development hot-reload scenarios)
   */
  clear(): void {
    this.tools.clear();
  }

  /**
   * Get tool information for MCP protocol
   */
  getToolInfo(toolName: string): { name: string; description: string; schema: any } | null {
    const tool = this.tools.get(toolName);
    if (!tool) return null;

    return {
      name: tool.name,
      description: tool.description,
      schema: tool.schema,
    };
  }
}

// Default registry instance
export const defaultToolRegistry = new ToolRegistry();
