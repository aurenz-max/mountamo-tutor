/**
 * Pattern builder's domain on the teaching workspace (its boss is `patternBuilder.boss.ts`). Every challenge is one
 * checked gesture; the builder's own Check is the judge and no key reaches the tutor:
 *   - extend / find_rule: tokens tapped into the "?" blanks, then Check;
 *   - identify_core: the tokens of the repeating part tapped in the row, then Check;
 *   - translate: the new tokens tapped in order, following the drawn key, then Check;
 *   - create (open build, OB-9M): the learner's own row in the pattern shape the ask names (AB, ABB, ...), then
 *     "I'm done!"; the check is code (a part of that shape, repeated at least twice). When the row makes the shape,
 *     the rule turn: the learner picks which part of their own row repeats (`ruleChoices`), and that pick commits.
 *     Try again keeps the row.
 *   - copy: the model row rebuilt token by token in an empty row below it, then Check;
 *   - fill_gap: the token that belongs in the "?" inside the row, then Check.
 */
import type { SceneOf } from '../../../components/live-activity/bossLevers';
import type { SpokenKey } from '../../../components/live-activity/spokenKey';
import type { KnownMiss } from '../../../components/live-activity/runtime/spokenMissContract';
import type { PatternBuilderChallenge, PatternBuilderData } from './PatternBuilder';
import type { PatternBuilderMiss } from './patternBuilder.card';

export { PATTERN_MISSES_BY_MODE, type PatternBuilderMiss } from './patternBuilder.card';

export type PatternPhase = 'copy' | 'identify' | 'create' | 'translate' | 'rebuild' | 'gap';
export type PatternTier = 'easy' | 'medium' | 'hard';
type PatternSource = Pick<PatternBuilderData, 'sequence' | 'tokens' | 'translationTarget' | 'showOptions'>;

export function phaseFor(type: PatternBuilderChallenge['type'] | undefined): PatternPhase {
  if (type === 'identify_core') return 'identify';
  if (type === 'create') return 'create';
  if (type === 'translate') return 'translate';
  if (type === 'copy') return 'rebuild';
  if (type === 'fill_gap') return 'gap';
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

/** Create without an asked shape (an older payload): at least four tokens, at least two different ones, and one
 *  starting part repeats all the way through. A row of one token repeated is not a pattern anyone made. */
export function repeatsAPart(row: string[]): boolean {
  if (row.length < 4 || new Set(row.map(t => t.toLowerCase())).size < 2) return false;
  for (let coreLen = 1; coreLen <= Math.floor(row.length / 2); coreLen++) {
    if (row.every((t, i) => t.toLowerCase() === row[i % coreLen].toLowerCase())) return true;
  }
  return false;
}

/** The pattern shapes a create item may ask for, simplest first. Code picks one per item (the generator). */
export const CREATE_SHAPES = ['AB', 'ABB', 'AAB', 'ABC', 'AABB'] as const;
export type CreateShape = typeof CREATE_SHAPES[number];

/** The letter shape of a part: each new token takes the next letter ("red blue blue" → "ABB"). */
export function shapeOf(part: string[]): string {
  const seen: string[] = [];
  return part.map(t => {
    const k = t.toLowerCase();
    if (!seen.includes(k)) seen.push(k);
    return String.fromCharCode(65 + seen.indexOf(k));
  }).join('');
}

/** How many different tokens a shape needs. */
export const tokensNeeded = (shape: string) => new Set(shape.split('')).size;

/** The ask's words for a shape. The shape IS the task, so stating it is not a leak; the tokens are the learner's. */
const SHAPE_WORDS: Record<string, string> = {
  AB: 'two things taking turns',
  ABB: 'one thing, then two the same',
  AAB: 'two the same, then one different',
  ABC: 'three different things in a row',
  AABB: 'two the same, then two of another',
};
export const shapeLetters = (shape: string) => shape.split('').join(' ');
export const createInstruction = (shape: string) =>
  `Make your own ${shapeLetters(shape)} pattern (${SHAPE_WORDS[shape] ?? 'a part that repeats'}). Use any tokens, and repeat it at least two times.`;

/** The asked shape's check: the first part has that shape and the row repeats it, at least two whole times
 *  (a trailing part of the next repeat is fine: red blue blue red blue blue red). */
export function makesShape(row: string[], shape: string): boolean {
  const k = shape.length;
  if (row.length < 2 * k) return false;
  const part = row.slice(0, k);
  return shapeOf(part) === shape && row.every((t, i) => t.toLowerCase() === part[i % k].toLowerCase());
}

/** The shortest part the row repeats from its start (at least two whole times), or null. */
export function repeatedPart(row: readonly string[]): string[] | null {
  for (let k = 1; k <= Math.floor(row.length / 2); k++) {
    if (row.every((t, i) => t.toLowerCase() === row[i % k].toLowerCase())) return row.slice(0, k);
  }
  return null;
}

/** A repeating row's key from its shown tokens: the part it repeats and the `blanks` tokens that continue it. Null when
 *  the shown row does not repeat a part of two or more different tokens. The generator writes extend and identify_core
 *  keys from this, so an LLM key that does not continue the row (AAB shown, "A B" hidden) never reaches the check. */
export function repeatKey(given: readonly string[], blanks: number): { core: string[]; hidden: string[] } | null {
  const part = repeatedPart(given);
  if (!part || new Set(part.map(t => t.toLowerCase())).size < 2) return null;
  return { core: part, hidden: Array.from({ length: blanks }, (_, i) => part[(given.length + i) % part.length]) };
}

/**
 * fill_gap: the row as drawn, with "?" at the gap. The generator keeps the gap's token in `given` (so the row's part is
 * code-derived); nothing the tutor or the screen sees may carry it.
 */
export function shownRow(data: PatternSource, c: PatternBuilderChallenge): string[] {
  const given = activeSequence(data, c).given;
  return c.type === 'fill_gap' && Number.isInteger(c.gapIndex) ? given.map((t, i) => (i === c.gapIndex ? '?' : t)) : given;
}

/**
 * fill_gap's spoken key: the gap's token is one sayable word ("blue", "star"), so the item also takes it said (user
 * ruling 10-13, voice beside the tap). The tap is still checked by the activity. Null on every other mode.
 */
export function gapKey(c: PatternBuilderChallenge): SpokenKey | null {
  const t = c.type === 'fill_gap' ? c.sequence?.hidden[0] : undefined;
  if (!t) return null;
  return { answer: t, alsoAccept: [`the ${t} one`, `${t} one`, `a ${t}`],
    acceptRule: `A sentence that names it, such as "it is ${t}", counts.`, signatureError: 'Naming any other token is wrong.' };
}

/** fill_gap's known spoken misses, with the tap's ids: a token beside the gap, or another token on the palette. */
export function gapSpokenMisses(c: PatternBuilderChallenge): KnownMiss[] {
  const seq = c.sequence, key = seq?.hidden[0], gap = c.gapIndex ?? -1;
  if (c.type !== 'fill_gap' || !seq || !key) return [];
  const lowerKey = key.toLowerCase();
  const near = Array.from(new Set([seq.given[gap - 1], seq.given[gap + 1]].filter((t): t is string => !!t && t.toLowerCase() !== lowerKey)));
  const other = Array.from(new Set((c.availableTokens ?? []).filter(t => t.toLowerCase() !== lowerKey && !near.includes(t))));
  const fact = `The answer is "${key}", the token the pattern puts in the gap.`;
  return [
    ...(near.length ? [{ id: 'copied_neighbour', pattern: `${fact} The learner names ${near.map(t => `"${t}"`).join(' or ')}, `
      + 'the token beside the gap.', examples: near }] : []),
    ...(other.length ? [{ id: 'one_wrong', pattern: `${fact} The learner names another token: ${other.map(t => `"${t}"`).join(', ')}.`,
      examples: other }] : []),
  ];
}

/** A small stable number from an id, so an item's choices come in the same order every time it is drawn. */
const seedOf = (id: string) => Array.from(id).reduce((s, ch) => (s * 31 + ch.charCodeAt(0)) >>> 0, 7);

/**
 * create's rule turn: three parts of the learner's own row to pick the one that repeats from — the part the asked shape
 * has, one token short of it and one token over. Each is the row's own start, so no choice brings a token the learner
 * did not place, and only the part of the asked length repeats through the row. Rotated by the item's id. Empty when
 * the row does not make the shape (the turn opens only after it does).
 */
export function ruleChoices(c: PatternBuilderChallenge, row: readonly string[]): string[][] {
  const k = c.createShape?.length ?? 0;
  if (c.type !== 'create' || !c.createShape || !makesShape([...row], c.createShape)) return [];
  const parts = [row.slice(0, k - 1), row.slice(0, k), row.slice(0, k + 1)].filter(p => p.length > 0);
  const rot = seedOf(c.id) % parts.length;
  return [...parts.slice(rot), ...parts.slice(0, rot)];
}

/** Which of `ruleChoices` is the part that repeats; -1 when there is no turn. */
export function ruleKeyIndex(c: PatternBuilderChallenge, row: readonly string[]): number {
  const k = c.createShape?.length ?? 0;
  return ruleChoices(c, row).findIndex(p => p.length === k);
}

/** The learner's work on the current challenge. */
export interface PatternBuilderView {
  extension: string[];
  coreIndices: number[];
  created: string[];
  translated: string[];
  /** copy: the row rebuilt below the model. */
  copied?: string[];
  /** create's rule turn: the part of their row the learner picked as the part that repeats, once picked. */
  rule?: string[] | null;
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
    // An asked shape is judged with its rule turn: the shape made, and the part picked is the part that repeats.
    case 'create': return c.createShape
      ? makesShape(v.created, c.createShape) && !!v.rule && same(v.rule, v.created.slice(0, c.createShape.length))
      : repeatsAPart(v.created);
    case 'translate': { const expected = translationOf(data, c); return !!expected && same(v.translated, expected); }
    case 'copy': return same(v.copied ?? [], seq.given);
    case 'fill_gap': return same(v.extension, seq.hidden);
  }
}

const rowMiss = (got: string[], want: string[]): PatternBuilderMiss => {
  if (got.length < want.length) return 'blanks_left';
  if (got.length > want.length) return 'extra_tokens';
  const off = want.map((t, i) => i).filter(i => got[i].toLowerCase() !== want[i].toLowerCase());
  if (off.length === 1) return 'one_wrong';
  if (off.length === 2 && same([got[off[0]], got[off[1]]], [want[off[1]], want[off[0]]])) return 'two_swapped';
  return 'several_wrong';
};

export function patternBuilderMiss(data: PatternSource, c: PatternBuilderChallenge | null, v: PatternBuilderView):
  PatternBuilderMiss | undefined {
  if (!c || patternBuilderMatches(data, c, v)) return undefined;
  const seq = activeSequence(data, c);
  switch (c.type) {
    case 'extend':
    case 'find_rule': {
      const got = v.extension, last = seq.given[seq.given.length - 1];
      if (got.length === seq.hidden.length && last && got.every(t => t.toLowerCase() === last.toLowerCase())) return 'repeated_last';
      if (got.length === seq.hidden.length && same(got, seq.given.slice(0, got.length))) return 'started_over';
      return rowMiss(got, seq.hidden);
    }
    case 'translate': return rowMiss(v.translated, translationOf(data, c) ?? []);
    case 'copy': return rowMiss(v.copied ?? [], seq.given);
    case 'fill_gap': {
      const got = v.extension[0], gap = c.gapIndex ?? -1;
      if (!got) return 'blanks_left';
      // The token on either side of the gap: copying a neighbour, not following the pattern.
      const near = [seq.given[gap - 1], seq.given[gap + 1]].filter(Boolean).map(t => t.toLowerCase());
      return near.includes(got.toLowerCase()) ? 'copied_neighbour' : 'one_wrong';
    }
    case 'identify_core': {
      const got = selectedTokens(data, c, v);
      if (same(got, [...seq.core, ...seq.core])) return 'two_repeats';
      return got.length > seq.core.length ? 'too_long' : got.length < seq.core.length ? 'too_short' : 'other_part';
    }
    case 'create': {
      const min = c.createShape ? 2 * c.createShape.length : 4;
      // The shape made: no miss until the rule turn's pick; a wrong pick is one token short of the part, or one over.
      if (c.createShape && makesShape(v.created, c.createShape)) {
        if (!v.rule) return undefined;
        return v.rule.length < c.createShape.length ? 'rule_short' : 'rule_long';
      }
      if (v.created.length < min) return 'too_short';
      const part = repeatedPart(v.created);
      if (!part) return 'no_repeat';
      return c.createShape || new Set(part.map(t => t.toLowerCase())).size < 2 ? 'other_shape' : 'no_repeat';
    }
  }
}

/** The learner's checked work in their terms, never the key. */
export function describePatternBuilderCheck(data: PatternSource, c: PatternBuilderChallenge, v: PatternBuilderView): string {
  const row = (tokens: string[]) => tokens.length ? tokens.join(', ') : 'nothing';
  switch (c.type) {
    case 'extend':
    case 'find_rule': return `Placed ${row(v.extension)} in the ${activeSequence(data, c).hidden.length} blanks`;
    case 'identify_core': return `Selected ${row(selectedTokens(data, c, v))}`;
    case 'create': return `Built ${row(v.created)}${v.rule ? `; picked ${row(v.rule)} as the part that repeats` : ''}`;
    case 'translate': return `Built ${row(v.translated)}`;
    case 'copy': return `Built ${row(v.copied ?? [])} below the model row`;
    case 'fill_gap': return v.extension.length ? `Placed ${row(v.extension)} in the gap` : 'Nothing placed in the gap';
  }
}

/** This mode's own leak rules; the moves and the shared rules come from the card (`patternBuilder.card.ts`). */
const CONSTRAINTS: Record<PatternBuilderChallenge['type'], string> = {
  extend: 'The missing tokens are the answer: never say one or point to its choice.',
  find_rule: 'The next numbers are the answer: never say one or point to its choice.',
  identify_core: 'The part that repeats is the answer: never name it, say how many tokens it has, or say where it starts over.',
  translate: 'You may read the whole key aloud, but never tie a key entry to a place in the row ("the first one", "the last '
    + 'color"). The new row is the answer: never say it, or which token goes in any place.',
  create: 'There is no single answer: the builder accepts any tokens whose first part has the asked shape and repeats at '
    + 'least two whole times. You may explain the shape with tokens that are not on the palette, but never tell the '
    + 'learner which tokens to tap or say their next one. In the rule turn, ask the learner to say or tap the part of '
    + 'their row that repeats; never say which choice it is.',
  copy: 'The model row is on screen and copying it is the task: you may ask which token of the model comes next, but '
    + 'never say a token to tap.',
  fill_gap: 'The token in the gap is the answer: never say it, point to its choice, or say what the pattern says at the gap.',
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

/**
 * What is drawn and asked: the pattern row with its blanks, the key, the choices. Never the hidden tokens.
 * `groupsShown`: the gaps where the row starts over are on screen, so the tier's "do not point it out" no longer holds.
 */
export function patternBuilderScene(data: PatternSource, c: PatternBuilderChallenge, groupsShown = false): SceneOf {
  const seq = activeSequence(data, c);
  const phase = phaseFor(c.type);
  const mapping = activeMapping(data, c);
  const tier = c.supportTier;
  const tip = groupsShown
    ? 'The gaps where the row starts over are on screen: you may point to them. Never say a blank\'s token.'
    : coaching(c, tier);
  return { objects: [], facts: {
    kind: c.type,
    ...(phase === 'copy' ? { pattern: [...seq.given, ...seq.hidden.map(() => '?')].join(', ') } : {}),
    ...(phase === 'gap' ? { pattern: shownRow(data, c).join(', '), gap: 'one place inside the row is empty ("?")' } : {}),
    ...(phase === 'rebuild' ? { modelRow: seq.given.join(', '), buildRow: 'an empty row below the model' } : {}),
    ...(phase === 'identify' || phase === 'translate' ? { pattern: seq.given.join(', ') } : {}),
    ...((phase === 'copy' || phase === 'gap') && data.showOptions?.showCore ? { highlightedPart: seq.core.join(', ') } : {}),
    ...(phase === 'translate' && mapping ? { key: Object.entries(mapping).map(([from, to]) => `${from} → ${to}`).join(', ') } : {}),
    ...(phase !== 'identify' ? { choices: paletteFor(data, c).join(' | ') } : {}),
    ...(c.type === 'create' && c.createShape ? { askedShape: shapeLetters(c.createShape) } : {}),
    ...(tier ? { supportTier: tier } : {}),
    ...(tip ? { coaching: tip } : {}),
    constraints: CONSTRAINTS[c.type],
  } };
}

type HarnessInput = { type: 'touch'; target: string } | { type: 'choose'; label: string };

export const CHECK_LABEL = 'Check Answer';
export const DONE_LABEL = "I'm done!";
export const START_OVER_LABEL = 'Start over';

/** create: the learner's row as facts, the made quantities as numbers (so `workHistory` records a turn back). */
export function createdFacts(row: string[]): Record<string, string | number> {
  return { row: row.length ? row.join(', ') : 'empty', tokensInRow: row.length,
    differentTokens: new Set(row.map(t => t.toLowerCase())).size };
}

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
export function patternBuilderHarnessInputs(data: PatternSource, c: PatternBuilderChallenge, wrong: boolean, kept = false): HarnessInput[] {
  const check: HarnessInput = { type: 'choose', label: CHECK_LABEL };
  const palette = paletteFor(data, c);
  const seq = activeSequence(data, c);
  if (c.type === 'extend' || c.type === 'find_rule') {
    return [...tapRow(palette, wrong ? spoil(palette, seq.hidden) : seq.hidden), check];
  }
  if (c.type === 'copy') return [...tapRow(palette, wrong ? spoil(palette, seq.given) : seq.given), check];
  if (c.type === 'fill_gap') {
    // Wrong: the token beside the gap (copying a neighbour), or any other token.
    const key = seq.hidden[0], gap = c.gapIndex ?? 0;
    const near = [seq.given[gap - 1], seq.given[gap + 1]].find(t => t && t.toLowerCase() !== key.toLowerCase());
    const other = near ?? palette.find(t => t.toLowerCase() !== key.toLowerCase());
    if (!other) throw new Error(`fill_gap ${c.id} has no wrong token`);
    return [...tapRow(palette, [wrong ? other : key]), check];
  }
  if (c.type === 'translate') {
    const row = translationOf(data, c);
    if (!row) throw new Error(`No translation key for ${c.id}`);
    return [...tapRow(palette, wrong ? spoil(palette, row) : row), check];
  }
  if (c.type === 'create') {
    // Open build: the asked shape in the palette's first different tokens, twice, then I'm done. Wrong: the other
    // shape (AB, or ABB when AB was asked), twice. Try again keeps the row, so a kept row is cleared first.
    const distinct = palette.filter((t, i) => palette.findIndex(u => u.toLowerCase() === t.toLowerCase()) === i);
    if (!c.createShape) {
      // An older payload with no asked shape: any repeat passes, so wrong is a row that does not repeat.
      if (distinct.length < 2) throw new Error(`create ${c.id} has fewer than two distinct tokens`);
      const [a, b] = distinct;
      return [...tapRow(palette, wrong ? [a, b, b, a] : [a, b, a, b]), check];
    }
    const madeShape = wrong ? (c.createShape === 'AB' ? 'ABB' : 'AB') : c.createShape;
    if (distinct.length < tokensNeeded(madeShape)) throw new Error(`create ${c.id} has too few different tokens for ${madeShape}`);
    const part = madeShape.split('').map(l => distinct[l.charCodeAt(0) - 65]);
    const clear: HarnessInput[] = kept ? [{ type: 'choose', label: START_OVER_LABEL }] : [];
    const row = [...part, ...part];
    // A row of the asked shape opens the rule turn: the right answer picks the part that repeats.
    const rule: HarnessInput[] = wrong ? [] : [{ type: 'touch', target: `rule-${ruleKeyIndex(c, row)}` }];
    return [...clear, ...tapRow(palette, row), { type: 'choose', label: DONE_LABEL }, ...rule];
  }
  // identify_core: the first place the core appears in the row, or one token more.
  const n = seq.core.length;
  const start = seq.given.findIndex((_, i) => same(seq.given.slice(i, i + n), seq.core));
  if (start < 0) throw new Error(`The core of ${c.id} is not in its row`);
  const count = wrong ? (start + n + 1 <= seq.given.length ? n + 1 : n - 1) : n;
  if (count < 1) throw new Error(`No wrong selection for ${c.id}`);
  return [...Array.from({ length: count }, (_, k) => ({ type: 'touch' as const, target: `seq-${start + k}` })), check];
}
