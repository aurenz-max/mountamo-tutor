'use client';

/**
 * DiDiceRoll — a DI-native dice quantity, comparison, and addition primitive. The child taps the die
 * itself, watches a deterministic controlled roll, and answers aloud: how many dots, which die has
 * more, or how many altogether. The finalized value lives in challenge data before the animation
 * starts; intermediate faces are presentational and never announced.
 *
 * The Live tutor teaches it on the shared tutor/JEV workspace through `DiTeachingStage` (workspace
 * rollout C6; the judged runner is gone, one-path ruling 09-23). The roll is the learner's own act and
 * never an answer: until the dice land the workspace is not ready for a response. An unbound mount
 * renders the stage's visible "needs the tutor" card.
 *
 * LEVERS (`diDiceRollLevers.ts`, DI family 2). A small "my turn" card with a DIFFERENT roll, solved; dots
 * on the child's own dice that can be tapped and ringed (so the rolled dice live outside the roll button,
 * which a disabled button would swallow taps for); a bracket under both dice for a sum. None of them draws
 * or counts the child's answer.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion } from '../../../ui';
import type { DiDiceRollMetrics, PrimitiveEvaluationResult } from '../../../evaluation/types';
import { SoundManager } from '../../../utils/SoundManager';
import DiTeachingStage, { diStageMetrics, type DiStageLevers, type DiStageView } from './DiTeachingStage';
import { diceValuesFor, isTwoDiceChallenge, type DiDiceRollChallenge, type DiDiceRollChallengeType,
  type DieValue } from './diDiceRollScript';
import { diceAssignment, diceScene } from './diDiceRollWorkspace';
import { BRACKET_LEVER, MODEL_LEVER, TOUCH_LEVER, diceLeverFacts, diceLevers, modelFor, simplerRoll,
  startingLevers } from './diDiceRollLevers';

export type {
  DiDiceRollChallenge,
  DiDiceRollChallengeType,
  DiceComparison,
  DiDiceRollSupportTier,
  DieValue,
} from './diDiceRollScript';

export type DieSides = 6 | 8 | 10 | 12 | 20;

export interface DieProps {
  value: number;
  sides?: DieSides;
  representation?: 'pips' | 'numeral';
  size?: 'sm' | 'md' | 'lg';
  appearance?: 'rounded' | 'classic' | 'soft';
  rolling?: boolean;
  ariaLabel?: string;
  className?: string;
  /** `touch_dots`: the pip cells (0-8) the learner has tapped. */
  ringed?: ReadonlySet<number>;
  /** `touch_dots`: present = each pip is a tap target. Absent = pips are not tappable. */
  onPipTap?: (cell: number) => void;
}

export interface DiDiceRollData {
  title: string;
  description: string;
  /** 3-6 controlled rolls. REQUIRED. Built by the local value/pair pools. */
  challenges: DiDiceRollChallenge[];
  /** Representative metadata; mixed sessions render from each challenge's type. */
  challengeType: DiDiceRollChallengeType;
  appearance?: DieProps['appearance'];
  gradeLevel?: string;

  // Evaluation props (auto-injected by ManifestOrderRenderer)
  instanceId?: string;
  skillId?: string;
  subskillId?: string;
  objectiveId?: string;
  exhibitId?: string;
  componentIntent?: string;
  objectiveText?: string;
  onEvaluationSubmit?: (result: PrimitiveEvaluationResult<DiDiceRollMetrics>) => void;
}

const PIP_POSITIONS: Record<number, ReadonlySet<number>> = {
  1: new Set([4]),
  2: new Set([0, 8]),
  3: new Set([0, 4, 8]),
  4: new Set([0, 2, 6, 8]),
  5: new Set([0, 2, 4, 6, 8]),
  6: new Set([0, 2, 3, 5, 6, 8]),
};

const DIE_SIZE: Record<NonNullable<DieProps['size']>, string> = {
  sm: 'h-16 w-16 p-2.5',
  md: 'h-24 w-24 p-4',
  lg: 'h-32 w-32 p-5',
};

const PIP_SIZE: Record<NonNullable<DieProps['size']>, string> = {
  sm: 'h-2.5 w-2.5',
  md: 'h-3.5 w-3.5',
  lg: 'h-5 w-5',
};

const DIE_APPEARANCE: Record<NonNullable<DieProps['appearance']>, string> = {
  rounded: 'rounded-[1.75rem] border-2 border-violet-200/70 bg-white shadow-[0_10px_0_rgba(196,181,253,0.55),0_18px_35px_rgba(15,23,42,0.28)]',
  classic: 'rounded-2xl border-2 border-slate-300 bg-white shadow-[0_9px_0_rgba(148,163,184,0.45),0_16px_30px_rgba(15,23,42,0.25)]',
  soft: 'rounded-[2rem] border border-violet-200/50 bg-violet-50 shadow-[0_9px_0_rgba(196,181,253,0.42),0_16px_30px_rgba(15,23,42,0.22)]',
};

/** Reusable controlled visual. It never generates values or owns scoring. */
export const Die: React.FC<DieProps> = ({
  value,
  sides = 6,
  representation = 'pips',
  size = 'lg',
  appearance = 'rounded',
  rolling = false,
  ariaLabel = 'Die with a dot pattern',
  className = '',
  ringed,
  onPipTap,
}) => {
  const valid = Number.isInteger(value) && value >= 1 && value <= sides;
  const showPips = valid && representation === 'pips' && sides === 6;
  const occupied = showPips ? PIP_POSITIONS[value] : undefined;

  return (
    <div
      role="img"
      aria-label={ariaLabel}
      className={`grid grid-cols-3 grid-rows-3 place-items-center text-4xl font-bold text-violet-700 transition-transform ${DIE_SIZE[size]} ${DIE_APPEARANCE[appearance]} ${rolling ? 'animate-bounce motion-reduce:animate-none' : ''} ${className}`}
    >
      {showPips
        ? Array.from({ length: 9 }, (_, index) => onPipTap && occupied?.has(index)
          ? <button key={index} type="button" data-pip-tap={index} data-ringed={ringed?.has(index) ?? false}
              aria-label="A dot" onClick={() => onPipTap(index)}
              className={`${PIP_SIZE[size]} rounded-full bg-violet-600 shadow-sm ${ringed?.has(index) ? 'ring-4 ring-amber-400 ring-offset-2' : ''}`} />
          : (
            <span
              key={index}
              aria-hidden="true"
              className={occupied?.has(index)
                ? `${PIP_SIZE[size]} rounded-full bg-violet-600 shadow-sm`
                : PIP_SIZE[size]}
            />
          ))
        : (
            <span aria-hidden="true" className="col-span-3 row-span-3 self-center">
              {valid ? value : '?'}
            </span>
          )}
    </div>
  );
};

const rollFrames = (target: DieValue): DieValue[] => [
  ((target + 1) % 6 + 1) as DieValue,
  ((target + 3) % 6 + 1) as DieValue,
  ((target + 4) % 6 + 1) as DieValue,
  ((target + 2) % 6 + 1) as DieValue,
  target,
];

const ROLL_START_DELAY_MS = 60;
const ROLL_FRAME_MS = 90;

const COPY = {
  empty: 'No dice practice was built for this objective.',
  title: 'Dice Time', badge: 'Roll & say', prompt: 'Roll, then say the answer out loud, or ask for help.',
  heading: 'Dice Practice Complete!', celebration: 'You rolled, looked, and answered out loud!',
};

const headline = (item: DiDiceRollChallenge) => item.challengeType === 'compare_dice'
  ? item.comparison === 'same' ? 'Same amount' : `${item.comparison === 'left' ? 'Left' : 'Right'} has more`
  : item.spokenAnswer;
const detail = (item: DiDiceRollChallenge) => item.challengeType === 'count_pips'
  ? `${item.value} ${item.value === 1 ? 'dot' : 'dots'}`
  : item.challengeType === 'sum_two_dice'
    ? `${item.value} + ${item.secondValue} = ${item.total}`
    : `${item.value} dots · ${item.secondValue} dots`;

const answerNumber = (item: DiDiceRollChallenge) => item.challengeType === 'sum_two_dice' ? item.total : item.value;

/** `model_roll`: a different roll, solved, small and apart from the child's dice (DI's "my turn"). */
function ModelRoll({ item }: { item: DiDiceRollChallenge }) {
  const model = modelFor(item);
  if (!model) return null;
  const faces = diceValuesFor(model);
  const star = model.challengeType === 'compare_dice' ? (model.comparison === 'left' ? 0 : 1) : -1;
  return <div data-lever={MODEL_LEVER} data-model-roll={faces.join('-')}
    aria-label={`My turn: a different roll, ${model.spokenAnswer}`}
    className="mt-5 flex items-center gap-3 rounded-xl border-2 border-dashed border-purple-400/70 bg-purple-500/10 px-4 py-2">
    <span aria-hidden="true" className="text-xl leading-none">🗣️</span>
    {faces.map((value, index) => <div key={index} className="flex flex-col items-center">
      <span aria-hidden="true" data-model-star={index === star || undefined} className="h-5 text-base leading-none">{index === star ? '⭐' : ''}</span>
      <Die value={value} size="sm" className="!h-12 !w-12 !p-1.5" />
    </div>)}
    {model.challengeType !== 'compare_dice' && <span className="text-3xl font-semibold text-purple-100">= {answerNumber(model)}</span>}
  </div>;
}

/** The covered dice, the controlled roll, and, once credited, the answer under them. Keyed by item, so
 *  a new item starts covered; Try again keeps the roll. */
const DiceStage: React.FC<{ item: DiDiceRollChallenge; view: DiStageView; marked: boolean;
  appearance?: DieProps['appearance'] }> = ({ item, view, marked, appearance }) => {
  const [displayed, setDisplayed] = useState<DieValue[] | null>(view.ready ? [...diceValuesFor(item)] : null);
  const [rolling, setRolling] = useState(false);
  const [ringed, setRinged] = useState<ReadonlySet<string>>(new Set());
  const timers = useRef<number[]>([]);
  useEffect(() => () => timers.current.forEach(timer => window.clearTimeout(timer)), []);
  const { markReady } = view;
  const roll = useCallback(() => {
    if (rolling || displayed != null) return;
    SoundManager.tap();
    // The faces are final before the animation starts, so the item is answerable from the tap: a
    // learner who speaks while the dice tumble is not answering too early for the workspace.
    markReady();
    const targets = [...diceValuesFor(item)];
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      setDisplayed(targets); SoundManager.snap(); return;
    }
    setRolling(true);
    const frames = targets.map(rollFrames);
    frames[0].forEach((_frame, index) => {
      timers.current.push(window.setTimeout(() => {
        setDisplayed(frames.map(dieFrames => dieFrames[index]));
        if (index === frames[0].length - 1) { SoundManager.snap(); setRolling(false); }
        else SoundManager.tick();
      }, ROLL_START_DELAY_MS + index * ROLL_FRAME_MS));
    });
  }, [displayed, item, markReady, rolling]);

  const two = isTwoDiceChallenge(item);
  const credited = view.committed.has(item.id);
  // Rings mark only what the learner taps: no number, no order.
  const touch = view.pulled.includes(TOUCH_LEVER) && !rolling && displayed != null;
  const tap = (die: number, cell: number) => {
    SoundManager.tap();
    setRinged(prev => {
      const next = new Set(prev), key = `${die}-${cell}`;
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };
  const ringsOn = (die: number) => new Set(Array.from(ringed).filter(k => k.startsWith(`${die}-`)).map(k => Number(k.split('-')[1])));
  const label = displayed == null ? (two ? 'Roll both dice' : 'Roll the die')
    : item.challengeType === 'compare_dice' ? 'Two dice with dot patterns. Say which has more: left, right, or same.'
      : two ? 'Two dice with dot patterns. Say how many dots there are altogether.'
        : 'Die with a dot pattern. Say how many dots you see.';
  const dice = <>
    <div className="flex items-end justify-center gap-5 sm:gap-8">
      {Array.from({ length: two ? 2 : 1 }, (_, dieIndex) => (
        <div key={dieIndex} className="flex flex-col items-center gap-2">
          {item.challengeType === 'compare_dice' && <span aria-hidden="true"
            className="text-xs font-bold uppercase tracking-[0.22em] text-slate-300">{dieIndex === 0 ? 'Left' : 'Right'}</span>}
          {displayed == null
            ? <div aria-hidden="true" className={`${two ? 'h-24 w-24' : 'h-32 w-32'} grid place-items-center rounded-[1.75rem] border-2 border-dashed border-violet-300/60 bg-violet-500/10 text-4xl font-semibold text-violet-200`}>?</div>
            : <Die value={displayed[dieIndex]} size={two ? 'md' : 'lg'} rolling={rolling} appearance={appearance}
              ariaLabel={item.challengeType === 'compare_dice' ? `${dieIndex === 0 ? 'Left' : 'Right'} die with a dot pattern` : 'Die with a dot pattern'}
              className={credited ? motion.pop : motion.reveal}
              {...(touch ? { onPipTap: (cell: number) => tap(dieIndex, cell), ringed: ringsOn(dieIndex) } : {})} />}
        </div>
      ))}
    </div>
    {view.pulled.includes(BRACKET_LEVER) && two && <div data-lever={BRACKET_LEVER} aria-label="All the dots on both dice"
      className="mx-auto mt-3 h-4 w-full rounded-b-xl border-x-4 border-b-4 border-amber-300/80" />}
  </>;
  return <div data-dice-object="dice" data-assignment-target="true" data-tutor-demonstration={marked}
    data-practice-item={view.practice || undefined}
    className={`flex min-h-64 flex-col items-center justify-center rounded-2xl border border-violet-400/20 bg-violet-500/5 py-8 ${marked ? 'outline outline-2 outline-dashed outline-offset-4 outline-purple-400' : ''}`}>
    {/* Once rolled, the dice leave the roll button: a disabled button would swallow taps on their dots. */}
    {displayed == null || rolling
      ? <button type="button" onClick={roll} disabled={rolling} aria-label={label}
        className="rounded-[2rem] p-2 outline-none transition-transform hover:scale-[1.03] focus-visible:ring-4 focus-visible:ring-violet-400/70 disabled:cursor-default disabled:hover:scale-100">
        {dice}
      </button>
      : <div role="group" aria-label={label} className="rounded-[2rem] p-2">{dice}</div>}
    {view.pulled.includes(MODEL_LEVER) && <ModelRoll item={item} />}
    {credited && <div className={`mt-5 text-center ${motion.pop}`} data-dice-credited={item.id}>
      <div className="text-4xl font-bold capitalize text-emerald-300">{headline(item)}</div>
      <div className="mt-1 text-lg font-semibold text-emerald-200">{detail(item)}</div>
    </div>}
  </div>;
};

const LEVERS: DiStageLevers<DiDiceRollChallenge> = {
  declare: diceLevers, onScreen: diceLeverFacts, starting: startingLevers, simpler: simplerRoll,
};

/** Credited rolls, each drawn small with its answer. */
function creditedRolls(done: DiDiceRollChallenge[]) {
  return done.length > 0 && <div className="flex flex-wrap justify-center gap-2" aria-label="Rolls you have answered">
    {done.map(item => <div key={item.id} data-dice-trail={item.id}
      className="flex items-center gap-2 rounded-xl border border-emerald-400/40 bg-emerald-500/10 px-3 py-1">
      {diceValuesFor(item).map((value, index) => <Die key={index} value={value} size="sm" className="!h-8 !w-8 !p-1" />)}
      <span className="text-sm font-semibold text-emerald-200">{headline(item)}</span>
    </div>)}
  </div>;
}

/** A missed roll recaps without its answer. */
const recapLabel = (item: DiDiceRollChallenge, solved: boolean) =>
  solved ? `${headline(item)} (${detail(item)})` : item.challengeType === 'count_pips' ? 'Count the dots'
    : item.challengeType === 'compare_dice' ? 'Compare the dice' : 'Add the dice';

export interface DiDiceRollProps {
  data: DiDiceRollData;
  index?: number;
  className?: string;
  runtimePlanItemId?: string;
  /** The RESOLVED eval mode from the live mount; never rebuilt from a label. */
  runtimeEvalMode?: string;
}

/** PLATFORM PROP CONTRACT: registry primitives mount as `<Component data={…} index={…} />`. */
export const DiDiceRoll: React.FC<DiDiceRollProps> = ({ data, className, runtimePlanItemId, runtimeEvalMode }) => {
  const items = useMemo(() => data.challenges ?? [], [data.challenges]);
  return <DiTeachingStage<DiDiceRollChallenge, DiDiceRollMetrics> primitiveId="di-dice-roll" data={data}
    items={items} runtimeEvalMode={runtimeEvalMode} className={className} runtimePlanItemId={runtimePlanItemId}
    assignment={diceAssignment} scene={diceScene} copy={COPY} recapLabel={recapLabel} trail={creditedRolls}
    awaitsStimulus levers={LEVERS}
    stimulus={(item, marks, view) => <DiceStage key={item.id} item={item} view={view} marked={marks.includes('dice')}
      appearance={data.appearance} />}
    metrics={result => ({ type: 'di-dice-roll', ...diStageMetrics(result, items, data.challengeType),
      challengeTypesTested: Array.from(new Set(items.map(challenge => challenge.challengeType))), meanResponseMs: null })} />;
};

export default DiDiceRoll;
