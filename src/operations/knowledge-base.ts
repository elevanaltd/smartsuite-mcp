// Phoenix Implementation: Phase 2G - Knowledge Base
// Purpose: Load and manage SmartSuite API safety patterns
// Architecture: Dependency injection pattern for testability
// Critical-Engineer Analysis: 002-PHASE-2G-INTELLIGENT-TOOL-ANALYSIS.md
// Critical-Engineer: consulted for Resource path resolution strategy

import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';

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
 * Knowledge pattern structure
 */
export interface KnowledgePattern {
  pattern: string;
  safetyLevel: SafetyLevel;
  failureModes: FailureMode[];
  validationRules?: ValidationRule[];
  correction?: Correction;
}

/**
 * Manifest structure from manifest.json
 */
export interface Manifest {
  version: string;
  api_compatibility: string;
  last_updated: string;
  checksum: string;
  patterns: string[];
  knowledge_files: string[];
  description: string;
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
 */
export class KnowledgeBase {
  private patterns: KnowledgePattern[];
  private manifest: Manifest;

  /**
   * Constructor with dependency injection
   * @param patterns Pre-loaded patterns for testing
   * @param manifest Optional manifest for testing
   */
  constructor(patterns: KnowledgePattern[], manifest?: Manifest) {
    this.patterns = patterns;
    this.manifest = manifest ?? this.createDefaultManifest();
  }

  /**
   * Static factory method to load knowledge base from files
   * Multi-layered configuration strategy:
   * 1. Explicit path (for tests)
   * 2. KNOWLEDGE_BASE_PATH environment variable (for production/staging)
   * 3. Project root discovery (for local development)
   *
   * @param basePath Optional base path for knowledge files (for testing)
   * @returns KnowledgeBase instance
   */
  static loadFromFiles(basePath?: string): KnowledgeBase {
    let knowledgePath: string | undefined;

    // 1. Prioritize explicit path (for tests)
    if (basePath) {
      knowledgePath = basePath;
    }
    // 2. Prioritize Environment Variable (for production/staging)
    else if (process.env.KNOWLEDGE_BASE_PATH) {
      knowledgePath = process.env.KNOWLEDGE_BASE_PATH;
    }
    // 3. Fallback to robust project root discovery (for local development)
    else {
      // Find project root with coordination directory
      // Start from CWD and search upward for coordination/smartsuite-truth
      let searchDir = process.cwd();

      while (true) {
        const candidatePath = join(searchDir, 'coordination/smartsuite-truth');
        if (existsSync(join(candidatePath, 'manifest.json'))) {
          knowledgePath = candidatePath;
          break;
        }

        // Try parent directory
        const parentDir = dirname(searchDir);
        if (parentDir === searchDir) {
          // Reached filesystem root without finding coordination directory
          throw new Error(
            'Could not find knowledge base (coordination/smartsuite-truth/manifest.json). ' +
            'Set KNOWLEDGE_BASE_PATH environment variable or ensure coordination directory exists.',
          );
        }
        searchDir = parentDir;
      }
    }

    if (!knowledgePath) {
      throw new Error('Knowledge base path could not be determined');
    }

    const manifestPath = join(knowledgePath, 'manifest.json');

    // Validate manifest exists with context-specific error message
    if (!existsSync(manifestPath)) {
      const source = basePath ? 'explicit path' :
                     process.env.KNOWLEDGE_BASE_PATH ? 'KNOWLEDGE_BASE_PATH environment variable' :
                     'discovered project root';
      throw new Error(
        `manifest.json not found at ${manifestPath} (from ${source}). ` +
        'Ensure knowledge base is properly configured.',
      );
    }

    // Load and parse manifest
    const manifestContent = readFileSync(manifestPath, 'utf-8');
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- JSON.parse returns any; validated immediately below
    const manifest: Manifest = JSON.parse(manifestContent);

    // Validate manifest structure
    if (!manifest.version || !manifest.patterns || !manifest.last_updated) {
      throw new Error('Invalid manifest structure: missing required fields');
    }

    // Build patterns from manifest
    const patterns = KnowledgeBase.buildPatternsFromManifest(manifest);

    return new KnowledgeBase(patterns, manifest);
  }

  /**
   * Build hardcoded patterns based on manifest pattern list
   * In production, this could load from files, but for simplicity we hardcode
   */
  private static buildPatternsFromManifest(manifest: Manifest): KnowledgePattern[] {
    const patterns: KnowledgePattern[] = [];

    if (manifest.patterns.includes('UUID_CORRUPTION')) {
      patterns.push({
        pattern: 'UUID_CORRUPTION',
        safetyLevel: 'RED',
        failureModes: [
          {
            description: 'Using "options" parameter will destroy all existing UUIDs',
            prevention: 'Use "choices" parameter with preserved UUIDs instead of "options"',
            impact: 'All existing record values become invalid, data relationships break',
          },
        ],
        correction: {
          parameter: 'choices',
        },
      });
    }

    if (manifest.patterns.includes('BULK_OPERATION_LIMIT')) {
      patterns.push({
        pattern: 'BULK_OPERATION_LIMIT',
        safetyLevel: 'YELLOW',
        failureModes: [
          {
            description: 'Bulk operation exceeds recommended limit',
            prevention: 'Split operations into batches of 100 or fewer records',
            impact: 'API timeouts, poor performance, potential partial failures',
          },
        ],
        validationRules: [
          {
            limit: 100,
          },
        ],
      });
    }

    if (manifest.patterns.includes('WRONG_HTTP_METHOD')) {
      patterns.push({
        pattern: 'WRONG_HTTP_METHOD',
        safetyLevel: 'RED',
        failureModes: [
          {
            description: 'Wrong HTTP method for endpoint',
            prevention: 'Use POST for /records/list/, DELETE with trailing slash for record deletion',
            impact: 'API request fails with 405 error',
          },
        ],
        correction: {
          method: 'POST',
          endpoint: '/records/list/',
        },
      });
    }

    if (manifest.patterns.includes('SMARTDOC_FORMAT')) {
      patterns.push({
        pattern: 'SMARTDOC_FORMAT',
        safetyLevel: 'RED',
        failureModes: [
          {
            description: 'Invalid SmartDoc format - plain string causes silent failure',
            prevention: 'Use full SmartDoc structure with data/html/preview components',
            impact: 'API returns 200 but field value not saved (silent failure)',
          },
        ],
        correction: {
          format: 'smartdoc',
        },
      });
    }

    if (manifest.patterns.includes('FIELD_NAME_VS_ID')) {
      patterns.push({
        pattern: 'FIELD_NAME_VS_ID',
        safetyLevel: 'YELLOW',
        failureModes: [
          {
            description: 'Using display names instead of field IDs',
            prevention: 'Use discover tool to get field mappings before operations',
            impact: 'Field not found errors, data sent to wrong fields',
          },
        ],
      });
    }

    return patterns;
  }

  /**
   * Create default manifest for testing
   */
  private createDefaultManifest(): Manifest {
    const lastUpdated = new Date().toISOString().split('T')[0];
    if (!lastUpdated) {
      throw new Error('Failed to generate last_updated date');
    }
    return {
      version: '1.0.0',
      api_compatibility: 'v1',
      last_updated: lastUpdated,
      checksum: 'sha256-default',
      patterns: [],
      knowledge_files: [],
      description: 'Default manifest',
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
   * Match operation against known patterns
   * Returns array of matching patterns with safety information
   */
  match(operation: Operation): KnowledgePattern[] {
    const matches: KnowledgePattern[] = [];

    // Check UUID corruption pattern
    if (this.hasPattern('UUID_CORRUPTION')) {
      if (this.matchesUuidCorruption(operation)) {
        const pattern = this.getPattern('UUID_CORRUPTION');
        if (pattern) matches.push(pattern);
      }
    }

    // Check bulk operation limit pattern
    if (this.hasPattern('BULK_OPERATION_LIMIT')) {
      if (this.matchesBulkLimit(operation)) {
        const pattern = this.getPattern('BULK_OPERATION_LIMIT');
        if (pattern) matches.push(pattern);
      }
    }

    // Check wrong HTTP method pattern
    if (this.hasPattern('WRONG_HTTP_METHOD')) {
      if (this.matchesWrongMethod(operation)) {
        const pattern = this.getPattern('WRONG_HTTP_METHOD');
        if (pattern) matches.push(pattern);
      }
    }

    // Check SmartDoc format pattern
    if (this.hasPattern('SMARTDOC_FORMAT')) {
      if (this.matchesSmartDocFormat(operation)) {
        const pattern = this.getPattern('SMARTDOC_FORMAT');
        if (pattern) matches.push(pattern);
      }
    }

    // Check field name vs ID pattern
    if (this.hasPattern('FIELD_NAME_VS_ID')) {
      if (this.matchesFieldNameVsId(operation)) {
        const pattern = this.getPattern('FIELD_NAME_VS_ID');
        if (pattern) matches.push(pattern);
      }
    }

    return matches;
  }

  /**
   * Check if operation matches UUID corruption pattern
   */
  private matchesUuidCorruption(operation: Operation): boolean {
    if (!operation.payload) return false;

    // Detect "options" parameter in select field operations
    return (
      operation.endpoint.includes('change_field') &&
      operation.method === 'PUT' &&
      'options' in operation.payload &&
      (operation.payload.field_type === 'singleselectfield' ||
       operation.payload.field_type === 'multipleselectfield')
    );
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
