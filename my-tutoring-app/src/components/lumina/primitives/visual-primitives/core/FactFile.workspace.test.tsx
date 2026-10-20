// @vitest-environment jsdom
/**
 * Fact file on the teaching workspace (its boss: `factFile.boss.ts`): what is its own (modes, the reading phase, the
 * closed file, levers, misses, the pre-reader screen) and the generator's pick. The generic W1 contract (runtime/workspaceContract.test.tsx)
 * covers ownership, the packet and self-advance.
 */
vi.mock('@/contexts/LuminaAIContext', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).luminaAIContextSeam());
vi.mock('@/components/lumina/hooks/useLiveVoiceTurns', async original => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).voiceTurnsSeam(original as any));
vi.mock('@/components/lumina/evaluation', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).evaluationSeam());
vi.mock('@/components/lumina/utils/SoundManager', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).soundSeam());
vi.mock('@/components/lumina/service/geminiClient', () => ({ ai: {} }));

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup } from '@testing-library/react';
import { installRuntimeTimers, resetSeams, restoreRuntimeTimers, seam } from '../../../components/live-activity/runtime/testing/liveRuntimeSeams';
import { mountWorkspace, type WorkspaceHarness } from '../../../components/live-activity/runtime/testing/workspaceHarness';
import { LIVE_ADAPTERS } from '../../../components/live-activity/activityContract';
import { nextLever } from '../../../components/live-activity/runtime/observerLever';
import { getComponentById } from '../../../service/manifest/catalog';
import { pickSelfChecks, checkDefect } from '../../../service/core/gemini-fact-file';
import type { FactFileCheck, FactFileData } from './FactFile';
import { SECTION_LABEL, factFileHarnessAnswers, factFileMiss, factFileSpokenMisses, fileTabs, fileText, workspaceScene }
  from './factFileWorkspace';
import { FACT_FILE_LEVERS, NO_LEVERS } from './factFileLevers';
import { factFileBoss } from './factFile.boss';

beforeEach(() => { resetSeams(); vi.clearAllMocks(); installRuntimeTimers(); });
afterEach(() => { cleanup(); restoreRuntimeTimers(); });

const flushScoring = () => act(async () => { for (let tick = 0; tick < 20; tick++) await Promise.resolve(); });

const FILE: Omit<FactFileData, 'selfChecks'> = {
  title: 'Volcanoes', category: 'Earth Science', description: 'Mountains that let melted rock out.',
  keyStats: [{ value: '1,350', unit: 'volcanoes', label: 'Active on land' }, { value: '1,200', unit: '°C', label: 'Lava heat' }],
  quickFacts: [{ fact: 'Melted rock under the ground is called magma.', icon: '🔥' }, { fact: 'Ash clouds can block sunlight.', icon: '☁️' }],
  deepDive: [{ heading: 'How they form', body: 'Plates of the crust move apart or push together, and magma rises.' }],
  records: [{ label: 'Tallest', value: 'Mauna Kea in Hawaii' }],
  didYouKnow: [{ text: 'Some volcanoes are under the sea.' }],
};
const check = (id: string, question: string, options: string[], correctIndex: number, extra: Partial<FactFileCheck> = {}): FactFileCheck =>
  ({ id, question, options, correctIndex, explanation: `Because of ${options[correctIndex]} reasons.`, difficulty: 'easy',
    relatedSection: 'quickFacts', ...extra });

/** One hand-built check per catalog mode; explore keeps the file open, recall and apply close it. */
const CHECKS: Record<string, FactFileCheck> = {
  explore: check('e1', 'What is melted rock under the ground called?', ['Magma', 'Mauna Kea', 'Granite', 'Sand'], 0, { fileOpen: true }),
  recall: check('r1', 'Which volcano is the tallest?', ['Mount Fuji', 'Mauna Kea', 'Magma', 'Etna'], 1,
    { fileOpen: false, relatedSection: 'records', difficulty: 'medium' }),
  apply: check('a1', 'Why might a town far from a volcano see a dark sky?', ['Ash clouds block sunlight', 'Magma', 'Rain falls', 'The moon hides'], 0,
    { fileOpen: false, difficulty: 'hard' }),
};
const MODES = (getComponentById('fact-file')?.evalModes ?? []).map(m => m.evalMode);
const data = (checks: FactFileCheck[], extra: Partial<FactFileData> = {}) => ({ ...FILE, selfChecks: checks, ...extra }) as unknown as Record<string, unknown>;
const TABS = ['Quick Facts', 'Deep Dive', 'Records', 'Did You Know?'];
const html = (h: WorkspaceHarness) => h.view.container.textContent ?? '';

/** A tap on the harness's right or wrong choice (the boss's `show` move), through the real button. */
function perform(h: WorkspaceHarness, d: Record<string, unknown>, intent: 'wrong' | 'correct') {
  const item = factFileBoss.items(d as never).find(i => i.id === h.state().task!.itemId)!;
  const { correct, wrong } = factFileHarnessAnswers(item, item.fileText);
  h.press(intent === 'correct' ? correct : wrong);
}
/** While the file is being read (recall, apply): open every tab and press Start questions, as the boss's harness does. */
function readFile(h: WorkspaceHarness, d: Record<string, unknown>) {
  if (!String(h.state().task!.demand.phase ?? '').startsWith('reading')) return;
  for (const t of fileTabs(d as never)) h.press(SECTION_LABEL[t]);
  h.press('Start questions');
}
const mount = (mode: string, d: Record<string, unknown>) => {
  seam.evaluationContext = { lesson: 'test' };
  const h = mountWorkspace({ primitiveId: 'fact-file', evalMode: mode, instanceId: 'fact-file', data: d });
  readFile(h, d);
  return h;
};

it('every catalog mode has a hand-built check', () => {
  expect(MODES.sort()).toEqual(Object.keys(CHECKS).sort());
});

it.each(Object.keys(CHECKS))('%s: one checked tap; a wrong one names its miss and shows no answer, Try again clears it, the right one completes once',
  async mode => {
    const c = CHECKS[mode];
    const d = data([c]);
    const h = mount(mode, d);
    const task = h.state().task!;
    expect(task.task).toContain(c.question);
    // Every choice can be said, so the item also takes it spoken: the observer judges against the key.
    expect(task.workspace!.expectedAnswer).toContain(`"${c.options[c.correctIndex]}"`);
    expect(task.demand.response).toBe('speech');
    expect(JSON.stringify(task.demand)).not.toMatch(/Because of|relatedSection|Mauna Kea in Hawaii|magma\./i);
    expect(task.demand).toMatchObject({ choices: c.options.join(' | '), learnerWork: 'No choice tapped yet' });
    expect(seam.legacyAI).not.toHaveBeenCalled();
    expect(html(h)).not.toMatch(/next question|see results/i);
    // explore: the file is open above the question; recall and apply: closed, key stats included.
    if (c.fileOpen) expect(html(h)).toMatch(/Lava heat/);
    else expect(html(h)).not.toMatch(/Lava heat|Quick Facts/);

    perform(h, d, 'wrong');
    expect(h.state().task!.evidence.correctness).toBe('incorrect');
    const miss = h.state().task!.workspace!.attempts.at(-1)?.miss;
    expect(getComponentById('fact-file')!.teachingWorkspace!.misses![mode]).toContain(miss);
    expect(html(h)).not.toMatch(/Because of/);
    expect(h.view.container.querySelectorAll('[class*="emerald"]').length).toBe(0);
    h.dispatch('retry');
    expect(h.state().task!.demand.learnerWork).toBe('No choice tapped yet');
    expect(html(h)).not.toMatch(/not quite/i);

    perform(h, d, 'correct');
    expect(h.state().task!.evidence.correctness).toBe('correct');
    h.dispatch('advance'); h.confirmVisible();
    expect(h.state().status).toBe('completed');
    await flushScoring();
    expect(seam.submit).toHaveBeenCalledOnce();
  });

it.each(Object.keys(CHECKS))('%s: a choice said aloud and credited by the tutor completes the check', async mode => {
  const c = CHECKS[mode];
  const h = mount(mode, data([c]));
  h.say(c.options.find((_, i) => i !== c.correctIndex)!); h.feedback('incorrect', 'retry');
  h.say(c.options[c.correctIndex]); h.feedback('correct', 'advance'); h.confirmVisible();
  expect(h.state().status).toBe('completed');
  await flushScoring();
  expect(seam.submit).toHaveBeenCalledOnce();
});

describe('the reading phase (recall, apply)', () => {
  it('hides the question until every tab is open and Start questions is pressed; nothing can be answered meanwhile', () => {
    seam.evaluationContext = { lesson: 'test' };
    const d = data([CHECKS.recall]);
    const h = mountWorkspace({ primitiveId: 'fact-file', evalMode: 'recall', instanceId: 'fact-file', data: d });
    expect(String(h.state().task!.demand.phase)).toMatch(/^reading/);
    expect(h.state().task!.workspace!.levers ?? []).toEqual([]);
    expect(html(h)).not.toContain(CHECKS.recall.question);
    expect(html(h)).not.toMatch(/Start questions/);
    // Speech while reading is not an answer.
    h.say('Mauna Kea');
    expect(h.state().task!.workspace!.pendingResponse).toBeFalsy();
    for (const t of TABS) h.press(t);
    h.press('Start questions');
    expect(h.state().task!.demand.phase).toBeUndefined();
    expect(html(h)).toContain(CHECKS.recall.question);
    expect(html(h)).not.toMatch(/Mauna Kea in Hawaii|Lava heat/);
  });

  it('explore opens with the question beside the file and no reading phase', () => {
    const h = mount('explore', data([CHECKS.explore]));
    expect(h.state().task!.demand.phase).toBeUndefined();
    expect(html(h)).toContain(CHECKS.explore.question);
    h.press('Records');
    expect(html(h)).toMatch(/Mauna Kea in Hawaii/);
  });
});

describe('levers', () => {
  const levers = (h: WorkspaceHarness) => (h.state().task!.workspace!.levers ?? []).map(l => [l.id, l.pulled]);
  const attempts = (h: WorkspaceHarness) => h.state().task!.workspace!.attempts;
  const onScreen = (h: WorkspaceHarness) => String(h.state().task!.demand.onScreen ?? '');

  it('recall: the section note names the section only, the file stays closed, and the next tap records it', () => {
    const d = data([CHECKS.recall]);
    const h = mount('recall', d);
    expect(levers(h)).toEqual([['point_to_section', false], ['drop_far_choice', false]]);
    perform(h, d, 'wrong');
    expect(h.dispatch('pull_lever', { lever: 'point_to_section' }).status).toBe('committed');
    expect(html(h)).toMatch(/This is in: Records/);
    expect(html(h)).not.toMatch(/Mauna Kea in Hawaii/);
    expect(onScreen(h)).toMatch(/Records section; the file stays closed/);
    h.dispatch('retry');
    perform(h, d, 'correct');
    expect(attempts(h).at(-1)).toMatchObject({ correct: true, levers: ['point_to_section'] });
  });

  it('explore: the note also rings the tab, and opens nothing', () => {
    const h = mount('explore', data([{ ...CHECKS.explore, relatedSection: 'records' }]));
    expect(h.dispatch('pull_lever', { lever: 'point_to_section' }).status).toBe('committed');
    expect(html(h)).not.toMatch(/Mauna Kea in Hawaii/);
    expect(h.view.container.querySelector('button[data-lever="point-to-section"]')?.getAttribute('aria-label')).toBe('Records');
    expect(onScreen(h)).toMatch(/that tab is ringed/);
  });

  it('the drop greys out an untried wrong choice the file does not state; a refused pull changes nothing', () => {
    const d = data([CHECKS.recall]);
    const h = mount('recall', d);
    h.press('Magma');
    expect(attempts(h).at(-1)).toMatchObject({ miss: 'other_file_fact' });
    const before = { demand: JSON.stringify(h.state().task!.demand), html: h.view.container.innerHTML };
    expect(h.dispatch('pull_lever', { lever: 'count_model' }).status).toBe('blocked');
    expect({ demand: JSON.stringify(h.state().task!.demand), html: h.view.container.innerHTML }).toEqual(before);
    expect(h.dispatch('pull_lever', { lever: 'drop_far_choice' }).status).toBe('committed');
    const dropped = Array.from(h.view.container.querySelectorAll('[data-dropped]')) as HTMLButtonElement[];
    expect(dropped.map(b => b.textContent)).toEqual(['Mount Fuji']);
    expect(dropped[0].disabled).toBe(true);
    expect(onScreen(h)).toBe('choice 1, "Mount Fuji", is greyed out and is not the answer');
    // Two wrong choices tried or dropped of three: no more drop, so the answer is never left alone.
    expect(levers(h)).toEqual([['point_to_section', false], ['drop_far_choice', true]]);
  });

  it('easy tier: the note is on screen from the start, so the lever is not offered and nothing is recorded', () => {
    const d = data([{ ...CHECKS.recall, sectionHint: true }]);
    const h = mount('recall', d);
    expect(html(h)).toMatch(/This is in: Records/);
    expect(levers(h)).toEqual([['drop_far_choice', false]]);
    perform(h, d, 'correct');
    expect(attempts(h).at(-1)).toMatchObject({ correct: true });
    expect(attempts(h).at(-1)?.levers ?? []).toEqual([]);
  });

  it('every miss a check names is answered by a lever, help first', () => {
    for (const c of Object.values(CHECKS)) {
      const text = fileText(FILE);
      const ls = FACT_FILE_LEVERS.declare({ ...c, id: c.id!, fileText: text }, { state: NO_LEVERS, preReader: false }, []);
      for (const miss of ['other_file_fact', 'not_in_file']) expect(nextLever(ls, miss)).toBe('point_to_section');
    }
  });
});

describe('misses', () => {
  const text = fileText(FILE);
  it.each([
    ['recall', 2, 'other_file_fact'], ['recall', 0, 'not_in_file'], ['recall', 3, 'not_in_file'], ['recall', 1, undefined],
    ['explore', 1, 'other_file_fact'], ['explore', 2, 'not_in_file'], ['apply', 1, 'other_file_fact'],
  ] as const)('%s choice %i is %s', (mode, picked, miss) => {
    expect(factFileMiss(CHECKS[mode], picked, text)).toBe(miss);
  });
  it('a spoken answer lists the other choices under the same ids, never the key', () => {
    const misses = factFileSpokenMisses(CHECKS.recall, text);
    expect(misses.map(m => m.id)).toEqual(['other_file_fact', 'not_in_file']);
    expect(JSON.stringify(misses)).not.toMatch(/Mauna Kea/);
  });
  it('picture choices with an emoji only stay a tap', () => {
    const c = check('p', 'Which is hot?', ['🔥', '🧊', '❄️'], 0);
    expect(factFileSpokenMisses(c, text)).toEqual([]);
    expect(factFileBoss.assignment({ ...c, id: 'p', fileText: text })).toEqual({ id: 'p', task: 'Which is hot?', response: 'gesture' });
  });
});

it('a right tap shows the explanation and waits for the observer; the next check opens blank', () => {
  const d = data([CHECKS.recall, { ...CHECKS.apply, id: 'a2' }]);
  const h = mount('recall', d);
  perform(h, d, 'correct');
  expect(html(h)).toMatch(/Because of Mauna Kea reasons/);
  h.settle(30000);
  expect(h.state().task!.itemId).toBe('r1');
  h.dispatch('advance'); h.confirmVisible();
  expect(h.state().task!.itemId).toBe('a2');
  expect(html(h)).not.toMatch(/Because of/);
  expect(html(h)).toContain(CHECKS.apply.question);
});

it('the scene never states the key, the explanation or the section', () => {
  const facts = JSON.stringify(workspaceScene(FILE, CHECKS.recall, { reading: false, picked: null }).facts);
  expect(facts).not.toMatch(/Because of|records|Mauna Kea in Hawaii/i);
});

it('pre-reader: picture choices with the tutor, a tap is checked, no section note', () => {
  const c = check('k1', 'Where does lava come from?', ['A volcano', 'A tree', 'A cloud'], 0, { optionEmojis: ['🌋', '🌳', '☁️'] });
  const d = data([c], { gradeLevel: 'K' });
  const h = mount('explore', d);
  expect(html(h)).not.toMatch(/Fact File:|Quick Facts/);
  expect(html(h)).toMatch(/🌋/);
  expect((h.state().task!.workspace!.levers ?? []).map(l => l.id)).toEqual(['drop_far_choice']);
  h.press(/A tree/);
  expect(h.state().task!.evidence.correctness).toBe('incorrect');
  expect(h.view.container.querySelectorAll('[class*="emerald"]').length).toBe(0);
});

it('the adapter refuses a check its tap cannot answer', () => {
  const validate = LIVE_ADAPTERS['fact-file'].validate;
  expect(() => validate(data([CHECKS.recall]))).not.toThrow();
  expect(() => validate(data([{ ...CHECKS.recall, correctIndex: 4 }]))).toThrow();
  expect(() => validate(data([{ ...CHECKS.recall, options: ['Etna', 'etna', 'Fuji', 'Magma'] }]))).toThrow();
  expect(() => validate(data([]))).toThrow();
});

describe('generator pick (code owns which questions ship and how)', () => {
  const pool: FactFileCheck[] = [
    check('', 'What is melted rock under the ground called?', ['Magma', 'Mauna Kea', 'Granite', 'Sand'], 0, { challengeType: 'recall_easy' }),
    check('', 'Which volcano is the tallest?', ['Mount Fuji', 'Mauna Kea', 'Magma', 'Etna'], 1, { challengeType: 'recall_medium' }),
    check('', 'Is melted rock called magma or granite?', ['Magma', 'Granite', 'Sand', 'Ash'], 0, { challengeType: 'recall_easy' }),
    check('', 'Which is true?', ['All of the above', 'Ash', 'Rock', 'Sea'], 0, { challengeType: 'recall_easy' }),
    check('', 'What can block sunlight?', ['Clouds of ash from an eruption can block sunlight', 'Rain', 'Wind', 'Snow'], 0, { challengeType: 'recall_easy' }),
    check('', 'Where are some volcanoes?', ['Under the sea', 'On the moon', 'In a cave', 'In space'], 0, { challengeType: 'recall_easy' }),
    check('', 'What can ash clouds block?', ['Sunlight', 'Rain', 'Wind', 'Snow'], 0, { challengeType: 'recall_easy' }),
  ];
  it('drops a key printed in the stem and "all of the above"', () => {
    expect(checkDefect(pool[2])).toMatch(/printed in the question/);
    expect(checkDefect(pool[3])).toMatch(/above/);
  });
  it('explore ships 3 open-file checks of its types, a plainly longest key ranked down', () => {
    const out = pickSelfChecks(pool, FILE, { mode: 'explore', allowedTypes: ['recall_easy'], tier: 'medium', preReader: false });
    expect(out).toHaveLength(3);
    expect(out.every(c => c.fileOpen && c.options.length === 4 && !c.sectionHint)).toBe(true);
    expect(out.map(c => c.id)).toEqual(['check-1', 'check-2', 'check-3']);
    expect(out.map(c => c.question)).not.toContain('What can block sunlight?');
  });
  it('never ships a question whose key another shipped question prints', () => {
    const leaky = [
      check('', 'Where do most plants live?', ['The canopy', 'The floor', 'The river', 'Underground'], 0, { challengeType: 'recall_hard' }),
      check('', 'Why is the floor dark?', ['Rain', 'The canopy blocks the light', 'Night', 'Fog'], 1, { challengeType: 'recall_hard' }),
      check('', 'Where are some volcanoes?', ['Under the sea', 'On the moon', 'In a cave', 'In space'], 0, { challengeType: 'recall_hard' }),
    ];
    const out = pickSelfChecks(leaky, FILE, { mode: 'apply', allowedTypes: ['recall_medium', 'recall_hard'], tier: 'medium', preReader: false });
    expect(out.map(c => c.question)).toEqual(['Where do most plants live?', 'Where are some volcanoes?']);
  });
  it('apply ranks a lookup stem last', () => {
    const mixed = [
      check('', 'How many volcanoes are active on land?', ['1,350', '20', '5', '90'], 0, { challengeType: 'recall_hard' }),
      ...['A', 'B', 'C', 'D'].map(x => check('', `Why might town ${x} see a dark sky?`, [`Ash ${x}`, `Rain ${x}`, `Fog ${x}`, `Night ${x}`], 0, { challengeType: 'recall_hard' as const })),
    ];
    const out = pickSelfChecks(mixed, FILE, { mode: 'apply', allowedTypes: ['recall_medium', 'recall_hard'], tier: 'medium', preReader: false });
    expect(out.map(c => c.question)).not.toContain('How many volcanoes are active on land?');
  });
  it('easy: four choices with the key kept, and the section note on from the start', () => {
    const out = pickSelfChecks(pool, FILE, { mode: 'recall', allowedTypes: ['recall_easy', 'recall_medium'], tier: 'easy', preReader: false });
    for (const c of out) {
      expect(c.options).toHaveLength(4);
      expect(c.sectionHint).toBe(true);
      expect(c.fileOpen).toBe(false);
      const source = pool.find(p => p.question === c.question)!;
      expect(c.options[c.correctIndex]).toBe(source.options[source.correctIndex]);
    }
  });
});
