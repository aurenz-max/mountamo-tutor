import 'server-only';

/**
 * Fit ledger — one JSON line per fit verdict, `qa/fit-gate/ledger-YYYY-MM-DD.jsonl`
 * under the app root. `scripts/fit-gate-report.mjs` ranks primitive × mode by
 * failure rate: the outliers are the next `/eval-fix` or `/topic-fidelity` work.
 * Append-only and best-effort: a write failure never affects generation.
 */

import { appendFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';

export function fitLedgerDir(): string {
  return process.env.LUMINA_FIT_LEDGER_DIR || join(process.cwd(), 'qa', 'fit-gate');
}

let ready: Promise<unknown> | null = null;

export function appendFitLedger(entry: Record<string, unknown>): void {
  appendLine('ledger', entry);
}

/**
 * Content a lesson asked for that a primitive's context axis cannot express
 * (service/contextAxis.ts). `scripts/axis-gap-report.mjs` ranks them: the most-asked
 * gap is the next mode or primitive to build.
 */
export function appendAxisGap(entry: Record<string, unknown>): void {
  // Resolver unit tests report gaps on purpose; keep them out of the real log.
  if (process.env.VITEST && !process.env.LUMINA_FIT_LEDGER_DIR) return;
  appendLine('axis-gaps', { at: new Date().toISOString(), ...entry });
}

function appendLine(prefix: string, entry: Record<string, unknown>): void {
  if (process.env.LUMINA_FIT_LEDGER === 'off') return;
  const dir = fitLedgerDir();
  const file = join(dir, `${prefix}-${new Date().toISOString().slice(0, 10)}.jsonl`);
  ready ??= mkdir(dir, { recursive: true });
  void ready
    .then(() => appendFile(file, `${JSON.stringify(entry)}\n`, 'utf8'))
    .catch((err) => console.warn('[FitGate] ledger write failed:', err instanceof Error ? err.message : err));
}
