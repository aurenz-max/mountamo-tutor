// @vitest-environment jsdom
/**
 * ordinal-line on its boss (spoken preset; the build checked by the line), mounted the way a lesson mounts it: what is
 * its own. The generic W1 contract (runtime/workspaceContract.test.tsx), boss.test.ts and the Pip contract cover
 * ownership, the packet and the wiring; the levers have OrdinalLine.levers.workspace.test.tsx.
 *
 * Moved here from the scripted-path suites when the scripted controller was deleted (di-stage): no Check or Next
 * control and no printed instruction; the ordinal labels wait for the credited answer; the story never prints; adult
 * chrome and the names are hidden for a pre-reader.
 */
vi.mock('@/contexts/LuminaAIContext', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).luminaAIContextSeam());
vi.mock('@/components/lumina/hooks/useLiveVoiceTurns', async original => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).voiceTurnsSeam(original as any));
vi.mock('@/components/lumina/evaluation', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).evaluationSeam());
vi.mock('@/components/lumina/utils/SoundManager', async () => (await import('@/components/lumina/components/live-activity/runtime/testing/liveRuntimeSeams')).soundSeam());

import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import { installRuntimeTimers, restoreRuntimeTimers, seam } from '../../../components/live-activity/runtime/testing/liveRuntimeSeams';
import { mountWorkspace, type WorkspaceHarness } from '../../../components/live-activity/runtime/testing/workspaceHarness';

beforeEach(() => { installRuntimeTimers(); });
afterEach(() => { cleanup(); restoreRuntimeTimers(); seam.evaluationContext = null; });

type Mode = 'identify' | 'match' | 'relative_position' | 'sequence_story' | 'build_sequence';

const LINE = [{ name: 'Fox', emoji: '🦊' }, { name: 'Bear', emoji: '🐻' }, { name: 'Duck', emoji: '🦆' }, { name: 'Mole', emoji: '🐹' }];
const CLUES = [{ character: 'Fox', position: 1 }, { character: 'Bear', position: 2 }, { character: 'Duck', position: 3 }];
const STORY = 'The Fox got to the front. The Bear came along next. The Duck came along at the end.';

/** One challenge per mode, each satisfying `itemsFromChallenge`'s own gates. */
function challengeFor(mode: Mode): Record<string, unknown> {
  const base = { id: 'c0', type: mode.replace('_', '-'), instruction: 'Tap the third one.', characters: LINE.slice(0, 3) };
  switch (mode) {
    case 'identify': return { ...base, characters: LINE, targetPosition: 3, correctAnswer: '3' };
    case 'relative_position': return { ...base, targetPosition: 2, relativeQuery: 'after', correctAnswer: 'Duck' };
    case 'match': return { ...base, matchPairs: [{ symbol: '2nd', word: 'second' }] };
    case 'sequence_story': return { ...base, clues: CLUES, storyText: STORY };
    default: return { ...base, clues: CLUES };
  }
}

const mount = (mode: Mode, band: 'K' | '1' = 'K') => mountWorkspace({ primitiveId: 'ordinal-line', evalMode: mode, instanceId: 'line-up',
  data: { title: 'The line up', gradeBand: band, maxPosition: 4, context: 'race', showOrdinalLabels: true, labelFormat: 'symbol',
    challenges: [challengeFor(mode)] } });
const text = (h: WorkspaceHarness) => h.view.container.textContent ?? '';
/** Picture then place, for each name in turn: the page's own two-tap mechanic. */
const build = (h: WorkspaceHarness, ...names: string[]) => names.forEach((name, i) => { h.touch(`picture-${name}`); h.touch(`slot-${i + 1}`); });

it.each(['identify', 'match', 'relative_position', 'sequence_story', 'build_sequence'] as const)(
  '%s: no Check, Next or hear-again control and no printed instruction', mode => {
    const h = mount(mode);
    expect(h.state().owner).toBe('tutor');
    expect(h.tutorTools()).toEqual(['begin_help', 'pull_lever']);
    const buttons = Array.from(h.view.container.querySelectorAll('button')).map(b => b.textContent ?? b.getAttribute('aria-label'));
    for (const label of [/check/i, /next/i]) expect(buttons.join(' ')).not.toMatch(label);
    expect(h.view.container.querySelector('[aria-label="Hear the question again"]')).toBeNull();
    expect(text(h)).not.toContain('Tap the third one.');
    h.close();
  });

it('a spoken item publishes its spoken key; a build never publishes its answer line', () => {
  const h = mount('identify');
  expect(h.state().task!.workspace!.expectedAnswer).toMatch(/^"Duck"\. A count along the line that ends on the Duck/);
  expect(h.state().task!.demand).toMatchObject({ kind: 'identify', front: 'the starting line' });
  h.close(); cleanup();
  const g1 = mount('identify', '1');
  expect(g1.state().task!.workspace!.expectedAnswer).toMatch(/^"third"\..*"three", the counting number said alone, is not the answer/);
  g1.close(); cleanup();
  const b = mount('build_sequence');
  expect(b.state().task!.workspace!.expectedAnswer).toBeUndefined();
  // The clues are the spoken task; the scene reports only what the learner placed.
  expect(b.state().task!.task).toContain('The Fox goes first.');
  expect(b.state().task!.demand).toMatchObject({ places: 3, line: 'Placed none of the pictures' });
  b.close();
});

it('build: the line checks a still, full line, Try again clears it, and a right one completes once', () => {
  seam.evaluationContext = { lesson: 'test' };
  const h = mount('build_sequence');
  build(h, 'Duck', 'Bear', 'Fox'); h.settle();
  expect(h.state().task!.evidence.correctness).toBe('incorrect');
  expect(h.state().task!.workspace!.attempts.at(-1)).toMatchObject({ correct: false, miss: 'reversed' });
  expect(h.offer('advance')).toBeUndefined();
  h.dispatch('retry');
  expect(h.view.container.querySelector('[data-pip-object="picture-Fox"]')).not.toBeNull();
  build(h, 'Fox', 'Bear', 'Duck'); h.settle();
  expect(h.state().task!.evidence.correctness).toBe('correct');
  h.dispatch('advance');
  h.confirmVisible();
  expect(h.state().status).toBe('completed');
  h.close();
});

it('build: a part-filled line that stays still commits and is checked wrong', () => {
  const h = mount('build_sequence');
  h.touch('picture-Fox'); h.touch('slot-1'); h.touch('picture-Duck'); h.touch('slot-3'); h.settle();
  expect(h.state().task!.evidence.correctness).toBe('incorrect');
  expect(h.state().task!.workspace!.attempts.at(-1)).toMatchObject({ correct: false, miss: 'place_left_empty' });
  expect(h.state().task!.demand.line).toBe('Placed 2 of 3, from the first place: Fox, empty, Duck');
  h.close();
});

it('identify: the place labels wait for the credited answer; a wrong answer reopens the same item', () => {
  const h = mount('identify');
  const first = h.state().task!.itemId;
  expect(text(h)).not.toMatch(/3rd/);
  h.say('the bear'); h.feedback('incorrect', 'retry');
  expect(h.state().task!.itemId).toBe(first);
  expect(h.state().status).not.toBe('completed');
  h.say('duck'); h.feedback('correct');
  expect(text(h)).toMatch(/3rd/);
  // The reveal is the PAIRING, never the answer text alone.
  expect(text(h)).toContain('Duck — third');
  h.dispatch('advance'); h.confirmVisible();
  expect(h.state().status).toBe('completed');
  h.close();
});

it('the story never prints: it is the tutor\'s voice, not the page', () => {
  const h = mount('sequence_story');
  expect(h.state().task!.task).toContain(STORY);
  expect(text(h)).not.toContain('The Fox got to the front');
  h.close();
});

it('adult chrome and the names are hidden for a pre-reader, shown at Grade 1', () => {
  const k = mount('identify');
  expect(text(k)).not.toContain('race');
  expect(text(k)).not.toContain('Bear');
  k.close(); cleanup();
  const g1 = mount('identify', '1');
  expect(text(g1)).toContain('race');
  expect(text(g1)).toContain('Bear');
  g1.close();
});
