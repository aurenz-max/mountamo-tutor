/**
 * shape-composer levers: leak rules per mode, the simplify builders over the item shapes the generator draws and the
 * saved payloads, the free-create marks, and "this wrong answer, then this lever" as code.
 */
import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';
import { describe, expect, it } from 'vitest';
import { nextLever } from '../../../components/live-activity/runtime/observerLever';
import { getComponentById } from '../../../service/manifest/catalog';
import type { ShapeComposerChallenge } from './ShapeComposer';
import { buildRecipes, judgeShapeBuild, type BoardPiece } from './shapeComposerBuild';
import {
  EMPTY_SPACE_LEVER, EMPTY_SPOTS_LEVER, FEWER_PIECES_LEVER, IN_PLACE_LEVER, JOIN_MARKS_LEVER, LIST_MATCH_LEVER,
  PARTS_MODEL_LEVER, PIECES_MODEL_LEVER, SMALLER_BUILD_LEVER, SMALLER_PICTURE_LEVER, SMALLER_RECIPE_LEVER, SPLIT_LINES_LEVER,
  TWO_PARTS_LEVER, joinStates, leverFacts, leverTextLeaks, listMatch, partsModelFor, piecesModelFor, shapeComposerLevers,
  simplerLeaks, simplerShape, smallerRecipe,
} from './shapeComposerLevers';
import { shapeComposerMatches, shapeComposerMiss, type ShapeView } from './shapeComposerWorkspace';

type Mode = ShapeComposerChallenge['type'];
const MODES: Mode[] = ['compose-match', 'compose-picture', 'decompose', 'how-many-ways', 'free-create'];
const SHAPES = ['triangle', 'square', 'rectangle', 'circle'];

/** Item shapes per mode, as the generator draws them (two to four pieces, parts or spots). */
function items(mode: Mode): ShapeComposerChallenge[] {
  const out: ShapeComposerChallenge[] = [];
  if (mode === 'compose-match') for (const target of ['large-triangle', 'large-square', 'long-rectangle', 'house']) for (let n = 2; n <= 4; n++) {
    out.push({ id: `m-${target}-${n}`, type: mode, instruction: 'Fill it.', targetShape: target, targetOutlinePath: `M 0 0 L ${n} 0 Z`,
      pieces: Array.from({ length: n }, (_, i) => ({ id: `p${i}`, shape: SHAPES[i % 2] as 'triangle' | 'square', color: '#fff', width: 100, height: 100,
        targetX: 100 * i, targetY: 100 })) });
  }
  if (mode === 'compose-picture') for (const picture of ['house', 'tree', 'rocket', 'lollipop', 'tent']) for (let n = 2; n <= 4; n++) {
    const slots = Array.from({ length: n }, (_, i) => ({ id: `s${i}`, shape: SHAPES[i], x: 50 + 60 * i, y: 100, width: 50, height: 50, rotation: 0 }));
    out.push({ id: `p-${picture}-${n}`, type: mode, instruction: 'Build it.', targetPicture: picture, pictureSlots: slots,
      availableShapes: slots.map(s => ({ shape: s.shape, color: '#fff', count: 1 })) });
  }
  if (mode === 'decompose') for (const parts of [[['triangle', 2]], [['square', 2]], [['triangle', 4]], [['triangle', 2], ['square', 1]],
    [['rectangle', 1], ['triangle', 2]], [['square', 1], ['triangle', 1]], [['rectangle', 2]]] as Array<Array<[string, number]>>) {
    out.push({ id: `d-${parts.map(p => p.join('')).join('-')}`, type: mode, instruction: 'What shapes?', compositeShapePath: `M ${parts.length} 0 Z`,
      expectedComponents: parts.map(([shape, count]) => ({ shape, count })), divisionLineHints: [{ x1: 0, y1: 0, x2: 1, y2: 1 }] });
  }
  if (mode === 'how-many-ways') for (const [target, piece, n] of [['square', 'triangle', 2], ['rectangle', 'square', 2],
    ['large-triangle', 'triangle', 4], ['hexagon', 'triangle', 6], ['trapezoid', 'triangle', 3]] as const) {
    out.push({ id: `h-${target}`, type: mode, instruction: `How many ${piece}s make a ${target}?`, targetForComposition: target,
      allowedPieces: [piece], minimumPiecesNeeded: n });
  }
  if (mode === 'free-create') for (const band of ['K', '1'] as const) for (let seed = 1; seed <= 6; seed++) {
    let x = seed;
    buildRecipes(band, 4, () => ((x = (x * 9301 + 49297) % 233280) / 233280)).forEach((recipe, i) =>
      out.push({ id: `f-${band}-${seed}-${i}`, type: mode, instruction: 'Make it.', recipe }));
  }
  return out;
}

/** The saved W1 payloads' items, so every lever claim is checked on what a lesson really mounts. */
const PAYLOADS = join(__dirname, '../../../components/live-activity/runtime/testing/w1-payloads');
const saved = (): ShapeComposerChallenge[] => readdirSync(PAYLOADS).filter(f => f.startsWith('shape-composer.'))
  .flatMap(f => JSON.parse(readFileSync(join(PAYLOADS, f), 'utf-8')).data.challenges as ShapeComposerChallenge[]);

const piece = (id: string, shape: string, x: number, y = 100): BoardPiece => ({ id, shape, x, y, width: 50, height: 50, rotation: 0 });
const view = (over: Partial<ShapeView>): ShapeView => ({ placed: [], taps: [], answer: '', snapTolerance: 50, ...over });

/** The practice item's own key, as work its own check reads. */
function keyOf(s: ShapeComposerChallenge): ShapeView {
  switch (s.type) {
    case 'compose-match': return view({ placed: s.pieces!.map(p => ({ id: p.id, shape: p.shape, x: p.targetX!, y: p.targetY!,
      width: p.width, height: p.height, rotation: 0 })) });
    case 'compose-picture': return view({ placed: s.pictureSlots!.map(p => ({ ...p })) });
    case 'decompose': return view({ taps: s.expectedComponents!.flatMap(p => Array.from({ length: p.count }, () => p.shape)) });
    case 'how-many-ways': return view({ answer: String(s.minimumPiecesNeeded) });
    default: {
      // A row of the listed shapes, edge to edge.
      const shapes = s.recipe!.flatMap(r => Array.from({ length: r.count }, () => r.shape));
      return view({ placed: shapes.map((shape, i) => piece(`r${i}`, shape === 'circle' ? 'square' : shape, 20 + 50 * i)) });
    }
  }
}

describe('simplify builders', () => {
  it.each(MODES)('%s: same mode, its own id, fewer pieces, solvable by its own check, never the learner\'s item', mode => {
    let built = 0;
    for (const c of [...items(mode), ...saved().filter(x => x.type === mode)]) {
      const s = simplerShape(c);
      if (!s) continue;
      built++;
      expect(s.type).toBe(mode);
      expect(s.id).toBe(`${c.id}~simpler`);
      expect(simplerLeaks(c, s), c.id).toBe(false);
      expect(simplerShape(s)).toBeNull();
      if (mode !== 'free-create') expect(shapeComposerMatches(s, keyOf(s)), s.id).toBe(true);
    }
    expect(built).toBeGreaterThan(0);
  });
  it('offered only where the item is bigger than two pieces, parts or spots', () => {
    const two = items('compose-match').find(c => c.pieces!.length === 2)!;
    expect(simplerShape(two)).toBeNull();
    expect(simplerShape(items('decompose')[0])).toBeNull();
    expect(simplerShape(items('how-many-ways')[0])).toBeNull();
    expect(simplerShape(items('how-many-ways').find(c => c.targetForComposition === 'hexagon')!))
      .toMatchObject({ minimumPiecesNeeded: 2, targetForComposition: 'rectangle' });
    expect(smallerRecipe([{ shape: 'triangle', count: 2 }, { shape: 'square', count: 1 }])).toEqual([{ shape: 'triangle', count: 1 }, { shape: 'square', count: 1 }]);
    expect(smallerRecipe([{ shape: 'triangle', count: 1 }, { shape: 'square', count: 1 }])).toBeNull();
  });
  it('the leak rule refuses the learner\'s own target, picture, big shape or list', () => {
    const m = items('compose-match').find(c => c.pieces!.length === 4)!;
    expect(simplerLeaks(m, { ...simplerShape(m)!, targetShape: m.targetShape })).toBe(true);
    const f = items('free-create').find(c => simplerShape(c))!;
    expect(simplerLeaks(f, { ...simplerShape(f)!, recipe: f.recipe })).toBe(true);
    const h = items('how-many-ways').find(c => c.minimumPiecesNeeded === 4)!;
    expect(simplerLeaks(h, { ...simplerShape(h)!, targetForComposition: h.targetForComposition })).toBe(true);
  });
});

describe('leak rules on the help levers', () => {
  it.each(MODES)('%s: no lever text or scene fact carries a digit; decompose names none of its parts', mode => {
    for (const c of [...items(mode), ...saved().filter(x => x.type === mode)]) for (const showSeams of [true, false]) {
      const item = { ...c, showSeams };
      const levers = shapeComposerLevers(item, []);
      expect(levers.length, c.id).toBeGreaterThan(0);
      for (const l of levers) expect(leverTextLeaks(item, `${l.when} ${l.does}`), `${c.id} ${l.id}`).toBe(false);
      const facts = leverFacts(item, levers.map(l => l.id));
      expect(facts.length, c.id).toBeGreaterThan(0);
      expect(leverTextLeaks(item, facts), c.id).toBe(false);
    }
  });
  it('the models are outside the item: decompose never its part shapes, how-many-ways never its shape or number', () => {
    for (const c of items('decompose')) {
      const m = partsModelFor(c);
      const parts = c.expectedComponents!.map(p => p.shape);
      if (m) expect(parts).not.toContain(m.part), expect(parts).not.toContain(m.name);
    }
    for (const c of items('how-many-ways')) {
      const m = piecesModelFor(c)!;
      expect(m.count).not.toBe(c.minimumPiecesNeeded);
      expect(c.targetForComposition!.split('-')).not.toContain(m.name);
    }
  });
  it('split lines only where the session hides them; an older free-create payload has none', () => {
    const d = items('decompose')[0];
    expect(shapeComposerLevers({ ...d, showSeams: false }, []).map(l => l.id)).toEqual([SPLIT_LINES_LEVER, PARTS_MODEL_LEVER]);
    expect(shapeComposerLevers(d, []).map(l => l.id)).toEqual([PARTS_MODEL_LEVER]);
    expect(shapeComposerLevers({ id: 'old', type: 'free-create', instruction: 'Build anything!' }, [])).toEqual([]);
  });
});

describe('free-create marks read the learner\'s own work', () => {
  it('list match lights the listed kinds and rings what is not on the list', () => {
    const r = listMatch([{ shape: 'triangle', count: 2 }, { shape: 'square', count: 1 }],
      [piece('a', 'triangle', 0), piece('b', 'circle', 100), piece('c', 'square', 200), piece('d', 'square', 300)]);
    expect(r.lit).toEqual([1, 1]);
    expect(Array.from(r.offList)).toEqual(['b', 'd']);
  });
  it('join marks: touching, on its own, on top of another', () => {
    const s = joinStates([piece('a', 'square', 0), piece('b', 'square', 51), piece('c', 'square', 300), piece('d', 'square', 305)]);
    expect(Object.fromEntries(s)).toEqual({ a: 'touching', b: 'touching', c: 'on_top', d: 'on_top' });
    expect(joinStates([piece('a', 'square', 0), piece('b', 'square', 200)]).get('a')).toBe('alone');
  });
});

describe('this wrong answer, then this lever', () => {
  const match = items('compose-match').find(c => c.pieces!.length === 4)!;
  const picture = items('compose-picture').find(c => c.pictureSlots!.length === 3)!;
  const decompose = items('decompose').find(c => c.id === 'd-triangle2-square1')!;
  const hexagon = items('how-many-ways').find(c => c.targetForComposition === 'hexagon')!;
  const build: ShapeComposerChallenge = { id: 'b', type: 'free-create', instruction: 'Make it.',
    recipe: [{ shape: 'triangle', count: 2 }, { shape: 'square', count: 1 }] };
  it.each([
    ['match pieces left', match, view({ placed: [] }), 'pieces_left', EMPTY_SPACE_LEVER, FEWER_PIECES_LEVER],
    ['match off the outline', match, view({ placed: match.pieces!.map(p => piece(p.id, p.shape, 0, 0)) }), 'piece_off_outline', EMPTY_SPACE_LEVER, IN_PLACE_LEVER],
    ['picture shape missing', picture, view({ placed: [] }), 'shape_missing', EMPTY_SPOTS_LEVER, SMALLER_PICTURE_LEVER],
    ['decompose not a part', decompose, view({ taps: ['circle'] }), 'not_a_part', PARTS_MODEL_LEVER, null],
    ['decompose missed part', decompose, view({ taps: ['triangle'] }), 'missed_part', PARTS_MODEL_LEVER, TWO_PARTS_LEVER],
    ['how many too few', hexagon, view({ answer: '3' }), 'too_few', PIECES_MODEL_LEVER, SMALLER_BUILD_LEVER],
    ['build not touching', build, view({ placed: [piece('a', 'triangle', 0), piece('b', 'triangle', 100), piece('c', 'square', 200)] }),
      'not_touching', JOIN_MARKS_LEVER, SMALLER_RECIPE_LEVER],
    ['build missing piece', build, view({ placed: [piece('a', 'triangle', 0)] }), 'missing_piece', LIST_MATCH_LEVER, SMALLER_RECIPE_LEVER],
  ] as const)('%s → %s, then %s', (_n, c, work, miss, first, second) => {
    expect(shapeComposerMiss(c, work)).toBe(miss);
    if (c.type === 'free-create') expect(judgeShapeBuild(c.recipe!, work.placed).miss).toBe(miss);
    expect(nextLever(shapeComposerLevers(c, []), miss)).toBe(first);
    const after = nextLever(shapeComposerLevers(c, [first]), miss);
    if (second) expect(after).toBe(second);
  });
  it('every catalog miss is answered by a lever on every item and every saved payload item, seams shown or not (J9/J12)', () => {
    const tw = getComponentById('shape-composer')!.teachingWorkspace!;
    expect(tw.levers).toBe(true);
    expect(tw.unanswered).toEqual({ 'free-create': ['too_few_shapes'] });
    for (const mode of MODES) for (const c of [...items(mode), ...saved().filter(x => x.type === mode)]) for (const showSeams of [true, false]) {
      const levers = shapeComposerLevers({ ...c, showSeams }, []);
      for (const m of tw.misses![mode].filter(x => !tw.unanswered![mode]?.includes(x))) {
        expect(levers.some(l => l.answers?.includes(m)), `${mode} ${c.id} ${m}`).toBe(true);
      }
    }
  });
});
