'use client';

import { useAppStore, FileStatus } from '@/stores/app-store';
import { formatBytes } from '@/lib/utils/file-helpers';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import Link from 'next/link';

const statusLabels: Record<FileStatus, string> = {
  queued: 'Queued',
  parsing: 'Parsing',
  auditing: 'Auditing',
  audited: 'Audit Complete',
  remediating: 'Remediating',
  remediated: 'Complete',
  error: 'Error',
};

const statusColors: Record<FileStatus, string> = {
  queued: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300',
  parsing: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  auditing: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  audited: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300',
  remediating: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
  remediated: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  error: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
};

interface FileCardProps {
  fileId: string;
}

export function FileCard({ fileId }: FileCardProps) {
  const file = useAppStore((state) => state.files.find((f) => f.id === fileId));
  const removeFile = useAppStore((state) => state.removeFile);

  if (!file) return null;

  const isProcessing = ['parsing', 'auditing', 'remediating'].includes(file.status);
  const hasReport = file.status === 'audited' || file.status === 'remediating' || file.status === 'remediated';
  const hasScore = file.auditResult != null;

  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 text-muted-foreground flex-shrink-0" aria-hidden="true">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
            </svg>
            <h3 className="font-medium text-sm truncate">{file.name}</h3>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>{formatBytes(file.size)}</span>
            <span aria-hidden="true">·</span>
            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${statusColors[file.status]}`}>
              {statusLabels[file.status]}
            </span>
            {hasScore && (
              <>
                <span aria-hidden="true">·</span>
                <span>Score: {file.auditResult!.complianceScore}%</span>
              </>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          {hasReport && (
            <Link href={`/app/${file.id}`}>
              <Button variant="outline" size="sm">
                Report
              </Button>
            </Link>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => removeFile(file.id)}
            aria-label={`Remove ${file.name}`}
            disabled={isProcessing}
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4" aria-hidden="true">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </Button>
        </div>
      </div>
      {isProcessing && (
        <div className="mt-3">
          <Progress value={file.progress} className="h-2" />
          <p className="text-xs text-muted-foreground mt-1">
            {file.progressMessage || `${file.status}... ${file.progress}%`}
          </p>
        </div>
      )}
      {file.status === 'error' && (
        <p className="mt-2 text-xs text-red-600 dark:text-red-400">
          {file.error || 'An unknown error occurred'}
        </p>
      )}
    </Card>
  );
}
