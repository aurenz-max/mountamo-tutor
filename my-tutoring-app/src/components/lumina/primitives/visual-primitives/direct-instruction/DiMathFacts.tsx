'use client';

/**
 * DiMathFacts — DI family primitive #3: the child sees a printed problem
 * ("2 + 1", "5 →", a bare numeral) and says the answer's number word out loud,
 * and the Live tutor teaches it on the shared tutor/JEV workspace, on its boss
 * (`diMathFacts.card.ts` + `diMathFacts.boss.ts`).
 *
 * ANSWER-LEAK RULE: the stage shows the PRINTED PROBLEM ONLY — the answer never
 * appears before the child says it. The completed equation renders only after a
 * COMMITTED correct answer and in the recap for solved facts.
 *
 * The scripted DISTAR drill that used to run when no live runtime was mounted
 * was deleted in LA-14 S5 (qa/live-runtime-handoffs/13-delete-di-scripted-drills.md).
 * It also shipped a Tier-A misconception packet and silent per-fact response
 * timing; the workspace path reports neither yet (queued for
 * /add-misconception-loop). What it taught that is task structure lives in
 * `diMathFactsDomain`; an unbound mount renders a visible "needs the tutor"
 * state (`DiTeachingStage`).
 */

/**
 * The stage as a tutor/JEV teaching workspace (sixth adopter, after Counting Board, Shape Sorter, the number train,
 * di-letter-sounds and di-word-reading; the third DI pack to migrate).
 *
 * What the DI pedagogy KEEPS, because it is task structure rather than control
 * protocol: the child SAYS the answer out loud; the printed problem is the only
 * thing on the stage before the answer; counting to the answer is a legitimate
 * route whose direction depends on the skill; a different quantity is wrong
 * however close. What it loses is the requirement that the tutor say one exact
 * sentence and that the application read progression out of those words.
 *
 * WHAT IS DRAWN, AND WHY IT IS DRAWN THAT WAY
 *
 * THE ANSWER IS NOT THE STIMULUS — the inverse of di-word-reading, and the
 * reason this adopter is not a copy of it. There the tutor could be handed the
 * word freely, because it was already printed in front of the child. Here the
 * answer exists nowhere on screen, so handing it to the tutor (which the
 * assignment fact must do, or it cannot judge) creates a channel the screen
 * does not have: the tutor can SAY the answer before the child does. The screen
 * cannot block that, so the guidance does, and `askFor` never contains it.
 *
 * `name_numeral` inverts within the pack: the printed numeral IS the answer, so
 * its domain gate is inverted too and there is nothing to withhold.
 *
 * The printed terms are separate workspace objects on a computed fact, so
 * marking one is the real counting-on gesture — point at the 2, then count on
 * one more. A bare numeral has a single token, so it publishes no term targets
 * and the whole stimulus is the only thing to point at.
 *
 * THE REWARD-REVEAL DECISION, and where it departs from the standalone stage
 *
 * The standalone drill completes the fact IN PLACE ("2 + 1" becomes "2 + 1 = 3",
 * emerald, for a held beat) and shows nothing else, because a user browser check
 * (2026-07-25) found two facts on screen at once to be overload at this age.
 * That beat depends on a `phase === 'affirmed'` window, and this path has none.
 * So the completed fact is keyed on the COMMITTED attempt instead, as
 * di-word-reading's read-words trail is, and it is rendered small and secondary
 * beneath the stage rather than at stimulus size. That keeps one large fact on
 * the stage — the overload finding's actual subject — while every affirmed fact
 * still gets its visible receipt.
 *
 * LEVERS (`diMathFactsLevers.ts`, user ruling 2026-10-02). The help levers draw beside or under the
 * problem, never in place of it: a solved model card of a DIFFERENT fact (DI's "my turn" on a parallel
 * item, small and secondary for the same overload reason), dots under each printed number, take-away
 * dots, and a number path ending in an empty box. None of them draws this problem's answer. A simplify
 * lever puts an easier fact on the stage, ungraded.
 *
 * The workspace binding, evaluation, lever state, recap and Pip are `DiTeachingStage`; the assignment is the boss's
 * (`diMathFacts.boss.ts`).
 */

import React, { useMemo } from 'react';
import type { PrimitiveEvaluationResult, DiMathFactsMetrics } from '../../../evaluation/types';
import DiTeachingStage, { diStageMetrics, type DiStageView } from './DiTeachingStage';
import { buildMathFactItems, workspaceScene, type DiMathFactsChallenge, type DiMathFactsChallengeType, type MathFactItem }
  from './diMathFactsDomain';
import { DOTS_LEVER, MATH_FACT_LEVERS, MODEL_LEVER, PATH_LEVER, TAKE_AWAY_LEVER, dotGroups, modelFor, numberPath,
  takeAwayDots } from './diMathFactsLevers';
import { diMathFactsBoss } from './diMathFacts.boss';
import { DiModelCard } from './DiModelCard';

export type { DiMathFactsChallenge, DiMathFactsChallengeType, DiMathFactsSupportTier } from './diMathFactsDomain';

export interface DiMathFactsData {
  title: string;
  description: string;
  /** Printed facts. REQUIRED. Built by the scoped fact pool. */
  challenges: DiMathFactsChallenge[];
  /** Session core task identity — the resolved/primary eval-mode skill. */
  challengeType: DiMathFactsChallengeType;
  /** Flat "2 + 1, 3 + 1" item-set summary (printed problems only, never the
   *  answers), attached by the generator for the tutoring scaffold's RUNTIME
   *  STATE (catalog contextKey `facts`). */
  facts?: string;
  gradeLevel?: string;

  // Evaluation props (auto-injected by ManifestOrderRenderer)
  instanceId?: string;
  skillId?: string;
  subskillId?: string;
  objectiveId?: string;
  exhibitId?: string;
  componentIntent?: string;
  objectiveText?: string;
  onEvaluationSubmit?: (result: PrimitiveEvaluationResult<DiMathFactsMetrics>) => void;
}

export interface DiMathFactsProps {
  data: DiMathFactsData;
  index?: number;
  className?: string;
  runtimePlanItemId?: string;
  /** The RESOLVED eval mode from the live mount; never rebuilt from a label. */
  runtimeEvalMode?: string;
}

const COPY = {
  empty: 'These facts are still being prepared. Try generating this practice again.',
  title: 'Math Facts', badge: 'Say it out loud', prompt: 'Say the answer out loud, or ask for help.',
  heading: 'Great work today!', celebration: 'You answered every fact!',
};

/** The levers read nothing beyond the item, so one binding serves every lesson. */
const LEVERS = MATH_FACT_LEVERS.bind(null);

/** Dots in rows of five, so a group is seen rather than counted one by one. `crossed` marks the last ones. */
function Dots({ count, crossed = 0, group }: { count: number; crossed?: number; group: number }) {
  const rows = Array.from({ length: Math.ceil(count / 5) }, (_, row) =>
    Array.from({ length: Math.min(5, count - row * 5) }, (_, k) => row * 5 + k));
  return <div data-dot-group={group} data-dots={count} data-crossed={crossed || undefined}
    className="flex flex-col items-center gap-1 pt-2">
    {rows.map((row, r) => <div key={r} className="flex gap-1">
      {row.map(k => {
        const out = k >= count - crossed;
        return <span key={k} data-dot-crossed={out || undefined}
          className={`relative inline-block h-3 w-3 rounded-full ${out ? 'bg-slate-500/50' : 'bg-amber-300'}`}>
          {out && <span aria-hidden="true"
            className="absolute inset-0 flex items-center justify-center text-[10px] font-bold leading-none text-rose-300">✕</span>}
        </span>;
      })}
    </div>)}
  </div>;
}

/** The printed problem, with whatever help levers are on screen. No answer, no equals sign, no worked
 *  form joins it before the child speaks: computing it IS the skill. */
function stimulus(item: MathFactItem, marks: readonly string[], view: DiStageView) {
  const groups = view.pulled.includes(DOTS_LEVER) ? dotGroups(item) : null;
  const take = view.pulled.includes(TAKE_AWAY_LEVER) ? takeAwayDots(item) : null;
  const path = view.pulled.includes(PATH_LEVER) ? numberPath(item) : null;
  const model = view.pulled.includes(MODEL_LEVER) ? modelFor(item) : null;
  let numeral = -1;
  return <div className="flex flex-col items-center gap-4">
    <div className="flex flex-wrap items-center justify-center gap-4">
      <div data-fact-object="problem" data-assignment-target="true" data-practice-item={view.practice || undefined}
        data-tutor-demonstration={marks.includes('problem')}
        aria-label={`The problem ${item.display}`}
        className={`flex items-start gap-3 rounded-2xl border-2 border-amber-300 bg-amber-400/10 px-10 py-4 text-7xl font-bold tracking-wide text-white ${
          marks.includes('problem') ? 'outline outline-2 outline-dashed outline-offset-4 outline-purple-400' : ''}`}>
        {item.terms.length
          ? item.terms.map((term, position) => {
            const isNumber = /^[0-9]+$/.test(term);
            if (isNumber) numeral++;
            const dots = groups && isNumber ? groups[numeral] : undefined;
            const takeAway = take && isNumber && numeral === 0 ? take : null;
            return <span key={position} className="flex flex-col items-center">
              <span data-fact-term={position}
                data-tutor-demonstration={marks.includes(`term-${position}`)}
                className={`rounded-lg px-1 ${marks.includes(`term-${position}`)
                  ? 'outline outline-2 outline-dashed outline-offset-2 outline-purple-400' : ''}`}>
                {term}
              </span>
              {dots !== undefined && <Dots count={dots} group={numeral} />}
              {takeAway && <Dots count={takeAway.total} crossed={takeAway.crossed} group={0} />}
            </span>;
          })
          : <span>{item.display}</span>}
      </div>
      {model && <DiModelCard lever={MODEL_LEVER} data-model-fact={model.display}
        aria-label={`My turn: ${model.problem} is ${model.answerWord}`} className="flex flex-col items-center gap-1">
        <span className="text-3xl font-semibold">
          {model.challengeType === 'name_numeral' ? model.display : model.solvedDisplay}
        </span>
      </DiModelCard>}
    </div>
    {path && <div data-lever={PATH_LEVER} aria-label="A number path ending in an empty box" className="flex items-center gap-2">
      {path.map(n => <span key={n} data-path-number={n}
        className="rounded-lg border border-slate-500/60 bg-slate-800/60 px-3 py-1 text-3xl font-semibold text-slate-100">{n}</span>)}
      <span data-path-box="empty" className="h-11 w-14 rounded-lg border-2 border-dashed border-amber-300/80" />
    </div>}
  </div>;
}

/** The reward reveal: only facts the observer has already credited. */
function solvedFacts(solved: MathFactItem[]) {
  return solved.length > 0 && <div className="flex flex-wrap justify-center gap-2" aria-label="Facts you have answered">
    {solved.map(done => <div key={done.id} data-fact-solved={done.answerNumeral}
      className="flex items-center gap-2 rounded-xl border border-emerald-400/40 bg-emerald-500/10 px-3 py-1">
      <span className="text-lg font-semibold text-white">{done.solvedDisplay}</span>
      <span className="text-xl leading-none" aria-hidden="true">✅</span>
    </div>)}
  </div>;
}

/** A missed fact recaps by its PROBLEM, never its solved form: the recap must not
 *  print an answer the child never produced. */
const recapLabel = (item: MathFactItem, solved: boolean) => solved ? item.solvedDisplay : item.display;

/** PLATFORM PROP CONTRACT: registry primitives mount as
 *  `<Component data={…} index={…} />` — the generated data arrives as ONE `data`
 *  prop (evaluation props merged in), never spread across props. */
export const DiMathFacts: React.FC<DiMathFactsProps> = ({ data, className, runtimePlanItemId, runtimeEvalMode }) => {
  const items = useMemo(() => buildMathFactItems(data.challenges), [data.challenges]);
  // `meanResponseMs` is the standalone drill's tutor-audio-fall timing. The workspace
  // does not measure it, and reporting a number this path never took would make a
  // silent signal quietly wrong.
  return <DiTeachingStage<MathFactItem, DiMathFactsMetrics> primitiveId="di-math-facts" data={data}
    items={items} runtimeEvalMode={runtimeEvalMode} className={className} runtimePlanItemId={runtimePlanItemId}
    assignment={diMathFactsBoss.assignment} scene={workspaceScene} copy={COPY} stimulus={stimulus} trail={solvedFacts}
    recapLabel={recapLabel} levers={LEVERS}
    metrics={result => ({ type: 'di-math-facts', ...diStageMetrics(result, items, data.challengeType), meanResponseMs: null })} />;
};

export default DiMathFacts;
