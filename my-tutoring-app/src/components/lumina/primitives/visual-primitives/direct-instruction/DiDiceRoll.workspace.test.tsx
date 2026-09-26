// @vitest-environment jsdom
/**
 * di-dice-roll on the teaching workspace (rollout C6): every mode binds; the dice stay covered and the
 * workspace is not ready for an answer until the learner rolls; the roll plays its sounds; the key
 * carries the comparison words and the count-aloud rule; only credit prints the answer.
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
import { SoundManager } from '../../../utils/SoundManager';
import { DiDiceRoll, type DiDiceRollData } from './DiDiceRoll';
import type { DiDiceRollChallenge } from './diDiceRollScript';

const setReducedMotion = (matches: boolean) => Object.defineProperty(window, 'matchMedia', {
  configurable: true, value: vi.fn().mockReturnValue({ matches }) });
beforeEach(() => { installRuntimeTimers(); setReducedMotion(true); });
afterEach(() => { cleanup(); restoreRuntimeTimers(); });

const flushScoring = () => act(async () => { for (let tick = 0; tick < 20; tick++) await Promise.resolve(); });
const count: DiDiceRollChallenge = { id: 'roll-1', challengeType: 'count_pips', action: 'count_pips', answerKind: 'voice',
  responseClass: 'number_word_to_20', sides: 6, value: 4, spokenAnswer: 'four', asrAliases: ['4'], supportTier: 'medium' };
const compare: DiDiceRollChallenge = { id: 'roll-2', challengeType: 'compare_dice', action: 'compare_dice', answerKind: 'voice',
  responseClass: 'short_spoken_word', sides: 6, value: 2, secondValue: 5, comparison: 'right', spokenAnswer: 'right', asrAliases: [] };
const sum: DiDiceRollChallenge = { id: 'roll-3', challengeType: 'sum_two_dice', action: 'sum_two_dice', answerKind: 'voice',
  responseClass: 'number_word_to_20', sides: 6, value: 3, secondValue: 4, total: 7, spokenAnswer: 'seven', asrAliases: ['7'] };
const BY_MODE = { count_pips: count, compare_dice: compare, sum_two_dice: sum } as const;

const pack = (challenges: DiDiceRollChallenge[], challengeType = challenges[0].challengeType): DiDiceRollData => ({
  title: 'Dice Time', description: 'Roll and say the number.', challenges, challengeType, gradeLevel: 'kindergarten' });
const mount = (data: DiDiceRollData, mode: string = data.challengeType) =>
  mountWorkspace({ primitiveId: 'di-dice-roll', evalMode: mode, data: data as unknown as Record<string, unknown> });
const roll = (name: RegExp = /Roll/) => fireEvent.click(screen.getByRole('button', { name }));

describe('DiDiceRoll — every mode binds; the roll comes first', () => {
  it.each(Object.keys(BY_MODE) as Array<keyof typeof BY_MODE>)('%s binds, and is not ready until the learner rolls', mode => {
    const data = pack([BY_MODE[mode]], mode);
    expect(workspaceBinding({ instanceId: 'ws', primitiveId: 'di-dice-roll', pin: mode, objectiveIds: ['o'], data })).not.toBeNull();
    const h = mount(data);
    expect(h.state().task!.demand).toMatchObject({ rolled: 'no', presentation: 'not ready' });
    expect(h.view.container.querySelectorAll('[role="img"]').length).toBe(0);
    roll();
    expect(h.state().task!.demand).toMatchObject({ rolled: 'yes', presentation: 'ready' });
    expect(h.view.container.querySelectorAll('[role="img"]').length).toBe(mode === 'count_pips' ? 1 : 2);
  });

  it('the key names the count-aloud route, or the three comparison answers', () => {
    expect(mount(pack([sum])).state().task!.workspace!.expectedAnswer).toBe('"seven". Counting all the dots aloud and ending on seven is the answer.');
    cleanup();
    expect(mount(pack([compare])).state().task!.workspace!.expectedAnswer).toContain('"the right die"');
  });

  it('the scene and the task never name a face value', () => {
    const h = mount(pack([sum]));
    roll();
    const handed = JSON.stringify({ task: h.state().task!.task, demand: h.state().task!.demand, objects: h.state().task!.workspace!.objects });
    expect(handed).not.toMatch(/\b(3|4|7|three|four|seven)\b/);
  });

  it('the adapter refuses a sum that does not add up and a comparison that disagrees with its dice', () => {
    expect(() => LIVE_ADAPTERS['di-dice-roll'].validate(pack([{ ...sum, total: 8 }]))).toThrow();
    expect(() => LIVE_ADAPTERS['di-dice-roll'].validate(pack([{ ...compare, comparison: 'left' }]))).toThrow();
  });
});

describe('DiDiceRoll — the roll', () => {
  it('is answerable from the tap, ticks through the frames and snaps once, then refuses a second roll', () => {
    setReducedMotion(false);
    vi.mocked(SoundManager.tap).mockClear(); vi.mocked(SoundManager.tick).mockClear(); vi.mocked(SoundManager.snap).mockClear();
    const h = mount(pack([count]));
    roll();
    expect(SoundManager.tap).toHaveBeenCalledOnce();
    expect(h.state().task!.demand).toMatchObject({ rolled: 'yes' });
    act(() => { vi.advanceTimersByTime(1000); });
    expect(SoundManager.tick).toHaveBeenCalledTimes(4);
    expect(SoundManager.snap).toHaveBeenCalledOnce();
    expect(h.state().task!.demand).toMatchObject({ rolled: 'yes' });
    fireEvent.click(screen.getByRole('button', { name: /Say how many dots/ }));
    expect(SoundManager.tap).toHaveBeenCalledOnce();
  });
});

describe('DiDiceRoll — credit prints the answer, a miss never does', () => {
  it('a wrong answer reopens with the dice still rolled; credit joins the trail; the lesson completes once', async () => {
    seam.evaluationContext = { lesson: 'test' };
    const h = mount(pack([count, compare]), 'mixed');
    roll();
    h.say('three'); h.feedback('incorrect', 'retry');
    expect(h.state().task!.demand).toMatchObject({ rolled: 'yes' });
    expect(h.view.container.querySelector('[data-dice-credited], [data-dice-trail]')).toBeNull();
    h.say('four'); h.feedback('correct', 'advance'); h.confirmVisible();
    expect(h.view.container.querySelector('[data-dice-trail="roll-1"]')?.textContent).toContain('four');
    expect(h.state().task!.demand).toMatchObject({ rolled: 'no' });
    roll();
    h.say('right'); h.feedback('correct', 'advance'); h.confirmVisible();
    expect(h.state().status).toBe('completed');
    await flushScoring();
    expect(seam.submit).toHaveBeenCalledOnce();
    expect(seam.submit.mock.calls[0][2]).toMatchObject({ type: 'di-dice-roll', correctCount: 2, firstTryCount: 1,
      challengeTypesTested: ['count_pips', 'compare_dice'] });
  });

  it('outside a runtime the stage shows the needs-the-tutor card', () => {
    const view = render(<DiDiceRoll data={pack([count])} />);
    expect(view.container.querySelector('[data-workspace-unbound]')).not.toBeNull();
  });
});
