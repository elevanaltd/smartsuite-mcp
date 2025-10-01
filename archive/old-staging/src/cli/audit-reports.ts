// Context7: consulted for path
import * as path from 'path';

import { AuditLogger } from '../audit/audit-logger.js';
import type { ComplianceReport } from '../audit/audit-logger.js';

/**
 * CLI command for generating compliance reports from audit trail
 */
export async function generateComplianceReport(
  standard: 'SOC2' | 'GDPR',
  auditFilePath?: string,
  outputFormat: 'json' | 'text' = 'text',
): Promise<void> {
  const auditPath = auditFilePath ?? path.join(process.cwd(), 'audit-trail.ndjson');
  const auditLogger = new AuditLogger(auditPath);

  try {
    const report = await auditLogger.generateComplianceReport(standard);

    if (outputFormat === 'json') {
      console.log(JSON.stringify(report, null, 2));
    } else {
      printTextReport(report);
    }
  } catch (error) {
    console.error(`Failed to generate ${standard} compliance report:`, error);
    process.exit(1);
  }
}

function printTextReport(report: ComplianceReport): void {
  console.log(`\n=== ${report.standard} COMPLIANCE REPORT ===`);
  console.log(`Report Date: ${report.reportDate.toISOString()}`);
  console.log('\nOperations Summary:');
  console.log(`  Total Operations: ${report.totalOperations}`);
  console.log(`  Create: ${report.operationsByType.create}`);
  console.log(`  Update: ${report.operationsByType.update}`);
  console.log(`  Delete: ${report.operationsByType.delete}`);

  console.log(`\nAffected Tables: ${report.affectedTables.join(', ')}`);

  console.log('\nDate Range:');
  console.log(`  From: ${report.dateRange.from.toISOString()}`);
  console.log(`  To: ${report.dateRange.to.toISOString()}`);

  console.log('\nRetention Analysis:');
  console.log(`  Total Entries: ${report.retentionAnalysis.totalEntries}`);
  console.log(`  Oldest Entry: ${report.retentionAnalysis.oldestEntry.toISOString()}`);
  console.log(`  Newest Entry: ${report.retentionAnalysis.newestEntry.toISOString()}`);

  if (report.standard === 'GDPR') {
    console.log('\nGDPR-Specific Analysis:');
    console.log(`  Personal Data Operations: ${report.personalDataOperations?.length ?? 0}`);
    console.log(`  Data Subjects: ${report.dataSubjects?.length ?? 0}`);
    console.log(`  Right to Erasure Records: ${report.rightToErasure?.length ?? 0}`);
  }
}

// CLI argument parsing for direct execution
if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  const standard = args[0] as 'SOC2' | 'GDPR';
  const auditFile = args[1];
  const format = args[2] as 'json' | 'text';

  if (!standard || !['SOC2', 'GDPR'].includes(standard)) {
    console.error('Usage: node audit-reports.js <SOC2|GDPR> [audit-file-path] [json|text]');
    process.exit(1);
  }

  await generateComplianceReport(standard, auditFile, format || 'text');
}
