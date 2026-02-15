import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function HomePage() {
  return (
    <div className="container">
      {/* Hero */}
      <section className="py-20 md:py-32 text-center space-y-6">
        <h1 className="text-4xl md:text-6xl font-bold tracking-tight">
          Make Your PDFs <span className="text-primary">Accessible</span>
        </h1>
        <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto">
          Upload PDF documents, get a comprehensive WCAG 2.1 AA accessibility audit, and generate remediated accessible PDFs — all in your browser. No data leaves your device.
        </p>
        <div className="flex gap-4 justify-center">
          <Link href="/app">
            <Button size="lg">Get Started</Button>
          </Link>
        </div>
      </section>

      {/* Features */}
      <section className="py-16 border-t" aria-labelledby="features-heading">
        <h2 id="features-heading" className="text-2xl md:text-3xl font-bold text-center mb-12">How It Works</h2>
        <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
          <div className="text-center space-y-3">
            <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6 text-primary" aria-hidden="true">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
            </div>
            <h3 className="font-semibold text-lg">1. Upload</h3>
            <p className="text-sm text-muted-foreground">Drag and drop your PDF files. Process up to 10 files at once. Everything stays in your browser.</p>
          </div>
          <div className="text-center space-y-3">
            <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6 text-primary" aria-hidden="true">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <path d="M9 15l2 2 4-4" />
              </svg>
            </div>
            <h3 className="font-semibold text-lg">2. Audit</h3>
            <p className="text-sm text-muted-foreground">Get a detailed WCAG 2.1 AA accessibility report with 22+ rules across 9 categories.</p>
          </div>
          <div className="text-center space-y-3">
            <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6 text-primary" aria-hidden="true">
                <path d="M12 20h9" />
                <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
              </svg>
            </div>
            <h3 className="font-semibold text-lg">3. Remediate</h3>
            <p className="text-sm text-muted-foreground">Generate a new accessible PDF with proper tags, metadata, bookmarks, and structure.</p>
          </div>
        </div>
      </section>

      {/* Privacy */}
      <section className="py-16 border-t" aria-labelledby="privacy-heading">
        <div className="max-w-2xl mx-auto text-center space-y-4">
          <h2 id="privacy-heading" className="text-2xl font-bold">Privacy First</h2>
          <p className="text-muted-foreground">
            All processing happens entirely in your browser using Web Workers. Your documents never leave your device — there are no uploads, no servers, no API calls. Your data is completely private.
          </p>
        </div>
      </section>
    </div>
  );
}
