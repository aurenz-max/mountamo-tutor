import { describe, expect, it } from 'vitest';
import { evidenceAsk, readEvidence, surfaceGap, unsupportedAct, type EvidenceSpec } from './evidence';
import { buildSurfaceLevers, readDraft } from './itemLoop';
import { solverPrompt } from './look';
import { describeSurfaceWork, surfaceScene } from './surfaceScene';
import { answerReady, gradeAnswer, itemErrors, makeSolutions, makeWays, missHint, rightAnswer, shortcutChecks, surfaceTaps, wrongAnswer } from './surfaces';

const coin = (id: string, name: string) => ({ id, display: { kind: 'coins', coins: [name] } });
const tray = (prompt: string, goal: Record<string, number>, pieces: Array<[string, string]>, extra: Record<string, unknown> = {}) =>
  readDraft({ tier: 'medium', surface: 'make', prompt, goal, options: pieces.map(([id, name]) => coin(id, name)), ...extra }, 'm-1', 3);

// The tray an author built out of categorize on 2026-11-09: its fixed key named c1 and marked the other dime wrong.
const twenty = () => tray('Make 20¢ with exactly 3 coins.', { total: 20, count: 3 }, [['c1', 'dime'], ['c4', 'dime'], ['c2', 'nickel'], ['c3', 'nickel'], ['c5', 'penny']]);

describe('make: a goal over the pieces on the tray', () => {
  it('takes any set that meets the goal, so either dime is right', () => {
    const { item } = twenty();
    expect(itemErrors(item)).toEqual([]);
    expect(gradeAnswer(item, { made: ['c1', 'c2', 'c3'] })).toEqual({ correct: true });
    expect(gradeAnswer(item, { made: ['c4', 'c2', 'c3'] })).toEqual({ correct: true });
    expect(makeSolutions(item)).toHaveLength(2);
    expect(makeWays(item)).toBe(1);
  });

  it('names the part of the goal a wrong tray misses, without giving a set away', () => {
    const { item } = twenty();
    expect(gradeAnswer(item, { made: ['c1', 'c4'] })).toEqual({ correct: false, miss: 'off_goal' });
    expect(missHint(item, { made: ['c1', 'c4'] })).toMatch(/how many/);
    expect(missHint(item, { made: ['c1', 'c2', 'c5'] })).toMatch(/come to/);
    expect(answerReady(item, { made: [] })).toBe(false);
  });

  it('computes the key: the author writes none, and a stored key that misses the goal is refused', () => {
    const { item } = tray('Make 20¢ with exactly 3 coins.', { total: 20, count: 3 }, [['c1', 'dime'], ['c4', 'dime'], ['c2', 'nickel'], ['c3', 'nickel'], ['c5', 'penny']], { key: ['c5'] });
    expect(gradeAnswer(item, rightAnswer(item)).correct).toBe(true);
    expect(itemErrors({ ...item, key: ['c1', 'c4'] }).join()).toMatch(/stored key/);
  });

  it('plays the harness: the right taps solve it and the wrong ones do not', () => {
    const { item } = twenty();
    expect(gradeAnswer(item, wrongAnswer(item)).correct).toBe(false);
    expect(wrongAnswer(item).made!.length).toBeGreaterThan(0);
    expect(surfaceTaps(item, rightAnswer(item), 'Check')).toEqual([...(item.key as string[]).map(id => ({ type: 'touch', target: `card-${id}` })), { type: 'choose', label: 'Check' }]);
  });

  it('refuses a goal nothing reaches, a piece with no value and a goal with no numbers', () => {
    expect(itemErrors(tray('Make 3¢ with coins.', { total: 3 }, [['a', 'dime'], ['b', 'nickel'], ['c', 'nickel']]).item).join()).toMatch(/no set of these pieces/);
    const blank = readDraft({ surface: 'make', prompt: 'Make 10.', goal: { total: 10 }, options: [{ id: 'a', label: '4' }, { id: 'b', label: '6', value: 6 }, { id: 'c', label: '5', value: 5 }] }, 'm-2', 1);
    expect(itemErrors(blank.item).join()).toMatch(/piece a has no value/);
    expect(itemErrors(tray('Make some money.', {}, [['a', 'dime'], ['b', 'nickel'], ['c', 'nickel']]).item).join()).toMatch(/goal needs a total/);
  });

  it('takes number cards: a piece is worth its value when no display states one', () => {
    const { item } = readDraft({ surface: 'make', prompt: 'Pick two cards that make 10.', goal: { total: 10, count: 2 },
      options: [4, 6, 3, 7, 5].map(n => ({ id: `n${n}`, label: String(n), value: n })) }, 'm-3', 1);
    expect(itemErrors(item)).toEqual([]);
    expect(makeWays(item)).toBe(2);
    expect(gradeAnswer(item, { made: ['n3', 'n7'] }).correct).toBe(true);
  });

  it('blocks the shortcuts: every piece needed, one piece that is the total, a prompt that never says the goal', () => {
    expect(shortcutChecks(tray('Make 20¢ with coins.', { total: 20 }, [['a', 'dime'], ['b', 'nickel'], ['c', 'nickel']]).item).join()).toMatch(/every piece/);
    expect(shortcutChecks(tray('Make 10¢ with coins.', { total: 10 }, [['a', 'dime'], ['b', 'nickel'], ['c', 'nickel'], ['d', 'penny']]).item).join()).toMatch(/one piece alone/);
    expect(shortcutChecks(tray('Put the right coins on the tray.', { total: 20, count: 3 }, [['c1', 'dime'], ['c4', 'dime'], ['c2', 'nickel'], ['c3', 'nickel'], ['c5', 'penny']]).item).join()).toMatch(/never says the total.*never says how many/);
    expect(shortcutChecks(twenty().item)).toEqual([]);
    expect(shortcutChecks(tray('Make twenty cents with exactly three coins.', { total: 20, count: 3 }, [['c1', 'dime'], ['c4', 'dime'], ['c2', 'nickel'], ['c3', 'nickel'], ['c5', 'penny']]).item)).toEqual([]);
  });

  it('reaches every band from structure (I6)', () => {
    const easy = tray('Make 20¢ with coins.', { total: 20 }, [['a', 'dime'], ['b', 'dime'], ['c', 'nickel'], ['d', 'nickel']]).item;
    const hard = tray('Make 35¢ with exactly 5 coins.', { total: 35, count: 5 }, [['a', 'dime'], ['b', 'dime'], ['c', 'dime'], ['d', 'nickel'], ['e', 'nickel'], ['f', 'nickel'], ['g', 'quarter']]).item;
    expect([easy, twenty().item, hard].map(i => i.difficulty.band)).toEqual(['easy', 'medium', 'hard']);
    expect(hard.difficulty.reasons.join()).toMatch(/a total and a piece count/);
  });

  it('simplifies by taking pieces off the tray, and refuses a simplify that leaves no set or no choice', () => {
    const pieces: Array<[string, string]> = [['a', 'dime'], ['b', 'dime'], ['c', 'dime'], ['d', 'nickel'], ['e', 'nickel'], ['f', 'nickel'], ['g', 'quarter']];
    const d = (remove: string[]) => buildSurfaceLevers(tray('Make 35¢ with exactly 5 coins.', { total: 35, count: 5 }, pieces, { simplify: { says: 'Fewer coins to choose from.', remove_options: remove } }), 3);
    const ok = d(['g']);
    expect(ok.refused).toEqual([]);
    expect(gradeAnswer(ok.levers[0].item, rightAnswer(ok.levers[0].item)).correct).toBe(true);
    expect(d(['d', 'e']).refused.join()).toMatch(/no set of these pieces/);
    expect(d(['c', 'g']).refused.join()).toMatch(/every piece/);
  });

  it('tells the tutor what is on the tray and never the total or a set that works', () => {
    const { item } = twenty();
    const scene = surfaceScene(item, { answer: { made: ['c1'] }, tries: [], solved: false });
    expect(describeSurfaceWork(item, { made: [] })).toBe('nothing on the tray yet');
    expect(String(scene.facts.set)).toMatch(/on the tray: card \d/);
    expect(String(scene.facts.task)).toMatch(/more than one set can be right/);
    expect(JSON.stringify(scene.facts)).not.toContain(JSON.stringify(item.key));
  });
});

describe('the evidence a lesson must collect', () => {
  const build: EvidenceSpec = { act: 'build', on: 'an empty tray and bins of coins', credit: "the child's own set of coins totals the target and uses the stated number of coins", notCredit: 'picking a ready-made set of coins' };

  it('reads a spec and refuses one with no act or no credit condition', () => {
    expect(readEvidence({ ...build, observed: true })).toEqual({ ...build, observed: true });
    expect(readEvidence({ ...build, act: 'guess' })).toBeUndefined();
    expect(readEvidence({ act: 'build', on: 'a tray' })).toBeUndefined();
    expect(readEvidence(undefined)).toBeUndefined();
  });

  it('says in code when a surface cannot collect the act and another can', () => {
    expect(surfaceGap(build, 'choose')).toMatch(/Use make/);
    expect(surfaceGap(build, 'make')).toBeNull();
    expect(surfaceGap({ ...build, act: 'arrange' }, 'choose')).toMatch(/categorize or order/);
    expect(surfaceGap({ ...build, act: 'recognize' }, 'order')).toBeNull();
  });

  it('names an act the kit has no surface for as the kit\'s gap, never the author\'s', () => {
    // run-read left this list on 11-09: a set item on a `system` board collects it (`system.test.ts`).
    // `explain` has a surface since 11-13 (`teach`); `say` still has none.
    for (const act of ['say'] as const) {
      expect(unsupportedAct({ ...build, act })).toMatch(/no kit surface/);
      expect(surfaceGap({ ...build, act }, 'choose')).toBeNull();
    }
    expect(unsupportedAct(build)).toBeNull();
  });

  it('gives the blind reader the spec and the gap field, and never the key', () => {
    const { item } = twenty();
    const asked = solverPrompt(item, 'grade 2', true, build);
    expect(asked).toContain(build.credit);
    expect(asked).toContain('Does not count: picking a ready-made set of coins.');
    expect(asked).toContain(evidenceAsk(build).field);
    expect(asked).toMatch(/card numbers you would put on the tray/);
    expect(asked).not.toContain(JSON.stringify(item.key));
    expect(solverPrompt(item, 'grade 2', true)).not.toMatch(/evidence/);
  });
});
