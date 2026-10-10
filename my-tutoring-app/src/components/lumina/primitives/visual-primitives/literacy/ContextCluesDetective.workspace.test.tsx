// @vitest-environment jsdom
/**
 * Context clues detective on the teaching workspace: what is its own. The generic W1 contract
 * (runtime/workspaceContract.test.tsx) covers ownership, the packet and self-advance.
 */
vi.mock('@/contexts/LuminaAIContext', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).luminaAIContextSeam());
vi.mock('@/components/lumina/hooks/useLiveVoiceTurns', async original => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).voiceTurnsSeam(original as any));
vi.mock('@/components/lumina/hooks/useLuminaAI', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).legacyAISeam());
vi.mock('@/components/lumina/evaluation', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).evaluationSeam());
vi.mock('@/components/lumina/utils/SoundManager', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).soundSeam());

import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import React from 'react';
import { act, cleanup, fireEvent, render } from '@testing-library/react';
import { installRuntimeTimers, restoreRuntimeTimers, seam } from '../../../components/live-activity/runtime/testing/liveRuntimeSeams';
import { mountWorkspace, type WorkspaceHarness } from '../../../components/live-activity/runtime/testing/workspaceHarness';
import { LIVE_ADAPTERS } from '../../../components/live-activity/activityContract';
import { workspaceBinding } from '../../../components/live-activity/lessonWorkspacePlan';
import { getComponentById } from '../../../service/manifest/catalog';
import ContextCluesDetective, { type ContextClueChallenge, type ContextCluesDetectiveData } from './ContextCluesDetective';
import { CONTEXT_CLUE_MISSES_BY_MODE, clueMiss, clueSteps, findCorrect, scriptedScore, stepFor } from './contextCluesWorkspace';

beforeEach(() => { installRuntimeTimers(); });
afterEach(() => { cleanup(); restoreRuntimeTimers(); });

const flushScoring = () => act(async () => { for (let tick = 0; tick < 20; tick++) await Promise.resolve(); });

const word = (id: string, clueType: ContextClueChallenge['clueType'], targetWord: string, texts: string[], target: number,
  clues: number[], correctMeaning: string, wrongMeanings: string[]): ContextClueChallenge => ({
  id, clueType, targetWord, correctMeaning,
  passage: { sentences: texts.map((text, i) => ({ id: `${id}_s${i + 1}`, text, isClue: clues.includes(i + 1) })) },
  targetWordSentenceId: `${id}_s${target}`, clueSentenceIds: clues.map(n => `${id}_s${n}`),
  meaningOptions: [wrongMeanings[0], correctMeaning, ...wrongMeanings.slice(1)], dictionaryDefinition: `${targetWord}: ${correctMeaning}.`,
});
const ITEMS: Record<string, ContextClueChallenge> = {
  definition: word('d', 'definition', 'nocturnal', ['Owls hunt at a strange time.', 'They are nocturnal animals.',
    'Nocturnal means awake and active at night.', 'In the day they rest in trees.'], 2, [3], 'Up at night, asleep by day', ['Very loud', 'Covered in feathers', 'Hungry']),
  synonym_antonym: word('s', 'antonym', 'timid', ['The puppy was timid.', 'Unlike his bold sister, he hid under the bed.',
    'He liked chewing socks.'], 1, [2], 'Shy and easily scared', ['Very brave', 'Sleepy', 'Fast']),
  example: word('e', 'example', 'reptiles', ['We visited the zoo.', 'We saw reptiles, such as snakes, lizards and turtles.',
    'Then we ate lunch.'], 2, [2], 'Cold-blooded animals with scales', ['Birds that sing', 'Baby animals', 'Ocean plants']),
  inference: word('i', 'inference', 'parched', ['We hiked for hours in the sun.', 'Our bottles were empty.',
    'My throat felt parched.', 'I gulped the water when we got home.'], 3, [1, 4], 'Very dry and thirsty', ['Sore from yelling', 'Cold', 'Sleepy']),
};
const WRONG_TYPE: Record<string, [string, string]> = {
  definition: ['Synonym', 'definition_synonym'], synonym_antonym: ['Synonym', 'similar_opposite'],
  example: ['Inference', 'said_inference'], inference: ['Example', 'stated_for_inference'],
};
// A synonym word beside the antonym one: the synonym_antonym session mixes types, so it keeps the classify step.
const SYN = word('y', 'synonym', 'enormous', ['The whale was enormous, or very large.', 'It swam past our boat.',
  'We took a photo.'], 1, [1], 'Very big', ['Very small', 'Quiet', 'Blue']);
const LESSONS: Record<string, ContextClueChallenge[]> = {
  definition: [ITEMS.definition], synonym_antonym: [ITEMS.synonym_antonym, SYN], example: [ITEMS.example], inference: [ITEMS.inference],
};
const lesson = (challenges: ContextClueChallenge[]): ContextCluesDetectiveData => ({ title: 'Word detectives', gradeLevel: '4', challenges });
const mount = (mode: string, challenges: ContextClueChallenge[]) =>
  mountWorkspace({ primitiveId: 'context-clues-detective', evalMode: mode, data: lesson(challenges) as unknown as Record<string, unknown> });
const enabled = (h: WorkspaceHarness, label: string) =>
  Array.from(h.view.container.querySelectorAll('button')).some(b => !b.disabled && b.textContent?.trim() === label);
const miss = (h: WorkspaceHarness) => h.state().task!.workspace!.attempts.at(-1)?.miss;
const advance = (h: WorkspaceHarness) => { h.dispatch('advance'); h.confirmVisible(); };

it('every catalog mode binds, with its miss list', () => {
  const entry = getComponentById('context-clues-detective')!;
  expect((entry.evalModes ?? []).map(m => m.evalMode).sort()).toEqual(Object.keys(ITEMS).sort());
  expect(entry.teachingWorkspace!.misses).toEqual(CONTEXT_CLUE_MISSES_BY_MODE);
  for (const mode of Object.keys(ITEMS)) {
    expect(workspaceBinding({ instanceId: 'ws', primitiveId: 'context-clues-detective', pin: mode, objectiveIds: ['o'],
      data: lesson([ITEMS[mode]]) as unknown as Record<string, unknown> }), mode).not.toBeNull();
  }
});

it.each(Object.keys(ITEMS))('%s: checked steps per word (classify only when the session mixes clue types), no key published before its step is credited; each wrong check names its miss and Try again clears it; the last right one completes once',
  async (mode) => {
    seam.evaluationContext = { lesson: 'test' };
    const c = ITEMS[mode];
    const mixed = LESSONS[mode].length > 1;
    const h = mount(mode, LESSONS[mode]);
    const clueNo = c.passage.sentences.findIndex(s => s.id === (c.clueSentenceIds.find(id => id !== c.targetWordSentenceId) ?? c.targetWordSentenceId)) + 1;
    const typeLabel = c.clueType[0].toUpperCase() + c.clueType.slice(1);
    // Find.
    let task = h.state().task!;
    expect(task.itemId).toBe(`${c.id}:find`);
    expect(task.workspace!.expectedAnswer).toBeUndefined();
    expect(JSON.stringify(h.state().task)).not.toMatch(new RegExp(`${c.correctMeaning}|clue type is|${typeLabel}\\b|clueSentenceIds`, 'i'));
    expect(seam.legacyAI).not.toHaveBeenCalled();
    expect(h.view.container.textContent).not.toMatch(/Next Word|Finish/);
    const wrongNo = c.passage.sentences.findIndex(s => !c.clueSentenceIds.includes(s.id) && s.id !== c.targetWordSentenceId) + 1;
    h.press(`sentence ${wrongNo}`); h.press('Check Clue');
    expect(h.state().task!.evidence.correctness).toBe('incorrect');
    expect(miss(h)).toBe('no_clue');
    expect(enabled(h, 'Check Clue')).toBe(false);
    h.press(`sentence ${clueNo}`);
    expect(h.state().task!.demand.learnerWork).toBe(`Tapped sentence ${wrongNo}`);
    h.dispatch('retry');
    expect(h.state().task!.demand.learnerWork).toBe('No sentence tapped yet');
    h.press(`sentence ${clueNo}`); h.press('Check Clue');
    expect(h.state().task!.evidence.correctness).toBe('correct');
    advance(h);
    if (mixed) {
    // Classify.
    task = h.state().task!;
    expect(task.itemId).toBe(`${c.id}:classify`);
    expect(JSON.stringify(task.demand)).not.toMatch(new RegExp(`${c.correctMeaning}|clue type is`, 'i'));
    expect(String(task.demand.clueSentences)).toMatch(/shaded green/);
    h.press(WRONG_TYPE[mode][0]); h.press('Check Type');
    expect(miss(h)).toBe(WRONG_TYPE[mode][1]);
    expect(h.view.container.textContent).not.toMatch(/Correct! You identified/);
    h.dispatch('retry');
    expect(h.state().task!.demand.learnerWork).toBe('No clue type chosen yet');
    h.press(typeLabel); h.press('Check Type');
    expect(h.state().task!.evidence.correctness).toBe('correct');
    advance(h);
    }
    // Define: right after find when every word shares one clue type (no classify item is built).
    task = h.state().task!;
    expect(task.itemId).toBe(`${c.id}:define`);
    expect(String(task.demand.clueType)).toContain(typeLabel);
    expect(h.state().task!.task).not.toMatch(/Check Type/);
    expect(String(task.demand.step)).toBe(`Word 1 of ${LESSONS[mode].length}, step ${mixed ? 3 : 2} of ${mixed ? 3 : 2}: give the meaning.`);
    h.press(c.meaningOptions![0]); h.press('Check Meaning');
    expect(miss(h)).toBe('other_meaning');
    // A miss shows neither the meaning nor the dictionary.
    expect(h.view.container.textContent).not.toMatch(/The meaning is|Dictionary Definition/);
    expect(h.view.container.querySelector('[data-state="correct"]')).toBeNull();
    h.dispatch('retry');
    expect(h.state().task!.demand.learnerWork).toBe('No meaning chosen yet');
    h.press(c.correctMeaning); h.press('Check Meaning');
    expect(h.state().task!.evidence.correctness).toBe('correct');
    expect(h.view.container.textContent).toMatch(/Dictionary Definition/);
    advance(h);
    if (mixed) {
      expect(h.state().task!.itemId).toBe('y:find');
      h.press('sentence 1'); h.press('Check Clue'); advance(h);
      expect(h.state().task!.itemId).toBe('y:classify');
      h.press('Synonym'); h.press('Check Type'); advance(h);
      h.press('Very big'); h.press('Check Meaning'); advance(h);
    }
    expect(h.state().status).toBe('completed');
    await flushScoring();
    expect(seam.submit).toHaveBeenCalledOnce();
    expect(seam.legacyAI).not.toHaveBeenCalled();
  });

it('the find check: a clue elsewhere is not found by the highlighted sentence alone, nor by tapping every sentence', () => {
  const d = ITEMS.definition, e = ITEMS.example;
  const [find] = clueSteps([d]);
  const view = (picked: string[]) => ({ picked, clueType: '', meaning: '' });
  expect(findCorrect(d, ['d_s2'])).toBe(false);
  expect(clueMiss(find, view(['d_s2']))).toBe('target_sentence_only');
  expect(clueMiss(find, view(['d_s1', 'd_s2', 'd_s3', 'd_s4']))).toBe('extra_sentence');
  expect(findCorrect(d, ['d_s2', 'd_s3'])).toBe(true);
  expect(clueMiss(find, view(['d_s1']))).toBe('no_clue');
  // An example clue sits inside the word's own sentence, which can be tapped.
  expect(findCorrect(e, ['e_s2'])).toBe(true);
  const h = mount('example', [e]);
  h.press('sentence 2'); h.press('Check Clue');
  expect(h.state().task!.evidence.correctness).toBe('correct');
});

it('the live host (no evaluation provider) never submits', async () => {
  const c = ITEMS.example;
  const h = mount('example', [c]);
  h.press('sentence 2'); h.press('Check Clue'); advance(h);
  h.press(c.correctMeaning); h.press('Check Meaning'); advance(h);
  expect(h.state().status).toBe('completed');
  await flushScoring();
  expect(seam.submit).not.toHaveBeenCalled();
});

it('the adapter refuses a word its own check cannot read', () => {
  const validate = LIVE_ADAPTERS['context-clues-detective'].validate;
  expect(() => validate(lesson([{ ...ITEMS.definition, clueSentenceIds: ['nope'] }]))).toThrow();
  expect(() => validate(lesson([{ ...ITEMS.definition, targetWordSentenceId: 'nope' }]))).toThrow();
  expect(() => validate(lesson([{ ...ITEMS.definition, meaningOptions: ['a', 'b'] }]))).toThrow();
  expect(validate(lesson(Object.values(ITEMS)))).toBeTruthy();
});

it('the classify step is built only when the session mixes clue types', () => {
  expect(clueSteps([ITEMS.definition]).map(s => s.phase)).toEqual(['find', 'define']);
  expect(clueSteps([ITEMS.synonym_antonym, SYN]).map(s => s.id)).toEqual(['s:find', 's:classify', 's:define', 'y:find', 'y:classify', 'y:define']);
  expect(stepFor([ITEMS.definition], 'd:classify')).toBeNull();
});

it('the scripted path (no runtime) keeps its flow: steps advance on their own, a wrong meaning shows the meaning, Finish submits', () => {
  const c = ITEMS.synonym_antonym;
  const view = render(<ContextCluesDetective data={lesson([c])} />);
  const press = (label: string) => act(() => {
    const b = Array.from(view.container.querySelectorAll('button')).find(x => x.textContent?.trim() === label || x.getAttribute('aria-label') === label);
    expect(b, label).toBeTruthy(); fireEvent.click(b!);
  });
  press('sentence 2'); press('Check Clue');
  act(() => { vi.advanceTimersByTime(1100); });
  // One word, one clue type: no classify step.
  expect(view.container.textContent).not.toMatch(/What type of context clue/);
  press('Very brave'); press('Check Meaning');
  expect(view.container.textContent).toMatch(/The meaning is: "Shy and easily scared"/);
  expect(seam.legacyAI).toHaveBeenCalledWith('enabled');
  press('Finish');
  expect(seam.submit).toHaveBeenCalledOnce();
  // Clue found, meaning wrong, no type step: 30/70 of the word, rescaled.
  expect(seam.submit.mock.calls[0][1]).toBe(43);
});

it('the scripted score weighs only the steps built: 30/30/40 with a type step, find 3/7 and define 4/7 without', () => {
  const r = (clueCorrect: boolean, typeCorrect: boolean, meaningCorrect: boolean) => ({ clueCorrect, typeCorrect, meaningCorrect });
  expect(scriptedScore([r(true, true, true)], true)).toBe(100);
  expect(scriptedScore([r(true, false, false)], true)).toBe(30);
  expect(scriptedScore([r(true, true, false), r(true, false, true)], true)).toBe(30 + 15 + 20);
  expect(scriptedScore([r(true, false, true)], false)).toBe(100);
  expect(scriptedScore([r(true, false, false)], false)).toBe(43);
  expect(scriptedScore([r(false, false, true)], false)).toBe(57);
  expect(scriptedScore([], false)).toBe(0);
});
