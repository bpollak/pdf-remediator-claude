import { create } from 'zustand';
import { ParsedPDF } from '@/types/pdf';
import { AuditResult } from '@/types/audit';

export type FileStatus = 'queued' | 'parsing' | 'auditing' | 'audited' | 'remediating' | 'remediated' | 'error';

export interface FileEntry {
  id: string;
  name: string;
  size: number;
  originalBytes: ArrayBuffer;
  status: FileStatus;
  progress: number;
  progressMessage: string;
  parsedData?: ParsedPDF;
  auditResult?: AuditResult;
  remediatedBytes?: ArrayBuffer;
  postRemediationAudit?: AuditResult;
  error?: string;
}

interface AppState {
  files: FileEntry[];
  darkMode: boolean;

  // File management
  addFiles: (files: Array<{ name: string; size: number; bytes: ArrayBuffer }>) => string[];
  removeFile: (id: string) => void;
  clearAll: () => void;

  // Status updates
  updateFileStatus: (id: string, status: FileStatus) => void;
  updateFileProgress: (id: string, progress: number, message?: string) => void;
  setFileParsedData: (id: string, data: ParsedPDF) => void;
  setFileAuditResult: (id: string, result: AuditResult) => void;
  setFileRemediatedBytes: (id: string, bytes: ArrayBuffer) => void;
  setFilePostRemediationAudit: (id: string, result: AuditResult) => void;
  setFileError: (id: string, error: string) => void;

  // UI
  toggleDarkMode: () => void;

  // Getters
  getFile: (id: string) => FileEntry | undefined;
}

export const useAppStore = create<AppState>((set, get) => ({
  files: [],
  darkMode: false,

  // ---------------------------------------------------------------------------
  // File management
  // ---------------------------------------------------------------------------

  addFiles: (incoming) => {
    const newEntries: FileEntry[] = incoming.map((f) => ({
      id: crypto.randomUUID(),
      name: f.name,
      size: f.size,
      originalBytes: f.bytes,
      status: 'queued' as FileStatus,
      progress: 0,
      progressMessage: '',
    }));

    set((state) => ({ files: [...state.files, ...newEntries] }));

    return newEntries.map((e) => e.id);
  },

  removeFile: (id) => {
    set((state) => ({ files: state.files.filter((f) => f.id !== id) }));
  },

  clearAll: () => {
    set({ files: [] });
  },

  // ---------------------------------------------------------------------------
  // Status updates
  // ---------------------------------------------------------------------------

  updateFileStatus: (id, status) => {
    set((state) => ({
      files: state.files.map((f) =>
        f.id === id ? { ...f, status } : f,
      ),
    }));
  },

  updateFileProgress: (id, progress, message) => {
    set((state) => ({
      files: state.files.map((f) =>
        f.id === id
          ? { ...f, progress, progressMessage: message ?? f.progressMessage }
          : f,
      ),
    }));
  },

  setFileParsedData: (id, data) => {
    set((state) => ({
      files: state.files.map((f) =>
        f.id === id ? { ...f, parsedData: data } : f,
      ),
    }));
  },

  setFileAuditResult: (id, result) => {
    set((state) => ({
      files: state.files.map((f) =>
        f.id === id ? { ...f, auditResult: result } : f,
      ),
    }));
  },

  setFileRemediatedBytes: (id, bytes) => {
    set((state) => ({
      files: state.files.map((f) =>
        f.id === id ? { ...f, remediatedBytes: bytes } : f,
      ),
    }));
  },

  setFilePostRemediationAudit: (id, result) => {
    set((state) => ({
      files: state.files.map((f) =>
        f.id === id ? { ...f, postRemediationAudit: result } : f,
      ),
    }));
  },

  setFileError: (id, error) => {
    set((state) => ({
      files: state.files.map((f) =>
        f.id === id ? { ...f, status: 'error' as FileStatus, error } : f,
      ),
    }));
  },

  // ---------------------------------------------------------------------------
  // UI
  // ---------------------------------------------------------------------------

  toggleDarkMode: () => {
    set((state) => {
      const next = !state.darkMode;
      if (typeof document !== 'undefined') {
        document.documentElement.classList.toggle('dark', next);
      }
      return { darkMode: next };
    });
  },

  // ---------------------------------------------------------------------------
  // Getters
  // ---------------------------------------------------------------------------

  getFile: (id) => {
    return get().files.find((f) => f.id === id);
  },
}));
