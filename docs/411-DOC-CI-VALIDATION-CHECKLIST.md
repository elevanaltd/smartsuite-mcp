# CI Validation Checklist

## MANDATORY BEFORE MARKING COMPLETE

### ✅ Full Validation Sequence
```bash
# Run ALL THREE in sequence - MUST ALL PASS
npm run lint       # Check code style and formatting
npm run typecheck  # Check ALL TypeScript files including tests
npm run test       # Run test suite
```

### ❌ INSUFFICIENT VALIDATION
- `npm run build` alone - Only checks src/ compilation, misses test files
- `npm test` alone - Doesn't check types or lint
- "It compiles" - Not enough for CI
- "TypeScript clean" - Must include test files, not just src/

### 🎯 Common CI Failures to Check

1. **Test File TypeScript Errors**
   - CI checks test files, build doesn't
   - Run: `npm run typecheck` (checks ALL .ts files)
   - Common: Incorrect type assumptions in tests

2. **ESLint Formatting Issues**
   - Missing newlines at end of file
   - Import ordering violations
   - Missing trailing commas
   - Quote style inconsistency
   - Run: `npm run lint` to catch all

3. **Unused Variables/Imports**
   - Especially in test files
   - Declared but never read errors
   - Check with: `npm run lint`

### 📊 Evidence Requirements
Before claiming "CI ready", provide actual command output:

```
> npm run lint
✔ No ESLint errors (warnings acceptable)

> npm run typecheck
✔ No TypeScript errors in any files

> npm run test
✔ All tests passing
```

### 🚫 False Completion Prevention

**NEVER claim complete with only:**
- "Build successful" - Insufficient, only checks src/
- "Tests pass" - Missing type and lint checks
- "TypeScript compiles" - Must verify test files too
- "It works locally" - Must pass all three checks

### 📋 Pre-Push Checklist

- [ ] Ran `npm run lint` - Zero errors
- [ ] Ran `npm run typecheck` - All files pass
- [ ] Ran `npm run test` - All tests pass
- [ ] Copied command outputs as evidence
- [ ] Verified test files are type-checked
- [ ] Checked for unused imports/variables

### 💡 Quick Fix Commands

```bash
# Auto-fix many lint issues
npm run lint:fix

# Check what would be fixed
npm run lint -- --fix-dry-run

# Run all validation at once
npm run lint && npm run typecheck && npm run test
```

### 🔍 Debugging CI Failures

If CI fails but local passes:
1. Check you're on the right branch
2. Ensure all files are committed
3. Run the EXACT commands CI runs
4. Check for environment differences
5. Verify node/npm versions match

### 📝 Agent-Specific Requirements

**Implementation-Lead**: Must show all three passing before reporting complete
**Error-Architect**: Must verify all three when claiming errors fixed
**Code-Review-Specialist**: Must confirm CI parity in reviews

---

**Remember**: CI runs ALL validations. Your local checks must match exactly.
