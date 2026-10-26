/**
 * knowledgeCheckScript — the items a knowledge check asks (qa/di/BACKLOG.md
 * item 23 slice 2). Problem CONTENT stays generator-scoped; this module owns the
 * answer-material fork, the build gates, the asks and the harness answers. The
 * scripted cues and judging contracts were retired when the family moved onto
 * its boss (`knowledgeCheck.card.ts` + `knowledgeCheck.boss.ts`, 2026-10-26):
 * the tutor now judges against the item's `SpokenKey` (`knowledgeCheckWorkspace.ts`).
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
 *   (BLOCKED). Each is worked on screen instead — see below.
 *
 * ── PER-PROBLEM FALLBACK (R7) ─────────────────────────────────────────────
 * Knowledge-check completion is gated per problem (`${instanceId}::pN`,
 * KindergartenStage), so every problem must yield at least one item. A problem
 * the spoken kinds cannot ask (sequencing, an unsayable or leaking draw)
 * becomes ONE `on_screen` item: the tutor reads it, the child works the
 * problem's own surface, and that surface's check is the verdict. The set
 * stays on the workspace.
 *
 * ── ANSWER-LEAK RULES, PER KIND ────────────────────────────────────────────
 *  - choice/match/sort: the ask necessarily speaks the menu — that is the
 *    QUESTION side, exempt by construction (`leakExemptSpan`). What is never
 *    exempt: a STEM that contains the correct option's distinguishing words
 *    (dropped at build).
 *  - blank: the sentence is spoken with "hmm" in the gap; a sentence that
 *    also contains the answer word elsewhere is dropped, and tap-to-hear
 *    re-speaks the blanked sentence, never the bank.
 *  - sort: an item whose own text contains a group-name token names its
 *    answer in the ask (defect class 11) — dropped.
 *  - true_false: the statement is both stimulus and question; "true" leaks
 *    nothing.
 *
 * A generated sentence that opens with "Yes" or "My turn" is still dropped at
 * build (`opensWithSentinel`), a gate kept from the scripted era.
 */

import type {
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
  ProductionProblemData,
  Inset,
  VisualPrimitive,
} from '../types';
import { MAX_SENTENCE_WORDS } from './visual-primitives/direct-instruction/diSentenceReadingDomain';
import {
  serializeInsetForPrompt,
  spokenArrangement,
  spokenGlyphCard,
  spokenNumberSentence,
} from '../service/insets/serialize';
import { findInsetAnswerLeaks } from '../service/insets/leaks';
import { containsPhrase } from '../components/live-activity/spokenKey';

// ============================================================================
// Item model
// ============================================================================

/**
 * The six click-era kinds plus the three PRODUCTION kinds of the KC redesign
 * (P2, 2026-09-05): the child sees a stimulus that is NOT the answer and
 * produces — says a name / value (`say_it`), says a count (`how_many`), or
 * points at a form in a printed sentence (`point_to`, the honest tap per the
 * DI ruling: tap only for position / form / build).
 */
export type KnowledgeCheckItemKind =
  | 'true_false'
  | 'choice'
  | 'choice_tap'
  | 'blank'
  | 'match'
  | 'sort'
  | 'say_it'
  | 'point_to'
  | 'how_many'
  | 'on_screen';

/** Standing gate 1: what each kind's answer is MADE of. `say_it` narrows per
 *  item (`responseClassForProduction`) — this is its widest class. */
export const responseClassFor = (kind: KnowledgeCheckItemKind): ResponseClassId =>
  kind === 'true_false'
    ? 'yes_no'
    : kind === 'blank' || kind === 'say_it'
      ? 'short_spoken_word'
      : kind === 'how_many'
        ? 'number_word_to_20'
        : kind === 'choice_tap' || kind === 'point_to' || kind === 'on_screen'
          ? 'manipulation'
          : 'closed_set_choice';

/** The benched class a production item's answer belongs to, by what the card
 *  shows: a numeral → number word; a letter → letter name (build-ahead); a
 *  shape → shape name; an operator → one short word. */
export const responseClassForProduction = (p: ProductionProblemData): ResponseClassId => {
  if (p.kind === 'point_to') return 'manipulation';
  if (p.kind === 'how_many') return 'number_word_to_20';
  if (p.stimulus.insetType === 'glyph-card') {
    switch (p.stimulus.glyphKind) {
      case 'numeral': return Number(p.stimulus.glyph) > 20 ? 'number_word_to_120' : 'number_word_to_20';
      case 'letter': return 'letter_name';
      case 'shape': return 'shape_name';
      default: return 'short_spoken_word';
    }
  }
  return 'short_spoken_word';
};

export const answerKindFor = (kind: KnowledgeCheckItemKind): 'voice' | 'gesture' =>
  kind === 'choice_tap' || kind === 'point_to' || kind === 'on_screen' ? 'gesture' : 'voice';

export const isProductionKind = (kind: KnowledgeCheckItemKind): boolean =>
  kind === 'say_it' || kind === 'point_to' || kind === 'how_many';

export interface KnowledgeCheckOption {
  id: string;
  text: string;
  emoji?: string;
  /** choice / choice_tap: the generator's near/far tag on a wrong option (`drop_far_choice`). Never rendered. */
  distance?: 'key' | 'near' | 'far';
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
  /** Production kinds: what the child SEES (stimulus ≠ answer). */
  stimulus?: Inset;
  /** Legacy MC/TF: the orchestrator-planned evidence the problem was written
   *  against (a number line, a picture key). The judged surface renders it and
   *  the contract describes it — a question written about a number line that
   *  is not on screen ("what number do you land on?") is unanswerable. */
  inset?: Inset;
  visual?: VisualPrimitive;
  /** Production kinds: the canonical spoken answer, plus equally-correct forms. */
  expectedAnswer?: string;
  alternates?: string[];
  /** point_to: the number-sentence token the child must touch. */
  targetTokenId?: string;
  /** choice / choice_tap: the generated picture cue (`cue_picture` lever), shown only when pulled. */
  cue?: { picture: string; shows: string };
  /** on_screen: the answer as the cap-reached close says it ("first dig, then load"); empty when the problem's
   *  answer has no short spoken form. */
  closeAnswer?: string;
  /** on_screen from a multiple-choice or true/false problem: the key a spoken answer is judged against, so the
   *  item takes the answer said aloud as well as the work on screen (user ruling 10-12). Absent for kinds with no
   *  short spoken form (sequencing). */
  spokenKey?: { answer: string; others: string[] } | { truth: boolean };
}

// ── Small helpers (family idiom)────────────────────────────────────────────

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

/** Quoted spans in a raw (unsanitized) stem: "…", “…”, ‘…’, or '…' opened after
 *  a space/colon/start and closed before a space/punctuation/end, so an
 *  apostrophe inside a word does not open one. */
const QUOTED_SPAN = /"([^"]+)"|“([^”]+)”|‘([^’]+)’|(?:^|(?<=[\s:(]))'([^']+)'(?=[\s.,;:?!)]|$)/g;

/** The stem with the quoted sentence removed, when one quoted span contains
 *  every word of every option (the options are words of that sentence).
 *  Otherwise the whole sanitized stem. */
export const stemOutsideMenuQuote = (rawQuestion: string, options: KnowledgeCheckOption[]): string => {
  for (const match of Array.from(rawQuestion.matchAll(QUOTED_SPAN))) {
    const quoted = new Set(tokensOf(match[1] ?? match[2] ?? match[3] ?? match[4] ?? ''));
    if (options.length >= 2 && options.every((o) => tokensOf(o.text).every((w) => quoted.has(w)))) {
      return sanitize(rawQuestion.replace(match[0], ' '));
    }
  }
  return sanitize(rawQuestion);
};

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
    ...(p.inset ? { inset: p.inset } : {}),
    ...(p.visual ? { visual: p.visual } : {}),
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
    ...(o.distance ? { distance: o.distance } : {}),
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
    // "Which word in 'The dog barks.' is the verb?": the quoted sentence holds
    // EVERY choice, so it names the key no more than the menu does. Only the
    // rest of the stem is checked.
    const stemTokens = new Set(tokensOf(stemOutsideMenuQuote(p.question ?? '', options)));
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
      ...(p.inset ? { inset: p.inset } : {}),
      ...(p.visual ? { visual: p.visual } : {}),
      ...(p.cue ? { cue: p.cue } : {}),
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
    ...(p.inset ? { inset: p.inset } : {}),
    ...(p.visual ? { visual: p.visual } : {}),
    ...(p.cue ? { cue: p.cue } : {}),
  }];
};

/** The blanked sentence exactly as the tutor speaks it: the gap is "hmm".
 *  `[blank_N]` is the generator's own marker (FillInBlanksProblem splits on it). */
export const blankSpokenSentence = (textWithBlanks: string): string =>
  sanitize(textWithBlanks).replace(/_{2,}|\[blank(?:_\d+)?\]|\{\{\s*blank\s*\}\}/gi, 'hmm');

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

/**
 * Production items (KC redesign P2). KEEP-OR-DROP like every other builder:
 * the ask must be speakable, the answer must be one to three plain words
 * clean of sentinels, the stimulus must exist, a `point_to` target must
 * resolve to a token, and the per-type inset leak rule must pass — the
 * generator already ran it, but this is the runtime's own gate (belt and
 * suspenders, the same posture as `choiceSpokenReason`).
 */
const itemsFromProduction = (
  p: ProductionProblemData,
  problemIndex: number,
): KnowledgeCheckItem[] => {
  const prompt = sanitize(p.ask ?? '');
  if (!promptUsable(prompt)) return [];
  if (!p.stimulus) return [];
  const answer = sanitize(p.expectedAnswer ?? '');
  if (!answer || wordsIn(answer) > 3 || opensWithSentinel(answer)) return [];
  if (VERDICT_WORDS.has(normalizeWord(answer))) return [];
  const alternates = (p.alternates ?? []).map(sanitize).filter((a) => a && !opensWithSentinel(a));
  if (p.kind === 'point_to') {
    if (p.stimulus.insetType !== 'number-sentence') return [];
    if (!p.targetTokenId || !p.stimulus.tokens.some((t) => t.id === p.targetTokenId)) return [];
  }
  if (findInsetAnswerLeaks(p.stimulus, {
    kind: p.kind, ask: prompt, expectedAnswer: answer, alternates, targetTokenId: p.targetTokenId,
  }).length > 0) return [];
  const options = (p.options ?? []).map((o) => ({ id: o.id, text: sanitize(o.text), emoji: o.emoji }));
  return [{
    id: `p${problemIndex}-${p.kind}`,
    kind: p.kind,
    answerKind: answerKindFor(p.kind),
    responseClass: responseClassForProduction(p),
    action: p.kind,
    problemIndex,
    prompt,
    stimulus: p.stimulus,
    expectedAnswer: answer,
    alternates,
    ...(p.targetTokenId ? { targetTokenId: p.targetTokenId } : {}),
    // The fallback menu rides along for the harness's plain-wrong answer and
    // the reveal; the judged stage never renders it for a production kind.
    options,
    correctOptionId: p.correctOptionId,
  }];
};

const itemsFromProblem = (p: ProblemData, problemIndex: number): KnowledgeCheckItem[] => {
  switch (p.type) {
    case 'true_false': return itemsFromTrueFalse(p, problemIndex);
    case 'multiple_choice': return itemsFromChoice(p, problemIndex);
    case 'fill_in_blanks': return itemsFromBlanks(p, problemIndex);
    case 'matching_activity': return itemsFromMatching(p, problemIndex);
    case 'categorization_activity': return itemsFromSort(p, problemIndex);
    case 'production': return itemsFromProduction(p, problemIndex);
    default: return []; // sequencing (slice 2b), scenario, short_answer
  }
};

/**
 * The ANSWER this item closes on, for the answered-once invariant. Sort is
 * EXEMPT by design: a sort's answer is the relation (item × group), the group
 * label repeats by construction (word-sorter's shipped shape), and the item
 * being placed is new every time. true_false is exempt for the same reason a
 * yes/no round is — the verdict pair is the response CLASS, not content.
 * PRODUCTION kinds are exempt for sort's reason: their key is (stimulus ×
 * answer) and the stimulus is a fresh draw each time (a new arrangement, the
 * other letter case, a different sentence) — the generator's `used` set keeps
 * identical stimuli apart, so a repeated "three" is a new count, not recall
 * of the tutor's last sentence.
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
  /** False only for an empty set: a problem with no spoken item is worked
   *  on screen (`on_screen`; see the header). */
  judgedViable: boolean;
  dropped: number;
}

/** The answer of a problem worked on screen, as the cap-reached close says it. */
const closeAnswerOf = (p: ProblemData): string => {
  switch (p.type) {
    case 'multiple_choice': return sanitize(p.options?.find((o) => o.id === p.correctOptionId)?.text ?? '');
    case 'true_false': return p.correct ? 'true' : 'false';
    case 'sequencing_activity': return (p.items ?? []).map((i) => stripEnd(sanitize(i))).join(', then ');
    default: return '';
  }
};

/**
 * A problem the spoken kinds cannot ask (sequencing, an unsayable or leaking draw) is worked on screen INSIDE the
 * session: the tutor reads it, the child does it with the problem's own surface, and the problem's own check is the
 * verdict. One problem no longer sends the whole set to the tap flow.
 */
const onScreenItem = (p: ProblemData, problemIndex: number): KnowledgeCheckItem => {
  const raw = 'question' in p ? p.question : 'statement' in p ? p.statement : 'instruction' in p ? p.instruction
    : 'textWithBlanks' in p ? blankSpokenSentence(p.textWithBlanks) : '';
  const stem = sanitize(String(raw ?? ''));
  const closeAnswer = closeAnswerOf(p);
  // A stem that already says its answer (class 11) cannot be judged from speech: that problem is worked on screen only.
  const spokenKey: KnowledgeCheckItem['spokenKey'] = p.type === 'true_false' ? { truth: !!p.correct }
    : p.type === 'multiple_choice' && closeAnswer && !containsPhrase(stem, stripEnd(closeAnswer)) ? { answer: stripEnd(closeAnswer),
      others: (p.options ?? []).filter((o) => o.id !== p.correctOptionId).map((o) => stripEnd(sanitize(o.text))).filter(Boolean) }
    : undefined;
  return {
    id: `p${problemIndex}-screen`,
    kind: 'on_screen',
    answerKind: 'gesture',
    responseClass: responseClassFor('on_screen'),
    action: 'on_screen',
    problemIndex,
    prompt: stem && !opensWithSentinel(stem) ? stem : 'Look at this one on the screen.',
    ...(closeAnswer ? { closeAnswer } : {}),
    ...(spokenKey ? { spokenKey } : {}),
  };
};

export const itemsFromProblems = (problems: ProblemData[]): KnowledgeCheckBuild => {
  if (!problems.length) return { items: [], judgedViable: false, dropped: 0 };
  const raw = problems.flatMap((p, i) => itemsFromProblem(p, i));
  const deduped = dropRepeatAnswers(raw);
  const selected = selectToCap(deduped);
  const covered = new Set(selected.map((i) => i.problemIndex));
  const items = problems.flatMap((p, i) => (covered.has(i)
    ? selected.filter((item) => item.problemIndex === i)
    : [onScreenItem(p, i)]));
  return { items, judgedViable: true, dropped: raw.length - selected.length };
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
    case 'say_it':
      return `Your turn. Look at the card. ${item.prompt}`;
    case 'how_many':
      return `Your turn. Look at the picture. ${item.prompt}`;
    case 'point_to':
      return `Your turn. Look at the number sentence. ${item.prompt}`;
    case 'on_screen':
      return `Your turn. ${item.prompt} ${item.spokenKey ? 'Tell me, or show me on the screen.' : 'Do it on the screen.'}`;
  }
};

// ============================================================================
// What the screen shows
// ============================================================================

export const correctOptionText = (item: KnowledgeCheckItem): string =>
  (item.options ?? []).find((o) => o.id === item.correctOptionId)?.text ?? '';

/** What the blind tutor is told a LEGACY item shows — the planned evidence
 *  (a number line, a picture key). Empty when the problem is text-only. */
export const evidenceDescription = (item: KnowledgeCheckItem): string => {
  const parts: string[] = [];
  if (item.inset) parts.push(`The screen shows this evidence: ${serializeInsetForPrompt(item.inset)}.`);
  if (item.visual?.type === 'object-collection') {
    const items = (item.visual.data as { items?: Array<{ name: string; icon: string; count: number }> }).items ?? [];
    if (items.length) parts.push(`The screen shows these pictures: ${items.map((i) => `${i.count} × ${i.name} (${i.icon})`).join(', ')}.`);
  } else if (item.visual?.type === 'comparison-panel') {
    const panels = (item.visual.data as { panels?: Array<{ label: string; collection: { items: Array<{ name: string; icon: string }> } }> }).panels ?? [];
    if (panels.length) parts.push(`The screen shows two pictures side by side: ${panels.map((p) => `"${p.label}" — ${p.collection.items.map((i) => `${i.name} (${i.icon})`).join(', ')}`).join('; ')}.`);
  }
  return parts.length ? `${parts.join(' ')} ` : '';
};

/** What the blind tutor is told the child is LOOKING at. The tutor needs it
 *  to judge ("is that the numeral on the card?"); it never enters the runtime
 *  state block (answer-free by construction — see `stimulusFor`). */
export const stimulusDescription = (item: KnowledgeCheckItem): string => {
  const s = item.stimulus;
  if (!s) return '';
  switch (s.insetType) {
    case 'glyph-card': return `The screen shows ${spokenGlyphCard(s)}. `;
    case 'arrangement': return `The screen shows ${spokenArrangement(s)}. `;
    case 'number-sentence': return `The screen shows the printed number sentence ${spokenNumberSentence(s)}. `;
    default: return '';
  }
};

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

  if (item.kind === 'point_to' && item.stimulus?.insetType === 'number-sentence') {
    const tokens = item.stimulus.tokens;
    const correct = tokens.findIndex((t) => t.id === item.targetTokenId);
    // The plain wrong is the OTHER operator (the discrimination the objective
    // names); fall back to any other position.
    const otherOperator = tokens.findIndex((t, i) => i !== correct && t.kind === 'operator');
    const wrong = otherOperator >= 0 ? otherOperator : tokens.findIndex((_, i) => i !== correct);
    return {
      correct: item.expectedAnswer ?? '',
      plainWrong: tokens[wrong]?.text ?? '?',
      placed: { correct: Math.max(0, correct), wrong: Math.max(0, wrong) },
      signatureWrong: {
        text: tokens[wrong]?.text ?? '?',
        why: 'the OTHER sign in the sentence — the exact confusion the objective names '
          + '(minus for equals); a verdict that affirms it has graded "touched a sign", not "touched THE sign"',
      },
      // The ask NAMES the sign by design ("touch the minus sign"): the name is
      // the question side for a point item, so nothing is a leak token here.
      leakTokens: [],
    };
  }

  if (item.kind === 'say_it' || item.kind === 'how_many') {
    const answer = item.expectedAnswer ?? '';
    const wrongOption = (item.options ?? []).find((o) => o.id !== item.correctOptionId);
    const stimulus = item.stimulus;
    let signature: { text: string; why: string } | undefined;
    if (item.kind === 'how_many' && stimulus?.insetType === 'arrangement') {
      if ((stimulus.removed ?? 0) > 0) {
        signature = {
          text: String(stimulus.count),
          why: 'the START count — every object counted and the crossed-out ones ignored; '
            + 'fluent, confident, and exactly the misread a take-away picture exists to catch',
        };
      } else {
        signature = {
          text: String(stimulus.count + 1),
          why: 'an off-by-one count said confidently — the near miss a judge scoring "said a number" affirms',
        };
      }
    } else if (stimulus?.insetType === 'glyph-card' && stimulus.glyphKind === 'numeral') {
      signature = {
        text: String(Number(stimulus.glyph) + 1),
        why: 'the NEXT numeral said fluently — the neighbour a child reaches by counting on instead of reading the card',
      };
    } else if (wrongOption) {
      signature = {
        text: stripEnd(sanitize(wrongOption.text)),
        why: 'a plausible neighbour (a look-alike letter, a shape one side off) named confidently',
      };
    }
    return {
      correct: answer,
      plainWrong: wrongOption ? stripEnd(sanitize(wrongOption.text)) : 'banana',
      ...(signature ? { signatureWrong: signature } : {}),
      leakTokens: [...tokensOf(answer), ...(item.alternates ?? []).flatMap(tokensOf)]
        .filter((w) => w.length >= 3),
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
