/**
 * Convert sRGB component to linear RGB
 */
function sRGBtoLinear(c: number): number {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}

/**
 * Calculate relative luminance per WCAG 2.1
 */
export function relativeLuminance(r: number, g: number, b: number): number {
  return 0.2126 * sRGBtoLinear(r) + 0.7152 * sRGBtoLinear(g) + 0.0722 * sRGBtoLinear(b);
}

/**
 * Calculate contrast ratio between two colors
 * Returns ratio as number (e.g. 4.5 for 4.5:1)
 */
export function contrastRatio(
  fg: { r: number; g: number; b: number },
  bg: { r: number; g: number; b: number }
): number {
  const l1 = relativeLuminance(fg.r, fg.g, fg.b);
  const l2 = relativeLuminance(bg.r, bg.g, bg.b);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Check if contrast meets WCAG AA for normal text (4.5:1)
 */
export function meetsAANormalText(ratio: number): boolean {
  return ratio >= 4.5;
}

/**
 * Check if contrast meets WCAG AA for large text (3:1)
 * Large text is >= 18pt or >= 14pt bold
 */
export function meetsAALargeText(ratio: number): boolean {
  return ratio >= 3.0;
}

/**
 * Determine if text is "large" per WCAG definition
 * Large = 18pt+ regular or 14pt+ bold
 * 1pt = 1.333px approximately
 */
export function isLargeText(fontSize: number, isBold: boolean): boolean {
  // fontSize is in PDF points which are ~CSS points
  if (isBold) return fontSize >= 14;
  return fontSize >= 18;
}
