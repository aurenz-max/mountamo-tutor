/**
 * DI run log — diagnostics contract.
 *
 * The load-bearing assertion is NOT "logging works". It is that the three
 * emissions every pack drops for progression (`attempt-superseded`,
 * `phantom-transcript`, `unanchored-verdict`) are nonetheless RECORDED and
 * FLAGGED. Those three are what a decohered sitting needs and what the packs
 * silently discarded before this module, so a regression that quietly stopped
 * capturing them would restore the exact blindness this was built to fix.
 */

import { describe, expect, it, beforeEach } from 'vitest';
import type { LoopAttempt, LoopEmission, VoiceTurnRecord } from '../../../hooks/judgedLoopModel';
import type { VoiceTurnEvent } from '../../../hooks/voiceTurnMachine';
import {
  buildDiRunJson,
  deriveDiRunCounters,
  getDiRunLogSnapshot,
  logDiEmission,
  logDiStage,
  logDiTutorText,
  logDiVoiceClose,
  startDiRunLog,
} from './diRunLog';

const turn = (overrides: Partial<VoiceTurnRecord> = {}): VoiceTurnRecord => ({
  openedAt: 1000,
  closedAt: 1800,
  durationMs: 800,
  peak: 0.09,
  duringTutorAudio: false,
  ...overrides,
});

const attempt = (overrides: Partial<LoopAttempt> = {}): LoopAttempt => ({
  turn: turn(),
  transcript: null,
  transcriptAt: null,
  ...overrides,
});

const closeEvent = (
  overrides: Partial<Extract<VoiceTurnEvent, { kind: 'close' }>> = {},
): Extract<VoiceTurnEvent, { kind: 'close' }> => ({
  kind: 'close',
  startedAt: 1000,
  durationMs: 800,
  voicedMs: 885,
  peak: 0.09,
  duringTutorAudio: false,
  belowMinVoice: false,
  ...overrides,
});

const ctx = { itemId: 'fact-1', itemDisplay: '5 − 1' };

beforeEach(() => {
  startDiRunLog({ primitiveId: 'di-math-facts', challengeType: 'subtraction_fact', totalItems: 5 });
});

describe('the three previously-dropped emissions', () => {
  it('records and flags attempt-superseded (the silenceCloseMs split class)', () => {
    logDiEmission({ kind: 'attempt-superseded', attempt: attempt() }, ctx);

    const [event] = getDiRunLogSnapshot();
    expect(event.kind).toBe('attempt-superseded');
    expect(event.flag).toBe('superseded');
    expect(event.itemId).toBe('fact-1');
    expect(deriveDiRunCounters(getDiRunLogSnapshot()).supersessions).toBe(1);
  });

  it('records and flags phantom-transcript, keeping the heard text', () => {
    logDiEmission({ kind: 'phantom-transcript', text: 'six', at: 2000 }, ctx);

    const [event] = getDiRunLogSnapshot();
    expect(event.flag).toBe('phantom');
    expect(event.text).toBe('six');
    expect(deriveDiRunCounters(getDiRunLogSnapshot()).phantoms).toBe(1);
  });

  it('records and flags unanchored-verdict — the canonical DI-1 desync signal', () => {
    logDiEmission({ kind: 'unanchored-verdict', judgment: 'affirmed' }, ctx);

    const [event] = getDiRunLogSnapshot();
    expect(event.flag).toBe('unanchored');
    expect(event.judgment).toBe('affirmed');
    expect(deriveDiRunCounters(getDiRunLogSnapshot()).unanchored).toBe(1);
  });
});

describe('verdict capture', () => {
  it('flags off-script and no-verdict, which are stalls rather than judgments', () => {
    logDiEmission({ kind: 'verdict', judgment: 'off-script', attempt: attempt(), misses: 1 }, ctx);
    logDiEmission({ kind: 'verdict', judgment: 'no-verdict', attempt: attempt(), misses: 2 }, ctx);

    const counters = deriveDiRunCounters(getDiRunLogSnapshot());
    expect(counters.offScript).toBe(1);
    expect(counters.noVerdict).toBe(1);
    // Neither is a judgment, so neither counts as affirmed/corrected.
    expect(counters.affirmed).toBe(0);
    expect(counters.corrected).toBe(0);
  });

  it('keeps the tutor’s COMPLETE judging line, where correction drift would show', () => {
    logDiEmission(
      { kind: 'verdict', judgment: 'corrected', attempt: attempt(), misses: 0, verdictText: 'My turn' },
      ctx,
    );
    logDiEmission(
      {
        kind: 'verdict-text',
        judgment: 'corrected',
        text: 'My turn: not six — five minus one is four. Your turn.',
      },
      ctx,
    );

    const timeline = getDiRunLogSnapshot();
    // The verdict itself is truncated at the sentinel by construction…
    expect(timeline[0].text).toBe('My turn');
    // …and the complete line is what names the error.
    expect(timeline[1].text).toContain('not six');
    expect(deriveDiRunCounters(timeline).corrected).toBe(1);
  });
});

describe('timing and mic telemetry', () => {
  it('averages responseMs and commitLagMs across transcripts only', () => {
    logDiEmission(
      { kind: 'attempt-transcript', attempt: attempt(), text: 'six', responseMs: 1000, commitLagMs: 900 },
      ctx,
    );
    logDiEmission(
      { kind: 'attempt-transcript', attempt: attempt(), text: 'five', responseMs: 2000, commitLagMs: 1100 },
      ctx,
    );
    // A null responseMs (the split-fragment shape) must not drag the mean to 0.
    logDiEmission(
      { kind: 'attempt-transcript', attempt: attempt(), text: 'four', responseMs: null, commitLagMs: 1000 },
      ctx,
    );

    const counters = deriveDiRunCounters(getDiRunLogSnapshot());
    expect(counters.transcripts).toBe(3);
    expect(counters.meanResponseMs).toBe(1500);
    expect(counters.meanCommitLagMs).toBe(1000);
  });

  it('counts echo-opened turns separately from ordinary closes', () => {
    logDiVoiceClose(closeEvent(), ctx);
    logDiVoiceClose(closeEvent({ duringTutorAudio: true, peak: 0.033 }), ctx);

    const counters = deriveDiRunCounters(getDiRunLogSnapshot());
    expect(counters.voiceCloses).toBe(2);
    expect(counters.echoOpenedTurns).toBe(1);
  });

  it('ignores empty tutor fragments so the timeline stays readable', () => {
    logDiTutorText('   ', ctx);
    logDiTutorText('Listen: five minus one.', ctx);

    expect(deriveDiRunCounters(getDiRunLogSnapshot()).tutorLines).toBe(1);
  });
});

describe('run framing', () => {
  it('starts a fresh timeline per run, so one sitting never bleeds into the next', () => {
    logDiEmission({ kind: 'unanchored-verdict', judgment: 'corrected' }, ctx);
    expect(getDiRunLogSnapshot()).toHaveLength(1);

    startDiRunLog({ primitiveId: 'di-math-facts' });
    expect(getDiRunLogSnapshot()).toHaveLength(0);
    expect(deriveDiRunCounters(getDiRunLogSnapshot()).unanchored).toBe(0);
  });

  it('flags the correction cap — a path never observed live in any pack', () => {
    logDiStage('move-on', 'correction cap (2) reached — moving on', ctx, 'move-on');
    expect(deriveDiRunCounters(getDiRunLogSnapshot()).moveOns).toBe(1);
  });

  it('reports a coherent run as all-zero on every desync counter', () => {
    logDiStage('run-start', 'armed with 2 items', ctx);
    logDiEmission({ kind: 'attempt-open', attempt: attempt() }, ctx);
    logDiEmission(
      { kind: 'attempt-transcript', attempt: attempt(), text: 'four', responseMs: 1200, commitLagMs: 800 },
      ctx,
    );
    logDiEmission(
      { kind: 'verdict', judgment: 'affirmed', attempt: attempt(), misses: 0, verdictText: 'Yes,' },
      ctx,
    );

    const counters = deriveDiRunCounters(getDiRunLogSnapshot());
    expect(counters.affirmed).toBe(1);
    // This is the shape a healthy sitting reports; any non-zero here is the lead.
    expect(counters.supersessions).toBe(0);
    expect(counters.phantoms).toBe(0);
    expect(counters.unanchored).toBe(0);
    expect(counters.offScript).toBe(0);
    expect(counters.noVerdict).toBe(0);
  });

  it('exports parseable run JSON carrying meta, counters and timeline', () => {
    logDiEmission({ kind: 'attempt-superseded', attempt: attempt() }, ctx);

    const parsed = JSON.parse(buildDiRunJson());
    expect(parsed.source).toBe('di-primitive-run-log');
    expect(parsed.meta.primitiveId).toBe('di-math-facts');
    expect(parsed.meta.challengeType).toBe('subtraction_fact');
    expect(parsed.counters.supersessions).toBe(1);
    expect(parsed.timeline).toHaveLength(1);
  });
});
