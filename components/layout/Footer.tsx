export function Footer() {
  return (
    <footer className="border-t py-6 md:py-0">
      <div className="container flex flex-col items-center justify-between gap-4 md:h-16 md:flex-row">
        <p className="text-center text-sm leading-loose text-muted-foreground md:text-left">
          AccessiblePDF — Automated PDF accessibility remediation tool.
        </p>
        <p className="text-center text-xs text-muted-foreground md:text-right max-w-md">
          This tool performs automated structural remediation. Manual review is recommended for complete WCAG 2.1 AA compliance.
        </p>
      </div>
    </footer>
  );
}
