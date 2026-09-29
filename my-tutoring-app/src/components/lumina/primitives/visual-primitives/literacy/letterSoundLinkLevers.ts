/**
 * The in-item levers on letter-sound-link `hear-see` (`/add-support-tiers`, handoff 22 L1): the tutor says a
 * sound and the learner taps one of two letters. The spoken modes join L2.
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
 */
import type { WorkspaceLever } from '../../../components/live-activity/runtime/contract';
import { LETTER_GROUPS, normalizeLetterGroup } from '../../../service/literacy/letterGroups';
import { canProduceSound, itemFromChallenge, keywordFor, keywordNamesItsPicture, emojiForKeyword,
  type LetterSoundItem } from './letterSoundLinkDomain';

export const KEYWORDS_LEVER = 'keyword_under_both';
export const VOICE_LEVER = 'voice_feel_model';
export const FAR_PAIR_LEVER = 'far_letter_pair';

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

/** The levers this item declares, with their state. Empty off `hear-see`. */
export function letterSoundLevers(item: LetterSoundItem | null, pulled: readonly string[], items: readonly LetterSoundItem[],
  index: number, letterGroup: number | undefined): WorkspaceLever[] {
  if (!item || item.mode !== 'hear-see') return [];
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
