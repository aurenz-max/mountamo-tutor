/**
 * Editorial Layout — Pretext wrapper for advanced text layout.
 *
 * Uses @chenglou/pretext to calculate line breaks with variable widths,
 * predict text heights without DOM reads, and balance multi-column text.
 *
 * Three layout modes:
 *   1. Text-around-figure — variable width per line to wrap around an image
 *   2. Height prediction — pure arithmetic for masonry/column balancing
 *   3. Balanced columns — split text into N columns with equal height
 *
 * IMPORTANT: pretext warns against system-ui / ui-sans-serif fonts because
 * canvas resolves them to different optical variants than the DOM on macOS.
 * Always use named fonts (Inter, Helvetica, Georgia, etc.).
 */

import {
  prepare,
  prepareWithSegments,
  layout,
  layoutNextLine,
  layoutWithLines,
  type PreparedText,
  type PreparedTextWithSegments,
  type LayoutCursor,
  type LayoutLine,
  type LayoutResult,
  type LayoutLinesResult,
} from '@chenglou/pretext';

// ── Constants ────────────────────────────────────────────────────────

/**
 * Named font matching Lumina's system font (Inter, loaded via next/font/google).
 * NEVER use system-ui or ui-sans-serif — pretext's canvas measurement resolves
 * them to different optical variants than the DOM on macOS.
 */
export const EDITORIAL_FONT = '16px Inter, Helvetica, Arial, sans-serif';
export const EDITORIAL_LINE_HEIGHT = 26; // px — slightly more generous than 24 for readability
export const PARAGRAPH_GAP = 16; // px between paragraphs

// ── Prepare cache ───────────────────────────────────────────────────

const prepareCache = new Map<string, PreparedTextWithSegments>();
const prepareLightCache = new Map<string, PreparedText>();

function cacheKey(text: string, font: string): string {
  return `${font}|||${text}`;
}

/** Prepare text for rich layout (line-by-line rendering). Cached. */
export function prepareText(
  text: string,
  font: string = EDITORIAL_FONT,
): PreparedTextWithSegments {
  const key = cacheKey(text, font);
  const cached = prepareCache.get(key);
  if (cached) return cached;

  const prepared = prepareWithSegments(text, font);
  prepareCache.set(key, prepared);
  return prepared;
}

/** Prepare text for height prediction only (no line text needed). Cached. */
export function prepareTextLight(
  text: string,
  font: string = EDITORIAL_FONT,
): PreparedText {
  const key = cacheKey(text, font);
  const cached = prepareLightCache.get(key);
  if (cached) return cached;

  const prepared = prepare(text, font);
  prepareLightCache.set(key, prepared);
  return prepared;
}

// ── Figure rect ─────────────────────────────────────────────────────

export interface FigureRect {
  placement: 'left' | 'right';
  /** Width of the figure area including gap (px) */
  width: number;
  /** Height of the figure area including gap (px) */
  height: number;
}

export interface LayoutLineWithPosition {
  text: string;
  x: number;
  y: number;
  width: number;
}

// ── 1. Text-around-figure layout ────────────────────────────────────

/**
 * Lay out paragraphs around a figure rectangle.
 *
 * Each paragraph is laid out independently with a gap between them.
 * Lines overlapping the figure get reduced width; lines below get full width.
 */
export function layoutParagraphsAroundFigure(
  paragraphs: string[],
  font: string = EDITORIAL_FONT,
  containerWidth: number,
  figureRect: FigureRect,
  lineHeight: number = EDITORIAL_LINE_HEIGHT,
  paragraphGap: number = PARAGRAPH_GAP,
): LayoutLineWithPosition[] {
  const lines: LayoutLineWithPosition[] = [];
  let y = 0;

  for (let pi = 0; pi < paragraphs.length; pi++) {
    const para = paragraphs[pi];
    if (!para || para.trim().length === 0) continue;

    const prepared = prepareText(para, font);
    let cursor: LayoutCursor = { segmentIndex: 0, graphemeIndex: 0 };

    while (true) {
      const overlaps = y < figureRect.height;
      const maxWidth = overlaps
        ? containerWidth - figureRect.width
        : containerWidth;

      // Safety: if maxWidth is too small, use full width (figure will overlap but text won't vanish)
      const effectiveWidth = maxWidth > 40 ? maxWidth : containerWidth;

      const line: LayoutLine | null = layoutNextLine(prepared, cursor, effectiveWidth);
      if (!line) break;

      const x = overlaps && figureRect.placement === 'left'
        ? figureRect.width
        : 0;

      lines.push({ text: line.text, x, y, width: line.width });
      cursor = line.end;
      y += lineHeight;
    }

    // Add paragraph gap (except after last paragraph)
    if (pi < paragraphs.length - 1) {
      y += paragraphGap;
    }
  }

  return lines;
}

/**
 * Legacy single-text API — kept for backward compatibility.
 * Prefer layoutParagraphsAroundFigure for multi-paragraph content.
 */
export function layoutTextAroundFigure(
  text: string,
  font: string = EDITORIAL_FONT,
  containerWidth: number,
  figureRect: FigureRect,
  lineHeight: number = EDITORIAL_LINE_HEIGHT,
): LayoutLineWithPosition[] {
  return layoutParagraphsAroundFigure(
    [text], font, containerWidth, figureRect, lineHeight, 0,
  );
}

// ── 2. Height prediction ────────────────────────────────────────────

export interface ParagraphMetrics {
  lineCount: number;
  height: number;
}

/**
 * Predict the rendered height of a paragraph at a given width.
 * Pure arithmetic — no DOM reads. ~0.0002ms per call after prepare().
 */
export function predictParagraphHeight(
  text: string,
  font: string = EDITORIAL_FONT,
  maxWidth: number,
  lineHeight: number = EDITORIAL_LINE_HEIGHT,
): ParagraphMetrics {
  const prepared = prepareTextLight(text, font);
  const result: LayoutResult = layout(prepared, maxWidth, lineHeight);
  return { lineCount: result.lineCount, height: result.height };
}

/**
 * Predict total height for multiple paragraphs including gaps.
 */
export function predictParagraphsHeight(
  paragraphs: string[],
  font: string = EDITORIAL_FONT,
  maxWidth: number,
  lineHeight: number = EDITORIAL_LINE_HEIGHT,
  paragraphGap: number = PARAGRAPH_GAP,
): number {
  let total = 0;
  for (let i = 0; i < paragraphs.length; i++) {
    const para = paragraphs[i];
    if (!para || para.trim().length === 0) continue;
    const { height } = predictParagraphHeight(para, font, maxWidth, lineHeight);
    total += height;
    if (i < paragraphs.length - 1) total += paragraphGap;
  }
  return total;
}

// ── 3. Balanced multi-column layout ─────────────────────────────────

export interface ColumnLayout {
  /** Lines for each column, with positions relative to the column's origin */
  columns: LayoutLineWithPosition[][];
  /** Width of each column (px) */
  columnWidth: number;
  /** Height of the tallest column (px) — use this for the container */
  maxColumnHeight: number;
}

/**
 * Split paragraphs across N balanced columns using pretext height prediction.
 *
 * Uses binary search to find the target height that distributes text evenly,
 * then lays out each column's text with layoutWithLines().
 */
export function layoutBalancedColumns(
  paragraphs: string[],
  font: string = EDITORIAL_FONT,
  containerWidth: number,
  numColumns: number = 2,
  lineHeight: number = EDITORIAL_LINE_HEIGHT,
  columnGap: number = 32,
  paragraphGap: number = PARAGRAPH_GAP,
): ColumnLayout {
  const columnWidth = (containerWidth - columnGap * (numColumns - 1)) / numColumns;

  // Join all text for total height prediction
  const totalHeight = predictParagraphsHeight(paragraphs, font, columnWidth, lineHeight, paragraphGap);

  // Target height per column — start with equal split
  const targetHeight = totalHeight / numColumns;

  // Distribute paragraphs into columns greedily by height
  const columnParagraphs: string[][] = Array.from({ length: numColumns }, () => []);
  let currentCol = 0;
  let currentColHeight = 0;

  for (const para of paragraphs) {
    if (!para || para.trim().length === 0) continue;

    const paraHeight = predictParagraphHeight(para, font, columnWidth, lineHeight).height;

    // Move to next column if this paragraph would exceed target
    // (but don't move past the last column)
    if (
      currentColHeight > 0 &&
      currentColHeight + paraHeight > targetHeight * 1.15 &&
      currentCol < numColumns - 1
    ) {
      currentCol++;
      currentColHeight = 0;
    }

    columnParagraphs[currentCol].push(para);
    currentColHeight += paraHeight + paragraphGap;
  }

  // Lay out each column
  const columns: LayoutLineWithPosition[][] = [];
  let maxColumnHeight = 0;

  for (let col = 0; col < numColumns; col++) {
    const colLines: LayoutLineWithPosition[] = [];
    const colX = col * (columnWidth + columnGap);
    let y = 0;

    for (let pi = 0; pi < columnParagraphs[col].length; pi++) {
      const para = columnParagraphs[col][pi];
      if (!para || para.trim().length === 0) continue;

      const prepared = prepareText(para, font);
      const result: LayoutLinesResult = layoutWithLines(prepared, columnWidth, lineHeight);

      for (const line of result.lines) {
        colLines.push({ text: line.text, x: colX, y, width: line.width });
        y += lineHeight;
      }

      if (pi < columnParagraphs[col].length - 1) {
        y += paragraphGap;
      }
    }

    columns.push(colLines);
    if (y > maxColumnHeight) maxColumnHeight = y;
  }

  return { columns, columnWidth, maxColumnHeight };
}

// ── 4. Masonry card layout ──────────────────────────────────────────

export interface MasonryCard {
  /** Original paragraph text */
  text: string;
  /** Column index (0-based) */
  column: number;
  /** X position (px) */
  x: number;
  /** Y position (px) */
  y: number;
  /** Card width (px) */
  width: number;
  /** Predicted card content height (px) — add padding in the renderer */
  contentHeight: number;
}

export interface MasonryLayout {
  cards: MasonryCard[];
  numColumns: number;
  columnWidth: number;
  /** Total height of the tallest column (px) */
  totalHeight: number;
}

/**
 * Place paragraphs as cards in a masonry grid using pretext height prediction.
 *
 * Each paragraph becomes a card. Pretext predicts the text height at the
 * card's width without any DOM reads, then we place each card in the
 * shortest column (classic masonry algorithm).
 *
 * This is the same technique as the chenglou.me/pretext/masonry/ demo.
 */
export function layoutMasonryCards(
  paragraphs: string[],
  font: string = EDITORIAL_FONT,
  containerWidth: number,
  numColumns: number = 3,
  columnGap: number = 16,
  rowGap: number = 16,
  cardPadding: number = 24, // will be added to predicted text height
  lineHeight: number = EDITORIAL_LINE_HEIGHT,
): MasonryLayout {
  const columnWidth = (containerWidth - columnGap * (numColumns - 1)) / numColumns;
  const textWidth = columnWidth - cardPadding * 2; // inner text area

  // Track the bottom edge of each column
  const columnHeights = new Array(numColumns).fill(0);
  const cards: MasonryCard[] = [];

  for (const para of paragraphs) {
    if (!para || para.trim().length === 0) continue;

    // Predict text height via pretext — zero DOM reads
    const { height: textHeight } = predictParagraphHeight(para, font, textWidth, lineHeight);
    const cardHeight = textHeight + cardPadding * 2;

    // Place in the shortest column
    let shortestCol = 0;
    for (let c = 1; c < numColumns; c++) {
      if (columnHeights[c] < columnHeights[shortestCol]) shortestCol = c;
    }

    const x = shortestCol * (columnWidth + columnGap);
    const y = columnHeights[shortestCol];

    cards.push({
      text: para,
      column: shortestCol,
      x,
      y,
      width: columnWidth,
      contentHeight: textHeight,
    });

    columnHeights[shortestCol] = y + cardHeight + rowGap;
  }

  const totalHeight = Math.max(...columnHeights, 0);

  return { cards, numColumns, columnWidth, totalHeight };
}

// ── Cache management ────────────────────────────────────────────────

/** Clear all prepare caches. Call on unmount or large content changes. */
export function clearPrepareCache(): void {
  prepareCache.clear();
  prepareLightCache.clear();
}
