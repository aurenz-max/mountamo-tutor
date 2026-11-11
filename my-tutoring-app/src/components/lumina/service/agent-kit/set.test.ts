import { describe, expect, it } from 'vitest';
import { displayErrors, type Display } from './displays';
import { surfaceGap, unsupportedAct } from './evidence';
import { buildSurfaceLevers, readDraft, surfacePrompt } from './itemLoop';
import { solverPrompt } from './look';
import { setApply, setControls, setFacts, setSolve, setSteps, setUnmet, type ControlSpec, type SetGoal, type SetSpec } from './setting';
import { surfaceScene } from './surfaceScene';
import { answerReady, gradeAnswer, itemErrors, missHint, rightAnswer, setTarget, shortcutChecks, surfaceTaps, wrongAnswer } from './surfaces';

const circle = (cuts: number[]): Display => ({ kind: 'shares', shape: 'circle', cuts });
const rect = (wide: number, tall: number, cuts: number[] = [], across: number[] = []): Display => ({ kind: 'shares', shape: 'rectangle', wide, tall, cuts, across });
const set = (prompt: string, board: Display, goal: Record<string, unknown>, extra: Record<string, unknown> = {}) =>
  readDraft({ tier: 'medium', surface: 'set', prompt, board, goal, ...extra }, 's-1', 3);
const facts = (board: Display) => setFacts({ board });
const solve = (board: Display, setGoal: SetGoal, more: Partial<SetSpec> = {}) => setSolve({ board, setGoal, ...more });

// GEOM002-03-a: the objective says the child cuts the circle. On 2026-11-09 every item for it was a pick among drawn cuts.
const thirds = () => set('Cut the circle into 3 equal shares.', circle([]), { parts: 3, equal: true });

describe('shares: a shape cut into parts', () => {
  it('reads the parts and whether they are one size', () => {
    expect(facts(circle([0, 4, 8]))).toMatchObject({ parts: 3, equal: true });
    expect(facts(circle([1, 5, 9]))).toMatchObject({ parts: 3, equal: true });
    expect(facts(circle([0, 1, 6]))).toMatchObject({ parts: 3, equal: false });
    expect(facts(circle([0, 6]))).toMatchObject({ parts: 2, equal: true });
    expect(facts(circle([0, 3, 6, 9]))).toMatchObject({ parts: 4, equal: true });
    expect(facts(circle([5]))).toMatchObject({ parts: 1, equal: false });
    expect(facts(rect(6, 4, [3], [2]))).toMatchObject({ parts: 4, equal: true, rows: 2, columns: 2 });
    expect(facts(rect(6, 4, [1], [2]))).toMatchObject({ parts: 4, equal: false, rows: 2, columns: 2 });
    expect(facts({ kind: 'shares', shape: 'rectangle', wide: 6, tall: 4, cuts: [], diagonal: 'down' })).toMatchObject({ parts: 2, equal: true });
  });

  it('refuses a shape it cannot draw', () => {
    expect(displayErrors(circle([0, 12])).join()).toMatch(/0-11/);
    expect(displayErrors(rect(6, 4, [6])).join()).toMatch(/1-5/);
    expect(displayErrors({ kind: 'shares', shape: 'rectangle', wide: 6, tall: 4, cuts: [3], diagonal: 'down' }).join()).toMatch(/drawn alone/);
    expect(displayErrors({ ...circle([0, 6]), shaded: 3 } as Display).join()).toMatch(/shaded/);
  });
});

describe('set: the child changes a board until a goal holds', () => {
  it('takes any board that meets the goal, wherever the cuts sit', () => {
    const { item } = thirds();
    expect(itemErrors(item)).toEqual([]);
    expect(gradeAnswer(item, { board: circle([0, 4, 8]) })).toEqual({ correct: true });
    expect(gradeAnswer(item, { board: circle([2, 6, 10]) })).toEqual({ correct: true });
    expect(gradeAnswer(item, { board: circle([0, 1, 6]) })).toEqual({ correct: false, miss: 'off_goal' });
  });

  it('names the fact a wrong board misses, never where to cut', () => {
    const { item } = thirds();
    expect(missHint(item, { board: circle([0, 6]) })).toBe('Count the parts.');
    expect(missHint(item, { board: circle([0, 1, 6]) })).toMatch(/same size/);
    expect(answerReady(item, {})).toBe(false);
    expect(answerReady(item, { board: circle([0]) })).toBe(true);
  });

  it('refuses a board that starts finished, a goal the controls cannot reach, a fact the board lacks, no controls, and cards', () => {
    expect(itemErrors(set('Cut it in half.', circle([0, 6]), { parts: 2, equal: true }).item).join()).toMatch(/already meets the goal/);
    expect(itemErrors(set('Cut it into 5 equal shares.', circle([]), { parts: 5, equal: true }).item).join()).toMatch(/cannot reach/);
    expect(itemErrors(set('Make 3 rows.', circle([]), { rows: 3 }).item).join()).toMatch(/does not have. Its facts are/);
    expect(itemErrors(set('Cut it.', circle([]), {}).item).join()).toMatch(/names at least one fact/);
    expect(itemErrors(set('Make 30 cents.', { kind: 'coins', coins: ['dime'] } as Display, { value: 30 }).item).join()).toMatch(/say what the child can change/);
    expect(itemErrors(set('Cut it in half.', circle([]), { parts: 2, equal: true }, { options: [{ id: 'a', label: 'half' }] }).item).join()).toMatch(/no option cards/);
  });

  it('refuses controls that do not fit the board', () => {
    const array: Display = { kind: 'array', rows: 2, columns: 2 };
    const bad = (controls: ControlSpec[]) => itemErrors(set('Make 12.', array, { value: 12 }, { controls }).item).join();
    expect(bad([{ field: 'dots', min: 1, max: 6 }])).toMatch(/is not a number on this board/);
    expect(bad([{ field: 'rows', min: 4, max: 6 }])).toMatch(/starts with rows at 2/);
    expect(bad([{ field: 'rows' }])).toMatch(/needs min and max/);
    expect(bad([{ field: 'rows', toggle: [1, 2] }])).toMatch(/has no list there/);
    const graph: Display = { kind: 'pictograph', icon: '🍎', key_value: 5, labels: ['Red', 'Green'], values: [5, 10] };
    // A step the author sized wrongly still works: each tap lands on the next value the display can draw.
    const red = set('Make Red show 15.', graph, { 'values[0]': 15 }, { controls: [{ field: 'values[0]', min: 0, max: 20 }] }).item;
    expect(itemErrors(red)).toEqual([]);
    expect(surfaceTaps(red, rightAnswer(red), 'Check')).toHaveLength(3);
  });

  it('plays the harness: the taps from the start reach a right board, and one tap alone does not', () => {
    const { item } = thirds();
    const right = rightAnswer(item);
    expect(gradeAnswer(item, right).correct).toBe(true);
    expect(gradeAnswer(item, wrongAnswer(item)).correct).toBe(false);
    expect(surfaceTaps(item, right, 'Check')).toEqual([...[0, 4, 8].map(p => ({ type: 'touch', target: `set-cuts:${p}` })), { type: 'choose', label: 'Check' }]);
  });

  it('solves from where the board starts: the nearest right board, not a fixed one', () => {
    expect(solve(circle([1]), { parts: 2, equal: true })).toMatchObject({ cuts: [1, 7] });
    expect(solve(rect(8, 6), { rows: 3, columns: 4, equal: true })).toMatchObject({ cuts: [2, 4, 6], across: [2, 4] });
    expect(solve(circle([]), { parts: 3, equal: false })).toMatchObject({ cuts: [0, 1, 2] });
    expect(facts(solve(rect(8, 6), { parts: 4, equal: true })!)).toMatchObject({ parts: 4, equal: true });
  });

  it('blocks the shortcuts: a finished answer shown above the board, and a board where every mark is on', () => {
    expect(shortcutChecks(set('Cut the circle into 3 equal shares.', circle([]), { parts: 3, equal: true }, { stimulus: [circle([2, 6, 10])] }).item).join()).toMatch(/already shows a finished answer/);
    expect(shortcutChecks(set('Cut it into 2 rows and 2 columns.', rect(2, 2), { rows: 2, columns: 2 }).item).join()).toMatch(/every mark/);
    expect(shortcutChecks(thirds().item)).toEqual([]);
    expect(shortcutChecks(set('Cut the circle into 3 equal shares.', circle([]), { parts: 3, equal: true }, { stimulus: [circle([0, 6])] }).item)).toEqual([]);
  });

  it('reaches every band from structure (I6)', () => {
    const easy = set('Finish cutting the circle in half.', circle([0]), { parts: 2, equal: true }).item;
    const hard = set('Cut the rectangle into 3 rows and 4 columns of equal squares.', rect(8, 6), { rows: 3, columns: 4, equal: true }).item;
    expect([easy, thirds().item, hard].map(i => i.difficulty.band)).toEqual(['easy', 'medium', 'hard']);
  });

  it('simplifies by starting the board part done, and refuses a board that is finished or missing', () => {
    const lever = (simplify: Record<string, unknown>) => buildSurfaceLevers(set('Cut the circle into 3 equal shares.', circle([]), { parts: 3, equal: true }, { simplify }), 3);
    const ok = lever({ says: 'Two cuts are made. Where does the last one go?', board: circle([0, 4]) });
    expect(ok.refused).toEqual([]);
    expect(ok.levers[0].item.difficulty.score).toBeLessThan(thirds().item.difficulty.score);
    expect(gradeAnswer(ok.levers[0].item, rightAnswer(ok.levers[0].item)).correct).toBe(true);
    expect(lever({ says: 'Here.', board: circle([0, 4, 8]) }).refused.join()).toMatch(/already meets the goal/);
    expect(lever({ says: 'Try again.' }).refused.join()).toMatch(/part of the work done/);
  });

  it('sets a clock with the controls it comes with: the hands go the short way round', () => {
    const { item } = set('Set the clock to half past 3.', { kind: 'clock', hour: 12, minute: 0 }, { hour: 3, minute: 30 });
    expect(itemErrors(item)).toEqual([]);
    const taps = surfaceTaps(item, rightAnswer(item), 'Check').map(t => ('target' in t ? t.target : t.label));
    expect(taps).toEqual([...Array(3).fill('set-hour-up'), ...Array(6).fill('set-minute-up'), 'Check']);
    expect(gradeAnswer(item, { board: { kind: 'clock', hour: 3, minute: 30 } }).correct).toBe(true);
    expect(missHint(item, { board: { kind: 'clock', hour: 4, minute: 30 } })).toMatch(/short hand/);
    expect(setTarget('hour', -1)).toBe('set-hour-down');
    const back = set('Set the clock to 11 o\'clock.', { kind: 'clock', hour: 1, minute: 0 }, { hour: 11 }).item;
    expect(surfaceTaps(back, rightAnswer(back), 'Check').slice(0, -1)).toEqual(Array(2).fill({ type: 'touch', target: 'set-hour-down' }));
  });

  it('tells the tutor and the blind reader what the child can change, and neither the goal', () => {
    const { item } = thirds();
    const scene = surfaceScene(item, { answer: { board: circle([0, 6]) }, tries: [], solved: false });
    expect(String(scene.facts.set)).toMatch(/cuts from its center toward 12, 6 o'clock/);
    expect(`${scene.facts.set} ${scene.facts.board} ${scene.facts.task}`).not.toMatch(/equal|same size|\d parts/);
    const asked = solverPrompt(item, 'grade 2', true);
    expect(asked).toMatch(/There are no cards/);
    expect(asked).toMatch(/put any of 0, 1, 2.*into or out of "cuts"/);
    expect(asked).toContain('{kind:"shares"');
    expect(asked).not.toContain(JSON.stringify(item.setGoal));
  });

  it('is offered to the author as a surface over every display', () => {
    expect(surfacePrompt()).toMatch(/- set: the child changes a picture/);
    expect(surfacePrompt()).toMatch(/board: any display from the list below/);
  });

  it('counts as the evidence act it is', () => {
    const spec = { act: 'set' as const, on: 'a whole, uncut circle', credit: "the child's cuts make equal shares" };
    expect(unsupportedAct(spec)).toBeNull();
    expect(surfaceGap(spec, 'choose')).toMatch(/Use set/);
    expect(surfaceGap(spec, 'set')).toBeNull();
  });
});

/**
 * The claim this surface rests on: a display is a board with no code of its own. Every row is a display that existed
 * before `set` did, with controls and a goal written the way an author writes them. `shares` and `clock` are here only
 * for their built-in controls; nothing else in this table has any set code in `displays.ts`.
 */
describe('any display is a board', () => {
  const step = (field: string, min: number, max: number, more: Partial<ControlSpec> = {}): ControlSpec => ({ field, min, max, ...more });
  const BOARDS: Array<{ what: string; board: Display; controls?: ControlSpec[]; goal: SetGoal; derive?: SetSpec['derive']; ways?: number }> = [
    { what: 'array: any array of 12', board: { kind: 'array', rows: 1, columns: 1 }, controls: [step('rows', 1, 6), step('columns', 1, 6)], goal: { value: 12 } },
    { what: 'ten frame: fill to 7', board: { kind: 'ten_frame', filled: 2 }, controls: [step('filled', 0, 10)], goal: { filled: 7 } },
    { what: 'base ten: 34 from tens and ones', board: { kind: 'base_ten', hundreds: 0, tens: 0, ones: 1 }, controls: [step('tens', 0, 9), step('ones', 0, 20)], goal: { value: 34 } },
    { what: 'number line: a point between 6 and 8', board: { kind: 'number_line', min: 0, max: 10, step: 1, marks: [{ value: 0, label: 'my point' }] }, controls: [step('marks[0].value', 0, 10)], goal: { 'marks[0].value': { min: 6.5, max: 7.5 } } },
    { what: 'bar graph: Dog 3 more than Cat', board: { kind: 'bar_graph', labels: ['Cat', 'Dog'], values: [4, 4] }, controls: [step('values[1]', 0, 10, { label: 'the Dog bar' })], goal: { more: 3 }, derive: { more: { diff: ['values[1]', 'values[0]'] } } },
    { what: 'picture graph: Red and Green show 30 in all', board: { kind: 'pictograph', icon: '🍎', key_value: 5, labels: ['Red', 'Green'], values: [5, 5] }, controls: [step('values[0]', 0, 30, { step: 5 }), step('values[1]', 0, 30, { step: 5 })], goal: { all: 30 }, derive: { all: { sum: ['values[0]', 'values[1]'] } } },
    { what: 'chart: week 3 taller than 10', board: { kind: 'chart', chart_type: 'bar', points: [{ label: 'Week 1', value: 2 }, { label: 'Week 2', value: 5 }, { label: 'Week 3', value: 5 }] }, controls: [step('points[2].value', 0, 20)], goal: { 'points[2].value': { min: 11 } } },
    { what: 'timeline: the bridge after the mill', board: { kind: 'timeline', events: [{ label: 'Mill', at: 1900 }, { label: 'Bridge', at: 1850 }] }, controls: [step('events[1].at', 1850, 2000, { step: 50 })], goal: { later: { min: 1 } }, derive: { later: { diff: ['events[1].at', 'events[0].at'] } } },
    { what: 'map: the park east of the school', board: { kind: 'map', places: [{ name: 'School', x: 5, y: 5 }, { name: 'Park', x: 2, y: 5 }] }, controls: [step('places[1].x', 0, 10)], goal: { east: { min: 1 } }, derive: { east: { diff: ['places[1].x', 'places[0].x'] } } },
    { what: 'food web: the fox above the rabbit', board: { kind: 'food_web', living: [{ name: 'Grass', level: 1 }, { name: 'Rabbit', level: 2 }, { name: 'Fox', level: 1 }], eats: [['Rabbit', 'Grass'], ['Fox', 'Rabbit']] }, controls: [step('living[2].level', 1, 4)], goal: { 'living[2].level': 3 } },
    { what: 'shares: shade one of four equal parts', board: { kind: 'shares', shape: 'circle', cuts: [0, 3, 6, 9], shaded: 0 }, controls: [step('shaded', 0, 4)], goal: { shaded: 1 } },
    { what: 'shares: cut into fourths', board: circle([]), goal: { parts: 4, equal: true } },
    { what: 'clock: quarter past 2', board: { kind: 'clock', hour: 9, minute: 45 }, goal: { hour: 2, minute: 15 } },
  ];

  it.each(BOARDS.map(b => [b.what, b] as const))('%s', (_what, b) => {
    const spec: SetSpec = { board: b.board, ...(b.controls ? { controls: b.controls } : {}), ...(b.derive ? { derive: b.derive } : {}), setGoal: b.goal };
    const item = set('Do it.', b.board, b.goal as Record<string, unknown>, { ...(b.controls ? { controls: b.controls } : {}), ...(b.derive ? { derive: b.derive } : {}) }).item;
    expect(itemErrors(item)).toEqual([]);
    const solved = setSolve(spec)!;
    expect(setUnmet(spec, solved)).toBeNull();
    // The child's own taps, one at a time, get there, and every board on the way can be drawn.
    const walked = setSteps(spec, b.board, solved).reduce<Display>((d, tap) => { const next = setApply(spec, d, tap); expect(displayErrors(next)).toEqual([]); return next; }, b.board);
    expect(setUnmet(spec, walked)).toBeNull();
    expect(gradeAnswer(item, rightAnswer(item)).correct).toBe(true);
    expect(gradeAnswer(item, wrongAnswer(item)).correct).toBe(false);
    expect(setControls(spec, b.board).length).toBeGreaterThan(0);
    expect(solverPrompt(item, 'grade 2', true)).toContain(`{kind:"${b.board.kind}"`);
  });

  it('steps past a value the display cannot draw, and says so when a board will not start empty', () => {
    const spec: SetSpec = { board: { kind: 'timeline', events: [{ label: 'Mill', at: 1900 }, { label: 'Bridge', at: 1850 }] }, controls: [step('events[1].at', 1850, 2000, { step: 50 })] };
    expect(setApply(spec, spec.board!, { id: 'events[1].at', dir: 1 })).toMatchObject({ events: [{ at: 1900 }, { at: 1950 }] });
    const empty = set('Show 34 with blocks.', { kind: 'base_ten', hundreds: 0, tens: 0, ones: 0 }, { value: 34 }, { controls: [step('tens', 0, 9), step('ones', 0, 20)] }).item;
    expect(itemErrors(empty).join()).toMatch(/board: base_ten: at least one block/);
  });

  it('keeps a goal with many right answers open: 12 as any array, 34 as any tens and ones', () => {
    const twelve = set('Make an array of 12.', { kind: 'array', rows: 1, columns: 1 }, { value: 12 }, { controls: [step('rows', 1, 6), step('columns', 1, 6)] }).item;
    for (const [rows, columns] of [[3, 4], [4, 3], [2, 6], [6, 2]]) expect(gradeAnswer(twelve, { board: { kind: 'array', rows, columns } }).correct).toBe(true);
    expect(gradeAnswer(twelve, { board: { kind: 'array', rows: 3, columns: 3 } }).correct).toBe(false);
    const number = set('Show 34 with blocks.', { kind: 'base_ten', hundreds: 0, tens: 0, ones: 1 }, { value: 34 }, { controls: [step('tens', 0, 9), step('ones', 0, 20)] }).item;
    expect(gradeAnswer(number, { board: { kind: 'base_ten', hundreds: 0, tens: 3, ones: 4 } }).correct).toBe(true);
    expect(gradeAnswer(number, { board: { kind: 'base_ten', hundreds: 0, tens: 2, ones: 14 } }).correct).toBe(true);
    expect(missHint(number, { board: { kind: 'base_ten', hundreds: 0, tens: 4, ones: 3 } })).toMatch(/whole picture/);
  });
});
