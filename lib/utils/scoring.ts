import { AuditFinding } from '@/types/audit';

/**
 * Calculate compliance score as percentage
 * Based on rules passed vs total applicable rules
 */
export function calculateComplianceScore(
  passedRules: string[],
  failedRules: string[],
  totalApplicable: number
): number {
  if (totalApplicable === 0) return 100;
  const score = (passedRules.length / totalApplicable) * 100;
  return Math.round(score * 10) / 10;
}

/**
 * Get color class for score
 */
export function getScoreColorClass(score: number): string {
  if (score >= 85) return 'text-green-600 dark:text-green-400';
  if (score >= 50) return 'text-amber-600 dark:text-amber-400';
  return 'text-red-600 dark:text-red-400';
}

/**
 * Get background color class for score
 */
export function getScoreBgClass(score: number): string {
  if (score >= 85) return 'bg-green-100 dark:bg-green-900/30';
  if (score >= 50) return 'bg-amber-100 dark:bg-amber-900/30';
  return 'bg-red-100 dark:bg-red-900/30';
}

/**
 * Get severity color class
 */
export function getSeverityColorClass(severity: 'critical' | 'major' | 'minor'): string {
  switch (severity) {
    case 'critical': return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300';
    case 'major': return 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300';
    case 'minor': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300';
  }
}

/**
 * Get severity badge variant
 */
export function getSeverityVariant(severity: 'critical' | 'major' | 'minor'): 'destructive' | 'default' | 'secondary' {
  switch (severity) {
    case 'critical': return 'destructive';
    case 'major': return 'default';
    case 'minor': return 'secondary';
  }
}

/**
 * Group findings by category
 */
export function groupByCategory(findings: AuditFinding[]): Record<string, AuditFinding[]> {
  return findings.reduce((acc, finding) => {
    if (!acc[finding.category]) acc[finding.category] = [];
    acc[finding.category].push(finding);
    return acc;
  }, {} as Record<string, AuditFinding[]>);
}

/**
 * Get human-readable category name
 */
export function getCategoryLabel(category: string): string {
  const labels: Record<string, string> = {
    'document-structure': 'Document Structure',
    'headings': 'Headings & Structure',
    'images': 'Images & Non-Text Content',
    'tables': 'Tables',
    'lists': 'Lists',
    'links': 'Links & Navigation',
    'color': 'Color & Visual',
    'forms': 'Forms',
    'metadata': 'Metadata & Navigation',
  };
  return labels[category] || category;
}
