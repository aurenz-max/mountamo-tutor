'use client';

import React, { useCallback, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bug, ChevronDown, Lock } from 'lucide-react';
import { Card } from '../../ui/card';
import { Button } from '../../ui/button';
import { Badge } from '../../ui/badge';
import { KaTeX, MixedContent } from './annotated-example/StepContentRenderer';
import { RichStepCard, LayerIconMap } from './annotated-example/RichStepCard';
import { InsetRenderer, isGateableInset } from './problem-primitives/insets/InsetRenderer';
import type {
  ChallengeAssignment,
  RichAnnotatedExampleData,
  LayerId,
  SolverDebugPayload,
  StepSpec,
} from './annotated-example/types';
import { ANNOTATION_LAYERS } from './annotated-example/types';

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
}

export const AnnotatedExample: React.FC<AnnotatedExampleProps> = ({ data, className }) => {
  const [activeLayers, setActiveLayers] = useState<LayerId[]>(['steps']);
  /**
   * Per-step challenge-completion state. Default is "complete" — a step
   * reports `false` only while it has an uncommitted challenge. Steps
   * unlock sequentially in the full-solution view so the next step's
   * `from` (which is the current step's `to`) doesn't reveal the answer
   * to a pending prompt.
   */
  const [stepCompletions, setStepCompletions] = useState<Record<number, boolean>>({});
  /**
   * Whether the problem-statement inset is committed. Only meaningful when
   * the inset is gateable (currently `equation-setup`); for static insets
   * or no inset the value stays `true` and never blocks step rendering.
   * The inset reports its commit through `InsetRenderer`'s
   * `onCompletionChange` prop, which we wire up below.
   */
  const insetGateable = isGateableInset(data.problem.inset);
  const [insetComplete, setInsetComplete] = useState(!insetGateable);

  const reportCompletion = useCallback((idx: number, complete: boolean) => {
    setStepCompletions((prev) => (prev[idx] === complete ? prev : { ...prev, [idx]: complete }));
  }, []);

  const isStepComplete = useCallback(
    (idx: number) => stepCompletions[idx] !== false,
    [stepCompletions],
  );

  const isStepUnlocked = useCallback(
    (idx: number) => {
      // A gateable inset (currently the modeling MCQ) blocks every step
      // until the student commits — otherwise the algebra would reveal
      // the equation the inset is asking them to derive.
      if (!insetComplete) return false;
      for (let i = 0; i < idx; i++) {
        if (!isStepComplete(i)) return false;
      }
      return true;
    },
    [insetComplete, isStepComplete],
  );

  const toggleLayer = (layerId: LayerId) => {
    setActiveLayers((prev) =>
      prev.includes(layerId) ? prev.filter((id) => id !== layerId) : [...prev, layerId],
    );
  };

  return (
    <div className={`max-w-3xl mx-auto font-sans text-slate-200 ${className || ''}`}>
      {/* ── Header ─────────────────────────────────────────────── */}
      <div className="mb-6 space-y-4">
        <div>
          <Badge variant="outline" className="mb-2 text-blue-400 border-blue-500/30 bg-blue-500/10">
            {data.subject}
          </Badge>
          <h1 className="text-2xl font-serif font-bold text-white tracking-tight">{data.title}</h1>
        </div>

        {/* Problem Card */}
        <Card className="relative overflow-hidden backdrop-blur-xl bg-gradient-to-br from-slate-900/60 to-slate-800/40 border-white/10 p-6 shadow-xl">
          <div className="relative z-10">
            <p className="text-slate-400 text-sm mb-3 font-medium uppercase tracking-wide">
              Problem Statement
            </p>
            {data.problem.equations && data.problem.equations.length > 0 && (
              <div className="text-xl md:text-2xl text-white mb-2 space-y-1">
                {data.problem.equations.map((eq, i) => (
                  <div key={i}>
                    <KaTeX latex={eq} />
                  </div>
                ))}
              </div>
            )}
            <p className="text-slate-300 leading-relaxed"><MixedContent text={data.problem.statement} /></p>
            {data.problem.inset && (
              <InsetRenderer
                inset={data.problem.inset}
                onCompletionChange={insetGateable ? setInsetComplete : undefined}
              />
            )}
            {data.problem.context && (
              <p className="text-slate-400 text-sm mt-2 leading-relaxed"><MixedContent text={data.problem.context} /></p>
            )}
          </div>
          <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
        </Card>

        {/* Solution Strategy */}
        {data.solutionStrategy && (
          <Card className="backdrop-blur-xl bg-slate-900/30 border-white/5 px-5 py-3">
            <p className="text-xs text-slate-500 uppercase tracking-wider font-medium mb-1">Strategy</p>
            <p className="text-sm text-slate-400 leading-relaxed"><MixedContent text={data.solutionStrategy} /></p>
          </Card>
        )}

        {/* Pipeline Debug — solver blocks → planner specs → rendered steps */}
        {data.solverDebug && <PipelineDebugCard debug={data.solverDebug} renderedStepCount={data.steps.length} />}

        {/* Layer Toggles */}
        <div className="flex flex-wrap gap-2 py-1">
          {ANNOTATION_LAYERS.map((layer) => {
            const isActive = activeLayers.includes(layer.id);
            return (
              <Button
                key={layer.id}
                variant="ghost"
                size="sm"
                onClick={() => toggleLayer(layer.id)}
                className={`flex items-center gap-2 rounded-full text-xs font-semibold transition-all ${
                  isActive
                    ? 'border-transparent shadow-sm'
                    : 'bg-transparent border border-slate-700 text-slate-500 hover:border-slate-600'
                }`}
                style={
                  isActive
                    ? {
                        backgroundColor: `${layer.color}20`,
                        color: layer.color,
                        boxShadow: `0 0 10px ${layer.color}15`,
                      }
                    : {}
                }
              >
                {LayerIconMap[layer.id] || <span className="text-sm">{layer.icon}</span>}
                {layer.label}
              </Button>
            );
          })}
        </div>
      </div>

      {/* ── Step Content (full-solution view) ───────────────────────── */}
      <div className="space-y-0 relative">
        {/* Vertical timeline line */}
        <div className="absolute left-[1.15rem] top-4 bottom-4 w-0.5 bg-slate-800 z-0" />

        {(() => {
          // Render every unlocked step, then ONE locked placeholder for
          // the next step (if any). Steps beyond that aren't rendered at
          // all — a placeholder for each one would just be noise.
          const rendered: React.ReactNode[] = [];
          for (let idx = 0; idx < data.steps.length; idx++) {
            if (!isStepUnlocked(idx)) {
              rendered.push(
                <LockedStepPlaceholder
                  key={`locked-${idx}`}
                  index={idx}
                  total={data.steps.length}
                />,
              );
              break;
            }
            const step = data.steps[idx];
            rendered.push(
              <div key={step.id} className="relative z-10 pb-8 last:pb-0">
                <RichStepCard
                  step={step}
                  index={idx}
                  activeLayers={activeLayers}
                  isCompact
                  interactive={data.interactive !== false}
                  onCompletionChange={(complete) => reportCompletion(idx, complete)}
                />
              </div>,
            );
          }
          return rendered;
        })()}
      </div>

    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════
// Locked Step Placeholder — full view only
// ═══════════════════════════════════════════════════════════════════════
//
// Renders in place of a step that is not yet unlocked. The bubble keeps
// the timeline numbered correctly; the body explains why the card is
// blank without revealing any of the step's content.

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
