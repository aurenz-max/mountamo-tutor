'use client';

import React, { useCallback, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bug, ChevronDown, Lock } from 'lucide-react';
import { Card } from '../../ui/card';
import { Button } from '../../ui/button';
import { KaTeX, MixedContent } from './annotated-example/StepContentRenderer';
import { RichStepCard } from './annotated-example/RichStepCard';
import { InsetRenderer, isGateableInset } from './problem-primitives/insets/InsetRenderer';
import type {
  ChallengeAssignment,
  RichAnnotatedExampleData,
  SolverDebugPayload,
  StepSpec,
} from './annotated-example/types';

// ═══════════════════════════════════════════════════════════════════════
// AnnotatedExample — pre-hydrated worked example.
//
// The orchestrator authors the problem upstream and the pipeline hydrates
// the worked solution before mount. The primitive renders the example with
// annotation layers and challenger gates. Practice on a sibling problem
// lives in the standalone `PracticeProblem` primitive — this component is
// pure Watch.
// ═══════════════════════════════════════════════════════════════════════

interface AnnotatedExampleProps {
  data: RichAnnotatedExampleData;
  className?: string;
  showDebug?: boolean;
}

export const AnnotatedExample: React.FC<AnnotatedExampleProps> = (props) => (
  <AnnotatedExampleSession key={JSON.stringify(props.data)} {...props} />
);

const AnnotatedExampleSession: React.FC<AnnotatedExampleProps> = ({ data, className, showDebug = false }) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [visitedStep, setVisitedStep] = useState(0);
  const [completions, setCompletions] = useState<Record<number, boolean>>({});
  const insetGateable = isGateableInset(data.problem.inset);
  const [insetComplete, setInsetComplete] = useState(!insetGateable);
  const reportCompletion = useCallback((idx: number, complete: boolean) => {
    setCompletions((prev) => prev[idx] === complete ? prev : { ...prev, [idx]: complete });
  }, []);
  const isComplete = (idx: number) => {
    if (completions[idx] !== undefined) return completions[idx];
    const step = data.steps[idx];
    return step.content.type === 'algebra'
      ? step.content.transitions.length <= 1 && !step.content.transitions.some((transition) => transition.challenge)
      : !step.challenge;
  };
  const canContinue = insetComplete && isComplete(currentStep);

  return (
    <div className={`max-w-3xl mx-auto font-sans text-slate-200 ${className || ''}`}>
      <div className="mb-6 space-y-4">
        <h1 className="text-2xl font-semibold text-white tracking-tight">{data.title}</h1>
        <Card className="bg-slate-900/60 border-white/10 p-4 sm:p-6">
          <p className="text-sm text-blue-300 mb-3">Let&apos;s work it out</p>
          {data.problem.equations?.map((eq, i) => (
            <div key={i} className="text-xl overflow-x-auto"><KaTeX latex={eq} /></div>
          ))}
          <p className="text-lg leading-relaxed"><MixedContent text={data.problem.statement} /></p>
          {data.problem.inset && <InsetRenderer inset={data.problem.inset} onCompletionChange={insetGateable ? setInsetComplete : undefined} />}
          {data.problem.context && <details className="mt-3">
            <summary className="cursor-pointer text-sm text-slate-400">More about the problem</summary>
            <p className="mt-2 leading-relaxed"><MixedContent text={data.problem.context} /></p>
          </details>}
        </Card>
        {data.solutionStrategy && insetComplete && data.steps.every((_, idx) => isComplete(idx)) && <details className="rounded-xl border border-white/10 px-4 py-3">
          <summary className="cursor-pointer text-sm text-slate-300">Our plan</summary>
          <p className="mt-2 leading-relaxed"><MixedContent text={data.solutionStrategy} /></p>
        </details>}
        {showDebug && data.solverDebug && <PipelineDebugCard debug={data.solverDebug} renderedStepCount={data.steps.length} />}
      </div>
      <section aria-label="Worked solution" className="space-y-4">
        <p className="text-sm text-slate-400" aria-live="polite">Step {currentStep + 1} of {data.steps.length}</p>
        {data.steps.slice(0, visitedStep + 1).map((step, idx) => (
          <div key={step.id} hidden={idx !== currentStep}>
            {insetComplete ? <RichStepCard
              step={step} index={idx} activeLayers={[]} optionalAnnotations isCompact
              interactive={data.interactive !== false}
              onCompletionChange={(complete) => reportCompletion(idx, complete)}
            /> : <LockedStepPlaceholder index={idx} total={data.steps.length} />}
          </div>
        ))}
        <div className="flex items-center justify-between gap-3 border-t border-white/10 pt-4">
          <Button variant="ghost" disabled={currentStep === 0} onClick={() => setCurrentStep((step) => step - 1)}>Back</Button>
          {currentStep < data.steps.length - 1 ? (
            <Button disabled={!canContinue} onClick={() => {
              setVisitedStep((step) => Math.max(step, currentStep + 1));
              setCurrentStep((step) => step + 1);
            }}>Next step</Button>
          ) : canContinue ? <p className="text-sm text-emerald-300">You reached the last step.</p>
            : <p className="text-sm text-slate-400">Try the question above.</p>}
        </div>
      </section>
    </div>
  );
};

const LockedStepPlaceholder: React.FC<{ index: number; total: number }> = ({ index, total }) => {
  return (
    <div className="relative z-10 pb-8 last:pb-0">
      <div className="flex gap-4">
        <div className="flex-shrink-0">
          <div className="w-10 h-10 rounded-full bg-slate-900 border-2 border-slate-800 flex items-center justify-center font-bold text-slate-600 shadow-sm">
            {index + 1}
          </div>
        </div>
        <Card className="flex-grow min-w-0 bg-slate-900/20 border border-dashed border-slate-700/50 p-5">
          <div className="flex items-center gap-2 text-slate-400">
            <Lock size={14} className="text-amber-400/70" />
            <p className="text-sm">
              Step {index + 1} of {total} is locked. Answer the prompt above to unlock it.
            </p>
          </div>
        </Card>
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════
// Pipeline Debug Card — solver blocks vs planner specs vs rendered steps.
// Coverage check replaces the old 1:1 block→step invariant: every block
// should appear in some spec's groundingBlockIndices, and any injected step
// (no grounding) is flagged so the planner can't sneak in a phantom primitive.
// ═══════════════════════════════════════════════════════════════════════

const PipelineDebugCard: React.FC<{
  debug: SolverDebugPayload;
  renderedStepCount: number;
}> = ({ debug, renderedStepCount }) => {
  const [open, setOpen] = useState(false);
  const blockCount = debug.blocks.length;
  const specCount = debug.planner.specs.length;
  const renderFailures = specCount - renderedStepCount;
  const challengeCount = debug.challenger?.assignments.length ?? 0;
  const challengeDropped = debug.challenger?.dropped.length ?? 0;
  const challengerFailed = debug.challenger?.failed ?? false;

  const summaryColor = renderFailures > 0 || debug.planner.unusedBlockIndices.length > 0
    ? 'text-red-400'
    : 'text-slate-300';

  return (
    <Card className="backdrop-blur-xl bg-slate-900/40 border-amber-500/20 overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full px-5 py-3 flex items-center gap-3 text-left hover:bg-amber-500/5 transition-colors"
      >
        <Bug size={14} className="text-amber-400 flex-shrink-0" />
        <div className="flex-grow min-w-0">
          <p className="text-xs text-amber-400 uppercase tracking-wider font-medium">Pipeline Debug</p>
          <p className="text-xs text-slate-500 mt-0.5">
            Solver <span className="text-slate-300 font-medium">{blockCount}</span> blocks ·
            Planner <span className="text-slate-300 font-medium">{specCount}</span> specs
            {debug.planner.mergedCount > 0 && <span className="text-cyan-400"> ({debug.planner.mergedCount} merged)</span>}
            {debug.planner.injectedCount > 0 && <span className="text-violet-400"> ({debug.planner.injectedCount} injected)</span>}
            {' · '}
            Rendered <span className={summaryColor + ' font-medium'}>{renderedStepCount}</span>
            {renderFailures > 0 && <span className="ml-2 text-red-400">⚠ {renderFailures} failed</span>}
            {debug.planner.unusedBlockIndices.length > 0 && (
              <span className="ml-2 text-red-400">⚠ {debug.planner.unusedBlockIndices.length} unused block(s)</span>
            )}
            {debug.planner.fallback && <span className="ml-2 text-amber-400">⚠ planner fallback</span>}
            {debug.challenger && (
              <>
                {' · '}
                Challenges <span className="text-fuchsia-400 font-medium">{challengeCount}</span>
                {challengeDropped > 0 && <span className="ml-2 text-red-400">⚠ {challengeDropped} dropped</span>}
                {challengerFailed && <span className="ml-2 text-amber-400">⚠ challenger failed</span>}
              </>
            )}
          </p>
        </div>
        <ChevronDown
          size={14}
          className={`text-slate-500 flex-shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden border-t border-amber-500/10"
          >
            <div className="px-5 py-4 grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Left: planner specs (drives the render) */}
              <div className="space-y-2">
                <p className="text-[10px] text-slate-500 uppercase tracking-wider font-medium mb-2">
                  Planner Specs ({specCount}) — each becomes one rendered step
                </p>
                {debug.planner.specs.map((spec, i) => (
                  <PlannerSpecRow key={i} spec={spec} index={i} />
                ))}
                {debug.planner.unusedBlockIndices.length > 0 && (
                  <div className="text-sm leading-relaxed rounded p-3 border-l-2 bg-red-500/5 border-red-500/40">
                    <p className="text-[10px] uppercase tracking-wider font-medium text-red-400 mb-1">
                      Unused solver blocks
                    </p>
                    <p className="text-xs text-slate-400">
                      Block(s) [{debug.planner.unusedBlockIndices.join(', ')}] were dropped by the planner.
                    </p>
                  </div>
                )}
              </div>

              {/* Right: solver blocks (raw input) */}
              <div className="space-y-2">
                <p className="text-[10px] text-slate-500 uppercase tracking-wider font-medium mb-2">
                  Solver Blocks ({blockCount}) — raw strategic moves
                </p>
                {debug.blocks.map((block) => (
                  <div
                    key={block.index}
                    className="text-sm leading-relaxed rounded p-3 border-l-2 bg-slate-800/30 border-emerald-500/40"
                  >
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="text-[10px] uppercase tracking-wider font-medium text-slate-500">
                        Block {block.index}
                      </span>
                    </div>
                    <div className="text-slate-300 text-xs">
                      <MixedContent text={block.prose} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Challenge layer — full-width row below the two columns. Shown
                whenever stage 4 ran (failed or not), so the absence of
                assignments is visible too. */}
            {debug.challenger && (
              <div className="px-5 py-4 border-t border-amber-500/10 space-y-2">
                <p className="text-[10px] text-slate-500 uppercase tracking-wider font-medium">
                  Challenge Layer ({challengeCount} attached
                  {challengeDropped > 0 && `, ${challengeDropped} dropped`}
                  {challengerFailed && ', LLM failed'})
                </p>
                {challengeCount === 0 && !challengerFailed && (
                  <p className="text-xs text-slate-500 italic">No challenges proposed for this example.</p>
                )}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {debug.challenger.assignments.map((a, i) => (
                    <ChallengeAssignmentRow key={i} assignment={a} />
                  ))}
                </div>
                {debug.challenger.dropped.length > 0 && (
                  <div className="space-y-1 pt-1">
                    <p className="text-[10px] text-red-400 uppercase tracking-wider font-medium">
                      Dropped by merge
                    </p>
                    {debug.challenger.dropped.map(({ assignment, reason }, i) => {
                      const locator =
                        assignment.kind === 'step'
                          ? `step ${assignment.stepIndex} · step-level gate`
                          : `step ${assignment.stepIndex} · transition ${assignment.transitionIndex} · hide ${assignment.hide}`;
                      return (
                        <div
                          key={i}
                          className="text-xs rounded p-2 border-l-2 bg-red-500/5 border-red-500/40"
                        >
                          <span className="text-slate-500 mr-2">{locator}</span>
                          <span className="text-red-300">{reason}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  );
};

const ChallengeAssignmentRow: React.FC<{ assignment: ChallengeAssignment }> = ({ assignment }) => {
  const isMcq = assignment.distractors.length > 0;
  const isStep = assignment.kind === 'step';
  const locator = isStep
    ? `step ${assignment.stepIndex} · step-level`
    : `step ${assignment.stepIndex} · t${assignment.transitionIndex}`;
  const tag = isStep ? 'gate content' : `hide ${assignment.hide}`;
  return (
    <div className="text-xs leading-relaxed rounded p-3 border-l-2 bg-slate-800/30 border-fuchsia-500/40">
      <div className="flex items-center gap-2 mb-1.5 flex-wrap">
        <span className="text-[10px] uppercase tracking-wider font-medium text-slate-500">
          {locator}
        </span>
        <span className="text-[10px] uppercase tracking-wider font-medium text-fuchsia-300/80 bg-fuchsia-500/10 px-1.5 py-0.5 rounded">
          {tag}
        </span>
        <span className="text-[10px] uppercase tracking-wider font-medium text-slate-400 ml-auto">
          {isMcq ? `MCQ · ${assignment.distractors.length}` : 'free response'}
        </span>
      </div>
      <p className="text-slate-300 mb-1">{assignment.prompt}</p>
      <p className="text-slate-500">
        <span className="font-medium">Answer:</span>{' '}
        <span className="font-mono text-emerald-300">{assignment.acceptableAnswers[0]}</span>
      </p>
      {assignment.rationale && (
        <p className="text-slate-500 italic mt-1">{assignment.rationale}</p>
      )}
    </div>
  );
};

const PlannerSpecRow: React.FC<{ spec: StepSpec; index: number }> = ({ spec, index }) => {
  const isInjected = spec.groundingBlockIndices.length === 0;
  const isMerged = spec.groundingBlockIndices.length > 1;

  let groundingLabel: React.ReactNode;
  let borderColor = 'border-emerald-500/40';
  if (isInjected) {
    groundingLabel = <span className="text-violet-400">INJECTED · no block</span>;
    borderColor = 'border-violet-500/40';
  } else if (isMerged) {
    groundingLabel = (
      <span className="text-cyan-400">
        MERGED · blocks [{spec.groundingBlockIndices.join(', ')}]
      </span>
    );
    borderColor = 'border-cyan-500/40';
  } else {
    groundingLabel = (
      <span className="text-emerald-400">block {spec.groundingBlockIndices[0]}</span>
    );
  }

  return (
    <div className={`text-sm leading-relaxed rounded p-3 border-l-2 bg-slate-800/30 ${borderColor}`}>
      <div className="flex items-center gap-2 mb-1.5 flex-wrap">
        <span className="text-[10px] uppercase tracking-wider font-medium text-slate-500">
          Spec {index}
        </span>
        <span className="text-[10px] uppercase tracking-wider font-medium text-amber-400/80 bg-amber-500/10 px-1.5 py-0.5 rounded">
          {spec.stepType}
        </span>
        <span className="text-xs text-slate-300 font-medium">{spec.title}</span>
        <span className="text-[10px] uppercase tracking-wider font-medium ml-auto">
          {groundingLabel}
        </span>
      </div>
      {spec.pedagogicalGoal && (
        <p className="text-xs text-slate-400 italic mb-1">Goal: {spec.pedagogicalGoal}</p>
      )}
      {spec.seedNotes && (
        <p className="text-xs text-slate-500"><span className="font-medium">Seed:</span> <MixedContent text={spec.seedNotes} /></p>
      )}
    </div>
  );
};

export default AnnotatedExample;
