/// <reference lib="webworker" />

import * as pdfjsLib from 'pdfjs-dist';

// Configure pdf.js worker
// In a web worker context, we need to disable the nested worker or point to the correct source
pdfjsLib.GlobalWorkerOptions.workerSrc = '';

// We'll import our parser logic inline since workers can't use path aliases
// The actual parsing logic:

const ctx = self as unknown as DedicatedWorkerGlobalScope;

interface ParseRequest {
  type: 'PARSE_PDF';
  fileId: string;
  buffer: ArrayBuffer;
}

ctx.addEventListener('message', async (event: MessageEvent<ParseRequest>) => {
  const { type, fileId, buffer } = event.data;

  if (type !== 'PARSE_PDF') return;

  try {
    ctx.postMessage({
      type: 'PARSE_PROGRESS',
      fileId,
      progress: 5,
      message: 'Loading PDF document...',
    });

    // Load document
    const loadingTask = pdfjsLib.getDocument({
      data: buffer,
      useSystemFonts: true,
      isEvalSupported: false,
      useWorkerFetch: false,
    });

    let pdf;
    try {
      pdf = await loadingTask.promise;
    } catch (err: any) {
      if (err?.name === 'PasswordException') {
        throw new Error('This PDF is encrypted and cannot be processed');
      }
      throw new Error('Unable to read this PDF file');
    }

    ctx.postMessage({
      type: 'PARSE_PROGRESS',
      fileId,
      progress: 15,
      message: 'Extracting metadata...',
    });

    // Extract metadata
    const meta = await pdf.getMetadata().catch(() => ({ info: {}, metadata: null }));
    const info = (meta.info || {}) as any;

    let isTagged = false;
    try {
      const markInfo = await pdf.getMarkInfo();
      isTagged = markInfo?.Marked === true;
    } catch {}

    let displayDocTitle = false;
    try {
      const vp = await (pdf as any).getViewerPreferences();
      displayDocTitle = vp?.DisplayDocTitle === true;
    } catch {}

    const metadata = {
      title: info.Title || '',
      author: info.Author || '',
      subject: info.Subject || '',
      keywords: info.Keywords || '',
      creator: info.Creator || '',
      producer: info.Producer || '',
      creationDate: info.CreationDate || '',
      modDate: info.ModDate || '',
      language: (info as any).Language || '',
      isTagged,
      hasStructTree: isTagged, // approximate
      isPdfUa: false, // hard to detect without XMP parsing
      displayDocTitle,
      pageCount: pdf.numPages,
    };

    ctx.postMessage({
      type: 'PARSE_PROGRESS',
      fileId,
      progress: 20,
      message: 'Extracting page content...',
    });

    // Extract pages
    const pages = [];
    for (let i = 1; i <= pdf.numPages; i++) {
      const progress = 20 + (i / pdf.numPages) * 60;
      ctx.postMessage({
        type: 'PARSE_PROGRESS',
        fileId,
        progress,
        message: `Extracting page ${i} of ${pdf.numPages}...`,
      });

      try {
        const page = await pdf.getPage(i);
        const viewport = page.getViewport({ scale: 1.0 });

        // Extract text
        const textContent = await page.getTextContent();
        const textItems = textContent.items
          .filter((item: any) => 'str' in item && item.str)
          .map((item: any) => {
            const tx = item.transform || [1, 0, 0, 1, 0, 0];
            const fontName = item.fontName || '';
            const lowerFont = fontName.toLowerCase();

            let fontFamily = 'sans-serif';
            if (lowerFont.includes('courier') || lowerFont.includes('mono')) {
              fontFamily = 'monospace';
            } else if (lowerFont.includes('times') || lowerFont.includes('serif') || lowerFont.includes('georgia')) {
              fontFamily = 'serif';
            }

            return {
              text: item.str,
              x: tx[4],
              y: tx[5],
              width: item.width || 0,
              height: item.height || Math.abs(tx[0]) || 12,
              fontSize: Math.abs(tx[0]) || 12,
              fontName,
              fontFamily,
              isBold: lowerFont.includes('bold') || lowerFont.includes('black') || lowerFont.includes('heavy'),
              isItalic: lowerFont.includes('italic') || lowerFont.includes('oblique'),
              color: { r: 0, g: 0, b: 0 },
              pageIndex: i - 1,
              transform: tx,
            };
          });

        // Extract annotations (links and form fields)
        const annotations = await page.getAnnotations().catch(() => []);
        const links = [];
        const formFields = [];

        for (const annot of annotations) {
          if (annot.subtype === 'Link' && annot.url) {
            const rect = annot.rect || [0, 0, 0, 0];
            links.push({
              url: annot.url,
              text: annot.title || annot.url || '',
              x: rect[0],
              y: rect[1],
              width: rect[2] - rect[0],
              height: rect[3] - rect[1],
              pageIndex: i - 1,
            });
          } else if (annot.subtype === 'Widget') {
            const rect = annot.rect || [0, 0, 0, 0];
            formFields.push({
              name: annot.fieldName || '',
              type: annot.fieldType === 'Btn' ? (annot.checkBox ? 'checkbox' : annot.radioButton ? 'radio' : 'button') : 'text',
              label: annot.alternativeText || '',
              tooltip: annot.alternativeText || '',
              required: annot.required || false,
              x: rect[0],
              y: rect[1],
              width: rect[2] - rect[0],
              height: rect[3] - rect[1],
              pageIndex: i - 1,
            });
          }
        }

        pages.push({
          pageIndex: i - 1,
          width: viewport.width,
          height: viewport.height,
          textItems,
          imageItems: [], // Image extraction is complex in workers - skip for now
          links,
          formFields,
        });
      } catch (err) {
        // Add empty page on error
        pages.push({
          pageIndex: i - 1,
          width: 612,
          height: 792,
          textItems: [],
          imageItems: [],
          links: [],
          formFields: [],
        });
      }
    }

    ctx.postMessage({
      type: 'PARSE_PROGRESS',
      fileId,
      progress: 85,
      message: 'Extracting document structure...',
    });

    // Try to extract structure tree
    let tagTree = null;
    // Structure tree extraction is limited in worker context
    // The tag tree will be reconstructed during remediation

    ctx.postMessage({
      type: 'PARSE_PROGRESS',
      fileId,
      progress: 90,
      message: 'Extracting bookmarks...',
    });

    // Extract outlines
    let outlines: any[] = [];
    try {
      const outline = await pdf.getOutline();
      if (outline) {
        const processOutline = (items: any[]): any[] => {
          return items.map(item => ({
            title: item.title || '',
            dest: item.dest || null,
            pageIndex: null, // Would need to resolve destinations
            children: item.items ? processOutline(item.items) : [],
          }));
        };
        outlines = processOutline(outline);
      }
    } catch {}

    ctx.postMessage({
      type: 'PARSE_PROGRESS',
      fileId,
      progress: 100,
      message: 'Parsing complete',
    });

    // Send result
    const parsedData = {
      metadata,
      pages,
      tagTree,
      outlines,
      rawBytes: buffer,
    };

    ctx.postMessage({
      type: 'PARSE_COMPLETE',
      fileId,
      parsedData,
    });

  } catch (err: any) {
    ctx.postMessage({
      type: 'PARSE_ERROR',
      fileId,
      error: err.message || 'Unknown parsing error',
    });
  }
});
