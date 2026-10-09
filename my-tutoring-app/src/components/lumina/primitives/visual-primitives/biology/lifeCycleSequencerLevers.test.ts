/**
 * life-cycle-sequencer levers, pure: which lever answers which miss, the leak rules (`keptLeaks`, `practiceLeaks`), and
 * the practice builder over many items (same shape, three stages, solvable, never the item or its organism).
 */
import { describe, expect, it } from 'vitest';
import { nextLever } from '../../../components/live-activity/runtime/observerLever';
import type { LifeCycleSequencerData } from './LifeCycleSequencer';
import { CYCLE_MISSES, cycleMiss, lifeCycleItem, type CycleMiss } from './lifeCycleSequencerWorkspace';
import { ARROW_LEVER, FEWER_LEVER, KEEP_LEVER, cycleLeverFacts, cycleLevers, keptLeaks, keptSlots, lifeCycleJourneyItem,
  practiceCycle, practiceLeaks } from './lifeCycleSequencerLevers';

const data = (cycleType: LifeCycleSequencerData['cycleType'], labels: string[], title = 'Life of a frog'): LifeCycleSequencerData => ({
  title, instructions: 'Put the pictures in order.', cycleType, gradeBand: 'K-2', scaleContext: '',
  misconceptionTrap: { commonError: '', correction: '' },
  stages: labels.map((label, i) => ({ id: `s${i}`, label, imagePrompt: '', description: `${label} picture.`, correctPosition: i,
    transitionToNext: '', duration: null })) });
const FROG = lifeCycleItem(data('linear', ['Frog Eggs', 'Tadpole', 'Froglet', 'Adult Frog']));
const WATER = lifeCycleItem(data('circular', ['Evaporation', 'Condensation', 'Precipitation', 'Collection'], 'The water cycle'));
const THREE = lifeCycleItem(data('linear', ['Seed', 'Sprout', 'Plant'], 'A bean'));

describe('declarations', () => {
  it('every order miss is answered by a lever; cycle_rotated by none (catalog unanswered)', () => {
    for (const item of [FROG, WATER]) {
      const levers = cycleLevers(item, []);
      expect(levers.map(l => l.id)).toEqual([ARROW_LEVER, KEEP_LEVER, FEWER_LEVER]);
      for (const miss of CYCLE_MISSES.filter(m => m !== 'cycle_rotated'))
        expect(levers.some(l => l.answers?.includes(miss))).toBe(true);
      expect(levers.some(l => l.answers?.includes('cycle_rotated'))).toBe(false);
    }
  });

  it.each<[CycleMiss, string]>([
    ['reversed', ARROW_LEVER], ['mixed_order', ARROW_LEVER], ['adjacent_swap', KEEP_LEVER],
    ['two_swapped', KEEP_LEVER], ['one_moved', KEEP_LEVER],
  ])('after %s the next lever is %s', (miss, lever) => {
    expect(nextLever(cycleLevers(FROG, []), miss)).toBe(lever);
  });

  it('a 3-stage item offers no simplify; a practice item carries no levers', () => {
    expect(cycleLevers(THREE, []).map(l => l.id)).toEqual([ARROW_LEVER, KEEP_LEVER]);
    expect(cycleLevers(practiceCycle(FROG), [])).toEqual([]);
  });

  it('the arrow fact names no stage; a circle adds the way back', () => {
    for (const item of [FROG, WATER]) {
      const fact = cycleLeverFacts(item, [ARROW_LEVER], {});
      expect(item.stages.some(s => fact.includes(s.label))).toBe(false);
    }
    expect(cycleLeverFacts(WATER, [ARROW_LEVER], {})).toMatch(/back to slot 1/);
    expect(cycleLeverFacts(FROG, [ARROW_LEVER], {})).not.toMatch(/back to slot 1/);
  });
});

describe('keep_right', () => {
  const slots = (...ps: number[]) => ps.map(p => `s${p}`);
  const marks = (seq: number[]) => ({ right: seq.flatMap((p, i) => (p === i ? [i] : [])), wrong: seq.flatMap((p, i) => (p === i ? [] : [i])) });

  it('locks only the slots the check marked right, with their stages', () => {
    const seq = [1, 0, 2, 3];
    expect(keptSlots(FROG, slots(...seq), marks(seq))).toEqual({ 2: 's2', 3: 's3' });
    expect(cycleMiss(FROG, slots(...seq))).toBe('adjacent_swap');
  });

  it('refuses before a check, with none right, or with all right', () => {
    expect(keptSlots(FROG, slots(1, 0, 2, 3), null)).toBeNull();
    expect(keptSlots(FROG, slots(3, 2, 1, 0), marks([3, 2, 1, 0]))).toBeNull();
    expect(keptSlots(FROG, slots(0, 1, 2, 3), marks([0, 1, 2, 3]))).toBeNull();
  });

  it('leak rule: never a stage outside its right slot, never the whole order', () => {
    expect(keptLeaks(FROG, { 0: 's0', 1: 's1' })).toBe(false);
    expect(keptLeaks(FROG, { 0: 's1' })).toBe(true);
    expect(keptLeaks(FROG, { 0: 's0', 1: 's1', 2: 's2', 3: 's3' })).toBe(true);
    // A mark list that lies (a wrong slot reported right) is refused by the rule, not drawn.
    expect(keptSlots(FROG, slots(1, 0, 2, 3), { right: [0, 2], wrong: [1, 3] })).toBeNull();
  });

  it('the fact names only kept stages', () => {
    const fact = cycleLeverFacts(FROG, [KEEP_LEVER], { 2: 's2', 3: 's3' });
    expect(fact).toMatch(/slot 3 "Froglet", slot 4 "Adult Frog"/);
    expect(fact).not.toMatch(/Tadpole|Frog Eggs/);
  });
});

describe('fewer_stages', () => {
  const ORGANISMS = ['Butterfly', 'Frog', 'Chicken', 'Sunflower', 'Bean', 'Dog', 'Ladybug', 'Salmon', 'Apple Tree', 'Human',
    'Water', 'Rock', 'Moon', 'Seasons', 'Day'];
  const items = ORGANISMS.flatMap(o => (['linear', 'circular'] as const).map(shape =>
    lifeCycleItem(data(shape, [`${o} egg`, `Young ${o}`, `Growing ${o}`, `Adult ${o}`, `Old ${o}`].slice(0, 4 + (o.length % 2)),
      `Life cycle of a ${o.toLowerCase()}`))));

  it.each(items.map(i => [i.title, i.cycleType, i] as const))('%s (%s): same shape, 3 stages, solvable, no shared word', (_t, _c, item) => {
    const p = practiceCycle(item);
    if (!p) return; // every pool entry was about the item's own subject: no simplify is declared
    expect(p.id).toBe('cycle~simpler');
    expect(p.cycleType).toBe(item.cycleType);
    expect(p.stages.map(s => s.correctPosition)).toEqual([0, 1, 2]);
    expect(practiceLeaks(p, item)).toBe(false);
    const own = `${item.title} ${item.stages.map(s => s.label).join(' ')}`.toLowerCase();
    expect(p.stages.some(s => own.includes(s.label.toLowerCase()))).toBe(false);
  });

  it('almost every 4+ stage item gets one', () => {
    expect(items.filter(i => practiceCycle(i)).length).toBeGreaterThanOrEqual(items.length - 2);
  });

  it('never the item\'s own subject: a water cycle gets no rain practice, a sunflower no sunflower', () => {
    expect(practiceCycle(WATER)!.title).not.toMatch(/rain/i);
    const sun = lifeCycleItem(data('linear', ['Sunflower seed', 'Sprout', 'Bud', 'Bloom'], 'How a sunflower grows'));
    expect(practiceCycle(sun)!.title).not.toMatch(/sunflower/i);
  });

  it('the journey rebuilds the practice item from its id', () => {
    const d = data('linear', ['Frog Eggs', 'Tadpole', 'Froglet', 'Adult Frog']);
    expect(lifeCycleJourneyItem(d, 'cycle')!.id).toBe('cycle');
    expect(lifeCycleJourneyItem(d, 'cycle~simpler')).toEqual(practiceCycle(FROG));
    expect(lifeCycleJourneyItem(d, 'other')).toBeNull();
  });

  it('leak rule: refuses the item itself, another shape, as many stages, or a shared word', () => {
    const p = practiceCycle(FROG)!;
    expect(practiceLeaks({ ...p, id: 'cycle' }, FROG)).toBe(true);
    expect(practiceLeaks({ ...p, cycleType: 'circular' }, FROG)).toBe(true);
    expect(practiceLeaks({ ...p, stages: [...p.stages, { ...p.stages[0], id: 'p-3' }] }, FROG)).toBe(true);
    expect(practiceLeaks({ ...p, stages: [{ ...p.stages[0], label: 'Tiny Tadpole' }, ...p.stages.slice(1)] }, FROG)).toBe(true);
  });
});

