'use client';

import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { Switch } from '@/components/ui/switch';
import type { MiniSimBlockData } from '../types';
import BlockWrapper from './BlockWrapper';
import {
  LuminaSlider,
  LuminaAnswerChoice,
  LuminaActionButton,
  LuminaFeedbackCard,
  LuminaBadge,
  LuminaReadAloud,
  type AnswerChoiceState,
} from '../../../../../ui';
import { SoundManager } from '../../../../../utils/SoundManager';
import BlockTutorHelp from './BlockTutorHelp';

interface MiniSimBlockProps {
  data: MiniSimBlockData;
  index: number;
  onAnswer?: (blockId: string, correct: boolean, attempts: number) => void;
  answered?: boolean;
  /** Bridge to the DeepDive live tutor for a contextual, answer-free hint */
  onAskTutor?: (message: string) => void;
  /**
   * Pre-reader (K) presentation — reader-fit PRE band contract: the tutor reads
   * the scenario + prediction aloud (auto on first view + 🔊 replay), the
   * prediction renders picture-primary with a single tap to choose (no Check),
   * the outcome is read aloud when the child flips the control, and adult mono
   * chrome (PREDICT FIRST / EXPERIMENT / KEY OBSERVATION / letter labels) hides.
   */
  preReader?: boolean;
}

const MiniSimBlock: React.FC<MiniSimBlockProps> = ({
  data,
  index,
  onAnswer,
  answered: answeredProp,
  onAskTutor,
  preReader = false,
}) => {
  const {
    scenario,
    controlType,
    controlLabel,
    toggleOffLabel,
    toggleOnLabel,
    sliderMin = 0,
    sliderMax = 100,
    sliderStep = 1,
    sliderUnit = '',
    sliderDefault,
    states,
    prediction,
    label,
  } = data;

  // ── State ──────────────────────────────────────────────────────────
  const [toggleValue, setToggleValue] = useState(false);
  const [sliderValue, setSliderValue] = useState(sliderDefault ?? sliderMin);
  const [predictionAnswer, setPredictionAnswer] = useState<number | null>(null);
  const [predictionSubmitted, setPredictionSubmitted] = useState(false);
  const [predictionAttempts, setPredictionAttempts] = useState(0);
  const [simUnlocked, setSimUnlocked] = useState(!prediction);
  const [answered, setAnswered] = useState(answeredProp ?? false);
  // Pre-reader retry state — the wrongly-tapped picture stays marked until the
  // next tap so feedback lands on the touched object (reader-fit rule 5).
  const [retryIndex, setRetryIndex] = useState<number | null>(null);

  // ── Resolve current state from control value ───────────────────────
  const activeState = useMemo(() => {
    if (controlType === 'toggle') {
      const cond = toggleValue ? 'on' : 'off';
      return states.find((s) => s.condition === cond) ?? states[0];
    }
    // Slider: find the range that contains the current value
    for (const s of states) {
      const [lo, hi] = s.condition.split('-').map(Number);
      if (!isNaN(lo) && !isNaN(hi) && sliderValue >= lo && sliderValue <= hi) {
        return s;
      }
    }
    return states[states.length - 1] ?? null;
  }, [controlType, toggleValue, sliderValue, states]);

  // The spoken STIMULUS beat — scenario + prediction question + every option,
  // read by the tutor. Enacted by the catalog PRE-READER READ-ALOUD directive
  // (survives the lesson-mode brevity cap). Correct prediction never spoken.
  const readAloudMessage = prediction
    ? `[SIM_READ_ALOUD] A pre-reader is doing a little experiment and cannot read it. `
      + `First read the setup aloud word for word: "${scenario}". `
      + `Then read the question: "${prediction.question}". `
      + `Then read each choice slowly with its letter: ${prediction.options.map((o, i) => `${String.fromCharCode(65 + i)}) ${o}`).join('; ')}. `
      + `Then ask which one they think will happen. Do not say which one is right.`
    : '';

  // ORIENT/STIMULUS auto-beat at PRE — fires once when the block first scrolls
  // into view (all blocks mount together in stack layout, so mount-time firing
  // would read every block at once). Ref-guarded against re-fire.
  const blockRef = useRef<HTMLDivElement | null>(null);
  const readAloudFiredRef = useRef(false);
  useEffect(() => {
    if (!preReader || !onAskTutor || !prediction || answered || readAloudFiredRef.current) return;
    const el = blockRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !readAloudFiredRef.current) {
          readAloudFiredRef.current = true;
          onAskTutor(readAloudMessage);
          observer.disconnect();
        }
      },
      { threshold: 0.4 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [preReader, onAskTutor, prediction, answered, readAloudMessage]);

  // STIMULUS for the experiment: read the observable outcome aloud when the
  // pre-reader flips the control (the outcome text is load-bearing and they
  // can't read it). Baseline recorded silently so it fires only on real change,
  // keeping the tutor quiet-by-default until the child acts.
  const lastObservedRef = useRef<string | null>(null);
  useEffect(() => {
    if (!preReader || !onAskTutor || !simUnlocked || !activeState) return;
    if (lastObservedRef.current === null) {
      lastObservedRef.current = activeState.condition;
      return;
    }
    if (lastObservedRef.current === activeState.condition) return;
    lastObservedRef.current = activeState.condition;
    onAskTutor(
      `[SIM_OBSERVE] The pre-reader changed the control and now sees "${activeState.title}". `
      + `Read what happens aloud, warmly and clearly: "${activeState.description}". One or two sentences, then stop.`,
    );
  }, [preReader, onAskTutor, simUnlocked, activeState]);

  // ── Prediction handlers ────────────────────────────────────────────
  const handlePredictionSelect = useCallback(
    (idx: number) => {
      if (predictionSubmitted) return;
      SoundManager.select();
      setPredictionAnswer((prev) => (prev === idx ? null : idx));
    },
    [predictionSubmitted],
  );

  const handlePredictionSubmit = useCallback(() => {
    if (predictionAnswer === null || !prediction || predictionSubmitted) return;
    const newAttempts = predictionAttempts + 1;
    setPredictionAttempts(newAttempts);

    const isCorrect = predictionAnswer === prediction.correctIndex;

    if (isCorrect) {
      SoundManager.playCorrect();
      setPredictionSubmitted(true);
      setSimUnlocked(true);
      setAnswered(true);
      onAnswer?.(data.id, true, newAttempts);
    } else if (newAttempts >= 2) {
      SoundManager.playIncorrect();
      setPredictionSubmitted(true);
      setSimUnlocked(true);
      setAnswered(true);
      onAnswer?.(data.id, false, newAttempts);
    } else {
      SoundManager.playIncorrect();
      setPredictionAnswer(null);
    }
  }, [predictionAnswer, prediction, predictionSubmitted, predictionAttempts, data.id, onAnswer]);

  // Pre-reader flow: single tap = choose (the selection is atomic, so no Check
  // button — reader-fit rule 2). Same two-attempt policy as the deliberate flow.
  const handlePredictionChoose = useCallback(
    (idx: number) => {
      if (predictionSubmitted || !prediction) return;
      const newAttempts = predictionAttempts + 1;
      setPredictionAttempts(newAttempts);
      setPredictionAnswer(idx);

      if (idx === prediction.correctIndex) {
        SoundManager.playCorrect();
        setRetryIndex(null);
        setPredictionSubmitted(true);
        setSimUnlocked(true);
        setAnswered(true);
        onAnswer?.(data.id, true, newAttempts);
      } else if (newAttempts >= 2) {
        SoundManager.playIncorrect();
        setRetryIndex(null);
        setPredictionSubmitted(true);
        setSimUnlocked(true);
        setAnswered(true);
        onAnswer?.(data.id, false, newAttempts);
      } else {
        // First miss — feedback lands on the tapped picture and the tutor gives
        // an eyes-free spoken hint (RECOVER beat), never revealing the answer.
        SoundManager.playIncorrect();
        setRetryIndex(idx);
        onAskTutor?.(
          `[SIM_PREDICT_RETRY] The pre-reader guessed "${prediction.options[idx]}" for what will happen — not right. `
          + `Give ONE warm spoken hint without revealing the answer, and invite them to tap another picture.`,
        );
      }
    },
    [predictionSubmitted, prediction, predictionAttempts, data.id, onAnswer, onAskTutor],
  );

  const wasCorrect = prediction ? predictionAnswer === prediction.correctIndex : false;

  // ── Shared control input (toggle / slider) ─────────────────────────
  const controlInput =
    controlType === 'toggle' ? (
      <div className="flex items-center gap-3">
        <span
          className={`text-sm transition-colors ${
            !toggleValue ? 'text-slate-100 font-medium' : 'text-slate-500'
          }`}
        >
          {toggleOffLabel || 'Off'}
        </span>
        <Switch
          checked={toggleValue}
          onCheckedChange={(v) => {
            SoundManager.toggle(v);
            setToggleValue(v);
          }}
          className="data-[state=checked]:bg-cyan-500"
        />
        <span
          className={`text-sm transition-colors ${
            toggleValue ? 'text-slate-100 font-medium' : 'text-slate-500'
          }`}
        >
          {toggleOnLabel || 'On'}
        </span>
      </div>
    ) : (
      <div className="space-y-2">
        <LuminaSlider
          accent="cyan"
          value={[sliderValue]}
          onValueChange={([v]) => setSliderValue(v)}
          min={sliderMin}
          max={sliderMax}
          step={sliderStep}
        />
        <div className="flex justify-between text-xs text-slate-500">
          <span>
            {sliderMin}
            {sliderUnit}
          </span>
          <span className="text-cyan-300 font-medium">
            {sliderValue}
            {sliderUnit}
          </span>
          <span>
            {sliderMax}
            {sliderUnit}
          </span>
        </div>
      </div>
    );

  // ── Render: Prediction Phase (deliberate select-then-Check) ────────
  const renderPrediction = () => {
    if (!prediction) return null;

    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2 mb-1">
          <div className="w-1.5 h-1.5 rounded-full bg-cyan-400/80" />
          <p className="text-xs font-mono uppercase tracking-wider text-cyan-400/70">
            Predict First
          </p>
        </div>
        <p className="text-[15px] text-slate-200 leading-relaxed">
          {prediction.question}
        </p>
        <div className="grid gap-2">
          {prediction.options.map((opt, i) => {
            let state: AnswerChoiceState;
            if (!predictionSubmitted) {
              state = predictionAnswer === i ? 'selected' : 'idle';
            } else if (i === prediction.correctIndex) {
              state = 'correct';
            } else if (i === predictionAnswer) {
              state = 'incorrect';
            } else {
              state = 'dimmed';
            }

            return (
              <LuminaAnswerChoice
                key={i}
                state={state}
                disabled={predictionSubmitted}
                onClick={() => handlePredictionSelect(i)}
                className="p-2.5 text-sm"
              >
                <span className="text-slate-500 mr-2 font-mono text-xs">
                  {String.fromCharCode(65 + i)}.
                </span>
                {opt}
              </LuminaAnswerChoice>
            );
          })}
        </div>

        {!predictionSubmitted && (
          <div className="flex flex-wrap items-center gap-3">
            <LuminaActionButton
              action="check"
              onClick={handlePredictionSubmit}
              disabled={predictionAnswer === null}
            >
              Lock In Prediction
            </LuminaActionButton>
            <BlockTutorHelp
              onAskTutor={onAskTutor}
              message={`[STUDENT_HELP_REQUEST] The student is predicting the outcome of a simulation. Scenario: "${scenario}". Question: "${prediction.question}". Options: ${prediction.options.map((o, i) => `${String.fromCharCode(65 + i)}) ${o}`).join('; ')}. The correct prediction is "${prediction.options[prediction.correctIndex]}". Guide them to reason about cause and effect — do NOT reveal or name the correct prediction.`}
            />
          </div>
        )}

        {predictionSubmitted && (
          <div className="space-y-2">
            <LuminaFeedbackCard
              status={wasCorrect ? 'correct' : 'incorrect'}
              label={
                wasCorrect
                  ? predictionAttempts === 1 ? 'Correct!' : 'Correct (2nd try)'
                  : 'Answer revealed'
              }
            >
              {prediction.explanation}
            </LuminaFeedbackCard>
            <p className="text-xs text-cyan-400/60 mt-2 font-mono uppercase tracking-wider">
              Now try it yourself below
            </p>
          </div>
        )}
      </div>
    );
  };

  // ── Render: Prediction Phase (pre-reader, picture-primary tap=choose) ──
  const renderPreReaderPrediction = () => {
    if (!prediction) return null;

    return (
      <div className="space-y-4">
        <div className="flex items-start gap-3">
          <p className="text-slate-100 font-medium text-lg leading-relaxed flex-1">
            {prediction.question}
          </p>
          {onAskTutor && (
            <LuminaReadAloud
              iconOnly
              size="md"
              aria-label="Hear the question again"
              className="flex-shrink-0"
              onClick={() => {
                SoundManager.tap();
                onAskTutor(readAloudMessage);
              }}
            />
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          {prediction.options.map((opt, i) => {
            let state: AnswerChoiceState = 'idle';
            if (predictionSubmitted) {
              if (i === prediction.correctIndex) state = 'correct';
              else if (i === predictionAnswer) state = 'incorrect';
              else state = 'dimmed';
            } else if (i === retryIndex) {
              state = 'incorrect';
            }
            return (
              <LuminaAnswerChoice
                key={i}
                state={state}
                disabled={predictionSubmitted}
                onClick={() => handlePredictionChoose(i)}
                className="p-5 flex flex-col items-center justify-center gap-2 text-center min-h-[7rem]"
              >
                <span className="text-5xl leading-none" aria-hidden>
                  {prediction.optionEmojis?.[i] || '⭐'}
                </span>
                <span className="text-base text-slate-100">{opt}</span>
              </LuminaAnswerChoice>
            );
          })}
        </div>

        {predictionSubmitted && (
          <LuminaFeedbackCard
            status={wasCorrect ? 'correct' : 'incorrect'}
            label={wasCorrect ? '🎉 You did it!' : '💛 Good try!'}
          >
            {prediction.explanation}
          </LuminaFeedbackCard>
        )}
      </div>
    );
  };

  // ── Render: Simulation Controls (deliberate) ───────────────────────
  const renderControls = () => {
    if (!simUnlocked) return null;

    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2 mb-1">
          <div className="w-1.5 h-1.5 rounded-full bg-cyan-400/80 animate-pulse" />
          <p className="text-xs font-mono uppercase tracking-wider text-cyan-400/70">
            Experiment
          </p>
        </div>

        {/* Control */}
        <div className="p-4 rounded-xl bg-white/5 border border-white/10">
          <p className="text-sm text-slate-400 mb-3">{controlLabel}</p>
          {controlInput}
        </div>

        {/* Outcome card */}
        {activeState && (
          <div
            key={activeState.condition}
            className="p-4 rounded-xl bg-cyan-500/5 border border-cyan-500/20 space-y-2 animate-in fade-in duration-300"
          >
            <p className="text-sm font-semibold text-cyan-200">{activeState.title}</p>
            <p className="text-sm text-slate-300 leading-relaxed">
              {activeState.description}
            </p>
            <div className="pt-2 border-t border-white/5">
              <p className="text-xs font-mono uppercase tracking-wider text-cyan-400/60 mb-1">
                Key Observation
              </p>
              <p className="text-sm text-slate-200 italic">{activeState.keyObservation}</p>
            </div>
          </div>
        )}
      </div>
    );
  };

  // ── Render: Simulation Controls (pre-reader — no mono chrome) ───────
  const renderPreReaderControls = () => {
    if (!simUnlocked) return null;

    return (
      <div className="space-y-4">
        {/* Control */}
        <div className="p-4 rounded-2xl bg-white/5 border border-white/10">
          <p className="text-base text-slate-200 mb-3">{controlLabel}</p>
          {controlInput}
        </div>

        {/* Outcome card — title + what happens (read aloud on change); the
            adult "Key Observation" insight is dropped at PRE. */}
        {activeState && (
          <div
            key={activeState.condition}
            className="p-4 rounded-2xl bg-cyan-500/5 border border-cyan-500/20 space-y-2 animate-in fade-in duration-300"
          >
            <p className="text-base font-semibold text-cyan-200">{activeState.title}</p>
            <p className="text-base text-slate-100 leading-relaxed">
              {activeState.description}
            </p>
          </div>
        )}
      </div>
    );
  };

  // ── Pre-reader main render ─────────────────────────────────────────
  if (preReader) {
    return (
      <BlockWrapper label={label} index={index} accent="cyan" variant="default">
        <div ref={blockRef} className="space-y-5">
          {/* Scenario — read aloud in the STIMULUS beat */}
          <p className="text-[17px] text-slate-100 leading-relaxed">{scenario}</p>

          {/* Prediction (if present) */}
          {prediction && !answered && renderPreReaderPrediction()}

          {/* Simulation controls + outcome */}
          {renderPreReaderControls()}
        </div>
      </BlockWrapper>
    );
  }

  // ── Standard main render ───────────────────────────────────────────
  return (
    <BlockWrapper label={label} index={index} accent="cyan" variant="default">
      <div className="space-y-5">
        {/* Scenario description */}
        <p className="text-[15px] text-slate-300 leading-relaxed">{scenario}</p>

        {/* Prediction phase (if present) */}
        {prediction && !answered && renderPrediction()}
        {prediction && answered && (
          <div className="p-3 rounded-lg bg-white/5 border border-white/10 text-sm text-slate-400">
            <span className="font-medium text-slate-300">Your prediction:</span>{' '}
            {prediction.options[predictionAnswer ?? prediction.correctIndex]}
            {predictionAnswer === prediction.correctIndex ? (
              <LuminaBadge accent="emerald" className="ml-2 text-xs">
                Correct
              </LuminaBadge>
            ) : (
              <LuminaBadge accent="rose" className="ml-2 text-xs">
                Revised
              </LuminaBadge>
            )}
          </div>
        )}

        {/* Simulation controls + outcome */}
        {renderControls()}
      </div>
    </BlockWrapper>
  );
};

export default MiniSimBlock;
