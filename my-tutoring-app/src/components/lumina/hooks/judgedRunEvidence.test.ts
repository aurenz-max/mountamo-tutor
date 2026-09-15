import { describe, expect, it } from 'vitest';
import { isDiagnosableFailure } from '../evaluation/diagnosis/types';
import type { JudgedDiagnosisObservation, JudgedScriptItem } from './judgedScriptContract';
import { firstResponseScoreOf, judgedRunEvidence, selectEvidencePhases } from './judgedRunEvidence';

interface Item extends JudgedScriptItem { kind: 'take_away' | 'add_more' }
const item = (id: string, kind: Item['kind'] = 'take_away'): Item => ({ id, kind, answerKind: 'voice', responseClass: 'short_spoken_word', action: kind });
const wrong = (it: Item, n: number, extra: Partial<JudgedDiagnosisObservation> = {}): JudgedDiagnosisObservation => ({
  itemId: it.id, phase: it.kind, challenge: `Board ${it.id}.`, expected: 'four (4) left', observed: `Said "${it.id}-try${n}".`,
  support: `Correction observation; ${n - 1} prior corrections on this item. Other assistance is not established.`, ...extra,
});
const pack = { activityLine: 'Counting boards with the tutor', maxCorrections: 2 };

describe('judgedRunEvidence', () => {
  it('no corrected attempt means no evidence', () => {
    const items = [item('a'), item('b')];
    const outcomes = items.map((it) => ({ id: it.id, solved: true, corrections: 0 }));
    expect(judgedRunEvidence({ outcomes, observations: [], items, pack })).toBeUndefined();
    expect(judgedRunEvidence({ outcomes: [], observations: [wrong(items[0], 1)], items, pack })).toBeUndefined();
  });

  it('keeps at most 12 phases: every item\'s first wrong attempt before later ones, emitted in the order they happened', () => {
    const items = Array.from({ length: 8 }, (_, i) => item(`c${i + 1}`));
    const observations = items.flatMap((it) => [1, 2].map((n) => wrong(it, n)));
    observations[15] = { ...observations[15], judgeFeedback: 'My turn: count what is left.' };
    const outcomes = items.map((it, i) => ({ id: it.id, solved: i % 2 === 0, corrections: 2 }));
    const evidence = judgedRunEvidence({ outcomes, observations, items, pack })!;
    expect(evidence.firstResponseScore).toBe(0);
    expect(evidence.phases).toHaveLength(12);
    expect(evidence.phases!.map((p) => p.observed.replace(/^Said "|"\.$/g, ''))).toEqual(
      ['c1-try1', 'c1-try2', 'c2-try1', 'c2-try2', 'c3-try1', 'c3-try2', 'c4-try1', 'c4-try2', 'c5-try1', 'c6-try1', 'c7-try1', 'c8-try1']);
    expect(evidence.phases![0]).toMatchObject({ itemId: 'c1', phase: 'take_away', challenge: 'Board c1.', expected: 'four (4) left',
      support: 'Correction observation; 0 prior corrections on this item. Other assistance is not established.' });
    expect(evidence.judgeFeedback).toBe('My turn: count what is left.');
    expect(evidence.challengeSummary).toBe('Counting boards with the tutor. 8 items; a wrong answer gets the tutor\'s scripted correction '
      + 'and the same question again, up to 2 corrections per item. 0 of 8 items were answered right the first time.');
    // No evidenceSummary: the key comes from the latest judge-backed observation.
    expect(evidence.expected).toBe('four (4) left');
    expect(evidence.observed.length).toBeLessThanOrEqual(2000);
    expect(evidence.observed.startsWith('Board c1. Said "c1-try1". | Board c1. Said "c1-try2".')).toBe(true);
    // Prior attempts exclude the source (the judge-backed one) and keep the last four others.
    expect(evidence.priorAttempts!.map((p) => p.observed)).toEqual(['c6-try2', 'c7-try1', 'c7-try2', 'c8-try1'].map((t) => `Said "${t}".`));
  });

  it('first-response score counts only items solved with zero corrections, and the gate reads it', () => {
    const items = ['a', 'b', 'c', 'd', 'e'].map((id) => item(id, 'add_more'));
    const outcomes = items.map((it, i) => ({ id: it.id, solved: true, corrections: i < 3 ? 1 : 0 }));
    const observations = items.slice(0, 3).map((it) => wrong(it, 1));
    const evidence = judgedRunEvidence({ outcomes, observations, items, pack })!;
    expect(evidence.firstResponseScore).toBe(40);
    expect(isDiagnosableFailure({ success: true, score: 80 }, evidence)).toBe(true);
    expect(firstResponseScoreOf([{ solved: false, corrections: 0 }, { solved: true, corrections: 0 }])).toBe(50);
    expect(firstResponseScoreOf([])).toBe(0);
  });

  it('mixed kinds use the pack\'s summary for every kind present, with the count and policy appended', () => {
    const items = [item('a', 'take_away'), item('b', 'add_more'), item('c', 'take_away')];
    const outcomes = items.map((it) => ({ id: it.id, solved: true, corrections: 1 }));
    const observations = items.map((it) => wrong(it, 1));
    const evidence = judgedRunEvidence({ outcomes, observations, items, pack: { ...pack, maxCorrections: 1,
      evidenceSummary: (asked) => ({ task: `Boards of ${Array.from(new Set(asked.map((it) => it.kind))).join(', ')}:`,
        expected: 'The number on the board after the change.' }) } })!;
    expect(evidence.challengeSummary).toBe('Boards of take_away, add_more. 3 items; a wrong answer gets the tutor\'s scripted correction '
      + 'and the same question again, up to 1 correction per item. 0 of 3 items were answered right the first time.');
    expect(evidence.expected).toBe('The number on the board after the change.');
  });

  it('selectEvidencePhases treats a missing itemId as one item', () => {
    const anon = (n: number): JudgedDiagnosisObservation => ({ challenge: 'c', expected: 'e', observed: `o${n}` });
    expect(selectEvidencePhases([anon(1), anon(2), anon(3)], 2).map((o) => o.observed)).toEqual(['o1', 'o2']);
  });
});
