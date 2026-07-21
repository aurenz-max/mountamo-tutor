import { describe, expect, it } from 'vitest';
import {
  completeCue,
  correctionLine,
  DEFAULT_ITEMS,
  guideLine,
  itemCue,
  modelLine,
  moveOnCue,
  scoreFidelity,
  testLine,
  verifyLine,
} from './diScript';
import {
  detectDIItemFromTutorText,
  matchesAsrAliases,
  MAX_CORRECTIONS_PER_ITEM,
  resolveLiveJudgment,
  summarizeEvents,
  type BenchEvent,
} from './diBenchModel';
import { DI_SENTINELS, scanForSentinel } from '../../hooks/judgedLoopModel';

describe('live-judged Direct Instruction bench model', () => {
  it('keeps the active opening item set', () => {
    expect(DEFAULT_ITEMS.map((item) => item.id)).toEqual([
      'sound-m',
      'sound-s',
      'sound-a',
      'word-sam',
    ]);
    expect(DEFAULT_ITEMS.find((item) => item.id === 'sound-s')?.asrAliases).toContain('shh');
    expect(DEFAULT_ITEMS.find((item) => item.id === 'sound-a')?.asrAliases).toContain('apple');
  });

  it('gives every item cue the two-branch judging contract', () => {
    const cue = itemCue(DEFAULT_ITEMS[0], true);
    expect(cue).toContain('[DI_ITEM]');
    expect(cue).toContain('What sound?');
    expect(cue).toContain(`"${verifyLine(DEFAULT_ITEMS[0])}"`);
    expect(cue).toContain(`"${correctionLine(DEFAULT_ITEMS[0])}"`);
    expect(cue).toContain('square brackets');
    expect(cue).not.toContain('This sound is sss');
  });

  it('keeps the branch sentinels at the front of the scripted lines', () => {
    for (const item of DEFAULT_ITEMS) {
      expect(verifyLine(item).toLowerCase().startsWith('yes')).toBe(true);
      expect(correctionLine(item).toLowerCase().startsWith('my turn')).toBe(true);
    }
  });

  it('never lets a non-verdict scripted line collide with an engine sentinel', () => {
    // Cross-module contract: the DI script and the engine's DI_SENTINELS must
    // stay collision-free — no cue/model/guide/test line may scan as a verdict.
    for (const item of DEFAULT_ITEMS) {
      for (const line of [modelLine(item), guideLine(item), testLine(item)]) {
        expect(['affirmed', 'corrected']).not.toContain(scanForSentinel(line, DI_SENTINELS));
      }
    }
    expect(scanForSentinel(completeCue(), DI_SENTINELS)).not.toBe('affirmed');
    for (const item of DEFAULT_ITEMS) {
      expect(scanForSentinel(verifyLine(item), DI_SENTINELS)).toBe('affirmed');
      expect(scanForSentinel(correctionLine(item), DI_SENTINELS)).toBe('corrected');
    }
  });

  it('cross-checks lossy input transcripts with whole-token aliases', () => {
    const soundS = DEFAULT_ITEMS[1];
    expect(matchesAsrAliases('Shh.', soundS)).toBe(true);
    expect(matchesAsrAliases('sss', soundS)).toBe(true);
    expect(matchesAsrAliases('shhh no', soundS)).toBe(false);
    const shortA = DEFAULT_ITEMS[2];
    expect(matchesAsrAliases('Apple!', shortA)).toBe(true);
    // Keyword elicitation grades the keyword, not the isolated sound.
    expect(matchesAsrAliases('aaa', shortA)).toBe(false);
    expect(matchesAsrAliases('', shortA)).toBe(false);
  });

  it('advances, retries, and completes from the bench alone', () => {
    expect(resolveLiveJudgment('affirmed', 'sound-s', DEFAULT_ITEMS, 0))
      .toEqual({ kind: 'advance', nextItemId: 'sound-a' });
    expect(resolveLiveJudgment('affirmed', 'word-sam', DEFAULT_ITEMS, 1))
      .toEqual({ kind: 'complete' });
    expect(resolveLiveJudgment('corrected', 'sound-s', DEFAULT_ITEMS, 1))
      .toEqual({ kind: 'retry', correctionsUsed: 1 });
    expect(resolveLiveJudgment('off-script', 'sound-s', DEFAULT_ITEMS, 0))
      .toEqual({ kind: 'stay', reason: 'off-script' });
  });

  it('caps corrections and moves the lesson forward', () => {
    expect(resolveLiveJudgment('corrected', 'sound-s', DEFAULT_ITEMS, MAX_CORRECTIONS_PER_ITEM, ))
      .toEqual({ kind: 'move-on', nextItemId: 'sound-a' });
    expect(resolveLiveJudgment('corrected', 'word-sam', DEFAULT_ITEMS, MAX_CORRECTIONS_PER_ITEM))
      .toEqual({ kind: 'move-on', nextItemId: null });
    expect(moveOnCue(DEFAULT_ITEMS[1], DEFAULT_ITEMS[2])).toContain('[DI_MOVE_ON]');
    expect(moveOnCue(DEFAULT_ITEMS[3])).toContain("That's the end of our practice.");
  });

  it('retains the expected DI phrasing for diagnostics', () => {
    expect(guideLine(DEFAULT_ITEMS[0])).toBe('Together: mmm, as in moon.');
    const shortA = DEFAULT_ITEMS[2];
    expect(modelLine(shortA)).toBe('The first sound in apple is short a. Listen: apple.');
    expect(testLine(shortA)).toBe('Your turn. Say apple.');
    expect(correctionLine(shortA)).toBe('My turn: apple. Your turn. Say apple.');
    expect(verifyLine(shortA)).toBe('Yes. Apple starts with short a.');
  });

  it('scores transcript fidelity in order', () => {
    expect(scoreFidelity('Your turn. What sound?', 'Your turn. What sound?')).toEqual({
      coverage: 1,
      extras: 0,
    });
    expect(scoreFidelity('Your turn. What sound?', 'Sound what turn your')).toEqual({
      coverage: 0.25,
      extras: 3,
    });
  });

  it('summarizes verdicts, agreement, and local-mic telemetry', () => {
    const events: BenchEvent[] = [
      { n: 1, speaker: 'tutor', text: 'Your turn.', atMs: 100 },
      { n: 2, speaker: 'mic', text: 'local voice 0.9s', atMs: 850, durationMs: 900, peakLevel: 0.08 },
      { n: 3, speaker: 'learner', text: 'mmm', atMs: 900, responseMs: 800, commitLagMs: 1400, aliasMatch: true },
      { n: 4, speaker: 'judge', text: 'Live affirmed m', atMs: 1000, judgment: 'affirmed', aliasMatch: true, action: 'advance' },
      { n: 5, speaker: 'mic', text: 'local voice 0.5s, opened over tutor audio', atMs: 1500, durationMs: 500, peakLevel: 0.05, duringTutorAudio: true },
      { n: 6, speaker: 'learner', text: 'shh', atMs: 1700, responseMs: 600, commitLagMs: 1000, aliasMatch: true },
      { n: 7, speaker: 'judge', text: 'Live corrected s', atMs: 1800, judgment: 'corrected', aliasMatch: true, action: 'retry' },
      { n: 8, speaker: 'mic', text: 'local voice 0.4s', atMs: 2400, durationMs: 400, peakLevel: 0.04 },
      { n: 9, speaker: 'judge', text: 'Live off-script s', atMs: 2500, judgment: 'off-script', aliasMatch: false, action: 'stay' },
      // DI-1 shape: Live affirmed audio it heard but the learner transcript
      // never arrived — counted separately, never as an anchored affirm.
      { n: 10, speaker: 'judge', text: 'Live affirmed with NO pending attempt (transcript lost?)', atMs: 3100, judgment: 'affirmed', unanchored: true },
    ];
    expect(summarizeEvents(events)).toEqual({
      tutorEvents: 1,
      learnerEvents: 2,
      judgeEvents: 4,
      micEvents: 3,
      turnsOverTutorAudio: 1,
      timedResponses: 2,
      meanFrontendResponseMs: 700,
      meanCommitLagMs: 1200,
      affirmed: 1,
      corrected: 1,
      offScript: 1,
      unanchoredVerdicts: 1,
      aliasAgree: 1,
      aliasDisagree: 1,
    });
  });

  it('detects obvious display transitions from output transcription', () => {
    expect(detectDIItemFromTutorText('Good. This sound is aaa, as in apple.', DEFAULT_ITEMS)?.id)
      .toBe('sound-a');
    expect(detectDIItemFromTutorText('Next. This word is sam.', DEFAULT_ITEMS)?.id)
      .toBe('word-sam');
  });
});
