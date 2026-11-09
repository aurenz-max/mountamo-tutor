import { describe, expect, it } from 'vitest';
import { displayErrors, displayHtml, displayWords, sanitizeSvg, withHighlight, type Display } from './displays';
import { buildSurfaceLevers, readDraft } from './itemLoop';
import {
  difficultyOf, gradeAnswer, inAnswerOrder, itemErrors, missHint, rightAnswer, shortcutChecks, shownOrder, wrongAnswer, type SurfaceItem,
} from './surfaces';

const base = { stimulus: [], tier: 'medium' as const, difficulty: { band: 'easy' as const, score: 0, reasons: [] } };
const graph = { kind: 'bar_graph' as const, title: 'Pets', labels: ['Cat', 'Dog', 'Fish'], values: [4, 7, 2] };

const choose: SurfaceItem = { ...base, id: 'c', surface: 'choose', prompt: 'How many more chose Dog than Cat?', stimulus: [graph],
  options: [{ id: 'a', label: '3' }, { id: 'b', label: '11' }, { id: 'c', label: '7' }], key: 'a',
  misconceptions: { b: 'You added the two bars. "How many more" asks for the difference.', c: 'That is the Dog bar alone.' } };
const order: SurfaceItem = { ...base, id: 'o', surface: 'order', prompt: 'Put the frog\'s life in order.',
  options: [{ id: 'egg', label: 'egg' }, { id: 'tad', label: 'tadpole' }, { id: 'frog', label: 'frog' }], key: ['egg', 'tad', 'frog'] };
const sort: SurfaceItem = { ...base, id: 's', surface: 'categorize', prompt: 'Hard or soft?', categories: ['Hard', 'Soft'],
  options: [{ id: 'rock', label: 'rock' }, { id: 'pillow', label: 'pillow' }, { id: 'spoon', label: 'spoon' }],
  key: { rock: 'Hard', pillow: 'Soft', spoon: 'Hard' } };

describe('surfaces', () => {
  it('accepts well-formed items and names what a broken one lacks', () => {
    for (const it of [choose, order, sort]) expect(itemErrors(it)).toEqual([]);
    expect(itemErrors({ ...choose, key: 'zz' })).toContain('choose: the key is one option id');
    expect(itemErrors({ ...order, key: ['egg', 'tad'] })[0]).toMatch(/every option id once/);
    expect(itemErrors({ ...sort, key: { rock: 'Hard', pillow: 'Hard', spoon: 'Hard' } })[0]).toMatch(/every category gets/);
  });

  it('scores right and wrong answers and names the miss', () => {
    for (const it of [choose, order, sort]) {
      expect(gradeAnswer(it, rightAnswer(it)).correct).toBe(true);
      expect(gradeAnswer(it, wrongAnswer(it)).correct).toBe(false);
    }
    expect(gradeAnswer(choose, { choice: 'b' }).miss).toBe('wrong_choice');
    expect(gradeAnswer(order, { order: ['tad', 'egg', 'frog'] }).miss).toBe('out_of_order');
    expect(gradeAnswer(sort, { placed: { rock: 'Soft', pillow: 'Soft', spoon: 'Hard' } }).miss).toBe('misplaced');
    expect(missHint(choose, { choice: 'b' })).toMatch(/difference/);
  });

  it('never shows the cards in the answer\'s own order', () => {
    for (let seed = 1; seed < 40; seed++) {
      const o = { ...order, options: shownOrder(order, seed) };
      const s = { ...sort, options: shownOrder(sort, seed) };
      expect(inAnswerOrder(o)).toBe(false);
      expect(inAnswerOrder(s)).toBe(false);
    }
  });

  it('blocks shortcuts code can see', () => {
    expect(shortcutChecks({ ...order, prompt: 'First the egg, then the tadpole. Put it in order.' })[0]).toMatch(/order words/);
    const pic = { kind: 'svg' as const, svg: '<svg viewBox="0 0 10 10"><circle r="3"/></svg>' };
    expect(shortcutChecks({ ...choose, options: [{ id: 'a', display: pic }, { id: 'b', label: 'x' }, { id: 'c', label: 'y' }] }).join(' ')).toMatch(/odd one out/);
    expect(shortcutChecks({ ...sort, categories: ['Clear', 'Not clear'], key: { rock: 'Not clear', pillow: 'Not clear', spoon: 'Clear' },
      options: [{ id: 'rock', label: 'rock' }, { id: 'pillow', label: 'pillow' }, { id: 'spoon', label: 'clear spoon' }] }).join(' ')).toMatch(/shares a word/);
    expect(shortcutChecks(choose)).toEqual([]);
  });

  it('scores difficulty from structure', () => {
    const two = difficultyOf({ ...choose, options: choose.options.slice(0, 2), misconceptions: {} });
    const three = difficultyOf(choose);
    expect(three.score).toBeGreaterThan(two.score);
    expect(three.reasons.join(' ')).toMatch(/reading a graph/);
  });
});

describe('displays', () => {
  it('sanitizes agent SVG', () => {
    const dirty = '<svg onload="x()"><script>alert(1)</script><image href="http://evil/x.png"/><rect onclick="y()" width="2"/></svg>';
    const clean = sanitizeSvg(dirty);
    expect(clean).not.toMatch(/script|onload|onclick|evil/);
    expect(clean).toMatch(/<rect/);
  });
  it('checks and draws code displays', () => {
    expect(displayErrors(graph)).toEqual([]);
    expect(displayErrors({ kind: 'bar_graph', labels: ['a'], values: [1] })[0]).toMatch(/2-6 labels/);
    expect(displayErrors({ kind: 'number_line', min: 0, max: 1, step: 0.25, marks: [{ value: 2, label: '?' }] })[0]).toMatch(/between/);
    expect(displayHtml(graph)).toMatch(/<rect/);
  });
});

describe('clock display', () => {
  const clock = (hour: number, minute = 0) => ({ kind: 'clock' as const, hour, minute });
  const cards = (key: string, extra: Partial<SurfaceItem>): SurfaceItem => ({ ...base, id: 'k', surface: 'choose', prompt: 'Which clock shows 9:00?',
    options: [{ id: 'a', display: clock(9) }, { id: 'b', display: clock(3) }, { id: 'c', display: clock(12, 45) }], key, ...extra });

  it('refuses what it cannot draw and draws the hands where the time puts them', () => {
    expect(displayErrors(clock(13))[0]).toMatch(/hour is a whole number/);
    expect(displayErrors(clock(3, 60))[0]).toMatch(/minute is a whole number/);
    expect(displayErrors({ ...clock(3), highlight: 'second' as 'hour' })[0]).toMatch(/highlight/);
    const html = displayHtml(clock(3, 30));
    expect(html).toContain('rotate(105 100 100)');
    expect(html).toContain('rotate(180 100 100)');
    expect(html).not.toMatch(/3:30|half past/);
  });

  it('says where the hands are, never the time in digits', () => {
    expect(displayWords(clock(9))).toBe('a clock: short hand at 9, long hand at 12');
    expect(displayWords(clock(3, 30))).toBe('a clock: short hand between 3 and 4, long hand at 6');
    expect(displayWords(clock(12, 15))).toMatch(/between 12 and 1, long hand at 3/);
  });

  it('checks the key against the clock it can read', () => {
    expect(shortcutChecks(cards('a', {}))).toEqual([]);
    expect(shortcutChecks(cards('b', {})).join(' ')).toMatch(/key card shows another/);
    expect(shortcutChecks(cards('a', { options: [{ id: 'a', display: clock(9) }, { id: 'b', display: clock(9) }, { id: 'c', display: clock(3) }] })).join(' ')).toMatch(/two cards show the same value/);
    const read: SurfaceItem = { ...base, id: 'r', surface: 'choose', prompt: 'What time does the clock show?', stimulus: [clock(4, 30)],
      options: [{ id: 'a', label: '4:30' }, { id: 'b', label: '3:30' }, { id: 'c', label: '6:20' }], key: 'b' };
    expect(shortcutChecks(read).join(' ')).toMatch(/does not match the value/);
    expect(shortcutChecks({ ...read, key: 'a' })).toEqual([]);
  });

  it('accepts o\'clock and half past as stated times, and a prompt that asks for a later time', () => {
    const read: SurfaceItem = { ...base, id: 'r', surface: 'choose', prompt: 'What time is it?', stimulus: [clock(4, 30)],
      options: [{ id: 'a', label: 'half past four' }, { id: 'b', label: '3 o\'clock' }, { id: 'c', label: 'nine o\'clock' }], key: 'a' };
    expect(shortcutChecks(read)).toEqual([]);
    expect(shortcutChecks({ ...read, prompt: 'What time will it be one hour later?', key: 'b' })).toEqual([]);
  });

  it('flags a clock card labeled with its own time', () => {
    expect(shortcutChecks(cards('a', { options: [{ id: 'a', display: clock(9), label: '9:00' }, { id: 'b', display: clock(3), label: 'x' }, { id: 'c', display: clock(1), label: 'y' }] })).join(' ')).toMatch(/states in words/);
  });

  it('scores a clock from what it asks the child to read', () => {
    const asked = (d: { kind: 'clock'; hour: number; minute: number; numerals?: boolean }) => difficultyOf({ ...choose, stimulus: [d] }).score;
    expect(asked(clock(9, 30))).toBeGreaterThan(asked(clock(9)));
    expect(asked(clock(9, 22))).toBeGreaterThan(asked(clock(9, 15)));
    expect(asked({ ...clock(9), numerals: false })).toBeGreaterThan(asked(clock(9)));
  });

  it('a highlight replaces the same clock in place; a card highlight lights every card alike', () => {
    const d = readDraft({
      tier: 'medium', surface: 'choose', prompt: 'What time does the clock show?', stimulus: [clock(4, 30)],
      options: [{ id: 'a', label: '4:30' }, { id: 'b', label: '3:30' }, { id: 'c', label: '6:20' }], key: 'a',
      help: { says: 'Find the short hand.', add_stimulus: [{ ...clock(4, 30), highlight: 'hour' }] },
    }, 'x', 3);
    const { levers } = buildSurfaceLevers(d, 3);
    expect(levers[0].item.stimulus).toEqual([{ ...clock(4, 30), highlight: 'hour' }]);

    const c = readDraft({
      tier: 'medium', surface: 'choose', prompt: 'Which clock shows 9:00?', stimulus: [],
      options: [{ id: 'a', display: clock(9) }, { id: 'b', display: clock(3) }, { id: 'c', display: clock(12, 45) }], key: 'a',
      help: { says: 'Look at the short hands.', highlight_cards: 'hour' },
    }, 'y', 3);
    const lit = buildSurfaceLevers(c, 3).levers[0].item.options;
    expect(lit.every(o => (o.display as { highlight?: string }).highlight === 'hour')).toBe(true);
  });
});

describe('the rest of the display queue', () => {
  const samples: Display[] = [
    { kind: 'base_ten', hundreds: 1, tens: 3, ones: 4 },
    { kind: 'pattern_blocks', target: 'hexagon', pieces: [{ shape: 'trapezoid', slots: [0, 1, 2] }, { shape: 'rhombus', slots: [3, 4] }], tray: ['triangle'] },
    { kind: 'ten_frame', filled: 13, second: 3 },
    { kind: 'array', rows: 3, columns: 4, grouping: 'rows', icon: '🍎' },
    { kind: 'coins', coins: ['quarter', 'dime', 'penny', 'one_dollar'] },
    { kind: 'pictograph', title: 'Fruit', icon: '🍎', key_value: 2, labels: ['Red', 'Green'], values: [6, 3 + 1] },
    { kind: 'timeline', events: [{ label: 'Mill', at: 1900 }, { label: '?', at: 1950 }] },
    { kind: 'map', places: [{ name: 'School', icon: '🏫', x: 2, y: 8 }, { name: 'Park', x: 7, y: 3 }], paths: [['School', 'Park']], regions: [{ type: 'water', x: 1, y: 1, w: 2, h: 2 }], legend: [{ icon: '🏫', meaning: 'school' }] },
  ];

  it('draws and describes every display', () => {
    for (const d of samples) {
      expect(displayErrors(d)).toEqual([]);
      expect(displayHtml(d)).toMatch(/<svg/);
      expect(displayHtml(d)).not.toMatch(/undefined|NaN/);
      expect(displayWords(d)).not.toBe('');
    }
  });

  it('never prints the value a display is there to show', () => {
    expect(displayHtml({ kind: 'base_ten', hundreds: 0, tens: 3, ones: 4 })).not.toMatch(/>34</);
    expect(displayHtml({ kind: 'ten_frame', filled: 7 })).not.toMatch(/>7</);
    expect(displayHtml({ kind: 'coins', coins: ['dime'] })).not.toMatch(/10¢/);
    expect(displayHtml({ kind: 'coins', coins: ['dime'], highlight: 'values' })).toMatch(/10¢/);
  });

  it('refuses what it cannot draw', () => {
    expect(displayErrors({ kind: 'base_ten', hundreds: 0, tens: 0, ones: 0 })[0]).toMatch(/at least one/);
    expect(displayErrors({ kind: 'ten_frame', filled: 14, frames: 1 })[0]).toMatch(/filled/);
    expect(displayErrors({ kind: 'array', rows: 0, columns: 3 })[0]).toMatch(/1-12/);
    expect(displayErrors({ kind: 'coins', coins: ['groat' as 'dime'] })[0]).toMatch(/not one of/);
    expect(displayErrors({ kind: 'pictograph', icon: '⭐', key_value: 3, labels: ['a', 'b'], values: [4, 3] })[0]).toMatch(/whole or half/);
    expect(displayErrors({ kind: 'timeline', events: [{ label: 'a', at: 1 }, { label: 'b' }] })[0]).toMatch(/every event or on none/);
    expect(displayErrors({ kind: 'map', places: [{ name: 'a', x: 11, y: 1 }, { name: 'b', x: 1, y: 1 }] })[0]).toMatch(/0-10/);
  });

  it('checks pattern blocks by the size of each piece', () => {
    expect(displayErrors({ kind: 'pattern_blocks', target: 'hexagon', pieces: [{ shape: 'rhombus', slots: [0, 3] }] })[0]).toMatch(/touch along an edge/);
    expect(displayErrors({ kind: 'pattern_blocks', target: 'hexagon', pieces: [{ shape: 'trapezoid', slots: [0, 1] }] })[0]).toMatch(/covers 3/);
    expect(displayErrors({ kind: 'pattern_blocks', target: 'hexagon', pieces: [{ shape: 'triangle', slots: [0] }, { shape: 'triangle', slots: [0] }] })[0]).toMatch(/overlap/);
    expect(displayErrors({ kind: 'pattern_blocks', target: 'big_triangle', pieces: [{ shape: 'rhombus', slots: [1, 3] }] })).toEqual([]);

    const tray = (t: Array<'trapezoid' | 'triangle' | 'rhombus'>) => ({ kind: 'pattern_blocks' as const, tray: t });
    const item: SurfaceItem = { ...base, id: 'p', surface: 'choose', prompt: 'Which blocks fill the hexagon?', stimulus: [{ kind: 'pattern_blocks', target: 'hexagon' }],
      options: [{ id: 'a', display: tray(['trapezoid', 'trapezoid']) }, { id: 'b', display: tray(['rhombus', 'triangle']) }, { id: 'c', display: tray(['trapezoid', 'triangle']) }], key: 'a' };
    expect(shortcutChecks(item)).toEqual([]);
    expect(shortcutChecks({ ...item, key: 'b' }).join(' ')).toMatch(/do not add up/);
  });

  it('checks the key against what code can read for each kind', () => {
    const choose2 = (stimulus: Display, labels: string[], key: string, prompt = 'How much is shown?'): SurfaceItem => ({ ...base, id: 'k', surface: 'choose', prompt, stimulus: [stimulus], options: labels.map((label, i) => ({ id: String.fromCharCode(97 + i), label })), key });
    expect(shortcutChecks(choose2({ kind: 'base_ten', hundreds: 0, tens: 3, ones: 4 }, ['34', '43', '7'], 'b')).join(' ')).toMatch(/does not match/);
    expect(shortcutChecks(choose2({ kind: 'base_ten', hundreds: 0, tens: 3, ones: 4 }, ['34', '43', '7'], 'a'))).toEqual([]);
    expect(shortcutChecks(choose2({ kind: 'coins', coins: ['quarter', 'dime'] }, ['35¢', '30¢', '25¢'], 'b')).join(' ')).toMatch(/does not match/);
    expect(shortcutChecks(choose2({ kind: 'coins', coins: ['quarter', 'dime'] }, ['$0.35', '$0.30', '$0.25'], 'a'))).toEqual([]);
    expect(shortcutChecks(choose2({ kind: 'array', rows: 3, columns: 4 }, ['12', '7', '34'], 'a'))).toEqual([]);
    expect(shortcutChecks(choose2({ kind: 'ten_frame', filled: 7 }, ['3', '7', '10'], 'a', 'How many more make ten?'))).toEqual([]);
    const sort: SurfaceItem = { ...base, id: 's', surface: 'categorize', prompt: 'Match each card.', categories: ['2:00', '5:00'], options: [{ id: 'a', label: '2:00' }, { id: 'b', label: '5:00' }, { id: 'c', display: { kind: 'clock', hour: 2, minute: 0 } }], key: { a: '2:00', b: '5:00', c: '2:00' } };
    expect(shortcutChecks(sort).join(' ')).toMatch(/labeled with its own category/);
  });

  it('a highlight changes the drawing and the same state replaces in place', () => {
    for (const [d, value] of [[samples[0], 'tens'], [samples[1], 'slots'], [{ kind: 'ten_frame', filled: 3 }, 'empty'], [{ kind: 'array', rows: 2, columns: 2 }, 'row'], [{ kind: 'coins', coins: ['penny'] }, 'values']] as Array<[Display, string]>) {
      const lit = withHighlight(d, value)!;
      expect(displayErrors(lit)).toEqual([]);
      expect(displayHtml(lit)).not.toBe(displayHtml(d));
    }
  });
});

describe('levers', () => {
  const draft = (extra: Record<string, unknown>) => readDraft({
    tier: 'medium', surface: 'choose', prompt: choose.prompt, stimulus: [graph],
    options: [{ id: 'a', label: '3' }, { id: 'b', label: '11' }, { id: 'c', label: '7' }, { id: 'd', label: '2' }], key: 'a',
    misconceptions: { b: 'added', c: 'one bar', d: 'the fish bar' }, ...extra,
  }, 'x-1', 5);

  it('builds a help that draws more and a simplify that is easier, keeping the answer', () => {
    const d = draft({
      help: { says: 'Look at the gap between the two bars.', add_stimulus: [{ kind: 'number_line', min: 0, max: 8, step: 1, marks: [{ value: 4, label: 'Cat' }, { value: 7, label: 'Dog' }] }] },
      simplify: { says: 'Two choices now.', remove_options: ['c', 'd'] },
    });
    const { levers, refused } = buildSurfaceLevers(d, 5);
    expect(refused).toEqual([]);
    expect(levers.map(l => l.kind)).toEqual(['help', 'simplify']);
    expect(levers[0].item.key).toBe('a');
    expect(levers[1].item.options.map(o => o.id).sort()).toEqual(['a', 'b']);
    expect(levers[1].item.difficulty.score).toBeLessThan(d.item.difficulty.score);
  });

  it('refuses a text-only help and a simplify that drops the answer', () => {
    const d = draft({ help: { says: 'Think hard.', add_stimulus: [] }, simplify: { says: 'Fewer.', remove_options: ['a'] } });
    const { levers, refused } = buildSurfaceLevers(d, 5);
    expect(levers).toEqual([]);
    expect(refused.join(' ')).toMatch(/adds nothing/);
    expect(refused.join(' ')).toMatch(/removes the right answer/);
  });
});
