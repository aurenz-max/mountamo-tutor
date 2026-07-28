/**
 * Seeded stochastic fuzz over the voice-turn machine (DI BACKLOG item 9,
 * tier 1). The 2026-07-26 child sitting showed the loop's failures live in
 * event ORDERINGS no table-driven test enumerates; this drives hundreds of
 * randomized frame sequences and asserts the machine's structural invariants
 * on every step. Fully deterministic: a failure names its seed and step, and
 * re-running the seed reproduces it exactly.
 */

import { describe, expect, it } from 'vitest';
import {
  closeVoiceTurn,
  DEFAULT_VOICE_TURN_CONFIG,
  IDLE_VOICE_TURN,
  stepVoiceTurn,
  type VoiceTurnConfig,
  type VoiceTurnState,
} from './voiceTurnMachine';

/** Deterministic PRNG (mulberry32) — no Math.random anywhere in this file. */
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
const FRAMES_PER_RUN = 300;
/** Generous ceiling: seeded runs are fast alone but share CPU in a full-suite
 *  run, where the vitest default 5s tripped (2026-07-26). */
const FUZZ_TIMEOUT_MS = 60_000;

/** Levels come in regimes so turns actually open, hold, and close: silence,
 *  marginal chatter around the threshold, and real speech bursts. */
const levelFor = (rand: () => number): number => {
  const regime = rand();
  if (regime < 0.5) return rand() * 0.015; // silence
  if (regime < 0.7) return 0.015 + rand() * 0.035; // marginal, straddles 0.025
  return 0.03 + rand() * 0.5; // speech
};

const CONFIGS: Array<{ name: string; config: VoiceTurnConfig }> = [
  { name: 'default (framePeriodMs 0)', config: DEFAULT_VOICE_TURN_CONFIG },
  // The real capture cadence: one micLevel per 4096-sample block at 48kHz —
  // the quantisation that produced the 2026-07-26 turn-gate bug.
  { name: 'quantised (framePeriodMs 85.33)', config: { ...DEFAULT_VOICE_TURN_CONFIG, framePeriodMs: 85.33333 } },
];

const explain = (seed: number, step: number, detail: string): string =>
  `seed=${seed} step=${step}: ${detail}`;

describe('voiceTurnMachine fuzz — structural invariants under random frame sequences', () => {
  for (const { name, config } of CONFIGS) {
    it(`holds every invariant across ${SEEDS} seeded runs — ${name}`, { timeout: FUZZ_TIMEOUT_MS }, () => {
      for (let seed = 1; seed <= SEEDS; seed++) {
        const rand = mulberry32(seed);
        let state: VoiceTurnState = IDLE_VOICE_TURN;
        let now = 1000;
        let opens = 0;
        let closes = 0;
        let openTutorAudio = false;

        for (let step = 0; step < FRAMES_PER_RUN; step++) {
          now += 20 + Math.round(rand() * 130); // monotonic clock

          // Occasionally force-close (stop / disable / unmount path).
          if (rand() < 0.02) {
            const wasActive = state.active;
            const forced = closeVoiceTurn(state, config);
            if (!wasActive) {
              expect(forced.event, explain(seed, step, 'force-close on idle must be a no-op')).toBeNull();
              expect(forced.state, explain(seed, step, 'force-close on idle must not change state')).toBe(state);
            } else {
              expect(forced.event?.kind, explain(seed, step, 'force-close on active must emit close')).toBe('close');
              expect(forced.state, explain(seed, step, 'post-close state must be IDLE')).toEqual(IDLE_VOICE_TURN);
              closes += 1;
            }
            state = forced.state;
            continue;
          }

          const frame = { level: levelFor(rand), tutorAudible: rand() < 0.25, now };
          const wasActive = state.active;
          const { state: next, event } = stepVoiceTurn(state, frame, config);

          if (event?.kind === 'open') {
            expect(wasActive, explain(seed, step, 'open emitted while a turn was already open')).toBe(false);
            expect(next.active, explain(seed, step, 'state not active after open')).toBe(true);
            expect(event.duringTutorAudio, explain(seed, step, 'open provenance must match the frame')).toBe(frame.tutorAudible);
            opens += 1;
            openTutorAudio = frame.tutorAudible;
          }

          if (event?.kind === 'close') {
            expect(wasActive, explain(seed, step, 'close emitted with no open turn')).toBe(true);
            expect(next, explain(seed, step, 'post-close state must be exactly IDLE')).toEqual(IDLE_VOICE_TURN);
            expect(event.durationMs, explain(seed, step, 'negative durationMs')).toBeGreaterThanOrEqual(0);
            expect(
              event.voicedMs,
              explain(seed, step, 'voicedMs must be durationMs + one frame period'),
            ).toBe(event.durationMs + Math.round(config.framePeriodMs));
            expect(
              event.belowMinVoice,
              explain(seed, step, 'belowMinVoice must derive from voicedMs vs minVoiceMs'),
            ).toBe(event.voicedMs < config.minVoiceMs);
            expect(
              event.peak,
              explain(seed, step, 'close peak below the open bar — turn could never have opened'),
            ).toBeGreaterThanOrEqual(config.silenceThreshold);
            expect(event.duringTutorAudio, explain(seed, step, 'close provenance must be latched at open')).toBe(openTutorAudio);
            closes += 1;
          }

          if (next.active) {
            expect(
              next.lastAboveAt,
              explain(seed, step, 'lastAboveAt regressed behind startedAt'),
            ).toBeGreaterThanOrEqual(next.startedAt);
            expect(
              next.openBar === config.silenceThreshold ||
                next.openBar === config.silenceThreshold * config.bargeInMultiplier,
              explain(seed, step, `openBar ${next.openBar} is not one of the two legal bars`),
            ).toBe(true);
          }

          // Liveness ledger: turns strictly alternate.
          expect(
            opens - closes,
            explain(seed, step, `open/close ledger broke (opens=${opens}, closes=${closes})`),
          ).toBeGreaterThanOrEqual(0);
          expect(opens - closes, explain(seed, step, 'more than one turn open at once')).toBeLessThanOrEqual(1);
          expect(next.active, explain(seed, step, 'active flag disagrees with the ledger')).toBe(opens - closes === 1);

          state = next;
        }
      }
    });
  }
});
