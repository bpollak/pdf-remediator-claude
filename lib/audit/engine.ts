import type { AuditFinding, AuditResult } from '@/types/audit';
import type { ParsedPDF } from '@/types/pdf';
import {
  docStructureRules,
  headingRules,
  imageRules,
  tableRules,
  listRules,
  linkRules,
  colorRules,
  formRules,
  metadataRules,
} from './rules';
import { calculateComplianceScore } from '@/lib/utils/scoring';

/**
 * All rule IDs defined across all rule modules.
 */
const ALL_RULE_IDS: string[] = [
  'DOC-001',
  'DOC-002',
  'DOC-003',
  'DOC-004',
  'DOC-005',
  'HDG-001',
  'HDG-002',
  'HDG-003',
  'IMG-001',
  'IMG-002',
  'IMG-003',
  'TBL-001',
  'TBL-002',
  'TBL-003',
  'LST-001',
  'LNK-001',
  'LNK-002',
  'CLR-001',
  'CLR-002',
  'FRM-001',
  'FRM-002',
  'META-001',
  'META-002',
];

/**
 * Rule module registry. Each entry maps a module name to its function.
 */
const RULE_REGISTRY: { name: string; fn: (pdf: ParsedPDF) => AuditFinding[] }[] = [
  { name: 'Document Structure', fn: docStructureRules },
  { name: 'Headings', fn: headingRules },
  { name: 'Images', fn: imageRules },
  { name: 'Tables', fn: tableRules },
  { name: 'Lists', fn: listRules },
  { name: 'Links', fn: linkRules },
  { name: 'Color & Contrast', fn: colorRules },
  { name: 'Forms', fn: formRules },
  { name: 'Metadata', fn: metadataRules },
];

/**
 * Run a complete accessibility audit on a parsed PDF document.
 *
 * @param pdf - The parsed PDF document to audit.
 * @param onProgress - Optional callback for progress updates (0-100 percentage and message).
 * @returns The complete audit result with findings, scores, and statistics.
 */
export function runAudit(
  pdf: ParsedPDF,
  onProgress?: (progress: number, message: string) => void
): AuditResult {
  const allFindings: AuditFinding[] = [];
  const totalModules = RULE_REGISTRY.length;

  for (let i = 0; i < RULE_REGISTRY.length; i++) {
    const ruleModule = RULE_REGISTRY[i];

    // Report progress
    if (onProgress) {
      const progress = Math.round((i / totalModules) * 100);
      onProgress(progress, `Checking ${ruleModule.name}...`);
    }

    try {
      const findings = ruleModule.fn(pdf);
      allFindings.push(...findings);
    } catch (error) {
      // Don't let one rule module crash the entire audit.
      // Log the error and continue with other modules.
      console.error(
        `Audit module "${ruleModule.name}" threw an error:`,
        error instanceof Error ? error.message : error
      );
    }
  }

  // Report completion
  if (onProgress) {
    onProgress(100, 'Audit complete.');
  }

  // Determine which rule IDs produced findings (failed) and which did not (passed)
  const failedRuleIdSet = new Set(allFindings.map((f) => f.ruleId));
  const failedRules = ALL_RULE_IDS.filter((id) => failedRuleIdSet.has(id));
  const passedRules = ALL_RULE_IDS.filter((id) => !failedRuleIdSet.has(id));

  // Count findings by severity
  let criticalCount = 0;
  let majorCount = 0;
  let minorCount = 0;

  for (const finding of allFindings) {
    switch (finding.severity) {
      case 'critical':
        criticalCount++;
        break;
      case 'major':
        majorCount++;
        break;
      case 'minor':
        minorCount++;
        break;
    }
  }

  const totalApplicableRules = ALL_RULE_IDS.length;
  const complianceScore = calculateComplianceScore(
    passedRules,
    failedRules,
    totalApplicableRules
  );

  return {
    findings: allFindings,
    totalIssues: allFindings.length,
    criticalCount,
    majorCount,
    minorCount,
    passedRules,
    failedRules,
    totalApplicableRules,
    complianceScore,
    timestamp: new Date().toISOString(),
  };
}
