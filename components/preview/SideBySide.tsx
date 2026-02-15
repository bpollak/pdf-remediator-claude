'use client';

import { useState } from 'react';
import { PdfViewer } from './PdfViewer';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface SideBySideProps {
  originalBytes: ArrayBuffer;
  remediatedBytes: ArrayBuffer;
}

export function SideBySide({ originalBytes, remediatedBytes }: SideBySideProps) {
  const [currentPage, setCurrentPage] = useState(1);

  return (
    <>
      {/* Desktop: side-by-side */}
      <div className="hidden md:grid md:grid-cols-2 gap-4 h-[calc(100vh-12rem)]">
        <div className="border rounded-lg overflow-hidden">
          <PdfViewer pdfBytes={originalBytes} label="Original" currentPage={currentPage} onPageChange={setCurrentPage} />
        </div>
        <div className="border rounded-lg overflow-hidden">
          <PdfViewer pdfBytes={remediatedBytes} label="Remediated" currentPage={currentPage} onPageChange={setCurrentPage} />
        </div>
      </div>

      {/* Mobile: tabs */}
      <div className="md:hidden">
        <Tabs defaultValue="original" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="original">Original</TabsTrigger>
            <TabsTrigger value="remediated">Remediated</TabsTrigger>
          </TabsList>
          <TabsContent value="original" className="border rounded-lg overflow-hidden h-[calc(100vh-16rem)]">
            <PdfViewer pdfBytes={originalBytes} label="Original" currentPage={currentPage} onPageChange={setCurrentPage} />
          </TabsContent>
          <TabsContent value="remediated" className="border rounded-lg overflow-hidden h-[calc(100vh-16rem)]">
            <PdfViewer pdfBytes={remediatedBytes} label="Remediated" currentPage={currentPage} onPageChange={setCurrentPage} />
          </TabsContent>
        </Tabs>
      </div>
    </>
  );
}
