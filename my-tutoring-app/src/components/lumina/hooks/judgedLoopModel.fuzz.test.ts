/**
 * Seeded stochastic fuzz over the judged-loop reducer (DI BACKLOG item 9,
 * tier 1). Random event orderings — verdict-before-attempt, blips, phantom
 * transcripts, sentinel fragments interleaved with junk — with the reducer's
 * structural invariants asserted after every step. The load-bearing one is the
 * ATTEMPT LEDGER: every attempt that opens is accounted for (superseded,
 * resolved by a verdict, discarded by arm/disarm, or still open) — an attempt
 * silently lost with no verdict is exactly the 2026-07-26 stall class.
 * Deterministic: failures name their seed and step.
 */

import { describe, expect, it } from 'vitest';
import {
  DEFAULT_JUDGED_LOOP_CONFIG,
  IDLE_JUDGED_LOOP,
  reduceJudgedLoop,
  type JudgedLoopState,
  type LoopEvent,
  type VoiceTurnRecord,
} from './judgedLoopModel';

const mulberry32 = (seed: number) => {
  let a = seed | 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

const SEEDS = 120;
const EVENTS_PER_RUN = 250;
/** Generous ceiling: seeded runs are fast alone but share CPU in a full-suite
 *  run, where the vitest default 5s can trip. */
const FUZZ_TIMEOUT_MS = 60_000;

const config = DEFAULT_JUDGED_LOOP_CONFIG;

/** Tutor fragments spanning every sentinel scan outcome: full affirm/correct
 *  lines, opener prefixes that stay pending, and plain non-sentinel speech
 *  (some sentence-ending, to open the off-script gate). */
const TUTOR_FRAGMENTS = [
  'Yes, two plus two is four.',
  'Yes,',
  'My turn:',
  'My',
  'turn: not three — one plus three is four. Your turn.',
  'not three — one plus three is four.',
  'Together: two plus two is four.',
  'plus',
  'four.',
  'What is one plus three?',
  'Listen: one',
];

const LEARNER_WORDS = ['three', 'four', 'five', 'the car', 'sechs'];

const makeTurn = (rand: () => number, closedAt: number): VoiceTurnRecord => {
  const durationMs = Math.round(rand() * 1200);
  return {
    openedAt: closedAt - durationMs,
    closedAt,
    durationMs,
    peak: 0.03 + rand() * 0.3,
    duringTutorAudio: rand() < 0.1,
  };
};

const explain = (seed: number, step: number, detail: string): string =>
  `seed=${seed} step=${step}: ${detail}`;

describe('judgedLoopModel fuzz — attempt ledger + emission invariants under random event orderings', () => {
  it(`holds every invariant across ${SEEDS} seeded runs`, { timeout: FUZZ_TIMEOUT_MS }, () => {
    for (let seed = 1; seed <= SEEDS; seed++) {
      const rand = mulberry32(seed);
      let state: JudgedLoopState = IDLE_JUDGED_LOOP;
      let at = 1000;

      // The attempt ledger.
      let opened = 0;
      let superseded = 0;
      let resolvedByVerdict = 0; // non-retro verdicts only
      let discardedByReset = 0; // arm/disarm while an attempt was open

      for (let step = 0; step < EVENTS_PER_RUN; step++) {
        at += 100 + Math.round(rand() * 1400); // monotonic clock

        const roll = rand();
        let event: LoopEvent;
        if (roll < 0.05) event = { type: 'arm' };
        else if (roll < 0.08) event = { type: 'disarm' };
        else if (roll < 0.23) event = { type: 'voice-close', turn: makeTurn(rand, at) };
        else if (roll < 0.31) event = { type: 'voice-blip', turn: makeTurn(rand, at) };
        else if (roll < 0.43)
          event = { type: 'transcript', text: LEARNER_WORDS[Math.floor(rand() * LEARNER_WORDS.length)], at };
        else if (roll < 0.78)
          event = { type: 'tutor-text', text: TUTOR_FRAGMENTS[Math.floor(rand() * TUTOR_FRAGMENTS.length)], at };
        else if (roll < 0.9) event = { type: 'tutor-quiet', at };
        else event = { type: 'tick', at };

        const pre = state;
        const { state: next, emissions } = reduceJudgedLoop(pre, event, config);

        // Disarmed loop is inert: no emission of any kind.
        if (!pre.armed) {
          expect(emissions, explain(seed, step, `disarmed loop emitted ${emissions.map((e) => e.kind).join(',')}`)).toEqual([]);
        }

        // The reducer never emits verdict-text (that is the hook's channel).
        expect(
          emissions.some((e) => e.kind === 'verdict-text'),
          explain(seed, step, 'reducer emitted verdict-text'),
        ).toBe(false);

        for (let i = 0; i < emissions.length; i++) {
          const emission = emissions[i];

          if (emission.kind === 'attempt-open') opened += 1;
          if (emission.kind === 'attempt-superseded') superseded += 1;
          if (emission.kind === 'verdict' && !emission.retroAnchored) resolvedByVerdict += 1;

          if (emission.kind === 'attempt-transcript') {
            expect(emission.commitLagMs, explain(seed, step, 'negative commitLagMs')).toBeGreaterThanOrEqual(0);
            if (emission.responseMs != null) {
              expect(emission.responseMs, explain(seed, step, 'negative responseMs')).toBeGreaterThanOrEqual(0);
            }
          }

          if (emission.kind === 'resync') {
            expect(
              emission.misses,
              explain(seed, step, 'resync below the miss threshold'),
            ).toBeGreaterThanOrEqual(config.resyncAfterMisses);
            const prev = emissions[i - 1];
            expect(
              prev?.kind === 'verdict' &&
                (prev.judgment === 'off-script' || prev.judgment === 'no-verdict') &&
                prev.misses === emission.misses,
              explain(seed, step, 'resync not paired with its miss verdict in the same step'),
            ).toBe(true);
          }

          if (emission.kind === 'phantom-transcript' || emission.kind === 'unanchored-verdict') {
            expect(pre.attempt, explain(seed, step, `${emission.kind} with an attempt open`)).toBeNull();
          }
        }

        // arm/disarm silently discard an open attempt — account for it.
        if ((event.type === 'arm' || event.type === 'disarm') && pre.attempt !== null) {
          discardedByReset += 1;
        }

        // ATTEMPT LEDGER: nothing opened may vanish unaccounted.
        const stillOpen = next.attempt !== null ? 1 : 0;
        expect(
          opened,
          explain(
            seed,
            step,
            `attempt ledger broke: opened=${opened} superseded=${superseded} ` +
              `resolved=${resolvedByVerdict} discarded=${discardedByReset} stillOpen=${stillOpen}`,
          ),
        ).toBe(superseded + resolvedByVerdict + discardedByReset + stillOpen);

        // State sanity.
        expect(next.consecutiveMisses, explain(seed, step, 'negative miss counter')).toBeGreaterThanOrEqual(0);
        if (next.attempt === null) {
          expect(next.verdictText, explain(seed, step, 'verdictText survived its attempt')).toBe('');
        }

        state = next;
      }
    }
  });
});
