'use client';

import { useParams } from 'next/navigation';
import { useAppStore } from '@/stores/app-store';
import { SummaryDashboard } from '@/components/report/SummaryDashboard';
import { IssueList } from '@/components/report/IssueList';
import { ExportButton } from '@/components/report/ExportButton';
import { RemediationPanel } from '@/components/remediation/RemediationPanel';
import { RemediationProgress } from '@/components/remediation/RemediationProgress';
import { RemediationSummary } from '@/components/remediation/RemediationSummary';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { useEffect, useRef, useCallback, useState } from 'react';

export default function FileReportPage() {
  const params = useParams();
  const fileId = params.fileId as string;
  const file = useAppStore((s) => s.files.find((f) => f.id === fileId));
  const updateFileStatus = useAppStore((s) => s.updateFileStatus);
  const updateFileProgress = useAppStore((s) => s.updateFileProgress);
  const setFileRemediatedBytes = useAppStore((s) => s.setFileRemediatedBytes);
  const setFilePostRemediationAudit = useAppStore((s) => s.setFilePostRemediationAudit);
  const setFileError = useAppStore((s) => s.setFileError);

  const remediateWorkerRef = useRef<Worker | null>(null);
  const auditWorkerRef = useRef<Worker | null>(null);
  const [warnings] = useState<string[]>([
    'Font substitution was applied. Visual appearance uses standard fonts as substitutes.',
  ]);

  useEffect(() => {
    remediateWorkerRef.current = new Worker(
      new URL('@/workers/remediate.worker.ts', import.meta.url)
    );
    auditWorkerRef.current = new Worker(
      new URL('@/workers/audit.worker.ts', import.meta.url)
    );

    remediateWorkerRef.current.onmessage = (event: MessageEvent) => {
      const msg = event.data;
      switch (msg.type) {
        case 'REMEDIATE_PROGRESS':
          updateFileProgress(msg.fileId, msg.progress, msg.message);
          break;
        case 'REMEDIATE_COMPLETE':
          setFileRemediatedBytes(msg.fileId, msg.pdfBytes);
          updateFileStatus(msg.fileId, 'remediated');
          break;
        case 'REMEDIATE_ERROR':
          setFileError(msg.fileId, msg.error);
          break;
      }
    };

    auditWorkerRef.current.onmessage = (event: MessageEvent) => {
      const msg = event.data;
      if (msg.type === 'AUDIT_COMPLETE') {
        setFilePostRemediationAudit(msg.fileId, msg.result);
      }
    };

    return () => {
      remediateWorkerRef.current?.terminate();
      auditWorkerRef.current?.terminate();
    };
  }, [updateFileProgress, setFileRemediatedBytes, updateFileStatus, setFileError, setFilePostRemediationAudit]);

  const handleRemediate = useCallback((options: { language: string; title: string }) => {
    if (!file?.parsedData) return;
    updateFileStatus(file.id, 'remediating');
    updateFileProgress(file.id, 0, 'Starting remediation...');
    remediateWorkerRef.current?.postMessage({
      type: 'REMEDIATE_PDF',
      fileId: file.id,
      parsedData: file.parsedData,
      options,
    });
  }, [file?.id, file?.parsedData, updateFileStatus, updateFileProgress]);

  if (!file) {
    return (
      <div className="text-center py-12">
        <h1 className="text-xl font-bold">File not found</h1>
        <p className="text-muted-foreground mt-2">This file may have been removed.</p>
        <Link href="/app"><Button variant="outline" className="mt-4">Back to App</Button></Link>
      </div>
    );
  }

  if (!file.auditResult) {
    return (
      <div className="text-center py-12">
        <h1 className="text-xl font-bold">Audit in progress</h1>
        <p className="text-muted-foreground mt-2">Please wait for the audit to complete.</p>
        <Link href="/app"><Button variant="outline" className="mt-4">Back to App</Button></Link>
      </div>
    );
  }

  const defaultTitle = file.parsedData?.metadata?.title || file.name.replace(/\.pdf$/i, '');

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <Link href="/app" className="text-sm text-muted-foreground hover:text-foreground mb-1 inline-block">&larr; Back to files</Link>
          <h1 className="text-2xl font-bold">{file.name}</h1>
        </div>
        <ExportButton result={file.auditResult} fileName={file.name.replace(/\.pdf$/i, '')} />
      </div>

      <SummaryDashboard result={file.auditResult} />

      <div className="grid gap-8 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <h2 className="text-xl font-semibold mb-4">Issues</h2>
          <IssueList result={file.auditResult} />
        </div>
        <div>
          {file.status === 'audited' && (
            <RemediationPanel
              defaultTitle={defaultTitle}
              onRemediate={handleRemediate}
              isRemediating={false}
            />
          )}
          {file.status === 'remediating' && (
            <RemediationProgress progress={file.progress} message={file.progressMessage} />
          )}
          {file.status === 'remediated' && file.remediatedBytes && (
            <RemediationSummary
              originalAudit={file.auditResult}
              postAudit={file.postRemediationAudit}
              remediatedBytes={file.remediatedBytes}
              fileName={file.name}
              fileId={file.id}
              warnings={warnings}
            />
          )}
        </div>
      </div>
    </div>
  );
}
