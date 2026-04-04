/**
 * Tunable thresholds for the adaptive decision engine.
 * All in one file for rapid test-and-learn iteration.
 */
export const ADAPTIVE = {
  // --- Score thresholds (0-100 scale) ---
  HIGH_SCORE: 90,               // >= 90 is "mastery" on this item
  FAILURE_SCORE: 60,            // < 60 is "failed"
  EXTENSION_STREAK: 80,         // >= 80 to qualify for extension

  // --- Session bounds ---
  MIN_ITEMS: 3,                 // minimum items before early exit allowed
  MAX_ITEMS: 10,                // hard cap
  INITIAL_BATCH_SIZE: 1,        // first manifest call generates 1 item (prefetch starts immediately)
  PREFETCH_SIZE: 1,             // prefetch 1 item while student works

  // --- Early exit ---
  EARLY_EXIT_STREAK: 3,         // consecutive high scores needed
  EARLY_EXIT_MIN_BATCHES: 2,    // across at least 2 manifest batches (proxy for skill diversity)

  // --- Failure handling ---
  CONSECUTIVE_FAILURES_FOR_EXAMPLE: 2,  // 2 failures → worked example
  MAX_WORKED_EXAMPLES: 2,               // cap per session
  MAX_ATTEMPTS_PER_TOPIC: 3,            // struggle cap: never fail same thing 4 times

  // --- Scaffolding ---
  SCAFFOLDING_DROP_ON_SWITCH: 1,  // drop mode by 1 when switching representation
  INITIAL_SCAFFOLDING_MODE: 3,    // start at mode 3 (middle of 1-6)
  MIN_SCAFFOLDING_MODE: 1,
  MAX_SCAFFOLDING_MODE: 6,

  // --- Transition timing ---
  TRANSITION_DURATION_MS: 2500,   // animation duration (also masks hydration latency)
} as const;
