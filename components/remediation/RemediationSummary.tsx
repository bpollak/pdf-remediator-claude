'use client';

import { AuditResult } from '@/types/audit';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { downloadFile } from '@/lib/utils/file-helpers';
import Link from 'next/link';

interface RemediationSummaryProps {
  originalAudit: AuditResult;
  postAudit: AuditResult | undefined;
  remediatedBytes: ArrayBuffer;
  fileName: string;
  fileId: string;
  warnings: string[];
}

export function RemediationSummary({ originalAudit, postAudit, remediatedBytes, fileName, fileId, warnings }: RemediationSummaryProps) {
  const handleDownload = () => {
    const name = fileName.replace(/\.pdf$/i, '') + '-accessible.pdf';
    downloadFile(remediatedBytes, name);
  };

  return (
    <Card className="p-6 space-y-4">
      <h3 className="text-lg font-semibold text-green-700 dark:text-green-400">Remediation Complete</h3>

      <div className="grid grid-cols-2 gap-4 text-center">
        <div className="border rounded-lg p-4">
          <p className="text-sm text-muted-foreground">Original Score</p>
          <p className="text-2xl font-bold">{originalAudit.complianceScore}%</p>
          <p className="text-xs text-muted-foreground">{originalAudit.totalIssues} issues</p>
        </div>
        <div className="border rounded-lg p-4">
          <p className="text-sm text-muted-foreground">Remediated Score</p>
          <p className="text-2xl font-bold text-green-600 dark:text-green-400">
            {postAudit ? `${postAudit.complianceScore}%` : 'N/A'}
          </p>
          <p className="text-xs text-muted-foreground">
            {postAudit ? `${postAudit.totalIssues} issues` : ''}
          </p>
        </div>
      </div>

      {warnings.length > 0 && (
        <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg p-3 space-y-1">
          <p className="text-xs font-medium text-amber-800 dark:text-amber-300">Notes:</p>
          <ul className="text-xs text-amber-700 dark:text-amber-400 space-y-1">
            {warnings.map((w, i) => (
              <li key={i}>- {w}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex gap-2">
        <Button onClick={handleDownload} className="flex-1">
          Download Accessible PDF
        </Button>
        <Link href={`/app/${fileId}/compare`}>
          <Button variant="outline">Compare</Button>
        </Link>
      </div>
    </Card>
  );
}
