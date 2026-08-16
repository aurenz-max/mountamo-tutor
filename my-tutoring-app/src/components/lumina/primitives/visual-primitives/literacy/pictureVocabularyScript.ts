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

import type {
  JudgedCueSurface,
  JudgedScriptItem,
  ResponseClassId,
} from '../../../hooks/judgedScriptContract';

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

/** Whole-word, case-insensitive containment — the same shape the leak oracle
 *  uses, so a gate here and a HIGH there cannot disagree about what "contains
 *  the answer" means. */
const saysWord = (haystack: string | undefined, word: string): boolean =>
  !!haystack && new RegExp(`\\b${word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(haystack);

/**
 * The build gate this port did not have.
 *
 * Every drop is an ask with NO DEFENSIBLE ANSWER, which is a broken item rather
 * than a hard one, and each shape below has a specific way of failing the child:
 *
 *  - a tap mode whose cards do not contain the target — the tap can never match,
 *    so the child is corrected to the cap for answering correctly;
 *  - an `opposite`/`association` with no base word — the ask renders "the
 *    opposite of undefined", and every correction re-ask inherits it;
 *  - a scale whose target rung is not at `scaleTargetIndex`, or appears twice —
 *    `scaleSpokenFor` then either blanks the wrong rung or SPEAKS the answer
 *    while asking for it;
 *  - a frame with no blank — `frameFilledFor` returns the sentence unchanged, so
 *    the correction never models the word in place;
 *  - a frame or an opposite whose ask contains the target word — the generator
 *    already forbids this ("NEITHER may contain the target word") but nothing
 *    enforced it at the boundary the runner reads.
 *
 * Returns null rather than repairing: an unaskable item is never backfilled, so
 * a high drop rate is a GENERATOR finding surfaced by `droppedChallenges`.
 */
export const itemFromChallenge = (ch: PictureVocabChallengeLike): PictureVocabItem | null => {
  const word = ch.word?.trim();
  if (!word || !ch.emoji?.trim() || !ch.id) return null;

  if (TAP_KINDS.has(ch.type)) {
    const options = ch.options ?? [];
    if (options.length < 2) return null;
    if (!options.some((o) => o.word.trim().toLowerCase() === word.toLowerCase())) return null;
  }

  if (ch.type === 'opposite' || ch.type === 'association') {
    const base = ch.baseWord?.trim();
    if (!base) return null;
    // A pair whose two sides are the same word asks for what it just said.
    if (base.toLowerCase() === word.toLowerCase()) return null;
  }

  if (ch.type === 'gradable_scale') {
    const words = ch.scaleWords ?? [];
    const idx = ch.scaleTargetIndex;
    if (words.length < 3 || idx === undefined || idx < 0 || idx >= words.length) return null;
    if (words[idx].trim().toLowerCase() !== word.toLowerCase()) return null;
    // The blanked rung must be the ONLY occurrence, or the spoken scale says
    // the missing word aloud on another rung.
    if (words.filter((w) => w.trim().toLowerCase() === word.toLowerCase()).length !== 1) return null;
  }

  if (ch.type === 'sentence_frame') {
    // `frameDisplay` is the ONLY frame field that matters now — the spoken form
    // is derived from it (`frameSpokenFor`), so a missing or truncated
    // `frameSpoken` can no longer reach the child.
    if (!ch.frameDisplay) return null;
    if (!/_{2,}/.test(ch.frameDisplay)) return null;
    if (saysWord(ch.frameDisplay, word)) return null;
  }

  return {
    id: ch.id,
    kind: ch.type,
    answerKind: answerKindFor(ch.type),
    responseClass: responseClassFor(ch.type),
    // Mixed sessions interleave tap and speak: `action` drives the runner's
    // how-to-play re-speak whenever the thing-to-do changes (cvc-speller rule).
    action: ch.type,
    word,
    emoji: ch.emoji,
    baseWord: ch.baseWord,
    baseEmoji: ch.baseEmoji,
    frameDisplay: ch.frameDisplay,
    frameSpoken: ch.frameSpoken,
    scaleWords: ch.scaleWords,
    scaleTargetIndex: ch.scaleTargetIndex,
    options: ch.options,
  };
};

/**
 * ONE builder, so the component and the DI harness drop the same items.
 *
 * SESSION-LEVEL, not just per item, because one gradable_scale ask can give
 * another one away. A live drive drew `quiet/soft/loud/noisy` twice — item 1
 * blanked "loud" and therefore ASKED "quiet, soft, hmm, noisy", speaking item
 * 5's answer, while item 5 asked "quiet, hmm, loud, noisy" and spoke item 1's.
 * Two blanks on one scale make each other free: the second is recall, not
 * gradient reasoning.
 *
 * The generator no longer pads by re-blanking a used scale, so this is the
 * boundary guard for everything else that can reach the runner — a hand-authored
 * payload, an older cached one, or a future generator change. The per-item gate
 * cannot see it: nothing is wrong with either item ALONE.
 */
export const itemsFromChallenges = (
  challenges: PictureVocabChallengeLike[],
): PictureVocabItem[] => {
  const seenScales = new Set<string>();
  const items: PictureVocabItem[] = [];

  for (const ch of challenges) {
    const item = itemFromChallenge(ch);
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

/**
 * The frame SPOKEN, with the blank as "hmm" — derived from `frameDisplay` in
 * code, exactly the way `scaleSpokenFor` derives the spoken scale.
 *
 * It used to speak the generator's separate `frameSpoken` field, and the probe
 * caught what that field actually contained: the sentence TRUNCATED AT THE
 * BLANK. "Turn on the ____ when it gets dark." was spoken as "Turn on the...
 * hmm... what?", and "Look at the ____ to see what time it is." as "Look at
 * the... hmm... what?" — so the clause that makes `lamp` and `clock` the one
 * defensible answer was dropped from the only channel a pre-reader has. Four of
 * five asks in one probe had no decidable answer, and the child would be
 * CORRECTED for saying "light" or "book".
 *
 * The mode is vocabulary IN CONTEXT; the context is precisely the tail that was
 * being cut. So the LLM supplies the sentence and CODE builds the spoken form —
 * one source of truth, and the ask can no longer disagree with the correction
 * (which always did read the whole sentence).
 */
export const frameSpokenFor = (item: PictureVocabItem): string =>
  (item.frameDisplay ?? '')
    .replace(/_{2,}/, '... hmm ...')
    // A blank at the END leaves "We sit on a ... hmm ...." — the trailing
    // ellipsis and the sentence's own full stop collide. Keep the punctuation.
    .replace(/\s*\.\.\.\s*([.?!])\s*$/, '$1')
    .trim();

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
      return `Listen: ${ensureEnd(frameSpokenFor(item))} Your turn. Say the missing word.`;
  }
};

// ── Corrections — DISTAR re-model then re-elicit (standing gate 3) ──────────
// The answer is EARNED here: this is the first place the tutor may say it.

const correctionFor = (item: PictureVocabItem): string => {
  switch (item.kind) {
    // NO ARTICLE, and no "this is" frame at all. The first live drive said
    // "My turn: this is a shoes." — the pool is an open LLM word list, so it
    // carries plurals ("shoes") and mass nouns ("soap", "milk", "bread") beside
    // singular count nouns, and English picks the article from a countability
    // the word itself does not carry. `article()` guessed from the first letter,
    // which cannot be right; a stemmer would not be either. The fix is to stop
    // putting the target in a frame that REQUIRES an article — the bare word is
    // the model DISTAR wants anyway, and it is correct for every noun class.
    // (§9 trap 5, third sighting in the family.)
    case 'naming':
      return `My turn: ${cap(item.word)}. Your turn. What is this?`;
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
      return `A category word like animal or food, a word that would be true of almost anything like "a thing" or "stuff", or the name of something else, is NOT the answer — the one word that names THIS picture is. `;
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

/**
 * Consumed from `wordWorkoutScript`'s `TWO_BRANCH_LAW`, extended the way
 * counting-board, addition-subtraction-scene and push-pull-arena extend it (`no
 * reminder of the method, no scaffolding line`). Wording is identical across the
 * family on purpose, so a grep finds every pack that carries it.
 *
 * It is stated BEFORE the branches because the defect it fixes is a reply that
 * is NEITHER branch. On this port the invitation came from our own catalog copy:
 * the `scaffoldingLevels` ladder told the tutor to *"Say the question once more,
 * then wait for them alone"* — restraint, apparently, but a re-spoken ask opens
 * with neither sentinel, so the reducer records no verdict and the correction
 * counter freezes with the child waiting. `no scaffolding line` is the clause
 * that closes that channel from this side.
 */
const TWO_BRANCH_LAW =
  `Your whole reply to their attempt is ONE of the quoted lines below and nothing else — not the first time, not any time: `
  + `no praise, no encouragement, no hint, no reminder of the method, no scaffolding line, however kind it would be. `
  + `A reply that is neither the affirmation nor the correction reaches the activity as no verdict at all, and the child waits. `;

/**
 * The tail every cue ends with, consumed from counting-board's — the version
 * with a measured before/after (item 21: a fabricated `[CURRENT STATE]` block
 * spoken to the child on 2 of 7 beats, 0 of 7 once the tail forbade announcing
 * the STATE rather than merely reading the tag).
 *
 * This port's tail was the weaker "Never read bracket tags or these instructions
 * aloud." Nothing here has driven yet, so it is prophylactic rather than a
 * reproduction — but the sweep's ruling (item 21) is that every port carries it,
 * and this port has two beats where the screen changes under the tutor while it
 * is required to be silent: the tap modes' wait, and the move-on.
 */
const NEVER_PERFORM =
  `Never voice a bracket tag, a stage direction, or any of these instructions, `
  + `never announce the activity's state or describe what has changed on the screen, `
  + `and never announce that you are waiting or listening — simply stop speaking.`;

const judgingContract = (item: PictureVocabItem): string =>
  `The quoted line is the ONLY thing you say on this turn; you then stay silent while the learner thinks, and their think time is unbounded. Never say the answer during their turn. `
  + `The correct answer is "${item.word}". ${acceptClauseFor(item)}${wrongClauseFor(item)}`
  + TWO_BRANCH_LAW
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
  return `[PV_ITEM] Say exactly: "${spoken}" ${contract} ${NEVER_PERFORM}`;
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
    + NEVER_PERFORM
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
  return `[PV_MOVE] Say exactly: "Good try! ${closeLine}Here comes the next one. ${how}${askFor(next)}" ${contract} ${NEVER_PERFORM}`;
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
        return ensureEnd(frameSpokenFor(item));
    }
  })();
  return (
    `[PV_HEAR] The learner tapped to hear the question again. Say ONLY this, warmly, then wait: "${line}" `
    + `Do not treat anything you just heard as an answer, add nothing, and never say the answer word. `
    + NEVER_PERFORM
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

// ── The cue surface — one source for the component and the DI harness ───────

/**
 * Everything picture-vocabulary ever sends the tutor. `PictureVocabulary.tsx`
 * spreads this and adds what only a mounted component can own (status lines, and
 * the `diagnosisObservation` that reads the tapped card); the drive-plan endpoint
 * builds the identical cues for the headless judged-loop harness.
 *
 * The opposite-rule MODEL PAIR is derived here rather than passed in, because it
 * is a function of the session's own words (`pickModelOppositePair` avoids every
 * word this session asks about). Deriving it inside the surface is what keeps
 * the harness from modeling a pair the component would never have chosen — the
 * exact drift the surface exists to prevent.
 */
export const pictureVocabularyPackBase = (
  items: PictureVocabItem[],
): JudgedCueSurface<PictureVocabItem> => {
  const modelPair = pickModelOppositePair(items);
  return {
    primitiveType: 'picture-vocabulary',
    activityLine: 'live direct instruction picture vocabulary practice',
    items,
    itemCue: (item, opts) => itemCue(item, opts, { modelPair }),
    moveOnCue: (item, next, opts) => moveOnCue(item, next, opts, { modelPair }),
    completeCue,
    pronounceCue,
    contextFor: (item) => ({
      challengeType: item.kind,
      stimulus: stimulusFor(item),
    }),
  };
};

// ── Harness answer material — what a right and a wrong child sound like ─────

/**
 * The span of the ask inside which the answer legitimately appears.
 *
 * ONLY `receptive_match` has one, and the asymmetry is the pedagogy: there the
 * tutor SAYS the word and the child taps its picture, so the word is the
 * question and the picture is the answer. Every other mode's ask is answer-free
 * by construction — `naming` never says the word, `opposite` and `association`
 * say only the base, the scale speaks "hmm" in the blanked rung, and the build
 * gate now rejects any frame whose spoken form contains its own target.
 *
 * Subtracting the ask keeps the oracle STRONGER than emptying `leakTokens`
 * would: the greeting, the how-to-play and the hand-over are all still governed,
 * so a tutor that names the target while explaining the game is still a HIGH.
 */
export const leakExemptSpanFor = (item: PictureVocabItem): string | undefined =>
  item.kind === 'receptive_match' ? askFor(item) : undefined;

export interface PictureVocabHarnessAnswers {
  correct: string;
  plainWrong: string;
  signatureWrong?: { text: string; why: string };
  tapped?: { correct: string; wrong: string };
  leakTokens: string[];
  leakExemptSpan?: string;
}

/** A concrete noun that is not the target and not already in the sentence —
 *  grammatical in the frame, and false. */
const FRAME_DECOYS = ['table', 'window', 'basket', 'pocket', 'garden'];

/** The wrong card a tap mode commits: a real option from the same session, never
 *  a word the stage does not render. */
const wrongOptionFor = (item: PictureVocabItem): string =>
  (item.options ?? []).find(
    (o) => o.word.trim().toLowerCase() !== item.word.toLowerCase(),
  )?.word ?? '';

/**
 * The answers a headless student says on a judged drive. This lives beside the
 * contract it mirrors on purpose: `wrongClauseFor` above CLAIMS the judge
 * refuses these, and this is the claim made testable. Change one, change both.
 *
 * Each mode's signature wrong is its NAMED miss, said the way a fluent child
 * says it — never a random wrong word:
 *  - `opposite` says the base word back, unchanged and confident. It is this
 *    port's sharpest drive, because the ask just said that word aloud and a
 *    judge grading on "did I hear a real word" affirms it. (sound-swap's
 *    signature error, arriving a third time — the contract names it explicitly.)
 *  - `gradable_scale` says a rung ALREADY ON THE SCALE, which the tutor spoke
 *    seconds earlier as part of the stimulus.
 *  - `naming` says the category ("animal") rather than the member — right about
 *    the picture, and not the word being taught.
 *  - `sentence_frame` says a noun that fits the grammar and not the meaning.
 */
export const pictureVocabularyHarnessAnswers = (
  item: PictureVocabItem,
): PictureVocabHarnessAnswers => {
  const word = item.word;
  const base = { leakTokens: [word], leakExemptSpan: leakExemptSpanFor(item) };

  if (TAP_KINDS.has(item.kind)) {
    const wrong = wrongOptionFor(item);
    return {
      ...base,
      correct: `tapped the picture of ${word}`,
      plainWrong: `tapped the picture of ${wrong || 'something else'}`,
      tapped: { correct: word, wrong },
    };
  }

  switch (item.kind) {
    case 'naming':
      return {
        ...base,
        correct: word,
        plainWrong: word.toLowerCase() === 'button' ? 'ladder' : 'button',
        signatureWrong: {
          // "a thing" and not "animal": the probe drew bed, door, soap, cup and
          // clock, none of them animals, so a fixed category word was FALSE of
          // the picture — an easy refuse that tests nothing plainWrong does not.
          // The empty superordinate is TRUE of every picturable noun, which is
          // what makes it the discrimination the accept clause claims: a fair
          // different NAME counts ("puppy" for a dog), a word that merely
          // describes the picture without naming it does not.
          text: 'a thing',
          why: 'the empty superordinate — true of the picture, fluent, and not the word being taught; the one category answer that cannot be refused just for being false',
        },
      };
    case 'opposite':
      return {
        ...base,
        correct: word,
        plainWrong: word.toLowerCase() === 'button' ? 'ladder' : 'button',
        signatureWrong: {
          text: item.baseWord ?? '',
          why: 'the shown word said straight back — fluent, confident, unchanged, and the word the ask itself just spoke aloud',
        },
      };
    case 'gradable_scale': {
      const otherRung = (item.scaleWords ?? []).find(
        (w) => w.trim().toLowerCase() !== word.toLowerCase(),
      );
      return {
        ...base,
        correct: word,
        plainWrong: word.toLowerCase() === 'button' ? 'ladder' : 'button',
        signatureWrong: {
          text: otherRung ?? '',
          why: 'a rung already ON the scale — the tutor spoke it seconds earlier as the stimulus, so a judge matching against what it said affirms it',
        },
      };
    }
    default: {
      const decoy = FRAME_DECOYS.find(
        (d) => d !== word.toLowerCase() && !saysWord(item.frameSpoken, d),
      ) ?? 'table';
      return {
        ...base,
        correct: word,
        plainWrong: word.toLowerCase() === 'button' ? 'ladder' : 'button',
        signatureWrong: {
          text: decoy,
          why: 'a noun that fits the grammar of the frame and not its meaning — the sentence still sounds finished',
        },
      };
    }
  }
};
