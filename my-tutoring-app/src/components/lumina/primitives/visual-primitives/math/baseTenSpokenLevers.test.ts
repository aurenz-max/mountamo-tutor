/**
 * The base-ten-blocks spoken-mat levers (handoff 21 M1, spoken slice): which lever answers which miss, each lever's
 * leak rule, and the practice builders, on the saved generated payloads and on every number the modes can ask.
 */
import { readFileSync } from 'fs';
import { join } from 'path';
import { describe, expect, it } from 'vitest';
import { nextLever } from '../../../components/live-activity/runtime/observerLever';
import { getComponentById } from '../../../service/manifest/catalog';
import { btProblem, predictedCount, readCount, startingLowerCount, tradeablePlaces, type BtMode, type BtProblem } from './baseTenModel';
import { baseTenItems, itemsFromChallenges, type BaseTenItem } from './baseTenScript';
import { baseTenSpokenMisses, spokenAnswer } from './baseTenWorkspace';
import { DIM_LEVER, FEWER_LEVER, FIVES_LEVER, GLOW_LEVER, MODEL_LEVER, SMALL_START_LEVER, WORTH_LEVER, baseTenSpokenLevers,
  fewerBlocksProblem, smallStartProblem, spokenLeverFacts, spokenPracticeItem, tradeModel, worthKey } from './baseTenSpokenLevers';

const payload = (mode: BtMode) => JSON.parse(readFileSync(join(__dirname,
  `../../../components/live-activity/runtime/testing/w1-payloads/base-ten-blocks.${mode}.json`), 'utf8')).data.challenges;
const itemsOf = (mode: BtMode, targets: number[]) => itemsFromChallenges(targets.map(targetNumber => ({ type: mode, targetNumber })), mode);
const each = (mode: BtMode, targets: number[]) => targets.flatMap(t => itemsOf(mode, [t]));
const step = (mode: BtMode, target: number, key: string) => itemsOf(mode, [target]).find(i => i.step === key)!;
const problemsOf = (items: readonly BaseTenItem[]) => Array.from(new Map(items.map(i => [i.problem.id, i.problem])).values());
const ALL: number[] = Array.from({ length: 990 }, (_, i) => i + 10);
const standalone = (text: string, n: number) => new RegExp(`(?<![0-9])${n}(?![0-9])`).test(text);

describe('which lever answers which miss', () => {
  it.each([
    ['count', 'said_value', WORTH_LEVER], ['count', 'other_block_count', DIM_LEVER], ['count', 'said_total', DIM_LEVER],
    ['count', 'one_short', FIVES_LEVER], ['count', 'short_by_more', FEWER_LEVER],
    ['worth', 'said_count', WORTH_LEVER], ['worth', 'one_block_off', FIVES_LEVER], ['worth', 'over_by_more', FEWER_LEVER],
  ])('read_blocks 76, %s step, after %s: %s', (key, miss, lever) => {
    const item = step('read_blocks', 76, key);
    expect(nextLever(baseTenSpokenLevers(item, [], [item.problem]), miss)).toBe(lever);
  });
  it.each([
    ['predict', 'said_ten', MODEL_LEVER], ['predict', 'said_start', MODEL_LEVER], ['predict', 'one_over', MODEL_LEVER],
    ['predict', 'short_by_more', SMALL_START_LEVER], ['trade', 'other_block', MODEL_LEVER], ['trade', 'traded_twice', MODEL_LEVER],
  ])('regroup 25, %s step, after %s: %s', (key, miss, lever) => {
    const item = step('regroup', 25, key);
    expect(nextLever(baseTenSpokenLevers(item, [], [item.problem]), miss)).toBe(lever);
  });
  it('with the model pulled, "ten" again gets the glow; help-only never opens simplify', () => {
    const item = step('regroup', 25, 'predict');
    expect(nextLever(baseTenSpokenLevers(item, [MODEL_LEVER], [item.problem]), 'said_ten')).toBe(GLOW_LEVER);
    expect(nextLever(baseTenSpokenLevers(item, [MODEL_LEVER, GLOW_LEVER], [item.problem]), 'short_by_more', 'help')).toBeNull();
  });
  it("every lever's answers are misses the catalog declares for its mode, and the rest are declared unanswered", () => {
    const entry = getComponentById('base-ten-blocks')!.teachingWorkspace!;
    for (const mode of ['read_blocks', 'regroup'] as const) {
      const answered = new Set(each(mode, ALL).flatMap(i => baseTenSpokenLevers(i, [], problemsOf([i])).flatMap(l => l.answers ?? [])));
      const declared = entry.misses![mode];
      answered.forEach(m => expect(declared).toContain(m));
      expect(declared.filter(m => !answered.has(m)).sort()).toEqual([...(entry.unanswered?.[mode] ?? [])].sort());
    }
  });
});

describe('leak rules', () => {
  it('the worth key is refused where one block is the answer, and otherwise is never the step\'s answer', () => {
    expect(worthKey(step('read_blocks', 14, 'worth'))).toBeNull();
    for (const item of each('read_blocks', ALL)) {
      const key = worthKey(item);
      if (key) expect(key.worth).not.toBe(spokenAnswer(item));
    }
  });
  it("the model trade starts from a count no session problem has, so its result is no session prediction", () => {
    for (const mode of ['regroup'] as const) {
      const items = itemsOf(mode, payload(mode).map((c: { targetNumber: number }) => c.targetNumber));
      const problems = problemsOf(items);
      for (const item of items) {
        const model = tradeModel(item, problems)!;
        expect(problems.map(startingLowerCount)).not.toContain(model.before);
        expect(problems.map(predictedCount)).not.toContain(model.after);
        expect(model.place).toBe(item.problem.place);
      }
    }
  });
  it('with every lever pulled, the scene fact never states the step\'s answer (payloads and every number)', () => {
    for (const mode of ['read_blocks', 'regroup'] as const) {
      const sessions = [itemsOf(mode, payload(mode).map((c: { targetNumber: number }) => c.targetNumber)),
        ...ALL.map(t => itemsOf(mode, [t]))];
      for (const items of sessions) {
        const problems = problemsOf(items);
        for (const item of items) {
          const all = baseTenSpokenLevers(item, [], problems).map(l => l.id);
          const fact = spokenLeverFacts(item, all, problems);
          if (item.answerKind !== 'gesture') expect(standalone(fact, spokenAnswer(item)), `${item.id} ${fact}`).toBe(false);
        }
      }
    }
  });
  it('group_fives only from six blocks and dim_others only when another size is on the mat', () => {
    const ids = (target: number) => baseTenSpokenLevers(step('read_blocks', target, 'count'), [], []).map(l => l.id);
    expect(ids(40)).toEqual([WORTH_LEVER, FEWER_LEVER]);
    expect(ids(70)).toContain(FIVES_LEVER);
    expect(ids(47)).toContain(DIM_LEVER);
  });
});

describe('practice builders', () => {
  const check = (mode: BtMode, build: (i: BaseTenItem, s: readonly BtProblem[]) => BtProblem | null, lever: string) => {
    let built = 0;
    for (const item of each(mode, ALL)) {
      const session = [item.problem, btProblem(item.problem.target + 11, mode, 1)].filter((p): p is BtProblem => !!p);
      const p = build(item, session);
      if (!p) continue;
      built++;
      // R3: never the learner's own item or another session number, and a new answer.
      expect(session.map(s => s.target)).not.toContain(p.target);
      // R2: the same mode, place and digit count, still askable.
      expect([p.mode, p.place, String(p.target).length]).toEqual([mode, item.problem.place, String(item.problem.target).length]);
      const practice = spokenPracticeItem(item, lever, session)!;
      expect(practice).toMatchObject({ id: `${item.id}~simpler`, step: item.step });
      expect(spokenAnswer(practice)).not.toBe(spokenAnswer(item));
      expect(baseTenSpokenMisses(practice).length).toBeGreaterThan(0);
    }
    return built;
  };
  it('fewer_blocks: about half as many of the asked block, same step', () => {
    expect(check('read_blocks', fewerBlocksProblem, FEWER_LEVER)).toBeGreaterThan(300);
    for (const item of each('read_blocks', ALL)) {
      const p = fewerBlocksProblem(item, [item.problem]);
      if (p) expect(readCount(p)).toBeLessThanOrEqual(Math.ceil(readCount(item.problem) / 2));
    }
    expect(fewerBlocksProblem(step('read_blocks', 20, 'count'), [])).toBeNull();
  });
  it('small_start: one or two already in the receiving column, predict step only', () => {
    expect(check('regroup', smallStartProblem, SMALL_START_LEVER)).toBeGreaterThan(200);
    for (const item of each('regroup', ALL)) {
      const p = smallStartProblem(item, [item.problem]);
      if (!p) continue;
      expect([1, 2]).toContain(startingLowerCount(p));
      expect(tradeablePlaces(p.target)).toContain(p.place);
    }
    expect(smallStartProblem(step('regroup', 25, 'trade'), [])).toBeNull();
    expect(smallStartProblem(step('regroup', 22, 'predict'), [])).toBeNull();
  });
  it('the practice item is built by the pack\'s own plan', () => {
    const item = step('regroup', 47, 'predict');
    const practice = spokenPracticeItem(item, SMALL_START_LEVER, [item.problem])!;
    expect(practice.actionContract.instruction).toBe(baseTenItems([practice.problem]).find(i => i.step === 'predict')!.actionContract.instruction);
    expect(practice.actionContract.instruction).toMatch(/You have 1 ones cube\./);
  });
});
