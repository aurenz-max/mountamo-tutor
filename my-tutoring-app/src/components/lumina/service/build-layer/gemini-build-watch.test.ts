import { describe, expect, it, vi } from 'vitest';

vi.mock('../geminiClient', () => ({ ai: {} }));
import { keepWatchLine } from './gemini-build-watch';

describe('keepWatchLine on a build whose skill is a number', () => {
  it('drops a fraction word or a sameness claim: on a fraction build it states the amount or the verdict', () => {
    for (const line of ['Half the circle is glowing pink!', 'Pink quarters are filling the circle!', 'Thin eighths fan out like a pizza!',
      'The whole circle is pink!', 'All the slices look equal and pink!', 'Looks the same as the other one!'])
      expect(keepWatchLine(line, 'never')).toBe('');
  });

  it('keeps a line about shapes, colors and where things are', () => {
    expect(keepWatchLine('Pink slices are spreading around the circle like a fan!', 'never')).toBe('Pink slices are spreading around the circle like a fan!');
    expect(keepWatchLine('Half the circle is glowing pink!', 'allowed')).toBe('Half the circle is glowing pink!');
  });
});
