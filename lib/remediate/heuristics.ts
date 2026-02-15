import { TextItem } from '@/types/pdf';

// ---------------------------------------------------------------------------
// Interfaces
// ---------------------------------------------------------------------------

export interface DetectedHeading {
  text: string;
  level: number; // 1-6
  textItems: TextItem[];
  pageIndex: number;
  y: number;
}

export interface DetectedListItem {
  label: string; // bullet char or number
  body: string;
  textItems: TextItem[];
  pageIndex: number;
  y: number;
  indentLevel: number;
}

export interface DetectedList {
  items: DetectedListItem[];
  ordered: boolean;
  pageIndex: number;
  startY: number;
}

export interface DetectedTableCell {
  text: string;
  textItems: TextItem[];
  row: number;
  col: number;
  isHeader: boolean;
}

export interface DetectedTable {
  cells: DetectedTableCell[];
  rows: number;
  cols: number;
  pageIndex: number;
  startY: number;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Tolerance (pts) used to decide whether two y-positions sit on the same line. */
const Y_TOLERANCE = 2;

/** Tolerance (pts) used to decide whether two font sizes are "the same level". */
const FONT_SIZE_TOLERANCE = 0.5;

/** Minimum ratio of fontSize-to-body-size to be considered a heading. */
const HEADING_SIZE_RATIO = 1.2;

/** Maximum character length for a heading candidate. */
const MAX_HEADING_LENGTH = 200;

/** Column x-position alignment tolerance (pts). */
const COL_X_TOLERANCE = 4;

/** Minimum number of rows required to consider content a table. */
const MIN_TABLE_ROWS = 3;

/** Minimum number of columns required to consider content a table. */
const MIN_TABLE_COLS = 2;

/** X-position tolerance for grouping list items at the same indent. */
const LIST_X_TOLERANCE = 6;

/** Minimum gap (pts) between a heading candidate and the preceding text. */
const HEADING_GAP_THRESHOLD = 8;

// ---- tiny utilities -------------------------------------------------------

function almostEqual(a: number, b: number, tolerance: number): boolean {
  return Math.abs(a - b) <= tolerance;
}

/**
 * Merge consecutive TextItems that share the same y-position (within
 * tolerance) into a single combined string while keeping the list of
 * contributing items.
 */
function mergeLineItems(
  items: TextItem[],
): { text: string; items: TextItem[]; y: number; pageIndex: number }[] {
  if (items.length === 0) return [];

  // Sort by page, then y (descending – PDF y-axis goes up), then x.
  const sorted = [...items].sort((a, b) => {
    if (a.pageIndex !== b.pageIndex) return a.pageIndex - b.pageIndex;
    if (!almostEqual(a.y, b.y, Y_TOLERANCE)) return b.y - a.y; // higher y first
    return a.x - b.x;
  });

  const lines: { text: string; items: TextItem[]; y: number; pageIndex: number }[] = [];
  let currentLine: TextItem[] = [sorted[0]];

  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1];
    const cur = sorted[i];

    if (
      cur.pageIndex === prev.pageIndex &&
      almostEqual(cur.y, prev.y, Y_TOLERANCE)
    ) {
      currentLine.push(cur);
    } else {
      lines.push(finalizeLine(currentLine));
      currentLine = [cur];
    }
  }
  lines.push(finalizeLine(currentLine));

  return lines;
}

function finalizeLine(
  items: TextItem[],
): { text: string; items: TextItem[]; y: number; pageIndex: number } {
  // Sort items within the line by x-position for correct reading order.
  const sorted = [...items].sort((a, b) => a.x - b.x);
  const text = sorted.map((t) => t.text).join('');
  return {
    text: text.trim(),
    items: sorted,
    y: sorted[0].y,
    pageIndex: sorted[0].pageIndex,
  };
}

/**
 * Find the most common font size among the provided text items.
 * Returns 0 when the input is empty.
 */
function findBodyFontSize(textItems: TextItem[]): number {
  if (textItems.length === 0) return 0;

  // Weight each item's contribution by text length so that long body
  // paragraphs dominate over short headings.
  const sizeWeight = new Map<number, number>();

  for (const item of textItems) {
    const len = item.text.length;
    if (len === 0) continue;
    // Round fontSize to one decimal to group near-identical sizes.
    const rounded = Math.round(item.fontSize * 10) / 10;
    sizeWeight.set(rounded, (sizeWeight.get(rounded) ?? 0) + len);
  }

  let bestSize = 0;
  let bestWeight = 0;
  for (const [size, weight] of sizeWeight) {
    if (weight > bestWeight) {
      bestWeight = weight;
      bestSize = size;
    }
  }
  return bestSize;
}

/**
 * Build a sorted array of unique heading font sizes (descending) from a set
 * of candidate sizes, grouping sizes that are within FONT_SIZE_TOLERANCE of
 * each other into the same bucket.
 */
function buildHeadingLevels(sizes: number[]): number[] {
  if (sizes.length === 0) return [];

  const sorted = Array.from(new Set(sizes)).sort((a, b) => b - a);
  const levels: number[] = [sorted[0]];

  for (let i = 1; i < sorted.length; i++) {
    if (!almostEqual(sorted[i], levels[levels.length - 1], FONT_SIZE_TOLERANCE)) {
      levels.push(sorted[i]);
    }
  }

  return levels; // largest first
}

// ---------------------------------------------------------------------------
// Bullet / ordered-label patterns
// ---------------------------------------------------------------------------

const BULLET_CHARS = new Set([
  '\u2022', // •
  '\u25CF', // ●
  '\u25CB', // ○
  '\u25A0', // ■
  '\u25A1', // □
  '\u25AA', // ▪
  '-',
  '\u2013', // –
  '\u2014', // —
]);

/**
 * Attempt to parse a list-item label from the beginning of `text`.
 * Returns `{ label, body }` on success, or `null` otherwise.
 */
function parseListLabel(
  text: string,
): { label: string; body: string; ordered: boolean } | null {
  const trimmed = text.trimStart();
  if (trimmed.length === 0) return null;

  // Single bullet character followed by whitespace.
  if (BULLET_CHARS.has(trimmed[0]) && trimmed.length > 1 && /\s/.test(trimmed[1])) {
    return {
      label: trimmed[0],
      body: trimmed.slice(1).trimStart(),
      ordered: false,
    };
  }

  // Ordered patterns: "1.", "12.", "a.", "iv.", "(1)", "(a)", etc.
  const orderedPatterns: RegExp[] = [
    /^(\d{1,4})\.\s+/,         // 1. 12. etc.
    /^([a-zA-Z])\.\s+/,        // a. b. A. B.
    /^((?:x{0,3}(?:ix|iv|v?i{0,3})|(?:ix|iv|v?i{0,3})))\.\s+/i, // roman: i. ii. iv.
    /^\((\d{1,4})\)\s+/,       // (1)
    /^\(([a-zA-Z])\)\s+/,      // (a)
  ];

  for (const re of orderedPatterns) {
    const m = trimmed.match(re);
    if (m) {
      return {
        label: m[0].trimEnd(),
        body: trimmed.slice(m[0].length).trimStart(),
        ordered: true,
      };
    }
  }

  return null;
}

// ---------------------------------------------------------------------------
// detectHeadings
// ---------------------------------------------------------------------------

export function detectHeadings(textItems: TextItem[]): DetectedHeading[] {
  if (textItems.length === 0) return [];

  const bodySize = findBodyFontSize(textItems);
  if (bodySize === 0) return [];

  // Merge items into logical lines.
  const lines = mergeLineItems(textItems);

  // Identify candidate heading lines.
  interface HeadingCandidate {
    text: string;
    fontSize: number;
    items: TextItem[];
    pageIndex: number;
    y: number;
  }

  const candidates: HeadingCandidate[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.text.length === 0 || line.text.length >= MAX_HEADING_LENGTH) continue;

    // Determine dominant font size & bold state for this line.
    const maxFontSize = Math.max(...line.items.map((t) => t.fontSize));
    const isBold = line.items.some((t) => t.isBold);

    const isLarger = maxFontSize >= bodySize * HEADING_SIZE_RATIO;
    const isBoldAtLargerSize = isBold && maxFontSize > bodySize;

    if (!isLarger && !isBoldAtLargerSize) continue;

    // Check that the heading is preceded by a vertical gap (section break) or
    // is at the top of its page.
    let precededByGap = false;
    if (i === 0) {
      precededByGap = true;
    } else {
      const prev = lines[i - 1];
      if (prev.pageIndex !== line.pageIndex) {
        // First line on a new page.
        precededByGap = true;
      } else {
        // Gap between previous line and this one. PDF y-axis grows upward so
        // a preceding line has higher y when it is above.
        const gap = Math.abs(prev.y - line.y) - (line.items[0]?.height ?? 0);
        if (gap >= HEADING_GAP_THRESHOLD) {
          precededByGap = true;
        }
      }
    }

    if (!precededByGap) continue;

    candidates.push({
      text: line.text,
      fontSize: maxFontSize,
      items: line.items,
      pageIndex: line.pageIndex,
      y: line.y,
    });
  }

  if (candidates.length === 0) return [];

  // Determine heading levels based on relative font sizes.
  const levels = buildHeadingLevels(candidates.map((c) => c.fontSize));

  const headings: DetectedHeading[] = candidates.map((c) => {
    // Find which level bucket this candidate falls into.
    let level = levels.length; // fallback: deepest
    for (let l = 0; l < levels.length; l++) {
      if (almostEqual(c.fontSize, levels[l], FONT_SIZE_TOLERANCE)) {
        level = l + 1; // 1-based
        break;
      }
    }
    // Clamp to 1-6.
    level = Math.max(1, Math.min(6, level));

    return {
      text: c.text,
      level,
      textItems: c.items,
      pageIndex: c.pageIndex,
      y: c.y,
    };
  });

  // Sort by page then y (descending y = higher on page comes first).
  headings.sort((a, b) => {
    if (a.pageIndex !== b.pageIndex) return a.pageIndex - b.pageIndex;
    return b.y - a.y;
  });

  return headings;
}

// ---------------------------------------------------------------------------
// detectLists
// ---------------------------------------------------------------------------

export function detectLists(textItems: TextItem[]): DetectedList[] {
  if (textItems.length === 0) return [];

  // Merge into lines.
  const lines = mergeLineItems(textItems);

  // Determine the baseline x-position for each page (the most common leftmost
  // x among lines on that page).
  const pageBaseX = new Map<number, number>();
  {
    const pageXCounts = new Map<number, Map<number, number>>();
    for (const line of lines) {
      const roundedX = Math.round(line.items[0]?.x ?? 0);
      if (!pageXCounts.has(line.pageIndex)) {
        pageXCounts.set(line.pageIndex, new Map());
      }
      const counts = pageXCounts.get(line.pageIndex)!;
      counts.set(roundedX, (counts.get(roundedX) ?? 0) + 1);
    }
    for (const [page, counts] of pageXCounts) {
      let bestX = 0;
      let bestCount = 0;
      for (const [x, c] of counts) {
        if (c > bestCount) {
          bestCount = c;
          bestX = x;
        }
      }
      pageBaseX.set(page, bestX);
    }
  }

  // Identify list-item lines.
  interface ListItemLine {
    label: string;
    body: string;
    ordered: boolean;
    items: TextItem[];
    pageIndex: number;
    y: number;
    x: number;
  }

  const listItemLines: ListItemLine[] = [];

  for (const line of lines) {
    const parsed = parseListLabel(line.text);
    if (!parsed) continue;

    const x = line.items[0]?.x ?? 0;

    listItemLines.push({
      label: parsed.label,
      body: parsed.body,
      ordered: parsed.ordered,
      items: line.items,
      pageIndex: line.pageIndex,
      y: line.y,
      x,
    });
  }

  if (listItemLines.length === 0) return [];

  // Group consecutive list-item lines at similar x-positions into lists.
  const lists: DetectedList[] = [];
  let currentGroup: ListItemLine[] = [listItemLines[0]];

  for (let i = 1; i < listItemLines.length; i++) {
    const prev = listItemLines[i - 1];
    const cur = listItemLines[i];

    // Same page, similar x, and consecutive in original line order.
    const samePage = cur.pageIndex === prev.pageIndex;
    const similarX = almostEqual(cur.x, prev.x, LIST_X_TOLERANCE);

    // Check that they were adjacent in the original merged-line list (no large
    // gaps of unrelated content between them). We rely on the mergeLineItems
    // ordering and simply check that the y-gap is reasonable.
    const yGap = Math.abs(prev.y - cur.y);
    const lineHeight = prev.items[0]?.height ?? 12;
    const reasonable = yGap < lineHeight * 3;

    if (samePage && similarX && reasonable) {
      currentGroup.push(cur);
    } else {
      if (currentGroup.length >= 1) {
        lists.push(buildList(currentGroup, pageBaseX));
      }
      currentGroup = [cur];
    }
  }
  if (currentGroup.length >= 1) {
    lists.push(buildList(currentGroup, pageBaseX));
  }

  return lists;
}

function buildList(
  group: {
    label: string;
    body: string;
    ordered: boolean;
    items: TextItem[];
    pageIndex: number;
    y: number;
    x: number;
  }[],
  pageBaseX: Map<number, number>,
): DetectedList {
  // Determine the minimum x in the group to compute indent levels.
  const baseX = pageBaseX.get(group[0].pageIndex) ?? group[0].x;
  const indentUnit = 20; // ~20pt per indent level is a common convention.

  // Decide ordered vs unordered by majority vote.
  const orderedCount = group.filter((g) => g.ordered).length;
  const ordered = orderedCount > group.length / 2;

  const items: DetectedListItem[] = group.map((g) => {
    const indentPx = Math.max(0, g.x - baseX);
    const indentLevel = Math.round(indentPx / indentUnit);
    return {
      label: g.label,
      body: g.body,
      textItems: g.items,
      pageIndex: g.pageIndex,
      y: g.y,
      indentLevel,
    };
  });

  return {
    items,
    ordered,
    pageIndex: group[0].pageIndex,
    startY: group[0].y,
  };
}

// ---------------------------------------------------------------------------
// detectTables
// ---------------------------------------------------------------------------

export function detectTables(textItems: TextItem[]): DetectedTable[] {
  if (textItems.length === 0) return [];

  // Step 1: Group text items by page.
  const byPage = new Map<number, TextItem[]>();
  for (const item of textItems) {
    if (!byPage.has(item.pageIndex)) {
      byPage.set(item.pageIndex, []);
    }
    byPage.get(item.pageIndex)!.push(item);
  }

  const tables: DetectedTable[] = [];

  for (const [pageIndex, pageItems] of byPage) {
    const pageTables = detectTablesOnPage(pageItems, pageIndex);
    tables.push(...pageTables);
  }

  // Sort by page and startY.
  tables.sort((a, b) => {
    if (a.pageIndex !== b.pageIndex) return a.pageIndex - b.pageIndex;
    return b.startY - a.startY;
  });

  return tables;
}

function detectTablesOnPage(pageItems: TextItem[], pageIndex: number): DetectedTable[] {
  if (pageItems.length === 0) return [];

  // Step 2: Group items into rows by y-position.
  const sorted = [...pageItems].sort((a, b) => {
    if (!almostEqual(a.y, b.y, Y_TOLERANCE)) return b.y - a.y;
    return a.x - b.x;
  });

  // Build rows (groups of items at similar y).
  const rows: { y: number; items: TextItem[] }[] = [];
  let currentRow: TextItem[] = [sorted[0]];
  let currentY = sorted[0].y;

  for (let i = 1; i < sorted.length; i++) {
    if (almostEqual(sorted[i].y, currentY, Y_TOLERANCE)) {
      currentRow.push(sorted[i]);
    } else {
      rows.push({ y: currentY, items: currentRow });
      currentRow = [sorted[i]];
      currentY = sorted[i].y;
    }
  }
  rows.push({ y: currentY, items: currentRow });

  // Step 3: Find column alignments. For each row, record the x-positions of
  // its items (using the start x of each distinct "cell" cluster).
  // Merge nearby items within a row into cells first.
  interface RowCell {
    x: number;
    text: string;
    items: TextItem[];
  }

  const rowCells: RowCell[][] = rows.map((row) => {
    const sortedItems = [...row.items].sort((a, b) => a.x - b.x);
    const cells: RowCell[] = [];
    let cellItems: TextItem[] = [sortedItems[0]];

    for (let i = 1; i < sortedItems.length; i++) {
      const prev = sortedItems[i - 1];
      const cur = sortedItems[i];
      // If the current item starts within or very close to the end of the
      // previous item, they belong to the same cell.
      const prevEnd = prev.x + prev.width;
      const gap = cur.x - prevEnd;
      if (gap < 10) {
        cellItems.push(cur);
      } else {
        cells.push({
          x: cellItems[0].x,
          text: cellItems.map((t) => t.text).join('').trim(),
          items: cellItems,
        });
        cellItems = [cur];
      }
    }
    cells.push({
      x: cellItems[0].x,
      text: cellItems.map((t) => t.text).join('').trim(),
      items: cellItems,
    });
    return cells;
  });

  // Step 4: Only keep rows that have 2+ cells (single-cell rows are unlikely
  // table rows).
  const multiCellRowIndices: number[] = [];
  for (let i = 0; i < rowCells.length; i++) {
    if (rowCells[i].length >= MIN_TABLE_COLS) {
      multiCellRowIndices.push(i);
    }
  }

  if (multiCellRowIndices.length < MIN_TABLE_ROWS) return [];

  // Step 5: Identify column x-positions across rows by clustering the cell
  // x-positions.
  const allXPositions: number[] = [];
  for (const idx of multiCellRowIndices) {
    for (const cell of rowCells[idx]) {
      allXPositions.push(cell.x);
    }
  }
  const columnXPositions = clusterValues(allXPositions, COL_X_TOLERANCE);

  if (columnXPositions.length < MIN_TABLE_COLS) return [];

  // Step 6: Find contiguous runs of multi-cell rows that share column
  // alignments. A row "matches" the column grid if most of its cells align
  // with a known column position.
  const matchingRows: number[] = [];
  for (const idx of multiCellRowIndices) {
    const cells = rowCells[idx];
    let aligned = 0;
    for (const cell of cells) {
      if (columnXPositions.some((cx) => almostEqual(cell.x, cx, COL_X_TOLERANCE))) {
        aligned++;
      }
    }
    if (aligned >= Math.min(MIN_TABLE_COLS, cells.length)) {
      matchingRows.push(idx);
    }
  }

  if (matchingRows.length < MIN_TABLE_ROWS) return [];

  // Group into contiguous runs.
  const runs: number[][] = [];
  let currentRun: number[] = [matchingRows[0]];
  for (let i = 1; i < matchingRows.length; i++) {
    // Allow a gap of 1 row (e.g., a thin separator row without text).
    if (matchingRows[i] - matchingRows[i - 1] <= 2) {
      currentRun.push(matchingRows[i]);
    } else {
      runs.push(currentRun);
      currentRun = [matchingRows[i]];
    }
  }
  runs.push(currentRun);

  // Step 7: Build DetectedTable for each run with enough rows.
  const tables: DetectedTable[] = [];

  for (const run of runs) {
    if (run.length < MIN_TABLE_ROWS) continue;

    // Re-compute column positions for this specific run.
    const runXPositions: number[] = [];
    for (const idx of run) {
      for (const cell of rowCells[idx]) {
        runXPositions.push(cell.x);
      }
    }
    const colPositions = clusterValues(runXPositions, COL_X_TOLERANCE);
    if (colPositions.length < MIN_TABLE_COLS) continue;

    // Sort columns left to right.
    colPositions.sort((a, b) => a - b);

    const numRows = run.length;
    const numCols = colPositions.length;

    const cells: DetectedTableCell[] = [];

    for (let r = 0; r < run.length; r++) {
      const rowIdx = run[r];
      const rc = rowCells[rowIdx];

      for (const cell of rc) {
        // Find the best-matching column.
        let bestCol = 0;
        let bestDist = Infinity;
        for (let c = 0; c < colPositions.length; c++) {
          const dist = Math.abs(cell.x - colPositions[c]);
          if (dist < bestDist) {
            bestDist = dist;
            bestCol = c;
          }
        }

        cells.push({
          text: cell.text,
          textItems: cell.items,
          row: r,
          col: bestCol,
          isHeader: r === 0,
        });
      }
    }

    tables.push({
      cells,
      rows: numRows,
      cols: numCols,
      pageIndex,
      startY: rows[run[0]].y,
    });
  }

  return tables;
}

/**
 * Cluster an array of numeric values so that values within `tolerance` of
 * each other belong to the same cluster. Returns the centroid of each cluster
 * sorted ascending.
 */
function clusterValues(values: number[], tolerance: number): number[] {
  if (values.length === 0) return [];

  const sorted = [...values].sort((a, b) => a - b);
  const clusters: number[][] = [[sorted[0]]];

  for (let i = 1; i < sorted.length; i++) {
    const lastCluster = clusters[clusters.length - 1];
    const lastMean =
      lastCluster.reduce((s, v) => s + v, 0) / lastCluster.length;
    if (Math.abs(sorted[i] - lastMean) <= tolerance) {
      lastCluster.push(sorted[i]);
    } else {
      clusters.push([sorted[i]]);
    }
  }

  return clusters
    .map((c) => c.reduce((s, v) => s + v, 0) / c.length)
    .sort((a, b) => a - b);
}
