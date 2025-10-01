import { KnowledgeLibrary } from './knowledge-library.js';
import type {
  IntelligentToolInput,
  KnowledgeMatch,
  SafetyAssessment,
  SafetyProtocol,
  SafetyLevel,
  Warning,
} from './types.js';

export interface ValidationResult {
  passed: boolean;
  protocol: string;
  message: string;
  severity: SafetyLevel;
}

export class SafetyEngine {
  // Critical protocols from EAV failure analysis
  private criticalProtocols = {
    UUID_PROTECTION: {
      pattern: /singleselectfield.*options/,
      validate: (operation: IntelligentToolInput): ValidationResult | null => {
        if (operation.payload?.field_type === 'singleselectfield' && operation.payload?.options) {
          return {
            passed: false,
            protocol: 'UUID_PROTECTION',
            message: 'UUID corruption risk: "options" parameter destroys UUIDs. Use "choices" instead.',
            severity: 'RED' as SafetyLevel,
          };
        }
        return null;
      },
    },
    BULK_OPERATION_LIMITS: {
      pattern: /bulk/,
      validate: (operation: IntelligentToolInput): ValidationResult | null => {
        if (operation.payload?.records &&
            Array.isArray(operation.payload.records) &&
            operation.payload.records.length > 25) {
          return {
            passed: false,
            protocol: 'BULK_OPERATION_LIMITS',
            message: `Bulk operation with ${operation.payload.records.length} records exceeds limit of 25 records`,
            severity: 'YELLOW' as SafetyLevel,
          };
        }
        return null;
      },
    },
    ENDPOINT_VALIDATION: {
      pattern: /records$/,
      validate: (operation: IntelligentToolInput): ValidationResult | null => {
        if (operation.method === 'GET' && operation.endpoint.endsWith('/records')) {
          return {
            passed: false,
            protocol: 'ENDPOINT_VALIDATION',
            message: 'Wrong HTTP method: Use POST /applications/{id}/records/list/ instead of GET',
            severity: 'RED' as SafetyLevel,
          };
        }
        return null;
      },
    },
  };

  constructor(_knowledgeLibrary: KnowledgeLibrary) {
    // Knowledge library is passed in but not stored - methods receive knowledge matches directly
  }

  assess(operation: IntelligentToolInput, knowledge: KnowledgeMatch[]): SafetyAssessment {
    const protocols: SafetyProtocol[] = [];
    const warnings: Warning[] = [];
    const blockers: string[] = [];
    const recommendations: string[] = [];
    let level: SafetyLevel = 'GREEN';
    let score = 100;

    // Validate critical protocols
    const validations = this.validateCriticalProtocols(operation);

    for (const validation of validations) {
      if (!validation.passed) {
        if (validation.severity === 'RED') {
          level = 'RED';
          score = Math.min(score, 20);
          blockers.push(validation.message);

          // Add specific recommendations based on protocol
          if (validation.protocol === 'UUID_PROTECTION') {
            recommendations.push('Use "choices" parameter instead of "options"');
          } else if (validation.protocol === 'ENDPOINT_VALIDATION') {
            recommendations.push('Use POST method with /records/list/ endpoint');
          }
        } else if (validation.severity === 'YELLOW' && level !== 'RED') {
          level = 'YELLOW';
          score = Math.min(score, 60);
          warnings.push({
            level: 'WARNING',
            message: validation.message,
            protocol: validation.protocol,
          });

          if (validation.protocol === 'BULK_OPERATION_LIMITS') {
            recommendations.push('Split into batches of 25 records or less');
          }
        }
      }
    }

    // Check knowledge matches
    for (const match of knowledge) {
      if (match.entry.safetyLevel === 'RED') {
        level = 'RED';
        score = Math.min(score, 20);

        if (match.entry.failureModes) {
          for (const failure of match.entry.failureModes) {
            blockers.push(failure.description);
            if (failure.prevention) {
              recommendations.push(failure.prevention);
            }
          }
        }
      } else if (match.entry.safetyLevel === 'YELLOW' && level !== 'RED') {
        level = 'YELLOW';
        score = Math.min(score, 60);
      }

      // Add protocols from knowledge
      if (match.entry.protocols) {
        protocols.push(...match.entry.protocols);
      }
    }

    // Check for execution mode restrictions
    if (operation.mode === 'execute' && level === 'RED' && !operation.confirmed) {
      blockers.push('RED level operation requires confirmation');
    }

    // Generate warnings based on assessment only if none exist and it's not a GREEN safe operation
    if (warnings.length === 0 && (level !== 'GREEN' || blockers.length > 0)) {
      const generatedWarnings = this.generateWarnings({ level, score, protocols, warnings, blockers, recommendations });
      warnings.push(...generatedWarnings);
    }

    return {
      level,
      score,
      protocols,
      warnings,
      blockers,
      recommendations,
    };
  }

  validateCriticalProtocols(operation: IntelligentToolInput): ValidationResult[] {
    const results: ValidationResult[] = [];

    for (const [, protocol] of Object.entries(this.criticalProtocols)) {
      const result = protocol.validate(operation);
      if (result) {
        results.push(result);
      }
    }

    return results;
  }

  generateWarnings(assessment: SafetyAssessment): Warning[] {
    const warnings: Warning[] = [];

    if (assessment.level === 'RED') {
      warnings.push({
        level: 'CRITICAL',
        message: 'HIGH RISK: This operation has critical safety concerns',
        protocol: 'SAFETY_ASSESSMENT',
      });
    } else if (assessment.level === 'YELLOW') {
      warnings.push({
        level: 'WARNING',
        message: 'Moderate risk: Review recommendations before proceeding',
        protocol: 'SAFETY_ASSESSMENT',
      });
    } else {
      warnings.push({
        level: 'INFO',
        message: 'Safe operation: No critical issues detected',
        protocol: 'SAFETY_ASSESSMENT',
      });
    }

    return warnings;
  }
}
