/**
 * The component kinds (see `contract.ts`). This file is the only place a kind can be added, and
 * `registry.guard.test.ts` holds what a kind must have:
 *   1. a finite list of ids that comes from a code-owned library (`components`), never from a model or a lesson;
 *   2. evidence that code produces (`expand` maps what a primitive observed onto ids from that list);
 *   3. a screen that shows it (`display`, a component under `lumina/components/`).
 * A kind also has to recur across several subskills or primitives. A problem shape, a question type or anything
 * a subskill or eval mode already names is not a kind.
 *
 * Server-only: the libraries are (the word library is 500 KB).
 */
import 'server-only';
import { NEW_LETTERS } from '../literacy/letterGroups';
import { WORDS, lexWord, soundLabel } from '../wordSpace/lexicon';
import { DIGRAPHS, DOUBLES, R_CONTROLLED, SPLIT_DIGRAPHS, VOWEL_TEAMS, gpcsForLetters } from '../wordSpace/scope';
import { mergeEvidence, type ComponentEvidence, type ComponentInfo, type ComponentTally } from './contract';

export interface ComponentKind {
  kind: string;
  title: string;
  /** The unit a primitive reports this kind in. */
  unit: string;
  /** Where the ids come from. */
  library: string;
  /** The component that shows it, under `lumina/components/`. */
  display: string;
  /** Every component of the kind, in display order. */
  components: () => ComponentInfo[];
  /** What a primitive observed, as evidence rows on ids from `components()`. A unit the library lacks gives none. */
  expand: (units: ComponentTally['units']) => ComponentEvidence[];
}

/**
 * Pairs a family sees as one: the word library splits short o by accent (o/AA in hot, o/AO in dog), and both are
 * the short o a letter-sound lesson teaches. The second id is shown inside the first one's cell (`also`); the stored
 * evidence keeps the library's own ids.
 */
const SHOWN_WITH: Readonly<Record<string, string>> = { 'o/AO': 'o/AA' };

const KNOWN_ORDER = { K: 0, G1: 1, G2: 2 } as const;
/**
 * A word a family can read the pair in ("ai" as in rain). Lowest rank wins: one syllable, known earliest, the pair
 * at the start of the word, a word with a picture, then the shortest. A vowel before r is coloured by the r
 * (ear, here), so those words rank last.
 */
function keyWord(id: string): string | undefined {
  let best: { w: string; rank: number } | undefined;
  for (const x of WORDS) {
    const at = x.gpcs?.indexOf(id) ?? -1;
    if (at < 0 || x.w.length < 2) continue;
    const beforeR = x.gpcs![at + 1]?.startsWith('r') || (id.includes('_e') && /re$/.test(x.w));
    const rank = (beforeR ? 100000 : 0) + (x.syllables - 1) * 5000 + KNOWN_ORDER[x.knownBy] * 1000
      + (at === 0 ? 0 : 400) + (x.emoji ? 0 : 200) + x.w.length;
    if (!best || rank < best.rank) best = { w: x.w, rank };
  }
  return best?.w;
}

const pairInfo = (id: string, group: string): ComponentInfo => {
  const [letters, phones] = id.split('/');
  const also = Object.keys(SHOWN_WITH).filter(other => SHOWN_WITH[other] === id);
  return { id, label: letters.replace('_', '-'), detail: keyWord(id) ?? phones.split(' ').map(soundLabel).join(''), group,
    ...(also.length ? { also } : {}) };
};

let letterSounds: ComponentInfo[] | null = null;
/** Every letter-sound pair the word library uses: the taught sequence first, then the rest by how many words use it. */
function letterSoundComponents(): ComponentInfo[] {
  if (letterSounds) return letterSounds;
  const uses = new Map<string, number>();
  for (const x of WORDS) for (const g of x.gpcs ?? []) uses.set(g, (uses.get(g) ?? 0) + 1);
  const taught: Array<[string, readonly string[]]> = [
    ...[1, 2, 3, 4].map((g): [string, string[]] => [`Letter group ${g}`, Array.from(gpcsForLetters(NEW_LETTERS[g]))]),
    ['Double letters and ck', DOUBLES], ['Digraphs', DIGRAPHS], ['Silent e', SPLIT_DIGRAPHS],
    ['Vowel teams', VOWEL_TEAMS], ['R-controlled vowels', R_CONTROLLED],
  ];
  const out: ComponentInfo[] = [], seen = new Set<string>();
  for (const [group, ids] of taught) for (const id of ids) {
    // ck is taught with group 2 in `gpcsForLetters`; it is shown once, with the doubles.
    if (seen.has(id) || !uses.has(id) || (id === 'ck/K' && group !== 'Double letters and ck')) continue;
    seen.add(id);
    if (!SHOWN_WITH[id]) out.push(pairInfo(id, group));
  }
  const rest = Array.from(uses.entries()).filter(([id]) => !seen.has(id) && !SHOWN_WITH[id]).sort((a, b) => b[1] - a[1]);
  for (const [id] of rest) out.push(pairInfo(id, 'Other spellings'));
  letterSounds = out;
  return out;
}

const LETTER_SOUND: ComponentKind = {
  kind: 'letter_sound',
  title: 'Letter sounds',
  unit: 'a printed word read aloud',
  library: 'service/wordSpace/lexicon.json',
  display: 'ComponentMasteryGrid',
  components: letterSoundComponents,
  expand: units => mergeEvidence(units.flatMap(u => (lexWord(u.unit)?.gpcs ?? [])
    .map(id => ({ kind: 'letter_sound', id, attempts: u.attempts, correct: u.correct })))),
};

export const COMPONENT_KINDS: readonly ComponentKind[] = [LETTER_SOUND];

export const componentKind = (kind: string): ComponentKind | undefined => COMPONENT_KINDS.find(k => k.kind === kind);

/** Evidence for every tally whose kind is registered; an unknown kind gives none. */
export function expandTallies(tallies: readonly ComponentTally[]): ComponentEvidence[] {
  return mergeEvidence(tallies.flatMap(t => componentKind(t.kind)?.expand(t.units) ?? []));
}
