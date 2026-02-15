'use client';

import { useState, useMemo } from 'react';
import { AuditResult, Severity, Category } from '@/types/audit';
import { IssueCard } from './IssueCard';
import { ReportFilters } from './ReportFilters';
import { groupByCategory, getCategoryLabel } from '@/lib/utils/scoring';

interface IssueListProps {
  result: AuditResult;
}

export function IssueList({ result }: IssueListProps) {
  const [selectedSeverities, setSelectedSeverities] = useState<Set<Severity>>(
    () => new Set<Severity>(['critical', 'major', 'minor'])
  );
  const [selectedCategories, setSelectedCategories] = useState<Set<Category>>(
    () => new Set<Category>([
      'document-structure', 'headings', 'images', 'tables',
      'lists', 'links', 'color', 'forms', 'metadata',
    ])
  );
  const [showAutoFixable, setShowAutoFixable] = useState<boolean | null>(null);

  const filteredFindings = useMemo(() => {
    return result.findings.filter((f) => {
      if (!selectedSeverities.has(f.severity)) return false;
      if (!selectedCategories.has(f.category)) return false;
      if (showAutoFixable !== null && f.autoFixable !== showAutoFixable) return false;
      return true;
    });
  }, [result.findings, selectedSeverities, selectedCategories, showAutoFixable]);

  const grouped = useMemo(() => groupByCategory(filteredFindings), [filteredFindings]);

  const toggleSeverity = (s: Severity) => {
    setSelectedSeverities((prev) => {
      const next = new Set(prev);
      if (next.has(s)) next.delete(s);
      else next.add(s);
      return next;
    });
  };

  const toggleCategory = (c: Category) => {
    setSelectedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(c)) next.delete(c);
      else next.add(c);
      return next;
    });
  };

  return (
    <div className="space-y-6">
      <ReportFilters
        selectedSeverities={selectedSeverities}
        selectedCategories={selectedCategories}
        showAutoFixable={showAutoFixable}
        onSeverityToggle={toggleSeverity}
        onCategoryToggle={toggleCategory}
        onAutoFixableChange={setShowAutoFixable}
      />
      <div className="text-sm text-muted-foreground">
        Showing {filteredFindings.length} of {result.totalIssues} issues
      </div>
      {Object.entries(grouped).length === 0 ? (
        <p className="text-muted-foreground text-center py-8">
          No issues match the current filters.
        </p>
      ) : (
        <div className="space-y-6">
          {Object.entries(grouped).map(([category, findings]) => (
            <div key={category}>
              <h3 className="font-semibold text-base mb-3">{getCategoryLabel(category)}</h3>
              <div className="space-y-3">
                {findings.map((finding, i) => (
                  <IssueCard key={`${finding.ruleId}-${i}`} finding={finding} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
