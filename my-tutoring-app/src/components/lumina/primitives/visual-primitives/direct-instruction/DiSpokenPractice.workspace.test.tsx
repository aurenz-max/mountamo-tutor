// @vitest-environment jsdom
/**
 * di-spoken-practice on the teaching workspace (rollout C6): every mode binds, the stimulus reaches the
 * screen without its answer, the key the observer judges against carries the pack's own judging clauses,
 * and only the observer's credit prints an answer.
 */
vi.mock('@/contexts/LuminaAIContext', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).luminaAIContextSeam());
vi.mock('@/components/lumina/hooks/useLiveVoiceTurns', async original => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).voiceTurnsSeam(original as any));
vi.mock('@/components/lumina/evaluation', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).evaluationSeam());
vi.mock('@/components/lumina/utils/SoundManager', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).soundSeam());

import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen } from '@testing-library/react';
import { installRuntimeTimers, restoreRuntimeTimers, seam } from '../../../components/live-activity/runtime/testing/liveRuntimeSeams';
import { mountWorkspace } from '../../../components/live-activity/runtime/testing/workspaceHarness';
import { LIVE_ADAPTERS } from '../../../components/live-activity/activityContract';
import { workspaceBinding } from '../../../components/live-activity/lessonWorkspacePlan';
import { DiSpokenPractice } from './DiSpokenPractice';
import type { SpokenPracticeItem, SpokenPracticeMode } from './diSpokenPracticeScript';

beforeEach(() => { installRuntimeTimers(); });
afterEach(() => { cleanup(); restoreRuntimeTimers(); });

const flushScoring = () => act(async () => { for (let tick = 0; tick < 20; tick++) await Promise.resolve(); });
const base: SpokenPracticeItem = {
  id: 'dsp-equal', mode: 'say_answer', action: 'say_answer', answerKind: 'voice', responseClass: 'short_spoken_word',
  stimulusRole: 'visual_target', stimulusKind: 'text', answerSource: 'recall', stimulusText: '=', stimulusEmoji: '',
  stimulusCount: 0, ask: 'What is this called?', howToPlay: 'Look, then say its name.', expectedAnswer: 'equal sign',
  alternates: ['equals'], acceptRule: '', signatureError: 'Saying "plus" names a different sign.',
  correctionBody: 'This is called equal sign.' };
const count: SpokenPracticeItem = { ...base, id: 'dsp-count', mode: 'count_and_say', stimulusRole: undefined, stimulusKind: 'objects',
  stimulusText: 'apples', stimulusEmoji: '🍎', stimulusCount: 4, ask: 'How many apples are there?', expectedAnswer: 'four',
  alternates: [], acceptRule: 'Counting aloud and landing on four is the answer.', signatureError: '' };
const pair: SpokenPracticeItem = { ...base, id: 'dsp-pair', mode: 'compare_choice', stimulusRole: undefined, stimulusKind: 'pair',
  stimulusText: 'pencil', stimulusEmoji: '✏️', stimulusText2: 'crayon', stimulusEmoji2: '🖍️', choices: ['longer', 'shorter'],
  ask: 'Here is a pencil and a crayon. Is the pencil longer or shorter?', expectedAnswer: 'longer', alternates: [],
  acceptRule: '', signatureError: '' };
const read: SpokenPracticeItem = { ...base, id: 'dsp-read', mode: 'read_aloud', stimulusRole: undefined, answerSource: 'decode',
  stimulusText: 'big dog', ask: 'Read this out loud.', expectedAnswer: 'big dog', alternates: [], signatureError: '' };
const explain: SpokenPracticeItem = { ...base, id: 'dsp-explain', mode: 'explain_concept', stimulusRole: undefined,
  stimulusText: '3 + 2 = 5', ask: 'What does the equal sign tell us here?', expectedAnswer: 'both sides the same',
  alternates: ['same amount'], conceptStatement: 'The equal sign means both sides have the same amount.', signatureError: '' };
const riddle: SpokenPracticeItem = { ...base, id: 'dsp-riddle', stimulusRole: undefined, stimulusKind: 'none',
  stimulusText: 'I have four legs and bark. What animal am I?', ask: 'I have four legs and bark. What animal am I?',
  expectedAnswer: 'dog', alternates: ['puppy'], signatureError: '' };
const BY_MODE: Record<SpokenPracticeMode, SpokenPracticeItem> = {
  say_answer: base, count_and_say: count, compare_choice: pair, read_aloud: read, explain_concept: explain };

const pack = (items: SpokenPracticeItem[], challengeType: SpokenPracticeMode = items[0].mode) => ({
  title: 'Say It Out Loud', description: 'Look, then answer out loud!', items, challengeType, gradeLevel: 'Grade 1' });
const mount = (data: ReturnType<typeof pack>, mode: string = data.challengeType) =>
  mountWorkspace({ primitiveId: 'di-spoken-practice', evalMode: mode, data: data as unknown as Record<string, unknown> });

describe('DiSpokenPractice — every mode binds and is spoken', () => {
  it.each(Object.keys(BY_MODE) as SpokenPracticeMode[])('%s binds in a lesson and publishes a spoken key', mode => {
    const data = pack([BY_MODE[mode]], mode);
    expect(workspaceBinding({ instanceId: 'ws', primitiveId: 'di-spoken-practice', pin: mode, objectiveIds: ['o'], data })).not.toBeNull();
    const task = mount(data).state().task!;
    expect(task.task).toBe(BY_MODE[mode].ask);
    expect(task.workspace!.expectedAnswer).toContain(mode === 'explain_concept' ? 'both sides have the same amount' : BY_MODE[mode].expectedAnswer);
  });

  it('the key carries the alternates, the menu, the accept rule and the signature error', () => {
    expect(mount(pack([base])).state().task!.workspace!.expectedAnswer)
      .toBe('"equal sign" (also accept "equals"). Saying "plus" names a different sign.');
    cleanup();
    expect(mount(pack([pair])).state().task!.workspace!.expectedAnswer).toContain('one word from "longer", "shorter"');
    cleanup();
    expect(mount(pack([count])).state().task!.workspace!.expectedAnswer).toContain('landing on four');
    cleanup();
    const key = mount(pack([explain])).state().task!.workspace!.expectedAnswer!;
    expect(key).toContain('"same amount"');
    expect(key).toContain('"3 + 2 = 5" read back');
  });

  it('the adapter refuses a counting item with nothing to count and an explain item with no idea', () => {
    expect(() => LIVE_ADAPTERS['di-spoken-practice'].validate(pack([{ ...count, stimulusCount: 0 }]))).toThrow();
    expect(() => LIVE_ADAPTERS['di-spoken-practice'].validate(pack([{ ...explain, conceptStatement: undefined }]))).toThrow();
  });
});

describe('DiSpokenPractice — the screen never names the answer early', () => {
  it('prints the symbol to name, never its name, and offers no tap-to-hear', () => {
    mount(pack([base]));
    expect(screen.getByText('=')).toBeTruthy();
    expect(screen.queryByText(/equal sign/i)).toBeNull();
    expect(screen.queryByRole('button', { name: /Hear/ })).toBeNull();
  });

  it('draws the pictures to count and no numeral; the scene names no count', () => {
    const h = mount(pack([count]));
    expect(h.view.container.querySelectorAll('[data-spoken-object] span').length).toBe(4);
    expect(screen.queryByText(/four|\b4\b/i)).toBeNull();
    expect(JSON.stringify(h.state().task!.workspace!.objects)).not.toMatch(/four|\b4\b/);
  });

  it('a listen-only riddle prints nothing but the listening cue', () => {
    mount(pack([riddle]));
    expect(screen.getByText('listen')).toBeTruthy();
    expect(screen.queryByRole('img')).toBeNull();
    expect(screen.queryByText(/dog/)).toBeNull();
  });
});

describe('DiSpokenPractice — credit prints an answer, a miss never does', () => {
  it('a wrong answer reopens; a credited answer joins the trail; the lesson completes once', async () => {
    seam.evaluationContext = { lesson: 'test' };
    const h = mount(pack([pair, count]), 'mixed');
    h.say('shorter'); h.feedback('incorrect', 'retry');
    expect(h.view.container.querySelector('[data-spoken-credited]')).toBeNull();
    h.say('longer'); h.feedback('correct', 'advance'); h.confirmVisible();
    expect(h.view.container.querySelector('[data-spoken-credited="dsp-pair"]')?.textContent).toBe('longer');
    h.say('four'); h.feedback('correct', 'advance'); h.confirmVisible();
    expect(h.state().status).toBe('completed');
    await flushScoring();
    expect(seam.submit).toHaveBeenCalledOnce();
    expect(seam.submit.mock.calls[0][2]).toMatchObject({ type: 'di-spoken-practice', correctCount: 2, firstTryCount: 1 });
  });

  it('outside a runtime the stage shows the needs-the-tutor card', () => {
    const view = render(<DiSpokenPractice data={pack([base])} />);
    expect(view.container.querySelector('[data-workspace-unbound]')).not.toBeNull();
  });
});
