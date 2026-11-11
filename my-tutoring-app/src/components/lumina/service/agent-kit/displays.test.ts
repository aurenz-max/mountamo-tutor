import { describe, expect, it } from 'vitest';
import {
  ALL_DISPLAYS, DISPLAY_KINDS, POINT_KINDS, displayErrors, displayHighlights, displayHtml, displayParts, displayPointed, displaySeen, displayIssues, displayLoad, displayMenu, displayPrompt, displayText, displayWords,
  readDisplay, readDisplays, withHighlight, type Display, type DisplayKind,
} from './displays';

/** One valid display of every kind. The mapped type makes a new kind fail to compile until it has a row here. */
const SAMPLES: { [K in DisplayKind]: Extract<Display, { kind: K }> } = {
  svg: { kind: 'svg', svg: '<svg viewBox="0 0 10 10"><text>Leaf</text></svg>', name: 'a leaf' },
  bar_graph: { kind: 'bar_graph', title: 'Moths', labels: ['Dark', 'Light'], values: [3, 5] },
  chart: { kind: 'chart', chart_type: 'line', title: 'Plant height', x_label: 'Week', y_label: 'cm', points: [{ label: '1', value: 2 }, { label: '2', value: 5 }, { label: '6', value: 9 }] },
  number_line: { kind: 'number_line', min: 0, max: 4, step: 1, marks: [{ value: 2, label: '?' }, { value: 1, label: 'A' }, { value: 3, label: 'B' }] },
  table: { kind: 'table', headers: ['Pot', 'Water'], rows: [['A', 'some'], ['B', 'none']] },
  text: { kind: 'text', text: 'A short line.' },
  passage: { kind: 'passage', title: 'Bees', sentences: ['Bees make honey.', 'They store it in wax.', 'It lasts for years.'] },
  clock: { kind: 'clock', hour: 3, minute: 30 },
  base_ten: { kind: 'base_ten', hundreds: 1, tens: 3, ones: 4 },
  pattern_blocks: { kind: 'pattern_blocks', target: 'hexagon', pieces: [{ shape: 'trapezoid', slots: [0, 1, 2] }], tray: ['triangle'] },
  ten_frame: { kind: 'ten_frame', filled: 13, second: 3 },
  array: { kind: 'array', rows: 3, columns: 4 },
  coins: { kind: 'coins', coins: ['quarter', 'dime'] },
  shares: { kind: 'shares', shape: 'rectangle', wide: 6, tall: 4, cuts: [3], across: [2], shaded: 1 },
  pictograph: { kind: 'pictograph', icon: '🍎', key_value: 2, labels: ['Red', 'Green'], values: [6, 4] },
  timeline: { kind: 'timeline', events: [{ label: 'Mill', at: 1900 }, { label: '?', at: 1950 }] },
  flow: { kind: 'flow', steps: [{ label: 'Egg', icon: '🥚' }, { label: 'Tadpole with long tail' }, { label: '?' }], loop: true },
  map: { kind: 'map', places: [{ name: 'School', x: 2, y: 8 }, { name: 'Park', x: 7, y: 3 }] },
  cell: { kind: 'cell', cell: 'animal', parts: [{ shape: 'round', label: 'control center' }, { shape: 'bean', label: '?', count: 4 }, { shape: 'dots', count: 3 }] },
  zoom: { kind: 'zoom', levels: [{ label: 'Runner', icon: '🏃' }, { label: 'Leg muscle', icon: '💪' }, { label: '?' }] },
  food_web: { kind: 'food_web', living: [{ name: 'Grass', icon: '🌿', level: 1 }, { name: 'Rabbit', level: 2 }, { name: 'Fox', level: 3 }], eats: [['Rabbit', 'Grass'], ['Fox', 'Rabbit']] },
  system: { kind: 'system', title: 'Digger arm', parts: [{ id: 'push', label: 'Piston push', value: 2, min: 1, max: 6 }, { id: 'rock', label: 'Rock', value: 8, unit: 'tons' }],
    rules: [{ id: 'force', label: 'Lift force', op: 'multiply', of: ['push', 2] }, { id: 'lifts', label: 'Lifts the rock', op: 'at_least', of: ['force', 'rock'] }] },
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

describe('a display with parts to tap (the point surface)', () => {
  const boards = all.filter(d => POINT_KINDS.includes(d.kind));

  it('covers the displays whose parts carry a name', () => {
    expect([...POINT_KINDS].sort()).toEqual(['cell', 'chart', 'flow', 'food_web', 'map', 'number_line', 'passage', 'pictograph', 'table', 'timeline', 'zoom']);
  });

  it.each(boards.map(d => [d.kind, d] as const))('%s draws one tap shape per part, and a tapped part changes the drawing', (_kind, d) => {
    const parts = displayParts(d), html = displayHtml(d);
    expect(parts.length).toBeGreaterThan(0);
    expect(parts).not.toContain('?');
    const drawn = Array.from(html.matchAll(/data-part="([^"]*)"/g)).map(m => m[1]);
    expect(drawn.sort()).toEqual([...parts].sort());
    for (const part of parts) {
      const lit = displayPointed(d, part);
      expect(displayErrors(lit), part).toEqual([]);
      expect(displayHtml(lit), part).not.toBe(html);
    }
    expect(displayPointed(d, 'no such part')).toBe(d);
  });

  it('names table rows by their first cell, number-line marks by their label, sentences by number and skips what is asked about', () => {
    expect(displayParts(SAMPLES.table)).toEqual(['A', 'B']);
    expect(displayParts(SAMPLES.number_line)).toEqual(['A', 'B']);
    expect(displayParts(SAMPLES.passage)).toEqual(['Sentence 1', 'Sentence 2', 'Sentence 3']);
    expect(displayWords(SAMPLES.passage)).toContain('(2) They store it in wax.');
  });

  it('tells a blind reader where the marks sit, and not the tutor', () => {
    expect(displaySeen(SAMPLES.number_line)).toContain('A at 1');
    expect(displayWords(SAMPLES.number_line)).not.toContain('A at 1');
    expect(displaySeen(SAMPLES.clock)).toBe(displayWords(SAMPLES.clock));
  });

  it('names a cell\'s unlabelled parts by shape, and draws no name for them', () => {
    const bare: Display = { kind: 'cell', cell: 'animal', parts: [{ shape: 'round' }, { shape: 'bean', count: 4 }, { shape: 'sac' }] };
    expect(displayParts(bare)).toEqual(['round', 'bean', 'sac']);
    expect(displayHtml(bare).match(/<text/g)).toBeNull();
    // Four beans are drawn; they are one part, so any of them answers.
    expect(displayHtml(bare).match(/<g data-part="bean">(.*?)<\/g>/)![1].match(/<ellipse/g)).toHaveLength(4);
  });

  it('a pie chart\'s slices and a bar chart\'s bars are parts; a display with no named parts has none', () => {
    const pie: Display = { kind: 'chart', chart_type: 'pie', points: [{ label: 'Rent', value: 5 }, { label: 'Food', value: 3 }, { label: 'None', value: 0 }] };
    expect(displayParts(pie)).toEqual(['Rent', 'Food']);
    expect(displayHtml(pie)).toMatch(/<path data-part="Rent"/);
    const bars: Display = { kind: 'chart', chart_type: 'bar', points: [{ label: 'A', value: 1, group: 'x' }, { label: 'A', value: 2, group: 'y' }, { label: 'B', value: 3, group: 'x' }, { label: 'B', value: 1, group: 'y' }] };
    expect(displayParts(bars)).toEqual(['A', 'B']);
    expect(displayParts(SAMPLES.clock)).toEqual([]);
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

describe('chart', () => {
  const series = (group: string, labels: string[]) => labels.map((label, i) => ({ label, value: i + 2, group }));
  const twoCities: Display = { kind: 'chart', chart_type: 'line', points: [...series('Miami', ['1990', '2000', '2020']), ...series('Boston', ['1990', '2000', '2020'])] };

  it('prints no value unless asked, so the child reads it from the axis', () => {
    const d: Display = { kind: 'chart', chart_type: 'bar', points: [{ label: 'Oak', value: 37 }, { label: 'Elm', value: 12 }] };
    expect(displayHtml(d)).not.toContain('>37<');
    expect(displayHtml({ ...d, show_values: true } as Display)).toContain('>37<');
  });

  it('spaces numeric years to scale on a line', () => {
    const cx = (d: Display) => Array.from(displayHtml(d).matchAll(/<circle cx="([\d.]+)"/g)).map(m => Number(m[1]));
    const [a, b, c] = cx({ kind: 'chart', chart_type: 'line', points: [{ label: '1900', value: 1 }, { label: '1910', value: 2 }, { label: '2000', value: 3 }] });
    expect((c - b) / (b - a)).toBeCloseTo(9, 0);
  });

  it('draws groups with a legend and tells lines apart without color, and states every value in words', () => {
    expect(displayHtml(twoCities)).toContain('>Boston<');
    expect(displayHtml(twoCities)).toContain('stroke-dasharray="7 4"');
    expect(displayWords(twoCities)).toBe('a line chart: Miami: 1990 2, 2000 3, 2020 4; Boston: 1990 2, 2000 3, 2020 4');
  });

  it('draws negative values and all zeros without a broken axis', () => {
    expect(displayHtml({ kind: 'chart', chart_type: 'bar', points: [{ label: 'Jan', value: -4.5 }, { label: 'Jul', value: 20 }] })).not.toMatch(/NaN|undefined|Infinity/);
    expect(displayHtml({ kind: 'chart', chart_type: 'line', points: [{ label: 'a', value: 0 }, { label: 'b', value: 0 }, { label: 'c', value: 0 }] })).not.toMatch(/NaN|undefined|Infinity/);
  });

  it('a pie draws a slice per part and one whole slice as a circle', () => {
    expect(displayHtml({ kind: 'chart', chart_type: 'pie', points: [{ label: 'Rice', value: 3 }, { label: 'Beans', value: 1 }] }).match(/<path/g)).toHaveLength(2);
    expect(displayHtml({ kind: 'chart', chart_type: 'pie', points: [{ label: 'Rice', value: 3 }, { label: 'Beans', value: 0 }] })).toContain('<circle');
  });

  it('a highlight on a point or a group changes the drawing', () => {
    expect(displayHtml({ ...twoCities, highlight: 'Boston' } as Display)).not.toBe(displayHtml(twoCities));
    expect(displayHtml({ ...twoCities, highlight: '2000' } as Display)).not.toBe(displayHtml(twoCities));
    expect(displayErrors({ ...twoCities, highlight: 'Paris' } as Display).join()).toMatch(/highlight/);
  });

  it('refuses a chart it cannot draw, in sentences', () => {
    expect(displayErrors({ kind: 'chart', chart_type: 'area' as never, points: [] }).join()).toMatch(/bar, line or pie/);
    expect(displayErrors({ kind: 'chart', chart_type: 'line', points: [{ label: 'a', value: 1 }, { label: 'b', value: 2 }] }).join()).toMatch(/at least 3 points/);
    expect(displayErrors({ kind: 'chart', chart_type: 'pie', points: [{ label: 'a', value: 0 }, { label: 'b', value: 0 }] }).join()).toMatch(/larger than 0/);
    expect(displayErrors({ kind: 'chart', chart_type: 'bar', points: [{ label: 'a very long label for one bar', value: 1 }, { label: 'b', value: 2 }] }).join()).toMatch(/at most 20/);
  });

  it('counts a chart that compares groups as more reading', () => {
    expect(displayLoad(twoCities)!.score).toBeGreaterThan(displayLoad(SAMPLES.chart)!.score);
  });
});

describe('displayText', () => {
  it('reads the words a child sees in an agent drawing', () => {
    expect(displayText(SAMPLES.svg)).toMatch(/Leaf/);
    expect(displayText(SAMPLES.svg)).toMatch(/a leaf/);
    expect(displayText(SAMPLES.bar_graph)).toMatch(/Dark 3/);
  });
});
