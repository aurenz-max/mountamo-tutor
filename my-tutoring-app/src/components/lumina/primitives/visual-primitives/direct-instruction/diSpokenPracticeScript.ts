/**
 * diSpokenPracticeScript — the item type and the generation-boundary content gates of the CONTENT-GENERIC
 * member of the DI family: one component, one generator, many skills, for practice where the screen shows a
 * stimulus and the child answers aloud (no manipulative carries the pedagogy).
 *
 * The generator writes each item's sentences (ask, correction body, `acceptRule`, `signatureError`); code
 * owns the structure. Because `expectedAnswer` is a field, the gates here are mechanical and run before items
 * ship: `deriveResponseClass` refuses an answer it cannot place in a benched response class (a long free-text
 * answer is open-set production, which is blocked), `findAnswerLeaks` drops an item that shows or says its
 * own answer, and the menu, concept, arithmetic and unspoken-stimulus gates drop the other defects
 * `gateSpokenItems` lists. The tutor's words come from the boss (`diSpokenPractice.boss.ts`), not from this
 * module.
 */

import {
  opensWithSentinel,
  type DiActionContract,
  type JudgedScriptItem,
  type ResponseClassId,
} from '../../../hooks/judgedScriptContract';
import {
  HOW_TO_PLAY,
  MODE_SHAPE,
  diSpokenPracticeModePlan,
  type AnswerSource,
  type SpokenPracticeMode,
  type StimulusKind,
} from './diSpokenPracticeModes';
import { containsPhrase, spokenKeyLeaks, tokenize } from '../../../components/live-activity/spokenKey';

export type { AnswerSource, SpokenPracticeMode, StimulusKind } from './diSpokenPracticeModes';

// ── Modes ────────────────────────────────────────────────────────────────────

/**
 * L1 task identities. These are genuinely different acts, not difficulty
 * tiers: produce an answer you were not shown / say aloud the thing you were
 * shown / enumerate a set / pick the word that describes a pair.
 * `answerSource` and `stimulusKind` are stamped from the mode in code (Fork A
 * — Gemini never emits a challenge type).
 *
 * `compare_choice` is the one whose STIMULUS is plural, and that is the whole
 * reason it is a mode rather than a flavour of say_answer: the question is not
 * "what is this?" but "which of these stated words describes THESE TWO?", so it
 * needs a second stimulus, a menu, and a menu-shaped judging contract. Its
 * answer rides `closed_set_choice`, not open production — see
 * `findChoiceMenuDefects` for what makes that claim honest.
 *
 * `explain_concept` is the first OPEN-PROPOSITION mode (qa/di item 36): the
 * child says, in their own words, what a shown instance MEANS or what RULE it
 * follows, and the judge decides whether the utterance expresses the concept
 * rather than whether it contains a token. Its answer rides
 * `concept_statement` — see `findConceptDefects` for what code can check and
 * the generator's review call for what it cannot.
 */
/** How the stimulus APPEARS. `none` still carries stimulusText — the tutor
 *  says it ("Listen: cat…"), nothing is printed. `pair` draws TWO pictures side
 *  by side and prints neither label (the tutor names both aloud). */
/**
 * Where the answer comes from — and therefore whether the printed stimulus is
 * a leak or the task. `decode` is di-word-reading's shape: the word on screen
 * IS the answer and reading it aloud is the skill. `recall` is everything
 * else, and there the stimulus may never contain the answer.
 */
/**
 * How-to-play is CODE-OWNED, one line per mode — the model does not write it.
 *
 * Live-run finding 2026-08-11: asked for a how-to-play per item, flash-lite
 * produced "Look at the math fact, then say the answer out loud!" — filler,
 * because in a voice-only pack there is nothing to explain. Every item is
 * answered out loud; saying so before each one is noise a child sits through.
 *
 * The contrast that makes this a rule rather than a taste: counting-board's
 * how-to-play is "Touch each bear one time as you count" — a PROCEDURE, and it
 * exists because that pack has a manipulative. This pack has none, so "what to
 * do" is a property of the MODE and nothing else. Three lines cover it.
 */
export { HOW_TO_PLAY, MODE_SHAPE } from './diSpokenPracticeModes';

// ── The item ─────────────────────────────────────────────────────────────────

export interface SpokenPracticeItem extends JudgedScriptItem {
  mode: SpokenPracticeMode;
  /** Present on code-planned items; used to verify post-filter session coverage. */
  targetId?: string;
  /** Code-owned subject-verb completion metadata. These fields let the
   *  generator verify that both grammatical numbers survived every gate and
   *  that the spoken key agrees with the requested subject number. */
  agreementNumber?: 'singular' | 'plural';
  agreementPairId?: string;
  /** A displayed naming target must not be spoken by the ask or tap-to-hear.
   * Absent on legacy items, whose existing delivery behavior is preserved. */
  stimulusRole?: 'visual_target';
  stimulusKind: StimulusKind;
  answerSource: AnswerSource;
  /** The stimulus content. Printed when `stimulusKind` is 'text'; spoken by
   *  tap-to-hear on recall items; the object word in 'objects' mode. */
  stimulusText: string;
  /** One emoji for 'emoji' / 'objects' / 'pair' modes; '' otherwise. */
  stimulusEmoji: string;
  /** 'pair' mode: the SECOND thing being compared. Absent on every other mode. */
  stimulusText2?: string;
  /** 'pair' mode: the second thing's emoji. Absent on every other mode. */
  stimulusEmoji2?: string;
  /** 'pair' mode: the closed word menu the child chooses from, spoken in full on
   *  every ask. Its completeness is what makes the ask carry no answer — see
   *  `findChoiceMenuDefects`. Absent on every other mode. */
  choices?: string[];
  /** 'objects' mode: how many to draw. Code NEVER prints the numeral. */
  stimulusCount: number;
  /** 'explain_concept' ONLY: the ONE sentence the judge holds — the idea the
   *  child must express, in any words. Spoken back as the affirmation ("Yes,
   *  the equal sign means both sides have the same amount."), which is the
   *  DISTAR firm-up rather than a clipped echo of a token. `expectedAnswer` and
   *  `alternates` are ANCHOR PHRASINGS of it (≤ 4 words each), examples for the
   *  judge and never a required wording. Absent on every other mode. */
  conceptStatement?: string;
  /** The tutor's scripted question, ending in the hand-over. Generated. */
  ask: string;
  /** Spoken on the opener and whenever the ACTION changes. CODE-OWNED from
   *  `HOW_TO_PLAY` — see that constant for why the model does not write it. */
  howToPlay: string;
  expectedAnswer: string;
  alternates: string[];
  /** A RIGHT answer that does not look right, in this skill's own terms.
   *  '' when the skill has none. Generated. */
  acceptRule: string;
  /** A WRONG answer that sounds right. '' when the skill has none. Generated. */
  signatureError: string;
  /** The re-model, WITHOUT the "My turn:" opener and WITHOUT the re-ask —
   *  code owns both, so a generated line cannot break sentinel discipline
   *  or end a correction on the answer. Generated. */
  correctionBody: string;
  /** Where the levers start (`/add-support-tiers`). Absent = easy. */
  supportTier?: 'easy' | 'medium' | 'hard';
  /** A spare the generator marked as a noticeably easier question of the same skill: the `easier_item` practice case
   *  (ruling R3). Spares ride on `DiSpokenPracticeData.spares`, never as session items. */
  easier?: boolean;
}

export type ActionableSpokenPracticeItem = SpokenPracticeItem & {
  actionContract: DiActionContract;
};

/** Attach the shared DI action contract at the generation boundary. The generated ask is the exact sentence
 *  shown and spoken. */
export const withSpokenPracticeAction = (
  item: SpokenPracticeItem,
): ActionableSpokenPracticeItem => {
  const actionContract = diSpokenPracticeModePlan(item).answerStep.actionContract;
  return {
    ...item,
    answerKind: actionContract.answerKind,
    actionContract,
  };
};

// ── Response classes — standing gate 1 at the generation boundary ────────────

const NUMBER_WORDS = [
  'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten',
  'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen',
  'eighteen', 'nineteen', 'twenty',
];

/** 1..20 as words. ZERO is excluded — "zero"/"none" spoken is an unbenched
 *  answer (di-shapes rung 2 residual), so counting items floor at 1. */
export const numberWordFor = (n: number): string => NUMBER_WORDS[n - 1] ?? String(n);

export const wordCount = (text: string): number =>
  text.trim().split(/\s+/).filter(Boolean).length;

/** explain_concept anchors are EXAMPLES for the judge, never a required wording,
 *  so they stay short: a five-year-old's "plus two" is the whole answer. */
export const CONCEPT_ANCHOR_MAX_WORDS = 4;
/** The one sentence the judge holds and speaks back as the affirmation. Long
 *  enough to be a proposition, short enough to be a firm-up rather than a lecture. */
export const CONCEPT_STATEMENT_MIN_WORDS = 4;
export const CONCEPT_STATEMENT_MAX_WORDS = 12;

const isNumberWord = (text: string): boolean =>
  NUMBER_WORDS.includes(text.trim().toLowerCase());

const TENS_WORDS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];

/**
 * The tokens a numeral is SPOKEN as, 1-120, for the gate that checks an ask
 * says its stimulus ("10, 20, 30, 40" → thirty, forty). The benched spoken
 * ANSWER class still stops at 20 — this only decides whether the tutor's own
 * voice carried the instance, which an explain pattern above twenty needs
 * (the third pilot dropped "10, 20, 30, 40" for an ask that said it perfectly).
 */
const spokenNumberTokens = (n: number): string[] => {
  if (n >= 1 && n <= 20) return [NUMBER_WORDS[n - 1]];
  if (n > 20 && n < 100) {
    const tens = TENS_WORDS[Math.floor(n / 10)];
    const ones = n % 10;
    return ones ? [tens, NUMBER_WORDS[ones - 1]] : [tens];
  }
  if (n >= 100 && n <= 120) {
    const rest = n - 100;
    return ['hundred', ...(rest ? spokenNumberTokens(rest) : [])];
  }
  return [];
};

/**
 * A bare numeral is a WRITTEN form; the child SAYS a number word. Normalising
 * it in code is the same rule as computing the counting answer from the count —
 * and it is load-bearing twice over: the verdict line is read aloud, and
 * `deriveResponseClass` cannot recognise the benched number-word class through
 * a digit, so an un-normalised "2" would ship declaring `short_spoken_word`.
 *
 * Found on the first real generation (2026-08-11): flash-lite returned
 * `expectedAnswer: "2"` with `alternates: ["two"]` — the two forms inverted.
 */
export const normalizeSpokenAnswer = (answer: string): string => {
  const trimmed = answer.trim();
  if (!/^\d+$/.test(trimmed)) return trimmed;
  const n = Number.parseInt(trimmed, 10);
  return n >= 1 && n <= 20 ? numberWordFor(n) : trimmed;
};

const isBareNumeral = (text: string): boolean => /^\d+$/.test(text.trim());

/**
 * The benched class this item's answer belongs to, or NULL when it cannot be
 * placed honestly — which is a refusal, not a fallback.
 *
 * The refusal that matters: a long free-text answer is open-set production,
 * and `open_set_word` is BLOCKED for want of a bench. A generic primitive with
 * a free-text answer field is exactly the shape that would launder that class
 * into production, so the clamp lives here rather than in a reviewer's head.
 */
export const deriveResponseClass = (
  mode: SpokenPracticeMode,
  expectedAnswer: string,
  stimulusText: string,
): ResponseClassId | null => {
  const answer = expectedAnswer.trim();
  if (!answer) return null;
  // A numeral that survived normalisation is outside 1-20, i.e. a multi-word
  // numeral — the build-ahead class (#63) this pack does not gate on.
  if (isBareNumeral(answer)) return null;

  if (mode === 'count_and_say') {
    return isNumberWord(answer) ? 'number_word_to_20' : null;
  }
  if (mode === 'compare_choice') {
    // The child says ONE word from a menu the tutor read out in full. That is
    // `closed_set_choice`, not open production — but only while the menu really
    // is closed and complete, which `findChoiceMenuDefects` (not this function)
    // is what enforces. The length clamp stays: a menu word is a word.
    return wordCount(answer) <= 3 ? 'closed_set_choice' : null;
  }
  if (mode === 'read_aloud') {
    // The printed stimulus is the utterance; its length picks the class.
    return wordCount(stimulusText) >= 3 ? 'sentence_read_aloud' : 'short_spoken_word';
  }
  if (mode === 'explain_concept') {
    // The child produces a PROPOSITION in any words; `expectedAnswer` is only
    // the primary ANCHOR phrasing the judge is shown, and an anchor is short by
    // design (≤ 4 words) so the contract stays readable. The class is
    // `concept_statement` — and it is the class that gates, not the length:
    // while the record is `blocked`, `validateJudgedScriptPack` refuses every
    // item here, which is standing gate 1 doing its job on the first open
    // proposition the family has had (qa/di item 36).
    return wordCount(answer) <= CONCEPT_ANCHOR_MAX_WORDS ? 'concept_statement' : null;
  }
  // say_answer
  if (isNumberWord(answer)) return 'number_word_to_20';
  return wordCount(answer) <= 3 ? 'short_spoken_word' : null;
};

// ── Answer-leak detection — the gate a bespoke pack cannot run ───────────────

// `tokenize` and `containsPhrase` are the shared spoken key's (`spokenKey.ts`).

export interface AnswerLeak {
  itemId: string;
  /** Which surface leaked — the field name a fix must target. */
  field: 'ask' | 'howToPlay' | 'stimulusText' | 'stimulusText2';
  answer: string;
}

/**
 * Every place the child could read or hear the answer before producing it.
 *
 * Scoping note that IS the pedagogy: on a `decode` item the stimulus is the
 * answer by design ("read this word"), so the stimulus is exempt — but the ASK
 * never is, in either mode. This is the one distinction that separates a leak
 * from the task, and it is why `answerSource` is a field rather than a
 * per-primitive convention.
 */
export function findAnswerLeaks(items: readonly SpokenPracticeItem[]): AnswerLeak[] {
  const leaks: AnswerLeak[] = [];
  for (const item of items) {
    const surfaces: Array<{ field: AnswerLeak['field']; text: string }> = [];
    // The second exemption, and the only one that is not about `decode`: a
    // compare_choice ask CARRIES the menu, so it contains the answer by
    // construction. That is safe ONLY because `findChoiceMenuDefects` requires
    // EVERY choice in every ask — a menu that is always complete tells the child
    // nothing, while a menu narrowed to two of four words is a leak that gate
    // catches. Exempting the ask here without that gate would be laundering.
    if (item.mode !== 'compare_choice') surfaces.push({ field: 'ask', text: item.ask });
    surfaces.push({ field: 'howToPlay', text: item.howToPlay });
    if (item.answerSource === 'recall' && item.stimulusKind === 'text') {
      surfaces.push({ field: 'stimulusText', text: item.stimulusText });
    }
    // On a pair the OBJECTS are never the answer (the comparison word is), so
    // both object words are scanned: "the longer stick" hands it over.
    if (item.stimulusKind === 'pair') {
      surfaces.push({ field: 'stimulusText', text: item.stimulusText });
      surfaces.push({ field: 'stimulusText2', text: item.stimulusText2 ?? '' });
    }
    for (const leak of spokenKeyLeaks({ answer: item.expectedAnswer, alsoAccept: item.alternates }, surfaces)) {
      leaks.push({ itemId: item.id, ...leak });
    }
  }
  return leaks;
}

/** 'objects' mode prints pictures, never a numeral — a digit in the stimulus
 *  word would hand over the count. */
export function findPrintedNumerals(items: readonly SpokenPracticeItem[]): string[] {
  return items
    .filter((item) => item.stimulusKind === 'objects' && /\d/.test(item.stimulusText))
    .map((item) => item.id);
}

// ── Choice-menu gate — what makes a spoken menu a CLOSED set ────────────────

export interface ChoiceMenuDefect {
  itemId: string;
  /** Why this menu cannot be judged honestly — the field a regeneration must fix. */
  reason: 'too_few_choices' | 'answer_not_in_menu' | 'menu_not_spoken' | 'choices_not_separable'
    | 'menu_word_in_stimulus';
  /** The words at fault: the choices missing from the ask, the overlapping pair,
   *  or the object-name tokens that gave a menu word away. */
  detail: string[];
}

/**
 * `closed_set_choice` is only honest while the set really is closed, and this
 * is the gate that says so — the counterpart to `findAnswerLeaks`' exemption of
 * the compare_choice ask.
 *
 * FOUR WAYS A MENU STOPS BEING ONE, in the order they matter:
 *   1. Fewer than two words is not a choice.
 *   2. An answer outside the menu means the child was asked one question and
 *      graded on another.
 *   3. Two choices where one contains the other ("long" inside "longer") cannot
 *      be told apart by ear — the class's own ear-separability note, and the
 *      item to DROP rather than judge leniently.
 *   4. An object NAMED with a menu word, or its stem: "a long pencil" against a
 *      menu holding "longer" is the answer said out loud before the question.
 *   5. THE ONE THAT DOES THE WORK: an ask that reads only SOME of the words has
 *      narrowed the field for the child. "Is it longer or heavier?" on a
 *      four-word menu is a two-way guess wearing a four-way costume, and it is
 *      also the exact shape the model reaches for unprompted (the wxyu draw's
 *      intent proposed it verbatim). Requiring the WHOLE menu in every ask is
 *      what makes the answer-leak exemption above safe.
 */
/**
 * Can these two choices be told apart BY EAR? Two ways they cannot, and the
 * second is the one that matters for a single-word menu:
 *   - one is a whole-token subsequence of the other ("A cat" inside "A cat and
 *     a dog") — the class note's own example, and what `containsPhrase` sees.
 *   - one single word OPENS the other ("long" inside "longer"). Token matching
 *     is blind to this by design (it is what stops "cat" hitting "catalog"),
 *     but a child who says the stem has said neither word and both — exactly
 *     the ambiguity `closed_set_choice` requires a pack to refuse.
 */
const sharesEar = (choice: string, other: string): boolean => {
  if (containsPhrase(other, choice)) return true;
  const a = tokenize(choice);
  const b = tokenize(other);
  return a.length === 1 && b.length === 1 && sharesStem(a[0], b[0]);
};

/**
 * Do two words share enough of an opening to hand one over by ear?
 *
 * FOUND LIVE, first real generation (probe 2026-09-06): flash-lite wrote "a long
 * pencil" against a menu containing "longer", and every whole-token gate passed
 * it — `containsPhrase` is deliberately blind to substrings (it is what stops
 * "cat" hitting "catalog"). But a five-year-old hearing "here is a LONG pencil …
 * is the pencil longer, shorter, heavier, or lighter?" has been told the answer
 * by the adjective. Four characters is the threshold that separates the real
 * pairs (long/longer, heavy/heavier, light/lighter, short/shorter) from the
 * accidental ones (leaf/lighter, ladybug/lighter).
 */
const sharesStem = (a: string, b: string): boolean => {
  const x = a.toLowerCase();
  const y = b.toLowerCase();
  let i = 0;
  while (i < x.length && i < y.length && x[i] === y[i]) i += 1;
  return i >= 4;
};

export function findChoiceMenuDefects(items: readonly SpokenPracticeItem[]): ChoiceMenuDefect[] {
  const defects: ChoiceMenuDefect[] = [];
  for (const item of items) {
    if (item.mode !== 'compare_choice') continue;
    const choices = (item.choices ?? []).map((c) => c.trim()).filter(Boolean);
    if (choices.length < 2) {
      defects.push({ itemId: item.id, reason: 'too_few_choices', detail: choices });
      continue;
    }
    if (!choices.some((c) => c.toLowerCase() === item.expectedAnswer.trim().toLowerCase())) {
      defects.push({ itemId: item.id, reason: 'answer_not_in_menu', detail: choices });
      continue;
    }
    const overlapping = choices.filter((c, i) =>
      choices.some((other, j) => i !== j && sharesEar(c, other)));
    if (overlapping.length) {
      defects.push({ itemId: item.id, reason: 'choices_not_separable', detail: overlapping });
      continue;
    }
    // The stem case (see `sharesStem`): naming a thing "a long pencil" answers
    // the question before it is asked, and no whole-word gate can see it.
    const giveaway = [item.stimulusText, item.stimulusText2 ?? '']
      .flatMap(tokenize)
      .filter((token) => choices.some((c) => sharesStem(token, c)));
    if (giveaway.length) {
      defects.push({ itemId: item.id, reason: 'menu_word_in_stimulus', detail: giveaway });
      continue;
    }
    const unspoken = choices.filter((c) => !containsPhrase(item.ask, c));
    if (unspoken.length) {
      defects.push({ itemId: item.id, reason: 'menu_not_spoken', detail: unspoken });
    }
  }
  return defects;
}

// ── Concept gate — what code CAN check about an open proposition ─────────────

export interface ConceptDefect {
  itemId: string;
  reason:
    | 'missing_concept'        // no conceptStatement, or outside 4-12 words
    | 'anchor_too_long'        // an anchor over 4 words is a sentence, not an example
    | 'too_many_anchors'       // > 3 anchors is a word list, not a concept
    | 'anchors_not_distinct'   // two anchors the ear cannot tell apart add nothing
    | 'anchor_echoes_stimulus' // an anchor inside the instance makes ECHO un-refusable
    | 'concept_in_ask'         // the concept sentence, or a run of it, in the ask
    | 'sentinel_in_concept';   // a concept sentence opening with "Yes"/"My turn"
  detail: string[];
}

/**
 * A run of this many concept-sentence tokens inside the ask is the concept
 * leaking, not the subject being named. Four, not three: the SUBJECT of a
 * concept sentence is legitimately in the ask ("What does THE EQUAL SIGN tell
 * us?" against "THE EQUAL SIGN means both sides have the same amount"), and it
 * is three tokens long. The PREDICATE is the leak, and a four-token run cannot
 * be the subject alone. Anchors are scanned at any length by `findAnswerLeaks`.
 */
const CONCEPT_RUN_LEAK = 4;

const hasTokenRun = (haystack: string, needle: string, run: number): boolean => {
  const need = tokenize(needle);
  for (let i = 0; i + run <= need.length; i++) {
    if (containsPhrase(haystack, need.slice(i, i + run).join(' '))) return true;
  }
  return false;
};

/**
 * STRUCTURE ONLY — and the docblock says so because the first design note for
 * this mode said "code-validated acceptableConcepts", and that is not a thing.
 * Nothing in the objective text grounds a paraphrase: "= means both sides are
 * the same" is printed nowhere a token inventory can find it. So the split is
 * the one `planSpokenPractice` already uses — code checks SHAPE (present,
 * bounded, distinct, no echo, no leak), and the generator's per-session review
 * call checks MEANING (is the concept true and grade-appropriate for THIS
 * stimulus; does each anchor mean the same thing). A reader looking here for
 * the grounding that proves an anchor is right will not find it; it is in the
 * review, and it is a semantic judgment, like lesson coverage.
 *
 * What the seven reasons protect, in the order they matter:
 *   1. The judge must be HANDED an idea — no concept sentence, nothing to judge.
 *   2-3. Anchors are examples, not a required wording; a long one, or a long
 *      LIST of them, turns the class back into token matching.
 *   4. Two anchors the ear cannot separate are one anchor written twice.
 *   5. An anchor that sits inside the instance ("red blue" for "red, blue, red,
 *      blue") makes the ECHO bucket un-refusable: reading the screen would count.
 *   6. The concept in the ask is THE leak — the coverage judge files it as
 *      recall of a sentence just heard, not an explanation.
 *   7. The concept sentence is SPOKEN inside the affirmation, so a sentinel
 *      opener in it would be a verdict the reducer misreads.
 */
export function findConceptDefects(items: readonly SpokenPracticeItem[]): ConceptDefect[] {
  const defects: ConceptDefect[] = [];
  for (const item of items) {
    if (item.mode !== 'explain_concept') continue;
    const concept = (item.conceptStatement ?? '').trim();
    const conceptWords = wordCount(concept);
    if (!concept || conceptWords < CONCEPT_STATEMENT_MIN_WORDS
      || conceptWords > CONCEPT_STATEMENT_MAX_WORDS) {
      defects.push({ itemId: item.id, reason: 'missing_concept', detail: [concept] });
      continue;
    }
    if (opensWithSentinel(concept)) {
      defects.push({ itemId: item.id, reason: 'sentinel_in_concept', detail: [concept] });
      continue;
    }
    const anchors = [item.expectedAnswer, ...item.alternates].map((a) => a.trim()).filter(Boolean);
    const long = anchors.filter((a) => wordCount(a) > CONCEPT_ANCHOR_MAX_WORDS);
    if (long.length) {
      defects.push({ itemId: item.id, reason: 'anchor_too_long', detail: long });
      continue;
    }
    if (anchors.length > 3) {
      defects.push({ itemId: item.id, reason: 'too_many_anchors', detail: anchors });
      continue;
    }
    const overlapping = anchors.filter((a, i) =>
      anchors.some((other, j) => i !== j && sharesEar(a, other)));
    if (overlapping.length) {
      defects.push({ itemId: item.id, reason: 'anchors_not_distinct', detail: overlapping });
      continue;
    }
    const echoing = anchors.filter((a) => containsPhrase(item.stimulusText, a));
    if (echoing.length) {
      defects.push({ itemId: item.id, reason: 'anchor_echoes_stimulus', detail: echoing });
      continue;
    }
    if (hasTokenRun(item.ask, concept, CONCEPT_RUN_LEAK)) {
      defects.push({ itemId: item.id, reason: 'concept_in_ask', detail: [concept] });
    }
  }
  return defects;
}

// ── Arithmetic-consistency gate — the fact on screen is the ground truth ─────

/** A printed two-operand fact: "3 + 2", "7 − 4", "2 x 3", optionally "= ?". */
const ARITHMETIC_FACT = /^\s*(\d+)\s*([+x×*\-−–])\s*(\d+)\s*(?:=\s*\??)?\s*$/;

export interface ArithmeticMismatch {
  itemId: string;
  /** What the printed fact actually equals, as the spoken word. */
  computed: string;
  /** What the item claimed the child should say. */
  claimed: string;
}

/**
 * say_answer items whose printed fact disagrees with their own answer.
 *
 * Opened by the seed pool (run 592abf43424c): once the TARGET number is
 * pooled, the model back-solves operands to fit it — which is the point — but
 * a bad back-solve ships "3 + 2 → six". The stimulus is what the child sees
 * and what the ask says aloud, so the FACT is the ground truth. A mismatched
 * item is DROPPED, never patched: the generated correctionBody states the
 * claimed answer, so overwriting `expectedAnswer` would leave the re-teach
 * asserting the very number this gate just refuted.
 */
export function findArithmeticMismatches(
  items: readonly SpokenPracticeItem[],
): ArithmeticMismatch[] {
  const results: ArithmeticMismatch[] = [];
  for (const item of items) {
    if (item.mode !== 'say_answer') continue;
    if (item.stimulusRole === 'visual_target') continue;
    const match = ARITHMETIC_FACT.exec(item.stimulusText);
    if (!match) continue;
    const a = Number.parseInt(match[1], 10);
    const b = Number.parseInt(match[3], 10);
    const op = match[2];
    const value = op === '+' ? a + b : /[x×*]/.test(op) ? a * b : a - b;
    // numberWordFor falls back to the numeral outside 1-20 (incl. "0" for a
    // zero result) — never equal to a benched word, so those items drop too.
    const computed = numberWordFor(value);
    if (computed.toLowerCase() !== item.expectedAnswer.trim().toLowerCase()) {
      results.push({ itemId: item.id, computed, claimed: item.expectedAnswer });
    }
  }
  return results;
}

// ── Unspoken-stimulus detection — the ask must SAY the problem ───────────────

/** Operator glyphs survive tokenisation as letters ("2 x 3" → "x"); the ask may
 *  phrase the operation any way it likes ("groups of", "times"), so operator
 *  tokens are never required of it. */
const OPERATOR_TOKENS = new Set(['x']);

/** An article is not the name of the thing. Requiring one would drop a correct
 *  ask for saying "the rock" where the stimulus said "a rock" — a false drop,
 *  and the only reason this list exists. */
const ARTICLE_TOKENS = new Set(['a', 'an', 'the']);

export interface UnspokenStimulus {
  itemId: string;
  /** The stimulus tokens the ask never says — what a regeneration must add. */
  missing: string[];
}

/**
 * The counterpart gate to `findAnswerLeaks`, found live (run 436dcb5616cb,
 * 2026-08-11): the tutor asked "Here is a groups problem. What is the answer?"
 * — a question with no problem in it — because nothing required the generated
 * ask to contain the stimulus. In a voice-first pack the ask is the child's
 * EAR-side access to the problem; the printed stimulus is reinforcement, not
 * the carrier. DISTAR asks state the item ("Two plus one. What is two plus
 * one?"), so an ask that never says its own stimulus is a defective item.
 *
 * Scope is `say_answer` with a 'text' or 'none' stimulus, PLUS every
 * `compare_choice` pair. The other shapes must NOT state theirs: read_aloud's
 * stimulus is the answer (leak gate bans it from the ask), count_and_say's
 * count is the answer, and an 'emoji'/'objects' stimulus word spoken aloud
 * would name the picture the child is being asked about.
 *
 * A pair is the opposite case and belongs here for the same reason the
 * arithmetic ask does: the two OBJECTS are not the answer — the comparison word
 * is — so naming them aloud is the task, and an ask that shows two pictures
 * without saying what they are asks a pre-reader to compare two unnamed things.
 *
 * Digits match their number word in either direction ("2" is satisfied by
 * "two" and vice versa) — the ask is spoken, so both forms reach the child
 * identically.
 */
export function findUnspokenStimulus(items: readonly SpokenPracticeItem[]): UnspokenStimulus[] {
  const results: UnspokenStimulus[] = [];
  for (const item of items) {
    if (item.stimulusRole === 'visual_target') continue;
    // explain_concept joins the arithmetic case for the arithmetic reason: the
    // INSTANCE ("3 + 2 = 5", "2, 4, 6, 8") is not the answer — the concept is —
    // so the ask must say it aloud, and a printed pattern under "what is the
    // rule?" asks a pre-reader to explain something they were never told. A
    // pictured instance (emoji) is exempt exactly as say_answer's is.
    const spoken = item.mode === 'compare_choice'
      ? [item.stimulusText, item.stimulusText2 ?? ''].filter((t) => t.trim()).join(' ')
      : item.mode === 'say_answer' && (item.stimulusKind === 'text' || item.stimulusKind === 'none')
        ? item.stimulusText
        : item.mode === 'explain_concept' && item.stimulusKind === 'text'
          ? item.stimulusText
          : null;
    if (spoken === null) continue;
    const askTokens = new Set(tokenize(item.ask));
    const missing = Array.from(new Set(tokenize(spoken)))
      .filter((token) => !OPERATOR_TOKENS.has(token) && !ARTICLE_TOKENS.has(token))
      .filter((token) => {
        if (askTokens.has(token)) return false;
        if (/^\d+$/.test(token)) {
          const spokenAs = spokenNumberTokens(Number.parseInt(token, 10));
          return !(spokenAs.length && spokenAs.every((w) => askTokens.has(w)));
        }
        return !NUMBER_WORDS.includes(token) || !askTokens.has(String(NUMBER_WORDS.indexOf(token) + 1));
      });
    if (missing.length) results.push({ itemId: item.id, missing });
  }
  return results;
}

// ── Concept anchors — normalised once, for the plan and the build alike ─────

/** At most this many anchors ride an explain item: the primary and two more.
 *  They are EXAMPLES for the judge; a fourth is a word list. */
export const CONCEPT_ANCHOR_MAX_ALTERNATES = 2;

/**
 * The anchor set a judge is shown, tidied rather than refused. The model
 * (and the planner) routinely offer a redundant wording ("same as" beside
 * "the same as"), a fourth example, or the instance itself as an anchor; the
 * third pilot lost 6/6 items of a whole session to `anchors_not_distinct` on
 * ONE planned "same as" — every stamped item carried the same redundancy.
 * Redundancy is noise, not a defect: the contained wording is dropped, the
 * list is capped, and an alternate that sits inside the instance (the echo)
 * is dropped because the judge must be able to refuse the read-back. Only a
 * PRIMARY that echoes the instance still drops the item (`findConceptDefects`).
 */
export const normalizeConceptAnchors = (
  primary: string,
  alternates: readonly string[],
  stimulusText = '',
): string[] => {
  const kept: string[] = [];
  for (const raw of alternates) {
    const a = raw.trim();
    if (!a || a.toLowerCase() === primary.trim().toLowerCase()) continue;
    if (sharesEar(a, primary) || sharesEar(primary, a)) continue;
    if (kept.some((k) => sharesEar(a, k) || sharesEar(k, a))) continue;
    if (stimulusText && containsPhrase(stimulusText, a)) continue;
    kept.push(a);
    if (kept.length === CONCEPT_ANCHOR_MAX_ALTERNATES) break;
  }
  return kept;
};

/**
 * Anchors against THIS ask. Returns the primary to ship ('' when every anchor
 * is a word of the ask — a genuine leak, and the item drops) and the ask-safe
 * alternates. See the call site in `buildSpokenItem` for why.
 */
export const reconcileConceptAnchors = (
  primary: string,
  alternates: readonly string[],
  ask: string,
): { primary: string; alternates: string[] } => {
  const safe = alternates.filter((a) => !containsPhrase(ask, a));
  if (!containsPhrase(ask, primary)) return { primary, alternates: safe };
  return safe.length ? { primary: safe[0], alternates: safe.slice(1) } : { primary: '', alternates: [] };
};

// ── Raw → item — the generation boundary, in one place ──────────────────────

/** Counting draws what it can draw (1-10); the floor is the benched
 *  number-word class's floor — "zero"/"none" spoken is unbenched. */
export const MIN_COUNT = 1;
export const MAX_COUNT = 10;

/** What the model emits per item — flat, every field optional and untrusted. */
export interface RawSpokenItem {
  stimulusText?: unknown;
  stimulusEmoji?: unknown;
  stimulusText2?: unknown;
  stimulusEmoji2?: unknown;
  stimulusCount?: unknown;
  printStimulus?: unknown;
  ask?: unknown;
  expectedAnswer?: unknown;
  alsoAccept?: unknown;
  conceptStatement?: unknown;
  acceptRule?: unknown;
  signatureError?: unknown;
  correctionBody?: unknown;
  easier?: unknown;
}

const str = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');

const clampCount = (value: unknown): number => {
  const n = typeof value === 'number' ? Math.round(value) : Number.parseInt(String(value ?? ''), 10);
  if (!Number.isFinite(n)) return MIN_COUNT;
  return Math.max(MIN_COUNT, Math.min(MAX_COUNT, n));
};

/**
 * Build one item, or null if it cannot ship. Both refusals are gates, not
 * fallbacks: a class that cannot be placed is standing gate 1, and a missing
 * ask/answer is an item with nothing to judge.
 *
 * Lives in the SCRIPT module rather than the generator so a bench fixture can
 * build through it without importing the Gemini client — the shipped gate is
 * what a bench must go through, or it benches a contract the primitive does
 * not use (`conceptStatementBench.ts`).
 *
 * `menu` (compare_choice) and `concept` (a session-planned explain_concept
 * anchor set) are the two code-owned, session-wide slots stamped INTO every
 * item: the model writes the instance around them and never re-emits them.
 */
export const buildSpokenItem = (
  raw: RawSpokenItem,
  index: number,
  mode: SpokenPracticeMode,
  menu: readonly string[] = [],
  concept?: { conceptStatement: string; anchors: readonly string[] },
): SpokenPracticeItem | null => {
  const shape = MODE_SHAPE[mode];
  const generatedStimulusText = str(raw.stimulusText);
  const ask = str(raw.ask);
  if (!ask || !generatedStimulusText) return null;
  // A pair with one thing in it is not a comparison, and a pair with nothing
  // drawn is two names a pre-reader cannot hold — both are missing halves of
  // the stimulus, refused here rather than rendered as a blank side.
  const stimulusText2 = str(raw.stimulusText2);
  const stimulusEmoji2 = str(raw.stimulusEmoji2).slice(0, 8);
  if (mode === 'compare_choice'
    && (!stimulusText2 || !str(raw.stimulusEmoji) || !stimulusEmoji2)) return null;

  // count_and_say: the COUNT is the truth and the answer is computed from it.
  // Trusting a model-written number word here is how "seven" ends up under six
  // bears (LLM emits the window, code builds the answer).
  const stimulusCount = mode === 'count_and_say' ? clampCount(raw.stimulusCount) : 0;
  const spokenAnswer = normalizeSpokenAnswer(concept ? concept.anchors[0] ?? '' : str(raw.expectedAnswer));
  // The menu is the objective's OWN wording, so a case- or inflection-drifted
  // answer is snapped back to it: the cue reads the menu and the answer aloud
  // in the same breath, and they must be the same word when it does.
  const expectedAnswer = mode === 'count_and_say'
    ? numberWordFor(stimulusCount)
    : menu.find((c) => c.toLowerCase() === spokenAnswer.toLowerCase()) ?? spokenAnswer;
  if (!expectedAnswer) return null;
  // Reading preserves the printed utterance, including supported numeral → word
  // normalization. A symbol NAME is recall and cannot be relabeled as decoding.
  if (mode === 'read_aloud'
    && normalizeSpokenAnswer(generatedStimulusText).toLowerCase() !== expectedAnswer.toLowerCase()) return null;

  const responseClass = deriveResponseClass(mode, expectedAnswer, generatedStimulusText);
  if (!responseClass) return null;

  const offered = (concept ? concept.anchors.slice(1).join(',') : str(raw.alsoAccept))
    .split(',')
    .map((a) => normalizeSpokenAnswer(a))
    .filter(Boolean)
    // An "alternate" identical to the answer adds noise to the contract — and
    // after normalisation the common case IS identical, because the model
    // routinely offers the digit and the word as if they were two answers.
    .filter((a) => a.toLowerCase() !== expectedAnswer.toLowerCase())
    .slice(0, 4);
  // Explain anchors are tidied, not refused (see `normalizeConceptAnchors`),
  // and then reconciled with THIS item's ask: the ask must name the thing being
  // explained ("what does the EQUAL sign tell us?"), so an anchor that is a
  // word of that name ("equal") is in every ask by construction and would fail
  // the leak gate on every item — the fresh draw `…i08t` shipped 0/6 twice on
  // exactly that. An anchor the ask contains is no example the judge needs
  // (the judge is told words from the ask are not the test), so it is dropped;
  // a PRIMARY the ask contains hands over to the first ask-safe alternate. A
  // stamped set may therefore ride as a SUBSET on some items —
  // `hasConceptCoverage` checks the subset, never byte-equality.
  const reconciled = mode === 'explain_concept'
    ? reconcileConceptAnchors(expectedAnswer, normalizeConceptAnchors(expectedAnswer, offered, generatedStimulusText), ask)
    : { primary: expectedAnswer, alternates: offered };
  const alternates = reconciled.alternates;
  if (!reconciled.primary) return null;

  const stimulusEmoji = str(raw.stimulusEmoji).slice(0, 8);
  // A generated picture whose label is an accepted answer is the answer in
  // pictorial form. That is valid only for a code-planned visual_naming task,
  // which bypasses this builder and carries stimulusRole='visual_target'. For
  // listening riddles and context-clue questions, keep the complete spoken ask
  // as the replayable stimulus and remove the answer-depicting picture. This is
  // a lossless repair: the clues, answer, alternates, judge and correction stay
  // synchronized; only the unauthorized shortcut is removed.
  const answerDepictingPicture = mode === 'say_answer' && Boolean(stimulusEmoji)
    && [reconciled.primary, ...alternates].some((answer) =>
      containsPhrase(generatedStimulusText, answer) || containsPhrase(answer, generatedStimulusText));
  const stimulusText = answerDepictingPicture ? ask : generatedStimulusText;
  // 'objects' needs something to draw; without an emoji the mode has no
  // stimulus at all, so fall back to a neutral counter rather than a blank board.
  const emoji = answerDepictingPicture
    ? ''
    : mode === 'count_and_say' && !stimulusEmoji ? '🔵' : stimulusEmoji;

  // How the stimulus APPEARS. say_answer varies three ways: a picture, printed
  // text, or nothing at all — and the last is pedagogy, not layout. Showing the
  // word during a sound-manipulation task turns an auditory skill into a visual
  // one. explain_concept reuses the picture branch only: its instance is
  // printed or pictured, never withheld (the child explains what they SEE).
  const listenOnly = mode === 'say_answer'
    && (answerDepictingPicture || (raw.printStimulus === false && !emoji));
  const stimulusKind = mode === 'say_answer'
    ? listenOnly ? 'none' : emoji ? 'emoji' : 'text'
    : mode === 'explain_concept'
      ? emoji ? 'emoji' : 'text'
      : shape.stimulusKind;
  const pair = mode === 'compare_choice';
  const explain = mode === 'explain_concept';

  return withSpokenPracticeAction({
    id: `dsp-${index + 1}`,
    mode,
    action: mode,
    answerKind: 'voice',
    responseClass,
    stimulusKind,
    answerSource: shape.answerSource,
    stimulusText,
    stimulusEmoji: emoji,
    ...(pair ? { stimulusText2, stimulusEmoji2, choices: [...menu] } : {}),
    ...(explain ? { conceptStatement: concept?.conceptStatement ?? str(raw.conceptStatement) } : {}),
    stimulusCount,
    ask,
    // Code-owned, per MODE — the model wrote filler here on the first live run.
    howToPlay: HOW_TO_PLAY[mode],
    expectedAnswer: reconciled.primary,
    alternates,
    ...(raw.easier === true ? { easier: true } : {}),
    acceptRule: str(raw.acceptRule),
    signatureError: str(raw.signatureError),
    correctionBody: str(raw.correctionBody) || `The answer is ${expectedAnswer}.`,
  });
};

/** Drop every item that leaks its own answer, prints a count, asks a
 *  question with no problem in it (an ask that never says its stimulus — run
 *  436dcb5616cb), contradicts its own printed fact ("3 + 2 → six"), offers a
 *  narrowed / unspeakable choice menu ("longer or heavier?" out of four), or
 *  hands the judge a malformed concept (no sentence, an anchor that echoes the
 *  instance, the concept inside the ask). All are content-contract refusals;
 *  logged by id so the tester shows what was dropped. */
export const gateSpokenItems = (items: SpokenPracticeItem[]): {
  kept: SpokenPracticeItem[];
  dropped: string[];
  /** WHY each dropped item dropped — the field a regeneration must fix. The
   *  second explain pilot lost 5 of 6 pattern items to code gates with only ids
   *  in the log, which is a finding nobody can act on. */
  reasons: Record<string, string[]>;
} => {
  const reasons: Record<string, string[]> = {};
  const flag = (id: string, why: string) => { (reasons[id] ??= []).push(why); };
  for (const leak of findAnswerLeaks(items)) flag(leak.itemId, `leak: "${leak.answer}" in ${leak.field}`);
  for (const id of findPrintedNumerals(items)) flag(id, 'printed numeral in objects stimulus');
  for (const u of findUnspokenStimulus(items)) flag(u.itemId, `ask never says: ${u.missing.join(', ')}`);
  for (const m of findArithmeticMismatches(items)) flag(m.itemId, `fact says ${m.computed}, item says ${m.claimed}`);
  for (const d of findChoiceMenuDefects(items)) flag(d.itemId, `menu ${d.reason}: ${d.detail.join(', ')}`);
  for (const d of findConceptDefects(items)) flag(d.itemId, `concept ${d.reason}: ${d.detail.join(', ')}`);
  const bad = new Set(Object.keys(reasons));
  return {
    kept: items.filter((item) => !bad.has(item.id)),
    dropped: Array.from(bad),
    reasons,
  };
};

// ── The concept affirmation ─────────────────────────────────────────────────

/** "The equal sign means…" → "the equal sign means…", so "Yes, the equal sign
 *  means…" reads as one sentence; a trailing period is guaranteed. */
export const conceptAffirmForm = (concept: string): string => {
  const trimmed = concept.trim().replace(/[.!?]+$/, '');
  return `${trimmed.charAt(0).toLowerCase()}${trimmed.slice(1)}.`;
};
