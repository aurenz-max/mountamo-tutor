/**
 * DI run log — bench-parity diagnostics for the primitive packs.
 *
 * WHY THIS EXISTS (2026-07-25). The first sustained-miss live sitting drove the
 * tutor and a pack into a decohered state and left NO usable record. The
 * `di-bench` panel has carried a full conversation timeline + Copy-run-JSON
 * since the open-mic runs, which is why every prior DI failure was diagnosable;
 * the packs shipped with none of it. Concretely, before this module a pack:
 *
 *  - handled 5 of the 8 `LoopEmission` kinds and hit `default: return` on the
 *    three that MEAN desync — `attempt-superseded` (a second voice turn
 *    replaced the pending answer), `phantom-transcript` (speech with no open
 *    attempt), and `unanchored-verdict` (the tutor judged with nothing to bind
 *    it to — the canonical DI-1 signal);
 *  - wired neither `onTutorText` nor `onVoiceTurnClose`, so there was no record
 *    of what the tutor actually SAID (the only way to see contrastive-correction
 *    drift, a spoken `⟨ ⟩` marker, or a missed sentinel) and none of the mic
 *    floors telemetry that explains a split or echo-opened turn.
 *
 * DESIGN. A module-level store, not component state or props:
 *  - packs write to it with a one-line call at the top of `handleEmission`, so
 *    the existing switch is untouched and the three previously-dropped
 *    emissions are recorded on their way to `default: return`. Logging must
 *    never influence progression.
 *  - the dev panel reads it via `useSyncExternalStore`, so nothing is threaded
 *    through a pack's public props and a lesson-mode render carries no consumer.
 *
 * This is diagnostics only. Nothing here is spoken, rendered to a student, or
 * submitted; `buildDiRunJson()` output is meant to be pasted into a report
 * under `qa/di-bench/` or `qa/eval-reports/`, exactly like a bench run JSON.
 */

import type { LoopEmission } from '../../../hooks/judgedLoopModel';
import type { CueLogEvent } from '../../../hooks/useJudgedSpeechLoop';
import type { VoiceTurnEvent } from '../../../hooks/voiceTurnMachine';
import { getClientRunId, mintRunId, setClientRunId } from '../../../service/clientRunId';

/** Who produced the line. `stage` = the pack's own orchestration. */
export type DiRunSpeaker = 'learner' | 'tutor' | 'judge' | 'stage';

/**
 * The desync/interest flags. A run whose timeline carries none of these was
 * coherent; any of them is a lead, and the first four were previously invisible.
 */
export type DiRunFlag =
  | 'unanchored'       // verdict with no voice-anchored attempt (DI-1)
  | 'superseded'       // attempt replaced before its verdict (silenceCloseMs class)
  | 'phantom'          // transcript with no open attempt
  | 'no-verdict'       // judge never took a branch before the timeout
  | 'off-script'       // tutor spoke at quiet without taking a branch
  | 'resync'           // engine re-cued after N misses
  | 'move-on'          // correction cap hit — never once observed live before
  | 'retro'            // verdict rebuilt from an unanchored trace (turn detection is marginal)
  | 'session-dead'     // cues going out, tutor proven silent — the mid-run stall, caught live (item 5)
  | 'session-resumed'  // transport resumed; the pack re-cues the item in flight
  | 'loop-deaf';       // learner spoke into an UNARMED loop — our defect, reads as silence everywhere else

export interface DiRunEvent {
  seq: number;
  /** Milliseconds since the run started — the axis you read a stall on. */
  atMs: number;
  speaker: DiRunSpeaker;
  /** `LoopEmission['kind']` verbatim, or a synthetic channel name. */
  kind: string;
  text?: string;
  itemId?: string | null;
  itemDisplay?: string | null;
  responseMs?: number | null;
  commitLagMs?: number | null;
  judgment?: string;
  misses?: number;
  flag?: DiRunFlag;
  /** Voice-turn telemetry (onVoiceTurnClose). */
  peak?: number;
  /** Raw inter-edge span. Undercounts by one capture frame — read `voicedMs`. */
  durationMs?: number;
  /** Speech actually captured (`durationMs` + one frame). What the gate reads. */
  voicedMs?: number;
  duringTutorAudio?: boolean;
  belowMinVoice?: boolean;
}

export interface DiRunMeta {
  primitiveId: string;
  challengeType?: string;
  gradeLevel?: string;
  supportTier?: string;
  totalItems?: number;
  /** Resolved engine config worth pinning — silenceCloseMs is pack-specific. */
  silenceCloseMs?: number;
  startedAtIso?: string;
  /** Correlation key: also sent as `client_run_id` in the tutor WS auth message
   *  and stamped into the backend session ledger. Minted by startDiRunLog. */
  runId?: string;
}

export interface DiRunCounters {
  events: number;
  dropped: number;
  attempts: number;
  transcripts: number;
  affirmed: number;
  corrected: number;
  offScript: number;
  noVerdict: number;
  supersessions: number;
  phantoms: number;
  unanchored: number;
  /** Verdicts saved by the retro-anchor. Nothing was lost, but a run with these
   *  has marginal turn detection — the gate is rejecting real speech. */
  retroAnchored: number;
  resyncs: number;
  moveOns: number;
  tutorLines: number;
  voiceCloses: number;
  echoOpenedTurns: number;
  /** Closes the loop declined to anchor — their activityEnd still reached
   *  Gemini, so each one is a turn the judge may rule on unanchored. */
  belowMinVoiceCloses: number;
  cuesQueued: number;
  cuesSent: number;
  cuesDropped: number;
  cuesBlocked: number;
  /** Cues composed but never spoken (`queued − sent − dropped`). Non-zero means
   *  the surface stopped driving the tutor — the stall signature. */
  cuesStalled: number;
  /** Sent cues the tutor never reacted to within the liveness window — the
   *  OTHER stall signature: the surface kept driving, the tutor was dead. */
  cuesDead: number;
  /** session-dead emissions (ladder level 2 fired). */
  sessionDeads: number;
  /** session-resumed emissions (transport resumes the pack re-cued over). */
  sessionResumes: number;
  meanResponseMs: number | null;
  meanCommitLagMs: number | null;
}

/**
 * Bound the log so a long lesson cannot grow it without limit. A DI run is
 * ~10 items; 600 events is far past a legitimate run, so hitting the cap is
 * itself a signal (and is reported as `dropped`, never silently truncated).
 */
const MAX_EVENTS = 600;

let events: DiRunEvent[] = [];
let dropped = 0;
let seq = 0;
let runStartedAt = 0;
let meta: DiRunMeta | null = null;
const listeners = new Set<() => void>();

/** Cached so `useSyncExternalStore` sees a stable snapshot between writes. */
let snapshot: readonly DiRunEvent[] = [];

const publish = (): void => {
  snapshot = events.slice();
  listeners.forEach((fn) => fn());
  schedulePersist();
};

const push = (event: Omit<DiRunEvent, 'seq' | 'atMs'>): void => {
  if (events.length >= MAX_EVENTS) {
    dropped += 1;
    return;
  }
  seq += 1;
  events.push({
    ...event,
    seq,
    atMs: runStartedAt ? Math.max(0, Date.now() - runStartedAt) : 0,
  });
  publish();
};

// =============================================================================
// Lifecycle
// =============================================================================

/** The runId of the last run that claimed a pre-registered id — so a second
 *  run in the same session mints fresh instead of colliding in the ring. */
let lastClaimedRunId: string | null = null;

/** Begin a run. Clears the previous timeline — call where the pack arms. */
export function startDiRunLog(next: DiRunMeta): void {
  events = [];
  dropped = 0;
  seq = 0;
  runStartedAt = Date.now();
  // Prefer an id the pack registered BEFORE ctx.connect() — the WS auth
  // message already carried it as client_run_id, so claiming it here is what
  // makes the server ledger and this run log join (2026-07-26 smoke finding:
  // minting at arm time is ~200ms too late; auth wins the race).
  const registered = getClientRunId();
  const runId =
    next.runId ?? (registered && registered !== lastClaimedRunId ? registered : mintRunId());
  lastClaimedRunId = runId;
  meta = { ...next, runId, startedAtIso: new Date().toISOString() };
  // Publish the id so later reconnect auth messages carry this run's id.
  setClientRunId(runId);
  lastFlushKey = '';
  publish();
}

export function subscribeDiRunLog(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getDiRunLogSnapshot(): readonly DiRunEvent[] {
  return snapshot;
}

export function getDiRunMeta(): DiRunMeta | null {
  return meta;
}

// =============================================================================
// Writers — called by the packs. None of these may affect progression.
// =============================================================================

export interface DiRunItemContext {
  itemId?: string | null;
  itemDisplay?: string | null;
}

/**
 * Record one engine emission. Call at the TOP of a pack's `handleEmission`,
 * before its switch, so every kind is captured — including the three the packs
 * intentionally ignore for progression.
 */
export function logDiEmission(emission: LoopEmission, ctx: DiRunItemContext = {}): void {
  const base = { itemId: ctx.itemId ?? null, itemDisplay: ctx.itemDisplay ?? null };

  switch (emission.kind) {
    case 'attempt-open':
      push({ ...base, speaker: 'stage', kind: emission.kind, text: 'attempt opened (voice turn closed)' });
      return;

    case 'attempt-superseded':
      push({
        ...base,
        speaker: 'judge',
        kind: emission.kind,
        text: 'attempt superseded by a newer answer before its verdict',
        flag: 'superseded',
      });
      return;

    case 'attempt-transcript':
      push({
        ...base,
        speaker: 'learner',
        kind: emission.kind,
        text: emission.text,
        responseMs: emission.responseMs,
        commitLagMs: emission.commitLagMs,
      });
      return;

    case 'phantom-transcript':
      push({
        ...base,
        speaker: 'learner',
        kind: emission.kind,
        text: emission.text,
        flag: 'phantom',
      });
      return;

    case 'verdict':
      push({
        ...base,
        speaker: 'judge',
        kind: emission.kind,
        judgment: emission.judgment,
        misses: emission.misses,
        // Truncated at the sentinel by construction — usually "My turn".
        text: emission.retroAnchored
          ? `${emission.verdictText ?? ''} [retro-anchored: no voice turn was accepted for this answer]`
          : emission.verdictText,
        flag:
          emission.judgment === 'no-verdict' ? 'no-verdict'
          : emission.judgment === 'off-script' ? 'off-script'
          : emission.retroAnchored ? 'retro'
          : undefined,
      });
      return;

    case 'verdict-text':
      // The COMPLETE judging line. For a contrastive correction this is the
      // part that names the error — and the place drift would show up.
      push({
        ...base,
        speaker: 'tutor',
        kind: emission.kind,
        judgment: emission.judgment,
        text: emission.text,
      });
      return;

    case 'unanchored-verdict':
      push({
        ...base,
        speaker: 'judge',
        kind: emission.kind,
        judgment: emission.judgment,
        text: 'Live took a branch with NO voice-anchored attempt — investigate',
        flag: 'unanchored',
      });
      return;

    case 'resync':
      push({
        ...base,
        speaker: 'judge',
        kind: emission.kind,
        misses: emission.misses,
        text: `resync after ${emission.misses} misses`,
        flag: 'resync',
      });
      return;

    case 'session-resumed':
      // The transport resumed (server GoAway/drop resume or warm client
      // reconnect). The resume restored the conversation, not the item in
      // flight — the pack re-cues it on this signal (BACKLOG item 5 fix (i)).
      push({
        ...base,
        speaker: 'stage',
        kind: emission.kind,
        text: 'session resumed — re-cueing the item in flight',
        flag: 'session-resumed',
      });
      return;

    case 'session-dead':
      // The ladder's level-2 detection: cues went out and the tutor was proven
      // silent. Paired in the timeline with the cue-dead events that built it.
      push({
        ...base,
        speaker: 'stage',
        kind: emission.kind,
        text: `session dead: ${emission.deadCues} consecutive cues with no tutor audio or text`,
        flag: 'session-dead',
      });
      return;

    case 'loop-deaf':
      // The learner spoke and the loop was not armed to record it. OUR defect,
      // and previously invisible: it produces no attempt, so every counter in
      // this log reads exactly as if the child had stayed silent. One of these
      // in a run means the surface could not hear them.
      push({
        ...base,
        speaker: 'learner',
        kind: emission.kind,
        text: `voice turn closed into an UNARMED loop (${Math.round(emission.turn.durationMs)}ms) — answer not recorded`,
        flag: 'loop-deaf',
      });
      return;

    default:
      return;
  }
}

/** Raw tutor output-transcription fragments (`onTutorText`). */
export function logDiTutorText(text: string, ctx: DiRunItemContext = {}): void {
  const trimmed = text.trim();
  if (!trimmed) return;
  push({ ...ctx, speaker: 'tutor', kind: 'tutor-text', text: trimmed });
}

/** How much of a cue text to keep. Cues carry the whole judging contract
 *  (~1.5kB); the timeline wants the identity of the cue, not its body. */
const CUE_SUMMARY_CHARS = 90;

const summarizeCue = (text: string): string => {
  const flat = text.replace(/\s+/g, ' ').trim();
  return flat.length > CUE_SUMMARY_CHARS ? `${flat.slice(0, CUE_SUMMARY_CHARS)}…` : flat;
};

/**
 * A cue's trip through the verify beat (`onCue`).
 *
 * Reads as a ledger: every `sent` and every `dropped` consumes one `queued`, so
 * a run ending with queued > sent + dropped has a cue that was composed and
 * never spoken — which from outside is indistinguishable from a verdict that
 * never fired, and was the ambiguity at the centre of the 2026-07-25 sitting.
 * `blocked` alone is normal (the cue waits for the next release edge).
 * `dead` sits outside the ledger arithmetic: the cue WAS spoken to a session
 * that never reacted (liveness window elapsed) — the item-5 stall signature.
 */
export function logDiCue(event: CueLogEvent, ctx: DiRunItemContext = {}): void {
  push({
    ...ctx,
    speaker: 'stage',
    kind: `cue-${event.phase}`,
    text: event.reason
      ? `${summarizeCue(event.text)} — held by ${event.reason}`
      : summarizeCue(event.text),
  });
}

/** Closed voice turns (`onVoiceTurnClose`) — INCLUDING belowMinVoice blips,
 *  whose activity brackets already reached Gemini. See the option's docblock. */
export function logDiVoiceClose(
  event: Extract<VoiceTurnEvent, { kind: 'close' }>,
  ctx: DiRunItemContext = {},
): void {
  push({
    ...ctx,
    speaker: 'learner',
    kind: 'voice-close',
    peak: Math.round(event.peak * 10000) / 10000,
    durationMs: event.durationMs,
    voicedMs: event.voicedMs,
    duringTutorAudio: event.duringTutorAudio,
    belowMinVoice: event.belowMinVoice,
    text: event.duringTutorAudio ? 'voice turn closed (opened over tutor audio)' : 'voice turn closed',
  });
}

/**
 * A pack-orchestration beat worth seeing next to the engine's: a cue queued,
 * the correction cap firing, an advance committing. This is what distinguishes
 * "the engine desynced" from "the pack mis-sequenced its own cues".
 */
export function logDiStage(kind: string, text: string, ctx: DiRunItemContext = {}, flag?: DiRunFlag): void {
  push({ ...ctx, speaker: 'stage', kind, text, flag });
}

// =============================================================================
// Derivation + export
// =============================================================================

const mean = (values: number[]): number | null =>
  values.length ? Math.round(values.reduce((sum, v) => sum + v, 0) / values.length) : null;

export function deriveDiRunCounters(timeline: readonly DiRunEvent[]): DiRunCounters {
  const countKind = (kind: string) => timeline.filter((e) => e.kind === kind).length;
  const countFlag = (flag: DiRunFlag) => timeline.filter((e) => e.flag === flag).length;
  const verdicts = timeline.filter((e) => e.kind === 'verdict');
  const cuesQueued = countKind('cue-queued');
  const cuesSent = countKind('cue-sent');
  const cuesDropped = countKind('cue-dropped');

  return {
    events: timeline.length,
    dropped,
    attempts: countKind('attempt-open'),
    transcripts: countKind('attempt-transcript'),
    affirmed: verdicts.filter((e) => e.judgment === 'affirmed').length,
    corrected: verdicts.filter((e) => e.judgment === 'corrected').length,
    offScript: countFlag('off-script'),
    noVerdict: countFlag('no-verdict'),
    supersessions: countFlag('superseded'),
    phantoms: countFlag('phantom'),
    unanchored: countFlag('unanchored'),
    retroAnchored: countFlag('retro'),
    resyncs: countFlag('resync'),
    moveOns: countFlag('move-on'),
    tutorLines: countKind('tutor-text'),
    voiceCloses: countKind('voice-close'),
    echoOpenedTurns: timeline.filter((e) => e.kind === 'voice-close' && e.duringTutorAudio).length,
    belowMinVoiceCloses: timeline.filter((e) => e.kind === 'voice-close' && e.belowMinVoice).length,
    cuesQueued,
    cuesSent,
    cuesDropped,
    cuesBlocked: countKind('cue-blocked'),
    cuesStalled: Math.max(0, cuesQueued - cuesSent - cuesDropped),
    // By KIND, not flag: the recovery hook's stage lines (stall-reconnect,
    // stall) share the session-dead FLAG for grep-ability, which double-counted
    // the first live episode (2026-08-01 drive read sessionDeads: 2 for one).
    cuesDead: countKind('cue-dead'),
    sessionDeads: countKind('session-dead'),
    sessionResumes: countKind('session-resumed'),
    meanResponseMs: mean(
      timeline.map((e) => e.responseMs).filter((v): v is number => typeof v === 'number'),
    ),
    meanCommitLagMs: mean(
      timeline.map((e) => e.commitLagMs).filter((v): v is number => typeof v === 'number'),
    ),
  };
}

/** The run payload as an object — what the ring, the upload, and Copy share. */
export function buildDiRunPayload(): {
  source: string;
  meta: DiRunMeta | null;
  counters: DiRunCounters;
  timeline: readonly DiRunEvent[];
} {
  const timeline = getDiRunLogSnapshot();
  return {
    source: 'di-primitive-run-log',
    meta,
    counters: deriveDiRunCounters(timeline),
    timeline,
  };
}

/**
 * The copyable payload. Mirrors the bench run JSON so a pack run and a bench
 * run can be read side by side (and diffed) when bisecting engine vs. pack.
 */
export function buildDiRunJson(): string {
  return JSON.stringify(buildDiRunPayload(), null, 2);
}

// =============================================================================
// Auto-persistence — "no usable record survived" must never recur.
//
// Two layers, both passive:
//  1. localStorage ring (last DI_RING_SIZE runs, throttled): survives tab
//     close, crash, and a child wandering off — no click, no network.
//  2. flushDiRunLog(): POSTs the payload to /api/di-run-logs so the artifact
//     lands on disk next to the backend session ledger, joined by meta.runId.
//     Called by packs at run end and on teardown; never awaited by anything
//     that gates progression.
// =============================================================================

const DI_RING_KEY = 'lumina.di-run-log.ring';
const DI_RING_SIZE = 5;
const PERSIST_THROTTLE_MS = 1000;

let persistTimer: ReturnType<typeof setTimeout> | null = null;
let lastFlushKey = '';

const ringRunId = (entry: unknown): string | undefined =>
  (entry as { meta?: { runId?: string } | null } | null)?.meta?.runId;

function persistToRing(): void {
  if (typeof window === 'undefined') return;
  try {
    const payload = buildDiRunPayload();
    if (!payload.meta || payload.timeline.length === 0) return;
    const raw = window.localStorage.getItem(DI_RING_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    const ring: unknown[] = Array.isArray(parsed) ? parsed : [];
    const kept = ring.filter((entry) => ringRunId(entry) !== payload.meta?.runId);
    kept.push(payload);
    while (kept.length > DI_RING_SIZE) kept.shift();
    window.localStorage.setItem(DI_RING_KEY, JSON.stringify(kept));
  } catch {
    // Quota/serialization failures must never surface into a session.
  }
}

function schedulePersist(): void {
  if (typeof window === 'undefined') return;
  if (persistTimer !== null) return;
  persistTimer = setTimeout(() => {
    persistTimer = null;
    persistToRing();
  }, PERSIST_THROTTLE_MS);
}

/** Read the persisted ring (dev tooling / recovery after a lost session). */
export function readDiRunLogRing(): unknown[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(DI_RING_KEY);
    const ring = raw ? JSON.parse(raw) : [];
    return Array.isArray(ring) ? ring : [];
  } catch {
    return [];
  }
}

/**
 * Upload the current run to the backend drop-box. Fire-and-forget: failures
 * log to the console and the localStorage ring still holds the payload.
 * Deduped on (runId, seq) so run-end + unmount doesn't double-post.
 */
export async function flushDiRunLog(
  reason: string,
  extra: Record<string, unknown> = {},
): Promise<boolean> {
  persistToRing();
  const payload = buildDiRunPayload();
  if (!payload.meta || payload.timeline.length === 0) return false;
  const flushKey = `${payload.meta.runId ?? 'no-id'}:${seq}`;
  if (flushKey === lastFlushKey) return false;
  try {
    // Dynamic import keeps firebase/auth out of the module graph for node
    // tests and for renders that never flush.
    const { authApi } = await import('@/lib/authApiClient');
    await authApi.post('/api/di-run-logs', { ...payload, flushReason: reason, ...extra });
    lastFlushKey = flushKey;
    return true;
  } catch (error) {
    console.warn(`[diRunLog] flush (${reason}) failed — payload retained in localStorage ring`, error);
    return false;
  }
}
