/**
 * The in-item levers on sound-swap, as one lever set (`bossLevers.ts`; `/add-support-tiers`, handoff 22 L2). The
 * answer is the new word said aloud; no lever prints it, pictures it or says it before credit (contract R2), and none
 * turns it into a choice (R2 of the handoff).
 *
 * Spoken items (addition, deletion, substitution):
 * - `swap_model` (model): the same operation on model words the session never uses, shown and said end to end (in,
 *   pin). Its sound is never the item's sound, and its new word never rhymes with the item's answer.
 * - `mark_target_sound` (marks): the tile of the sound to change or take away pulses; for an addition, an empty dashed
 *   tile appears where the new sound goes. The new sound's letter is never drawn. Not offered where the tier's own
 *   highlight is already up.
 * - `easier_operation_item` (easier): an ungraded item of the same operation on the FIRST sound, with a held sound
 *   (ox, fox), from words the session never uses.
 * Build items (swap_build, the shared letter build's helpers in `letterBuild.ts`):
 * - `pattern_card` (clue): the given word with "keep two letters, change one", no letter to choose.
 * - `model_word` (model): one solved change on other words, none of them an answer to this item.
 * - `small_bank` (easier): the same ask, one word, only the letters two answers need.
 */
import { leverSet } from '../../../components/live-activity/bossLevers';
import { speakablePhoneme } from './phonemeVoice';
import { MODEL_RHYME_SETS, rimeOfWord } from './rhymeModels';
import type { SoundSwapChallenge } from './SoundSwap';
import { SWAP_OPERATIONS, soundSwapCard } from './soundSwap.card';
import { asSwapBuild, asSwapWord, isSwapBuild, type SoundSwapItem, type SwapBuild } from './soundSwapDomain';
import { modelFor, patternFor, smallBankFor, type LetterBuildItem } from './letterBuild';

export const MARK_LEVER = 'mark_target_sound';
export const MODEL_LEVER = 'swap_model';
export const EASIER_LEVER = 'easier_operation_item';
export const PATTERN_LEVER = 'pattern_card';
export const MODEL_WORD_LEVER = 'model_word';
export const SMALL_BANK_LEVER = 'small_bank';

type Op = SoundSwapChallenge['operation'];
/** A worked operation: `from` changed by `sound` (at `position`) makes `to`. */
export interface SwapExample { op: Op; from: string; to: string; sound: string; oldSound?: string; position: 'beginning' | 'end';
  fromPhonemes: string[]; toPhonemes: string[]; emoji: string }

const VOWEL: Record<string, string> = { a: '/æ/', e: '/ɛ/', i: '/ɪ/', o: '/ɒ/', u: '/ʌ/' };
const cvc = (w: string) => w.split('').map(ch => VOWEL[ch] ?? `/${ch}/`);

/** Additions (and, reversed, deletions) of a first sound. Stops for models, held sounds for practice. */
const FIRST_SOUND: ReadonlyArray<{ short: string; long: string; sound: string; shortPh: string[]; longPh: string[]; emoji: string; held: boolean }> = [
  { short: 'in', long: 'pin', sound: '/p/', shortPh: ['/ɪ/', '/n/'], longPh: ['/p/', '/ɪ/', '/n/'], emoji: '📌', held: false },
  { short: 'up', long: 'cup', sound: '/k/', shortPh: ['/ʌ/', '/p/'], longPh: ['/k/', '/ʌ/', '/p/'], emoji: '🥤', held: false },
  { short: 'ox', long: 'box', sound: '/b/', shortPh: ['/ɒ/', '/k/', '/s/'], longPh: ['/b/', '/ɒ/', '/k/', '/s/'], emoji: '📦', held: false },
  { short: 'ox', long: 'fox', sound: '/f/', shortPh: ['/ɒ/', '/k/', '/s/'], longPh: ['/f/', '/ɒ/', '/k/', '/s/'], emoji: '🦊', held: true },
  { short: 'egg', long: 'leg', sound: '/l/', shortPh: ['/ɛ/', '/g/'], longPh: ['/l/', '/ɛ/', '/g/'], emoji: '🦵', held: true },
  { short: 'eat', long: 'meat', sound: '/m/', shortPh: ['/iː/', '/t/'], longPh: ['/m/', '/iː/', '/t/'], emoji: '🍖', held: true },
  { short: 'arm', long: 'farm', sound: '/f/', shortPh: ['/ɑr/', '/m/'], longPh: ['/f/', '/ɑr/', '/m/'], emoji: '🚜', held: true },
  { short: 'ice', long: 'mice', sound: '/m/', shortPh: ['/aɪ/', '/s/'], longPh: ['/m/', '/aɪ/', '/s/'], emoji: '🐭', held: true },
];
/** Additions (and deletions) at the end. */
const LAST_SOUND: ReadonlyArray<{ short: string; long: string; sound: string; shortPh: string[]; longPh: string[]; emoji: string }> = [
  { short: 'row', long: 'rope', sound: '/p/', shortPh: ['/r/', '/oʊ/'], longPh: ['/r/', '/oʊ/', '/p/'], emoji: '🪢' },
  { short: 'see', long: 'seed', sound: '/d/', shortPh: ['/s/', '/iː/'], longPh: ['/s/', '/iː/', '/d/'], emoji: '🌱' },
];
/** First-sound changes to a held sound, for practice. */
const HELD_CHANGES: ReadonlyArray<readonly [string, string, string]> = [
  ['hat', 'mat', '🧘'], ['bun', 'sun', '☀️'], ['dog', 'log', '🪵'], ['top', 'mop', '🧹'], ['bed', 'red', '🟥'], ['pan', 'fan', '🪭'],
  ['bug', 'rug', '🧶'], ['pig', 'fig', '🟣'],
];

const low = (w: string | undefined) => (w ?? '').trim().toLowerCase();
const sayOf = (raw: string | undefined) => speakablePhoneme(raw ?? '');

/** The sound an item operates with: added, taken away, or put in. */
export const operatedSound = (c: SoundSwapChallenge) =>
  sayOf(c.operation === 'addition' ? c.addPhoneme : c.operation === 'deletion' ? c.deletePhoneme : c.newPhoneme);

/** Every starting and new word in the session. A model or practice word may be none of them. */
export const swapSessionWords = (challenges: readonly SoundSwapChallenge[]) =>
  new Set(challenges.flatMap(c => [c.originalWord, c.resultWord]).map(low).filter(Boolean));

function examples(op: Op, held: boolean): SwapExample[] {
  if (op === 'substitution') {
    return held
      ? HELD_CHANGES.map(([from, to, emoji]) => ({ op, from, to, sound: `/${to[0]}/`, oldSound: `/${from[0]}/`, position: 'beginning' as const,
        fromPhonemes: cvc(from), toPhonemes: cvc(to), emoji }))
      : MODEL_RHYME_SETS.filter(m => m.swap).map(m => {
        const [a, b] = m.words;
        return { op, from: a.word, to: b.word, sound: `/${b.word[0]}/`, oldSound: `/${a.word[0]}/`, position: 'beginning' as const,
          fromPhonemes: [], toPhonemes: [], emoji: b.emoji };
      });
  }
  const firsts = FIRST_SOUND.filter(f => f.held === held).map(f => ({ ...f, position: 'beginning' as const }));
  const lasts = held ? [] : LAST_SOUND.map(f => ({ ...f, position: 'end' as const }));
  return [...firsts, ...lasts].map(f => op === 'addition'
    ? { op, from: f.short, to: f.long, sound: f.sound, position: f.position, fromPhonemes: f.shortPh, toPhonemes: f.longPh, emoji: f.emoji }
    : { op, from: f.long, to: f.short, sound: f.sound, position: f.position, fromPhonemes: f.longPh, toPhonemes: f.shortPh, emoji: f.emoji });
}

/** An example is off the session: none of its words is a session word, its sound is not the item's, and its new
 *  word does not rhyme with the item's answer. */
const offSession = (e: SwapExample, item: SoundSwapChallenge, used: Set<string>) =>
  !used.has(e.from) && !used.has(e.to) && sayOf(e.sound) !== operatedSound(item) && rimeOfWord(e.to) !== rimeOfWord(item.resultWord);

/** The model for this item, at the item's position where one exists. Null when every model is the session's. */
export function swapModelFor(item: SoundSwapChallenge, challenges: readonly SoundSwapChallenge[]): SwapExample | null {
  const used = swapSessionWords(challenges);
  const position = item.operation === 'addition' ? item.addPosition : undefined;
  const fits = examples(item.operation, false).filter(e => offSession(e, item, used));
  return fits.find(e => !position || e.position === position) ?? fits[0] ?? null;
}

/** The practice item: the same operation on a first sound, with a held sound, on words the session never uses. */
export function practiceItemFor(item: SoundSwapChallenge, challenges: readonly SoundSwapChallenge[]): SoundSwapChallenge | null {
  const used = swapSessionWords(challenges);
  const e = examples(item.operation, true).find(x => offSession(x, item, used));
  if (!e) return null;
  const base = { id: `${item.id}~simpler`, operation: item.operation, originalWord: e.from, originalPhonemes: e.fromPhonemes,
    originalImage: '', resultWord: e.to, resultPhonemes: e.toPhonemes, resultImage: e.emoji, showTargetHighlight: item.showTargetHighlight };
  if (item.operation === 'addition') return { ...base, addPhoneme: e.sound, addPosition: 'beginning' };
  if (item.operation === 'deletion') return { ...base, deletePhoneme: e.sound, deletePosition: 'beginning' };
  return { ...base, oldPhoneme: e.oldSound, newPhoneme: e.sound, substitutePosition: 'beginning' };
}

/** Leak rule for a practice item: true if it changes the operation, uses a session word, or the item's sound. */
export const practiceLeak = (practice: SoundSwapChallenge, item: SoundSwapChallenge, challenges: readonly SoundSwapChallenge[]) => {
  const used = swapSessionWords(challenges);
  return practice.operation !== item.operation || used.has(low(practice.originalWord)) || used.has(low(practice.resultWord))
    || operatedSound(practice) === operatedSound(item);
};

/** Which tile a substitution or deletion acts on (-1 when the data does not say). Addition acts on no tile. */
export function targetTile(c: SoundSwapChallenge): number {
  const [phoneme, position] = c.operation === 'substitution' ? [c.oldPhoneme, c.substitutePosition]
    : c.operation === 'deletion' ? [c.deletePhoneme, c.deletePosition] : [undefined, undefined];
  if (!phoneme || !position) return -1;
  const p = c.originalPhonemes.map(x => x.toLowerCase()), want = phoneme.toLowerCase();
  if (position === 'beginning') return p[0] === want ? 0 : -1;
  if (position === 'end') return p[p.length - 1] === want ? p.length - 1 : -1;
  for (let i = 1; i < p.length - 1; i++) if (p[i] === want) return i;
  return -1;
}

/** Whether the mark lever has anything to mark, and is not already on screen from the tier. */
const markable = (c: SoundSwapChallenge) => c.operation === 'addition'
  || (targetTile(c) >= 0 && (c.operation === 'deletion' || c.showTargetHighlight === false));

// ── the lever set ────────────────────────────────────────────────────────────

/** What the set reads beyond the item: the session's challenges (a model or practice item uses none of their words). */
export interface SwapLeverContext { challenges: readonly SoundSwapChallenge[] }

const SPOKEN = SWAP_OPERATIONS;
const BUILD = ['swap_build'] as const;
const word = (item: SoundSwapItem) => (isSwapBuild(item) ? null : item);
const build = (item: SoundSwapItem) => (isSwapBuild(item) ? item : null);

/** The model as the tutor reads it: the starting word, the change, the word it makes. */
const modelFact = (m: SwapExample) => `A model on other words: ${m.from}, ${m.op === 'substitution'
  ? `${sayOf(m.oldSound)} changed to ${sayOf(m.sound)}` : m.op === 'addition' ? `add ${sayOf(m.sound)} at the ${m.position}`
    : `take away ${sayOf(m.sound)}`}, makes ${m.to}. Say the model through; it is not this item.`;

export const SWAP_LEVERS = leverSet<SoundSwapItem, SwapLeverContext>({
  modeOf: item => item.mode,
  missesOf: mode => soundSwapCard.modes[mode].misses,
  answersOf: item => (isSwapBuild(item) ? item.examples : [item.resultWord]),
  // Both models show a different item solved; the lesson's tier says when (items carry it, default medium).
  support: { tier: item => item.supportTier,
    different: item => (isSwapBuild(item) ? 'one solved change on other words' : 'the same kind of change on other words'),
    own: item => (isSwapBuild(item) ? 'a word that answers this ask' : 'this item\'s new word') },
  specs: [
    // The model first: with no named miss the ladder pulls it, and it teaches the whole move.
    { id: MODEL_LEVER, type: 'model', modes: SPOKEN, answers: ['echo_start', 'nonword', 'sounds_no_word'],
      when: 'The learner says the starting word back, a made-up word, or the sounds with no word.',
      does: 'Shows the same change on other words, start to finish. Say it through; never this item\'s new word.',
      content: (item, ctx) => { const w = word(item); return w ? swapModelFor(w, ctx.challenges) : null; },
      fact: (m: SwapExample) => modelFact(m) },
    { id: MARK_LEVER, type: 'marks', modes: SPOKEN, answers: ['other_position'],
      when: 'The learner changes a different sound.',
      does: item => (!isSwapBuild(item) && item.operation === 'addition'
        ? 'Shows an empty tile where the new sound goes.' : 'Makes the tile of the sound to change pulse.'),
      content: item => { const w = word(item); return w && markable(w) ? w : null; },
      fact: (w: SoundSwapChallenge) => (w.operation === 'addition'
        ? `An empty tile sits at the ${w.addPosition ?? 'beginning'} of the word, where the new sound goes; it shows no letter.`
        : 'The tile of the sound to change pulses.') },
    { id: EASIER_LEVER, type: 'easier', modes: SPOKEN, carrier: 'shown', answers: 'all',
      when: 'The learner still cannot make the new word after help.',
      does: 'Opens an easier practice item first: the same kind of change, on the first sound, with a sound you can '
        + 'hold. Not graded; the full item comes back after it.',
      content: (item, ctx) => { const w = word(item); const p = w && practiceItemFor(w, ctx.challenges);
        return w && p ? asSwapWord(p, w.supportTier) : null; } },
    { id: PATTERN_LEVER, type: 'clue', modes: BUILD, carrier: 'shown', answers: ['not_cvc', 'same_as_given', 'changed_more'],
      when: 'The learner\'s word is not three letters, is the given word back, or changes more than one letter.',
      does: 'Shows a pattern card above the boxes: the given word with "keep two letters, change one". No letter the '
        + 'learner must choose is shown.',
      content: item => { const b = build(item); return b ? patternFor(b) : null; },
      fact: (pattern: string) => `A pattern card above the boxes shows: ${pattern}.` },
    { id: MODEL_WORD_LEVER, type: 'model', modes: BUILD, answers: ['not_a_word'],
      when: 'The learner makes letters that are not a real word.',
      does: 'Shows one solved change on other words, so the learner sees how a real word comes out. It shares no answer '
        + 'with this item.',
      content: item => { const b = build(item); return b ? modelFor(b) : null; },
      fact: (model: string) => `A solved example on other letters is shown: ${model}.` },
    { id: SMALL_BANK_LEVER, type: 'easier', modes: BUILD, carrier: 'shown', answers: ['not_a_word'],
      when: 'The learner keeps making letters that are not a word, or cannot start with so many letters.',
      does: 'Opens the same ask first with a smaller letter bank, one word only. It is not graded; the full item comes '
        + 'back after it.',
      content: item => { const b = build(item); const small = b && smallBankFor(b); return b && small ? asSwapBuild(small, b.supportTier) : null; } },
  ],
});

/** The build levers bound for the shared letter build surface: its items carry no mode or tier, so they are stamped. */
export function swapBuildLevers(ctx: SwapLeverContext, supportTier: SwapBuild['supportTier']) {
  const bound = SWAP_LEVERS.bind(ctx);
  const stamp = (item: LetterBuildItem) => asSwapBuild(item, supportTier);
  return {
    declare: (item: LetterBuildItem, pulled: readonly string[]) => bound.declare(stamp(item), pulled),
    onScreen: (item: LetterBuildItem, pulled: readonly string[]) => bound.onScreen(stamp(item), pulled),
    simpler: (item: LetterBuildItem, lever: string) => bound.simpler(stamp(item), lever) as SwapBuild | null,
    support: (item: LetterBuildItem) => bound.support(stamp(item)),
  };
}
