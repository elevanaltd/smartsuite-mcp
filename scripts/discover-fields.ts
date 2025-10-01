#!/usr/bin/env tsx
// Critical-Engineer: consulted for type-safe test mocking strategy
/**
 * Field Discovery Script
 *
 * This script connects to SmartSuite API and discovers the actual field structure
 * for a given application/table. It can:
 * 1. Fetch the current schema from SmartSuite
 * 2. Compare with existing YAML mappings
 * 3. Suggest new mappings for unmapped fields
 * 4. Generate or update YAML mapping files
 */

// Context7: consulted for fs-extra
// Context7: consulted for path
// Context7: consulted for yaml
// Context7: consulted for dotenv
import * as path from 'path';

import * as dotenv from 'dotenv';
import * as fs from 'fs-extra';
import * as yaml from 'yaml';

import { FieldMapping } from '../src/lib/field-translator.js';
import { createAuthenticatedClient } from '../src/smartsuite-client.js';

// Load environment variables
dotenv.config();

interface FieldInfo {
  slug: string;
  label: string;
  field_type: string;
  description?: string;
}

// Extended schema with application info
interface DiscoverSchema {
  structure: {
    fields: FieldInfo[];
  };
  application: {
    id: string;
    name: string;
  };
}

// Export helper function for testing
export function labelToCamelCase(label: string): string {
  return label
    .split(/[\s-_]+/)
    .map((word, index) =>
      index === 0 ? word.toLowerCase() :
      word.charAt(0).toUpperCase() + word.slice(1).toLowerCase(),
    )
    .join('');
}

export async function discoverFields(appId: string, outputPath?: string): Promise<void> {
  /* eslint-disable no-console */
  // Console output is intentional for CLI tool user interface
  console.log(`\n🔍 Discovering fields for application: ${appId}\n`);
  // Create authenticated client
  const client = await createAuthenticatedClient({
    apiKey: process.env.SMARTSUITE_API_TOKEN!,
    workspaceId: process.env.SMARTSUITE_WORKSPACE_ID!,
  });

  try {
    // Fetch schema from SmartSuite
    console.log('Fetching schema from SmartSuite...');
    const apiSchema = await client.getSchema(appId);

    // Transform to our extended schema format
    const schema: DiscoverSchema = {
      structure: {
        fields: apiSchema.structure.map((field) => {
          const fieldInfo: FieldInfo = {
            slug: field.slug,
            label: field.label,
            field_type: field.field_type,
          };
          if (field.params?.description) {
            fieldInfo.description = field.params.description as string;
          }
          return fieldInfo;
        }),
      },
      application: {
        id: apiSchema.id,
        name: apiSchema.name,
      },
    };
    console.log(`\nApplication: ${schema.application.name}`);
    console.log(`Application ID: ${schema.application.id}`);
    console.log(`Total fields: ${schema.structure.fields.length}\n`);

    // Check for existing mapping
    const mappingPath = outputPath ??
      path.join(process.cwd(), 'config', 'field-mappings', `${schema.application.name.toLowerCase().replace(/\s+/g, '-')}.yaml`);

    let existingMapping: FieldMapping | null = null;
    if (await fs.pathExists(mappingPath)) {
      console.log(`📄 Found existing mapping at: ${mappingPath}`);
      const content = await fs.readFile(mappingPath, 'utf8');
      existingMapping = yaml.parse(content) as FieldMapping;
      console.log(`Existing mappings: ${Object.keys(existingMapping.fields).length} fields\n`);
    }

    // Analyze fields
    const mappedFields = new Set(existingMapping ? Object.values(existingMapping.fields) : []);
    const newFields: FieldInfo[] = [];
    const existingFields: FieldInfo[] = [];

    console.log('📊 Field Analysis:\n');
    console.log('API Slug'.padEnd(30) + ' | ' + 'Label'.padEnd(30) + ' | ' + 'Type'.padEnd(20) + ' | Status');
    console.log('-'.repeat(100));

    for (const field of schema.structure.fields) {
      const status = mappedFields.has(field.slug) ? '✅ Mapped' : '❌ Not Mapped';

      console.log(
        field.slug.padEnd(30) + ' | ' +
        field.label.padEnd(30) + ' | ' +
        field.field_type.padEnd(20) + ' | ' +
        status,
      );

      if (!mappedFields.has(field.slug)) {
        newFields.push(field);
      } else {
        existingFields.push(field);
      }
    }

    // Generate suggested mappings for new fields
    if (newFields.length > 0) {
      console.log(`\n\n🆕 Suggested mappings for ${newFields.length} unmapped fields:\n`);
      console.log('# Add these to your YAML mapping file:\n');

      for (const field of newFields) {
        // Convert label to camelCase for human-readable name
        const humanName = labelToCamelCase(field.label);

        console.log(`  ${humanName}: ${field.slug.padEnd(30)} # ${field.label} - ${field.field_type}`);
      }
    }

    // Option to generate complete YAML file
    if (!existingMapping || process.argv.includes('--generate')) {
      console.log('\n\n📝 Complete YAML mapping file:\n');

      const mapping: FieldMapping = {
        tableName: schema.application.name.toLowerCase().replace(/\s+/g, '-'),
        tableId: appId,
        fields: {},
      };

      // Add existing mappings first
      if (existingMapping) {
        mapping.fields = { ...existingMapping.fields };
      }

      // Add new fields with suggested names
      for (const field of schema.structure.fields) {
        if (!mapping.fields[field.slug]) {
          const humanName = labelToCamelCase(field.label);

          // Use the inverse mapping (human -> API)
          mapping.fields[humanName] = field.slug;
        }
      }

      const yamlContent = yaml.stringify(mapping);

      if (process.argv.includes('--save')) {
        await fs.ensureDir(path.dirname(mappingPath));
        await fs.writeFile(mappingPath, yamlContent);
        console.log(`✅ Saved to: ${mappingPath}`);
      } else {
        console.log(yamlContent);
        console.log('\n💡 Tip: Use --save flag to save this to a file');
      }
    }

    // Summary
    console.log('\n\n📈 Summary:');
    console.log(`- Total fields in SmartSuite: ${schema.structure.fields.length}`);
    console.log(`- Mapped fields: ${existingFields.length}`);
    console.log(`- Unmapped fields: ${newFields.length}`);

    if (existingMapping) {
      const orphanedMappings = Object.values(existingMapping.fields)
        .filter(apiCode => !schema.structure.fields.find(f => f.slug === apiCode));

      if (orphanedMappings.length > 0) {
        console.log(`\n⚠️  Warning: ${orphanedMappings.length} mapped fields not found in current schema:`);
        orphanedMappings.forEach(code => console.log(`  - ${code}`));
      }
    }

  } catch (error) {
    console.error('❌ Error discovering fields:', error);
    process.exit(1);
  }
  /* eslint-enable no-console */
}

// CLI Usage
/* eslint-disable no-console */
if (require.main === module) {
  const appId = process.argv[2];

  if (!appId) {
    console.log(`
📚 SmartSuite Field Discovery Tool

Usage: npm run discover-fields <appId> [options]

Options:
  --generate    Generate complete YAML mapping file
  --save        Save the generated YAML to config/field-mappings/
  
Examples:
  npm run discover-fields 68a8ff5237fde0bf797c05b3
  npm run discover-fields 68a8ff5237fde0bf797c05b3 --generate --save

Available Table IDs (from existing mappings):
  - 68a8ff5237fde0bf797c05b3  (projects)
  - 68b81e5b3ed00285dd7105c9  (tasks)
  - 68b6d87833631a88dcae5544  (clients)
  - 68b8229a3ed0606217710711  (videos)
  - 68ba866b0cf2034c087e0f33  (schedule)
    `);
    process.exit(0);
  }

  // Check for required environment variables
  if (!process.env.SMARTSUITE_API_TOKEN || !process.env.SMARTSUITE_WORKSPACE_ID) {
    console.error('❌ Error: SMARTSUITE_API_TOKEN and SMARTSUITE_WORKSPACE_ID must be set in .env file');
    process.exit(1);
  }

  discoverFields(appId).catch(console.error);
}
/* eslint-enable no-console */
