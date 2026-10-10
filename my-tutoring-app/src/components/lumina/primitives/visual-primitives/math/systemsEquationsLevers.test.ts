/**
 * systems-equations-visualizer levers: the leak rules per mode, the simplify builder over many systems, the worked
 * examples' arithmetic, and "this wrong answer, then this lever" as code.
 */
import { describe, expect, it } from 'vitest';
import { nextLever } from '../../../components/live-activity/runtime/observerLever';
import type { SystemsEquationsChallenge } from './SystemsEquationsVisualizer';
import {
  CHECK_BOTH, SIMPLER, checkSentence, exampleCandidates, exampleLeaks, leverFacts, leverTextLeaks, lineUpColumns,
  practiceLeaks, setEqualLine, simplerItem, slopeDisplay, standardDisplay, systemsLevers, workedExample,
} from './systemsEquationsLevers';
import {
  SYSTEMS_MISSES_BY_MODE, onLine, pairText, solutionCorrect, systemsMiss, type SolutionPoint, type SystemsMode,
} from './systemsEquationsWorkspace';

const SLOPES = [1, 2, 3, -1, -2, -3, 0.5, -0.5, 1.5, -1.5];
const COEFS = [-3, -2, -1, 1, 2, 3];
const KEYS: SolutionPoint[] = [];
for (let x = -4; x <= 4; x++) for (let y = -4; y <= 4; y++) KEYS.push({ x, y });
const TIERS: Array<Partial<SystemsEquationsChallenge>> = [{}, { showStepHint: true, stepHint: 'steps' }, { showAxisLabels: false }];

/** Systems as the generator builds them: two slopes (or two coefficient rows) through an integer key. */
function items(type: SystemsMode): SystemsEquationsChallenge[] {
  const out: SystemsEquationsChallenge[] = [];
  let n = 0;
  for (const k of KEYS) {
    if (type === 'elimination') {
      const [a1, b1, a2, b2] = [COEFS[n % 6], COEFS[(n + 2) % 6], COEFS[(n + 3) % 6], COEFS[(n + 5) % 6]];
      n++;
      if (a1 * b2 - a2 * b1 === 0) continue;
      const c1 = a1 * k.x + b1 * k.y, c2 = a2 * k.x + b2 * k.y;
      out.push({ id: `e${n}`, type, systemForm: 'standard', expectedX: k.x, expectedY: k.y, instruction: 'Use elimination.', hint: '',
        equationA: { display: standardDisplay(a1, b1, c1), slope: -a1 / b1, yIntercept: c1 / b1, a: a1, b: b1, c: c1 },
        equationB: { display: standardDisplay(a2, b2, c2), slope: -a2 / b2, yIntercept: c2 / b2, a: a2, b: b2, c: c2 },
        ...TIERS[n % TIERS.length] });
      continue;
    }
    for (const [mA, mB] of [[SLOPES[n % 10], SLOPES[(n + 3) % 10]], [1, -1], [2, -1]]) {
      n++;
      if (mA === mB) continue;
      const bA = k.y - mA * k.x, bB = k.y - mB * k.x;
      out.push({ id: `${type[0]}${n}`, type, systemForm: 'slope-intercept', expectedX: k.x, expectedY: k.y, instruction: 'Solve it.', hint: '',
        equationA: { display: slopeDisplay(mA, bA), slope: mA, yIntercept: bA },
        equationB: { display: slopeDisplay(mB, bB), slope: mB, yIntercept: bB }, ...TIERS[n % TIERS.length] });
    }
  }
  return out;
}
const MODES: SystemsMode[] = ['graph', 'substitution', 'elimination'];

describe.each(MODES)('%s', mode => {
  const all = items(mode);

  it('no lever\'s when or does carries a digit', () => {
    for (const c of all) for (const l of systemsLevers(c, [])) {
      expect(leverTextLeaks(l.when), `${c.id} ${l.id}`).toBe(false);
      expect(leverTextLeaks(l.does), `${c.id} ${l.id}`).toBe(false);
    }
  });

  it('every miss the check names is answered by a lever on every item', () => {
    for (const c of all) {
      const levers = systemsLevers(c, []);
      for (const m of SYSTEMS_MISSES_BY_MODE[mode]) expect(levers.some(l => l.answers?.includes(m)), `${c.id} ${m}`).toBe(true);
    }
  });

  it('a worked example exists for every item, is arithmetically right, and shares nothing with the key or the system', () => {
    for (const c of all) {
      const ex = workedExample(c);
      expect(ex, c.id).not.toBeNull();
      expect(exampleLeaks(c, ex!)).toBe(false);
      expect(ex!.solution.x === c.expectedX || ex!.solution.y === c.expectedY).toBe(false);
      expect(ex!.steps.join(' ')).not.toContain(pairText({ x: c.expectedX, y: c.expectedY }));
    }
    for (const ex of exampleCandidates(mode)) {
      expect([ex.equationA, ex.equationB].every(e => onLine(e, ex.solution)), ex.steps.join(' | ')).toBe(true);
      expect(ex.steps.at(-1)).toContain(pairText(ex.solution));
    }
  });

  it('the simpler item keeps the mode, is solvable, small, and never the learner\'s item or its answer', () => {
    let built = 0;
    for (const c of all) {
      const p = simplerItem(c);
      if (!p) continue;
      built++;
      expect(p.type).toBe(mode);
      expect(p.id).toBe(`${c.id}~simpler`);
      expect(practiceLeaks(c, p)).toBe(false);
      expect([p.equationA, p.equationB].every(e => onLine(e, { x: p.expectedX, y: p.expectedY }))).toBe(true);
      expect(Math.max(Math.abs(p.expectedX), Math.abs(p.expectedY))).toBeLessThanOrEqual(3);
      expect(simplerItem(p)).toBeNull();
      expect(systemsLevers(p, [])).toEqual([]);
      if (mode === 'elimination') expect(lineUpColumns({ ...p })?.note).toMatch(/opposites/);
      else expect([p.equationA.slope, p.equationB.slope].sort()).toEqual([-1, 1]);
    }
    expect(built).toBeGreaterThan(all.length / 2);
  });

  it('check_both prints the learner\'s pair, never the key', () => {
    for (const c of all) {
      const k = { x: c.expectedX, y: c.expectedY };
      for (const p of [{ x: k.y, y: k.x }, { x: k.x, y: k.y + 2 }, { x: -k.x, y: k.y }]) {
        if (solutionCorrect(c, p)) continue;
        const s = checkSentence(c, p);
        expect(s).toContain(pairText(p));
        expect(s.replace(/\s/g, '')).not.toContain(pairText(k).replace(/\s/g, ''));
        expect(s).toMatch(/does not work/);
      }
    }
  });

  it('the item\'s own first step states no solved value', () => {
    for (const c of all) {
      for (const text of [setEqualLine(c) ?? '', lineUpColumns(c)?.note ?? '']) {
        expect(text, c.id).not.toMatch(/(^|[^\w.])[xy]\s*=\s*-?\d+(\.\d+)?\s*($|[;,.])/);
      }
      expect(lineUpColumns(c)?.note ?? '', c.id).not.toMatch(/\d/);
      const facts = leverFacts(c, systemsLevers(c, []).map(l => l.id), { x: c.expectedX + 1, y: c.expectedY });
      expect(facts.replace(/\s/g, ''), c.id).not.toContain(pairText({ x: c.expectedX, y: c.expectedY }).replace(/\s/g, ''));
    }
  });
});

describe('this wrong answer, then this lever', () => {
  const graph = items('graph').find(c => c.expectedX === 1 && c.expectedY === 3 && !c.showStepHint && c.showAxisLabels !== false)!;
  const substitution = items('substitution').find(c => c.expectedX === 1 && c.expectedY === 3 && !c.showStepHint)!;
  const elimination = items('elimination').find(c => c.expectedX === 2 && c.expectedY === 1 && !c.showStepHint)!;
  it.each([
    [graph, { x: 3, y: 1 }, 'swapped', 'axis_guide'],
    [graph, { x: -1, y: 3 }, 'x_sign', 'axis_guide'],
    [graph, { x: 1, y: 9 }, 'x_only', CHECK_BOTH],
    [substitution, { x: 3, y: 1 }, 'swapped', CHECK_BOTH],
    [substitution, { x: -1, y: 3 }, 'x_sign', 'set_equal'],
    [substitution, { x: 1, y: 9 }, 'x_only', CHECK_BOTH],
    [elimination, { x: -2, y: 1 }, 'x_sign', 'line_up'],
    [elimination, { x: 2, y: 9 }, 'x_only', CHECK_BOTH],
  ] as const)('%#: %s', (c, p, miss, lever) => {
    expect(c, 'fixture').toBeTruthy();
    expect(systemsMiss(c, p)).toBe(miss);
    expect(nextLever(systemsLevers(c, []), miss)).toBe(lever);
  });

  it('a pulled lever is not offered again; simplify comes after every help lever that answers', () => {
    const ids = systemsLevers(graph, []).map(l => l.id);
    expect(ids.at(-1)).toBe(SIMPLER);
    expect(nextLever(systemsLevers(graph, ['axis_guide']), 'swapped')).toBe(CHECK_BOTH);
  });
});
