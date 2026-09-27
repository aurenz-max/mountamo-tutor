/**
 * Pattern builder on the shared tutor/JEV teaching workspace, W1 minimal binding
 * (qa/workspace-rollout/ROLLOUT.md, batch C9), plain shape: `useWorkspaceProgress` in place of
 * `useChallengeProgress`. Every challenge is one checked gesture; the builder's own Check is the
 * judge and no key reaches the tutor:
 *   - extend / find_rule: tokens tapped into the "?" blanks, then Check;
 *   - identify_core: the tokens of the repeating part tapped in the row, then Check;
 *   - translate: the new tokens tapped in order, following the drawn key, then Check;
 *   - create: the learner's own row, then Check; the check is code (does one part repeat?).
 */
import type { TeachingAssignment, WorkspaceScene } from '../../../components/live-activity/runtime/useTeachingWorkspace';
import type { PatternBuilderChallenge, PatternBuilderData } from './PatternBuilder';

export type PatternPhase = 'copy' | 'identify' | 'create' | 'translate';
export type PatternTier = 'easy' | 'medium' | 'hard';
type PatternSource = Pick<PatternBuilderData, 'sequence' | 'tokens' | 'translationTarget' | 'showOptions'>;

export function phaseFor(type: PatternBuilderChallenge['type'] | undefined): PatternPhase {
  if (type === 'identify_core') return 'identify';
  if (type === 'create') return 'create';
  if (type === 'translate') return 'translate';
  return 'copy';
}

/** A single-type mode gives each challenge its own pattern; a blended one shares the top-level one. */
export const activeSequence = (data: PatternSource, c: PatternBuilderChallenge) => c.sequence ?? data.sequence;
export const activeMapping = (data: PatternSource, c: PatternBuilderChallenge): Record<string, string> | undefined =>
  c.translationMapping ?? data.translationTarget?.mapping;

/** The tokens the palette draws for a challenge, in order: `token-N` is the N-th. */
export function paletteFor(data: PatternSource, c: PatternBuilderChallenge): string[] {
  const mapping = activeMapping(data, c);
  if (c.type === 'translate' && mapping) return Object.values(mapping);
  if (c.availableTokens && c.availableTokens.length > 0) return c.availableTokens;
  return data.tokens.available;
}

const same = (a: string[], b: string[]) => a.length === b.length && a.every((t, i) => t.toLowerCase() === b[i].toLowerCase());

/** The translated row the key produces from the original pattern. */
export function translationOf(data: PatternSource, c: PatternBuilderChallenge): string[] | null {
  const mapping = activeMapping(data, c);
  if (!mapping) return null;
  return activeSequence(data, c).given.map(t => mapping[t.toLowerCase()] || mapping[t] || t);
}

/** Create: at least four tokens, and one starting part repeats all the way through (a part may be one token). */
export function repeatsAPart(row: string[]): boolean {
  if (row.length < 4) return false;
  for (let coreLen = 1; coreLen <= Math.floor(row.length / 2); coreLen++) {
    if (row.every((t, i) => t.toLowerCase() === row[i % coreLen].toLowerCase())) return true;
  }
  return false;
}

/** The learner's work on the current challenge. */
export interface PatternBuilderView {
  extension: string[];
  coreIndices: number[];
  created: string[];
  translated: string[];
}

export function patternBuilderAssignment(c: PatternBuilderChallenge): TeachingAssignment {
  return { id: c.id, task: c.instruction, response: 'gesture' };
}

const selectedTokens = (data: PatternSource, c: PatternBuilderChallenge, v: PatternBuilderView) => {
  const seq = activeSequence(data, c);
  const full = [...seq.given, ...seq.hidden];
  return [...v.coreIndices].sort((a, b) => a - b).map(i => full[i]);
};

/** The builder's own check. */
export function patternBuilderMatches(data: PatternSource, c: PatternBuilderChallenge, v: PatternBuilderView): boolean {
  const seq = activeSequence(data, c);
  switch (c.type) {
    case 'extend':
    case 'find_rule': return same(v.extension, seq.hidden);
    case 'identify_core': return same(selectedTokens(data, c, v), seq.core);
    case 'create': return repeatsAPart(v.created);
    case 'translate': { const expected = translationOf(data, c); return !!expected && same(v.translated, expected); }
  }
}

/** The learner's checked work in their terms, never the key. */
export function describePatternBuilderCheck(data: PatternSource, c: PatternBuilderChallenge, v: PatternBuilderView): string {
  const row = (tokens: string[]) => tokens.length ? tokens.join(', ') : 'nothing';
  switch (c.type) {
    case 'extend':
    case 'find_rule': return `Placed ${row(v.extension)} in the ${activeSequence(data, c).hidden.length} blanks`;
    case 'identify_core': return `Selected ${row(selectedTokens(data, c, v))}`;
    case 'create': return `Built ${row(v.created)}`;
    case 'translate': return `Built ${row(v.translated)}`;
  }
}

const CONSTRAINTS: Record<PatternBuilderChallenge['type'], string> = {
  extend: 'The learner taps tokens from the choices to fill the "?" blanks in order (tapping the last one placed takes it back) '
    + 'and presses Check; the builder checks it. The missing tokens are the answer: never say one or point to its choice.',
  find_rule: 'The learner taps numbers from the choices to fill the "?" blanks in order and presses Check; the builder checks '
    + 'it. The next numbers are the answer: never say one or point to its choice.',
  identify_core: 'The learner taps the tokens in the row that make the smallest part that repeats, then presses Check; the '
    + 'builder checks it. That part is the answer: never name it, say how many tokens it has, or say where it starts over.',
  translate: 'The learner makes the same pattern with the new tokens, following the drawn key (each old token becomes its '
    + 'new token), tapping them in order, then presses Check; the builder checks it. You may read the whole key aloud, '
    + 'but never tie a key entry to a place in the row ("the first one", "the last color"). The new row is the answer: '
    + 'never say it, or which token goes in any place.',
  create: 'The learner taps tokens to build their own pattern and presses Check; the builder accepts any row of at least '
    + '4 tokens where one starting part repeats all the way through. There is no single answer: explain what makes a '
    + 'pattern, but never tell the learner which tokens to tap.',
};

/** How far the tutor may coach at this support tier, so it never says what the tier withheld on screen. */
function coaching(c: PatternBuilderChallenge, tier: PatternTier | undefined): string | undefined {
  if (!tier) return undefined;
  if (c.type === 'identify_core') {
    if (tier === 'easy') return 'You may explain that the repeating part is the smallest group that starts over; never name it.';
    if (tier === 'medium') return 'Do not name the rule; ask where the pattern starts over.';
    return 'Do not name the rule or hint where the pattern starts over; ask what the learner notices repeating.';
  }
  if (c.type === 'create') {
    if (tier === 'easy') return 'You may name a kind of pattern (like "two colors taking turns") as an idea.';
    if (tier === 'medium') return 'Do not name a kind of pattern; ask what part the learner wants to repeat.';
    return 'Let the learner invent it; ask what repeats in their row.';
  }
  if (tier === 'easy') return 'You may name the repeating part and the rule; never the next token.';
  if (tier === 'medium') return c.type === 'translate'
    ? 'Do not name the rule; let the learner describe what repeats.'
    : 'You may point to the highlighted repeating part, but do not name the rule; let the learner describe it.';
  return 'Do not name the rule or point out where the repeating part starts over. Ask what the learner notices repeating.';
}

/** What is drawn and asked: the pattern row with its blanks, the key, the choices. Never the hidden tokens. */
export function patternBuilderScene(data: PatternSource, c: PatternBuilderChallenge): WorkspaceScene {
  const seq = activeSequence(data, c);
  const phase = phaseFor(c.type);
  const mapping = activeMapping(data, c);
  const tier = c.supportTier;
  const tip = coaching(c, tier);
  return { objects: [], facts: {
    kind: c.type,
    ...(phase === 'copy' ? { pattern: [...seq.given, ...seq.hidden.map(() => '?')].join(', ') } : {}),
    ...(phase === 'identify' || phase === 'translate' ? { pattern: seq.given.join(', ') } : {}),
    ...(phase === 'copy' && data.showOptions?.showCore ? { highlightedPart: seq.core.join(', ') } : {}),
    ...(phase === 'translate' && mapping ? { key: Object.entries(mapping).map(([from, to]) => `${from} → ${to}`).join(', ') } : {}),
    ...(phase !== 'identify' ? { choices: paletteFor(data, c).join(' | ') } : {}),
    ...(tier ? { supportTier: tier } : {}),
    ...(tip ? { coaching: tip } : {}),
    constraints: CONSTRAINTS[c.type],
  } };
}

type HarnessInput = { type: 'touch'; target: string } | { type: 'choose'; label: string };

export const CHECK_LABEL = 'Check Answer';

/** Taps for a row of tokens through the palette; the first palette token with that name. */
function tapRow(palette: string[], row: string[]): HarnessInput[] {
  return row.map(token => {
    const i = palette.findIndex(t => t.toLowerCase() === token.toLowerCase());
    if (i < 0) throw new Error(`Token ${token} is not in the palette`);
    return { type: 'touch' as const, target: `token-${i}` };
  });
}

/** A complete wrong row: the last token swapped for another palette token, or dropped when there is none. */
function spoil(palette: string[], row: string[]): string[] {
  const last = row[row.length - 1];
  const other = palette.find(t => t.toLowerCase() !== last?.toLowerCase());
  return other ? [...row.slice(0, -1), other] : row.slice(0, -1);
}

/**
 * The journey's inputs for one challenge, through the real controls, ending with Check. `wrong` swaps
 * the last token of a row, selects one token too many, or builds a row that does not repeat.
 */
export function patternBuilderHarnessInputs(data: PatternSource, c: PatternBuilderChallenge, wrong: boolean): HarnessInput[] {
  const check: HarnessInput = { type: 'choose', label: CHECK_LABEL };
  const palette = paletteFor(data, c);
  const seq = activeSequence(data, c);
  if (c.type === 'extend' || c.type === 'find_rule') {
    return [...tapRow(palette, wrong ? spoil(palette, seq.hidden) : seq.hidden), check];
  }
  if (c.type === 'translate') {
    const row = translationOf(data, c);
    if (!row) throw new Error(`No translation key for ${c.id}`);
    return [...tapRow(palette, wrong ? spoil(palette, row) : row), check];
  }
  if (c.type === 'create') {
    const distinct = palette.filter((t, i) => palette.findIndex(u => u.toLowerCase() === t.toLowerCase()) === i);
    if (distinct.length < 2) throw new Error(`create ${c.id} has fewer than two distinct tokens`);
    const [a, b] = distinct;
    return [...tapRow(palette, wrong ? [a, b, b, a] : [a, b, a, b]), check];
  }
  // identify_core: the first place the core appears in the row, or one token more.
  const n = seq.core.length;
  const start = seq.given.findIndex((_, i) => same(seq.given.slice(i, i + n), seq.core));
  if (start < 0) throw new Error(`The core of ${c.id} is not in its row`);
  const count = wrong ? (start + n + 1 <= seq.given.length ? n + 1 : n - 1) : n;
  if (count < 1) throw new Error(`No wrong selection for ${c.id}`);
  return [...Array.from({ length: count }, (_, k) => ({ type: 'touch' as const, target: `seq-${start + k}` })), check];
}
