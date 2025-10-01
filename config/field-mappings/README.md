# Field Mappings Configuration

This directory contains field mappings that translate SmartSuite's cryptic field IDs (like `s5cf4d4f`) into human-readable names (like `client_name`).

## Directory Structure

```
config/field-mappings/
├── README.md           # This file
├── examples/           # Example mappings (tracked in git)
│   ├── clients.example.yaml
│   ├── projects.example.yaml
│   └── ...
├── defaults/           # (Optional) Shared defaults
└── *.yaml             # Your local mappings (gitignored)
```

## Configuration Priority

The system loads mappings with the following priority:
1. **Local mappings** (`*.yaml` in this directory) - Your workspace-specific configurations
2. **Example mappings** (`examples/*.example.yaml`) - Templates for new users
3. **Default mappings** (`defaults/*.yaml`) - Shared baseline configurations

## Setup for New Users

### Option 1: Copy Examples (Quick Start)
```bash
# Copy all example files to create your local mappings
cp examples/*.example.yaml .
# Remove the .example suffix
for file in *.example.yaml; do mv "$file" "${file%.example.yaml}.yaml"; done
```

### Option 2: Generate from SmartSuite (Recommended)
```bash
# Discover fields from your actual SmartSuite workspace
npm run discover:fields -- --appId YOUR_APP_ID --save
```

This will:
- Connect to your SmartSuite workspace
- Fetch actual field definitions
- Generate accurate YAML mappings
- Save them to this directory

## Local Mappings (Gitignored)

Your local `*.yaml` files are gitignored because:
- They contain workspace-specific field IDs
- Different users may have different SmartSuite workspaces
- Prevents constant PRs for configuration changes

## Example Mapping Format

```yaml
# clients.yaml
s5cf4d4f: client_name
s5cf4d50: client_email
s5cf4d51: client_phone
sbc456c5: client_status
# ... more field mappings
```

## Updating Mappings

When SmartSuite fields change:
1. Run `npm run discover:fields` to regenerate mappings
2. Or manually edit the YAML files
3. Restart the MCP server to load new mappings

## Graceful Fallback

If no mappings are found, the server will:
1. Log a warning about missing mappings
2. Continue operating with raw field IDs
3. Suggest running the discover script

This ensures the server never fails due to missing configuration.