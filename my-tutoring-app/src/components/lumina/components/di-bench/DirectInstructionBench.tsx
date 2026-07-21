'use client';

/**
 * DirectInstructionBench — Live-judged Direct Instruction over one Gemini Live
 * session; pilot consumer of the judged-loop engine.
 *
 * The engine (useJudgedSpeechLoop → judgedLoopModel + useLiveVoiceTurns) owns
 * the loop mechanics: open-mic turn authority, voice-anchored attempts (DI-1),
 * sentence-scoped sentinel verdicts, cue pacing into silence, timeouts and
 * resync. The bench owns DI pedagogy and diagnostics: the item script, the
 * progression policy (advance / retry / move-on after capped corrections),
 * the alias cross-check, and the run log + Copy-run-JSON export.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { LuminaAIProvider, useLuminaAIContext } from '@/contexts/LuminaAIContext';
import { EvaluationProvider } from '../../evaluation';
import { ExhibitProvider } from '../../contexts/ExhibitContext';
import { LuminaMicListener } from '../../ui';
import { useJudgedSpeechLoop } from '../../hooks/useJudgedSpeechLoop';
import type { LoopEmission } from '../../hooks/judgedLoopModel';
import { DEFAULT_VOICE_TURN_CONFIG } from '../../hooks/voiceTurnMachine';
import { completeCue, DEFAULT_ITEMS, DI_TUTORING, itemCue, moveOnCue } from './diScript';
import {
  detectDIItemFromTutorText,
  matchesAsrAliases,
  MAX_CORRECTIONS_PER_ITEM,
  resolveLiveJudgment,
  summarizeEvents,
  type BenchEvent,
  type DIItem,
} from './diBenchModel';

interface DirectInstructionBenchProps {
  onBack: () => void;
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** Manual voice-activity mode. Run 3 proved Gemini's automatic VAD gates on
 *  speech-likeness, not energy: it ignored sustained hums louder than words it
 *  committed, while promoting noise/echo into phantom turns. So the engine's
 *  amplitude detector brackets every learner turn via activityStart/End, and
 *  Gemini's VAD is disabled entirely. */
const DI_AUDIO_INPUT = {
  manual_activity: true,
};

/** The bench keeps only the editable silence threshold; barge-in bar,
 *  hysteresis, close and min-voice windows are the shared engine defaults
 *  (tuned by runs 3–4 and the 2026-07-19/20 open-mic runs). */
const DEFAULT_VAD_THRESHOLD = DEFAULT_VOICE_TURN_CONFIG.silenceThreshold;

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
  const runStartRef = useRef(0);
  const eventNRef = useRef(0);
  const tutorTranscriptRef = useRef('');
  const activeItemIdRef = useRef(DEFAULT_ITEMS[0]?.id ?? '');
  const matchedItemIdsRef = useRef(new Set<string>());
  const correctionsRef = useRef(new Map<string, number>());
  const itemsRef = useRef(items);
  const weConnectedRef = useRef(false);

  connectedRef.current = ctx.isConnected;
  listeningRef.current = ctx.isListening;
  runningRef.current = running;
  itemsRef.current = items;

  const pushEvent = useCallback((event: Omit<BenchEvent, 'n' | 'atMs'>) => {
    // Capture n before the updater runs: React batches same-tick pushes, so
    // reading the ref inside the closure would stamp duplicates.
    const n = ++eventNRef.current;
    const atMs = runStartRef.current
      ? Math.max(0, Math.round(performance.now() - runStartRef.current))
      : 0;
    setEvents((previous) => [...previous, { n, atMs, ...event }]);
  }, []);

  const activeItemOf = () =>
    itemsRef.current.find((candidate) => candidate.id === activeItemIdRef.current);

  /** DI progression policy over an engine verdict. The engine already bound
   *  the verdict to a voice-anchored attempt; this decides what it means. */
  const applyVerdict = useCallback((
    judgment: 'affirmed' | 'corrected' | 'off-script',
    aliasMatch: boolean | undefined,
    queueCue: (text: string) => void,
  ) => {
    const currentItems = itemsRef.current;
    const item = activeItemOf();
    if (!item) return;

    let correctionsUsed = correctionsRef.current.get(item.id) ?? 0;
    if (judgment === 'corrected') {
      correctionsUsed += 1;
      correctionsRef.current.set(item.id, correctionsUsed);
    }
    const decision = resolveLiveJudgment(judgment, item.id, currentItems, correctionsUsed);
    pushEvent({
      speaker: 'judge',
      text: `Live ${judgment} ${item.display}`,
      itemId: item.id,
      judgment,
      aliasMatch,
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
        const nextItem = currentItems.find((candidate) => candidate.id === decision.nextItemId);
        if (!nextItem) return;
        activeItemIdRef.current = nextItem.id;
        setActiveItemId(nextItem.id);
        setPhase(`Live affirmed ${item.display}; next item after the verify line plays out.`);
        queueCue(itemCue(nextItem));
        return;
      }
      case 'complete':
        matchedItemIdsRef.current.add(item.id);
        runningRef.current = false;
        setRunning(false);
        setPhase('Live affirmed the final item; run complete and Live remains warm.');
        queueCue(completeCue());
        return;
      case 'move-on': {
        const nextItem = decision.nextItemId
          ? currentItems.find((candidate) => candidate.id === decision.nextItemId)
          : undefined;
        if (nextItem) {
          activeItemIdRef.current = nextItem.id;
          setActiveItemId(nextItem.id);
          setPhase(`Corrections capped on ${item.display}; moving on to ${nextItem.display}.`);
          queueCue(moveOnCue(item, nextItem));
        } else {
          runningRef.current = false;
          setRunning(false);
          setPhase(`Corrections capped on the final item ${item.display}; run complete.`);
          queueCue(moveOnCue(item));
        }
        return;
      }
    }
  }, [pushEvent]);

  const handleEmission = useCallback((emission: LoopEmission) => {
    switch (emission.kind) {
      case 'attempt-open':
        return;
      case 'attempt-superseded':
        pushEvent({
          speaker: 'judge',
          text: 'attempt superseded by a newer answer before the verdict',
          itemId: activeItemIdRef.current,
        });
        return;
      case 'attempt-transcript': {
        const item = activeItemOf();
        pushEvent({
          speaker: 'learner',
          text: emission.text,
          responseMs: emission.responseMs,
          commitLagMs: emission.commitLagMs,
          itemId: activeItemIdRef.current,
          aliasMatch: item ? matchesAsrAliases(emission.text, item) : false,
        });
        return;
      }
      case 'phantom-transcript': {
        const item = activeItemOf();
        pushEvent({
          speaker: 'learner',
          text: emission.text,
          responseMs: null,
          commitLagMs: null,
          itemId: activeItemIdRef.current,
          aliasMatch: item ? matchesAsrAliases(emission.text, item) : false,
          ignored: 'no-local-voice',
        });
        return;
      }
      case 'verdict': {
        if (emission.judgment === 'no-verdict') {
          pushEvent({
            speaker: 'judge',
            text: 'no verdict before timeout; attempt dropped',
            itemId: activeItemIdRef.current,
            judgment: 'no-verdict',
          });
          setPhase(`The Live judge never took a branch for ${activeItemIdRef.current}; waiting (resync will re-cue).`);
          return;
        }
        // Alias cross-check comes from the attempt's transcript when Live
        // supplied one; a transcript-less attempt (DI-1 shape) is judged but
        // excluded from agreement stats.
        const item = activeItemOf();
        const aliasMatch = emission.attempt.transcript != null && item
          ? matchesAsrAliases(emission.attempt.transcript, item)
          : undefined;
        applyVerdict(emission.judgment, aliasMatch, loopRef.current.queueCue);
        return;
      }
      case 'unanchored-verdict':
        pushEvent({
          speaker: 'judge',
          text: `Live ${emission.judgment} with NO voice-anchored attempt`,
          itemId: activeItemIdRef.current,
          judgment: emission.judgment,
          unanchored: true,
        });
        setPhase(`Live took a branch with no local voice turn at all on ${activeItemIdRef.current} — investigate.`);
        return;
      case 'resync': {
        const item = activeItemOf();
        if (!item) return;
        pushEvent({
          speaker: 'judge',
          text: `resync after ${emission.misses} misses — re-cueing ${item.display}`,
          itemId: item.id,
          action: 'stay',
        });
        setPhase(`Loop resync: re-cueing ${item.display}.`);
        loopRef.current.queueCue(itemCue(item));
        return;
      }
    }
  }, [applyVerdict, pushEvent]);

  const loop = useJudgedSpeechLoop({
    enabled: running,
    voice: { config: { silenceThreshold: vadThreshold } },
    onEmission: handleEmission,
    onTutorText: (text) => {
      tutorTranscriptRef.current += ` ${text}`;
      const detected = detectDIItemFromTutorText(tutorTranscriptRef.current, itemsRef.current);
      pushEvent({ speaker: 'tutor', text, detectedItemId: detected?.id });
    },
    onVoiceTurnClose: (event) => {
      pushEvent({
        speaker: 'mic',
        text: `local voice ${(event.durationMs / 1000).toFixed(1)}s, peak ${event.peak.toFixed(3)}${event.duringTutorAudio ? ', opened over tutor audio' : ''}`,
        durationMs: event.durationMs,
        peakLevel: Number(event.peak.toFixed(3)),
        duringTutorAudio: event.duringTutorAudio || undefined,
      });
    },
  });
  // handleEmission fires from inside the loop's dispatch, before `loop` from
  // this render is assignable — route self-references through a ref.
  const loopRef = useRef(loop);
  loopRef.current = loop;

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
    tutorTranscriptRef.current = '';
    setEvents([]);
    matchedItemIdsRef.current.clear();
    correctionsRef.current.clear();
    loop.reset();
    activeItemIdRef.current = firstItem.id;
    setActiveItemId(firstItem.id);
    runningRef.current = true;
    setRunning(true);
    setPhase('The Live tutor is conducting the lesson. Speak naturally when she asks.');
    loop.sendCueNow(itemCue(firstItem, true));
    loop.arm();
  }, [ctx, items, loop]);

  const stopRun = useCallback(() => {
    runningRef.current = false;
    setRunning(false);
    // Disabling disarms the engine and closes any open voice turn; an abrupt
    // stop also drops whatever cue was queued.
    loop.clearQueuedCue();
    setPhase('Run stopped — the Live tutor remains warm.');
  }, [loop]);

  useEffect(() => () => {
    runningRef.current = false;
    // The engine and voice hook clean up their own timers/turns on unmount.
    ctx.stopListening();
    if (weConnectedRef.current) ctx.disconnect();
  // Context methods are stable; this is unmount-only cleanup.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const summary = useMemo(() => summarizeEvents(events), [events]);
  const ready = ctx.isConnected && ctx.isListening;
  const activeItem = items.find((item) => item.id === activeItemId) ?? items[0];
  const awaitingJudgment = loop.isAwaitingJudgment();

  const copyRun = useCallback(async () => {
    const payload = {
      bench: 'direct-instruction',
      at: new Date().toISOString(),
      config: {
        architecture: 'judged-speech-loop-engine-with-di-progression-policy',
        live: 'gemini-3.1-flash-live-preview-audio-with-input-output-transcription',
        judge: 'gemini-live-in-band (affirm="Yes", correct="My turn")',
        crossCheck: 'whole-token-asr-alias-match-on-input-transcript (passive)',
        timing: 'frontend:tutor-audio-fall-to-live-input-transcription-arrival',
        geminiVad: { ...DI_AUDIO_INPUT, note: 'automatic VAD disabled; client brackets turns' },
        engine: {
          attemptAnchor: 'local-voice-turn-close (DI-1); transcripts annotate, never anchor',
          verdictScan: 'sentence-opener sentinels over post-attempt tutor output',
          sentinels: loop.config.sentinels,
          verdictTimeoutMs: loop.config.verdictTimeoutMs,
          resyncAfterMisses: loop.config.resyncAfterMisses,
        },
        localVad: {
          role: 'turn-authority (useLiveVoiceTurns / voiceTurnMachine)',
          ...loop.voiceTurns.config,
          gatedWhileTutorAudioPlays: false,
          bargeIn: 'activityStart over tutor audio interrupts generation; client flushes on ai_interrupted',
          echoDefense: 'browser AEC on capture + DI-2 dual threshold (barge-in bar = silenceThreshold × bargeInMultiplier)',
          measuredFloors: {
            ambientRms: Number(loop.voiceTurns.floorsRef.current.ambientRms.toFixed(4)),
            echoRms: Number(loop.voiceTurns.floorsRef.current.echoRms.toFixed(4)),
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
  }, [events, items, summary, loop]);

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
          <p className="text-xs text-slate-400">The judged-loop engine anchors attempts to local voice turns and binds the Live judge’s in-band verdicts; the bench maps them to DI progression.</p>
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
            Engine pilot
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
          <span className="font-mono text-[10px] text-slate-500" title={`EMA noise floors: ambient (tutor silent) / echo residual (tutor speaking). Barge-in bar opens at threshold × ${loop.voiceTurns.config.bargeInMultiplier}.`}>
            floors {loop.voiceTurns.floorsRef.current.ambientRms.toFixed(3)}/{loop.voiceTurns.floorsRef.current.echoRms.toFixed(3)}
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
