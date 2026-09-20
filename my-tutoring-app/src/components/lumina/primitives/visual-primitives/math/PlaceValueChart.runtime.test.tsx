// @vitest-environment jsdom
//
// Real PlaceValueChart, real judged runner, real LiveLessonRuntime, real transport
// and rendering shell. Only the microphone-side context, the voice-turn detector,
// the evaluation write and sound are substituted, all from the shared seam module.
//
// The closed action contract — what a judged family may advertise, what it must
// refuse, that no aid states the answer, that every registered mode is covered — is
// proven by `describeJudgedConformance`. What is written out below it is the only
// thing that is this primitive's own: which misstep each aid answers, and how a
// child's answer routes between them.
import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import { cleanup } from '@testing-library/react';

// `vi.mock` is hoisted above every declaration, and its specifier must be a literal
// for the bundler to resolve it — so the seam path is spelled out rather than shared
// through a constant. These five lines are identical in every runtime test file.
vi.mock('@/contexts/LuminaAIContext', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).luminaAIContextSeam());
vi.mock('../../../hooks/useLiveVoiceTurns', async original => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).voiceTurnsSeam(original as any));
vi.mock('../../../evaluation', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).evaluationSeam());
vi.mock('../../../utils/SoundManager', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).soundSeam());
vi.mock('../../../components/JudgedMicPanel', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).micPanelSeam());

import React from 'react';
import { installRuntimeTimers, restoreRuntimeTimers } from '../../../components/live-activity/runtime/testing/liveRuntimeSeams';
import { mountJudged, type JudgedHarness } from '../../../components/live-activity/runtime/testing/judgedRuntimeHarness';
import { describeJudgedConformance } from '../../../components/live-activity/runtime/testing/judgedConformance';
import PlaceValueChart, { type PlaceValueChartData } from './PlaceValueChart';

type Mode = 'identify' | 'build' | 'compare' | 'expanded_form';

// Block bodies: an arrow returning the helper would run its return value as teardown.
beforeEach(() => { installRuntimeTimers(); });
afterEach(() => { cleanup(); restoreRuntimeTimers(); });

/** The mounted instance id. The session's active primitive must match it exactly. */
const INSTANCE = 'chart';

/** Forty-five, with the TENS digit glowing: four in the tens place, worth forty. */
const CHALLENGE = { id: 'p1', targetNumber: 45, highlightedDigitPlace: 1,
  minPlace: 0, maxPlace: 1, placeNameChoices: [], digitValueChoices: [] };

/**
 * The data object is built ONCE per mount and closed over, never rebuilt inside
 * `children`. The harness rerenders on every tutor turn, and a fresh `data`
 * identity each time remounts the judged runner: the owner reverts to `tutor` and
 * nothing is ever advertised.
 */
const mount = (mode: Mode = 'compare') => {
  const data = { instanceId: INSTANCE, title: 'Place value', description: 'Say it',
    challengeType: mode, supportTier: 'medium', challenges: [CHALLENGE] } as unknown as PlaceValueChartData;
  return mountJudged({
    activePrimitiveId: INSTANCE,
    opening: 'Hi! Look at the chart. Your turn.',
    children: () => <PlaceValueChart data={data} autoStart />,
  });
};

/**
 * Answer the place ask correctly and let the runner open the next item.
 *
 * One analyze challenge produces TWO judged items in order — the place ask first,
 * then the value ask — so a value aid can only be reached by actually finishing the
 * place ask. There is no shortcut: the runner owns progression.
 */
async function toValueAsk(h: JudgedHarness) {
  await h.answer('the tens place');
  await h.speak('Yes, the four is in the tens place. Your turn. What is it worth?');
  await h.end();
  await h.tick(1500);
  expect(h.runtime.getSnapshot().task?.itemId).toContain('value');
}

describeJudgedConformance<Mode>({
  primitiveId: 'place-value-chart',
  mount,
  pilotMode: 'compare',
  reminderSays: 'does not write, move or highlight anything',
  // Real on the counting board, and never on a place-value chart.
  foreignStrategyId: 'a-digit-in-each-column',
  reach: toValueAsk,
  provokeAid: h => h.answer('four'),
  // The digit, its worth, and the whole number are all answers on this chart.
  leak: () => ({ numbers: [4, 40, 45], words: ['ones', 'tens', 'hundreds', 'thousands'] }),
});

// ── Routing: an aid for a misstep the child has not made is never offered ──

it('routes a value ask between saying the digit and saying the whole number', async () => {
  const h = await mount('compare');       // 45, the tens digit glowing: four, worth forty
  await toValueAsk(h);
  await h.answer('four');
  expect(h.strategies()).toContain('the-digit-is-not-the-whole-worth');
  expect(h.strategies()).not.toContain('just-the-glowing-column');
  cleanup();
  const g = await mount('compare');
  await toValueAsk(g);
  await g.answer('forty five');
  expect(g.strategies()).toContain('just-the-glowing-column');
  expect(g.strategies()).not.toContain('the-digit-is-not-the-whole-worth');
});

it('routes a place ask between the neighbouring column and answering with a number', async () => {
  const h = await mount('identify');      // the glowing digit sits in the tens place
  await h.answer('the ones place');
  expect(h.strategies()).toContain('you-named-the-column-next-door');
  expect(h.strategies()).not.toContain('name-the-column-not-the-number');
  cleanup();
  const g = await mount('identify');
  await g.answer('forty');                 // a number, not a column name
  expect(g.strategies()).toContain('name-the-column-not-the-number');
  expect(g.strategies()).not.toContain('you-named-the-column-next-door');
});
