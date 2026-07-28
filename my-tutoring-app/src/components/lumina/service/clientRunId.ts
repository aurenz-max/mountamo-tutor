/**
 * Client run-id registry — the correlation key between a client-side run
 * recorder (diRunLog) and the backend session ledger.
 *
 * `LuminaAIContext` reads this at auth-send time and ships it as
 * `client_run_id` in the tutor WebSocket auth message; the backend stamps it
 * into `logs/lumina-sessions/*.jsonl` (`session-init`), and the run-log upload
 * carries the same id in `meta.runId` — so the three records join on one key.
 *
 * Deliberately a plain module registry (not React context): the recorder that
 * mints the id (diRunLog) and the transport that sends it (LuminaAIContext)
 * must not import each other.
 */

let currentRunId: string | null = null;

export function setClientRunId(id: string | null): void {
  currentRunId = id;
}

export function getClientRunId(): string | null {
  return currentRunId;
}

export function mintRunId(): string {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID().replace(/-/g, '').slice(0, 12);
    }
  } catch {
    // fall through to the non-crypto fallback
  }
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}
