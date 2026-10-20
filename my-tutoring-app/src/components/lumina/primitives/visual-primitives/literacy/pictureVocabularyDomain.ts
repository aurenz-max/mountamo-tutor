/**
 * picture-vocabulary's domain: the build gates, the items, the ask, the spoken key, the known misses, the scene, the
 * content gate and the harness's answers. Pure; the boss, the levers, the component, the generator and the tests read
 * the same rules.
 *
 * Five modes are one spoken word: the picture's name (naming), the opposite of the shown word, something that goes with
 * the shown thing (association), the missing word of a spoken scale, the word that finishes a spoken sentence. One mode
 * is a tap: receptive_match, where the tutor says the word and the learner taps its picture among four wordless cards
 * (a child without the word cannot pick the referent out of four, so the tap IS the receptive skill). A board item
 * (`pair_build`) is the shared pair board (`picturePairBuild.ts`); its check lives there.
 *
 * Association is an OPEN set (sock goes with shoe, foot, drawer), so its key is a RULE with the generated partner as
 * one example, never the answer: a judge handed "the answer is shoe" refuses the honest answers real children give
 * (the 2026-08-21 and 09-02 benches, `service/qa/di/associationBench.ts`). Its guards (a story is not a link; the
 * group's name, another member of it, or a kind of the thing is not a partner; a made-up word is not a thing) came
 * from those benches.
 */
import type { ResponseClassId, TeachingItem } from '../../../hooks/teachingItemContract';
import type { KnownMiss } from '../../../components/live-activity/runtime/spokenMissContract';
import type { SceneOf } from '../../../components/live-activity/bossLevers';
import type { SpokenKey } from '../../../components/live-activity/spokenKey';
import type { SupportTier } from '../../../components/live-activity/supportFact';
import type { DriverInput } from '../../../components/live-activity/liveJourneySpec';
import { validateChallengePool } from '../../../components/live-activity/adapters/adapterContract';
import { isSingleEmojiPicture } from '../../../utils/emojiPicture';
import type { PictureVocabularyData } from './PictureVocabulary';
import { ASKS, passingPairs, picturePairItemsFrom, picturePairMiss, type PicturePairItem } from './picturePairBuild';

export type PictureVocabItemKind =
  | 'receptive_match'
  | 'naming'
  | 'opposite'
  | 'association'
  | 'gradable_scale'
  | 'sentence_frame';

export interface PictureVocabTapOption {
  word: string;
  emoji: string;
  /** The kind of thing (animal, food, toy), so a wrong tap can be named against the target's. */
  category?: string;
}

/**
 * Leak rule for a spoken clue (what the thing does or where it is found): true if it says the word, a form of it,
 * or anything about its sounds or letters. A first-sound cue gives away part of the answer (handoff 22 L4).
 */
export function clueLeak(clue: string, word: string): boolean {
  const c = clue.toLowerCase(), w = word.toLowerCase().trim();
  const stem = w.replace(/(es|s)$/, '');
  if (new RegExp(`\\b${stem.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'i').test(c)) return true;
  if (/\b(starts?|begins?|ends?|sounds?|letters?|rhymes?|spell\w*|syllables?)\b/.test(c)) return true;
  if (/\/[a-z]+\//.test(c)) return true;
  const words = c.split(/\s+/).filter(Boolean);
  return words.length < 3 || words.length > 12;
}

export interface PictureVocabItem extends TeachingItem {
  kind: PictureVocabItemKind;
  /** The target word: the answer. For receptive_match, the word of the right card. */
  word: string;
  emoji: string;
  /** The lesson's support tier (default medium): when a model lever comes (`supportFact`). */
  tier: SupportTier;
  /** opposite / association: the shown prompt word (the stimulus, never the answer). */
  baseWord?: string;
  baseEmoji?: string;
  /** sentence_frame */
  frameDisplay?: string;
  frameSpoken?: string;
  /** gradable_scale */
  scaleWords?: string[];
  scaleTargetIndex?: number;
  /** receptive_match only: the emoji-only cards on screen. */
  options?: PictureVocabTapOption[];
  /** receptive_match / naming: the target's kind of thing, and a spoken clue (what it does, where it is found). */
  category?: string;
  clue?: string;
}

/** A picture board on pair_build, stamped with its mode and the lesson's tier (when the model lever comes). */
export type PictureBoard = PicturePairItem & { kind: 'pair_build'; tier: SupportTier };
export type PictureVocabularyItem = PictureVocabItem | PictureBoard;

export const isPictureBoard = (item: PictureVocabularyItem): item is PictureBoard => item.kind === 'pair_build';
export const asPictureBoard = (item: PicturePairItem, tier: SupportTier): PictureBoard => ({ ...item, kind: 'pair_build', tier });

/** The one mode whose answer is a tap the activity checks. Association left it on 2026-08-19 (item 25): it is spoken. */
export const TAP_KINDS: ReadonlySet<PictureVocabItemKind> = new Set<PictureVocabItemKind>(['receptive_match']);

export const answerKindFor = (kind: PictureVocabItemKind): 'voice' | 'gesture' =>
  TAP_KINDS.has(kind) ? 'gesture' : 'voice';

/** Association hands the judge a RULE instead of one target. */
export const isOpenSet = (kind: PictureVocabItemKind): boolean => kind === 'association';

export const responseClassFor = (kind: PictureVocabItemKind): ResponseClassId =>
  TAP_KINDS.has(kind) ? 'manipulation' : isOpenSet(kind) ? 'open_set_word' : 'short_spoken_word';

/** Structural challenge shape as the generator emits it (duck-typed so this module never imports the component's
 *  values). */
export interface PictureVocabChallengeLike {
  id: string;
  type: PictureVocabItemKind;
  word: string;
  emoji: string;
  baseWord?: string;
  baseEmoji?: string;
  frameDisplay?: string;
  frameSpoken?: string;
  scaleWords?: string[];
  scaleTargetIndex?: number;
  options?: PictureVocabTapOption[];
  category?: string;
  clue?: string;
}

/** Whole-word, case-insensitive containment (the leak oracle's shape). */
const saysWord = (haystack: string | undefined, word: string): boolean =>
  !!haystack && new RegExp(`\\b${word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(haystack);

/**
 * The build gate: an item with no defensible answer is dropped, never repaired. Dropped: a picture field that is not
 * one pictograph; a tap item whose cards do not contain the target; an opposite or association with no base word, or
 * one equal to its answer; a scale whose target rung is not at `scaleTargetIndex` or appears twice (the spoken scale
 * would say the answer); a frame with no blank, or one that says its own answer.
 */
export const itemFromChallenge = (ch: PictureVocabChallengeLike, tier: SupportTier = 'medium'): PictureVocabItem | null => {
  const word = ch.word?.trim();
  if (!word || !isSingleEmojiPicture(ch.emoji) || !ch.id) return null;

  if (TAP_KINDS.has(ch.type)) {
    const options = ch.options ?? [];
    if (options.length < 2) return null;
    if (options.some((option) => !isSingleEmojiPicture(option.emoji))) return null;
    if (!options.some((o) => o.word.trim().toLowerCase() === word.toLowerCase())) return null;
  }

  if (ch.type === 'opposite' || ch.type === 'association') {
    const base = ch.baseWord?.trim();
    if (!base || !isSingleEmojiPicture(ch.baseEmoji)) return null;
    if (base.toLowerCase() === word.toLowerCase()) return null;
  }

  if (ch.type === 'gradable_scale') {
    const words = ch.scaleWords ?? [];
    const idx = ch.scaleTargetIndex;
    if (words.length < 3 || idx === undefined || idx < 0 || idx >= words.length) return null;
    if (words[idx].trim().toLowerCase() !== word.toLowerCase()) return null;
    if (words.filter((w) => w.trim().toLowerCase() === word.toLowerCase()).length !== 1) return null;
  }

  if (ch.type === 'sentence_frame') {
    // The spoken frame is derived from `frameDisplay` (`frameSpokenFor`), so it is the only frame field that matters.
    if (!ch.frameDisplay) return null;
    if (!/_{2,}/.test(ch.frameDisplay)) return null;
    if (saysWord(ch.frameDisplay, word)) return null;
  }

  return {
    id: ch.id,
    kind: ch.type,
    answerKind: answerKindFor(ch.type),
    responseClass: responseClassFor(ch.type),
    action: ch.type,
    word,
    emoji: ch.emoji,
    tier,
    baseWord: ch.baseWord,
    baseEmoji: ch.baseEmoji,
    frameDisplay: ch.frameDisplay,
    frameSpoken: ch.frameSpoken,
    scaleWords: ch.scaleWords,
    scaleTargetIndex: ch.scaleTargetIndex,
    options: ch.options,
    // A clue that fails the leak rule is dropped here too: an older or hand-authored payload never reaches the tutor.
    ...(ch.category ? { category: ch.category } : {}),
    ...(ch.clue && !clueLeak(ch.clue, word) ? { clue: ch.clue } : {}),
  };
};

/**
 * One builder, so the component, the boss and the probes drop the same items. Session-level too: two blanks on one
 * scale give each other away (each ask speaks the other's answer), so a scale is asked once.
 */
export const itemsFromChallenges = (challenges: PictureVocabChallengeLike[], tier: SupportTier = 'medium'): PictureVocabItem[] => {
  const seenScales = new Set<string>();
  const items: PictureVocabItem[] = [];
  for (const ch of challenges) {
    const item = itemFromChallenge(ch, tier);
    if (!item) continue;
    if (item.kind === 'gradable_scale') {
      const signature = (item.scaleWords ?? []).map((w) => w.trim().toLowerCase()).join('|');
      if (seenScales.has(signature)) continue;
      seenScales.add(signature);
    }
    items.push(item);
  }
  return items;
};

const tierOf = (data: Pick<PictureVocabularyData, 'supportTier'>): SupportTier => data.supportTier ?? 'medium';

/** The session's items: the picture boards on pair_build, the word items otherwise. */
export function pictureVocabularyItems(data: PictureVocabularyData): PictureVocabularyItem[] {
  if (data.task === 'pair_build') return picturePairItemsFrom(data.pairItems ?? [], data.supportTier).map(i => asPictureBoard(i, tierOf(data)));
  return itemsFromChallenges((data.challenges ?? []) as PictureVocabChallengeLike[], tierOf(data));
}

// ── The ask ─────────────────────────────────────────────────────────────────

const cap = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);
const ensureEnd = (value: string): string => (/[.!?]$/.test(value.trim()) ? value.trim() : `${value.trim()}?`);

/** The scale spoken with the missing rung as "hmm": the stimulus spoken, the answer never. */
export const scaleSpokenFor = (item: PictureVocabItem): string =>
  (item.scaleWords ?? []).map((w, i) => (i === item.scaleTargetIndex ? 'hmm' : w)).join(', ');

/**
 * The frame SPOKEN, with the blank as "hmm", derived from `frameDisplay` in code. The generator's own `frameSpoken`
 * once cut the sentence at the blank and dropped the clause that makes the answer the only one.
 */
export const frameSpokenFor = (item: PictureVocabItem): string =>
  (item.frameDisplay ?? '')
    .replace(/_{2,}/, '... hmm ...')
    .replace(/\s*\.\.\.\s*([.?!])\s*$/, '$1')
    .trim();

const waysLine = (board: PicturePairItem) => (board.ways === 2 ? ' Then find a different pair.' : '');

/** What the learner is asked. On receptive_match the word IS the question (the picture is the answer); every other
 *  ask is answer-free: naming never says the word, opposite and association say only the base. */
export function askFor(item: PictureVocabularyItem): string {
  if (isPictureBoard(item)) return `${ASKS[item.relation]}${waysLine(item)}`;
  switch (item.kind) {
    case 'receptive_match': return `Listen: ${item.word}. Your turn. Tap the ${item.word}.`;
    case 'naming': return 'Look at the picture. Your turn. What is this?';
    case 'opposite': return `${cap(item.baseWord ?? '')}. Your turn. What is the opposite of ${item.baseWord}?`;
    case 'association': return `${cap(item.baseWord ?? '')}. Your turn. What goes with ${item.baseWord}?`;
    case 'gradable_scale': return `Listen: ${scaleSpokenFor(item)}. Your turn. What word is missing?`;
    case 'sentence_frame': return `Listen: ${ensureEnd(frameSpokenFor(item))} Your turn. Say the missing word.`;
  }
}

// ── The key ─────────────────────────────────────────────────────────────────

/** The association rule: what goes with the base, and the guards the benches proved the judge needs. */
function associationKey(item: PictureVocabItem): SpokenKey {
  const base = item.baseWord ?? '';
  return {
    answer: `any everyday thing that plainly goes with ${base}`,
    alsoAccept: [],
    acceptRule: `A thing you would use with ${base}, put on it or in it, or the place you keep it, goes with it (for `
      + `example ${item.word}); either may name the other. "${base}" goes with several things: accept one you did not `
      + 'think of, and a small mispronunciation still counts.',
    signatureError: `"${base}" said back is not it. If the link needs a story to explain it ("a cat, because cats play `
      + `with socks"), they do not go together. The name of the group ${base} belongs to, another member of that group `
      + `(an apple for a banana), ${base} under a second name (a couch for a sofa), or a kind of ${base} is not it: being `
      + `the same kind of thing, or sitting in the same place, is not going together (a glove goes with a hand, not with `
      + 'a scarf). A made-up word, or no thing at all, is not an answer.',
  };
}

/** The spoken key; null on a tap or a board (the activity checks it, and the tutor is never told the key). */
export function pictureVocabKey(item: PictureVocabularyItem): SpokenKey | null {
  if (isPictureBoard(item) || item.kind === 'receptive_match') return null;
  const w = item.word, base = item.baseWord ?? '';
  switch (item.kind) {
    case 'naming':
      return { answer: w, alsoAccept: [], acceptRule: `Another fair name for the same thing (puppy for a dog) counts.`,
        signatureError: 'A word for a whole group ("a thing", "stuff", "animal") or the name of something else is not it.' };
    case 'opposite':
      return { answer: w, alsoAccept: [], acceptRule: `Another word that truly means the opposite of ${base} counts.`,
        signatureError: `"${base}" said back, or a word that means the same as "${base}", is not it, however confident.` };
    case 'association':
      return associationKey(item);
    case 'gradable_scale': {
      const given = (item.scaleWords ?? []).filter((_, i) => i !== item.scaleTargetIndex);
      return { answer: w, alsoAccept: [], acceptRule: 'A close word for the same amount counts.',
        signatureError: `A word already on the scale (${given.join(', ')}) is not it.` };
    }
    case 'sentence_frame':
      return { answer: w, alsoAccept: [], acceptRule: 'Another word that honestly finishes the sentence counts.',
        signatureError: 'A word that does not make sense in the blank is not it.' };
  }
}

/** A spoken item's known wrong answers, in precedence order, for the `spoken_miss` observer. */
export function pictureVocabSpokenMisses(item: PictureVocabularyItem): KnownMiss[] {
  if (isPictureBoard(item) || item.answerKind === 'gesture') return [];
  const w = item.word, base = item.baseWord ?? '';
  switch (item.kind) {
    case 'opposite': return [
      { id: 'said_base_word', pattern: `The word shown is "${base}". The learner says "${base}" back, or a word that means the same, instead of its opposite.`, examples: [base] },
      { id: 'not_opposite', pattern: `The opposite of "${base}" is "${w}". The learner says a word that is neither "${w}" nor another word for it, and not "${base}".`, examples: [] },
    ];
    case 'association': return [
      { id: 'said_base_word', pattern: `The word shown is "${base}". The learner says "${base}" back instead of something that goes with it.`, examples: [base] },
      { id: 'no_link', pattern: `The learner names a real thing that does not plainly go with "${base}" (used with it, found with it, or part of it).`, examples: [] },
    ];
    case 'gradable_scale': {
      const given = (item.scaleWords ?? []).filter((_, i) => i !== item.scaleTargetIndex);
      return [
        { id: 'given_rung', pattern: `The scale already shows ${given.map(g => `"${g}"`).join(' and ')}. The learner says one of those words instead of the missing one.`, examples: given },
        { id: 'off_scale', pattern: `The missing word is "${w}". The learner says a word that does not fit between the words around the gap, such as one that is not about the same quality or is too far along the scale.`, examples: [] },
      ];
    }
    case 'sentence_frame': return [
      { id: 'does_not_fit', pattern: `The sentence is "${item.frameDisplay ?? ''}". The learner says a word that does not make sense in the blank.`, examples: [] },
    ];
    case 'naming': break;
    default: return [];
  }
  const other = w.toLowerCase() === 'button' ? 'ladder' : 'button';
  return [
    { id: 'category_word', pattern: `The picture shows a ${w}. The learner's answer is a word for a whole group of things, such as "a thing", "stuff" or "toys", not the name ${w} or another name for it.`,
      examples: ['a thing', 'stuff'] },
    { id: 'other_thing', pattern: `The picture shows a ${w}. The learner's answer names a different object, such as "${other}", that is not a ${w} and not another name for a ${w}.`,
      examples: [other] },
  ];
}

// ── The scene ───────────────────────────────────────────────────────────────

const shown = (item: PictureVocabItem): string => {
  switch (item.kind) {
    case 'receptive_match': return 'Four picture cards with no words. The activity checks the tap and tells you what was tapped.';
    case 'naming': return 'The picture only; its word appears after credit.';
    case 'opposite': return `The word ${item.baseWord} and its picture, beside an empty slot for the opposite.`;
    case 'association': return `The word ${item.baseWord} and its picture. Many answers are right; the screen names none of them.`;
    case 'gradable_scale': return `The scale with one word hidden: ${scaleSpokenFor(item)}.`;
    case 'sentence_frame': return 'The sentence with a blank; the picture of the missing word appears only after credit.';
  }
};

/** What the tutor is told about a word item, and the item's own never-say rules (contract R5). The pair board's scene
 *  is `picturePairScene` (`picturePairBuild.ts`). */
export function pictureVocabScene(item: PictureVocabItem): SceneOf {
  return { objects: [], facts: {
    shown: shown(item),
    constraints: item.kind === 'receptive_match'
      ? 'Say the word clearly: it is the question. Never say which card shows it or describe the pictures.'
      : 'Before the learner has tried, never name the picture or the answer, and never hint at its first sound, its '
        + 'letters or a rhyme; what the thing does or where it is found is fair.',
  } };
}

/** How a card tap reads to the tutor and the observer: which picture, never the key. */
export const describeCardTap = (word: string) => `Tapped the picture of ${word}.`;

/** What hear-again asks the tutor to say: the question only, never the answer. */
export const hearQuestionRequest = (item: PictureVocabItem) =>
  `The learner tapped to hear the question again. Say only this, once: "${askFor(item)}"`;

// ── The content gate ────────────────────────────────────────────────────────

/** The open build: every board must pass the pair board's own gate. */
function validatePairBuild(d: PictureVocabularyData): PictureVocabularyData {
  if (typeof d.title !== 'string' || !Array.isArray(d.pairItems) || !d.pairItems.length || d.pairItems.length > 12
      || picturePairItemsFrom(d.pairItems, d.supportTier).length !== d.pairItems.length)
    throw new Error('Generated picture vocabulary has invalid lesson content.');
  return d;
}

/** Reject an item the build would drop: cards without the target, a pair whose sides match, a scale whose blank is
 *  not the answer, a frame with no blank or one that says its own answer. */
export const validatePictureVocabularyData = (value: unknown): PictureVocabularyData =>
  (value as PictureVocabularyData)?.task === 'pair_build' ? validatePairBuild(value as PictureVocabularyData)
    : validateChallengePool<PictureVocabularyData>(value, c => !!c && itemFromChallenge(c as PictureVocabChallengeLike) !== null,
      { pool: 'Generated picture vocabulary has invalid lesson content.', item: 'A picture vocabulary item cannot be asked.' });

// ── The harness ─────────────────────────────────────────────────────────────

/** A made-up word: wrong for every association stimulus by definition (anything real might be an honest partner). */
const ASSOCIATION_NONWORD = 'blen';

/** The journey's spoken answers. Association's right answer is the generator's curated partner (a safe affirm, not the
 *  only one); its wrong answer is a nonword, the one wrong answer that holds for every stimulus. */
export function pictureVocabHarnessAnswers(item: PictureVocabItem): { correct: string; plainWrong: string } {
  if (item.kind === 'receptive_match') throw new Error('picture-vocabulary receptive_match is tapped, not said');
  const w = item.word;
  return { correct: w, plainWrong: item.kind === 'association' ? ASSOCIATION_NONWORD : w.toLowerCase() === 'button' ? 'ladder' : 'button' };
}

/** The journey's tap on receptive_match: the right card, or another card on screen. */
export function receptiveTap(right: boolean, item: PictureVocabItem): DriverInput[] {
  const wrong = (item.options ?? []).find(o => o.word.trim().toLowerCase() !== item.word.toLowerCase())?.word;
  if (!right && !wrong) throw new Error(`picture-vocabulary ${item.id}: no wrong card to tap`);
  return [{ type: 'touch', target: `card-${right ? item.word : wrong}` }];
}

/**
 * The journey's moves on a pair board, through its real pictures: wrong is the board's misconception decoy (alike /
 * same kind); right is a pair not made yet, two of them on a two-pair board. Try again keeps the tray, so it is
 * cleared first.
 */
export function pictureBoardMoves(right: boolean, board: PictureBoard, demand: Record<string, unknown> | null | undefined): DriverInput[] {
  const pick = (pair: readonly string[]): DriverInput[] => [...pair.map(w => ({ type: 'choose' as const, label: `picture ${w}` })),
    { type: 'choose', label: "I'm done!" }];
  const clear: DriverInput[] = Number(demand?.picturesInTray ?? 0) > 0 ? [{ type: 'choose', label: 'Clear' }] : [];
  if (!right) {
    const want = board.relation === 'opposite' ? 'alike' : 'same_kind';
    const decoy = board.board.flatMap((a, i) => board.board.slice(i + 1).map(b => [a, b]))
      .find(p => picturePairMiss(p, [], board.relation) === want);
    if (!decoy) throw new Error(`picture-vocabulary pair_build ${board.id}: no ${want} decoy on the board`);
    return [...clear, ...pick(decoy)];
  }
  const made = String(demand?.madeBefore ?? '').split('; ').filter(m => m && m !== 'none').map(m => m.split(' and ').sort().join('+'));
  const left = passingPairs(board.board, board.relation).filter(p => !made.includes(p)).map(p => p.split('+'));
  const need = Math.max(1, board.ways - made.length);
  if (left.length < need) throw new Error(`picture-vocabulary pair_build ${board.id}: ${left.length} right pairs left, ${need} needed`);
  return [...clear, ...left.slice(0, need).flatMap(pick)];
}
