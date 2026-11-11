import { describe, expect, it } from 'vitest';
import { displayErrors, displayHtml, displayRevealed, displayWords, readDisplay, type Display } from './displays';
import { evidencePlanAsk, surfaceGap, unsupportedAct } from './evidence';
import { difficultyOf, gradeAnswer, itemErrors, rightAnswer, shortcutChecks, surfaceTaps, wrongAnswer, type SurfaceItem } from './surfaces';
import { setControls, setWalk, setSteps } from './setting';
import { bindScene, systemValues, type SystemDisplay } from './system';

const scene = `<svg viewBox="0 0 200 120"><rect x="20" y="80" width="80" height="30" fill="#f59e0b"/><g data-bind="force" data-turn="-3" data-pivot="100,80"><rect x="100" y="76" width="80" height="8" fill="#334155"/></g><circle data-bind="push" data-move="2,0" cx="60" cy="70" r="5"/><text data-bind="lifts" data-show="yes" x="150" y="20">up</text><text data-bind="lifts" data-show="no" x="150" y="110">stuck</text></svg>`;
const digger: SystemDisplay = {
  kind: 'system', title: 'Digger arm', scene,
  parts: [{ id: 'push', label: 'Piston push', icon: '💪', value: 2, min: 1, max: 6 }, { id: 'arm', label: 'Pistons', value: 1, min: 1, max: 3 }, { id: 'rock', label: 'Rock', value: 12, unit: 'tons' }],
  rules: [{ id: 'force', label: 'Lift force', unit: 'tons', op: 'multiply', of: ['push', 'arm'] }, { id: 'lifts', label: 'Lifts the rock', op: 'at_least', of: ['force', 'rock'] }],
};
const item = (over: Partial<SurfaceItem> = {}): SurfaceItem => {
  const base: SurfaceItem = { id: 's1', surface: 'set', prompt: 'Make the digger arm lift the rock.', stimulus: [], options: [], board: digger, setGoal: { lifts: true }, key: '', tier: 'medium', difficulty: { band: 'easy', score: 0, reasons: [] }, ...over };
  return { ...base, difficulty: difficultyOf(base) };
};

describe('the system display: a model code runs', () => {
  it('works out every rule from the parts, in order', () => {
    expect(systemValues(digger)).toEqual({ push: 2, arm: 1, rock: 12, force: 2, lifts: false });
    expect(systemValues({ ...digger, parts: [{ ...digger.parts[0], value: 6 }, { ...digger.parts[1], value: 2 }, digger.parts[2]] })).toMatchObject({ force: 12, lifts: true });
  });

  it('hides the results until it is run, on the panel and in the scene', () => {
    const before = displayHtml(digger), after = displayHtml(displayRevealed(digger));
    expect(before).toContain('>?<');
    expect(before).not.toMatch(/>(Yes|No)</);
    expect(after).toMatch(/>No</);
    expect(after).toContain('>2 tons<');
    // A part moves the scene as soon as it changes; a result stays at rest and undrawn until the run.
    expect(before).toContain('transform="translate(4 0)"');
    expect(before).toContain('transform="rotate(0 100 80)"');
    expect(before.match(/display="none"/g)).toHaveLength(2);
    expect(after).toContain('transform="rotate(-6 100 80)"');
    expect(after.match(/display="none"/g)).toHaveLength(1);
  });

  it('keeps an element\'s own transform after the bound one', () => {
    expect(bindScene('<svg><g data-bind="a" data-move="1,2" transform="scale(2)"/></svg>', { a: 3 }, () => true)).toContain('transform="translate(3 6) scale(2)"');
  });

  it('says its amounts and rules in words, and its results only after a run', () => {
    expect(displayWords(digger)).toBe('a working model "Digger arm": Piston push 2, Pistons 1, Rock 12 tons. Lift force is Piston push times Pistons. Lifts the rock when Lift force is at least Rock. The results are hidden until it is run.');
    expect(displayWords(displayRevealed(digger))).toContain('(no)');
  });

  it('refuses a model code cannot run, with a sentence', () => {
    const bad = (over: Partial<SystemDisplay>) => displayErrors({ ...digger, ...over } as Display).join();
    expect(bad({ rules: [{ id: 'lifts', label: 'Lifts', op: 'at_least', of: ['force', 'rock'] }] })).toMatch(/uses "force"/);
    expect(bad({ rules: [{ id: 'a', label: 'A', op: 'at_least', of: ['push', 'rock'] }, { id: 'b', label: 'B', op: 'add', of: ['a', 1] }] })).toMatch(/earlier rule that gives a number/);
    expect(bad({ rules: [{ id: 'r', label: 'Ratio', op: 'divide', of: ['rock', 0] }] })).toMatch(/divides by zero/);
    expect(bad({ parts: [{ id: 'push', label: 'Push', value: 9, min: 1, max: 6 }] })).toMatch(/min below max/);
    expect(bad({ scene: scene.replace('data-bind="push"', 'data-bind="pump"') })).toMatch(/binds to "pump"/);
    expect(bad({ rules: [{ id: 'push', label: 'Twice', op: 'add', of: ['push', 1] }] })).toMatch(/its own id/);
  });

  it('reads the same after a tool writes it', () => {
    const read = readDisplay(JSON.parse(JSON.stringify(digger)))!;
    expect(read).toEqual(digger);
  });
});

describe('a system as the board of a set item', () => {
  it('runs with no controls declared: every part with a range is one', () => {
    const it0 = item();
    expect(itemErrors(it0)).toEqual([]);
    expect(setControls(it0, digger).map(c => c.label)).toEqual(['Piston push', 'Pistons']);
    expect(shortcutChecks(it0)).toEqual([]);
  });

  it('is judged by the result, so any parts that lift the rock are right', () => {
    const it0 = item(), right = rightAnswer(it0), wrong = wrongAnswer(it0);
    expect(gradeAnswer(it0, right).correct).toBe(true);
    expect(gradeAnswer(it0, wrong)).toEqual({ correct: false, miss: 'off_goal' });
    const other = { ...digger, parts: [{ ...digger.parts[0], value: 4 }, { ...digger.parts[1], value: 3 }, digger.parts[2]] };
    expect(gradeAnswer(it0, { board: other }).correct).toBe(true);
    // The harness's taps reach the board the solver found.
    expect(surfaceTaps(it0, right, 'Check').length).toBeGreaterThan(2);
    expect(gradeAnswer(it0, { board: setWalk(it0, digger, setSteps(it0, digger, right.board!)) }).correct).toBe(true);
  });

  it('refuses a goal that is already met or cannot be reached', () => {
    expect(itemErrors(item({ setGoal: { lifts: false } })).join()).toMatch(/already meets the goal/);
    expect(itemErrors(item({ board: { ...digger, parts: [digger.parts[0], digger.parts[1], { ...digger.parts[2], value: 40 }] } })).join()).toMatch(/cannot reach this goal/);
  });

  it('blocks a model that is a combination lock, a goal on a part, and a drawing that never moves', () => {
    const lock = item({ board: { ...digger, rules: [{ id: 'lifts', label: 'Lifts the rock', op: 'equal', of: ['push', 4] }] } });
    expect(shortcutChecks(lock).join()).toMatch(/only inside the rule \(4\)/);
    expect(shortcutChecks(item({ setGoal: { push: 6 } })).join()).toMatch(/number of a part/);
    const still = item({ board: { ...digger, scene: scene.replace('data-move="2,0"', '') } });
    expect(shortcutChecks(still).join()).toMatch(/does not move when the child changes a part/);
  });

  it('prints each rule in words under its result', () => {
    expect(displayHtml(digger)).toContain('= Piston push times Pistons');
    expect(displayHtml(digger)).toContain('when Lift force is at least Rock');
  });

  it('scores harder with more rules to work through', () => {
    const one = item({ board: { ...digger, rules: [{ id: 'lifts', label: 'Lifts the rock', op: 'at_least', of: ['push', 4] }] } });
    expect(difficultyOf(item()).score).toBeGreaterThan(difficultyOf(one).score);
  });
});

describe('evidence for running a model', () => {
  it('counts run-read as collectable on a set item', () => {
    const spec = { act: 'run-read' as const, on: 'a digger arm', credit: 'the arm lifts the rock when the model is run' };
    expect(unsupportedAct(spec)).toBeNull();
    expect(surfaceGap(spec, 'set')).toBeNull();
    expect(surfaceGap(spec, 'choose')).toMatch(/Use set/);
  });

  it('plans from acts the kit can collect', () => {
    const ask = evidencePlanAsk('excavators', 'grade 2');
    expect(ask).toContain('- run-read:');
    expect(ask).not.toContain('- explain:');
  });
});
