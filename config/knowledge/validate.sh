#!/bin/bash
set -e

echo "🔍 Validating SmartSuite Knowledge Base (IntelligentHandler Interface Compliance)..."

KNOWLEDGE_BASE="config/knowledge"
ERRORS=0

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 1. JSON Syntax Validation
echo ""
echo "═══════════════════════════════════════════════════════════"
echo "1️⃣  Checking JSON Syntax..."
echo "═══════════════════════════════════════════════════════════"
find "$KNOWLEDGE_BASE" -name "*.json" | while read file; do
  if jq empty "$file" 2>/dev/null; then
    echo -e "${GREEN}✓${NC} Valid: $file"
  else
    echo -e "${RED}✗ INVALID JSON: $file${NC}"
    ERRORS=$((ERRORS + 1))
  fi
done

# 2. Required Fields Validation (IntelligentHandler Interface)
echo ""
echo "═══════════════════════════════════════════════════════════"
echo "2️⃣  Checking Required Fields (pattern, safetyLevel, failureModes)..."
echo "═══════════════════════════════════════════════════════════"
find "$KNOWLEDGE_BASE/patterns" -name "*.json" -not -name "PATTERN_TEMPLATE.json" | while read file; do
  MISSING=""

  # Check for 'pattern' field
  if ! jq -e '.pattern' "$file" >/dev/null 2>&1; then
    MISSING="${MISSING}pattern, "
  fi

  # Check for 'safetyLevel' field
  if ! jq -e '.safetyLevel' "$file" >/dev/null 2>&1; then
    MISSING="${MISSING}safetyLevel, "
  fi

  # Check for 'failureModes' array
  if ! jq -e '.failureModes | type == "array"' "$file" >/dev/null 2>&1; then
    MISSING="${MISSING}failureModes[], "
  fi

  if [ -z "$MISSING" ]; then
    echo -e "${GREEN}✓${NC} Complete: $file"
  else
    echo -e "${RED}✗ MISSING REQUIRED FIELDS in $file: ${MISSING%, }${NC}"
    ERRORS=$((ERRORS + 1))
  fi
done

# 3. SafetyLevel Validation
echo ""
echo "═══════════════════════════════════════════════════════════"
echo "3️⃣  Checking safetyLevel Values (must be RED|YELLOW|GREEN)..."
echo "═══════════════════════════════════════════════════════════"
find "$KNOWLEDGE_BASE/patterns" -name "*.json" -not -name "PATTERN_TEMPLATE.json" | while read file; do
  SAFETY_LEVEL=$(jq -r '.safetyLevel // "MISSING"' "$file")

  if [[ "$SAFETY_LEVEL" =~ ^(RED|YELLOW|GREEN)$ ]]; then
    echo -e "${GREEN}✓${NC} Valid safetyLevel '$SAFETY_LEVEL': $file"
  else
    echo -e "${RED}✗ INVALID safetyLevel '$SAFETY_LEVEL' in $file (must be RED|YELLOW|GREEN)${NC}"
    ERRORS=$((ERRORS + 1))
  fi
done

# 4. Pattern ID Uniqueness
echo ""
echo "═══════════════════════════════════════════════════════════"
echo "4️⃣  Checking Pattern ID Uniqueness..."
echo "═══════════════════════════════════════════════════════════"
DUPLICATES=$(jq -s '[
  .[].pattern_index.red[].id,
  .[].pattern_index.yellow[].id,
  .[].pattern_index.green[].id
] | group_by(.) | map(select(length > 1)) | flatten' "$KNOWLEDGE_BASE/manifest.json")

if [ "$DUPLICATES" = "[]" ]; then
  echo -e "${GREEN}✓${NC} All pattern IDs are unique"
else
  echo -e "${RED}✗ DUPLICATE PATTERN IDs: $DUPLICATES${NC}"
  ERRORS=$((ERRORS + 1))
fi

# 5. Pattern Name Uniqueness (UPPERCASE_WITH_UNDERSCORES)
echo ""
echo "═══════════════════════════════════════════════════════════"
echo "5️⃣  Checking Pattern Name Uniqueness..."
echo "═══════════════════════════════════════════════════════════"
DUPLICATES=$(jq -s '[
  .[].pattern_index.red[].pattern,
  .[].pattern_index.yellow[].pattern,
  .[].pattern_index.green[].pattern
] | group_by(.) | map(select(length > 1)) | flatten' "$KNOWLEDGE_BASE/manifest.json")

if [ "$DUPLICATES" = "[]" ]; then
  echo -e "${GREEN}✓${NC} All pattern names are unique"
else
  echo -e "${RED}✗ DUPLICATE PATTERN NAMES: $DUPLICATES${NC}"
  ERRORS=$((ERRORS + 1))
fi

# 6. Manifest-Pattern File Sync
echo ""
echo "═══════════════════════════════════════════════════════════"
echo "6️⃣  Checking Manifest-File Synchronization..."
echo "═══════════════════════════════════════════════════════════"
jq -r '.pattern_index | .red[], .yellow[], .green[] | .file' "$KNOWLEDGE_BASE/manifest.json" 2>/dev/null | \
  while read file; do
    FULL_PATH="$KNOWLEDGE_BASE/$file"
    if [ -f "$FULL_PATH" ]; then
      echo -e "${GREEN}✓${NC} Exists: $file"
    else
      echo -e "${RED}✗ MISSING FILE referenced in manifest: $file${NC}"
      ERRORS=$((ERRORS + 1))
    fi
  done

# 7. Pattern-Manifest Reverse Sync
echo ""
echo "═══════════════════════════════════════════════════════════"
echo "7️⃣  Checking for Orphaned Pattern Files..."
echo "═══════════════════════════════════════════════════════════"
find "$KNOWLEDGE_BASE/patterns" -name "*.json" -not -name "PATTERN_TEMPLATE.json" | while read file; do
  REL_PATH="${file#$KNOWLEDGE_BASE/}"

  REFERENCED=$(jq -r --arg path "$REL_PATH" '
    .pattern_index | .red[], .yellow[], .green[] |
    select(.file == $path) | .file
  ' "$KNOWLEDGE_BASE/manifest.json")

  if [ -n "$REFERENCED" ]; then
    echo -e "${GREEN}✓${NC} Referenced: $REL_PATH"
  else
    echo -e "${YELLOW}⚠${NC}  ORPHANED (not in manifest): $REL_PATH"
  fi
done

# 8. FailureModes Array Validation
echo ""
echo "═══════════════════════════════════════════════════════════"
echo "8️⃣  Checking failureModes[] Structure..."
echo "═══════════════════════════════════════════════════════════"
find "$KNOWLEDGE_BASE/patterns" -name "*.json" -not -name "PATTERN_TEMPLATE.json" | while read file; do
  FAILURE_MODES=$(jq '.failureModes // []' "$file")
  COUNT=$(echo "$FAILURE_MODES" | jq 'length')

  if [ "$COUNT" -gt 0 ]; then
    # Check each failure mode has required fields
    VALID=true
    for i in $(seq 0 $((COUNT - 1))); do
      if ! echo "$FAILURE_MODES" | jq -e ".[$i] | .description and .prevention and .impact" >/dev/null 2>&1; then
        VALID=false
        break
      fi
    done

    if $VALID; then
      echo -e "${GREEN}✓${NC} Valid failureModes[$COUNT]: $file"
    else
      echo -e "${RED}✗ INVALID failureMode structure (missing description/prevention/impact): $file${NC}"
      ERRORS=$((ERRORS + 1))
    fi
  else
    echo -e "${RED}✗ EMPTY failureModes[] array in: $file${NC}"
    ERRORS=$((ERRORS + 1))
  fi
done

# 9. Pattern Field Consistency
echo ""
echo "═══════════════════════════════════════════════════════════"
echo "9️⃣  Checking Pattern Field Consistency (file vs manifest)..."
echo "═══════════════════════════════════════════════════════════"
jq -r '.pattern_index | .red[], .yellow[], .green[] |
  "\(.file)|\(.pattern)|\(.safetyLevel)"' "$KNOWLEDGE_BASE/manifest.json" | \
  while IFS='|' read file expected_pattern expected_safety; do
    FULL_PATH="$KNOWLEDGE_BASE/$file"

    if [ -f "$FULL_PATH" ]; then
      ACTUAL_PATTERN=$(jq -r '.pattern // "MISSING"' "$FULL_PATH")
      ACTUAL_SAFETY=$(jq -r '.safetyLevel // "MISSING"' "$FULL_PATH")

      if [ "$ACTUAL_PATTERN" = "$expected_pattern" ] && [ "$ACTUAL_SAFETY" = "$expected_safety" ]; then
        echo -e "${GREEN}✓${NC} Consistent: $file"
      else
        echo -e "${RED}✗ MISMATCH in $file:${NC}"
        echo -e "   Expected: pattern='$expected_pattern', safetyLevel='$expected_safety'"
        echo -e "   Actual:   pattern='$ACTUAL_PATTERN', safetyLevel='$ACTUAL_SAFETY'"
        ERRORS=$((ERRORS + 1))
      fi
    fi
  done

# Final Summary
echo ""
echo "═══════════════════════════════════════════════════════════"
echo "📊 Validation Summary"
echo "═══════════════════════════════════════════════════════════"

if [ $ERRORS -eq 0 ]; then
  echo -e "${GREEN}✅ Knowledge base validation PASSED!${NC}"
  echo "All patterns comply with IntelligentHandler interface requirements."
  exit 0
else
  echo -e "${RED}❌ Knowledge base validation FAILED with $ERRORS error(s)${NC}"
  echo "Please fix the errors above before proceeding."
  exit 1
fi
