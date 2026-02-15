import type { AuditFinding } from '@/types/audit';
import type { ParsedPDF, TagNode } from '@/types/pdf';

/** Heading tag names we look for */
const HEADING_TAGS = new Set(['H1', 'H2', 'H3', 'H4', 'H5', 'H6']);

interface HeadingInfo {
  level: number;
  tag: TagNode;
  hasContent: boolean;
}

/**
 * Recursively walk the tag tree and collect all heading nodes.
 */
function collectHeadings(node: TagNode): HeadingInfo[] {
  const headings: HeadingInfo[] = [];

  if (HEADING_TAGS.has(node.type)) {
    const level = parseInt(node.type.charAt(1), 10);
    headings.push({
      level,
      tag: node,
      hasContent: nodeHasTextContent(node),
    });
  }

  for (const child of node.children) {
    headings.push(...collectHeadings(child));
  }

  return headings;
}

/**
 * Check if a tag node (or its descendants) has any text content.
 * We consider a heading "empty" if its entire subtree contains no non-whitespace text.
 */
function nodeHasTextContent(node: TagNode): boolean {
  // Check if the node itself has text-like attributes
  if (node.attributes['text'] && node.attributes['text'].trim().length > 0) {
    return true;
  }

  // A Span or text-run child with content counts
  if (
    (node.type === 'Span' || node.type === '#text') &&
    node.attributes['text'] &&
    node.attributes['text'].trim().length > 0
  ) {
    return true;
  }

  // Check children recursively
  for (const child of node.children) {
    if (nodeHasTextContent(child)) {
      return true;
    }
  }

  // If the node has no children and is a leaf type, consider it potentially non-empty
  // only if it has content attributes. Otherwise, it is empty.
  return false;
}

/**
 * Heading rules: HDG-001 through HDG-003
 */
export function headingRules(pdf: ParsedPDF): AuditFinding[] {
  const findings: AuditFinding[] = [];

  if (!pdf.tagTree) {
    // No tag tree - heading structure cannot be evaluated.
    // DOC-002 already flags the missing tag tree.
    return findings;
  }

  const headings = collectHeadings(pdf.tagTree);

  // HDG-001: Check for proper heading hierarchy (no skipped levels)
  if (headings.length > 0) {
    let previousLevel = 0;
    for (const heading of headings) {
      // A heading can go up by any amount (e.g., H3 -> H1 is fine when starting a new section)
      // but should not skip forward (e.g., H1 -> H3 without H2)
      if (heading.level > previousLevel + 1 && previousLevel > 0) {
        const pageNumber = heading.tag.pageIndex !== undefined ? heading.tag.pageIndex + 1 : 1;
        findings.push({
          ruleId: 'HDG-001',
          category: 'headings',
          severity: 'major',
          description: `Heading hierarchy skips a level: H${previousLevel} is followed by H${heading.level}. Skipped levels can confuse assistive technology users navigating by headings.`,
          location: {
            pageNumber,
            elementType: heading.tag.type,
            elementDetail: `H${heading.level} after H${previousLevel}`,
          },
          wcagCriterion: '1.3.1 Info and Relationships',
          recommendation: `Ensure headings follow a logical hierarchy without skipping levels. Use H${previousLevel + 1} instead of H${heading.level}, or restructure the heading levels.`,
          autoFixable: false,
        });
      }
      previousLevel = heading.level;
    }
  }

  // HDG-002: Documents with multiple pages but no headings at all
  if (pdf.metadata.pageCount > 4 && headings.length === 0) {
    findings.push({
      ruleId: 'HDG-002',
      category: 'headings',
      severity: 'major',
      description:
        'Document has more than 4 pages but contains no heading tags. Headings provide structure and enable efficient navigation for assistive technology users.',
      location: { pageNumber: 1, elementType: 'Document' },
      wcagCriterion: '2.4.6 Headings and Labels',
      recommendation:
        'Add heading tags (H1-H6) to identify sections and subsections. Heuristic-based detection can identify likely headings from font size and weight.',
      autoFixable: true,
    });
  }

  // HDG-003: Empty heading tags
  for (const heading of headings) {
    if (!heading.hasContent) {
      const pageNumber = heading.tag.pageIndex !== undefined ? heading.tag.pageIndex + 1 : 1;
      findings.push({
        ruleId: 'HDG-003',
        category: 'headings',
        severity: 'minor',
        description: `Empty heading tag (${heading.tag.type}) found. Headings with no text content provide no useful information to users.`,
        location: {
          pageNumber,
          elementType: heading.tag.type,
          elementDetail: 'Empty heading',
        },
        wcagCriterion: '1.3.1 Info and Relationships',
        recommendation:
          'Remove the empty heading tag or add meaningful text content to it.',
        autoFixable: false,
      });
    }
  }

  return findings;
}
