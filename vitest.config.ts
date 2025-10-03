// TESTGUARD_BYPASS: INFRA-005 - Vitest configuration for test infrastructure
// Context7: consulted for vitest/config
// Context7: consulted for vite-tsconfig-paths
// CRITICAL_ENGINEER_BYPASS: INFRA-005 - Test configuration infrastructure, non-architectural
// Critical-Engineer: consulted for test discovery and configuration validation
// Critical-Engineer: consulted for TypeScript ESM and Vitest configuration architecture
import tsconfigPaths from 'vite-tsconfig-paths';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: 'node',
    globals: true,
    // Load environment variables for tests
    setupFiles: ['./test/setup-integration-env.ts'],
    // TESTGUARD ENFORCEMENT: Explicit test inclusion/exclusion
    // Only run TypeScript source files, never compiled JS
    include: [
      'test/**/*.{test,spec}.ts',
      'src/**/*.{test,spec}.ts',
    ],
    exclude: [
      'node_modules/**',
      'dist/**',
      'build/**',
      'coverage/**',
      '**/*.js',  // Explicitly exclude all JavaScript files
      '**/*.d.ts', // Exclude type definition files
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      all: true, // Ensure all files are included, not just tested ones
      exclude: [
        'node_modules/**',
        'build/**',
        'dist/**',
        'coverage/**',
        '**/*.config.*',
        '**/*.d.ts',
        'scripts/**',
        '**/main.ts',
        '**/types.ts',
      ],
      thresholds: {
        global: {
          // TESTGUARD ENFORCEMENT: 98% coverage requirement for critical input validation
          branches: 98,
          functions: 98,
          lines: 98,
          statements: 98,
        },
      },
    },
    testTimeout: 10000,
    // Limit parallelism to prevent memory issues
    pool: 'threads',
    poolOptions: {
      threads: {
        maxThreads: 4,
        minThreads: 1,
      },
    },
  },
});
