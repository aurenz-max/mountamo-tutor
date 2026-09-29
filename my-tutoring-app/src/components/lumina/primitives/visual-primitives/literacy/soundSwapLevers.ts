/**
 * The in-item levers on sound-swap (`/add-support-tiers`, handoff 22 L2). The answer is the new word said aloud;
 * no lever prints it, pictures it or says it before credit (contract R2), and none turns it into a choice (R2 of
 * the handoff).
 *
 * - `mark_target_sound` (help, shown): the tile of the sound to change or take away pulses; for an addition, an
 *   empty dashed tile appears where the new sound goes. The new sound's letter is never drawn.
 * - `swap_model` (help, both): the same operation on model words the session never uses, shown and said end to
 *   end (in, pin). Its sound is never the item's sound, and its new word never rhymes with the item's answer.
 * - `easier_operation_item` (simplify): an ungraded item of the same operation on the FIRST sound, with a held
 *   sound (ox, fox), from words the session never uses.
 *
 * Misses are spoken and not emitted yet (handoff 20 Part B): declared here, unanswered for J9.
 */
import type { WorkspaceLever } from '../../../components/live-activity/runtime/contract';
import { speakablePhoneme } from './phonemeVoice';
import { MODEL_RHYME_SETS, rimeOfWord } from './rhymeModels';
import type { SoundSwapChallenge } from './SoundSwap';

export const MARK_LEVER = 'mark_target_sound';
export const MODEL_LEVER = 'swap_model';
export const EASIER_LEVER = 'easier_operation_item';

export const SWAP_MISSES = ['echo_start', 'other_position', 'nonword', 'sounds_no_word'] as const;
export type SwapMiss = typeof SWAP_MISSES[number];

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

/** What the pulled help levers put on screen, for the tutor. Never the new word. */
export function leversOnScreen(item: SoundSwapChallenge, pulled: readonly string[], challenges: readonly SoundSwapChallenge[]): string | null {
  const parts: string[] = [];
  if (pulled.includes(MARK_LEVER)) parts.push(item.operation === 'addition'
    ? `an empty tile at the ${item.addPosition ?? 'beginning'} of the word, where the new sound goes. Never say the new word`
    : 'the tile of the sound to change pulses. Never say the new word');
  const model = pulled.includes(MODEL_LEVER) ? swapModelFor(item, challenges) : null;
  if (model) parts.push(`a model on other words: ${model.from}, ${model.op === 'substitution' ? `${sayOf(model.oldSound)} changed to ${sayOf(model.sound)}`
    : model.op === 'addition' ? `add ${sayOf(model.sound)} at the ${model.position}` : `take away ${sayOf(model.sound)}`}, makes ${model.to}. `
    + 'Say the model through; it is not this item');
  return parts.length ? parts.join('; ') : null;
}

/** The levers this item declares, with their state. */
export function soundSwapLevers(item: SoundSwapChallenge | null, pulled: readonly string[], challenges: readonly SoundSwapChallenge[]): WorkspaceLever[] {
  if (!item) return [];
  const levers: WorkspaceLever[] = [];
  const add = (id: string, kind: WorkspaceLever['kind'], carrier: WorkspaceLever['carrier'], answers: readonly SwapMiss[], when: string, does: string) =>
    levers.push({ id, kind, carrier, pulled: pulled.includes(id), answers, when, does });
  // The model first: with no named miss the ladder pulls it, and it teaches the whole move.
  if (swapModelFor(item, challenges)) add(MODEL_LEVER, 'help', 'both', ['echo_start', 'nonword', 'sounds_no_word'],
    'The learner says the starting word back, a made-up word, or the sounds with no word.',
    'Shows the same change on other words, start to finish. Say it through; never this item\'s new word.');
  if (markable(item)) add(MARK_LEVER, 'help', 'shown', ['other_position'], 'The learner changes a different sound.',
    item.operation === 'addition' ? 'Shows an empty tile where the new sound goes.' : 'Makes the tile of the sound to change pulse.');
  if (practiceItemFor(item, challenges)) add(EASIER_LEVER, 'simplify', 'shown', SWAP_MISSES,
    'The learner still cannot make the new word after help.',
    'Opens an easier practice item first: the same kind of change, on the first sound, with a sound you can hold. Not graded; the full item comes back after it.');
  return levers;
}
