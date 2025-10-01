// Test for TypeScript configuration settings for ES modules
// Critical-Engineer: consulted for Node.js ESM module resolution strategy
// Context7: consulted for vitest
// Context7: consulted for fs
// Context7: consulted for path
import * as fs from 'fs';
import * as path from 'path';

import { describe, it, expect } from 'vitest';

describe('TypeScript Configuration', () => {
  it('should have correct module resolution for Node.js ES modules', () => {
    const tsconfigPath = path.join(process.cwd(), 'tsconfig.json');
    const tsconfigContent = fs.readFileSync(tsconfigPath, 'utf-8');
    const tsconfig = JSON.parse(tsconfigContent);

    // Check that moduleResolution is set to nodenext
    expect(tsconfig.compilerOptions.moduleResolution).toBe('nodenext');

    // Check that module is set to NodeNext (or ESNext with nodenext resolution)
    expect(['NodeNext', 'ESNext']).toContain(tsconfig.compilerOptions.module);

    // If module is ESNext, moduleResolution MUST be nodenext for Node.js
    if (tsconfig.compilerOptions.module === 'ESNext') {
      expect(tsconfig.compilerOptions.moduleResolution).toBe('nodenext');
    }
  });

  it('should have ES module type in package.json', () => {
    const packageJsonPath = path.join(process.cwd(), 'package.json');
    const packageJsonContent = fs.readFileSync(packageJsonPath, 'utf-8');
    const packageJson = JSON.parse(packageJsonContent);

    // Check that type is set to module
    expect(packageJson.type).toBe('module');
  });

  it('should have appropriate target for modern Node.js', () => {
    const tsconfigPath = path.join(process.cwd(), 'tsconfig.json');
    const tsconfigContent = fs.readFileSync(tsconfigPath, 'utf-8');
    const tsconfig = JSON.parse(tsconfigContent);

    // Check that target is at least ES2022 for modern Node.js
    const validTargets = ['ES2022', 'ES2023', 'ESNext'];
    expect(validTargets).toContain(tsconfig.compilerOptions.target);
  });
});
