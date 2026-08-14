/**
 * rhymeStudioScript — HAND-AUTHORED judged-loop script for rhyme-studio
 * (EIGHTH literacy DI port; qa/di/BACKLOG.md item 16). The exact wording IS the
 * pedagogy; these lines are authored per pack, never generated. Item CONTENT
 * (which words, which families, which distractors) stays generator-scoped; this
 * module owns the cue shapes, the tier ladder and the in-band judging contracts.
 *
 * ── THE BENCH, ANSWERED BY THE BANK ─────────────────────────────────────────
 * This primitive sat behind a bench sitting longer than any other literacy
 * surface, for one reason: `open_set_word` is a BLOCKED response class and
 * "tell me a word that rhymes with cat" is the canonical open set. The port is
 * possible because the shipped `production` mode was never open — it renders a
 * FOUR-TILE WORD BANK and the child taps one. The bank looked like scaffolding
 * to delete on the way to DI; it is in fact the thing that makes the mode
 * sayable at all. Delete it and the mode becomes a blocked class; keep it and
 * the child produces a rhyme ALOUD from a closed, code-enumerable set.
 *
 * So the bench is not cleared here and nothing pretends it is. What ships is
 * CONSTRAINED production (the generator's own long-standing name for the
 * remediation move); free production stays behind `open_set_word` and the
 * sitting it is owed. The concrete question that sitting must answer is now
 * sharp: can the judge hear an arbitrary child-invented rhyme, off any menu?
 *
 * ── THE SPLIT — EVERY MODE IS SPOKEN ────────────────────────────────────────
 *
 *   recognition    the answer is a JUDGMENT  → VOICE `yes_no`
 *   identification the answer is a WORD      → VOICE `short_spoken_word`
 *   production     the answer is a WORD      → VOICE `short_spoken_word`
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

import type { JudgedScriptItem, ResponseClassId } from '../../../hooks/judgedScriptContract';

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

/** Standing gate 1: identification and production produce one short word from a
 *  closed per-item set (benched); recognition produces a verdict (`yes_no`,
 *  accepted-build-ahead on the user's ruling). FREE production would be
 *  `open_set_word` (BLOCKED) — the word bank is what keeps it out of this pack. */
export const responseClassFor = (mode: RhymeMode): ResponseClassId =>
  mode === 'recognition' ? 'yes_no' : 'short_spoken_word';

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
  acceptableAnswers?: string[];
  bankDistractors?: string[];
  productionCorrectCount?: number;
  tutorNamesOptions?: boolean;
}

/** "-at" → "at". The hyphen is a spelling convention; a spoken line needs the
 *  sound, and "dash at" is what a voice does with the raw field. */
export const rimeOf = (rhymeFamily: string): string =>
  rhymeFamily.trim().replace(/^-+/, '').toLowerCase();

/**
 * The production word bank, built in CODE from the generator's content.
 *
 * The bank is the item's closed answer set, so its composition is a gate, not a
 * detail: `productionCorrectCount` (support tier #5) decides how many of the
 * four tiles rhyme, a correct tile is ALWAYS present, and every word passes the
 * sentinel filter before it can reach a spoken line. Deterministic given the
 * order the generator emitted — no shuffle here, because a bank that re-rolls
 * on re-render would desynchronise the tutor's enumerated ask from the screen.
 */
export const buildProductionBank = (ch: RhymeChallengeLike): RhymeChoice[] => {
  const correctTake = Math.max(1, ch.productionCorrectCount ?? 2);
  const accepted = (ch.acceptableAnswers ?? []).filter(isSentinelSafeWord);
  const distractors = (ch.bankDistractors ?? []).filter(
    (w) => isSentinelSafeWord(w) && w.toLowerCase() !== ch.targetWord.toLowerCase(),
  );
  const correct = accepted.slice(0, correctTake);
  const wrong = distractors.slice(0, Math.max(0, 4 - correct.length));
  // Interleave rather than shuffle: the correct tiles must not cluster at the
  // front (position would become the answer) and the order must be stable.
  const bank: RhymeChoice[] = [];
  const longest = Math.max(correct.length, wrong.length);
  for (let i = 0; i < longest; i++) {
    if (wrong[i]) bank.push({ word: wrong[i], isCorrect: false });
    if (correct[i]) bank.push({ word: correct[i], isCorrect: true });
  }
  return bank;
};

export const itemFromChallenge = (
  ch: RhymeChallengeLike,
  tier: RhymeTier = 'medium',
): RhymeItem => {
  const mode = ch.mode;
  const choices: RhymeChoice[] = mode === 'identification'
    ? (ch.options ?? [])
        .filter((o) => isSentinelSafeWord(o.word))
        .map((o) => ({ word: o.word, emoji: o.image, isCorrect: o.isCorrect }))
    : mode === 'production'
      ? buildProductionBank(ch)
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
  const accepted = mode === 'recognition'
    // The verdict itself. Authored tokens, not generated content — the accept
    // clause widens them to the natural variants a five-year-old actually says.
    ? [ch.doesRhyme ? 'yes' : 'no']
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
      return 'I say a word and some word cards — you say a card that rhymes! ';
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
    case 'production': {
      const choices = spokenChoices(item);
      return choices
        ? `Listen to this word: ${item.targetWord}. Your turn. Which card rhymes with ${item.targetWord} — ${choices}? Say it out loud.`
        : `Listen to this word: ${item.targetWord}. Your turn. Say the card on the screen that rhymes with ${item.targetWord}.`;
    }
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
      return (
        `My turn: ${item.answer} rhymes with ${item.targetWord} — both end with ${item.rime}. `
        + `Your turn. Which card rhymes with ${item.targetWord}?`
      );
  }
};

// ── Judging contracts (spoken modes) ────────────────────────────────────────

const acceptClauseFor = (item: RhymeItem): string => {
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
    : `Yes, ${item.answer} rhymes with ${item.targetWord}.`;

const judgingContract = (item: RhymeItem): string =>
  `The quoted line is the ONLY thing you say on this turn; you then stay silent while the learner thinks, and their think time is unbounded. Never say the answer during their turn. `
  + `${acceptClauseFor(item)}${wrongClauseFor(item)}`
  + `If the answer is right, say exactly: "${affirmFor(item)}" `
  + `If it is wrong, say exactly: "${correctionFor(item)}"`;

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
      case 'production': {
        const choices = spokenChoices(item);
        return choices
          ? `Listen to this word: ${item.targetWord}. Which card rhymes with ${item.targetWord} — ${choices}?`
          : `Listen to this word: ${item.targetWord}. Which card on the screen rhymes with ${item.targetWord}?`;
      }
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
      return `the word ${item.targetWord}, with word cards on screen`;
  }
};
