import type { AuditFinding } from '@/types/audit';
import type { ParsedPDF } from '@/types/pdf';

/** Link text values that are considered poor/uninformative */
const POOR_LINK_TEXT = new Set([
  'click here',
  'here',
  'read more',
  'more',
  'link',
  'learn more',
  'details',
  'more info',
  'more information',
]);

/**
 * Check if text is a raw URL.
 */
function isRawUrl(text: string): boolean {
  const trimmed = text.trim();
  return trimmed.startsWith('http://') || trimmed.startsWith('https://');
}

/**
 * Link rules: LNK-001 and LNK-002
 */
export function linkRules(pdf: ParsedPDF): AuditFinding[] {
  const findings: AuditFinding[] = [];

  // LNK-001: Check link text quality across all pages
  const reportedTexts = new Set<string>();

  for (const page of pdf.pages) {
    for (const link of page.links) {
      const text = link.text.trim().toLowerCase();

      // Skip empty link text (could be an image link, separate concern)
      if (text.length === 0) continue;

      // Avoid reporting the same poor link text multiple times
      if (reportedTexts.has(text)) continue;

      if (POOR_LINK_TEXT.has(text) || isRawUrl(link.text.trim())) {
        reportedTexts.add(text);

        const isPoorText = POOR_LINK_TEXT.has(text);
        const description = isPoorText
          ? `Link text "${link.text.trim()}" is not descriptive. Generic link text does not convey the purpose or destination of the link.`
          : `Link text is a raw URL: "${link.text.trim()}". URLs are not meaningful link text for screen reader users.`;

        findings.push({
          ruleId: 'LNK-001',
          category: 'links',
          severity: 'major',
          description,
          location: {
            pageNumber: page.pageIndex + 1,
            elementType: 'Link',
            elementDetail: `Link text: "${link.text.trim()}"`,
          },
          wcagCriterion: '2.4.4 Link Purpose',
          recommendation:
            'Use descriptive link text that clearly indicates the purpose or destination of the link. Avoid generic phrases like "click here" or raw URLs.',
          autoFixable: false,
        });
      }
    }
  }

  // LNK-002: Check for bookmarks/outlines in documents with more than 4 pages
  if (pdf.metadata.pageCount > 4) {
    const hasOutlines = pdf.outlines && pdf.outlines.length > 0;

    if (!hasOutlines) {
      findings.push({
        ruleId: 'LNK-002',
        category: 'links',
        severity: 'minor',
        description: `Document has ${pdf.metadata.pageCount} pages but no bookmarks/outlines. Bookmarks provide an alternative way to navigate lengthy documents.`,
        location: {
          pageNumber: 1,
          elementType: 'Document',
          elementDetail: 'No bookmarks/outlines',
        },
        wcagCriterion: '2.4.5 Multiple Ways',
        recommendation:
          'Add bookmarks (outlines) to the document that correspond to the heading structure, enabling users to navigate directly to sections.',
        autoFixable: true,
      });
    }
  }

  return findings;
}
