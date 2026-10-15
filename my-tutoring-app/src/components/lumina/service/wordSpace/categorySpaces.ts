/**
 * Category spaces (service/wordSpace): pictured nouns grouped by the library's reviewed category, for
 * picture-vocabulary (receptive_match, naming) and word-sorter (binary_sort, ternary_sort).
 *
 * Measured before (2026-10-13, `qa/word-space-lab/2026-10-13/picture-vocabulary/before.txt` and
 * `.../word-sorter/before.txt`): picture-vocabulary gave apple, cat, sun, tree, shoe, ball at every tier, its
 * receptive_match wrong pictures always came from other categories (the tier changed nothing), and "lamp"
 * was pictured as a light bulb; word-sorter sorted the same few animals and foods at every tier.
 *
 * Difficulty features (logits; refit from first-try results). Categorization research: children sort
 * animals, food, clothing and vehicles before tools, weather and places; two categories children confuse
 * (food/drink, toy/sport, clothing/body) are harder to separate than two unrelated ones; a wrong picture
 * from the target's own category (cat among dog, cow, pig) is the hardest receptive choice. A word the grade
 * knows later adds a little; so does a longer word to name.
 */
import { WORDS, knownByForGrade, type LexWord } from './lexicon';
import type { WordSpaceItem } from './pick';
import { isInflected } from './scope';

export const CONCEPT_CATS = ['animal', 'food', 'drink', 'clothing', 'vehicle', 'body', 'home', 'toy', 'nature', 'weather', 'tool', 'music', 'sport', 'school', 'place'] as const;
/** Categories children sort reliably first (0) through ones that need more world knowledge. */
export const CAT_BETA: Readonly<Record<string, number>> = {
  animal: 0, food: 0, clothing: 0, vehicle: 0, body: 0.1, toy: 0.3, home: 0.3, drink: 0.3, sport: 0.4, music: 0.4,
  school: 0.6, tool: 0.6, nature: 0.6, weather: 0.7, place: 0.7,
};
const NEAR_CATS: ReadonlyArray<readonly [string, string]> = [['food', 'drink'], ['clothing', 'body'], ['toy', 'sport'], ['nature', 'weather'],
  ['home', 'tool'], ['school', 'home'], ['toy', 'music'], ['animal', 'nature'], ['vehicle', 'place']];
export const nearCats = (a: string, b: string): boolean => NEAR_CATS.some(([x, y]) => (x === a && y === b) || (x === b && y === a));

const famBeta = (x: LexWord): number => (x.knownBy === 'K' ? 0 : x.knownBy === 'G1' ? 0.3 : 0.6);
const hash = (s: string): number => { let h = 7; for (const ch of s) h = (h * 31 + ch.charCodeAt(0)) % 100003; return h; };
const take = <T>(list: readonly T[], key: string): T | undefined => (list.length ? list[hash(key) % list.length] : undefined);

/** A person doing something (🏃 🤸 🏊 🚴 ⛹ 💃): the picture names an action, so a child says "running", not "jog". */
const ACTION_POINTS: ReadonlySet<number> = new Set([0x1F3C3, 0x1F3C4, 0x1F3C7, 0x1F3CA, 0x1F3CB, 0x1F3CC, 0x1F483, 0x1F57A, 0x1F6A3,
  0x1F6B4, 0x1F6B5, 0x1F6B6, 0x1F938, 0x1F93D, 0x1F93E, 0x1F9D7, 0x1F9D8, 0x26F9]);
const isActionPicture = (emoji: string): boolean => Array.from(emoji).some((ch) => ACTION_POINTS.has(ch.codePointAt(0) ?? 0));

/** Pictured nouns a grade knows, by category; one word per picture (cot and bed are one bed). */
export function nounPool(grade: string): LexWord[] {
  const allowed = knownByForGrade(grade);
  const seen = new Set<string>();
  return WORDS.filter((x) => allowed.has(x.knownBy) && !!x.emoji && (CONCEPT_CATS as readonly string[]).includes(x.category)
    && /^[a-z]{2,12}$/.test(x.w) && x.syllables <= 3 && !isInflected(x) && !isActionPicture(x.emoji!))
    .filter((x) => (seen.has(x.emoji!) ? false : (seen.add(x.emoji!), true)));
}

export interface NounCard { word: string; emoji: string; category: string }
const cardOf = (x: LexWord): NounCard => ({ word: x.w, emoji: x.emoji!, category: x.category });

/** receptive_match: hear the word, tap its picture among four. */
export function receptiveSpace(grade: string): WordSpaceItem<{ target: NounCard; wrong: NounCard[] }>[] {
  const pool = nounPool(grade);
  const items: WordSpaceItem<{ target: NounCard; wrong: NounCard[] }>[] = [];
  for (const t of pool) {
    const same = pool.filter((x) => x !== t && x.category === t.category);
    const near = pool.filter((x) => nearCats(x.category, t.category));
    const far = pool.filter((x) => x.category !== t.category && !nearCats(x.category, t.category));
    const pickFrom = (list: LexWord[], salt: string, exclude: LexWord[]) => take(list.filter((x) => !exclude.includes(x)), `${t.w}:${salt}`);
    const variants: Array<{ s: string; b: number; make: () => Array<LexWord | undefined> }> = [
      { s: 'far', b: 0, make: () => { const a = pickFrom(far, '1', []); const b = pickFrom(far.filter((x) => x.category !== a?.category), '2', [a!]); return [a, b, pickFrom(far.filter((x) => x.category !== a?.category && x.category !== b?.category), '3', [a!, b!])]; } },
      { s: 'one-same', b: 0.5, make: () => { const a = pickFrom(same, 's', []); const b = pickFrom(far, '2', []); return [a, b, pickFrom(far.filter((x) => x.category !== b?.category), '3', [b!])]; } },
      { s: 'same+near', b: 0.8, make: () => { const a = pickFrom(same, 's', []); return [a, pickFrom(near, 'n', []), pickFrom(far, '3', [])]; } },
      { s: 'all-same', b: 1.2, make: () => { const a = pickFrom(same, 's', []); const b = pickFrom(same, 't', [a!]); return [a, b, pickFrom(same, 'u', [a!, b!])]; } },
    ];
    for (const { s, b, make } of variants) {
      const d = make();
      if (d.some((x) => !x) || new Set(d.map((x) => x!.w)).size !== 3) continue;
      items.push({
        beta: +(b + 0.5 * (CAT_BETA[t.category] ?? 0.5) + famBeta(t)).toFixed(2),
        structure: s,
        key: t.category,
        words: [t.w],
        shown: [t.w, ...d.map((x) => x!.w)],
        payload: { target: cardOf(t), wrong: (d as LexWord[]).map(cardOf) },
      });
    }
  }
  return items;
}

/** naming: see the picture, say the word. */
export function namingSpace(grade: string): WordSpaceItem<{ target: NounCard }>[] {
  return nounPool(grade).map((t) => ({
    beta: +((CAT_BETA[t.category] ?? 0.5) + famBeta(t) + 0.2 * (t.syllables - 1)).toFixed(2),
    structure: t.category,
    key: t.category,
    words: [t.w],
    produces: t.w,
    payload: { target: cardOf(t) },
  }));
}

/**
 * Sorting sessions: two (or three) categories and the words to sort. One item is a whole sort; its beta is
 * how separable the categories are (near pairs hardest) plus the categories' own difficulty.
 */
export function sortSpace(grade: string, bins: 2 | 3, perBin: number): WordSpaceItem<{ categories: string[]; cards: NounCard[] }>[] {
  const pool = nounPool(grade);
  const byCat = new Map<string, LexWord[]>();
  for (const x of pool) byCat.set(x.category, [...(byCat.get(x.category) ?? []), x]);
  const cats = Array.from(byCat.keys()).filter((c) => byCat.get(c)!.length >= perBin + 2).sort();
  const items: WordSpaceItem<{ categories: string[]; cards: NounCard[] }>[] = [];
  const combos: string[][] = [];
  for (let i = 0; i < cats.length; i++) for (let j = i + 1; j < cats.length; j++) {
    if (bins === 2) combos.push([cats[i], cats[j]]);
    else for (let k = j + 1; k < cats.length; k++) combos.push([cats[i], cats[j], cats[k]]);
  }
  for (const combo of combos) {
    // Several word sets per combination: a lesson that names its categories (animals, food) still varies.
    for (const salt of ['a', 'b', 'c', 'd', 'e', 'f']) {
      const cards = combo.flatMap((c) => {
        const list = byCat.get(c)!;
        const start = hash(`${combo.join('/')}:${salt}:${c}`) % list.length;
        return Array.from({ length: perBin }, (_, n) => list[(start + n * 3) % list.length]);
      });
      if (new Set(cards.map((x) => x.w)).size !== cards.length) continue;
      const nearPairs = combo.flatMap((a, i) => combo.slice(i + 1).filter((b) => nearCats(a, b))).length;
      items.push({
        beta: +(0.8 * nearPairs + combo.reduce((s, c) => s + (CAT_BETA[c] ?? 0.5), 0) / combo.length
          + cards.reduce((s, x) => s + famBeta(x), 0) / cards.length).toFixed(2),
        structure: `${nearPairs ? 'near' : 'far'}:${combo.join('/')}`,
        key: combo.join('/'),
        words: cards.map((x) => x.w),
        payload: { categories: combo, cards: cards.map(cardOf) },
      });
    }
  }
  return items;
}
