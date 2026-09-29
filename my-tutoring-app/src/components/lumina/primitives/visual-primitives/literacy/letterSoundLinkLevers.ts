/**
 * The in-item levers on letter-sound-link (`/add-support-tiers`). `hear-see` (handoff 22 L1): the tutor says a
 * sound and the learner taps one of two letters. The spoken modes (handoff 24) are at the end of this header.
 *
 * Pure: the component draws from these, the workspace publishes them, and the tests hold each leak rule.
 * - `keyword_under_both` (help): a keyword picture under BOTH letter cards, alike. Answers `other_short_vowel`
 *   and `other_letter`. Leak rules: both pictures or neither (one alone marks a card); both must read as their
 *   word; neither letter nor keyword may come up in a later item, which would then be told (contract R4).
 * - `voice_feel_model` (help): a quiet and a buzzing sound on two pictures, no letters (snake "sss", bee "zzz").
 *   Answers `voicing_partner`, only on a voicing-pair item. Leak rule: never the item's own pair.
 * - `far_letter_pair` (simplify): an ungraded practice item first, a NEW sound whose letter is used nowhere in
 *   the session, against a foil of the other kind (vowel against consonant). Leak rule: the same sound with a
 *   far foil would hand over the answer when the full item comes back, and a session letter would be told
 *   before it is asked (R4).
 *
 * `see-hear` (say the letter's sound) and `keyword-match` (say the picture word that starts with it):
 * - `letter_model` (help, both): another letter card, one the session never asks, offers or pictures, of the
 *   item's sound kind where the group has one (held, clipped, vowel); the tutor says its sound, held or clipped
 *   as it is. On keyword-match its keyword picture sits beside it and the tutor says the word too. Answers
 *   `letter_name`, `keyword_word`, `added_vowel` (see-hear) and `other_picture`, `letter_name`, `said_the_sound`
 *   (keyword-match). Leak rule (`letterModelLeak`): no session letter, keyword or picture (R3, R4).
 * - `other_sound` (see-hear) has no lever by decision: only this letter's own keyword separates it from the one the
 *   learner said, and the anchor is never shown before credit (R3). No simplify on the spoken modes: another
 *   letter asks the same thing, not less.
 */
import type { WorkspaceLever } from '../../../components/live-activity/runtime/contract';
import { LETTER_GROUPS, normalizeLetterGroup } from '../../../service/literacy/letterGroups';
import { canProduceSound, itemFromChallenge, isClippedSound, keywordFor, keywordNamesItsPicture, emojiForKeyword,
  spokenSoundFor, type LetterSoundItem } from './letterSoundLinkDomain';

export const KEYWORDS_LEVER = 'keyword_under_both';
export const VOICE_LEVER = 'voice_feel_model';
export const FAR_PAIR_LEVER = 'far_letter_pair';
export const LETTER_MODEL_LEVER = 'letter_model';

const VOWELS = new Set(['a', 'e', 'i', 'o', 'u']);
const VOICING = [['t', 'd'], ['p', 'b'], ['s', 'z'], ['f', 'v'], ['k', 'g'], ['c', 'g']];
/** Continuants first: a held sound is the easiest to hear against a vowel. */
const EASY_FIRST = ['m', 's', 'f', 'n', 'l', 'r', 'a', 'o', 'u', 'i', 'e', 't', 'p', 'd', 'b', 'g', 'h', 'k', 'c'];

const low = (s: string) => s.trim().toLowerCase();
const optionLetters = (item: LetterSoundItem) => item.options.map(o => low(o.value));

/** A voicing model on pictures: the sound said quietly, and its buzzing partner. */
export interface VoiceModel { pair: [string, string]; quiet: { emoji: string; word: string; sound: string };
  buzz: { emoji: string; word: string; sound: string } }
const VOICE_MODELS: readonly VoiceModel[] = [
  { pair: ['s', 'z'], quiet: { emoji: '🐍', word: 'snake', sound: 'sss' }, buzz: { emoji: '🐝', word: 'bee', sound: 'zzz' } },
  { pair: ['f', 'v'], quiet: { emoji: '🌬️', word: 'wind', sound: 'fff' }, buzz: { emoji: '🏎️', word: 'race car', sound: 'vvv' } },
];

export const isVoicingPair = (item: LetterSoundItem) => {
  const [a, b] = optionLetters(item);
  return item.mode === 'hear-see' && VOICING.some(([x, y]) => (x === a && y === b) || (x === b && y === a));
};

/** The model for this item: a pair that is not its own. Null off a voicing pair. */
export function voiceModelFor(item: LetterSoundItem): VoiceModel | null {
  if (!isVoicingPair(item)) return null;
  const letters = optionLetters(item);
  return VOICE_MODELS.find(m => !m.pair.some(l => letters.includes(l))) ?? null;
}

/** What later items will ask or show: their letters, their choices, and their keyword words. */
export function laterStimuli(items: readonly LetterSoundItem[], index: number): Set<string> {
  return new Set(items.slice(index + 1).flatMap(i => [low(i.letter), low(i.keyword), ...i.options.map(o => low(o.value))]));
}

/** The keyword picture under each card, or [] when the pair fails a leak rule. */
export function cardKeywords(item: LetterSoundItem, later: ReadonlySet<string>): Array<{ letter: string; word: string; emoji: string }> {
  if (item.mode !== 'hear-see' || item.options.length !== 2) return [];
  const cards = optionLetters(item).map(letter => ({ letter, word: keywordFor(letter), emoji: emojiForKeyword(keywordFor(letter)) }));
  if (!cards.every(c => keywordNamesItsPicture(c.letter))) return [];
  if (cards.some(c => later.has(c.letter) || later.has(c.word))) return [];
  return cards;
}

/** Leak rule for card keywords: true unless every card has one, each distinct. */
export const cardKeywordsLeak = (item: LetterSoundItem, drawn: readonly { letter: string }[]) =>
  drawn.length !== item.options.length || new Set(drawn.map(d => d.letter)).size !== drawn.length;

/** Every letter the session asks, offers or reveals. A practice item may use none of them (R4). */
export const sessionLetters = (items: readonly LetterSoundItem[]) =>
  new Set(items.flatMap(i => [low(i.letter), ...(i.mode === 'hear-see' ? optionLetters(i) : [])]));

/**
 * The practice item for `item`: a new sound in the letter group that the session never uses, against a foil
 * of the other kind that the session never uses either. Two cards, tapped, like the full item. Null if the
 * group has no such pair.
 */
export function fartherPair(item: LetterSoundItem, items: readonly LetterSoundItem[], letterGroup: number | undefined): LetterSoundItem | null {
  if (item.mode !== 'hear-see') return null;
  const group = LETTER_GROUPS[normalizeLetterGroup(letterGroup) ?? 4].filter(l => l.length === 1);
  const used = sessionLetters(items);
  const free = EASY_FIRST.filter(l => group.includes(l) && !used.has(l) && canProduceSound(l));
  for (const target of free) {
    const foil = free.find(l => l !== target && VOWELS.has(l) !== VOWELS.has(target));
    if (!foil) continue;
    const options = [target, foil].sort().map(letter => ({ letter, isCorrect: letter === target }));
    return { ...itemFromChallenge({ id: `${item.id}~simpler`, mode: 'hear-see', targetLetter: target, targetSound: `/${target}/`,
      keywordWord: keywordFor(target), options }, item.tier) };
  }
  return null;
}

/** Leak rule for a practice item: true if it shares any letter with the session. */
export const practiceLeak = (practice: LetterSoundItem, items: readonly LetterSoundItem[]) => {
  const used = sessionLetters(items);
  return [practice.letter, ...optionLetters(practice)].some(l => used.has(low(l)));
};

// ── letter_model: the spoken modes ───────────────────────────────────────────

export interface LetterModel { letter: string; sound: string; word: string; emoji: string }
const soundKind = (l: string) => VOWELS.has(l) ? 'vowel' : isClippedSound(l) ? 'clipped' : 'held';

/** Every word and picture the session says or shows: keywords, distractors and keyword-match cards. */
const sessionPictures = (items: readonly LetterSoundItem[]) => new Set(items.flatMap(i =>
  [i.keyword, i.keywordEmoji, i.distractor, ...i.options.flatMap(o => [o.value, o.emoji ?? ''])]).map(low).filter(Boolean));

/** Leak rule for the model: true when its letter, keyword or picture is one the session uses. */
export const letterModelLeak = (m: LetterModel, items: readonly LetterSoundItem[]) => {
  const pictures = sessionPictures(items);
  return sessionLetters(items).has(m.letter) || pictures.has(low(m.word)) || pictures.has(m.emoji);
};

/** The model for a spoken item: a group letter of the item's sound kind first, then any other that passes. */
export function letterModelFor(item: LetterSoundItem, items: readonly LetterSoundItem[], letterGroup: number | undefined): LetterModel | null {
  if (item.mode === 'hear-see') return null;
  const group = LETTER_GROUPS[normalizeLetterGroup(letterGroup) ?? 4].filter(l => l.length === 1);
  const ordered = [...EASY_FIRST.filter(l => group.includes(l)), ...EASY_FIRST.filter(l => !group.includes(l))];
  const model = (l: string): LetterModel => ({ letter: l, sound: spokenSoundFor(l, `/${l}/`), word: keywordFor(l), emoji: emojiForKeyword(keywordFor(l)) });
  const fits = (l: string) => canProduceSound(l) && keywordNamesItsPicture(l) && !letterModelLeak(model(l), items);
  const letter = ordered.find(l => fits(l) && soundKind(l) === soundKind(low(item.letter))) ?? ordered.find(fits);
  return letter ? model(letter) : null;
}

/** The levers this item declares, with their state. */
export function letterSoundLevers(item: LetterSoundItem | null, pulled: readonly string[], items: readonly LetterSoundItem[],
  index: number, letterGroup: number | undefined): WorkspaceLever[] {
  if (!item) return [];
  if (item.mode !== 'hear-see') {
    const m = letterModelFor(item, items, letterGroup);
    const match = item.mode === 'keyword-match';
    return m ? [{ id: LETTER_MODEL_LEVER, kind: 'help', carrier: 'both', pulled: pulled.includes(LETTER_MODEL_LEVER),
      answers: match ? ['other_picture', 'letter_name', 'said_the_sound'] : ['letter_name', 'keyword_word', 'added_vowel'],
      when: match ? 'The learner says the other picture, the letter name, or the sound with no picture word.'
        : 'The learner says the letter name, a whole word, or the sound with a vowel after it.',
      // The model letter is named only in the scene fact once pulled (letter-spotter replay 09-29: named here, the
      // tutor spoke of the model before any pull).
      does: match ? 'Shows another letter beside its picture. Once it is on screen, say its sound, then the picture word that '
        + 'starts with it. It is not this item\'s letter.'
        : 'Shows another letter. Once it is on screen, say its sound once, on its own. It is not this item\'s letter.',
    }] : [];
  }
  const levers: WorkspaceLever[] = [];
  if (cardKeywords(item, laterStimuli(items, index)).length) levers.push({
    id: KEYWORDS_LEVER, kind: 'help', carrier: 'shown', pulled: pulled.includes(KEYWORDS_LEVER),
    answers: ['other_short_vowel', 'other_letter'],
    when: 'The learner taps the wrong letter, not a voicing partner.',
    does: 'Puts a keyword picture under each of the two letter cards, alike. Do not name either picture.',
  });
  const model = voiceModelFor(item);
  if (model) levers.push({
    id: VOICE_LEVER, kind: 'help', carrier: 'both', pulled: pulled.includes(VOICE_LEVER), answers: ['voicing_partner'],
    when: 'The learner taps the letter whose sound differs only by the voice being on or off.',
    does: `Shows a quiet sound and a buzzing sound on two pictures, a ${model.quiet.word} (${model.quiet.sound}) and a `
      + `${model.buzz.word} (${model.buzz.sound}), with a hand on the throat. Say both sounds so the learner feels `
      + 'the buzz; they are not this item\'s sounds.',
  });
  if (fartherPair(item, items, letterGroup)) levers.push({
    id: FAR_PAIR_LEVER, kind: 'simplify', carrier: 'shown', pulled: pulled.includes(FAR_PAIR_LEVER),
    answers: ['other_letter', 'other_short_vowel', 'voicing_partner'],
    when: 'The learner cannot yet tell these two letters apart by sound.',
    does: 'Opens an easier practice item first: a different sound, between two letters that sound nothing alike. '
      + 'It is not graded; the full item comes back after it.',
  });
  return levers;
}
