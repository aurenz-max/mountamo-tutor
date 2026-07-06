'use client';

/**
 * Voice Studio — the plug-and-play design bench for spoken interaction.
 *
 * Shell responsibilities (content-agnostic):
 *  - scenario picker (registry in scenarios/index.ts — one entry per bench)
 *  - shared config panels: capture modality (+legacy turn tunables +
 *    auto-arm), control levers, judge model
 *  - re-judge bar for the last captured clip (bench models against the SAME
 *    audio) + the shared trials table with timing instrumentation
 *  - SPEC EXPORT: copies the tuned configuration as JSON — the handoff
 *    artifact from a studio session into a primitive build
 *
 * Scenarios own their surface + judge wiring and consume useVoiceCapture
 * exactly like a primitive would — the studio dogfoods the graduation path.
 * Scenario/modality switches remount the scenario (engine treats modality
 * as fixed per mount).
 */

import React, { useCallback, useRef, useState } from 'react';
import {
  LuminaCard,
  LuminaCardContent,
  LuminaCardHeader,
  LuminaCardTitle,
  LuminaBadge,
  LuminaButton,
  LuminaPanel,
  LuminaVoiceToggle,
} from '../../ui';
import { SoundManager } from '../../utils/SoundManager';
import { useAutoListenEnabled } from '../../utils/voiceMode';
import {
  useMicPermission,
  SPECULATIVE_SILENCE_MS,
  FULL_SILENCE_MS,
  MAX_CLIP_MS,
  PRE_ROLL_FRAMES,
  EARLY_ONSET_MS,
  OPEN_IDLE_CLOSE_MS,
  DEFAULT_ARM_DELAY_MS,
  DEFAULT_COOLDOWN_MS,
  type VoiceModality,
} from '../../hooks/useVoiceCapture';
import { ESCALATION_MODEL } from '../../utils/spokenWordJudge';
import { rejudgeClip } from './studioJudge';
import { STUDIO_SCENARIOS } from './scenarios';
import {
  AUTO_LADDER,
  PRESET_MODELS,
  THINKING_LEVELS,
  type LastUtterance,
  type StudioConfig,
  type Trial,
} from './types';

// Order = doctrine. Open mic won the bench (user ruling 2026-07-05): no
// windows, no re-arm taps, silence is free. Turn loop = legacy comparison.
const MODALITIES: Array<{ id: VoiceModality; label: string; blurb: string }> = [
  {
    id: 'open',
    label: 'Open mic ★',
    blurb: 'The native shape: mic stays hot; utterances segmented + judged while it keeps listening.',
  },
  {
    id: 'ptt',
    label: 'Push to talk',
    blurb: 'Tap per attempt. Cold mic open every time — watch the open/onset columns.',
  },
  {
    id: 'turn',
    label: 'Turn loop (legacy)',
    blurb: 'useSpokenTurn v2 window shape, kept to bench against open mic.',
  },
];

interface VoiceStudioProps {
  onBack: () => void;
}

const VoiceStudio: React.FC<VoiceStudioProps> = ({ onBack }) => {
  const [scenarioId, setScenarioId] = useState(STUDIO_SCENARIOS[0].id);
  const [config, setConfig] = useState<StudioConfig>({
    modality: 'open',
    autoArm: false,
    model: AUTO_LADDER,
    thinking: THINKING_LEVELS[0],
    actOn: 'high',
    voiceAction: 'submit',
    armDelayMs: DEFAULT_ARM_DELAY_MS,
    cooldownMs: DEFAULT_COOLDOWN_MS,
  });
  const [customModel, setCustomModel] = useState('');
  const [trials, setTrials] = useState<Trial[]>([]);
  const [lastUtt, setLastUtt] = useState<LastUtterance | null>(null);
  const [rejudging, setRejudging] = useState(false);
  const [specCopied, setSpecCopied] = useState(false);

  const micPermission = useMicPermission();
  const autoListenEnabled = useAutoListenEnabled();
  const trialIdRef = useRef(1);

  const resolvedModel = customModel.trim() || config.model;
  const effectiveConfig: StudioConfig = { ...config, model: resolvedModel };

  const scenario = STUDIO_SCENARIOS.find((s) => s.id === scenarioId) ?? STUDIO_SCENARIOS[0];

  const patch = useCallback((p: Partial<StudioConfig>) => {
    setConfig((prev) => ({ ...prev, ...p }));
  }, []);

  const recordTrial = useCallback((t: Omit<Trial, 'id'>) => {
    setTrials((prev) => [{ ...t, id: trialIdRef.current++ }, ...prev]);
  }, []);

  const reportUtterance = useCallback((last: LastUtterance) => {
    setLastUtt(last);
  }, []);

  const rejudge = useCallback(() => {
    if (!lastUtt || rejudging) return;
    setRejudging(true);
    SoundManager.startProcessing();
    void rejudgeClip(lastUtt.kind, lastUtt.utterance, effectiveConfig, lastUtt.scenario, recordTrial)
      .finally(() => {
        SoundManager.stopProcessing();
        setRejudging(false);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastUtt, rejudging, resolvedModel, config.thinking, recordTrial]);

  // The handoff artifact: everything a primitive needs to reproduce the
  // configuration tuned in this session.
  const copySpec = useCallback(() => {
    const spec = {
      version: 1,
      capture: {
        modality: config.modality,
        autoArm: config.autoArm,
        endpointing: {
          speculativeSilenceMs: SPECULATIVE_SILENCE_MS,
          fullSilenceMs: FULL_SILENCE_MS,
          maxClipMs: MAX_CLIP_MS,
          preRollFrames: PRE_ROLL_FRAMES,
        },
        cue: { openingState: true, earconOnFirstFrame: true, earlyOnsetMs: EARLY_ONSET_MS },
        openIdleCloseMs: OPEN_IDLE_CLOSE_MS,
        turnLegacy: { armDelayMs: config.armDelayMs, cooldownMs: config.cooldownMs },
      },
      judge: {
        model: resolvedModel,
        thinking: config.thinking,
        escalation: ESCALATION_MODEL,
      },
      control: {
        actOn: config.actOn,
        voiceAction: config.voiceAction,
        lowConfidenceDegradesToHighlight: true,
      },
      scenario: scenarioId,
    };
    void navigator.clipboard?.writeText(JSON.stringify(spec, null, 2)).then(() => {
      setSpecCopied(true);
      window.setTimeout(() => setSpecCopied(false), 2000);
    });
  }, [config, resolvedModel, scenarioId]);

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
        <LuminaBadge className="text-xs">design studio — scenarios are plug-ins</LuminaBadge>
      </div>

      <LuminaCard>
        <LuminaCardHeader>
          <div className="flex items-center justify-between gap-3">
            <LuminaCardTitle className="text-lg">🎛️ Voice Studio</LuminaCardTitle>
            <div className="flex items-center gap-2">
              {/* The session-level kill switch, exactly as a lesson/Pulse navbar would mount it */}
              <LuminaVoiceToggle />
              <LuminaButton onClick={copySpec}>{specCopied ? '✓ Spec copied' : '📋 Copy spec'}</LuminaButton>
            </div>
          </div>
          <p className="text-slate-400 text-sm">
            Plug-and-play bench for spoken interaction: pick a scenario (a plug-in component), tune
            capture modality + control levers + judge, and export the spec as JSON when it feels
            right. The engine under every scenario is <span className="font-mono text-slate-300">useVoiceCapture</span> —
            the same hook primitives graduate onto.
          </p>
        </LuminaCardHeader>
        <LuminaCardContent className="space-y-4">
          {/* Scenario */}
          <LuminaPanel className="space-y-3">
            <p className="text-xs text-slate-500 uppercase tracking-wider">Scenario — what the voice means</p>
            <div className="grid sm:grid-cols-2 gap-2">
              {STUDIO_SCENARIOS.map((s) => (
                <button
                  key={s.id}
                  onClick={() => setScenarioId(s.id)}
                  className={`px-3 py-2 rounded-xl border-2 text-left transition-all ${
                    scenarioId === s.id
                      ? 'bg-emerald-500/20 border-emerald-400/50'
                      : 'bg-slate-700/40 border-slate-500/30 hover:bg-slate-600/40'
                  }`}
                >
                  <span className={`font-bold block text-sm ${scenarioId === s.id ? 'text-emerald-200' : 'text-slate-200'}`}>
                    {s.label}
                  </span>
                  <span className="text-xs text-slate-400">{s.blurb}</span>
                </button>
              ))}
            </div>
          </LuminaPanel>

          {/* Capture modality */}
          <LuminaPanel className="space-y-3">
            <p className="text-xs text-slate-500 uppercase tracking-wider">Capture modality — when the mic listens</p>
            <div className="grid sm:grid-cols-3 gap-2">
              {MODALITIES.map((m) => (
                <button
                  key={m.id}
                  onClick={() => patch({ modality: m.id })}
                  className={`px-3 py-2 rounded-xl border-2 text-left transition-all ${
                    config.modality === m.id
                      ? 'bg-emerald-500/20 border-emerald-400/50'
                      : 'bg-slate-700/40 border-slate-500/30 hover:bg-slate-600/40'
                  }`}
                >
                  <span className={`font-bold block text-sm ${config.modality === m.id ? 'text-emerald-200' : 'text-slate-200'}`}>
                    {m.label}
                  </span>
                  <span className="text-xs text-slate-400">{m.blurb}</span>
                </button>
              ))}
            </div>
            {config.modality === 'turn' && (
              <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500">
                <label className="flex items-center gap-1.5">
                  arm delay
                  <input
                    type="number"
                    min={0}
                    step={100}
                    value={config.armDelayMs}
                    onChange={(e) => patch({ armDelayMs: Math.max(0, Number(e.target.value) || 0) })}
                    className="w-20 px-2 py-1 rounded-lg bg-white/5 border border-white/20 text-slate-200 focus:outline-none focus:border-emerald-400/50"
                  />
                  ms
                </label>
                <label className="flex items-center gap-1.5">
                  re-arm cooldown
                  <input
                    type="number"
                    min={0}
                    step={100}
                    value={config.cooldownMs}
                    onChange={(e) => patch({ cooldownMs: Math.max(0, Number(e.target.value) || 0) })}
                    className="w-20 px-2 py-1 rounded-lg bg-white/5 border border-white/20 text-slate-200 focus:outline-none focus:border-emerald-400/50"
                  />
                  ms
                </label>
                <span>legacy shape — bench against open mic</span>
              </div>
            )}
            {config.modality !== 'ptt' && (
              <div className="flex flex-wrap items-center gap-3 pt-1">
                <button
                  onClick={() => patch({ autoArm: !config.autoArm })}
                  className={`px-3 py-1.5 rounded-lg border text-xs font-semibold transition-all ${
                    config.autoArm
                      ? 'bg-emerald-500/20 border-emerald-400/50 text-emerald-200'
                      : 'bg-slate-700/40 border-slate-500/30 text-slate-400 hover:bg-slate-600/40'
                  }`}
                >
                  ⚡ auto-arm {config.autoArm ? 'ON' : 'off'}
                </button>
                <span className="text-xs text-slate-600">
                  no button: the mic opens itself on every activation.{' '}
                  {!autoListenEnabled
                    ? 'Suspended — global auto-listen is OFF (navbar chip / Ctrl+M).'
                    : micPermission === 'granted'
                      ? 'Mic permission granted ✓'
                      : micPermission === 'denied'
                        ? 'Mic permission DENIED — allow it in the browser first.'
                        : 'Start once by hand to grant the mic — auto-arm takes over from then on.'}
                </span>
              </div>
            )}
          </LuminaPanel>

          {/* Control levers */}
          <LuminaPanel className="space-y-2">
            <p className="text-xs text-slate-500 uppercase tracking-wider">Control levers — how voice actuates</p>
            <div className="flex flex-wrap items-center gap-6">
              <div className="flex items-center gap-2 text-xs">
                <span className="text-slate-500 uppercase tracking-wider">voice acts on</span>
                {(['high', 'any'] as const).map((v) => (
                  <button
                    key={v}
                    onClick={() => patch({ actOn: v })}
                    className={`px-3 py-1.5 rounded-lg border font-semibold transition-all ${
                      config.actOn === v
                        ? 'bg-emerald-500/20 border-emerald-400/50 text-emerald-200'
                        : 'bg-slate-700/40 border-slate-500/30 text-slate-400 hover:bg-slate-600/40'
                    }`}
                  >
                    {v === 'high' ? 'high confidence' : 'any match'}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-2 text-xs">
                <span className="text-slate-500 uppercase tracking-wider">voice action</span>
                {(['submit', 'highlight'] as const).map((v) => (
                  <button
                    key={v}
                    onClick={() => patch({ voiceAction: v })}
                    className={`px-3 py-1.5 rounded-lg border font-semibold transition-all ${
                      config.voiceAction === v
                        ? 'bg-emerald-500/20 border-emerald-400/50 text-emerald-200'
                        : 'bg-slate-700/40 border-slate-500/30 text-slate-400 hover:bg-slate-600/40'
                    }`}
                  >
                    {v === 'submit' ? 'submit answer' : 'highlight — tap confirms'}
                  </button>
                ))}
              </div>
            </div>
            <p className="text-xs text-slate-600">
              Consumed by control scenarios (spoken choice). Low confidence under &ldquo;high&rdquo; degrades
              submit → highlight — voice never silently does nothing when something was heard.
            </p>
          </LuminaPanel>

          {/* Judge model */}
          <LuminaPanel className="space-y-3">
            <p className="text-xs text-slate-500 uppercase tracking-wider">Judge model</p>
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={config.model}
                onChange={(e) => { patch({ model: e.target.value }); setCustomModel(''); }}
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
                  value={config.thinking}
                  onChange={(e) => patch({ thinking: e.target.value })}
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

          {/* The plugged scenario (remounts on scenario/modality switch) */}
          <scenario.Component
            key={`${scenario.id}:${config.modality}`}
            config={effectiveConfig}
            recordTrial={recordTrial}
            reportUtterance={reportUtterance}
          />

          {/* Re-judge the last clip against the current model config */}
          {lastUtt && (
            <LuminaPanel className="flex flex-wrap items-center justify-center gap-3 py-3">
              <audio controls src={lastUtt.utterance.url} className="h-9" />
              <LuminaButton onClick={rejudge} disabled={rejudging}>
                {rejudging
                  ? 'Re-judging…'
                  : `Re-judge last clip with ${resolvedModel.length > 24 ? `${resolvedModel.slice(0, 24)}…` : resolvedModel}`}
              </LuminaButton>
            </LuminaPanel>
          )}

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
                          <span className="block text-slate-600">
                            thinking: {t.thinking} · {t.pass} · {t.modality} · {t.scenario}
                          </span>
                          {t.verdict?.usedSchemaFallback && (
                            <span className="block text-amber-400">schema fallback</span>
                          )}
                        </td>
                        <td className="py-2 pr-3 text-slate-300">{t.verdict ? `“${t.verdict.heard}”` : '—'}</td>
                        <td className="py-2 pr-3">
                          {t.error ? (
                            <LuminaBadge accent="rose" className="text-xs">error</LuminaBadge>
                          ) : t.verdict?.selectedOption !== undefined ? (
                            t.verdict?.selectedOption ? (
                              <LuminaBadge accent={t.verdict.isMatch ? 'emerald' : 'amber'} className="text-xs">
                                → {t.verdict.selectedOption}
                              </LuminaBadge>
                            ) : (
                              <LuminaBadge accent="rose" className="text-xs">no option</LuminaBadge>
                            )
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
                          {t.timing.micOpenMs !== null && (
                            <span className="block text-xs text-slate-600">
                              open {t.timing.micOpenMs}ms
                              {t.timing.onsetMs !== null ? ` · onset ${t.timing.onsetMs}ms` : ''}
                            </span>
                          )}
                          {t.timing.earlyOnset && (
                            <span className="block text-xs text-amber-400">⚠ early onset</span>
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

export default VoiceStudio;
