import { describe, expect, it } from 'vitest';
import {
  DEFAULT_JUDGED_LOOP_CONFIG,
  DI_SENTINELS,
  IDLE_JUDGED_LOOP,
  reduceJudgedLoop,
  scanForSentinel,
  type JudgedLoopState,
  type LoopEmission,
  type LoopEvent,
  type VoiceTurnRecord,
} from './judgedLoopModel';

const config = DEFAULT_JUDGED_LOOP_CONFIG;

const turn = (overrides: Partial<VoiceTurnRecord> = {}): VoiceTurnRecord => ({
  openedAt: 1000,
  closedAt: 2000,
  durationMs: 1000,
  peak: 0.15,
  duringTutorAudio: false,
  ...overrides,
});

const drive = (events: LoopEvent[], initial: JudgedLoopState = IDLE_JUDGED_LOOP) => {
  let state = initial;
  const emissions: LoopEmission[] = [];
  for (const event of events) {
    const step = reduceJudgedLoop(state, event, config);
    state = step.state;
    emissions.push(...step.emissions);
  }
  return { state, emissions };
};

describe('scanForSentinel', () => {
  it('finds verdict sentences by their openers', () => {
    expect(scanForSentinel('Yes, mmm.', DI_SENTINELS)).toBe('affirmed');
    expect(scanForSentinel('Yes. Apple starts with short a.', DI_SENTINELS)).toBe('affirmed');
    expect(scanForSentinel('My turn: sss, as in sun. Your turn.', DI_SENTINELS)).toBe('corrected');
  });

  it('treats streaming partial sentinels as pending, lookalikes as none', () => {
    expect(scanForSentinel('Ye', DI_SENTINELS)).toBe('pending');
    expect(scanForSentinel('My', DI_SENTINELS)).toBe('pending');
    expect(scanForSentinel('My friend', DI_SENTINELS)).toBe('none');
    expect(scanForSentinel('Yesterday we practiced.', DI_SENTINELS)).toBe('none');
    expect(scanForSentinel('Your turn. What sound?', DI_SENTINELS)).toBe('none');
  });

  it('finds a sentinel even after cue remnants (hook-parity run mid-cue shape)', () => {
    // Run 2026-07-20: attempt landed mid-cue; prefix classification consumed
    // "is sam." as the verdict. Sentence scanning ignores the remnants and
    // still catches a later real verdict in the same stream.
    const remnants = 'is sam. Listen: sam. Together: sam. Your turn. What word?';
    expect(scanForSentinel(remnants, DI_SENTINELS)).toBe('none');
    expect(scanForSentinel(`${remnants} Yes, sam.`, DI_SENTINELS)).toBe('affirmed');
  });

  it('accepts an unterminated verdict opener in the streaming tail', () => {
    expect(scanForSentinel('Yes, mmm', DI_SENTINELS)).toBe('affirmed');
    expect(scanForSentinel('My turn: mmm', DI_SENTINELS)).toBe('corrected');
  });
});

describe('reduceJudgedLoop', () => {
  it('DI-1: a verdict binds to the voice-anchored attempt even when the transcript never arrives', () => {
    // Probe run 2026-07-19 n47–n49: /sss/ spoken over tutor audio, judged and
    // affirmed by Live, but input transcription lost. Voice-anchoring means
    // the attempt exists from the local turn close, so the verdict binds.
    const { emissions } = drive([
      { type: 'arm' },
      { type: 'voice-close', turn: turn({ duringTutorAudio: true }) },
      { type: 'tutor-text', text: 'Yes, sss.', at: 3000 },
    ]);
    expect(emissions).toEqual([
      { kind: 'attempt-open', attempt: { turn: turn({ duringTutorAudio: true }), transcript: null, transcriptAt: null } },
      {
        kind: 'verdict',
        judgment: 'affirmed',
        attempt: { turn: turn({ duringTutorAudio: true }), transcript: null, transcriptAt: null },
        misses: 0,
      },
    ]);
  });

  it('annotates the attempt when the transcript arrives, with both clocks', () => {
    const { state, emissions } = drive([
      { type: 'arm' },
      { type: 'tutor-quiet', at: 500 },
      { type: 'voice-close', turn: turn() },
      { type: 'transcript', text: 'Mmm.', at: 2400 },
    ]);
    const annotated = emissions.find((emission) => emission.kind === 'attempt-transcript');
    expect(annotated).toMatchObject({
      text: 'Mmm.',
      responseMs: 1900, // tutor quiet 500 → transcript 2400
      commitLagMs: 1400, // voice open 1000 → transcript 2400
    });
    expect(state.attempt?.transcript).toBe('Mmm.');
    expect(state.lastTutorQuietAt).toBeNull();
  });

  it('DI-3: nothing is recorded before arming', () => {
    const { state, emissions } = drive([
      { type: 'voice-close', turn: turn() },
      { type: 'transcript', text: 'Good.', at: 800 },
      { type: 'tutor-text', text: 'Yes, mmm.', at: 900 },
    ]);
    expect(emissions).toEqual([]);
    expect(state.attempt).toBeNull();
  });

  it('flags transcripts with no voice-anchored attempt as phantoms', () => {
    const { emissions } = drive([
      { type: 'arm' },
      { type: 'transcript', text: 'ठीक है।', at: 700 },
    ]);
    expect(emissions).toEqual([{ kind: 'phantom-transcript', text: 'ठीक है।', at: 700 }]);
  });

  it('mid-cue shape: cue remnants + quiet without a sentinel become off-script, not a misread verdict', () => {
    const { emissions } = drive([
      { type: 'arm' },
      { type: 'voice-close', turn: turn() },
      // Tail of the interrupted cue falls quiet first — no sentence since the
      // attempt yet, so NOT off-script.
      { type: 'tutor-quiet', at: 2100 },
      // The tutor resumes the cue script (complete sentences, no sentinel)…
      { type: 'tutor-text', text: 'is sam. Listen: sam.', at: 2500 },
      { type: 'tutor-text', text: ' Your turn. What word?', at: 2900 },
      // …and goes quiet again: NOW it is an off-script miss.
      { type: 'tutor-quiet', at: 4000 },
    ]);
    const verdicts = emissions.filter((emission) => emission.kind === 'verdict');
    expect(verdicts).toEqual([
      { kind: 'verdict', judgment: 'off-script', attempt: expect.anything(), misses: 1 },
    ]);
  });

  it('emits resync after consecutive misses and resets misses on a real verdict', () => {
    const miss = (at: number): LoopEvent[] => [
      { type: 'voice-close', turn: turn({ openedAt: at, closedAt: at + 500 }) },
      { type: 'tutor-text', text: 'Something else entirely.', at: at + 900 },
      { type: 'tutor-quiet', at: at + 1200 },
    ];
    const twoMisses = drive([{ type: 'arm' }, ...miss(1000), ...miss(5000)]);
    expect(twoMisses.emissions.filter((emission) => emission.kind === 'resync')).toEqual([
      { kind: 'resync', misses: 2 },
    ]);

    const missThenVerdict = drive([
      { type: 'arm' },
      ...miss(1000),
      { type: 'voice-close', turn: turn({ openedAt: 5000, closedAt: 5500 }) },
      { type: 'tutor-text', text: 'Yes, mmm.', at: 6000 },
    ]);
    expect(missThenVerdict.state.consecutiveMisses).toBe(0);
    expect(missThenVerdict.emissions.filter((emission) => emission.kind === 'resync')).toEqual([]);
  });

  it('times out an unjudged attempt into a no-verdict miss', () => {
    const { emissions, state } = drive([
      { type: 'arm' },
      { type: 'voice-close', turn: turn() },
      { type: 'tick', at: 2000 + config.verdictTimeoutMs - 1 },
      { type: 'tick', at: 2000 + config.verdictTimeoutMs },
    ]);
    expect(emissions.filter((emission) => emission.kind === 'verdict')).toEqual([
      { kind: 'verdict', judgment: 'no-verdict', attempt: expect.anything(), misses: 1 },
    ]);
    expect(state.attempt).toBeNull();
  });

  it('a re-answer before the verdict supersedes the pending attempt', () => {
    const second = turn({ openedAt: 4000, closedAt: 4600 });
    const { state, emissions } = drive([
      { type: 'arm' },
      { type: 'voice-close', turn: turn() },
      { type: 'voice-close', turn: second },
    ]);
    expect(emissions.map((emission) => emission.kind)).toEqual([
      'attempt-open',
      'attempt-superseded',
      'attempt-open',
    ]);
    expect(state.attempt?.turn).toEqual(second);
  });

  it('a sentinel with no attempt at all is surfaced as unanchored, never bound', () => {
    const { emissions } = drive([
      { type: 'arm' },
      { type: 'tutor-text', text: 'Yes, sss.', at: 3000 },
    ]);
    expect(emissions).toEqual([{ kind: 'unanchored-verdict', judgment: 'affirmed' }]);
  });
});
