'use client';

import { useParams } from 'next/navigation';
import { useAppStore } from '@/stores/app-store';
import { SideBySide } from '@/components/preview/SideBySide';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

export default function ComparePage() {
  const params = useParams();
  const fileId = params.fileId as string;
  const file = useAppStore((s) => s.files.find((f) => f.id === fileId));

  if (!file) {
    return (
      <div className="text-center py-12">
        <h1 className="text-xl font-bold">File not found</h1>
        <Link href="/app"><Button variant="outline" className="mt-4">Back to App</Button></Link>
      </div>
    );
  }

  if (!file.remediatedBytes) {
    return (
      <div className="text-center py-12">
        <h1 className="text-xl font-bold">No remediated PDF available</h1>
        <p className="text-muted-foreground mt-2">Please run remediation first.</p>
        <Link href={`/app/${fileId}`}><Button variant="outline" className="mt-4">Back to Report</Button></Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <Link href={`/app/${fileId}`} className="text-sm text-muted-foreground hover:text-foreground mb-1 inline-block">&larr; Back to report</Link>
          <h1 className="text-xl font-bold">{file.name} — Before &amp; After</h1>
        </div>
      </div>
      <SideBySide originalBytes={file.originalBytes} remediatedBytes={file.remediatedBytes} />
    </div>
  );
}
