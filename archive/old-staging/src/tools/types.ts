// Critical-Engineer: consulted for MCP tool handler refactoring
// Technical-Architect: synthesized third-way solution using function modules
// Test-Methodology-Guardian: approved TDD RED-GREEN-REFACTOR cycle

// External imports
// Context7: consulted for @supabase/supabase-js
import type { SupabaseClient } from '@supabase/supabase-js';

// Internal imports - ordered alphabetically
import type { AuditLogger } from '../audit/audit-logger.js';
import type { IEventStore } from '../knowledge-platform/events/event-store.js';
import type { FieldTranslator } from '../lib/field-translator.js';
import type { TableResolver } from '../lib/table-resolver.js';
import type { SmartSuiteClient } from '../smartsuite-client.js';

/**
 * Minimal context object passed to tool functions
 * Each tool receives exactly what it needs, no God Object pattern
 */
export interface ToolContext {
  client: SmartSuiteClient;
  fieldTranslator: FieldTranslator;
  tableResolver: TableResolver;
  auditLogger: AuditLogger;
  eventStore?: IEventStore; // Optional for Knowledge Platform tools
  supabaseClient?: SupabaseClient; // Optional for Knowledge Platform tools
}
