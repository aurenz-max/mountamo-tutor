'use client';

import React, { useState, useCallback, useMemo } from 'react';
import { Switch } from '@/components/ui/switch';
import type { MiniSimBlockData } from '../types';
import BlockWrapper from './BlockWrapper';
import {
  LuminaSlider,
  LuminaAnswerChoice,
  LuminaActionButton,
  LuminaFeedbackCard,
  LuminaBadge,
  type AnswerChoiceState,
} from '../../../../../ui';
import { SoundManager } from '../../../../../utils/SoundManager';

interface MiniSimBlockProps {
  data: MiniSimBlockData;
  index: number;
  onAnswer?: (blockId: string, correct: boolean, attempts: number) => void;
  answered?: boolean;
}

const MiniSimBlock: React.FC<MiniSimBlockProps> = ({
  data,
  index,
  onAnswer,
  answered: answeredProp,
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

  // ── Render: Prediction Phase ───────────────────────────────────────
  const renderPrediction = () => {
    if (!prediction) return null;

    const wasCorrect = predictionAnswer === prediction.correctIndex;

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
          <LuminaActionButton
            action="check"
            onClick={handlePredictionSubmit}
            disabled={predictionAnswer === null}
          >
            Lock In Prediction
          </LuminaActionButton>
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

  // ── Render: Simulation Controls ────────────────────────────────────
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

          {controlType === 'toggle' ? (
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
          )}
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

  // ── Main Render ────────────────────────────────────────────────────
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
