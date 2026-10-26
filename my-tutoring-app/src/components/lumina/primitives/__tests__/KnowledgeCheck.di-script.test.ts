/**
 * KnowledgeCheck.di-script — pedagogy pins for the knowledge-check items
 * (qa/di/BACKLOG.md item 23 slice 2): the answer-material fork both
 * directions, each kind's spoken key (the judging contracts' claims, re-based
 * onto `SpokenKey` when the family moved onto its boss, 2026-10-26), the build
 * gates (KEEP-OR-DROP), and the harness answer material.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
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
  itemsFromProblems,
  knowledgeCheckHarnessAnswers,
  askFor,
  MAX_SESSION_ITEMS,
  type KnowledgeCheckItem,
  type KnowledgeCheckItemKind,
} from '../knowledgeCheckScript';
import { knowledgeCheckAsk, knowledgeCheckAssignment, knowledgeCheckKey, knowledgeCheckMiss } from '../knowledgeCheckWorkspace';

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
      // KC redesign P2 — the production kinds. `say_it` narrows per card
      // (numeral → number word, letter → letter_name, shape → shape_name);
      // this is its widest class.
      say_it: ['voice', 'short_spoken_word'],
      how_many: ['voice', 'number_word_to_20'],
      point_to: ['gesture', 'manipulation'],
      on_screen: ['gesture', 'manipulation'],
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

// ── Per-kind spoken keys ────────────────────────────────────────────────────

describe('spoken keys', () => {
  const itemsByKind = () => {
    const { items } = buildAll();
    return new Map(items.map((i) => [i.kind, i]));
  };

  it('every VOICE item has a key and a spoken assignment; a touched item has neither key nor expected answer', () => {
    for (const item of buildAll().items) {
      const assignment = knowledgeCheckAssignment(item);
      if (item.answerKind === 'voice') {
        expect(knowledgeCheckKey(item)).not.toBeNull();
        expect(assignment.response).toBe('speech');
      } else {
        expect(assignment.response).toBe('gesture');
        expect(assignment.expectedAnswer).toBeUndefined();
      }
    }
  });

  it('true_false accepts the natural verdict forms and refuses the statement echoed back', () => {
    const key = knowledgeCheckKey(itemsByKind().get('true_false')!)!;
    expect(key.alsoAccept).toEqual(expect.arrayContaining(['yes', 'yeah']));
    expect(key.signatureError).toContain('The statement said back');
  });

  it('menu kinds accept the short form and the position, and speak the menu in on-screen order', () => {
    const choice = itemsByKind().get('choice')!;
    expect(knowledgeCheckKey(choice)!.acceptRule).toContain('the part that tells it apart');
    expect(knowledgeCheckKey(choice)!.acceptRule).toContain('"the second one"');
    expect(choicesSpokenFor(choice)).toBe('cow, duck, or frog');
  });

  it('sort names the groups inside the ask (the mats are not a costume) and refuses the item echoed back', () => {
    const sort = itemsByKind().get('sort')!;
    expect(knowledgeCheckAsk(sort)).toContain('Farm, or Ocean');
    expect(knowledgeCheckKey(sort)!.signatureError).toContain(`"${sort.focusText}" said back names no group`);
  });

  it('a touched choice is checked in code', () => {
    const tap = itemsByKind().get('choice_tap')!;
    expect(knowledgeCheckMiss(tap, tap.correctOptionId!)).toBeUndefined();
    const wrong = tap.options!.find((o) => o.id !== tap.correctOptionId)!;
    expect(knowledgeCheckMiss(tap, wrong.id)).toBeDefined();
  });
});

// ── Build gates: KEEP-OR-DROP; a dropped problem is worked on screen ──────────────────────────────

describe('build gates', () => {
  const kinds = (problems: ProblemData[]) => itemsFromProblems(problems).items.map((i) => i.kind);

  it('a sentinel-opening statement drops its spoken item; that problem is worked on screen, the rest stay spoken', () => {
    const { judgedViable, items } = itemsFromProblems([
      tfProblem({ statement: 'Yes, a spider has eight legs' }),
      mcProblem(),
    ]);
    expect(judgedViable).toBe(true);
    expect(items.map((i) => i.kind)).toEqual(['on_screen', 'choice']);
    // The fallback ask never opens with a sentinel either.
    expect(items[0].prompt).toBe('Look at this one on the screen.');
  });

  it('a blank whose answer survives elsewhere in the sentence drops (leak) to on screen', () => {
    expect(kinds([blankProblem({ textWithBlanks: 'The morning sun rises in the ____' })])).toEqual(['on_screen']);
  });

  it('an MCQ whose stem contains the answer drops (class 11) to on screen', () => {
    expect(kinds([mcProblem({ question: 'Which animal is the cow that says moo?' })])).toEqual(['on_screen']);
  });

  // KC-UB (handoff 28): the two saved literacy payloads fell to the tap flow
  // because their quoted sentence holds the key word — and every other choice.
  it.each([
    ['knowledge-check.apply.literacy.json', 'barks'],
    ['knowledge-check.recall.literacy.json', 'cat'],
  ])('a "which word in this sentence" MCQ builds (%s)', (file, key) => {
    const saved = JSON.parse(readFileSync(resolve(__dirname, '../../../../../qa/eval-reports/knowledge-check-levers-probe', file), 'utf8'));
    const { judgedViable, items } = itemsFromProblems(saved.data.problems);
    expect(judgedViable).toBe(true);
    expect(items[0].prompt.toLowerCase()).toContain(key); // the sentence is still read to the child
  });

  it.each([
    ['single quotes', "Read the sentence: 'The cat sleeps on the rug.' Which word is a noun?"],
    ['curly quotes', 'Read the sentence: “The cat sleeps on the rug.” Which word is a noun?'],
  ])('the quoted-sentence exemption covers %s', (_label, question) => {
    const p = mcProblem({ question, options: [{ id: 'A', text: 'sleeps' }, { id: 'B', text: 'cat' }, { id: 'C', text: 'on' }], correctOptionId: 'B' });
    expect(itemsFromProblems([p]).judgedViable).toBe(true);
  });

  it('the generator marker [blank_1] builds a blank item (KC-UB probe, 2026-09-29)', () => {
    const p = blankProblem({ textWithBlanks: 'The [blank_1] will run on the grass.', blanks: [{ id: 'blank_1', correctAnswer: 'dog' }] as never });
    const { judgedViable, items } = itemsFromProblems([p]);
    expect(judgedViable).toBe(true);
    expect(items[0].prompt).toBe('The hmm will run on the grass.');
  });

  it('the exemption holds only when the quote contains every choice; a key named outside it still drops', () => {
    // The quote holds only the key: that is a stated answer, not a sentence to search.
    const keyOnly = mcProblem({ question: 'The book says "the cow says moo." Which animal says moo?' });
    expect(kinds([keyOnly])).toEqual(['on_screen']);
    // Every choice is quoted, but the stem names the key again outside the quote.
    const outside = mcProblem({
      question: 'In "The cow and the duck and the frog", which is the cow?',
    });
    expect(kinds([outside])).toEqual(['on_screen']);
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
    // The duplicate-answer MCQ loses its spoken item; its problem is worked on
    // screen — never a silently missing ask.
    expect(kinds([
      mcProblem(),
      mcProblem({ id: 'mc9', question: 'Which farm animal gives milk?' }), // same answer: cow
    ])).toEqual(['choice', 'on_screen']);
  });

  it('a sequencing problem is worked on screen inside the session, with no spoken key', () => {
    const { judgedViable, items } = itemsFromProblems([
      mcProblem(),
      { ...base, type: 'sequencing_activity', id: 'sq1', instruction: 'Put the steps in order', items: ['wake', 'eat', 'play'] },
    ]);
    expect(judgedViable).toBe(true);
    expect(items.map((i) => i.kind)).toEqual(['choice', 'on_screen']);
    expect(items[1]).toMatchObject({ problemIndex: 1, answerKind: 'gesture', prompt: 'Put the steps in order' });
    expect(knowledgeCheckKey(items[1])).toBeNull();
    expect(askFor(items[1])).toBe('Your turn. Put the steps in order Do it on the screen.');
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
