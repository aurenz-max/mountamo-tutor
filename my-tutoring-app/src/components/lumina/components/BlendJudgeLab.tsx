'use client';

/**
 * Blend Judge Lab — dev spike for spoken phonics blending judgment.
 *
 * Tests the "truth channel" idea end-to-end WITHOUT touching Gemini Live or
 * PhonicsBlender: pick a target CVC word, say it into the mic, the lab
 * captures a bounded clip (RMS silence auto-stop), encodes 16kHz WAV, and
 * asks a micro-LLM judge "did the student say this word?" with a yes/no
 * schema. A model selector + re-judge button lets you bench models against
 * the SAME clip, and every trial lands in a history table.
 *
 * What this is meant to answer before any wiring:
 *   1. Is end-to-end latency acceptable for a discrete "say it!" beat?
 *   2. Does flash-lite / Gemma judge kid-style speech leniently but reject
 *      minimal-pair neighbors (mop ≠ map)?
 *   3. Do hosted Gemma endpoints accept audio + responseSchema at all?
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  LuminaCard,
  LuminaCardContent,
  LuminaCardHeader,
  LuminaCardTitle,
  LuminaBadge,
  LuminaButton,
  LuminaPanel,
} from '../ui';
import type { BlendJudgeVerdict } from '../service/literacy/gemini-blend-judge';
import { SoundManager } from '../utils/SoundManager';
import { encodeWav16kMono, bytesToBase64 } from '../utils/wavEncode';
import { AZURE_ENGINE, ESCALATION_MODEL } from '../utils/spokenWordJudge';

// ── Capture tuning ───────────────────────────────────────────────
const SPEECH_RMS_THRESHOLD = 0.015; // above = speech
// Two-tier endpointing (speculative dispatch): fire a first-pass judge on a
// snapshot at 250ms of silence while the mic keeps recording; close the full
// clip at 750ms. The first pass is accepted only if it's high-confidence AND
// no speech resumed after the snapshot — otherwise the full clip is judged.
// Net effect: the ack lands at 250ms and the verdict ~350-500ms earlier than
// single-pass endpointing, with the full clip as the safety net.
const SPECULATIVE_SILENCE_MS = 250; // snapshot + first-pass judge
const FULL_SILENCE_MS = 750;        // mic off, full clip closed
const MAX_CLIP_MS = 6000;           // hard cap
const ARM_TIMEOUT_MS = 8000;        // give up if no speech ever starts

const PRESET_WORDS = ['map', 'cat', 'sun', 'pig', 'bed', 'top', 'run', 'hat'];

// Bench 2026-07-04: flash-latest keeps trap accuracy at MINIMAL and drops to
// ~1.7-1.9s; 3.1-flash-lite NEEDS thinking (MINIMAL fails the mop/map trap).
const THINKING_LEVELS = ['MINIMAL', 'LOW', 'default'] as const;

// Bench 2026-07-04 (adult TTS clips): flash-latest correctly rejected the
// mop/map minimal pair; flash-lite false-positived on it (high confidence);
// hosted Gemma 4 returns "Audio input modality is not enabled for this model".
// "azure:*" routes to Pronunciation Assessment (scores, not an LLM) — thinking
// level is ignored on that lane.
//
// "auto:ladder" is the production shape: Azure first (~400ms); a low-confidence
// or errored Azure verdict escalates the clip to flash-latest for a second
// opinion from a DIFFERENT judge (re-asking Azure on the same audio just
// repeats the same answer). Fresh audio (speech resumed after the snapshot)
// re-enters at the Azure rung first.
const AUTO_LADDER = 'auto:ladder';
const PRESET_MODELS = [
  AUTO_LADDER,
  AZURE_ENGINE,
  'gemini-flash-latest',
  'gemini-flash-lite-latest',
  'gemma-4-26b-a4b-it',
];

type CaptureState = 'idle' | 'armed' | 'recording' | 'judging';

type JudgePass = 'spec' | 'full' | 'single' | 're-judge';

interface Trial {
  id: number;
  word: string;
  model: string;
  thinking: string;
  pass: JudgePass;
  verdict: BlendJudgeVerdict | null;
  error?: string;
  totalLatencyMs: number;
  clipUrl: string;
  clipMs: number;
}

interface Clip {
  base64: string;
  url: string;
  ms: number;
  word: string;
}

// ── Component ────────────────────────────────────────────────────

interface BlendJudgeLabProps {
  onBack: () => void;
}

const BlendJudgeLab: React.FC<BlendJudgeLabProps> = ({ onBack }) => {
  const [targetWord, setTargetWord] = useState('map');
  const [customWord, setCustomWord] = useState('');
  const [model, setModel] = useState(PRESET_MODELS[0]);
  const [customModel, setCustomModel] = useState('');
  const [thinking, setThinking] = useState<string>(THINKING_LEVELS[0]);
  const [captureState, setCaptureState] = useState<CaptureState>('idle');
  const [level, setLevel] = useState(0);
  const [trials, setTrials] = useState<Trial[]>([]);
  const [lastClip, setLastClip] = useState<Clip | null>(null);
  const [statusNote, setStatusNote] = useState('');

  // Live audio plumbing (refs — none of this should re-render)
  const audioCtxRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const chunksRef = useRef<Float32Array[]>([]);
  const speechStartedRef = useRef(false);
  const lastSpeechAtRef = useRef(0);
  const recordStartedAtRef = useRef(0);
  const stopTimerRef = useRef<number | null>(null);
  const trialIdRef = useRef(1);
  // Speculative first-pass coordination
  const specFiredRef = useRef(false);
  const speechAfterSpecRef = useRef(false);
  const specPromiseRef = useRef<Promise<BlendJudgeVerdict | null> | null>(null);

  const resolvedModel = customModel.trim() || model;
  const resolvedWord = (customWord.trim() || targetWord).toLowerCase();

  const teardownAudio = useCallback(() => {
    // Mic-only teardown — the processing pulse must SURVIVE this (it plays
    // while the judge runs after the mic is already off). The unmount effect
    // below stops the pulse separately.
    processorRef.current?.disconnect();
    processorRef.current = null;
    sourceRef.current?.disconnect();
    sourceRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') {
      audioCtxRef.current.close().catch(() => {});
    }
    audioCtxRef.current = null;
    if (stopTimerRef.current !== null) {
      window.clearTimeout(stopTimerRef.current);
      stopTimerRef.current = null;
    }
    setLevel(0);
  }, []);

  useEffect(
    () => () => {
      teardownAudio();
      SoundManager.stopProcessing(); // never let the pulse outlive the panel
    },
    [teardownAudio],
  );

  // ── Judge call ─────────────────────────────────────────────────
  // Pure judge call: records the trial and returns the verdict (null on
  // error). No sounds and no capture-state changes — the orchestration
  // decides which verdict is FINAL, and only that one gets feedback audio.
  const runJudge = useCallback(
    async (clip: Clip, judgeModel: string, thinkingLevel: string, pass: JudgePass): Promise<BlendJudgeVerdict | null> => {
      const started = Date.now();
      const trialId = trialIdRef.current++;
      try {
        const res = await fetch('/api/lumina', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'judgeBlendAudio',
            params: {
              audioBase64: clip.base64,
              mimeType: 'audio/wav',
              targetWord: clip.word,
              gradeLevel: 'Kindergarten',
              model: judgeModel,
              thinkingLevel,
            },
          }),
        });
        if (!res.ok) {
          const body = await res.text();
          throw new Error(`HTTP ${res.status}: ${body.slice(0, 300)}`);
        }
        const verdict = (await res.json()) as BlendJudgeVerdict;
        setTrials((prev) => [
          {
            id: trialId,
            word: clip.word,
            model: judgeModel,
            thinking: thinkingLevel,
            pass,
            verdict,
            totalLatencyMs: Date.now() - started,
            clipUrl: clip.url,
            clipMs: clip.ms,
          },
          ...prev,
        ]);
        return verdict;
      } catch (err) {
        setTrials((prev) => [
          {
            id: trialId,
            word: clip.word,
            model: judgeModel,
            thinking: thinkingLevel,
            pass,
            verdict: null,
            error: err instanceof Error ? err.message : String(err),
            totalLatencyMs: Date.now() - started,
            clipUrl: clip.url,
            clipMs: clip.ms,
          },
          ...prev,
        ]);
        return null;
      }
    },
    [],
  );

  // The FINAL verdict lands: stop the pulse, play feedback, return to idle.
  const settle = useCallback((verdict: BlendJudgeVerdict | null) => {
    SoundManager.stopProcessing();
    if (!verdict) SoundManager.invalid();
    else if (verdict.isMatch) SoundManager.playCorrect();
    else SoundManager.playIncorrect();
    setCaptureState('idle');
    setStatusNote('');
  }, []);

  // Azure-first ladder: escalate to the LLM only when Azure is unsure or
  // errored. Used by auto:ladder mode for full clips and re-judges.
  const judgeWithLadder = useCallback(
    async (clip: Clip, pass: JudgePass): Promise<BlendJudgeVerdict | null> => {
      const azureVerdict = await runJudge(clip, AZURE_ENGINE, thinking, pass);
      if (azureVerdict && azureVerdict.confidence === 'high') return azureVerdict;
      setStatusNote('Azure unsure — escalating to Gemini…');
      return runJudge(clip, ESCALATION_MODEL, thinking, pass);
    },
    [runJudge, thinking],
  );

  // Speculative first pass: snapshot the audio so far, ack + pulse, and fire
  // the judge while the mic keeps recording. Called from the audio callback
  // via ref so it always sees fresh word/model/thinking.
  const dispatchSpeculative = useCallback(() => {
    const snapshot = chunksRef.current.slice();
    const rate = audioCtxRef.current?.sampleRate ?? 48000;
    SoundManager.snap();            // "heard you" at ~250ms after speech ends
    SoundManager.startProcessing(); // thinking pulse until the FINAL verdict
    const { bytes, durationMs } = encodeWav16kMono(snapshot, rate);
    const clip: Clip = {
      base64: bytesToBase64(bytes),
      url: URL.createObjectURL(new Blob([bytes.buffer as ArrayBuffer], { type: 'audio/wav' })),
      ms: durationMs,
      word: resolvedWord,
    };
    // In ladder mode the speculative pass rides the fast Azure lane.
    const engine = resolvedModel === AUTO_LADDER ? AZURE_ENGINE : resolvedModel;
    specPromiseRef.current = runJudge(clip, engine, thinking, 'spec');
  }, [resolvedWord, resolvedModel, thinking, runJudge]);

  const dispatchSpeculativeRef = useRef(dispatchSpeculative);
  dispatchSpeculativeRef.current = dispatchSpeculative;

  // ── Capture ────────────────────────────────────────────────────
  const finishRecording = useCallback(() => {
    const ctx = audioCtxRef.current;
    const chunks = chunksRef.current;
    const sourceRate = ctx?.sampleRate ?? 48000;
    const hadSpeech = speechStartedRef.current;
    teardownAudio();

    if (!hadSpeech || chunks.length === 0) {
      SoundManager.invalid();
      setCaptureState('idle');
      setStatusNote('No speech detected — try again closer to the mic.');
      return;
    }

    const { bytes, durationMs } = encodeWav16kMono(chunks, sourceRate);
    chunksRef.current = [];
    const base64 = bytesToBase64(bytes);
    const url = URL.createObjectURL(new Blob([bytes.buffer as ArrayBuffer], { type: 'audio/wav' }));
    const fullClip: Clip = { base64, url, ms: durationMs, word: resolvedWord };
    setLastClip(fullClip);
    setCaptureState('judging');

    // Arbitrate: prefer the speculative first pass; fall back to the full clip.
    const isLadder = resolvedModel === AUTO_LADDER;
    void (async () => {
      let superseded = false;
      if (specPromiseRef.current) {
        setStatusNote('Waiting on first pass…');
        const specVerdict = await specPromiseRef.current;
        specPromiseRef.current = null;
        superseded = speechAfterSpecRef.current;
        if (!superseded && specVerdict && specVerdict.confidence === 'high') {
          settle(specVerdict); // fast path — full clip never judged
          return;
        }
        if (isLadder && !superseded) {
          // Same audio, Azure already unsure — re-asking Azure repeats the
          // same answer. Straight to the LLM tie-break on the full clip.
          setStatusNote('Azure unsure — escalating to Gemini…');
          settle(await runJudge(fullClip, ESCALATION_MODEL, thinking, 'full'));
          return;
        }
        setStatusNote(
          superseded
            ? 'More speech arrived — judging the full clip…'
            : 'First pass unclear — judging the full clip…',
        );
      } else {
        // Speculative never fired (hard cap mid-speech) — ack + pulse now.
        SoundManager.snap();
        SoundManager.startProcessing();
        setStatusNote('Judging…');
      }
      // Fresh audio (or single-pass): ladder mode re-enters at the Azure rung.
      const pass: JudgePass = specFiredRef.current ? 'full' : 'single';
      if (isLadder) {
        settle(await judgeWithLadder(fullClip, pass));
      } else {
        settle(await runJudge(fullClip, resolvedModel, thinking, pass));
      }
    })();
  }, [teardownAudio, resolvedWord, resolvedModel, thinking, runJudge, judgeWithLadder, settle]);

  const finishRecordingRef = useRef(finishRecording);
  finishRecordingRef.current = finishRecording;

  const startCapture = useCallback(async () => {
    if (captureState !== 'idle') return;
    setStatusNote('');
    chunksRef.current = [];
    speechStartedRef.current = false;
    lastSpeechAtRef.current = 0;
    recordStartedAtRef.current = Date.now();
    specFiredRef.current = false;
    speechAfterSpecRef.current = false;
    specPromiseRef.current = null;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      const ctx = new AudioContext();
      const source = ctx.createMediaStreamSource(stream);
      const processor = ctx.createScriptProcessor(4096, 1, 1);

      streamRef.current = stream;
      audioCtxRef.current = ctx;
      sourceRef.current = source;
      processorRef.current = processor;

      processor.onaudioprocess = (event) => {
        const data = event.inputBuffer.getChannelData(0);
        chunksRef.current.push(new Float32Array(data));

        let sum = 0;
        for (let i = 0; i < data.length; i++) sum += data[i] * data[i];
        const rms = Math.sqrt(sum / data.length);
        setLevel(rms);

        const now = Date.now();
        if (rms > SPEECH_RMS_THRESHOLD) {
          if (!speechStartedRef.current) {
            speechStartedRef.current = true;
            setCaptureState('recording');
          }
          // Speech after the speculative snapshot supersedes the first pass
          // (e.g. sounding out "m…a…p… map" — the snapshot missed the word).
          if (specFiredRef.current) speechAfterSpecRef.current = true;
          lastSpeechAtRef.current = now;
        }

        const elapsed = now - recordStartedAtRef.current;
        const silentFor = speechStartedRef.current ? now - lastSpeechAtRef.current : 0;

        // First pass: judge a snapshot early while the mic keeps rolling.
        if (speechStartedRef.current && !specFiredRef.current && silentFor >= SPECULATIVE_SILENCE_MS) {
          specFiredRef.current = true;
          dispatchSpeculativeRef.current();
        }

        if (
          elapsed >= MAX_CLIP_MS ||
          (speechStartedRef.current && silentFor >= FULL_SILENCE_MS) ||
          (!speechStartedRef.current && elapsed >= ARM_TIMEOUT_MS)
        ) {
          finishRecordingRef.current();
        }
      };

      source.connect(processor);
      processor.connect(ctx.destination);
      setCaptureState('armed');
    } catch (err) {
      teardownAudio();
      setCaptureState('idle');
      setStatusNote(`Mic unavailable: ${err instanceof Error ? err.message : String(err)}`);
    }
  }, [captureState, teardownAudio]);

  const cancelCapture = useCallback(() => {
    chunksRef.current = [];
    speechStartedRef.current = false;
    specPromiseRef.current = null; // orphan any in-flight first pass
    SoundManager.stopProcessing();
    teardownAudio();
    setCaptureState('idle');
    setStatusNote('');
  }, [teardownAudio]);

  // ── Render ─────────────────────────────────────────────────────
  const isCapturing = captureState === 'armed' || captureState === 'recording';
  const levelPct = Math.min(100, Math.round((level / 0.12) * 100));

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-2 px-4 py-2 bg-slate-800/50 hover:bg-slate-700/50 text-white rounded-full border border-slate-600 transition-all text-sm"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Back
        </button>
        <LuminaBadge className="text-xs">dev spike — not wired to any primitive</LuminaBadge>
      </div>

      <LuminaCard>
        <LuminaCardHeader>
          <LuminaCardTitle className="text-lg">🎙️ Blend Judge Lab</LuminaCardTitle>
          <p className="text-slate-400 text-sm">
            Say the target word aloud. A speculative first pass fires at ~250ms of silence (snap =
            &ldquo;heard you&rdquo;, pulse = judging) while the mic keeps rolling; if the first pass errors, is
            unclear, or you keep talking, the full clip is judged instead. Try minimal pairs (say
            &ldquo;mop&rdquo; when the target is &ldquo;map&rdquo;) and slow sounding-out (&ldquo;m… a… p… map&rdquo;) to probe both paths.
          </p>
        </LuminaCardHeader>
        <LuminaCardContent className="space-y-4">
          {/* Target word */}
          <LuminaPanel className="space-y-3">
            <p className="text-xs text-slate-500 uppercase tracking-wider">Target word</p>
            <div className="flex flex-wrap gap-2">
              {PRESET_WORDS.map((w) => (
                <button
                  key={w}
                  onClick={() => { setTargetWord(w); setCustomWord(''); }}
                  className={`px-4 py-2 rounded-xl border-2 font-bold transition-all ${
                    resolvedWord === w
                      ? 'bg-emerald-500/20 border-emerald-400/50 text-emerald-200'
                      : 'bg-slate-700/40 border-slate-500/30 text-slate-300 hover:bg-slate-600/40'
                  }`}
                >
                  {w}
                </button>
              ))}
              <input
                value={customWord}
                onChange={(e) => setCustomWord(e.target.value)}
                placeholder="custom…"
                className="px-3 py-2 rounded-xl bg-white/5 border border-white/20 text-slate-200 text-sm w-28 focus:outline-none focus:border-emerald-400/50"
              />
            </div>
          </LuminaPanel>

          {/* Model */}
          <LuminaPanel className="space-y-3">
            <p className="text-xs text-slate-500 uppercase tracking-wider">Judge model</p>
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={model}
                onChange={(e) => { setModel(e.target.value); setCustomModel(''); }}
                className="px-3 py-2 rounded-xl bg-slate-800 border border-white/20 text-slate-200 text-sm focus:outline-none"
              >
                {PRESET_MODELS.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
              <input
                value={customModel}
                onChange={(e) => setCustomModel(e.target.value)}
                placeholder="or custom model id…"
                className="px-3 py-2 rounded-xl bg-white/5 border border-white/20 text-slate-200 text-sm w-56 focus:outline-none focus:border-emerald-400/50"
              />
              <label className="flex items-center gap-1.5 text-xs text-slate-500">
                thinking
                <select
                  value={thinking}
                  onChange={(e) => setThinking(e.target.value)}
                  className="px-2 py-2 rounded-xl bg-slate-800 border border-white/20 text-slate-200 text-sm focus:outline-none"
                >
                  {THINKING_LEVELS.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </label>
              <span className="text-xs text-slate-500">
                using <span className="text-slate-300 font-mono">{resolvedModel}</span>
              </span>
            </div>
          </LuminaPanel>

          {/* Capture controls */}
          <LuminaPanel className="text-center space-y-4 py-6">
            {!isCapturing && captureState !== 'judging' && (
              <LuminaButton tone="primary" onClick={startCapture} className="text-lg px-8 py-3">
                🎙️ Say &ldquo;{resolvedWord}&rdquo;
              </LuminaButton>
            )}

            {isCapturing && (
              <div className="space-y-3">
                <p className={`font-semibold ${captureState === 'recording' ? 'text-emerald-300' : 'text-amber-300 animate-pulse'}`}>
                  {captureState === 'recording' ? 'Listening… (stops on silence)' : 'Waiting for you to speak…'}
                </p>
                {/* Level meter */}
                <div className="max-w-xs mx-auto h-2.5 rounded-full bg-white/5 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-75 ${level > SPEECH_RMS_THRESHOLD ? 'bg-emerald-500' : 'bg-slate-500'}`}
                    style={{ width: `${levelPct}%` }}
                  />
                </div>
                <LuminaButton onClick={cancelCapture}>Cancel</LuminaButton>
              </div>
            )}

            {captureState === 'judging' && (
              <p className="text-blue-300 animate-pulse font-semibold">{statusNote || 'Judging…'}</p>
            )}

            {statusNote && captureState === 'idle' && (
              <p className="text-amber-300 text-sm">{statusNote}</p>
            )}

            {lastClip && captureState === 'idle' && (
              <div className="flex items-center justify-center gap-3 pt-1">
                <audio controls src={lastClip.url} className="h-9" />
                <LuminaButton
                  onClick={() => {
                    setCaptureState('judging');
                    setStatusNote(`Judging with ${resolvedModel}…`);
                    SoundManager.startProcessing();
                    const clip = { ...lastClip, word: resolvedWord };
                    void (resolvedModel === AUTO_LADDER
                      ? judgeWithLadder(clip, 're-judge')
                      : runJudge(clip, resolvedModel, thinking, 're-judge')
                    ).then(settle);
                  }}
                >
                  Re-judge clip with {resolvedModel.length > 24 ? `${resolvedModel.slice(0, 24)}…` : resolvedModel}
                </LuminaButton>
              </div>
            )}
          </LuminaPanel>

          {/* Trials */}
          {trials.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs text-slate-500 uppercase tracking-wider">Trials ({trials.length})</p>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-slate-500 border-b border-white/10">
                      <th className="py-2 pr-3">Target</th>
                      <th className="py-2 pr-3">Model</th>
                      <th className="py-2 pr-3">Heard</th>
                      <th className="py-2 pr-3">Verdict</th>
                      <th className="py-2 pr-3">Conf.</th>
                      <th className="py-2 pr-3">Latency</th>
                      <th className="py-2 pr-3">Clip</th>
                      <th className="py-2">Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {trials.map((t) => (
                      <tr key={t.id} className="border-b border-white/5 align-top">
                        <td className="py-2 pr-3 font-bold text-slate-200">{t.word}</td>
                        <td className="py-2 pr-3 font-mono text-xs text-slate-400">
                          {t.model}
                          <span className="block text-slate-600">thinking: {t.thinking} · {t.pass}</span>
                          {t.verdict?.usedSchemaFallback && (
                            <span className="block text-amber-400">schema fallback</span>
                          )}
                        </td>
                        <td className="py-2 pr-3 text-slate-300">{t.verdict ? `“${t.verdict.heard}”` : '—'}</td>
                        <td className="py-2 pr-3">
                          {t.error ? (
                            <LuminaBadge accent="rose" className="text-xs">error</LuminaBadge>
                          ) : t.verdict?.isMatch ? (
                            <LuminaBadge accent="emerald" className="text-xs">match</LuminaBadge>
                          ) : (
                            <LuminaBadge accent="amber" className="text-xs">no match</LuminaBadge>
                          )}
                        </td>
                        <td className="py-2 pr-3 text-slate-400">{t.verdict?.confidence ?? '—'}</td>
                        <td className="py-2 pr-3 text-slate-400">
                          {(t.totalLatencyMs / 1000).toFixed(1)}s
                          {t.verdict && (
                            <span className="block text-xs text-slate-600">
                              judge {(t.verdict.judgeLatencyMs / 1000).toFixed(1)}s
                            </span>
                          )}
                        </td>
                        <td className="py-2 pr-3 text-slate-500 text-xs">
                          <audio controls src={t.clipUrl} className="h-7 w-32" />
                          <span className="block">{(t.clipMs / 1000).toFixed(1)}s</span>
                        </td>
                        <td className="py-2 text-xs text-slate-500 max-w-[16rem]">
                          {t.error ? <span className="text-rose-400">{t.error}</span> : t.verdict?.reasoning}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </LuminaCardContent>
      </LuminaCard>
    </div>
  );
};

export default BlendJudgeLab;
