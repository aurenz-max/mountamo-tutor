// @vitest-environment jsdom
/**
 * W1 minimal binding, plain shape, and the in-item levers: the real ConstellationBuilder on the shared teaching
 * workspace, mounted the way a lesson mounts it. Trace modes commit every wrong star tap with its named miss and the
 * finished pattern as the right answer; identify and seasonal take the name tapped or said. Try again keeps the lines
 * already drawn; the runtime owns progression; the gesture key never reaches the tutor and the spoken key is the
 * observer's `expectedAnswer`. A pull changes the screen and the scene fact in one commit and draws no answer.
 */
vi.mock('@/contexts/LuminaAIContext', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).luminaAIContextSeam());
vi.mock('@/components/lumina/hooks/useLiveVoiceTurns', async original => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).voiceTurnsSeam(original as any));
vi.mock('@/components/lumina/hooks/useLuminaAI', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).legacyAISeam());
vi.mock('@/components/lumina/evaluation', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).evaluationSeam());
vi.mock('@/components/lumina/utils/SoundManager', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).soundSeam());
vi.mock('../../../components/PhaseSummaryPanel', () => ({ default: () => <div>summary</div> }));

import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { act, cleanup } from '@testing-library/react';
import { installRuntimeTimers, resetSeams, restoreRuntimeTimers, seam } from '../../../components/live-activity/runtime/testing/liveRuntimeSeams';
import { mountWorkspace, type WorkspaceHarness } from '../../../components/live-activity/runtime/testing/workspaceHarness';
import { nextLever } from '../../../components/live-activity/runtime/observerLever';
import { getComponentById } from '../../../service/manifest/catalog';
import type { ConstellationChallenge, StarData } from './ConstellationBuilder';
import { identifyOptions, nameHarnessAnswers, traceHarnessTaps } from './constellationWorkspace';
import { constellationBuilderBoss } from './constellationBuilder.boss';
import { practiceItem } from './constellationLevers';

beforeEach(() => { resetSeams(); vi.clearAllMocks(); installRuntimeTimers(); });
afterEach(() => { cleanup(); restoreRuntimeTimers(); });
const flushScoring = () => act(async () => { for (let tick = 0; tick < 20; tick++) await Promise.resolve(); });

const STARS: StarData[] = [
  ...[[10, 30], [25, 70], [40, 40], [55, 75], [70, 25]].map(([x, y], i) => ({ id: `p${i + 1}`, x, y, magnitude: 2, isPartOfConstellation: true })),
  ...[[85, 85], [90, 10], [5, 90]].map(([x, y], i) => ({ id: `b${i + 1}`, x, y, magnitude: 5, isPartOfConstellation: false })),
];
const W = [['p1', 'p2'], ['p2', 'p3'], ['p3', 'p4'], ['p4', 'p5']].map(([fromStarId, toStarId]) => ({ fromStarId, toStarId }));
const base = { constellationName: 'Cassiopeia', starOrder: ['p1', 'p2', 'p3', 'p4', 'p5'], correctConnections: W,
  mythologyFact: 'Cassiopeia was a queen who sits on a chair in the sky.', season: 'fall' };
const CHALLENGES: Record<string, ConstellationChallenge> = {
  guided_trace: { ...base, id: 'g', type: 'guided_trace', instruction: 'Tap the stars in order to draw Cassiopeia.' },
  free_connect: { ...base, id: 'f', type: 'free_connect', instruction: 'Join the bright stars to draw Cassiopeia.' },
  // The generator's identify and seasonal instructions describe the answer; the screen asks the plain question.
  identify: { ...base, id: 'i', type: 'identify', instruction: 'What W-shaped queen is this?', distractorName0: 'Orion', distractorName1: 'Leo' },
  seasonal: { ...base, id: 's', type: 'seasonal', instruction: 'Which W-shaped pattern shines in autumn?', distractorName0: 'Orion', distractorName1: 'Cygnus' },
};
const data = (challenges: ConstellationChallenge[], extra: Record<string, unknown> = {}) =>
  ({ title: 'Star Patterns', description: 'Find the patterns', gradeLevel: '3', stars: STARS, challenges, ...extra });
const mount = (mode: string, challenges: ConstellationChallenge[], extra: Record<string, unknown> = {}) => {
  const h = mountWorkspace({ primitiveId: 'constellation-builder', evalMode: mode, instanceId: 'constellation', data: data(challenges, extra) });
  h.settle(1000);
  return h;
};
/** The journey's inputs, through the real controls. */
function perform(h: WorkspaceHarness, c: ConstellationChallenge, intent: 'wrong' | 'correct') {
  if (c.type === 'guided_trace' || c.type === 'free_connect') {
    const taps = traceHarnessTaps(c);
    for (const id of intent === 'wrong' ? taps.plainWrong : taps.correct) h.touch(`star-${id}`);
  } else {
    const answers = nameHarnessAnswers(c);
    h.press(intent === 'wrong' ? answers.plainWrong : answers.correct);
    if (c.type === 'seasonal') h.press('Check Answer');
  }
  h.settle();
}
const demand = (h: WorkspaceHarness) => h.state().task!.demand as Record<string, unknown>;
const attempts = (h: WorkspaceHarness) => h.state().task!.workspace!.attempts;
const levers = (h: WorkspaceHarness) => (h.state().task!.workspace!.levers ?? []).map(l => [l.id, l.pulled]);
const q = (h: WorkspaceHarness, sel: string) => Array.from(h.view.container.querySelectorAll(sel));

it.each(Object.keys(CHALLENGES))('%s: tutor-owned with no scripted cue; a wrong answer names its miss, Try again reopens it, the right one completes once',
  async mode => {
    seam.evaluationContext = { lesson: 'test' };
    const c = CHALLENGES[mode];
    const h = mount(mode, [c]);
    expect(h.state().owner).toBe('tutor');
    expect(seam.legacyAI).not.toHaveBeenCalled();
    expect(h.view.container.textContent).not.toMatch(/Next Constellation|See Results|Submit Results/);
    const task = h.state().task!;
    if (mode === 'identify' || mode === 'seasonal') {
      // A name may be said: the observer judges it against the key, which the tutor needs to judge it.
      expect(task.workspace!.expectedAnswer).toBe('"Cassiopeia".');
      expect(task.demand.response).toBe('speech');
      // The screen and the task ask the plain question; the name is on screen once, as one of the choices.
      expect(h.view.container.textContent).not.toMatch(/W-shaped|queen/);
      expect(h.view.container.textContent!.split('Cassiopeia').length - 1).toBe(1);
      expect(String(demand(h).choices).split('Cassiopeia').length - 1).toBe(1);
    } else {
      expect(task.task).toBe(c.instruction);
      expect(task.workspace!.expectedAnswer).toBeUndefined();
      // Never which star is next or which stars join.
      expect(JSON.stringify(task)).not.toMatch(/\bp[1-5]\b/);
    }
    perform(h, c, 'wrong');
    expect(h.state().task!.evidence.correctness).toBe('incorrect');
    const miss = attempts(h).at(-1)?.miss;
    expect(getComponentById('constellation-builder')!.teachingWorkspace!.misses![mode]).toContain(miss);
    // The answer is still not drawn after the miss: no Star Lore card.
    expect(h.view.container.textContent).not.toContain('Star Lore');
    h.dispatch('retry'); h.confirmVisible();
    perform(h, c, 'correct');
    expect(h.state().task!.evidence.correctness).toBe('correct');
    h.dispatch('advance'); h.confirmVisible();
    expect(h.state().status).toBe('completed');
    await flushScoring();
    expect(seam.submit).toHaveBeenCalledOnce();
    h.close();
  });

it('guided trace: a wrong tap closes the stars; Try again keeps the lines already drawn and the ring moves on from there', () => {
  const c = CHALLENGES.guided_trace;
  const h = mount('guided_trace', [c]);
  h.touch('star-p1'); h.touch('star-p2'); h.touch('star-p4'); h.settle();
  expect(attempts(h).at(-1)).toMatchObject({ correct: false, miss: 'later_star' });
  expect(demand(h)).toMatchObject({ progress: '1 of 4 lines drawn' });
  // Closed: a tap does nothing until Try again.
  h.touch('star-p3');
  expect(demand(h)).toMatchObject({ progress: '1 of 4 lines drawn' });
  h.dispatch('retry'); h.confirmVisible();
  expect(demand(h)).toMatchObject({ progress: '1 of 4 lines drawn' });
  ['p3', 'p4', 'p5'].forEach(id => h.touch(`star-${id}`)); h.settle();
  expect(h.state().task!.evidence.correctness).toBe('correct');
  h.close();
});

it('guided trace: spotlight fades every other star and grows the ring in one commit; a repeat pull changes nothing; the next attempt records it', () => {
  const c = CHALLENGES.guided_trace;
  const h = mount('guided_trace', [c]);
  expect(levers(h)).toEqual([['spotlight', false], ['easier_pattern', false]]);
  h.touch('star-p3'); h.settle();
  expect(attempts(h).at(-1)).toMatchObject({ miss: 'later_star' });
  expect(nextLever(h.state().task!.workspace!.levers!, 'later_star')).toBe('spotlight');
  const receipt = h.dispatch('pull_lever', { lever: 'spotlight' });
  expect(receipt.status).toBe('committed');
  expect(String(receipt.state.task!.demand.onScreen)).toMatch(/faded/);
  expect(q(h, '[data-lever="spotlight-ring"]')).toHaveLength(1);
  // Faded: every star but the ringed one (p1).
  expect(q(h, 'circle[opacity="0.12"]')).toHaveLength(STARS.length - 1);
  const before = h.view.container.innerHTML;
  expect(h.dispatch('pull_lever', { lever: 'spotlight' }).status).toBe('blocked');
  expect(h.view.container.innerHTML).toBe(before);
  h.dispatch('retry'); h.confirmVisible();
  c.starOrder.forEach(id => h.touch(`star-${id}`)); h.settle();
  expect(attempts(h).at(-1)).toMatchObject({ itemId: 'g', correct: true, levers: ['spotlight'] });
  h.close();
});

it('free connect: the shape card draws the pattern\'s lines and no background star; bright stars is offered only where the tier withdrew them', () => {
  const c = CHALLENGES.free_connect;
  const h = mount('free_connect', [c]);
  expect(levers(h).map(([id]) => id)).toEqual(['shape_card', 'easier_pattern']);
  h.touch('star-p1'); h.touch('star-p3'); h.settle();
  expect(attempts(h).at(-1)).toMatchObject({ miss: 'wrong_pair' });
  expect(h.dispatch('pull_lever', { lever: 'shape_card' }).status).toBe('committed');
  expect(q(h, '[data-lever="shape-card"] line')).toHaveLength(4);
  expect(q(h, '[data-lever="shape-card"] circle')).toHaveLength(5);
  h.close();

  const m = mount('free_connect', [c], { supportTier: 'medium' });
  expect(levers(m).map(([id]) => id)).toEqual(['shape_card', 'bright_stars', 'easier_pattern']);
  m.touch('star-b1'); m.settle();
  expect(attempts(m).at(-1)).toMatchObject({ miss: 'background_star' });
  expect(nextLever(m.state().task!.workspace!.levers!, 'background_star')).toBe('shape_card');
  expect(q(m, 'circle[fill="#fffbe6"]')).toHaveLength(0);
  expect(m.dispatch('pull_lever', { lever: 'bright_stars' }).status).toBe('committed');
  expect(q(m, 'circle[fill="#fffbe6"]')).toHaveLength(5);
  expect(String(m.state().task!.demand.onScreen)).toMatch(/brighter/);
  m.close();
});

it('identify: a spoken name the tutor credits shows as a correct tap; a wrong one retries', async () => {
  seam.evaluationContext = { lesson: 'test' };
  const c = CHALLENGES.identify;
  const h = mount('identify', [c, { ...c, id: 'i2' }]);
  // The known wrong names reach the spoken-miss observer, never the tutor's packet.
  expect(constellationBuilderBoss.assignment(c).misses?.map(m => [m.id, m.examples])).toEqual([['wrong_name', ['Orion', 'Leo']]]);
  h.say('Orion'); h.feedback('incorrect', 'retry');
  expect(h.state().status).not.toBe('completed');
  h.say('Cassiopeia'); h.feedback('correct');
  expect(h.view.container.textContent).toContain("Yes! That's Cassiopeia!");
  h.dispatch('advance'); h.confirmVisible();
  expect(h.state().task!.itemId).toBe('i2');
  perform(h, c, 'correct');
  h.dispatch('advance'); h.confirmVisible();
  expect(h.state().status).toBe('completed');
  await flushScoring();
  expect(seam.submit).toHaveBeenCalledOnce();
  h.close();
});

it('identify: the easier pattern is ungraded practice with two names, neither one the item shows; the full item comes back and is credited', () => {
  const c = CHALLENGES.identify;
  const h = mount('identify', [c], { title: 'Meet Cassiopeia' });
  // The title names the answer while the item is open: masked.
  expect(h.view.container.textContent).not.toContain('Meet Cassiopeia');
  perform(h, c, 'wrong');
  const receipt = h.dispatch('pull_lever', { lever: 'easier_pattern' });
  expect(receipt.status).toBe('committed');
  expect(receipt.state.task!.itemId).toBe('i~easier');
  const p = practiceItem(c)!;
  expect(p.choices).toHaveLength(2);
  for (const name of identifyOptions(c)) expect(p.choices).not.toContain(name);
  expect(h.view.container.textContent).toMatch(/Practice/);
  for (const name of p.choices!) expect(h.view.container.textContent).toContain(name);
  expect(h.view.container.textContent).not.toContain('Cassiopeia');
  h.press(p.constellationName); h.settle();
  expect(h.state().task!.workspace!.lastResponse).toMatchObject({ correct: true });
  h.dispatch('advance');
  expect(h.state().task!.itemId).toBe('i');
  expect(h.view.container.textContent).not.toMatch(/Practice/);
  perform(h, c, 'correct');
  expect(attempts(h).map(a => [a.itemId, a.correct])).toEqual([['i', false], ['i~easier', true], ['i', true]]);
  expect(attempts(h).at(-1)).toMatchObject({ levers: ['easier_pattern'] });
  h.close();
});

it('seasonal: another seasonal item seen in the same season is not offered as a choice', () => {
  const winter = { ...CHALLENGES.seasonal, id: 's2', constellationName: 'Orion', season: 'winter', distractorName0: 'Leo', distractorName1: undefined };
  const fall2 = { ...CHALLENGES.seasonal, id: 's3', constellationName: 'Pegasus', season: 'autumn', distractorName0: 'Leo', distractorName1: undefined };
  const h = mount('seasonal', [CHALLENGES.seasonal, winter, fall2]);
  const choices = String(demand(h).choices).split(' | ');
  expect(choices).toContain('Orion');
  expect(choices).not.toContain('Pegasus');
  h.press('Cassiopeia'); h.press('Orion'); h.press('Check Answer'); h.settle();
  expect(attempts(h).at(-1)).toMatchObject({ correct: false, miss: 'several_names' });
  h.close();
});

it('the never-say rules ride in the scene: never the next star, and no star counts for a learner who cannot read', () => {
  const k = mount('guided_trace', [CHALLENGES.guided_trace], { gradeLevel: 'K' });
  expect(String(demand(k).constraints)).toMatch(/never say which star is next, where a star is or which stars join/);
  expect(String(demand(k).constraints)).toMatch(/no star counts or step numbers/);
  k.close();
  const g3 = mount('identify', [CHALLENGES.identify]);
  expect(String(demand(g3).constraints)).toMatch(/Never say the answer, its shape, its figure/);
  expect(String(demand(g3).constraints)).not.toMatch(/star counts/);
  g3.close();
});
