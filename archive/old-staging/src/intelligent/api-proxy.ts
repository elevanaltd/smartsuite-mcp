import { SmartSuiteClient, SmartSuiteRequestOptions, type SmartSuiteRequestResponse } from '../smartsuite-client.js';

import { KnowledgeLibrary } from './knowledge-library.js';
import { SafetyEngine } from './safety-engine.js';
import type {
  IntelligentToolInput,
  OperationResult,
  HttpMethod,
} from './types.js';

/**
 * SmartSuiteAPIProxy - Direct API execution layer for intelligent tool
 * Enables true 90% API coverage by making direct SmartSuite API calls
 *
 * Technical-Architect: Approved for direct API execution pattern
 * Critical-Engineer: Validated for safety-first execution flow
 */
export class SmartSuiteAPIProxy {
  constructor(
    private client: SmartSuiteClient,
    private knowledgeLibrary: KnowledgeLibrary,
    private safetyEngine: SafetyEngine,
  ) {}

  /**
   * Execute operation directly against SmartSuite API
   * This is the key to achieving true API coverage
   */
  async executeOperation(input: IntelligentToolInput): Promise<OperationResult> {
    const startTime = performance.now();

    try {
      // 1. Knowledge-driven validation
      const knowledge = this.knowledgeLibrary.findRelevantKnowledge(
        input.method,
        input.endpoint,
        input.payload,
      );

      // 2. Safety assessment with confirmation requirement
      const safetyAssessment = this.safetyEngine.assess(
        input,
        knowledge,
      );

      if (safetyAssessment.level === 'RED' && !input.confirmed) {
        return {
          success: false,
          mode: 'execute',
          analysis: {
            endpoint: input.endpoint,
            method: input.method,
            safetyLevel: 'RED',
            requiresConfirmation: true,
            warnings: safetyAssessment.warnings,
            recommendations: safetyAssessment.recommendations ?? [],
          },
          error: 'Operation requires confirmation due to high risk level',
          performanceMs: performance.now() - startTime,
        };
      }

      // 3. Apply knowledge-based corrections
      const correctedInput = this.applyCorrections(input, knowledge);

      // 4. Build full API endpoint (table ID substitution happens AFTER corrections)
      const fullEndpoint = this.buildFullEndpoint(correctedInput);

      // 5. Execute the API call directly
      const requestOptions: SmartSuiteRequestOptions = {
        method: correctedInput.method as 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH',
        endpoint: fullEndpoint,
        ...(correctedInput.payload !== undefined && { data: correctedInput.payload }),
      };
      const response: SmartSuiteRequestResponse = await this.client.request(requestOptions);

      // 6. Capture learning from successful operation
      // Only capture if response is an object (not an array or success status)
      if (response && typeof response === 'object' && !Array.isArray(response)) {
        this.captureSuccessPattern(correctedInput, response as Record<string, unknown>);
      }

      return {
        success: true,
        mode: 'execute',
        result: response,
        analysis: {
          endpoint: fullEndpoint,
          method: correctedInput.method,
          safetyLevel: safetyAssessment.level,
          appliedCorrections: this.getAppliedCorrections(input, correctedInput),
        },
        performanceMs: performance.now() - startTime,
      };

    } catch (error) {
      // Capture failure patterns for learning
      this.captureFailurePattern(input, error);

      return {
        success: false,
        mode: 'execute',
        error: error instanceof Error ? error.message : 'Unknown error',
        analysis: {
          endpoint: input.endpoint,
          method: input.method,
          failureMode: this.identifyFailureMode(error),
        },
        performanceMs: performance.now() - startTime,
      };
    }
  }

  /**
   * Perform dry run validation without executing
   */
  async performDryRun(input: IntelligentToolInput): Promise<OperationResult> {
    const startTime = performance.now();

    // Find relevant knowledge
    const knowledge = this.knowledgeLibrary.findRelevantKnowledge(
      input.method,
      input.endpoint,
      input.payload,
    );

    // Assess safety
    const safetyAssessment = this.safetyEngine.assess(input, knowledge);

    // Apply corrections
    const correctedInput = this.applyCorrections(input, knowledge);

    // Validate connectivity (probe pattern)
    const connectivityValid = await this.validateConnectivity();

    return {
      success: true,
      mode: 'dry_run',
      analysis: {
        endpoint: this.buildFullEndpoint(correctedInput),
        method: correctedInput.method,
        safetyLevel: safetyAssessment.level,
        warnings: safetyAssessment.warnings,
        recommendations: safetyAssessment.recommendations ?? [],
        appliedCorrections: this.getAppliedCorrections(input, correctedInput),
        connectivityValid,
        wouldExecute: safetyAssessment.level !== 'RED' || (input.confirmed ?? false),
      },
      performanceMs: performance.now() - startTime,
    };
  }

  /**
   * Apply knowledge-based corrections to input
   */
  private applyCorrections(
    input: IntelligentToolInput,
    knowledge: ReturnType<KnowledgeLibrary['findRelevantKnowledge']>,
  ): IntelligentToolInput {
    const corrected = { ...input };

    for (const match of knowledge) {
      // Apply HTTP method corrections
      if (match.entry.correction?.method) {
        corrected.method = match.entry.correction.method.to as HttpMethod;
      }

      // Apply parameter corrections (e.g., options -> choices)
      if (match.entry.correction?.parameters && corrected.payload) {
        const { from, to } = match.entry.correction.parameters;
        if (from in corrected.payload) {
          corrected.payload[to] = corrected.payload[from];
          delete corrected.payload[from];
        }
      }

      // Apply endpoint corrections (preserve prefix)
      if (match.entry.correction?.endpoint) {
        const { from, to } = match.entry.correction.endpoint;
        // Only replace the matching part, not the whole endpoint
        corrected.endpoint = corrected.endpoint.replace(from, to);
      }
    }

    return corrected;
  }

  /**
   * Build full API endpoint with table ID substitution
   */
  private buildFullEndpoint(input: IntelligentToolInput): string {
    let endpoint = input.endpoint;

    // Ensure leading slash first
    if (!endpoint.startsWith('/')) {
      endpoint = '/' + endpoint;
    }

    // Replace {id} with tableId if provided
    if (input.tableId && endpoint.includes('{id}')) {
      endpoint = endpoint.replace('{id}', input.tableId);
    }

    return endpoint;
  }

  /**
   * Get list of corrections that were applied
   */
  private getAppliedCorrections(
    original: IntelligentToolInput,
    corrected: IntelligentToolInput,
  ): string[] {
    const corrections: string[] = [];

    if (original.method !== corrected.method) {
      corrections.push(`HTTP method: ${original.method} → ${corrected.method}`);
    }

    if (original.endpoint !== corrected.endpoint) {
      corrections.push(`Endpoint: ${original.endpoint} → ${corrected.endpoint}`);
    }

    // Check for parameter changes
    if (original.payload && corrected.payload) {
      const originalKeys = Object.keys(original.payload);
      const correctedKeys = Object.keys(corrected.payload);

      const removed = originalKeys.filter(k => !correctedKeys.includes(k));
      const added = correctedKeys.filter(k => !originalKeys.includes(k));

      if (removed.length && added.length) {
        corrections.push(`Parameters: ${removed.join(', ')} → ${added.join(', ')}`);
      }
    }

    return corrections;
  }

  /**
   * Validate API connectivity using probe pattern
   */
  private async validateConnectivity(): Promise<boolean> {
    try {
      // Use lightweight endpoint for connectivity check
      await this.client.request({
        method: 'GET',
        endpoint: '/solutions/',
      });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Capture successful operation patterns for learning
   */
  private captureSuccessPattern(
    input: IntelligentToolInput,
    _response: Record<string, unknown>,
  ): void {
    // TODO: Implement learning engine integration
    // Success pattern would be sent to learning engine here
    void {
      endpoint: input.endpoint,
      method: input.method,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Capture failure patterns for learning
   */
  private captureFailurePattern(
    input: IntelligentToolInput,
    error: unknown,
  ): void {
    // TODO: Implement learning engine integration
    // Failure pattern would be sent to learning engine here
    void {
      endpoint: input.endpoint,
      method: input.method,
      error: error instanceof Error ? error.message : 'Unknown',
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Identify the failure mode from error
   */
  private identifyFailureMode(error: unknown): string {
    if (error instanceof Error) {
      if (error.message.includes('404')) {
        return 'ENDPOINT_NOT_FOUND';
      }
      if (error.message.includes('401') || error.message.includes('403')) {
        return 'AUTHENTICATION_ERROR';
      }
      if (error.message.includes('400')) {
        return 'INVALID_PAYLOAD';
      }
      if (error.message.includes('500')) {
        return 'SERVER_ERROR';
      }
    }
    return 'UNKNOWN_ERROR';
  }
}
