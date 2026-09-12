import { describe, expect, it } from 'vitest';
import { validateJudgedScriptPack } from '../../../hooks/judgedScriptContract';
import { selectBalanceScaleChallenges } from '../../../service/math/gemini-balance-scale';
import { enterWorkshopStage, groupCounts, initialWorkshopBoard, isHands, modelStage, moveWorkshopUnit, placeWorkshopWeight,
  scene, signature, stageSolved, STAGES, workshopBalance, workshopProblem, WORKSHOP_MODES, type WorkshopProblem } from './balanceWorkshopModel';
import { workshopAsk, workshopCheckCue, workshopCompleteCue, workshopItemCue, workshopItems, workshopJudging, workshopMoveCue } from './balanceWorkshopScript';

const problem = (mode: WorkshopProblem['mode'], target = 4, known = 3, parcels = 2): WorkshopProblem => ({
  id: 'test', mode, target, known, parcels, total: target * parcels + known, reverse: false,
});
const spoken = (cue: string) => cue.match(/Say exactly: "([^"]*)"/)?.[1] ?? '';

describe('weight workshop conservation', () => {
  it('lets students separate either side first, restore it, and only complete an equal removal', () => {
    const p = problem('two_step_intro');
    const initial = initialWorkshopBoard(p);
    const leftOnly = { ...initial, leftAside: true };
    expect(workshopBalance(p, leftOnly)).toBe('right-heavy');
    expect(stageSolved(p, 'separate', leftOnly)).toBe(false);
    let board = leftOnly;
    for (let index = 0; index < p.known; index++) board = moveWorkshopUnit(p, board, index, -2, 'separate')!;
    expect(stageSolved(p, 'separate', board)).toBe(true);
    expect(workshopBalance(p, board)).toBe('balanced');
    expect(board.units).toHaveLength(p.total);
    expect(initial.units.every((place) => place === -1)).toBe(true);
    const over = moveWorkshopUnit(p, board, p.known, -2, 'separate')!;
    expect(workshopBalance(p, over)).toBe('left-heavy');
    expect(stageSolved(p, 'separate', over)).toBe(false);
    expect(stageSolved(p, 'separate', moveWorkshopUnit(p, over, p.known, -1, 'separate')!)).toBe(true);
  });
  it('allows unequal groups without losing units and refuses to share set-aside units', () => {
    const p = problem('two_step_intro');
    let board = modelStage(p, 'separate', initialWorkshopBoard(p));
    expect(moveWorkshopUnit(p, board, 0, 0, 'share')).toBeNull();
    expect(moveWorkshopUnit(p, board, p.known, p.parcels, 'share')).toBeNull();
    expect(moveWorkshopUnit(p, board, -1, 0, 'share')).toBeNull();
    expect(moveWorkshopUnit(p, board, p.known, 0, 'remaining')).toBeNull();
    for (let i = p.known; i < p.total; i++) board = moveWorkshopUnit(p, board, i, 0, 'share')!;
    expect(groupCounts(p, board)).toEqual([8, 0]);
    expect(stageSolved(p, 'share', board)).toBe(false);
    for (let i = p.known + p.target; i < p.total; i++) board = moveWorkshopUnit(p, board, i, 1, 'share')!;
    expect(groupCounts(p, board)).toEqual([4, 4]);
    expect(stageSolved(p, 'share', board)).toBe(true);
    expect(board.units).toHaveLength(11);
    expect(board.units.filter((place) => place === -2)).toHaveLength(3);
  });
  it('checks a missing part against the full known load, including overshoots', () => {
    const p = problem('one_step', 7, 5, 1);
    const start = initialWorkshopBoard(p);
    expect(workshopBalance(p, start)).toBe('right-heavy');
    const board = placeWorkshopWeight(placeWorkshopWeight(start, 5, 0)!, 2, 1)!;
    expect(workshopBalance(p, board)).toBe('balanced');
    expect(stageSolved(p, 'complete', board)).toBe(true);
    expect(workshopBalance(p, placeWorkshopWeight(board, 1, 2)!)).toBe('left-heavy');
  });
  it('requires a different multiset, not the same blocks reordered or renamed', () => {
    const p = problem('equality_hard', 8, 0, 1);
    const first = { ...initialWorkshopBoard(p), weights: [{ id: 0, value: 5 }, { id: 1, value: 3 }] };
    const next = enterWorkshopStage(p, 'recompose', first).board;
    expect(next.first).toEqual(first.weights); expect(next.weights).toEqual([]);
    const same = { ...next, weights: [{ id: 6, value: 3 }, { id: 7, value: 5 }] };
    expect(stageSolved(p, 'recompose', same)).toBe(false);
    const different = { ...next, weights: [{ id: 8, value: 3 }, { id: 9, value: 3 }, { id: 10, value: 2 }] };
    expect(stageSolved(p, 'recompose', different)).toBe(true);
    expect(enterWorkshopStage(p, 'recompose', different).board).toEqual(different);
    expect(signature(modelStage(p, 'recompose', next).weights)).not.toBe(signature(first.weights));
  });
  it('keeps every generated mode solvable, with valid numeric classes and explicit modeled fallbacks', () => {
    for (const mode of WORKSHOP_MODES) for (let run = 0; run < 30; run++) {
      const problems = selectBalanceScaleChallenges(mode).map(workshopProblem);
      const items = workshopItems(problems);
      expect(validateJudgedScriptPack({ primitiveType: 'balance-scale', activityLine: 'weights', items,
        itemCue: workshopItemCue, moveOnCue: (item, next) => workshopMoveCue(item, next, initialWorkshopBoard(next?.problem ?? item.problem)),
        completeCue: workshopCompleteCue, contextFor: () => ({}) })).toEqual([]);
      for (const p of problems) {
        let board = initialWorkshopBoard(p);
        for (const stage of STAGES[mode]) {
          board = enterWorkshopStage(p, stage, board).board;
          if (isHands(stage)) { board = modelStage(p, stage, board); expect(stageSolved(p, stage, board)).toBe(true); }
        }
      }
    }
  });
});

describe('spoken workshop contract', () => {
  it('withholds parcel values in hand prompts and separates number interpretation from explanation', () => {
    const p = problem('two_step', 7, 3, 2);
    const items = workshopItems([p]);
    for (const item of items.filter((entry) => isHands(entry.step))) {
      expect(spoken(workshopItemCue(item, { opening: true }))).not.toMatch(/\b7\b|\bseven\b/);
      expect(spoken(workshopCheckCue(item, modelStage(p, item.step, initialWorkshopBoard(p))))).not.toMatch(/\b7\b|\bseven\b/);
    }
    expect(scene(p, initialWorkshopBoard(p))).not.toContain('target');
    expect(workshopJudging(items.find((item) => item.step === 'infer')!)).toContain('Wait for fresh speech');
    expect(workshopJudging(items.find((item) => item.step === 'explain')!)).toContain('Reject a bare number');
  });
  it('asks reverse rounds to demonstrate the operation without supplying its result', () => {
    const p = { ...problem('two_step', 5, 4, 3), reverse: true };
    expect(workshopAsk(p, 'separate')).toContain('subtracting 4 from both sides');
    expect(workshopAsk(p, 'share')).toContain('dividing both sides by 3');
    expect(workshopAsk(p, 'share')).not.toMatch(/\b5\b/);
  });
  it('models a capped separation before asking about the remaining weight', () => {
    const p = problem('two_step_intro');
    const items = workshopItems([p]);
    const prepared = enterWorkshopStage(p, 'remaining', initialWorkshopBoard(p));
    expect(prepared.modeled).toBe(true);
    expect(stageSolved(p, 'separate', prepared.board)).toBe(true);
    expect(spoken(workshopMoveCue(items[0], items[1], initialWorkshopBoard(p)))).toContain('I have shown this step');
  });
});
