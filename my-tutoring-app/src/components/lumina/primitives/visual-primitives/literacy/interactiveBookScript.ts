/**
 * interactiveBookScript — HAND-AUTHORED judged-loop script for interactive-book
 * (FOURTEENTH literacy DI port; qa/di/BACKLOG.md item 16). The exact wording IS
 * the pedagogy; these lines are authored per pack, never generated. Item CONTENT
 * (which book, which sentences, which features) stays generator-scoped; this
 * module owns the cue shapes, the build gates, and the judging contracts.
 *
 * WHAT THE PORT REPLACED. This was the last literacy surface on the push-to-talk
 * capture hook — a standing open-mic doctrine violation: the child had to tap a
 * mic, answer into a closed window, and a miss fell back to TAPPING THE GLOWING
 * WORD, which completes an oral-reading task without reading anything (the
 * costume test kills that fallback outright). Around it sat a voice-mode fork, a
 * read-advance delay timer, a three-attempt reveal-and-lock ladder, free page
 * navigation that could strand the child on the wrong page mid-question, and
 * seven improvised tutor sends. All gone. Progression now has exactly one
 * cause: the tutor's verdict.
 *
 * ── THE ANSWER-MATERIAL FORK (skill step 1 — the table picture) ─────────────
 *
 *   read-focus-word  the tutor reads a book sentence up to one glowing word and
 *                    STOPS; the child READS that word out loud → VOICE,
 *                    `short_spoken_word` (benched: sound-swap 9/9, word-flip
 *                    5/5, and shipped four times since). At a table this is
 *                    shared reading, the most spoken thing a teacher and a
 *                    five-year-old do — there is no button in that picture.
 *
 *   find-feature     the child locates a PRINTED BOOK PART — title, author,
 *                    heading, caption, page number → GESTURE, `manipulation`.
 *                    At a table the teacher says "show me the title" and the
 *                    child POINTS AT THE PAGE (concepts-of-print assessment is
 *                    literally administered by pointing). The answer is WHICH
 *                    printed element it is — a POSITION on the page. Saying the
 *                    title's words aloud would be READING it, a different and
 *                    harder skill than knowing where a title lives; a pre-reader
 *                    can find the title without being able to read it, and that
 *                    is the skill this mode measures. The screen IS the page.
 *
 * ── ANSWER-LEAK RULES, WHICH DIFFER PER MODE ────────────────────────────────
 *  - read-focus-word: the word is PRINTED and glowing — that is the mode; the
 *    child decodes print. The leak lives on the AUDIO channel: the tutor must
 *    never speak the word before a verdict. The ask carries the lead-in and
 *    stops; tap-to-hear re-speaks lead + instruction only. The signature error
 *    is the CONTEXT GUESS — a word that fits the sentence, said fluently,
 *    produced from the story instead of the print — and the contract names it.
 *    A near-synonym is wrong for the same reason: the task is reading THIS
 *    printed word, not naming its idea.
 *  - find-feature: every candidate feature is printed on the page — that is the
 *    question side, like the letter grid in find-it. What the tutor must never
 *    do pre-verdict is read any printed text aloud (a child who hears "Pond
 *    Neighbors" can match the sound to the biggest words without knowing what a
 *    title is) or hint at position. The CORRECTION re-models the feature's JOB
 *    — "a caption is the little line right beside the picture" — which is the
 *    teaching move for print concepts, exactly as naming both cases is
 *    match-it's: feature knowledge IS job-plus-place knowledge, and the child
 *    still has to map that description onto this page's print. The affirm reads
 *    the found text aloud as the reveal payoff (reveal-on-affirm).
 *
 * Sentinels are the engine defaults ("Yes" / "My turn"), collision-checked by
 * validateJudgedScriptPack in this pack's test file. Generated text (feature
 * texts, sentence leads, focus words) is interpolated into spoken cues, so the
 * build gates DROP anything that would open a spoken sentence with a sentinel,
 * refuse verdict-shaped focus words ("yes"/"no"), and refuse embedded double
 * quotes — a stray `"` closes the `Say exactly: "…"` span and turns the rest of
 * the line into judge-side prose. The GENERATOR imports these same gates from
 * this module (decodable-reader/letter-spotter precedent): hand-synced copies
 * drifted live once already (90 vs 100 chars), so both sides of the wire read
 * one address.
 */

import type { JudgedScriptItem, ResponseClassId } from '../../../hooks/judgedScriptContract';
import { opensWithSentinel, type JudgedCueSurface } from '../../../hooks/judgedScriptContract';

// Re-exported so the generator imports its build gates from ONE address.
export { opensWithSentinel };

export type InteractiveBookDiMode = 'find-feature' | 'read-focus-word';

/** The five findable print features. `focus-word` is the READ mode's material,
 *  never a find-feature target. */
export type InteractiveBookFeature = 'title' | 'author' | 'heading' | 'caption' | 'page-number';

/** How the tutor SAYS each feature. One spoken name per feature, invariant —
 *  a rotating vocabulary for the same slot is the letter-spotter emoji defect. */
export const FEATURE_SPOKEN: Record<InteractiveBookFeature, string> = {
  title: 'title',
  author: "author's name",
  heading: 'heading',
  caption: 'picture caption',
  'page-number': 'page number',
};

// ── The item ────────────────────────────────────────────────────────────────

export interface InteractiveBookItem extends JudgedScriptItem {
  mode: InteractiveBookDiMode;
  /** Which book view the stage shows for this item ('cover' or a page id).
   *  The screen follows the lesson — there is no free navigation to wander
   *  off it. */
  targetPageId: string;
  /** find-feature: the printed text of the target element — the CODE-COMPUTED
   *  match key, spoken only after a verdict. read-focus-word: the glowing
   *  word — the answer, never spoken before a verdict. */
  targetText: string;
  /** find-feature only. */
  feature?: InteractiveBookFeature;
  /** read-focus-word: the sentence up to the glowing word, spoken by the tutor. */
  readLead?: string;
  /** read-focus-word: the printed continuation after the word. Spoken only
   *  inside the affirm/correction, where the completed sentence is the model. */
  readTail?: string;
}

/** The table picture, per mode: shared reading is SPOKEN; "show me the title"
 *  is answered by pointing at the page. Nothing else gets to choose. */
export const answerKindFor = (mode: InteractiveBookDiMode): 'voice' | 'gesture' =>
  mode === 'read-focus-word' ? 'voice' : 'gesture';

/** Standing gate 1: the spoken mode is a benched short word; a tap is a
 *  `manipulation`. */
export const responseClassFor = (mode: InteractiveBookDiMode): ResponseClassId =>
  mode === 'read-focus-word' ? 'short_spoken_word' : 'manipulation';

// ── Build gates — DROP an unaskable item, never repair it into one ──────────

/** Structural challenge shape as the generator emits it (duck-typed so this
 *  module never imports the component — the component imports us). */
export interface InteractiveBookChallengeLike {
  id: string;
  type: string;
  targetPageId: string;
  targetFeature: string;
  targetText: string;
  optionTexts?: string[];
  readLead?: string;
  readTail?: string;
}

/** One breath for a spoken lead-in (letter-spotter's benched-by-drive bound —
 *  the stricter of the two copies that once disagreed across the wire). */
export const MAX_LEAD_CHARS = 90;
/** A one-word lead ("A —") is not an oral cloze, it is a headless fragment:
 *  the child gets no sentence context to hold the word's place in. */
export const MIN_LEAD_WORDS = 2;
/** A focus word is ONE sayable token. The cap is the letter-spotter babble
 *  gate: an unbounded string field can arrive as model deliberation that
 *  passes every semantic check. */
export const MAX_WORD_CHARS = 12;
/** Feature text rides inside spoken affirm/verdict lines — keep it a phrase. */
export const MAX_FEATURE_CHARS = 40;

/** Words that are their own verdict class: a focus word the child answers with
 *  "yes"/"no" hands an affirmation-shaped utterance to a judge listening for a
 *  short word (decodable-reader's rule, same reason). */
const VERDICT_WORDS: ReadonlySet<string> = new Set(['yes', 'yeah', 'no', 'nope']);

const wordsIn = (text: string): number =>
  text.trim() ? text.trim().split(/\s+/).length : 0;

/** No double quotes (they close the `Say exactly: "…"` span early) and no
 *  underscores (blank markers read aloud). */
const speakableText = (text: string): boolean =>
  text.trim().length > 0 && !/["“”_]/.test(text);

export const isSayableWord = (word: string): boolean =>
  new RegExp(`^[a-z]{1,${MAX_WORD_CHARS}}$`, 'i').test(word.trim());

export const isSayableLead = (lead: string): boolean =>
  speakableText(lead)
  && lead.trim().length <= MAX_LEAD_CHARS
  && wordsIn(lead) >= MIN_LEAD_WORDS;

/** Feature text as spoken in a verdict line: short, quote-free, and holding no
 *  sentence-ending mark — it is interpolated mid-sentence, and an embedded "."
 *  would split the spoken line where the sentinel scan classifies openers. */
export const isSayableFeatureText = (text: string): boolean =>
  speakableText(text)
  && text.trim().length <= MAX_FEATURE_CHARS
  && wordsIn(text) <= 4
  && !/[.!?]/.test(text);

const isFeature = (value: string): value is InteractiveBookFeature =>
  value in FEATURE_SPOKEN;

const wholeWordIn = (text: string, word: string): boolean => {
  const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(^|[^A-Za-z])${escaped}([^A-Za-z]|$)`, 'i').test(text);
};

/**
 * One judged item, or null when the challenge cannot be ASKED. Nothing here
 * backfills: a placeholder in a judged loop becomes a spoken ask the tutor must
 * stand behind, so a broken item is dropped and the session runs shorter.
 *
 * The gates, and what each one refuses:
 *  - find-feature needs a known feature, a sayable target text, and options
 *    (the page's printed candidates) that contain the target EXACTLY once —
 *    two elements printing the same text is one question with two right
 *    answers, and zero is a question with none. A one-candidate page is a
 *    costume (nothing to discriminate).
 *  - read-focus-word needs a sayable single-token word that is not a verdict
 *    word, a lead of at least two words the tutor can say in one breath, and
 *    the word must not appear inside the lead or the tail — the print-exactly-
 *    once contract re-checked at the seam it protects.
 *  - nothing generated may open a spoken sentence with a sentinel token.
 */
export const itemFromChallenge = (
  ch: InteractiveBookChallengeLike,
): InteractiveBookItem | null => {
  const targetText = (ch.targetText ?? '').trim();
  if (!targetText || !ch.targetPageId) return null;

  if (ch.type === 'read-focus-word') {
    const readLead = (ch.readLead ?? '').trim();
    const readTail = (ch.readTail ?? '').trim();
    if (!isSayableWord(targetText)) return null;
    if (VERDICT_WORDS.has(targetText.toLowerCase())) return null;
    if (!isSayableLead(readLead)) return null;
    if (readTail && /["“”_]/.test(readTail)) return null;
    if (readTail.length > MAX_LEAD_CHARS) return null;
    if (opensWithSentinel(readLead) || opensWithSentinel(targetText)) return null;
    if (wholeWordIn(readLead, targetText) || wholeWordIn(readTail, targetText)) return null;
    return {
      id: ch.id,
      mode: 'read-focus-word',
      answerKind: 'voice',
      responseClass: 'short_spoken_word',
      action: 'read-focus-word',
      targetPageId: ch.targetPageId,
      targetText: targetText.toLowerCase(),
      readLead,
      readTail,
    };
  }

  if (ch.type !== 'find-feature') return null;
  if (!isFeature(ch.targetFeature)) return null;
  if (!isSayableFeatureText(targetText)) return null;
  if (opensWithSentinel(targetText)) return null;

  const options = (ch.optionTexts ?? []).map((o) => (o ?? '').trim()).filter(Boolean);
  if (options.length < 2) return null;
  if (!options.every((o) => isSayableFeatureText(o) && !opensWithSentinel(o))) return null;
  const normalized = options.map((o) => o.toLowerCase());
  if (new Set(normalized).size !== options.length) return null;
  if (normalized.filter((o) => o === targetText.toLowerCase()).length !== 1) return null;

  return {
    id: ch.id,
    mode: 'find-feature',
    answerKind: 'gesture',
    responseClass: 'manipulation',
    action: 'find-feature',
    targetPageId: ch.targetPageId,
    targetText,
    feature: ch.targetFeature,
  };
};

/** Build the session, dropping what cannot be asked. */
export const itemsFromChallenges = (
  challenges: InteractiveBookChallengeLike[],
): InteractiveBookItem[] =>
  challenges
    .map((ch) => itemFromChallenge(ch))
    .filter((item): item is InteractiveBookItem => item !== null);

/** The generator's side of the same gate — one address, both sides of the wire. */
export const challengeAskable = (ch: InteractiveBookChallengeLike): boolean =>
  itemFromChallenge(ch) !== null;

// ── Small speakable helpers ─────────────────────────────────────────────────

const featureSpoken = (item: InteractiveBookItem): string =>
  FEATURE_SPOKEN[item.feature ?? 'title'];

/**
 * The sentence made whole again — lead, word, tail, joined the way print joins
 * them (a tail that begins with punctuation closes straight onto the word).
 * Spoken ONLY after a verdict: it is the affirm's payoff and the correction's
 * re-model, never part of the ask.
 */
export const fullSentenceOf = (item: InteractiveBookItem): string => {
  const tail = item.readTail ?? '';
  const joined = !tail
    ? `${item.readLead} ${item.targetText}`
    : /^[.!?,;:]/.test(tail)
      ? `${item.readLead} ${item.targetText}${tail}`
      : `${item.readLead} ${item.targetText} ${tail}`;
  return /[.!?]$/.test(joined) ? joined : `${joined}.`;
};

// ── How-to-play — inside the quoted line (SWAP-1), re-spoken on action change ─

export const howToPlayFor = (item: InteractiveBookItem): string => {
  switch (item.mode) {
    case 'find-feature':
      return 'This is our picture book! I name a book part — you find it on the page and tap it! ';
    case 'read-focus-word':
      return 'I read our book out loud, and I stop at one glowing word. You read that word to me! ';
  }
};

// ── The asks — short, the problem STATED aloud, one defensible answer ───────
// (A pre-reader cannot read the screen, and every correction re-ask inherits
// the ask.) Both asks carry varying content — the feature name, the sentence
// lead — so consecutive same-action items never recite a byte-identical line.

export const askFor = (item: InteractiveBookItem): string => {
  switch (item.mode) {
    case 'find-feature':
      return `Find the ${featureSpoken(item)}. Your turn. Tap the ${featureSpoken(item)}.`;
    case 'read-focus-word':
      // The lead hangs unfinished and "hmm" is the audible blank — the oral
      // cloze stated aloud. The word itself is never in this line.
      return `Listen: ${item.readLead} — hmm. Your turn. Read the glowing word.`;
  }
};

// ── Verdict lines ───────────────────────────────────────────────────────────

/** Affirmations open "Yes," (engine sentinel). The reading affirm completes the
 *  sentence — the word back in its home, read fluently, is the payoff and the
 *  model (di-sentence-reading's restate rule). The feature affirm READS the
 *  found text aloud: reveal-on-affirm, and the first time any printed book text
 *  is spoken. */
export const affirmFor = (item: InteractiveBookItem): string => {
  switch (item.mode) {
    case 'find-feature':
      return `Yes, that is the ${featureSpoken(item)} — it says ${item.targetText}!`;
    case 'read-focus-word':
      return `Yes, ${item.targetText}! ${fullSentenceOf(item)}`;
  }
};

/**
 * Corrections open "My turn:", re-model, re-elicit (standing gate 3) — and what
 * each may model follows the answer-material arithmetic:
 *  - read-focus-word NAMES the word. Model-lead-test is the DISTAR word-reading
 *    correction (decodable-reader's readingContract does the same for a whole
 *    line): the tutor models the word inside its completed sentence and the
 *    child re-reads it with the print in front of them. The echo read IS the
 *    correction move for oral reading; withholding the word would leave a stuck
 *    reader stuck.
 *  - find-feature re-models the feature's JOB — what a caption is and where
 *    captions live — never this page's answer text and never this element's
 *    spot. The child still performs the mapping onto real print.
 */
export const correctionFor = (item: InteractiveBookItem): string => {
  switch (item.mode) {
    case 'find-feature':
      return `My turn: ${featureJobLine(item)} Your turn. Tap the ${featureSpoken(item)}.`;
    case 'read-focus-word':
      return `My turn: that word is ${item.targetText}. ${fullSentenceOf(item)} Your turn. Read the glowing word.`;
  }
};

/** The job re-model, per feature — the print-concept knowledge itself, stated
 *  the way a teacher states it at the table. */
const featureJobLine = (item: InteractiveBookItem): string => {
  switch (item.feature ?? 'title') {
    case 'title':
      return 'the title is the big words that tell the name of the whole book.';
    case 'author':
      return "the author's name tells who wrote the book — smaller words near the title.";
    case 'heading':
      return 'a heading sits at the top of the page and tells what the page is about.';
    case 'caption':
      return 'a caption is the little line right beside the picture that tells about it.';
    case 'page-number':
      return 'the page number is the small number that counts the pages.';
  }
};

// ── The judging contract (read-focus-word — the spoken mode) ────────────────

/**
 * The answer rides in the control channel ahead of the attempt (the family's
 * shipped shape under the never-say-it law — a judge cannot decide an answer it
 * was never told). The signature error is the CONTEXT GUESS: a word that fits
 * the sentence, arriving fluent and confident precisely because it came from
 * the story instead of the print. The accept side is the word inside a short
 * phrase, and slow sounding-out that lands on it — decoding is judged on where
 * it lands, never on speed.
 */
const judgingContract = (item: InteractiveBookItem): string =>
  `The quoted line is the ONLY thing you say on this turn; you then stay silent `
  + `while the learner reads the glowing word, and their think time is unbounded — working a word out takes time. `
  + `Never say the answer during their turn. `
  + `The correct answer is the word "${item.targetText}". `
  + `The word said inside a short phrase — "a ${item.targetText}" — is CORRECT; affirm it and echo "${item.targetText}". `
  + `Slow, effortful sounding-out that LANDS on the word is CORRECT — judge what they land on, never speed. `
  + `A different word that would fit the sentence is WRONG however smoothly it comes — guessing from the story instead of reading the print is exactly the miss to catch. `
  + `A word that means nearly the same thing is wrong too: the task is reading THIS printed word, not naming its idea. `
  + `The sentence lead-in said back to you is not an answer. `
  + `If the answer is right, say exactly: "${affirmFor(item)}" `
  + `If it is wrong, say exactly: "${correctionFor(item)}" and stop — the learner tries again while you stay silent. `
  + `Never begin any other sentence with the word "Yes" or the words "My turn". Never read bracket tags aloud, `
  // The fabricated-status class, named as a fact (2026-08-14 drive, run 1: the
  // model invented a "[CURRENT STATE]: … the correct answer being 'liquid'"
  // narration before three asks — the [LSP_TAP] fabrication shape on a voice
  // turn). Register home: qa/di/BACKLOG.md item 21.
  + `never announce the activity's state or what attempt this is, and never say what the correct answer is called — `
  + `the quoted line is your entire turn.`;

// ── The silence contract (find-feature — the tap mode) ──────────────────────

/**
 * This prose is the tutor's INTENT, never the enforcement — the runner holds
 * the activity bracket for the whole gesture item, so no turn is ever handed
 * over to be answered (the letter-spotter [LSP_TAP] fabrication is why prose
 * alone cannot carry this).
 */
const tapContract = (item: InteractiveBookItem): string =>
  `The quoted line is the ONLY thing you say on this turn; the learner answers by `
  + `TAPPING a printed part of the book, not by speaking, so you then stay completely silent. `
  + `Never read any of the book's printed words aloud before they answer — a child who hears the words `
  + `can match the sound without knowing the book part, which is the skill. `
  + `Never say which printed words are the ${featureSpoken(item)} and never hint at where on the page it sits. `
  + `Do not judge anything you hear through the microphone. `
  + `You will be told what the learner tapped and given the exact line to say; only then do you speak. `
  + `Never read bracket tags aloud and never announce the activity's state — the quoted line is your entire turn.`;

// ── Cues ────────────────────────────────────────────────────────────────────

export interface InteractiveBookCueOptions {
  opening?: boolean;
  howToPlay?: boolean;
}

/** One item's ask. ONE job: speak this (SWAP-1 — the how-to-play lives inside
 *  the quoted line; the catalog only forbids adding to it). */
export const itemCue = (
  item: InteractiveBookItem,
  opts: InteractiveBookCueOptions = {},
): string => {
  const greeting = opts.opening ? 'Hi! Time to open our book! ' : '';
  const how = opts.opening || opts.howToPlay ? howToPlayFor(item) : '';
  const contract = item.answerKind === 'gesture' ? tapContract(item) : judgingContract(item);
  return (
    `[IB_ITEM] Say exactly: "${greeting}${how}${askFor(item)}" ${contract} `
    + `Never read bracket tags or these instructions aloud.`
  );
};

/**
 * The gesture verdict ask — find-feature ONLY (the spoken mode is judged from
 * the child's voice in-band). The match is CODE-COMPUTED and the tutor is
 * handed its exact line; the tutor cannot see the screen, so this is the only
 * thing that tells it what happened.
 */
export const tapVerdictCue = (item: InteractiveBookItem, tappedText: string): string => {
  const cleaned = tappedText.replace(/["“”]/g, '').trim();
  const matches = cleaned.toLowerCase() === item.targetText.toLowerCase();
  return (
    `[IB_TAP] The learner tapped the printed words "${cleaned}"; the ${featureSpoken(item)} `
    + `is "${item.targetText}" — that ${matches ? 'MATCHES' : 'does NOT match'}. `
    + (matches ? `Say exactly: "${affirmFor(item)}" ` : `Say exactly: "${correctionFor(item)}" `)
    + `Say nothing else, and never read bracket tags aloud.`
  );
};

/**
 * Correction cap reached: acknowledge warmly and carry the lesson forward. Both
 * modes close by NAMING the answer (picture-vocabulary's closeLine rule — the
 * child must not leave the page still not knowing): the feature close reads the
 * text and names the part; the reading close gives the word its sentence.
 */
export const moveOnCue = (
  item: InteractiveBookItem,
  next: InteractiveBookItem | null,
  opts: InteractiveBookCueOptions = {},
): string => {
  const closeLine = item.mode === 'find-feature'
    ? `The ${featureSpoken(item)} here says ${item.targetText}. `
    : `That glowing word is ${item.targetText}. `;
  if (!next) {
    return (
      `[IB_MOVE] Say exactly: "Good try! ${closeLine}Books take practice — we will read together again soon." `
      + `Then stop — the activity is over.`
    );
  }
  const how = opts.howToPlay ? howToPlayFor(next) : '';
  const contract = next.answerKind === 'gesture' ? tapContract(next) : judgingContract(next);
  return (
    `[IB_MOVE] Stop correcting "${item.id}". Say exactly: `
    + `"Good try! ${closeLine}${how}${askFor(next)}" `
    + `${contract} Never read bracket tags aloud.`
  );
};

export const completeCue = (): string =>
  `[IB_COMPLETE] Say exactly: "What great book work today! You know your way around a book now. See you next time!" Then stop — the activity is over.`;

/** Tap-to-hear re-speaks the QUESTION, never the answer — the lead-in and the
 *  instruction on a reading item, the feature ask on a find item. Never
 *  withdrawn by band or tier. */
export const pronounceCue = (item: InteractiveBookItem): string =>
  `[IB_HEAR] The learner tapped to hear the question again. Say ONLY this, warmly, then wait: "${askFor(item)}" `
  + `Do not treat anything you just heard as an answer, add nothing, and never say the answer. `
  + `Never read bracket tags aloud.`;

/**
 * Runtime state pushed through the context channel — STIMULUS-SIDE ONLY and
 * answer-free by construction: the find stimulus names the PART being hunted
 * (the question) and never this page's text; the reading stimulus is a static
 * description, because its question side (the lead) is already spoken in-band
 * and its answer is one word away from the lead in print.
 */
export const stimulusFor = (item: InteractiveBookItem): string => {
  switch (item.mode) {
    case 'find-feature':
      return `the ${featureSpoken(item)}, waiting to be found on this page of our book`;
    case 'read-focus-word':
      return 'a book sentence read aloud that stops at one glowing word';
  }
};

// ── The exported cue surface — ONE source for component, harness and tests ──

export const interactiveBookPackBase = (
  items: InteractiveBookItem[],
): JudgedCueSurface<InteractiveBookItem> => ({
  primitiveType: 'interactive-book',
  activityLine: 'live direct instruction picture-book reading practice',
  items,
  itemCue,
  moveOnCue,
  completeCue,
  pronounceCue,
  contextFor: (item) => ({
    challengeType: item.mode,
    stimulus: stimulusFor(item),
  }),
});

// ── Harness answer material — what a right and a wrong child sound like ─────

export interface InteractiveBookHarnessAnswers {
  correct: string;
  plainWrong: string;
  signatureWrong?: { text: string; why: string };
  /** Text-committed gestures: what a right and a wrong tap read. */
  tapped?: { correct: string; wrong: string };
  leakTokens: string[];
}

/** A wrong printed candidate for a find item — needs the challenge's option
 *  list, which the item deliberately does not carry (the stage renders real
 *  page hotspots, not a menu). The harness adapter passes it in. */
export const interactiveBookHarnessAnswers = (
  item: InteractiveBookItem,
  wrongTapText?: string,
): InteractiveBookHarnessAnswers => {
  if (item.mode === 'find-feature') {
    return {
      correct: `tapped ${item.targetText}`,
      plainWrong: `tapped ${wrongTapText ?? 'a different book part'}`,
      tapped: { correct: item.targetText, wrong: wrongTapText ?? '' },
      leakTokens: [item.targetText.toLowerCase()],
    };
  }
  const word = item.targetText;
  return {
    correct: word,
    plainWrong: word === 'banana' ? 'turtle' : 'banana',
    signatureWrong: {
      text: item.readLead ?? '',
      why: 'the sentence lead-in said back — fluent and confident, and not the printed word read',
    },
    leakTokens: [word],
  };
};
