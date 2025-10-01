# Architecture Decision Record: CodeQL Integration Strategy

## Status: Accepted

## Context

We have implemented CodeQL security scanning as part of our integrated CI pipeline using `github/codeql-action/init@v3` and `github/codeql-action/analyze@v3`. 

GitHub's Code Security settings offer three options:
1. **Default** - GitHub automatically finds best configuration  
2. **Advanced** - Customize via YAML (creates separate workflow)
3. **Not set up** - Use custom integration

## Decision

**We choose "Not set up" in the GitHub UI and maintain our custom CI integration.**

## Rationale

### Advantages of Custom Integration:
- ✅ **Single Source of Truth** - All CI configuration in version-controlled YAML
- ✅ **No Duplicate Scanning** - Avoids running GitHub's scan + our scan
- ✅ **Integrated Quality Gates** - CodeQL runs alongside lint, test, build
- ✅ **Optimized Configuration** - Customized for our TypeScript/Node.js stack
- ✅ **Full Control** - Version-controlled, reviewable changes

### Risks of GitHub "Default":
- ❌ **Duplicate Resource Usage** - Wastes CI minutes running two scans
- ❌ **Conflicting Results** - Two different scans may disagree
- ❌ **Loss of Control** - GitHub's "magic" configuration is opaque
- ❌ **Source of Truth Confusion** - Which scan results are authoritative?

## Implementation

### Current Configuration
```yaml
security-scan:
  name: Security Scan
  permissions:
    security-events: write  # Upload SARIF results
    actions: read
    contents: read
    id-token: write        # OIDC for CodeQL v3
    pull-requests: read    # PR context
  
  steps:
    - uses: github/codeql-action/init@v3
      with:
        languages: javascript-typescript
        tools: latest
        
    - uses: github/codeql-action/analyze@v3
      with:
        upload: true              # ← Key: uploads to Security tab
        wait-for-processing: true
```

### GitHub UI Setting
- Navigate to: Settings → Code security and analysis → Code scanning
- **Select: "Not set up"**
- **Do NOT select "Default" or "Advanced"**

## Consequences

### Positive:
- Single, maintainable CodeQL configuration
- Integrated with quality gates (must pass to merge)
- No resource waste or conflicting results
- Full transparency and control

### Negative:
- Requires manual documentation (this ADR)
- Team members might be confused by "Not set up" in UI
- Must ensure SARIF upload works correctly

## Verification

Results from our custom workflow appear in:
- GitHub Security tab (via SARIF upload)
- CI pipeline status checks
- Pull request checks

## Prevention

To prevent accidental UI configuration:
1. This ADR documents the decision
2. CI workflow contains warning comments
3. Team onboarding includes this context