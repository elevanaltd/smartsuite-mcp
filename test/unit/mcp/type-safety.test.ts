import { describe, it, expect } from 'vitest';

/**
 * Type safety tests for executeIntelligentTool
 * Critical-Engineer Finding #2: Type safety erosion (as never bypass)
 *
 * These tests verify proper type narrowing instead of unsafe type assertions
 */
describe('executeIntelligentTool - Type Safety', () => {
  describe('Type assertion removal', () => {
    it('should not use "as never" type bypass', async () => {
      // Read the source file and check for 'as never'
      const fs = await import('fs');
      const path = await import('path');
      const toolsPath = path.resolve('./src/mcp/tools.ts');
      const source = fs.readFileSync(toolsPath, 'utf-8');

      // Check if executeIntelligentTool contains 'as never'
      const functionStart = source.indexOf('export async function executeIntelligentTool');
      const functionEnd = source.indexOf('\n}', functionStart) + 2;
      const functionBody = source.substring(functionStart, functionEnd);

      // This should fail initially because the code contains 'as never'
      expect(functionBody).not.toContain('as never');
    });

    it('should use proper type narrowing for handler execution', async () => {
      // Check that we use a type-safe approach
      const fs = await import('fs');
      const path = await import('path');
      const toolsPath = path.resolve('./src/mcp/tools.ts');
      const source = fs.readFileSync(toolsPath, 'utf-8');

      // Look for the new type-safe implementation pattern
      // Should contain handler type checking or discriminated union
      const functionStart = source.indexOf('export async function executeIntelligentTool');
      const functionEnd = source.indexOf('\n}', functionStart) + 2;
      const functionBody = source.substring(functionStart, functionEnd);

      // Should have type narrowing logic
      expect(functionBody).toContain('getHandlerType');
    });
  });

  describe('Handler type identification', () => {
    it('should have getHandlerType helper function', async () => {
      const fs = await import('fs');
      const path = await import('path');
      const toolsPath = path.resolve('./src/mcp/tools.ts');
      const source = fs.readFileSync(toolsPath, 'utf-8');

      // Check for type identification helper
      expect(source).toContain('function getHandlerType');
    });

    it('should have executeWithTypedContext helper function', async () => {
      const fs = await import('fs');
      const path = await import('path');
      const toolsPath = path.resolve('./src/mcp/tools.ts');
      const source = fs.readFileSync(toolsPath, 'utf-8');

      // Check for typed execution helper
      expect(source).toContain('function executeWithTypedContext');
    });
  });
});
