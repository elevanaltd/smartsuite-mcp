// Test setup file for loading environment variables
// Required by vitest.config.ts setupFiles

// Load environment variables from .env if available
import { config } from 'dotenv';

config();

// Global test setup can be added here
