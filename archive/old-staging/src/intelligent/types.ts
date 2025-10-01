export type SafetyLevel = 'GREEN' | 'YELLOW' | 'RED';
export type OperationMode = 'learn' | 'dry_run' | 'execute';
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';

export interface FailureMode {
  description: string;
  cause: string;
  prevention: string;
  recovery?: string;
  exampleError?: string;
  safeAlternative?: string;
}

export interface SafetyProtocol {
  pattern: RegExp;
  level: SafetyLevel;
  validation?: (payload: Record<string, unknown>) => void;
  template?: {
    correctPayload?: Record<string, unknown>;
    wrongPayload?: Record<string, unknown>;
  };
  prevention?: string;
}

export interface OperationExample {
  method: HttpMethod;
  endpoint: string;
  payload?: Record<string, unknown>;
  response?: Record<string, unknown> | { error: string } | { success: boolean } | { recordCount: number };
  timestamp: string;
}

export interface ValidationRule {
  type: string;
  limit?: number;
  pattern?: RegExp;
  message: string;
}

export interface OperationTemplate {
  name: string;
  method: HttpMethod;
  endpointPattern: string;
  payloadTemplate: Record<string, unknown>;
  description: string;
}

export interface OperationCorrection {
  method?: { from: string; to: string };
  endpoint?: { from: string; to: string };
  parameters?: { from: string; to: string };
}

export interface KnowledgeEntry {
  pattern: RegExp;
  safetyLevel: SafetyLevel;
  protocols?: SafetyProtocol[];
  examples?: OperationExample[];
  failureModes?: FailureMode[];
  validationRules?: ValidationRule[];
  templates?: OperationTemplate[];
  correction?: OperationCorrection;
}

export interface KnowledgeMatch {
  entry: KnowledgeEntry;
  confidence: number;
  matchReason: string;
  score?: number;
}

export interface Operation {
  method: HttpMethod;
  endpoint: string;
  payload?: Record<string, unknown>;
  timestamp: string;
}

export interface OperationOutcome {
  success: boolean;
  responseTime?: number;
  recordCount?: number;
  error?: string;
  suggestion?: string;
}

// Helper functions for creating type-safe OperationOutcomes
export const createSuccessOutcome = (options?: {
  responseTime?: number;
  recordCount?: number;
}): OperationOutcome => ({
  success: true,
  ...(options?.responseTime !== undefined && { responseTime: options.responseTime }),
  ...(options?.recordCount !== undefined && { recordCount: options.recordCount }),
});

export const createFailureOutcome = (error: string, suggestion?: string): OperationOutcome => ({
  success: false,
  error,
  ...(suggestion !== undefined && { suggestion }),
});

export interface IntelligentToolInput {
  mode: OperationMode;
  endpoint: string;
  method: HttpMethod;
  payload?: Record<string, unknown>;
  tableId?: string;
  operation_description: string;
  confirmed?: boolean;
}

export interface OperationAnalysis {
  endpoint: string;
  method: HttpMethod;
  safetyLevel?: SafetyLevel;
  requiresConfirmation?: boolean;
  warnings?: string[] | Warning[];
  recommendations?: string[];
  appliedCorrections?: string[];
  failureMode?: string;
  connectivityValid?: boolean;
  wouldExecute?: boolean;
}

export interface OperationResult {
  // Core execution properties
  success: boolean;
  mode: OperationMode;

  // For successful operations
  result?: unknown;
  analysis?: OperationAnalysis;

  // For error cases
  error?: string;

  // Original fields for compatibility
  status?: 'analyzed' | 'error';
  endpoint?: string;
  method?: HttpMethod;
  operation_description?: string;
  knowledge_applied?: boolean;
  safety_assessment?: SafetyAssessment;
  guidance?: string;
  suggested_correction?: IntelligentToolInput & { note?: string };
  warnings?: string[];
  knowledge_matches?: number;

  // Performance tracking
  performance_ms?: number;
  performanceMs?: number;
  knowledge_version?: string;
}

export interface SafetyAssessment {
  level: SafetyLevel;
  score?: number;
  protocols?: SafetyProtocol[];
  warnings: string[] | Warning[];
  blockers?: string[];
  recommendations?: string[];
  canProceed?: boolean;
  requiresConfirmation?: boolean;
}

export interface Warning {
  level: 'INFO' | 'WARNING' | 'CRITICAL';
  message: string;
  protocol?: string;
}

export interface KnowledgeVersion {
  version: string;
  patternCount: number;
  lastUpdated: string;
  compatibility: string;
}

export interface CacheEntry {
  key: string;
  value: KnowledgeMatch[];
  timestamp: number;
  hits: number;
}

export interface OperationContext {
  isListOperation: boolean;
  isBulkOperation: boolean;
  isFieldOperation: boolean;
  isDeleteOperation: boolean;
  hasPayload: boolean;
  recordCount: number;
}
