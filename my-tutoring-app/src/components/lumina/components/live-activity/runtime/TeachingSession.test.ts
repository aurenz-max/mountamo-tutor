import { describe, expect, it } from 'vitest';
import { TeachingSession, teachingSummary } from './TeachingSession';

describe('teaching state without a speech script', () => {
  it('summarizes actual attempts and help only after every item is completed', () => {
    const s = new TeachingSession(['one', 'two']);
    s.assist(); s.submit('a', 'wrong', 'speech', false);
    s.retry(); s.submit('b', 'correct', 'speech', true); s.advance();
    expect(teachingSummary(['one', 'two'], s.getSnapshot())).toBeNull();
    s.submit('c', 'correct', 'gesture', true); s.advance();
    expect(teachingSummary(['one', 'two'], s.getSnapshot())).toEqual({ solvedCount: 2, outcomes: [
      { id: 'one', solved: true, corrections: 1, attempts: 2, score: 67, assisted: true },
      { id: 'two', solved: true, corrections: 0, attempts: 1, score: 100, assisted: false },
    ] });
  });
  it('accepts a distinct spoken correction before observer retry, without duplicating or replacing checked success', () => {
    const s = new TeachingSession(['one']);
    s.assist(); s.submit('first', 'six', 'speech', false);
    expect(s.submit('first', 'six', 'speech', false, true)).toBe(false);
    expect(s.submit('click', 'five', 'gesture', true, true)).toBe(false);
    expect(s.submit('second', 'five', 'speech', true, true)).toBe(true);
    expect(s.getSnapshot().attempts.map(a => [a.response, a.correct, a.assisted])).toEqual([['six', false, true], ['five', true, true]]);
    expect(s.submit('third', 'six', 'speech', false, true)).toBe(false);
  });
  it('does not grade help, impose a correction cap, or progress after mistakes', () => {
    const s = new TeachingSession(['one', 'two']);
    s.assist();
    expect(s.getSnapshot().attempts).toEqual([]);
    for (let i = 0; i < 5; i++) {
      expect(s.submit(String(i), 'wrong', 'gesture', false)).toBe(true);
      expect(s.advance()).toBe(false);
      expect(s.retry()).toBe(true);
    }
    expect(s.getSnapshot()).toMatchObject({ index: 0, assisted: true });
    expect(s.getSnapshot().attempts).toHaveLength(5);
  });
  it('keeps assisted work and response identity through retry, then opens a fresh item', () => {
    const s = new TeachingSession(['one', 'two']);
    s.assist(); s.submit('first', 'three', 'speech', true);
    expect(s.submit('duplicate', 'three', 'speech', true)).toBe(false);
    s.retry();
    expect(s.submit('first', 'three', 'speech', true)).toBe(false);
    s.submit('second', 'three', 'speech', true);
    expect(s.getSnapshot().lastResponse?.assisted).toBe(true);
    s.advance();
    expect(s.getSnapshot()).toMatchObject({ index: 1, assisted: false, lastResponse: null, phase: 'working' });
    s.submit('third', 'four', 'speech', true); s.advance();
    expect(s.getSnapshot().phase).toBe('completed');
    expect(s.retry()).toBe(false);
    expect(s.assist()).toBe(false);
  });
});
