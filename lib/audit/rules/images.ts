import type { AuditFinding } from '@/types/audit';
import type { ParsedPDF, TagNode } from '@/types/pdf';

/** Patterns that indicate low-quality or suspicious alt text */
const SUSPICIOUS_ALT_PATTERNS = [
  /\.(png|jpg|jpeg|gif|bmp|tiff|svg)$/i,
  /^image$/i,
  /^photo$/i,
  /^picture$/i,
  /^untitled$/i,
  /^IMG_\d+/,
  /^image\d+/i,
  /^DSC_?\d+/i,
  /^screenshot/i,
  /^graphic$/i,
];

interface FigureInfo {
  tag: TagNode;
  altText: string | undefined;
  pageIndex: number;
}

/**
 * Recursively collect all Figure tags from the tag tree.
 */
function collectFigures(node: TagNode): FigureInfo[] {
  const figures: FigureInfo[] = [];

  if (node.type === 'Figure') {
    figures.push({
      tag: node,
      altText: node.altText,
      pageIndex: node.pageIndex ?? 0,
    });
  }

  for (const child of node.children) {
    figures.push(...collectFigures(child));
  }

  return figures;
}

/**
 * Recursively count Figure and Artifact tags per page.
 */
function countFigureAndArtifactsByPage(node: TagNode): Map<number, number> {
  const counts = new Map<number, number>();

  if (node.type === 'Figure' || node.type === 'Artifact') {
    const page = node.pageIndex ?? 0;
    counts.set(page, (counts.get(page) ?? 0) + 1);
  }

  for (const child of node.children) {
    const childCounts = countFigureAndArtifactsByPage(child);
    for (const [page, count] of Array.from(childCounts)) {
      counts.set(page, (counts.get(page) ?? 0) + count);
    }
  }

  return counts;
}

/**
 * Image rules: IMG-001 through IMG-003
 */
export function imageRules(pdf: ParsedPDF): AuditFinding[] {
  const findings: AuditFinding[] = [];

  if (!pdf.tagTree) {
    // Without a tag tree, we cannot inspect Figure tags.
    // DOC-002 already flags the missing tag tree.
    // However, if there are images on pages, we should still flag them.
    for (const page of pdf.pages) {
      if (page.imageItems.length > 0) {
        findings.push({
          ruleId: 'IMG-003',
          category: 'images',
          severity: 'minor',
          description: `Page ${page.pageIndex + 1} contains ${page.imageItems.length} image(s) but no tag tree exists to represent them as Figure or Artifact.`,
          location: {
            pageNumber: page.pageIndex + 1,
            elementType: 'Image',
            elementDetail: `${page.imageItems.length} untagged image(s)`,
          },
          wcagCriterion: '1.1.1 Non-text Content',
          recommendation:
            'Tag the document and ensure all meaningful images are tagged as Figure with alt text, and decorative images are tagged as Artifact.',
          autoFixable: true,
        });
      }
    }
    return findings;
  }

  const figures = collectFigures(pdf.tagTree);

  // IMG-001: Check all Figure tags have alt text
  for (const figure of figures) {
    if (!figure.altText || figure.altText.trim().length === 0) {
      findings.push({
        ruleId: 'IMG-001',
        category: 'images',
        severity: 'critical',
        description: `Figure tag on page ${figure.pageIndex + 1} is missing alternative text. Images without alt text are inaccessible to screen reader users.`,
        location: {
          pageNumber: figure.pageIndex + 1,
          elementType: 'Figure',
          elementDetail: 'Missing alt text',
        },
        wcagCriterion: '1.1.1 Non-text Content',
        recommendation:
          'Add descriptive alternative text to the Figure tag that conveys the same information as the image.',
        autoFixable: false,
      });
    }
  }

  // IMG-002: Check for suspicious/low-quality alt text
  for (const figure of figures) {
    if (figure.altText && figure.altText.trim().length > 0) {
      const text = figure.altText.trim();
      const isSuspicious = SUSPICIOUS_ALT_PATTERNS.some((pattern) =>
        pattern.test(text)
      );

      if (isSuspicious) {
        findings.push({
          ruleId: 'IMG-002',
          category: 'images',
          severity: 'major',
          description: `Figure tag on page ${figure.pageIndex + 1} has suspicious alt text: "${text}". This appears to be a filename, placeholder, or generic label rather than a meaningful description.`,
          location: {
            pageNumber: figure.pageIndex + 1,
            elementType: 'Figure',
            elementDetail: `Suspicious alt text: "${text}"`,
          },
          wcagCriterion: '1.1.1 Non-text Content',
          recommendation:
            'Replace the alt text with a meaningful description of the image content and purpose.',
          autoFixable: false,
        });
      }
    }
  }

  // IMG-003: Check for images on pages not represented in the tag tree
  const taggedImagesByPage = countFigureAndArtifactsByPage(pdf.tagTree);

  for (const page of pdf.pages) {
    const imageCount = page.imageItems.length;
    if (imageCount === 0) continue;

    const taggedCount = taggedImagesByPage.get(page.pageIndex) ?? 0;

    if (imageCount > taggedCount) {
      const untaggedCount = imageCount - taggedCount;
      findings.push({
        ruleId: 'IMG-003',
        category: 'images',
        severity: 'minor',
        description: `Page ${page.pageIndex + 1} has ${imageCount} image(s) but only ${taggedCount} are tagged as Figure or Artifact. ${untaggedCount} image(s) may not be accessible.`,
        location: {
          pageNumber: page.pageIndex + 1,
          elementType: 'Image',
          elementDetail: `${untaggedCount} potentially untagged image(s)`,
        },
        wcagCriterion: '1.1.1 Non-text Content',
        recommendation:
          'Ensure all meaningful images are tagged as Figure with alt text, and decorative images are marked as Artifact.',
        autoFixable: true,
      });
    }
  }

  return findings;
}
