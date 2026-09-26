// @vitest-environment jsdom
/**
 * di-word-problem-setup on the teaching workspace (rollout C6): every mode binds; the hands step is a checked
 * gesture that publishes no key and commits only a finished board after the stillness window; the spoken
 * steps publish keys; the page draws each step only once it is credited.
 */
vi.mock('@/contexts/LuminaAIContext', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).luminaAIContextSeam());
vi.mock('@/components/lumina/hooks/useLiveVoiceTurns', async original => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).voiceTurnsSeam(original as any));
vi.mock('@/components/lumina/evaluation', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).evaluationSeam());
vi.mock('@/components/lumina/utils/SoundManager', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).soundSeam());

import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { installRuntimeTimers, restoreRuntimeTimers, seam } from '../../../components/live-activity/runtime/testing/liveRuntimeSeams';
import { mountWorkspace } from '../../../components/live-activity/runtime/testing/workspaceHarness';
import { LIVE_ADAPTERS } from '../../../components/live-activity/activityContract';
import { workspaceBinding } from '../../../components/live-activity/lessonWorkspacePlan';
import { WORD_PROBLEM_BENCH_THEME } from '../../../service/qa/di/wordProblemBench';
import DiWordProblemSetup, { type DiWordProblemSetupData } from './DiWordProblemSetup';
import type { WordProblemChallengeType } from './diWordProblemScript';

beforeEach(() => { installRuntimeTimers(); });
afterEach(() => { cleanup(); restoreRuntimeTimers(); });

const flushScoring = () => act(async () => { for (let tick = 0; tick < 20; tick++) await Promise.resolve(); });
// Jen has 12. Tom has 8 more than Jen. How many does Tom have? → Tom's is the big number (the box); Jen's 12 is
// "the biggest number I see".
const pack = (challengeType: WordProblemChallengeType): DiWordProblemSetupData => ({
  title: 'Set Up the Story', description: 'Find the big number and say the family.', challengeType, gradeLevel: 'Grade 2',
  problems: [{ id: 'p1', frameId: 'comparison:more_person', theme: WORD_PROBLEM_BENCH_THEME, first: 12, second: 8, challengeType }] });
const mount = (data: DiWordProblemSetupData, mode: string = data.challengeType) =>
  mountWorkspace({ primitiveId: 'di-word-problem-setup', evalMode: mode, data: data as unknown as Record<string, unknown> });

const place = (label: string, zone: HTMLElement) => {
  fireEvent.click(screen.getByRole('button', { name: `Select ${label}` }));
  fireEvent.click(zone);
};
const smallZones = () => screen.getAllByLabelText('small amount drop zone');
const bigZone = () => screen.getByLabelText('big amount drop zone');
const settle = () => act(() => { vi.advanceTimersByTime(2000); });

describe('DiWordProblemSetup — every mode binds; the hands step is checked, the rest are spoken', () => {
  it.each(['find_big_number', 'build_family', 'classify_and_build'] as const)('%s binds in a lesson', mode => {
    expect(workspaceBinding({ instanceId: 'ws', primitiveId: 'di-word-problem-setup', pin: mode, objectiveIds: ['o'], data: pack(mode) })).not.toBeNull();
    const task = mount(pack(mode)).state().task!;
    expect(task.demand).toMatchObject({ kind: mode === 'classify_and_build' ? 'classify' : 'big_number' });
  });

  it('the hands step publishes no key and names no slot for a card', () => {
    const task = mount(pack('build_family')).state().task!;
    expect(task.demand).toMatchObject({ response: 'gesture' });
    expect(task.workspace!.expectedAnswer).toBeUndefined();
    expect(JSON.stringify(task.demand)).not.toMatch(/big number is|belongs/i);
  });

  it('the classify key names the kind and its signature error', () => {
    const key = mount(pack('classify_and_build')).state().task!.workspace!.expectedAnswer!;
    expect(key).toContain('"comparison"');
    expect(key).toContain('signature error');
  });

  it('the adapter refuses a story the plan gates drop', () => {
    const bad = pack('find_big_number');
    expect(() => LIVE_ADAPTERS['di-word-problem-setup'].validate({ ...bad, problems: [{ ...bad.problems[0], first: 0 }] })).toThrow();
  });
});

describe('DiWordProblemSetup — the board commits only when finished and still', () => {
  it('a small amount in the big slot commits as a miss after the window; Try again empties the board', () => {
    const h = mount(pack('build_family'));
    place("Tom's stickers", smallZones()[0]);
    place('how many more', smallZones()[1]);
    expect(h.state().task!.phase).toBe('working');
    place("Jen's stickers", bigZone());
    expect(h.state().task!.phase).toBe('working'); // still inside the stillness window
    settle();
    expect(h.state().task!.phase).toBe('checked');
    expect(h.state().task!.workspace!.lastResponse?.correct).toBe(false);
    h.dispatch('retry'); h.confirmVisible();
    expect(screen.getByRole('button', { name: "Select Tom's stickers" })).toBeTruthy();
  });

  it('taking a card back inside the window cancels the commit', () => {
    const h = mount(pack('find_big_number'));
    place("Tom's stickers", bigZone());
    fireEvent.click(screen.getByRole('button', { name: "Tom's stickers, in the big slot" }));
    settle();
    expect(h.state().task!.phase).toBe('working');
  });
});

describe('DiWordProblemSetup — the page draws only what is credited', () => {
  it('a right build draws the bar model; the spoken steps fill in the working; the lesson completes once', async () => {
    seam.evaluationContext = { lesson: 'test' };
    const h = mount(pack('build_family'));
    expect(h.view.container.querySelector('[data-word-problem-credited]')).toBeNull();
    place("Jen's stickers", smallZones()[0]);
    place('how many more', smallZones()[1]);
    place("Tom's stickers", bigZone());
    settle();
    expect(h.view.container.querySelector('[data-word-problem-credited="big"]')).not.toBeNull();
    h.dispatch('advance'); h.confirmVisible();
    expect(h.state().task!.demand).toMatchObject({ kind: 'family', response: 'speech' });
    expect(h.state().task!.workspace!.expectedAnswer).toContain('twelve plus eight equals box');
    h.say('twelve plus eight equals box'); h.feedback('correct', 'advance'); h.confirmVisible();
    expect(h.view.container.querySelector('[data-word-problem-credited="operation"]')).toBeNull();
    h.say('add'); h.feedback('correct', 'advance'); h.confirmVisible();
    expect(h.view.container.querySelector('[data-word-problem-credited="operation"]')?.textContent).toContain('12 + 8 = ▢');
    h.say('twenty'); h.feedback('correct', 'advance'); h.confirmVisible();
    expect(h.state().status).toBe('completed');
    await flushScoring();
    expect(seam.submit).toHaveBeenCalledOnce();
    expect(seam.submit.mock.calls[0][2]).toMatchObject({ type: 'di-word-problem-setup', correctCount: 4,
      bigNumberStepsTotal: 1, bigNumberStepsCorrect: 1, familyStepsTotal: 1, familyStepsCorrect: 1 });
  });

  it('outside a runtime the surface shows the needs-the-tutor card', () => {
    const view = render(<DiWordProblemSetup data={pack('find_big_number')} />);
    expect(view.container.querySelector('[data-workspace-unbound]')).not.toBeNull();
  });
});
