// @vitest-environment jsdom
/**
 * The other half of the move contract: a move the TUTOR composed reaches the real shared
 * surface and draws, with no prepared artifact behind it and no per-primitive renderer.
 *
 * The unit tests next door prove the refusals. This one proves the thing the refusals are
 * protecting: that the open lane actually puts something different on the child's screen.
 */
import React, { useState } from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { LiveLessonRuntime } from './LiveLessonRuntime';
import { LiveRuntimeContext } from './LiveRuntimeContext';
import { LiveRuntimeSurface } from './LiveRuntimeSurface';
import { ReferenceTask } from './LiveRuntimeLab';
import { createRuntimeFixture } from './runtimeFixture';
import type { ComposedMove } from './moveContract';

afterEach(cleanup);

function Host({ move }: { move: ComposedMove }) {
  const [runtime] = useState(() => new LiveLessonRuntime('move-render', {
    maxSupportLevel: 3, allowAnswerExposure: true, allowSupportArtifacts: true,
  }));
  const [fixture] = useState(() => {
    const created = createRuntimeFixture();
    Object.assign(created.mount.adapter, { representation: 'reference-model',
      alternateRepresentations: ['counters'], drawsTask: (counts: readonly number[]) => [8, 3, 5].some(n => counts.includes(n)) });
    return created;
  });
  const [opened, setOpened] = useState('');
  return <LiveRuntimeContext.Provider value={runtime}>
    <LiveRuntimeSurface runtime={runtime}><ReferenceTask fixture={fixture} /></LiveRuntimeSurface>
    <button onClick={() => setOpened(runtime.openComposedMove(
      { instanceId: fixture.mount.instanceId, itemId: runtime.getSnapshot().task!.itemId }, move).status)}>Make the move</button>
    <p>Move: {opened}</p>
  </LiveRuntimeContext.Provider>;
}

describe('a tutor-composed move on the real surface', () => {
  it('draws a contrast the tutor composed from its own numbers, with the child’s task suspended behind it', () => {
    render(<Host move={{ obstacle: 'cannot tell which row has more', delta: 'contrast', representation: 'counters',
      nextAction: 'point to the row with more', values: [6, 4] }} />);
    expect(screen.getByLabelText('Your answer')).toBeTruthy();
    fireEvent.click(screen.getByText('Make the move'));
    expect(screen.getByText('Move: committed')).toBeTruthy();
    // Code wrote the sentence from the numbers, so this is what the tutor may say and no more.
    expect(screen.getByText('6 has 2 more than 4. The last 2 have no partner.')).toBeTruthy();
    expect(document.querySelectorAll('[data-contrast-row]')).toHaveLength(2);
    expect(document.querySelectorAll('[data-contrast-highlight]')).toHaveLength(2);
  });

  it('draws a process the tutor composed, one step per frame', () => {
    render(<Host move={{ obstacle: 'does not know what to do first', delta: 'model-process', representation: 'counters',
      nextAction: 'take away two on your own frame', values: [6, 2], operation: 'subtract' }} />);
    fireEvent.click(screen.getByText('Make the move'));
    expect(screen.getByText('Move: committed')).toBeTruthy();
    expect(document.querySelectorAll('[data-step-frame]')).toHaveLength(3);
    ['Start with 6 counters.', 'Take away 2.', '4 counters are left.'].forEach(caption =>
      expect(screen.getByText(caption)).toBeTruthy());
    expect(document.querySelectorAll('[data-step-tone="crossed"]')).toHaveLength(2);
  });
});
