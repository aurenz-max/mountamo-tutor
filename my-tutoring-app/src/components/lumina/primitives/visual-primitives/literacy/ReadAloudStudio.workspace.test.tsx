// @vitest-environment jsdom
/**
 * Read aloud studio on the teaching workspace: what is its own, plus its Pip surface. The generic
 * W1 contract (runtime/workspaceContract.test.tsx) covers ownership, the packet and self-advance.
 */
vi.mock('@/contexts/LuminaAIContext', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).luminaAIContextSeam());
vi.mock('@/components/lumina/hooks/useLiveVoiceTurns', async original => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).voiceTurnsSeam(original as any));
vi.mock('@/components/lumina/evaluation', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).evaluationSeam());
vi.mock('@/components/lumina/utils/SoundManager', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).soundSeam());

import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { act, cleanup, screen } from '@testing-library/react';
import { installRuntimeTimers, restoreRuntimeTimers, seam } from '../../../components/live-activity/runtime/testing/liveRuntimeSeams';
import { mountWorkspace } from '../../../components/live-activity/runtime/testing/workspaceHarness';
import { LIVE_ADAPTERS } from '../../../components/live-activity/activityContract';
import { workspaceBinding } from '../../../components/live-activity/lessonWorkspacePlan';
import { PipSurfaceStore } from '../../../pip/PipSurfaceStore';

beforeEach(() => { installRuntimeTimers(); });
afterEach(() => { cleanup(); restoreRuntimeTimers(); });

const LINES = [{ text: 'Sam reads a book.' }, { text: 'He looks at words.' }];
const PAYLOADS: Record<string, Record<string, unknown>> = {
  accuracy: { title: 'Fun to Read', gradeLevel: '1', lexileLevel: '200L', fluencyFocus: 'accuracy', lines: LINES },
  dialogue: { title: 'Voices', gradeLevel: '3', lexileLevel: '500L', fluencyFocus: 'dialogue',
    lines: [{ text: 'I found the missing key!', speaker: 'Mia' }, { text: 'Where was it hiding?', speaker: 'Leo' }] },
  expression: { title: 'Phrases', gradeLevel: '3', lexileLevel: '500L', fluencyFocus: 'expression',
    lines: [{ text: 'When the rain stopped, we ran outside.', phraseGroups: ['When the rain stopped,', 'we ran outside.'] }] },
};
const mount = (mode: string, pipStore?: PipSurfaceStore) =>
  mountWorkspace({ primitiveId: 'read-aloud-studio', evalMode: mode, data: PAYLOADS[mode], instanceId: 'read-aloud-studio', pipStore });

it.each(Object.keys(PAYLOADS))('%s binds on its first item', mode => {
  expect(workspaceBinding({ instanceId: 'ws', primitiveId: 'read-aloud-studio', pin: mode, objectiveIds: ['o'], data: PAYLOADS[mode] })).not.toBeNull();
  const task = mount(mode).state().task!;
  expect(task.task).not.toMatch(/Your turn/);
  if (mode === 'expression') {
    expect(task.workspace!.expectedAnswer).toBeUndefined();
    expect(task.demand.constraints).toMatch(/not a test/);
  } else {
    expect(task.workspace!.expectedAnswer).toContain((PAYLOADS[mode].lines as Array<{ text: string }>)[0].text);
  }
});

it('accuracy is a cold read: the task never says the line', () => {
  const task = mount('accuracy').state().task!;
  expect(task.task).not.toMatch(/Sam|book/);
  expect(task.demand.constraints).toMatch(/cold read/);
});

it('dialogue models the line in the speaker\'s voice first', () => {
  expect(mount('dialogue').state().task!.task).toMatch(/Mia says: I found the missing key!/);
});

it('a wrong read reopens the line, a right one marks it read', () => {
  const h = mount('accuracy');
  expect(screen.queryByRole('button', { name: /say that again|next|record/i })).toBeNull();
  h.say('Sam reads book'); h.feedback('incorrect', 'retry'); h.confirmVisible();
  expect(screen.getByText('read it')).toBeTruthy();
  h.say('Sam reads a book'); h.feedback('correct');
  expect(screen.getByText('yes!')).toBeTruthy();
});

const TWO_LINES = { title: 'After the rain', gradeLevel: '3', lexileLevel: '520L', fluencyFocus: 'expression', lines: [
  { text: 'After the rain, the birds sang.', phraseGroups: ['After the rain,', 'the birds sang.'] },
  { text: 'The sun came out.', phraseGroups: ['The sun came out.'] },
] };
const pressed = (name: string) => screen.getByRole('button', { name }).getAttribute('aria-pressed');

it('expression: marks toggle, the plan commits once and carries into both reads; marks reset on the next line', () => {
  const h = mountWorkspace({ primitiveId: 'read-aloud-studio', evalMode: 'expression', data: TWO_LINES, instanceId: 'read-aloud-studio' });
  expect(screen.queryByText('One way to group the words')).toBeNull();
  h.press('Pause after rain, word 3');
  expect(pressed('Pause after rain, word 3')).toBe('true');
  h.press('Pause after rain, word 3');
  expect(pressed('Pause after rain, word 3')).toBe('false');
  h.press('Pause after rain, word 3');
  expect(h.state().task!.demand.plan).toMatch(/After the rain, \/ the birds sang\./);
  h.press('Use my phrase plan'); h.press('Use my phrase plan');
  expect(h.state().task!.workspace!.attempts).toHaveLength(1);
  expect(h.state().task!.evidence.correctness).toBe('correct');
  h.dispatch('advance'); h.confirmVisible();
  expect(h.state().task!.itemId).toBe('line-1-first_read');
  expect(h.state().task!.demand.constraints).toMatch(/cold read/);
  expect(screen.getByText('After the rain, / the birds sang.')).toBeTruthy();
  expect(screen.queryByText('One way to group the words')).toBeNull();
  h.say('After the rain the birds sang'); h.feedback('correct', 'advance'); h.confirmVisible();
  expect(h.state().task!.itemId).toBe('line-1-reread');
  expect(h.state().task!.task).toMatch(/Listen: After the rain, the birds sang\./);
  expect(h.state().task!.demand.model).toBe('Model the groups in order: After the rain, / the birds sang.');
  expect(screen.getByText('One way to group the words')).toBeTruthy();
  h.say('After the rain the birds sang'); h.feedback('correct', 'advance'); h.confirmVisible();
  expect(h.state().task!.itemId).toBe('line-2-mark');
  expect(screen.getAllByRole('button', { name: /Pause after/ }).every(b => b.getAttribute('aria-pressed') === 'false')).toBe(true);
});

it('expression: a one-phrase plan is fine, and only the modeled reread is scored', async () => {
  seam.evaluationContext = { lesson: 'test' };
  const h = mount('expression');
  h.press('Use my phrase plan');
  expect(h.state().task!.workspace!.attempts[0].response).toBe('Committed the phrase plan: When the rain stopped, we ran outside.');
  h.dispatch('advance'); h.confirmVisible();
  // A missed first read is practice: it does not reach the line's score.
  h.say('When rain stopped we ran'); h.feedback('incorrect', 'retry'); h.confirmVisible();
  h.say('When the rain stopped we ran outside'); h.feedback('correct', 'advance'); h.confirmVisible();
  h.say('When the rain stopped we ran outside'); h.feedback('correct', 'advance'); h.confirmVisible();
  expect(h.state().status).toBe('completed');
  await act(async () => { for (let tick = 0; tick < 20; tick++) await Promise.resolve(); });
  expect(seam.submit).toHaveBeenCalledOnce();
  const [passed, score, metrics, work] = seam.submit.mock.calls[0];
  expect([passed, score]).toEqual([true, 100]);
  expect(metrics).toMatchObject({ type: 'read-aloud-studio', linesTotal: 1, linesRead: 1, firstTryCount: 1 });
  expect(work).toMatchObject({ prosodyAssessed: false, scoringBasis: 'modeled-reread-word-accuracy' });
  expect(work.lineResults).toHaveLength(1);
  expect(work.firstReadResults).toHaveLength(1);
  expect(work.phrasePlans[0].learnerGroups).toEqual(['When the rain stopped, we ran outside.']);
});

it('Pip outlines the printed line and celebrates the credit', () => {
  const store = new PipSurfaceStore();
  store.setActive('read-aloud-studio');
  const h = mount('accuracy', store);
  expect(store.getActive()?.targets.map(t => t.id)).toEqual(['stimulus']);
  h.say('Sam reads a book'); h.feedback('correct');
  expect(store.getActive()?.pose).toEqual({ phase: 'celebrating', gesture: 'none' });
});

it('the adapter refuses a passage with no askable line', () => {
  const adapter = LIVE_ADAPTERS['read-aloud-studio'];
  expect(() => adapter.validate({ ...PAYLOADS.accuracy, lines: [{ text: 'Go.' }] })).toThrow();
  expect(adapter.validate(PAYLOADS.accuracy)).toBeTruthy();
});
