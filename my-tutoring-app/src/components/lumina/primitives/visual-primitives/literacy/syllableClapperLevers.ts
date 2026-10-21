/**
 * The in-item levers on syllable-clapper, as one lever set (`bossLevers.ts`; `/add-support-tiers`, handoff 22 L2).
 * Nothing about a spoken item is printed before credit, and how the tutor voices the word is the pedagogy: chanted
 * parts answer count and delete, and a joined word answers blend. So help never chants the item's parts.
 *
 * Spoken items:
 * - `part_beats` (blend, clue): one dot per part slides together over an arrow while the tutor says the parts with
 *   shorter gaps, never fully joined. The number of parts is not the blend answer.
 * - `clap_model` (count, model): another word, never the session's and never the item's count, a clap per part.
 * - `stretched_joined` (count, clue, voiced; only where the tier dropped the slow echo): the word once more, slowly,
 *   with no pause between parts. It names no count.
 * - `delete_model` (delete, model): another compound in two pictures; the first fades and the second is what is left.
 * - `two_part_blend` / `fewer_parts_word` / `drop_first_part` (easier): an ungraded item of the same act.
 * No clap pad: the 2026-08-16 port removed the on-screen clap button and tally because the tally did the counting,
 * the act this primitive trains. Claps stay in the learner's hands.
 *
 * Build items (build_parts, the shared letter build's helpers in `syllableBuild.ts`):
 * - `clap_cards` (marks): a clap under each card the learner placed.
 * - `model_word` (model): a word made from other cards, with a different number of parts.
 * - `small_bank` (easier): a two-part word from a bank of four cards.
 */
import { leverSet } from '../../../components/live-activity/bossLevers';
import { MODEL_LEVER as MODEL_WORD_LEVER, SMALL_BANK_LEVER, type LetterBuildItem } from './letterBuild';
import { CLAP_LEVER, smallSyllableItem, syllableModelFor } from './syllableBuild';
import { SYLLABLE_MISSES, syllableClapperCard } from './syllableClapper.card';
import {
  asSyllableBuild, isSyllableBuild, itemFromChallenge, syllableModeOf,
  type SyllableBuild, type SyllableClapperBossItem, type SyllableClapperItem,
} from './syllableClapperDomain';
import type { SyllableTask } from './syllableClapperModes';

export { SYLLABLE_MISSES, type SyllableMiss } from './syllableClapper.card';

export const BEATS_LEVER = 'part_beats';
export const CLAP_MODEL_LEVER = 'clap_model';
export const STRETCH_LEVER = 'stretched_joined';
export const DELETE_MODEL_LEVER = 'delete_model';
export const SIMPLIFY_LEVER: Record<SyllableTask, string> = {
  blend_syllables: 'two_part_blend', count_parts: 'fewer_parts_word', delete_compound: 'drop_first_part',
};
export { CLAP_LEVER, MODEL_WORD_LEVER, SMALL_BANK_LEVER };

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
  (item.task !== 'count_parts' ? null
    : CLAP_MODELS.find(m => m.parts.length !== item.partCount && unused(m, syllableSessionWords(items))) ?? null);

/** The deletion model: a compound sharing no word or part with the session. */
export const deleteModelFor = (item: SyllableClapperItem, items: readonly SyllableClapperItem[]) =>
  (item.task !== 'delete_compound' ? null : COMPOUNDS.find(c => unused(c, syllableSessionWords(items))) ?? null);

/** The practice item: the same act on words the session never uses, with the full ask scaffolds. Null when the pools
 *  run out. */
export function practiceItemFor(item: SyllableClapperItem, items: readonly SyllableClapperItem[]): SyllableClapperItem | null {
  const used = syllableSessionWords(items), id = `${item.id}~simpler`;
  const model = deleteModelFor(item, items);
  const build = (p: PicturedParts, extra: object = {}) => {
    const built = itemFromChallenge({ id, word: p.word, syllables: p.parts, challengeType: item.task, echoWordSlowly: true,
      inviteClap: true, ...extra });
    return built && { ...built, supportTier: item.supportTier };
  };
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

// ── the lever set ────────────────────────────────────────────────────────────

/** What the set reads beyond the item: the session's spoken items (a model or practice item uses none of their words). */
export interface SyllableLeverContext { items: readonly SyllableClapperItem[] }

const word = (item: SyllableClapperBossItem) => (isSyllableBuild(item) ? null : item);
const build = (item: SyllableClapperBossItem) => (isSyllableBuild(item) ? item : null);
const spokenIn = (task: SyllableTask) => (item: SyllableClapperBossItem) => { const w = word(item); return w?.task === task ? w : null; };
const BUILD = ['build_parts'] as const;

export const SYLLABLE_LEVERS = leverSet<SyllableClapperBossItem, SyllableLeverContext>({
  modeOf: syllableModeOf,
  missesOf: mode => syllableClapperCard.modes[mode].misses,
  // What a clue's words must never name: the item's answer (and a count's digit), or a word that answers the build.
  answersOf: item => (isSyllableBuild(item) ? item.examples
    : [item.answer, ...(item.task === 'count_parts' ? [String(item.partCount)] : [])]),
  // Both models work a different word; the lesson's tier says when (items carry it, default medium).
  support: { tier: item => item.supportTier ?? 'medium',
    different: item => (isSyllableBuild(item) ? 'a word made from other cards' : 'another word, worked through'),
    own: item => (isSyllableBuild(item) ? 'a word that answers this ask' : 'this item\'s answer') },
  specs: [
    { id: BEATS_LEVER, type: 'clue', modes: ['blend_syllables'], answers: SYLLABLE_MISSES.blend_syllables,
      when: 'The learner says the parts back, still apart.',
      does: 'Slides a dot for each part together over an arrow. Say the parts again with shorter gaps; never join them into the word.',
      fact: 'A dot for each part slides together over an arrow. Say the parts again with shorter gaps, but never join them '
        + 'into the word.' },
    { id: CLAP_MODEL_LEVER, type: 'model', modes: ['count_parts'], answers: SYLLABLE_MISSES.count_parts,
      when: 'The learner counts sounds, says the word back, or gives a count one off.',
      does: 'Shows another word with a clap for each part. Clap and say it; it is not this item\'s word.',
      content: (item, ctx) => { const w = spokenIn('count_parts')(item); return w ? clapModelFor(w, ctx.items) : null; },
      fact: (m: PicturedParts) => `A model on another word, ${m.word}, with a clap for each part. Clap and say it; it is `
        + 'not this item\'s word.' },
    { id: STRETCH_LEVER, type: 'clue', modes: ['count_parts'], carrier: 'voiced', answers: ['count_one_over', 'counted_sounds'],
      when: 'The learner could not hear the parts at a natural pace.',
      does: 'Say the word once more, slowly and stretched, with no pause between parts.',
      // Offered only where the tier dropped the slow echo from the ask.
      offer: item => !!spokenIn('count_parts')(item) && !word(item)!.echoSlowly,
      fact: 'Say the word once more, slowly and stretched, with no pause between its parts.' },
    { id: DELETE_MODEL_LEVER, type: 'model', modes: ['delete_compound'], answers: SYLLABLE_MISSES.delete_compound,
      when: 'The learner says the whole word back, or the part taken away.',
      does: 'Shows another two-part word in pictures; its first part fades and the second is left. Say it through.',
      content: (item, ctx) => { const w = spokenIn('delete_compound')(item); return w ? deleteModelFor(w, ctx.items) : null; },
      fact: (d: PicturedParts) => `A model on another word: ${d.word} is ${d.parts[0]} and ${d.parts[1]}; ${d.parts[0]} fades, `
        + `and ${d.parts[1]} is left. Say it through; it is not this item's word.` },
    ...(['blend_syllables', 'count_parts', 'delete_compound'] as const).map(task => ({
      id: SIMPLIFY_LEVER[task], type: 'easier' as const, modes: [task], carrier: 'shown' as const, answers: 'all' as const,
      when: 'The learner still cannot do it after help.',
      does: `Opens an easier practice item first: ${{ blend_syllables: 'a two-part word', count_parts: 'a word with fewer parts',
        delete_compound: 'a new two-part word with its first part taken away' }[task]}. Not graded; the full item comes back after it.`,
      content: (item: SyllableClapperBossItem, ctx: SyllableLeverContext) => {
        const w = spokenIn(task)(item); return w ? practiceItemFor(w, ctx.items) : null; },
    })),
    { id: CLAP_LEVER, type: 'marks', modes: BUILD, answers: ['too_few_parts', 'too_many_parts', 'counted_letters'],
      when: 'The learner\'s word has a different number of parts than the ask, or they count letters instead of the beats they clap.',
      does: 'Puts a clap mark under each card in the learner\'s word, one per card, so each card reads as one clap. It does not '
        + 'show the number the ask wants or which cards to use.',
      fact: 'A clap mark shows under each card in the learner\'s word, one per card.' },
    { id: MODEL_WORD_LEVER, type: 'model', modes: BUILD, answers: ['not_a_word'],
      when: 'The learner joins parts that do not make a real word.',
      does: 'Shows one word made from other cards, with a different number of parts, and a speaker that says its parts and '
        + 'then the word. It shares no card with this item.',
      content: item => { const b = build(item); return b ? syllableModelFor(b) : null; },
      fact: (m: { word: string; cards: string[] }) => `A solved example on other cards is shown: ${m.cards.join(' + ')} = ${m.word}.` },
    { id: SMALL_BANK_LEVER, type: 'easier', modes: BUILD, carrier: 'shown', answers: ['too_few_parts', 'too_many_parts', 'not_a_word'],
      when: 'The learner cannot hold this many parts, or keeps making words that are not real from so many cards.',
      does: 'Opens a two-part word first, from a bank of only four cards, one word only. It is not graded; the full item '
        + 'comes back after it.',
      content: item => { const b = build(item); const small = b && smallSyllableItem(b); return b && small ? asSyllableBuild(small, b.supportTier) : null; } },
  ],
});

/** The build levers bound for the shared letter build surface: its items carry no mode or tier, so they are stamped. */
export function syllableBuildLevers(supportTier: SyllableBuild['supportTier']) {
  const bound = SYLLABLE_LEVERS.bind({ items: [] });
  const stamp = (item: LetterBuildItem) => asSyllableBuild(item, supportTier);
  return {
    declare: (item: LetterBuildItem, pulled: readonly string[]) => bound.declare(stamp(item), pulled),
    onScreen: (item: LetterBuildItem, pulled: readonly string[]) => bound.onScreen(stamp(item), pulled),
    simpler: (item: LetterBuildItem, lever: string) => bound.simpler(stamp(item), lever) as SyllableBuild | null,
    support: (item: LetterBuildItem) => bound.support(stamp(item)),
  };
}
