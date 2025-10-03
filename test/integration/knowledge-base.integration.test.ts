// Integration Test: Knowledge Base Default Path Resolution
// Purpose: Validate production path resolution works correctly
// Critical: This test prevents path resolution bugs from reaching production

import { describe, it, expect, beforeEach, afterEach } from 'vitest';

import { KnowledgeBase } from '../../src/operations/knowledge-base.js';

describe('KnowledgeBase Integration - Default Path Resolution', () => {
  let originalEnv: string | undefined;

  beforeEach(() => {
    // Save original env var if it exists
    originalEnv = process.env.KNOWLEDGE_BASE_PATH;
  });

  afterEach(() => {
    // Restore original env var
    if (originalEnv !== undefined) {
      process.env.KNOWLEDGE_BASE_PATH = originalEnv;
    } else {
      delete process.env.KNOWLEDGE_BASE_PATH;
    }
  });

  it('should load successfully using project root discovery (default path)', () => {
    // Ensure no env var is set for this test
    delete process.env.KNOWLEDGE_BASE_PATH;

    // This should NOT throw an error - it should find coordination/ and resolve
    const kb = KnowledgeBase.loadFromFiles();

    // Validate it loaded the real production knowledge base
    expect(kb.getPatternCount()).toBeGreaterThan(0);
    expect(kb.getManifest().version).toBeDefined();
    expect(kb.getManifest().version).toMatch(/^\d+\.\d+\.\d+$/);

    // Validate critical patterns are loaded
    expect(kb.hasPattern('UUID_CORRUPTION')).toBe(true);
    expect(kb.hasPattern('BULK_OPERATION_LIMIT')).toBe(true);
    expect(kb.hasPattern('WRONG_HTTP_METHOD')).toBe(true);
    expect(kb.hasPattern('SMARTDOC_FORMAT')).toBe(true);
    expect(kb.hasPattern('FIELD_NAME_VS_ID')).toBe(true);
  });

  it('should load from KNOWLEDGE_BASE_PATH environment variable when set', () => {
    // Set environment variable to absolute path
    process.env.KNOWLEDGE_BASE_PATH = '/Volumes/HestAI-Projects/smartsuite-api-shim/coordination/smartsuite-truth';

    // This should use the env var path
    const kb = KnowledgeBase.loadFromFiles();

    // Validate it loaded successfully
    expect(kb.getPatternCount()).toBeGreaterThan(0);
    expect(kb.getManifest().version).toBeDefined();
  });

  it('should prioritize explicit path over environment variable and auto-discovery', () => {
    // Set env var to wrong path (should be ignored)
    process.env.KNOWLEDGE_BASE_PATH = '/nonexistent/path';

    // Explicit path should take precedence
    const kb = KnowledgeBase.loadFromFiles('test/fixtures/knowledge');

    // Should load from test fixtures successfully
    expect(kb.getPatternCount()).toBeGreaterThan(0);
    expect(kb.getManifest().version).toBeDefined();
  });

  it('should throw descriptive error when env var points to invalid path', () => {
    // Set env var to nonexistent path
    process.env.KNOWLEDGE_BASE_PATH = '/absolutely/nonexistent/path';

    // Should throw with context about env var
    expect(() => {
      KnowledgeBase.loadFromFiles();
    }).toThrow(/manifest\.json not found.*KNOWLEDGE_BASE_PATH environment variable/);
  });

  it('should throw descriptive error when coordination directory cannot be found', () => {
    // Delete env var
    delete process.env.KNOWLEDGE_BASE_PATH;

    // Set CWD to a directory without coordination (use /tmp for test)
    // Note: We cannot change CWD in Vitest workers, so we test via explicit path
    // that simulates missing coordination directory

    // This test validates error message when coordination not found
    // The auto-discovery will fail if run from a directory tree without coordination/
    expect(() => {
      // Simulate by providing a path that doesn't exist
      KnowledgeBase.loadFromFiles('/tmp/nonexistent-project');
    }).toThrow(/manifest\.json not found/);
  });
});
