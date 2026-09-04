/**
 * era-explorer — the judged DI pack's gate (port 24, first history port).
 *
 * Replaces `EraExplorer.tiers.test.tsx` and `EraExplorer.tutoring.test.tsx`,
 * whose assertions pinned the click-era surface (the bin captions, the hint
 * ladder, the Start gate, the figure-voice button). Nothing they protected is
 * dropped — each intent is RE-BASED onto the surface that replaced it, and the
 * describe blocks below say which:
 *
 *   L3 "the tier must actually withdraw something"  → the lead-in ladder
 *   L3 "the tutor may not hand back the withdrawal" → the scripted correction
 *   L3 "the icon survives every tier"               → the MENU survives every
 *                                                     tier (the mats rule): the
 *                                                     pre-reader's channel to
 *                                                     the choices is now the ask
 *   L2 "read-aloud must carry what a non-reader
 *       cannot read"                                → `sourceCue` reads the lens
 *                                                     BODY, the evidence itself
 *   L2 "the era voice must never brush a live
 *       statement"                                  → no cue but the item cue
 *                                                     may name the statement
 */
import { describe, it, expect } from 'vitest';
import {
  checkDiCatalogEntry,
  checkPackGates,
  type DiCatalogEntryLike,
} from '../../../../hooks/judgedScriptContract.testkit';
import {
  spokenSpanOf,
  spokenSpansOf,
  type JudgedScriptPack,
} from '../../../../hooks/judgedScriptContract';
import { HISTORY_CATALOG } from '../../../../service/manifest/catalog/history';
import {
  answerKindFor,
  answerWordsInStatement,
  choicesFor,
  correctChoiceOf,
  eraExplorerHarnessAnswers,
  eraExplorerPackBase,
  ERA_KINDS,
  guideLineFor,
  itemFromChallenge,
  itemsFromChallenges,
  leadInFor,
  menuClauseFor,
  modelLineFor,
  optionsEarSeparable,
  responseClassFor,
  sourceCue,
  stimulusFor,
  type EraChallengeLike,
  type EraExplorerItem,
  type EraSessionLike,
  type EraTier,
} from '../eraExplorerScript';

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

/**
 * A REAL SESSION SHAPE, not one item per mode.
 *
 * The one-per-mode fixture every port reaches for first is the only shape
 * `findRepeatedConsecutiveAsks` can never fire on — consecutive items differ by
 * action by construction — so it leaves the gate on and asleep (19a found all 12
 * suites in that state). This pack runs two lens_id, three era_sort and two
 * era_compare items back to back, which is what a drawn session actually looks
 * like.
 */
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

const buildPack = (tier: EraTier = 'medium'): JudgedScriptPack<EraExplorerItem> =>
  eraExplorerPackBase(buildItems(tier)) as JudgedScriptPack<EraExplorerItem>;

const CATALOG = HISTORY_CATALOG.find((c) => c.id === 'era-explorer') as unknown as DiCatalogEntryLike;

/** The ask span with every legitimately-exempt span subtracted — what the leak
 *  scan actually looks at. */
const askWithoutExemptions = (item: EraExplorerItem): string => {
  const answers = eraExplorerHarnessAnswers(item);
  let ask = spokenSpanOf(eraExplorerPackBase([item]).itemCue(item, { opening: false, howToPlay: false }));
  for (const span of answers.leakExemptSpan) ask = ask.split(span).join(' ');
  return ask.toLowerCase();
};

// ---------------------------------------------------------------------------
// The shared gates
// ---------------------------------------------------------------------------

describe('era-explorer pack gates', () => {
  it('builds a real session and passes every structural gate', () => {
    const pack = buildPack();
    expect(pack.items.length).toBe(8);
    expect(checkPackGates(pack)).toEqual([]);
  });

  it('passes the gates at every tier — the lead-in ladder changes the cue', () => {
    for (const tier of ['easy', 'medium', 'hard'] as EraTier[]) {
      expect(checkPackGates(buildPack(tier))).toEqual([]);
    }
  });

  it('matches its catalog entry', () => {
    const pack = buildPack();
    expect(checkDiCatalogEntry(CATALOG, pack, pack.items[0])).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// The answer-material fork — pinned in BOTH directions
// ---------------------------------------------------------------------------

describe('the split (standing gate 1)', () => {
  it('every mode is spoken — there is no gesture item in this pack', () => {
    for (const kind of ERA_KINDS) expect(answerKindFor(kind)).toBe('voice');
    expect(buildItems().every((i) => i.answerKind === 'voice')).toBe(true);
  });

  it('every mode is closed_set_choice, because every mode is a three-bin classification', () => {
    for (const kind of ERA_KINDS) expect(responseClassFor(kind)).toBe('closed_set_choice');
    expect(buildItems().every((i) => i.responseClass === 'closed_set_choice')).toBe(true);
  });

  it('no item is ever told to ignore the microphone', () => {
    const pack = buildPack();
    for (const item of pack.items) {
      expect(pack.itemCue(item, { opening: false, howToPlay: false })).not.toMatch(/tap|touch|press|click/i);
    }
  });
});

// ---------------------------------------------------------------------------
// Leaks — the ask never hands over its own answer
// ---------------------------------------------------------------------------

describe('answer-leak discipline', () => {
  it('the spoken ask never carries the answer outside the menu and the model line', () => {
    for (const tier of ['easy', 'medium', 'hard'] as EraTier[]) {
      for (const item of buildItems(tier)) {
        const stripped = askWithoutExemptions(item);
        const answer = correctChoiceOf(item).distinguisher.toLowerCase();
        expect(stripped, `${item.id} @ ${tier}`).not.toContain(answer);
      }
    }
  });

  it('the correction re-models and re-elicits without landing the answer', () => {
    const pack = buildPack();
    for (const item of pack.items) {
      const spans = spokenSpansOf(pack.itemCue(item, { opening: false, howToPlay: false }));
      // [ask, affirmation, correction] — the two verdict lines are scripted
      // inside the item cue, which is what makes them judgeable at all.
      expect(spans).toHaveLength(3);
      const [, affirm, correction] = spans;
      expect(affirm.startsWith('Yes,')).toBe(true);
      expect(correction.startsWith('My turn:')).toBe(true);
      // The correction hands the question back — it always ends in the menu.
      expect(correction).toContain(menuClauseFor(item));
    }
  });

  it('the printed teaching note never reaches a spoken line', () => {
    const pack = buildPack();
    for (const item of pack.items) {
      if (!item.explanation) continue;
      const spoken = spokenSpansOf(pack.itemCue(item, { opening: true, howToPlay: true })).join(' ');
      expect(spoken).not.toContain(item.explanation);
    }
  });

  it('the context stimulus names no era, no lens and no cause', () => {
    for (const item of buildItems()) {
      const stimulus = stimulusFor(item).toLowerCase();
      expect(stimulus).not.toContain('pioneer');
      expect(stimulus).not.toContain('colonial');
      for (const title of SESSION.lensTitles) {
        expect(stimulus).not.toContain(title.toLowerCase());
      }
      expect(stimulus).not.toContain(correctChoiceOf(item).distinguisher.toLowerCase());
    }
  });

  it('the opening greeting names no era — the era name IS an answer label', () => {
    const pack = buildPack();
    const opening = spokenSpanOf(pack.itemCue(pack.items[0], { opening: true, howToPlay: true }));
    const greeting = opening.slice(0, opening.indexOf('Listen.'));
    expect(greeting.toLowerCase()).not.toContain('pioneer');
    expect(greeting.toLowerCase()).not.toContain('colonial');
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

  it('drops a statement carrying a double quote — it would close the cue span early', () => {
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
// The tier — RE-BASED from the deleted L3 render suite
// ---------------------------------------------------------------------------

describe('support tier (re-based: the lead-in ladder is the spoken lever)', () => {
  const first = (tier: EraTier) => buildItems(tier)[0];

  it('easy speaks the model AND the historian move; medium the model only; hard nothing', () => {
    expect(leadInFor(first('easy'))).toContain(guideLineFor(first('easy')));
    expect(leadInFor(first('easy'))).toContain(modelLineFor(first('easy')));
    expect(leadInFor(first('medium'))).toContain(modelLineFor(first('medium')));
    expect(leadInFor(first('medium'))).not.toContain(guideLineFor(first('medium')));
    expect(leadInFor(first('hard'))).toBe('');
  });

  it('the lead-in speaks only where the how-to-play does — never per item', () => {
    const pack = buildPack('easy');
    const item = pack.items[0];
    const repeat = spokenSpanOf(pack.itemCue(item, { opening: false, howToPlay: false }));
    expect(repeat).not.toContain(modelLineFor(item));
    expect(repeat).not.toContain(guideLineFor(item));
  });

  it('the MENU survives every tier — it is the ask, not a scaffold', () => {
    // Re-based from "the bin ICON survives every tier": the pre-reader's channel
    // to the three choices used to be the icons and is now the spoken menu, so
    // withdrawing it would be the same wrong-band move.
    for (const tier of ['easy', 'medium', 'hard'] as EraTier[]) {
      const pack = buildPack(tier);
      for (const item of pack.items) {
        expect(spokenSpanOf(pack.itemCue(item, { opening: false, howToPlay: false })))
          .toContain(menuClauseFor(item));
      }
    }
  });

  it('the tutor cannot hand back what the tier withdrew — the correction is identical at every tier', () => {
    // Re-based from the L3 gotcha (`tutorRevealPolicy`): the click era had to
    // branch the tutor's improvised nudge by tier, and getting that branch wrong
    // silently half-applied the tier. There is no improvised nudge left, so the
    // failure mode is gone by construction rather than by a branch.
    const correctionAt = (tier: EraTier) => {
      const pack = buildPack(tier);
      const item = pack.items[0];
      return spokenSpansOf(pack.itemCue(item, { opening: false, howToPlay: false }))[2];
    };
    expect(correctionAt('hard')).toBe(correctionAt('easy'));
  });
});

// ---------------------------------------------------------------------------
// The source read — RE-BASED from the deleted L2 tutoring suite
// ---------------------------------------------------------------------------

describe('the source read-aloud', () => {
  it('speaks the lens BODY — the evidence a non-reader cannot reach', () => {
    const cue = sourceCue('Technology', SESSION.lensBodies[1])!;
    expect(cue).toContain(SESSION.lensBodies[1]);
    expect(spokenSpanOf(cue)).toBe(SESSION.lensBodies[1]);
  });

  it('never speaks a statement, an option, or a verdict', () => {
    const cue = sourceCue('Daily Life', SESSION.lensBodies[0])!;
    const spoken = spokenSpanOf(cue);
    for (const c of CHALLENGES) expect(spoken).not.toContain(c.statement);
    for (const bin of [...SORT_BINS, ...COMPARE_BINS]) expect(spoken).not.toContain(bin);
    expect(cue).toMatch(/never say which choice it points to/);
  });

  it('refuses a lens body that would be read as a verdict', () => {
    expect(sourceCue('Daily Life', 'Yes, water came in from the pump outside.')).toBeNull();
    expect(sourceCue('Daily Life', 'My turn to tell you about the pump outside.')).toBeNull();
    expect(sourceCue('Daily Life', 'Water came from the "pump" outside.')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Catalog steering — a regression here routes the primitive wrong forever
// ---------------------------------------------------------------------------

describe('catalog steering', () => {
  it('names the microphone and no longer sells a tap surface', () => {
    const prose = `${CATALOG.description} ${CATALOG.constraints}`;
    expect(prose).toMatch(/microphone/i);
    expect(prose).toMatch(/spoken/i);
    // The one mention of tapping is a NEGATION, and that is the steering that
    // matters: the click-era prose ("sort life details into the era / today /
    // both") is what would route this primitive back onto a tap surface forever.
    expect(prose).toMatch(/there is nothing to drag, tap or type/i);
    expect(prose).not.toMatch(/\btap the\b|\bdrag (a|an|the)\b|\bsort [^.]* into\b/i);
  });

  it('keeps the four eval modes and their betas — nothing structural moved', () => {
    const entry = HISTORY_CATALOG.find((c) => c.id === 'era-explorer')!;
    expect(entry.evalModes?.map((m) => [m.evalMode, m.beta])).toEqual([
      ['lens_id', 2.0],
      ['era_sort', 3.5],
      ['era_compare', 5.0],
      ['cause_of_change', 6.5],
    ]);
  });
});

// ---------------------------------------------------------------------------
// Harness answer material
// ---------------------------------------------------------------------------

describe('harness answers', () => {
  it('gives the drive a correct, a plain wrong and the signature wrong per mode', () => {
    for (const item of buildItems()) {
      const a = eraExplorerHarnessAnswers(item);
      expect(a.correct).toBeTruthy();
      expect(a.plainWrong).toBeTruthy();
      expect(a.plainWrong).not.toBe(a.correct);
      expect(a.signatureWrong?.text).toBeTruthy();
      expect(a.signatureWrong?.why).toBeTruthy();
    }
  });

  it('claims exactly the signature the contract refuses, per mode', () => {
    const byKind = new Map(buildItems().map((i) => [i.kind, i]));
    // era_compare: "today" is not one of the three choices at all.
    const compare = byKind.get('era_compare')!;
    expect(eraExplorerHarnessAnswers(compare).signatureWrong?.text).toBe('today');
    const contract = eraExplorerPackBase([compare]).itemCue(compare, { opening: false, howToPlay: false });
    expect(contract).toMatch(/weighing the statement against TODAY/);
    // cause_of_change: the statement said back is not a cause.
    const cause = byKind.get('cause_of_change')!;
    const causeContract = eraExplorerPackBase([cause]).itemCue(cause, { opening: false, howToPlay: false });
    expect(causeContract).toMatch(/restating WHAT changed instead of naming WHY/);
  });
});
