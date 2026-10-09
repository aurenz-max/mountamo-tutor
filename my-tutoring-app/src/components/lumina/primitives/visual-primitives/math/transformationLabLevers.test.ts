/**
 * transformation-lab levers: the leak rules per mode, the simplify builders over every item shape the generator draws,
 * and "this wrong answer, then this lever" as code.
 */
import { describe, expect, it } from 'vitest';
import { nextLever } from '../../../components/live-activity/runtime/observerLever';
import type { GridPoint, TransformationLabChallenge, TransformationLabChallengeType } from './TransformationLab';
import {
  CORNER_LETTERS_LEVER, MODEL_FLAG, MODEL_POINT_LEVER, MOTION_MODELS_LEVER, ORIGIN_RAYS_LEVER, PRE_COORDS_LEVER, RULE_CARD_LEVER,
  SIMPLER_FIGURE_LEVER, SIMPLER_TARGET_LEVER, TARGET_COORDS_LEVER, TWO_CHOICES_LEVER, leverFacts, leverTextLeaks, modelPoint,
  modelPointLeaks, motionModels, practiceLeaks, ruleFor, simplerItem, transformLevers,
} from './transformationLabLevers';
import {
  TRANSFORM_MISSES_BY_MODE, applySpec, composeOf, fmtPoint, inGrid, mapSpec, polygonsMatch, specFromLabel, specOf,
  transformCorrect, type TransformSpec,
} from './transformationLabWorkspace';

// ── the generator's item shapes (`gemini-transformation-lab.ts`), every placement it can draw ──────────────────────

const BASE_SHAPES: GridPoint[][] = [
  [{ x: 0, y: 0 }, { x: 2, y: 0 }, { x: 0, y: 3 }],
  [{ x: 0, y: 0 }, { x: 3, y: 0 }, { x: 1, y: 2 }],
  [{ x: 0, y: 0 }, { x: 2, y: 1 }, { x: 1, y: 3 }],
  [{ x: 0, y: 0 }, { x: 3, y: 0 }, { x: 3, y: 2 }, { x: 0, y: 1 }],
  [{ x: 0, y: 0 }, { x: 2, y: 0 }, { x: 3, y: 2 }, { x: 0, y: 2 }],
];
const SMALL_SHAPES: GridPoint[][] = [
  [{ x: 0, y: 0 }, { x: 2, y: 0 }, { x: 0, y: 2 }],
  [{ x: 0, y: 0 }, { x: 2, y: 0 }, { x: 1, y: 2 }],
  [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 2 }],
  [{ x: 0, y: 0 }, { x: 2, y: 1 }, { x: 0, y: 2 }],
];
const LABEL: Record<string, string> = {
  reflect_x: 'Reflection over the x-axis', reflect_y: 'Reflection over the y-axis', reflect_yx: 'Reflection over the line y = x',
  rotate90: 'Rotation 90° counterclockwise about the origin', rotate180: 'Rotation 180° about the origin',
  rotate270: 'Rotation 270° counterclockwise about the origin',
};
const RIGID: TransformSpec[] = ['reflect_x', 'reflect_y', 'reflect_yx', 'rotate90', 'rotate180', 'rotate270'].map(kind => ({ kind } as TransformSpec));
const place = (shape: GridPoint[], ox: number, oy: number) => shape.map(p => ({ x: p.x + ox, y: p.y + oy }));
const ok = (pre: GridPoint[], img: GridPoint[]) => pre.every(inGrid) && img.every(inGrid) && !polygonsMatch(pre, img);

function items(type: TransformationLabChallengeType): TransformationLabChallenge[] {
  const out: TransformationLabChallenge[] = [];
  const add = (pre: GridPoint[], img: GridPoint[], extra: Partial<TransformationLabChallenge>) => {
    if (ok(pre, img)) out.push({ id: `${type}-${out.length}`, type, narration: 'A shape moves.', instruction: 'Move it.', hint: '',
      answerKind: 'drag', preImage: pre, expectedImage: img, transformLabel: '', ...extra });
  };
  BASE_SHAPES.forEach((shape, si) => { for (let ox = -4; ox <= 3; ox++) for (let oy = -4; oy <= 3; oy++) {
    const pre = place(shape, ox, oy);
    if (type === 'apply_translation_reflection') {
      for (const [dx, dy] of [[3, -2], [-4, 1], [2, 3], [-2, -1]]) add(pre, mapSpec({ kind: 'translation', dx, dy }, pre), {});
      for (const s of RIGID.slice(0, 3)) add(pre, mapSpec(s, pre), {});
    }
    if (type === 'apply_rotation' && ox >= 1 && oy >= 1) for (const s of RIGID.slice(3)) add(pre, mapSpec(s, pre), {});
    if (type === 'identify_transformation' && ox >= 1 && oy >= 1) RIGID.forEach((s, k) => {
      const others = RIGID.filter(r => r.kind !== s.kind).map(r => LABEL[r.kind]);
      const options = [LABEL[s.kind], others[(si + k) % 5], others[(si + k + 1) % 5], others[(si + k + 2) % 5]];
      const rot = (si + k + ox) % 4, opts = [...options.slice(rot), ...options.slice(0, rot)];
      add(pre, mapSpec(s, pre), { answerKind: 'identify', options: opts, correctOption: opts.indexOf(LABEL[s.kind]), transformLabel: LABEL[s.kind] });
    });
    if (type === 'compose_sequence' && ox >= 0 && oy >= 0) for (const s of [RIGID[1], RIGID[0], RIGID[3], RIGID[4], RIGID[5]])
      for (const [dx, dy] of [[1, 1], [-3, 2], [2, -3]]) add(pre, mapSpec(s, pre).map(p => ({ x: p.x + dx, y: p.y + dy })), { answerKind: 'sequence' });
  } });
  if (type === 'dilation_similarity') for (const shape of SMALL_SHAPES) for (const k of [2, 3]) for (const [ox, oy] of [[0, 0], [0, 1], [1, 0], [1, 1]]) {
    const pre = place(shape, k >= 3 ? 0 : ox, k >= 3 ? 0 : oy);
    add(pre, mapSpec({ kind: 'dilate', k }, pre), { isSimilarity: true, scaleFactor: k });
  }
  return out;
}
const MODES = Object.keys(TRANSFORM_MISSES_BY_MODE) as TransformationLabChallengeType[];
const ALL = (pre: boolean, rule: boolean) => ({ preCoordsShown: pre, ruleShown: rule });

it('the generator\'s shapes give items in every mode', () => {
  for (const m of MODES) expect(items(m).length, m).toBeGreaterThan(20);
});

describe('simplify builders', () => {
  it.each(MODES)('%s: same mode, own id and narration, no corner of the item, solvable, deterministic', (mode) => {
    let built = 0;
    const all = items(mode);
    for (const c of all) {
      const s = simplerItem(c);
      if (!s) continue;
      built++;
      expect(s.id).toBe(`${c.id}~simpler`);
      expect([s.type, s.answerKind]).toEqual([c.type, c.answerKind]);
      expect(practiceLeaks(c, s)).toBe(false);
      expect(simplerItem(c)).toEqual(s);
      expect([...s.preImage, ...s.expectedImage].every(inGrid)).toBe(true);
      if (c.answerKind === 'identify') {
        expect(s.options).toHaveLength(2);
        expect(specFromLabel(s.options![s.correctOption!])).toEqual(specOf(s));
        expect(transformCorrect(s, { image: [], steps: [], selected: s.correctOption! })).toBe(true);
      } else if (c.answerKind === 'sequence') {
        const plan = composeOf(s)!;
        expect(Math.abs(plan.dx) + Math.abs(plan.dy)).toBe(1);
      } else {
        expect(specOf(s)).toEqual(specOf(c));
        expect(s.preImage.length < c.preImage.length || s.preImage.length === 3).toBe(true);
      }
    }
    expect(built / all.length, `${mode}: ${built}/${all.length} built`).toBeGreaterThan(0.9);
  });

  it('a practice item that repeats the item, crosses the mode or shares its corners leaks', () => {
    const c = items('apply_rotation')[0], s = simplerItem(c)!;
    expect(practiceLeaks(c, { ...s, id: c.id })).toBe(true);
    expect(practiceLeaks(c, { ...s, type: 'apply_translation_reflection' })).toBe(true);
    expect(practiceLeaks(c, { ...s, preImage: [c.preImage[0], ...s.preImage.slice(1)] })).toBe(true);
    const id = items('identify_transformation')[0], si = simplerItem(id)!;
    expect(practiceLeaks(id, { ...si, preImage: si.preImage, expectedImage: mapSpec(specOf(id)!, si.preImage) })).toBe(true);
  });
});

describe('help levers: leak rules', () => {
  it.each(MODES)('%s: with every help lever pulled, no lever word, fact or rule names an image corner or the right option', (mode) => {
    for (const c of items(mode)) {
      const levers = transformLevers(c, [], ALL(false, false));
      const help = levers.filter(l => l.kind === 'help').map(l => l.id);
      const facts = leverFacts(c, help);
      expect(leverTextLeaks(c, facts), `${c.id}: ${facts}`).toBe(false);
      for (const l of levers) expect(leverTextLeaks(c, `${l.when} ${l.does}`)).toBe(false);
      const rule = ruleFor(c);
      if (c.answerKind === 'identify') expect(rule).toBeNull();
      else if (rule) expect(leverTextLeaks(c, rule)).toBe(false);
    }
  });

  it('the model point shows the item\'s own motion on a point that is not a corner, on every drag item', () => {
    for (const m of ['apply_translation_reflection', 'apply_rotation', 'dilation_similarity'] as const) for (const c of items(m)) {
      const p = modelPoint(c);
      expect(p, c.id).not.toBeNull();
      expect(applySpec(specOf(c)!, p!.from)).toEqual(p!.to);
      expect(modelPointLeaks(c, p!.from, p!.to)).toBe(false);
      expect(inGrid(p!.to)).toBe(true);
    }
    // identify and compose never get one: there the motion is the answer.
    expect(modelPoint(items('identify_transformation')[0])).toBeNull();
    expect(modelPoint(items('compose_sequence')[0])).toBeNull();
  });

  it('the motion models move a flag that is not the item\'s figure, one per option or palette turn, none marked', () => {
    const id = items('identify_transformation')[5];
    expect(motionModels(id).map(m => m.caption)).toEqual(id.options);
    expect(motionModels(items('compose_sequence')[0])).toHaveLength(5);
    for (const c of [...items('identify_transformation'), ...items('compose_sequence')])
      expect(MODEL_FLAG.length).not.toBe(c.preImage.length);
    expect(motionModels(items('apply_rotation')[0])).toEqual([]);
  });

  it('the rule card and the pre-image labels are offered only where the screen does not already show them', () => {
    const c = items('apply_rotation')[0];
    const ids = (pre: boolean, rule: boolean) => transformLevers(c, [], ALL(pre, rule)).map(l => l.id);
    expect(ids(false, false)).toEqual(expect.arrayContaining([PRE_COORDS_LEVER, RULE_CARD_LEVER]));
    expect(ids(true, true)).not.toContain(PRE_COORDS_LEVER);
    expect(ids(true, true)).not.toContain(RULE_CARD_LEVER);
    expect(transformLevers({ ...c, id: `${c.id}~simpler` }, [], ALL(false, false))).toEqual([]);
  });
});

describe('this wrong answer, then this lever', () => {
  it.each(MODES)('%s: every catalog miss is answered by a lever on every item, with the labels and rule card shown or not', (mode) => {
    for (const c of items(mode)) for (const ctx of [ALL(true, true), ALL(false, false)]) {
      const levers = transformLevers(c, [], ctx);
      for (const miss of TRANSFORM_MISSES_BY_MODE[mode])
        expect(levers.some(l => l.kind === 'help' && l.answers?.includes(miss)), `${c.id} ${miss}`).toBe(true);
    }
  });

  const first = (mode: TransformationLabChallengeType) => items(mode)[0];
  it.each([
    ['apply_translation_reflection', 'opposite_shift', MODEL_POINT_LEVER],
    ['apply_translation_reflection', 'partly_placed', CORNER_LETTERS_LEVER],
    ['apply_rotation', 'wrong_direction', MODEL_POINT_LEVER],
    ['apply_rotation', 'shape_changed', CORNER_LETTERS_LEVER],
    ['dilation_similarity', 'added_factor', ORIGIN_RAYS_LEVER],
    ['dilation_similarity', 'wrong_factor', MODEL_POINT_LEVER],
    ['identify_transformation', 'wrong_axis', CORNER_LETTERS_LEVER],
    ['compose_sequence', 'orientation_off', MOTION_MODELS_LEVER],
    ['compose_sequence', 'position_off', TARGET_COORDS_LEVER],
  ] as const)('%s: %s → %s', (mode, miss, lever) => {
    expect(nextLever(transformLevers(first(mode), [], ALL(true, true)), miss)).toBe(lever);
  });

  it('once the help levers for a miss are pulled, the next is the simplify lever', () => {
    const c = first('apply_rotation');
    const help = transformLevers(c, [], ALL(true, true)).filter(l => l.kind === 'help').map(l => l.id);
    expect(nextLever(transformLevers(c, help, ALL(true, true)), 'wrong_direction')).toBe(SIMPLER_FIGURE_LEVER);
    const id = first('identify_transformation');
    const idHelp = transformLevers(id, [], ALL(true, true)).filter(l => l.kind === 'help').map(l => l.id);
    expect(nextLever(transformLevers(id, idHelp, ALL(true, true)), 'wrong_axis')).toBe(TWO_CHOICES_LEVER);
    const co = first('compose_sequence');
    const coHelp = transformLevers(co, [], ALL(true, true)).filter(l => l.kind === 'help').map(l => l.id);
    expect(nextLever(transformLevers(co, coHelp, ALL(true, true)), 'position_off')).toBe(SIMPLER_TARGET_LEVER);
  });

  it('a lever fact names only what is drawn: P and P′, never an image corner', () => {
    const c = first('apply_rotation'), p = modelPoint(c)!;
    const facts = leverFacts(c, [MODEL_POINT_LEVER, RULE_CARD_LEVER]);
    expect(facts).toContain(`P at ${fmtPoint(p.from)}`);
    expect(facts).toMatch(/A rule card reads \(x, y\) →/);
    for (const e of c.expectedImage) expect(facts).not.toContain(fmtPoint(e));
  });
});
