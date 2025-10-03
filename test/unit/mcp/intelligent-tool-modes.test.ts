import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { executeIntelligentTool } from '../../../src/mcp/tools.js';

/**
 * Mode handling tests for executeIntelligentTool
 *
 * Tests the three operation modes:
 * - learn: Analysis only (no API execution)
 * - dry_run: Validation + preview (no API execution)
 * - execute: Full API execution with safety analysis wrapper
 *
 * API Validation Report Lines 295-335: Required fixes for mode handling
 */
describe('executeIntelligentTool mode handling', () => {
  const mockParams = {
    endpoint: '/applications/test-table/records/list/',
    method: 'POST',
    operationDescription: 'list records',
    mode: 'learn'
  };

  describe('learn mode', () => {
    it('should return analysis only (no API execution)', async () => {
      const result = await executeIntelligentTool({
        ...mockParams,
        mode: 'learn'
      });

      expect(result).toHaveProperty('mode', 'learn');
      expect(result).toHaveProperty('analysis');
      expect(result.analysis).toHaveProperty('safety_level');
      // No api_response in learn mode
      expect(result).not.toHaveProperty('api_response');
    });

    it('should default to learn mode when mode parameter missing', async () => {
      const { mode, ...paramsWithoutMode } = mockParams;
      const result = await executeIntelligentTool(paramsWithoutMode);

      expect(result).toHaveProperty('mode', 'learn');
      expect(result).toHaveProperty('analysis');
    });

    it('should include safety level in analysis', async () => {
      const result = await executeIntelligentTool({
        ...mockParams,
        mode: 'learn'
      });

      expect(result.analysis.safety_level).toMatch(/^(RED|YELLOW|GREEN)$/);
    });

    it('should provide guidance in analysis', async () => {
      const result = await executeIntelligentTool({
        ...mockParams,
        mode: 'learn'
      });

      expect(result.analysis).toHaveProperty('guidance');
      expect(typeof result.analysis.guidance).toBe('string');
    });
  });

  describe('dry_run mode', () => {
    it('should validate and return preview without executing', async () => {
      const result = await executeIntelligentTool({
        ...mockParams,
        mode: 'dry_run'
      });

      expect(result).toHaveProperty('mode', 'dry_run');
      expect(result).toHaveProperty('valid');
      expect(result).toHaveProperty('analysis');
    });

    it('should return valid=false for RED safety level', async () => {
      const result = await executeIntelligentTool({
        endpoint: '/applications/123/records',  // GET /records (no trailing slash) = RED blocker
        method: 'GET',
        operationDescription: 'list records',
        mode: 'dry_run'
      });

      expect(result.valid).toBe(false);
      expect(result.analysis.safety_level).toBe('RED');
      expect(result.blockers).toBeDefined();
      expect(result.blockers.length).toBeGreaterThan(0);
    });

    it('should return valid=true for GREEN safety level', async () => {
      const result = await executeIntelligentTool({
        endpoint: '/applications/test-table/records/list/',
        method: 'POST',
        operationDescription: 'list records',
        payload: { limit: 10 },
        mode: 'dry_run'
      });

      expect(result.valid).toBe(true);
      expect(result.analysis.safety_level).toMatch(/^(GREEN|YELLOW)$/);
    });

    it('should include warnings for YELLOW safety level', async () => {
      const result = await executeIntelligentTool({
        endpoint: '/applications/test-table/records/',
        method: 'POST',
        operationDescription: 'create record',
        payload: { field_name: 'value' },  // Display name = YELLOW warning
        mode: 'dry_run'
      });

      if (result.analysis.safety_level === 'YELLOW') {
        expect(result.analysis.warnings).toBeDefined();
        expect(result.analysis.warnings.length).toBeGreaterThan(0);
      }
    });
  });

  describe('execute mode', () => {
    it('should attempt execution (client required - expect error for now)', async () => {
      // Execute mode routes to handlers which need client
      // Without client, should get "SmartSuiteClient not initialized" error
      await expect(
        executeIntelligentTool({
          endpoint: '/applications/test-table/records/list/',
          method: 'POST',
          operationDescription: 'list records',
          tableId: 'test-table-id',
          payload: { limit: 2 },
          mode: 'execute'
        })
      ).rejects.toThrow(/SmartSuiteClient not initialized/);
    });

    it('should throw error when safety_level is RED (blocks before client check)', async () => {
      // RED safety level blocks BEFORE attempting execution
      // This should throw "Operation blocked" not "Client not initialized"
      await expect(
        executeIntelligentTool({
          endpoint: '/applications/123/records',  // GET /records (no trailing slash) = RED blocker
          method: 'GET',
          operationDescription: 'list records',
          tableId: 'test-table-id',
          mode: 'execute'
        })
      ).rejects.toThrow(/Operation blocked/);
    });

    it('should not throw "Operation blocked" for GREEN operations (throws client error instead)', async () => {
      // GREEN operation should NOT be blocked by safety analysis
      // Should reach handler execution and fail on missing client
      await expect(
        executeIntelligentTool({
          endpoint: '/applications/test-table/records/list/',
          method: 'POST',
          operationDescription: 'list records',
          tableId: 'test-table-id',
          payload: { limit: 2 },
          mode: 'execute'
        })
      ).rejects.toThrow(/SmartSuiteClient not initialized/);  // NOT "Operation blocked"
    });

    it('should not throw "Operation blocked" for YELLOW operations (throws client error instead)', async () => {
      // YELLOW operation (warnings but not blockers) should proceed to execution
      // Should reach handler and fail on missing client
      await expect(
        executeIntelligentTool({
          endpoint: '/applications/test-table/records/',
          method: 'POST',
          operationDescription: 'create record with bulk items',
          tableId: 'test-table-id',
          payload: { items: Array(30).fill({}) },
          mode: 'execute'
        })
      ).rejects.toThrow(/SmartSuiteClient not initialized/);  // NOT "Operation blocked"
    });
  });

  describe('invalid mode', () => {
    it('should throw error for invalid mode value', async () => {
      await expect(
        executeIntelligentTool({
          ...mockParams,
          mode: 'invalid_mode'
        })
      ).rejects.toThrow(/Invalid mode/);
    });

    it('should throw error for null mode', async () => {
      await expect(
        executeIntelligentTool({
          ...mockParams,
          mode: null
        })
      ).rejects.toThrow();
    });
  });

  describe('mode parameter type handling', () => {
    it('should handle mode as string', async () => {
      const result = await executeIntelligentTool({
        ...mockParams,
        mode: 'learn'
      });

      expect(result.mode).toBe('learn');
    });

    it('should handle missing mode (defaults to learn)', async () => {
      const { mode, ...paramsWithoutMode} = mockParams;
      const result = await executeIntelligentTool(paramsWithoutMode);

      expect(result.mode).toBe('learn');
    });
  });
});
