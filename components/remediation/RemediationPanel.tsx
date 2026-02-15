'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';

interface RemediationPanelProps {
  defaultTitle: string;
  onRemediate: (options: { language: string; title: string }) => void;
  isRemediating: boolean;
}

const languages = [
  { value: 'en-US', label: 'English (US)' },
  { value: 'en-GB', label: 'English (UK)' },
  { value: 'es', label: 'Spanish' },
  { value: 'fr', label: 'French' },
  { value: 'de', label: 'German' },
  { value: 'it', label: 'Italian' },
  { value: 'pt', label: 'Portuguese' },
  { value: 'ja', label: 'Japanese' },
  { value: 'zh', label: 'Chinese' },
  { value: 'ko', label: 'Korean' },
  { value: 'ar', label: 'Arabic' },
];

export function RemediationPanel({ defaultTitle, onRemediate, isRemediating }: RemediationPanelProps) {
  const [language, setLanguage] = useState('en-US');
  const [title, setTitle] = useState(defaultTitle);

  return (
    <Card className="p-6 space-y-4">
      <h3 className="text-lg font-semibold">Remediation Options</h3>
      <p className="text-sm text-muted-foreground">
        Configure options before generating the accessible PDF. The remediation engine will create a new PDF with proper tags, metadata, and bookmarks.
      </p>
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="doc-title">Document Title</Label>
          <Input
            id="doc-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Enter document title"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="doc-lang">Document Language</Label>
          <Select value={language} onValueChange={setLanguage}>
            <SelectTrigger id="doc-lang">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {languages.map((l) => (
                <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
        <p className="text-xs text-amber-800 dark:text-amber-300">
          This tool performs automated structural remediation. The output PDF uses standard font substitution. Manual review is recommended for complete WCAG 2.1 AA compliance.
        </p>
      </div>
      <Button
        onClick={() => onRemediate({ language, title })}
        disabled={isRemediating}
        className="w-full"
      >
        {isRemediating ? 'Remediating...' : 'Generate Accessible PDF'}
      </Button>
    </Card>
  );
}
