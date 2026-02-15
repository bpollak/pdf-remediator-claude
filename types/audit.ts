export type Severity = 'critical' | 'major' | 'minor';
export type Category =
  | 'document-structure'
  | 'headings'
  | 'images'
  | 'tables'
  | 'lists'
  | 'links'
  | 'color'
  | 'forms'
  | 'metadata';

export interface AuditFinding {
  ruleId: string;
  category: Category;
  severity: Severity;
  description: string;
  location: {
    pageNumber: number; // 1-based
    elementType?: string;
    elementDetail?: string;
  };
  wcagCriterion: string;
  recommendation: string;
  autoFixable: boolean;
}

export interface AuditResult {
  findings: AuditFinding[];
  totalIssues: number;
  criticalCount: number;
  majorCount: number;
  minorCount: number;
  passedRules: string[];
  failedRules: string[];
  totalApplicableRules: number;
  complianceScore: number; // 0-100
  timestamp: string;
}
