'use client';

/**
 * Choice-queue scenario — voice CONTROL over a multi-problem surface.
 *
 * Two problems, each a board of spoken options, wrapped in LuminaVoiceTarget
 * frames (MMO-style targeting): exactly one problem holds the voice focus;
 * saying an option answers it; correct → focus advances to the next unsolved
 * problem. Tap a frame to re-target, tap an option to answer directly —
 * voice and tap actuate the same controls.
 *
 * Control policy (from studio config levers):
 *  - actOn 'high': low-confidence selections DEGRADE to highlight + confirm
 *  - voiceAction 'highlight': voice only arms the option; a tap submits
 * Verdicts actuate the problem frozen into the utterance at capture time,
 * so a late verdict never lands on the wrong board.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { LuminaButton, LuminaPanel, LuminaVoiceTarget } from '../../../ui';
import { SoundManager } from '../../../utils/SoundManager';
import {
  useVoiceCapture,
  type CapturedUtterance,
  type VoiceCapture,
} from '../../../hooks/useVoiceCapture';
import { judgeForPass } from '../studioJudge';
import { DISTRACTOR_POOL, PRESET_WORDS, type LabVerdict, type StudioScenarioProps } from '../types';
import CaptureSurface from '../CaptureSurface';

interface ChoiceContext {
  idx: number;
  answer: string;
  options: string[];
}

interface ProblemDef {
  answer: string;
  options: string[];
}

const SCENARIO_ID = 'choice-queue';

const ChoiceQueueScenario: React.FC<StudioScenarioProps> = ({ config, recordTrial, reportUtterance }) => {
  const [targetWord, setTargetWord] = useState('map');
  const [customWord, setCustomWord] = useState('');
  const [distractors, setDistractors] = useState<string[]>(['mop', 'cat', 'sun']);
  const [customOption, setCustomOption] = useState('');
  const [note, setNote] = useState('');

  const [focusIdx, setFocusIdx] = useState(0);
  const [answers, setAnswers] = useState<Array<{ word: string; correct: boolean } | null>>([null, null]);
  const [voiceChoice, setVoiceChoice] = useState<{ idx: number; word: string } | null>(null);

  const resolvedWord = (customWord.trim() || targetWord).toLowerCase();

  // Problem 1 is operator-configured; Problem 2 auto-builds from the
  // remaining pool so the boards differ. Alphabetical order so the answer's
  // position is never a tell.
  const problems = useMemo<ProblemDef[]>(() => {
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

  const configRef = useRef(config);
  configRef.current = config;
  const problemsRef = useRef(problems);
  problemsRef.current = problems;
  const focusIdxRef = useRef(0);
  const answersRef = useRef(answers);
  const allSolvedRef = useRef(false);
  const voiceRef = useRef<VoiceCapture | null>(null);

  const allSolved = answers.length > 0 && answers.every((a) => a?.correct);

  const resetQueue = useCallback(() => {
    const blank = problemsRef.current.map(() => null);
    answersRef.current = blank;
    setAnswers(blank);
    allSolvedRef.current = false;
    focusIdxRef.current = 0;
    setFocusIdx(0);
    setVoiceChoice(null);
    setNote('');
  }, []);

  useEffect(() => {
    resetQueue();
  }, [problems, resetQueue]);

  /** Native control: submit an option to problem `idx` (voice or tap). */
  const submitChoiceAt = useCallback((idx: number, word: string): boolean => {
    const prob = problemsRef.current[idx];
    if (!prob || answersRef.current[idx]?.correct) return false;
    const correct = word === prob.answer;
    const next = answersRef.current.map((a, i) => (i === idx ? { word, correct } : a));
    answersRef.current = next;
    setAnswers(next);
    setVoiceChoice(null);
    if (correct) {
      SoundManager.playCorrect();
      const nextIdx = next.findIndex((a) => !a?.correct);
      if (nextIdx === -1) {
        allSolvedRef.current = true;
        setNote('All problems answered! 🎉');
        // Queue cleared: a turn activation is complete; open mic stays hot.
        if (configRef.current.modality === 'turn') voiceRef.current?.stop();
      } else {
        focusIdxRef.current = nextIdx;
        setFocusIdx(nextIdx);
        setNote('');
      }
    } else {
      SoundManager.playIncorrect();
      focusIdxRef.current = idx;
      setFocusIdx(idx);
    }
    return correct;
  }, []);

  // Voice actuation policy — the levers live here. Never a silent no-op
  // when something was heard.
  const applyActuation = useCallback(
    (verdict: LabVerdict | null, idx: number) => {
      if (!verdict) {
        SoundManager.invalid();
        setNote('Judge error — try again.');
        return;
      }
      if (answersRef.current[idx]?.correct) {
        SoundManager.tick(); // late verdict on an already-solved problem
        return;
      }
      const sel = verdict.selectedOption ?? null;
      if (!sel) {
        SoundManager.tick();
        setNote(
          verdict.heard
            ? `Heard “${verdict.heard}” — that isn't one of the options.`
            : 'Could not make that out — say one of the options.',
        );
        return;
      }
      const confident = configRef.current.actOn === 'any' || verdict.confidence === 'high';
      if (!confident || configRef.current.voiceAction === 'highlight') {
        setVoiceChoice({ idx, word: sel });
        SoundManager.select();
        setNote(
          confident
            ? `Heard “${sel}” — tap it to confirm.`
            : `Maybe “${sel}”? Tap to confirm, or say it again.`,
        );
        return;
      }
      setNote('');
      submitChoiceAt(idx, sel);
    },
    [submitChoiceAt],
  );

  const judge = useCallback(
    (utt: CapturedUtterance<ChoiceContext>, pass: 'spec' | 'escalate' | 'fresh') =>
      judgeForPass(
        { kind: 'choice', options: utt.context.options, word: utt.context.answer },
        utt,
        pass,
        configRef.current,
        SCENARIO_ID,
        recordTrial,
        setNote,
      ),
    [recordTrial],
  );

  const onSettle = useCallback(
    (verdict: LabVerdict | null, utt: CapturedUtterance<ChoiceContext>) => {
      applyActuation(verdict, utt.context.idx);
      reportUtterance({
        utterance: utt,
        kind: { kind: 'choice', options: utt.context.options, word: utt.context.answer },
        scenario: SCENARIO_ID,
      });
    },
    [applyActuation, reportUtterance],
  );

  const voice = useVoiceCapture<LabVerdict, ChoiceContext>({
    modality: config.modality,
    getContext: () => {
      const idx = focusIdxRef.current;
      const prob = problemsRef.current[idx];
      return { idx, answer: prob.answer, options: prob.options };
    },
    judge,
    isConfident: (v) => v.confidence === 'high',
    onSettle,
    onNoSpeech: useCallback(() => {
      if (configRef.current.modality === 'ptt') {
        SoundManager.invalid();
        setNote('No speech detected — try again closer to the mic.');
      }
    }, []),
    autoStart: config.autoArm,
    activationKey: `${SCENARIO_ID}:${problems.map((p) => p.answer).join('|')}`,
    armDelayMs: config.armDelayMs,
    cooldownMs: config.cooldownMs,
  });
  voiceRef.current = voice;

  const tapOption = useCallback(
    (idx: number, word: string) => {
      submitChoiceAt(idx, word);
    },
    [submitChoiceAt],
  );

  const focusProblem = useCallback((idx: number) => {
    if (answersRef.current[idx]?.correct) return;
    focusIdxRef.current = idx;
    setFocusIdx(idx);
    setVoiceChoice(null);
  }, []);

  const addCustomOption = useCallback(() => {
    const w = customOption.trim().toLowerCase();
    if (!w) return;
    setDistractors((prev) => (prev.includes(w) ? prev : [...prev, w]));
    setCustomOption('');
  }, [customOption]);

  const listeningLabel = allSolved
    ? 'All answered — still listening'
    : `Problem ${focusIdx + 1}: say one of its options`;

  return (
    <div className="space-y-4">
      {/* Problem 1 config */}
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

      {/* The voice-controlled queue */}
      <LuminaPanel className="text-center space-y-4 py-6">
        <div className="grid sm:grid-cols-2 gap-4 pt-2 pb-1 text-left">
          {problems.map((p, i) => {
            const done = !!answers[i]?.correct;
            const isFocus = i === focusIdx && !allSolved;
            return (
              <LuminaVoiceTarget
                key={`${p.answer}-${i}`}
                label={`Problem ${i + 1}`}
                active={isFocus}
                done={done}
                accent={config.modality === 'open' ? 'purple' : 'cyan'}
                onFocus={() => focusProblem(i)}
                activeHint={
                  voice.state === 'recording'
                    ? 'hearing you…'
                    : voice.state === 'armed'
                      ? 'listening…'
                      : 'targeted'
                }
              >
                <p className="text-xs text-slate-500 mb-2">
                  say <span className="font-bold text-slate-300">“{p.answer}”</span>
                </p>
                <div className="flex flex-wrap gap-2">
                  {p.options.map((w) => {
                    const isVoice = voiceChoice?.idx === i && voiceChoice.word === w;
                    const sub = answers[i]?.word === w ? answers[i] : null;
                    return (
                      <button
                        key={w}
                        onClick={(e) => { e.stopPropagation(); tapOption(i, w); }}
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

        {allSolved && <LuminaButton onClick={resetQueue}>↺ Play again</LuminaButton>}

        <CaptureSurface
          voice={voice}
          modality={config.modality}
          idleLabel="Answer by voice"
          listeningLabel={listeningLabel}
          startLabel={config.modality === 'open' ? 'Open mic' : 'Start turn — answer the problems'}
          statusNote={note}
        />
      </LuminaPanel>
    </div>
  );
};

export default ChoiceQueueScenario;
