// @vitest-environment jsdom
/**
 * di-shapes on the teaching workspace (rollout B3): the L4 drawing reaches the screen, the support
 * tier reaches the tutor (now as a scene fact, not a connect bag), nothing the tutor or the screen is
 * handed before an answer names it, and the observer's credit is the only thing that labels a shape.
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
import { DiShapes } from './DiShapes';
import { geometryFor, pointsAttr } from './diShapesGeometry';
import type { DiShapesChallenge, DiShapesSupportTier } from './diShapesScript';

beforeEach(() => { installRuntimeTimers(); });
afterEach(() => { cleanup(); restoreRuntimeTimers(); });

const flushScoring = () => act(async () => { for (let tick = 0; tick < 20; tick++) await Promise.resolve(); });
const triangle = (over: Partial<DiShapesChallenge> = {}): DiShapesChallenge => ({
  id: 'dish-1-triangle', challengeType: 'name_shape', shape: 'triangle', shapeWord: 'triangle', article: 'a',
  sides: 3, corners: 3, rotationDeg: 0, asrAliases: ['triangle'], ...over });
const pack = (challenges: DiShapesChallenge[], challengeType: DiShapesChallenge['challengeType'] = 'name_shape') => ({
  title: 'Shape Time', description: 'Look at each shape and answer out loud!', challenges, challengeType, gradeLevel: 'kindergarten' });
const counting = (supportTier?: DiShapesSupportTier): DiShapesChallenge => ({ ...triangle(), id: 'dish-2-count', challengeType: 'count_sides',
  rotationDeg: 12, countNumeral: 3, countWord: 'three', asrAliases: ['three', '3'], ...(supportTier ? { supportTier } : {}) });
const mount = (data: ReturnType<typeof pack>, mode: string = data.challengeType) =>
  mountWorkspace({ primitiveId: 'di-shapes', evalMode: mode, data: data as unknown as Record<string, unknown> });
const drawn = (container: HTMLElement) => ({
  points: container.querySelector('[data-shape-object] svg polygon')?.getAttribute('points') ?? '',
  transform: container.querySelector('[data-shape-object] svg g')?.getAttribute('transform') ?? '',
});

describe('DiShapes — the L4 drawing actually reaches the screen', () => {
  it('renders the VARIANT geometry when the item carries one, the PROTOTYPE otherwise', () => {
    const variant = geometryFor('triangle', 'variant'), prototype = geometryFor('triangle', 'prototype');
    if (variant.kind !== 'polygon' || prototype.kind !== 'polygon') throw new Error('polygons');
    const a = mount(pack([triangle({ exemplar: 'variant' })]));
    expect(drawn(a.view.container).points).toBe(pointsAttr(variant.points));
    cleanup();
    const b = mount(pack([triangle()]));
    expect(drawn(b.view.container).points).toBe(pointsAttr(prototype.points));
  });

  it('applies rotation AND scale to the drawing; an untiered item is drawn at scale 1', () => {
    const a = mount(pack([triangle({ exemplar: 'variant', scalePct: 70, rotationDeg: 137 })]));
    expect(drawn(a.view.container).transform).toContain('rotate(137 100 100)');
    expect(drawn(a.view.container).transform).toContain('scale(0.7)');
    cleanup();
    expect(drawn(mount(pack([triangle()])).view.container).transform).toContain('scale(1)');
  });
});

describe('DiShapes — the tutor is told the tier and the task, never the answer early', () => {
  it.each(['name_shape', 'shape_review', 'count_sides', 'count_corners', 'mixed'])('%s binds in a lesson', mode => {
    const data = pack([triangle(), counting()], 'name_shape');
    expect(workspaceBinding({ instanceId: 'ws', primitiveId: 'di-shapes', pin: mode, objectiveIds: ['o'], data })).not.toBeNull();
  });

  it.each(['easy', 'medium', 'hard'] as const)('%s: the tier is a scene fact; neither the task nor the scene names the shape on a counting item', tier => {
    const h = mount(pack([counting(tier)], 'count_sides'));
    const task = h.state().task!;
    expect(task.demand).toMatchObject({ supportTier: tier, kind: 'count_sides' });
    const handed = JSON.stringify({ task: task.task, demand: task.demand, objects: task.workspace!.objects }).toLowerCase();
    for (const leak of ['triangle', 'three']) expect(handed, `${tier} leaked "${leak}"`).not.toContain(leak);
    expect(task.workspace!.expectedAnswer).toBe('three');
    expect(screen.queryByText(/triangle|three/i)).toBeNull();
  });

  it('a naming item publishes its spoken alternates with the key', () => {
    const h = mount(pack([triangle({ shape: 'rhombus', shapeWord: 'rhombus', spokenAlternates: ['diamond'] })]));
    expect(h.state().task!.workspace!.expectedAnswer).toBe('rhombus (also accept diamond)');
  });
});

describe('DiShapes — credit labels a shape, a miss never does', () => {
  it('a wrong name reopens; a credited name joins the trail; the lesson completes once', async () => {
    seam.evaluationContext = { lesson: 'test' };
    const h = mount(pack([triangle(), counting()]), 'mixed');
    h.say('circle'); h.feedback('incorrect', 'retry');
    expect(h.view.container.querySelector('[data-shape-credited]')).toBeNull();
    h.say('triangle'); h.feedback('correct', 'advance'); h.confirmVisible();
    expect(h.view.container.querySelector('[data-shape-credited="dish-1-triangle"]')?.textContent).toContain('triangle');
    h.say('three'); h.feedback('correct', 'advance'); h.confirmVisible();
    expect(h.state().status).toBe('completed');
    await flushScoring();
    expect(seam.submit).toHaveBeenCalledOnce();
    expect(seam.submit.mock.calls[0][2]).toMatchObject({ type: 'di-shapes', correctCount: 2, firstTryCount: 1, meanResponseMs: null });
  });

  it('outside a runtime the stage shows the needs-the-tutor card, never a stalled drill', () => {
    const view = render(<DiShapes data={pack([triangle()])} />);
    expect(view.container.querySelector('[data-workspace-unbound]')).not.toBeNull();
  });

  it('the adapter refuses a real-object item with no object', () => {
    expect(() => LIVE_ADAPTERS['di-shapes'].validate(pack([triangle({ challengeType: 'name_real_object' })]))).toThrow();
  });
});
