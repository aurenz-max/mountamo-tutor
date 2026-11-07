/**
 * The Wonder Walk math world, against the agent-primitive invariants: one hand-built world per K math standard passes
 * every check, builds, and is solved by the harness (I2, the coverage table); code derives the key and names the mode
 * (I4); shortcuts are blocked (I5); difficulty comes from structure (I6); variety and tier hold (I7).
 */
import { describe, expect, it } from 'vitest';
import { buildStops, rng, stopChecks, walkChecks, type MathScope, type StopDraft } from './checks';
import { MATH_MODES, countMax, modeOf, scatter, worldDifficulty, worldKey, type WorldDraft } from './world';
import { validateWonderWalkData } from '../../../primitives/visual-primitives/core/wonder-walk/wonderWalk.boss';
import { stopHarnessTaps } from '../../../primitives/visual-primitives/core/wonder-walk/wonderWalkWorkspace';
import { goalHolds, solveMove } from '../../../primitives/visual-primitives/core/wonder-walk/wonderWalkWorld';

const ALL: MathScope = { max: 20, openModes: MATH_MODES };
type P = WorldDraft['places'][number];
const place = (id: string, kind: P['kind'], arrangement: P['arrangement'], contents: P['contents'] = [], color?: P['color']): P => ({ id, kind, arrangement, contents, ...(color ? { color } : {}) });
const c = (count: number, word = 'apple', color?: 'red' | 'blue' | 'yellow' | 'green') => ({ word, count, ...(color ? { color } : {}) });

const stop = (world: WorldDraft, ask: string, narration = 'Look closely and count with me.', why = 'Touch each one as you count. The last number tells how many.'): StopDraft =>
  ({ kind: modeOf(world), ideaIndex: 0, sceneWords: [], imagePrompt: '', correctWord: '', wrongWords: [], narration, ask, why, world });
const blocking = (d: StopDraft, scope = ALL) => stopChecks(d, 1, scope).blocking.join(' | ');

/** One world per standard. Each must pass, build, validate, and be solved by the harness's taps. */
const COVERAGE: Array<{ standard: string; mode: string; draft: StopDraft }> = [
  { standard: 'K.CC.A.2 count on from a number', mode: 'count-on',
    draft: stop({ places: [place('cup', 'cup', 'rows', [c(5, 'frog')]), place('b', 'group', 'rows', [c(3, 'frog')])], events: [], answer: { kind: 'number', countPlaces: ['cup', 'b'] } },
      'How many frogs are there in all?', 'Five frogs hide under the cup. More frogs sit outside.', 'Start at five and count on.') },
  { standard: 'K.CC.A.3 numerals: tap the number that tells how many', mode: 'how-many',
    draft: stop({ places: [place('a', 'group', 'scattered', [c(7)])], events: [], answer: { kind: 'number', countPlaces: ['a'] } }, 'How many apples are there?', 'Apples fell in the grass!') },
  { standard: 'K.CC.B.4a one-to-one: count out', mode: 'count-out',
    draft: stop({ places: [place('pile', 'pile', 'scattered', [c(9)]), place('bk', 'basket', 'rows')], events: [], answer: { kind: 'move', goal: [{ places: ['bk'], count: 5 }] } },
      'Can you put five apples in the basket?', 'Look at all these apples!', 'Count each one as it goes in. Stop at the number.') },
  { standard: 'K.CC.B.4b the last number is how many', mode: 'how-many',
    draft: stop({ places: [place('a', 'group', 'rows', [c(5)]), place('b', 'group', 'line', [c(4)]), place('c', 'group', 'rows', [c(6)])], events: [], answer: { kind: 'tap', rule: 'has', number: 5 } },
      'Which group has five?') },
  { standard: 'K.CC.B.4c each next number is one more', mode: 'more-fewer',
    draft: stop({ places: [place('r', 'group', 'line', [c(4, 'duck')]), place('a', 'group', 'rows', [c(5)]), place('b', 'group', 'line', [c(3)]), place('d', 'group', 'rows', [c(6)])], events: [], answer: { kind: 'tap', rule: 'one-more-than', ref: 'r' } },
      'Which group has one more?', 'Here are four ducks. Count them!') },
  { standard: 'K.CC.B.5 how many, rows to 20', mode: 'how-many',
    draft: stop({ places: [place('a', 'group', 'rows', [c(14)]), place('b', 'group', 'rows', [c(13)]), place('d', 'group', 'rows', [c(16)])], events: [], answer: { kind: 'tap', rule: 'has', number: 14 } },
      'Which group has fourteen?') },
  { standard: 'K.CC.C.6 more, by counting not length', mode: 'more-fewer',
    draft: stop({ places: [place('a', 'group', 'line', [c(7, 'duck')]), place('b', 'group', 'rows', [c(8, 'duck')])], events: [], answer: { kind: 'tap', rule: 'most' } }, 'Which group has more?') },
  { standard: 'K.CC.C.6 the same', mode: 'more-fewer',
    draft: stop({ places: [place('r', 'group', 'line', [c(6, 'duck')]), place('a', 'group', 'rows', [c(6)]), place('b', 'group', 'line', [c(5)]), place('d', 'group', 'rows', [c(7)])], events: [], answer: { kind: 'tap', rule: 'same-as', ref: 'r' } },
      'Which group has the same number?', 'Here are some ducks in a line.') },
  { standard: 'K.OA.A.1-2 add to (join)', mode: 'add-take',
    draft: stop({ places: [place('pond', 'group', 'rows', [c(3, 'duck')])], events: [{ kind: 'join', place: 'pond', word: 'duck', count: 2 }], answer: { kind: 'number', countPlaces: ['pond'] } },
      'How many ducks are in the pond now?', 'Three ducks swim. Two more ducks come!') },
  { standard: 'K.OA.A.1-2 take from (leave)', mode: 'add-take',
    draft: stop({ places: [place('tree', 'group', 'line', [c(7, 'bird')])], events: [{ kind: 'leave', place: 'tree', word: 'bird', count: 3 }], answer: { kind: 'number', countPlaces: ['tree'] } },
      'How many birds are left?', 'Seven birds sit. Three fly away!') },
  { standard: 'K.OA.A.3 decompose into two parts', mode: 'parts',
    draft: stop({ places: [place('pile', 'pile', 'rows', [c(5)]), place('p1', 'plate', 'rows'), place('p2', 'plate', 'rows')], events: [],
      answer: { kind: 'move', goal: [{ places: ['p1', 'p2'], count: 5 }, { places: ['p1'], atLeast: 1 }, { places: ['p2'], atLeast: 1 }] } },
      'Can you put all five apples on the two plates?', 'Two friends share apples.', 'Every apple goes on a plate. Both plates get some.') },
  { standard: 'K.OA.A.4 make ten', mode: 'parts',
    draft: stop({ places: [place('f', 'ten-frame', 'ten-frame', [c(7)]), place('pile', 'pile', 'rows', [c(5)])], events: [], answer: { kind: 'move', goal: [{ places: ['f'], full: true }] } },
      'Can you fill the frame?', 'The frame has some apples.', 'Put one in each empty box. Count as you go.') },
  { standard: 'K.OA.A.5 add within 5', mode: 'add-take',
    draft: stop({ places: [place('n', 'group', 'ten-frame', [c(2, 'egg')])], events: [{ kind: 'join', place: 'n', word: 'egg', count: 2 }], answer: { kind: 'number', countPlaces: ['n'] } },
      'How many eggs now?', 'Two eggs sit in the nest. Two more come!') },
  { standard: 'K.NBT.A.1 teen as ten and some more (count)', mode: 'teens',
    draft: stop({ places: [place('f', 'ten-frame', 'ten-frame', [c(13)])], events: [], answer: { kind: 'number', countPlaces: ['f'] } },
      'How many apples are there?', 'One frame is full. Some more wait in the next one.', 'Ten in the full frame. Count on the rest.') },
  { standard: 'K.NBT.A.1 build a teen', mode: 'teens',
    draft: stop({ places: [place('f', 'ten-frame', 'ten-frame'), place('pile', 'pile', 'rows', [c(17)])], events: [], answer: { kind: 'move', goal: [{ places: ['f'], count: 14 }] } },
      'Can you make fourteen in the frames?', 'Here is a big pile of apples.', 'Fill one frame. Then put some more.') },
  { standard: 'K.MD.B.3 sort by colour', mode: 'sort-count',
    draft: stop({ places: [place('pile', 'pile', 'scattered', [c(4, 'apple', 'red'), c(3, 'apple', 'blue')]), place('rp', 'plate', 'rows', [], 'red')], events: [],
      answer: { kind: 'move', goal: [{ places: ['rp'], only: true, color: 'red' }] } },
      'Can you put the red ones on the red plate?', 'Red and blue counters got mixed up!', 'Look at the colour. Only red goes on the red plate.') },
  { standard: 'K.MD.B.3 count one kind', mode: 'sort-count',
    draft: stop({ places: [place('pile', 'pile', 'scattered', [c(4, 'apple', 'red'), c(3, 'apple', 'blue')])], events: [], answer: { kind: 'number', countPlaces: ['pile'], countColor: 'blue' } },
      'How many blue ones are there?', 'Red and blue counters!', 'Touch only the blue ones as you count.') },
];

describe('coverage (I2): one world per K math standard', () => {
  it.each(COVERAGE)('$standard', ({ draft, mode }) => {
    expect(draft.kind).toBe(mode);
    expect(stopChecks(draft, 1, ALL).blocking).toEqual([]);
    const [built] = buildStops([draft], ['idea'], 5, []);
    expect(built.challengeType).toBe(mode);
    validateWonderWalkData({ title: 't', bigIdea: 'b', domain: 'math', gradeBand: 'K', challengeType: mode, challenges: [built, { ...built, id: 'stop-2' }] });
    // The harness can finish it: a move world reaches its goal; a tap or number world names a choice on screen.
    const taps = stopHarnessTaps(built);
    expect(taps.correct.length).toBeGreaterThan(0);
    if (built.world!.answer.kind === 'move') {
      const plan = solveMove(built.world!)!;
      const at = new Map(built.world!.objects.map(o => [o.id, o.place]));
      plan.forEach(m => at.set(m.object, m.to));
      expect(goalHolds(built.world!.answer.goal, built.world!.objects.map(o => ({ ...o, place: at.get(o.id)! })), id => built.world!.places.find(p => p.id === id)?.kind)).toBe(true);
    }
  });
  it('covers every math mode', () => {
    expect(new Set(COVERAGE.map(x => x.mode))).toEqual(new Set(MATH_MODES));
  });
});

describe('key and mode (I4): code derives them from the world', () => {
  it('number answers count after the story; taps follow the rule; the mode comes from the structure', () => {
    expect(worldKey(COVERAGE[8].draft.world!)).toEqual({ number: 5 });
    expect(worldKey(COVERAGE[9].draft.world!)).toEqual({ number: 4 });
    expect(worldKey(COVERAGE[0].draft.world!)).toEqual({ number: 8 });
    expect(worldKey(COVERAGE[4].draft.world!)).toEqual({ place: 'a' });
    expect(modeOf({ ...COVERAGE[1].draft.world!, events: [{ kind: 'join', place: 'a', word: 'apple', count: 1 }] })).toBe('add-take');
  });
  it('the number choices are code-picked: the answer, one off, and a part of the story', () => {
    const [built] = buildStops([COVERAGE[8].draft], ['idea'], 3, []);
    const a = built.world!.answer;
    expect(a.kind === 'number' && a.choices.includes(5) && a.choices.length === 3).toBe(true);
    expect(built.correctOptionId).toBe('num-5');
    expect(built.world!.objects.filter(o => o.event === 'join')).toHaveLength(2);
  });
});

describe('shortcuts (I5): a world a child can solve without the skill is blocked', () => {
  const groups = (counts: number[], arr: P['arrangement'][] = counts.map(() => 'rows')) =>
    counts.map((n, i) => place('abc'[i], 'group', arr[i], [c(n)]));
  it('pick by size, odd one out, match the shape', () => {
    expect(blocking(stop({ places: groups([9, 2, 4]), events: [], answer: { kind: 'tap', rule: 'has', number: 9 } }, 'Which group has nine?'))).toContain('how big it looks');
    expect(blocking(stop({ places: groups([6, 5, 7], ['scattered', 'rows', 'rows']), events: [], answer: { kind: 'tap', rule: 'has', number: 6 } }, 'Which group has six?'))).toContain('odd one out');
    expect(blocking(stop({ places: [place('r', 'group', 'ten-frame', [c(5)]), ...groups([5, 4, 6]).map((p, i) => ({ ...p, arrangement: (i === 0 ? 'ten-frame' : 'rows') as P['arrangement'] }))], events: [], answer: { kind: 'tap', rule: 'same-as', ref: 'r' } }, 'Which group has the same?'))).toContain('match the shape');
  });
  it('the narration counting what the child counts: a visible addend, the ones on a teen frame', () => {
    expect(blocking(stop(COVERAGE[0].draft.world!, 'How many frogs are there in all?', 'Five frogs hide under the cup. Three more sit outside.'))).toContain('narration says 3');
    expect(blocking(stop(COVERAGE[13].draft.world!, 'How many apples are there?', 'Ten apples fill one frame and three more sit in the next.'))).toContain('narration says 3');
    expect(blocking(COVERAGE[0].draft)).toBe('');
  });
  it('the answer said aloud, a goal already true, a goal no moves reach, a skill not open', () => {
    expect(blocking(stop(COVERAGE[8].draft.world!, 'How many ducks now?', 'Three ducks swim. Two come. Now there are five!'))).toContain('narration says 5');
    expect(blocking(stop(COVERAGE[8].draft.world!, 'Are there five ducks now?', 'Three ducks swim. Two more come!'))).toContain('says 5, the answer');
    expect(blocking(stop({ places: [place('pile', 'pile', 'rows', [c(3)]), place('bk', 'basket', 'rows', [c(5)])], events: [], answer: { kind: 'move', goal: [{ places: ['bk'], count: 5 }] } }, 'Can you put five apples in the basket?'))).toContain('already holds');
    expect(blocking(stop({ places: [place('pile', 'pile', 'rows', [c(4)]), place('bk', 'basket', 'rows')], events: [], answer: { kind: 'move', goal: [{ places: ['bk'], count: 6 }] } }, 'Can you put six apples in the basket?'))).toMatch(/world has 4|at least 2 bigger/);
    expect(blocking(COVERAGE[8].draft, { ...ALL, openModes: ['how-many'] })).toContain('add-take stop');
  });
});

describe('difficulty (I6) and the walk (I7)', () => {
  it('bands follow structure', () => {
    expect(worldDifficulty(COVERAGE[12].draft.world!).band).toBe('easy'); // 2 + 2 eggs in a frame
    expect(worldDifficulty(COVERAGE[9].draft.world!).band).toBe('hard'); // 7 birds, 3 leave
    expect(worldDifficulty(COVERAGE[6].draft.world!).reasons.join(' ')).toContain('looks longer');
  });
  it('blocks one arrangement throughout, one skill when several are open, a repeated item, a stop off the tier', () => {
    const a = COVERAGE[3].draft;
    const flat = (d: StopDraft): StopDraft => ({ ...d, world: { ...d.world!, places: d.world!.places.map(p => ({ ...p, arrangement: 'rows' })) } });
    const b2 = walkChecks({ planned: true, ideas: ['x'], stops: [flat(a), flat(COVERAGE[5].draft), flat(COVERAGE[1].draft)], math: ALL }).blocking.join(' | ');
    expect(b2).toContain('drawn as rows');
    expect(b2).toContain('every math stop is how-many');
    expect(walkChecks({ planned: true, ideas: ['x'], stops: [a, COVERAGE[8].draft, a], math: ALL }).blocking.join(' ')).toContain('same item');
    expect(walkChecks({ planned: true, ideas: ['x'], stops: [COVERAGE[9].draft, COVERAGE[12].draft, COVERAGE[1].draft], math: { ...ALL, tier: 'hard' } }).blocking.join(' ')).toMatch(/math stop 1 is easy.*make it harder/);
  });
});

describe('helpers', () => {
  it('countMax reads the lesson range; scatter is seeded, one object per cell', () => {
    expect(countMax('Counting to 5')).toBe(5);
    expect(countMax('More and fewer')).toBe(10);
    expect(countMax('Teen numbers: ten and some more')).toBe(20);
    const s = scatter(10, rng(3));
    expect(new Set(s.map(([x, y]) => `${Math.floor(x * 4)},${Math.floor(y * 4)}`)).size).toBe(10);
    expect(scatter(10, rng(3))).toEqual(s);
  });
});
