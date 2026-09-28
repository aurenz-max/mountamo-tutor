// @vitest-environment jsdom
/**
 * number-bond on the shared teaching workspace, mounted the way a lesson mounts it (handoff 21 M1): what the
 * screen may show before a try (contract R12), then the in-item levers.
 */
vi.mock('@/contexts/LuminaAIContext', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).luminaAIContextSeam());
vi.mock('@/components/lumina/hooks/useLiveVoiceTurns', async original => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).voiceTurnsSeam(original as any));
vi.mock('@/components/lumina/hooks/useLuminaAI', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).legacyAISeam());
vi.mock('@/components/lumina/evaluation', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).evaluationSeam());
vi.mock('@/components/lumina/utils/SoundManager', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).soundSeam());
vi.mock('@/components/lumina/components/JudgedMicPanel', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).micPanelSeam());

import { readFileSync } from 'fs';
import { join } from 'path';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import { installRuntimeTimers, restoreRuntimeTimers } from '../../../components/live-activity/runtime/testing/liveRuntimeSeams';
import { mountWorkspace } from '../../../components/live-activity/runtime/testing/workspaceHarness';

beforeEach(() => { installRuntimeTimers(); });
afterEach(() => { cleanup(); restoreRuntimeTimers(); vi.restoreAllMocks(); });

const payload = (mode: string) => JSON.parse(readFileSync(join(process.cwd(),
  `src/components/lumina/components/live-activity/runtime/testing/w1-payloads/number-bond.${mode}.json`), 'utf-8')).data;

it.each(['build_equation', 'fact_family'])('%s: the empty equation entry shows no operator and no number before a try (R12)', (mode) => {
  const h = mountWorkspace({ primitiveId: 'number-bond', evalMode: mode, data: payload(mode), instanceId: 'bond' });
  h.settle();
  h.press('Join the groups');
  h.settle();
  expect(h.state().task!.workspace!.lastResponse).toMatchObject({ correct: true });
  h.dispatch('advance');
  h.settle();
  const entry = h.view.container.querySelector('input[aria-label="Equation keyboard entry"]') as HTMLInputElement | null;
  expect(entry, 'the equation phase is on screen').toBeTruthy();
  expect(entry!.value).toBe('');
  expect(entry!.placeholder).not.toMatch(/[+\-−=]|\d/);
  h.close();
});
