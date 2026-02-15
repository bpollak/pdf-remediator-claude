import { ParsedPDF } from './pdf';
import { AuditResult } from './audit';

// Parse worker messages
export interface ParseWorkerRequest {
  type: 'PARSE_PDF';
  fileId: string;
  buffer: ArrayBuffer;
}

export interface ParseWorkerProgress {
  type: 'PARSE_PROGRESS';
  fileId: string;
  progress: number; // 0-100
  message: string;
}

export interface ParseWorkerResult {
  type: 'PARSE_COMPLETE';
  fileId: string;
  parsedData: ParsedPDF;
}

export interface ParseWorkerError {
  type: 'PARSE_ERROR';
  fileId: string;
  error: string;
}

export type ParseWorkerMessage = ParseWorkerProgress | ParseWorkerResult | ParseWorkerError;

// Audit worker messages
export interface AuditWorkerRequest {
  type: 'RUN_AUDIT';
  fileId: string;
  parsedData: ParsedPDF;
}

export interface AuditWorkerProgress {
  type: 'AUDIT_PROGRESS';
  fileId: string;
  progress: number;
  message: string;
}

export interface AuditWorkerResult {
  type: 'AUDIT_COMPLETE';
  fileId: string;
  result: AuditResult;
}

export interface AuditWorkerError {
  type: 'AUDIT_ERROR';
  fileId: string;
  error: string;
}

export type AuditWorkerMessage = AuditWorkerProgress | AuditWorkerResult | AuditWorkerError;

// Remediate worker messages
export interface RemediateWorkerRequest {
  type: 'REMEDIATE_PDF';
  fileId: string;
  parsedData: ParsedPDF;
  options: RemediationOptions;
}

export interface RemediationOptions {
  language: string; // e.g., 'en-US'
  title?: string;
}

export interface RemediateWorkerProgress {
  type: 'REMEDIATE_PROGRESS';
  fileId: string;
  progress: number;
  message: string;
}

export interface RemediateWorkerResult {
  type: 'REMEDIATE_COMPLETE';
  fileId: string;
  pdfBytes: ArrayBuffer;
}

export interface RemediateWorkerError {
  type: 'REMEDIATE_ERROR';
  fileId: string;
  error: string;
}

export type RemediateWorkerMessage = RemediateWorkerProgress | RemediateWorkerResult | RemediateWorkerError;
