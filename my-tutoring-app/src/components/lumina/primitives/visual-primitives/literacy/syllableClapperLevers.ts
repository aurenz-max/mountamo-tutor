/**
 * The in-item levers on syllable-clapper (`/add-support-tiers`, handoff 22 L2). Nothing about the item is printed
 * before credit, and how the tutor voices the word is the pedagogy: chanted parts answer count and delete (the
 * catalog's correction move), and a joined word answers blend. So help never chants the item's parts:
 *
 * - `part_beats` (blend, both): one dot per part slides together over an arrow while the tutor says the parts
 *   with shorter gaps, never fully joined. The number of parts is not the blend answer.
 * - `clap_model` (count, both): another word, never the session's and never the item's count, with a dot per clap.
 * - No clap pad: the 2026-08-16 port removed the on-screen clap button and tally because the tally did the
 *   counting, the act this primitive trains. Claps stay in the learner's hands.
 * - `stretched_joined` (count, voiced, only where the tier dropped the slow echo): the word once more, slowly,
 *   with no pause between parts. Its scene fact is safe to say: it names no count.
 * - `delete_model` (delete, both): another compound, pictured in its two parts; the first fades and the second is
 *   what is left. It shares no part with the item.
 * - `two_part_blend` / `fewer_parts_word` / `drop_first_part` (simplify): an ungraded item of the same act.
 *
 * Misses are spoken and not emitted yet (handoff 20 Part B): declared here, unanswered for J9.
 */
import type { WorkspaceLever } from '../../../components/live-activity/runtime/contract';
import { itemFromChallenge, type SyllableClapperItem } from './syllableClapperScript';
import type { SyllableTask } from './syllableClapperModes';

export const BEATS_LEVER = 'part_beats';
export const CLAP_MODEL_LEVER = 'clap_model';
export const STRETCH_LEVER = 'stretched_joined';
export const DELETE_MODEL_LEVER = 'delete_model';
export const SIMPLIFY_LEVER: Record<SyllableTask, string> = {
  blend_syllables: 'two_part_blend', count_parts: 'fewer_parts_word', delete_compound: 'drop_first_part',
};

export const SYLLABLE_MISSES = {
  blend_syllables: ['parts_back'],
  count_parts: ['count_one_over', 'counted_sounds', 'word_for_count'],
  delete_compound: ['whole_word', 'removed_part'],
} as const;
export type SyllableMiss = typeof SYLLABLE_MISSES[keyof typeof SYLLABLE_MISSES][number];

interface PicturedParts { word: string; emoji: string; parts: string[] }
/** Counting models: one picture, clapped. Never a word the session asks, never the item's count. */
export const CLAP_MODELS: readonly PicturedParts[] = [
  { word: 'pencil', emoji: '✏️', parts: ['pen', 'cil'] }, { word: 'napkin', emoji: '🧻', parts: ['nap', 'kin'] },
  { word: 'umbrella', emoji: '☂️', parts: ['um', 'brel', 'la'] }, { word: 'dinosaur', emoji: '🦕', parts: ['di', 'no', 'saur'] },
  { word: 'helicopter', emoji: '🚁', parts: ['hel', 'i', 'cop', 'ter'] }, { word: 'alligator', emoji: '🐊', parts: ['al', 'li', 'ga', 'tor'] },
];
/** Two-word compounds, each part a picture: deletion models and practice compounds. */
export const COMPOUNDS: ReadonlyArray<PicturedParts & { partEmoji: [string, string] }> = [
  { word: 'sunhat', emoji: '👒', parts: ['sun', 'hat'], partEmoji: ['☀️', '🎩'] },
  { word: 'toothbrush', emoji: '🪥', parts: ['tooth', 'brush'], partEmoji: ['🦷', '🖌️'] },
  { word: 'cupcake', emoji: '🧁', parts: ['cup', 'cake'], partEmoji: ['☕', '🎂'] },
  { word: 'football', emoji: '🏈', parts: ['foot', 'ball'], partEmoji: ['🦶', '⚽'] },
  { word: 'rainbow', emoji: '🌈', parts: ['rain', 'bow'], partEmoji: ['🌧️', '🎀'] },
  { word: 'snowman', emoji: '⛄', parts: ['snow', 'man'], partEmoji: ['❄️', '👨'] },
  { word: 'popcorn', emoji: '🍿', parts: ['pop', 'corn'], partEmoji: ['💥', '🌽'] },
  { word: 'sailboat', emoji: '⛵', parts: ['sail', 'boat'], partEmoji: ['🏳️', '🚤'] },
];
/** Counting practice, by number of parts. */
const COUNT_WORDS: Record<number, readonly PicturedParts[]> = {
  1: [{ word: 'cat', emoji: '🐱', parts: ['cat'] }, { word: 'sun', emoji: '☀️', parts: ['sun'] }, { word: 'fish', emoji: '🐟', parts: ['fish'] },
    { word: 'ball', emoji: '⚽', parts: ['ball'] }],
  2: [{ word: 'rabbit', emoji: '🐰', parts: ['rab', 'bit'] }, { word: 'monkey', emoji: '🐒', parts: ['mon', 'key'] },
    { word: 'window', emoji: '🪟', parts: ['win', 'dow'] }, { word: 'basket', emoji: '🧺', parts: ['bas', 'ket'] }],
  3: [{ word: 'banana', emoji: '🍌', parts: ['ba', 'na', 'na'] }, { word: 'butterfly', emoji: '🦋', parts: ['but', 'ter', 'fly'] },
    { word: 'ladybug', emoji: '🐞', parts: ['la', 'dy', 'bug'] }],
};

const low = (w: string | undefined) => (w ?? '').trim().toLowerCase();

/** Every word and part the session says or asks for. A model or practice word may be none of them. */
export const syllableSessionWords = (items: readonly SyllableClapperItem[]) =>
  new Set(items.flatMap(i => [i.word, i.answer, i.residue, ...i.parts]).map(low).filter(Boolean));

const unused = (p: PicturedParts, used: Set<string>) => !used.has(p.word) && !p.parts.some(x => used.has(x));

/** The clap model for a count item: not the session's, and a count that is not the item's. */
export const clapModelFor = (item: SyllableClapperItem, items: readonly SyllableClapperItem[]) =>
  item.task !== 'count_parts' ? null
    : CLAP_MODELS.find(m => m.parts.length !== item.partCount && unused(m, syllableSessionWords(items))) ?? null;

/** The deletion model: a compound sharing no word or part with the session. */
export const deleteModelFor = (item: SyllableClapperItem, items: readonly SyllableClapperItem[]) =>
  item.task !== 'delete_compound' ? null : COMPOUNDS.find(c => unused(c, syllableSessionWords(items))) ?? null;

/** The practice item: the same act on words the session never uses. Null when the pools run out. */
export function practiceItemFor(item: SyllableClapperItem, items: readonly SyllableClapperItem[]): SyllableClapperItem | null {
  const used = syllableSessionWords(items), id = `${item.id}~simpler`;
  const model = deleteModelFor(item, items);
  const build = (p: PicturedParts, extra: object = {}) =>
    itemFromChallenge({ id, word: p.word, syllables: p.parts, challengeType: item.task, echoWordSlowly: true, inviteClap: true, ...extra }, used);
  if (item.task === 'count_parts') {
    if (item.partCount < 2) return null;
    for (const w of COUNT_WORDS[Math.min(item.partCount - 1, 3)] ?? []) {
      const built = unused(w, used) ? build(w) : null;
      if (built) return built;
    }
    return null;
  }
  for (const c of COMPOUNDS) {
    if (!unused(c, used) || c === model) continue;
    const built = build(c, item.task === 'delete_compound' ? { removePart: c.parts[0], residue: c.parts[1] } : {});
    if (built) return built;
  }
  return null;
}

/** Leak rule for a practice item: true if it changes the act or uses a session word or part. */
export const practiceLeak = (practice: SyllableClapperItem, item: SyllableClapperItem, items: readonly SyllableClapperItem[]) => {
  const used = syllableSessionWords(items);
  return practice.task !== item.task || [practice.word, ...practice.parts].some(w => used.has(low(w)));
};

/** What the pulled help levers put on screen, for the tutor. Never the item's word, parts or count. */
export function leversOnScreen(item: SyllableClapperItem, pulled: readonly string[], items: readonly SyllableClapperItem[]): string | null {
  const parts: string[] = [];
  if (pulled.includes(BEATS_LEVER)) parts.push('a dot for each part slides together over an arrow. Say the parts again with '
    + 'shorter gaps, but never join them into the word');
  const clap = pulled.includes(CLAP_MODEL_LEVER) ? clapModelFor(item, items) : null;
  if (clap) parts.push(`a model on another word, ${clap.word}, with a dot for each clap. Clap and say it; it is not this item's word`);
  if (pulled.includes(STRETCH_LEVER)) parts.push('say the word once more, slowly and stretched, with no pause between its parts');
  const del = pulled.includes(DELETE_MODEL_LEVER) ? deleteModelFor(item, items) : null;
  if (del) parts.push(`a model on another word: ${del.word} is ${del.parts[0]} and ${del.parts[1]}; ${del.parts[0]} fades, and ${del.parts[1]} `
    + 'is left. Say it through; it is not this item\'s word');
  return parts.length ? parts.join('; ') : null;
}

/** The levers this item declares, with their state. */
export function syllableClapperLevers(item: SyllableClapperItem | null, pulled: readonly string[], items: readonly SyllableClapperItem[]): WorkspaceLever[] {
  if (!item) return [];
  const levers: WorkspaceLever[] = [];
  const add = (id: string, kind: WorkspaceLever['kind'], carrier: WorkspaceLever['carrier'], answers: readonly SyllableMiss[], when: string, does: string) =>
    levers.push({ id, kind, carrier, pulled: pulled.includes(id), answers, when, does });
  if (item.task === 'blend_syllables') add(BEATS_LEVER, 'help', 'both', ['parts_back'], 'The learner says the parts back, still apart.',
    'Slides a dot for each part together over an arrow. Say the parts again with shorter gaps; never join them into the word.');
  if (clapModelFor(item, items)) add(CLAP_MODEL_LEVER, 'help', 'both', ['count_one_over', 'counted_sounds', 'word_for_count'],
    'The learner counts sounds, says the word back, or gives a count one off.',
    'Shows another word with a dot for each clap. Clap and say it; it is not this item\'s word.');
  if (item.task === 'count_parts' && !item.echoSlowly) add(STRETCH_LEVER, 'help', 'voiced', ['count_one_over', 'counted_sounds'],
    'The learner could not hear the parts at a natural pace.', 'Say the word once more, slowly and stretched, with no pause between parts.');
  if (deleteModelFor(item, items)) add(DELETE_MODEL_LEVER, 'help', 'both', ['whole_word', 'removed_part'],
    'The learner says the whole word back, or the part taken away.',
    'Shows another two-part word in pictures; its first part fades and the second is left. Say it through.');
  if (practiceItemFor(item, items)) add(SIMPLIFY_LEVER[item.task], 'simplify', 'shown', SYLLABLE_MISSES[item.task],
    'The learner still cannot do it after help.',
    `Opens an easier practice item first: ${{ blend_syllables: 'a two-part word', count_parts: 'a word with fewer parts',
      delete_compound: 'a new two-part word with its first part taken away' }[item.task]}. Not graded; the full item comes back after it.`);
  return levers;
}

