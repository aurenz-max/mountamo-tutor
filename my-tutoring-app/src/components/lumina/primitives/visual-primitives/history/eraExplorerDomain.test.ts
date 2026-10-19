/**
 * eraExplorerDomain: the build gates, the ask and the key, pinned. Pure, no jsdom.
 *
 *  1. Every mode is SPOKEN (`answerKind: 'voice'`) and a three-way `closed_set_choice`.
 *  2. Keep-or-drop: a menu the ear cannot separate, a statement carrying its own answer, a generator leak, an
 *     out-of-range key all drop the item, never backfill it.
 *  3. Session shape: the modes ship as runs in ladder order; an answer is not repeated.
 *  4. The ask says the whole menu and the key is a menu key over it; the printed teaching note is never spoken.
 */
import { describe, it, expect } from 'vitest';
import { askLeaks, spokenKeyText } from '../../../components/live-activity/spokenKey';
import { HISTORY_CATALOG } from '../../../service/manifest/catalog/history';
import {
  answerKindFor,
  answerWordsInStatement,
  askFor,
  choicesFor,
  correctChoiceOf,
  eraExplorerHarnessAnswers,
  eraKey,
  ERA_KINDS,
  hearCardRequest,
  itemFromChallenge,
  itemsFromChallenges,
  menuClauseFor,
  optionsEarSeparable,
  responseClassFor,
  type EraChallengeLike,
  type EraExplorerItem,
  type EraSessionLike,
  type EraTier,
} from './eraExplorerDomain';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const SESSION: EraSessionLike = {
  eraName: 'Pioneer Times',
  priorEraName: 'Colonial Farm Days',
  lensTitles: ['Daily Life', 'Technology', 'School & Work'],
  lensBodies: [
    'Water came in from the pump outside and the stove burned wood.',
    'Light came from candles and oil lamps set on the table.',
    'Children finished chores before walking to the one room school.',
  ],
};

const SORT_BINS = ['Pioneer Times', 'Today', 'Both then and now'];
const COMPARE_BINS = ['Colonial Farm Days', 'Pioneer Times', 'Both eras'];
const CAUSES = [
  'pipes brought running water into houses',
  'railroads carried goods to distant towns',
  'new laws required children to attend school',
];

const ch = (over: Partial<EraChallengeLike> & { id: string }): EraChallengeLike => ({
  type: 'era_sort',
  statement: 'Water is carried in from a pump outside.',
  options: SORT_BINS,
  correctIndex: 0,
  explanation: 'Homes had no taps yet.',
  ...over,
});

/** A real session shape, not one item per mode: two lens_id, three era_sort, two era_compare, one cause. */
const CHALLENGES: EraChallengeLike[] = [
  // Deliberately INTERLEAVED, the way a real draw arrives. A pre-grouped
  // fixture makes the defect-13 assertion vacuous: `itemsFromChallenges` would
  // pass it by doing nothing, which is exactly the state a mutation check
  // caught this file in.
  ch({ id: 's1', type: 'era_sort', statement: 'Water is carried in from a pump outside.', correctIndex: 0 }),
  ch({ id: 'l1', type: 'lens_id', statement: 'Lamps were filled with oil each evening.', options: SESSION.lensTitles, correctIndex: 1 }),
  ch({ id: 'p1', type: 'era_compare', statement: 'Families travel by wagon over dirt tracks.', options: COMPARE_BINS, correctIndex: 1 }),
  ch({ id: 's2', type: 'era_sort', statement: 'Children play games with their friends.', correctIndex: 2 }),
  ch({ id: 'c1', type: 'cause_of_change', statement: 'Families stopped carrying pails in from outside.', options: CAUSES, correctIndex: 0 }),
  ch({ id: 'l2', type: 'lens_id', statement: 'Chores were finished before the long walk.', options: SESSION.lensTitles, correctIndex: 2 }),
  ch({ id: 's3', type: 'era_sort', statement: 'Meals are heated in a humming metal box.', correctIndex: 1 }),
  ch({ id: 'p2', type: 'era_compare', statement: 'Bread is baked at home each week.', options: COMPARE_BINS, correctIndex: 2 }),
];

const buildItems = (tier: EraTier = 'medium'): EraExplorerItem[] =>
  itemsFromChallenges(CHALLENGES, SESSION, { tier });

describe('the split', () => {
  it('every mode is spoken and a three-way closed_set_choice', () => {
    for (const kind of ERA_KINDS) {
      expect(answerKindFor(kind)).toBe('voice');
      expect(responseClassFor(kind)).toBe('closed_set_choice');
    }
    expect(buildItems().length).toBe(8);
    expect(buildItems().every((i) => i.answerKind === 'voice' && i.choices.length === 3)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Build gates — keep-or-drop, never backfill
// ---------------------------------------------------------------------------

describe('build gates', () => {
  it('drops a menu whose options are not separable by ear', () => {
    // Two era names sharing every content word: a child saying "pioneer" has
    // named two of the three choices, and there is no honest verdict.
    const collided: EraSessionLike = { ...SESSION, priorEraName: 'Early Pioneer Days' };
    const item = itemFromChallenge(
      ch({ id: 'x', type: 'era_compare', statement: 'Bread is baked at home each week.', options: ['Early Pioneer Days', 'Pioneer Times', 'Both eras'], correctIndex: 1 }),
      collided,
    );
    expect(item).toBeNull();
  });

  it('drops a cause_of_change triple where one cause has no word of its own', () => {
    expect(choicesFor('cause_of_change', [
      'water pipes were built into houses',
      'water pipes were built into houses and streets',
      'railroads carried goods to distant towns',
    ])).toBeNull();
  });

  it('drops a statement carrying the words that distinguish its own answer', () => {
    const choices = choicesFor('cause_of_change', CAUSES)!;
    expect(answerWordsInStatement('Families stopped carrying pipes in from outside.', choices[0])).toBe(true);
    expect(itemFromChallenge(
      ch({ id: 'x', type: 'cause_of_change', statement: 'Families stopped carrying pipes in from outside.', options: CAUSES, correctIndex: 0 }),
      SESSION,
    )).toBeNull();
  });

  it('drops a statement that opens with a verdict sentinel', () => {
    expect(itemFromChallenge(
      ch({ id: 'x', statement: 'Yes, water is carried in from a pump outside.' }),
      SESSION,
    )).toBeNull();
  });

  it('drops a statement carrying a double quote', () => {
    expect(itemFromChallenge(
      ch({ id: 'x', statement: 'Children call the room the "front parlour" all day.' }),
      SESSION,
    )).toBeNull();
  });

  it('drops the generator leaks it already refuses, from the SAME predicate', () => {
    // era_sort naming the era, and a time word.
    expect(itemFromChallenge(ch({ id: 'x', statement: 'Pioneer families carry water in.' }), SESSION)).toBeNull();
    expect(itemFromChallenge(ch({ id: 'x', statement: 'Families carry water in from outside today.' }), SESSION)).toBeNull();
    // lens_id naming a lens.
    expect(itemFromChallenge(
      ch({ id: 'x', type: 'lens_id', statement: 'Technology filled the lamps with oil.', options: SESSION.lensTitles, correctIndex: 1 }),
      SESSION,
    )).toBeNull();
  });

  it('drops an out-of-range key rather than defaulting to option 0', () => {
    expect(itemFromChallenge(ch({ id: 'x', correctIndex: 3 }), SESSION)).toBeNull();
    expect(itemFromChallenge(ch({ id: 'x', correctIndex: -1 }), SESSION)).toBeNull();
  });

  it('never surfaces a folded plural as a spoken accept token', () => {
    // Caught by the FIRST live draw: the accept clause read "automobile
    // factorie" and "widespread electrical", because the ear-comparison
    // tokenizer folds plurals and its output was being handed to the tutor as
    // text. The fold is a lens for matching, never a source of words.
    const causes = [
      'automobile factories replaced the blacksmith trade',
      'widespread electrical wiring reached ordinary homes',
      'railroads carried goods to distant towns',
    ];
    const choices = choicesFor('cause_of_change', causes)!;
    for (const c of choices) {
      for (const token of [c.distinguisher, ...c.alsoCounts]) {
        expect(causes.some((cause) => cause.toLowerCase().includes(token))).toBe(true);
      }
    }
    expect(choices[0].distinguisher).toContain('factories');
  });

  it('keeps the fixed-bin menus separable — the shipped bin labels pass', () => {
    expect(optionsEarSeparable(choicesFor('era_sort', SORT_BINS)!)).toBe(true);
    expect(optionsEarSeparable(choicesFor('era_compare', COMPARE_BINS)!)).toBe(true);
    expect(optionsEarSeparable(choicesFor('lens_id', SESSION.lensTitles)!)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Session shape — defects 2 and 13
// ---------------------------------------------------------------------------

describe('session shape', () => {
  it('ships the modes as RUNS in ladder order (defect 13)', () => {
    const kinds = buildItems().map((i) => i.kind);
    const firstIndex = ERA_KINDS.map((k) => kinds.indexOf(k)).filter((i) => i >= 0);
    expect(firstIndex).toEqual([...firstIndex].sort((a, b) => a - b));
    // and each mode is contiguous
    for (const kind of ERA_KINDS) {
      const idx = kinds.map((k, i) => (k === kind ? i : -1)).filter((i) => i >= 0);
      if (idx.length < 2) continue;
      expect(idx[idx.length - 1] - idx[0]).toBe(idx.length - 1);
    }
  });

  it('never puts the same answer on two consecutive items of one mode (defect 2)', () => {
    const items = buildItems();
    for (let i = 1; i < items.length; i++) {
      if (items[i].action !== items[i - 1].action) continue;
      expect(correctChoiceOf(items[i]).distinguisher)
        .not.toBe(correctChoiceOf(items[i - 1]).distinguisher);
    }
  });

  it('answers each lens at most once per session (defect 2, strong form)', () => {
    // A, B, A — the repeat is NOT adjacent, so the weak consecutive-answer rule
    // cannot catch it and only the per-lens set can. (Adjacent repeats made this
    // assertion pass with the rule deleted; a mutation check found it.)
    const repeated = [
      ch({ id: 'l1', type: 'lens_id', statement: 'Lamps were filled with oil each evening.', options: SESSION.lensTitles, correctIndex: 1 }),
      ch({ id: 'l2', type: 'lens_id', statement: 'Chores were finished before the long walk.', options: SESSION.lensTitles, correctIndex: 2 }),
      ch({ id: 'l3', type: 'lens_id', statement: 'Candles stood ready on every shelf.', options: SESSION.lensTitles, correctIndex: 1 }),
    ];
    const built = itemsFromChallenges(repeated, SESSION);
    expect(built).toHaveLength(2);
    expect(built.map((i) => correctChoiceOf(i).label)).toEqual(['Technology', 'School & Work']);
  });
});

// ---------------------------------------------------------------------------
// The ask and the key
// ---------------------------------------------------------------------------

describe('the ask and the key', () => {
  it('the ask reads the detail and says the whole menu; the key is a menu key over it', () => {
    for (const tier of ['easy', 'medium', 'hard'] as EraTier[]) {
      for (const item of buildItems(tier)) {
        const ask = askFor(item);
        expect(ask.startsWith(item.statement)).toBe(true);
        expect(ask).toContain(menuClauseFor(item));
        expect(ask).not.toMatch(/Your turn|^Listen/);
        const key = eraKey(item);
        expect(key.menu).toEqual(item.choices.map((c) => c.phrase));
        expect(askLeaks(ask, key)).toEqual([]);
      }
    }
  });

  it('the key accepts the short forms and the place, and names the other choices and the signature miss as wrong', () => {
    const byKind = new Map(buildItems().map((i) => [i.kind, i]));
    const compare = byKind.get('era_compare')!;
    const key = eraKey(compare);
    expect(key.answer).toBe(correctChoiceOf(compare).phrase);
    expect(key.alsoAccept).toContain(correctChoiceOf(compare).distinguisher);
    expect(key.alsoAccept).toContain(['the first one', 'the second one', 'the third one'][compare.correctIndex]);
    expect(key.signatureError).toMatch(/"Today", "now" and "our time" are not choices here/);
    expect(eraKey(byKind.get('cause_of_change')!).signatureError).toMatch(/what changed instead of why/);
    expect(spokenKeyText(key).startsWith(`"${correctChoiceOf(compare).phrase}"`)).toBe(true);
    for (const item of buildItems()) {
      const wrong = item.choices.filter((_, i) => i !== item.correctIndex).map((c) => c.distinguisher);
      for (const w of wrong) expect(eraKey(item).alsoAccept).not.toContain(w);
    }
  });

  it('the printed teaching note never reaches the ask', () => {
    for (const item of buildItems()) if (item.explanation) expect(askFor(item)).not.toContain(item.explanation);
  });

  it('a card read-aloud asks for the lens body word for word, and nothing else', () => {
    const request = hearCardRequest('Technology', SESSION.lensBodies[1]);
    expect(request).toContain(`"${SESSION.lensBodies[1]}"`);
    for (const c of CHALLENGES) expect(request).not.toContain(c.statement);
  });
});

// ---------------------------------------------------------------------------
// Catalog steering — a regression here routes the primitive wrong forever
// ---------------------------------------------------------------------------

describe('catalog steering', () => {
  it('names the microphone and no longer sells a tap surface', () => {
    const entry = HISTORY_CATALOG.find((c) => c.id === 'era-explorer')!;
    const prose = `${entry.description} ${entry.constraints}`;
    expect(prose).toMatch(/microphone/i);
    expect(prose).toMatch(/there is nothing to drag, tap or type/i);
    expect(prose).not.toMatch(/\btap the\b|\bdrag (a|an|the)\b|\bsort [^.]* into\b/i);
  });

  it('keeps the four eval modes and their betas', () => {
    const entry = HISTORY_CATALOG.find((c) => c.id === 'era-explorer')!;
    expect(entry.evalModes?.map((m) => [m.evalMode, m.beta])).toEqual([
      ['lens_id', 2.0], ['era_sort', 3.5], ['era_compare', 5.0], ['cause_of_change', 6.5],
    ]);
  });
});

describe('harness answers', () => {
  it('gives the drive a correct and a plainly different choice per item', () => {
    for (const item of buildItems()) {
      const a = eraExplorerHarnessAnswers(item);
      expect(a.correct).toBe(correctChoiceOf(item).distinguisher);
      expect(a.plainWrong).toBeTruthy();
      expect(a.plainWrong).not.toBe(a.correct);
    }
  });
});
