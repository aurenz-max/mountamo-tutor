/**
 * storyTalkScript — HAND-AUTHORED judged-loop script for story-talk (FIFTEENTH
 * literacy DI port; qa/di/BACKLOG.md item 16). The exact wording IS the pedagogy;
 * these lines are authored per pack, never generated. Item CONTENT (the stories,
 * the questions, the answers) stays generator-scoped; this module owns the cue
 * shapes, the build gates, and the judging contracts.
 *
 * ── THE ANSWER-MATERIAL FORK (skill step 1 — the table picture) ─────────────
 *
 * ALL THREE MODES ARE SPOKEN, and the four-picture menu is DELETED. The queue
 * predicted a split — naming verbal, the two inference modes keeping their
 * 4-picture answer space as `closed_set_choice` — and the generator refutes it:
 * every mode's `answer` field is ONE WORD.
 *
 *   who_what_where  a picturable noun the story STATED ("squirrel")
 *   feeling_check   one common feeling word ("scared")
 *   why_because     the CAUSE as one picturable noun the story stated ("rain")
 *
 * A single word is sayable, so step 1's first question ends the fork before the
 * class table is consulted: `short_spoken_word`, benched four times over. There
 * is no proposition anywhere in this primitive, so `closed_set_choice` — the
 * class that keeps a menu when free production would be open-set — never
 * applies. Picture a teacher reading a story to one five-year-old and asking
 * "Who hid the acorn?": there is no menu of four cards on that table, and the
 * child says "the squirrel".
 *
 * What the menu cost while it existed is the standard arithmetic: production
 * became recognition, the guess floor sat at 1/4, and the answer set the child
 * was supposed to generate was handed over as pictures. The distractor WORDS
 * survive the deletion with a different job — they are the harness's
 * signature-wrong material (a same-category near miss is exactly the confusion
 * this skill produces) and the generator's forcing function for a fair answer.
 * They are never rendered and never spoken; `storyTalkPackBase` cannot reach
 * them and the stage draws no options at all.
 *
 * ── WHAT THE PORT DELETES THAT NO OTHER PORT HAD ────────────────────────────
 *
 * The click-era component gated its microphone on tutor-busy — `!isAIResponding
 * && !isAudioPlaying`, with a docblock calling itself "a deliberate, narrow
 * exception" to the standing open-mic rule. The reason was real for the
 * architecture it sat in: a separate Azure capture judged the child, and an open
 * mic during the read-aloud could hear the TUTOR say the answer word (the story
 * contains it verbatim) and credit it to the child.
 *
 * The judged loop dissolves the exception rather than carrying it. The judge IS
 * the tutor, judging its own session's audio in-band; it cannot mistake its own
 * read-aloud for the learner's answer. So the mic is open for the whole run like
 * every other port, and the doctrine keeps its "never gate the mic on tutor-busy"
 * rule with no exception in the family.
 *
 * ── THE LEAK RULES, WHICH DIFFER PER MODE ───────────────────────────────────
 *
 * For who_what_where and why_because THE ANSWER IS INSIDE THE STIMULUS: the
 * generator requires the answer word to appear in the story, and the tutor reads
 * the story verbatim. That is not a leak — hearing the word in context and
 * knowing it answers THIS question is the whole comprehension task. So the
 * contract cannot carry a flat "never say the answer": that instruction
 * contradicts "read this story exactly", and a model resolving the contradiction
 * edits the story. The contract states the narrow thing instead — never single
 * it out, never say it alone, never point at the part of the story holding it,
 * never answer for the learner. feeling_check is the opposite shape (the feeling
 * is never named in the story) and gets the flat rule.
 *
 * The PIXEL side is separate and stricter: the story text, the answer emoji and
 * the answer word do not render until the tutor affirms.
 *
 * ── THE BUILD GATE THIS PRIMITIVE NEEDED AND NOTHING ELSE DOES ──────────────
 *
 * This is the only judged primitive whose read-aloud text is CHARACTER DIALOGUE,
 * which makes it the one most likely to hand the engine a phantom verdict: a
 * story sentence that opens `Yes, I found it!` is ordinary children's writing,
 * the tutor reads it verbatim, and the sentence-scoped verdict scan classifies an
 * affirmation that no one made. `opensWithSentinel` runs over every generated
 * string that reaches a spoken line, and the generator imports the same gates
 * from this module (decodable-reader/letter-spotter precedent — hand-synced
 * copies drifted live once already).
 *
 * Dialogue also arrives wrapped in DOUBLE QUOTES, and a stray `"` closes the
 * `Say exactly: "…"` span and turns the rest of the cue into judge-side prose.
 * Dropping every story with dialogue would drop most of them, so `speechSafe`
 * folds double quotes to single ones: quotation marks have no spoken
 * realization, the line reads identically aloud, and the ONE normalized string
 * is what both the cue and the stage use, so speech and print cannot diverge.
 * That is a punctuation normalization, never a content backfill — everything
 * that changes what the tutor would SAY still drops the item.
 *
 * Sentinels are the engine defaults ("Yes" / "My turn"), collision-checked by
 * validateJudgedScriptPack in this pack's test file.
 */

import type { JudgedScriptItem, ResponseClassId } from '../../../hooks/judgedScriptContract';
import { opensWithSentinel, type JudgedCueSurface } from '../../../hooks/judgedScriptContract';

// Re-exported so the generator imports its build gates from ONE address.
export { opensWithSentinel };

export type StoryTalkDiMode = 'who_what_where' | 'feeling_check' | 'why_because';

// ── The item ────────────────────────────────────────────────────────────────

export interface StoryTalkItem extends JudgedScriptItem {
  mode: StoryTalkDiMode;
  /** The mini-story, speech-safe. Read aloud by the tutor; PRINTED only after
   *  the affirm, because for two of three modes it contains the answer. */
  story: string;
  /** The comprehension question — answer-free by build gate, so it is the one
   *  thing safe to print beside the listening card and to push as context. */
  question: string;
  /** The one-word answer. Never spoken before a verdict, never rendered before
   *  the affirm. */
  answer: string;
  /** Emoji of the answer — reveal-on-affirm only. */
  answerEmoji: string;
  /** The story's kid-friendly title, or '' when the title would leak the answer
   *  ("Milo's Acorn" over "What did Milo find?"). The stage prints a neutral
   *  label instead of dropping an otherwise good story over a caption. */
  displayTitle: string;
  /**
   * ONE same-category distractor, kept for the HARNESS only — the deliberate
   * wrong answer whose refusal is the discrimination claim this pack makes. It
   * is never rendered, never spoken, and never reaches a cue: `storyTalkPackBase`
   * has no path to it. (Its old job was to be a tile in the deleted menu.)
   */
  nearMissWord?: string;
}

/**
 * The table picture: every answer here is one word a child says out loud, so
 * nothing in this primitive is answered with the hands. `answerKindFor` exists
 * as a function rather than a constant so the fork is PINNED per mode in the
 * test file, both directions — a later mode that genuinely needed a gesture
 * would have to change this and be seen doing it.
 */
export const answerKindFor = (_mode: StoryTalkDiMode): 'voice' | 'gesture' => 'voice';

/** Standing gate 1: one short spoken word from a closed per-item set (benched —
 *  sound-swap 9/9, word-flip 5/5, and shipped on five ports since). */
export const responseClassFor = (_mode: StoryTalkDiMode): ResponseClassId => 'short_spoken_word';

// ── Build gates — DROP an unaskable item, never repair it into one ──────────

/** Structural challenge shape as the generator emits it (duck-typed so this
 *  module never imports the component — the component imports us). */
export interface StoryTalkChallengeLike {
  id: string;
  type: string;
  storyTitle?: string;
  story?: string;
  question?: string;
  answer?: string;
  answerEmoji?: string;
  options?: Array<{ word?: string; emoji?: string }>;
}

/** A read-aloud a five-year-old can hold in one listen. The cap is also the
 *  letter-spotter babble gate: an unbounded string field can arrive as model
 *  deliberation that passes every semantic check. */
export const MAX_STORY_CHARS = 420;
/** Under two sentences it is not a story, it is the answer stated once. */
export const MIN_STORY_SENTENCES = 2;
export const MAX_STORY_SENTENCES = 6;
/** The question is spoken in one breath and printed beside the card. */
export const MAX_QUESTION_CHARS = 120;
/** One sayable token (the generator's own answer-token bound). */
export const MAX_ANSWER_CHARS = 15;

/** Words that are their own verdict class: an answer the child gives as
 *  "yes"/"no" hands an affirmation-shaped utterance to a judge listening for a
 *  short word (decodable-reader's rule, same reason). */
const VERDICT_WORDS: ReadonlySet<string> = new Set(['yes', 'yeah', 'no', 'nope']);

/** The modes whose answer word is required to be inside the story — the accept
 *  and wrong clauses below are written against that fact, so an item that
 *  breaks it is unaskable rather than merely odd. */
const ANSWER_STATED_IN_STORY: ReadonlySet<StoryTalkDiMode> = new Set<StoryTalkDiMode>([
  'who_what_where',
  'why_because',
]);

const isMode = (value: string): value is StoryTalkDiMode =>
  value === 'who_what_where' || value === 'feeling_check' || value === 'why_because';

/**
 * Fold double quotes to single ones and flatten whitespace. Quotation marks have
 * no spoken realization, so the read-aloud is byte-for-byte the same performance
 * — but an embedded `"` closes the `Say exactly: "…"` span, and this is the one
 * primitive whose stimulus is dialogue. Everything that WOULD change the
 * performance (underscores, bracket tags) is refused by `isSpeakable` instead.
 */
export const speechSafe = (text: string): string =>
  text.replace(/[“”"]/g, "'").replace(/\s+/g, ' ').trim();

/** No blank markers and no bracket tags — both get read aloud, and a bracket
 *  tag is the shape the model has been proven to fabricate from. */
const isSpeakable = (text: string): boolean =>
  text.trim().length > 0 && !/[_[\]{}]/.test(text);

const sentenceCount = (text: string): number =>
  text.split(/[.!?]+/).map((s) => s.trim()).filter(Boolean).length;

export const isSayableAnswer = (word: string): boolean =>
  new RegExp(`^[a-z][a-z'-]{0,${MAX_ANSWER_CHARS - 1}}$`, 'i').test(word.trim());

export const isSayableStory = (story: string): boolean =>
  isSpeakable(story)
  && story.trim().length <= MAX_STORY_CHARS
  && sentenceCount(story) >= MIN_STORY_SENTENCES
  && sentenceCount(story) <= MAX_STORY_SENTENCES;

export const isSayableQuestion = (question: string): boolean =>
  isSpeakable(question) && question.trim().length <= MAX_QUESTION_CHARS;

/** Whole-ish-word contains, case-insensitive ("hat" does not match "that") —
 *  the same predicate the generator validates with, so both sides of the wire
 *  agree on what "the answer is in the story" means. */
export const containsWord = (haystack: string, word: string): boolean => {
  const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(^|[^A-Za-z])${escaped}([^A-Za-z]|$)`, 'i').test(haystack);
};

/**
 * One judged item, or null when the challenge cannot be ASKED. Nothing here
 * backfills: a placeholder in a judged loop becomes a spoken ask the tutor must
 * stand behind, so a broken item is dropped and the session runs shorter.
 *
 * The gates, and what each one refuses:
 *  - an unknown mode, or an answer that is not one sayable non-verdict token;
 *  - a story that is not a read-aloud (empty, over one listen, fewer than two
 *    sentences, or carrying blank markers / bracket tags);
 *  - a question that is over a breath, unspeakable, or CONTAINS THE ANSWER —
 *    the generator's own rule, re-checked at the seam it protects;
 *  - for the two stated-answer modes, an answer that is not actually in the
 *    story: the accept clause and the correction are written against that;
 *  - anything generated that would open a spoken sentence with a verdict
 *    sentinel — the dialogue gate this primitive exists to need.
 */
export const itemFromChallenge = (ch: StoryTalkChallengeLike): StoryTalkItem | null => {
  if (!ch?.id || !isMode(ch.type ?? '')) return null;
  const mode = ch.type as StoryTalkDiMode;

  const answer = (ch.answer ?? '').trim().toLowerCase();
  if (!isSayableAnswer(answer) || VERDICT_WORDS.has(answer)) return null;

  const story = speechSafe(ch.story ?? '');
  const question = speechSafe(ch.question ?? '');
  if (!isSayableStory(story) || !isSayableQuestion(question)) return null;

  // The answer must not be askable off the question alone.
  if (containsWord(question, answer)) return null;
  // …and the two literal modes are only judgeable if it IS in the story.
  if (ANSWER_STATED_IN_STORY.has(mode) && !containsWord(story, answer)) return null;
  // feeling_check's whole task is inferring a word the story never says.
  if (mode === 'feeling_check' && containsWord(story, answer)) return null;

  if (opensWithSentinel(story) || opensWithSentinel(question) || opensWithSentinel(answer)) {
    return null;
  }

  const answerEmoji = (ch.answerEmoji ?? '').trim();
  if (!answerEmoji) return null;

  // A title that names the answer is a pixel leak on the listening card. The
  // story is fine — only the caption goes.
  const rawTitle = speechSafe(ch.storyTitle ?? '');
  const displayTitle =
    rawTitle && isSpeakable(rawTitle) && !containsWord(rawTitle, answer) ? rawTitle : '';

  const nearMissWord = (ch.options ?? [])
    .map((option) => (option?.word ?? '').trim().toLowerCase())
    .find((word) => word.length > 0 && word !== answer && isSayableAnswer(word));

  return {
    id: ch.id,
    mode,
    answerKind: answerKindFor(mode),
    responseClass: responseClassFor(mode),
    // Mixed sessions interleave the three comprehension skills, and WHAT TO
    // LISTEN FOR changes with them (a stated detail / a feeling / a cause), so
    // the mode is the action and the how-to-play re-speaks on each change.
    action: mode,
    story,
    question,
    answer,
    answerEmoji,
    displayTitle,
    nearMissWord,
  };
};

/** Build the session, dropping what cannot be asked. */
export const itemsFromChallenges = (challenges: StoryTalkChallengeLike[]): StoryTalkItem[] =>
  challenges
    .map((ch) => itemFromChallenge(ch))
    .filter((item): item is StoryTalkItem => item !== null);

/** The generator's side of the same gate — one address, both sides of the wire. */
export const challengeAskable = (ch: StoryTalkChallengeLike): boolean =>
  itemFromChallenge(ch) !== null;

// ── Small speakable helpers ─────────────────────────────────────────────────

const ensureQuestion = (value: string): string =>
  /[.!?]$/.test(value.trim()) ? value.trim() : `${value.trim()}?`;

const ensureStop = (value: string): string =>
  /[.!?]$/.test(value.trim()) ? value.trim() : `${value.trim()}.`;

// ── How-to-play — inside the quoted line (SWAP-1), re-spoken on action change ─
//
// It names WHAT TO LISTEN FOR, which is the only thing that differs between the
// three modes and the thing a five-year-old actually needs before the story
// starts. It is NOT re-recited per item: the runner passes `howToPlay` only on
// the opening cue and when the mode changes, and the ask itself always carries a
// brand-new story, so no two consecutive asks can recite the same line.

export const howToPlayFor = (item: StoryTalkItem): string => {
  switch (item.mode) {
    case 'who_what_where':
      return 'I tell you a little story, then I ask you about it. You tell me the answer out loud! ';
    case 'feeling_check':
      return 'I tell you a little story. The story will not say how they felt — you work it out and tell me out loud! ';
    case 'why_because':
      return 'I tell you a little story, then I ask you WHY it happened. You tell me out loud! ';
  }
};

// ── The asks — the stimulus SPOKEN, the problem stated aloud ────────────────
//
// A pre-reader cannot read the screen and the story is deliberately not printed
// while they answer, so the ask carries the entire stimulus in-band. Every
// correction re-ask inherits it, which is why the question is restated in the
// correction rather than referred back to.

export const askFor = (item: StoryTalkItem): string =>
  `Listen. ${ensureStop(item.story)} Your turn. ${ensureQuestion(item.question)}`;

// ── Verdict lines ───────────────────────────────────────────────────────────

/** Affirmations open "Yes," (engine sentinel) and ECHO THE CANONICAL WORD —
 *  which is what makes the accept clauses safe: a child who said "unhappy" or
 *  "because it rained" hears the target word back as the model. */
export const affirmFor = (item: StoryTalkItem): string => `Yes, ${item.answer}!`;

/**
 * Corrections open "My turn:", re-model, re-elicit (standing gate 3). What each
 * mode models is the teaching move for ITS comprehension skill:
 *  - who_what_where states the recalled detail — the answer is earned here, the
 *    first place the tutor may say it alone;
 *  - feeling_check bridges event to emotion ("that is how you feel when that
 *    happens"), which is the inference the child could not make;
 *  - why_because names the answer AS the cause, because a child who missed this
 *    one usually gave the event instead, and hearing "that is why" labels the
 *    relation, not just the word.
 * Re-hearing the whole story is a separate, child-initiated channel ([ST_HEAR]).
 */
export const correctionFor = (item: StoryTalkItem): string => {
  switch (item.mode) {
    case 'who_what_where':
      return `My turn: ${item.answer}. Your turn. ${ensureQuestion(item.question)}`;
    case 'feeling_check':
      return `My turn: ${item.answer}. That is how you feel when that happens. Your turn. ${ensureQuestion(item.question)}`;
    case 'why_because':
      return `My turn: ${item.answer}. That is why it happened. Your turn. ${ensureQuestion(item.question)}`;
  }
};

// ── The judging contract ────────────────────────────────────────────────────

/**
 * THE LEAK CLAUSE IS MODE-SHAPED, and that is the whole reason it is a function.
 * A flat "never say the answer" is FALSE for two of three modes — the tutor has
 * just been told to read a story that contains the answer word — and a contract
 * that contradicts itself gets resolved by the model, which here means editing
 * the story it was told to read verbatim.
 */
const leakClauseFor = (item: StoryTalkItem): string =>
  item.mode === 'feeling_check'
    ? `The story never names the feeling — working it out is the whole task — so the feeling word does not leave your mouth before your verdict. `
    : `The answer word sits inside the story you just read, and hearing it there IS the task. What you never do is single it out, say it on its own, tell them which part of the story holds it, or answer for them. `;

/** The RIGHT answer that does not look right. Every clause ends by echoing the
 *  canonical word, so an accepted variant still models the target. */
const acceptClauseFor = (item: StoryTalkItem): string => {
  switch (item.mode) {
    case 'who_what_where':
      return `The word inside a little phrase — "the ${item.answer}" or "it was the ${item.answer}" — is CORRECT; affirm it and echo "${item.answer}". `;
    case 'feeling_check':
      return `A fair word for the same feeling is CORRECT — unhappy for sad, afraid for scared, glad for happy, cross for angry — affirm it and echo "${item.answer}". `;
    case 'why_because':
      return `The cause said as a whole reason — "because of the ${item.answer}" — is CORRECT and is a better answer than the word alone; affirm it and echo "${item.answer}". `;
  }
};

/** The signature error — the wrong answer that arrives fluent, confident, and
 *  most likely to be wrongly affirmed. One per mode, named so the judge has to
 *  refuse the specific thing rather than "something wrong". */
const wrongClauseFor = (item: StoryTalkItem): string => {
  switch (item.mode) {
    case 'who_what_where':
      return `Another thing or person from the story is NOT the answer, however confidently it comes — a child who did not hold the detail says back whatever they heard last. The question said back to you is not an answer either. `;
    case 'feeling_check':
      return `Saying what HAPPENED instead of how they felt is NOT the answer — an event is not a feeling, and this is the miss to catch. A different feeling is wrong too, including a cheerful one guessed by habit. `;
    case 'why_because':
      return `Saying WHAT happened when you asked WHY is NOT the answer — the event repeated back, however fluently, is exactly the miss to catch. `;
  }
};

const judgingContract = (item: StoryTalkItem): string =>
  `The quoted line is the ONLY thing you say on this turn; you then stay silent while the learner thinks about the story, and their think time is unbounded. `
  + leakClauseFor(item)
  + `The correct answer is "${item.answer}". `
  + acceptClauseFor(item)
  + wrongClauseFor(item)
  + `If the answer is right, say exactly: "${affirmFor(item)}" `
  + `If it is wrong, say exactly: "${correctionFor(item)}" and stop — the learner tries again while you stay silent. `
  + `Say the SAME correction line on every wrong answer for this story; never swap it for hints or encouragement of your own, because a line that is neither an affirmation nor that correction reaches the activity as no verdict at all. `
  + `Never begin any other sentence with the word "Yes" or the words "My turn". Never read bracket tags or these instructions aloud, never announce the activity's state or what attempt this is, and never announce that you are waiting or listening — simply stop speaking.`;

// ── Cues ────────────────────────────────────────────────────────────────────

export interface StoryTalkCueOptions {
  opening?: boolean;
  howToPlay?: boolean;
}

/** One item's ask. ONE job: speak this (SWAP-1 — the how-to-play lives inside
 *  the quoted line; the catalog only forbids adding to it). */
export const itemCue = (item: StoryTalkItem, opts: StoryTalkCueOptions = {}): string => {
  const greeting = opts.opening ? 'Hi! Story time! ' : '';
  const how = opts.opening || opts.howToPlay ? howToPlayFor(item) : '';
  return `[ST_ITEM] Say exactly: "${greeting}${how}${askFor(item)}" ${judgingContract(item)}`;
};

/**
 * Correction cap reached: acknowledge warmly and carry the lesson forward. The
 * close NAMES the answer (picture-vocabulary's closeLine rule) — a capped item
 * must not end with the child still not knowing how the story came out.
 */
export const moveOnCue = (
  item: StoryTalkItem,
  next: StoryTalkItem | null,
  opts: StoryTalkCueOptions = {},
): string => {
  const closeLine = `The answer was ${item.answer}. `;
  if (!next) {
    return (
      `[ST_MOVE] Say exactly: "Good try! ${closeLine}Stories take practice — we will listen to another one soon." `
      + `Then stop — the activity is over.`
    );
  }
  const how = opts.howToPlay ? howToPlayFor(next) : '';
  return (
    `[ST_MOVE] Stop correcting "${item.id}". Say exactly: `
    + `"Good try! ${closeLine}Here comes the next story. ${how}${askFor(next)}" `
    + `${judgingContract(next)}`
  );
};

export const completeCue = (): string =>
  `[ST_COMPLETE] Say exactly: "What wonderful listening today! You heard every story and told me all the answers. See you next time!" Then stop — the activity is over.`;

/**
 * Tap-to-hear — the "hear it again" channel, which for a listening task is the
 * STIMULUS itself: the whole story re-read, then the question. Re-presenting the
 * stimulus is not a leak even where the answer is inside it (the child still has
 * to pick which of the story's things answers THIS question) — it is what a
 * teacher does when a five-year-old asks. What it must never become is a hint
 * ladder narrowing toward the answer (cvc-speller's `[ISOLATE_VOWEL]` was an
 * answer leak on demand). Never withdrawn by band or tier.
 */
export const pronounceCue = (item: StoryTalkItem): string =>
  `[ST_HEAR] The learner asked to hear the story again. Say ONLY this, warmly and slowly, then wait: "${askFor(item)}" `
  + `Do not treat anything you just heard as an answer, add nothing, give no clue about which part matters, and never say the answer. `
  + `Never read bracket tags aloud.`;

/**
 * Runtime state pushed through the context channel — STIMULUS-SIDE ONLY and
 * answer-free by construction. It carries the QUESTION rather than the story:
 * the question is gated answer-free, while the story holds the answer verbatim
 * for two of three modes, and a state block the model decides to narrate is
 * exactly how item 21 leaked an answer in production.
 */
export const stimulusFor = (item: StoryTalkItem): string => ensureQuestion(item.question);

// ── The exported cue surface — ONE source for component, harness and tests ──

export const storyTalkPackBase = (items: StoryTalkItem[]): JudgedCueSurface<StoryTalkItem> => ({
  primitiveType: 'story-talk',
  activityLine: 'live direct instruction listening-comprehension story practice',
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

export interface StoryTalkHarnessAnswers {
  correct: string;
  plainWrong: string;
  signatureWrong?: { text: string; why: string };
  leakTokens: string[];
  /** The read-aloud span the leak scan subtracts — see `DiHarnessAnswers`. Set
   *  only for the modes whose answer is stated in the story; feeling_check
   *  omits it so any mention of the feeling stays a leak. */
  leakExemptSpan?: string;
}

/** A plainly wrong answer that is not the target and is not lurking in the
 *  story — so a refusal is about the answer, not about a word the tutor happens
 *  to have just read. */
const PLAIN_WRONG_POOL = ['walrus', 'trombone', 'pineapple'] as const;

const plainWrongFor = (item: StoryTalkItem): string =>
  PLAIN_WRONG_POOL.find(
    (word) => word !== item.answer && !containsWord(item.story, word),
  ) ?? 'trombone';

/**
 * The signature wrong is the SAME-CATEGORY near miss — another animal, another
 * feeling, another thing from the story world. It is the confusion the deleted
 * menu used to display and the one `wrongClauseFor` claims the judge refuses, so
 * driving it is what turns that clause from prose into evidence.
 */
export const storyTalkHarnessAnswers = (item: StoryTalkItem): StoryTalkHarnessAnswers => ({
  correct: item.answer,
  plainWrong: plainWrongFor(item),
  signatureWrong: item.nearMissWord
    ? {
        text: item.nearMissWord,
        why:
          item.mode === 'feeling_check'
            ? 'a different feeling said confidently — the emotion-inference miss the contract names'
            : 'a same-category thing from the story world — the detail a child says back when they did not hold the real one',
      }
    : undefined,
  leakTokens: [item.answer],
  // The story is the STIMULUS, and for these two modes the answer is inside it
  // by construction — recalling it from the read-aloud is the task. The scan
  // still governs everything around it.
  leakExemptSpan: ANSWER_STATED_IN_STORY.has(item.mode) ? item.story : undefined,
});
