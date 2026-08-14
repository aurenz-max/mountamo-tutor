/**
 * countingBoardScript — the pedagogy lives here (pure, real — no jsdom).
 *
 * What this locks in:
 *  1. The pack passes the contract gates: no blocked response class, no
 *     sentinel collision in ANY cue the pack can emit (standing gates 1 + 2).
 *  2. The model-is-the-answer ruling: nothing is modeled before the ask; the
 *     count is modeled only in the correction — walked aloud at ≤10, named
 *     without the walk above 10.
 *  3. The ambiguous-ask ruling: compare hands over on "How many in the group
 *     with more?", never "Which group has more?".
 *  4. subitize_perceptual is NUMBER-FREE in every spoken line, including both
 *     verdict lines of the gesture cue.
 *  5. Response classes split at 20: ≤20 rides the benched number-word class,
 *     21+ declares the build-ahead multi-word class (#63 owed).
 *  6. Cardinality contract: counting aloud that ENDS on the target counts as
 *     that answer; count_on's start number said back does not.
 */
import { describe, expect, it } from 'vitest';
import {
  spokenSpansOf,
  type JudgedScriptPack,
} from '../../../hooks/judgedScriptContract';
import {
  checkDiCatalogEntry,
  checkPackGates,
} from '../../../hooks/judgedScriptContract.testkit';
import { MATH_CATALOG } from '../../../service/manifest/catalog/math';
import {
  completeCue,
  countWalk,
  handVerdictCue,
  howToPlayFor,
  itemCue,
  moveOnCue,
  numberWordFor,
  responseClassFor,
  type CountingItem,
  type CountingItemKind,
} from './countingBoardScript';

const item = (
  kind: CountingItemKind,
  target: number,
  extra: Partial<CountingItem> = {},
): CountingItem => ({
  id: extra.id ?? `${kind}-${target}`,
  kind,
  answerKind: kind === 'subitize_perceptual' ? 'gesture' : 'voice',
  responseClass: responseClassFor({ kind, target }),
  action: kind,
  objectWord: 'bears',
  count: extra.count ?? target,
  target,
  ...extra,
});

const FIXTURES: CountingItem[] = [
  item('count_all', 5),
  item('subitize', 4),
  item('subitize_perceptual', 2, { count: 2 }),
  item('count_on', 8, { startFrom: 5 }),
  item('group_count', 12, { groupSize: 4 }),
  item('compare', 7, { count: 11, groupSize: 7 }),
  item('count_all', 21, { id: 'big-21' }),
];

const packOf = (items: CountingItem[]): JudgedScriptPack<CountingItem> => ({
  primitiveType: 'counting-board',
  activityLine: 'live direct instruction counting practice',
  items,
  itemCue,
  moveOnCue,
  completeCue,
  contextFor: (it) => ({
    challengeType: it.kind,
    objectType: it.objectWord,
    targetCount: String(it.target),
  }),
});

/** Every line the tutor is told to SPEAK — the shared parser, so every port
 *  reads the same span. */
const spokenLines = spokenSpansOf;

const NUMBER_WORDS = /\b(one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|zero)\b/i;

describe('contract gates', () => {
  it('passes the family gates: validate + performed-directions + repeated-asks', () => {
    // checkPackGates = validateJudgedScriptPack PLUS the two gates that exist
    // because a live drive found the defect after every machine gate passed
    // (the performed "[WAIT silently]"; the byte-identical consecutive ask).
    expect(checkPackGates(packOf(FIXTURES))).toEqual([]);
  });

  it('two count_all items in a row do not recite the ask twice', () => {
    // The fixture list above never pairs a kind with itself, which is the ONE
    // shape that cannot trigger the repeat gate — and a real counting session
    // is mostly count_all after count_all.
    expect(checkPackGates(packOf([
      item('count_all', 5, { id: 'ca-1' }),
      item('count_all', 7, { id: 'ca-2' }),
    ]))).toEqual([]);
  });

  it('the catalog keeps its side: audio mode, contextKeys, template keys, sentinel scan', () => {
    const entry = MATH_CATALOG.find((p) => p.id === 'counting-board')!;
    expect(checkDiCatalogEntry(entry, packOf(FIXTURES), FIXTURES[0])).toEqual([]);
  });

  it('response classes split at 20 (standing gate 1, per item)', () => {
    expect(responseClassFor({ kind: 'count_all', target: 20 })).toBe('number_word_to_20');
    expect(responseClassFor({ kind: 'count_all', target: 21 })).toBe('number_word_to_120');
    expect(responseClassFor({ kind: 'subitize_perceptual', target: 2 })).toBe('manipulation');
  });
});

describe('number words (code-owned)', () => {
  it('covers the primitive ceiling', () => {
    expect(numberWordFor(1)).toBe('one');
    expect(numberWordFor(15)).toBe('fifteen');
    expect(numberWordFor(20)).toBe('twenty');
    expect(numberWordFor(21)).toBe('twenty-one');
    expect(numberWordFor(30)).toBe('thirty');
  });

  it('walks the count for the ≤10 correction', () => {
    expect(countWalk(3)).toBe('One, two, three');
  });
});

describe('the asks', () => {
  it('nothing is modeled before the ask — the cue presents the stimulus and hands over', () => {
    const cue = itemCue(item('count_all', 5));
    const [spoken] = spokenLines(cue);
    expect(spoken).toContain('Your turn. How many bears?');
    // The count itself never appears in the spoken ask.
    expect(spoken).not.toMatch(/\bfive\b/i);
    expect(spoken).not.toMatch(/\d/);
  });

  it('the opening cue carries the how-to-play inside the quoted line (SWAP-1)', () => {
    const cue = itemCue(item('count_all', 5), { opening: true, howToPlay: true });
    const [spoken] = spokenLines(cue);
    expect(spoken).toContain('Touch each bears one time as you count'.replace('bears', 'bears'));
    expect(spoken).toContain(howToPlayFor(item('count_all', 5)).trim());
  });

  it('compare hands over on a count, never on "which group" (ambiguous-ask ruling)', () => {
    const [spoken] = spokenLines(itemCue(item('compare', 7, { count: 11 })));
    expect(spoken).toContain('How many in the group with more?');
    expect(spoken).not.toMatch(/which group\?$/i);
  });

  it('count_on names the start as stimulus and asks for the total', () => {
    const [spoken] = spokenLines(itemCue(item('count_on', 8, { startFrom: 5 })));
    expect(spoken).toContain('already has five');
    expect(spoken).toContain('How many bears altogether?');
    expect(spoken).not.toMatch(/\beight\b/i);
  });
});

describe('the judging contracts', () => {
  it('cardinality: counting aloud that ends on the target IS the answer', () => {
    const cue = itemCue(item('count_all', 5));
    expect(cue).toContain('Counting aloud that ENDS on "five" counts as that answer');
    expect(cue).toContain('The correct answer is "five"');
  });

  it('count_on flags the start number said back as a non-answer', () => {
    const cue = itemCue(item('count_on', 8, { startFrom: 5 }));
    expect(cue).toContain('The starting number "five" said back is NOT the answer');
  });

  it('compare flags the smaller group as the fluent wrong answer', () => {
    const cue = itemCue(item('compare', 7, { count: 11 }));
    expect(cue).toContain("The smaller group's count is NOT the answer");
  });

  it('the ≤10 correction walks the count and lands on the answer', () => {
    const cue = itemCue(item('count_all', 5));
    expect(cue).toContain('My turn: watch me count. One, two, three, four, five. Five bears.');
    expect(cue).toContain('Your turn. How many bears?');
  });

  it('the >10 correction names the answer without the walk (ear-noise ruling)', () => {
    const cue = itemCue(item('count_all', 21));
    expect(cue).toContain('there are twenty-one bears');
    expect(cue).not.toContain('watch me count. One,');
  });

  it('every contract orders the tutor to wait and never count along', () => {
    for (const it_ of FIXTURES.filter((f) => f.kind !== 'subitize_perceptual')) {
      const cue = itemCue(it_);
      // Stated as a FACT about the turn, never ordered: a model handed the
      // imperative form voiced it as "[WAIT silently]" on a ten-frame drive.
      expect(cue).toContain('The quoted line is the ONLY thing you say on this turn');
      expect(cue).toContain('you then stay silent while the learner counts');
      expect(cue).toContain('Never count aloud');
    }
  });
});

describe('subitize_perceptual is number-free (pre-numeric contract)', () => {
  const pk = item('subitize_perceptual', 2, { count: 2 });

  it('the item cue spoken line has no digits and no number words', () => {
    for (const spoken of spokenLines(itemCue(pk, { opening: true, howToPlay: true }))) {
      expect(spoken).not.toMatch(/\d/);
      expect(spoken).not.toMatch(NUMBER_WORDS);
    }
  });

  it('the item cue is a SILENCE contract — the tap answers, not speech', () => {
    const cue = itemCue(pk);
    expect(cue).toContain('The quoted line is the ONLY thing you say on this turn');
    expect(cue).toContain('answers by TAPPING');
    expect(cue).toContain('Do not say any number word');
  });

  it('both gesture verdict lines are number-free', () => {
    for (const picked of [2, 3]) {
      for (const spoken of spokenLines(handVerdictCue(pk, picked))) {
        expect(spoken).not.toMatch(/\d/);
        expect(spoken).not.toMatch(NUMBER_WORDS);
      }
    }
  });

  it('the gesture cue tells the judge which way to rule', () => {
    expect(handVerdictCue(pk, 2)).toContain('MATCHES');
    expect(handVerdictCue(pk, 3)).toContain('does NOT match');
    expect(spokenLines(handVerdictCue(pk, 2))[0]).toMatch(/^Yes!/);
    expect(spokenLines(handVerdictCue(pk, 3))[0]).toMatch(/^My turn:/);
  });
});

describe('move-on and complete', () => {
  it('moveOnCue with a next item acknowledges then carries the next ask + contract', () => {
    const cue = moveOnCue(item('count_all', 5), item('subitize', 4), { howToPlay: true });
    const [spoken] = spokenLines(cue);
    expect(spoken).toContain('Good try!');
    expect(spoken).toContain('How many bears?');
    expect(cue).toContain('The correct answer is "four"');
  });

  it('moveOnCue on the last item stops', () => {
    const cue = moveOnCue(item('count_all', 5), null);
    expect(cue).toContain('Then stop.');
  });

  it('completeCue closes the activity and stops', () => {
    expect(completeCue()).toContain('Then stop — the activity is over.');
  });
});
