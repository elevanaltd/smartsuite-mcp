// Phoenix Implementation: Phase 2G - Intelligent Handler
// Purpose: Analyze SmartSuite operations for safety issues and provide guidance
// Architecture: Uses KnowledgeBase for pattern matching with comprehensive safety checks
// Critical-Engineer Analysis: 002-PHASE-2G-INTELLIGENT-TOOL-ANALYSIS.md

import { KnowledgeBase, SafetyLevel, type Operation } from './knowledge-base.js';

/**
 * Suggested correction for detected issue
 */
export interface SuggestedCorrection {
  issue: string;
  fix: string;
  corrected_payload?: Record<string, unknown>;
  corrected_endpoint?: string;
  corrected_method?: string;
  batches?: unknown[][];
  recommendation?: string;
}

/**
 * Analysis result from intelligent handler
 */
export interface AnalysisResult {
  safety_level: SafetyLevel;
  warnings: string[];
  blockers: string[];
  guidance: string;
  suggested_corrections: SuggestedCorrection[];
  next_steps?: string[];
  metadata: {
    patterns_matched: string[];
    timestamp: string;
    table_id?: string;
  };
  table_context?: string;
}

/**
 * IntelligentHandler class
 * Analyzes operations for safety issues and provides guidance
 */
export class IntelligentHandler {
  private knowledgeBase: KnowledgeBase;
  private logger: ((data: unknown) => void) | null = null;

  /**
   * Constructor with dependency injection
   * @param knowledgeBase Optional knowledge base for testing
   */
  constructor(knowledgeBase?: KnowledgeBase) {
    this.knowledgeBase = knowledgeBase || KnowledgeBase.loadFromFiles();
  }

  /**
   * Get knowledge base instance
   */
  getKnowledgeBase(): KnowledgeBase {
    return this.knowledgeBase;
  }

  /**
   * Set custom logger for observability
   */
  setLogger(logger: (data: unknown) => void): void {
    this.logger = logger;
  }

  /**
   * Analyze operation for safety issues
   * @param operation Operation to analyze
   * @returns Analysis result with safety level and guidance
   */
  analyze(operation: Operation & { tableId?: string }): AnalysisResult {
    const warnings: string[] = [];
    const blockers: string[] = [];
    const suggestedCorrections: SuggestedCorrection[] = [];
    const patternsMatched: string[] = [];
    const nextSteps: string[] = [];

    // Match operation against knowledge base patterns
    const matches = this.knowledgeBase.match(operation);

    // Track highest safety level (RED > YELLOW > GREEN)
    let safetyLevel: SafetyLevel = 'GREEN';

    if (matches.length > 0) {
      // Process each matched pattern
      for (const match of matches) {
        patternsMatched.push(match.pattern);

        // Update safety level (RED overrides YELLOW, YELLOW overrides GREEN)
        if (match.safetyLevel === 'RED') {
          safetyLevel = 'RED';
        } else if (match.safetyLevel === 'YELLOW' && safetyLevel !== 'RED') {
          safetyLevel = 'YELLOW';
        }

        // Extract warnings and blockers from failure modes
        for (const failureMode of match.failureModes) {
          // Format warning with operation context
          let warningMessage = this.formatWarning(match.pattern, failureMode.description, operation);
          let blockerMessage = failureMode.description;

          // Special handling for bulk operations - include count in message
          if (match.pattern === 'BULK_OPERATION_LIMIT' && operation.payload) {
            const count = this.getBulkOperationCount(operation.payload);
            if (count > 100) {
              warningMessage = `${count} records exceeds recommended limit of 100`;
              blockerMessage = warningMessage;
            }
          }

          // Special handling for wrong HTTP method - include specific method/endpoint in blocker
          if (match.pattern === 'WRONG_HTTP_METHOD') {
            // Simplify endpoint for blocker message
            const simplifiedEndpoint = operation.endpoint.includes('/applications/') && operation.endpoint.includes('/records')
              ? '/records'
              : operation.endpoint;
            blockerMessage = `${operation.method} ${simplifiedEndpoint} returns 405 Method Not Allowed`;
          }

          // Special handling for SmartDoc format
          if (match.pattern === 'SMARTDOC_FORMAT') {
            blockerMessage = 'Rich text fields require SmartDoc structure';
          }

          if (match.safetyLevel === 'RED') {
            blockers.push(blockerMessage);
            warnings.push(warningMessage);
          } else {
            warnings.push(warningMessage);
          }

          // Generate corrections based on pattern
          const correction = this.generateCorrection(match.pattern, operation, match);
          if (correction) {
            suggestedCorrections.push(correction);
          }
        }
      }
    }

    // If no matches and it looks like a safe operation, keep GREEN
    // Otherwise default to YELLOW for unknown patterns
    if (matches.length === 0 && !this.looksLikeSafeOperation(operation)) {
      safetyLevel = 'YELLOW';
      warnings.push('No knowledge base match found');
      suggestedCorrections.push({
        issue: 'unknown operation pattern',
        fix: 'Review operation parameters and endpoint carefully before execution',
      });
    }

    // Generate next steps based on safety level
    if (safetyLevel === 'RED') {
      nextSteps.push('Review and correct critical issues before proceeding');
      nextSteps.push('Consult SmartSuite API documentation if needed');
    } else if (safetyLevel === 'YELLOW') {
      nextSteps.push('Use discover tool to verify field IDs and structure');
      nextSteps.push('Review suggested corrections before executing');
    } else {
      nextSteps.push('Verify operation parameters match expected format');
    }

    // Generate human-readable guidance
    const guidance = this.generateGuidance(safetyLevel, warnings, blockers, suggestedCorrections, matches);

    // Log for observability
    this.logAnalysis(operation, safetyLevel, patternsMatched, warnings, blockers);

    // Build result with properly typed metadata
    const result: AnalysisResult = {
      safety_level: safetyLevel,
      warnings,
      blockers,
      guidance,
      suggested_corrections: suggestedCorrections,
      next_steps: nextSteps,
      metadata: {
        patterns_matched: patternsMatched,
        timestamp: new Date().toISOString(),
        ...(operation.tableId ? { table_id: operation.tableId } : {}),
      },
    };

    // Add table_context if present
    if (operation.tableId) {
      result.table_context = operation.tableId;
    }

    return result;
  }

  /**
   * Get bulk operation count from payload
   */
  private getBulkOperationCount(payload: Record<string, unknown>): number {
    const bulkArrays = ['records', 'items', 'fields'];
    for (const key of bulkArrays) {
      if (key in payload && Array.isArray(payload[key])) {
        return (payload[key] as unknown[]).length;
      }
    }
    return 0;
  }

  /**
   * Check if operation looks safe (known safe patterns)
   */
  private looksLikeSafeOperation(operation: Operation): boolean {
    // Safe operations include standard list, get, schema operations
    const endpoint = operation.endpoint.toLowerCase();

    // POST /records/list/ is safe
    if (operation.method === 'POST' && endpoint.includes('/records/list/')) {
      return true;
    }

    // POST /records/bulk/ with reasonable payload is safe
    if (operation.method === 'POST' && endpoint.includes('/records/bulk/')) {
      return true;
    }

    // POST /records/ for create is safe
    if (operation.method === 'POST' && endpoint.includes('/records/')) {
      return true;
    }

    // GET /applications/{id}/ for schema is safe
    if (operation.method === 'GET' && endpoint.includes('/applications/') &&
        !endpoint.includes('/records')) {
      return true;
    }

    // Operations with proper field IDs (not display names) are safer
    if (operation.payload) {
      const keys = Object.keys(operation.payload);
      const hasFieldIds = keys.some(k => /^s[a-z0-9]{9}$/.test(k));
      if (hasFieldIds) return true;
    }

    return false;
  }

  /**
   * Format warning message with pattern context
   */
  private formatWarning(pattern: string, description: string, operation?: Operation): string {
    switch (pattern) {
      case 'UUID_CORRUPTION':
        return 'UUID corruption risk detected';

      case 'BULK_OPERATION_LIMIT':
        // Let caller handle this with specific count
        return description;

      case 'WRONG_HTTP_METHOD':
        // Check for specific DELETE case
        if (operation && operation.method === 'DELETE' && !operation.endpoint.endsWith('/')) {
          return `${operation.method} ${operation.endpoint} requires trailing slash`;
        }
        // Otherwise return generic warning
        return 'Wrong HTTP method for records endpoint';

      case 'SMARTDOC_FORMAT':
        // Check field type to determine if it's checklist or rich text
        if (operation && operation.fieldTypes) {
          const hasChecklist = Object.values(operation.fieldTypes).some(ft => ft === 'checklistfield');
          if (hasChecklist) {
            return 'Invalid format for checklist field';
          }
        }
        return 'Invalid format for rich text field';

      case 'FIELD_NAME_VS_ID':
        // Check if payload has mixed field names and IDs
        if (operation && operation.payload) {
          const keys = Object.keys(operation.payload);
          const hasDisplayNames = keys.some(k => k.includes(' ') || /^[A-Z]/.test(k));
          const hasFieldIds = keys.some(k => /^s[a-z0-9]{9}$/.test(k));
          if (hasDisplayNames && hasFieldIds) {
            return 'mixed usage of display names and field IDs detected';
          }
        }
        return 'Using display name instead of field ID';

      default:
        return description;
    }
  }

  /**
   * Generate correction suggestion based on pattern
   */
  private generateCorrection(
    pattern: string,
    operation: Operation,
    _match: any,
  ): SuggestedCorrection | null {
    switch (pattern) {
      case 'UUID_CORRUPTION':
        return this.correctUuidCorruption(operation);

      case 'BULK_OPERATION_LIMIT':
        return this.correctBulkLimit(operation);

      case 'WRONG_HTTP_METHOD':
        return this.correctHttpMethod(operation);

      case 'SMARTDOC_FORMAT':
        return this.correctSmartDocFormat(operation);

      case 'FIELD_NAME_VS_ID':
        return this.correctFieldNames(operation);

      default:
        return null;
    }
  }

  /**
   * Correct UUID corruption issue (options vs choices)
   */
  private correctUuidCorruption(operation: Operation): SuggestedCorrection {
    const correctedPayload = { ...operation.payload };

    if (correctedPayload.options && Array.isArray(correctedPayload.options)) {
      // Convert options array to choices array with preserved UUIDs
      const choices = (correctedPayload.options as string[]).map((label, index) => ({
        value: `existing_uuid_${index + 1}`,
        label,
        color: '#000000',
      }));

      delete correctedPayload.options;
      correctedPayload.choices = choices;
    }

    return {
      issue: 'Using "options" parameter will destroy all existing UUIDs',
      fix: 'Use "choices" parameter with preserved UUIDs',
      corrected_payload: correctedPayload,
    };
  }

  /**
   * Correct bulk operation limit issue
   */
  private correctBulkLimit(operation: Operation): SuggestedCorrection {
    if (!operation.payload) {
      return {
        issue: 'Bulk operation detected',
        fix: 'Split into smaller batches',
      };
    }

    // Find bulk array
    const bulkArrays = ['records', 'items', 'fields'];
    let arrayKey: string | null = null;
    let arrayValue: unknown[] = [];

    for (const key of bulkArrays) {
      if (key in operation.payload && Array.isArray(operation.payload[key])) {
        arrayKey = key;
        arrayValue = operation.payload[key] as unknown[];
        break;
      }
    }

    if (!arrayKey || arrayValue.length === 0) {
      return {
        issue: 'Bulk operation detected',
        fix: 'Split into batches of 100 records or fewer',
      };
    }

    // Split into batches of 100
    const batches: unknown[][] = [];
    const batchSize = 100;

    for (let i = 0; i < arrayValue.length; i += batchSize) {
      batches.push(arrayValue.slice(i, i + batchSize));
    }

    return {
      issue: `${arrayValue.length} records exceeds recommended limit of 100`,
      fix: `Split into ${batches.length} batches of ${batchSize} or fewer`,
      batches,
    };
  }

  /**
   * Correct HTTP method issue
   */
  private correctHttpMethod(operation: Operation): SuggestedCorrection {
    let correctedEndpoint = operation.endpoint;
    let correctedMethod = operation.method;

    // GET /records should be POST /records/list/
    if (operation.method === 'GET' && operation.endpoint.includes('/records') &&
        !operation.endpoint.includes('/list/')) {
      correctedMethod = 'POST';
      correctedEndpoint = operation.endpoint.replace('/records', '/records/list/');
    }

    // DELETE without trailing slash
    if (operation.method === 'DELETE' && !operation.endpoint.endsWith('/')) {
      correctedEndpoint = operation.endpoint + '/';
    }

    return {
      issue: `${operation.method} ${operation.endpoint} is incorrect`,
      fix: `Use ${correctedMethod} ${correctedEndpoint}`,
      corrected_endpoint: correctedEndpoint,
      corrected_method: correctedMethod,
    };
  }

  /**
   * Correct SmartDoc format issue
   */
  private correctSmartDocFormat(operation: Operation): SuggestedCorrection {
    if (!operation.payload || !operation.fieldTypes) {
      return {
        issue: 'SmartDoc format validation failed',
        fix: 'Use full SmartDoc structure',
      };
    }

    const correctedPayload = { ...operation.payload };

    // Find and correct rich text fields
    for (const [fieldName, fieldType] of Object.entries(operation.fieldTypes)) {
      if ((fieldType === 'richtextareafield' || fieldType === 'checklistfield') &&
          fieldName in correctedPayload) {
        const value = correctedPayload[fieldName];

        if (typeof value === 'string') {
          // Convert plain string to SmartDoc
          correctedPayload[fieldName] = this.createSmartDocStructure(value);
        } else if (Array.isArray(value)) {
          // Convert array (checklist) to SmartDoc
          correctedPayload[fieldName] = this.createSmartDocStructure(value.join('\n'));
        }
      }
    }

    return {
      issue: 'plain string or array format for rich text / checklist field',
      fix: 'Use SmartDoc structure with data/html/preview components',
      corrected_payload: correctedPayload,
    };
  }

  /**
   * Create SmartDoc structure from plain text
   */
  private createSmartDocStructure(text: string): Record<string, unknown> {
    return {
      data: {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [
              {
                type: 'text',
                text,
              },
            ],
          },
        ],
      },
      html: `<p>${text}</p>`,
      preview: text,
    };
  }

  /**
   * Correct field name vs ID issue
   */
  private correctFieldNames(_operation: Operation): SuggestedCorrection {
    return {
      issue: 'Display names detected instead of field IDs',
      fix: 'Use discover tool to get field mappings',
      recommendation: 'Use smartsuite_discover tool for accurate field mapping before operations',
    };
  }

  /**
   * Generate human-readable guidance with emojis
   */
  private generateGuidance(
    safetyLevel: SafetyLevel,
    warnings: string[],
    blockers: string[],
    corrections: SuggestedCorrection[],
    matches: Array<{ failureModes: Array<{ description: string; prevention: string; impact: string }> }>,
  ): string {
    let guidance = '';

    // Add emoji and safety level header
    if (safetyLevel === 'RED') {
      guidance += '🔴 CRITICAL SAFETY ISSUE\n\n';
    } else if (safetyLevel === 'YELLOW') {
      guidance += '🟡 CAUTION RECOMMENDED\n\n';
    } else {
      guidance += '🟢 OPERATION APPEARS SAFE\n\n';
    }

    // Add blockers section
    if (blockers.length > 0) {
      guidance += '⛔ BLOCKERS:\n';
      for (const blocker of blockers) {
        guidance += `  • ${blocker}\n`;
      }
      guidance += '\n';
    }

    // Add warnings section
    if (warnings.length > 0) {
      guidance += '⚠️  WARNINGS:\n';
      for (const warning of warnings) {
        guidance += `  • ${warning}\n`;
      }
      guidance += '\n';
    }

    // Add prevention information from matched patterns
    if (matches.length > 0) {
      const preventions = new Set<string>();
      for (const match of matches) {
        for (const failureMode of match.failureModes) {
          if (failureMode.prevention) {
            preventions.add(failureMode.prevention);
          }
        }
      }

      if (preventions.size > 0) {
        guidance += '🛡️ Prevention:\n';
        for (const prevention of preventions) {
          guidance += `  • ${prevention}\n`;
        }
        guidance += '\n';
      }
    }

    // Add corrections section
    if (corrections.length > 0) {
      guidance += '💡 SUGGESTED CORRECTIONS:\n';
      for (let i = 0; i < corrections.length; i++) {
        const correction = corrections[i];
        if (correction) {
          guidance += `  ${i + 1}. ${correction.issue}\n`;
          guidance += `     → ${correction.fix}\n`;
        }
      }
      guidance += '\n';
    }

    // Add next steps
    if (safetyLevel === 'RED') {
      guidance += '🚨 ACTION REQUIRED: Review and correct issues before proceeding\n';
    } else if (safetyLevel === 'YELLOW') {
      guidance += '⚡ RECOMMENDED: Review suggestions and proceed with caution\n';
      guidance += '\nProceed with caution for unknown or non-standard operations.\n';
      guidance += 'Test in development environment first.\n';
    } else {
      guidance += '✅ READY: Operation can proceed\n';
    }

    return guidance;
  }

  /**
   * Log analysis for observability
   */
  private logAnalysis(
    operation: Operation,
    safetyLevel: SafetyLevel,
    patterns: string[],
    warnings: string[],
    blockers: string[],
  ): void {
    // Determine log level based on safety
    let logLevel: 'INFO' | 'WARN' | 'ERROR' = 'INFO';
    if (safetyLevel === 'RED') {
      logLevel = 'ERROR';
    } else if (safetyLevel === 'YELLOW') {
      logLevel = 'WARN';
    }

    const logData = {
      log_level: logLevel,
      safety_level: safetyLevel,
      operation: {
        endpoint: operation.endpoint,
        method: operation.method,
        description: operation.operation_description,
      },
      patterns_matched: patterns,
      warnings,
      blockers,
      warning_count: warnings.length,
      blocker_count: blockers.length,
      timestamp: new Date().toISOString(),
    };

    if (this.logger) {
      this.logger(logData);
    } else {
      console.log('[IntelligentHandler] Analysis:', logData);
    }
  }
}
