'use client';

import { useEffect, useRef } from 'react';
import { DropZone } from '@/components/upload/DropZone';
import { FileQueue } from '@/components/upload/FileQueue';
import { useAppStore } from '@/stores/app-store';

export default function AppPage() {
  const files = useAppStore((s) => s.files);
  const updateFileStatus = useAppStore((s) => s.updateFileStatus);
  const updateFileProgress = useAppStore((s) => s.updateFileProgress);
  const setFileParsedData = useAppStore((s) => s.setFileParsedData);
  const setFileAuditResult = useAppStore((s) => s.setFileAuditResult);
  const setFileError = useAppStore((s) => s.setFileError);

  const parseWorkerRef = useRef<Worker | null>(null);
  const auditWorkerRef = useRef<Worker | null>(null);

  // Initialize workers
  useEffect(() => {
    parseWorkerRef.current = new Worker(
      new URL('@/workers/pdf-parse.worker.ts', import.meta.url)
    );
    auditWorkerRef.current = new Worker(
      new URL('@/workers/audit.worker.ts', import.meta.url)
    );

    // Parse worker message handler
    parseWorkerRef.current.onmessage = (event) => {
      const msg = event.data;
      switch (msg.type) {
        case 'PARSE_PROGRESS':
          updateFileProgress(msg.fileId, msg.progress, msg.message);
          break;
        case 'PARSE_COMPLETE':
          setFileParsedData(msg.fileId, msg.parsedData);
          updateFileStatus(msg.fileId, 'auditing');
          updateFileProgress(msg.fileId, 0, 'Starting audit...');
          // Start audit
          auditWorkerRef.current?.postMessage({
            type: 'RUN_AUDIT',
            fileId: msg.fileId,
            parsedData: msg.parsedData,
          });
          break;
        case 'PARSE_ERROR':
          setFileError(msg.fileId, msg.error);
          break;
      }
    };

    // Audit worker message handler
    auditWorkerRef.current.onmessage = (event) => {
      const msg = event.data;
      switch (msg.type) {
        case 'AUDIT_PROGRESS':
          updateFileProgress(msg.fileId, msg.progress, msg.message);
          break;
        case 'AUDIT_COMPLETE':
          setFileAuditResult(msg.fileId, msg.result);
          updateFileStatus(msg.fileId, 'audited');
          break;
        case 'AUDIT_ERROR':
          setFileError(msg.fileId, msg.error);
          break;
      }
    };

    return () => {
      parseWorkerRef.current?.terminate();
      auditWorkerRef.current?.terminate();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Process queued files
  useEffect(() => {
    const queuedFiles = files.filter((f) => f.status === 'queued');
    for (const file of queuedFiles) {
      updateFileStatus(file.id, 'parsing');
      updateFileProgress(file.id, 0, 'Starting PDF parsing...');
      parseWorkerRef.current?.postMessage({
        type: 'PARSE_PDF',
        fileId: file.id,
        buffer: file.originalBytes,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [files]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold mb-2">PDF Accessibility Audit & Remediation</h1>
        <p className="text-muted-foreground">
          Upload your PDF files to check for WCAG 2.1 AA accessibility issues and generate remediated accessible versions.
        </p>
      </div>
      <DropZone />
      <FileQueue />
      {files.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <p className="text-lg">No files uploaded yet</p>
          <p className="text-sm mt-1">Drop PDF files above or click to browse</p>
        </div>
      )}
    </div>
  );
}
