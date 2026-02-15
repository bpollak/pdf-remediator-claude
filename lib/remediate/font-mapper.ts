import { StandardFonts } from 'pdf-lib';

export type FontStyle = {
  base: StandardFonts;
  bold: StandardFonts;
  italic: StandardFonts;
  boldItalic: StandardFonts;
};

const serifFonts: FontStyle = {
  base: StandardFonts.TimesRoman,
  bold: StandardFonts.TimesRomanBold,
  italic: StandardFonts.TimesRomanItalic,
  boldItalic: StandardFonts.TimesRomanBoldItalic,
};

const sansSerifFonts: FontStyle = {
  base: StandardFonts.Helvetica,
  bold: StandardFonts.HelveticaBold,
  italic: StandardFonts.HelveticaOblique,
  boldItalic: StandardFonts.HelveticaBoldOblique,
};

const monoFonts: FontStyle = {
  base: StandardFonts.Courier,
  bold: StandardFonts.CourierBold,
  italic: StandardFonts.CourierOblique,
  boldItalic: StandardFonts.CourierBoldOblique,
};

/**
 * Map a font family string to the appropriate standard font family
 */
export function mapFontFamily(fontFamily: string, fontName: string): FontStyle {
  const lower = (fontFamily + ' ' + fontName).toLowerCase();

  if (lower.includes('courier') || lower.includes('mono') || lower.includes('consolas') || lower.includes('menlo')) {
    return monoFonts;
  }
  if (lower.includes('helvetica') || lower.includes('arial') || lower.includes('sans') || lower.includes('gothic') || lower.includes('verdana') || lower.includes('calibri') || lower.includes('tahoma')) {
    return sansSerifFonts;
  }
  if (lower.includes('times') || lower.includes('serif') || lower.includes('georgia') || lower.includes('garamond') || lower.includes('cambria') || lower.includes('palatino')) {
    return serifFonts;
  }
  // Default to sans-serif
  return sansSerifFonts;
}

/**
 * Get the specific standard font for a given text item's style
 */
export function getStandardFont(fontFamily: string, fontName: string, isBold: boolean, isItalic: boolean): StandardFonts {
  const family = mapFontFamily(fontFamily, fontName);
  if (isBold && isItalic) return family.boldItalic;
  if (isBold) return family.bold;
  if (isItalic) return family.italic;
  return family.base;
}
