/**
 * KnowledgeCheck.di-script — machine gates + pedagogy pins for the judged
 * knowledge-check pack (qa/di/BACKLOG.md item 23 slice 2).
 *
 * Plumbing comes from the shared testkit (`checkPackGates` /
 * `checkDiCatalogEntry`) — never re-typed. The pins below are the file's
 * point: the answer-material fork both directions, the per-kind judging
 * contracts, the build gates (KEEP-OR-DROP + the all-or-nothing rule this
 * pack alone carries), and the harness answer material each contract's
 * claims are tested with.
 */
import { describe, it, expect } from 'vitest';
import {
  checkPackGates,
  checkDiCatalogEntry,
} from '../../hooks/judgedScriptContract.testkit';
import { spokenSpansOf } from '../../hooks/judgedScriptContract';
import { ASSESSMENT_CATALOG } from '../../service/manifest/catalog/assessment';
import type {
  ProblemData,
  TrueFalseProblemData,
  MultipleChoiceProblemData,
  FillInBlanksProblemData,
  MatchingActivityProblemData,
  CategorizationActivityProblemData,
} from '../../types';
import {
  answerKindFor,
  responseClassFor,
  blankSpokenSentence,
  choiceSpokenReason,
  choicesSpokenFor,
  itemCue,
  itemsFromProblems,
  knowledgeCheckHarnessAnswers,
  knowledgeCheckPackBase,
  moveOnCue,
  closeLineFor,
  correctionLine,
  affirmLine,
  stimulusFor,
  tapVerdictCue,
  MAX_SESSION_ITEMS,
  type KnowledgeCheckItem,
  type KnowledgeCheckItemKind,
} from '../knowledgeCheckScript';

// ── Fixtures ────────────────────────────────────────────────────────────────

const base = {
  difficulty: 'easy' as const,
  gradeLevel: '1',
  rationale: 'Because that is how it works.',
  teachingNote: '',
  successCriteria: [],
};

const tfProblem = (over: Partial<TrueFalseProblemData> = {}): TrueFalseProblemData => ({
  ...base, type: 'true_false', id: 'tf1',
  statement: 'A spider has eight legs', correct: true, ...over,
});

const mcProblem = (over: Partial<MultipleChoiceProblemData> = {}): MultipleChoiceProblemData => ({
  ...base, type: 'multiple_choice', id: 'mc1',
  question: 'Which animal says moo?',
  options: [
    { id: 'A', text: 'cow', emoji: '🐄' },
    { id: 'B', text: 'duck', emoji: '🦆' },
    { id: 'C', text: 'frog', emoji: '🐸' },
  ],
  correctOptionId: 'A', ...over,
});

const katexProblem = (): MultipleChoiceProblemData => mcProblem({
  id: 'mc2',
  question: 'Which expression equals ten?',
  optionFormat: 'katex',
  options: [{ id: 'A', text: '7+3' }, { id: 'B', text: '5+2' }],
  correctOptionId: 'A',
});

const blankProblem = (over: Partial<FillInBlanksProblemData> = {}): FillInBlanksProblemData => ({
  ...base, type: 'fill_in_blanks', id: 'fb1',
  textWithBlanks: 'The sun rises in the ____',
  blanks: [{ id: 'b1', correctAnswer: 'morning', caseSensitive: false }],
  wordBank: ['morning', 'night', 'shoe'], ...over,
});

const matchProblem = (): MatchingActivityProblemData => ({
  ...base, type: 'matching_activity', id: 'ma1',
  prompt: 'Match each animal to its home',
  leftItems: [{ id: 'L1', text: 'dog' }, { id: 'L2', text: 'bird' }],
  rightItems: [{ id: 'R1', text: 'kennel' }, { id: 'R2', text: 'nest' }, { id: 'R3', text: 'hive' }],
  mappings: [{ leftId: 'L1', rightIds: ['R1'] }, { leftId: 'L2', rightIds: ['R2'] }],
});

const sortProblem = (over: Partial<CategorizationActivityProblemData> = {}): CategorizationActivityProblemData => ({
  ...base, type: 'categorization_activity', id: 'ca1',
  instruction: 'Sort each one by where it lives',
  categories: ['Farm', 'Ocean'],
  categorizationItems: [
    { itemText: 'cow', correctCategory: 'Farm' },
    { itemText: 'shark', correctCategory: 'Ocean' },
    { itemText: 'pig', correctCategory: 'Farm' },
  ], ...over,
});

const fullSet = (): ProblemData[] => [
  tfProblem(), mcProblem(), katexProblem(), blankProblem(), matchProblem(), sortProblem(),
];

const buildAll = () => itemsFromProblems(fullSet());

const catalogEntry = ASSESSMENT_CATALOG.find((c) => c.id === 'knowledge-check')!;

// ── The gates ───────────────────────────────────────────────────────────────

describe('pack gates (shared testkit)', () => {
  it('the full mixed pack passes every structural gate', () => {
    const { items, judgedViable } = buildAll();
    expect(judgedViable).toBe(true);
    expect(checkPackGates(knowledgeCheckPackBase(items))).toEqual([]);
  });

  it('the catalog entry passes the DI catalog contract', () => {
    const { items } = buildAll();
    const pack = knowledgeCheckPackBase(items);
    expect(checkDiCatalogEntry(catalogEntry, pack, items[0])).toEqual([]);
  });

  // ⚠️ The one-item-per-mode fixture above can never trigger the repeat-ask
  // gate. This is the REAL session shape: several same-action items back to
  // back (a whole sort, then consecutive true/false problems).
  it('a real session shape (consecutive same-action items) passes the repeat-ask gate', () => {
    const { items, judgedViable } = itemsFromProblems([
      sortProblem({
        id: 'ca2',
        categorizationItems: [
          { itemText: 'cow', correctCategory: 'Farm' },
          { itemText: 'shark', correctCategory: 'Ocean' },
          { itemText: 'pig', correctCategory: 'Farm' },
          { itemText: 'crab', correctCategory: 'Ocean' },
        ],
      }),
      tfProblem({ id: 'tf2', statement: 'A cow lives in the ocean', correct: false }),
      tfProblem({ id: 'tf3', statement: 'A crab has a hard shell', correct: true }),
    ]);
    expect(judgedViable).toBe(true);
    expect(checkPackGates(knowledgeCheckPackBase(items))).toEqual([]);
  });
});

// ── The answer-material fork, both directions ───────────────────────────────

describe('answer-material fork', () => {
  it('maps every kind to its ruled answer kind and response class', () => {
    const expected: Record<KnowledgeCheckItemKind, [string, string]> = {
      true_false: ['voice', 'yes_no'],
      choice: ['voice', 'closed_set_choice'],
      choice_tap: ['gesture', 'manipulation'],
      blank: ['voice', 'short_spoken_word'],
      match: ['voice', 'closed_set_choice'],
      sort: ['voice', 'closed_set_choice'],
    };
    for (const [kind, [answerKind, responseClass]] of Object.entries(expected)) {
      expect(answerKindFor(kind as KnowledgeCheckItemKind)).toBe(answerKind);
      expect(responseClassFor(kind as KnowledgeCheckItemKind)).toBe(responseClass);
    }
  });

  it('builds one item per problem kind from the mixed set (match expands per pair, sort per item)', () => {
    const { items } = buildAll();
    const kinds = items.map((i) => i.kind);
    expect(kinds.filter((k) => k === 'true_false')).toHaveLength(1);
    expect(kinds.filter((k) => k === 'choice')).toHaveLength(1);
    expect(kinds.filter((k) => k === 'choice_tap')).toHaveLength(1);
    expect(kinds.filter((k) => k === 'blank')).toHaveLength(1);
    expect(kinds.filter((k) => k === 'match')).toHaveLength(2);
    expect(kinds.filter((k) => k === 'sort')).toHaveLength(3);
  });

  it('a sayable MCQ is spoken; katex is the honest tap; ear-inseparable goes to tap too', () => {
    expect(choiceSpokenReason(mcProblem())).toBeNull();
    expect(choiceSpokenReason(katexProblem())).toBe('katex options');
    expect(choiceSpokenReason(mcProblem({
      options: [{ id: 'A', text: 'a cat' }, { id: 'B', text: 'a cat and a dog' }],
      correctOptionId: 'A',
    }))).toBe('options not ear-separable');
  });
});

// ── Per-kind cue contracts ──────────────────────────────────────────────────

describe('cue contracts', () => {
  const itemsByKind = () => {
    const { items } = buildAll();
    return new Map(items.map((i) => [i.kind, i]));
  };

  it('every VOICE cue carries ask + affirm + correction spans; affirm opens Yes, correction opens My turn', () => {
    for (const item of buildAll().items.filter((i) => i.answerKind === 'voice')) {
      const spans = spokenSpansOf(itemCue(item));
      expect(spans.length).toBeGreaterThanOrEqual(3);
      expect(spans[1].startsWith('Yes')).toBe(true);
      expect(spans[2].startsWith('My turn')).toBe(true);
      expect(itemCue(item)).toContain('stay silent');
    }
  });

  it('the TAP cue carries the silence contract and NO verdict branches (the verdict cue is separate)', () => {
    const tap = itemsByKind().get('choice_tap')!;
    const cue = itemCue(tap);
    expect(spokenSpansOf(cue)).toHaveLength(1); // the ask alone
    expect(cue).toContain('nothing for you to listen for');
    expect(cue).not.toContain('If the answer is right');
  });

  it('true_false accepts the natural verdict forms and refuses the statement echoed back', () => {
    const tf = itemsByKind().get('true_false')!;
    const cue = itemCue(tf);
    expect(cue).toContain('"yes"');
    expect(cue).toContain('"yeah"');
    expect(cue).toContain('said back to you is NOT an answer');
    // The correction may not name the verdict — with two options, naming is
    // handing over. The verdict is earned at the cap (closeLine).
    expect(correctionLine(tf)).not.toContain('That one is');
    expect(closeLineFor(tf)).toContain('That one is true');
  });

  it('menu kinds accept the short form and the position, and speak the menu in on-screen order', () => {
    const choice = itemsByKind().get('choice')!;
    const cue = itemCue(choice);
    expect(cue).toContain('the part that tells it apart');
    expect(cue).toContain('"the second one"');
    expect(choicesSpokenFor(choice)).toBe('cow, duck, or frog');
  });

  it('sort names the groups inside the ask (the mats are not a costume) and refuses the item echoed back', () => {
    const sort = itemsByKind().get('sort')!;
    const cue = itemCue(sort);
    expect(spokenSpansOf(cue)[0]).toContain('Farm, or Ocean');
    expect(cue).toContain(`Saying "${sort.focusText}" back to you names no group`);
  });

  it('the capped close names the answer; corrections never did', () => {
    const choice = itemsByKind().get('choice')!;
    expect(closeLineFor(choice)).toContain('cow');
    expect(moveOnCue(choice, null)).toContain('The answer is cow');
  });

  it('tap verdict cues carry the code-computed match', () => {
    const tap = itemsByKind().get('choice_tap')!;
    expect(tapVerdictCue(tap, 0)).toContain('That is the correct choice');
    expect(tapVerdictCue(tap, 0)).toContain(affirmLine(tap));
    expect(tapVerdictCue(tap, 1)).toContain('That is not the correct choice');
  });

  it('the context channel is answer-free: the question side only, never the menu or the key', () => {
    const { items } = buildAll();
    const choice = items.find((i) => i.kind === 'choice')!;
    expect(stimulusFor(choice)).toBe(choice.prompt);
    expect(stimulusFor(choice)).not.toContain('cow');
    const blank = items.find((i) => i.kind === 'blank')!;
    expect(stimulusFor(blank)).toContain('hmm');
    expect(stimulusFor(blank)).not.toContain('morning');
  });
});

// ── Build gates: KEEP-OR-DROP + all-or-nothing ──────────────────────────────

describe('build gates', () => {
  it('a sentinel-opening statement drops its problem, and the SET falls back (all-or-nothing)', () => {
    const { judgedViable } = itemsFromProblems([
      tfProblem({ statement: 'Yes, a spider has eight legs' }),
      mcProblem(),
    ]);
    expect(judgedViable).toBe(false);
  });

  it('a blank whose answer survives elsewhere in the sentence drops (leak), failing the set', () => {
    const { judgedViable } = itemsFromProblems([
      blankProblem({ textWithBlanks: 'The morning sun rises in the ____' }),
    ]);
    expect(judgedViable).toBe(false);
  });

  it('an MCQ whose stem contains the answer drops (class 11), failing the set', () => {
    const { judgedViable } = itemsFromProblems([
      mcProblem({ question: 'Which animal is the cow that says moo?' }),
    ]);
    expect(judgedViable).toBe(false);
  });

  it('a sort item whose own text names a group is dropped; the problem survives on its siblings', () => {
    const { items, judgedViable } = itemsFromProblems([
      sortProblem({
        categorizationItems: [
          { itemText: 'farm cat', correctCategory: 'Farm' }, // names its answer
          { itemText: 'shark', correctCategory: 'Ocean' },
          { itemText: 'cow', correctCategory: 'Farm' },
        ],
      }),
    ]);
    expect(judgedViable).toBe(true);
    expect(items.map((i) => i.focusText)).toEqual(['shark', 'cow']);
  });

  it('matching asks at most N-1 pairs of an N-option bank (the answered-once arithmetic)', () => {
    const twoPairTwoBank: MatchingActivityProblemData = {
      ...matchProblem(),
      rightItems: [{ id: 'R1', text: 'kennel' }, { id: 'R2', text: 'nest' }],
    };
    const { items } = itemsFromProblems([twoPairTwoBank]);
    expect(items.filter((i) => i.kind === 'match')).toHaveLength(1);
  });

  it('an answer the tutor has already NAMED may not be a later item\'s answer (class 2)', () => {
    const { judgedViable } = itemsFromProblems([
      mcProblem(),
      mcProblem({ id: 'mc9', question: 'Which farm animal gives milk?' }), // same answer: cow
    ]);
    // The duplicate-answer MCQ loses its only item, so its problem is
    // uncovered and the whole set falls back — never a silently missing ask.
    expect(judgedViable).toBe(false);
  });

  it('sequencing / scenario / short_answer sets fall back whole (slice 2b)', () => {
    const { judgedViable } = itemsFromProblems([
      mcProblem(),
      { ...base, type: 'sequencing_activity', id: 'sq1', instruction: 'Put the steps in order', items: ['wake', 'eat', 'play'] },
    ]);
    expect(judgedViable).toBe(false);
  });

  it('SELECTS to the session cap with every problem still covered', () => {
    const big = itemsFromProblems([
      sortProblem({
        id: 'caA',
        categorizationItems: Array.from({ length: 6 }, (_, i) => ({
          itemText: ['cow', 'shark', 'pig', 'crab', 'hen', 'whale'][i],
          correctCategory: i % 2 === 0 ? 'Farm' : 'Ocean',
        })),
      }),
      sortProblem({
        id: 'caB',
        instruction: 'Sort each one by how it moves',
        categories: ['Flies', 'Swims'],
        categorizationItems: Array.from({ length: 6 }, (_, i) => ({
          itemText: ['owl', 'trout', 'bat', 'eel', 'wasp', 'squid'][i],
          correctCategory: i % 2 === 0 ? 'Flies' : 'Swims',
        })),
      }),
      tfProblem(),
    ]);
    expect(big.judgedViable).toBe(true);
    expect(big.items.length).toBeLessThanOrEqual(MAX_SESSION_ITEMS);
    const covered = new Set(big.items.map((i) => i.problemIndex));
    expect(covered).toEqual(new Set([0, 1, 2]));
  });
});

// ── Harness answer material — each contract's claims, testable ──────────────

describe('harness answers', () => {
  const itemOf = (kind: KnowledgeCheckItemKind): KnowledgeCheckItem =>
    buildAll().items.find((i) => i.kind === kind)!;

  it('true_false: yes/no verdicts, and the signature wrong is a statement fragment', () => {
    const answers = knowledgeCheckHarnessAnswers(itemOf('true_false'));
    expect(answers.correct).toBe('yes');
    expect(answers.plainWrong).toBe('false');
    expect(answers.signatureWrong?.text).toBe('spider has eight');
  });

  it('blank: the signature wrong is a word-bank distractor, and the answer is the leak token', () => {
    const answers = knowledgeCheckHarnessAnswers(itemOf('blank'));
    expect(answers.correct).toBe('morning');
    expect(answers.signatureWrong?.text).toBe('night');
    expect(answers.leakTokens).toContain('morning');
  });

  it('sort/match: the signature wrong is the focus item said back (the fluent non-placement)', () => {
    const sort = itemOf('sort');
    expect(knowledgeCheckHarnessAnswers(sort).signatureWrong?.text).toBe(sort.focusText);
    const match = itemOf('match');
    expect(knowledgeCheckHarnessAnswers(match).signatureWrong?.text).toBe(match.focusText);
  });

  it('menu kinds exempt the spoken menu and scan the correct choice\'s words outside it', () => {
    const answers = knowledgeCheckHarnessAnswers(itemOf('choice'));
    expect(answers.leakExemptSpan).toBe('cow, duck, or frog');
    expect(answers.leakTokens).toContain('cow');
  });

  it('choice_tap: carries the tapped indices for the gesture verdict', () => {
    const answers = knowledgeCheckHarnessAnswers(itemOf('choice_tap'));
    expect(answers.placed).toEqual({ correct: 0, wrong: 1 });
  });
});

// ── The spoken sentence builders ────────────────────────────────────────────

describe('spoken builders', () => {
  it('blankSpokenSentence speaks the gap as hmm', () => {
    expect(blankSpokenSentence('The sun rises in the ____')).toBe('The sun rises in the hmm');
    expect(blankSpokenSentence('A [blank] has eight legs')).toBe('A hmm has eight legs');
  });
});
