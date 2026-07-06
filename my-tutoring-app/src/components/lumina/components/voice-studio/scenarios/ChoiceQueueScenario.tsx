'use client';

/**
 * Choice-queue scenario — voice CONTROL over a multi-problem surface.
 *
 * All the voice-control machinery (targeting, actuation levers, grading,
 * focus advance, engine wiring) lives in hooks/useVoiceChoice — this file is
 * exactly what a real primitive writes: items in, controller state painted
 * onto its own boards. Everything else here is studio bench apparatus
 * (config panels, the demo boards, trial reporting via the judge override).
 */

import React, { useCallback, useMemo, useState } from 'react';
import { LuminaButton, LuminaPanel, LuminaVoiceTarget } from '../../../ui';
import {
  useVoiceChoice,
  type SpokenChoiceVerdict,
  type VoiceChoiceContext,
} from '../../../hooks/useVoiceChoice';
import type { CapturedUtterance, VoiceJudgePass } from '../../../hooks/useVoiceCapture';
import { judgeForPass } from '../studioJudge';
import { DISTRACTOR_POOL, PRESET_WORDS, type StudioScenarioProps } from '../types';
import CaptureSurface from '../CaptureSurface';

const SCENARIO_ID = 'choice-queue';

const ChoiceQueueScenario: React.FC<StudioScenarioProps> = ({ config, recordTrial, reportUtterance }) => {
  const [targetWord, setTargetWord] = useState('map');
  const [customWord, setCustomWord] = useState('');
  const [distractors, setDistractors] = useState<string[]>(['mop', 'cat', 'sun']);
  const [customOption, setCustomOption] = useState('');

  const resolvedWord = (customWord.trim() || targetWord).toLowerCase();

  // Problem 1 is operator-configured; Problem 2 auto-builds from the
  // remaining pool. (A real primitive gets its items from generator content.)
  const items = useMemo(() => {
    const p1Options = Array.from(
      new Set([resolvedWord, ...distractors.filter((d) => d && d !== resolvedWord)]),
    ).sort();
    const exclude = new Set(p1Options);
    const answer2 =
      PRESET_WORDS.find((w) => !exclude.has(w)) ??
      PRESET_WORDS.find((w) => w !== resolvedWord) ??
      'sun';
    const opts2 = DISTRACTOR_POOL.filter((w) => w !== answer2 && !exclude.has(w)).slice(0, 3);
    return [
      { answer: resolvedWord, options: p1Options },
      { answer: answer2, options: Array.from(new Set([answer2, ...opts2])).sort() },
    ];
  }, [resolvedWord, distractors]);

  // Studio judge override: benched models + trial rows instead of the
  // production ladder. Primitives omit `judge` entirely.
  const configRef = React.useRef(config);
  configRef.current = config;
  const studioJudge = useCallback(
    async (utt: CapturedUtterance<VoiceChoiceContext>, pass: VoiceJudgePass): Promise<SpokenChoiceVerdict | null> => {
      const v = await judgeForPass(
        { kind: 'choice', options: utt.context.options, word: utt.context.answer },
        utt,
        pass,
        configRef.current,
        SCENARIO_ID,
        recordTrial,
      );
      return v ? { heard: v.heard, selectedOption: v.selectedOption ?? null, confidence: v.confidence } : null;
    },
    [recordTrial],
  );

  // ── The part a real primitive writes ───────────────────────────
  const choice = useVoiceChoice({
    items,
    modality: config.modality,
    actOn: config.actOn,
    voiceAction: config.voiceAction,
    autoStart: config.autoArm,
    judge: studioJudge,
    onVerdict: (verdict, utt) =>
      reportUtterance({
        utterance: utt,
        kind: { kind: 'choice', options: utt.context.options, word: utt.context.answer },
        scenario: SCENARIO_ID,
      }),
    armDelayMs: config.armDelayMs,
    cooldownMs: config.cooldownMs,
  });

  const addCustomOption = useCallback(() => {
    const w = customOption.trim().toLowerCase();
    if (!w) return;
    setDistractors((prev) => (prev.includes(w) ? prev : [...prev, w]));
    setCustomOption('');
  }, [customOption]);

  const listeningLabel = choice.allSolved
    ? 'All answered — still listening'
    : `Problem ${choice.focusIdx + 1}: say one of its options`;

  return (
    <div className="space-y-4">
      {/* Problem 1 config (studio apparatus) */}
      <LuminaPanel className="space-y-3">
        <p className="text-xs text-slate-500 uppercase tracking-wider">Problem 1 — correct answer</p>
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
        <p className="text-xs text-slate-500 uppercase tracking-wider pt-1">Problem 1 options (toggle distractors)</p>
        <div className="flex flex-wrap gap-2">
          {DISTRACTOR_POOL.filter((w) => w !== resolvedWord).map((w) => {
            const on = distractors.includes(w);
            return (
              <button
                key={w}
                onClick={() => setDistractors((prev) => (on ? prev.filter((d) => d !== w) : [...prev, w]))}
                className={`px-3 py-1.5 rounded-xl border text-sm font-semibold transition-all ${
                  on
                    ? 'bg-cyan-500/20 border-cyan-400/50 text-cyan-200'
                    : 'bg-slate-700/40 border-slate-500/30 text-slate-400 hover:bg-slate-600/40'
                }`}
              >
                {w}
              </button>
            );
          })}
          <input
            value={customOption}
            onChange={(e) => setCustomOption(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') addCustomOption(); }}
            placeholder="add distractor…"
            className="px-3 py-1.5 rounded-xl bg-white/5 border border-white/20 text-slate-200 text-sm w-32 focus:outline-none focus:border-cyan-400/50"
          />
        </div>
        <p className="text-xs text-slate-600">
          Include a minimal pair of the answer (e.g. mop vs map) to probe vowel discrimination.
          Problem 2 auto-builds from the remaining pool so the two boards differ.
        </p>
      </LuminaPanel>

      {/* The voice-controlled queue — painted from controller state */}
      <LuminaPanel className="text-center space-y-4 py-6">
        <div className="grid sm:grid-cols-2 gap-4 pt-2 pb-1 text-left">
          {items.map((p, i) => {
            const done = !!choice.answers[i]?.correct;
            const isFocus = i === choice.focusIdx && !choice.allSolved;
            return (
              <LuminaVoiceTarget
                key={`${p.answer}-${i}`}
                label={`Problem ${i + 1}`}
                active={isFocus}
                done={done}
                accent={config.modality === 'open' ? 'purple' : 'cyan'}
                onFocus={() => choice.focusItem(i)}
                activeHint={
                  choice.voice.state === 'recording'
                    ? 'hearing you…'
                    : choice.voice.state === 'armed'
                      ? 'listening…'
                      : 'targeted'
                }
              >
                <p className="text-xs text-slate-500 mb-2">
                  say <span className="font-bold text-slate-300">“{p.answer}”</span>
                </p>
                <div className="flex flex-wrap gap-2">
                  {p.options.map((w) => {
                    const isVoice = choice.highlight?.idx === i && choice.highlight.word === w;
                    const sub = choice.answers[i]?.word === w ? choice.answers[i] : null;
                    return (
                      <button
                        key={w}
                        onClick={(e) => { e.stopPropagation(); choice.tapOption(i, w); }}
                        className={`px-4 py-3 rounded-xl border-2 text-lg font-bold transition-all ${
                          sub
                            ? sub.correct
                              ? 'bg-emerald-500/25 border-emerald-400/60 text-emerald-100'
                              : 'bg-rose-500/20 border-rose-400/50 text-rose-200'
                            : isVoice
                              ? 'bg-cyan-500/20 border-cyan-400/60 text-cyan-100 ring-2 ring-cyan-300/40 animate-pulse'
                              : 'bg-slate-700/40 border-slate-500/30 text-slate-200 hover:bg-slate-600/40'
                        }`}
                      >
                        {isVoice && (
                          <span className="block text-[10px] uppercase tracking-wider text-cyan-300">🎙 heard</span>
                        )}
                        {w}
                      </button>
                    );
                  })}
                </div>
              </LuminaVoiceTarget>
            );
          })}
        </div>

        {choice.allSolved && (
          <div className="space-y-2">
            <p className="text-amber-300 text-sm">All problems answered! 🎉</p>
            <LuminaButton onClick={choice.reset}>↺ Play again</LuminaButton>
          </div>
        )}

        <CaptureSurface
          voice={choice.voice}
          modality={config.modality}
          idleLabel="Answer by voice"
          listeningLabel={listeningLabel}
          startLabel={config.modality === 'open' ? 'Open mic' : 'Start turn — answer the problems'}
          statusNote={choice.note}
        />
      </LuminaPanel>
    </div>
  );
};

export default ChoiceQueueScenario;
