// Context7: consulted for fs/promises
// Context7: consulted for path
// Context7: consulted for lru-cache
// Critical-Engineer: consulted for Architecture pattern selection
// Critical-Engineer: consulted for Build process and asset management strategy
import * as fs from 'fs/promises';
import * as path from 'path';

import { LRUCache } from 'lru-cache';

import { Clock, SystemClock } from '../common/clock.js';

import type {
  KnowledgeEntry,
  KnowledgeMatch,
  Operation,
  OperationOutcome,
  KnowledgeVersion,
  SafetyProtocol,
  SafetyLevel,
  FailureMode,
  OperationExample,
  ValidationRule,
} from './types.js';

interface MemoryUsage {
  totalMemoryMB: number;
  entriesCount: number;
  cacheSize: number;
  learningBufferSize: number;
  cacheHitRate?: number;
}

export class KnowledgeLibrary {
  private entries: Map<string, KnowledgeEntry[]> = new Map();
  private protocols: Map<string, SafetyProtocol> = new Map();
  private cache: LRUCache<string, KnowledgeMatch[]>;
  private cacheHits: number = 0;
  private cacheRequests: number = 0;
  private version: KnowledgeVersion = {
    version: '1.0.0',
    patternCount: 0,
    lastUpdated: '', // Will be initialized in constructor
    compatibility: '1.0.0',
  };
  private learningBuffer: Map<string, Array<{ operation: Operation; outcome: OperationOutcome }>> = new Map();
  private clock: Clock;

  constructor(clock: Clock = new SystemClock()) {
    this.clock = clock;

    // Configure LRU cache with memory-safe settings
    this.cache = new LRUCache({
      max: 100,                    // Maximum 100 cached queries
      ttl: 5 * 60 * 1000,         // 5 minute TTL
      maxSize: 50 * 1024 * 1024,  // 50MB max cache size
      sizeCalculation: (value, key): number => {
        // Estimate memory usage: key size + value size
        const keySize = new Blob([key]).size;
        const valueSize = JSON.stringify(value).length * 2; // ~2 bytes per char
        return keySize + valueSize;
      },
      dispose: (_value, _key, reason): void => {
        // Optional: Log cache evictions for monitoring
        if (reason === 'evict') {
          // Could add logging here if needed
        }
      },
    });

    // CRITICAL SAFETY: Always load default patterns to ensure safety contracts
    // These patterns prevent dangerous operations like wrong HTTP methods,
    // UUID corruption, and bulk operation overruns
    this.loadDefaultPatterns();
    this.updateVersion();
  }

  async loadFromResearch(researchPath: string): Promise<void> {
    try {
      // Load knowledge JSON files from the research path
      const files = await fs.readdir(researchPath);
      const jsonFiles = files.filter(f => f.endsWith('.json'));

      // Read all files in parallel to avoid await in loop
      const fileReadPromises = jsonFiles.map(async (file) => {
        const filePath = path.join(researchPath, file);
        const content = await fs.readFile(filePath, 'utf-8');
        return JSON.parse(content) as unknown;
      });

      const allData = await Promise.all(fileReadPromises);

      // Process all data after reading
      for (let i = 0; i < allData.length; i++) {
        const data = allData[i];
        const fileName = jsonFiles[i];

        // Process different knowledge types based on filename and actual structure
        if (fileName?.includes('failure-modes')) {
          // Convert object format to array format
          const failureModesObject = data as Record<string, unknown>;
          const failureModesArray = Object.values(failureModesObject);
          this.loadFailureModes(failureModesArray);
        } else if (fileName?.includes('api-patterns')) {
          // Handle api-patterns.json structure - it contains various knowledge sections
          const apiPatternsObject = data as Record<string, unknown>;
          // Extract specific patterns from the structured knowledge
          this.loadApiPatternsFromKnowledge(apiPatternsObject);
        } else if (fileName?.includes('safety-protocols')) {
          // Convert object format to array format
          const safetyProtocolsObject = data as Record<string, unknown>;
          const safetyProtocolsArray = Object.values(safetyProtocolsObject);
          this.loadSafetyProtocols(safetyProtocolsArray);
        } else if (fileName?.includes('operation-templates')) {
          // Convert object format to array format
          const operationTemplatesObject = data as Record<string, unknown>;
          const operationTemplatesArray = Object.values(operationTemplatesObject);
          this.loadOperationTemplates(operationTemplatesArray);
        }
      }

      // Default patterns are already loaded in constructor
      // Additional patterns from research files are additive

      this.updateVersion();
    } catch (_error) {
      // Default patterns are already loaded in constructor
      // File loading failures don't affect basic safety
      this.updateVersion();
    }
  }

  private loadFailureModes(failureModes: unknown[]): void {
    for (const modeData of failureModes) {
      const mode = modeData as {
        pattern?: string;
        endpoint?: string;
        severity?: string;
        description?: string;
        cause?: string;
        prevention?: string;
        solution?: string;
        recovery?: string;
        exampleError?: string;
        safeAlternative?: string;
        method?: string;
      };

      const failureMode: FailureMode = {
        description: mode.description ?? '',
        cause: mode.cause ?? '',
        prevention: mode.prevention ?? mode.solution ?? '',
      };

      // Only add optional properties if they have values
      if (mode.recovery) {
        failureMode.recovery = mode.recovery;
      }
      if (mode.exampleError) {
        failureMode.exampleError = mode.exampleError;
      }
      if (mode.safeAlternative) {
        failureMode.safeAlternative = mode.safeAlternative;
      }

      const entry: KnowledgeEntry = {
        pattern: new RegExp(mode.pattern ?? mode.endpoint ?? '.*'),
        safetyLevel: mode.severity === 'critical' ? 'RED' : mode.severity === 'warning' ? 'YELLOW' : 'GREEN',
        failureModes: [failureMode],
      };
      this.addEntry(mode.method ?? 'ANY', entry);
    }
  }

  private loadApiPatternsFromKnowledge(_knowledgeData: Record<string, unknown>): void {
    // Extract critical patterns from the knowledge structure
    // The api-patterns.json contains various sections, not just an array of patterns
    // TODO: Parse the actual knowledge data structure when needed

    // Pattern 1: Records list endpoint - must use POST not GET
    this.addEntry('GET', {
      pattern: /\/records\/list/,
      safetyLevel: 'RED',
      failureModes: [{
        description: 'Wrong HTTP method for records/list endpoint',
        cause: 'Using GET instead of POST for /records/list/',
        prevention: 'Always use POST for /applications/{id}/records/list/',
        exampleError: '404 Not Found',
      }],
    });

    // Pattern 2: Add field endpoint patterns
    this.addEntry('POST', {
      pattern: /\/add_field(\/|$)/,
      safetyLevel: 'YELLOW',
      failureModes: [{
        description: 'Field addition requires proper structure',
        cause: 'Missing required field parameters',
        prevention: 'Include field_type, label, and slug',
      }],
    });

    // Pattern 3: Bulk operations
    const bulkValidationRule: ValidationRule = {
      type: 'recordLimit',
      limit: 25,
      message: 'Bulk operations limited to 25 records',
    };

    this.addEntry('POST', {
      pattern: /\/bulk/,
      safetyLevel: 'YELLOW',
      validationRules: [bulkValidationRule],
    });

    // Count the patterns loaded from knowledge
    this.version.patternCount += 3;
  }


  private loadSafetyProtocols(protocols: unknown[]): void {
    for (const protocolData of protocols) {
      const protocol = protocolData as {
        pattern?: string;
        level?: SafetyLevel;
        prevention?: string;
        template?: {
          correctPayload?: Record<string, unknown>;
          wrongPayload?: Record<string, unknown>;
        };
        name?: string;
      };

      const safetyProtocol: SafetyProtocol = {
        pattern: new RegExp(protocol.pattern ?? '.*'),
        level: protocol.level ?? 'YELLOW',
      };

      // Only add optional properties if they have values
      if (protocol.prevention) {
        safetyProtocol.prevention = protocol.prevention;
      }
      if (protocol.template) {
        safetyProtocol.template = protocol.template;
      }
      this.protocols.set(protocol.name ?? protocol.pattern ?? 'unknown', safetyProtocol);
    }
  }

  private loadOperationTemplates(templates: unknown[]): void {
    // Load operation templates for future use
    // Currently just counting them for version info
    this.version.patternCount += templates.length;
  }

  private loadDefaultPatterns(): void {
    // Critical pattern 1: Wrong HTTP method for records
    this.addEntry('GET', {
      pattern: /\/records(\/|$)/,
      safetyLevel: 'RED',
      failureModes: [{
        description: 'Wrong HTTP method for record listing',
        cause: 'Using GET instead of POST for /records/list/',
        prevention: 'Always use POST /applications/{id}/records/list/',
        exampleError: '404 Not Found',
      }],
    });

    // Critical pattern 2: UUID corruption in status fields
    this.addEntry('POST', {
      pattern: /change_field(\/|$)/,
      safetyLevel: 'RED',
      protocols: [{
        pattern: /singleselectfield.*options/,
        level: 'RED',
        prevention: 'Use "choices" parameter instead of "options" to preserve UUIDs',
      }],
    });

    // Critical pattern 3: Bulk operation limits
    this.addEntry('POST', {
      pattern: /bulk/,
      safetyLevel: 'YELLOW',
      validationRules: [{
        type: 'recordLimit',
        limit: 25,
        message: 'Bulk operations limited to 25 records per API constraints',
      }],
    });

    // Pattern 4: Add field endpoint patterns
    this.addEntry('POST', {
      pattern: /\/add_field(\/|$)/,
      safetyLevel: 'YELLOW',
      failureModes: [{
        description: 'Field addition requires proper structure',
        cause: 'Missing required field parameters',
        prevention: 'Include field_type, label, and slug',
      }],
    });
  }

  private addEntry(method: string, entry: KnowledgeEntry): void {
    const key = method.toUpperCase();
    if (!this.entries.has(key)) {
      this.entries.set(key, []);
    }
    this.entries.get(key)!.push(entry);
    this.version.patternCount++;
  }

  findRelevantKnowledge(method: string, endpoint: string, payload?: unknown): KnowledgeMatch[] {
    const cacheKey = `${method}:${endpoint}:${JSON.stringify(payload || {})}`;

    // Track cache requests for hit rate calculation
    this.cacheRequests++;

    // Check cache first
    const cached = this.cache.get(cacheKey);
    if (cached) {
      this.cacheHits++;
      return cached;
    }

    const matches: KnowledgeMatch[] = [];

    // Check method-specific entries
    const methodEntries = this.entries.get(method.toUpperCase()) ?? [];
    for (const entry of methodEntries) {
      if (entry.pattern.test(endpoint)) {
        // Check payload-specific conditions
        let confidence = 0.8;
        let matchReason = 'Endpoint pattern match';

        // Check for specific payload issues
        if (payload && entry.protocols) {
          // Check if any protocol matches the specific dangerous pattern
          const payloadObj = payload as Record<string, unknown>;
          if (payloadObj.field_type === 'singleselectfield' && payloadObj.options) {
            confidence = 1.0;
            matchReason = 'Critical UUID corruption risk detected';
          }
        }

        if (payload && entry.validationRules) {
          const payloadObj = payload as Record<string, unknown>;
          if (payloadObj.records && Array.isArray(payloadObj.records)) {
            for (const rule of entry.validationRules) {
              if (rule.type === 'recordLimit' && payloadObj.records.length > (rule.limit ?? 25)) {
                confidence = 0.9;
                matchReason = 'Bulk operation limit exceeded';
              }
            }
          }
        }

        matches.push({
          entry,
          confidence,
          matchReason,
        });
      }
    }

    // Check ANY method entries
    const anyEntries = this.entries.get('ANY') ?? [];
    for (const entry of anyEntries) {
      if (entry.pattern.test(endpoint)) {
        matches.push({
          entry,
          confidence: 0.7,
          matchReason: 'General pattern match',
        });
      }
    }

    // Cache the result
    this.cache.set(cacheKey, matches);

    return matches;
  }

  learnFromOperation(operation: Operation, outcome: OperationOutcome): void {
    const key = `${operation.method}:${operation.endpoint}`;

    if (!this.learningBuffer.has(key)) {
      this.learningBuffer.set(key, []);
    }

    this.learningBuffer.get(key)!.push({ operation, outcome });

    // Always create or update an entry for the operation
    const example: OperationExample = {
      method: operation.method,
      endpoint: operation.endpoint,
      timestamp: operation.timestamp,
    };

    // Only add payload if it exists
    if (operation.payload) {
      example.payload = operation.payload;
    }

    // Add response based on outcome
    if (outcome.success) {
      example.response = outcome.recordCount !== undefined
        ? { recordCount: outcome.recordCount }
        : { success: true };
    } else {
      example.response = outcome.error !== undefined
        ? { error: outcome.error }
        : { error: 'Unknown error' };
    }

    // Check for EXACT endpoint match to decide update vs create
    // This preserves general patterns while allowing specific learning
    const methodEntries = this.entries.get(operation.method.toUpperCase()) ?? [];
    let exactMatch: KnowledgeEntry | undefined;

    for (const entry of methodEntries) {
      // Check if this entry's pattern is an exact match for this endpoint
      // (created from a previous learn operation with the same endpoint)
      const patternSource = entry.pattern.source;
      const escapedEndpoint = operation.endpoint.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      if (patternSource === escapedEndpoint) {
        exactMatch = entry;
        break;
      }
    }

    if (exactMatch) {
      // Update existing exact match with new example
      if (!exactMatch.examples) {
        exactMatch.examples = [];
      }
      exactMatch.examples.push(example);
    } else {
      // Create new entry for this specific operation pattern
      const newEntry: KnowledgeEntry = {
        pattern: new RegExp(operation.endpoint.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')),
        safetyLevel: outcome.success ? 'GREEN' : 'YELLOW',
        examples: [example],
      };

      if (!outcome.success) {
        newEntry.failureModes = [{
          description: 'Learned failure pattern',
          cause: outcome.error ?? 'Unknown error',
          prevention: outcome.suggestion ?? 'Review operation parameters',
        }];
      }

      this.addEntry(operation.method, newEntry);
    }

    // Clear cache for this pattern
    this.cache.clear();
    this.updateVersion();
  }

  private updateVersion(): void {
    this.version.lastUpdated = this.clock.now().toISOString();
    this.version.patternCount = Array.from(this.entries.values())
      .reduce((sum, entries) => sum + entries.length, 0);
  }

  getEntryCount(): number {
    return this.version.patternCount;
  }

  getCacheSize(): number {
    return this.cache.size;
  }

  getCacheTTL(): number {
    return 5 * 60 * 1000; // 5 minutes in milliseconds
  }

  getMemoryUsage(): MemoryUsage {
    // Estimate memory usage of entries
    let entriesMemory = 0;
    for (const [key, entryList] of this.entries) {
      entriesMemory += new Blob([key]).size;
      entriesMemory += JSON.stringify(entryList).length * 2; // ~2 bytes per char
    }

    // Estimate memory usage of learning buffer
    let learningBufferMemory = 0;
    for (const [key, operations] of this.learningBuffer) {
      learningBufferMemory += new Blob([key]).size;
      learningBufferMemory += JSON.stringify(operations).length * 2;
    }

    // Get cache size (in bytes, as configured in sizeCalculation)
    const cacheMemoryBytes = this.cache.calculatedSize || 0;

    // Calculate total memory in MB
    const totalMemoryBytes = entriesMemory + learningBufferMemory + cacheMemoryBytes;
    const totalMemoryMB = totalMemoryBytes / (1024 * 1024);

    // Calculate cache hit rate
    const cacheHitRate = this.cacheRequests > 0
      ? this.cacheHits / this.cacheRequests
      : 0;

    return {
      totalMemoryMB,
      entriesCount: this.getEntryCount(),
      cacheSize: this.cache.size,
      learningBufferSize: this.learningBuffer.size,
      cacheHitRate,
    };
  }

  getVersion(): KnowledgeVersion {
    return { ...this.version };
  }
}
