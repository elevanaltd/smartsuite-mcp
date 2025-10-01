# CI Validation Checklist

## CRITICAL: Preventing False "Complete" Claims

This checklist exists because agents have been claiming work is "complete" when it only passes partial validation. CI runs MORE checks than just `npm run build`.

## ✅ MANDATORY BEFORE MARKING COMPLETE

### Full Validation Sequence (ALL THREE REQUIRED)
```bash
# Run ALL THREE commands in this exact sequence
npm run lint       # Checks code style, formatting, unused variables
npm run typecheck  # Checks ALL TypeScript files including tests
npm run test       # Runs test suite
```

**SUCCESS CRITERIA**: All three commands must pass with zero errors.

## ❌ INSUFFICIENT VALIDATION (Common Agent Mistakes)

These are NOT enough to claim "CI ready":
- `npm run build` alone - Only checks src/ compilation, misses test files
- `npm test` alone - Doesn't check types or lint issues
- "It compiles" - Not sufficient for CI standards
- "Build successful" - Ignores lint and test type checking
- "Tests pass" - May have type errors in test files

## 🎯 Common CI Failures to Check

### 1. Test File TypeScript Errors
- **Issue**: CI checks test files, `npm run build` doesn't
- **Check**: `npm run typecheck` (NOT just build)
- **Common**: Incorrect mock types, missing type imports

### 2. ESLint Formatting Issues
- **Missing newlines** at end of files
- **Import ordering** (external before internal)
- **Trailing commas** in objects/arrays
- **Quote style** (single vs double)
- **Check**: `npm run lint`
- **Auto-fix**: `npm run lint:fix` (but verify changes)

### 3. Unused Variables/Imports
- **Especially in test files** after refactoring
- **Unused function parameters**
- **Check**: `npm run lint`

## 📊 Evidence Requirements

Before claiming "CI ready", you MUST show actual command output:

### GOOD Evidence ✅
```bash
$ npm run lint
> smartsuite-api-shim@1.0.0 lint
> eslint . --ext .ts,.tsx
✨ Done in 3.45s.

$ npm run typecheck
> smartsuite-api-shim@1.0.0 typecheck
> tsc --noEmit
✨ Done in 5.23s.

$ npm run test
> smartsuite-api-shim@1.0.0 test
> vitest run
✓ 467 tests passed
```

### BAD Evidence ❌
- "Build successful"
- "TypeScript clean"
- "Tests are passing"
- "No errors found"
- "Should work in CI"

## 🚨 AGENT ACCOUNTABILITY

- **implementation-lead**: MUST run all three checks before reporting complete
- **error-architect**: MUST verify all three when fixing CI errors
- **code-review-specialist**: MUST confirm CI parity in reviews
- **ANY agent making code changes**: MUST validate with all three commands

## 💡 Quick Fix Commands

If you find issues, these might help:
```bash
# Auto-fix formatting issues (but review changes!)
npm run lint:fix

# Check only TypeScript (faster during development)
npx tsc --noEmit

# Run specific test file
npm test -- path/to/file.test.ts
```

## 🔄 CI/CD Pipeline Sequence

Our CI runs these checks in order:
1. `npm run lint` - Fails fast on style issues
2. `npm run typecheck` - Catches type errors
3. `npm test` - Runs test suite

**ALL must pass for CI to succeed.**

---

**Last Updated**: 2025-09-17
**Purpose**: Prevent false "complete" claims that cause CI failures
**Enforcement**: Required reading for all agents before claiming task completion
