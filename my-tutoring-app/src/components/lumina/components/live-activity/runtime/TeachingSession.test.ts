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
  it('records levers on the next attempt and keeps them through retry, clearing them on advance', () => {
    const s = new TeachingSession(['one', 'two']);
    s.submit('a', 'six', 'gesture', false);
    s.assist('none', 'hops'); s.assist('none', 'hops');
    s.retry(); s.submit('b', 'five', 'gesture', true);
    expect(s.getSnapshot().attempts.map(a => a.levers)).toEqual([undefined, ['hops']]);
    s.advance();
    expect(s.getSnapshot().levers).toEqual([]);
  });
  it('a simpler item is ungraded practice: never an outcome, never advanced past, then the same item returns', () => {
    const s = new TeachingSession(['one', 'two']);
    expect(s.openPractice('one')).toBe(false);
    s.assist('none', 'simpler');
    expect(s.openPractice('one~simpler')).toBe(true);
    expect(s.openPractice('again')).toBe(false);
    s.submit('p1', 'right', 'gesture', true);
    expect(s.advance()).toBe(false);
    expect(s.getSnapshot()).toMatchObject({ index: 0, practice: 'one~simpler', phase: 'checked' });
    expect(s.closePractice()).toBe(true);
    expect(s.getSnapshot()).toMatchObject({ index: 0, practice: null, phase: 'working', lastResponse: null, levers: ['simpler'] });
    expect(s.openPractice('one~simpler')).toBe(false);
    s.submit('f1', 'right', 'gesture', true); s.advance();
    s.submit('f2', 'right', 'gesture', true); s.advance();
    expect(teachingSummary(['one', 'two'], s.getSnapshot())!.outcomes.map(o => [o.id, o.attempts, o.score])).toEqual([['one', 1, 100], ['two', 1, 100]]);
    expect(s.getSnapshot().attempts.map(a => [a.itemId, !!a.practice, a.levers])).toEqual([
      ['one~simpler', true, ['simpler']], ['one', false, ['simpler']], ['two', false, undefined]]);
  });
});
