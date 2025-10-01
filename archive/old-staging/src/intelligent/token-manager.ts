/**
 * TokenManager - Prevents MCP client disconnects by managing token limits
 *
 * CRITICAL: Token overflow causes MCP client disconnections
 * This class provides proactive token counting and validation before operations
 */

export class TokenManager {
  private static readonly MAX_TOKENS = 100000;
  private static readonly WARNING_THRESHOLD = 80000;

  /**
   * Estimates token count for given input
   * Uses approximation: 4 characters ≈ 1 token (conservative estimate)
   */
  public estimateTokens(input: unknown): number {
    let text: string;

    if (typeof input === 'string') {
      text = input;
    } else {
      // Convert non-string input to JSON for token estimation
      text = JSON.stringify(input);
    }

    // Conservative token estimation: ~4 characters per token
    // This accounts for spaces, punctuation, and typical token boundaries
    const estimatedTokens = Math.ceil(text.length / 4);

    return estimatedTokens;
  }

  /**
   * Validates that input doesn't exceed token limits
   * Throws error if MAX_TOKENS exceeded, warns at WARNING_THRESHOLD
   */
  public validateTokenLimit(input: unknown): void {
    const estimatedTokens = this.estimateTokens(input);

    if (estimatedTokens >= TokenManager.MAX_TOKENS) {
      throw new Error(
        `Token limit exceeded: estimated ${estimatedTokens} tokens, max allowed: ${TokenManager.MAX_TOKENS}. ` +
        'This would cause MCP client disconnect. Consider reducing data size or implementing pagination.',
      );
    }

    if (estimatedTokens >= TokenManager.WARNING_THRESHOLD) {
      // Token usage warning - keeping silent to avoid console pollution
      // Consider using a proper logger in production
      /*
      console.warn(
        `Token usage warning: estimated ${estimatedTokens} tokens (${Math.round(estimatedTokens / TokenManager.MAX_TOKENS * 100)}% of limit). ` +
        `Approaching maximum of ${TokenManager.MAX_TOKENS} tokens. Consider optimization.`,
      );
      */
    }
  }

  /**
   * Gets current token limits for reference
   */
  public getTokenLimits(): { maxTokens: number; warningThreshold: number } {
    return {
      maxTokens: TokenManager.MAX_TOKENS,
      warningThreshold: TokenManager.WARNING_THRESHOLD,
    };
  }

  /**
   * Validates token limits for SmartSuite API responses before processing
   * This is the primary integration point for preventing overflow
   */
  public validateApiResponse(response: unknown, operation: string): void {
    try {
      this.validateTokenLimit(response);
    } catch (error) {
      throw new Error(
        `Token overflow prevented for ${operation}: ${error instanceof Error ? error.message : 'Unknown error'}. ` +
        'Use pagination or field filtering to reduce response size.',
      );
    }
  }
}
