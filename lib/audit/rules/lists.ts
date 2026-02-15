import type { AuditFinding } from '@/types/audit';
import type { ParsedPDF, TagNode } from '@/types/pdf';

/**
 * Patterns that indicate list content in text.
 * Matches common bullet characters and numbered list patterns.
 */
const BULLET_PATTERNS = [
  /^\s*[\u2022\u2023\u25E6\u2043\u2219\u25AA\u25AB\u25CF\u25CB\u2013\u2014\u2015-]\s/m, // bullet characters
  /^\s*[a-zA-Z]\)\s/m,          // a) b) c) style
  /^\s*[a-zA-Z]\.\s/m,          // a. b. c. style (only at start of line)
  /^\s*\d{1,3}\.\s/m,           // 1. 2. 3. style
  /^\s*\d{1,3}\)\s/m,           // 1) 2) 3) style
  /^\s*[ivxlcdm]+\.\s/mi,      // roman numeral style (i. ii. iii.)
  /^\s*\(\d{1,3}\)\s/m,        // (1) (2) (3) style
];

/**
 * Check if text contains list-like patterns.
 * Returns true if at least 2 list-like items are detected (a single bullet is not a list).
 */
function detectListPatterns(text: string): boolean {
  let matchCount = 0;

  for (const pattern of BULLET_PATTERNS) {
    const globalPattern = new RegExp(pattern.source, pattern.flags.includes('m') ? 'gm' : 'g');
    const matches = text.match(globalPattern);
    if (matches) {
      matchCount += matches.length;
    }
  }

  // Need at least 2 items to consider it a list
  return matchCount >= 2;
}

/**
 * Recursively check if the tag tree contains any L (List) tags.
 */
function hasListTags(node: TagNode): boolean {
  if (node.type === 'L') {
    return true;
  }

  for (const child of node.children) {
    if (hasListTags(child)) {
      return true;
    }
  }

  return false;
}

/**
 * List rules: LST-001
 */
export function listRules(pdf: ParsedPDF): AuditFinding[] {
  const findings: AuditFinding[] = [];

  // Combine all text content from all pages
  const pagesWithListContent: number[] = [];

  for (const page of pdf.pages) {
    const pageText = page.textItems.map((item) => item.text).join('\n');
    if (detectListPatterns(pageText)) {
      pagesWithListContent.push(page.pageIndex + 1);
    }
  }

  if (pagesWithListContent.length === 0) {
    // No list-like content detected in text
    return findings;
  }

  // Check if the tag tree has proper list tags
  const hasProperListTags = pdf.tagTree ? hasListTags(pdf.tagTree) : false;

  // LST-001: List content exists but no proper L/LI tags
  if (!hasProperListTags) {
    const pagesList =
      pagesWithListContent.length <= 5
        ? pagesWithListContent.join(', ')
        : `${pagesWithListContent.slice(0, 5).join(', ')} and ${pagesWithListContent.length - 5} more`;

    findings.push({
      ruleId: 'LST-001',
      category: 'lists',
      severity: 'major',
      description: `Document appears to contain list content (detected on page(s) ${pagesList}) but does not use proper list tags (L/LI/Lbl/LBody). Screen readers cannot identify these as lists.`,
      location: {
        pageNumber: pagesWithListContent[0],
        elementType: 'List',
        elementDetail: `List-like content on ${pagesWithListContent.length} page(s)`,
      },
      wcagCriterion: '1.3.1 Info and Relationships',
      recommendation:
        'Tag list content using the proper PDF list structure: L (List) > LI (List Item) > Lbl (Label/bullet) + LBody (List Body).',
      autoFixable: true,
    });
  }

  return findings;
}
