# Repository Setup Guide for SmartSuite API Shim

## Required GitHub Repository Settings

### 1. Enable Code Security (CRITICAL)

Navigate to: **Settings** → **Code security and analysis**

Enable the following features:

- [x] **Dependency graph** - Enable
- [x] **Dependabot alerts** - Enable  
- [x] **Dependabot security updates** - Enable
- [x] **Code scanning** - Enable
  - Select: "Default" or "Advanced" setup
  - If Advanced: CodeQL workflow is already configured in `.github/workflows/ci.yml`

### 2. Configure Branch Protection Rules

Navigate to: **Settings** → **Branches**

Add rule for `main` branch:

**Required status checks:**
- [x] quality-gates (ubuntu-latest, 18.x)
- [x] quality-gates (ubuntu-latest, 20.x)
- [x] security-scan
- [x] build-validation

**Protection settings:**
- [x] Require status checks to pass before merging
- [x] Require branches to be up to date before merging
- [x] Require conversation resolution before merging
- [X] Include administrators (optional for stricter enforcement)

### 3. Repository Permissions

Ensure the repository has these permissions configured:

**Actions permissions:**
- Allow all actions and reusable workflows
- Note: "Read and write permissions" may be greyed out due to organization security policies

**Workflow permissions:**
- Read repository contents and packages permissions (secure default)
- Note: Granular permissions are configured via YAML in workflow files

**Granular Permissions (Configured in CI workflow):**
- actions: read (workflow metadata)
- contents: read (repository access)
- security-events: write (SARIF upload)
- pull-requests: read (PR context)
- id-token: write (OIDC authentication)

### 4. Secrets Configuration

Navigate to: **Settings** → **Secrets and variables** → **Actions**

Required secrets:
- `SMARTSUITE_API_TOKEN_TEST` - Test environment API token

## CI/CD Pipeline Status

### CodeQL Configuration
- ✅ Updated to CodeQL Action v3 (resolved deprecation)
- ✅ Added proper permissions for Code Scanning API
- ✅ Configured CLI version handling
- ✅ Added security-and-quality queries

### Quality Gates
- ✅ Linting (ESLint + Prettier)
- ✅ Type checking (TypeScript)
- ✅ Testing with coverage
- ✅ Multi-version Node.js testing (18.x, 20.x)

### Security Scanning
- ✅ npm audit for dependency vulnerabilities
- ✅ CodeQL analysis for code vulnerabilities
- ✅ SARIF results upload to GitHub Security tab

## Verification Steps

After configuring repository settings:

1. Push a test commit to trigger CI
2. Check Actions tab for successful workflow runs
3. Verify Code scanning results appear in Security tab
4. Confirm branch protection is enforced on PRs

## Troubleshooting

### CodeQL Issues

If you see "Code Security must be enabled":
1. Go to Settings → Code security and analysis
2. Enable "Code scanning"
3. Re-run the failed workflow

If you see permission errors:
1. Check repository Settings → Actions → General
2. Ensure "Read and write permissions" is selected
3. Save changes and re-run workflow

### Branch Protection Issues

If required checks don't appear:
1. Run the CI workflow at least once successfully
2. Refresh the branch protection settings page
3. The check names should now be available in the dropdown

## Related Files

- `.github/workflows/ci.yml` - Main CI pipeline configuration
- `package.json` - NPM scripts for quality gates
- `.eslintrc.json` - ESLint configuration
- `tsconfig.json` - TypeScript configuration
- `jest.config.js` - Test configuration

---

Last Updated: 2025-09-04
Job UUID Reference: 5dd9b243-8bcc-42f1-b438-e78af2470d11
