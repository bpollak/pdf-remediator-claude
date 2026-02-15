import { ExtractedContent } from './extractor';
import { ParsedPDF, TextItem } from '@/types/pdf';
import { DetectedHeading, DetectedList, DetectedTable } from './heuristics';

export type StructTag =
  | 'Document' | 'Part' | 'Sect'
  | 'H1' | 'H2' | 'H3' | 'H4' | 'H5' | 'H6'
  | 'P' | 'Span'
  | 'L' | 'LI' | 'Lbl' | 'LBody'
  | 'Table' | 'TR' | 'TH' | 'TD'
  | 'Figure' | 'Link'
  | 'Artifact';

export interface StructNode {
  tag: StructTag;
  pageIndex?: number;
  children: StructNode[];
  text?: string;
  altText?: string;
  attributes: Record<string, string>;
  // Reference to content items this node covers
  contentRef?: {
    type: 'text' | 'image' | 'link';
    pageIndex: number;
    itemIndex: number;
  };
}

/**
 * Build the accessibility tag tree from extracted content
 */
export function buildTagTree(pdf: ParsedPDF, extracted: ExtractedContent): StructNode {
  const root: StructNode = {
    tag: 'Document',
    children: [],
    attributes: { Lang: extracted.metadata.language },
  };

  // Process each page
  for (let pageIdx = 0; pageIdx < pdf.pages.length; pageIdx++) {
    const page = pdf.pages[pageIdx];
    const pageHeadings = extracted.headings.filter(h => h.pageIndex === pageIdx);
    const pageLists = extracted.lists.filter(l => l.pageIndex === pageIdx);
    const pageTables = extracted.tables.filter(t => t.pageIndex === pageIdx);

    // Sort all elements by y position (top to bottom)
    // Build a queue of content elements sorted by y position
    interface ContentElement {
      y: number;
      type: 'heading' | 'list' | 'table' | 'text' | 'image';
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      data: any;
    }

    const elements: ContentElement[] = [];

    for (const h of pageHeadings) {
      elements.push({ y: h.y, type: 'heading', data: h });
    }
    for (const l of pageLists) {
      elements.push({ y: l.startY, type: 'list', data: l });
    }
    for (const t of pageTables) {
      elements.push({ y: t.startY, type: 'table', data: t });
    }

    // Add unclassified text items as paragraphs
    // Group consecutive unclassified text items into paragraph blocks
    const unclassifiedItems = page.textItems.filter(ti => {
      const key = `${ti.pageIndex}-${ti.x.toFixed(1)}-${ti.y.toFixed(1)}`;
      return !extracted.classifiedItems.has(key);
    });

    // Group into paragraphs by proximity
    let currentParagraph: TextItem[] = [];
    const paragraphs: TextItem[][] = [];

    const sortedItems = [...unclassifiedItems].sort((a, b) => b.y - a.y || a.x - b.x);

    for (const item of sortedItems) {
      if (item.text.trim() === '') continue;
      if (currentParagraph.length === 0) {
        currentParagraph.push(item);
      } else {
        const lastItem = currentParagraph[currentParagraph.length - 1];
        const yGap = Math.abs(lastItem.y - item.y);
        // If items are close together vertically, they're the same paragraph
        if (yGap < lastItem.fontSize * 2) {
          currentParagraph.push(item);
        } else {
          paragraphs.push(currentParagraph);
          currentParagraph = [item];
        }
      }
    }
    if (currentParagraph.length > 0) {
      paragraphs.push(currentParagraph);
    }

    for (const para of paragraphs) {
      const avgY = para.reduce((sum, ti) => sum + ti.y, 0) / para.length;
      elements.push({
        y: avgY,
        type: 'text',
        data: para,
      });
    }

    // Add images
    for (let i = 0; i < page.imageItems.length; i++) {
      elements.push({
        y: page.imageItems[i].y,
        type: 'image',
        data: { ...page.imageItems[i], itemIndex: i },
      });
    }

    // Sort by y position (descending since PDF y=0 is bottom)
    elements.sort((a, b) => b.y - a.y);

    // Convert elements to struct nodes
    for (const elem of elements) {
      switch (elem.type) {
        case 'heading': {
          const h = elem.data as DetectedHeading;
          const tagName = `H${h.level}` as StructTag;
          root.children.push({
            tag: tagName,
            pageIndex: pageIdx,
            children: [],
            text: h.text,
            attributes: {},
          });
          break;
        }
        case 'list': {
          const list = elem.data as DetectedList;
          const listNode: StructNode = {
            tag: 'L',
            pageIndex: pageIdx,
            children: [],
            attributes: {},
          };
          for (const item of list.items) {
            const liNode: StructNode = {
              tag: 'LI',
              pageIndex: pageIdx,
              children: [
                {
                  tag: 'Lbl',
                  pageIndex: pageIdx,
                  children: [],
                  text: item.label,
                  attributes: {},
                },
                {
                  tag: 'LBody',
                  pageIndex: pageIdx,
                  children: [],
                  text: item.body,
                  attributes: {},
                },
              ],
              attributes: {},
            };
            listNode.children.push(liNode);
          }
          root.children.push(listNode);
          break;
        }
        case 'table': {
          const table = elem.data as DetectedTable;
          const tableNode: StructNode = {
            tag: 'Table',
            pageIndex: pageIdx,
            children: [],
            attributes: {},
          };
          // Group cells by row
          const rowMap = new Map<number, typeof table.cells>();
          for (const cell of table.cells) {
            if (!rowMap.has(cell.row)) rowMap.set(cell.row, []);
            rowMap.get(cell.row)!.push(cell);
          }
          const sortedRows = Array.from(rowMap.entries()).sort((a, b) => a[0] - b[0]);
          for (const [, cells] of sortedRows) {
            const trNode: StructNode = {
              tag: 'TR',
              pageIndex: pageIdx,
              children: [],
              attributes: {},
            };
            const sortedCells = cells.sort((a, b) => a.col - b.col);
            for (const cell of sortedCells) {
              trNode.children.push({
                tag: cell.isHeader ? 'TH' : 'TD',
                pageIndex: pageIdx,
                children: [],
                text: cell.text,
                attributes: cell.isHeader ? { Scope: 'Column' } : {},
              });
            }
            tableNode.children.push(trNode);
          }
          root.children.push(tableNode);
          break;
        }
        case 'text': {
          const items = elem.data as TextItem[];
          const text = items.map(ti => ti.text).join(' ');
          root.children.push({
            tag: 'P',
            pageIndex: pageIdx,
            children: [],
            text,
            attributes: {},
          });
          break;
        }
        case 'image': {
          const img = elem.data;
          root.children.push({
            tag: 'Figure',
            pageIndex: pageIdx,
            children: [],
            altText: img.altText || `[Image on page ${pageIdx + 1} - alt text required]`,
            attributes: {},
            contentRef: {
              type: 'image',
              pageIndex: pageIdx,
              itemIndex: img.itemIndex,
            },
          });
          break;
        }
      }
    }
  }

  return root;
}
