/**
 * sortingStationScript — the pedagogy lives there, so this is where it is
 * pinned. Pure: no jsdom, no mocked live loop.
 *
 * What this locks in:
 *  1. The pack passes the family's structural gates (checkPackGates =
 *     validateJudgedScriptPack + performed-stage-directions + repeated-asks), on
 *     the fixture pack AND on the REAL SESSION SHAPE — several items of one mode
 *     back to back, which is the only shape the repeated-ask gate can fire on.
 *  2. THE FORK: all seven eval modes SPEAK. Changing a row here is a contract
 *     change, not an edit — and the response class is per ITEM KIND, because one
 *     mode can produce two different answer materials.
 *  3. BUILD GATES — each one a CONTENT fault the spoken ask exposed: an object
 *     that IS a tray label, tray labels that collide by ear, a group whose count
 *     would be ZERO (outside the benched class), a yes/no set with only one
 *     reachable verdict, a sort whose kept objects all share one answer. All
 *     DROPPED, none repaired.
 *  4. THE TWO CAPPING GATES, which are this port's own: a blind cap STRANDS A
 *     TRAY (and on a binary sort makes one label right forever), and a blind cap
 *     on two-attributes leaves an all-NO set a child passes by saying "no".
 *  5. THE WORKED EXAMPLE is on the page and inside every count, and is never the
 *     question — its answer is already visible.
 *  6. ANSWER-LEAK, in strings and in pixels: the spoken ask never contains the
 *     answer outside the menu clause it has to name, and `hidesCounts` is set on
 *     exactly the kinds whose answer is a number the tray badge would print.
 *  7. Corrections open "My turn:", model the fact and re-elicit; affirms open
 *     "Yes,". The band floor beats the tier.
 *  8. The catalog keeps its side: audio mode, contextKeys, template keys,
 *     sentinel scan — and its steering names the microphone instead of tapping.
 *  9. Harness answer material mirrors the discrimination clauses it drills.
 */
import { describe, it, expect } from 'vitest';
import {
  MAX_ITEMS_PER_CHALLENGE,
  MAX_ITEMS_PER_SESSION,
  answerKindFor,
  choicesPhrase,
  completeCue,
  isSayableCount,
  isSayableLabel,
  isSayableObject,
  itemCue,
  itemsFromChallenge,
  itemsFromChallenges,
  leakExemptSpanFor,
  moveOnCue,
  optionsEarSeparable,
  pronounceCue,
  responseClassFor,
  sortingStationHarnessAnswers,
  sortingStationPackBase,
  spokenAxisName,
  stimulusFor,
  type SortingChallengeLike,
  type SortingStationItem,
} from '../sortingStationScript';
import {
  findSentinelCollisions,
  spokenSpanOf,
  type JudgedScriptPack,
} from '../../../../hooks/judgedScriptContract';
import {
  checkDiCatalogEntry,
  checkPackGates,
} from '../../../../hooks/judgedScriptContract.testkit';
import { MATH_CATALOG } from '../../../../service/manifest/catalog/math';

// ── Fixtures ────────────────────────────────────────────────────────────────

const obj = (id: string, label: string, attributes: Record<string, string>, emoji = '🔵') =>
  ({ id, label, emoji, attributes });

/** Needs vs wants — the primitive's flagship semantic sort. */
const SORT_CH: SortingChallengeLike = {
  id: 'c1',
  type: 'sort-by-one',
  sortingAttribute: 'category',
  categories: [
    { label: 'Need', rule: { category: 'need' }, bucketEmoji: '🏠' },
    { label: 'Want', rule: { category: 'want' }, bucketEmoji: '🎁' },
  ],
  objects: [
    obj('o1', 'apple', { category: 'need' }, '🍎'),
    obj('o2', 'balloon', { category: 'want' }, '🎈'),
    obj('o3', 'water', { category: 'need' }, '💧'),
    obj('o4', 'toy car', { category: 'want' }, '🚗'),
  ],
};

const ODD_CH: SortingChallengeLike = {
  id: 'c2',
  type: 'odd-one-out',
  sortingAttribute: 'category',
  oddOneOut: 'o3',
  oddOneOutReason: 'the others are all fruit',
  objects: [
    obj('o1', 'apple', { category: 'fruit' }, '🍎'),
    obj('o2', 'banana', { category: 'fruit' }, '🍌'),
    obj('o3', 'hammer', { category: 'tool' }, '🔨'),
    obj('o4', 'grape', { category: 'fruit' }, '🍇'),
  ],
};

const COUNT_CH: SortingChallengeLike = {
  id: 'c3',
  type: 'count-and-compare',
  sortingAttribute: 'color',
  correctComparison: 'more',
  categories: [
    { label: 'Red', rule: { color: 'red' }, bucketEmoji: '🔴' },
    { label: 'Blue', rule: { color: 'blue' }, bucketEmoji: '🔵' },
  ],
  objects: [
    obj('o1', 'apple', { color: 'red' }),
    obj('o2', 'cherry', { color: 'red' }),
    obj('o3', 'rose', { color: 'red' }),
    obj('o4', 'sky', { color: 'blue' }),
  ],
};

const TWO_CH: SortingChallengeLike = {
  id: 'c4',
  type: 'two-attributes',
  sortingAttribute: 'category',
  targetCategory: 'need',
  secondaryAttribute: 'kind',
  secondaryValue: 'food',
  objects: [
    obj('o1', 'apple', { category: 'need', kind: 'food' }, '🍎'),
    obj('o2', 'coat', { category: 'need', kind: 'clothing' }, '🧥'),
    obj('o3', 'bread', { category: 'need', kind: 'food' }, '🍞'),
    obj('o4', 'balloon', { category: 'want', kind: 'toy' }, '🎈'),
  ],
};

const ATTR_CH: SortingChallengeLike = {
  id: 'c5',
  type: 'sort-by-attribute',
  sortingAttribute: 'shape',
  categories: [
    { label: 'Round', rule: { shape: 'round' }, bucketEmoji: '⭕' },
    { label: 'Square', rule: { shape: 'square' }, bucketEmoji: '🟦' },
  ],
  objects: [
    obj('o1', 'ball', { shape: 'round', color: 'red' }, '⚽'),
    obj('o2', 'box', { shape: 'square', color: 'brown' }, '📦'),
    obj('o3', 'plate', { shape: 'round', color: 'white' }, '🍽️'),
  ],
};

const build = (ch: SortingChallengeLike, opts = {}) => itemsFromChallenge(ch, opts);
const one = (ch: SortingChallengeLike, opts = {}) => build(ch, opts)[0];

const packOf = (items: SortingStationItem[]): JudgedScriptPack<SortingStationItem> =>
  sortingStationPackBase(items) as JudgedScriptPack<SortingStationItem>;

/** Word-boundary containment — "no" must not match inside "nonliving". */
const saysWord = (text: string, word: string) =>
  new RegExp(`\\b${word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(text);

// ────────────────────────────────────────────────────────────────────────────

describe('sorting-station DI pack — structural gates', () => {
  it('the fixture pack passes every family gate', () => {
    const items = [
      ...build(SORT_CH), ...build(ODD_CH), ...build(COUNT_CH),
      ...build(TWO_CH), ...build(ATTR_CH),
    ];
    expect(items.length).toBeGreaterThan(0);
    expect(checkPackGates(packOf(items))).toEqual([]);
  });

  /**
   * ⚠️ THE REAL SESSION SHAPE. A one-item-per-mode fixture is the one shape the
   * repeated-ask gate can NEVER fire on, and all 12 earlier ports shipped with
   * the gate asleep for exactly that reason. A real sorting session is several
   * asks of ONE mode back to back — which for this primitive is the DEFAULT,
   * since one challenge is now one judged turn per object.
   */
  it('passes the gates on consecutive same-action items (the real session shape)', () => {
    const items = build(SORT_CH);
    expect(items.length).toBeGreaterThanOrEqual(3);
    expect(items.every((i) => i.action === 'sort')).toBe(true);
    expect(checkPackGates(packOf(items))).toEqual([]);
  });

  it('consecutive sort asks are not byte-identical recitation', () => {
    const items = build(SORT_CH);
    const asks = items.map((i) => spokenSpanOf(itemCue(i)));
    expect(new Set(asks).size).toBe(asks.length);
  });

  it('the how-to-play and the DISTAR lead-in speak only on the introduction', () => {
    const [first, second] = build(SORT_CH);
    const intro = spokenSpanOf(itemCue(first, { opening: true, howToPlay: true }));
    const plain = spokenSpanOf(itemCue(second));
    expect(intro).toContain('one thing at a time');
    // The rule is established once, not recited every round.
    expect(plain).not.toContain('one thing at a time');
    expect(plain.length).toBeLessThan(intro.length);
  });
});

describe('the answer-material fork — all seven modes SPEAK', () => {
  it.each([
    'sort-by-one', 'sort-by-attribute', 'sort-variety', 'odd-one-out',
    'count-and-compare', 'two-attributes', 'tally-record',
  ] as const)('%s answers with the voice', (mode) => {
    expect(answerKindFor(mode)).toBe('voice');
  });

  it('every built item is a voice item — nothing in this pack taps', () => {
    const items = [
      ...build(SORT_CH), ...build(ODD_CH), ...build(COUNT_CH),
      ...build(TWO_CH), ...build(ATTR_CH),
    ];
    expect(items.every((i) => i.answerKind === 'voice')).toBe(true);
    // The deleted menus must not come back through a stale cached challenge.
    expect(items.filter((i) => i.kind === 'both_criteria').every((i) => i.choices.length === 0))
      .toBe(true);
    expect(items.filter((i) => i.kind === 'count_group').every((i) => i.choices.length === 0))
      .toBe(true);
  });

  it('the response class is per ITEM KIND, both directions', () => {
    expect(responseClassFor('sort')).toBe('short_spoken_word');
    expect(responseClassFor('pick_rule')).toBe('short_spoken_word');
    expect(responseClassFor('odd_one')).toBe('short_spoken_word');
    expect(responseClassFor('compare')).toBe('short_spoken_word');
    expect(responseClassFor('count_group')).toBe('number_word_to_20');
    expect(responseClassFor('both_criteria')).toBe('yes_no');
  });

  it('count-and-compare produces BOTH answer materials in one mode', () => {
    const items = build(COUNT_CH);
    expect(items.some((i) => i.responseClass === 'number_word_to_20')).toBe(true);
    expect(items.some((i) => i.kind === 'compare')).toBe(true);
  });

  it('tally-record records and stops — it has no compare beat', () => {
    const items = build({ ...COUNT_CH, id: 't1', type: 'tally-record' });
    expect(items.length).toBeGreaterThan(0);
    expect(items.every((i) => i.kind === 'count_group')).toBe(true);
  });

  it('sort-by-attribute keeps its metacognitive choice, spoken and leading', () => {
    const items = build(ATTR_CH);
    expect(items[0].kind).toBe('pick_rule');
    expect(items[0].answer).toBe('shape');
    expect(items.slice(1).every((i) => i.kind === 'sort')).toBe(true);
  });

  /**
   * Caught by the LIVE probe, not by a fixture: `pick_rule` shipped an ask whose
   * correct spoken answer was the word "category". A Grade 1 child asked how to
   * sort a pile of pictures says "kind". Only the spoken side moves — `ruleName`
   * keeps the raw key the component matches attributes on.
   */
  it('speaks the axis in a word a six-year-old says, keeping the key for the screen', () => {
    expect(spokenAxisName('category')).toBe('kind');
    expect(spokenAxisName('color')).toBe('color');
    const item = build({
      ...ATTR_CH,
      sortingAttribute: 'category',
      categories: [
        { label: 'Round', rule: { category: 'round' } },
        { label: 'Square', rule: { category: 'square' } },
      ],
      objects: [
        obj('o1', 'ball', { category: 'round', color: 'red' }),
        obj('o2', 'box', { category: 'square', color: 'brown' }),
        obj('o3', 'plate', { category: 'round', color: 'white' }),
      ],
    })[0];
    expect(item.kind).toBe('pick_rule');
    expect(item.answer).toBe('kind');
    expect(item.choices).toContain('kind');
    expect(item.choices).not.toContain('category');
    expect(item.ruleName).toBe('category');
    expect(spokenSpanOf(itemCue(item))).not.toContain('category');
  });
});

describe('build gates — DROP an unaskable challenge, never repair it', () => {
  it('drops a sort whose tray labels collide by ear', () => {
    expect(build({
      ...SORT_CH,
      categories: [
        { label: 'Big', rule: { category: 'need' } },
        { label: 'Big Things', rule: { category: 'want' } },
      ],
    })).toEqual([]);
  });

  it('drops an object that IS a tray label — the ask would be a riddle', () => {
    const items = build({
      ...SORT_CH,
      objects: [...SORT_CH.objects!, obj('o5', 'Need', { category: 'need' })],
    });
    expect(items.some((i) => i.stimulus.toLowerCase() === 'need')).toBe(false);
  });

  it('drops a sort whose kept objects all share one answer', () => {
    expect(build({
      ...SORT_CH,
      objects: [
        obj('o1', 'apple', { category: 'need' }),
        obj('o2', 'water', { category: 'need' }),
      ],
    })).toEqual([]);
  });

  /** ZERO is outside `number_word_to_20`, and an empty group is a perfectly
   *  ordinary sort outcome — so it is dropped, never floored to one. */
  it('never asks the count of an EMPTY group', () => {
    const items = build({
      ...COUNT_CH,
      categories: [
        ...COUNT_CH.categories!,
        { label: 'Green', rule: { color: 'green' } },
      ],
    });
    expect(items.some((i) => i.stimulus === 'Green')).toBe(false);
    expect(items.filter((i) => i.kind === 'count_group')
      .every((i) => isSayableCount(i.answerValue!))).toBe(true);
  });

  it('drops a two-attributes challenge with only ONE reachable verdict', () => {
    expect(build({
      ...TWO_CH,
      objects: [
        obj('o1', 'apple', { category: 'need', kind: 'food' }),
        obj('o2', 'bread', { category: 'need', kind: 'food' }),
        obj('o3', 'rice', { category: 'need', kind: 'food' }),
      ],
    })).toEqual([]);
  });

  it('drops an odd-one-out whose cards cannot be told apart by ear', () => {
    expect(build({
      ...ODD_CH,
      objects: [
        obj('o1', 'red ball', { category: 'toy' }),
        obj('o2', 'red ball toy', { category: 'toy' }),
        obj('o3', 'hammer', { category: 'tool' }),
      ],
    })).toEqual([]);
  });

  it('drops a comparison the counts do not support', () => {
    // The key says "more" while the two groups are equal.
    const items = build({
      ...COUNT_CH,
      objects: [
        obj('o1', 'apple', { color: 'red' }),
        obj('o2', 'sky', { color: 'blue' }),
      ],
    });
    expect(items.some((i) => i.kind === 'compare')).toBe(false);
  });

  it('the sayability predicates hold their own edges', () => {
    expect(isSayableObject('ice cream')).toBe(true);
    expect(isSayableObject('a very long compound name here')).toBe(false);
    expect(isSayableObject('Yes indeed')).toBe(false); // sentinel opener
    expect(isSayableLabel('Group')).toBe(false);       // pack prose collision
    expect(isSayableLabel('Living')).toBe(true);
    expect(isSayableCount(0)).toBe(false);
    expect(isSayableCount(21)).toBe(false);
    expect(optionsEarSeparable(['Need', 'Want'])).toBe(true);
    expect(optionsEarSeparable(['A cat', 'A cat and a dog'])).toBe(false);
  });

  /**
   * Caught by the LIVE probe, which dropped three of four living/non-living
   * challenges. A negation PREFIX is the distinction, not a collision — the two
   * labels sound nothing alike and a child says the "non". The naive word-token
   * model read it as the unjudgeable subset shape.
   */
  it('reads a prefixed antonym as separable, and still catches a real subset', () => {
    expect(optionsEarSeparable(['Living', 'Non-living'])).toBe(true);
    expect(optionsEarSeparable(['Living', 'Non living'])).toBe(true);
    expect(optionsEarSeparable(['Magnetic', 'Not magnetic'])).toBe(true);
    // The shape the gate exists for is untouched.
    expect(optionsEarSeparable(['Big', 'Big things'])).toBe(false);
  });

  /** Sorting cards are short noun PHRASES, not single words. */
  it('accepts a three-word card name and still refuses a sentence', () => {
    expect(isSayableObject('Red Toy Car')).toBe(true);
    expect(isSayableObject('Construction Paper')).toBe(true);
    expect(isSayableObject('the one that goes in the box')).toBe(false);
  });
});

describe('the two capping gates — a blind cap measures nothing', () => {
  /** Take the first N of a long sort and a tray can vanish entirely; on a binary
   *  sort that makes ONE LABEL RIGHT FOREVER. */
  it('a capped sort still reaches every tray', () => {
    const many: SortingChallengeLike = {
      ...SORT_CH,
      objects: [
        ...['bread', 'water', 'shoes', 'coat', 'soap', 'bed'].map(
          (label, i) => obj(`n${i}`, label, { category: 'need' }),
        ),
        obj('w1', 'balloon', { category: 'want' }),
        obj('w2', 'toy car', { category: 'want' }),
      ],
    };
    const items = build(many);
    expect(items.length).toBe(MAX_ITEMS_PER_CHALLENGE);
    expect(new Set(items.map((i) => i.answer)).size).toBe(2);
  });

  /** The same disease in a yes/no coat, and worse because it is invisible: an
   *  all-NO set is passed 100% by a child who says "no" every time. */
  it('a capped two-attributes set holds BOTH verdicts', () => {
    const many: SortingChallengeLike = {
      ...TWO_CH,
      objects: [
        ...['balloon', 'kite', 'puzzle', 'doll', 'drum', 'yo yo', 'robot'].map(
          (label, i) => obj(`n${i}`, label, { category: 'want', kind: 'toy' }),
        ),
        obj('y1', 'apple', { category: 'need', kind: 'food' }),
      ],
    };
    const items = build(many);
    expect(items.length).toBeLessThanOrEqual(MAX_ITEMS_PER_CHALLENGE);
    expect(new Set(items.map((i) => i.answer))).toEqual(new Set(['yes', 'no']));
  });

  it('the session cap truncates on a challenge boundary, never mid-challenge', () => {
    const items = itemsFromChallenges(
      Array.from({ length: 6 }, (_, i) => ({ ...SORT_CH, id: `c${i}` })),
    );
    expect(items.length).toBeLessThanOrEqual(MAX_ITEMS_PER_SESSION);
    // Every challenge present is present WHOLE — no partial tail.
    const byChallenge = new Map<string, number>();
    for (const i of items) byChallenge.set(i.challengeId, (byChallenge.get(i.challengeId) ?? 0) + 1);
    for (const count of Array.from(byChallenge.values())) {
      expect(count).toBe(build(SORT_CH).length);
    }
  });
});

describe('the worked example is on the page, inside the counts, and never the question', () => {
  it('is excluded from the judged set', () => {
    const items = build({ ...SORT_CH, modelItemId: 'o1' });
    expect(items.some((i) => i.id.endsWith('::o1'))).toBe(false);
    expect(items.some((i) => i.stimulus === 'apple')).toBe(false);
  });

  it('is still COUNTED — a count that skipped a visible card would contradict the screen', () => {
    const withModel = build({ ...COUNT_CH, type: 'tally-record', modelItemId: 'o1' });
    const red = withModel.find((i) => i.stimulus === 'Red');
    expect(red?.answerValue).toBe(3);
  });
});

describe('answer leak — in strings and in pixels', () => {
  const allItems = () => [
    ...build(SORT_CH), ...build(ODD_CH), ...build(COUNT_CH),
    ...build(TWO_CH), ...build(ATTR_CH),
  ];

  it('the spoken ask never says the answer outside the menu clause it must name', () => {
    for (const item of allItems()) {
      const spoken = spokenSpanOf(itemCue(item, { opening: true, howToPlay: true }));
      const exempt = leakExemptSpanFor(item);
      const scanned = exempt ? spoken.split(exempt).join(' ') : spoken;
      expect(saysWord(scanned, item.answer), `${item.id} leaked "${item.answer}"`).toBe(false);
    }
  });

  it('a count ask never says any number — its oracle is FLAT', () => {
    for (const item of build(COUNT_CH).filter((i) => i.kind === 'count_group')) {
      expect(leakExemptSpanFor(item)).toBeUndefined();
      const spoken = spokenSpanOf(itemCue(item));
      expect(saysWord(spoken, item.answer)).toBe(false);
      expect(/\d/.test(spoken)).toBe(false);
    }
  });

  it('an odd-one-out ask never recites the cards — its oracle is FLAT', () => {
    const item = one(ODD_CH);
    expect(item.namesChoices).toBe(false);
    expect(leakExemptSpanFor(item)).toBeUndefined();
    const spoken = spokenSpanOf(itemCue(item));
    for (const label of item.choices) expect(saysWord(spoken, label)).toBe(false);
  });

  /** ⭐ THE PIXEL GATE. `showCounts` printed the answer to every count ask. */
  it('hidesCounts is set on exactly the kinds whose answer the tray badge prints', () => {
    for (const item of allItems()) {
      expect(item.hidesCounts).toBe(item.kind === 'count_group' || item.kind === 'compare');
    }
  });

  it('the context channel is stimulus-side only — never a number, never the answer', () => {
    for (const item of allItems()) {
      const ctx = stimulusFor(item);
      expect(saysWord(ctx, item.answer)).toBe(false);
      if (item.kind === 'count_group') expect(/\d/.test(ctx)).toBe(false);
    }
  });

  it('tap-to-hear re-speaks the QUESTION, never the answer', () => {
    for (const item of allItems()) {
      const spoken = spokenSpanOf(pronounceCue(item));
      const exempt = leakExemptSpanFor(item);
      const scanned = exempt ? spoken.split(exempt).join(' ') : spoken;
      expect(saysWord(scanned, item.answer)).toBe(false);
    }
  });

  it('the capped move-on names no group label — every item shares one label set', () => {
    const items = build(SORT_CH);
    const spoken = spokenSpanOf(moveOnCue(items[0], null));
    for (const label of items[0].choices) expect(saysWord(spoken, label)).toBe(false);
  });
});

describe('the ask STATES its problem, and the tiers move the introduction', () => {
  it('names the trays aloud by default — a pre-reader cannot read one', () => {
    const item = one(SORT_CH);
    expect(item.namesChoices).toBe(true);
    expect(choicesPhrase(item)).toContain('Need');
    expect(choicesPhrase(item)).toContain('Want');
  });

  it('the HARD rung stops naming them, and the oracle goes flat', () => {
    const item = one({ ...SORT_CH, namesSortCriterion: false }, { tier: 'hard' });
    expect(item.namesChoices).toBe(false);
    expect(leakExemptSpanFor(item)).toBeUndefined();
  });

  /** The band floor beats the tier: at K an unnamed group is an unanswerable
   *  question, so the exemption returns even at `hard`. */
  it('the K band floor beats the hard tier', () => {
    const item = one(
      { ...SORT_CH, namesSortCriterion: false },
      { tier: 'hard', isPreReader: true },
    );
    expect(item.namesChoices).toBe(true);
  });

  it('the lead-in fades across the tier ladder', () => {
    const easy = spokenSpanOf(itemCue(one(SORT_CH, { tier: 'easy' }), { howToPlay: true }));
    const hard = spokenSpanOf(itemCue(one(SORT_CH, { tier: 'hard' }), { howToPlay: true }));
    expect(easy.length).toBeGreaterThan(hard.length);
  });
});

describe('verdict wording', () => {
  const allItems = () => [
    ...build(SORT_CH), ...build(ODD_CH), ...build(COUNT_CH),
    ...build(TWO_CH), ...build(ATTR_CH),
  ];

  it('every correction opens "My turn:", models the fact and re-elicits', () => {
    for (const item of allItems()) {
      const cue = itemCue(item);
      const correction = cue.split('If it is wrong, say exactly: "')[1]?.replace(/"\s*$/, '');
      expect(correction, item.id).toBeTruthy();
      expect(correction!.startsWith('My turn:'), item.id).toBe(true);
      expect(correction!, item.id).toContain('Your turn.');
    }
  });

  it('every affirmation opens "Yes,"', () => {
    for (const item of allItems()) {
      const cue = itemCue(item);
      const affirm = cue.split('If the answer is right, say exactly: "')[1]?.split('"')[0];
      expect(affirm, item.id).toBeTruthy();
      expect(affirm!.startsWith('Yes,'), item.id).toBe(true);
    }
  });

  it('every spoken item carries a target, an accept clause and BOTH verdict lines', () => {
    for (const item of allItems()) {
      const cue = itemCue(item);
      expect(cue, item.id).toContain('The correct answer is');
      expect(cue, item.id).toContain('If the answer is right, say exactly:');
      expect(cue, item.id).toContain('If it is wrong, say exactly:');
      // No spoken item is ever told to ignore the microphone.
      expect(cue.toLowerCase(), item.id).not.toContain('ignore anything you hear');
    }
  });

  it('carries the three family laws on every cue', () => {
    const item = one(SORT_CH);
    const cue = itemCue(item);
    expect(cue).toContain('A reply that is neither the affirmation nor the correction');
    expect(cue).toContain('never announce that you are waiting or listening');
    expect(cue).toContain('Your verdict line is the END of your turn');
  });

  it('no generated content or pack prose opens a sentence with a sentinel', () => {
    const items = [
      ...build(SORT_CH), ...build(ODD_CH), ...build(COUNT_CH),
      ...build(TWO_CH), ...build(ATTR_CH),
    ];
    for (const item of items) {
      expect(findSentinelCollisions([
        { label: item.id, text: spokenSpanOf(itemCue(item)) },
      ])).toEqual([]);
    }
    expect(findSentinelCollisions([
      { label: 'completeCue', text: spokenSpanOf(completeCue()) },
    ])).toEqual([]);
  });
});

describe('the catalog keeps its side', () => {
  const entry = MATH_CATALOG.find((c) => c.id === 'sorting-station')!;

  it('exists and passes the shared DI catalog check', () => {
    const items = build(SORT_CH);
    expect(checkDiCatalogEntry(entry, packOf(items), items[0])).toEqual([]);
  });

  it('steers on the microphone, not on tapping — a stale word routes it wrong forever', () => {
    const prose = `${entry.description} ${entry.constraints}`;
    expect(prose).toContain('microphone');
    // What must not survive is PRESCRIPTIVE tapping prose — the curator routes on
    // this string, so "drag objects into bins" would send the primitive to a
    // click lesson forever. Saying that those surfaces are GONE is the point.
    expect(prose.toLowerCase()).not.toMatch(/drag (the |an |each )?object/);
    expect(prose.toLowerCase()).not.toMatch(/tap the (tiles|bin)/);
    expect(prose.toLowerCase()).not.toMatch(/students? (drag|tap)/);
    expect(prose.toLowerCase()).toContain('no drag-to-bin');
  });

  /** R3 — the band floor is NOT moved by this port. The contract is explicit
   *  that unflooring needs a reader-fit re-audit, "NOT a simple unflooring". */
  it('keeps the K band floor exactly where the contract left it', () => {
    expect(entry.constraints).toContain('BAND FLOOR');
    expect(entry.constraints).toContain('only sort_one and odd_one_out');
    for (const mode of ['sort_attribute', 'sort_variety', 'count_compare', 'two_attributes', 'tally_record']) {
      const m = entry.evalModes!.find((e) => e.evalMode === mode)!;
      expect(m.description, mode).toContain('Grade 1+ ONLY');
    }
  });

  it('holds every β — no structural change moved one', () => {
    const betas = Object.fromEntries(entry.evalModes!.map((m) => [m.evalMode, m.beta]));
    expect(betas).toEqual({
      sort_one: 1.5, sort_attribute: 2.5, sort_variety: 3.0, count_compare: 3.5,
      odd_one_out: 4.0, two_attributes: 5.0, tally_record: 5.5,
    });
  });

  /** 18d, applied at birth: no rung may OFFER a speakable replacement line. */
  it('no scaffolding rung offers a quoted line of its own', () => {
    const rungs = Object.values(entry.tutoring!.scaffoldingLevels!);
    for (const rung of rungs) {
      // The ONE quoted string a rung may contain is the sentinel it commands the
      // model to reuse. Any other quoted span is a speakable replacement line —
      // the 18d no-verdict stall, which opens with neither sentinel.
      const quoted = rung.match(/"[^"]*"/g) ?? [];
      expect(quoted.every((q) => q === '"My turn:"'), rung).toBe(true);
    }
    expect(rungs.join(' ')).toContain('exactly as written');
  });

  it('no catalog sentence opens with a verdict sentinel', () => {
    const prose = [
      entry.description,
      entry.constraints,
      entry.tutoring!.taskDescription,
      ...Object.values(entry.tutoring!.scaffoldingLevels ?? {}),
      ...(entry.tutoring!.commonStruggles ?? []).flatMap((s) => [s.pattern, s.response]),
      ...(entry.tutoring!.aiDirectives ?? []).flatMap((d) => [d.title, d.instruction]),
    ].filter(Boolean) as string[];
    expect(findSentinelCollisions(
      prose.map((text, i) => ({ label: `catalog[${i}]`, text })),
    )).toEqual([]);
  });
});

describe('harness answer material mirrors the discrimination it drills', () => {
  it('a sort drills the stimulus said straight back', () => {
    const item = one(SORT_CH);
    const answers = sortingStationHarnessAnswers(item);
    expect(answers.correct).toBe(item.answer);
    expect(answers.signatureWrong.text).toBe(item.stimulus);
    expect(itemCue(item)).toContain(`Saying the word "${item.stimulus}" back is NOT an answer`);
  });

  it('a count drills the off-by-one the contract forbids rounding toward', () => {
    const item = build(COUNT_CH).find((i) => i.kind === 'count_group')!;
    const answers = sortingStationHarnessAnswers(item);
    expect(answers.signatureWrong.text).not.toBe(answers.correct);
    expect(itemCue(item)).toContain('is the most common miss and it is still wrong');
  });

  it('a two-criteria item drills ONE HALF of the compound', () => {
    const item = build(TWO_CH)[0];
    const answers = sortingStationHarnessAnswers(item);
    expect(answers.signatureWrong.text).toContain(item.criteria!.primary);
    expect(itemCue(item)).toContain('Answering only ONE of the two things is NOT an answer');
  });

  it('an odd-one-out drills the REASON offered in place of the choice', () => {
    const item = one(ODD_CH);
    const answers = sortingStationHarnessAnswers(item);
    expect(answers.signatureWrong.text).toBe('they all go together');
    expect(itemCue(item)).toContain('is NOT an answer — it is the reason');
  });

  it('every plain wrong answer really is wrong', () => {
    const items = [
      ...build(SORT_CH), ...build(ODD_CH), ...build(COUNT_CH),
      ...build(TWO_CH), ...build(ATTR_CH),
    ];
    for (const item of items) {
      const answers = sortingStationHarnessAnswers(item);
      expect(answers.plainWrong.toLowerCase(), item.id).not.toBe(answers.correct.toLowerCase());
    }
  });
});
