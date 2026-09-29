// @vitest-environment jsdom
/**
 * The shared print-support overlay (handoff 22 L3): every mark changes how the print is drawn, never which letters
 * are printed, and each mark is findable by its `data-lever`.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import { LuminaPrintSupport } from './LuminaPrintSupport';
import { changedLetter, chunkBreak, dotsLeak, graphemes } from './printSupport';

afterEach(cleanup);
const words = (c: HTMLElement) => Array.from(c.querySelectorAll('[data-print-word]')).map(w => w.textContent);

describe('pure rules', () => {
  it.each([['ship', ['sh', 'i', 'p']], ['green', ['g', 'r', 'ee', 'n']], ['hat.', ['h', 'a', 't', '.']]])('%s graphemes', (w, g) => {
    expect(graphemes(w)).toEqual(g);
    expect(dotsLeak(w, graphemes(w))).toBe(false);
  });
  it('chunk and changed letter', () => {
    expect(chunkBreak('cats', ['cat', '/s/'])).toBe(3);
    expect(chunkBreak('cats', ['/k/'])).toBeNull();
    expect(chunkBreak('cat', ['cat'])).toBeNull();
    expect(changedLetter('cat', 'hat')).toBe(0);
    expect(changedLetter('cat', 'hot')).toBeNull();
  });
});

describe('LuminaPrintSupport', () => {
  it('dots: one per grapheme, none under punctuation, the words unchanged', () => {
    const { container } = render(<LuminaPrintSupport text="The ship sat." soundDots />);
    expect(words(container)).toEqual(['The', 'ship', 'sat.']);
    expect(container.querySelectorAll('[data-sound-dot]')).toHaveLength(8); // Th e · sh i p · s a t
  });
  it('underline: one segment per word and the arrow', () => {
    const { container } = render(<LuminaPrintSupport text="A cat sat on a mat." trackingUnderline />);
    expect(container.querySelectorAll('[data-track-segment]')).toHaveLength(6);
    expect(container.querySelector('[data-lever="tracking-underline"]')).toBeTruthy();
    expect(container.querySelectorAll('[data-sound-dot]')).toHaveLength(0);
  });
  it('chunk divider and changed letter act on a single word only', () => {
    const { container } = render(<LuminaPrintSupport text="jumping" chunkBreak={4} changedLetter={0} />);
    expect(words(container)).toEqual(['jumping']);
    expect(container.querySelector('[data-lever="chunk-divider"]')!.previousElementSibling!.textContent).toBe('p');
    expect(container.querySelector('[data-lever="changed-letter"]')!.textContent).toBe('j');
    cleanup();
    const line = render(<LuminaPrintSupport text="two words" chunkBreak={1} changedLetter={0} />).container;
    expect(line.querySelector('[data-lever="chunk-divider"], [data-lever="changed-letter"]')).toBeNull();
  });
});
