'use client';

import { Progress } from '@/components/ui/progress';

interface RemediationProgressProps {
  progress: number;
  message: string;
}

export function RemediationProgress({ progress, message }: RemediationProgressProps) {
  return (
    <div className="space-y-2 p-4 border rounded-lg">
      <div className="flex justify-between text-sm">
        <span className="font-medium">Remediating PDF</span>
        <span className="text-muted-foreground">{Math.round(progress)}%</span>
      </div>
      <Progress value={progress} className="h-2" />
      <p className="text-xs text-muted-foreground">{message}</p>
    </div>
  );
}
