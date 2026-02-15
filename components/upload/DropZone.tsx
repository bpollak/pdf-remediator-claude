'use client';

import { useCallback, useState, useRef } from 'react';
import { useAppStore } from '@/stores/app-store';
import { validateFile, isPdfFile, MAX_BATCH_SIZE } from '@/lib/utils/file-helpers';
import { toast } from 'sonner';

export function DropZone() {
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { files, addFiles } = useAppStore();

  const processFiles = useCallback(async (fileList: FileList | File[]) => {
    const filesArray = Array.from(fileList);
    const remainingSlots = MAX_BATCH_SIZE - files.length;

    if (filesArray.length > remainingSlots) {
      toast.error(`Can only add ${remainingSlots} more file(s). Maximum ${MAX_BATCH_SIZE} files per batch.`);
      return;
    }

    const validFiles: Array<{ name: string; size: number; bytes: ArrayBuffer }> = [];

    for (const file of filesArray) {
      const validation = validateFile(file);
      if (!validation.valid) {
        toast.error(`${file.name}: ${validation.error}`);
        continue;
      }

      try {
        const bytes = await file.arrayBuffer();
        if (!isPdfFile(bytes)) {
          toast.error(`${file.name}: Not a valid PDF file`);
          continue;
        }
        validFiles.push({ name: file.name, size: file.size, bytes });
      } catch {
        toast.error(`${file.name}: Failed to read file`);
      }
    }

    if (validFiles.length > 0) {
      addFiles(validFiles);
      toast.success(`Added ${validFiles.length} file(s) for processing`);
    }
  }, [files.length, addFiles]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files.length > 0) {
      processFiles(e.dataTransfer.files);
    }
  }, [processFiles]);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processFiles(e.target.files);
      e.target.value = '';
    }
  }, [processFiles]);

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label="Upload PDF files. Drag and drop or click to browse."
      className={`
        relative border-2 border-dashed rounded-lg p-8 md:p-12 text-center cursor-pointer
        transition-colors duration-200
        ${isDragging
          ? 'border-primary bg-primary/5'
          : 'border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/50'
        }
      `}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={() => fileInputRef.current?.click()}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          fileInputRef.current?.click();
        }
      }}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,application/pdf"
        multiple
        className="hidden"
        onChange={handleFileInput}
        aria-hidden="true"
        tabIndex={-1}
      />
      <div className="flex flex-col items-center gap-4">
        <div className="rounded-full bg-muted p-4">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-8 w-8 text-muted-foreground"
            aria-hidden="true"
          >
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="17 8 12 3 7 8" />
            <line x1="12" y1="3" x2="12" y2="15" />
          </svg>
        </div>
        <div>
          <p className="text-lg font-medium">
            {isDragging ? 'Drop PDF files here' : 'Drag & drop PDF files here'}
          </p>
          <p className="text-sm text-muted-foreground mt-1">
            or click to browse — Max {MAX_BATCH_SIZE} files, 50MB each
          </p>
        </div>
      </div>
    </div>
  );
}
