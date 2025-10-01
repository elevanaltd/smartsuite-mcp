# Manual Testing Scripts

This directory contains manual test scripts for validating the SmartSuite API Shim functionality outside of the automated test suite.

## Scripts

- `test-api-detailed.mjs` - Direct API client testing
- `test-api-execution.mjs` - API execution through intelligent proxy
- `test-final.mjs` - Complete end-to-end integration test
- `test-intelligent.mjs` - Intelligent tool component testing
- `test-with-env.mjs` - Environment variable validation

## Usage

Run from the project root:

```bash
# Build the project first
npm run build

# Run individual test scripts
node scripts/manual-testing/test-final.mjs
node scripts/manual-testing/test-api-detailed.mjs
```

## Requirements

- Project must be built (`npm run build`)
- Environment variables must be configured (`.env` file)
- SmartSuite API credentials required