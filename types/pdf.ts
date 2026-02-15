export interface TextItem {
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fontSize: number;
  fontName: string;
  fontFamily: string;
  isBold: boolean;
  isItalic: boolean;
  color: { r: number; g: number; b: number };
  pageIndex: number;
  // original transform matrix from pdfjs
  transform: number[];
}

export interface ImageItem {
  data: Uint8Array;
  width: number;
  height: number;
  x: number;
  y: number;
  displayWidth: number;
  displayHeight: number;
  pageIndex: number;
  altText?: string;
  mimeType: 'image/png' | 'image/jpeg';
}

export interface LinkItem {
  url: string;
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
  pageIndex: number;
}

export interface FormField {
  name: string;
  type: 'text' | 'checkbox' | 'radio' | 'select' | 'button';
  label?: string;
  tooltip?: string;
  required: boolean;
  x: number;
  y: number;
  width: number;
  height: number;
  pageIndex: number;
}

export interface TagNode {
  type: string; // e.g., 'Document', 'P', 'H1', 'Figure', 'Table', etc.
  children: TagNode[];
  attributes: Record<string, string>;
  altText?: string;
  lang?: string;
  pageIndex?: number;
  // bounding box if available
  bbox?: { x: number; y: number; width: number; height: number };
}

export interface PageContent {
  pageIndex: number;
  width: number;
  height: number;
  textItems: TextItem[];
  imageItems: ImageItem[];
  links: LinkItem[];
  formFields: FormField[];
}

export interface PDFMetadata {
  title?: string;
  author?: string;
  subject?: string;
  keywords?: string;
  creator?: string;
  producer?: string;
  creationDate?: string;
  modDate?: string;
  language?: string;
  isTagged: boolean;
  hasStructTree: boolean;
  isPdfUa: boolean;
  displayDocTitle: boolean;
  pageCount: number;
}

export interface ParsedPDF {
  metadata: PDFMetadata;
  pages: PageContent[];
  tagTree: TagNode | null;
  outlines: OutlineItem[];
  rawBytes: ArrayBuffer;
}

export interface OutlineItem {
  title: string;
  dest: string | null;
  pageIndex: number | null;
  children: OutlineItem[];
}
