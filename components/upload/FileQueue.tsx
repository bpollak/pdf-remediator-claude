'use client';

import { useAppStore } from '@/stores/app-store';
import { FileCard } from './FileCard';
import { Button } from '@/components/ui/button';

export function FileQueue() {
  const { files, clearAll } = useAppStore();

  if (files.length === 0) {
    return null;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">
          Files ({files.length})
        </h2>
        <Button variant="outline" size="sm" onClick={clearAll}>
          Clear All
        </Button>
      </div>
      <div className="space-y-2" role="list" aria-label="Uploaded files">
        {files.map((file) => (
          <div key={file.id} role="listitem">
            <FileCard fileId={file.id} />
          </div>
        ))}
      </div>
    </div>
  );
}
