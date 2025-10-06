// Phoenix Implementation: Phase 2G - Knowledge Base
// Purpose: Load and manage SmartSuite API safety patterns
// Architecture: Dependency injection pattern for testability
// Critical-Engineer Analysis: 002-PHASE-2G-INTELLIGENT-TOOL-ANALYSIS.md

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

/**
 * Safety level classification
 * RED: Critical issues that cause data loss or corruption
 * YELLOW: Warnings for performance or best practice violations
 * GREEN: Safe operations with no known issues
 */
export type SafetyLevel = 'RED' | 'YELLOW' | 'GREEN';

/**
 * Failure mode description with prevention guidance
 */
export interface FailureMode {
  description: string;
  prevention: string;
  impact: string;
}

/**
 * Validation rule for operation constraints
 */
export interface ValidationRule {
  limit?: number;
  format?: string;
  required?: string[];
}

/**
 * Correction suggestion for detected issues
 */
export interface Correction {
  method?: string;
  endpoint?: string;
  format?: string;
  parameter?: string;
}

/**
 * Knowledge pattern structure (Legacy interface for backward compatibility)
 */
export interface KnowledgePattern {
  pattern: string;
  safetyLevel: SafetyLevel;
  failureModes: FailureMode[];
  validationRules?: ValidationRule[];
  correction?: Correction;
}

/**
 * Rich knowledge pattern structure (loaded from JSON files)
 * Internal-only interface that matches the new JSON schema
 */
export interface RichKnowledgePattern {
  pattern_id: string;
  schema_version: string;
  pattern: string;
  name: string;
  safetyLevel: SafetyLevel;
  severity: string;
  category: string;
  triggers?: Array<{
    condition: string;
    endpoint_match?: string;
    parameter_check?: unknown;
  }>;
  failureModes: FailureMode[];
  validationRules?: Array<{
    rule_type?: string;
    condition?: string;
    action?: string;
    message?: string;
    limit?: number;
    format?: string;
    required?: string[];
  }>;
  correction?: {
    description?: string;
    workflow?: string[];
    example?: unknown;
    requirements?: string[];
    method?: string;
    endpoint?: string;
    format?: string;
    parameter?: string;
  };
  evidence?: {
    incident_date?: string;
    production_validated?: boolean;
    source?: string;
  };
  metadata?: {
    last_verified?: string;
    production_incidents?: number;
    recovery_required?: boolean;
  };
}

/**
 * Manifest structure from manifest.json (NEW format - v2.0.0)
 * Critical-Engineer: consulted for Architecture pattern selection
 */
export interface Manifest {
  version: string;
  api_compatibility: string;
  last_updated: string;
  structure_version: string;
  description: string;
  pattern_index: {
    red: Array<{
      id: string;
      pattern: string;
      name: string;
      file: string;
      safetyLevel: string;
    }>;
    yellow: Array<{
      id: string;
      pattern: string;
      name: string;
      file: string;
      safetyLevel: string;
    }>;
    green: Array<{
      id: string;
      pattern: string;
      name: string;
      file: string;
      safetyLevel: string;
    }>;
  };
  validation_rules: unknown[];
  loading: {
    strategy: string;
    target_time: string;
    mcp_server_startup: boolean;
  };
  pattern_matching: {
    severity_priority: string[];
    citation_format: string;
    interface_compliance: string;
  };
  interface_requirements: {
    required_fields: string[];
    optional_fields: string[];
    safetyLevel_values: string[];
    pattern_naming: string;
  };
}

/**
 * Operation structure for pattern matching
 */
export interface Operation {
  endpoint: string;
  method: string;
  payload?: Record<string, unknown>;
  fieldTypes?: Record<string, string>;
  operation_description?: string;
}

/**
 * KnowledgeBase class
 * Loads SmartSuite API safety patterns and provides pattern matching
 * Critical-Engineer: consulted for Architecture pattern selection
 */
export class KnowledgeBase {
  private patterns: KnowledgePattern[]; // Legacy interface (exposed)
  private richPatterns: RichKnowledgePattern[]; // Rich JSON structure (internal)
  private manifest: Manifest;

  /**
   * Constructor with dependency injection
   * @param patterns Pre-loaded patterns for testing (legacy interface)
   * @param manifest Optional manifest for testing
   * @param richPatterns Optional rich patterns for testing (internal)
   */
  constructor(patterns: KnowledgePattern[], manifest?: Manifest, richPatterns?: RichKnowledgePattern[]) {
    this.patterns = patterns;
    this.richPatterns = richPatterns ?? [];
    this.manifest = manifest ?? this.createDefaultManifest();
  }

  /**
   * Static factory method to load knowledge base from files
   * @param basePath Optional base path for knowledge files (for testing)
   * @returns KnowledgeBase instance
   * Critical-Engineer: consulted for Architecture pattern selection
   */
  static loadFromFiles(basePath?: string): KnowledgeBase {
    // Default to config/knowledge directory (relative to project root)
    const knowledgePath = basePath ?? join(process.cwd(), 'config/knowledge');
    const manifestPath = join(knowledgePath, 'manifest.json');

    // Validate manifest exists
    if (!existsSync(manifestPath)) {
      throw new Error(`manifest.json not found at ${manifestPath}`);
    }

    // Load and parse manifest
    const manifestContent = readFileSync(manifestPath, 'utf-8');
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- JSON.parse returns any; validated immediately below
    const manifest: Manifest = JSON.parse(manifestContent);

    // Validate new manifest structure
    if (!manifest.version || !manifest.pattern_index || !manifest.last_updated) {
      throw new Error('Invalid manifest structure: missing required fields (version, pattern_index, last_updated)');
    }

    // Load rich patterns from JSON files
    const richPatterns = KnowledgeBase.loadRichPatternsFromManifest(manifest, knowledgePath);

    // Map rich patterns to legacy interface for backward compatibility
    const legacyPatterns = richPatterns.map(KnowledgeBase.mapRichToLegacy);

    return new KnowledgeBase(legacyPatterns, manifest, richPatterns);
  }

  /**
   * Load rich patterns from individual JSON files referenced in manifest
   * @param manifest Loaded manifest with pattern_index
   * @param basePath Base path for knowledge directory
   * @returns Array of rich patterns
   */
  private static loadRichPatternsFromManifest(manifest: Manifest, basePath: string): RichKnowledgePattern[] {
    const richPatterns: RichKnowledgePattern[] = [];

    // Load RED patterns
    for (const entry of manifest.pattern_index.red) {
      const patternPath = join(basePath, entry.file);
      if (existsSync(patternPath)) {
        const patternContent = readFileSync(patternPath, 'utf-8');
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- JSON.parse returns any; validated below
        const pattern: RichKnowledgePattern = JSON.parse(patternContent);

        // Basic validation
        if (!pattern.pattern || !pattern.safetyLevel || !pattern.failureModes) {
          // eslint-disable-next-line no-console -- Operational diagnostic: pattern validation during knowledge base loading
          console.warn(`Skipping malformed pattern at ${patternPath}: missing required fields`);
          continue;
        }

        richPatterns.push(pattern);
      } else {
        // eslint-disable-next-line no-console -- Operational diagnostic: pattern file discovery during knowledge base loading
        console.warn(`Pattern file not found: ${patternPath}`);
      }
    }

    // Load YELLOW patterns
    for (const entry of manifest.pattern_index.yellow) {
      const patternPath = join(basePath, entry.file);
      if (existsSync(patternPath)) {
        const patternContent = readFileSync(patternPath, 'utf-8');
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const pattern: RichKnowledgePattern = JSON.parse(patternContent);

        if (!pattern.pattern || !pattern.safetyLevel || !pattern.failureModes) {
          // eslint-disable-next-line no-console -- Operational diagnostic: pattern validation during knowledge base loading
          console.warn(`Skipping malformed pattern at ${patternPath}: missing required fields`);
          continue;
        }

        richPatterns.push(pattern);
      }
    }

    // Load GREEN patterns
    for (const entry of manifest.pattern_index.green) {
      const patternPath = join(basePath, entry.file);
      if (existsSync(patternPath)) {
        const patternContent = readFileSync(patternPath, 'utf-8');
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const pattern: RichKnowledgePattern = JSON.parse(patternContent);

        if (!pattern.pattern || !pattern.safetyLevel || !pattern.failureModes) {
          // eslint-disable-next-line no-console -- Operational diagnostic: pattern validation during knowledge base loading
          console.warn(`Skipping malformed pattern at ${patternPath}: missing required fields`);
          continue;
        }

        richPatterns.push(pattern);
      }
    }

    return richPatterns;
  }

  /**
   * Map rich pattern to legacy interface (adapter for backward compatibility)
   * @param richPattern Rich knowledge pattern from JSON
   * @returns Legacy knowledge pattern
   */
  private static mapRichToLegacy(richPattern: RichKnowledgePattern): KnowledgePattern {
    // Build result with proper exactOptionalPropertyTypes compliance
    const result: KnowledgePattern = {
      pattern: richPattern.pattern,
      safetyLevel: richPattern.safetyLevel,
      failureModes: richPattern.failureModes,
    };

    // Map validation rules (lossily - take first rule's properties if multiple exist)
    if (richPattern.validationRules && richPattern.validationRules.length > 0) {
      const mappedRules: ValidationRule[] = [];
      for (const rule of richPattern.validationRules) {
        const mappedRule: ValidationRule = {};
        if (rule.limit !== undefined) mappedRule.limit = rule.limit;
        if (rule.format !== undefined) mappedRule.format = rule.format;
        if (rule.required !== undefined) mappedRule.required = rule.required;
        mappedRules.push(mappedRule);
      }
      result.validationRules = mappedRules;
    }

    // Map correction (lossily - use basic fields, ignore workflow/requirements)
    if (richPattern.correction) {
      const mappedCorrection: Correction = {};
      if (richPattern.correction.method !== undefined) mappedCorrection.method = richPattern.correction.method;
      if (richPattern.correction.endpoint !== undefined) mappedCorrection.endpoint = richPattern.correction.endpoint;
      if (richPattern.correction.format !== undefined) mappedCorrection.format = richPattern.correction.format;
      if (richPattern.correction.parameter !== undefined) mappedCorrection.parameter = richPattern.correction.parameter;
      result.correction = mappedCorrection;
    }

    return result;
  }


  /**
   * Create default manifest for testing (new structure)
   */
  private createDefaultManifest(): Manifest {
    const lastUpdated = new Date().toISOString().split('T')[0];
    if (!lastUpdated) {
      throw new Error('Failed to generate last_updated date');
    }
    return {
      version: '2.0.0',
      api_compatibility: 'v1',
      last_updated: lastUpdated,
      structure_version: 'machine_optimized_v2',
      description: 'Default manifest',
      pattern_index: {
        red: [],
        yellow: [],
        green: [],
      },
      validation_rules: [],
      loading: {
        strategy: 'eager',
        target_time: '<100ms',
        mcp_server_startup: true,
      },
      pattern_matching: {
        severity_priority: ['red', 'yellow', 'green'],
        citation_format: 'pattern_id + pattern_name',
        interface_compliance: 'IntelligentHandler KnowledgePattern interface',
      },
      interface_requirements: {
        required_fields: ['pattern', 'safetyLevel', 'failureModes'],
        optional_fields: ['validationRules', 'correction'],
        safetyLevel_values: ['RED', 'YELLOW', 'GREEN'],
        pattern_naming: 'UPPERCASE_WITH_UNDERSCORES',
      },
    };
  }

  /**
   * Get knowledge base version
   */
  getVersion(): string {
    return this.manifest.version;
  }

  /**
   * Get full manifest
   */
  getManifest(): Manifest {
    return this.manifest;
  }

  /**
   * Get number of loaded patterns
   */
  getPatternCount(): number {
    return this.patterns.length;
  }

  /**
   * Check if a specific pattern exists
   */
  hasPattern(patternName: string): boolean {
    return this.patterns.some(p => p.pattern === patternName);
  }

  /**
   * Get pattern by name
   */
  getPattern(patternName: string): KnowledgePattern | undefined {
    return this.patterns.find(p => p.pattern === patternName);
  }

  /**
   * List all available pattern names
   */
  listPatterns(): string[] {
    return this.patterns.map(p => p.pattern);
  }

  /**
   * Alias for listPatterns (test compatibility)
   */
  getPatternNames(): string[] {
    return this.listPatterns();
  }

  /**
   * Get pattern statistics
   */
  getStatistics(): { total: number; red: number; yellow: number; green: number } {
    return {
      total: this.patterns.length,
      red: this.patterns.filter(p => p.safetyLevel === 'RED').length,
      yellow: this.patterns.filter(p => p.safetyLevel === 'YELLOW').length,
      green: this.patterns.filter(p => p.safetyLevel === 'GREEN').length,
    };
  }

  /**
   * Alias for getStatistics (test compatibility)
   */
  getStats(): { total: number; red: number; yellow: number; green: number } {
    return this.getStatistics();
  }

  /**
   * Match operation against known patterns using trigger-based evaluation
   * Returns array of matching patterns with safety information
   * MINIMAL_INTERVENTION: Generic trigger interpreter replaces hardcoded logic
   */
  match(operation: Operation): KnowledgePattern[] {
    const matches: KnowledgePattern[] = [];

    // Iterate over rich patterns and evaluate triggers
    for (const richPattern of this.richPatterns) {
      if (this.matchesPattern(richPattern, operation)) {
        // Map to legacy interface for backward compatibility
        matches.push(KnowledgeBase.mapRichToLegacy(richPattern));
      }
    }

    return matches;
  }

  /**
   * Check if operation matches a rich pattern using triggers
   * MINIMAL_INTERVENTION: Start with UUID_CORRUPTION operators (endpoint_match, exists, not_exists)
   */
  private matchesPattern(richPattern: RichKnowledgePattern, operation: Operation): boolean {
    // If no triggers defined, fall back to legacy matching (or skip)
    if (!richPattern.triggers || richPattern.triggers.length === 0) {
      // For patterns without triggers, use legacy hardcoded logic
      return this.matchesLegacyPattern(richPattern.pattern, operation);
    }

    // Evaluate all triggers (AND logic - all must match)
    for (const trigger of richPattern.triggers) {
      if (!this.evaluateTrigger(trigger, operation)) {
        return false; // Any trigger failure = no match
      }
    }

    return true; // All triggers matched
  }

  /**
   * Evaluate a single trigger against operation
   * Supports: endpoint_match, parameter_check (exists, not_exists, AND)
   */
  private evaluateTrigger(trigger: unknown, operation: Operation): boolean {
    // Type guard for trigger structure
    if (typeof trigger !== 'object' || trigger === null) {
      return false;
    }

    const triggerObj = trigger as Record<string, unknown>;

    // Check endpoint_match (string.includes)
    if ('endpoint_match' in triggerObj && typeof triggerObj.endpoint_match === 'string') {
      if (!operation.endpoint.includes(triggerObj.endpoint_match)) {
        return false; // Endpoint doesn't match
      }
    }

    // Check parameter_check (nested path evaluation)
    if ('parameter_check' in triggerObj && typeof triggerObj.parameter_check === 'object' && triggerObj.parameter_check !== null) {
      const paramCheck = triggerObj.parameter_check as Record<string, unknown>;

      // Evaluate primary condition
      if ('path' in paramCheck && 'operator' in paramCheck) {
        const path = paramCheck.path as string;
        const operator = paramCheck.operator as string;

        const value = this.resolvePath(operation, path);
        if (!this.checkCondition(value, operator)) {
          return false; // Primary condition failed
        }
      }

      // Evaluate AND condition (nested parameter_check)
      if ('AND' in paramCheck && typeof paramCheck.AND === 'object' && paramCheck.AND !== null) {
        const andCheck = paramCheck.AND as Record<string, unknown>;

        if ('path' in andCheck && 'operator' in andCheck) {
          const andPath = andCheck.path as string;
          const andOperator = andCheck.operator as string;

          const andValue = this.resolvePath(operation, andPath);
          if (!this.checkCondition(andValue, andOperator)) {
            return false; // AND condition failed
          }
        }
      }
    }

    return true; // All trigger checks passed
  }

  /**
   * Resolve nested path in object (e.g., "payload.params.options")
   * MINIMAL_INTERVENTION: Simple dot-notation path resolution
   */
  private resolvePath(obj: Operation | Record<string, unknown>, path: string): unknown {
    const parts = path.split('.');
    let current: unknown = obj;

    for (const part of parts) {
      if (typeof current !== 'object' || current === null) {
        return undefined;
      }
      current = (current as Record<string, unknown>)[part];
    }

    return current;
  }

  /**
   * Check condition based on operator
   * MINIMAL_INTERVENTION: Start with exists, not_exists
   */
  private checkCondition(value: unknown, operator: string): boolean {
    switch (operator) {
      case 'exists':
        return value !== undefined && value !== null;
      case 'not_exists':
        return value === undefined || value === null;
      default:
        // eslint-disable-next-line no-console -- Operational diagnostic: operator validation during pattern matching
        console.warn(`Unknown operator: ${operator}`);
        return false;
    }
  }

  /**
   * Legacy pattern matching for patterns without triggers
   * Preserves backward compatibility with hardcoded logic
   */
  private matchesLegacyPattern(patternName: string, operation: Operation): boolean {
    switch (patternName) {
      case 'BULK_OPERATION_LIMIT':
        return this.matchesBulkLimit(operation);
      case 'WRONG_HTTP_METHOD':
        return this.matchesWrongMethod(operation);
      case 'SMARTDOC_FORMAT':
        return this.matchesSmartDocFormat(operation);
      case 'FIELD_NAME_VS_ID':
        return this.matchesFieldNameVsId(operation);
      default:
        return false;
    }
  }

  /**
   * Check if operation matches bulk limit pattern
   */
  private matchesBulkLimit(operation: Operation): boolean {
    if (!operation.payload) return false;

    // Check for bulk arrays in various formats
    const bulkArrays = ['records', 'items', 'fields'];

    for (const arrayKey of bulkArrays) {
      if (arrayKey in operation.payload) {
        const value = operation.payload[arrayKey];
        if (Array.isArray(value) && value.length > 100) {
          return true;
        }
      }
    }

    return false;
  }

  /**
   * Check if operation matches wrong HTTP method pattern
   */
  private matchesWrongMethod(operation: Operation): boolean {
    // GET /records should be POST /records/list/
    if (operation.method === 'GET' && operation.endpoint.includes('/records') &&
        !operation.endpoint.includes('/records/') && !operation.endpoint.endsWith('/')) {
      return true;
    }

    // DELETE without trailing slash
    if (operation.method === 'DELETE' && operation.endpoint.includes('/records/') &&
        !operation.endpoint.endsWith('/')) {
      return true;
    }

    return false;
  }

  /**
   * Check if operation matches SmartDoc format pattern
   */
  private matchesSmartDocFormat(operation: Operation): boolean {
    if (!operation.payload || !operation.fieldTypes) return false;

    // Check if any rich text or checklist fields have plain string/array values
    for (const [fieldName, fieldType] of Object.entries(operation.fieldTypes)) {
      if ((fieldType === 'richtextareafield' || fieldType === 'checklistfield') && fieldName in operation.payload) {
        const value = operation.payload[fieldName];
        // Plain string, array, or missing SmartDoc structure
        if (typeof value === 'string' || Array.isArray(value) ||
            (typeof value === 'object' && value !== null && !('data' in value))) {
          return true;
        }
      }
    }

    return false;
  }

  /**
   * Check if operation matches field name vs ID pattern
   */
  private matchesFieldNameVsId(operation: Operation): boolean {
    if (!operation.payload) return false;

    // Check for field names with spaces or capitalization (display names)
    // SmartSuite field IDs are 10-char alphanumeric like "s1234abcde"
    return this.checkFieldNamesRecursive(operation.payload);
  }

  /**
   * Recursively check for field name issues in payload
   */
  private checkFieldNamesRecursive(obj: Record<string, unknown>): boolean {
    const keys = Object.keys(obj);

    for (const key of keys) {
      // Skip known safe keys (including field_type, params, slug, etc.)
      if (['filter', 'limit', 'offset', 'sort', 'records', 'items', 'fields',
           'field_type', 'params', 'slug', 'options', 'choices'].includes(key)) {
        // Check nested records/items arrays
        if ((key === 'records' || key === 'items') && Array.isArray(obj[key])) {
          const array = obj[key] as unknown[];
          for (const item of array) {
            if (typeof item === 'object' && item !== null) {
              if (this.checkFieldNamesRecursive(item as Record<string, unknown>)) {
                return true;
              }
            }
          }
        }
        continue;
      }

      // Detect display names (spaces, capitals not starting with s, or obvious display names)
      if (key.includes(' ') || /^[A-Z]/.test(key)) {
        return true;
      }

      // Check if it looks like a field ID (10-char alphanumeric starting with 's')
      // If it's NOT a field ID format and longer than 3 chars, likely a display name
      if (key.length > 3 && !/^s[a-z0-9]{9}$/.test(key) && !/^[a-z_]+$/.test(key)) {
        return true;
      }
    }

    return false;
  }
}
