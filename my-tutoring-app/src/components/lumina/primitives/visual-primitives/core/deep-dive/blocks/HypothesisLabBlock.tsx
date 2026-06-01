'use client';

import React, { useState, useMemo, useCallback } from 'react';
import type {
  HypothesisLabBlockData,
  HypothesisVariable,
  HypothesisVariableRole,
} from '../types';
import BlockWrapper from './BlockWrapper';
import { LuminaActionButton, LuminaBadge, LuminaFeedbackCard } from '../../../../../ui';
import { SoundManager } from '../../../../../utils/SoundManager';

type Zone = 'pool' | 'iv' | 'dv' | 'control';

interface HypothesisLabBlockProps {
  data: HypothesisLabBlockData;
  index: number;
  onAnswer: (blockId: string, correct: boolean, attempts: number) => void;
  answered?: boolean;
}

const ZONE_LABEL: Record<Exclude<Zone, 'pool'>, string> = {
  iv: 'Independent Variable',
  dv: 'Dependent Variable',
  control: 'Held Constant',
};

const ZONE_SUBLABEL: Record<Exclude<Zone, 'pool'>, string> = {
  iv: 'one factor',
  dv: 'one factor',
  control: 'one or more',
};

function correctZoneFor(role: HypothesisVariableRole): Zone {
  if (role === 'iv') return 'iv';
  if (role === 'dv') return 'dv';
  if (role === 'control') return 'control';
  return 'pool';
}

const HypothesisLabBlock: React.FC<HypothesisLabBlockProps> = ({
  data,
  index,
  onAnswer,
  answered: answeredProp,
}) => {
  const { scenario, prompt, variables, explanation, label } = data;

  const [positions, setPositions] = useState<Record<string, Zone>>(
    () => Object.fromEntries(variables.map((v) => [v.id, 'pool' as Zone])),
  );
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [attempts, setAttempts] = useState(0);
  const [answered, setAnswered] = useState(answeredProp ?? false);
  const [showExplanation, setShowExplanation] = useState(false);
  const [wrongIds, setWrongIds] = useState<Set<string>>(new Set());
  const [wasCorrect, setWasCorrect] = useState(false);

  const ivOccupant = useMemo(
    () => Object.entries(positions).find(([, z]) => z === 'iv')?.[0] ?? null,
    [positions],
  );
  const dvOccupant = useMemo(
    () => Object.entries(positions).find(([, z]) => z === 'dv')?.[0] ?? null,
    [positions],
  );
  const controlOccupants = useMemo(
    () => Object.entries(positions).filter(([, z]) => z === 'control').map(([id]) => id),
    [positions],
  );
  const poolOccupants = useMemo(
    () => Object.entries(positions).filter(([, z]) => z === 'pool').map(([id]) => id),
    [positions],
  );

  const canSubmit = ivOccupant !== null && dvOccupant !== null && !answered;

  const handleChipClick = useCallback(
    (id: string) => {
      if (answered) return;
      SoundManager.tap();
      const currentZone = positions[id];
      // Clicking a chip already in a zone returns it to the pool.
      if (currentZone !== 'pool') {
        setPositions((p) => ({ ...p, [id]: 'pool' }));
        if (selectedId === id) setSelectedId(null);
        return;
      }
      // Toggle selection in the pool.
      setSelectedId((prev) => (prev === id ? null : id));
    },
    [answered, positions, selectedId],
  );

  const handleZoneClick = useCallback(
    (zone: Exclude<Zone, 'pool'>) => {
      if (answered || !selectedId) return;
      SoundManager.snap();
      setPositions((p) => {
        const next = { ...p };
        // IV/DV are single-slot — eject any existing occupant back to the pool.
        if (zone === 'iv' || zone === 'dv') {
          for (const id of Object.keys(next)) {
            if (next[id] === zone && id !== selectedId) {
              next[id] = 'pool';
            }
          }
        }
        next[selectedId] = zone;
        return next;
      });
      setSelectedId(null);
    },
    [answered, selectedId],
  );

  const handleSubmit = useCallback(() => {
    if (!canSubmit) return;
    const wrong = new Set<string>();
    for (const v of variables) {
      const placed = positions[v.id];
      const correctZone = correctZoneFor(v.role);
      if (placed !== correctZone) wrong.add(v.id);
    }

    const newAttempts = attempts + 1;
    setAttempts(newAttempts);

    if (wrong.size === 0) {
      SoundManager.playCorrect();
      setAnswered(true);
      setShowExplanation(true);
      setWrongIds(new Set());
      setWasCorrect(true);
      onAnswer(data.id, true, newAttempts);
    } else if (newAttempts >= 2) {
      // Reveal answer key by snapping every chip to its correct zone.
      const corrected: Record<string, Zone> = {};
      for (const v of variables) corrected[v.id] = correctZoneFor(v.role);
      SoundManager.playIncorrect();
      setPositions(corrected);
      setAnswered(true);
      setShowExplanation(true);
      setWrongIds(new Set());
      setWasCorrect(false);
      onAnswer(data.id, false, newAttempts);
    } else {
      SoundManager.playIncorrect();
      setWrongIds(wrong);
    }
  }, [canSubmit, variables, positions, attempts, onAnswer, data.id]);

  // Hypothesis sentence assembled from correctly-classified variables —
  // shown only after submission.
  const hypothesisSentence = useMemo(() => {
    if (!answered) return null;
    const iv = variables.find((v) => v.role === 'iv')?.label;
    const dv = variables.find((v) => v.role === 'dv')?.label;
    const controls = variables.filter((v) => v.role === 'control').map((v) => v.label);
    if (!iv || !dv) return null;
    const controlClause = controls.length > 0
      ? ` while holding ${controls.join(', ')} constant`
      : '';
    return `This experiment tests whether changing ${iv} affects ${dv}${controlClause}.`;
  }, [answered, variables]);

  const renderChip = (v: HypothesisVariable, inZone: Zone) => {
    const isSelected = selectedId === v.id;
    const isWrong = wrongIds.has(v.id);
    const isInZone = inZone !== 'pool';

    let chipClasses =
      'inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-sm transition-all ';

    if (answered) {
      // After submission: green if correct, red if wrong, neutral otherwise.
      const correctZone = correctZoneFor(v.role);
      const placedCorrectly = positions[v.id] === correctZone;
      if (placedCorrectly && correctZone !== 'pool') {
        chipClasses += 'bg-emerald-500/15 border-emerald-500/40 text-emerald-200 ';
      } else if (placedCorrectly && correctZone === 'pool') {
        // Distractor correctly left in pool — subtle confirmation.
        chipClasses += 'bg-white/5 border-emerald-500/20 text-slate-300 ';
      } else {
        chipClasses += 'bg-rose-500/15 border-rose-500/40 text-rose-200 ';
      }
      chipClasses += 'cursor-default';
    } else if (isWrong) {
      chipClasses += 'bg-rose-500/15 border-rose-500/40 text-rose-100 cursor-pointer';
    } else if (isSelected) {
      chipClasses += 'bg-teal-500/25 border-teal-400/70 text-teal-50 shadow-lg shadow-teal-500/20 cursor-pointer ring-2 ring-teal-400/30';
    } else if (isInZone) {
      chipClasses += 'bg-teal-500/10 border-teal-500/30 text-teal-100 hover:bg-teal-500/20 cursor-pointer';
    } else {
      chipClasses += 'bg-white/5 border-white/20 text-slate-200 hover:bg-white/10 hover:border-white/30 cursor-pointer';
    }

    return (
      <button
        key={v.id}
        type="button"
        onClick={() => handleChipClick(v.id)}
        disabled={answered}
        className={chipClasses}
      >
        <span className="leading-tight">{v.label}</span>
        {answered && positions[v.id] !== correctZoneFor(v.role) && (
          <span className="text-[10px] font-mono uppercase tracking-widest opacity-70">
            {v.role === 'irrelevant' ? 'not part of expt' : ZONE_LABEL[correctZoneFor(v.role) as Exclude<Zone, 'pool'>]}
          </span>
        )}
      </button>
    );
  };

  const renderZone = (zone: Exclude<Zone, 'pool'>, occupantIds: string[]) => {
    const isClickable = !answered && selectedId !== null;
    const isMultiSlot = zone === 'control';
    const isEmpty = occupantIds.length === 0;

    let zoneClasses =
      'rounded-xl border p-3 transition-all min-h-[88px] flex flex-col gap-2 ';
    if (answered) {
      zoneClasses += 'bg-slate-950/40 border-white/10 ';
    } else if (isClickable) {
      zoneClasses += 'bg-teal-500/5 border-teal-500/40 border-dashed cursor-pointer hover:bg-teal-500/10 ';
    } else {
      zoneClasses += 'bg-slate-950/40 border-white/10 ';
    }

    return (
      <button
        type="button"
        onClick={() => handleZoneClick(zone)}
        disabled={answered || selectedId === null}
        className={`${zoneClasses} text-left disabled:cursor-default`}
      >
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-[10px] font-mono uppercase tracking-widest text-teal-300/70">
            {ZONE_LABEL[zone]}
          </span>
          <span className="text-[10px] text-slate-500">{ZONE_SUBLABEL[zone]}</span>
        </div>
        <div className="flex flex-wrap gap-1.5 min-h-[28px]">
          {isEmpty && (
            <span className="text-xs text-slate-600 italic">
              {isClickable ? 'tap to place' : 'empty'}
            </span>
          )}
          {occupantIds.map((id) => {
            const v = variables.find((x) => x.id === id);
            if (!v) return null;
            return renderChip(v, zone);
          })}
          {isMultiSlot && !isEmpty && isClickable && (
            <span className="text-[10px] text-teal-300/70 italic self-center">+ add</span>
          )}
        </div>
      </button>
    );
  };

  return (
    <BlockWrapper label={label} index={index} accent="teal" variant="default">
      <div className="space-y-4">
        {/* Scenario */}
        <div className="rounded-xl bg-teal-500/5 border border-teal-500/15 px-4 py-3">
          <div className="text-[10px] font-mono uppercase tracking-widest text-teal-300/60 mb-1.5">
            The experiment
          </div>
          <p className="text-sm text-slate-200 leading-relaxed">{scenario}</p>
        </div>

        {/* Prompt */}
        <p className="text-sm text-slate-300">
          {prompt || 'Tap a factor below, then tap a zone to place it. Tap a placed factor to send it back.'}
        </p>

        {/* Pool */}
        <div className="rounded-xl bg-slate-950/30 border border-white/10 p-3">
          <div className="text-[10px] font-mono uppercase tracking-widest text-slate-500 mb-2">
            Factors from the scenario
          </div>
          <div className="flex flex-wrap gap-2 min-h-[36px]">
            {poolOccupants.length === 0 && !answered && (
              <span className="text-xs text-slate-600 italic self-center">
                all factors placed
              </span>
            )}
            {poolOccupants.map((id) => {
              const v = variables.find((x) => x.id === id);
              if (!v) return null;
              return renderChip(v, 'pool');
            })}
          </div>
        </div>

        {/* Zones */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {renderZone('iv', ivOccupant ? [ivOccupant] : [])}
          {renderZone('dv', dvOccupant ? [dvOccupant] : [])}
          {renderZone('control', controlOccupants)}
        </div>

        {/* Submit */}
        {!answered && (
          <div className="flex items-center gap-3">
            <LuminaActionButton
              action="check"
              onClick={handleSubmit}
              disabled={!canSubmit}
            >
              Check My Design
            </LuminaActionButton>
            {!canSubmit && (
              <span className="text-xs text-slate-500 italic">
                Place an Independent and Dependent Variable to check.
              </span>
            )}
            {attempts === 1 && wrongIds.size > 0 && (
              <span className="text-xs text-rose-300/80">
                Some factors are misplaced. One more try.
              </span>
            )}
          </div>
        )}

        {/* Result */}
        {answered && (
          <div className="flex items-center gap-2">
            <LuminaBadge
              accent={wasCorrect && attempts === 1 ? 'emerald' : wasCorrect ? 'amber' : 'rose'}
            >
              {wasCorrect
                ? attempts === 1
                  ? 'Designed correctly!'
                  : 'Correct (2nd try)'
                : 'Revealed'}
            </LuminaBadge>
            <span className="text-xs text-slate-500">
              {attempts} {attempts === 1 ? 'attempt' : 'attempts'}
            </span>
          </div>
        )}

        {/* Hypothesis reveal — assembled from the student's correct classifications */}
        {answered && hypothesisSentence && (
          <div className="p-3 rounded-xl bg-teal-500/10 border border-teal-500/20">
            <div className="text-[10px] font-mono uppercase tracking-widest text-teal-300/70 mb-1.5">
              Your hypothesis
            </div>
            <p className="text-sm text-teal-100 leading-relaxed">{hypothesisSentence}</p>
          </div>
        )}

        {/* Explanation */}
        {showExplanation && (
          <LuminaFeedbackCard status="insight">{explanation}</LuminaFeedbackCard>
        )}
      </div>
    </BlockWrapper>
  );
};

export default HypothesisLabBlock;
