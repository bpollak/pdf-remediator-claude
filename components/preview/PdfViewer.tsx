'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';

interface PdfViewerProps {
  pdfBytes: ArrayBuffer;
  label: string;
  onPageChange?: (page: number) => void;
  currentPage?: number;
}

export function PdfViewer({ pdfBytes, label, onPageChange, currentPage }: PdfViewerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [pageNum, setPageNum] = useState(currentPage || 1);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(true);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pdfDocRef = useRef<any>(null);

  const renderPage = useCallback(async (num: number) => {
    if (!pdfDocRef.current || !canvasRef.current) return;
    setLoading(true);
    try {
      const page = await pdfDocRef.current.getPage(num);
      const viewport = page.getViewport({ scale: 1.2 });
      const canvas = canvasRef.current;
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      await page.render({ canvasContext: ctx, viewport }).promise;
    } catch (e) {
      console.error('Failed to render page:', e);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function loadPdf() {
      try {
        const pdfjsLib = await import('pdfjs-dist');
        pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
        const doc = await pdfjsLib.getDocument({ data: pdfBytes, isEvalSupported: false }).promise;
        if (cancelled) return;
        pdfDocRef.current = doc;
        setTotalPages(doc.numPages);
        await renderPage(pageNum);
      } catch (e) {
        console.error('Failed to load PDF:', e);
      }
    }
    loadPdf();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pdfBytes]);

  useEffect(() => {
    if (currentPage && currentPage !== pageNum) {
      setPageNum(currentPage);
      renderPage(currentPage);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage]);

  const goToPage = (num: number) => {
    const clamped = Math.max(1, Math.min(num, totalPages));
    setPageNum(clamped);
    renderPage(clamped);
    onPageChange?.(clamped);
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between p-2 border-b bg-muted/30">
        <span className="text-sm font-medium">{label}</span>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" disabled={pageNum <= 1} onClick={() => goToPage(pageNum - 1)} aria-label="Previous page">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4" aria-hidden="true"><polyline points="15 18 9 12 15 6"/></svg>
          </Button>
          <span className="text-xs text-muted-foreground whitespace-nowrap">
            {pageNum} / {totalPages}
          </span>
          <Button variant="outline" size="sm" disabled={pageNum >= totalPages} onClick={() => goToPage(pageNum + 1)} aria-label="Next page">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4" aria-hidden="true"><polyline points="9 18 15 12 9 6"/></svg>
          </Button>
        </div>
      </div>
      <div className="flex-1 overflow-auto p-4 flex items-start justify-center bg-muted/10">
        {loading && <div className="absolute inset-0 flex items-center justify-center"><div className="animate-pulse text-muted-foreground text-sm">Loading...</div></div>}
        <canvas ref={canvasRef} className="shadow-lg max-w-full" aria-label={`${label} page ${pageNum}`} />
      </div>
    </div>
  );
}
