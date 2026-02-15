import type { AuditFinding } from '@/types/audit';
import type { ParsedPDF, TagNode } from '@/types/pdf';

interface TableInfo {
  tag: TagNode;
  pageIndex: number;
  rows: TagNode[];
  hasHeaderCells: boolean;
  hasCaptionChild: boolean;
  isMalformed: boolean;
  malformedReason: string;
}

/**
 * Recursively collect all Table tags from the tag tree.
 */
function collectTables(node: TagNode): TableInfo[] {
  const tables: TableInfo[] = [];

  if (node.type === 'Table') {
    tables.push(analyzeTable(node));
  }

  for (const child of node.children) {
    tables.push(...collectTables(child));
  }

  return tables;
}

/**
 * Analyze a Table tag node for structural validity.
 */
function analyzeTable(tableNode: TagNode): TableInfo {
  const pageIndex = tableNode.pageIndex ?? 0;
  const rows: TagNode[] = [];
  let hasHeaderCells = false;
  let hasCaptionChild = false;
  let isMalformed = false;
  let malformedReason = '';

  // Check direct children for TR, THead, TBody, TFoot, Caption
  const validTableChildren = new Set([
    'TR', 'THead', 'TBody', 'TFoot', 'Caption',
  ]);

  for (const child of tableNode.children) {
    if (child.type === 'Caption') {
      hasCaptionChild = true;
      continue;
    }

    if (child.type === 'TR') {
      rows.push(child);
      // Check TR children for TH/TD
      if (checkRowForHeaders(child)) {
        hasHeaderCells = true;
      }
    } else if (
      child.type === 'THead' ||
      child.type === 'TBody' ||
      child.type === 'TFoot'
    ) {
      // These should contain TR children
      for (const sectionChild of child.children) {
        if (sectionChild.type === 'TR') {
          rows.push(sectionChild);
          if (checkRowForHeaders(sectionChild)) {
            hasHeaderCells = true;
          }
        }
      }
      if (child.type === 'THead') {
        hasHeaderCells = true;
      }
    } else if (!validTableChildren.has(child.type)) {
      isMalformed = true;
      malformedReason = `Table contains unexpected child element "${child.type}" instead of TR, THead, TBody, TFoot, or Caption.`;
    }
  }

  // Check that table has at least one row
  if (rows.length === 0 && !isMalformed) {
    isMalformed = true;
    malformedReason =
      'Table contains no row (TR) elements. A valid table must have at least one TR.';
  }

  // Check that each row contains TH or TD
  for (const row of rows) {
    const hasCells = row.children.some(
      (c) => c.type === 'TH' || c.type === 'TD'
    );
    if (!hasCells && !isMalformed) {
      isMalformed = true;
      malformedReason =
        'Table row (TR) contains no TH or TD cell elements.';
      break;
    }
  }

  return {
    tag: tableNode,
    pageIndex,
    rows,
    hasHeaderCells,
    hasCaptionChild,
    isMalformed,
    malformedReason,
  };
}

/**
 * Check if a TR node contains any TH children.
 */
function checkRowForHeaders(trNode: TagNode): boolean {
  return trNode.children.some((child) => child.type === 'TH');
}

/**
 * Table rules: TBL-001 through TBL-003
 */
export function tableRules(pdf: ParsedPDF): AuditFinding[] {
  const findings: AuditFinding[] = [];

  if (!pdf.tagTree) {
    // No tag tree - cannot evaluate table structure.
    return findings;
  }

  const tables = collectTables(pdf.tagTree);

  if (tables.length === 0) {
    // No tables in the document - rules are not applicable.
    return findings;
  }

  for (let i = 0; i < tables.length; i++) {
    const table = tables[i];
    const tableLabel = tables.length > 1 ? ` (table ${i + 1} of ${tables.length})` : '';
    const pageNumber = table.pageIndex + 1;

    // TBL-001: Verify Table/TR/TH/TD tag structure
    if (table.isMalformed) {
      findings.push({
        ruleId: 'TBL-001',
        category: 'tables',
        severity: 'major',
        description: `Malformed table structure on page ${pageNumber}${tableLabel}. ${table.malformedReason}`,
        location: {
          pageNumber,
          elementType: 'Table',
          elementDetail: table.malformedReason,
        },
        wcagCriterion: '1.3.1 Info and Relationships',
        recommendation:
          'Ensure the table follows the correct tag structure: Table > TR > TH/TD. Use THead, TBody, and TFoot elements for proper grouping.',
        autoFixable: true,
      });
    }

    // TBL-002: Check header cells
    if (!table.hasHeaderCells && !table.isMalformed && table.rows.length > 0) {
      findings.push({
        ruleId: 'TBL-002',
        category: 'tables',
        severity: 'major',
        description: `Table on page ${pageNumber}${tableLabel} has no header cells (TH). All cells are data cells (TD). Without headers, screen readers cannot associate data cells with their column or row labels.`,
        location: {
          pageNumber,
          elementType: 'Table',
          elementDetail: 'No TH elements found',
        },
        wcagCriterion: '1.3.1 Info and Relationships',
        recommendation:
          'Designate appropriate cells as header cells (TH) to identify row and column headers for the table data.',
        autoFixable: true,
      });
    }

    // TBL-003: Check for table caption/summary
    if (!table.hasCaptionChild) {
      findings.push({
        ruleId: 'TBL-003',
        category: 'tables',
        severity: 'minor',
        description: `Table on page ${pageNumber}${tableLabel} does not have a Caption tag. A caption provides context and helps users understand the purpose of the table.`,
        location: {
          pageNumber,
          elementType: 'Table',
          elementDetail: 'Missing Caption element',
        },
        wcagCriterion: '1.3.1 Info and Relationships',
        recommendation:
          'Add a Caption element as a child of the Table tag to describe the table content and purpose.',
        autoFixable: false,
      });
    }
  }

  return findings;
}
