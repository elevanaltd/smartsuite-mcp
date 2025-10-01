// Context7: consulted for path
// Context7: consulted for url
// Context7: consulted for fs
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

/**
 * Resolves the knowledge directory path for both development and production environments.
 *
 * Development: Uses src/knowledge relative to project root
 * Production: Uses build/src/knowledge where assets are copied during build
 *
 * @param importMetaUrl - The import.meta.url from the calling module
 * @returns Absolute path to the knowledge directory
 */
export function resolveKnowledgePath(importMetaUrl: string): string {
  const currentFile = fileURLToPath(importMetaUrl);
  const currentDir = path.dirname(currentFile);

  // In production builds, we'll be in build/src/ and need to find build/src/knowledge/
  // In development, we'll be in src/ and need to find src/knowledge/

  // Check if we're in a build directory
  const isProduction = currentDir.includes('build/src') || currentDir.includes('dist/src');

  if (isProduction) {
    // Production: look for knowledge in build directory
    // Current path might be like: /app/build/src/intelligent/
    // We need to find: /app/build/src/knowledge/

    // Find the build/src directory
    const buildSrcMatch = currentDir.match(/(.*[/\\]build[/\\]src)/);
    if (buildSrcMatch?.[1]) {
      const buildSrcPath = buildSrcMatch[1];
      const knowledgePath = path.join(buildSrcPath, 'knowledge');

      // Verify the path exists, return it if valid
      if (fs.existsSync(knowledgePath)) {
        return knowledgePath;
      }
    }

    // Fallback: try relative to current directory
    const relativePath = path.resolve(currentDir, '../knowledge');
    if (fs.existsSync(relativePath)) {
      return relativePath;
    }
  }

  // Development or fallback: look for src/knowledge from project root
  // Navigate up to find project root (where package.json exists)
  let searchDir = currentDir;
  let projectRoot = '';

  // Search up to 10 levels to find package.json
  for (let i = 0; i < 10; i++) {
    const packageJsonPath = path.join(searchDir, 'package.json');
    if (fs.existsSync(packageJsonPath)) {
      projectRoot = searchDir;
      break;
    }
    const parentDir = path.dirname(searchDir);
    if (parentDir === searchDir) break; // Reached filesystem root
    searchDir = parentDir;
  }

  if (projectRoot) {
    const devKnowledgePath = path.join(projectRoot, 'src', 'knowledge');
    if (fs.existsSync(devKnowledgePath)) {
      return devKnowledgePath;
    }
  }

  // Final fallback: return a path that should exist after proper build setup
  return path.resolve(currentDir, '../knowledge');
}

/**
 * Checks if the current environment is production based on NODE_ENV or directory structure
 */
export function isProductionEnvironment(): boolean {
  // Check NODE_ENV first
  if (process.env.NODE_ENV === 'production') {
    return true;
  }

  // Check if we're running from a build directory
  const stackTrace = new Error().stack || '';
  return stackTrace.includes('build/src') || stackTrace.includes('dist/src');
}

/**
 * Resolves any asset path for the current environment
 *
 * @param relativePath - Path relative to src/ directory
 * @param importMetaUrl - The import.meta.url from the calling module
 */
export function resolveAssetPath(relativePath: string, importMetaUrl: string): string {
  const currentFile = fileURLToPath(importMetaUrl);
  const currentDir = path.dirname(currentFile);

  const isProduction = currentDir.includes('build/src') || currentDir.includes('dist/src');

  if (isProduction) {
    // In production, assets should be copied to build/src/
    const buildSrcMatch = currentDir.match(/(.*[/\\]build[/\\]src)/);
    if (buildSrcMatch?.[1]) {
      return path.join(buildSrcMatch[1], relativePath);
    }
  }

  // Development: navigate up to find project root and src directory
  let searchDir = currentDir;

  // Special case: if we're in an intelligent subdirectory, look for src at parent level
  if (searchDir.includes('/intelligent') || searchDir.includes('\\intelligent')) {
    const parentOfIntelligent = searchDir.replace(/[/\\]intelligent.*$/, '');
    if (parentOfIntelligent && parentOfIntelligent !== searchDir) {
      if (parentOfIntelligent.endsWith('/src') || parentOfIntelligent.endsWith('\\src')) {
        return path.resolve(parentOfIntelligent, relativePath);
      }
      const srcPath = path.join(parentOfIntelligent, 'src');
      if (fs.existsSync(srcPath)) {
        return path.resolve(srcPath, relativePath);
      }
    }
  }

  for (let i = 0; i < 10; i++) {
    // Check if we're currently IN the src directory
    if (searchDir.endsWith('/src') || searchDir.endsWith('\\src')) {
      return path.resolve(searchDir, relativePath);
    }

    // Check if current directory contains src/
    const srcPath = path.join(searchDir, 'src');
    if (fs.existsSync(srcPath)) {
      return path.resolve(srcPath, relativePath);
    }

    const parentDir = path.dirname(searchDir);
    if (parentDir === searchDir) break; // Reached filesystem root
    searchDir = parentDir;
  }

  return path.resolve(currentDir, '..', relativePath);
}
