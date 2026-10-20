/**
 * constellation-builder misses and levers, pure: each wrong answer names its miss, the next lever after each miss,
 * and the easier item over every saved payload item (same mode, one step less, never a name the item shows).
 */
import { readFileSync } from 'fs';
import { join } from 'path';
import { describe, expect, it } from 'vitest';
import { nextLever } from '../../../components/live-activity/runtime/observerLever';
import type { ConstellationBuilderData, ConstellationChallenge } from './ConstellationBuilder';
import { CONSTELLATION_LEVERS, practiceItem, practiceLeaks } from './constellationLevers';
import { freeMiss, guidedMiss, identifyOptions, nameMiss, shownInstruction } from './constellationWorkspace';

const line = (a: string, b: string) => ({ fromStarId: a, toStarId: b });
const item = (type: ConstellationChallenge['type'], extra: Partial<ConstellationChallenge> = {}): ConstellationChallenge => ({
  id: type, type, constellationName: 'Orion', instruction: 'q', starOrder: ['a', 'b', 'c', 'd', 'e'],
  correctConnections: [line('a', 'b'), line('b', 'c'), line('c', 'd'), line('d', 'e')], mythologyFact: '', season: 'winter',
  distractorName0: 'Leo', distractorName1: 'Cygnus', ...extra });
const PAYLOADS = ['guided_trace', 'free_connect', 'identify', 'seasonal'].map(mode => (JSON.parse(readFileSync(join(process.cwd(),
  `src/components/lumina/components/live-activity/runtime/testing/w1-payloads/constellation-builder.${mode}.json`), 'utf-8')).data) as ConstellationBuilderData);

describe('misses', () => {
  it.each([
    ['guided: a later star', () => guidedMiss(item('guided_trace'), 1, 'd'), 'later_star'],
    ['guided: a star already joined', () => guidedMiss(item('guided_trace'), 2, 'a'), 'traced_star'],
    ['guided: a star not in the order', () => guidedMiss(item('guided_trace'), 0, 'z'), 'other_star'],
    ['free: a dim star', () => freeMiss(item('free_connect'), 'z'), 'background_star'],
    ['free: two pattern stars not joined', () => freeMiss(item('free_connect'), 'c'), 'wrong_pair'],
    ['identify: another name', () => nameMiss(item('identify'), ['Leo']), 'wrong_name'],
    ['seasonal: one other name', () => nameMiss(item('seasonal'), ['Leo']), 'other_name'],
    ['seasonal: two names', () => nameMiss(item('seasonal'), ['Orion', 'Leo']), 'several_names'],
    ['seasonal: the answer', () => nameMiss(item('seasonal'), ['orion']), undefined],
  ])('%s', (_name, miss, want) => expect(miss()).toBe(want));

  it.each([
    ['guided_trace', 'later_star', 'spotlight'], ['guided_trace', 'other_star', 'spotlight'],
    ['free_connect', 'wrong_pair', 'shape_card'], ['free_connect', 'background_star', 'shape_card'],
    ['identify', 'wrong_name', 'easier_pattern'], ['seasonal', 'several_names', 'easier_pattern'],
  ] as const)('%s: after %s the next lever is %s', (mode, miss, lever) =>
    expect(nextLever(CONSTELLATION_LEVERS.declare(item(mode), { membersBright: true }, []), miss)).toBe(lever));

  it('bright stars is offered only where the tier drew every star by its own brightness', () => {
    expect(CONSTELLATION_LEVERS.declare(item('free_connect'), { membersBright: true }, []).map(l => l.id)).not.toContain('bright_stars');
    expect(CONSTELLATION_LEVERS.declare(item('free_connect'), { membersBright: false }, []).map(l => l.id)).toContain('bright_stars');
  });
});

describe('the easier item', () => {
  it('every saved payload item bigger than the smallest pattern has one, of the same mode and one step less, with no name it must not use', () => {
    for (const d of PAYLOADS) for (const c of d.challenges) {
      const p = practiceItem(c, d.challenges);
      // Orion's Belt (3 stars) is already as small as the smallest pattern: its help lever answers its misses.
      if (c.type === 'free_connect' && c.correctConnections.length <= 2) { expect(p).toBeNull(); continue; }
      expect(p, `${c.type} ${c.id}`).not.toBeNull();
      expect(practiceLeaks(c, p!, d.challenges), `${c.type} ${c.id}`).toBe(false);
      const shown = c.type === 'identify' ? identifyOptions(c) : [c.constellationName];
      for (const n of [p!.constellationName, ...(p!.choices ?? [])]) expect(shown).not.toContain(n);
      // Every line of a practice trace joins two of its own stars.
      const ids = new Set((p!.stars ?? []).map(s => s.id));
      for (const l of p!.correctConnections) expect(ids.has(l.fromStarId) && ids.has(l.toStarId)).toBe(true);
    }
  });

  it('a trace already as small as the smallest pattern has none; a name item whose names cover the library has none', () => {
    const three = item('guided_trace', { starOrder: ['a', 'b', 'c'], correctConnections: [line('a', 'b'), line('b', 'c')] });
    expect(practiceItem(three)).toBeNull();
    expect(practiceItem(item('free_connect', { correctConnections: [line('a', 'b'), line('b', 'c')] }))).toBeNull();
    expect(practiceItem(item('free_connect', { correctConnections: [line('a', 'b'), line('b', 'c'), line('c', 'd')] }))!.constellationName)
      .toBe('Summer Triangle');
    expect(practiceItem(item('identify', { constellationName: 'Pegasus', distractorName0: 'Cassiopeia', distractorName1: 'Cygnus',
      distractorName2: 'Orion' }))!.choices).toEqual(['Big Dipper', 'Leo']);
  });

  it('a seasonal practice item asks about another season, with a foil from a third one', () => {
    const p = practiceItem(item('seasonal'))!;
    expect(p.season).not.toBe('winter');
    // Big Dipper (spring) is the item's answer: the practice asks about fall, and its foil is not a spring name.
    const spring = practiceItem(item('seasonal', { constellationName: 'Big Dipper', season: 'spring' }))!;
    expect([spring.season, spring.choices]).toEqual(['fall', ['Pegasus', 'Cygnus']]);
    expect(shownInstruction(p)).toMatch(new RegExp(p.season));
    expect(p.choices).toHaveLength(2);
  });
});

it('identify and seasonal show the plain question, whatever the generator wrote', () => {
  for (const d of PAYLOADS) for (const c of d.challenges) {
    if (c.type !== 'identify' && c.type !== 'seasonal') continue;
    expect(shownInstruction(c)).not.toMatch(new RegExp(c.constellationName, 'i'));
    expect(shownInstruction(c)).not.toMatch(/hunter|belt|queen|lion|beast|bowl|handle|zigzag|W\b|swan|flying|five/i);
  }
});
