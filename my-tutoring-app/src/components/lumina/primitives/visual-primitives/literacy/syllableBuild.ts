/**
 * Syllable build — syllable-clapper `build_parts` (qa/open-build/ROADMAP.md, OB-8L), the `syllables` ask kind of the
 * shared letter build (`letterBuild.ts` dispatches here; `LetterBuildSurface.tsx` renders it). "Make a word with three
 * parts": the learner taps word-part cards (one clap each) into a row and presses "I'm done!". Many words pass:
 * but-ter-fly, ba-na-na, and words the seed list never names (but-ter).
 *
 * Code judges the count: the cards used, lowered when two cards run together into one beat ("to" + "o" is "too",
 * one clap). The shared word judge (`judgeWordBuild`, `only: 'real_word'`) decides only whether the word is real; it
 * is never asked for a number. Asks and banks are code-owned from `syllableBuildWords.ts`; no word's parts sit next
 * to each other in the bank.
 *
 * Pre-readers: every card, the ask, the learner's word and the model are heard on request (the tutor says them;
 * the requests are below), so print is never load-bearing.
 */
import type { TeachingAssignment, WorkspaceScene } from '../../../components/live-activity/runtime/useTeachingWorkspace';
import type { WorkspaceLever } from '../../../components/live-activity/runtime/contract';
import type { LetterBuildItem, LetterBuildMiss } from './letterBuild';
import { NOT_FOR_LESSONS } from './letterBuildWords';
import { SYLLABLE_WORDS, syllableWordsWith } from './syllableBuildWords';

export const SYLLABLE_BUILD_MISSES: readonly LetterBuildMiss[] =
  ['too_few_parts', 'too_many_parts', 'counted_letters', 'same_word', 'pick_another', 'not_a_word'];
/** The most cards a word may hold: one past the longest ask, so "one too many" is always possible. */
export const MAX_CARDS = 5;
export const PART_WORDS = ['zero', 'one', 'two', 'three', 'four', 'five'];

export const CLAP_LEVER = 'clap_cards';
const MODEL_LEVER = 'model_word';
const SMALL_BANK_LEVER = 'small_bank';

/**
 * The beats a made word has, from its cards: one per card, unless the cards run together into fewer vowel sounds
 * ("to" + "o" = "too", "ti" + "e" = "tie", "no" + "on" = "noon"). Vowel groups, less a silent final e, can only
 * LOWER the card count; a vitest pins that every seed word comes out at its own number of cards.
 */
export function beatsIn(cards: readonly string[]): number {
  if (!cards.length) return 0;
  const word = cards.join('').toLowerCase();
  let groups = (word.match(/[aeiouy]+/g) ?? []).length;
  if (/[^aeiouyl]e$/.test(word) && groups > 1) groups -= 1;
  return Math.min(cards.length, Math.max(1, groups));
}

export function syllableShapeMiss(item: LetterBuildItem, row: readonly string[], made: readonly string[] = []): LetterBuildMiss | undefined {
  const cards = row.filter(Boolean);
  const n = item.parts ?? 0;
  const beats = beatsIn(cards);
  if (beats !== n) {
    // One card per letter: the learner counted letters, not beats ("pop" for three parts).
    if (cards.length !== n && cards.join('').length === n) return 'counted_letters';
    return beats < n ? 'too_few_parts' : 'too_many_parts';
  }
  const w = cards.join('').toLowerCase();
  if (made.includes(w)) return 'same_word';
  if (NOT_FOR_LESSONS.has(w)) return 'pick_another';
  return undefined;
}

/** True when two parts of one of these words sit next to each other in the bank (the word laid out as the answer). */
export const partsTogether = (bank: readonly string[], words: readonly string[]) => words.some(w => {
  const s = SYLLABLE_WORDS[w] ?? [];
  return s.some((c, i) => i > 0 && c !== s[i - 1] && Math.abs(bank.indexOf(c) - bank.indexOf(s[i - 1])) === 1);
});

/** The gate: 2-4 parts named in the ask, two seed words that answer it from the bank, no word's parts side by side. */
export function askableSyllableItem(item: LetterBuildItem): LetterBuildItem | null {
  const n = item.parts;
  if (!n || !Number.isInteger(n) || n < 2 || n > 4) return null;
  const bank = new Set(item.bank);
  if (bank.size !== item.bank.length || item.bank.length > 14
      || item.bank.some(c => !/^[a-z]+$/.test(c) || /^[^aeiou]e$/.test(c))) return null;
  const examples = Array.from(new Set(item.examples)).filter(w => {
    const s = SYLLABLE_WORDS[w];
    return !!s && s.length === n && s.every(c => bank.has(c)) && beatsIn(s) === n;
  });
  const ask = item.ask.toLowerCase();
  if (examples.length < 2 || !new RegExp(`\\b${PART_WORDS[n]}\\b`).test(ask)
      || examples.some(w => new RegExp(`\\b${w}\\b`).test(ask)) || partsTogether(item.bank, seedWordsFrom(item.bank))) return null;
  return { ...item, examples };
}

// ── Code-owned asks ──────────────────────────────────────────────────────────

const shuffle = <T,>(xs: readonly T[]): T[] => xs.map(x => [Math.random(), x] as const).sort((a, b) => a[0] - b[0]).map(([, x]) => x);
const askFor = (n: number) => `Make a word with ${PART_WORDS[n]} parts.`;

/** Every seed word the cards can make (the bank's words, and any other the cards happen to spell). */
export const seedWordsFrom = (cards: readonly string[]) =>
  Object.keys(SYLLABLE_WORDS).filter(w => SYLLABLE_WORDS[w].every(c => cards.includes(c)));

/** The cards in an order where no seed word's parts touch; null when 200 shuffles find none. */
function spread(cards: readonly string[]): string[] | null {
  const words = seedWordsFrom(cards);
  for (let t = 0; t < 200; t++) {
    const order = shuffle(cards);
    if (!partsTogether(order, words)) return order;
  }
  return null;
}

/** Part counts for a session: never the same twice in a row, every allowed count once the session is long enough. */
export function partCountsFor(grade: string | undefined, count: number): number[] {
  const allowed = /^(k|kindergarten|0)$/i.test(String(grade ?? 'K').replace(/^grade\s*/i, '').trim()) ? [2, 3] : [2, 3, 4];
  for (let t = 0; t < 100; t++) {
    const seq = Array.from({ length: count }, () => allowed[Math.floor(Math.random() * allowed.length)]);
    if (seq.every((n, i) => i === 0 || n !== seq[i - 1]) && (count < allowed.length || allowed.every(n => seq.includes(n)))) return seq;
  }
  return Array.from({ length: count }, (_, i) => allowed[i % allowed.length]);
}

/**
 * Asks for a session. Each bank: the parts of 3 seed words with the asked count (2 when it is four), and the parts of
 * one word with another count, so a real word with the wrong number of parts can be made (pop + corn on a three).
 */
export function makeSyllableItems(grade: string | undefined, count = 4): LetterBuildItem[] {
  const used = new Set<string>();
  const out: LetterBuildItem[] = [];
  for (const n of partCountsFor(grade, count)) {
    for (let t = 0; t < 20; t++) {
      const examples = shuffle(syllableWordsWith(n).filter(w => !used.has(w))).slice(0, n === 4 ? 2 : 3);
      const other = shuffle(syllableWordsWith(n === 2 ? 3 : 2).filter(w => !used.has(w) && !examples.includes(w)))[0];
      if (examples.length < 2 || !other) break;
      const words = [...examples, other];
      const bank = spread(Array.from(new Set(words.flatMap(w => SYLLABLE_WORDS[w]))));
      const item = bank && askableSyllableItem({ id: `s${out.length + 1}`, kind: 'syllables', parts: n, ask: askFor(n), bank,
        examples, ways: 1 });
      // A word that answered an earlier item, made again from this bank's cards, would answer twice.
      if (!item || seedWordsFrom(item.bank).some(w => used.has(w) && SYLLABLE_WORDS[w].length === n)) continue;
      seedWordsFrom(item.bank).forEach(w => used.add(w));
      out.push(item);
      break;
    }
  }
  return out;
}

// ── The workspace ────────────────────────────────────────────────────────────

export function syllableBuildScene(item: LetterBuildItem, row: readonly string[], made: readonly string[], inspectorSaid?: string): WorkspaceScene {
  return { objects: [], facts: {
    ask: item.ask,
    cardBank: item.bank.join(' · '),
    learnersWord: row.length ? row.join(' + ') : 'no cards yet',
    partsPlaced: row.length,
    ...(item.ways === 2 ? { waysAsked: 2, waysMade: made.length, madeBefore: made.join(', ') || 'none' } : {}),
    ...(inspectorSaid ? { inspectorSaid } : {}),
    constraints: 'Each card is one spoken part (one clap). The learner taps a card to add it to the end of their word, '
      + 'taps a card in their word to take it out, can tap a speaker to hear a card, the task or their word, and presses '
      + '"I\'m done!". The builder counts the parts in code, then checks whether it is a real word. Many words can pass. '
      + 'You cannot place or remove a card.',
  } };
}

export const describeSyllableBuild = (row: readonly string[]) => (row.length ? `Built "${row.join('-')}"` : 'Built nothing');

export const syllablePassWords = (item: LetterBuildItem, row: readonly string[], more: boolean) =>
  `Yes! ${row.join('-')}, "${row.join('')}", has ${PART_WORDS[item.parts ?? 0]} parts.${more ? ' Now make a different one.' : ''}`;

/** What the tutor is asked to say when the learner taps a speaker. Each names only what is on screen. */
export const hearCardRequest = (card: string) =>
  `The learner tapped a word-part card's speaker. Say only this part, once, plainly: "${card}"`;
export const hearMadeRequest = (row: readonly string[]) =>
  `The learner tapped to hear the word they made from the cards ${row.join(' + ')}. Say it once as one word, as `
  + `written, even if it is not a real word, and say nothing else: "${row.join('')}"`;
export const hearAskRequest = (a: TeachingAssignment) => `The learner tapped to hear the task again. Say only this, once: "${a.task}"`;
export const hearModelRequest = (m: { word: string; cards: readonly string[] }) =>
  `The learner tapped the example's speaker. Say its parts one at a time, then the whole word, and nothing else: `
  + `"${m.cards.join('... ')}... ${m.word}"`;

// ── Levers (start bare), designed from why a learner misses ──────────────────
// Counting letters instead of beats, or losing count of the beats: `clap_cards` puts a clap under each card the
// learner placed. Real syllables that make no word: `model_word`, a word made from other cards. Three parts is too
// many to hold: `small_bank`, two parts from a bank of two words.

/** A solved example on other cards, with a different number of parts than the ask. */
export function syllableModelFor(item: LetterBuildItem): { word: string; cards: string[] } | null {
  const want = item.parts === 2 ? 3 : 2;
  const word = syllableWordsWith(want).find(w => !item.examples.includes(w) && SYLLABLE_WORDS[w].every(c => !item.bank.includes(c)));
  return word ? { word, cards: [...SYLLABLE_WORDS[word]] } : null;
}

/** The easier practice item: two parts, the cards of two two-part words, interleaved so neither word sits together. */
export function smallSyllableItem(item: LetterBuildItem): LetterBuildItem | null {
  const twos = syllableWordsWith(2);
  const inBank = twos.filter(w => SYLLABLE_WORDS[w].every(c => item.bank.includes(c)));
  const pick: string[] = [];
  for (const w of [...(item.parts === 2 ? item.examples : inBank), ...twos.filter(x => !item.bank.some(c => SYLLABLE_WORDS[x].includes(c)))]) {
    if (pick.length < 2 && !pick.some(p => SYLLABLE_WORDS[p].some(c => SYLLABLE_WORDS[w].includes(c)))) pick.push(w);
  }
  if (pick.length < 2) return null;
  const [a, b] = pick.map(w => SYLLABLE_WORDS[w]);
  const bank = [a[0], b[0], a[1], b[1]];
  if (bank.length >= item.bank.length || partsTogether(bank, seedWordsFrom(bank))) return null;
  return { ...item, id: `${item.id}~small`, parts: 2, ask: askFor(2), bank, examples: pick, ways: 1 };
}

const lever = (id: string, kind: WorkspaceLever['kind'], answers: readonly LetterBuildMiss[], when: string, does: string,
  pulled: readonly string[]): WorkspaceLever => ({ id, kind, carrier: 'shown', when, does, answers, pulled: pulled.includes(id) });

export function syllableBuildLevers(item: LetterBuildItem, pulled: readonly string[]): WorkspaceLever[] {
  return [
    lever(CLAP_LEVER, 'help', ['too_few_parts', 'too_many_parts', 'counted_letters'],
      'The learner\'s word has a different number of parts than the ask, or they count letters instead of the beats they clap.',
      'Puts a clap mark under each card in the learner\'s word, one per card, so each card reads as one clap. It does not '
        + 'show the number the ask wants or which cards to use.',
      pulled),
    ...(syllableModelFor(item) ? [lever(MODEL_LEVER, 'help', ['not_a_word'],
      'The learner joins parts that do not make a real word.',
      'Shows one word made from other cards, with a different number of parts, and a speaker that says its parts and '
        + 'then the word. It shares no card with this item.',
      pulled)] : []),
    ...(smallSyllableItem(item) ? [lever(SMALL_BANK_LEVER, 'simplify', ['too_few_parts', 'too_many_parts', 'not_a_word'],
      'The learner cannot hold this many parts, or keeps making words that are not real from so many cards.',
      'Opens a two-part word first, from a bank of only four cards, one word only. It is not graded; the full item '
        + 'comes back after it.',
      pulled)] : []),
  ];
}

export function syllableLeverFacts(pulled: readonly string[], item: LetterBuildItem): string | undefined {
  const model = pulled.includes(MODEL_LEVER) ? syllableModelFor(item) : null;
  const notes = [
    pulled.includes(CLAP_LEVER) && 'A clap mark shows under each card in the learner\'s word, one per card.',
    model && `A solved example on other cards is shown: ${model.cards.join(' + ')} = ${model.word}.`,
  ].filter(Boolean);
  return notes.length ? notes.join(' ') : undefined;
}

export function syllableMissWords(miss: LetterBuildMiss | undefined, item: LetterBuildItem): string {
  switch (miss) {
    case 'too_few_parts':
    case 'too_many_parts':
      return `Say your word and clap it, one clap for each part. Does it have ${PART_WORDS[item.parts ?? 0]} parts?`;
    case 'counted_letters': return 'Parts are the beats you clap, not letters. Say your word and clap it.';
    case 'same_word': return 'You already made that word. Make a different one.';
    case 'pick_another': return 'Let us pick a different word for this one.';
    case 'not_a_word': return 'Hmm, that is not a word we use. Try other cards.';
    default: return 'Not quite. Try again.';
  }
}
