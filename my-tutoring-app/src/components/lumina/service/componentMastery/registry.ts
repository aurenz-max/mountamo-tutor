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

const pairInfo = (id: string, group: string): ComponentInfo => {
  const [letters, phones] = id.split('/');
  return { id, label: letters.replace('_', '-'), detail: phones.split(' ').map(soundLabel).join(''), group };
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
    seen.add(id); out.push(pairInfo(id, group));
  }
  const rest = Array.from(uses.entries()).filter(([id]) => !seen.has(id)).sort((a, b) => b[1] - a[1]);
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
