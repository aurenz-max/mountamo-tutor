import { describe, expect, it } from 'vitest';
import { compareReading, classifyReadingRepair, repairSummary, type ReadingRepairAttempt,
  type ReadingRepairEvidence, type ReadingTranscript } from '../readingRepairEvidence';

const print = 'Yesterday, Sam rode to the pond.';
const transcripts = (text: string): ReadingTranscript[] => [0, 1].map(() => ({ transcript: text, confidence: 'high', complete: true }));
const attempt = (said: string, selectedIndexes: number[] = [], supportBeforeReading = false): ReadingRepairAttempt => ({
  verdict: compareReading(print, transcripts(said)), selectedIndexes, supportBeforeReading,
  capturedAt: '2026-09-13T12:00:00Z', durationMs: 5000,
});
const miss = () => attempt('Yesterday Sam ride to the pond');

describe('print-referenced provisional reading evidence', () => {
  it('recognizes accurate first reading without manufacturing a repair', () => {
    expect(classifyReadingRepair([attempt(print)])).toBe('accurate_first_read');
  });
  it('observes independently noticed ride/rode correction', () => {
    expect(miss().verdict.mismatchIndexes).toEqual([2]);
    expect(classifyReadingRepair([miss(), attempt(print, [2])])).toBe('independent_repair');
  });
  it('records repair after support separately', () => {
    expect(classifyReadingRepair([miss(), attempt(print, [2], true)])).toBe('supported_repair');
  });
  it('does not turn replay, reflection or completion into repair', () => {
    expect(classifyReadingRepair([miss()])).toBe('unresolved_error');
    expect(classifyReadingRepair([miss(), miss()])).toBe('unresolved_error');
  });
  it('does not infer noticing from an unmarked or wrongly marked reread', () => {
    expect(classifyReadingRepair([miss(), attempt(print)])).toBe('unassessable');
    expect(classifyReadingRepair([miss(), attempt(print, [1])])).toBe('unassessable');
    expect(classifyReadingRepair([miss(), attempt(print, [0, 1, 2, 3, 4, 5])])).toBe('unassessable');
  });
  it('does not infer accurate cold reading after a model', () => {
    expect(classifyReadingRepair([attempt(print, [], true)])).toBe('unassessable');
  });
  it('does not use uncertain first reading as a repair opportunity', () => {
    const unclear = attempt('Yesterday Sam');
    expect(classifyReadingRepair([unclear, attempt(print, [2])])).toBe('unassessable');
    expect(classifyReadingRepair([miss(), unclear])).toBe('unassessable');
    expect(classifyReadingRepair([])).toBe('unassessable');
  });
  it('abstains on disagreement, low confidence, silence and truncation', () => {
    expect(compareReading(print, [transcripts(print)[0], transcripts('Yesterday Sam ride to the pond')[0]]).status).toBe('uncertain');
    expect(compareReading(print, transcripts(print).map(t => ({ ...t, confidence: 'low' }))).status).toBe('uncertain');
    expect(compareReading(print, transcripts(print).map(t => ({ ...t, complete: false }))).status).toBe('uncertain');
    expect(compareReading(print, transcripts('')).status).toBe('uncertain');
  });
  it('does not count homophonic spelling differences as reading errors', () => {
    expect(compareReading('I read the red book.', transcripts('I red the red book')).status).toBe('uncertain');
    expect(compareReading('He rode down the road.', transcripts('He road down the road')).status).toBe('uncertain');
  });
  it('does not accept plausible synonyms as the printed word', () => {
    expect(compareReading('The small duck swam away.', transcripts('The little duck swam away')).status).toBe('mismatch');
  });
  it('abstains on the real-audio walk/walked false-miss family despite recognizer agreement', () => {
    expect(compareReading('We walk to the pond this morning.', transcripts('We walked to the pond this morning.')).status).toBe('uncertain');
    expect(compareReading('The ducks swim across the pond.', transcripts('The duck swim across the pond.')).status).toBe('uncertain');
  });
  it('abstains on insertions, omissions and within-clip self-repairs instead of shifting indexes', () => {
    for (const heard of ['Sam rode to the pond', 'Yesterday Sam rode slowly to the pond', 'Yesterday Sam ride rode to the pond']) {
      expect(compareReading(print, transcripts(heard)).status).toBe('uncertain');
    }
  });
  it('keeps accurate-first, supported and unassessable signals out of independent-repair credit', () => {
    const rows = ['accurate_first_read', 'supported_repair', 'independent_repair', 'unresolved_error', 'unassessable']
      .map((outcome, i) => ({ challengeId: String(i), text: print, attempts: [], supportRequested: false,
        replayCount: 10, reflection: 'The letters', outcome })) as ReadingRepairEvidence[];
    expect(repairSummary(rows)).toMatchObject({ assessableCount: 4, repairOpportunities: 3, independentRepairRate: 33, overallAccuracy: 75 });
    expect(repairSummary([rows[0]])).toMatchObject({ independentRepairRate: null, repairOpportunities: 0, accurateFirstReadCount: 1 });
    expect(repairSummary([rows[4]])).toMatchObject({ assessableCount: 0, independentRepairRate: null, unassessableCount: 1 });
  });
});
