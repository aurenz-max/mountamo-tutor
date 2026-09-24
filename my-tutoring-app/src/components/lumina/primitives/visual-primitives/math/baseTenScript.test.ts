/**
 * baseTenScript — base-ten-blocks' spoken-mat items, pinned where the pedagogy
 * lives. Pure: no jsdom, no live session. The mounted spoken mat has its own
 * suite on the teaching workspace (`BaseTenBlocks.workspace.test.tsx`); the
 * scripted runner's cue and judging-contract tests were deleted with that path.
 *
 * What it locks in:
 *  1. BUILD GATES. A number that cannot carry an honest ask is DROPPED, never
 *     repaired into a different one — out of band, no place above the ones,
 *     and ⭐ on `regroup` an EMPTY RECEIVING PLACE, which would make the ask state
 *     its own answer and make "ten" both the expected answer and the signature error.
 *  2. ITEM SHAPE. One problem becomes one item per plan step, the session is
 *     selected in whole problems, and the subject place rotates.
 *  3. ANSWER LEAK, in the ASK. On `read_blocks` the counts ARE the answers, so the
 *     ask never states a count, a value or the composed number.
 *  4. THE HANDS VERDICT is computed in code.
 *  5. THE CATALOG'S SIDE: per-mode audio transport and projected eval modes.
 *  6. HARNESS ANSWERS the workspace journey reads.
 */
import { describe, expect, it } from 'vitest';
import {
  MAX_SESSION_ITEMS,
  MAX_TARGET,
  MIN_TARGET,
  baseTenHarnessAnswers,
  baseTenItems,
  isAskableTarget,
  isInBandTarget,
  itemsFromChallenges,
  problemsFromChallenges,
  stepsOfProblem,
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
  tradeSolved,
  tradedColumns,
  wordFor,
  type BtMode,
} from './baseTenModel';
import { BASE_TEN_DI_MODES } from './baseTenModes';
import { JUDGED_AUDIO_INPUT } from '../../../hooks/judgedScriptContract';
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

/** The spoken ask the workspace assigns (baseTenModes.ts owns the wording). */
const askOf = (item: BaseTenItem) => item.actionContract.instruction;

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
// 3. ⭐ Answer leak
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

  it('⭐ the composed number never appears in an ask', () => {
    const items = build('read_blocks', 247);
    for (const item of items) expect(askOf(item)).not.toContain('247');
  });

  it('regroup: the ask states the STARTING mat so the answer is an inference', () => {
    const ask = askOf(stepNamed(build('regroup', 247), 'predict'));
    expect(ask).toContain('You have 4 ten-sticks.');
    expect(ask).toContain('trade one hundred-flat for ten ten-sticks');
    // The predicted count is what the child must produce, so it is absent.
    expect(ask).not.toContain('14');
    expect(ask).not.toContain('fourteen');
  });
});

// ---------------------------------------------------------------------------
// 4. The hands verdict — computed in code
// ---------------------------------------------------------------------------

describe('baseTenModel · the hands verdict is computed in code', () => {
  const item = stepNamed(build('regroup', 247), 'trade');

  it('only the asked-for trade is solved', () => {
    expect(tradeSolved(item.problem, tradedColumns(item.problem.start, item.problem.place))).toBe(true);
    expect(tradeSolved(item.problem, tradedColumns(item.problem.start, 1))).toBe(false);
    expect(tradeSolved(item.problem, item.problem.start)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 5. The catalog's side of the wire
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

  it('the judged eval modes are PROJECTED from baseTenModes, never re-typed', () => {
    const declared = (entry.evalModes ?? []).map((definition) => definition.evalMode);
    for (const definition of BASE_TEN_DI_MODES) expect(declared).toContain(definition.evalMode);
    // …and the click era's modes are still served.
    expect(declared).toContain('build_number');
    expect(declared).toContain('operate');
  });
});

// ---------------------------------------------------------------------------
// 6. Harness answer material
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
    // The journey scans what the tutor SPOKE for these tokens with a word
    // boundary, so a token the ask carries by construction would fire on every
    // clean run. The one real collision — "ten" inside "ten-sticks" on
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
        // `\\b` in the template: a bare `\b` is a backspace, and the scan matched nothing (09-23).
        expect(scanned).not.toMatch(new RegExp(`\\b${normalized}\\b`));
      }
    }
  });

  it('⭐ the one-ten-stick mat is the collision the exempt span exists for', () => {
    const worth = stepNamed(build('read_blocks', 13), 'worth');
    const answers = baseTenHarnessAnswers(worth);
    expect(answers.correct).toBe('ten');
    // The answer word is inside the block NAME in the ask, and nowhere else.
    expect(worth.actionContract.instruction).toContain('ten-stick');
    expect(answers.leakExemptSpan).toBe('ten-stick');
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
    expect(tradeSolved(trade.problem, tradedColumns(trade.problem.start, 0))).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 7. The model's arithmetic, which the scene and the verdict both read
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
