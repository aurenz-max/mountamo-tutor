/**
 * The in-item levers on letter-sound-link (`/add-support-tiers`), as one lever set (`bossLevers.ts`):
 * keyword_under_both is a `legend` (a picture under both cards alike, none marked), pair_model, voice_feel_model and
 * letter_model are `model` levers (another letter or pair, solved), far_letter_pair is `easier`.
 * `hear-see` (handoff 22 L1): the tutor says a sound and the learner taps one of two letters. The spoken modes
 * (handoff 24) are at the end of this header.
 *
 * Pure: the component draws from these, the workspace publishes them, and the tests hold each leak rule.
 * - `keyword_under_both` (help): a keyword picture under BOTH letter cards, alike. Answers `other_short_vowel`
 *   and `other_letter`. Leak rules: both pictures or neither (one alone marks a card); both must read as their
 *   word; neither letter nor keyword may come up in a later item, which would then be told (contract R4).
 * - `voice_feel_model` (help): a quiet and a buzzing sound on two pictures, no letters (snake "sss", bee "zzz").
 *   Answers `voicing_partner`, only on a voicing-pair item. Leak rule: never the item's own pair.
 * - `pair_model` (help, both): two OTHER letter cards beside the item, each with its keyword picture, of the same
 *   sound kinds as the item's two cards, and the tutor says each model sound. The parallel-item model for
 *   `other_letter` / `other_short_vowel` where `keyword_under_both` is refused (a later item uses a card letter, or a
 *   card is `i`). A group-1 session uses every group letter, so the model may come from outside the group, as
 *   `letter_model` does. Leak rule (`pairModelLeak`): no session letter, keyword or picture; kinds match the item's
 *   as a set, so the model marks neither card.
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
import { leverSet } from '../../../components/live-activity/bossLevers';
import { LETTER_GROUPS, normalizeLetterGroup } from '../../../service/literacy/letterGroups';
import { letterSoundLinkCard } from './letterSoundLink.card';
import { canProduceSound, evalModeOf, itemFromChallenge, isClippedSound, keywordFor, keywordNamesItsPicture, emojiForKeyword,
  spokenSoundFor, type LetterSoundItem } from './letterSoundLinkDomain';

export const KEYWORDS_LEVER = 'keyword_under_both';
export const VOICE_LEVER = 'voice_feel_model';
export const FAR_PAIR_LEVER = 'far_letter_pair';
export const LETTER_MODEL_LEVER = 'letter_model';
export const PAIR_MODEL_LEVER = 'pair_model';

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

/** Two letters never paired in a model: one shared sound (c/k), or a mirror pair a K learner confuses (b/d). */
const BAD_MODEL_PAIRS = [['c', 'k'], ['b', 'd']];
const kindsOf = (letters: readonly string[]) => letters.map(soundKind).sort().join('+');

/** Leak rule for the pair model: true when a model letter, keyword or picture is a session one, or the model's sound
 *  kinds are not the item's (a vowel model beside a vowel/consonant item would mark the vowel card). */
export const pairModelLeak = (pair: readonly LetterModel[], item: LetterSoundItem, items: readonly LetterSoundItem[]) =>
  pair.length !== 2 || pair[0].letter === pair[1].letter || pair.some(m => letterModelLeak(m, items))
  || kindsOf(pair.map(m => m.letter)) !== kindsOf(optionLetters(item))
  || BAD_MODEL_PAIRS.some(([x, y]) => pair.some(m => m.letter === x) && pair.some(m => m.letter === y));

/** The model pair for a hear-see item: in-group letters first, then any that pass. Null if none passes. */
export function pairModelFor(item: LetterSoundItem, items: readonly LetterSoundItem[], letterGroup: number | undefined): LetterModel[] | null {
  if (item.mode !== 'hear-see' || item.options.length !== 2) return null;
  const group = LETTER_GROUPS[normalizeLetterGroup(letterGroup) ?? 4].filter(l => l.length === 1);
  const ordered = [...EASY_FIRST.filter(l => group.includes(l)), ...EASY_FIRST.filter(l => !group.includes(l))];
  const model = (l: string): LetterModel => ({ letter: l, sound: spokenSoundFor(l, `/${l}/`), word: keywordFor(l), emoji: emojiForKeyword(keywordFor(l)) });
  const candidates = ordered.filter(l => canProduceSound(l) && keywordNamesItsPicture(l)).map(model);
  const [k1, k2] = optionLetters(item).map(soundKind);
  for (const a of candidates.filter(m => soundKind(m.letter) === k1)) {
    for (const b of candidates.filter(m => soundKind(m.letter) === k2)) {
      const pair = [a, b].sort((x, y) => x.letter.localeCompare(y.letter));
      if (!pairModelLeak(pair, item, items)) return pair;
    }
  }
  return null;
}

/** What the lever set reads beyond the item: the session's items (leak rules, R4) and the letter group. */
export interface LetterSoundLeverContext { items: readonly LetterSoundItem[]; letterGroup?: number }

const later = (item: LetterSoundItem, ctx: LetterSoundLeverContext) =>
  laterStimuli(ctx.items, ctx.items.findIndex(i => i.id === item.id));
const MODEL_SAY = (m: LetterModel, picture: boolean) => `${m.letter.toUpperCase()}${picture ? `, beside its picture (${m.word})` : ''}`;
const HEAR_SEE_WHEN = 'The learner taps the wrong letter, not a voicing partner.';

export const LETTER_SOUND_LEVERS = leverSet<LetterSoundItem, LetterSoundLeverContext>({
  modeOf: evalModeOf,
  missesOf: mode => letterSoundLinkCard.modes[mode].misses,
  // The model levers show another letter, solved; the tier says when (items carry the lesson's tier).
  support: { tier: item => item.tier,
    different: item => (item.mode === 'hear-see' ? 'other letters the session never uses' : 'another letter the session never uses'),
    own: item => (item.mode === 'hear-see' ? 'which letter makes this sound' : 'this letter\'s sound') },
  specs: [
    // hear_see
    { id: KEYWORDS_LEVER, type: 'legend', modes: ['hear_see'], answers: ['other_short_vowel', 'other_letter'],
      when: HEAR_SEE_WHEN,
      does: 'Puts a keyword picture under each of the two letter cards, alike. Do not name either picture.',
      content: (item, ctx) => (cardKeywords(item, later(item, ctx)).length ? true : null),
      fact: 'A keyword picture sits under each of the two letter cards, alike.' },
    { id: PAIR_MODEL_LEVER, type: 'model', modes: ['hear_see'], answers: ['other_short_vowel', 'other_letter'],
      when: HEAR_SEE_WHEN,
      // The model letters are named only in the scene fact once pulled (the letter_model lesson).
      does: 'Shows two other letter cards, each with its picture, beside the item. Once they are on screen, say each '
        + "one's sound once. They are not this item's letters; do not say which card on the item matches.",
      content: (item, ctx) => pairModelFor(item, ctx.items, ctx.letterGroup),
      fact: (pair: LetterModel[]) => `A model pair beside the cards, two other letters with their pictures: ${pair.map(m =>
        `${m.letter.toUpperCase()} (${m.word}), sound ${m.sound}`).join(' and ')}. They are not this item's letters.` },
    { id: VOICE_LEVER, type: 'model', modes: ['hear_see'], answers: ['voicing_partner'],
      when: 'The learner taps the letter whose sound differs only by the voice being on or off.',
      does: item => {
        const model = voiceModelFor(item);
        return `Shows a quiet sound and a buzzing sound on two pictures, a ${model?.quiet.word} (${model?.quiet.sound}) and a `
          + `${model?.buzz.word} (${model?.buzz.sound}), with a hand on the throat. Say both sounds so the learner feels `
          + 'the buzz; they are not this item\'s sounds.';
      },
      content: item => voiceModelFor(item),
      fact: (model: VoiceModel) => `A quiet sound and a buzzing sound sit on two pictures: a ${model.quiet.word} `
        + `(${model.quiet.sound}) and a ${model.buzz.word} (${model.buzz.sound}), with a hand on the throat.` },
    { id: FAR_PAIR_LEVER, type: 'easier', modes: ['hear_see'], carrier: 'shown',
      answers: ['other_letter', 'other_short_vowel', 'voicing_partner'],
      when: 'The learner cannot yet tell these two letters apart by sound.',
      does: 'Opens an easier practice item first: a different sound, between two letters that sound nothing alike. '
        + 'It is not graded; the full item comes back after it.',
      content: (item, ctx) => fartherPair(item, ctx.items, ctx.letterGroup) },
    // see_hear and keyword_match: the model letter is named only in the scene fact once pulled (letter-spotter
    // replay 09-29: named in `does`, the tutor spoke of the model before any pull).
    { id: LETTER_MODEL_LEVER, type: 'model', modes: ['see_hear'], answers: ['letter_name', 'keyword_word', 'added_vowel'],
      when: 'The learner says the letter name, a whole word, or the sound with a vowel after it.',
      does: 'Shows another letter. Once it is on screen, say its sound once, on its own. It is not this item\'s letter.',
      content: (item, ctx) => letterModelFor(item, ctx.items, ctx.letterGroup),
      fact: (m: LetterModel) => `A model on another letter, ${MODEL_SAY(m, false)}: its sound is ${m.sound}. It is not this item's letter.` },
    { id: LETTER_MODEL_LEVER, type: 'model', modes: ['keyword_match'], answers: ['other_picture', 'letter_name', 'said_the_sound'],
      when: 'The learner says the other picture, the letter name, or the sound with no picture word.',
      does: 'Shows another letter beside its picture. Once it is on screen, say its sound, then the picture word that '
        + 'starts with it. It is not this item\'s letter.',
      content: (item, ctx) => letterModelFor(item, ctx.items, ctx.letterGroup),
      fact: (m: LetterModel) => `A model on another letter, ${MODEL_SAY(m, true)}: its sound is ${m.sound}, and ${m.word} `
        + 'starts with it. It is not this item\'s letter.' },
  ],
});
