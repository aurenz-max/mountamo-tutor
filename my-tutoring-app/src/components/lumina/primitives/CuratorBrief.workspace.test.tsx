// @vitest-environment jsdom
/**
 * The lesson opening (curator-brief) as an ungraded teaching surface: the real registry component
 * under a real LiveLessonRuntime. What is its own: the three captions reach the tutor as facts,
 * the quick-check answer reaches nothing (contract R3), a bound brief owns the lesson opening (R7),
 * an "I wonder" tap is host facts, and Start completes it without a submission.
 */
vi.mock('@/contexts/LuminaAIContext', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).luminaAIContextSeam());
vi.mock('@/components/lumina/hooks/useLiveVoiceTurns', async original => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).voiceTurnsSeam(original as any));
vi.mock('@/components/lumina/hooks/useLuminaAI', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).legacyAISeam());
vi.mock('@/components/lumina/evaluation', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).evaluationSeam());
vi.mock('@/components/lumina/utils/SoundManager', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).soundSeam());
vi.mock('@/components/lumina/service/geminiClient-api', () => ({ generateConceptImage: vi.fn(async () => 'data:image/png;base64,AA') }));

import React from 'react';
import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { installRuntimeTimers, restoreRuntimeTimers, seam } from '../components/live-activity/runtime/testing/liveRuntimeSeams';
import { mountWorkspace } from '../components/live-activity/runtime/testing/workspaceHarness';
import { lessonPrimitiveContext, workspaceBinding } from '../components/live-activity/lessonWorkspacePlan';
import { LIVE_ADAPTERS } from '../components/live-activity/activityContract';
import { generateConceptImage } from '../service/geminiClient-api';
import { finishOpeningFields, hookPicturePrompt } from '../service/curator-brief/briefOpening';
import { BRIEF_START_EVENT } from './curatorBriefWorkspace';
import CuratorBrief from './CuratorBrief';
import type { IntroBriefingData } from '../types';

const ANSWER = 'It reflects light from the Sun';
const BRIEF: IntroBriefingData = {
  primitive: 'intro_briefing', topic: 'Why the Moon has phases', subject: 'Science', gradeLevel: 'Grade 4',
  estimatedTime: '20 minutes',
  hook: { type: 'story', content: 'Some nights the Moon is a circle, other nights a thin banana.',
    question: 'Why does the Moon change shape?', imagePrompt: 'A quiet hill under a starry night sky', visual: '🚀' },
  bigIdea: { statement: 'We see different amounts of the Moon\'s lit half as it travels around Earth.', whyItMatters: 'It explains the sky.' },
  objectives: [{ id: 'obj1', text: 'Model how sunlight lights half of a ball', verb: 'apply', icon: 'puzzle' }],
  prerequisites: { shouldKnow: ['The Sun gives light'], quickCheck: { question: 'Does the Moon make its own light?', answer: ANSWER, hint: 'Think of a lamp.' } },
  roadmap: [{ phase: 'Explore', description: 'Look', activities: ['a'] }, { phase: 'Apply', description: 'Model', activities: ['b'] }],
  connections: { buildingFrom: ['Day and night'], leadingTo: ['Eclipses'], realWorld: ['Planning a night walk'] },
  mindset: { encouragement: 'You can do this.', growthTip: 'Draw what you see.' },
  today: 'We will use a ball and a light to see why the Moon changes.',
  wonders: [{ text: 'I wonder why we see the Moon in the day', emoji: '🔍' }, { text: 'I wonder what astronauts see', emoji: '🚀' }],
};
const data = BRIEF as unknown as Record<string, unknown>;

beforeEach(() => { installRuntimeTimers(); });
afterEach(() => { cleanup(); restoreRuntimeTimers(); vi.restoreAllMocks(); });

const mount = () => mountWorkspace({ primitiveId: 'curator-brief', evalMode: 'mixed', data });
const flush = () => act(async () => { await Promise.resolve(); await Promise.resolve(); });

describe('the lesson opening on the workspace', () => {
  it('binds as mixed, owns the lesson opening, and carries the teaching doctrine', () => {
    const binding = workspaceBinding({ instanceId: 'b', primitiveId: 'curator-brief', pin: undefined, objectiveIds: ['obj1', 'obj2'], data });
    expect(binding).toMatchObject({ evalMode: 'mixed', objectiveId: 'obj1' });
    const ctx = lessonPrimitiveContext({ componentId: 'curator-brief', instanceId: 'b', title: '', data }, binding!);
    expect(ctx).toMatchObject({ tutoring: null, owns_opening: true });
    expect(LIVE_ADAPTERS['curator-brief'].guidance).toMatch(/Nothing on this screen is graded/);
    // An old payload without a big idea keeps the scripted screen.
    expect(workspaceBinding({ instanceId: 'b', primitiveId: 'curator-brief', pin: undefined, objectiveIds: ['o'],
      data: { hook: 'Hi', objectives: ['Count'] } })).toBeNull();
  });

  it('gives the tutor three beats as facts and never the quick-check answer', async () => {
    const h = mount();
    await flush();
    const task = h.state().task!;
    expect(task.demand).toMatchObject({ hookQuestion: 'Why does the Moon change shape?', today: BRIEF.today,
      bigIdea: BRIEF.bigIdea.statement, picked: 'none', picture: expect.stringMatching(/^drawn/) });
    expect(String(task.demand.wonders)).toMatch(/1 \(cyan, 🔍\): I wonder why we see the Moon/);
    expect(h.tutorTools()).toEqual(['show']);
    const everything = [JSON.stringify(h.packet()), h.view.container.textContent, hookPicturePrompt(BRIEF)].join(' ');
    expect(everything).not.toContain(ANSWER);
    expect(everything).not.toContain('[READ_SECTION]');
    expect(screen.getByText('Why does the Moon change shape?')).toBeTruthy();
    expect(h.view.container.querySelector('[data-pip-object="picture"] img')).toBeTruthy();
    expect(seam.legacyAI).not.toHaveBeenCalled();
    h.close();
  });

  it('rings what the tutor shows, hears an "I wonder" tap once, and completes on Start without a submission', () => {
    seam.evaluationContext = { lesson: 'test' };
    const onStart = vi.fn();
    window.addEventListener(BRIEF_START_EVENT, onStart);
    const h = mount();
    h.dispatch('show', { targets: ['bigIdea', 'wonder-1'] });
    expect(h.view.container.querySelectorAll('[data-tutor-ring]')).toHaveLength(2);
    expect(seam.send, 'a tutor show is not news to the tutor').not.toHaveBeenCalled();
    h.touch('wonder-0');
    h.touch('wonder-0');
    expect(seam.send).toHaveBeenCalledTimes(1);
    expect(seam.send).toHaveBeenCalledWith(expect.stringMatching(/choice 1, which says: I wonder why we see the Moon/),
      expect.objectContaining({ author: 'host' }));
    expect(h.state().task!.demand.picked).toMatch(/^1: /);
    h.press('Start');
    expect(h.state().status).toBe('completed');
    expect(seam.submit).not.toHaveBeenCalled();
    expect(onStart).toHaveBeenCalledTimes(1);
    expect(screen.getByText('Lesson started')).toBeTruthy();
    window.removeEventListener(BRIEF_START_EVENT, onStart);
    h.close();
  });
});

describe('without the tutor', () => {
  it('renders the same screen at once, with the read-aloud, and never waits on the picture', () => {
    vi.mocked(generateConceptImage).mockImplementationOnce(() => new Promise(() => {}));
    render(<CuratorBrief data={BRIEF} />);
    expect(screen.getByText(BRIEF.bigIdea.statement)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Start' })).toBeTruthy();
    expect(document.querySelector('[data-picture="drawing"]')).toBeTruthy();
    expect(document.body.textContent).not.toContain(ANSWER);
    expect(document.body.textContent).not.toContain(BRIEF.mindset.growthTip);
  });

  it('a pre-reader gets picture choices and an icon Start', () => {
    render(<CuratorBrief data={{ ...BRIEF, gradeLevel: 'Kindergarten' }} />);
    expect(document.querySelector('[data-brief-reader="pre"]')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Start' }).textContent?.trim()).toBe('');
    expect(screen.getByRole('button', { name: 'I wonder what astronauts see' }).textContent).toContain('🚀');
  });

  it('still renders a legacy intro payload', () => {
    render(<CuratorBrief data={{ hook: 'Imagine a garden.', objectives: ['Name plant parts'] } as any} />);
    expect(screen.getByText('Imagine a garden.')).toBeTruthy();
  });
});

describe('the generator\'s opening fields', () => {
  it('drops anything carrying the quick-check answer and gives repeated themes distinct pictures', () => {
    const raw: Record<string, any> = {
      prerequisites: { quickCheck: { answer: 'red' } },
      hook: { question: 'What comes after blue?', imagePrompt: 'a red bead on a table' },
      today: 'We will make patterns.',
      wonders: [{ text: 'I wonder about red', theme: 'patterns' }, { text: 'I wonder about stripes', theme: 'patterns' },
        { text: 'I wonder about drums', theme: 'patterns' }, { text: 'I wonder about tiles', theme: 'art' }],
    };
    finishOpeningFields(raw);
    expect(raw.hook.imagePrompt).toBeUndefined();
    expect(raw.hook.question).toBe('What comes after blue?');
    expect(raw.wonders.map((w: any) => w.text)).toEqual(['I wonder about stripes', 'I wonder about drums', 'I wonder about tiles']);
    expect(new Set(raw.wonders.map((w: any) => w.emoji)).size).toBe(3);
  });

  it('drops a scene that asks the image model for a row, a count or a pattern', () => {
    const scene = (imagePrompt: string) => { const r: Record<string, any> = { hook: { imagePrompt } }; finishOpeningFields(r); return r.hook.imagePrompt; };
    expect(scene('A colorful row of children standing in line on a sunny school playground.')).toBeUndefined();
    expect(scene('Three red apples on a table')).toBeUndefined();
    expect(scene('A sunny school playground with a slide and swings')).toBe('A sunny school playground with a slide and swings');
  });
});
