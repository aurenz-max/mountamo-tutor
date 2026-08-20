/**
 * rhymeStudioScript — HAND-AUTHORED judged-loop script for rhyme-studio
 * (EIGHTH literacy DI port; qa/di/BACKLOG.md item 16). The exact wording IS the
 * pedagogy; these lines are authored per pack, never generated. Item CONTENT
 * (which words, which families, which distractors) stays generator-scoped; this
 * module owns the cue shapes, the tier ladder and the in-band judging contracts.
 *
 * ── THE BANK IS GONE. PRODUCTION IS OPEN. ───────────────────────────────────
 * This primitive sat behind a bench sitting longer than any other literacy
 * surface, for one reason: `open_set_word` was a BLOCKED response class and
 * "tell me a word that rhymes with cat" is the canonical open set. The port
 * shipped anyway because `production` was never open — it rendered a FOUR-TILE
 * WORD BANK and the child said one of the four, which is a closed,
 * code-enumerable set. The bank looked like scaffolding to delete on the way to
 * DI; it was in fact the only thing making the mode sayable.
 *
 * ⭐ THE CLASS WAS BENCHED AND CLEARED 2026-08-19, AND THE BANK IS DELETED.
 * `qa/di-bench/run-2026-08-19-open-set-word.md`: 72 probes over six rimes
 * through this exact contract, driven headlessly by `/tutor-test --di-bench`.
 * The judge's affirm set across all 72 was EXACTLY the 17 planted valid rhymes
 * — every echo, onset match, semantic neighbour, off-task turn and genuine
 * nonword refused, including "nake" (the string this generator itself once
 * emitted into an acceptable-answer list).
 *
 *   USER RULING 2026-08-18: *"we need to trust the ai model to hear the answer
 *   and judge correctly… we dont need a full schema but we do need to specify
 *   the problem and allow the ai to judge and impact the screen"* and *"agree
 *   with you on rhyme studio we shouldnt need an answer bank for synthesis,
 *   trust the model."*
 *
 * So `production` now hands the judge a RULE instead of an enumerated target,
 * and the whole difference lives in the judging clauses — no new item field, no
 * new runner field, nothing in the transport. What the child DOES changed from
 * reading four words and saying one to THINKING OF A RHYME: a different
 * learning event, and a Bloom tier up.
 *
 * ⚠️ THE FOUR GUARDS ARE LOAD-BEARING — see `openWrongClause`. Removing the
 * menu removes the closed-set arithmetic that makes every other spoken mode
 * safe, so the wrong clause is where this mode spends its words: ECHO,
 * NONWORD, ONSET-ONLY, OFF-TASK. Names COUNT (the bench's own correction —
 * "Bill" rhymes with "hill"). The two failures are NOT symmetric: a missed
 * valid rhyme costs the child another turn, an affirmed wrong answer teaches
 * the error.
 *
 * ⚠️ AND THE CORRECTION CAP IS LOAD-BEARING HERE IN A WAY IT IS NOT ELSEWHERE.
 * An open item has no menu bounding its wrong answers, so it reaches long
 * correction runs far more than any closed item — and the bench measured the
 * say-exactly grip decaying across consecutive corrections. Never raise
 * `maxCorrections` for this mode.
 *
 * ── THE SPLIT — EVERY MODE IS SPOKEN ────────────────────────────────────────
 *
 *   recognition     the answer is a JUDGMENT   → VOICE `yes_no`
 *   identification  the answer is a LISTED WORD → VOICE `short_spoken_word`
 *   production      the answer is ANY WORD      → VOICE `open_set_word`
 *
 * ⚠️ RECOGNITION TAPPED FOR ONE DAY AND THE FIRST DRIVE KILLED IT — read this
 * before ever proposing a tap here again. The original split gave recognition a
 * 👍/👎 tap on two arguments: that a yes/no verdict is not made of language,
 * and that its two carrier words are the worst pair to hand a judge ("no" is
 * VC-length, the length `short_spoken_word` records as unbenched; "yes" is the
 * affirm sentinel). **The user's first drive refuted the premise and the
 * session log refuted the hazard.**
 *
 *   USER RULING 2026-08-12: *"i think its weird to need the thumbs up and
 *   thumbs down [for] do they rhyme? we should just be able to say yes to the
 *   tutor."*
 *
 * The log (`backend/logs/lumina-sessions/2026-08-13-023253-…jsonl`) shows the
 * child doing exactly that — answering "Yes." aloud to a spoken question — and
 * the tap contract had NO SCRIPTED LINE for a spoken answer. So the model
 * improvised: it invented the tag names it had only seen described
 * (`"[RS_TAP] Correct! You got it… [RS_MOVE] Listen to these two words: cake,
 * chair"`), spoke them aloud, invented a whole next item, and — because it said
 * "Correct!" rather than the "Yes," sentinel — emitted no verdict at all, so
 * the loop went deaf and the screen never advanced. One silence contract
 * produced a hallucinated tag, invented content, and a wedged run.
 *
 * And the sentinel hazard was never real: **the verdict scan reads the TUTOR's
 * output, never the child's.** The same log shows the child's "Yes." arriving
 * as `user-transcript` with no misfire anywhere. What remains true is only that
 * `yes_no` had no bench — so it ships as `accepted-build-ahead` on the user's
 * ruling, with the acceptance drive owed on HUMAN-CHECKS #94, and the accept
 * clause below carries the VC-length worry as latitude ("yeah", "nope", "they
 * do") instead of pretending the bare word is enough.
 *
 * The general lesson, which is not about rhyming: **a silence contract is only
 * honest when the child has no way to answer with their voice.** Where the
 * question is spoken and the answer is sayable, a tap surface does not restrain
 * the model — it leaves it without a script at the exact moment it needs one.
 *
 * ── THE THREE SCRIPT QUESTIONS ──────────────────────────────────────────────
 *
 * 1. IS THE MODEL THE ANSWER? Never — and that is why this pack can model at
 *    all. What is taught is the RULE (words rhyme when they end the same), and
 *    the rule is modeled on a CODE-OWNED pair the session never asks about
 *    (word-flip's `pickModelNoun` ruling, fourth use). Modeling on a session
 *    pair would hand over a recognition item outright and would name an
 *    identification answer. `pickModelRhymePair` excludes by rhyme FAMILY, not
 *    just by word: a model pair from the -at family gives away every -at item
 *    in the run even though it shares no spelling with them.
 *
 * 2. CAN THE STIMULUS ANSWER THE HAND-OVER? "Do these rhyme?" over two spoken
 *    words has one defensible answer. Identification and production restate the
 *    target inside the hand-over ("which one rhymes with cat") so the child is
 *    never left guessing whether to say a rhyme, the target, or the ending.
 *
 * 3. WHAT LOOKS LIKE AN ANSWER AND ISN'T, PER MODE?
 *    - recognition: the ALLITERATIVE pair — cat/cap, cat/cup — same beginning,
 *      different end. It is the primitive's own documented signature error
 *      ("confusing rhyme with alliteration") and it arrives confident.
 *    - identification: the option that shares the target's ONSET rather than
 *      its rime; the generator is asked for exactly that distractor.
 *    - production: the TARGET WORD said back. A word rhymes with itself only
 *      trivially, and the ask is for a different word (sound-swap's signature
 *      error, arriving a fourth time).
 *    And on the accept side: any word from the item's full acceptable list
 *    counts even when it is not one of the four tiles on screen — a child who
 *    hears the family and says a member of it has done the skill, and the list
 *    is code-owned and closed, so accepting it costs no bench.
 *
 * ── SENTINELS ───────────────────────────────────────────────────────────────
 * Engine defaults ("Yes" / "My turn"), collision-checked by
 * validateJudgedScriptPack in this pack's test file. The live hazard here is
 * sharper than in any previous pack, because every word in every line is
 * GENERATED: the pre-DI component shipped a hardcoded distractor pool whose
 * seventh entry was the word "yes", which under this script would have opened a
 * spoken correction sentence with the affirm sentinel (port 7's finding,
 * arriving as a latent bug rather than a near miss). Two defences, both
 * structural: `isSentinelSafeWord` filters every pool the generator draws from,
 * and NO SENTENCE IN ANY LINE BELOW OPENS WITH A CONTENT WORD — every sentence
 * starts with an authored token ("Listen", "Your turn", "My turn", "Good try"),
 * so a word that slipped every filter still cannot land in an opener slot.
 */

import type {
  JudgedCueSurface,
  JudgedScriptItem,
  ResponseClassId,
} from '../../../hooks/judgedScriptContract';

/**
 * `production` is the OPEN mode: the child says any real word that rhymes, off
 * no menu at all. It carried a four-tile word bank until 2026-08-19, when the
 * `open_set_word` bench cleared and the bank was deleted (module header above).
 *
 * The mode KEY deliberately did not change. The eval mode, the IRT ladder and
 * `RhymeStudioMetrics.productionAccuracy` all measure the same SKILL — can the
 * child produce a word that rhymes — and banked-versus-open is a difference in
 * SCAFFOLD, the same axis the support tiers already move along. Renaming it
 * would have split one ability estimate into two half-populated ones for no
 * pedagogical gain.
 */
export type RhymeMode = 'recognition' | 'identification' | 'production';
export type RhymeTier = 'easy' | 'medium' | 'hard';

// ── The sentinel-safety filter ──────────────────────────────────────────────

/** Words that can never appear in a pool this pack speaks: they open a verdict
 *  sentence. Kept as tokens rather than a regex so the list reads as what it is
 *  — the sentinel openers, lowercased. */
const SENTINEL_TOKENS = new Set(['yes', 'my', 'turn']);

/**
 * May this generated word appear in a line the tutor speaks? Exported so the
 * generator filters its pools rather than trusting the prompt (the pool is
 * code's business — the continuant-gate ruling, second use).
 */
export const isSentinelSafeWord = (word: string): boolean =>
  !SENTINEL_TOKENS.has(word.trim().toLowerCase());

// ── The item ────────────────────────────────────────────────────────────────

export interface RhymeChoice {
  word: string;
  /** Pre-reader picture surface; absent at reader grades. */
  emoji?: string;
  isCorrect: boolean;
}

export interface RhymeItem extends JudgedScriptItem {
  mode: RhymeMode;
  /** The word the whole item is about — the stimulus, never the answer. */
  targetWord: string;
  targetEmoji?: string;
  /** Rime with the leading hyphen stripped: "-at" → "at". Spoken only in an
   *  affirmation or a capped close, never before a verdict. */
  rime: string;
  tier: RhymeTier;
  // -- recognition --
  comparisonWord?: string;
  comparisonEmoji?: string;
  doesRhyme?: boolean;
  // -- identification / production --
  /** The on-screen set. Speaking a word from it is the whole answer surface. */
  choices: RhymeChoice[];
  /** Every word that counts, whether or not it is one of the tiles on screen.
   *  Code-owned and closed — that is what keeps this a benched class. */
  acceptedWords: string[];
  /** The canonical right answer, for corrections and code-computed verdicts. */
  answer: string;
  /** Whether the tutor may enumerate the choices aloud (support tier #2;
   *  forced on at the pre-reader band — a non-reader has no other way in). */
  namesChoices: boolean;
}

/** Every mode is answered out loud — there is nothing to tap in this pack. */
export const answerKindFor = (_mode: RhymeMode): 'voice' | 'gesture' => 'voice';

/** Standing gate 1: identification and banked production produce one short word
 *  from a closed per-item set (benched); recognition produces a verdict
 *  (`yes_no`, accepted-build-ahead on the user's ruling); production produces a
 *  word from no set at all (`open_set_word`, benched 2026-08-19 on this very
 *  contract). */
export const responseClassFor = (mode: RhymeMode): ResponseClassId =>
  mode === 'recognition'
    ? 'yes_no'
    : mode === 'production'
      ? 'open_set_word'
      : 'short_spoken_word';

/** Does this mode hand the judge a rule instead of an enumerated target? */
export const isOpenSet = (mode: RhymeMode): boolean => mode === 'production';

/** Structural challenge shape as the generator emits it (duck-typed so this
 *  module never imports the component — the component imports us). */
export interface RhymeChallengeLike {
  id: string;
  mode: RhymeMode;
  targetWord: string;
  targetWordEmoji?: string;
  rhymeFamily: string;
  comparisonWord?: string;
  comparisonWordEmoji?: string;
  doesRhyme?: boolean;
  options?: Array<{ word: string; image?: string; isCorrect: boolean }>;
  /** Identification only. Production is OPEN — it enumerates nothing, and a
   *  generated "acceptable answer" has demonstrably been a nonword ("NAKE"),
   *  so this must never reach a line the tutor speaks. */
  acceptableAnswers?: string[];
  tutorNamesOptions?: boolean;
}

/** "-at" → "at". The hyphen is a spelling convention; a spoken line needs the
 *  sound, and "dash at" is what a voice does with the raw field. */
export const rimeOf = (rhymeFamily: string): string =>
  rhymeFamily.trim().replace(/^-+/, '').toLowerCase();

/**
 * ⛔ `buildProductionBank` USED TO LIVE HERE, AND ITS DELETION IS THE POINT.
 *
 * It assembled the four-tile word bank that made spoken production a CLOSED
 * set — the workaround that let this primitive port to DI at all while
 * `open_set_word` was blocked. The class was benched and cleared on
 * 2026-08-19 (qa/di-bench/run-2026-08-19-open-set-word.md), so the workaround
 * has no job left.
 *
 *   USER RULING 2026-08-18: *"agree with you on rhyme studio we shouldnt need
 *   an answer bank for synthesis, trust the model."*
 *
 * Deleting it IS the proof the class works: what the child does changed from
 * READING FOUR WORDS AND SAYING ONE to THINKING OF A RHYME, which is a
 * different learning event and a Bloom tier up. Nothing renders a bank,
 * nothing generates `bankDistractors`, and `acceptableAnswers` no longer
 * reaches a spoken line — the tutor speaks no generated word in this mode
 * except the stimulus.
 */

export const itemFromChallenge = (
  ch: RhymeChallengeLike,
  tier: RhymeTier = 'medium',
): RhymeItem => {
  const mode = ch.mode;
  // Only identification has an on-screen answer surface. Production has none
  // BY CONSTRUCTION — the bank is the thing this mode now exists without — and
  // recognition never had one.
  const choices: RhymeChoice[] = mode === 'identification'
    ? (ch.options ?? [])
        .filter((o) => isSentinelSafeWord(o.word))
        .map((o) => ({ word: o.word, emoji: o.image, isCorrect: o.isCorrect }))
    : [];

  /**
   * The accepted set is EXACTLY what is on screen, in every mode.
   *
   * The first draft of this pack widened production to the generator's whole
   * `acceptableAnswers` list — a child who hears -ake and says a member of the
   * family has done the skill, and the list is code-owned, so it looked free.
   * The live probe killed it: for the target `cake` the model produced
   * "bake, lake, rake, NAKE, take", and that list is read into the judge's
   * accept clause. A closed set is only worth what its members are worth, and a
   * generated word nothing verified is not a member — it is an invented word
   * the tutor has been told to affirm. On-screen words survive the bank's own
   * checks, so the honest set is the visible one.
   */
  /**
   * ⭐ PRODUCTION ACCEPTS NOTHING BY NAME, AND THAT IS THE MODE.
   *
   * The obvious move is to hand the judge `acceptableAnswers` as EXEMPLARS
   * ("cat, bat, mat are examples, and not the only right answers"). It is the
   * wrong move, for the reason recorded four paragraphs up: the live probe for
   * the target `cake` produced "bake, lake, rake, NAKE, take", and an exemplar
   * list is read into the judge's accept clause. Closed-set exemplars smuggle
   * the closed-set failure back into the open mode — the judge would be told a
   * nonword is an example of a real word, on the one item whose entire job is
   * refusing nonwords.
   *
   * So the accept clause carries the RULE and nothing else, and the tutor
   * speaks no generated word in this mode except the stimulus itself. That is
   * the user's ruling read literally: trust the model.
   */
  const accepted = mode === 'recognition'
    // The verdict itself. Authored tokens, not generated content — the accept
    // clause widens them to the natural variants a five-year-old actually says.
    ? [ch.doesRhyme ? 'yes' : 'no']
    : mode === 'production'
      ? []
      : choices.filter((c) => c.isCorrect).map((c) => c.word);

  return {
    id: ch.id,
    mode,
    answerKind: answerKindFor(mode),
    responseClass: responseClassFor(mode),
    // Mixed sessions interleave tapping and speaking: `action` drives the
    // runner's how-to-play re-speak whenever the thing-to-do changes
    // (cvc-speller rule).
    action: mode,
    targetWord: ch.targetWord,
    targetEmoji: ch.targetWordEmoji,
    rime: rimeOf(ch.rhymeFamily),
    tier,
    comparisonWord: ch.comparisonWord,
    comparisonEmoji: ch.comparisonWordEmoji,
    doesRhyme: ch.doesRhyme,
    choices,
    acceptedWords: accepted,
    answer: accepted[0] ?? '',
    // Band floor: the generator forces this true at K. The tier may withdraw it
    // only for readers, who can read the choices off the screen instead.
    namesChoices: ch.tutorNamesOptions !== false,
  };
};

// ── The rule-model pair — code-owned, never a session word OR family ────────
// (word-flip's pickModelNoun ruling, fourth use, with one rhyme-specific
// tightening: exclusion is by FAMILY. A model pair from the -at family gives
// away every -at item in the run even though it shares no letters with them.)

const MODEL_RHYME_PAIRS: ReadonlyArray<{ pair: readonly [string, string]; rime: string }> = [
  { pair: ['bee', 'tree'], rime: 'ee' },
  { pair: ['star', 'car'], rime: 'ar' },
  { pair: ['snake', 'cake'], rime: 'ake' },
  { pair: ['moon', 'spoon'], rime: 'oon' },
  { pair: ['sock', 'rock'], rime: 'ock' },
];

export interface RhymeModelPair {
  pair: readonly [string, string];
  rime: string;
}

export const pickModelRhymePair = (
  items: ReadonlyArray<Pick<RhymeItem, 'rime' | 'targetWord' | 'comparisonWord' | 'choices'>>,
): RhymeModelPair => {
  const rimes = new Set(items.map((i) => i.rime));
  const words = new Set(
    items.flatMap((i) => [
      i.targetWord.toLowerCase(),
      (i.comparisonWord ?? '').toLowerCase(),
      ...i.choices.map((c) => c.word.toLowerCase()),
    ]),
  );
  return (
    MODEL_RHYME_PAIRS.find(
      (m) => !rimes.has(m.rime) && !m.pair.some((w) => words.has(w)),
    ) ?? MODEL_RHYME_PAIRS[0]
  );
};

// ── Small speakable helpers ─────────────────────────────────────────────────

const list = (words: string[]): string => words.join(', ');

/** Choices as the tutor enumerates them. Empty when the tier has withdrawn the
 *  enumeration (readers only — the band floor forces it on at K). */
const spokenChoices = (item: RhymeItem): string =>
  item.namesChoices ? list(item.choices.map((c) => c.word)) : '';

// ── How-to-play — inside the quoted line (SWAP-1), re-spoken on action change ─

export const howToPlayFor = (item: RhymeItem): string => {
  switch (item.mode) {
    case 'recognition':
      return 'I say two words — you tell me yes if they rhyme, or no if they do not! ';
    case 'identification':
      return 'I say a word and some choices — you say the one that rhymes! ';
    case 'production':
      // No mention of cards, a screen, or choosing: there is nothing to choose
      // from. The protocol IS "think of one and say it".
      return 'I say a word — you think of a word that rhymes with it and say it! ';
  }
};

// ── The DISTAR lead-in: composed from the SUPPORT TIER, then FADED ──────────
// di-letter-sounds' L3 rungs, fifth use — with the correction the first full
// drive forced.
//
// ⚠️ THE RULE MODEL IS ESTABLISHED ONCE, NOT RECITED EVERY ITEM.
//
//   USER RULING 2026-08-13, on session log 2026-08-13-025523-…f76f154cd898:
//   *"she asks every time 'words rhyme when they end the same way, bee tree'
//   each time, i think we can remove that after the first example"*.
//
// Eight items, eight verbatim recitations — because the tier was read as a
// property of every ITEM when it is a property of the RUN. The earlier packs
// hid the difference: di-letter-sounds and letter-sound-link model the ITEM's
// own content ("the letter m says mmm"), so re-modeling per item IS the
// teaching. Here the model is a generic RULE on a code-owned pair, identical
// every time, so the second recitation teaches nothing and the eighth is noise
// the child listens through to reach the question.
//
//   ESTABLISHING   the first ask, and the first ask of a new task identity
//                  (`opening` / `howToPlay` — the runner's own answer to "is
//                  this a teaching moment?"), plus the ask after a CAPPED miss.
//   STEADY STATE   `easy` keeps the one-line listening guide, `medium` says
//                  nothing before the ask, `hard` stays cold.
//
// The tier still sets how much support exists; what fades is the REPETITION of
// what the child was already told. The ask, the judging and the CORRECTION's
// re-model are untouched (standing gate 3) — and the rule still arrives
// wherever it is earned, because every correction line restates it in
// performable form ("listen again to the end of each word", "bake rhymes with
// cake — both end with ake").
//
// The model is safe to speak at all ONLY because it runs on the code-owned
// pair: it teaches the rule without touching the item.

const modelLine = (model: RhymeModelPair): string =>
  `Words rhyme when they end the same way. Listen: ${model.pair[0]}, ${model.pair[1]} — both end with ${model.rime}.`;

const guideLine = (): string => 'Listen hard to the end of each word.';

const leadInFor = (
  item: RhymeItem,
  model: RhymeModelPair,
  establishing: boolean,
): string => {
  if (item.tier === 'hard') return '';
  if (establishing) {
    return item.tier === 'easy'
      ? `${modelLine(model)} ${guideLine()} `
      : `${modelLine(model)} `;
  }
  return item.tier === 'easy' ? `${guideLine()} ` : '';
};

/**
 * At `hard` the tutor must not volunteer the rhyme rule or the item's rime
 * before the child answers — that is the whole point of the rung. The omitted
 * lines already withhold it, but the catalog's scaffolding levels and struggle
 * responses are a second channel that could hand it over (the tier gotcha: a
 * tier withheld by the script and revealed by the tutor is only half applied).
 */
const coldGuard = (item: RhymeItem): string =>
  item.tier === 'hard'
    ? ' The learner is answering this one cold on purpose: do not explain what rhyming is, do not say the ending sound these words share, and do not hint before they answer. '
    : ' ';

// ── The asks — short, the problem STATED aloud, one defensible answer ───────
// (drive-2 ruling: an ask must SAY its problem — a pre-reader cannot read the
// screen, and every correction re-ask inherits the ask.)
//
// EVERY SENTENCE OPENS WITH AN AUTHORED TOKEN. Generated words never sit in an
// opener slot, so a word that slipped `isSentinelSafeWord` still cannot be read
// as a verdict.

const askFor = (item: RhymeItem): string => {
  switch (item.mode) {
    case 'recognition':
      return (
        `Listen to these two words: ${item.targetWord}, ${item.comparisonWord}. `
        + `Your turn. Do ${item.targetWord} and ${item.comparisonWord} rhyme? Say yes or no.`
      );
    case 'identification': {
      const choices = spokenChoices(item);
      return choices
        ? `Listen to this word: ${item.targetWord}. Your turn. Which one rhymes with ${item.targetWord} — ${choices}? Say it out loud.`
        : `Listen to this word: ${item.targetWord}. Your turn. Which choice on the screen rhymes with ${item.targetWord}? Say it out loud.`;
    }
    case 'production':
      // The ask names ONLY the stimulus. It cannot leak an answer because it
      // does not know one — the single property that makes this the benched
      // open class (`leakTokens` is empty here for the same reason).
      return (
        `Listen to this word: ${item.targetWord}. `
        + `Your turn. Tell me a word that rhymes with ${item.targetWord}.`
      );
  }
};

// ── Corrections — DISTAR re-model then re-elicit (standing gate 3) ──────────

/**
 * Recognition corrects WITHOUT naming its answer, and that is deliberate: the
 * answer here is one bit, so saying it ends the retry before it starts. The
 * re-model is a re-direction of attention to the ends of the words — real
 * DISTAR "listen again" — and the truth is finally stated at the correction
 * cap, in `moveOnCue`, so a capped item never leaves the child with the pair
 * unresolved.
 *
 * The word modes DO name their answer here: this is the first place the answer
 * is earned, and the child still has to say it back.
 */
const correctionFor = (item: RhymeItem): string => {
  switch (item.mode) {
    case 'recognition':
      return (
        `My turn: listen again to the end of each word. `
        + `Here they are: ${item.targetWord}, ${item.comparisonWord}. `
        + `Your turn. Do ${item.targetWord} and ${item.comparisonWord} rhyme?`
      );
    case 'identification':
      return (
        `My turn: ${item.answer} rhymes with ${item.targetWord} — both end with ${item.rime}. `
        + `Your turn. Which one rhymes with ${item.targetWord}?`
      );
    case 'production':
      /**
       * ⭐ THE RE-MODEL IS THE RIME, NOT A WORD — and that is a hard
       * requirement of this mode, not a stylistic choice.
       *
       * Every other mode's correction names its answer, because the answer is
       * enumerated and code-owned. Here there is no such word: the only
       * candidates are the generator's `acceptableAnswers`, and the live probe
       * put "NAKE" in that list for the target `cake`. Modelling from it would
       * speak an invented word to a five-year-old as a correct example — on
       * the one item whose contract is about refusing invented words.
       *
       * So the correction isolates the ENDING and re-elicits. It is real
       * DISTAR ("listen to the end"), it teaches the rime rather than one
       * member of it, and it holds the mode's invariant: the tutor speaks no
       * generated word here except the stimulus.
       */
      return (
        `My turn: listen to the end of ${item.targetWord} — ${item.rime}. `
        + `Your turn. Tell me a word that ends with ${item.rime}.`
      );
  }
};

// ── Judging contracts (spoken modes) ────────────────────────────────────────

/**
 * ⭐ THE OPEN-SET ACCEPT CLAUSE — a RULE where every other mode has a LIST.
 *
 * This is the whole of "specify the problem, not the answer set". The judge is
 * told what makes an answer right and is then trusted to decide; it is never
 * handed candidates to match against, because there are none to hand it.
 *
 * Two things it must do that a list does not have to:
 *
 *   STATE THE RULE IN SOUND, NOT SPELLING. A five-year-old saying a rhyme is
 *   not spelling it, and the rime field is a spelling convention ("-at"). A
 *   judge told to check letters refuses "eight" for "gate" and accepts "cough"
 *   for "dough". The clause therefore anchors on what the ending SOUNDS like.
 *
 *   AUTHORISE THE UNEXPECTED. The failure a rule-based clause invites is a
 *   judge that quietly re-closes the set around whatever it thought of first
 *   and refuses a valid rarer word. Saying so explicitly is the difference
 *   between an open set and a closed one the judge happens to be holding.
 */
const openAcceptClause = (item: RhymeItem): string =>
  `The learner has to say a REAL word that ends with the same sound as ${item.targetWord} — the ${item.rime} sound. `
  + `Any real word that ends that way is correct, including one you did not think of yourself. `
  + `Judge the SOUND you heard, not the spelling, and a small mispronunciation from a five-year-old's mouth still counts. `;

/**
 * ⭐ THE FOUR GUARDS. The honest risk of this class is FALSE AFFIRMATION, and
 * it is not symmetric with the other kind: a missed valid rhyme costs the child
 * one more turn, while an affirmed wrong answer teaches the error. A child who
 * says "hat" back to "hat" and hears "Yes!" has been taught that a word rhymes
 * with itself.
 *
 * So the wrong clause is where this mode spends its words. Each guard names a
 * failure the closed-set modes got for free from their enumeration, and each
 * one is a scored bucket in the bench (`openSetWordBench.ts`) — the contract
 * CLAIMS these are refused, and the bench is that claim made testable. Change
 * one, change both.
 */
const openWrongClause = (item: RhymeItem): string =>
  // ECHO — the stimulus said back. The primitive's own documented signature
  // error for production, arriving here without a bank to make it impossible.
  `The word ${item.targetWord} said back is NOT correct, however confident it sounds: a word does not count as rhyming with itself. `
  // NONWORD — the failure the bank structurally prevented and the rule cannot.
  //
  // ⭐ THE NAME CLAUSE IS PART OF THIS GUARD, NOT AN EXCEPTION TO IT, and it
  // exists because the first bench run found the boundary the hard way.
  //
  // The run's only apparent false affirmation was "zell" for "bell" — filed in
  // the bench's nonword bucket, affirmed by the judge, and it blocked the class.
  // Zell is a SURNAME. The judge was defensible and the KEY was wrong; the bench
  // had committed the exact error its own test file warns about.
  //
  // Following it through changed the contract rather than the key: a child who
  // answers "Bill" for "hill" or "Matt" for "hat" HAS DONE THE SKILL, and a
  // clause that refuses names to be safe about nonwords fails real answers to
  // catch invented ones. So names are named as acceptable, and the guard is
  // aimed where it belongs — at strings that are not words at all.
  + `A made-up word is NOT correct. If what you heard is not a real word you know, it is wrong even though it ends the right way. `
  + `A person's NAME is a real word here and counts: "Bill" rhymes with "hill". Refuse invented nonsense, never a name. `
  // ONSET-ONLY — confusing rhyme with alliteration, this primitive's signature
  // misconception, and the one a "sounds similar to ${item.targetWord}" judge
  // waves through.
  + `A word that only STARTS like ${item.targetWord} is NOT correct — the ENDING is the part that has to match. `
  // OFF-TASK — the turn that is not an answer at all. Without this the judge
  // has no scripted branch for "I don't know" and improvises one.
  + `If you did not hear a word, or the learner says they do not know, that is not an answer — treat it as wrong and run the correction. `;

const acceptClauseFor = (item: RhymeItem): string => {
  if (item.mode === 'production') return openAcceptClause(item);
  if (item.mode === 'recognition') {
    // `yes_no` carries the VC-length worry as LATITUDE. A five-year-old asked
    // "do they rhyme?" says "yeah", "uh huh", "nope", "they don't" at least as
    // often as the bare word, and refusing those would fail the child for
    // diction rather than for the skill.
    const right = item.doesRhyme ? 'YES' : 'NO';
    const variants = item.doesRhyme
      ? '"yes", "yeah", "uh huh", "they do", or a plain nod of a word'
      : '"no", "nope", "uh uh", "they don\'t", or any clear refusal';
    return (
      `The correct answer is ${right}. Anything that plainly means ${right} counts — ${variants}. `
      + `Judge the MEANING of what you heard, not the exact word. `
    );
  }
  return (
    `Any of these count: ${list(item.acceptedWords)}. `
    + `A small mispronunciation from a five-year-old's mouth still counts. `
  );
};

const wrongClauseFor = (item: RhymeItem): string => {
  if (item.mode === 'production') return openWrongClause(item);
  if (item.mode === 'recognition') {
    return (
      `Anything that plainly means ${item.doesRhyme ? 'NO' : 'YES'} is wrong. `
      + `If the learner only repeats a word back, or says something you cannot read as yes or no, `
      + `that is not an answer — treat it as wrong and run the correction. `
    );
  }
  const wrong = item.choices.filter((c) => !c.isCorrect).map((c) => c.word);
  return (
    (wrong.length ? `These do NOT rhyme with ${item.targetWord}: ${list(wrong)}. ` : '')
    + `The word ${item.targetWord} said back is NOT the answer either, however confident it sounds. `
  );
};

/** The affirmation. It opens with the "Yes," sentinel in EVERY mode — including
 *  when it affirms a child who correctly answered "no", where "Yes" means *you
 *  are right*, the DISTAR sense. The engine classifies the verdict from that
 *  opener; a tutor that says "Correct!" instead emits no verdict at all and the
 *  run goes deaf (observed live, port-8 session log). */
const affirmFor = (item: RhymeItem): string =>
  item.mode === 'recognition'
    ? (item.doesRhyme
        ? `Yes, ${item.targetWord} and ${item.comparisonWord} rhyme — both end with ${item.rime}.`
        : `Yes, ${item.targetWord} and ${item.comparisonWord} do not rhyme.`)
    /**
     * ⭐ THE FIRST AFFIRMATION IN THE FAMILY THAT CANNOT NAME THE ANSWER.
     *
     * Every other mode's affirm says the word back ("Yes, bake rhymes with
     * cake") because the word is known before the child speaks. Here it is not,
     * so the obvious line — "Yes, <what you said> rhymes with cake" — would
     * make the contract a TEMPLATE rather than a say-exactly line, and the
     * family's exact-line oracles (`DiDriveItem.affirmLine`, the harness's
     * scripted-line comparison) would have to go soft for every open item.
     *
     * "that" carries the deixis instead, and the affirmation still teaches:
     * the rime is named at the moment it is earned, which is exactly where
     * every other mode names it. The line stays byte-fixed, so nothing
     * downstream needs an exception for this class.
     */
    : item.mode === 'production'
      ? `Yes, that rhymes with ${item.targetWord} — both end with ${item.rime}.`
      : `Yes, ${item.answer} rhymes with ${item.targetWord}.`;

/**
 * ⭐ THE ECHO NEEDS ITS OWN SCRIPTED LINE, AND THE FIRST LIVE PILOT DRIVE PROVED
 * IT — this is a stall the child would have hit, not a bench artifact.
 *
 * The generic correction re-models the RIME ("listen to the end of dog — og"),
 * which is the right move for a wrong rhyme and a NON-SEQUITUR for a child who
 * said the target straight back. So the tutor did the sensible thing and went
 * off script — *"A word does not rhyme with itself in this game."* Correct
 * teaching, correct refusal, and it opens with neither sentinel, so the engine
 * read NO VERDICT and the loop stalled. It happened on **5 of 9 items** in one
 * drive, always on the first correction.
 *
 * That is not a rare edge: the echo is this mode's documented signature error,
 * and removing the word bank made it likelier (there is no menu to pick from,
 * so "say the word back" is the cheapest wrong answer available).
 *
 * The judge knows which error it heard, so it gets a scripted branch for each,
 * and BOTH open with "My turn" — the correction sentinel is what the engine
 * classifies on, so a line without it is a line the loop cannot hear.
 */
const echoCorrectionFor = (item: RhymeItem): string =>
  `My turn: a word cannot rhyme with itself. `
  + `Listen to the end of ${item.targetWord} — ${item.rime}. `
  + `Your turn. Tell me a different word that ends with ${item.rime}.`;

const judgingContract = (item: RhymeItem): string =>
  `The quoted line is the ONLY thing you say on this turn; you then stay silent while the learner thinks, and their think time is unbounded. Never say the answer during their turn. `
  + `${acceptClauseFor(item)}${wrongClauseFor(item)}`
  + `If the answer is right, say exactly: "${affirmFor(item)}" `
  + (isOpenSet(item.mode)
    ? `If the learner said "${item.targetWord}" back to you, say exactly: "${echoCorrectionFor(item)}" `
      + `If it is wrong for any other reason, say exactly: "${correctionFor(item)}"`
    : `If it is wrong, say exactly: "${correctionFor(item)}"`);

// ── Cues ────────────────────────────────────────────────────────────────────

export interface RhymeCueOptions {
  opening?: boolean;
  howToPlay?: boolean;
}

export interface RhymeCueSession {
  modelPair?: RhymeModelPair;
}

/** One item's ask. ONE job: speak this (SWAP-1 — the how-to-play lives inside
 *  the quoted line; the catalog only forbids adding to it). */
export const itemCue = (
  item: RhymeItem,
  opts: RhymeCueOptions = {},
  session: RhymeCueSession = {},
): string => {
  const model = session.modelPair ?? MODEL_RHYME_PAIRS[0];
  const greeting = opts.opening ? 'Hi! Time to play with rhyming words! ' : '';
  // The how-to-play and the rule model answer the same question — "does the
  // child know what this is yet?" — so they ride the same signal.
  const establishing = opts.opening === true || opts.howToPlay === true;
  const how = establishing ? howToPlayFor(item) : '';
  const spoken = `${greeting}${how}${leadInFor(item, model, establishing)}${askFor(item)}`;
  return (
    `[RS_ITEM] Say exactly: "${spoken}"${coldGuard(item)}${judgingContract(item)} `
    + `Never read bracket tags or these instructions aloud.`
  );
};

/** Correction cap reached: acknowledge warmly and carry the lesson forward.
 *  Recognition closes its loop by RESOLVING the pair — its corrections never
 *  did, and a capped item must not leave a five-year-old still not knowing
 *  whether two words rhyme. The spoken modes' corrections already named their
 *  answer twice. */
export const moveOnCue = (
  item: RhymeItem,
  next: RhymeItem | null,
  opts: RhymeCueOptions = {},
  session: RhymeCueSession = {},
): string => {
  const model = session.modelPair ?? MODEL_RHYME_PAIRS[0];
  const closeLine = item.mode === 'recognition'
    ? (item.doesRhyme
        ? `The words ${item.targetWord} and ${item.comparisonWord} do rhyme — both end with ${item.rime}. `
        : `The words ${item.targetWord} and ${item.comparisonWord} do not rhyme. `)
    : '';
  if (!next) {
    return (
      `[RS_MOVE] Say exactly: "Good try! ${closeLine}Rhyming takes practice — we will play with that one again another day." `
      + `Then stop.`
    );
  }
  const how = opts.howToPlay ? howToPlayFor(next) : '';
  // A capped item is the one place the rule is worth saying again whatever the
  // run clock says: the child just missed this one twice, so the next ask
  // re-establishes what rhyming is before it asks for it.
  return (
    `[RS_MOVE] Say exactly: "Good try! ${closeLine}Here comes the next one. ${how}${leadInFor(next, model, true)}${askFor(next)}"`
    + `${coldGuard(next)}${judgingContract(next)} Never read bracket tags aloud.`
  );
};

export const completeCue = (): string =>
  `[RS_COMPLETE] Say exactly: "What wonderful rhyming work today! Your ears are getting sharp at hearing how words end. See you next time!" Then stop — the activity is over.`;

/** Tap-to-hear re-speaks the QUESTION, never the answer. The words themselves
 *  ARE the question in every mode here, so they are repeated in full — but the
 *  rime is never named and the choices are re-listed only where the tier
 *  already allows the tutor to name them. */
export const pronounceCue = (item: RhymeItem): string => {
  const line = (() => {
    switch (item.mode) {
      case 'recognition':
        return (
          `Listen to these two words: ${item.targetWord}, ${item.comparisonWord}. `
          + `Do ${item.targetWord} and ${item.comparisonWord} rhyme? Say yes or no.`
        );
      case 'identification': {
        const choices = spokenChoices(item);
        return choices
          ? `Listen to this word: ${item.targetWord}. Which one rhymes with ${item.targetWord} — ${choices}?`
          : `Listen to this word: ${item.targetWord}. Which choice on the screen rhymes with ${item.targetWord}?`;
      }
      case 'production':
        return (
          `Listen to this word: ${item.targetWord}. `
          + `Tell me a word that rhymes with ${item.targetWord}.`
        );
    }
  })();
  return (
    `[RS_HEAR] The learner tapped to hear the question again. Say ONLY this, warmly, then wait: "${line}" `
    + `Do not treat anything you just heard as an answer, add nothing, and never say which words rhyme. Never read bracket tags aloud.`
  );
};

/** Runtime state pushed through the context channel — STIMULUS-SIDE ONLY
 *  (di-math-facts rule). The rime is never pushed in any mode: it names the
 *  family, and the family IS the answer in identification and production and
 *  the whole question in recognition. */
export const stimulusFor = (item: RhymeItem): string => {
  switch (item.mode) {
    case 'recognition':
      return `the two words ${item.targetWord} and ${item.comparisonWord}`;
    case 'identification':
      return `the word ${item.targetWord}, with choices on screen`;
    case 'production':
      // No "on screen" clause: naming a surface the child cannot answer from
      // is how a tutor starts telling them to look at, or pick from, nothing.
      return `the word ${item.targetWord}`;
  }
};

// ── The cue surface — ONE declaration, spread by both consumers ─────────────

/**
 * Everything of this pack that can reach the tutor, in one place.
 *
 * Two consumers now read it: `RhymeStudio.tsx` (which spreads it and adds the
 * component-owned half — status lines, diagnosis observation) and the DI drive
 * adapter in `service/qa/di/diDrivePlan.ts`, which serializes the loop for the
 * headless harness. A harness that re-typed these cues would test a fiction —
 * the exact drift 19f found on both sides of letter-spotter's wire — so the
 * cue surface is declared here and nowhere else.
 *
 * `modelPair` is bound at construction because `itemCue`/`moveOnCue` carry the
 * session's code-owned rule model, which is chosen from the run's items and so
 * cannot live on an item.
 */
export const rhymeStudioPackBase = (
  items: RhymeItem[],
  modelPair: RhymeModelPair = pickModelRhymePair(items),
): JudgedCueSurface<RhymeItem> => ({
  primitiveType: 'rhyme-studio',
  activityLine: 'live direct instruction rhyming practice',
  items,
  itemCue: (item, opts) => itemCue(item, opts, { modelPair }),
  moveOnCue: (item, next, opts) => moveOnCue(item, next, opts, { modelPair }),
  completeCue,
  pronounceCue,
  contextFor: (item) => ({
    challengeMode: item.mode,
    stimulus: stimulusFor(item),
  }),
});

// ── Harness answer material — what a right and a wrong child sound like ─────

/**
 * The answers a headless student says on a judged drive, for the CLOSED modes.
 * It lives beside the contract it mirrors because `judgingContract` CLAIMS the
 * judge refuses each of these; this is that claim made testable.
 *
 * ⚠️ PRODUCTION IS DELIBERATELY ABSENT, and that absence is the point. Its
 * answer material cannot be derived from the item: the only candidate words
 * are the generator's `acceptableAnswers`, and the live probe put "NAKE" in
 * that list for the target `cake`. A harness that took its `correct` from
 * there would expect an AFFIRM on a nonword and would score the judge's
 * correct REFUSAL as a failure — a bench whose key is wrong is worse than no
 * bench. Open-set material is HAND-AUTHORED per stimulus in
 * `service/qa/di/openSetWordBench.ts`, which is also where the scored buckets
 * live.
 */
export const rhymeStudioHarnessAnswers = (item: RhymeItem) => {
  if (item.mode === 'recognition') {
    const right = item.doesRhyme ? 'yes' : 'no';
    return {
      correct: right,
      plainWrong: item.doesRhyme ? 'no' : 'yes',
      signatureWrong: {
        text: item.targetWord,
        why:
          'the stimulus word repeated back instead of a verdict — the contract names this miss by name '
          + '("if the learner only repeats a word back… treat it as wrong"), and it is what a judge '
          + 'grading on "did I hear something relevant" waves through',
      },
      // "yes" and "no" are tokens the ask MUST contain to be a question, and
      // the tutor's own affirm sentinel is literally "Yes" — a leak oracle here
      // would fire every turn and mean nothing. Discrimination carries this mode.
      leakTokens: [] as string[],
    };
  }

  const wrong = item.choices.find((c) => !c.isCorrect);
  return {
    correct: item.answer,
    plainWrong: wrong?.word ?? item.targetWord,
    signatureWrong: {
      text: item.targetWord,
      why:
        'the target said straight back. A word rhymes with itself only trivially and the ask is for a '
        + 'DIFFERENT word; the contract names it explicitly ("however confident it sounds")',
    },
    // The choices are enumerated in the ask wherever the tier lets the tutor
    // name them, so the answer sits inside the question by construction there.
    leakTokens: item.namesChoices ? [] : item.acceptedWords,
  };
};
