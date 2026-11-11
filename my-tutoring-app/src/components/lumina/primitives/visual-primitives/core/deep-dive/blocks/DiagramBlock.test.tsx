// @vitest-environment jsdom
/** Tapping a pin on an explore diagram opens its card and asks the tutor about that part. */
import React from 'react';
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../../../../../utils/SoundManager', () => ({
  SoundManager: { tap: vi.fn(), snap: vi.fn(), playCorrect: vi.fn(), playIncorrect: vi.fn() },
}));

import DiagramBlock from './DiagramBlock';
import type { DiagramBlockData } from '../types';

const data = {
  id: 'd1',
  blockType: 'diagram',
  label: 'Excavator parts',
  interactionMode: 'explore',
  imageBase64: 'data:image/png;base64,AA==',
  altText: 'An excavator',
  caption: 'Tap each pin',
  labels: [
    { id: 'cab', text: 'Cab', description: 'The operator sits inside this room.', position: { x: 40, y: 30 } },
    { id: 'boom', text: 'Boom', description: 'The long arm that lifts.', position: { x: 60, y: 20 } },
  ],
} as unknown as DiagramBlockData;

/** Renders the block and waits out the pins' staggered entrance. */
function show(props: { onAskTutor?: (m: string) => void; preReader?: boolean }) {
  render(<DiagramBlock data={data} index={0} {...props} />);
  act(() => { vi.advanceTimersByTime(500); });
}

/** The pin comes before its chip in the document. */
const pin = (name: RegExp) => screen.getAllByRole('button', { name })[0];

describe('DiagramBlock explore pins', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { cleanup(); vi.useRealTimers(); });

  it('asks the tutor about the part a reader tapped, without reading the card back', () => {
    const onAskTutor = vi.fn();
    show({ onAskTutor });
    fireEvent.click(pin(/Cab/));
    expect(onAskTutor).toHaveBeenCalledTimes(1);
    const message = onAskTutor.mock.calls[0][0] as string;
    expect(message).toContain('"Cab"');
    expect(message).toContain('The operator sits inside this room.');
    expect(message).toContain('Do not read the card back');
    expect(screen.getByText('The operator sits inside this room.')).toBeTruthy();
  });

  it('has the tutor read the card word for word to a pre-reader', () => {
    const onAskTutor = vi.fn();
    show({ onAskTutor, preReader: true });
    fireEvent.click(pin(/Cab/));
    expect(onAskTutor.mock.calls[0][0]).toContain('word for word');
  });

  it('stays quiet when the card closes and on a rapid second tap', () => {
    const onAskTutor = vi.fn();
    show({ onAskTutor });
    fireEvent.click(pin(/Cab/));
    fireEvent.click(pin(/Boom/));
    expect(onAskTutor).toHaveBeenCalledTimes(1);
    act(() => { vi.advanceTimersByTime(1300); });
    fireEvent.click(pin(/Boom/));
    expect(onAskTutor).toHaveBeenCalledTimes(1);
  });

  it('still opens the card when no tutor is connected', () => {
    show({});
    fireEvent.click(pin(/Boom/));
    expect(screen.getByText('The long arm that lifts.')).toBeTruthy();
  });
});
