/**
 * baseTenScript — the base-ten-blocks judged loop, pinned where the pedagogy
 * lives. Pure: no jsdom, no mocked runner, no live session. The STAGE has its
 * own suite (`BaseTenBlocksDi.di-stage.test.tsx`); this file is the pack.
 *
 * What it locks in:
 *  1. BUILD GATES. A number that cannot carry an honest ask is DROPPED, never
 *     repaired into a different one — out of band, no place above the ones,
 *     and ⭐ on `regroup` an EMPTY RECEIVING PLACE (see 6 below).
 *  2. ITEM SHAPE. One problem becomes one item per plan step, the session is
 *     selected in whole problems, and the subject place rotates so consecutive
 *     problems are not the same question twice.
 *  3. ⭐ THE THREE SIGNATURE ERRORS. Each judging contract names the fluent
 *     wrong answer its step exists to undo and refuses it: the VALUE said for
 *     the COUNT, the BARE COUNT said for the value, and "ten" for the
 *     prediction. A contract that merely knows the right answer is not enough —
 *     the wrong answer a judge would affirm by accident has to be written down.
 *  4. ANSWER LEAK, in the ASK. On `read_blocks` the counts ARE the answers, so
 *     neither the ask, the scene, the stimulus nor the context bag may state a
 *     count, a value or the composed number before the child has answered. On
 *     `regroup` the hands turn may not leak the result of the trade before the
 *     check.
 *  5. THE HOW-TO-PLAY IS OPENING-ONLY, which is the item-shape half of
 *     add-di-loop defect 13: steps alternate, so an action-change policy would
 *     re-recite the protocol on literally every item.
 *  6. ⭐ THE REGRESSION BITE (2026-09-12). `regroup` on a number whose
 *     receiving place is empty — every multiple of ten — made the ask state its
 *     own answer ("trade one ten-stick for TEN ones cubes… how many ones cubes
 *     will you have then?") and handed the tutor a contract calling "ten" both
 *     the expected answer and the signature WRONG one. Those numbers now drop.
 *  7. THE CATALOG'S SIDE: per-mode audio transport, contextKeys matching
 *     exactly what the pack pushes, every {{key}} resolvable, no prose sentence
 *     opening with a verdict sentinel.
 */
import { describe, expect, it } from 'vitest';
import {
  MAX_SESSION_ITEMS,
  MAX_TARGET,
  MIN_TARGET,
  baseTenChangeCue,
  baseTenCheckCue,
  baseTenCompleteCue,
  baseTenHarnessAnswers,
  baseTenHearCue,
  baseTenItemCue,
  baseTenItems,
  baseTenMoveOnCue,
  baseTenPackBase,
  contextForItem,
  isAskableTarget,
  isInBandTarget,
  itemsFromChallenges,
  problemsFromChallenges,
  stepsOfProblem,
  stimulusFor,
  usesBaseTenDi,
  wrongTradePlace,
  type BaseTenItem,
} from './baseTenScript';
import {
  btProblem,
  predictedCount,
  readCount,
  readWorthWord,
  standardColumns,
  startingLowerCount,
  tradeablePlaces,
  tradedColumns,
  wordFor,
  type BtMode,
} from './baseTenModel';
import { BASE_TEN_DI_MODES } from './baseTenModes';
import { JUDGED_AUDIO_INPUT, spokenSpansOf } from '../../../hooks/judgedScriptContract';
import { checkDiCatalogEntry, checkPackGates } from '../../../hooks/judgedScriptContract.testkit';
import { MATH_CATALOG } from '../../../service/manifest/catalog/math';

// ── Fixtures ────────────────────────────────────────────────────────────────

const challenges = (mode: BtMode, ...targets: number[]) =>
  targets.map((targetNumber) => ({ type: mode, targetNumber }));

const build = (mode: BtMode, ...targets: number[]): BaseTenItem[] =>
  itemsFromChallenges(challenges(mode, ...targets), mode);

/** The real session shape: several same-mode problems back to back, which is
 *  the only shape `findRepeatedConsecutiveAsks` can see at all. */
const READ_ITEMS = build('read_blocks', 247, 35, 1234);
const REGROUP_ITEMS = build('regroup', 247, 35, 1234);

const stepNamed = (items: BaseTenItem[], step: string) =>
  items.find((item) => item.step === step)!;

const spansOf = (item: BaseTenItem) =>
  spokenSpansOf(baseTenItemCue(item, { opening: false, howToPlay: false }));

const askOf = (item: BaseTenItem) => spansOf(item)[0] ?? '';
const affirmOf = (item: BaseTenItem) => spansOf(item)[1] ?? '';
const correctionOf = (item: BaseTenItem) => spansOf(item)[2] ?? '';

/** Everything in the cue that is NOT spoken — the judge-side instruction. */
const judgeSideOf = (item: BaseTenItem) =>
  baseTenItemCue(item, { opening: false, howToPlay: false })
    .replace(/(?:Say|Speak) exactly:\s*"[\s\S]*?"/gi, ' ');

// ---------------------------------------------------------------------------
// 1. Build gates
// ---------------------------------------------------------------------------

describe('baseTenScript · build gates', () => {
  it('the band is two to four digits — a one-digit mat has no place to ask about', () => {
    expect(isInBandTarget(MIN_TARGET)).toBe(true);
    expect(isInBandTarget(MAX_TARGET)).toBe(true);
    expect(isInBandTarget(9)).toBe(false);
    expect(isInBandTarget(10_000)).toBe(false);
    expect(isInBandTarget(24.5)).toBe(false);
    expect(isInBandTarget('24')).toBe(false);
  });

  it('an unaskable challenge is DROPPED, and the askable ones still run', () => {
    const items = build('read_blocks', 7, 247);
    expect(new Set(items.map((item) => item.problem.target))).toEqual(new Set([247]));
  });

  it('⭐ regroup refuses a number whose RECEIVING place is empty', () => {
    // The whole mode is "the blocks already on the mat are not forgotten". With
    // nothing on the receiving place the prediction is a repetition of the ask,
    // and the signature wrong answer ("ten") IS the right answer.
    for (const multipleOfTen of [40, 100, 700, 1000]) {
      expect(isAskableTarget(multipleOfTen, 'regroup')).toBe(false);
      expect(btProblem(multipleOfTen, 'regroup', 0)).toBeNull();
    }
    // …and reading that same mat is still perfectly honest.
    expect(isAskableTarget(40, 'read_blocks')).toBe(true);
  });

  it('every regroup problem the gate admits starts with at least one receiving block', () => {
    for (let target = MIN_TARGET; target <= 999; target++) {
      const problem = btProblem(target, 'regroup', 0);
      if (!problem) continue;
      expect(startingLowerCount(problem)).toBeGreaterThanOrEqual(1);
      // …so the prediction is always an inference, never the stated ten.
      expect(predictedCount(problem)).toBeGreaterThan(10);
    }
  });

  it('tradeablePlaces names only places that can both give and receive', () => {
    expect(tradeablePlaces(247)).toEqual([2, 1]);
    // 270: the hundreds can give (the tens receive), the tens cannot (no ones).
    expect(tradeablePlaces(270)).toEqual([2]);
    // 207: the only block above the ones is a hundred-flat, and the tens that
    // would receive its ten sticks are empty.
    expect(tradeablePlaces(207)).toEqual([]);
    expect(tradeablePlaces(40)).toEqual([]);
  });

  it('the session is selected in WHOLE problems and never sliced mid-problem', () => {
    const items = build('read_blocks', ...Array.from({ length: 20 }, (_, index) => 21 + index));
    expect(items.length).toBeLessThanOrEqual(MAX_SESSION_ITEMS);
    const stepsPerProblem = new Map<string, number>();
    for (const item of items) {
      stepsPerProblem.set(item.problem.id, (stepsPerProblem.get(item.problem.id) ?? 0) + 1);
    }
    for (const count of Array.from(stepsPerProblem.values())) expect(count).toBe(2);
  });

  it('usesBaseTenDi routes HOMOGENEOUS judged payloads only', () => {
    expect(usesBaseTenDi(challenges('read_blocks', 247, 35))).toBe(true);
    expect(usesBaseTenDi(challenges('regroup', 247, 35))).toBe(true);
    // A legacy click mode anywhere in the deck keeps the whole deck on clicks.
    expect(usesBaseTenDi([
      { type: 'read_blocks', targetNumber: 247 },
      { type: 'build_number', targetNumber: 12 },
    ])).toBe(false);
    expect(usesBaseTenDi([{ type: 'build_number', targetNumber: 12 }])).toBe(false);
    expect(usesBaseTenDi([])).toBe(false);
    expect(usesBaseTenDi(undefined)).toBe(false);
    // A judged type whose numbers all fail the gate is not a judged session.
    expect(usesBaseTenDi(challenges('regroup', 40, 100))).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 2. Item shape
// ---------------------------------------------------------------------------

describe('baseTenScript · items', () => {
  it('read_blocks asks the count and then the value, in that order', () => {
    const items = build('read_blocks', 247);
    expect(items.map((item) => item.step)).toEqual(['count', 'worth']);
    expect(items.map((item) => item.answerKind)).toEqual(['voice', 'voice']);
    expect(items.map((item) => item.responseClass)).toEqual(['number_word_to_20', 'place_value_word']);
  });

  it('regroup predicts with the MOUTH before it trades with the HANDS', () => {
    const items = build('regroup', 247);
    expect(items.map((item) => item.step)).toEqual(['predict', 'trade']);
    expect(items.map((item) => item.answerKind)).toEqual(['voice', 'gesture']);
    expect(items[1].responseClass).toBe('manipulation');
  });

  it('the subject place rotates, so two problems are not the same question twice', () => {
    const items = build('read_blocks', 247, 358);
    expect(new Set(items.map((item) => item.problem.place)).size).toBeGreaterThan(1);
  });

  it('stepsOfProblem returns the ordered story of ONE problem', () => {
    const steps = stepsOfProblem(READ_ITEMS, READ_ITEMS[2]);
    expect(steps.map((step) => step.id)).toEqual([READ_ITEMS[2].id, READ_ITEMS[3].id]);
    expect(new Set(steps.map((step) => step.problem.id)).size).toBe(1);
  });

  it('ids are unique across a session', () => {
    const ids = READ_ITEMS.map((item) => item.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('problemsFromChallenges indexes the SURVIVING problems consecutively', () => {
    const problems = problemsFromChallenges(challenges('read_blocks', 7, 247, 3, 35), 'read_blocks');
    expect(problems.map((problem) => problem.id)).toEqual(['base-ten-1', 'base-ten-2']);
  });

  it('zero problems yield zero items, never a placeholder', () => {
    expect(baseTenItems([])).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// 3. ⭐ The three signature errors
// ---------------------------------------------------------------------------

describe('baseTenScript · the signature errors are named and refused', () => {
  it('count: the VALUE said where the COUNT was asked is incorrect, not a near miss', () => {
    const item = stepNamed(build('read_blocks', 247), 'count');
    const judge = judgeSideOf(item);
    expect(judge).toContain(`Private expected count: ${readCount(item.problem)}`);
    expect(judge).toContain(readWorthWord(item.problem));
    expect(judge).toMatch(/signature wrong answer is the VALUE/);
    expect(judge).toMatch(/incorrect here/);
    expect(judge).toContain('the whole number the mat shows');
  });

  it('worth: the BARE COUNT said for the value is incorrect, and the correction teaches WHY', () => {
    const item = stepNamed(build('read_blocks', 247), 'worth');
    const judge = judgeSideOf(item);
    expect(judge).toMatch(/signature wrong answer is the BARE COUNT/);
    expect(judge).toMatch(/not a near miss/);
    // The correction re-models the unit relationship, then re-elicits.
    const correction = correctionOf(item);
    expect(correction).toMatch(
      /^My turn: one hundred-flat is worth one hundred, so two of them are worth two hundred\./,
    );
    expect(correction).toContain('Your turn.');
    expect(correction).toContain(item.actionContract.instruction);
  });

  it('predict: "ten" — the blocks the trade creates, with the mat forgotten — is incorrect', () => {
    const item = stepNamed(build('regroup', 247), 'predict');
    const judge = judgeSideOf(item);
    expect(judge).toContain(`Private expected count: ${predictedCount(item.problem)}`);
    expect(judge).toMatch(/signature wrong answer is "ten"/);
    expect(judge).toContain('The starting count on its own is also incorrect.');
    // …and because the receiving place is never empty, "ten" is never also right.
    expect(affirmOf(item)).not.toMatch(/^Yes, ten\b/);
  });

  it('every voice contract refuses a previous turn and declines to judge a non-answer', () => {
    const voice = [...READ_ITEMS, ...REGROUP_ITEMS].filter((item) => item.answerKind === 'voice');
    expect(voice.length).toBeGreaterThan(4);
    for (const item of voice) {
      const judge = judgeSideOf(item);
      expect(judge).toContain('Help questions, silence');
      expect(judge).toContain('A previous turn never answers the current question');
      expect(judge).toContain('A verdict ends your turn');
    }
  });

  it('the hands turn judges no speech and names no result', () => {
    const judge = judgeSideOf(stepNamed(build('regroup', 247), 'trade'));
    expect(judge).toContain('Do not judge microphone speech');
    expect(judge).toContain('do not name the result of the trade');
    expect(judge).toContain('[BT_CHANGE] is coaching only');
  });
});

// ---------------------------------------------------------------------------
// 4. ⭐ Answer leak
// ---------------------------------------------------------------------------

describe('baseTenScript · the ask never contains its own answer', () => {
  it('read_blocks: no digit and no number word reaches the ask, at either step', () => {
    // The BLOCK NOUN is not a leak — a child has to be told which size to look
    // at, and "hundred-flat" names the object, not its value. What may never
    // appear is the count, the value, or the number the whole mat makes.
    for (const item of READ_ITEMS) {
      const ask = askOf(item);
      expect(ask).not.toMatch(/\d/);
      expect(ask).not.toMatch(new RegExp(`\\b${wordFor(readCount(item.problem))}\\b`, 'i'));
      expect(ask).not.toContain(readWorthWord(item.problem));
      expect(ask).not.toContain(String(item.problem.target));
    }
  });

  it('read_blocks: the SCENE tells the tutor a mat exists and states its own silence', () => {
    const cue = baseTenItemCue(
      stepNamed(build('read_blocks', 247), 'count'),
      { opening: false, howToPlay: false },
    );
    expect(cue).toContain('withheld from you');
    expect(cue).not.toContain('247');
    // The filled-column count is structural — never a block count.
    expect(cue).toMatch(/A block mat with 3 filled columns/);
  });

  it('read_blocks: the stimulus and the context bag withhold every answer-bearing value', () => {
    const item = stepNamed(build('read_blocks', 247), 'worth');
    expect(stimulusFor(item)).toContain('withheld from you');
    expect(stimulusFor(item)).not.toMatch(/\d/);
    const context = contextForItem(item);
    for (const key of ['numberValue', 'currentTotal', 'columns', 'targetNumber']) {
      expect(context[key]).toBe('withheld; the scripted cue carries every value you may say');
    }
    // The keys that are safe carry real values: a bag of nothing but
    // withholdings would make the catalog prose it feeds useless.
    expect(context.challengeType).toBe('read_blocks');
    expect(context.instruction).toBe(item.actionContract.instruction);
  });

  it('⭐ the composed number appears ONLY in the tutor affirmation, never in an ask', () => {
    const items = build('read_blocks', 247);
    for (const item of items) expect(askOf(item)).not.toContain('247');
    expect(affirmOf(items[1])).toContain('and the rest of the mat make 247');
  });

  it('a mat with only ONE occupied place composes nothing — there is no rest of the mat', () => {
    expect(affirmOf(build('read_blocks', 40)[1])).toBe('Yes, four ten-sticks are worth forty.');
  });

  it('⭐ a ONE-block mat takes singular verbs in every scripted line', () => {
    // Found by the 2026-09-12 headless drive, which every machine gate passed:
    // the tutor said "there are one thousand-block", "Yes, one thousand-block
    // ARE worth one thousand", and a correction that restated its own premise
    // ("one thousand-block is worth one thousand, so one of them is worth one
    // thousand"). These lines are read to a child verbatim.
    const items = build('read_blocks', 1234);
    const [count, worth] = [stepNamed(items, 'count'), stepNamed(items, 'worth')];
    expect(readCount(count.problem)).toBe(1);

    expect(affirmOf(count)).toBe('Yes, one thousand-block.');
    expect(correctionOf(count)).toContain('My turn: there is one thousand-block.');
    expect(correctionOf(count)).not.toContain('there are one');

    expect(affirmOf(worth)).toContain('Yes, one thousand-block is worth one thousand.');
    expect(affirmOf(worth)).not.toContain('block are worth');
    // The correction models the relationship once and stops — the "so N of them
    // are worth…" half is a restatement when N is one.
    expect(correctionOf(worth)).toContain('My turn: one thousand-block is worth one thousand.');
    expect(correctionOf(worth)).not.toContain('so one of them');
  });

  it('a multi-block mat keeps the plural verb and the full model sentence', () => {
    const worth = stepNamed(build('read_blocks', 247), 'worth');
    expect(affirmOf(worth)).toContain('two hundred-flats are worth two hundred');
    expect(correctionOf(worth))
      .toContain('one hundred-flat is worth one hundred, so two of them are worth two hundred.');
  });

  it('a single receiving block takes the singular verb in the predict correction', () => {
    const predict = stepNamed(build('regroup', 213), 'predict');
    expect(startingLowerCount(predict.problem)).toBe(1);
    expect(correctionOf(predict)).toContain('one was already there, so there are eleven');
    expect(correctionOf(predict)).not.toContain('one were already there');
  });

  it('the composed clause agrees in number with a single block', () => {
    const worth = stepNamed(build('read_blocks', 132), 'worth');
    expect(readCount(worth.problem)).toBe(1);
    expect(affirmOf(worth)).toContain('That hundred-flat and the rest of the mat make 132.');
    expect(affirmOf(worth)).not.toContain('Those hundred-flats');
  });

  it('regroup: the ask states the STARTING mat so the answer is an inference', () => {
    const ask = askOf(stepNamed(build('regroup', 247), 'predict'));
    expect(ask).toContain('You have 4 ten-sticks.');
    expect(ask).toContain('trade one hundred-flat for ten ten-sticks');
    // The predicted count is what the child must produce, so it is absent.
    expect(ask).not.toContain('14');
    expect(ask).not.toContain('fourteen');
  });

  it('⭐ the hands-turn coaching never states the trade result and never carries a verdict', () => {
    const item = stepNamed(build('regroup', 247), 'trade');
    const traded = tradedColumns(item.problem.start, item.problem.place);
    for (const columns of [item.problem.start, traded, [7, 5, 1]]) {
      const spoken = spokenSpansOf(baseTenChangeCue(item, columns))[0] ?? '';
      expect(spoken).not.toMatch(/^Yes\b/);
      expect(spoken).not.toMatch(/^My turn\b/);
      expect(spoken).not.toMatch(/\b(correct|right|wrong)\b/i);
    }
    expect(spokenSpansOf(baseTenChangeCue(item, item.problem.start))[0])
      .toBe('The mat has not changed yet. Tap a hundred-flat to trade it.');
    expect(spokenSpansOf(baseTenChangeCue(item, traded))[0])
      .toBe('The blocks have moved. Look at what you have now.');
  });

  it('tap-to-hear repeats the question and gives no hint', () => {
    for (const item of [...READ_ITEMS, ...REGROUP_ITEMS]) {
      const cue = baseTenHearCue(item);
      expect(spokenSpansOf(cue)[0]).toBe(item.actionContract.instruction);
      expect(cue).toContain('Do not judge speech you have just heard.');
    }
  });
});

// ---------------------------------------------------------------------------
// 5. The check cue — a code-computed verdict, used as fact
// ---------------------------------------------------------------------------

describe('baseTenScript · the hands verdict is computed in code', () => {
  const item = stepNamed(build('regroup', 247), 'trade');
  const traded = tradedColumns(item.problem.start, item.problem.place);

  it('the right trade is affirmed, and the value preservation is said out loud', () => {
    const cue = baseTenCheckCue(item, traded);
    expect(cue).toContain('Code computed solved=true');
    expect(spokenSpansOf(cue)[0])
      .toBe('Yes, one hundred-flat became ten ten-sticks. The mat still shows the same number.');
  });

  it('trading the WRONG size MODELS the trade and then re-elicits it', () => {
    // Not a bare "My turn: <the child's own instruction>": that promises a
    // demonstration, hands the job straight back, and never says the
    // relationship the trade is made of. A live drive read it back.
    const cue = baseTenCheckCue(item, tradedColumns(item.problem.start, 1));
    expect(cue).toContain('Code computed solved=false');
    expect(spokenSpansOf(cue)[0]).toBe(
      'My turn: one hundred-flat breaks into ten ten-sticks. '
      + `Your turn. ${item.actionContract.instruction}`,
    );
  });

  it('an untouched mat is not solved', () => {
    expect(baseTenCheckCue(item, item.problem.start)).toContain('Code computed solved=false');
  });
});

// ---------------------------------------------------------------------------
// 6. ⭐ The how-to-play is opening-only (add-di-loop defect 13)
// ---------------------------------------------------------------------------

describe('baseTenScript · the protocol is established once, not recited', () => {
  it('the opening cue carries the lead-in and the ask', () => {
    const first = READ_ITEMS[0];
    const opening = spokenSpansOf(baseTenItemCue(first, { opening: true, howToPlay: true }))[0];
    expect(opening).toContain('Let us read the blocks together.');
    expect(opening).toContain(first.actionContract.instruction);
  });

  it('⭐ howToPlay is IGNORED — every consecutive pair changes action by construction', () => {
    // The runner re-speaks the protocol when the action changes. Steps alternate
    // count/worth/count/worth, so honouring that flag would recite the lead-in
    // on every single item of the run.
    for (let index = 1; index < READ_ITEMS.length; index++) {
      expect(READ_ITEMS[index - 1].action).not.toBe(READ_ITEMS[index].action);
    }
    const withFlag = baseTenItemCue(READ_ITEMS[1], { opening: false, howToPlay: true });
    const without = baseTenItemCue(READ_ITEMS[1], { opening: false, howToPlay: false });
    expect(withFlag).toBe(without);
    expect(withFlag).not.toContain('Let us read the blocks together.');
  });

  it('each mode has its own lead-in, and regroup names the order of the turns', () => {
    const opening = spokenSpansOf(
      baseTenItemCue(REGROUP_ITEMS[0], { opening: true, howToPlay: false }),
    )[0];
    expect(opening).toContain('You tell me what will happen first, and then you make it happen.');
  });
});

// ---------------------------------------------------------------------------
// 7. Move-on and completion
// ---------------------------------------------------------------------------

describe('baseTenScript · handing over to the next item', () => {
  it('moveOn carries the NEXT ask and the next judging contract', () => {
    const cue = baseTenMoveOnCue(READ_ITEMS[0], READ_ITEMS[1], { opening: false, howToPlay: false });
    expect(spokenSpansOf(cue)[0]).toBe(`Let us keep going. ${READ_ITEMS[1].actionContract.instruction}`);
    expect(cue).toContain('Private expected value:');
  });

  it('moveOn with no next item completes the run, and the sign-off states no number', () => {
    expect(baseTenMoveOnCue(READ_ITEMS[0], null, { opening: false, howToPlay: false }))
      .toBe(baseTenCompleteCue('read_blocks'));
    expect(baseTenCompleteCue()).toContain('[BT_COMPLETE]');
    expect(spokenSpansOf(baseTenCompleteCue())[0]).not.toMatch(/\d/);
  });

  it('⭐ the sign-off names the work the child actually did', () => {
    // A regroup session was being told "You read the blocks and said what they
    // are worth" — heard on the 2026-09-12 drive, and invisible to every gate.
    expect(spokenSpansOf(baseTenCompleteCue('regroup'))[0])
      .toBe('You said what would happen and then you made every trade. Nice work with the mat!');
    expect(spokenSpansOf(baseTenCompleteCue('read_blocks'))[0])
      .toBe('You read the blocks and said what they are worth. Nice work with the mat!');
    // …and the pack's own surface picks it up from the items it was built with.
    expect(baseTenPackBase(REGROUP_ITEMS).completeCue())
      .toBe(baseTenCompleteCue('regroup'));
    expect(baseTenMoveOnCue(REGROUP_ITEMS.at(-1)!, null, { opening: false, howToPlay: false }))
      .toBe(baseTenCompleteCue('regroup'));
  });
});

// ---------------------------------------------------------------------------
// 8. Pack gates, in the real session shape
// ---------------------------------------------------------------------------

describe('baseTenScript · pack gates', () => {
  it.each([
    ['read_blocks', READ_ITEMS],
    ['regroup', REGROUP_ITEMS],
  ] as const)('%s passes every structural gate', (_mode, items) => {
    expect(items.length).toBeGreaterThan(2);
    expect(checkPackGates(baseTenPackBase(items))).toEqual([]);
  });

  it('the pack surface is ONE source — the stage and the drive spread the same cues', () => {
    const pack = baseTenPackBase(READ_ITEMS);
    const item = READ_ITEMS[0];
    expect(pack.primitiveType).toBe('base-ten-blocks');
    expect(pack.itemCue(item, { opening: false, howToPlay: false }))
      .toBe(baseTenItemCue(item, { opening: false, howToPlay: false }, item.problem.start));
    expect(pack.pronounceCue!(item)).toBe(baseTenHearCue(item, item.problem.start));
  });

  it('a columns function threads the LIVE mat into every cue', () => {
    const item = REGROUP_ITEMS[0];
    const traded = tradedColumns(item.problem.start, item.problem.place);
    const pack = baseTenPackBase(REGROUP_ITEMS, () => traded);
    expect(pack.itemCue(item, { opening: false, howToPlay: false }))
      .toBe(baseTenItemCue(item, { opening: false, howToPlay: false }, traded));
  });
});

// ---------------------------------------------------------------------------
// 9. The catalog's side of the wire
// ---------------------------------------------------------------------------

describe('baseTenScript · the catalog agrees with the pack', () => {
  const entry = MATH_CATALOG.find((definition) => definition.id === 'base-ten-blocks')!;

  it('BOTH judged modes declare the judged transport, and the click modes do not', () => {
    // A STAGED port: build_number and the operate modes keep the click era's
    // transport, which is exactly what audioInputByMode exists to express.
    expect(entry.audioInputByMode).toEqual({
      read_blocks: JUDGED_AUDIO_INPUT,
      regroup: JUDGED_AUDIO_INPUT,
    });
    expect(entry.audioInput).toBeUndefined();
  });

  it.each(['read_blocks', 'regroup'] as const)(
    '%s: contextKeys, template keys and sentinel discipline all hold',
    (mode) => {
      const items = build(mode, 247);
      // `audioInput` is resolved per mode on this entry; the shim lets the
      // shared checker run the rest of the contract over it.
      const shimmed = { ...entry, audioInput: entry.audioInputByMode![mode] };
      expect(checkDiCatalogEntry(shimmed, baseTenPackBase(items), items[0])).toEqual([]);
    },
  );

  it('the judged eval modes are PROJECTED from baseTenModes, never re-typed', () => {
    const declared = (entry.evalModes ?? []).map((definition) => definition.evalMode);
    for (const definition of BASE_TEN_DI_MODES) expect(declared).toContain(definition.evalMode);
    // …and the click era's modes are still served.
    expect(declared).toContain('build_number');
    expect(declared).toContain('operate');
  });
});

// ---------------------------------------------------------------------------
// 10. Harness answer material
// ---------------------------------------------------------------------------

describe('baseTenScript · drive-harness answers', () => {
  it('every voice item offers three DISTINCT answers', () => {
    const items = [
      ...build('read_blocks', 247, 35, 1234, 906),
      ...build('regroup', 247, 35, 1234, 916),
    ];
    const voice = items.filter((item) => item.answerKind === 'voice');
    expect(voice.length).toBeGreaterThan(6);
    for (const item of voice) {
      const answers = baseTenHarnessAnswers(item);
      expect(new Set([answers.correct, answers.plainWrong, answers.signatureWrong!.text]).size)
        .toBe(3);
      expect(answers.signatureWrong!.why).not.toBe('');
    }
  });

  it('the correct answer is the one the contract privately expects', () => {
    const items = build('read_blocks', 247);
    expect(baseTenHarnessAnswers(items[0]).correct).toBe('two');
    expect(baseTenHarnessAnswers(items[0]).signatureWrong!.text).toBe('two hundred');
    expect(baseTenHarnessAnswers(items[1]).correct).toBe('two hundred');
    expect(baseTenHarnessAnswers(items[1]).signatureWrong!.text).toBe('two');
  });

  it('the predict signature wrong is "ten", and it is never also the right answer', () => {
    for (const target of [247, 35, 1234, 916, 111]) {
      const items = build('regroup', target);
      expect(items.length).toBeGreaterThan(0);
      const answers = baseTenHarnessAnswers(items[0]);
      expect(answers.signatureWrong!.text).toBe('ten');
      expect(answers.correct).not.toBe('ten');
    }
  });

  it('⭐ no leak token is already sitting in the ask it guards', () => {
    // The harness scans what the tutor SPOKE for these tokens with a word
    // boundary, so a token the scripted ask carries by construction would fire
    // on every clean run. The one real collision — "ten" inside "ten-sticks" on
    // a mat holding a single ten-stick — is subtracted by `leakExemptSpan`.
    for (const item of [...READ_ITEMS, ...REGROUP_ITEMS]) {
      const answers = baseTenHarnessAnswers(item);
      const exempt = [answers.leakExemptSpan ?? []].flat();
      let scanned = askOf(item).toLowerCase().replace(/[^a-z0-9]+/g, ' ');
      for (const span of exempt) {
        scanned = scanned.split(span.toLowerCase().replace(/[^a-z0-9]+/g, ' ')).join(' ');
      }
      for (const token of answers.leakTokens) {
        const normalized = token.toLowerCase().replace(/[^a-z0-9]+/g, ' ');
        expect(scanned).not.toMatch(new RegExp(`\b${normalized}\b`));
      }
    }
  });

  it('⭐ the one-ten-stick mat is the collision the exempt span exists for', () => {
    const worth = stepNamed(build('read_blocks', 13), 'worth');
    const answers = baseTenHarnessAnswers(worth);
    expect(answers.correct).toBe('ten');
    // The answer word is inside the block NAME in the ask, and nowhere else.
    expect(worth.actionContract.instruction).toContain('ten-sticks');
    expect(answers.leakExemptSpan).toBe('ten-sticks');
  });

  it('a hands item commits a PLACE, and the wrong one is another block on the mat', () => {
    const trade = stepNamed(build('regroup', 247), 'trade');
    const answers = baseTenHarnessAnswers(trade);
    expect(answers.placed).toEqual({ correct: 2, wrong: 1 });
    expect(answers.signatureWrong).toBeUndefined();
    expect(answers.leakTokens).toEqual([]);
  });

  it('a mat with only ONE tradeable block falls back to the untradeable ones column', () => {
    const trade = stepNamed(build('regroup', 35), 'trade');
    expect(wrongTradePlace(trade.problem)).toBe(0);
    // Tapping it changes nothing, which is also not the trade that was asked for.
    expect(baseTenCheckCue(trade, tradedColumns(trade.problem.start, 0)))
      .toContain('Code computed solved=false');
  });

  it('the affirmation quotes the correct answer back verbatim', () => {
    for (const item of READ_ITEMS.filter((candidate) => candidate.answerKind === 'voice')) {
      expect(affirmOf(item)).toContain(baseTenHarnessAnswers(item).correct);
    }
  });
});

// ---------------------------------------------------------------------------
// 11. The model's arithmetic, which the scene and the verdict both read
// ---------------------------------------------------------------------------

describe('baseTenModel · the shared arithmetic', () => {
  it('standardColumns is ones-first', () => {
    expect(standardColumns(247)).toEqual([7, 4, 2]);
    expect(standardColumns(1000)).toEqual([0, 0, 0, 1]);
  });

  it('a trade preserves the value of the mat', () => {
    const problem = btProblem(247, 'regroup', 0)!;
    const traded = tradedColumns(problem.start, problem.place);
    const value = (columns: readonly number[]) =>
      columns.reduce((sum, count, place) => sum + count * 10 ** place, 0);
    expect(value(traded)).toBe(247);
    expect(traded).not.toEqual(problem.start);
  });

  it('the predicted count is the starting count plus the ten the trade creates', () => {
    const problem = btProblem(247, 'regroup', 0)!;
    expect(startingLowerCount(problem)).toBe(4);
    expect(predictedCount(problem)).toBe(14);
  });
});
