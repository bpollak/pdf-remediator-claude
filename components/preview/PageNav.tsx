'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useState } from 'react';

interface PageNavProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

export function PageNav({ currentPage, totalPages, onPageChange }: PageNavProps) {
  const [inputValue, setInputValue] = useState(String(currentPage));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const num = parseInt(inputValue, 10);
    if (!isNaN(num) && num >= 1 && num <= totalPages) {
      onPageChange(num);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <Button variant="outline" size="sm" disabled={currentPage <= 1} onClick={() => onPageChange(currentPage - 1)} aria-label="Previous page">
        Prev
      </Button>
      <form onSubmit={handleSubmit} className="flex items-center gap-1">
        <Input
          type="number"
          min={1}
          max={totalPages}
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          className="w-16 h-8 text-center text-sm"
          aria-label="Page number"
        />
        <span className="text-sm text-muted-foreground">/ {totalPages}</span>
      </form>
      <Button variant="outline" size="sm" disabled={currentPage >= totalPages} onClick={() => onPageChange(currentPage + 1)} aria-label="Next page">
        Next
      </Button>
    </div>
  );
}
