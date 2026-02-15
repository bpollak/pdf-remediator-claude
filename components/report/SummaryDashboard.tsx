'use client';

import { AuditResult } from '@/types/audit';
import { ComplianceScore } from './ComplianceScore';
import { groupByCategory, getCategoryLabel } from '@/lib/utils/scoring';
import { Card } from '@/components/ui/card';

interface SummaryDashboardProps {
  result: AuditResult;
}

export function SummaryDashboard({ result }: SummaryDashboardProps) {
  const grouped = groupByCategory(result.findings);
  const categories = Object.entries(grouped);
  const total = result.totalIssues || 1;

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <ComplianceScore
        score={result.complianceScore}
        totalIssues={result.totalIssues}
        criticalCount={result.criticalCount}
        majorCount={result.majorCount}
        minorCount={result.minorCount}
      />
      <Card className="p-6">
        <h3 className="font-semibold mb-4">Issues by Category</h3>
        <div className="space-y-3">
          {categories.length === 0 && (
            <p className="text-sm text-muted-foreground">No issues found!</p>
          )}
          {categories.map(([category, findings]) => {
            const pct = Math.round((findings.length / total) * 100);
            return (
              <div key={category}>
                <div className="flex justify-between text-sm mb-1">
                  <span>{getCategoryLabel(category)}</span>
                  <span className="text-muted-foreground">{findings.length}</span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary rounded-full transition-all"
                    style={{ width: `${pct}%` }}
                    role="progressbar"
                    aria-valuenow={pct}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-label={`${getCategoryLabel(category)}: ${findings.length} issues`}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}
