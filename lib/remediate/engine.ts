import { ParsedPDF } from '@/types/pdf';
import { extractContent } from './extractor';
import { buildTagTree } from './tagger';
import { buildAccessiblePDF } from './builder';

export interface RemediationOptions {
  language: string;
  title?: string;
}

export interface RemediationResult {
  pdfBytes: Uint8Array;
  warnings: string[];
}

export async function remediatePDF(
  pdf: ParsedPDF,
  options: RemediationOptions,
  onProgress?: (progress: number, message: string) => void
): Promise<RemediationResult> {
  const warnings: string[] = [];

  onProgress?.(5, 'Extracting content from original PDF...');

  // Step 1: Extract and classify content
  const extracted = extractContent(pdf);

  onProgress?.(15, 'Analyzing document structure...');

  // Step 2: Build tag tree
  const tagTree = buildTagTree(pdf, extracted);

  // Check for potential issues
  const imagesWithoutAlt = pdf.pages.reduce(
    (sum, p) => sum + p.imageItems.filter(img => !img.altText).length, 0
  );

  if (imagesWithoutAlt > 0) {
    warnings.push(`${imagesWithoutAlt} image(s) have placeholder alt text that needs manual review.`);
  }

  if (extracted.headings.length === 0 && pdf.metadata.pageCount > 1) {
    warnings.push('No headings were detected. The document structure may benefit from manual heading assignment.');
  }

  // Check for complex layouts
  for (const page of pdf.pages) {
    const textItems = page.textItems;
    if (textItems.length > 0) {
      const xPositions = Array.from(new Set(textItems.map(t => Math.round(t.x / 50))));
      if (xPositions.length > 3) {
        warnings.push(`Page ${page.pageIndex + 1} may have a complex multi-column layout. Visual fidelity may vary.`);
        break; // Only warn once
      }
    }
  }

  warnings.push('Font substitution was applied. Visual appearance uses standard fonts (Helvetica, Times, Courier) as substitutes for original fonts.');

  onProgress?.(25, 'Building accessible PDF...');

  // Step 3: Build new PDF
  const title = options.title || extracted.metadata.title;
  const pdfBytes = await buildAccessiblePDF(
    pdf,
    extracted,
    tagTree,
    {
      language: options.language,
      title,
      author: extracted.metadata.author,
    },
    (progress, message) => {
      // Map builder progress (0-100) to our range (25-95)
      const mappedProgress = 25 + (progress / 100) * 70;
      onProgress?.(mappedProgress, message);
    }
  );

  onProgress?.(100, 'Remediation complete');

  return { pdfBytes, warnings };
}
