'use client';

/**
 * DI run log panel — the packs' equivalent of the bench's Copy-run-JSON panel.
 *
 * DEV SURFACE ONLY. Rendered by `DirectInstructionPrimitivesTester`, never by a
 * lesson: it reads the module store in `diRunLog.ts` via `useSyncExternalStore`,
 * so a pack needs no extra props and a lesson-mode render has no consumer.
 *
 * What to read first when a sitting decoheres — the FLAGS row. A coherent run
 * shows zeroes across supersessions / phantoms / unanchored / off-script /
 * no-verdict. Any non-zero is the lead, and all five were invisible before this
 * panel existed.
 */

import { useCallback, useState, useSyncExternalStore } from 'react';
import { LuminaBadge, LuminaButton, LuminaPanel, LuminaSectionLabel } from '../../../ui';
import {
  buildDiRunJson,
  deriveDiRunCounters,
  getDiRunLogSnapshot,
  getDiRunMeta,
  subscribeDiRunLog,
  type DiRunEvent,
} from './diRunLog';

const EMPTY: readonly DiRunEvent[] = [];

const speakerTone: Record<DiRunEvent['speaker'], string> = {
  learner: 'text-emerald-300',
  tutor: 'text-cyan-300',
  judge: 'text-amber-300',
  stage: 'text-slate-400',
};

/** Flags that mean "this run lost coherence" — surfaced, never buried. */
const DESYNC_FLAGS = new Set(['unanchored', 'superseded', 'phantom', 'no-verdict', 'off-script']);

export function DiRunLogPanel() {
  const timeline = useSyncExternalStore(
    subscribeDiRunLog,
    getDiRunLogSnapshot,
    () => EMPTY,
  );
  const [copied, setCopied] = useState(false);

  const copy = useCallback(() => {
    void navigator.clipboard.writeText(buildDiRunJson()).then(
      () => {
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1500);
      },
      () => setCopied(false),
    );
  }, []);

  if (!timeline.length) {
    return (
      <LuminaPanel className="mt-4">
        <LuminaSectionLabel>DI run log</LuminaSectionLabel>
        <p className="text-sm text-slate-400">
          No events yet. Start a run with the mic — every engine emission, the tutor&apos;s own
          lines, and mic turn telemetry land here.
        </p>
      </LuminaPanel>
    );
  }

  const counters = deriveDiRunCounters(timeline);
  const meta = getDiRunMeta();
  // A stalled cue counts as a coherence flag in its own right: it is the
  // surface half of a decohered run (the pack composed a cue and never spoke
  // it), where the other five flags are all the engine/judge half.
  const desyncTotal =
    counters.supersessions + counters.phantoms + counters.unanchored
    + counters.offScript + counters.noVerdict + counters.cuesStalled;

  return (
    <LuminaPanel className="mt-4">
      <div className="flex items-center justify-between gap-3">
        <LuminaSectionLabel>DI run log</LuminaSectionLabel>
        <div className="flex items-center gap-2">
          {counters.dropped > 0 && (
            <LuminaBadge accent="amber">{counters.dropped} events dropped (cap)</LuminaBadge>
          )}
          <LuminaButton size="sm" tone="subtle" onClick={copy}>
            {copied ? 'Copied ✓' : 'Copy run JSON'}
          </LuminaButton>
        </div>
      </div>

      {meta && (
        <p className="mt-1 text-xs text-slate-500">
          {meta.primitiveId}
          {meta.challengeType ? ` · ${meta.challengeType}` : ''}
          {meta.gradeLevel ? ` · grade ${meta.gradeLevel}` : ''}
          {meta.supportTier ? ` · ${meta.supportTier}` : ''}
          {typeof meta.silenceCloseMs === 'number' ? ` · silenceClose ${meta.silenceCloseMs}ms` : ''}
        </p>
      )}

      {/* Coherence first — this is the row the panel exists for. */}
      <div
        className={`mt-3 rounded-lg border px-3 py-2 text-xs ${
          desyncTotal === 0
            ? 'border-emerald-400/30 bg-emerald-500/10 text-emerald-200'
            : 'border-rose-400/40 bg-rose-500/10 text-rose-200'
        }`}
      >
        {desyncTotal === 0 ? (
          <span>
            Coherent — 0 supersessions / phantoms / unanchored / off-script / no-verdict, every
            cue spoken.
          </span>
        ) : (
          <span>
            <strong>{desyncTotal} coherence flag{desyncTotal === 1 ? '' : 's'}</strong>
            {' — '}
            superseded {counters.supersessions} · phantom {counters.phantoms} · unanchored{' '}
            {counters.unanchored} · off-script {counters.offScript} · no-verdict {counters.noVerdict}
            {' · '}stalled cues {counters.cuesStalled}
          </span>
        )}
      </div>

      <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-slate-400 sm:grid-cols-4">
        <span>attempts <strong className="text-slate-200">{counters.attempts}</strong></span>
        <span>affirmed <strong className="text-slate-200">{counters.affirmed}</strong></span>
        <span>corrected <strong className="text-slate-200">{counters.corrected}</strong></span>
        <span>move-ons <strong className="text-slate-200">{counters.moveOns}</strong></span>
        <span>resyncs <strong className="text-slate-200">{counters.resyncs}</strong></span>
        <span>
          retro-anchored{' '}
          <strong className={counters.retroAnchored > 0 ? 'text-amber-300' : 'text-slate-200'}>
            {counters.retroAnchored}
          </strong>
        </span>
        <span>echo-opened <strong className="text-slate-200">{counters.echoOpenedTurns}</strong></span>
        <span>below-min turns <strong className="text-slate-200">{counters.belowMinVoiceCloses}</strong></span>
        <span>
          cues <strong className="text-slate-200">{counters.cuesSent}/{counters.cuesQueued}</strong>
          {counters.cuesBlocked > 0 && (
            <span className="text-slate-500"> ({counters.cuesBlocked} held)</span>
          )}
        </span>
        <span>mean response <strong className="text-slate-200">{counters.meanResponseMs ?? '—'}ms</strong></span>
        <span>mean commit lag <strong className="text-slate-200">{counters.meanCommitLagMs ?? '—'}ms</strong></span>
      </div>

      <div className="mt-3 max-h-72 overflow-y-auto rounded-lg border border-white/10 bg-slate-950/40">
        <table className="w-full text-left text-xs">
          <tbody>
            {timeline.map((event) => (
              <tr
                key={event.seq}
                className={`border-b border-white/5 last:border-0 ${
                  event.flag && DESYNC_FLAGS.has(event.flag) ? 'bg-rose-500/10' : ''
                }`}
              >
                <td className="w-14 px-2 py-1 align-top font-mono text-slate-600">
                  {(event.atMs / 1000).toFixed(1)}s
                </td>
                <td className={`w-16 px-2 py-1 align-top font-medium ${speakerTone[event.speaker]}`}>
                  {event.speaker}
                </td>
                <td className="px-2 py-1 align-top text-slate-300">
                  <span className="font-mono text-[11px] text-slate-500">{event.kind}</span>
                  {event.judgment && (
                    <span className="ml-1 font-mono text-[11px] text-amber-300/80">
                      {event.judgment}
                    </span>
                  )}
                  {event.text && <div className="text-slate-200">{event.text}</div>}
                  {(event.responseMs != null || event.commitLagMs != null) && (
                    <div className="text-[11px] text-slate-500">
                      {event.responseMs != null && `response ${event.responseMs}ms`}
                      {event.responseMs == null && 'response —'}
                      {event.commitLagMs != null && ` · commit lag ${event.commitLagMs}ms`}
                    </div>
                  )}
                  {event.kind === 'voice-close' && (
                    <div className="text-[11px] text-slate-500">
                      peak {event.peak} · voiced {event.voicedMs ?? event.durationMs}ms
                      {event.duringTutorAudio ? ' · over tutor audio' : ''}
                      {event.belowMinVoice ? ' · below min-voice' : ''}
                    </div>
                  )}
                  {event.itemDisplay && (
                    <div className="text-[11px] text-slate-600">item: {event.itemDisplay}</div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </LuminaPanel>
  );
}
