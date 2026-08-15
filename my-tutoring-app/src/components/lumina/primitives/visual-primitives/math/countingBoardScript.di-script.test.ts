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
 *
 * ADDED BY THE 19h-i-b ADAPTER SWEEP (this port is its first):
 *  7. THE WIRE. The pack under test is now `countingBoardPackBase` — the same
 *     exported surface the component spreads and the DI drive plan reads. The
 *     hand-rolled fixture this file used to carry could have passed every gate
 *     here while production sent something else (the drift ten-frame's suite
 *     deleted for the same reason).
 *  8. THE BUILD GATE: the two ways a counting challenge arrives unaskable, and
 *     the promise that nothing is backfilled.
 *  9. THE STATE BLOCK IS ANSWER-FREE — the regression guard for the
 *     `targetCount` key this port pushed on every item until the sweep.
 * 10. THE HARNESS ANSWERS MIRROR THE CONTRACT: every `signatureWrong` is a
 *     miss the item's own judging contract names in prose. Change one, change
 *     both — this is where the pairing is enforced.
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
  ACTION_FOR_KIND,
  completeCue,
  countingBoardHarnessAnswers,
  countingBoardPackBase,
  countedNoun,
  countWalk,
  handVerdictCue,
  howToPlayFor,
  itemCue,
  itemFromChallenge,
  itemsFromChallenges,
  moveOnCue,
  numberWordFor,
  objectSingularFor,
  objectWordFor,
  responseClassFor,
  stimulusFor,
  type CountingChallengeLike,
  type CountingItem,
  type CountingItemKind,
} from './countingBoardScript';
import { DI_PORTS } from '../../../service/qa/di/diDrivePlan';

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

/**
 * THE PACK UNDER TEST IS THE EXPORTED SURFACE, not a retyped copy of it. This
 * used to be a hand-rolled literal, which is a second source of truth for the
 * cues and context keys the pedagogy lives in — it could have gone green while
 * the component and the DI harness sent something else.
 */
const packOf = (items: CountingItem[]): JudgedScriptPack<CountingItem> =>
  countingBoardPackBase(items) as JudgedScriptPack<CountingItem>;

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
    expect(spoken).toContain(howToPlayFor(item('count_all', 5)).trim());
  });

  it('the one-at-a-time line says the object in the SINGULAR', () => {
    // "Touch each butterflies one time" is what the first --di plan printed
    // (19h-i-b, port 1) — spoken, to a five-year-old, on the opener.
    const [spoken] = spokenLines(
      itemCue({ ...item('count_all', 5), objectWord: 'butterflies' }, { opening: true, howToPlay: true }),
    );
    expect(spoken).toContain('Touch each butterfly one time');
    expect(spoken).not.toContain('each butterflies');
    expect(objectSingularFor('fish')).toBe('fish');          // no naive de-pluralising
    expect(objectSingularFor('llamas')).toBe('llamas');      // unknown word keeps what shipped
  });

  it('the verdict lines agree in number with a board of ONE', () => {
    // "Yes, one bears." is the same defect one turn later, and a board of one
    // is reachable on every counted mode.
    expect(countedNoun(1, 'bears')).toBe('one bear');
    expect(countedNoun(5, 'bears')).toBe('five bears');
    expect(itemCue(item('count_all', 1), {})).toContain('say exactly: "Yes, one bear."');
    expect(itemCue(item('count_all', 5), {})).toContain('say exactly: "Yes, five bears."');
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

// ══════════════════════════════════════════════════════════════════════════
// 19h-i-b — the DI adapter wire (this port is the sweep's first)
// ══════════════════════════════════════════════════════════════════════════

const chOf = (
  ch: Partial<CountingChallengeLike> & { id: string; type: CountingItemKind },
): CountingItem | null =>
  itemFromChallenge(
    { targetAnswer: ch.targetAnswer ?? 5, count: ch.count ?? 5, ...ch },
    { objectWord: 'bears' },
  );

describe('the build gate — items that cannot be ASKED are dropped, never backfilled', () => {
  it('drops an answer below one: "zero" is an unbenched spoken answer', () => {
    expect(chOf({ id: 'z1', type: 'count_all', targetAnswer: 0, count: 0 })).toBeNull();
    expect(chOf({ id: 'z2', type: 'compare', targetAnswer: -1, count: 4 })).toBeNull();
  });

  it('drops a count_on with no usable startFrom — the ask SPEAKS that number', () => {
    // "This group already has zero." / "…already has eight" for an answer of
    // eight hands the child the total before they count.
    expect(chOf({ id: 'c1', type: 'count_on', targetAnswer: 8, count: 8 })).toBeNull();
    expect(chOf({ id: 'c2', type: 'count_on', targetAnswer: 8, count: 8, startFrom: 0 })).toBeNull();
    expect(chOf({ id: 'c3', type: 'count_on', targetAnswer: 8, count: 8, startFrom: 8 })).toBeNull();
    expect(chOf({ id: 'c4', type: 'count_on', targetAnswer: 8, count: 8, startFrom: 9 })).toBeNull();
    expect(chOf({ id: 'c5', type: 'count_on', targetAnswer: 8, count: 8, startFrom: 5 })).not.toBeNull();
  });

  it('builds a session in order and reports the survivors, not a backfill', () => {
    const built = itemsFromChallenges(
      [
        { id: 'a', type: 'count_all', targetAnswer: 3, count: 3 },
        { id: 'b', type: 'count_on', targetAnswer: 8, count: 8 },
        { id: 'c', type: 'count_on', targetAnswer: 8, count: 8, startFrom: 5 },
      ],
      { objectWord: 'bears' },
    );
    expect(built.map((i) => i.id)).toEqual(['a', 'c']);
  });

  it('the fork and the action map come from the builder, not the component', () => {
    expect(chOf({ id: 'g', type: 'subitize_perceptual', targetAnswer: 2, count: 2 })!.answerKind)
      .toBe('gesture');
    expect(chOf({ id: 'v', type: 'count_all', targetAnswer: 5, count: 5 })!.answerKind).toBe('voice');
    expect(ACTION_FOR_KIND.count_all).toBe(ACTION_FOR_KIND.group_count); // one thing to DO
    expect(new Set(Object.values(ACTION_FOR_KIND)).size).toBe(5);
  });

  it('the object word is one decision, shared by both sides of the wire', () => {
    expect(objectWordFor('bears')).toBe('bears');
    expect(objectWordFor('custom')).toBe('objects');
  });
});

describe('the state block is ANSWER-FREE (the targetCount regression guard)', () => {
  it.each(FIXTURES.map((f) => [f.kind, f] as const))('%s pushes no answer and no digit', (_k, fixture) => {
    const pushed = Object.values(packOf([fixture]).contextFor(fixture)).join(' ');
    expect(pushed.toLowerCase()).not.toContain(numberWordFor(fixture.target));
    expect(pushed).not.toMatch(/\d/);
  });

  it('the only numbers a stimulus names are the PUBLIC ones', () => {
    // count_on's startFrom is spoken by the ask; group_count's groupSize
    // describes the board's structure, never its total.
    expect(stimulusFor(item('count_on', 8, { startFrom: 5 }))).toContain('five');
    expect(stimulusFor(item('group_count', 12, { groupSize: 4 }))).toContain('four');
    const cmp = item('compare', 7, { count: 11, groupSize: 7 });
    expect(stimulusFor(cmp)).not.toContain(numberWordFor(7));
    expect(stimulusFor(cmp)).not.toContain(numberWordFor(4)); // nor its signature miss
  });

  it('no catalog prose names a targetCount key any more', () => {
    const entry = MATH_CATALOG.find((p) => p.id === 'counting-board')!;
    expect(JSON.stringify(entry.tutoring)).not.toContain('targetCount');
  });
});

describe('harness answers mirror the judging contract', () => {
  it('correct is the answer word and plainWrong never is', () => {
    for (const f of FIXTURES.filter((i) => i.answerKind === 'voice')) {
      const a = countingBoardHarnessAnswers(f);
      expect(a.correct).toBe(numberWordFor(f.target));
      expect(a.plainWrong).not.toBe(a.correct);
      expect(a.leakTokens).toEqual([numberWordFor(f.target)]);
    }
  });

  it('THE COUNTED MODES: the signature wrong is a walk that ends one PAST the target', () => {
    // The contract ACCEPTS a count said aloud that ends on the target, so the
    // fluent miss is the walk containing the answer word without landing on it
    // — the only wrong answer here a string-matching judge affirms.
    const counted = [
      item('count_all', 5),
      item('subitize', 4),
      item('group_count', 12, { groupSize: 4 }),
    ];
    for (const f of counted) {
      const sig = countingBoardHarnessAnswers(f).signatureWrong!;
      expect(sig.text).toBe(countWalk(f.target + 1));
      expect(sig.text.toLowerCase()).toContain(numberWordFor(f.target));
      expect(sig.text.toLowerCase().endsWith(numberWordFor(f.target + 1))).toBe(true);
      // …and the contract is what makes that claim.
      expect(itemCue(f, {})).toContain('the last number said tells the total');
    }
  });

  it('count_on: the signature wrong is the start said back, and the contract names it', () => {
    const co = item('count_on', 8, { startFrom: 5 });
    expect(countingBoardHarnessAnswers(co).signatureWrong!.text).toBe('five');
    expect(itemCue(co, {})).toContain('The starting number "five" said back is NOT the answer');
  });

  it('compare: the signature wrong is the SMALLER group, and the contract names it', () => {
    const cmp = item('compare', 7, { count: 11, groupSize: 7 });
    expect(countingBoardHarnessAnswers(cmp).signatureWrong!.text).toBe(numberWordFor(4));
    expect(itemCue(cmp, {})).toContain("The smaller group's count is NOT the answer");
  });

  it('the hand item commits a FINGER COUNT inside the three offered hands', () => {
    const a = countingBoardHarnessAnswers(item('subitize_perceptual', 2, { count: 2 }));
    expect(a.placed).toEqual({ correct: 2, wrong: 1 });
    // target 1 has no lower neighbour and the wrong hand still has to exist.
    const one = countingBoardHarnessAnswers(item('subitize_perceptual', 1, { count: 1 }));
    expect(one.placed).toEqual({ correct: 1, wrong: 2 });
    for (const p of [a.placed!, one.placed!]) {
      expect([1, 2, 3]).toContain(p.correct);
      expect([1, 2, 3]).toContain(p.wrong);
    }
  });
});

describe('the registered DI adapter', () => {
  const adapter = DI_PORTS['counting-board'];

  it('is registered, so `--di` can drive this port', () => {
    expect(adapter).toBeDefined();
  });

  it('rebuilds the SAME items the component builds, from the raw generator payload', () => {
    const data = {
      objects: { type: 'bears' },
      challenges: [
        { id: 'a', type: 'count_all', targetAnswer: 5, count: 5 },
        { id: 'b', type: 'count_on', targetAnswer: 8, count: 8 },          // dropped
        { id: 'c', type: 'subitize_perceptual', targetAnswer: 2, count: 2 },
      ],
    } as unknown as Record<string, unknown>;
    const built = adapter.build(data);
    expect(built.items.map((i) => i.id)).toEqual(['a', 'c']);
    expect(built.dropped).toBe(1);
    expect(built.surface.primitiveType).toBe('counting-board');
    // The surface it returns IS the exported one, cues included.
    expect(built.surface.itemCue(built.items[0], { opening: false, howToPlay: false }))
      .toBe(itemCue(built.items[0] as CountingItem, { opening: false, howToPlay: false }));
  });

  it('a custom object type reaches the tutor as a sayable word', () => {
    const built = adapter.build({
      objects: { type: 'custom' },
      challenges: [{ id: 'a', type: 'count_all', targetAnswer: 4, count: 4 }],
    } as unknown as Record<string, unknown>);
    expect((built.items[0] as CountingItem).objectWord).toBe('objects');
  });

  it('the gesture verdict is code-computed from the tapped finger count', () => {
    const built = adapter.build({
      objects: { type: 'stars' },
      challenges: [{ id: 'h', type: 'subitize_perceptual', targetAnswer: 3, count: 3 }],
    } as unknown as Record<string, unknown>);
    const hands = built.items[0];
    expect(adapter.gestureVerdictCue!(hands, 3)).toContain('MATCHES');
    expect(adapter.gestureVerdictCue!(hands, 1)).toContain('does NOT match');
  });
});

describe('the two-branch law (cap-drill finding, 2026-08-15)', () => {
  it('every judged contract states the law BEFORE its branches', () => {
    for (const f of FIXTURES.filter((i) => i.answerKind === 'voice')) {
      const cue = itemCue(f, {});
      expect(cue).toContain('Your whole reply to their attempt is ONE of the quoted lines below');
      expect(cue).toContain('no scaffolding line');
      expect(cue.indexOf('Your whole reply')).toBeLessThan(cue.indexOf('If the answer is right'));
    }
  });

  it('the correction is named as invariant for the item', () => {
    expect(itemCue(item('count_all', 5), {}))
      .toContain('the same line on every wrong answer for this item');
  });

  it('THE CATALOG SCAFFOLD RUNGS CARRY A SENTINEL — a bare rung stalls the loop', () => {
    // The cap drill caught the model speaking level 2 and level 3 verbatim on
    // corrections 2 and 3; neither opened with a sentinel, so the loop recorded
    // di-no-verdict twice and the counter froze. The rungs now route the same
    // pedagogy through the correction branch.
    const entry = MATH_CATALOG.find((p) => p.id === 'counting-board')!;
    const levels = Object.values(entry.tutoring!.scaffoldingLevels ?? {}) as string[];
    expect(levels).toHaveLength(3);
    for (const level of levels) {
      expect(level).toMatch(/scripted correction|say nothing further/i);
    }
    // The two lines the model actually spoke are gone from the catalog.
    const prose = JSON.stringify(entry.tutoring);
    expect(prose).not.toContain('Touch each one just one time as you count"');
    expect(prose).not.toContain('Point at the first one. Count with your finger.');
  });
});
