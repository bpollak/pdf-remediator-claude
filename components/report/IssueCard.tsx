'use client';

import { AuditFinding } from '@/types/audit';
import { getSeverityColorClass } from '@/lib/utils/scoring';
import { Badge } from '@/components/ui/badge';

interface IssueCardProps {
  finding: AuditFinding;
}

export function IssueCard({ finding }: IssueCardProps) {
  return (
    <div className="border rounded-lg p-4 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${getSeverityColorClass(finding.severity)}`}>
            {finding.severity.toUpperCase()}
          </span>
          <Badge variant="outline" className="text-xs">{finding.ruleId}</Badge>
          <span className="text-xs text-muted-foreground">{finding.wcagCriterion}</span>
        </div>
        <span className="text-xs whitespace-nowrap">
          {finding.autoFixable ? (
            <span className="text-green-600 dark:text-green-400" title="Auto-fixable">Auto-fix</span>
          ) : (
            <span className="text-amber-600 dark:text-amber-400" title="Manual review needed">Manual</span>
          )}
        </span>
      </div>
      <p className="text-sm">{finding.description}</p>
      <div className="flex items-center gap-4 text-xs text-muted-foreground">
        <span>Page {finding.location.pageNumber}</span>
        {finding.location.elementType && <span>{finding.location.elementType}</span>}
      </div>
      <div className="bg-muted/50 rounded p-2 text-xs text-muted-foreground">
        <span className="font-medium">Recommendation:</span> {finding.recommendation}
      </div>
    </div>
  );
}
