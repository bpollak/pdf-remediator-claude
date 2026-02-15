import type { AuditFinding } from '@/types/audit';
import type { ParsedPDF, TextItem } from '@/types/pdf';
import {
  contrastRatio,
  isLargeText,
  meetsAANormalText,
  meetsAALargeText,
} from '@/lib/utils/contrast';

/** White background assumption */
const WHITE_BG = { r: 255, g: 255, b: 255 };

/**
 * Convert RGB color to a stable string key for grouping.
 */
function colorKey(r: number, g: number, b: number): string {
  return `${r},${g},${b}`;
}

/**
 * Determine if a color is "non-black / non-very-dark", indicating colored text.
 * Very dark is defined as all channels <= 30.
 */
function isColoredText(r: number, g: number, b: number): boolean {
  // Pure black or very dark
  if (r <= 30 && g <= 30 && b <= 30) return false;
  // Near-black grays
  if (Math.abs(r - g) <= 10 && Math.abs(g - b) <= 10 && r <= 50) return false;
  // Check if it's actually colored (not just gray)
  const maxDiff = Math.max(Math.abs(r - g), Math.abs(g - b), Math.abs(r - b));
  // It's considered "colored" if channels diverge or it's noticeably light
  return maxDiff > 20 || r > 100 || g > 100 || b > 100;
}

/**
 * Color rules: CLR-001 and CLR-002
 */
export function colorRules(pdf: ParsedPDF): AuditFinding[] {
  const findings: AuditFinding[] = [];

  // Collect distinct colors and a sample text item for each
  const colorSamples = new Map<
    string,
    {
      color: { r: number; g: number; b: number };
      sampleItem: TextItem;
      hasLargeText: boolean;
      hasNormalText: boolean;
      pageIndex: number;
    }
  >();

  for (const page of pdf.pages) {
    for (const item of page.textItems) {
      if (!item.color) continue;
      if (item.text.trim().length === 0) continue;

      const key = colorKey(item.color.r, item.color.g, item.color.b);
      const existing = colorSamples.get(key);

      if (!existing) {
        colorSamples.set(key, {
          color: item.color,
          sampleItem: item,
          hasLargeText: isLargeText(item.fontSize, item.isBold),
          hasNormalText: !isLargeText(item.fontSize, item.isBold),
          pageIndex: item.pageIndex,
        });
      } else {
        // Track whether this color is used for both large and normal text
        if (isLargeText(item.fontSize, item.isBold)) {
          existing.hasLargeText = true;
        } else {
          existing.hasNormalText = true;
        }
      }
    }
  }

  // CLR-001: Check text contrast for each unique color
  let hasColoredText = false;

  for (const [, sample] of Array.from(colorSamples)) {
    const ratio = contrastRatio(sample.color, WHITE_BG);
    const { r, g, b } = sample.color;

    // Check if it's colored (for CLR-002)
    if (isColoredText(r, g, b)) {
      hasColoredText = true;
    }

    // Determine if contrast fails for the text sizes this color is used for
    let fails = false;
    let failureDetail = '';

    if (sample.hasNormalText && !meetsAANormalText(ratio)) {
      fails = true;
      failureDetail = `normal text requires 4.5:1, got ${ratio.toFixed(2)}:1`;
    } else if (
      sample.hasLargeText &&
      !sample.hasNormalText &&
      !meetsAALargeText(ratio)
    ) {
      fails = true;
      failureDetail = `large text requires 3:1, got ${ratio.toFixed(2)}:1`;
    }

    if (fails) {
      findings.push({
        ruleId: 'CLR-001',
        category: 'color',
        severity: 'major',
        description: `Text color rgb(${r}, ${g}, ${b}) against white background has insufficient contrast (${failureDetail}). This affects readability for users with low vision.`,
        location: {
          pageNumber: sample.pageIndex + 1,
          elementType: 'Text',
          elementDetail: `Color rgb(${r}, ${g}, ${b}), ratio ${ratio.toFixed(2)}:1`,
        },
        wcagCriterion: '1.4.3 Contrast (Minimum)',
        recommendation:
          'Increase the contrast ratio by using a darker text color. WCAG AA requires at least 4.5:1 for normal text and 3:1 for large text (18pt+ or 14pt+ bold).',
        autoFixable: false,
      });
    }
  }

  // CLR-002: Information conveyed by color alone
  if (hasColoredText) {
    findings.push({
      ruleId: 'CLR-002',
      category: 'color',
      severity: 'minor',
      description:
        'Document contains colored text (non-black). If color alone is used to convey information (e.g., red for errors, green for success), users who cannot perceive color may miss this information.',
      location: {
        pageNumber: 1,
        elementType: 'Document',
        elementDetail: 'Colored text detected',
      },
      wcagCriterion: '1.4.1 Use of Color',
      recommendation:
        'Ensure that any information conveyed through color is also available through other visual means such as text labels, patterns, or symbols.',
      autoFixable: false,
    });
  }

  return findings;
}
