import * as pdfjsLib from 'pdfjs-dist';
import type {
  TextItem,
  ImageItem,
  LinkItem,
  FormField,
  TagNode,
  PageContent,
  PDFMetadata,
  ParsedPDF,
  OutlineItem,
} from '@/types/pdf';

// ---------------------------------------------------------------------------
// Font helpers
// ---------------------------------------------------------------------------

/**
 * Determine if a font name indicates bold weight.
 */
function isFontBold(fontName: string): boolean {
  const upper = fontName.toUpperCase();
  return upper.includes('BOLD') || upper.includes('BLACK') || upper.includes('HEAVY');
}

/**
 * Determine if a font name indicates italic style.
 */
function isFontItalic(fontName: string): boolean {
  const upper = fontName.toUpperCase();
  return upper.includes('ITALIC') || upper.includes('OBLIQUE');
}

/**
 * Try to extract a readable font family from the raw pdfjs font name.
 * pdfjs font names often look like "g_d0_f1" or "BCDEEE+TimesNewRoman-Bold".
 * We look for known family tokens.
 */
function deriveFontFamily(fontName: string): string {
  const upper = fontName.toUpperCase();

  if (upper.includes('COURIER') || upper.includes('MONO')) return 'monospace';
  if (upper.includes('HELVETICA') || upper.includes('ARIAL') || upper.includes('SANS')) return 'sans-serif';
  if (upper.includes('TIMES') || upper.includes('SERIF')) return 'serif';
  if (upper.includes('SYMBOL')) return 'symbol';
  if (upper.includes('ZAPF') || upper.includes('DINGBAT')) return 'symbol';

  // Fallback: return 'sans-serif' as a safe default
  return 'sans-serif';
}

// ---------------------------------------------------------------------------
// Structure tree helpers
// ---------------------------------------------------------------------------

/**
 * Recursively convert a pdfjs StructTreeNode (or StructTreeContent) into our
 * TagNode format. pdfjs returns per-page struct trees, so we aggregate them
 * under a synthetic root when building the full document tree.
 */
function convertStructTreeNode(node: Record<string, unknown>): TagNode | null {
  if (!node) return null;

  const role = (node.role as string) || (node.type as string) || 'Unknown';
  const children: TagNode[] = [];

  if (Array.isArray(node.children)) {
    for (const child of node.children) {
      if (child && typeof child === 'object') {
        // StructTreeContent nodes have a `type` of "content" or "object" and
        // an `id`.  We skip them since they only carry text-layer mapping info
        // and cannot be meaningfully converted to our TagNode.
        if (
          (child as Record<string, unknown>).type === 'content' ||
          (child as Record<string, unknown>).type === 'object'
        ) {
          continue;
        }
        const converted = convertStructTreeNode(child as Record<string, unknown>);
        if (converted) {
          children.push(converted);
        }
      }
    }
  }

  const attributes: Record<string, string> = {};
  const altText = typeof node.alt === 'string' ? node.alt : undefined;
  const lang = typeof node.lang === 'string' ? node.lang : undefined;

  return {
    type: role,
    children,
    attributes,
    altText,
    lang,
  };
}

// ---------------------------------------------------------------------------
// Outline helpers
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function convertOutlineItems(items: any[], pdf: any): Promise<OutlineItem[]> {
  const result: OutlineItem[] = [];

  for (const item of items) {
    let pageIndex: number | null = null;
    let destStr: string | null = null;

    try {
      if (typeof item.dest === 'string') {
        destStr = item.dest;
        const dest = await pdf.getDestination(item.dest);
        if (dest && Array.isArray(dest) && dest[0]) {
          const ref = dest[0];
          pageIndex = await pdf.getPageIndex(ref);
        }
      } else if (Array.isArray(item.dest) && item.dest.length > 0 && item.dest[0]) {
        const ref = item.dest[0];
        pageIndex = await pdf.getPageIndex(ref);
      }
    } catch {
      // Destination resolution may fail for some PDFs - continue with null pageIndex
    }

    const children = item.items && item.items.length > 0
      ? await convertOutlineItems(item.items, pdf)
      : [];

    result.push({
      title: item.title || '',
      dest: destStr,
      pageIndex,
      children,
    });
  }

  return result;
}

// ---------------------------------------------------------------------------
// Annotation helpers
// ---------------------------------------------------------------------------

function mapAnnotationSubtype(subtype: string): FormField['type'] {
  switch (subtype) {
    case 'Tx':
      return 'text';
    case 'Btn':
      return 'button';
    case 'Ch':
      return 'select';
    default:
      return 'text';
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function isLinkAnnotation(annotation: any): boolean {
  return annotation.subtype === 'Link';
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function isWidgetAnnotation(annotation: any): boolean {
  return annotation.subtype === 'Widget';
}

// ---------------------------------------------------------------------------
// Main parser
// ---------------------------------------------------------------------------

export async function parsePDF(
  buffer: ArrayBuffer,
  onProgress?: (progress: number, message: string) => void
): Promise<ParsedPDF> {
  const report = (progress: number, message: string) => {
    if (onProgress) {
      try {
        onProgress(progress, message);
      } catch {
        // Ignore callback errors
      }
    }
  };

  // ------------------------------------------------------------------
  // 1. Load the document
  // ------------------------------------------------------------------
  report(5, 'Loading PDF document...');

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let pdf: any;
  try {
    const loadingTask = pdfjsLib.getDocument({
      data: buffer,
      // We intentionally do NOT set useWorkerFetch or workerSrc here.
      // The caller is responsible for configuring GlobalWorkerOptions.workerSrc
      // if needed (e.g. in a web-worker context).
    });
    pdf = await loadingTask.promise;
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : String(err);
    if (
      message.includes('encrypted') ||
      message.includes('password') ||
      message.includes('PasswordException')
    ) {
      throw new Error('This PDF is encrypted and cannot be processed');
    }
    throw new Error('Unable to read this PDF file');
  }

  report(10, 'PDF document loaded');

  // ------------------------------------------------------------------
  // 2. Extract metadata
  // ------------------------------------------------------------------
  report(15, 'Extracting metadata...');

  let metadata: PDFMetadata;
  try {
    metadata = await extractMetadata(pdf);
  } catch {
    // Fall back to minimal metadata on failure
    metadata = {
      isTagged: false,
      hasStructTree: false,
      isPdfUa: false,
      displayDocTitle: false,
      pageCount: pdf.numPages,
    };
  }

  report(20, 'Metadata extracted');

  // ------------------------------------------------------------------
  // 3. Extract pages
  // ------------------------------------------------------------------
  const pages: PageContent[] = [];
  const totalPages = pdf.numPages;

  for (let i = 1; i <= totalPages; i++) {
    const pageProgress = 20 + Math.round(((i - 1) / totalPages) * 60);
    report(pageProgress, `Extracting page ${i} of ${totalPages}...`);

    try {
      const pageContent = await extractPage(pdf, i);
      pages.push(pageContent);
    } catch {
      // If a single page fails, push an empty shell so indices stay consistent
      pages.push({
        pageIndex: i - 1,
        width: 0,
        height: 0,
        textItems: [],
        imageItems: [],
        links: [],
        formFields: [],
      });
    }
  }

  report(80, 'Pages extracted');

  // ------------------------------------------------------------------
  // 4. Extract structure tree (tag tree)
  // ------------------------------------------------------------------
  report(82, 'Extracting structure tree...');

  let tagTree: TagNode | null = null;
  try {
    tagTree = await extractStructureTree(pdf, totalPages);
  } catch {
    // Structure tree is optional - continue without it
    tagTree = null;
  }

  report(90, 'Structure tree extracted');

  // ------------------------------------------------------------------
  // 5. Extract outlines / bookmarks
  // ------------------------------------------------------------------
  report(92, 'Extracting bookmarks...');

  let outlines: OutlineItem[] = [];
  try {
    outlines = await extractOutlines(pdf);
  } catch {
    outlines = [];
  }

  report(100, 'Parsing complete');

  return {
    metadata,
    pages,
    tagTree,
    outlines,
    rawBytes: buffer,
  };
}

// ---------------------------------------------------------------------------
// Metadata extraction
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function extractMetadata(pdf: any): Promise<PDFMetadata> {
  const { info, metadata: metadataObj } = await pdf.getMetadata();

  const title: string | undefined = info?.Title || undefined;
  const author: string | undefined = info?.Author || undefined;
  const subject: string | undefined = info?.Subject || undefined;
  const keywords: string | undefined = info?.Keywords || undefined;
  const creator: string | undefined = info?.Creator || undefined;
  const producer: string | undefined = info?.Producer || undefined;
  const creationDate: string | undefined = info?.CreationDate || undefined;
  const modDate: string | undefined = info?.ModDate || undefined;

  // Language from metadata or info
  let language: string | undefined;
  if (metadataObj) {
    try {
      const lang = metadataObj.get('dc:language');
      if (lang) {
        language = Array.isArray(lang) ? lang[0] : String(lang);
      }
    } catch {
      // metadata access can fail
    }
  }
  if (!language && info?.Language) {
    language = info.Language;
  }

  // MarkInfo - indicates if PDF is tagged
  let isTagged = false;
  try {
    const markInfo = await pdf.getMarkInfo();
    if (markInfo && markInfo.Marked) {
      isTagged = true;
    }
  } catch {
    // Not available
  }

  // Check for structure tree presence (we'll verify more thoroughly later)
  const hasStructTree = isTagged;

  // Check for PDF/UA compliance indicator
  let isPdfUa = false;
  if (metadataObj) {
    try {
      const metaXml = metadataObj.getRaw();
      if (typeof metaXml === 'string' && metaXml.includes('pdfuaid')) {
        isPdfUa = true;
      }
    } catch {
      // metadata raw access can fail
    }
    if (!isPdfUa) {
      try {
        const pdfuaid = metadataObj.get('pdfuaid:part');
        if (pdfuaid) {
          isPdfUa = true;
        }
      } catch {
        // Not available
      }
    }
  }

  // Check displayDocTitle in ViewerPreferences
  let displayDocTitle = false;
  try {
    const viewerPrefs = await pdf.getViewerPreferences();
    if (viewerPrefs && viewerPrefs.DisplayDocTitle) {
      displayDocTitle = true;
    }
  } catch {
    // Not available
  }

  return {
    title,
    author,
    subject,
    keywords,
    creator,
    producer,
    creationDate,
    modDate,
    language,
    isTagged,
    hasStructTree,
    isPdfUa,
    displayDocTitle,
    pageCount: pdf.numPages,
  };
}

// ---------------------------------------------------------------------------
// Per-page extraction
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function extractPage(pdf: any, pageNumber: number): Promise<PageContent> {
  const page = await pdf.getPage(pageNumber);
  const viewport = page.getViewport({ scale: 1.0 });
  const pageIndex = pageNumber - 1;

  // --- Text items ---
  const textItems: TextItem[] = [];
  try {
    const textContent = await page.getTextContent();
    for (const item of textContent.items) {
      // Skip marked-content items (they have a `type` property)
      if ('type' in item) continue;

      // item is a pdfjs TextItem with str, dir, transform, width, height, fontName, hasEOL
      const tx = item.transform;
      // transform: [scaleX, skewY, skewX, scaleY, translateX, translateY]
      const fontSize = Math.abs(tx[3]) || Math.abs(tx[0]) || 12;
      const x = tx[4];
      const y = tx[5];
      const width = item.width;
      const height = item.height || fontSize;

      const fontName: string = item.fontName || '';
      const isBold = isFontBold(fontName);
      const isItalic = isFontItalic(fontName);
      const fontFamily = deriveFontFamily(fontName);

      textItems.push({
        text: item.str,
        x,
        y,
        width,
        height,
        fontSize,
        fontName,
        fontFamily,
        isBold,
        isItalic,
        color: { r: 0, g: 0, b: 0 }, // Color is not readily available from getTextContent
        pageIndex,
        transform: tx,
      });
    }
  } catch {
    // Text extraction failed for this page - continue with empty array
  }

  // --- Annotations (links + form fields) ---
  const links: LinkItem[] = [];
  const formFields: FormField[] = [];
  try {
    const annotations = await page.getAnnotations();
    for (const annot of annotations) {
      const rect = annot.rect || [0, 0, 0, 0];
      const aX = rect[0];
      const aY = rect[1];
      const aWidth = rect[2] - rect[0];
      const aHeight = rect[3] - rect[1];

      if (isLinkAnnotation(annot)) {
        const url =
          annot.url ||
          (annot.dest ? (typeof annot.dest === 'string' ? `#${annot.dest}` : '#internal') : '');
        links.push({
          url,
          text: annot.title || annot.contents || '',
          x: aX,
          y: aY,
          width: aWidth,
          height: aHeight,
          pageIndex,
        });
      } else if (isWidgetAnnotation(annot)) {
        let fieldType = mapAnnotationSubtype(annot.fieldType || '');

        // Refine button type (checkbox vs radio vs pushbutton)
        if (fieldType === 'button') {
          if (annot.checkBox) {
            fieldType = 'checkbox';
          } else if (annot.radioButton) {
            fieldType = 'radio';
          }
        }

        formFields.push({
          name: annot.fieldName || annot.id || '',
          type: fieldType,
          label: annot.alternativeText || annot.fieldName || undefined,
          tooltip: annot.alternativeText || undefined,
          required: !!(annot.fieldFlags && (annot.fieldFlags & 0x2)), // REQUIRED flag
          x: aX,
          y: aY,
          width: aWidth,
          height: aHeight,
          pageIndex,
        });
      }
    }
  } catch {
    // Annotation extraction failed - continue with empty arrays
  }

  // --- Image items ---
  const imageItems: ImageItem[] = [];
  try {
    const operatorList = await page.getOperatorList();
    const OPS = pdfjsLib.OPS;

    for (let i = 0; i < operatorList.fnArray.length; i++) {
      const fn = operatorList.fnArray[i];

      if (fn === OPS.paintImageXObject || fn === OPS.paintInlineImageXObject) {
        const args = operatorList.argsArray[i];
        if (!args || args.length === 0) continue;

        const imgName = args[0];
        // For paintImageXObject the first arg is the image name (string key)
        // We try to resolve it from the page objects.
        if (typeof imgName === 'string') {
          try {
            const imgData = await new Promise<Record<string, unknown> | null>((resolve) => {
              // page.objs.get returns the object if available, or invokes callback
              try {
                page.objs.get(imgName, (data: unknown) => {
                  resolve(data as Record<string, unknown> | null);
                });
              } catch {
                resolve(null);
              }
              // Timeout to avoid hanging
              setTimeout(() => resolve(null), 2000);
            });

            if (imgData && typeof imgData === 'object') {
              const imgWidth = (imgData.width as number) || 0;
              const imgHeight = (imgData.height as number) || 0;
              const rawData = imgData.data as Uint8Array | undefined;

              if (imgWidth > 0 && imgHeight > 0) {
                imageItems.push({
                  data: rawData ? new Uint8Array(rawData) : new Uint8Array(0),
                  width: imgWidth,
                  height: imgHeight,
                  x: 0, // Precise position requires interpreting the graphics state
                  y: 0,
                  displayWidth: imgWidth,
                  displayHeight: imgHeight,
                  pageIndex,
                  mimeType: 'image/png',
                });
              }
            }
          } catch {
            // Failed to resolve image object - skip
          }
        }
      }
    }
  } catch {
    // Operator list extraction failed - continue without images
  }

  return {
    pageIndex,
    width: viewport.width,
    height: viewport.height,
    textItems,
    imageItems,
    links,
    formFields,
  };
}

// ---------------------------------------------------------------------------
// Structure tree extraction
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function extractStructureTree(pdf: any, totalPages: number): Promise<TagNode | null> {
  // Attempt to gather per-page structure trees and merge them under a root.
  const childNodes: TagNode[] = [];

  for (let i = 1; i <= totalPages; i++) {
    try {
      const page = await pdf.getPage(i);
      const tree = await page.getStructTree();

      if (tree) {
        const converted = convertStructTreeNode(tree as unknown as Record<string, unknown>);
        if (converted) {
          // Annotate page index on the top-level children
          converted.pageIndex = i - 1;
          childNodes.push(converted);
        }
      }
    } catch {
      // Structure tree not available for this page - skip
    }
  }

  if (childNodes.length === 0) {
    return null;
  }

  return {
    type: 'Document',
    children: childNodes,
    attributes: {},
  };
}

// ---------------------------------------------------------------------------
// Outline extraction
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function extractOutlines(pdf: any): Promise<OutlineItem[]> {
  const outline = await pdf.getOutline();
  if (!outline || outline.length === 0) {
    return [];
  }
  return convertOutlineItems(outline, pdf);
}
