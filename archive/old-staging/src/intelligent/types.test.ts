// Context7: consulted for vitest
import { describe, it, expect } from 'vitest';

import type {
  SafetyLevel,
  OperationMode,
  HttpMethod,
  KnowledgeEntry,
  SafetyAssessment,
} from './types.js';

describe('Types', () => {
  it('should export type definitions without runtime errors', () => {
    // Type-only test to ensure types are properly defined
    const testSafetyLevel: SafetyLevel = 'RED';
    expect(testSafetyLevel).toBe('RED');

    const testMode: OperationMode = 'learn';
    expect(testMode).toBe('learn');

    const testMethod: HttpMethod = 'POST';
    expect(testMethod).toBe('POST');
  });

  it('should allow creation of KnowledgeEntry objects', () => {
    const entry: KnowledgeEntry = {
      pattern: /test/,
      safetyLevel: 'YELLOW',
      failureModes: [{
        description: 'Test failure',
        cause: 'Test cause',
        prevention: 'Test prevention',
      }],
    };

    expect(entry.safetyLevel).toBe('YELLOW');
    expect(entry.failureModes).toHaveLength(1);
  });

  it('should allow creation of SafetyAssessment objects', () => {
    const assessment: SafetyAssessment = {
      level: 'GREEN',
      score: 95,
      protocols: [],
      warnings: [],
      blockers: [],
      recommendations: [],
    };

    expect(assessment.level).toBe('GREEN');
    expect(assessment.score).toBe(95);
  });
});
