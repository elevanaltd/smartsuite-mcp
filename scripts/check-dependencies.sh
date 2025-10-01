#!/bin/bash
# Dependency compatibility check script
# Prevents TypeScript/ESLint parser version mismatches

echo "🔍 Checking dependency compatibility..."

# Get TypeScript version
TS_VERSION=$(npx tsc --version | cut -d' ' -f2)
echo "TypeScript version: $TS_VERSION"

# Get parser version
PARSER_VERSION=$(npm ls @typescript-eslint/parser --depth=0 2>/dev/null | grep @typescript-eslint/parser | awk '{print $2}')
echo "@typescript-eslint/parser version: $PARSER_VERSION"

# Check if parser is outdated
if [[ -z "$PARSER_VERSION" ]]; then
    echo "❌ @typescript-eslint/parser not found!"
    echo "Run: npm install @typescript-eslint/parser @typescript-eslint/eslint-plugin"
    exit 1
fi

# Extract major.minor versions for comparison
TS_MAJOR_MINOR=$(echo $TS_VERSION | cut -d'.' -f1-2)
PARSER_MAJOR=$(echo $PARSER_VERSION | cut -d'.' -f1)

# Simple check: Parser major version should be >= 6 for TS 5.x
if [[ "$TS_MAJOR_MINOR" > "5.0" ]] && [[ "$PARSER_MAJOR" -lt "6" ]]; then
    echo "⚠️  WARNING: Parser may be too old for TypeScript $TS_VERSION"
    echo "Recommended: npm update @typescript-eslint/parser @typescript-eslint/eslint-plugin"
else
    echo "✅ Dependency versions appear compatible"
fi

# Check for outdated packages
echo ""
echo "📦 Checking for outdated packages..."
npm outdated --depth=0 2>/dev/null | grep -E "typescript|@typescript-eslint" || echo "✅ TypeScript packages up to date"

# Check for security issues
echo ""
echo "🔒 Checking for security vulnerabilities..."
npm audit --audit-level=high 2>/dev/null | tail -5

echo ""
echo "✨ Dependency check complete!"
