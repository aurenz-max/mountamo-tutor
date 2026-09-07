/**
 * Code-owned builders for the K-first stimulus insets. The LLM emits SCOPE
 * (which objects, which fact family); code builds the structure and the
 * answer (`feedback_llm-window-code-builds-structure`). Nothing here consults
 * a model.
 */

import type {
  ArrangementInset,
  ArrangementLayout,
  GlyphCardInset,
  GlyphCardGlyphKind,
  NumberSentenceInset,
  NumberSentenceToken,
} from '../../types';

export const MINUS = '−';
export const PLUS = '+';
export const EQUALS = '=';
export const BLANK = '□';

export type Operator = typeof MINUS | typeof PLUS;

export interface NumberSentenceSpec {
  a: number;
  op: Operator;
  b: number;
  /** When set, the result token prints as □ (the how_many form). */
  blankResult?: boolean;
}

export const resultOf = (spec: NumberSentenceSpec): number =>
  spec.op === MINUS ? spec.a - spec.b : spec.a + spec.b;

/** `3 − 1 = 2` as five addressable tokens t1..t5. */
export function buildNumberSentence(spec: NumberSentenceSpec): NumberSentenceInset {
  const result = resultOf(spec);
  const tokens: NumberSentenceToken[] = [
    { id: 't1', text: String(spec.a), kind: 'number' },
    { id: 't2', text: spec.op, kind: 'operator' },
    { id: 't3', text: String(spec.b), kind: 'number' },
    { id: 't4', text: EQUALS, kind: 'operator' },
    spec.blankResult
      ? { id: 't5', text: BLANK, kind: 'blank' }
      : { id: 't5', text: String(result), kind: 'number' },
  ];
  return { insetType: 'number-sentence', tokens };
}

/** The token id of the first operator matching `symbol`, or null. */
export const tokenIdForSymbol = (inset: NumberSentenceInset, symbol: string): string | null =>
  inset.tokens.find((t) => t.kind === 'operator' && t.text === symbol)?.id ?? null;

export interface ArrangementSpec {
  emoji: string;
  /** Total objects. Ignored (derived) when `groups` has ≥2 clusters. */
  count?: number;
  layout?: ArrangementLayout;
  removed?: number;
  /** Put-together picture: cluster sizes (each ≥ 1). Overrides `count`. */
  groups?: number[];
  objectName?: string;
}

export function buildArrangement(spec: ArrangementSpec): ArrangementInset {
  const groups = (spec.groups ?? []).map((g) => Math.max(1, Math.round(g))).filter((g) => g > 0);
  const count = groups.length >= 2
    ? Math.min(10, groups.reduce((a, b) => a + b, 0))
    : Math.max(1, Math.min(10, Math.round(spec.count ?? 1)));
  const removed = groups.length >= 2 ? 0 : Math.max(0, Math.min(count - 1, Math.round(spec.removed ?? 0)));
  const layout: ArrangementLayout = groups.length >= 2 ? 'groups' : spec.layout ?? (count > 5 ? 'ten-frame' : 'row');
  return {
    insetType: 'arrangement',
    emoji: spec.emoji,
    count,
    layout,
    ...(removed > 0 ? { removed } : {}),
    ...(groups.length >= 2 ? { groups } : {}),
    ...(layout === 'array' ? { columns: count > 6 ? 4 : 3 } : {}),
    ...(spec.objectName ? { objectName: spec.objectName } : {}),
  };
}

export const remainingOf = (inset: ArrangementInset): number => inset.count - (inset.removed ?? 0);

export interface GlyphCardSpec {
  glyphKind: GlyphCardGlyphKind;
  glyph?: string;
  sides?: number;
  shapeName?: string;
  phonemeBoxes?: boolean;
}

export function buildGlyphCard(spec: GlyphCardSpec): GlyphCardInset {
  return {
    insetType: 'glyph-card',
    glyphKind: spec.glyphKind,
    glyph: spec.glyphKind === 'shape' ? '' : (spec.glyph ?? ''),
    ...(spec.glyphKind === 'shape' ? { sides: spec.sides ?? 3 } : {}),
    ...(spec.glyphKind === 'shape' && spec.shapeName ? { shapeName: spec.shapeName } : {}),
    ...(spec.phonemeBoxes ? { phonemeBoxes: true } : {}),
  };
}

/** Regular polygon points on a 200×200 canvas (a circle when sides is 0). */
export function shapeOutlinePoints(sides: number, radius = 78, cx = 100, cy = 100): Array<[number, number]> {
  if (sides < 3) return [];
  // Start at the top so triangles point up and squares sit flat.
  const start = -Math.PI / 2 + (sides === 4 ? Math.PI / 4 : 0);
  return Array.from({ length: sides }, (_, i) => {
    const angle = start + (i * 2 * Math.PI) / sides;
    return [Math.round(cx + radius * Math.cos(angle)), Math.round(cy + radius * Math.sin(angle))];
  });
}
