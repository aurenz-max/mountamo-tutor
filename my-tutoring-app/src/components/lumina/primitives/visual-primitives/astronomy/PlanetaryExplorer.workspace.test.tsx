// @vitest-environment jsdom
/**
 * The real PlanetaryExplorer on its boss (`planetaryExplorer.boss.ts`), mounted the way a lesson mounts it. A stop's
 * card is read before its first question (no response yet); one tapped choice and Check Answer commits a checked
 * gesture with its named miss, or a spoken answer is judged; Try again clears the choice; the runtime owns progression;
 * the key is published only as the spoken expectedAnswer, never in the scene. Levers change the screen in the same
 * commit and never draw the answer. The K-1 chrome, support-tier and quiz-colour checks of the retired scripted tests
 * run here on bound mounts.
 */
vi.mock('@/contexts/LuminaAIContext', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).luminaAIContextSeam());
vi.mock('@/components/lumina/hooks/useLiveVoiceTurns', async original => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).voiceTurnsSeam(original as any));
vi.mock('@/components/lumina/hooks/useLuminaAI', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).legacyAISeam());
vi.mock('@/components/lumina/evaluation', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).evaluationSeam());
vi.mock('@/components/lumina/utils/SoundManager', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).soundSeam());
vi.mock('../../../components/PhaseSummaryPanel', () => ({ default: () => <div>summary</div> }));

import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { act, cleanup } from '@testing-library/react';
import { installRuntimeTimers, restoreRuntimeTimers, seam } from '../../../components/live-activity/runtime/testing/liveRuntimeSeams';
import { mountWorkspace, type WorkspaceHarness } from '../../../components/live-activity/runtime/testing/workspaceHarness';
import { nextLever } from '../../../components/live-activity/runtime/observerLever';
import type { PlanetQuestion, PlanetStop } from './PlanetaryExplorer';
import { planetGiven, planetHarnessAnswers, planetItems, planetMiss } from './planetaryExplorerWorkspace';
import { planetaryExplorerBoss } from './planetaryExplorer.boss';

beforeEach(() => { installRuntimeTimers(); });
afterEach(() => { cleanup(); restoreRuntimeTimers(); vi.restoreAllMocks(); });

const mc = (question: string, options: string[], correctIndex: number, questionType: PlanetQuestion['questionType'] = 'mc'): PlanetQuestion =>
  ({ question, options, correctIndex, questionType, explanation: 'Because of what the card says.', difficulty: 'easy' });
const MARS: PlanetStop = { planetId: 'mars', focusTheme: 'moons', description: 'Mars is a small red world.', funFact: 'Mars has dust storms.',
  transition: 'Next, a giant.', keyStats: [{ label: 'Moons', value: '2' }, { label: 'Day', value: '24.6', unit: 'hours' }],
  questions: [mc('How many moons does Mars have?', ['0', '1', '2', '4'], 2), mc('Mars is made of gas.', ['True', 'False'], 1, 'true-false')] };
const JUPITER: PlanetStop = { planetId: 'jupiter', focusTheme: 'size', description: 'Jupiter is the biggest planet.', funFact: 'It has a giant storm.',
  transition: '', keyStats: [{ label: 'Moons', value: '95' }, { label: 'Size', value: '11', unit: 'Earths wide' }],
  questions: [mc('Which planet has more moons, Mars or Jupiter?', ['Mars', 'Both the same', 'Jupiter', 'Neither has moons'], 2, 'compare'),
    mc('Why is Jupiter called a gas giant?', ['It is made mostly of gas and is huge', 'It is closest to the Sun', 'It has a rocky crust', 'It is full of water'], 0)] };
const QUIZ = [mc('Which planet is the biggest in the solar system?', ['Mars', 'Jupiter', 'Neptune', 'Mercury'], 1)];
const MODES = ['explore', 'identify', 'compare', 'apply'] as const;

const mount = (mode: string, planets: PlanetStop[], quizQuestions: PlanetQuestion[] = [], extra: Record<string, unknown> = {}) => {
  const h = mountWorkspace({ primitiveId: 'planetary-explorer', evalMode: mode, instanceId: 'planets',
    data: { title: 'Planet trip', description: 'A trip', introduction: 'Off we go', celebration: 'Done!', gradeLevel: '4',
      planets, quizQuestions, ...extra } });
  h.settle(1000);
  return h;
};
const demand = (h: WorkspaceHarness) => h.state().task!.demand as Record<string, unknown>;
const answer = (h: WorkspaceHarness, label: string) => { h.press(label); h.press('Check Answer'); h.settle(); };
const ready = (h: WorkspaceHarness) => { h.press('Ready for Questions →'); h.settle(); };
const attempts = (h: WorkspaceHarness) => h.state().task!.workspace!.attempts;
const levers = (h: WorkspaceHarness) => (h.state().task!.workspace!.levers ?? []).map(l => [l.id, l.pulled]);

it.each(MODES)('%s: the card first, then a spoken-or-tapped question whose key stays out of the scene', mode => {
  const h = mount(mode, [MARS]);
  expect(h.state().owner).toBe('tutor');
  expect(seam.legacyAI).not.toHaveBeenCalled();
  // The card is on screen; the question is not, and nothing is asked of the learner yet.
  expect(demand(h).presentation).toBe('not ready');
  expect(h.view.container.textContent).toContain('Mars is a small red world.');
  expect(h.view.container.textContent).not.toContain('How many moons does Mars have?');
  expect(h.view.container.querySelector('[aria-label="Hear about this planet"]')).toBeNull();
  ready(h);
  expect(demand(h).presentation).toBe('ready');
  const ws = h.state().task!.workspace!;
  expect(h.state().task!.task).toMatch(/^How many moons does Mars have\?/);
  expect(demand(h).response).toBe('speech');
  expect(ws.expectedAnswer).toMatch(/^"2" \(also accept "choice C", "the third one"\)/);
  // The choices are named; which one is right is not, and the card is gone.
  expect(String(demand(h).choices)).toBe('1) 0  2) 1  3) 2  4) 4');
  expect(JSON.stringify(demand(h))).not.toMatch(/correct|answer is|Moons 2/i);
  expect(h.view.container.textContent).not.toMatch(/Next Question|Continue to Next Planet|See Results/);
  answer(h, '2');
  expect(h.state().task!.evidence.correctness).toBe('correct');
  expect(h.view.container.textContent).toContain('Because of what the card says.');
  h.close();
});

const flush = () => act(async () => { for (let i = 0; i < 20; i++) await Promise.resolve(); });

it('a wrong tap commits its miss, closes the choices, and Try again clears it; the session submits once', async () => {
  seam.evaluationContext = { lesson: 'test' };
  const h = mount('explore', [MARS]);
  ready(h);
  answer(h, '0');
  expect(attempts(h).at(-1)).toMatchObject({ correct: false, miss: 'other_number' });
  expect(demand(h)).toMatchObject({ learnerWork: 'Chose "0"' });
  // The right choice is not shown, and nothing more can be tapped until Try again.
  expect(h.view.container.textContent).not.toContain('Because of what the card says.');
  expect(h.view.container.querySelector('button[aria-label="2"]')!.hasAttribute('disabled')).toBe(true);
  h.dispatch('retry'); h.confirmVisible();
  expect(demand(h)).toMatchObject({ learnerWork: 'Nothing chosen yet', presentation: 'ready' });
  answer(h, '2');
  h.dispatch('advance'); h.confirmVisible();
  // The true-false statement: said aloud this time, credited by the observer.
  expect(h.state().task!.task).toMatch(/^True or false: Mars is made of gas\./);
  h.say('false'); await flush(); h.feedback('correct', 'advance'); h.confirmVisible(); h.settle(); await flush(); h.settle();
  expect(h.state().status).toBe('completed');
  expect(seam.submit).toHaveBeenCalledOnce();
  const [success, , , work] = seam.submit.mock.calls[0];
  expect(success).toBe(true);
  expect(work.teachingAttempts.map((a: { correct: boolean; miss?: string }) => [a.correct, a.miss ?? null]))
    .toEqual([[false, 'other_number'], [true, null], [true, null]]);
  h.close();
});

it('identify quiz: no names on the map; the planet misses; drop_far_choice greys the farthest planet; family_model draws no name', () => {
  const h = mount('identify', [{ ...MARS, questions: [] }, { ...JUPITER, questions: [] }], QUIZ);
  expect(demand(h).presentation).toBe('ready');
  // The map's planets wear no names: the only planet names on screen are the choices.
  const named = Array.from(h.view.container.querySelectorAll('span')).filter(s => !s.closest('button')).map(s => s.textContent);
  expect(named.join(' ')).not.toMatch(/Mars|Jupiter|Mercury|Venus|Earth|Saturn|Uranus|Neptune/);
  const item = planetItems([], QUIZ)[0];
  expect([0, 2, 3].map(i => planetMiss(item, i, []))).toEqual(['neighbour_planet', 'same_family_planet', 'other_family_planet']);
  expect(levers(h)).toEqual([['family_model', false], ['drop_far_choice', false]]);
  answer(h, 'Mercury');
  expect(attempts(h).at(-1)).toMatchObject({ correct: false, miss: 'other_family_planet' });
  expect(nextLever(h.state().task!.workspace!.levers!, 'other_family_planet')).toBe('family_model');
  expect(h.dispatch('pull_lever', { lever: 'family_model' }).status).toBe('committed');
  const model = h.view.container.querySelector('[data-lever="family-model"]')!;
  expect(model.textContent).not.toMatch(/Mars|Jupiter|Neptune|Mercury/);
  expect(String(demand(h).onScreen)).toMatch(/two model worlds/);
  const before = h.view.container.innerHTML;
  expect(h.dispatch('pull_lever', { lever: 'family_model' }).status).toBe('blocked');
  expect(h.view.container.innerHTML).toBe(before);
  // Mercury is tried, so the farthest untried wrong planet from Jupiter is Neptune.
  expect(h.dispatch('pull_lever', { lever: 'drop_far_choice' }).status).toBe('committed');
  expect(h.view.container.querySelector('button[aria-label="Neptune"]')!.getAttribute('data-dropped')).toBe('true');
  expect(String(demand(h).onScreen)).toMatch(/choice 3, "Neptune", is greyed out and is not the answer/);
  h.dispatch('retry'); h.confirmVisible();
  answer(h, 'Jupiter');
  expect(attempts(h).at(-1)).toMatchObject({ correct: true, levers: ['family_model', 'drop_far_choice'] });
  h.close();
});

it('planet_card is withheld where a choice is printed on the card, and comes back beside a question where none is', () => {
  const h = mount('apply', [MARS, JUPITER]);
  ready(h);
  // "2" is on Mars's card: no card lever on the moons question.
  expect(levers(h).map(([id]) => id)).not.toContain('planet_card');
  answer(h, '2'); h.dispatch('advance'); h.confirmVisible();
  h.say('false'); h.feedback('correct', 'advance'); h.confirmVisible(); h.settle();
  ready(h);
  // Jupiter's compare question: the cards of both visited planets may come back, none marked.
  expect(levers(h).map(([id]) => id)).toEqual(['planet_card', 'visited_cards', 'drop_far_choice']);
  answer(h, 'Mars');
  expect(attempts(h).at(-1)).toMatchObject({ correct: false, miss: 'other_planet' });
  expect(h.dispatch('pull_lever', { lever: 'visited_cards' }).status).toBe('committed');
  const cards = h.view.container.querySelector('[data-lever="visited-cards"]')!;
  expect(cards.textContent).toMatch(/Mars.*2.*Jupiter.*95/);
  h.dispatch('retry'); h.confirmVisible();
  answer(h, 'Jupiter');
  expect(attempts(h).at(-1)).toMatchObject({ correct: true, levers: ['visited_cards'] });
  h.close();
});

it('an easy item opens with its help levers drawn and declared pulled; a right first answer records no lever', () => {
  const h = mount('apply', [{ ...JUPITER, questions: [JUPITER.questions[1]] }], [], { supportTier: 'easy' });
  ready(h);
  expect(h.view.container.querySelector('[data-lever="planet-card"]')).not.toBeNull();
  expect(levers(h)).toContainEqual(['planet_card', true]);
  answer(h, 'It is made mostly of gas and is huge');
  expect(attempts(h).at(-1)).toMatchObject({ correct: true });
  expect((attempts(h).at(-1) as { levers?: string[] }).levers ?? []).toEqual([]);
  h.close();
});

it('every saved payload question names a miss for each wrong choice, and the journey answers are its key and a wrong choice', () => {
  for (const mode of MODES) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { data } = require(`../../../components/live-activity/runtime/testing/w1-payloads/planetary-explorer.${mode}.json`);
    for (const item of planetItems(data.planets, data.quizQuestions ?? [])) {
      const q = item.question;
      q.options.forEach((_: string, i: number) => expect(!!planetMiss(item, i, data.planets), `${mode} ${item.id} ${i}`).toBe(i !== q.correctIndex));
      const a = planetHarnessAnswers(item, data.planets);
      expect(a.correct).toBe(q.options[q.correctIndex]);
      expect(a.plainWrong).not.toBe(a.correct);
    }
  }
});

it("the scene keeps this question's never-say rules: nicknames, the why, the quiz planet, and no units at K-1", () => {
  const h = mount('apply', [{ ...JUPITER, questions: [JUPITER.questions[1]] }]);
  ready(h);
  const rules = String(demand(h).constraints);
  expect(rules).toMatch(/nickname/);
  expect(rules).toMatch(/never name the reason/);
  expect(rules).not.toMatch(/units/);
  h.close();
  const q = mount('identify', [{ ...MARS, questions: [] }], QUIZ, { gradeLevel: 'K' });
  expect(String(demand(q).constraints)).toMatch(/never name or describe that planet.*Say no units or decimals/);
  q.close();
});

it('K-1 drops the question counter and the A./B. letters by conditional render; grade 4 keeps them; no button nests', () => {
  for (const [grade, shown] of [['K', false], ['4', true]] as const) {
    const h = mount('explore', [MARS], [], { gradeLevel: grade });
    ready(h);
    const text = h.view.container.textContent ?? '';
    expect(/Q1\/2/.test(text), grade).toBe(shown);
    expect(/A\./.test(text), grade).toBe(shown);
    expect(h.view.container.querySelectorAll('.hidden')).toHaveLength(0);
    expect(h.view.container.querySelectorAll('button button')).toHaveLength(0);
    h.close();
  }
});

it('hard withdraws the Earth comparisons on the card and keeps the values; other tiers keep them', () => {
  const stop: PlanetStop = { ...MARS, keyStats: [{ label: 'Size', value: '6,779', unit: 'km', comparisonToEarth: 'About half of Earth' }] };
  for (const [tier, shown] of [['hard', false], ['medium', true], ['easy', true]] as const) {
    const h = mount('explore', [stop], [], { supportTier: tier });
    const text = h.view.container.textContent ?? '';
    expect(text.includes('About half of Earth'), tier).toBe(shown);
    expect(text).toContain('6,779 km');
    h.close();
  }
});

it("quiz choices wear a neutral dot at every tier, while the card keeps the planet's colour", () => {
  for (const tier of [undefined, 'easy', 'hard'] as const) {
    const h = mount('identify', [{ ...MARS, questions: [] }], QUIZ, tier ? { supportTier: tier } : {});
    for (const name of QUIZ[0].options) {
      const btn = h.view.container.querySelector(`button[aria-label="${name}"]`)!;
      expect(btn.querySelector('div')!.className).toContain('bg-slate-600');
      expect(btn.innerHTML).not.toMatch(/background-color/);
    }
    h.close();
  }
  const h = mount('explore', [MARS], [], { supportTier: 'hard' });
  // The card is on screen: Mars's header circle wears its colour #c1440e.
  expect(Array.from(h.view.container.querySelectorAll('div')).some(d => (d as HTMLElement).style.backgroundColor === 'rgb(193, 68, 14)')).toBe(true);
  h.close();
});

it('a compare ask names its pair by design; an ask naming the key alone is rejected at launch', () => {
  const pair = planetItems([JUPITER])[0];
  expect(planetGiven(pair)).toEqual(['Mars', 'Jupiter']);
  const lone = mc('Is Jupiter the biggest planet of all?', ['Mars', 'Jupiter', 'Neptune'], 1);
  expect(planetGiven(planetItems([], [lone])[0])).toEqual([]);
  const data = { title: 'Trip', description: '', introduction: '', celebration: '', planets: [MARS], quizQuestions: [lone] };
  expect(() => planetaryExplorerBoss.validate(data)).toThrow(/says the answer "Jupiter"/);
});
