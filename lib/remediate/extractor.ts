import { ParsedPDF } from '@/types/pdf';
import { DetectedHeading, DetectedList, DetectedTable, detectHeadings, detectLists, detectTables } from './heuristics';

export interface ExtractedContent {
  headings: DetectedHeading[];
  lists: DetectedList[];
  tables: DetectedTable[];
  // Set of TextItem indices that are classified as headings/lists/tables
  classifiedItems: Set<string>; // key = `${pageIndex}-${x}-${y}`
  metadata: {
    title: string;
    language: string;
    author: string;
  };
}

/**
 * Extract and classify all content from parsed PDF
 */
export function extractContent(pdf: ParsedPDF): ExtractedContent {
  const allTextItems = pdf.pages.flatMap(p => p.textItems);

  const headings = detectHeadings(allTextItems);
  const lists = detectLists(allTextItems);
  const tables = detectTables(allTextItems);

  // Build a set of classified item keys to avoid double-tagging
  const classifiedItems = new Set<string>();

  for (const h of headings) {
    for (const ti of h.textItems) {
      classifiedItems.add(`${ti.pageIndex}-${ti.x.toFixed(1)}-${ti.y.toFixed(1)}`);
    }
  }

  for (const list of lists) {
    for (const item of list.items) {
      for (const ti of item.textItems) {
        classifiedItems.add(`${ti.pageIndex}-${ti.x.toFixed(1)}-${ti.y.toFixed(1)}`);
      }
    }
  }

  for (const table of tables) {
    for (const cell of table.cells) {
      for (const ti of cell.textItems) {
        classifiedItems.add(`${ti.pageIndex}-${ti.x.toFixed(1)}-${ti.y.toFixed(1)}`);
      }
    }
  }

  // Determine title
  const title = pdf.metadata.title ||
    (headings.length > 0 ? headings[0].text : '') ||
    'Untitled Document';

  return {
    headings,
    lists,
    tables,
    classifiedItems,
    metadata: {
      title,
      language: pdf.metadata.language || 'en-US',
      author: pdf.metadata.author || 'AccessiblePDF Remediation',
    },
  };
}
