// @vitest-environment jsdom
/**
 * L3 GOTCHA #2, checked at RUNTIME rather than by static analysis: a tier that
 * the SCRIPT withholds but the TUTOR volunteers is only half applied. The tier
 * reaches the tutor through the context bag — `primitive_data.supportTier` at
 * connect, then `updateContext` per item — and the catalog's `supportTier`
 * contextKey renders that value into RUNTIME STATE.
 *
 * WHY THIS TEST EXISTS AS A RENDER TEST. The `/tutor-test` Tier-2 probe reports
 * `supportTier: unresolved` → one `(not set)` in its prompt PREVIEW for every DI
 * pack, because `scaffoldAudit.analyzeHookSite` parses `useLuminaAI({ primitiveData })`
 * hook sites and the DI family passes its bag through `ctx.connect({ primitive_data })`
 * instead — all five packs report `data-bag-unparsed`, so the probe never sees
 * the component's key space at all. That is an analyzer blind spot, not evidence
 * about the shipped prompt, and the honest way to close it is to execute the
 * component and read what it actually sent. (The analyzer gap is filed
 * cross-queue; it is not this rung's to fix.)
 *
 * The bag also stays ANSWER-FREE at every tier — the shape name and the
 * side/corner count are the answers, so this asserts their absence too.
 */
import React from 'react';
import { render, screen, cleanup, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const connect = vi.fn(async (_payload: Record<string, unknown>) => {});
const updateContext = vi.fn();
const ctxState = {
  isConnected: false,
  isListening: false,
  isAudioPlaying: false,
  micLevel: 0,
  sessionMode: 'idle' as 'idle' | 'lesson',
  sessionResumeCount: 0,
  conversation: [] as Array<{ role: string; content: string }>,
};
vi.mock('@/contexts/LuminaAIContext', () => ({
  useLuminaAIContext: () => ({
    ...ctxState,
    sendText: vi.fn(),
    connect,
    disconnect: vi.fn(),
    reconnect: vi.fn(),
    startListening: vi.fn(() => { ctxState.isListening = true; }),
    stopListening: vi.fn(),
    updateContext,
  }),
}));

vi.mock('../../../evaluation', () => ({
  usePrimitiveEvaluation: () => ({
    submitResult: vi.fn(), hasSubmitted: false, submittedResult: null,
    elapsedMs: 0, resetAttempt: vi.fn(),
  }),
  useEvaluationContext: () => null,
}));

vi.mock('./diRunLog', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./diRunLog')>();
  return { ...actual, flushDiRunLog: vi.fn(async () => {}) };
});

import { DiShapes } from './DiShapes';
import { geometryFor, pointsAttr } from './diShapesGeometry';
import type { DiShapesChallenge, DiShapesSupportTier } from './diShapesScript';

/** A single-item pack whose drawing fields the test controls. */
const triangleData = (over: Partial<DiShapesChallenge>) => ({
  title: 'Shape Time',
  description: 'Look at each shape and answer out loud!',
  challenges: [{
    id: 'dish-1-triangle', challengeType: 'name_shape' as const, shape: 'triangle' as const,
    shapeWord: 'triangle', article: 'a' as const, sides: 3, corners: 3, rotationDeg: 0,
    asrAliases: ['triangle'], ...over,
  }],
  challengeType: 'name_shape' as const,
  gradeLevel: 'first grade',
  instanceId: 'obj-l4',
});

const packData = (supportTier?: DiShapesSupportTier) => {
  const challenges: DiShapesChallenge[] = [
    {
      id: 'dish-1-triangle', challengeType: 'count_sides', shape: 'triangle',
      shapeWord: 'triangle', article: 'a', sides: 3, corners: 3, rotationDeg: 12,
      countNumeral: 3, countWord: 'three', asrAliases: ['three', '3'],
      ...(supportTier ? { supportTier } : {}),
    },
    {
      id: 'dish-2-hexagon', challengeType: 'name_shape', shape: 'hexagon',
      shapeWord: 'hexagon', article: 'a', sides: 6, corners: 6, rotationDeg: -8,
      asrAliases: ['hexagon'],
      ...(supportTier ? { supportTier } : {}),
    },
  ];
  return {
    title: 'Shape Time',
    description: 'Look at each shape and answer out loud!',
    challenges,
    challengeType: 'count_sides' as const,
    gradeLevel: 'kindergarten',
    instanceId: 'obj1-shapes',
  };
};

/** The bag the component actually handed the tutor at connect. */
const connectBag = (): Record<string, unknown> => {
  const payload = connect.mock.calls[0]?.[0] as
    { primitive_data?: Record<string, unknown> } | undefined;
  return payload?.primitive_data ?? {};
};

const startRun = async () => {
  await act(async () => {
    screen.getByRole('button').click();
    await Promise.resolve();
  });
};

describe('DiShapes — the L4 drawing actually reaches the screen', () => {
  // The silent no-op this closes: the generator stamps `exemplar: 'variant'`
  // and `scalePct`, and a component that ignored them would render the textbook
  // picture at full size while every log line and test claimed the tier moved.
  beforeEach(() => {
    Object.defineProperty(globalThis.navigator, 'mediaDevices', {
      configurable: true, value: { getUserMedia: vi.fn() },
    });
  });
  afterEach(cleanup);

  const drawnPoints = (container: HTMLElement) =>
    container.querySelector('svg polygon')?.getAttribute('points') ?? '';
  const drawnTransform = (container: HTMLElement) =>
    container.querySelector('svg g')?.getAttribute('transform') ?? '';

  it('renders the VARIANT geometry when the item carries one', () => {
    const variant = geometryFor('triangle', 'variant');
    const prototype = geometryFor('triangle', 'prototype');
    if (variant.kind !== 'polygon' || prototype.kind !== 'polygon') throw new Error('polygons');

    const { container } = render(<DiShapes data={triangleData({ exemplar: 'variant' })} />);
    expect(drawnPoints(container)).toBe(pointsAttr(variant.points));
    expect(drawnPoints(container)).not.toBe(pointsAttr(prototype.points));
  });

  it('renders the PROTOTYPE when no exemplar is stamped (pre-L4 sessions unchanged)', () => {
    const prototype = geometryFor('triangle', 'prototype');
    if (prototype.kind !== 'polygon') throw new Error('polygon');
    const { container } = render(<DiShapes data={triangleData({})} />);
    expect(drawnPoints(container)).toBe(pointsAttr(prototype.points));
  });

  it('applies rotation AND scale to the drawing', () => {
    const { container } = render(
      <DiShapes data={triangleData({ exemplar: 'variant', scalePct: 70, rotationDeg: 137 })} />,
    );
    const t = drawnTransform(container);
    expect(t).toContain('rotate(137 100 100)');
    expect(t).toContain('scale(0.7)');
  });

  it('a full-size untiered item is drawn at scale 1', () => {
    const { container } = render(<DiShapes data={triangleData({})} />);
    expect(drawnTransform(container)).toContain('scale(1)');
  });
});

describe('DiShapes — the support tier reaches the tutor (L3 gotcha #2)', () => {
  beforeEach(() => {
    connect.mockClear();
    updateContext.mockClear();
    ctxState.isConnected = false;
    ctxState.isListening = false;
    ctxState.sessionMode = 'idle';
    Object.defineProperty(globalThis.navigator, 'mediaDevices', {
      configurable: true,
      value: { getUserMedia: vi.fn() },
    });
  });
  afterEach(cleanup);

  it('sends the running tier in primitive_data at connect', async () => {
    render(<DiShapes data={packData('hard')} />);
    await startRun();
    expect(connect).toHaveBeenCalled();
    expect(connectBag().supportTier).toBe('hard');
  });

  it('an UNTIERED session still reports a real tier — never absent, so RUNTIME STATE cannot read "(not set)"', async () => {
    // The catalog declares `supportTier` as a contextKey, so an absent value
    // would interpolate as literal "(not set)" into the tutor's prompt. A
    // pre-L3 session runs the easy shape, and that is what it reports.
    render(<DiShapes data={packData(undefined)} />);
    await startRun();
    const bag = connectBag();
    expect(bag).toHaveProperty('supportTier');
    expect(bag.supportTier).toBe('easy');
  });

  it('keeps RUNTIME STATE truthful per item via updateContext', async () => {
    ctxState.isConnected = true;
    render(<DiShapes data={packData('medium')} />);
    await act(async () => { await Promise.resolve(); });
    expect(updateContext).toHaveBeenCalled();
    const last = updateContext.mock.calls.at(-1)?.[0] as Record<string, unknown>;
    expect(last.supportTier).toBe('medium');
    expect(last.challengeType).toBe('count_sides');
  });

  it('the bag never carries an ANSWER at any tier — not the shape name, not the count', async () => {
    for (const tier of ['easy', 'medium', 'hard'] as const) {
      connect.mockClear();
      cleanup();
      render(<DiShapes data={packData(tier)} />);
      await startRun();
      const serialized = JSON.stringify(connectBag()).toLowerCase();
      for (const leak of ['triangle', 'hexagon', 'three', 'six']) {
        expect(serialized, `tier ${tier} leaked "${leak}" into the context bag`)
          .not.toContain(leak);
      }
      expect(connectBag().supportTier).toBe(tier);
    }
  });
});
