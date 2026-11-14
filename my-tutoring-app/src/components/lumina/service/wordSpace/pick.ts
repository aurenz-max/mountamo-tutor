/**
 * Picking items from a word space at a requested difficulty (service/wordSpace).
 *
 * A word space is every item a task allows within a scope, each with a predicted beta (a sum of
 * structural features: which sound position, a sound you can stretch or a stop, a near distractor) and a
 * structure key (the item without its particular words). Scopes are narrow in literacy (a K short-e space
 * has about 20 words), so tiers are relative: items are ranked by beta and split into thirds, the way math
 * `tierPick` handles a narrow scope. Within a third, the least-used structure goes first so one common
 * shape cannot fill the session, and no target or answer word appears in two picks.
 */
import type { SupportTier } from '../generation/generationContext';
import { letterSoundCoverage, spellingCoverage, weakLetterSoundScorer, weakSpellingScorer } from '../componentMastery/bias';
import { noteFocusWords } from '../attemptNotes/focus';

export interface WordSpaceItem<P> {
  beta: number;
  structure: string;
  /** The words that must not recur in one session: a target, an answer, an example. Wrong menu cards may
   *  recur (the script's session gate exempts menus: a card seen before still has to be compared). */
  words: string[];
  /** Every word the item shows or says (menus included); a later item cannot ask the child to produce one. */
  shown?: string[];
  /** The word the child must produce from nothing (blend, manipulate); it must not have been shown earlier. */
  produces?: string;
  /** What one session should not repeat within this mode (the asked sound, the vowel). */
  key?: string;
  /** What the child reads aloud from print, as letter-sound units (a word, or `letter:<letters>`). Set only where
   *  the task is print to sound; the picker then draws items with the learner's weak pairs first. */
  reads?: string[];
  /** The words the child builds from letters after hearing them (sound to print). The picker draws items with the
   *  learner's weak `spelling` pairs first, by the same rule as `reads`. */
  spells?: string[];
  payload: P;
}

/** Calibration stamp carried on each challenge; never rendered, never sent to the tutor. */
export interface WordSpaceStamp {
  space: string;
  structure: string;
  beta: number;
}

export function mulberry32(seed: number): () => number {
  let a = seed | 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const TIER_INDEX: Record<SupportTier, number> = { easy: 0, medium: 1, hard: 2 };

/** The most a coverage lean can score. A weak pair scores its miss rate, which is above 0.2 (`WEAK_BELOW`). */
const COVER_LEAN = 0.1;

/**
 * `n` items from the tier's third of the space, spread across structures, skipping any item that uses a
 * word in `used` (and adding the picks' words to it). Returns fewer than `n` when the third runs out;
 * returns [] when the space has fewer than n + 2 items (no two tiers would differ).
 */
export function tierPick<P>(
  items: readonly WordSpaceItem<P>[],
  tier: SupportTier,
  n: number,
  rand: () => number,
  used: Set<string> = new Set(),
  heard: Set<string> = new Set(),
): WordSpaceItem<P>[] {
  const ok = (it: WordSpaceItem<P>) => !it.words.some((w) => used.has(w)) && !(it.produces && heard.has(it.produces));
  const fresh = items.filter(ok);
  // A narrow scope (a letter group, one short vowel) still tiers: each tier takes a window of the ranked
  // space, the easiest, the middle and the hardest, overlapping when the space holds fewer than 3n items.
  // Fewer than n + 2 items leaves no difference between tiers.
  if (fresh.length < n + 2) return [];
  // Items that read one of this learner's weak letter-sound pairs come first among equals: across a tier boundary
  // (an equal-beta swap into the band) and inside each structure. Tier, structure spread and session rules are unchanged
  // (componentMastery/bias.ts). Without tallies the order is the shuffle's.
  const readOf = items.some((it) => it.reads?.length) ? weakLetterSoundScorer() : null;
  const spellOf = items.some((it) => it.spells?.length) ? weakSpellingScorer() : null;
  // A word one of this learner's attempt notes names (attemptNotes/focus.ts) ranks above any weak pair: the note
  // records a miss on that exact word. Only words this scope already holds can be drawn.
  const focus = noteFocusWords();
  const focused = (it: WordSpaceItem<P>) => !!focus && (it.words.some((w) => focus.has(w.toLowerCase())) || (!!it.produces && focus.has(it.produces.toLowerCase())));
  const weakOf = readOf ?? spellOf ?? (focus && items.some(focused) ? () => 0 : null);
  const weak = (it: WordSpaceItem<P>) => focused(it) ? 2 : Math.max(readOf && it.reads ? readOf(it.reads) : 0, spellOf && it.spells ? spellOf(it.spells) : 0);
  // Coverage: a pair this learner has read fewer than two times is neither weak nor known yet. An item scores by the
  // share of its pairs that still need a read and that no earlier pick of this session reads, always below any weak
  // pair, so a lesson's whole inventory gets read over sessions. It orders equals only: tier, cap and session rules
  // hold. Absent without tallies for the kind.
  const coverRead = items.some((it) => it.reads?.length) ? letterSoundCoverage() : null;
  const coverSpell = items.some((it) => it.spells?.length) ? spellingCoverage() : null;
  const pairsOf = new Map<WordSpaceItem<P>, Array<[string, number]>>();
  const pairs = (it: WordSpaceItem<P>) => {
    let p = pairsOf.get(it);
    if (!p) {
      p = [...(coverRead && it.reads ? coverRead(it.reads).map(([id, need]): [string, number] => [`r:${id}`, need]) : []),
        ...(coverSpell && it.spells ? coverSpell(it.spells).map(([id, need]): [string, number] => [`s:${id}`, need]) : [])];
      pairsOf.set(it, p);
    }
    return p;
  };
  const covered = new Set<string>();
  const cover = (it: WordSpaceItem<P>) => {
    const p = pairs(it);
    return p.length ? COVER_LEAN * p.reduce((sum, [id, need]) => sum + (covered.has(id) ? 0 : need), 0) / p.length : 0;
  };
  const covering = !!(coverRead || coverSpell);
  const leanOn = !!weakOf || covering;
  const lean = (it: WordSpaceItem<P>) => weak(it) || cover(it);
  // Ties in beta are broken at random, so equal items cross a tier boundary differently each session.
  const sorted = shuffleInPlace([...fresh], rand).sort((a, b) => a.beta - b.beta);
  const size = Math.max(n, Math.floor(sorted.length / 3));
  const t = TIER_INDEX[tier];
  const band = sorted.length >= 3 * n
    ? (t === 0 ? sorted.slice(0, size) : t === 1 ? sorted.slice(size, 2 * size) : sorted.slice(2 * size))
    : (t === 0 ? sorted.slice(0, size) : t === 1 ? sorted.slice(Math.floor((sorted.length - size) / 2)).slice(0, size) : sorted.slice(-size));
  // A weak (or less-read) item just outside the band at the same beta as a band item takes that item's place.
  if (leanOn) {
    for (const out of sorted.filter((it) => !band.includes(it) && lean(it) > 0).sort((a, b) => lean(b) - lean(a))) {
      const at = band.reduce((best, it, i) => (it.beta === out.beta && lean(it) < lean(out)
        && (best < 0 || lean(it) < lean(band[best])) ? i : best), -1);
      if (at < 0) continue;
      band[at] = out;
      // One item per less-read pair crosses: the pairs it reads stop counting for the items after it.
      if (weak(out) === 0) pairs(out).forEach(([id]) => covered.add(id));
    }
    covered.clear();
  }

  // A noted word outside the band takes the place of the band item nearest it in beta: at most two per session, and
  // never the place of another noted word. The scope is unchanged and the tier moves by one item's distance at most.
  if (focus) {
    for (const out of sorted.filter((it) => !band.includes(it) && focused(it)).slice(0, 2)) {
      const at = band.reduce((best, it, i) => (!focused(it) && (best < 0 || Math.abs(it.beta - out.beta) < Math.abs(band[best].beta - out.beta)) ? i : best), -1);
      if (at >= 0) band[at] = out;
    }
  }

  const byStructure = new Map<string, WordSpaceItem<P>[]>();
  for (const it of band) byStructure.set(it.structure, [...(byStructure.get(it.structure) ?? []), it]);
  byStructure.forEach((list) => shuffleInPlace(list, rand));
  // Ties keep the shuffle's order on every re-sort, so a word whose pairs were just covered falls back among its equals.
  const shuffled = new Map<WordSpaceItem<P>, number>();
  byStructure.forEach((list) => list.forEach((it, i) => shuffled.set(it, i)));
  const order = () => byStructure.forEach((list) => list.sort((a, b) => lean(b) - lean(a) || shuffled.get(a)! - shuffled.get(b)!));
  if (leanOn) order();
  const structures = shuffleInPlace(Array.from(byStructure.keys()), rand);
  const usedStructures = new Map<string, number>();
  const usedKeys = new Set<string>();
  const picks: WordSpaceItem<P>[] = [];
  // At most half the session is drawn for a weak pair; the rest stays review, so a weak pair cannot fill a lesson.
  const weakCap = Math.ceil(n / 2);
  let weakPicked = 0;
  while (picks.length < n) {
    const leaning = !!weakOf && weakPicked < weakCap;
    // Among equally used structures: while leaning, the one whose next item leans most; after the cap, the one whose
    // next item that is not weak covers most.
    const next = (s: string) => {
      const it = byStructure.get(s)!.find((x) => ok(x) && (leaning || weak(x) === 0));
      return it ? (leaning ? lean(it) : cover(it)) : 0;
    };
    structures.sort((a, b) => (usedStructures.get(a) ?? 0) - (usedStructures.get(b) ?? 0) || (leanOn ? next(b) - next(a) : 0));
    let picked = false;
    for (const s of structures) {
      const list = byStructure.get(s)!;
      const fits = (it: WordSpaceItem<P>) => ok(it) && !(it.key && usedKeys.has(it.key));
      let at = weakOf && !leaning ? list.findIndex((it) => fits(it) && weak(it) === 0) : -1;
      if (at < 0) at = list.findIndex(fits);
      if (at < 0) continue;
      const [it] = list.splice(at, 1);
      if (weak(it) > 0) weakPicked++;
      picks.push(it);
      if (covering) { pairs(it).forEach(([id]) => covered.add(id)); order(); }
      if (it.key) usedKeys.add(it.key);
      it.words.forEach((w) => used.add(w));
      (it.shown ?? it.words).forEach((w) => heard.add(w));
      usedStructures.set(s, (usedStructures.get(s) ?? 0) + 1);
      picked = true;
      break;
    }
    if (!picked && usedKeys.size) { usedKeys.clear(); continue; } // every key used once: allow a second round
    if (!picked) break;
  }
  // A narrow band can run dry once the session rules skip items (a shared rime, a word already used). The
  // nearest items outside the band, by beta, fill what is left, so the tier stays where it was asked.
  if (picks.length < n) {
    const lo = band[0]?.beta ?? 0; const hi = band[band.length - 1]?.beta ?? 0;
    const dist = (it: WordSpaceItem<P>) => (it.beta < lo ? lo - it.beta : it.beta > hi ? it.beta - hi : 0);
    const rest = sorted.filter((it) => !band.includes(it)).sort((a, b) => dist(a) - dist(b));
    for (const it of rest) {
      if (picks.length >= n) break;
      if (!ok(it)) continue;
      picks.push(it);
      it.words.forEach((w) => used.add(w));
      (it.shown ?? it.words).forEach((w) => heard.add(w));
    }
  }
  return picks;
}

function shuffleInPlace<T>(list: T[], rand: () => number): T[] {
  for (let i = list.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [list[i], list[j]] = [list[j], list[i]];
  }
  return list;
}

/** Deterministic pick from a list (the same item gets the same distractors every time). */
export const pickBy = <T>(list: readonly T[], key: string, salt: number): T => {
  let h = salt;
  for (const ch of key) h = (h * 31 + ch.charCodeAt(0)) % 100003;
  return list[h % list.length];
};

/**
 * A letter-group draw: two thirds of the picks use one of the lesson's new letter-sounds (`isFocus`), the
 * rest review earlier ones, each part tiered on its own (the new letters may all sit in harder words).
 * When review words run short, focus words fill the slots.
 */
export function tierPickFocus<P>(
  items: readonly WordSpaceItem<P>[],
  isFocus: (it: WordSpaceItem<P>) => boolean,
  tier: SupportTier,
  n: number,
  rand: () => number,
  used: Set<string> = new Set(),
  heard: Set<string> = new Set(),
): WordSpaceItem<P>[] {
  const nf = Math.ceil((2 * n) / 3);
  const focus = items.filter(isFocus);
  const picks = tierPick(focus, tier, nf, rand, used, heard);
  if (picks.length < nf) return tierPick(items, tier, n, rand, used, heard);
  picks.push(...tierPick(items.filter((it) => !isFocus(it)), tier, n - nf, rand, used, heard));
  if (picks.length < n) picks.push(...tierPick(focus, tier, n - picks.length, rand, used, heard));
  return picks;
}

/**
 * A draw that must hold both kinds of item (rhymes and non-rhymes, two vowels): the picks split as evenly
 * as `n` allows across the groups `groupOf` names, each group tiered on its own, then interleaved so no
 * group runs long. Returns fewer than `n` when a group runs dry.
 */
export function tierPickSplit<P>(
  items: readonly WordSpaceItem<P>[],
  groupOf: (it: WordSpaceItem<P>) => string,
  tier: SupportTier,
  n: number,
  rand: () => number,
  used: Set<string> = new Set(),
  heard: Set<string> = new Set(),
): WordSpaceItem<P>[] {
  const groups = Array.from(new Set(items.map(groupOf))).sort();
  const lists = groups.map((g, i) => tierPick(items.filter((it) => groupOf(it) === g), tier,
    Math.floor(n / groups.length) + (i < n % groups.length ? 1 : 0), rand, used, heard));
  const out: WordSpaceItem<P>[] = [];
  while (lists.some((l) => l.length)) {
    const live = lists.filter((l) => l.length);
    const total = live.reduce((s, l) => s + l.length, 0);
    let r = rand() * total;
    const pick = live.find((l) => (r -= l.length) < 0) ?? live[0];
    out.push(pick.shift()!);
  }
  return out;
}
