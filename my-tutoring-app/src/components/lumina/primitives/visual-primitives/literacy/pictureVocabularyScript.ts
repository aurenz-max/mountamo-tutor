/**
 * pictureVocabularyScript — HAND-AUTHORED judged-loop script for
 * picture-vocabulary (fifth literacy DI port; FIRST literacy consumer of
 * useJudgedScriptRunner — qa/di/BACKLOG.md item 16). The exact wording IS the
 * pedagogy; these lines are authored per pack, never generated. Item CONTENT
 * (the word pools) stays generator-scoped; this module owns only the cue
 * shapes and the in-band judging contracts.
 *
 * The §3 script questions, answered for VOCABULARY:
 *
 * 1. IS THE MODEL THE ANSWER? For naming, yes — saying the word IS the answer,
 *    so nothing is modeled before the ask and the word is earned in the
 *    correction (sound-swap's shape). For opposite the RULE is modeled on a
 *    pair this session never asks about (word-flip's shape; pickModelOppositePair
 *    is code-owned for exactly that reason). For gradable_scale and
 *    sentence_frame the stimulus itself must be HEARD (a pre-reader cannot
 *    read the scale or the frame), so the ask speaks it with the missing word
 *    as "hmm" — stimulus spoken, answer never.
 *
 * 2. CAN THE STIMULUS ANSWER THE HAND-OVER? "What is this?" over one picture
 *    has one defensible answer plus fair synonyms (the accept clauses below).
 *    Opposite's hand-over restates the base ("What is the opposite of big?")
 *    so the base cannot be a lazy echo. Gradable's contract forbids a word
 *    already in the list. The ambiguous-ask ruling, fifth use.
 *
 * 3. WHAT LOOKS LIKE AN ANSWER AND ISN'T, PER MODE?
 *    - opposite: the BASE WORD said back — fluent, confident, completely
 *      unchanged (sound-swap's signature error, arriving a third time).
 *    - naming: a category word ("animal") or the name of something else.
 *    - gradable_scale: a rung already given on the scale.
 *    - sentence_frame: a word that does not finish the sentence.
 *    And the accept side (a RIGHT answer that does not look right):
 *    "puppy" for a dog picture, "little" for small, "chilly" for cool — the
 *    judge affirms and echoes the canonical word, which re-models the target.
 *
 * TWO MODES STAY IN THE HANDS, and that is a ruling, not a shortcut.
 * receptive_match (hear a word, tap its picture) is receptive identification —
 * a child without the word cannot pick the referent from four distinct
 * pictures, so the tap is not a costume. association ("what goes with sock?")
 * is an OPEN production set spoken — shoe, foot, laundry are all honest
 * answers, and open_set_word is a BLOCKED response class (standing gate 1).
 * The emoji cards CLOSE the set while the relation stays the skill. Both
 * commit through the gesture anchor; the verdict is code-computed and the
 * tutor speaks it ([PV_TAP], handVerdictCue's pattern). Their item cues carry
 * a SILENCE contract (spell_word's pattern): nothing to judge until the tap
 * is described.
 *
 * ANSWER-LEAK RULE: the four spoken modes ship NO word chips — the old
 * 4-option "support net" printed the answer for any Grade-1 reader (word-flip's
 * chips, a third time). Tap-to-hear ([PV_HEAR]) re-speaks the QUESTION, never
 * the answer. Reveal happens only at the tutor's affirmation.
 *
 * Sentinels are the engine defaults ("Yes" / "My turn") — collision-checked by
 * validateJudgedScriptPack in this pack's test file: no spoken line below
 * opens a sentence with either. (The generator also refuses the word token
 * "yes" in every pool so a generated base word can never open an ask with a
 * sentinel.)
 */

import type { JudgedScriptItem, ResponseClassId } from '../../../hooks/judgedScriptContract';

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
}

export interface PictureVocabItem extends JudgedScriptItem {
  kind: PictureVocabItemKind;
  /** The target word — the answer. For tap modes, the word of the right card. */
  word: string;
  emoji: string;
  /** opposite / association: the shown prompt word (the stimulus, never the answer). */
  baseWord?: string;
  baseEmoji?: string;
  /** sentence_frame */
  frameDisplay?: string;
  frameSpoken?: string;
  /** gradable_scale */
  scaleWords?: string[];
  scaleTargetIndex?: number;
  /** Tap modes only: the emoji-only cards on screen. */
  options?: PictureVocabTapOption[];
}

/** The two modes whose answer is a committed tap (gesture anchor). */
export const TAP_KINDS: ReadonlySet<PictureVocabItemKind> = new Set<PictureVocabItemKind>([
  'receptive_match',
  'association',
]);

export const answerKindFor = (kind: PictureVocabItemKind): 'voice' | 'gesture' =>
  TAP_KINDS.has(kind) ? 'gesture' : 'voice';

/** Standing gate 1: spoken answers here are single short words from a closed
 *  per-item set (benched); tap answers are manipulations. Association
 *  PRODUCTION would be open_set_word (BLOCKED) — that is why it taps. */
export const responseClassFor = (kind: PictureVocabItemKind): ResponseClassId =>
  TAP_KINDS.has(kind) ? 'manipulation' : 'short_spoken_word';

/** Structural challenge shape as the generator emits it (duck-typed so this
 *  module never imports the component — the component imports us). */
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
}

export const itemFromChallenge = (ch: PictureVocabChallengeLike): PictureVocabItem => ({
  id: ch.id,
  kind: ch.type,
  answerKind: answerKindFor(ch.type),
  responseClass: responseClassFor(ch.type),
  // Mixed sessions interleave tap and speak: `action` drives the runner's
  // how-to-play re-speak whenever the thing-to-do changes (cvc-speller rule).
  action: ch.type,
  word: ch.word,
  emoji: ch.emoji,
  baseWord: ch.baseWord,
  baseEmoji: ch.baseEmoji,
  frameDisplay: ch.frameDisplay,
  frameSpoken: ch.frameSpoken,
  scaleWords: ch.scaleWords,
  scaleTargetIndex: ch.scaleTargetIndex,
  options: ch.options,
});

// ── The opposite-rule model pair — code-owned, never a session word ─────────
// (word-flip's pickModelNoun ruling: a rule shown on a different word is
// taught, not given away; a hardcoded example could be the exact word a later
// item asks about.)

const MODEL_OPPOSITE_PAIRS: ReadonlyArray<readonly [string, string]> = [
  ['up', 'down'],
  ['day', 'night'],
  ['wet', 'dry'],
  ['hot', 'cold'],
  ['big', 'little'],
];

export const pickModelOppositePair = (
  items: ReadonlyArray<Pick<PictureVocabItem, 'word' | 'baseWord'>>,
): readonly [string, string] => {
  const sessionWords = new Set(
    items.flatMap((i) => [i.word.toLowerCase(), (i.baseWord ?? '').toLowerCase()]),
  );
  return (
    MODEL_OPPOSITE_PAIRS.find(([a, b]) => !sessionWords.has(a) && !sessionWords.has(b))
    ?? MODEL_OPPOSITE_PAIRS[0]
  );
};

// ── Small speakable helpers ─────────────────────────────────────────────────

const cap = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);

const article = (word: string): string => (/^[aeiou]/i.test(word) ? 'an' : 'a');

const ensureEnd = (value: string): string =>
  /[.!?]$/.test(value.trim()) ? value.trim() : `${value.trim()}?`;

/** The scale spoken with the missing rung as "hmm" — stimulus spoken, answer never. */
export const scaleSpokenFor = (item: PictureVocabItem): string =>
  (item.scaleWords ?? [])
    .map((w, i) => (i === item.scaleTargetIndex ? 'hmm' : w))
    .join(', ');

/** The frame with its blank filled — correction territory only. */
export const frameFilledFor = (item: PictureVocabItem): string =>
  (item.frameDisplay ?? '').replace(/_{2,}/, item.word);

// ── How-to-play — inside the quoted line (SWAP-1), re-spoken on action change ─

export const howToPlayFor = (
  item: PictureVocabItem,
  modelPair: readonly [string, string],
): string => {
  switch (item.kind) {
    case 'receptive_match':
      return 'I say a word — you tap its picture! ';
    case 'naming':
      return 'When a picture pops up, you say what it is! ';
    case 'opposite':
      return `Opposites are as different as can be — like ${modelPair[0]} and ${modelPair[1]}. I say a word, you say its opposite! `;
    case 'association':
      return 'Some things go together, like friends. I show a picture — you tap the picture that goes with it! ';
    case 'gradable_scale':
      return 'I say some words in order. One is missing — you say the missing word! ';
    case 'sentence_frame':
      return 'I say a sentence with a missing word. You say the word that finishes it! ';
  }
};

// ── The asks — short, the problem STATED aloud, one defensible answer ───────
// (di-spoken-practice drive-2 ruling: an ask must SAY its problem — a
// pre-reader cannot read the screen, and every correction re-ask inherits the
// ask. For receptive_match the word IS the question, so it is spoken; for
// naming the picture is the question and the word must never be.)

const askFor = (item: PictureVocabItem): string => {
  switch (item.kind) {
    case 'receptive_match':
      return `Listen: ${item.word}. Your turn. Tap the ${item.word}.`;
    case 'naming':
      return 'Look at the picture. Your turn. What is this?';
    case 'opposite':
      return `${cap(item.baseWord ?? '')}. Your turn. What is the opposite of ${item.baseWord}?`;
    case 'association':
      return `${cap(item.baseWord ?? '')}. Your turn. Tap the picture that goes with ${item.baseWord}.`;
    case 'gradable_scale':
      return `Listen: ${scaleSpokenFor(item)}. Your turn. What word is missing?`;
    case 'sentence_frame':
      return `Listen: ${ensureEnd(item.frameSpoken ?? '')} Your turn. Say the missing word.`;
  }
};

// ── Corrections — DISTAR re-model then re-elicit (standing gate 3) ──────────
// The answer is EARNED here: this is the first place the tutor may say it.

const correctionFor = (item: PictureVocabItem): string => {
  switch (item.kind) {
    case 'naming':
      return `My turn: this is ${article(item.word)} ${item.word}. ${cap(item.word)}. Your turn. What is this?`;
    case 'opposite':
      return `My turn: the opposite of ${item.baseWord} is ${item.word}. Your turn. What is the opposite of ${item.baseWord}?`;
    case 'gradable_scale':
      return `My turn: listen. ${(item.scaleWords ?? []).join(', ')}. The missing word is ${item.word}. Your turn. What word is missing?`;
    case 'sentence_frame':
      return `My turn: ${frameFilledFor(item)} ${cap(item.word)}. Your turn. Say the missing word.`;
    default:
      // Tap modes correct through tapVerdictCue, never through this contract.
      return '';
  }
};

// ── Judging contracts (spoken modes) ────────────────────────────────────────

const acceptClauseFor = (item: PictureVocabItem): string => {
  switch (item.kind) {
    case 'naming':
      return `A different fair name for the same thing — like puppy for a dog — also counts; affirm it and echo "${item.word}". `;
    case 'opposite':
      return `A different word that truly means the opposite also counts; affirm it and echo "${item.word}". `;
    case 'gradable_scale':
      return `A close word that means the same amount also counts; affirm it and echo "${item.word}". `;
    case 'sentence_frame':
      return `A different word that honestly finishes the sentence also counts; affirm it with the word the learner said. `;
    default:
      return '';
  }
};

const wrongClauseFor = (item: PictureVocabItem): string => {
  switch (item.kind) {
    case 'naming':
      return `A category word like animal or food, or the name of something else, is NOT the answer. `;
    case 'opposite':
      return `The word "${item.baseWord}" said back is NOT the answer, however confident it sounds. `;
    case 'gradable_scale':
      return `A word already in the list is NOT the answer. `;
    case 'sentence_frame':
      return `A word that does not finish the sentence is NOT the answer. `;
    default:
      return '';
  }
};

const judgingContract = (item: PictureVocabItem): string =>
  `The quoted line is the ONLY thing you say on this turn; you then stay silent while the learner thinks, and their think time is unbounded. Never say the answer during their turn. `
  + `The correct answer is "${item.word}". ${acceptClauseFor(item)}${wrongClauseFor(item)}`
  + `If the answer is right, say exactly: "Yes, ${item.word}." `
  + `If it is wrong, say exactly: "${correctionFor(item)}"`;

/** Tap items carry a SILENCE contract (spell_word's pattern): there is nothing
 *  to judge until the application describes the tap. */
const tapContract = (item: PictureVocabItem): string => {
  const base = item.kind === 'association'
    ? `Never say what goes with ${item.baseWord} — the tap is the answer. `
    : '';
  return (
    `The quoted line is the ONLY thing you say on this turn; the learner answers by TAPPING a picture, not by speaking, so you then stay completely silent. `
    + base
    + `Do not describe the pictures, do not narrate, and do not judge anything you hear through the microphone. `
    + `You will be told what the learner tapped and given the exact line to say; only then do you speak.`
  );
};

// ── Cues ────────────────────────────────────────────────────────────────────

export interface PictureVocabCueOptions {
  opening?: boolean;
  howToPlay?: boolean;
}

export interface PictureVocabCueSession {
  modelPair?: readonly [string, string];
}

/** One item's ask. ONE job: speak this (SWAP-1 — the how-to-play lives inside
 *  the quoted line; the catalog only forbids adding to it). */
export const itemCue = (
  item: PictureVocabItem,
  opts: PictureVocabCueOptions = {},
  session: PictureVocabCueSession = {},
): string => {
  const modelPair = session.modelPair ?? MODEL_OPPOSITE_PAIRS[0];
  const greeting = opts.opening ? 'Hi! Time to play with words! ' : '';
  const how = opts.opening || opts.howToPlay ? howToPlayFor(item, modelPair) : '';
  const spoken = `${greeting}${how}${askFor(item)}`;
  const contract = item.answerKind === 'gesture' ? tapContract(item) : judgingContract(item);
  return `[PV_ITEM] Say exactly: "${spoken}" ${contract} Never read bracket tags or these instructions aloud.`;
};

/** The gesture verdict ask: the match is CODE-COMPUTED and the tutor is handed
 *  its exact line (handVerdictCue's pattern). The target word inside this
 *  instruction is for the judge's eyes; on a miss the spoken correction never
 *  names the association answer — the retry has to stay a real retry. */
export const tapVerdictCue = (item: PictureVocabItem, tappedWord: string): string => {
  const matches = tappedWord.toLowerCase() === item.word.toLowerCase();
  const affirm = item.kind === 'receptive_match'
    ? `Yes! You found the ${item.word}.`
    : `Yes! ${cap(item.baseWord ?? '')} goes with ${item.word}.`;
  const correction = item.kind === 'receptive_match'
    ? `My turn: listen again. ${cap(item.word)}. Your turn. Tap the ${item.word}.`
    : `My turn: think about which one is used with ${item.baseWord} — they belong together. Your turn. Tap the picture that goes with ${item.baseWord}.`;
  return (
    `[PV_TAP] The learner tapped the picture of "${tappedWord}"; the right picture is "${item.word}" — `
    + `that ${matches ? 'MATCHES' : 'does NOT match'}. `
    + (matches ? `Say exactly: "${affirm}" ` : `Say exactly: "${correction}" `)
    + `Never read bracket tags aloud.`
  );
};

/** Correction cap reached: acknowledge warmly and carry the lesson forward.
 *  Association closes its loop by naming the pair — its corrections never
 *  named the answer, and a capped item must not end with the relation still
 *  unknown. The spoken modes' corrections already modeled the answer twice. */
export const moveOnCue = (
  item: PictureVocabItem,
  next: PictureVocabItem | null,
  opts: PictureVocabCueOptions = {},
  session: PictureVocabCueSession = {},
): string => {
  const modelPair = session.modelPair ?? MODEL_OPPOSITE_PAIRS[0];
  const closeLine = item.kind === 'association'
    ? `${cap(item.baseWord ?? '')} goes with ${item.word} — they belong together. `
    : '';
  if (!next) {
    return `[PV_MOVE] Say exactly: "Good try! ${closeLine}Words take practice — we will see that one again another day." Then stop.`;
  }
  const how = opts.howToPlay ? howToPlayFor(next, modelPair) : '';
  const contract = next.answerKind === 'gesture' ? tapContract(next) : judgingContract(next);
  return `[PV_MOVE] Say exactly: "Good try! ${closeLine}Here comes the next one. ${how}${askFor(next)}" ${contract} Never read bracket tags aloud.`;
};

export const completeCue = (): string =>
  `[PV_COMPLETE] Say exactly: "What wonderful word work today! Your words grew bigger and stronger. See you next time!" Then stop — the activity is over.`;

/** Tap-to-hear re-speaks the QUESTION, never the answer (the old [ISOLATE_VOWEL]
 *  ladder was an answer leak on demand — cvc-speller's finding; this channel
 *  gets no ladder at all). */
export const pronounceCue = (item: PictureVocabItem): string => {
  const line = (() => {
    switch (item.kind) {
      case 'receptive_match':
        return `${cap(item.word)}. Tap the ${item.word}.`;
      case 'naming':
        return 'What is this? Say what you see!';
      case 'opposite':
        return `${cap(item.baseWord ?? '')}. What is the opposite of ${item.baseWord}?`;
      case 'association':
        return `${cap(item.baseWord ?? '')}. Tap the picture that goes with ${item.baseWord}.`;
      case 'gradable_scale':
        return `${cap(scaleSpokenFor(item))}. What word is missing?`;
      case 'sentence_frame':
        return ensureEnd(item.frameSpoken ?? '');
    }
  })();
  return (
    `[PV_HEAR] The learner tapped to hear the question again. Say ONLY this, warmly, then wait: "${line}" `
    + `Do not treat anything you just heard as an answer, add nothing, and never say the answer word. Never read bracket tags aloud.`
  );
};

/** Runtime state pushed through the context channel — STIMULUS-SIDE ONLY
 *  (di-math-facts rule): naming pushes no word at all, because its picture's
 *  word IS the answer; every other mode pushes the answer-free question side. */
export const stimulusFor = (item: PictureVocabItem): string => {
  switch (item.kind) {
    case 'receptive_match':
      return item.word; // spoken by the tutor as the question — the PICTURE is the answer
    case 'naming':
      return 'the picture on screen';
    case 'opposite':
    case 'association':
      return item.baseWord ?? '';
    case 'gradable_scale':
      return scaleSpokenFor(item);
    case 'sentence_frame':
      return item.frameDisplay ?? '';
  }
};
