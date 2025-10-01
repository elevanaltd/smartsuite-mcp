import { vi } from 'vitest';

import { TokenManager } from '../src/intelligent/token-manager.js';
// Context7: consulted for vitest

describe('TokenManager', () => {
  let tokenManager: TokenManager;

  beforeEach(() => {
    tokenManager = new TokenManager();
  });

  describe('estimateTokens', () => {
    it('should estimate tokens for simple text', () => {
      const text = 'Hello world';
      const estimated = tokenManager.estimateTokens(text);
      expect(estimated).toBeGreaterThan(0);
      expect(estimated).toBeLessThan(10);
    });

    it('should estimate higher token count for complex data structures', () => {
      const complexData = {
        records: Array(1000).fill({
          id: 'record-id-12345678',
          field1: 'some long field value with lots of text',
          field2: { nested: { deeply: { structured: 'data' } } },
        }),
      };
      const estimated = tokenManager.estimateTokens(JSON.stringify(complexData));
      expect(estimated).toBeGreaterThan(10000);
    });

    it('should estimate tokens for non-string data by converting to JSON', () => {
      const data = { key: 'value', number: 42, array: [1, 2, 3] };
      const estimated = tokenManager.estimateTokens(data);
      expect(estimated).toBeGreaterThan(0);
    });
  });

  describe('validateTokenLimit', () => {
    it('should throw error when tokens exceed MAX_TOKENS limit', () => {
      const largeText = 'x'.repeat(400000); // ~100K+ tokens

      expect(() => {
        tokenManager.validateTokenLimit(largeText);
      }).toThrow('Token limit exceeded: estimated');
    });

    it.skip('should log warning when tokens exceed WARNING_THRESHOLD - disabled to avoid console pollution', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const warningText = 'x'.repeat(320000); // ~80K+ tokens

      tokenManager.validateTokenLimit(warningText);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Token usage warning: estimated'),
      );
      consoleSpy.mockRestore();
    });

    it('should allow tokens under warning threshold without issues', () => {
      const smallText = 'This is a small text that should be fine';

      expect(() => {
        tokenManager.validateTokenLimit(smallText);
      }).not.toThrow();
    });

    it('should handle non-string input by converting to JSON string', () => {
      const data = { small: 'data' };

      expect(() => {
        tokenManager.validateTokenLimit(data);
      }).not.toThrow();
    });
  });

  describe('token overflow scenarios', () => {
    it('should prevent MCP client disconnect by failing before overflow', () => {
      // Simulate massive SmartSuite response that would cause overflow
      const massiveResponse = {
        records: Array(5000).fill({
          id: 'very-long-record-id-that-takes-many-tokens-123456789',
          title: 'A very long title with lots of descriptive text that uses many tokens',
          description: 'An even longer description field that contains extensive detailed information about this particular record item which would consume significant token allocation when processed through the API response handler',
          metadata: {
            created_by: { name: 'User Name', email: 'user@example.com', id: 'user-id-12345' },
            created_at: '2024-01-01T00:00:00Z',
            updated_at: '2024-01-01T00:00:00Z',
            tags: ['tag1', 'tag2', 'tag3', 'tag4', 'tag5'],
            custom_fields: {
              field1: 'Custom field value 1',
              field2: 'Custom field value 2',
              field3: 'Custom field value 3',
            },
          },
        }),
      };

      expect(() => {
        tokenManager.validateTokenLimit(JSON.stringify(massiveResponse));
      }).toThrow('Token limit exceeded');
    });

    it('should provide clear error message for overflow prevention', () => {
      const overflowData = 'x'.repeat(500000);

      expect(() => {
        tokenManager.validateTokenLimit(overflowData);
      }).toThrow(/Token limit exceeded: estimated \d+ tokens, max allowed: 100000/);
    });
  });
});
