'use client';

import { getScoreColorClass, getScoreBgClass } from '@/lib/utils/scoring';

interface ComplianceScoreProps {
  score: number;
  totalIssues: number;
  criticalCount: number;
  majorCount: number;
  minorCount: number;
}

export function ComplianceScore({ score, totalIssues, criticalCount, majorCount, minorCount }: ComplianceScoreProps) {
  const colorClass = getScoreColorClass(score);
  const bgClass = getScoreBgClass(score);
  const label = score >= 85 ? 'Good' : score >= 50 ? 'Needs Improvement' : 'Poor';

  return (
    <div className={`rounded-lg p-6 ${bgClass}`}>
      <div className="text-center">
        <div className={`text-5xl font-bold ${colorClass}`}>
          {score}%
        </div>
        <p className={`text-sm font-medium mt-1 ${colorClass}`}>{label}</p>
        <p className="text-xs text-muted-foreground mt-2">WCAG 2.1 AA Compliance Score</p>
      </div>
      <div className="mt-4 flex justify-center gap-4">
        <div className="text-center">
          <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300 text-sm font-bold">
            {criticalCount}
          </span>
          <p className="text-xs text-muted-foreground mt-1">Critical</p>
        </div>
        <div className="text-center">
          <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-orange-100 text-orange-800 dark:bg-orange-900/50 dark:text-orange-300 text-sm font-bold">
            {majorCount}
          </span>
          <p className="text-xs text-muted-foreground mt-1">Major</p>
        </div>
        <div className="text-center">
          <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-300 text-sm font-bold">
            {minorCount}
          </span>
          <p className="text-xs text-muted-foreground mt-1">Minor</p>
        </div>
      </div>
      <p className="text-center text-xs text-muted-foreground mt-3">
        {totalIssues} total issue{totalIssues !== 1 ? 's' : ''} found
      </p>
    </div>
  );
}
