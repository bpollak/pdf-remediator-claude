'use client';

import { Severity, Category } from '@/types/audit';
import { Button } from '@/components/ui/button';
import { getCategoryLabel } from '@/lib/utils/scoring';

interface ReportFiltersProps {
  selectedSeverities: Set<Severity>;
  selectedCategories: Set<Category>;
  showAutoFixable: boolean | null; // null = all, true = fixable, false = manual
  onSeverityToggle: (s: Severity) => void;
  onCategoryToggle: (c: Category) => void;
  onAutoFixableChange: (v: boolean | null) => void;
}

const severities: Severity[] = ['critical', 'major', 'minor'];
const categories: Category[] = [
  'document-structure', 'headings', 'images', 'tables',
  'lists', 'links', 'color', 'forms', 'metadata'
];

const severityColors: Record<Severity, string> = {
  critical: 'bg-red-100 text-red-800 border-red-300 dark:bg-red-900/30 dark:text-red-300 dark:border-red-700',
  major: 'bg-orange-100 text-orange-800 border-orange-300 dark:bg-orange-900/30 dark:text-orange-300 dark:border-orange-700',
  minor: 'bg-yellow-100 text-yellow-800 border-yellow-300 dark:bg-yellow-900/30 dark:text-yellow-300 dark:border-yellow-700',
};

export function ReportFilters({
  selectedSeverities,
  selectedCategories,
  showAutoFixable,
  onSeverityToggle,
  onCategoryToggle,
  onAutoFixableChange,
}: ReportFiltersProps) {
  return (
    <div className="space-y-4">
      <div>
        <h4 className="text-sm font-medium mb-2">Severity</h4>
        <div className="flex flex-wrap gap-2">
          {severities.map((s) => (
            <button
              key={s}
              onClick={() => onSeverityToggle(s)}
              className={`px-3 py-1 rounded-full text-xs font-medium border transition-opacity ${severityColors[s]} ${
                selectedSeverities.has(s) ? 'opacity-100' : 'opacity-40'
              }`}
              aria-pressed={selectedSeverities.has(s)}
              aria-label={`Filter by ${s} severity`}
            >
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>
      </div>
      <div>
        <h4 className="text-sm font-medium mb-2">Category</h4>
        <div className="flex flex-wrap gap-2">
          {categories.map((c) => (
            <button
              key={c}
              onClick={() => onCategoryToggle(c)}
              className={`px-3 py-1 rounded-full text-xs font-medium border transition-opacity ${
                selectedCategories.has(c)
                  ? 'bg-primary/10 text-primary border-primary/30'
                  : 'bg-muted text-muted-foreground border-muted opacity-60'
              }`}
              aria-pressed={selectedCategories.has(c)}
              aria-label={`Filter by ${getCategoryLabel(c)}`}
            >
              {getCategoryLabel(c)}
            </button>
          ))}
        </div>
      </div>
      <div>
        <h4 className="text-sm font-medium mb-2">Fixability</h4>
        <div className="flex gap-2">
          {[
            { label: 'All', value: null },
            { label: 'Auto-fixable', value: true },
            { label: 'Manual', value: false },
          ].map(({ label, value }) => (
            <Button
              key={label}
              variant={showAutoFixable === value ? 'default' : 'outline'}
              size="sm"
              onClick={() => onAutoFixableChange(value as boolean | null)}
              aria-pressed={showAutoFixable === value}
            >
              {label}
            </Button>
          ))}
        </div>
      </div>
    </div>
  );
}
