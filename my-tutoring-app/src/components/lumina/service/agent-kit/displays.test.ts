import { describe, expect, it } from 'vitest';
import {
  ALL_DISPLAYS, DISPLAY_KINDS, displayErrors, displayHighlights, displayHtml, displayIssues, displayMenu, displayPrompt, displayText, displayWords,
  readDisplay, readDisplays, withHighlight, type Display, type DisplayKind,
} from './displays';

/** One valid display of every kind. The mapped type makes a new kind fail to compile until it has a row here. */
const SAMPLES: { [K in DisplayKind]: Extract<Display, { kind: K }> } = {
  svg: { kind: 'svg', svg: '<svg viewBox="0 0 10 10"><text>Leaf</text></svg>', name: 'a leaf' },
  bar_graph: { kind: 'bar_graph', title: 'Moths', labels: ['Dark', 'Light'], values: [3, 5] },
  number_line: { kind: 'number_line', min: 0, max: 4, step: 1, marks: [{ value: 2, label: '?' }] },
  table: { kind: 'table', headers: ['Pot', 'Water'], rows: [['A', 'some']] },
  text: { kind: 'text', text: 'A short line.' },
  clock: { kind: 'clock', hour: 3, minute: 30 },
  base_ten: { kind: 'base_ten', hundreds: 1, tens: 3, ones: 4 },
  pattern_blocks: { kind: 'pattern_blocks', target: 'hexagon', pieces: [{ shape: 'trapezoid', slots: [0, 1, 2] }], tray: ['triangle'] },
  ten_frame: { kind: 'ten_frame', filled: 13, second: 3 },
  array: { kind: 'array', rows: 3, columns: 4 },
  coins: { kind: 'coins', coins: ['quarter', 'dime'] },
  pictograph: { kind: 'pictograph', icon: '🍎', key_value: 2, labels: ['Red', 'Green'], values: [6, 4] },
  timeline: { kind: 'timeline', events: [{ label: 'Mill', at: 1900 }, { label: '?', at: 1950 }] },
  flow: { kind: 'flow', steps: [{ label: 'Egg', icon: '🥚' }, { label: 'Tadpole with long tail' }, { label: '?' }], loop: true },
  map: { kind: 'map', places: [{ name: 'School', x: 2, y: 8 }, { name: 'Park', x: 7, y: 3 }] },
  cell: { kind: 'cell', cell: 'animal', parts: [{ shape: 'round', label: 'control center' }, { shape: 'bean', label: '?', count: 4 }, { shape: 'dots', count: 3 }] },
  zoom: { kind: 'zoom', levels: [{ label: 'Runner', icon: '🏃' }, { label: 'Leg muscle', icon: '💪' }, { label: '?' }] },
  food_web: { kind: 'food_web', living: [{ name: 'Grass', icon: '🌿', level: 1 }, { name: 'Rabbit', level: 2 }, { name: 'Fox', level: 3 }], eats: [['Rabbit', 'Grass'], ['Fox', 'Rabbit']] },
};
const all = Object.values(SAMPLES) as Display[];

describe('every display in the registry', () => {
  it('has a sample', () => expect(Object.keys(SAMPLES).sort()).toEqual([...DISPLAY_KINDS].sort()));

  it.each(all.map(d => [d.kind, d] as const))('%s draws, describes itself and tells the author about itself', (kind, d) => {
    expect(displayErrors(d)).toEqual([]);
    expect(displayHtml(d)).not.toBe('');
    expect(displayHtml(d)).not.toMatch(/undefined|NaN/);
    expect(displayWords(d)).not.toBe('');
    expect(displayPrompt()).toContain(`{kind:"${kind}"`);
  });

  it.each(all.map(d => [d.kind, d] as const))('%s draws the same after a tool writes it', (_kind, d) => {
    const read = readDisplay(JSON.parse(JSON.stringify(d)))!;
    expect(displayErrors(read)).toEqual([]);
    expect(displayHtml(read)).toBe(displayHtml(d));
  });

  it('every highlight changes the drawing, so a help lever changes the screen', () => {
    for (const d of all) for (const value of displayHighlights(d.kind)) {
      const lit = withHighlight(d, value)!;
      expect(displayErrors(lit), `${d.kind} ${value}`).toEqual([]);
      expect(displayHtml(lit), `${d.kind} ${value}`).not.toBe(displayHtml(d));
    }
  });
});

describe('a primitive\'s menu', () => {
  it('gives a general primitive every display', () => expect(displayMenu(ALL_DISPLAYS)).toEqual([...DISPLAY_KINDS]));

  it('gives a biology primitive the science and data displays and the general ones', () => {
    const menu = displayMenu({ domains: ['science'], without: ['svg', 'text'] });
    expect(menu).toEqual(expect.arrayContaining(['table', 'bar_graph', 'pictograph', 'timeline', 'flow']));
    expect(menu).not.toEqual(expect.arrayContaining(['clock']));
    expect(menu).not.toContain('svg');
  });

  it('offers the biology displays to a biology primitive and to a general one, not to a science primitive that did not ask', () => {
    const biology = displayMenu({ domains: ['science', 'biology'] });
    expect(biology).toEqual(expect.arrayContaining(['cell', 'zoom', 'food_web', 'svg', 'flow']));
    expect(biology).not.toContain('clock');
    expect(displayMenu(ALL_DISPLAYS)).toEqual(expect.arrayContaining(['cell', 'zoom', 'food_web']));
    expect(displayMenu({ domains: ['science'] })).not.toContain('cell');
  });

  it('a cell can show a count, so two cards can differ only in how many of a part they have', () => {
    const many = readDisplay({ kind: 'cell', parts: [{ shape: 'bean', count: 9 }] })!, few = readDisplay({ kind: 'cell', parts: [{ shape: 'bean', count: 2 }] })!;
    expect(displayErrors(many)).toEqual([]);
    expect(displayHtml(many).match(/stroke="#7f1d1d"/g)).toHaveLength(9);
    expect(displayHtml(few).match(/stroke="#7f1d1d"/g)).toHaveLength(2);
  });

  it('refuses a cell it cannot draw, in sentences', () => {
    expect(displayErrors({ kind: 'cell', parts: [{ shape: 'star' as never }] }).join()).toMatch(/shape is one of/);
    expect(displayErrors({ kind: 'cell', parts: [{ shape: 'bean', count: 13 }] }).join()).toMatch(/1-12/);
    expect(displayErrors({ kind: 'cell', parts: [{ shape: 'bean', count: 12 }, { shape: 'dots', count: 12 }] }).join()).toMatch(/at most 16/);
    expect(displayErrors({ kind: 'cell', cell: 'bacterium', parts: [{ shape: 'bean', count: 12 }] }).join()).toMatch(/too many small parts/);
    expect(displayErrors({ kind: 'cell', parts: [{ shape: 'bean', label: 'a' }], highlight: 'b' }).join()).toMatch(/highlight/);
  });

  it('a food web names who eats whom in words, and refuses an arrow to nobody', () => {
    expect(displayWords(SAMPLES.food_web)).toBe('a food web: Rabbit eats Grass; Fox eats Rabbit');
    expect(displayErrors({ ...SAMPLES.food_web, eats: [['Owl', 'Grass']] }).join()).toMatch(/two different named/);
    expect(readDisplay({ kind: 'food_web', living: SAMPLES.food_web.living, eats: [{ eater: 'Fox', eaten: 'Rabbit' }] })).toMatchObject({ eats: [['Fox', 'Rabbit']] });
  });

  it('a highlight on a biology display changes the drawing', () => {
    expect(displayHtml({ ...SAMPLES.cell, highlight: 'control center' })).not.toBe(displayHtml(SAMPLES.cell));
    expect(displayHtml({ ...SAMPLES.zoom, highlight: 'Runner' })).not.toBe(displayHtml(SAMPLES.zoom));
    expect(displayHtml({ ...SAMPLES.food_web, highlight: 'Fox' })).not.toBe(displayHtml(SAMPLES.food_web));
  });

  it('the prompt lists only the menu, and a measurement can hide one more', () => {
    const cap = { domains: ['science'] as const };
    expect(displayPrompt(cap)).toContain('{kind:"flow"');
    expect(displayPrompt(cap)).not.toContain('{kind:"clock"');
    expect(displayPrompt(cap, ['flow'])).not.toContain('{kind:"flow"');
  });

  it('refuses a display off the menu and an unknown kind in a sentence', () => {
    const cap = { domains: ['science'] as const };
    expect(displayIssues([SAMPLES.clock], cap)[0]).toMatch(/clock display is not offered here; use one of/);
    expect(displayIssues(readDisplays([{ kind: 'hologram' }]), cap)[0]).toMatch(/a display kind is one of/);
    expect(displayIssues([SAMPLES.flow], cap)).toEqual([]);
  });

  it('reads a list, one display, or JSON text', () => {
    expect(readDisplays([SAMPLES.table]).map(d => d.kind)).toEqual(['table']);
    expect(readDisplays(SAMPLES.table).map(d => d.kind)).toEqual(['table']);
    expect(readDisplays(JSON.stringify(SAMPLES.table)).map(d => d.kind)).toEqual(['table']);
    expect(readDisplays(undefined)).toEqual([]);
    expect(displayIssues(readDisplays('not json'), ALL_DISPLAYS)).toHaveLength(1);
  });
});

describe('flow', () => {
  const steps = (n: number) => Array.from({ length: n }, (_, i) => ({ label: `Step ${i + 1}` }));

  it('checks what it can draw', () => {
    expect(displayErrors({ kind: 'flow', steps: steps(1) })[0]).toMatch(/2-8/);
    expect(displayErrors({ kind: 'flow', steps: steps(2), loop: true })[0]).toMatch(/at least 3/);
    expect(displayErrors({ kind: 'flow', steps: [{ label: 'a' }, { label: 'a' }] })[0]).toMatch(/share a label/);
    expect(displayErrors({ kind: 'flow', steps: steps(3), highlight: 'nope' })[0]).toMatch(/highlight/);
  });

  it('draws a chain of any allowed length, and says a loop goes back to the start', () => {
    for (let n = 2; n <= 8; n++) {
      expect(displayHtml({ kind: 'flow', steps: steps(n) })).not.toMatch(/NaN|undefined/);
      if (n >= 3) expect(displayHtml({ kind: 'flow', steps: steps(n), loop: true })).not.toMatch(/NaN|undefined/);
    }
    expect(displayWords({ kind: 'flow', steps: steps(3), loop: true })).toMatch(/back to the start$/);
    expect(displayWords({ kind: 'flow', steps: steps(3) })).toBe('a flow: Step 1, then Step 2, then Step 3');
  });

  it('a highlight changes the drawing', () => {
    const d: Display = { kind: 'flow', steps: steps(3) };
    expect(displayHtml({ ...d, highlight: 'Step 2' } as Display)).not.toBe(displayHtml(d));
  });
});

describe('displayText', () => {
  it('reads the words a child sees in an agent drawing', () => {
    expect(displayText(SAMPLES.svg)).toMatch(/Leaf/);
    expect(displayText(SAMPLES.svg)).toMatch(/a leaf/);
    expect(displayText(SAMPLES.bar_graph)).toMatch(/Dark 3/);
  });
});
