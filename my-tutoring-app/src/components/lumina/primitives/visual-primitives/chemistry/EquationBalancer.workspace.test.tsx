// @vitest-environment jsdom
/**
 * equation-balancer on the shared teaching workspace (W1, plain shape) and its levers: what is its own. The generic W1
 * contract (runtime/workspaceContract.test.tsx) covers ownership, the packet and self-advance.
 * Every equation is a bank reaction keyed by code: the count key is published only as the spoken expectedAnswer, the
 * balance key never; nothing on screen counts atoms or marks a match before a check; a wrong check names its miss; and
 * every miss has a help lever.
 */
vi.mock('@/contexts/LuminaAIContext', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).luminaAIContextSeam());
vi.mock('@/components/lumina/hooks/useLiveVoiceTurns', async original => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).voiceTurnsSeam(original as any));
vi.mock('@/components/lumina/hooks/useLuminaAI', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).legacyAISeam());
vi.mock('@/components/lumina/evaluation', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).evaluationSeam());
vi.mock('@/components/lumina/utils/SoundManager', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).soundSeam());

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup } from '@testing-library/react';
import { installRuntimeTimers, restoreRuntimeTimers, seam } from '../../../components/live-activity/runtime/testing/liveRuntimeSeams';
import { mountWorkspace, type WorkspaceHarness } from '../../../components/live-activity/runtime/testing/workspaceHarness';
import { nextLever } from '../../../components/live-activity/runtime/observerLever';
import { getComponentById } from '../../../service/manifest/catalog';
import type { EquationBalancerData } from './EquationBalancer';
import {
  addLabel, BALANCER_MISSES, balanceCorrect, balanceMiss, balanceModeOf, balanceRank, balancerHarnessAnswers, balancerItems, compounds,
  countKey, countMiss, countRank, EQUATION_BANK, equationText, parseFormula, solveKey, toEquation, unbalancedElements, workspaceAssignment,
  type BalanceItem, type BalancerItem, type BalancerMode, type CountItem, type LessonEquation,
} from './equationBalancerWorkspace';
import { balancerLevers, MOLECULES_LEVER, simplerItem, SIMPLER_LEVER, tallyLeak, tallyLine, TALLY_LEVER } from './equationBalancerLevers';

beforeEach(() => { installRuntimeTimers(); });
afterEach(() => { cleanup(); restoreRuntimeTimers(); });

const MODES: BalancerMode[] = ['simple', 'guided', 'complex'];
const LESSON: Record<BalancerMode, string[]> = {
  simple: ['rust', 'methane', 'ammonia', 'water'],
  guided: ['water', 'rust', 'zinc_acid'],
  complex: ['methane', 'propane', 'ethane'],
};
const eqs = (mode: BalancerMode): LessonEquation[] => LESSON[mode].map(id => ({ id, for: mode, realWorld: `${id} fact line.` }));
const data = (mode: BalancerMode, equations = eqs(mode)): EquationBalancerData =>
  ({ title: 'Atoms In, Atoms Out', description: 'Balance it with 2 H2!', equations, challengeTypes: [mode], gradeBand: '7-8' });
const mount = (mode: BalancerMode, equations = eqs(mode)) => {
  const h = mountWorkspace({ primitiveId: 'equation-balancer', evalMode: mode, instanceId: 'equation-balancer', data: data(mode, equations) as never });
  h.settle(1000);
  return h;
};
const demand = (h: WorkspaceHarness) => h.state().task!.demand as Record<string, unknown>;
const last = (h: WorkspaceHarness) => h.state().task!.workspace!.attempts.at(-1);
const levers = (h: WorkspaceHarness) => (h.state().task!.workspace!.levers ?? []).map(l => [l.id, l.kind, l.pulled]);
const text = (h: WorkspaceHarness) => h.view.container.textContent ?? '';
const current = (h: WorkspaceHarness, mode: BalancerMode) => balancerItems(data(mode)).find(i => i.id === h.state().task!.itemId)!;
const press = (h: WorkspaceHarness, labels: string[], check: RegExp) => { for (const l of labels) h.press(l); h.press(check); h.settle(); };
const flush = () => act(async () => { for (let i = 0; i < 20; i++) await Promise.resolve(); });

it.each(MODES)('%s binds with its key out of the scene and nothing on screen that counts or marks a match', mode => {
  const h = mount(mode);
  const item = current(h, mode);
  expect(getComponentById('equation-balancer')!.evalModes!.map(m => m.evalMode)).toEqual(MODES);
  expect(h.state().owner).toBe('tutor');
  expect(seam.legacyAI).not.toHaveBeenCalled();
  expect(h.state().task!.task).toBe(workspaceAssignment(item).task);
  const ws = h.state().task!.workspace!;
  const facts = JSON.stringify(demand(h));
  expect(facts).not.toMatch(/fact line|answer is|correct/i);
  // No description, no real-world line, no Next, no match marks, no lever drawn.
  expect(text(h)).not.toMatch(/Balance it with|fact line|Next →|Finish|Balanced!|Match\?|Atom Counter|Balance Scale/);
  expect(h.view.container.querySelector('[data-lever]')).toBeNull();
  if (item.mode === 'simple') {
    expect(demand(h).response).toBe('speech');
    expect(ws.expectedAnswer).toContain(`"${countKey(item)}"`);
  } else {
    expect(demand(h).response).toBe('gesture');
    expect(ws.expectedAnswer).toBeUndefined();
    expect(demand(h).onScreenNow).toBe(equationText(item.equation, compounds(item.equation).map(() => 1)));
    expect(String(demand(h).learnerWork)).toMatch(/^Every number is still 1/);
    expect(facts).not.toContain(item.key.join(','));
  }
  h.close();
});

it('simple: a wrong tap names its miss and closes the choices; Try again clears it; right, then spoken, submits once', async () => {
  seam.evaluationContext = { lesson: 'simple' };
  const h = mount('simple', [{ id: 'rust', for: 'simple' }, { id: 'methane', for: 'simple' }]);
  const item = current(h, 'simple') as CountItem;
  expect(item.equation.id).toBe('rust');
  const wrong = balancerHarnessAnswers(item).plainWrong[0];
  press(h, [wrong], /Check Answer/);
  expect(last(h)).toMatchObject({ correct: false, miss: countMiss(item, wrong) });
  expect(demand(h).learnerWork).toBe(`Chose ${wrong}`);
  expect(h.view.container.querySelector(`button[aria-label="${countKey(item)}"]`)!.hasAttribute('disabled')).toBe(true);
  h.dispatch('retry'); h.confirmVisible();
  expect(demand(h).learnerWork).toBe('Nothing chosen yet');
  press(h, [countKey(item)], /Check Answer/);
  expect(last(h)).toMatchObject({ correct: true });
  expect(text(h)).toContain('2 Fe2O3: 2 × 3 = 6. 6 oxygen atoms.');
  h.dispatch('advance'); h.confirmVisible();
  const second = current(h, 'simple') as CountItem;
  expect(second.equation.id).toBe('methane');
  h.say(countKey(second)); await flush(); h.feedback('correct', 'advance'); h.confirmVisible(); h.settle(); await flush(); h.settle();
  expect(h.state().status).toBe('completed');
  expect(seam.submit).toHaveBeenCalledOnce();
  const [, , metrics, work] = seam.submit.mock.calls[0];
  expect(metrics).toMatchObject({ type: 'equation-balancer', countingTotal: 2, atomCountingCorrect: 2 });
  expect(work.teachingAttempts.map((a: { correct: boolean; miss?: string }) => [a.correct, a.miss ?? null]))
    .toEqual([[false, countMiss(item, wrong)], [true, null], [true, null]]);
  h.close();
});

it('guided: a wrong check names its miss and locks the numbers; Try again keeps them; Start over and the key credit it', () => {
  const h = mount('guided', [{ id: 'rust', for: 'guided' }, { id: 'zinc_acid', for: 'guided' }]);
  const item = current(h, 'guided') as BalanceItem;
  expect(item.key).toEqual([4, 3, 2]);
  press(h, [addLabel('Fe2O3')], /Check Balance/);
  expect(last(h)).toMatchObject({ correct: false, miss: 'several_off' });
  expect(demand(h).learnerWork).toBe('Set 1 Fe + 1 O2 → 2 Fe2O3');
  expect(text(h)).toContain('Not balanced yet.');
  expect(h.view.container.querySelector(`button[aria-label="${addLabel('Fe')}"]`)!.hasAttribute('disabled')).toBe(true);
  h.dispatch('retry'); h.confirmVisible();
  expect(demand(h).onScreenNow).toBe('1 Fe + 1 O2 → 2 Fe2O3');
  h.press('Start over'); h.settle();
  expect(demand(h).onScreenNow).toBe('1 Fe + 1 O2 → 1 Fe2O3');
  press(h, balancerHarnessAnswers(item).correct, /Check Balance/);
  expect(last(h)).toMatchObject({ correct: true });
  expect(text(h)).toMatch(/Every atom is accounted for: Fe 4 = 4, O 6 = 6\./);
  h.close();
});

it('guided: a balanced set that is not the smallest is its own miss and says so', () => {
  const h = mount('guided', [{ id: 'water', for: 'guided' }]);
  press(h, [addLabel('H2'), addLabel('H2'), addLabel('H2'), addLabel('O2'), addLabel('H2O'), addLabel('H2O'), addLabel('H2O')], /Check Balance/);
  expect(last(h)).toMatchObject({ correct: false, miss: 'not_lowest' });
  expect(text(h)).toContain('Every element matches, but these are not the smallest whole numbers.');
  expect(String(demand(h).checked)).toMatch(/not the smallest/);
  h.close();
});

it('complex: molecule_view and atom_tally change the screen and the scene in one commit and ride the next attempt', () => {
  const h = mount('complex');
  const item = current(h, 'complex') as BalanceItem;
  expect(levers(h)).toEqual([[MOLECULES_LEVER, 'help', false], [TALLY_LEVER, 'help', false], [SIMPLER_LEVER, 'simplify', false]]);
  press(h, balancerHarnessAnswers(item).plainWrong, /Check Balance/);
  const miss = last(h)!.miss!;
  expect(BALANCER_MISSES.complex).toContain(miss);
  expect(nextLever(h.state().task!.workspace!.levers!, miss)).toBe(miss === 'not_lowest' ? TALLY_LEVER : MOLECULES_LEVER);
  expect(h.dispatch('pull_lever', { lever: MOLECULES_LEVER }).status).toBe('committed');
  expect(h.view.container.querySelectorAll('[data-lever="molecule-view"]')).toHaveLength(compounds(item.equation).length);
  const receipt = h.dispatch('pull_lever', { lever: TALLY_LEVER });
  expect(receipt.status).toBe('committed');
  const tally = h.view.container.querySelector('[data-lever="atom-tally"]')!;
  expect(tally.textContent).toMatch(/Left side/);
  expect(tallyLeak(tally.textContent ?? '')).toBe(false);
  expect(String(receipt.state.task!.demand.onScreen)).toMatch(/An atom tally for the numbers now set: C: \d+ on the left/);
  h.dispatch('retry'); h.confirmVisible();
  press(h, ['Start over', ...balancerHarnessAnswers(item).correct], /Check Balance/);
  expect(last(h)).toMatchObject({ correct: true, assisted: true, levers: [MOLECULES_LEVER, TALLY_LEVER] });
  h.close();
});

it('simpler_equation opens a smaller equation of the same mode, ungraded, and the full item comes back', () => {
  const h = mount('complex');
  const item = current(h, 'complex') as BalanceItem;
  const simpler = simplerItem(item, balancerItems(data('complex')))!;
  const receipt = h.dispatch('pull_lever', { lever: SIMPLER_LEVER });
  expect(receipt.status).toBe('committed');
  expect(receipt.state.task).toMatchObject({ itemId: `${item.id}~simpler` });
  expect(h.view.container.querySelector('[data-practice="simpler-equation"]')).not.toBeNull();
  press(h, balancerHarnessAnswers(simpler).correct, /Check Balance/);
  expect(last(h)).toMatchObject({ itemId: `${item.id}~simpler`, correct: true });
  h.dispatch('advance');
  expect(h.state().task).toMatchObject({ itemId: item.id });
  expect(demand(h).onScreenNow).toBe(equationText(item.equation, compounds(item.equation).map(() => 1)));
  expect(String(demand(h).learnerWork)).toMatch(/^Every number is still 1/);
  press(h, balancerHarnessAnswers(item).correct, /Check Balance/);
  expect(last(h)).toMatchObject({ itemId: item.id, correct: true, levers: [SIMPLER_LEVER] });
  h.close();
});

describe('the pure rules', () => {
  const bank = EQUATION_BANK.map(b => toEquation({ id: b.id })!);

  it('every bank formula parses, every bank equation has a key that balances, and none is balanced at all ones', () => {
    expect(parseFormula('Ca(OH)2')).toEqual({ Ca: 1, O: 2, H: 2 });
    expect(parseFormula('Cu(NO3)2', true)).toEqual({ Cu: 1, N: 1, O: 3 });
    expect(parseFormula('C₆H₁₂O₆')).toEqual({ C: 6, H: 12, O: 6 });
    for (const e of bank) {
      const key = solveKey(e)!;
      expect(key, e.id).not.toBeNull();
      expect(unbalancedElements(e, key), e.id).toEqual([]);
      expect(balanceModeOf(e), e.id).not.toBeNull();
    }
    expect(solveKey(toEquation({ id: 'ethane' })!)).toEqual([2, 7, 4, 6]);
    expect(balanceModeOf(toEquation({ id: 'rust' })!)).toBe('guided');
    expect(balanceModeOf(toEquation({ id: 'methane' })!)).toBe('complex');
  });

  it('every wrong choice and every wrong set names a catalog miss, and every miss is answered by a help lever first', () => {
    const entry = getComponentById('equation-balancer')!;
    for (const mode of MODES) {
      expect([...entry.teachingWorkspace!.misses![mode]].sort()).toEqual([...BALANCER_MISSES[mode]].sort());
      const items = balancerItems(data(mode));
      expect(items.length).toBeGreaterThan(0);
      for (const item of items) {
        if (item.mode === 'simple') {
          for (const c of item.choices) expect(!!countMiss(item, c), `${item.id} ${c}`).toBe(c !== countKey(item));
        } else {
          expect(balanceMiss(item, item.key)).toBeUndefined();
          expect(balanceMiss(item, item.key.map(k => k * 2))).toBe('not_lowest');
          expect(BALANCER_MISSES[mode]).toContain(balanceMiss(item, compounds(item.equation).map(() => 1)));
        }
        const ls = balancerLevers(item, [], items);
        for (const miss of BALANCER_MISSES[mode]) expect(ls.find(l => l.id === nextLever(ls, miss))!.kind, `${item.id} ${miss}`).toBe('help');
      }
    }
    expect(entry.teachingWorkspace!.levers).toBe(true);
  });

  it('count misses: the number in front left out, the small number left out, one formula only, added', () => {
    const rust = balancerItems(data('simple', [{ id: 'rust' }]))[0] as CountItem;
    expect([rust.side, rust.element, countKey(rust)]).toEqual(['right', 'O', '6']);
    expect(['2', '3', '5'].map(c => countMiss(rust, c))).toEqual(['ignored_subscript', 'ignored_coefficient', 'added_not_multiplied']);
    const methane = balancerItems(data('simple', [{ id: 'methane' }]))[0] as CountItem;
    expect(countMiss(methane, '2')).toBe('one_compound_only');
  });

  it('a blended session never counts and balances the same equation, and modes come out smallest first', () => {
    const blended = balancerItems({ equations: ['water', 'rust', 'methane', 'propane', 'ammonia'].map(id => ({ id })), gradeBand: '7-8' });
    const counted = blended.filter(i => i.mode === 'simple').map(i => i.equation.id);
    const balanced = blended.filter(i => i.mode !== 'simple').map(i => i.equation.id);
    expect(counted.filter(id => balanced.includes(id))).toEqual([]);
    const guided = balancerItems(data('guided')).map(i => balanceRank(i.equation));
    expect(guided).toEqual([...guided].sort((a, b) => a - b));
    const simple = balancerItems(data('simple')) as CountItem[];
    expect(simple.map(countRank)).toEqual(simple.map(countRank).sort((a, b) => a - b));
  });

  it('the atom tally never marks a match, and the harness answers are the key and a miss', () => {
    for (const mode of MODES) {
      for (const item of balancerItems(data(mode))) {
        const answers = balancerHarnessAnswers(item);
        if (item.mode === 'simple') { expect(answers.correct).toEqual([countKey(item)]); continue; }
        expect(answers.correct).toHaveLength(item.key.reduce((s, k) => s + k - 1, 0));
        expect(tallyLeak(tallyLine(item, item.key))).toBe(false);
        const wrongSet = compounds(item.equation).map((c, i) => 1 + answers.plainWrong.filter(l => l === addLabel(c.formula)).length);
        expect(balanceCorrect(item, wrongSet)).toBe(false);
      }
    }
  });

  it('the simpler item is the same mode, smaller, never an equation of the session, and never shrinks twice', () => {
    for (const mode of MODES) {
      const items = balancerItems(data(mode));
      for (const item of items) {
        const simpler = simplerItem(item, items) as BalancerItem | null;
        if (!simpler) continue;
        expect(simpler.mode).toBe(mode);
        expect(items.map(i => i.equation.id)).not.toContain(simpler.equation.id);
        if (simpler.mode === 'simple') expect(countRank(simpler) <= countRank(item as CountItem)).toBe(true);
        else expect(balanceRank(simpler.equation)).toBeLessThan(balanceRank(item.equation));
        expect(simplerItem(simpler, items)).toBeNull();
        expect(balancerLevers(simpler, [], items)).toEqual([]);
      }
    }
  });
});
