/**
 * knowledgeCheckScript — HAND-AUTHORED judged-loop script for knowledge-check
 * (qa/di/BACKLOG.md item 23 slice 2). The exact wording IS the pedagogy, so
 * these lines are authored per pack, never generated. Problem CONTENT stays
 * generator-scoped; this module owns the answer-material fork, the build
 * gates, the cue shapes and the in-band judging contracts.
 *
 * WHAT THIS PORT CONVERTS. Knowledge-check is the cross-cutting final
 * assessment — the most-routed primitive in the portfolio (Grade-1 census:
 * 6/42, in every lesson). Its click era is recognition end to end: every
 * problem type is pick-from-N, retry runs until correct, and the completion
 * card reports N of N. Under the judged loop the sayable types become spoken
 * production judged from audio, corrections cap at 2, and the score is real.
 *
 * ── THE ANSWER-MATERIAL FORK (skill step 1) ────────────────────────────────
 * One picture: a teacher at a table asking a child the final questions of a
 * lesson. Per problem type, what would the child naturally do?
 *
 *   true_false    The teacher says a statement; the child SAYS "true" or
 *                 "false" (more often "yes"/"no"). → voice, `yes_no` — the
 *                 most separable closed pair there is. The accept clause must
 *                 take the natural variants; the signature error is the child
 *                 echoing part of the statement instead of judging it.
 *
 *   choice        The teacher asks and OFFERS THE CHOICES ALOUD; the child
 *                 SAYS which one. → voice, `closed_set_choice` (the menu IS
 *                 the ask — decodable-reader's ruled fork, third landing of
 *                 "i need to click on the button even though im speaking").
 *                 Short-form accept + ear-separability build gate.
 *
 *   choice_tap    The choices genuinely cannot be said (KaTeX, bare numbers,
 *                 symbols, or an ear-inseparable draw): the child POINTS —
 *                 the tap is the honest table gesture for "this one". →
 *                 gesture, `manipulation`. The tap is a position answer, one
 *                 of the three unsayable shapes; it is never the default and
 *                 never a judge workaround — `choiceSpoken` is tried first.
 *
 *   blank         The teacher reads the sentence with a hum in the gap; the
 *                 child SAYS the missing word (letter-spotter's verbatim
 *                 ruling: "they should be able to translate the sentence and
 *                 missing letter verbally"). → voice, `short_spoken_word` —
 *                 the word bank on screen closes the per-item set.
 *
 *   match         "Which one goes with X?" over the printed right column. →
 *                 voice, `closed_set_choice`. THE BANK STAYS WHOLE on screen
 *                 (defect class 3 — the click era's match column consumed its
 *                 entries and the last pair needed no reading). The
 *                 elimination arithmetic is real even with the bank whole: an
 *                 answer the tutor has NAMED is spent (defect class 2), so a
 *                 session asks at most N-1 pairs of an N-option bank and the
 *                 final ask still has two live candidates.
 *
 *   sort          "Which group does X go in — A, or B?" one item at a time —
 *                 the microstep (item 23 slice 1) spoken. → voice,
 *                 `closed_set_choice` over the group names. The ask NAMES the
 *                 groups by construction (defect class 4 — the mats are not a
 *                 costume; a sort with unknowable groups is broken, not
 *                 hard). Group answers repeat across items by construction —
 *                 word-sorter's shipped shape — so the answered-once rule
 *                 exempts sort: the answer is the RELATION, not the label.
 *
 *   sequencing_activity / scenario_question / short_answer are NOT askable in
 *   this pack: sequencing is a BUILD the judged stage does not carry yet
 *   (queued as item 23 slice 2b), and the other two are `open_set_word`
 *   (BLOCKED). A set containing one is not partially judged — see below.
 *
 * ── ALL-OR-NOTHING (this pack's own rule, forced by R7) ────────────────────
 * Knowledge-check completion is gated per problem (`${instanceId}::pN`,
 * KindergartenStage). A judged session that silently dropped one problem
 * would strand the whole check: that problem never asks, never submits, and
 * the stage gate waits forever. So the build is all-or-nothing — if ANY
 * problem yields zero judged items, `judgedViable` is false and the component
 * renders the tap surface for the whole set. Partial drops WITHIN a problem
 * (5 of 6 sort items survive) are fine: the problem still asks and submits.
 *
 * ── ANSWER-LEAK RULES, PER KIND ────────────────────────────────────────────
 *  - choice/match/sort: the ask necessarily speaks the menu — that is the
 *    QUESTION side, exempt by construction (`leakExemptSpan`). What is never
 *    exempt: a STEM that contains the correct option's distinguishing words
 *    (dropped at build), and a correction that names the right choice (the
 *    answer is earned only at the correction cap, in `moveOnCue`).
 *  - blank: the sentence is spoken with "hmm" in the gap; a sentence that
 *    also contains the answer word elsewhere is dropped, and tap-to-hear
 *    re-speaks the blanked sentence, never the bank.
 *  - sort: an item whose own text contains a group-name token names its
 *    answer in the ask (defect class 11) — dropped.
 *  - true_false: the statement is both stimulus and question; "true" leaks
 *    nothing. The correction must NOT name the verdict — with two options,
 *    naming is handing over — so it re-models the LISTENING, and the verdict
 *    is earned at the cap.
 *
 * Sentinels are the engine defaults ("Yes" / "My turn"). GENERATED text
 * (statements, stems, options, bank words, group names, item texts) is
 * interpolated into spoken cues, so anything whose own sentence opens with a
 * sentinel is DROPPED at build (`opensWithSentinel` reused, never re-rolled).
 */

import type {
  JudgedCueSurface,
  JudgedScriptItem,
  ResponseClassId,
} from '../hooks/judgedScriptContract';
import { opensWithSentinel, spokenSpansOf } from '../hooks/judgedScriptContract';
import type {
  ProblemData,
  MultipleChoiceProblemData,
  TrueFalseProblemData,
  FillInBlanksProblemData,
  MatchingActivityProblemData,
  CategorizationActivityProblemData,
} from '../types';
import { MAX_SENTENCE_WORDS } from './visual-primitives/direct-instruction/diSentenceReadingScript';

// ============================================================================
// Item model
// ============================================================================

export type KnowledgeCheckItemKind =
  | 'true_false'
  | 'choice'
  | 'choice_tap'
  | 'blank'
  | 'match'
  | 'sort';

/** Standing gate 1: what each kind's answer is MADE of. */
export const responseClassFor = (kind: KnowledgeCheckItemKind): ResponseClassId =>
  kind === 'true_false'
    ? 'yes_no'
    : kind === 'blank'
      ? 'short_spoken_word'
      : kind === 'choice_tap'
        ? 'manipulation'
        : 'closed_set_choice';

export const answerKindFor = (kind: KnowledgeCheckItemKind): 'voice' | 'gesture' =>
  kind === 'choice_tap' ? 'gesture' : 'voice';

export interface KnowledgeCheckOption {
  id: string;
  text: string;
  emoji?: string;
}

export interface KnowledgeCheckItem extends JudgedScriptItem {
  kind: KnowledgeCheckItemKind;
  /** Which problem of the set this item belongs to — the per-problem
   *  evaluation identity (`${instanceId}::pN`) aggregates on it. */
  problemIndex: number;
  /** The spoken question / statement / blanked sentence for this item. */
  prompt: string;
  /** true_false: the key. */
  correctBool?: boolean;
  /** blank: the one-word (or two-word) answer the child says. */
  answerWord?: string;
  /** blank: the printed word bank (render-only; closes the set on screen). */
  wordBank?: string[];
  /** choice / choice_tap / match / sort: the menu (for sort these are the
   *  group names; for match the whole right column, uniform for the whole
   *  problem — the bank never shrinks). */
  options?: KnowledgeCheckOption[];
  correctOptionId?: string;
  /** match: the left item this ask is about. sort: the item being placed. */
  focusText?: string;
  /** choice_tap only: why this draw could not be spoken (probe/report datum,
   *  never rendered). */
  tapReason?: string;
}

// ── Small helpers (family idiom) ────────────────────────────────────────────

/** Printed/spoken form. Double quotes are stripped — a stray `"` would close
 *  the `Say exactly: "…"` span the tutor reads. */
export const sanitize = (raw: string): string =>
  (raw ?? '').replace(/["“”]/g, '').replace(/\s+/g, ' ').trim();

export const wordsIn = (text: string): number =>
  text.trim() ? text.trim().split(/\s+/).length : 0;

const cap = (value: string): string => value.charAt(0).toUpperCase() + value.slice(1);

const stripEnd = (value: string): string => value.replace(/[.!?]+$/, '').trim();

const asQuestion = (value: string): string =>
  /[.!?]$/.test(value.trim()) ? value.trim() : `${value.trim()}?`;

const asStatement = (value: string): string =>
  /[.!?]$/.test(value.trim()) ? value.trim() : `${value.trim()}.`;

export const normalizeWord = (value: string): string =>
  sanitize(value).toLowerCase().replace(/[^a-z0-9' -]/g, '').trim();

const tokensOf = (text: string): string[] =>
  normalizeWord(text).split(/[\s-]+/).filter(Boolean);

/** Words that are their own verdict class — a blank whose answer is one of
 *  these would collide with the yes_no channel. */
const VERDICT_WORDS: ReadonlySet<string> = new Set(['yes', 'yeah', 'no', 'nope', 'true', 'false']);

// ============================================================================
// Build gates
// ============================================================================

/** The tutor speaks every menu option and the child says one back, so the
 *  sayable ceiling is the benched judged-utterance ceiling, imported from the
 *  pack that benched it — never a new number. */
export const MAX_OPTION_WORDS = MAX_SENTENCE_WORDS;

/** A statement/stem the tutor reads in one breath. Longer stems exist at
 *  upper grades, but a spoken ask past this asks a child to hold a paragraph
 *  by ear — the tap surface serves those sets. */
export const MAX_PROMPT_WORDS = 24;

/** The session is a closing check, not a drill. SELECT rather than truncate
 *  (defect class 1): the picker below keeps every problem represented. */
export const MAX_SESSION_ITEMS = 10;

/**
 * Can these menu options be told apart BY EAR? Every option needs at least
 * one word no other option has — the subset shape ("A cat." beside "A cat and
 * a dog.") has no honest verdict and is DROPPED, never judged leniently.
 * Exported for the generator's side of the wire (belt and suspenders).
 */
export const optionsEarSeparable = (options: KnowledgeCheckOption[]): boolean => {
  const wordsOf = (option: KnowledgeCheckOption) => tokensOf(option.text);
  return options.every((option, i) => {
    const others = new Set(options.flatMap((o, j) => (j === i ? [] : wordsOf(o))));
    return wordsOf(option).some((word) => !others.has(word));
  });
};

/** Is one option speakable at all — English words, inside the ceiling, clean
 *  of sentinels? (KaTeX and symbol content fails the letter test.) */
export const optionSayable = (option: KnowledgeCheckOption): boolean => {
  const text = sanitize(option.text);
  if (!text || !/[a-z]/i.test(text)) return false;
  if (wordsIn(text) > MAX_OPTION_WORDS) return false;
  return !opensWithSentinel(text);
};

/**
 * The spoken-menu gate for an MCQ draw. This SUPERSEDES the interim voice
 * pilot's `multipleChoiceVoiceReady` (R6 re-based): that gate protected a
 * mid-lesson word-matcher that could only hear 1-3 plain words; the judged
 * contract reads whole propositions, so the ceiling is the benched utterance
 * window and the hard requirements are identity ones — a resolvable key,
 * unique ear-separable options, no KaTeX.
 */
export const choiceSpokenReason = (p: MultipleChoiceProblemData): string | null => {
  if (p.optionFormat === 'katex') return 'katex options';
  const options = (p.options ?? []).map((o) => ({ id: o.id, text: sanitize(o.text) }));
  if (options.length < 2) return 'fewer than two options';
  if (!options.every(optionSayable)) return 'an unsayable option';
  const texts = options.map((o) => normalizeWord(o.text));
  if (new Set(texts).size !== texts.length) return 'duplicate option labels';
  if (!optionsEarSeparable(options)) return 'options not ear-separable';
  return null;
};

// ── Per-type item builders — KEEP-OR-DROP, never backfill ───────────────────

const promptUsable = (prompt: string): boolean =>
  !!prompt && /[a-z]/i.test(prompt) && wordsIn(prompt) <= MAX_PROMPT_WORDS
  && !opensWithSentinel(prompt);

const itemsFromTrueFalse = (
  p: TrueFalseProblemData,
  problemIndex: number,
): KnowledgeCheckItem[] => {
  const statement = asStatement(sanitize(p.statement ?? ''));
  if (!promptUsable(statement)) return [];
  return [{
    id: `p${problemIndex}-tf`,
    kind: 'true_false',
    answerKind: 'voice',
    responseClass: responseClassFor('true_false'),
    action: 'true_false',
    problemIndex,
    prompt: statement,
    correctBool: !!p.correct,
  }];
};

const itemsFromChoice = (
  p: MultipleChoiceProblemData,
  problemIndex: number,
): KnowledgeCheckItem[] => {
  const prompt = asQuestion(sanitize(p.question ?? ''));
  if (!promptUsable(prompt)) return [];
  const options = (p.options ?? []).map((o) => ({
    id: o.id,
    text: sanitize(o.text),
    emoji: o.emoji,
  }));
  if (options.length < 2 || options.length > 5) return [];
  if (!p.correctOptionId || !options.some((o) => o.id === p.correctOptionId)) return [];

  const tapReason = choiceSpokenReason(p);
  if (tapReason === null) {
    // The stem must not contain the correct option's distinguishing words —
    // an ask that says its own answer outside the menu clause (class 11).
    const correct = options.find((o) => o.id === p.correctOptionId)!;
    const others = new Set(options.flatMap((o) => (o.id === correct.id ? [] : tokensOf(o.text))));
    const distinctive = tokensOf(correct.text).filter((w) => w.length >= 3 && !others.has(w));
    const stemTokens = new Set(tokensOf(prompt));
    if (distinctive.some((w) => stemTokens.has(w))) return [];
    return [{
      id: `p${problemIndex}-mc`,
      kind: 'choice',
      answerKind: 'voice',
      responseClass: responseClassFor('choice'),
      action: 'choice',
      problemIndex,
      prompt,
      options,
      correctOptionId: p.correctOptionId,
    }];
  }

  // The honest gesture: the child points at the one they mean. The PROMPT must
  // still be speakable (the tutor asks it aloud); only the menu lives on the
  // page. KaTeX options render on screen — the page carries what the voice
  // cannot.
  return [{
    id: `p${problemIndex}-mct`,
    kind: 'choice_tap',
    answerKind: 'gesture',
    responseClass: responseClassFor('choice_tap'),
    action: 'choice_tap',
    problemIndex,
    prompt,
    options,
    correctOptionId: p.correctOptionId,
    tapReason,
  }];
};

/** The blanked sentence exactly as the tutor speaks it: the gap is "hmm". */
export const blankSpokenSentence = (textWithBlanks: string): string =>
  sanitize(textWithBlanks).replace(/_{2,}|\[blank\]|\{\{\s*blank\s*\}\}/gi, 'hmm');

const itemsFromBlanks = (
  p: FillInBlanksProblemData,
  problemIndex: number,
): KnowledgeCheckItem[] => {
  // One blank per judged ask. A multi-blank sentence spoken with several hums
  // has no single defensible answer per turn, so only single-blank problems
  // build (the tap surface serves the rest).
  const blanks = p.blanks ?? [];
  if (blanks.length !== 1) return [];
  const answer = normalizeWord(blanks[0]?.correctAnswer ?? '');
  const sentence = blankSpokenSentence(p.textWithBlanks ?? '');
  if (!promptUsable(sentence) || !sentence.includes('hmm')) return [];
  if (!answer || wordsIn(answer) > 2) return [];
  if (VERDICT_WORDS.has(answer) || opensWithSentinel(answer)) return [];
  // The answer must not survive elsewhere in the spoken sentence.
  const spokenTokens = new Set(tokensOf(sentence));
  if (tokensOf(answer).some((w) => spokenTokens.has(w))) return [];
  const bank = (p.wordBank ?? []).map(sanitize).filter(Boolean);
  return [{
    id: `p${problemIndex}-blank`,
    kind: 'blank',
    answerKind: 'voice',
    responseClass: responseClassFor('blank'),
    action: 'blank',
    problemIndex,
    prompt: sentence,
    answerWord: answer,
    wordBank: bank,
  }];
};

const itemsFromMatching = (
  p: MatchingActivityProblemData,
  problemIndex: number,
): KnowledgeCheckItem[] => {
  const right = (p.rightItems ?? []).map((r) => ({ id: r.id, text: sanitize(r.text) }));
  if (right.length < 2 || right.length > 4) return []; // a longer spoken menu is a recitation
  if (!right.every(optionSayable) || !optionsEarSeparable(right)) return [];

  // Pairs with exactly ONE right answer are askable; the bank stays whole on
  // screen and in the spoken menu for every ask. Ask at most N-1 pairs of an
  // N-option bank: each affirmed answer is SPENT (class 2), and the final ask
  // must still have two live candidates or it is elimination, not matching.
  const singles = (p.mappings ?? []).filter((m) => (m.rightIds ?? []).length === 1);
  const maxAsks = Math.max(1, right.length - 1);
  return singles.slice(0, maxAsks).flatMap((mapping, i) => {
    const left = (p.leftItems ?? []).find((l) => l.id === mapping.leftId);
    const focus = sanitize(left?.text ?? '');
    if (!focus || wordsIn(focus) > MAX_OPTION_WORDS || opensWithSentinel(focus)) return [];
    if (!right.some((r) => r.id === mapping.rightIds[0])) return [];
    return [{
      id: `p${problemIndex}-match-${i + 1}`,
      kind: 'match' as const,
      answerKind: 'voice' as const,
      responseClass: responseClassFor('match'),
      action: 'match',
      problemIndex,
      prompt: asQuestion(sanitize(p.prompt ?? 'Which one goes together')),
      focusText: focus,
      options: right,
      correctOptionId: mapping.rightIds[0],
    }];
  });
};

const itemsFromSort = (
  p: CategorizationActivityProblemData,
  problemIndex: number,
): KnowledgeCheckItem[] => {
  const groups = (p.categories ?? []).map((c) => ({ id: c, text: sanitize(c) }));
  if (groups.length < 2 || groups.length > 3) return [];
  if (!groups.every((g) => !!g.text && wordsIn(g.text) <= 4 && optionSayable(g))) return [];
  if (!optionsEarSeparable(groups)) return [];
  const groupTokens = new Set(groups.flatMap((g) => tokensOf(g.text)));

  return (p.categorizationItems ?? []).flatMap((entry, i) => {
    const focus = sanitize(entry.itemText ?? '');
    if (!focus || wordsIn(focus) > 4 || opensWithSentinel(focus)) return [];
    if (!groups.some((g) => g.id === entry.correctCategory)) return [];
    // Class 11: an item whose own words name a group answers itself out loud.
    if (tokensOf(focus).some((w) => groupTokens.has(w))) return [];
    return [{
      id: `p${problemIndex}-sort-${i + 1}`,
      kind: 'sort' as const,
      answerKind: 'voice' as const,
      responseClass: responseClassFor('sort'),
      action: 'sort',
      problemIndex,
      prompt: sanitize(p.instruction ?? ''),
      focusText: focus,
      options: groups,
      correctOptionId: entry.correctCategory,
    }];
  });
};

const itemsFromProblem = (p: ProblemData, problemIndex: number): KnowledgeCheckItem[] => {
  switch (p.type) {
    case 'true_false': return itemsFromTrueFalse(p, problemIndex);
    case 'multiple_choice': return itemsFromChoice(p, problemIndex);
    case 'fill_in_blanks': return itemsFromBlanks(p, problemIndex);
    case 'matching_activity': return itemsFromMatching(p, problemIndex);
    case 'categorization_activity': return itemsFromSort(p, problemIndex);
    default: return []; // sequencing (slice 2b), scenario, short_answer
  }
};

/**
 * The ANSWER this item closes on, for the answered-once invariant. Sort is
 * EXEMPT by design: a sort's answer is the relation (item × group), the group
 * label repeats by construction (word-sorter's shipped shape), and the item
 * being placed is new every time. true_false is exempt for the same reason a
 * yes/no round is — the verdict pair is the response CLASS, not content.
 */
export const answerKeyOf = (item: KnowledgeCheckItem): string | undefined => {
  switch (item.kind) {
    case 'choice':
    case 'choice_tap':
    case 'match': {
      const correct = (item.options ?? []).find((o) => o.id === item.correctOptionId);
      return correct ? normalizeWord(stripEnd(correct.text)) || undefined : undefined;
    }
    case 'blank':
      return normalizeWord(item.answerWord ?? '') || undefined;
    default:
      return undefined;
  }
};

/** Class 2: once the tutor has NAMED an answer aloud, a later item with the
 *  same answer measures recall of her last sentence. First occurrence keeps. */
const dropRepeatAnswers = (items: KnowledgeCheckItem[]): KnowledgeCheckItem[] => {
  const named = new Set<string>();
  return items.filter((item) => {
    const key = answerKeyOf(item);
    if (!key) return true;
    if (named.has(key)) return false;
    named.add(key);
    return true;
  });
};

/** SELECT to the session cap, never blind-slice: every problem keeps at least
 *  one item, sorts keep at least one item per group where the draw allows,
 *  and surplus comes off the LONGEST expansions first. */
const selectToCap = (items: KnowledgeCheckItem[]): KnowledgeCheckItem[] => {
  if (items.length <= MAX_SESSION_ITEMS) return items;
  const byProblem = new Map<number, KnowledgeCheckItem[]>();
  for (const item of items) {
    byProblem.set(item.problemIndex, [...(byProblem.get(item.problemIndex) ?? []), item]);
  }
  const keep = new Set<string>();
  // Pass 1: one item per problem, and per sort-group coverage.
  Array.from(byProblem.values()).forEach((group) => {
    keep.add(group[0].id);
    const seen = new Set<string>([group[0].correctOptionId ?? '']);
    for (const item of group) {
      if (item.kind !== 'sort') continue;
      const g = item.correctOptionId ?? '';
      if (!seen.has(g)) { keep.add(item.id); seen.add(g); }
    }
  });
  // Pass 2: round-robin the remainder until the cap.
  const queues = Array.from(byProblem.values()).map((group) => group.filter((i) => !keep.has(i.id)));
  let progressed = true;
  while (keep.size < MAX_SESSION_ITEMS && progressed) {
    progressed = false;
    for (const queue of queues) {
      if (keep.size >= MAX_SESSION_ITEMS) break;
      const next = queue.shift();
      if (next) { keep.add(next.id); progressed = true; }
    }
  }
  return items.filter((item) => keep.has(item.id));
};

export interface KnowledgeCheckBuild {
  items: KnowledgeCheckItem[];
  /** False when ANY problem yielded zero items — the whole set falls back to
   *  the tap surface (all-or-nothing; see the header). */
  judgedViable: boolean;
  dropped: number;
}

export const itemsFromProblems = (problems: ProblemData[]): KnowledgeCheckBuild => {
  if (!problems.length) return { items: [], judgedViable: false, dropped: 0 };
  const raw = problems.flatMap((p, i) => itemsFromProblem(p, i));
  const deduped = dropRepeatAnswers(raw);
  const items = selectToCap(deduped);
  const covered = new Set(items.map((i) => i.problemIndex));
  const judgedViable = problems.every((_, i) => covered.has(i));
  return { items, judgedViable, dropped: raw.length - items.length };
};

// ============================================================================
// How-to-play — inside the quoted line (SWAP-1), re-spoken on action change
// ============================================================================

export const howToPlayFor = (item: KnowledgeCheckItem): string => {
  switch (item.kind) {
    case 'true_false':
      return 'I say something, and you tell me out loud if it is true or false! ';
    case 'choice':
      return 'I ask you a question and say what the answers could be. You tell me the one you pick! ';
    case 'choice_tap':
      return 'I ask you a question, and the choices are on the screen. You touch the one you pick! ';
    case 'blank':
      return 'I say a sentence with a word missing — I say hmm where the word goes. You tell me the missing word! ';
    case 'match':
      return 'We match things that go together. I name one, and you tell me its partner! ';
    case 'sort':
      return 'We sort things into groups. I name one, and you tell me which group it goes in! ';
  }
};

// ============================================================================
// The asks — every ask STATES its problem aloud (a young learner may not read
// the screen, and every correction re-ask inherits the ask)
// ============================================================================

/** The menu spoken as one fair list, in the on-screen order — a child who
 *  says "the second one" must be naming the card in the second position. */
export const choicesSpokenFor = (item: KnowledgeCheckItem): string => {
  const texts = (item.options ?? []).map((o) => stripEnd(o.text)).filter(Boolean);
  if (texts.length === 0) return '';
  if (texts.length === 1) return texts[0];
  return `${texts.slice(0, -1).join(', ')}, or ${texts[texts.length - 1]}`;
};

export const askFor = (item: KnowledgeCheckItem): string => {
  switch (item.kind) {
    case 'true_false':
      return `Your turn. Listen: ${item.prompt} Is that true, or false?`;
    case 'choice':
      return `Your turn. ${item.prompt} Is it ${choicesSpokenFor(item)}? Tell me which one.`;
    case 'choice_tap':
      return `Your turn. ${item.prompt} Look at the choices on the screen, and touch the one you pick.`;
    case 'blank':
      return `Your turn. Listen: ${item.prompt} What word goes where the hmm is?`;
    case 'match':
      return `Your turn. Which one goes with ${item.focusText} — ${choicesSpokenFor(item)}? Tell me which one.`;
    case 'sort':
      return `Your turn. Which group does ${item.focusText} go in — ${choicesSpokenFor(item)}? Tell me which one.`;
  }
};

// ============================================================================
// Verdict lines
// ============================================================================

export const correctOptionText = (item: KnowledgeCheckItem): string =>
  (item.options ?? []).find((o) => o.id === item.correctOptionId)?.text ?? '';

/** Affirmation. MUST open "Yes" — the engine scans that sentinel. It echoes
 *  the canonical answer and STOPS: `VERDICT_ENDS_THE_TURN` (defect class 5 —
 *  word-sorter's affirmations ran on into fabricated next asks). */
export const affirmLine = (item: KnowledgeCheckItem): string => {
  switch (item.kind) {
    case 'true_false':
      return `Yes, that one is ${item.correctBool ? 'true' : 'false'}.`;
    case 'choice':
      return `Yes! ${stripEnd(correctOptionText(item))}.`;
    case 'choice_tap':
      return 'Yes! You picked the right one.';
    case 'blank':
      return `Yes, ${item.answerWord}.`;
    case 'match':
      return `Yes, ${item.focusText} goes with ${stripEnd(correctOptionText(item))}.`;
    case 'sort':
      return `Yes, ${item.focusText} goes in ${stripEnd(correctOptionText(item))}.`;
  }
};

/**
 * Corrections open "My turn:", re-model, then re-elicit (standing gate 3) —
 * and on every closed-menu kind they must NOT name the right answer: a named
 * answer turns the retry into an echo, and with two options it hands the
 * verdict over outright. The answer is earned at the correction cap, in
 * `moveOnCue`. What the re-model gives back is the STIMULUS — the statement,
 * the sentence, the menu — which is what a teacher re-reads.
 */
export const correctionLine = (item: KnowledgeCheckItem): string => {
  switch (item.kind) {
    case 'true_false':
      return `My turn: listen again, and think about whether it really happens that way. ${item.prompt} Your turn. Is that true, or false?`;
    case 'choice':
      return `My turn: let's think about it again. Your turn. ${item.prompt} Is it ${choicesSpokenFor(item)}? Tell me which one.`;
    case 'choice_tap':
      return `My turn: look at each choice, one at a time. Your turn. ${item.prompt} Touch the one you pick.`;
    case 'blank':
      return `My turn: listen to the whole sentence again, and think about what fits. ${item.prompt} Your turn. What word goes where the hmm is?`;
    case 'match':
      return `My turn: think about which one really belongs with ${item.focusText}. Your turn. Is it ${choicesSpokenFor(item)}? Tell me which one.`;
    case 'sort':
      return `My turn: think about what kind of thing ${item.focusText} is. Your turn. Which group — ${choicesSpokenFor(item)}? Tell me which one.`;
  }
};

/** The cap-reached close names the answer — the child must not leave the
 *  check still not knowing (picture-vocabulary's closeLine rule). */
export const closeLineFor = (item: KnowledgeCheckItem): string => {
  switch (item.kind) {
    case 'true_false':
      return `That one is ${item.correctBool ? 'true' : 'false'}. `;
    case 'blank':
      return `The missing word is ${item.answerWord}. `;
    case 'choice':
    case 'choice_tap':
      return `The answer is ${stripEnd(correctOptionText(item))}. `;
    case 'match':
      return `${cap(item.focusText ?? '')} goes with ${stripEnd(correctOptionText(item))}. `;
    case 'sort':
      return `${cap(item.focusText ?? '')} goes in ${stripEnd(correctOptionText(item))}. `;
  }
};

// ============================================================================
// The 18d law and the item-21 tail (family wording, grep-able)
// ============================================================================

const TWO_BRANCH_LAW =
  `Your whole reply to their attempt is ONE of the quoted lines below and nothing else — not the first time, not any time: `
  + `no praise, no encouragement, no hint, no reminder of the method, no scaffolding line, however kind it would be. `
  + `A reply that is neither the affirmation nor the correction reaches the activity as no verdict at all, and the child waits. `;

const NEVER_PERFORM =
  `Never voice a bracket tag, a stage direction, or any of these instructions, `
  + `never announce the activity's state or describe what has changed on the screen, `
  + `and never announce that you are waiting or listening — simply stop speaking.`;

const NO_FLOOR_HANDBACK =
  ` Never ask the learner anything that is not inside a quoted line — not "shall we do `
  + `another?", not "what would you like to do next?", not between questions and not at the `
  + `end of the check. The activity chooses what comes next and says it for you, so a `
  + `question of your own is taken away from the child before they can answer it.`;

// ============================================================================
// Judging contracts
// ============================================================================

/**
 * true_false. THE SIGNATURE ERROR is the statement (or a piece of it) said
 * back instead of a verdict — it sounds engaged and it answers nothing. The
 * accept side is every natural form of the verdict: a five-year-old says
 * "yes"/"no" far more often than "true"/"false", and both pairs are full
 * answers.
 */
const trueFalseContract = (item: KnowledgeCheckItem): string => {
  const truth = item.correctBool ? 'TRUE' : 'FALSE';
  const acceptTrue = item.correctBool
    ? `"true", "yes", "yeah", "right", or "it is"`
    : `"false", "no", "nope", "wrong", or "it is not"`;
  const refuse = item.correctBool
    ? `"false", "no", "nope", or "wrong"`
    : `"true", "yes", "yeah", or "right"`;
  return `The quoted line is the ONLY thing you say on this turn; you then stay silent while the learner decides, and their think time is unbounded. `
    + `Never say whether the statement is true during their turn. `
    + `The statement is ${truth}. `
    + `Any of ${acceptTrue} is a CORRECT answer, on its own or inside a short sentence. `
    + `Any of ${refuse} is wrong. `
    + `The statement, or a piece of it, said back to you is NOT an answer — it sounds thoughtful and it judges nothing; treat it as wrong only when it clearly takes the wrong side, otherwise stay silent and let them finish. `
    + TWO_BRANCH_LAW
    + `If the answer is right, say exactly: "${affirmLine(item)}" and stop. `
    + `If it is wrong, say exactly: "${correctionLine(item)}" and stop — the learner tries again while you stay silent. `
    + `Never begin any other sentence with the word "Yes" or the words "My turn".`;
};

/**
 * Spoken choice from a spoken menu (choice / match / sort). The accept side
 * is the whole design: the child names a choice with the whole thing, the
 * distinguishing part, the picture, or the position — a young child answers
 * with the short form far more often than the full string, and the short form
 * is a full answer. Ear-separability is a build gate, so one choice is named
 * or none is.
 *
 * Per-kind signature error, named so the judge refuses it:
 *  - sort: the ITEM said back ("spoon") instead of a group — fluent, engaged,
 *    and not a placement.
 *  - match: the FOCUS said back instead of a partner.
 *  - choice: a menu word said inside a "both"/"maybe" hedge — one choice must
 *    be committed to.
 */
const spokenChoiceContract = (item: KnowledgeCheckItem): string => {
  const options = item.options ?? [];
  const numbered = options.map((o, i) => `${i + 1}) "${stripEnd(o.text)}"`).join(' ');
  const correctIndex = options.findIndex((o) => o.id === item.correctOptionId) + 1;
  const signature = item.kind === 'sort'
    ? `Saying "${item.focusText}" back to you names no group — it is the thing being sorted, not a placement; treat it as no answer and stay silent while they think. `
    : item.kind === 'match'
      ? `Saying "${item.focusText}" back to you names no partner; treat it as no answer and stay silent while they think. `
      : `Naming two choices, or hedging between them, commits to nothing; stay silent and let them settle on one. `;
  return `The quoted line is the ONLY thing you say on this turn; you then stay silent while the learner thinks, and their think time is unbounded. `
    + `Never say which one is right and never hint at it. `
    + `The learner answers OUT LOUD, by telling you which choice they pick. `
    + `The choices, in the order you just said them, are: ${numbered}. `
    + `The correct one is number ${correctIndex}. `
    + `They have named a choice if they say the whole thing, OR just the part that tells it apart from the others, OR what its picture shows, OR where it is in the list ("the second one", "the last one"). `
    + `A young child answers with the short form far more often than the whole thing, and the short form is a full answer, not a lesser one. `
    + signature
    + TWO_BRANCH_LAW
    + `If they named the correct choice, say exactly: "${affirmLine(item)}" and stop. `
    + `If they named a different one, say exactly: "${correctionLine(item)}" and stop — the learner tries again while you stay silent. `
    + `If you truly cannot tell WHICH choice they meant — they trailed off, or what they said fits two of them — do not guess and do not judge: `
    + `say exactly "Tell me that one again." and wait for them. `
    + `Never begin any other sentence with the word "Yes" or the words "My turn".`;
};

/**
 * Spoken blank. THE SIGNATURE ERROR is a word-bank distractor said fluently —
 * it is on screen, it is on topic, and it does not fit the sentence; that is
 * the exact discrimination this problem type exists to measure. The accept
 * side is the answer inside a phrase, or the whole sentence said with the
 * answer in place — a child who re-says the sentence correctly filled has
 * answered.
 */
const blankContract = (item: KnowledgeCheckItem): string =>
  `The quoted line is the ONLY thing you say on this turn; you then stay silent while the learner thinks, and their think time is unbounded. `
  + `Never say the missing word during their turn. `
  + `The missing word is "${item.answerWord}". `
  + `The word said on its own, inside a phrase, or inside the whole sentence said back with the word in its place — all of those are CORRECT; affirm and echo "${item.answerWord}". `
  + `A different word — including a word they can see in the word bank on the screen — that does not truly fit the sentence is wrong, however confident it sounds. `
  + `The sentence said back with "hmm" still in it is not an answer. `
  + TWO_BRANCH_LAW
  + `If the answer is right, say exactly: "${affirmLine(item)}" and stop. `
  + `If it is wrong, say exactly: "${correctionLine(item)}" and stop — the learner tries again while you stay silent. `
  + `Never begin any other sentence with the word "Yes" or the words "My turn".`;

/**
 * The tap kind's turn contract — FACTS, never orders (a stated imperative
 * gets performed; ten-frame's "[WAIT silently]" was read aloud to a child).
 * The verdict for a tap arrives by a separate [KC_TAP] cue with the match
 * code-computed, so this contract carries no verdict branches at all.
 */
const tapContract = (): string =>
  `The quoted line is the ONLY thing you say on this turn. The learner answers with their hands, `
  + `by touching a choice on the screen — there is nothing for you to listen for, and anything you `
  + `hear while they work is thinking out loud, not an answer. The activity tells you what they `
  + `chose and which line to say; until it does, you have nothing to judge and nothing to say. `
  + `Never say which choice is right, and never describe the choices beyond the question you just asked. `
  + `Never begin any other sentence with the word "Yes" or the words "My turn".`;

const contractFor = (item: KnowledgeCheckItem): string => {
  switch (item.kind) {
    case 'true_false': return trueFalseContract(item);
    case 'choice':
    case 'match':
    case 'sort': return spokenChoiceContract(item);
    case 'blank': return blankContract(item);
    case 'choice_tap': return tapContract();
  }
};

// ============================================================================
// Cues
// ============================================================================

export interface KnowledgeCheckCueOptions {
  opening?: boolean;
  howToPlay?: boolean;
}

const GREETING = 'Time to show what you know! ';

export const itemCue = (
  item: KnowledgeCheckItem,
  opts: KnowledgeCheckCueOptions = {},
): string => {
  const greeting = opts.opening ? GREETING : '';
  const how = opts.opening || opts.howToPlay ? howToPlayFor(item) : '';
  return `[KC_ITEM] Say exactly: "${greeting}${how}${askFor(item)}" `
    + `${contractFor(item)} ${NEVER_PERFORM}${NO_FLOOR_HANDBACK}`;
};

const SORRY = 'Good try. ';
const END_OF_CHECK = 'That is the end of our check.';

export const moveOnCue = (
  item: KnowledgeCheckItem,
  next: KnowledgeCheckItem | null,
  opts: KnowledgeCheckCueOptions = {},
): string => {
  const close = closeLineFor(item);
  if (!next) {
    return `[KC_MOVE] Say exactly: "${SORRY}${close}${END_OF_CHECK}" `
      + `Then stop — the activity is over. ${NEVER_PERFORM}${NO_FLOOR_HANDBACK}`;
  }
  const how = opts.howToPlay ? howToPlayFor(next) : '';
  return `[KC_MOVE] Stop correcting "${item.id}". Say exactly: `
    + `"${SORRY}${close}${how}${askFor(next)}" `
    + `${contractFor(next)} ${NEVER_PERFORM}${NO_FLOOR_HANDBACK}`;
};

export const completeCue = (): string =>
  `[KC_COMPLETE] Say exactly: "You finished the whole check. Great thinking today!" `
  + `Then stop — the activity is over. ${NEVER_PERFORM}${NO_FLOOR_HANDBACK}`;

/** Tap-to-hear: the QUESTION side again — the ask, whole, never the answer
 *  and never a hint ladder. */
export const pronounceCue = (item: KnowledgeCheckItem): string =>
  `[KC_HEAR] The learner tapped to hear the question again. Say ONLY this, warmly, then wait: "${askFor(item)}" `
  + `Do not treat anything you just heard as an answer, add nothing, and never say the answer. `
  + NEVER_PERFORM + NO_FLOOR_HANDBACK;

/**
 * The tap verdict — the match is CODE-COMPUTED by the stage and this cue
 * tells the tutor which line to say. `tappedIndex` is 0-based.
 */
export const tapVerdictCue = (
  item: KnowledgeCheckItem,
  tappedIndex: number,
): string => {
  const options = item.options ?? [];
  const correct = options.findIndex((o) => o.id === item.correctOptionId);
  const isRight = tappedIndex === correct;
  const line = isRight ? affirmLine(item) : correctionLine(item);
  return `[KC_TAP] The learner touched choice ${tappedIndex + 1} of ${options.length}. `
    + `${isRight ? 'That is the correct choice.' : 'That is not the correct choice.'} `
    + `Say exactly: "${line}" and stop${isRight ? '' : ' — the learner tries again while you stay silent'}. `
    + `${NEVER_PERFORM}${NO_FLOOR_HANDBACK}`;
};

/**
 * Runtime state, ANSWER-FREE by construction: every kind pushes its QUESTION
 * side and nothing else — never the key, never the correct option, and never
 * the menu (the judging contract already carries the numbered choices at the
 * moment the tutor needs them; a second copy in the state block is a second
 * channel to leak from). The blank sentence is already blanked.
 */
export const stimulusFor = (item: KnowledgeCheckItem): string => {
  switch (item.kind) {
    case 'true_false': return item.prompt;
    case 'blank': return item.prompt;
    case 'choice':
    case 'choice_tap': return item.prompt;
    case 'match': return `Which one goes with ${item.focusText}?`;
    case 'sort': return `Which group does ${item.focusText} go in?`;
  }
};

// ── THE WIRE — what the tutor is told, shared with the DI drive harness ──────

export const knowledgeCheckPackBase = (
  items: KnowledgeCheckItem[],
): JudgedCueSurface<KnowledgeCheckItem> => ({
  primitiveType: 'knowledge-check',
  activityLine: 'live direct instruction knowledge check — the closing questions of the lesson, answered out loud',
  items,
  itemCue,
  moveOnCue,
  completeCue,
  pronounceCue,
  contextFor: (item) => ({
    challengeType: item.kind,
    stimulus: stimulusFor(item),
  }),
});

// ============================================================================
// Harness answer material — what a right and a wrong child sound like
// ============================================================================

/** The words of this option that appear in NO other option — guaranteed
 *  non-empty by the ear-separability build gate. */
const distinctiveWordsOf = (item: KnowledgeCheckItem, option: KnowledgeCheckOption): string[] => {
  const others = new Set(
    (item.options ?? []).filter((o) => o.id !== option.id).flatMap((o) => tokensOf(o.text)),
  );
  return tokensOf(option.text).filter((word) => !others.has(word));
};

const shortFormOf = (item: KnowledgeCheckItem, option: KnowledgeCheckOption): string => {
  const words = distinctiveWordsOf(item, option)
    .filter((w) => w.length >= 3)
    .sort((a, b) => b.length - a.length);
  return words[0] ?? stripEnd(sanitize(option.text));
};

export interface KnowledgeCheckHarnessAnswers {
  correct: string;
  plainWrong: string;
  signatureWrong?: { text: string; why: string };
  /** choice_tap: the tapped option INDEX a right and a wrong child commit —
   *  the payload `tapVerdictCue` takes. */
  placed?: { correct: number; wrong: number };
  leakTokens: string[];
  leakExemptSpan?: string | string[];
}

/**
 * The answers a headless student says on a judged drive. Each contract above
 * CLAIMS the judge refuses exactly these; this makes the claim testable.
 */
export const knowledgeCheckHarnessAnswers = (
  item: KnowledgeCheckItem,
): KnowledgeCheckHarnessAnswers => {
  if (item.kind === 'true_false') {
    const fragment = tokensOf(item.prompt).filter((w) => w.length >= 3).slice(0, 3).join(' ');
    return {
      correct: item.correctBool ? 'yes' : 'no',
      plainWrong: item.correctBool ? 'false' : 'true',
      ...(fragment
        ? {
            signatureWrong: {
              text: fragment,
              why: 'a piece of the statement said back instead of a verdict — engaged-sounding '
                + 'and judging nothing. The contract says to treat it as an answer only when it '
                + 'clearly takes the wrong side; a judge that affirms it has graded participation',
            },
          }
        : {}),
      leakTokens: [], // "true"/"false" are the menu of every TF ask by design
    };
  }

  if (item.kind === 'blank') {
    const answer = item.answerWord ?? '';
    const inSentence = new Set(tokensOf(item.prompt));
    const bankDecoy = (item.wordBank ?? [])
      .map(normalizeWord)
      .filter((w) => w && w !== normalizeWord(answer) && !inSentence.has(w))
      .sort((a, b) => b.length - a.length)[0];
    return {
      correct: answer,
      plainWrong: bankDecoy ?? 'banana',
      ...(bankDecoy
        ? {
            signatureWrong: {
              text: bankDecoy,
              why: 'a word-bank distractor said fluently — on screen, on topic, and not a fit '
                + 'for the sentence. Discriminating it from the answer is the whole problem type; '
                + 'a judge that accepts any bank word affirms it',
            },
          }
        : {}),
      leakTokens: tokensOf(answer).filter((w) => w.length >= 3),
    };
  }

  // choice / choice_tap / match / sort — a menu kind.
  const options = item.options ?? [];
  const correctOption = options.find((o) => o.id === item.correctOptionId);
  const wrongOption = options.find((o) => o.id !== item.correctOptionId);
  const menuSpan = choicesSpokenFor(item);
  const askedWords = new Set(tokensOf(item.prompt));
  const signature = item.kind === 'sort' || item.kind === 'match'
    ? {
        text: item.focusText ?? '',
        why: item.kind === 'sort'
          ? 'the item said back instead of a group — the fluent non-placement the contract '
            + 'names; a judge scoring "did I hear an on-topic word" affirms it'
          : 'the focus item said back instead of a partner — names no choice at all',
      }
    : wrongOption
      ? {
          text: shortFormOf(item, wrongOption),
          why: 'the short form of a WRONG choice — the exact utterance shape the contract '
            + 'accepts as a full answer, pointed at the wrong card',
        }
      : undefined;
  const correctIndex = options.findIndex((o) => o.id === item.correctOptionId);
  const wrongIndex = options.findIndex((o) => o.id !== item.correctOptionId);
  return {
    correct: correctOption ? shortFormOf(item, correctOption) : '',
    plainWrong: wrongOption ? stripEnd(sanitize(wrongOption.text)) : 'nothing',
    ...(item.kind === 'choice_tap'
      ? { placed: { correct: Math.max(0, correctIndex), wrong: Math.max(0, wrongIndex) } }
      : {}),
    ...(signature && signature.text ? { signatureWrong: signature } : {}),
    // The menu is the ask (exempt); the leak scan hunts the correct choice's
    // distinctive words OUTSIDE it — minus words the question itself says.
    leakTokens: correctOption
      ? distinctiveWordsOf(item, correctOption)
          .filter((w) => w.length >= 3 && !askedWords.has(w))
      : [],
    ...(menuSpan ? { leakExemptSpan: menuSpan } : {}),
  };
};

/** Re-export for the di-script test's span asserts. */
export { spokenSpansOf };
