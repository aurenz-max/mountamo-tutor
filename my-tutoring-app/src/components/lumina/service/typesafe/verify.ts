import 'server-only';

/**
 * TypeSafe output verifier — one shared, optional pipeline step that checks an
 * LLM's OUTPUT against its INPUT with typed yes/no questions, where a regex or
 * `includes()` used to stand in for a semantic judgment.
 *
 * WHAT IT IS. A caller hands over the state (what the model saw and what it
 * produced) and a list of named checks; each check is a TypeSafe Noul with the
 * answer it expects (`true` or `false`) and a threshold. The verifier returns
 * per-check probabilities and pass/fail, plus an overall `pass`. The CALLER owns
 * what happens next: attach the verdict (shadow) or enforce it (gate). TypeSafe
 * never decides on its own — the misconception bench (qa/typesafe/
 * misconception-bench-*.md) found it verifies well (supported/leaks 28/28 on the
 * golden set, 14/14 with the human out of sample) and decides badly (writes where
 * the distiller and the human abstain).
 *
 * MODE. `LUMINA_TYPESAFE_VERIFY` = `off` (default) | `shadow` | `gate`.
 *   off     no call; `ran: false`, `pass: null`. Behaviour identical to before.
 *   shadow  run and report; callers attach the verdict and log it, output unchanged.
 *           Turn this on first and read `[typesafe-verify]` lines for a while.
 *   gate    run and report; callers ENFORCE — a failed hypothesis becomes an abstain.
 * Server env only; a `next dev` restart picks up a change.
 *
 * FAILSAFE (same contract as specialistSuggestions.ts): no key, error, timeout or
 * an open breaker all yield `ran: false, pass: null` — the caller's output passes
 * through untouched. Never throws.
 */

import { systemOne, typesafeConfigured, type NoulQuestion } from '../manifest/typesafe/typesafeClient';

export type VerifyMode = 'off' | 'shadow' | 'gate';

export function verifyModeFromEnv(): VerifyMode {
  const v = (process.env.LUMINA_TYPESAFE_VERIFY ?? 'off').trim().toLowerCase();
  return v === 'shadow' || v === 'gate' ? v : 'off';
}

export interface Check {
  /** Key for code; not sent to the model. */
  id: string;
  /** The yes/no question. Reference state fields with backticked paths. */
  instructions: string;
  criteria?: { true?: string; false?: string };
  /** Which answer counts as a pass. */
  expect: 'true' | 'false';
  /** P(yes) at or above which the answer reads as "true". Default 0.5. */
  threshold?: number;
}

export interface CheckResult {
  id: string;
  /** P(yes) from the model. */
  p: number;
  expect: 'true' | 'false';
  threshold: number;
  pass: boolean;
}

export interface Verification {
  mode: VerifyMode;
  /** False when the verifier did not run (off, no key, error, timeout, breaker). */
  ran: boolean;
  /** Every check passed; null when it did not run. */
  pass: boolean | null;
  checks: CheckResult[];
  ms: number;
  error?: string;
  /** Ids of failed checks, for a one-line reason. */
  failed: string[];
}

export const VERIFY_TIMEOUT_MS = 3000;
const BREAKER_FAILURES = 3;
const BREAKER_OPEN_MS = 5 * 60_000;
let consecutiveFailures = 0;
let breakerOpenUntil = 0;

const notRun = (mode: VerifyMode, ms: number, error?: string): Verification => ({ mode, ran: false, pass: null, checks: [], ms, failed: [], ...(error ? { error } : {}) });

/**
 * Run the checks. `name` labels the log line; `mode` defaults to the env flag
 * (callers pass it explicitly only in tests and harnesses).
 */
export async function verify(
  state: unknown,
  checks: Check[],
  opts: { name?: string; mode?: VerifyMode; timeoutMs?: number } = {},
): Promise<Verification> {
  const mode = opts.mode ?? verifyModeFromEnv();
  const t0 = Date.now();
  if (mode === 'off' || !checks.length) return notRun(mode, 0);
  if (!typesafeConfigured()) return notRun(mode, 0, 'TYPESAFE_API_KEY is not set');
  if (Date.now() < breakerOpenUntil) return notRun(mode, 0, `circuit open until ${new Date(breakerOpenUntil).toISOString()}`);

  const questions: Record<string, NoulQuestion> = {};
  for (const c of checks) questions[c.id] = { type: 'noul', instructions: c.instructions, ...(c.criteria ? { criteria: c.criteria } : {}) };

  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), opts.timeoutMs ?? VERIFY_TIMEOUT_MS);
  try {
    const res = await systemOne(state, questions, { signal: ctl.signal });
    consecutiveFailures = 0;
    const results: CheckResult[] = checks.map((c) => {
      const a = res.answers[c.id];
      const p = a?.type === 'noul' ? a.noul : NaN;
      const threshold = c.threshold ?? 0.5;
      const isTrue = p >= threshold;
      return { id: c.id, p, expect: c.expect, threshold, pass: Number.isNaN(p) ? false : c.expect === 'true' ? isTrue : !isTrue };
    });
    const failed = results.filter((r) => !r.pass).map((r) => r.id);
    const out: Verification = { mode, ran: true, pass: failed.length === 0, checks: results, ms: Date.now() - t0, failed };
    console.info(`[typesafe-verify] ${opts.name ?? 'check'} mode=${mode} pass=${out.pass} ${results.map((r) => `${r.id}=${r.p.toFixed(2)}${r.pass ? '' : '!'}`).join(' ')} ${out.ms}ms`);
    return out;
  } catch (e) {
    consecutiveFailures += 1;
    if (consecutiveFailures >= BREAKER_FAILURES) {
      breakerOpenUntil = Date.now() + BREAKER_OPEN_MS;
      consecutiveFailures = 0;
      console.warn(`[typesafe-verify] ${BREAKER_FAILURES} consecutive failures — skipping for ${BREAKER_OPEN_MS / 60_000} min`);
    }
    const error = ctl.signal.aborted ? `timed out after ${opts.timeoutMs ?? VERIFY_TIMEOUT_MS} ms` : e instanceof Error ? e.message : String(e);
    return notRun(mode, Date.now() - t0, error);
  } finally {
    clearTimeout(timer);
  }
}

/** Test hook. */
export function _resetVerifyBreaker(): void {
  consecutiveFailures = 0;
  breakerOpenUntil = 0;
}

// ---------------------------------------------------------------------------
// Check sets the two distillers use. Kept here so the questions are versioned
// in one place and the bench (scripts/typesafe-misconception-bench.mjs) can
// stay in step with production wording.
// ---------------------------------------------------------------------------

/**
 * A misconception hypothesis against its evidence: must be what the recorded
 * attempts would produce, must not reveal the answer. Benched 28/28 golden,
 * 14/14 human-confirmed (qa/typesafe/misconception-bench-2026-09-16T13-32-27.md § B, D).
 */
export const HYPOTHESIS_CHECKS: Check[] = [
  {
    id: 'supported',
    expect: 'true',
    instructions: 'Is `hypothesis` — a claim about the wrong rule this student applies — supported by the recorded evidence in `evidence`?',
    criteria: { true: 'The recorded attempts are what this wrong rule would produce', false: 'The hypothesis describes a different error, a different task, or is not what the attempts show' },
  },
  {
    id: 'leaks',
    expect: 'false',
    instructions: 'Does the text of `hypothesis` state the correct answer, the target value the student should have produced, or the correct rule?',
    criteria: { true: 'It reveals the answer or the correct outcome', false: 'It only describes the student\'s wrong rule' },
  },
];

/**
 * A strength/support observation against the affirmed responses it cites: the
 * summary must describe what those responses show, and none of the three prose
 * fields may carry a target answer.
 */
export const OBSERVATION_CHECKS: Check[] = [
  {
    id: 'supported',
    expect: 'true',
    instructions: 'Is `observation.summary` — a tentative description of what this learner did successfully — supported by the cited responses in `evidence`?',
    criteria: { true: 'The cited responses show exactly what the summary describes', false: 'The summary claims more than, or something other than, what the cited responses show' },
  },
  {
    id: 'leaks',
    expect: 'false',
    instructions: 'Does any of `observation.summary`, `observation.teachingImplication`, or `observation.checkNext` state a target answer or the expected response to a specific item?',
    criteria: { true: 'A target answer or expected response appears in the text', false: 'The text describes behaviour and next steps without giving answers' },
  },
];
