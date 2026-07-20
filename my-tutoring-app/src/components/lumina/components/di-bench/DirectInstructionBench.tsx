'use client';

/**
 * DirectInstructionBench — Live-judged Direct Instruction over one Gemini Live session.
 *
 * The Live tutor heard the raw audio, so it judges each attempt in-band and
 * reports through a canonical branch pair in its own generated speech:
 * "Yes," affirms, "My turn." corrects. The bench parses only those sentinels
 * from output transcription — and only while an attempt is pending — and the
 * bench alone decides progression. The whole-token alias match on the lossy
 * input transcript runs as a passive cross-check to measure judge agreement.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { LuminaAIProvider, useLuminaAIContext } from '@/contexts/LuminaAIContext';
import { EvaluationProvider } from '../../evaluation';
import { ExhibitProvider } from '../../contexts/ExhibitContext';
import { LuminaMicListener } from '../../ui';
import { useLiveVoiceTurns } from '../../hooks/useLiveVoiceTurns';
import { DEFAULT_VOICE_TURN_CONFIG } from '../../hooks/voiceTurnMachine';
import { completeCue, DEFAULT_ITEMS, DI_TUTORING, itemCue, moveOnCue } from './diScript';
import {
  classifyTutorJudgment,
  detectDIItemFromTutorText,
  matchesAsrAliases,
  MAX_CORRECTIONS_PER_ITEM,
  resolveLiveJudgment,
  summarizeEvents,
  type BenchEvent,
  type DIItem,
  type LiveJudgment,
} from './diBenchModel';

interface DirectInstructionBenchProps {
  onBack: () => void;
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

interface PendingAttempt {
  itemId: string;
  aliasMatch: boolean;
}

/** Manual voice-activity mode. Run 3 proved Gemini's automatic VAD gates on
 *  speech-likeness, not energy: it ignored sustained hums louder than words it
 *  committed, while promoting noise/echo into phantom turns. So the bench's
 *  own amplitude detector now brackets every learner turn via
 *  activityStart/activityEnd, and Gemini's VAD is disabled entirely. */
const DI_AUDIO_INPUT = {
  manual_activity: true,
};

/** The turn authority now lives in useLiveVoiceTurns / voiceTurnMachine
 *  (extracted from this bench after the 2026-07-19 runs). The bench keeps
 *  only the editable silence threshold; barge-in bar, hysteresis, close and
 *  min-voice windows are the shared defaults. Run history that tuned them:
 *  runs 3–4 (threshold 0.025, hysteresis), probe run 2026-07-19 (DI-2 dual
 *  threshold: echo residual 0.033 vs real speech ≥0.068 over tutor audio). */
const DEFAULT_VAD_THRESHOLD = DEFAULT_VOICE_TURN_CONFIG.silenceThreshold;

/** Beat between the tutor's verify line finishing (audio fall) and the next
 *  item cue. Sending the cue at sentinel time stepped on "Yes, mmm." —
 *  the affirmation is the learner's payoff and must be heard whole. */
const VERIFY_BEAT_MS = 400;
/** Failsafe: send a queued cue even if the verify audio never registers. */
const PENDING_CUE_MAX_WAIT_MS = 5000;

const DirectInstructionBenchContent: React.FC<DirectInstructionBenchProps> = ({ onBack }) => {
  const ctx = useLuminaAIContext();
  const [items, setItems] = useState<DIItem[]>(DEFAULT_ITEMS);
  const [events, setEvents] = useState<BenchEvent[]>([]);
  const [running, setRunning] = useState(false);
  const [preparing, setPreparing] = useState(false);
  const [phase, setPhase] = useState('Prepare the Live tutor and microphone.');
  const [activeItemId, setActiveItemId] = useState(DEFAULT_ITEMS[0]?.id ?? '');
  const [vadThreshold, setVadThreshold] = useState(DEFAULT_VAD_THRESHOLD);

  const runningRef = useRef(false);
  const connectedRef = useRef(ctx.isConnected);
  const listeningRef = useRef(ctx.isListening);
  const previousAudioPlayingRef = useRef(ctx.isAudioPlaying);
  const runStartRef = useRef(0);
  const lastTutorQuietAtRef = useRef<number | null>(null);
  const eventNRef = useRef(0);
  const conversationIndexRef = useRef(ctx.conversation.length);
  const tutorTranscriptRef = useRef('');
  const activeItemIdRef = useRef(DEFAULT_ITEMS[0]?.id ?? '');
  const matchedItemIdsRef = useRef(new Set<string>());
  const correctionsRef = useRef(new Map<string, number>());
  const pendingAttemptRef = useRef<PendingAttempt | null>(null);
  const judgmentBufferRef = useRef('');
  const audioPlayingRef = useRef(ctx.isAudioPlaying);
  /** Synchronous view of the hook's turn state, readable inside timers
   *  declared before the hook call. */
  const voiceActiveRef = useRef<() => boolean>(() => false);
  const pendingCueRef = useRef<string | null>(null);
  const cueTimerRef = useRef<number | null>(null);
  const cueFallbackTimerRef = useRef<number | null>(null);
  const weConnectedRef = useRef(false);

  connectedRef.current = ctx.isConnected;
  listeningRef.current = ctx.isListening;
  runningRef.current = running;
  audioPlayingRef.current = ctx.isAudioPlaying;

  const pushEvent = useCallback((event: Omit<BenchEvent, 'n' | 'atMs'>) => {
    // Capture n before the updater runs: React batches same-tick pushes, so
    // reading the ref inside the closure would stamp duplicates.
    const n = ++eventNRef.current;
    const atMs = runStartRef.current
      ? Math.max(0, Math.round(performance.now() - runStartRef.current))
      : 0;
    setEvents((previous) => [...previous, { n, atMs, ...event }]);
  }, []);

  /** Send the queued cue after a short beat — but only into silence. The cue
   *  never fires while the tutor is audible, the learner is mid-utterance, or
   *  an attempt awaits judgment; when blocked it stays queued and each of
   *  those states re-triggers this on its falling edge (audio fall, voice
   *  close, verdict processed). A cue held through a verdict is either
   *  overwritten by the verdict's own next cue or — after an off-script
   *  'stay' — fires as the re-elicitation of the current item. Idempotent
   *  under the timer ref. */
  const schedulePendingCue = useCallback(() => {
    if (cueTimerRef.current != null || pendingCueRef.current == null) return;
    cueTimerRef.current = window.setTimeout(() => {
      cueTimerRef.current = null;
      if (audioPlayingRef.current || voiceActiveRef.current() || pendingAttemptRef.current != null) return;
      const cue = pendingCueRef.current;
      pendingCueRef.current = null;
      if (cue) ctx.sendText(cue, { silent: true });
    }, VERIFY_BEAT_MS);
  }, [ctx]);

  /** Queue the next lesson cue until the tutor's current line (the verify or
   *  correction the learner needs to HEAR) finishes playing. Sending at
   *  sentinel-classification time interrupts the affirmation mid-word. */
  const queueCueAfterSpeech = useCallback((cue: string) => {
    pendingCueRef.current = cue;
    if (!ctx.isAudioPlaying) schedulePendingCue();
    if (cueFallbackTimerRef.current != null) window.clearTimeout(cueFallbackTimerRef.current);
    cueFallbackTimerRef.current = window.setTimeout(() => {
      cueFallbackTimerRef.current = null;
      schedulePendingCue();
    }, PENDING_CUE_MAX_WAIT_MS);
  }, [ctx.isAudioPlaying, schedulePendingCue]);

  const clearPendingCue = useCallback(() => {
    pendingCueRef.current = null;
    if (cueTimerRef.current != null) { window.clearTimeout(cueTimerRef.current); cueTimerRef.current = null; }
    if (cueFallbackTimerRef.current != null) { window.clearTimeout(cueFallbackTimerRef.current); cueFallbackTimerRef.current = null; }
  }, []);

  // This remains the exact frontend response clock: audible tutor tail to the
  // first input-transcription event from the same Gemini Live session. The
  // same falling edge releases any cue held back for the verify line.
  useEffect(() => {
    const wasPlaying = previousAudioPlayingRef.current;
    previousAudioPlayingRef.current = ctx.isAudioPlaying;
    if (wasPlaying && !ctx.isAudioPlaying) {
      if (runningRef.current) lastTutorQuietAtRef.current = performance.now();
      schedulePendingCue();
    }
  }, [ctx.isAudioPlaying, schedulePendingCue]);

  // The shared open-mic turn authority (extracted from this bench). It sends
  // activityStart/End itself; the bench only logs telemetry and re-triggers
  // held cues on voice close.
  const voiceTurns = useLiveVoiceTurns({
    enabled: running,
    config: { silenceThreshold: vadThreshold },
    onTurnClose: (event) => {
      if (!event.belowMinVoice) {
        pushEvent({
          speaker: 'mic',
          text: `local voice ${(event.durationMs / 1000).toFixed(1)}s, peak ${event.peak.toFixed(3)}${event.duringTutorAudio ? ', opened over tutor audio' : ''}`,
          durationMs: event.durationMs,
          peakLevel: Number(event.peak.toFixed(3)),
          duringTutorAudio: event.duringTutorAudio || undefined,
        });
      }
      // Voice close is a cue trigger: a cue held while the learner spoke may
      // now be clear to fire.
      schedulePendingCue();
    },
  });
  voiceActiveRef.current = voiceTurns.isVoiceActive;
  const lastVoiceStartRef = voiceTurns.lastTurnOpenAtRef;

  useEffect(() => {
    const next = ctx.conversation.slice(conversationIndexRef.current);
    conversationIndexRef.current = ctx.conversation.length;
    if (!runningRef.current) return;

    const applyVerdict = (judgment: Exclude<LiveJudgment, 'pending'>, pending: PendingAttempt) => {
      const item = items.find((candidate) => candidate.id === pending.itemId);
      if (!item) return;

      let correctionsUsed = correctionsRef.current.get(item.id) ?? 0;
      if (judgment === 'corrected') {
        correctionsUsed += 1;
        correctionsRef.current.set(item.id, correctionsUsed);
      }
      const decision = resolveLiveJudgment(judgment, item.id, items, correctionsUsed);
      pushEvent({
        speaker: 'judge',
        text: `Live ${judgment} ${item.display}`,
        itemId: item.id,
        judgment,
        aliasMatch: pending.aliasMatch,
        action: decision.kind,
      });

      switch (decision.kind) {
        case 'stay':
          setPhase(`Tutor reply for ${item.display} matched neither branch; logged as off-script.`);
          return;
        case 'retry':
          setPhase(`Live corrected ${item.display} (${decision.correctionsUsed}/${MAX_CORRECTIONS_PER_ITEM}); listening again.`);
          return;
        case 'advance': {
          matchedItemIdsRef.current.add(item.id);
          const nextItem = items.find((candidate) => candidate.id === decision.nextItemId);
          if (!nextItem) return;
          activeItemIdRef.current = nextItem.id;
          setActiveItemId(nextItem.id);
          setPhase(`Live affirmed ${item.display}; next item after the verify line plays out.`);
          queueCueAfterSpeech(itemCue(nextItem));
          return;
        }
        case 'complete':
          matchedItemIdsRef.current.add(item.id);
          runningRef.current = false;
          setRunning(false);
          setPhase('Live affirmed the final item; run complete and Live remains warm.');
          queueCueAfterSpeech(completeCue());
          return;
        case 'move-on': {
          const nextItem = decision.nextItemId
            ? items.find((candidate) => candidate.id === decision.nextItemId)
            : undefined;
          if (nextItem) {
            activeItemIdRef.current = nextItem.id;
            setActiveItemId(nextItem.id);
            setPhase(`Corrections capped on ${item.display}; moving on to ${nextItem.display}.`);
            queueCueAfterSpeech(moveOnCue(item, nextItem));
          } else {
            runningRef.current = false;
            setRunning(false);
            setPhase(`Corrections capped on the final item ${item.display}; run complete.`);
            queueCueAfterSpeech(moveOnCue(item));
          }
          return;
        }
      }
    };

    for (const message of next) {
      if (message.role === 'user') {
        const quietAt = lastTutorQuietAtRef.current;
        const responseMs = quietAt == null ? null : Math.max(0, Math.round(performance.now() - quietAt));
        lastTutorQuietAtRef.current = null;
        const item = items.find((candidate) => candidate.id === activeItemIdRef.current);
        const aliasMatch = item ? matchesAsrAliases(message.content, item) : false;
        const voiceStart = lastVoiceStartRef.current;
        // Phantom-commit guard: a transcript no local voice backed (noise,
        // echo, stale pre-run audio) is logged but never judged. Run 3's
        // "hide"/"ठीक है।" both fail this test.
        if (voiceStart == null && !voiceTurns.isVoiceActive()) {
          pushEvent({
            speaker: 'learner',
            text: message.content,
            responseMs,
            commitLagMs: null,
            itemId: activeItemIdRef.current,
            aliasMatch,
            ignored: 'no-local-voice',
          });
          continue;
        }
        lastVoiceStartRef.current = null;
        const commitLagMs = voiceStart == null
          ? null
          : Math.max(0, Math.round(performance.now() - voiceStart));
        pendingAttemptRef.current = { itemId: activeItemIdRef.current, aliasMatch };
        judgmentBufferRef.current = '';
        pushEvent({
          speaker: 'learner',
          text: message.content,
          responseMs,
          commitLagMs,
          itemId: activeItemIdRef.current,
          aliasMatch,
        });
        continue;
      }

      tutorTranscriptRef.current += ` ${message.content}`;
      const detected = detectDIItemFromTutorText(tutorTranscriptRef.current, items);
      pushEvent({ speaker: 'tutor', text: message.content, detectedItemId: detected?.id });

      const pending = pendingAttemptRef.current;
      if (!pending) {
        // DI-1 detector: a sentinel verdict with NO transcript-backed attempt
        // pending means Live judged audio it heard but the input transcription
        // was lost (probe run 2026-07-19: /sss/ over tutor audio → "Yes, sss."
        // → screen stuck on s). Log it first-class — this is the exact moment
        // bench and model diverge. Per-fragment classification: sentinels open
        // a tutor sentence, so the fragment that starts one classifies alone;
        // a mid-word split ("Ye"+"s, …") can slip past — log-only tradeoff.
        const stray = classifyTutorJudgment(message.content);
        if (stray === 'affirmed' || stray === 'corrected') {
          pushEvent({
            speaker: 'judge',
            text: `Live ${stray} with NO pending attempt (transcript lost?)`,
            itemId: activeItemIdRef.current,
            judgment: stray,
            unanchored: true,
          });
          setPhase(`Live said a ${stray === 'affirmed' ? '"Yes"' : '"My turn"'} verdict with no attempt pending — likely a lost learner transcript on ${activeItemIdRef.current}.`);
        }
        continue;
      }
      judgmentBufferRef.current += ` ${message.content}`;
      const judgment = classifyTutorJudgment(judgmentBufferRef.current);
      if (judgment === 'pending') continue;
      pendingAttemptRef.current = null;
      judgmentBufferRef.current = '';
      applyVerdict(judgment, pending);
      if (!runningRef.current) break;
    }
    // Verdict processing is a cue trigger: clearing the pending attempt (or an
    // advance queueing its cue while the room is already quiet) can leave a
    // fireable cue with no future audio-fall or voice-close edge to release it.
    if (runningRef.current) schedulePendingCue();
  }, [ctx, items, pushEvent, queueCueAfterSpeech, schedulePendingCue]);

  const prepareLive = useCallback(async () => {
    if (preparing) return;
    setPreparing(true);
    setPhase('Connecting the Live tutor…');
    try {
      if (!connectedRef.current) {
        weConnectedRef.current = true;
        await ctx.connect({
          primitive_type: 'di-bench',
          instance_id: `di-bench-${Date.now()}`,
          primitive_data: {
            activity: 'live direct instruction drill',
            items: items.map(({ id, kind, display, spoken, keyword, elicitation }) => ({
              id, kind, display, spoken, keyword, elicitation,
            })),
          },
          grade_level: 'kindergarten',
          tutoring: DI_TUTORING,
          audio_input: DI_AUDIO_INPUT,
        });
        const connectionStarted = performance.now();
        while (!connectedRef.current && performance.now() - connectionStarted < 12_000) await sleep(100);
        if (!connectedRef.current) throw new Error('The Live tutor did not connect within 12 seconds.');
      }

      setPhase('Opening the microphone…');
      ctx.startListening();
      const micStarted = performance.now();
      while (!listeningRef.current && performance.now() - micStarted < 10_000) await sleep(100);
      if (!listeningRef.current) throw new Error('The microphone did not become live.');
      setPhase('Ready — Live input and output transcription are active.');
    } catch (error) {
      setPhase(error instanceof Error ? error.message : 'Unable to prepare the Live tutor.');
    } finally {
      setPreparing(false);
    }
  }, [ctx, items, preparing]);

  const startRun = useCallback(() => {
    if (!ctx.isConnected || !ctx.isListening || ctx.isAudioPlaying) return;
    const firstItem = items[0];
    if (!firstItem) return;
    eventNRef.current = 0;
    runStartRef.current = performance.now();
    lastTutorQuietAtRef.current = null;
    tutorTranscriptRef.current = '';
    conversationIndexRef.current = ctx.conversation.length;
    setEvents([]);
    matchedItemIdsRef.current.clear();
    correctionsRef.current.clear();
    pendingAttemptRef.current = null;
    judgmentBufferRef.current = '';
    voiceTurns.reset();
    clearPendingCue();
    activeItemIdRef.current = firstItem.id;
    setActiveItemId(firstItem.id);
    runningRef.current = true;
    setRunning(true);
    setPhase('The Live tutor is conducting the lesson. Speak naturally when she asks.');
    ctx.sendText(itemCue(firstItem, true), { silent: true });
  }, [clearPendingCue, ctx, items]);

  const stopRun = useCallback(() => {
    runningRef.current = false;
    setRunning(false);
    lastTutorQuietAtRef.current = null;
    pendingAttemptRef.current = null;
    judgmentBufferRef.current = '';
    // Flipping `running` false disables useLiveVoiceTurns, which force-closes
    // any open turn (activityEnd included).
    clearPendingCue();
    setPhase('Run stopped — the Live tutor remains warm.');
  }, [clearPendingCue]);

  useEffect(() => () => {
    runningRef.current = false;
    if (cueTimerRef.current != null) window.clearTimeout(cueTimerRef.current);
    if (cueFallbackTimerRef.current != null) window.clearTimeout(cueFallbackTimerRef.current);
    // useLiveVoiceTurns closes any open turn on its own unmount.
    ctx.stopListening();
    if (weConnectedRef.current) ctx.disconnect();
  // Context methods are stable; this is unmount-only cleanup.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const summary = useMemo(() => summarizeEvents(events), [events]);
  const ready = ctx.isConnected && ctx.isListening;
  const activeItem = items.find((item) => item.id === activeItemId) ?? items[0];
  const awaitingJudgment = pendingAttemptRef.current != null;

  const copyRun = useCallback(async () => {
    const payload = {
      bench: 'direct-instruction',
      at: new Date().toISOString(),
      config: {
        architecture: 'live-judged-two-branch-sentinel-with-frontend-progression-authority',
        live: 'gemini-3.1-flash-live-preview-audio-with-input-output-transcription',
        judge: 'gemini-live-in-band (affirm="Yes", correct="My turn")',
        crossCheck: 'whole-token-asr-alias-match-on-input-transcript (passive)',
        timing: 'frontend:tutor-audio-fall-to-live-input-transcription-arrival',
        geminiVad: { ...DI_AUDIO_INPUT, note: 'automatic VAD disabled; client brackets turns' },
        localVad: {
          role: 'turn-authority (useLiveVoiceTurns / voiceTurnMachine)',
          ...voiceTurns.config,
          gatedWhileTutorAudioPlays: false,
          bargeIn: 'activityStart over tutor audio interrupts generation; client flushes on ai_interrupted',
          echoDefense: 'browser AEC on capture + DI-2 dual threshold (barge-in bar = silenceThreshold × bargeInMultiplier)',
          measuredFloors: {
            ambientRms: Number(voiceTurns.floorsRef.current.ambientRms.toFixed(4)),
            echoRms: Number(voiceTurns.floorsRef.current.echoRms.toFixed(4)),
          },
          phantomCommitGuard: 'transcripts without local voice are logged, never judged',
        },
      },
      items,
      summary,
      events,
    };
    try {
      await navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
      setPhase('Run JSON copied to clipboard.');
    } catch {
      setPhase('Clipboard copy failed.');
    }
  }, [events, items, summary]);

  const setItem = (id: string, patch: Partial<DIItem>) => {
    setItems((previous) => previous.map((item) => item.id === id ? { ...item, ...patch } : item));
  };

  return (
    <div className="mx-auto max-w-5xl px-4 pb-16">
      <div className="mb-6 flex items-center gap-4">
        <button onClick={onBack} className="inline-flex items-center gap-2 rounded-full border border-slate-600 bg-slate-800/50 px-4 py-2 text-sm text-white transition-all hover:bg-slate-700/50">
          ← Back
        </button>
        <div>
          <h1 className="text-xl font-semibold text-slate-100">Direct Instruction Bench</h1>
          <p className="text-xs text-slate-400">Live judges each attempt in-band from the audio it heard; the bench parses the branch and alone advances the lesson.</p>
        </div>
      </div>

      <div className="mb-4 rounded-2xl border border-white/10 bg-slate-900/40 p-4 backdrop-blur-xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-slate-200">Live lesson set</h2>
            <p className="mt-1 max-w-2xl text-xs text-slate-500">
              Manual VAD: the local mic detector brackets every turn (Gemini’s auto-VAD is off) — speak above the RMS threshold and the turn is yours, even over the tutor: talking while she speaks interrupts her mid-line. Affirmations begin “Yes”, corrections begin “My turn”; the alias match stays a passive disagreement meter.
            </p>
          </div>
          <span className="rounded-full border border-cyan-400/30 bg-cyan-500/10 px-3 py-1 text-[10px] uppercase tracking-wide text-cyan-200">
            Live-judged POC
          </span>
        </div>
        <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
          {items.map((item) => (
            <div key={item.id} className={`flex items-center gap-3 rounded-xl border px-3 py-2 ${activeItemId === item.id ? 'border-cyan-400/50 bg-cyan-500/10' : 'border-white/10 bg-slate-800/50'}`}>
              <span className="w-10 text-center text-lg font-bold text-slate-100">{item.display}</span>
              <span className="text-[10px] uppercase text-slate-500">{matchedItemIdsRef.current.has(item.id) ? 'matched' : item.kind}</span>
              <label className="ml-auto flex items-center gap-1 text-[10px] text-slate-500">
                spoken
                <input value={item.spoken} disabled={running} onChange={(event) => setItem(item.id, { spoken: event.target.value })} className="w-20 rounded border border-white/10 bg-slate-900/60 px-1.5 py-0.5 font-mono text-xs text-slate-200" />
              </label>
            </div>
          ))}
        </div>
      </div>

      {running && activeItem && (
        <div className="mb-4 flex min-h-40 items-center justify-center rounded-2xl border border-cyan-400/20 bg-gradient-to-br from-cyan-500/10 to-slate-900/50 p-6 text-center">
          <div>
            <div className="text-7xl font-bold tracking-wide text-white">{activeItem.display}</div>
            <div className="mt-3 text-xs uppercase tracking-[0.2em] text-cyan-300">
              {awaitingJudgment ? 'judging' : 'listening'}
            </div>
            {(correctionsRef.current.get(activeItem.id) ?? 0) > 0 && (
              <div className="mt-2 text-sm text-slate-300">
                corrections {correctionsRef.current.get(activeItem.id)}/{MAX_CORRECTIONS_PER_ITEM}
              </div>
            )}
          </div>
        </div>
      )}

      <div className="mb-4 flex flex-wrap items-center gap-6 rounded-2xl border border-white/10 bg-slate-900/40 p-4 backdrop-blur-xl">
        <LuminaMicListener
          state={preparing ? 'opening' : ctx.isListening ? 'armed' : 'idle'}
          level={ctx.micLevel}
          isSupported={typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia}
          onStart={() => void prepareLive()}
          onCancel={running ? undefined : ctx.stopListening}
          size="md"
          idleLabel="Prepare live audio"
          openingLabel="Connecting tutor…"
          listeningLabel="Live tutor hearing"
        />

        <div className="flex flex-wrap items-center gap-4 text-xs text-slate-400">
          <span className="flex items-center gap-2"><span className={`h-2 w-2 rounded-full ${ctx.isConnected ? 'bg-emerald-400' : 'bg-slate-600'}`} />Live tutor {ctx.isConnected ? 'connected' : 'offline'}</span>
          <span className="flex items-center gap-2"><span className={`h-2 w-2 rounded-full ${ctx.isAudioPlaying ? 'animate-pulse bg-cyan-400' : 'bg-slate-600'}`} />{ctx.isAudioPlaying ? 'Tutor speaking' : 'Tutor silent'}</span>
          <span className="flex items-center gap-2"><span className={`h-2 w-2 rounded-full ${ctx.isListening ? 'bg-emerald-400' : 'bg-slate-600'}`} />{ctx.isListening ? 'Mic live' : 'Mic off'}</span>
          <span className="flex items-center gap-2 font-mono">
            <span className={`h-2 w-2 rounded-full ${!ctx.isAudioPlaying && ctx.micLevel >= vadThreshold ? 'bg-amber-400' : 'bg-slate-600'}`} />
            RMS {ctx.micLevel.toFixed(3)}
          </span>
          <label className="flex items-center gap-1">
            local VAD ≥
            <input
              type="number"
              step={0.01}
              min={0.005}
              max={0.5}
              value={vadThreshold}
              onChange={(event) => {
                const value = Number(event.target.value);
                if (Number.isFinite(value) && value > 0) setVadThreshold(value);
              }}
              className="w-16 rounded border border-white/10 bg-slate-900/60 px-1.5 py-0.5 font-mono text-xs text-slate-200"
            />
          </label>
          <span className="font-mono text-[10px] text-slate-500" title="EMA noise floors: ambient (tutor silent) / echo residual (tutor speaking). Barge-in bar opens at threshold × {String(voiceTurns.config.bargeInMultiplier)}.">
            floors {voiceTurns.floorsRef.current.ambientRms.toFixed(3)}/{voiceTurns.floorsRef.current.echoRms.toFixed(3)}
          </span>
        </div>

        <div className="ml-auto flex items-center gap-3">
          <span className="max-w-[17rem] truncate text-xs italic text-slate-400" title={phase}>{phase}</span>
          {running ? (
            <button onClick={stopRun} className="rounded-full border border-rose-400/40 bg-rose-500/20 px-4 py-2 text-sm text-rose-200">Stop</button>
          ) : (
            <button onClick={startRun} disabled={!ready || ctx.isAudioPlaying} title={!ready ? 'Prepare the Live tutor first' : ctx.isAudioPlaying ? 'Wait for the tutor to finish speaking' : undefined} className="rounded-full border border-cyan-400/40 bg-cyan-500/20 px-4 py-2 text-sm text-cyan-200 disabled:cursor-not-allowed disabled:opacity-40">Start run</button>
          )}
          <button onClick={() => void copyRun()} disabled={events.length === 0} className="rounded-full border border-white/10 bg-slate-800/60 px-4 py-2 text-sm text-slate-300 disabled:opacity-40">Copy run JSON</button>
        </div>
      </div>

      {events.length > 0 && (
        <div className="mb-3 text-xs text-slate-400">
          tutor: <span className="text-slate-200">{summary.tutorEvents}</span>
          {' · '}learner: <span className="text-emerald-300">{summary.learnerEvents}</span>
          {' · '}local voice: <span className={summary.micEvents > summary.learnerEvents ? 'text-rose-300' : 'text-amber-200'}>{summary.micEvents}</span>
          {summary.micEvents > summary.learnerEvents && <span className="text-rose-300"> ({summary.micEvents - summary.learnerEvents} unheard)</span>}
          {summary.turnsOverTutorAudio > 0 && <>{' · '}over tutor audio: <span className="text-amber-300">{summary.turnsOverTutorAudio}</span></>}
          {' · '}verdicts: <span className="text-violet-300">{summary.affirmed}✓ {summary.corrected}↻ {summary.offScript}?</span>
          {summary.unanchoredVerdicts > 0 && <>{' · '}<span className="text-rose-300">unanchored: {summary.unanchoredVerdicts}</span></>}
          {summary.aliasAgree + summary.aliasDisagree > 0 && (
            <>{' · '}alias agreement: <span className="text-amber-200">{summary.aliasAgree}/{summary.aliasAgree + summary.aliasDisagree}</span></>
          )}
          {summary.meanFrontendResponseMs != null && <>{' · '}mean response: <span className="text-cyan-200">{summary.meanFrontendResponseMs}ms</span></>}
          {summary.meanCommitLagMs != null && <>{' · '}mean voice→heard: <span className="text-amber-200">{summary.meanCommitLagMs}ms</span></>}
        </div>
      )}

      <div className="overflow-x-auto rounded-2xl border border-white/10 bg-slate-900/40 backdrop-blur-xl">
        <table className="w-full text-xs">
          <thead><tr className="border-b border-white/10 text-[10px] uppercase tracking-wide text-slate-500"><th className="px-3 py-2 text-left">#</th><th className="px-3 py-2 text-left">At</th><th className="px-3 py-2 text-left">Channel</th><th className="px-3 py-2 text-left">Text / verdict</th><th className="px-3 py-2 text-left">Response</th></tr></thead>
          <tbody>
            {events.length === 0 && <tr><td colSpan={5} className="px-3 py-7 text-center text-slate-500">Prepare live audio, then Start run. Transcripts drive the log and UI automatically.</td></tr>}
            {events.map((event) => (
              <tr key={event.n} className="border-b border-white/5 align-top">
                <td className="px-3 py-2 text-slate-500">{event.n}</td><td className="px-3 py-2 text-slate-400">{(event.atMs / 1000).toFixed(1)}s</td>
                <td className="px-3 py-2"><span className={event.speaker === 'tutor' ? 'text-cyan-300' : event.speaker === 'learner' ? 'text-emerald-300' : event.speaker === 'mic' ? 'text-amber-300' : 'text-violet-300'}>{event.speaker === 'tutor' ? 'Live · output' : event.speaker === 'learner' ? 'Live · input' : event.speaker === 'mic' ? 'Mic · local' : 'Bench · judge'}</span></td>
                <td className="max-w-xl px-3 py-2 text-slate-200">
                  “{event.text}”
                  {(event.itemId || event.detectedItemId || event.judgment || event.aliasMatch !== undefined || event.ignored) && (
                    <div className="mt-1 text-[10px] text-slate-500">
                      {event.itemId ? `item ${event.itemId}` : ''}
                      {event.detectedItemId ? ` · transcript mentions ${event.detectedItemId}` : ''}
                      {event.judgment ? ` · ${event.judgment}` : ''}
                      {event.aliasMatch !== undefined ? ` · alias ${event.aliasMatch ? 'match' : 'miss'}` : ''}
                      {event.action ? ` · ${event.action}` : ''}
                      {event.ignored ? <span className="text-rose-300"> · IGNORED ({event.ignored})</span> : ''}
                    </div>
                  )}
                </td>
                <td className="px-3 py-2 text-slate-300">
                  {event.responseMs != null ? `${event.responseMs}ms` : '—'}
                  {event.commitLagMs != null && <span className="text-amber-300/80"> · voice→heard {event.commitLagMs}ms</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const DirectInstructionBench: React.FC<DirectInstructionBenchProps> = (props) => (
  <EvaluationProvider><ExhibitProvider objectives={[]} manifestItems={[]}><LuminaAIProvider><DirectInstructionBenchContent {...props} /></LuminaAIProvider></ExhibitProvider></EvaluationProvider>
);

export default DirectInstructionBench;
