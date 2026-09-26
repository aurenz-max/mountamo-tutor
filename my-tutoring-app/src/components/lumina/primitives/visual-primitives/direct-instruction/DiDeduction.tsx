'use client';

/**
 * DiDeduction — the second "DI for Older Learners" pack (design brief 2026-09-07, concept 3): a RULE
 * card, a CASE card, and the child SAYS what the rule tells them — and how they know.
 *
 * WHAT THE CHILD DOES. Sees "All insects have six legs." and "A beetle is an insect." and says "it has
 * six legs". On the harder shapes the case is "A spider does not have six legs." → "no, not an insect,
 * because…", or "This animal has six legs." → "can't tell — other things have six legs too."
 *
 * The Live tutor teaches it on the shared tutor/JEV workspace through `DiTeachingStage` (workspace
 * rollout C6; the judged runner is gone, one-path ruling 09-23). An unbound mount renders the stage's
 * visible "needs the tutor" card.
 *
 * THE SCREEN ONLY FOLLOWS — AND HERE IT SCRIBES. Every credited case writes its conclusion under the
 * cards, and its verdict word lights. Nothing the child must say is printed before they say it, which is
 * why the ledger is keyed to credited item ids. A wrong answer no longer closes a case, so there is no
 * tutor-carried conclusion to draw.
 */

import React, { useMemo } from 'react';
import type { DiDeductionMetrics, PrimitiveEvaluationResult } from '../../../evaluation/types';
import DiTeachingStage, { diStageMetrics, type DiStageView } from './DiTeachingStage';
import type { DeductionItem, DiDeductionData } from './diDeductionScript';
import { deductionAssignment, deductionItems, deductionScene } from './diDeductionWorkspace';

export type {
  DeductionChallengeType,
  DeductionItem,
  DeductionRuleSpec,
  DeductionSupportTier,
  DiDeductionData,
} from './diDeductionScript';

const VERDICT_WORDS: Array<{ key: 'yes' | 'no' | 'cannot_tell'; label: string }> = [
  { key: 'yes', label: 'yes' },
  { key: 'no', label: 'no' },
  { key: 'cannot_tell', label: "can't tell" },
];

const COPY = {
  empty: 'No rules were built for this objective.',
  title: 'Use the Rule', badge: 'Use the rule', prompt: 'Say what the rule tells you, and how you know, or ask for help.',
  heading: 'Rule Work Complete!', celebration: 'You reasoned through every case yourself.',
};

/** The rule, the case and, on a verdict case, the three spoken words as a guide. */
function stimulus(item: DeductionItem, marks: readonly string[], view: DiStageView) {
  const lit = view.committed.has(item.id) ? item.case.verdict : null;
  const ring = (id: string) => marks.includes(id) ? 'outline outline-2 outline-dashed outline-offset-4 outline-purple-400' : '';
  return <div className="space-y-4">
    <div data-deduction-object="rule" data-assignment-target="true" data-tutor-demonstration={marks.includes('rule')}
      className={`rounded-xl border border-cyan-300/30 bg-cyan-400/5 px-5 py-4 ${ring('rule')}`}>
      <div className="text-[10px] uppercase tracking-[0.3em] text-cyan-300/80">Rule</div>
      <div className="mt-1 text-2xl font-semibold text-slate-100">{item.ruleText}</div>
    </div>
    <div data-deduction-object="case" data-tutor-demonstration={marks.includes('case')}
      className={`rounded-xl border border-white/10 bg-white/5 px-5 py-4 ${ring('case')}`}>
      <div className="text-[10px] uppercase tracking-[0.3em] text-slate-400">Case</div>
      <div className="mt-1 text-2xl font-semibold text-slate-100">{item.case.caseText}</div>
    </div>
    {item.shape !== 'conclude' && <div className="rounded-lg border border-white/10 bg-white/[0.025] px-3 py-3" aria-label="Spoken verdict choices">
      <p className="mb-2 text-center text-xs font-medium text-slate-300">Say one, then explain using the rule</p>
      <div className="flex flex-wrap justify-center gap-2">
        {VERDICT_WORDS.map(word => <span key={word.key} data-verdict={word.key} data-lit={lit === word.key ? 'true' : 'false'}
          className={'rounded-full border px-4 py-1 text-sm uppercase tracking-widest transition-colors '
            + (lit === word.key ? 'border-emerald-300 bg-emerald-400/20 text-emerald-200' : 'border-cyan-300/20 bg-cyan-400/5 text-slate-300')}>
          {word.label}
        </span>)}
      </div>
    </div>}
  </div>;
}

/** The ledger: the credited conclusions of the rule on screen. */
function ledger(done: DeductionItem[], current: DeductionItem) {
  const written = done.filter(item => item.ruleId === current.ruleId);
  return written.length > 0 && <ul className="space-y-1 border-t border-white/10 pt-3" aria-label="what we know">
    {written.map(item => <li key={item.id} data-deduction-credited={item.id} className="text-lg text-emerald-300">
      {item.case.conclusionText}
    </li>)}
  </ul>;
}

/** A missed case recaps without its conclusion. */
const recapLabel = (item: DeductionItem, solved: boolean) =>
  solved ? item.case.conclusionText : item.case.caseText;

const ruleCounter = (item: DeductionItem, items: readonly DeductionItem[]) =>
  ({ current: item.ruleIndex + 1, total: new Set(items.map(candidate => candidate.ruleId)).size });

export interface DiDeductionProps {
  data: DiDeductionData & { onEvaluationSubmit?: (result: PrimitiveEvaluationResult<DiDeductionMetrics>) => void };
  index?: number;
  className?: string;
  runtimePlanItemId?: string;
  /** The RESOLVED eval mode from the live mount; never rebuilt from a label. */
  runtimeEvalMode?: string;
}

/** PLATFORM PROP CONTRACT: registry primitives mount as `<Component data={…} index={…} />`. */
export const DiDeduction: React.FC<DiDeductionProps> = ({ data, className, runtimePlanItemId, runtimeEvalMode }) => {
  const items = useMemo(() => deductionItems(data), [data]);
  const evalMode = runtimeEvalMode || data.challengeType || 'conclude';
  return <DiTeachingStage<DeductionItem, DiDeductionMetrics> primitiveId="di-deduction" data={data}
    items={items} evalMode={evalMode} className={className} runtimePlanItemId={runtimePlanItemId}
    assignment={deductionAssignment} scene={deductionScene} copy={COPY} stimulus={stimulus} trail={ledger}
    recapLabel={recapLabel} counter={ruleCounter}
    metrics={result => {
      const cannotTell = items.filter(item => item.shape === 'cannot_tell');
      const solved = new Set(result.outcomes.filter(outcome => outcome.solved).map(outcome => outcome.id));
      return { type: 'di-deduction', ...diStageMetrics(result, items, data.challengeType),
        ruleCount: new Set(items.map(item => item.ruleId)).size,
        cannotTellTotal: cannotTell.length, cannotTellCorrect: cannotTell.filter(item => solved.has(item.id)).length,
        meanResponseMs: null };
    }} />;
};

export default DiDeduction;
