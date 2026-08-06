import { describe, expect, it } from 'vitest';
import {
  BENCH_SETS,
  completeCue,
  correctionLine,
  COUNTING_SEQUENCE_PROBE_ITEMS,
  DEFAULT_ITEMS,
  guideLine,
  itemCue,
  MATH_FACTS_PROBE_ITEMS,
  modelLine,
  moveOnCue,
  scoreFidelity,
  SENTENCE_READING_PROBE_ITEMS,
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

  it('exposes the math-facts probe as a bench set with full number-word coverage', () => {
    expect(BENCH_SETS.map((set) => set.id)).toEqual([
      'letter-sounds', 'word-reading', 'math-facts', 'counting-120', 'shapes', 'sentence-reading',
    ]);
    const probe = BENCH_SETS.find((set) => set.id === 'math-facts')!.items;
    expect(probe).toBe(MATH_FACTS_PROBE_ITEMS);
    expect(probe).toHaveLength(10);
    // The probe's point: every number word 1-10 appears exactly once as a target.
    expect([...probe.map((item) => item.spoken)].sort()).toEqual(
      ['eight', 'five', 'four', 'nine', 'one', 'seven', 'six', 'ten', 'three', 'two'].sort(),
    );
  });

  it('keeps every math-fact line on the two-branch sentinel contract', () => {
    for (const item of MATH_FACTS_PROBE_ITEMS) {
      expect(verifyLine(item).toLowerCase().startsWith('yes')).toBe(true);
      expect(correctionLine(item).toLowerCase().startsWith('my turn')).toBe(true);
      for (const line of [modelLine(item), guideLine(item), testLine(item)]) {
        expect(['affirmed', 'corrected']).not.toContain(scanForSentinel(line, DI_SENTINELS));
      }
      expect(scanForSentinel(verifyLine(item), DI_SENTINELS)).toBe('affirmed');
      expect(scanForSentinel(correctionLine(item), DI_SENTINELS)).toBe('corrected');
    }
  });

  it('retains the DISTAR math-fact phrasing', () => {
    const fact = MATH_FACTS_PROBE_ITEMS.find((item) => item.id === 'fact-2p1')!;
    expect(modelLine(fact)).toBe('Listen: two plus one is three.');
    expect(guideLine(fact)).toBe('Together: two plus one is three.');
    expect(testLine(fact)).toBe('Your turn. What is two plus one?');
    expect(verifyLine(fact)).toBe('Yes, two plus one is three.');
    expect(correctionLine(fact)).toBe('My turn: two plus one is three. Your turn. What is two plus one?');
    const cue = itemCue(fact);
    expect(cue).toContain('the spoken number word "three" answering two plus one');
  });

  it('cross-checks number-word answers including digit and homophone lexicalizations', () => {
    const three = MATH_FACTS_PROBE_ITEMS.find((item) => item.id === 'fact-2p1')!;
    expect(matchesAsrAliases('Three!', three)).toBe(true);
    expect(matchesAsrAliases('3', three)).toBe(true);
    expect(matchesAsrAliases('free', three)).toBe(true);
    expect(matchesAsrAliases('four', three)).toBe(false);
    const eight = MATH_FACTS_PROBE_ITEMS.find((item) => item.id === 'fact-4p4')!;
    expect(matchesAsrAliases('ate', eight)).toBe(true);
    const one = MATH_FACTS_PROBE_ITEMS.find((item) => item.id === 'fact-0p1')!;
    expect(matchesAsrAliases('won', one)).toBe(true);
  });

  it('detects fact transitions from output transcription', () => {
    expect(detectDIItemFromTutorText('Your turn. What is two plus one?', MATH_FACTS_PROBE_ITEMS)?.id)
      .toBe('fact-2p1');
    expect(detectDIItemFromTutorText('Yes, five plus five is ten.', MATH_FACTS_PROBE_ITEMS)?.id)
      .toBe('fact-5p5');
  });

  it('exposes the counting-to-120 probe with teen/decade and compound coverage', () => {
    const probe = BENCH_SETS.find((set) => set.id === 'counting-120')!.items;
    expect(probe).toBe(COUNTING_SEQUENCE_PROBE_ITEMS);
    expect(probe).toHaveLength(10);
    expect(probe.every((item) => item.kind === 'counting')).toBe(true);
    // (a) both sides of at least one teen/decade pair must be on the table, or
    // the confusion the sitting exists to measure is never actually put to it.
    const spoken = probe.map((item) => item.spoken);
    expect(spoken).toContain('thirteen');
    expect(spoken).toContain('thirty');
    // (b) the class under test is MULTI-WORD: single-word answers alone would
    // just re-bench #46.
    expect(spoken.filter((word) => /[\s-]/.test(word)).length).toBeGreaterThanOrEqual(4);
    // (c) the objective's ceiling is actually reached.
    expect(spoken).toContain('one hundred twenty');
  });

  it('never cross-aliases a teen with its decade sibling', () => {
    // The alias check is the judge-vs-transcript disagreement meter. Listing
    // "thirty" under thirteen would hide exactly the confusion being measured.
    const thirteen = COUNTING_SEQUENCE_PROBE_ITEMS.find((i) => i.id === 'count-12')!;
    expect(matchesAsrAliases('thirteen', thirteen)).toBe(true);
    expect(matchesAsrAliases('13', thirteen)).toBe(true);
    expect(matchesAsrAliases('thirty', thirteen)).toBe(false);
    const thirty = COUNTING_SEQUENCE_PROBE_ITEMS.find((i) => i.id === 'count-29')!;
    expect(matchesAsrAliases('thirty', thirty)).toBe(true);
    expect(matchesAsrAliases('thirteen', thirty)).toBe(false);
    // A partial compound must not cross-check as the whole number.
    const oneTwenty = COUNTING_SEQUENCE_PROBE_ITEMS.find((i) => i.id === 'count-119')!;
    expect(matchesAsrAliases('one hundred twenty', oneTwenty)).toBe(true);
    expect(matchesAsrAliases('twenty', oneTwenty)).toBe(false);
  });

  it('carries the bench-proven DISTAR lines unchanged into the counting kind', () => {
    // The whole reason `counting` reuses the fact wording: the #46-benched lines
    // are problem-phrased and already read correctly for a counting item, so the
    // sitting tests the NUMERAL class rather than new sentences.
    const item = COUNTING_SEQUENCE_PROBE_ITEMS.find((i) => i.id === 'count-29')!;
    expect(modelLine(item)).toBe('Listen: the number after twenty-nine is thirty.');
    expect(guideLine(item)).toBe('Together: the number after twenty-nine is thirty.');
    expect(testLine(item)).toBe('Your turn. What is the number after twenty-nine?');
    expect(verifyLine(item)).toBe('Yes, the number after twenty-nine is thirty.');
    expect(correctionLine(item)).toBe(
      'My turn: the number after twenty-nine is thirty. Your turn. What is the number after twenty-nine?',
    );
  });

  it('keeps every counting line on the two-branch sentinel contract', () => {
    for (const item of COUNTING_SEQUENCE_PROBE_ITEMS) {
      expect(verifyLine(item).toLowerCase().startsWith('yes')).toBe(true);
      expect(correctionLine(item).toLowerCase().startsWith('my turn')).toBe(true);
      for (const line of [modelLine(item), guideLine(item), testLine(item)]) {
        expect(['affirmed', 'corrected']).not.toContain(scanForSentinel(line, DI_SENTINELS));
      }
      expect(scanForSentinel(verifyLine(item), DI_SENTINELS)).toBe('affirmed');
      expect(scanForSentinel(correctionLine(item), DI_SENTINELS)).toBe('corrected');
    }
  });

  it('judges a counting answer strictly — no "reasonably close" past twenty', () => {
    const cue = itemCue(COUNTING_SEQUENCE_PROBE_ITEMS.find((i) => i.id === 'count-106')!);
    // The rubber-stamp guard, the counting analog of the sentence one: a teen
    // and its decade must never be judged as near-misses of each other.
    expect(cue).not.toContain('reasonably close');
    expect(cue).toContain('thirteen is not thirty');
    expect(cue).toContain('said in full');
    expect(cue).toContain('"hundred seven" is not "one hundred seven"');
    // Permissiveness that must survive: pronunciation and counting up.
    expect(cue).toContain('after counting up to it');
  });

  it('detects counting transitions from output transcription', () => {
    expect(
      detectDIItemFromTutorText(
        'Your turn. What is the number after one hundred nineteen?',
        COUNTING_SEQUENCE_PROBE_ITEMS,
      )?.id,
    ).toBe('count-119');
    expect(
      detectDIItemFromTutorText(
        'Yes, the number after ninety-nine is one hundred.',
        COUNTING_SEQUENCE_PROBE_ITEMS,
      )?.id,
    ).toBe('count-99');
  });

  it('exposes the sentence-reading probe with a 3-to-8-word length ladder', () => {
    const probe = BENCH_SETS.find((set) => set.id === 'sentence-reading')!.items;
    expect(probe).toBe(SENTENCE_READING_PROBE_ITEMS);
    expect(probe).toHaveLength(10);
    expect(probe.every((item) => item.kind === 'sentence')).toBe(true);
    // The ladder is the point: the sitting reports WHERE reliability breaks by
    // length, and that ceiling becomes the pack's max sentence length.
    const lengths = probe.map((item) => item.spoken.split(' ').length);
    expect(Math.min(...lengths)).toBe(3);
    expect(Math.max(...lengths)).toBe(8);
  });

  it('keeps every sentence line on the two-branch sentinel contract', () => {
    for (const item of SENTENCE_READING_PROBE_ITEMS) {
      expect(verifyLine(item).toLowerCase().startsWith('yes')).toBe(true);
      expect(correctionLine(item).toLowerCase().startsWith('my turn')).toBe(true);
      // The real collision risk for connected text: a sentence could itself
      // start with "Yes" or contain a clause that scans as a verdict.
      for (const line of [modelLine(item), guideLine(item), testLine(item)]) {
        expect(['affirmed', 'corrected']).not.toContain(scanForSentinel(line, DI_SENTINELS));
      }
      expect(scanForSentinel(verifyLine(item), DI_SENTINELS)).toBe('affirmed');
      expect(scanForSentinel(correctionLine(item), DI_SENTINELS)).toBe('corrected');
    }
  });

  it('reads connected text as a fluent model, not a spelled-out one', () => {
    const item = SENTENCE_READING_PROBE_ITEMS.find((i) => i.id === 'sent-sat-mat')!;
    expect(modelLine(item)).toBe('Listen: Sam sat on the mat.');
    expect(guideLine(item)).toBe('Together: Sam sat on the mat.');
    expect(testLine(item)).toBe('Your turn. Read it.');
    expect(verifyLine(item)).toBe('Yes, that says Sam sat on the mat.');
    expect(correctionLine(item)).toBe('My turn: Sam sat on the mat. Your turn. Read it again.');
  });

  it('judges connected text on word-by-word accuracy, never on speed', () => {
    const cue = itemCue(SENTENCE_READING_PROBE_ITEMS.find((i) => i.id === 'sent-red-hat')!);
    expect(cue).toContain('every word in order');
    // The rubber-stamp guard: "reasonably close" must NOT reach a sentence item.
    expect(cue).not.toContain('reasonably close');
    expect(cue).toContain('ANY word skipped, added, or read as a different word');
    expect(cue).toContain('judge accuracy, never speed');
  });

  it('cross-checks a read sentence as a strict full-sentence containment', () => {
    const item = SENTENCE_READING_PROBE_ITEMS.find((i) => i.id === 'sent-red-hat')!;
    expect(matchesAsrAliases('The big pig had a red hat on.', item)).toBe(true);
    // A one-word substitution must NOT pass the cross-check — this is the
    // signal the sitting reads when the Live judge and the transcript disagree.
    expect(matchesAsrAliases('The big pig had a red hut on.', item)).toBe(false);
    // ...nor an omission.
    expect(matchesAsrAliases('The big pig had a hat on.', item)).toBe(false);
  });

  it('detects sentence transitions from output transcription', () => {
    expect(detectDIItemFromTutorText('Listen: The cat sat.', SENTENCE_READING_PROBE_ITEMS)?.id)
      .toBe('sent-cat-sat');
    expect(
      detectDIItemFromTutorText('Yes, that says we go up and we go down.', SENTENCE_READING_PROBE_ITEMS)?.id,
    ).toBe('sent-up-down');
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
