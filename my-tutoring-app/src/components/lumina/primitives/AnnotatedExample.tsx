'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight, Layers, BookOpen, AlertTriangle, Lightbulb, GitMerge, Bug, ChevronDown } from 'lucide-react';
import { Card } from '../../ui/card';
import { Button } from '../../ui/button';
import { Badge } from '../../ui/badge';
import { Tabs, TabsList, TabsTrigger } from '../../ui/tabs';
import { StepContentRenderer, StepTypeIcon, KaTeX, MixedContent } from './annotated-example/StepContentRenderer';
import type { RichAnnotatedExampleData, RichExampleStep, LayerId, SolverDebugPayload, StepSpec } from './annotated-example/types';
import { ANNOTATION_LAYERS } from './annotated-example/types';

// ═══════════════════════════════════════════════════════════════════════
// Icon Map for annotation layers
// ═══════════════════════════════════════════════════════════════════════

const LayerIconMap: Record<string, React.ReactNode> = {
  steps: <Layers size={14} />,
  strategy: <Lightbulb size={14} />,
  misconceptions: <AlertTriangle size={14} />,
  connections: <GitMerge size={14} />,
  explain: <BookOpen size={14} />,
};

// ═══════════════════════════════════════════════════════════════════════
// Main Component
// ═══════════════════════════════════════════════════════════════════════

interface AnnotatedExampleProps {
  data: RichAnnotatedExampleData;
  className?: string;
}

export const AnnotatedExample: React.FC<AnnotatedExampleProps> = ({ data, className }) => {
  const [activeLayers, setActiveLayers] = useState<LayerId[]>(['steps']);
  const [currentStep, setCurrentStep] = useState(0);
  const [viewMode, setViewMode] = useState<'step' | 'full'>('step');

  const toggleLayer = (layerId: LayerId) => {
    setActiveLayers((prev) =>
      prev.includes(layerId) ? prev.filter((id) => id !== layerId) : [...prev, layerId],
    );
  };

  return (
    <div className={`max-w-3xl mx-auto font-sans text-slate-200 ${className || ''}`}>
      {/* ── Header ─────────────────────────────────────────────── */}
      <div className="mb-6 space-y-4">
        <div className="flex justify-between items-start">
          <div>
            <Badge variant="outline" className="mb-2 text-blue-400 border-blue-500/30 bg-blue-500/10">
              {data.subject}
            </Badge>
            <h1 className="text-2xl font-serif font-bold text-white tracking-tight">{data.title}</h1>
          </div>

          {/* View Toggle */}
          <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as 'step' | 'full')}>
            <TabsList className="bg-slate-800 border border-slate-700">
              <TabsTrigger value="step" className="text-xs data-[state=active]:bg-slate-600">
                Step-by-Step
              </TabsTrigger>
              <TabsTrigger value="full" className="text-xs data-[state=active]:bg-slate-600">
                Full Solution
              </TabsTrigger>
            </TabsList>
          </Tabs>
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

      {/* ── Step Content ───────────────────────────────────────── */}
      <AnimatePresence mode="wait">
        {viewMode === 'step' ? (
          <motion.div
            key="step-view"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
          >
            {/* Step Navigation */}
            <div className="flex items-center justify-between mb-4 bg-slate-900/50 p-2 rounded-xl border border-slate-800">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setCurrentStep(Math.max(0, currentStep - 1))}
                disabled={currentStep === 0}
                className="p-2 hover:bg-slate-700 disabled:opacity-30"
              >
                <ChevronLeft size={20} />
              </Button>

              <div className="flex gap-1.5">
                {data.steps.map((_, idx) => (
                  <button
                    key={idx}
                    onClick={() => setCurrentStep(idx)}
                    className={`h-1.5 rounded-full transition-all duration-300 ${
                      idx === currentStep ? 'w-8 bg-blue-500' : 'w-2 bg-slate-700 hover:bg-slate-600'
                    }`}
                    aria-label={`Go to step ${idx + 1}`}
                  />
                ))}
              </div>

              <Button
                variant="ghost"
                size="sm"
                onClick={() => setCurrentStep(Math.min(data.steps.length - 1, currentStep + 1))}
                disabled={currentStep === data.steps.length - 1}
                className="p-2 hover:bg-slate-700 disabled:opacity-30"
              >
                <ChevronRight size={20} />
              </Button>
            </div>

            {/* Active Step Card */}
            <RichStepCard
              step={data.steps[currentStep]}
              index={currentStep}
              activeLayers={activeLayers}
              interactive={data.interactive !== false}
            />
          </motion.div>
        ) : (
          <motion.div
            key="full-view"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="space-y-0 relative"
          >
            {/* Vertical timeline line */}
            <div className="absolute left-[1.15rem] top-4 bottom-4 w-0.5 bg-slate-800 z-0" />

            {data.steps.map((step, idx) => (
              <div key={step.id} className="relative z-10 pb-8 last:pb-0">
                <RichStepCard step={step} index={idx} activeLayers={activeLayers} isCompact interactive={data.interactive !== false} />
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════
// Rich Step Card
// ═══════════════════════════════════════════════════════════════════════

const RichStepCard: React.FC<{
  step: RichExampleStep;
  index: number;
  activeLayers: LayerId[];
  isCompact?: boolean;
  interactive?: boolean;
}> = ({ step, index, activeLayers, isCompact, interactive = true }) => {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3 }}
      className="flex gap-4"
    >
      {/* Step Number Bubble */}
      <div className="flex-shrink-0">
        <div className="w-10 h-10 rounded-full bg-slate-800 border-2 border-slate-700 flex items-center justify-center font-bold text-slate-300 shadow-sm">
          {index + 1}
        </div>
      </div>

      <Card
        className={`flex-grow min-w-0 backdrop-blur-xl ${
          isCompact
            ? 'bg-transparent border-0 shadow-none p-0'
            : 'bg-slate-900/40 border-white/10 p-6 shadow-lg'
        }`}
      >
        {/* Step Header */}
        <div className="flex items-center gap-2 mb-3 pt-1.5">
          <StepTypeIcon type={step.content.type} />
          <h3 className="text-lg font-serif font-semibold text-slate-100">{step.title}</h3>
          <Badge variant="outline" className="text-[10px] text-slate-500 border-slate-700 ml-auto">
            {step.content.type}
          </Badge>
        </div>

        {/* Step Content — type-specific renderer */}
        <div className="mb-4">
          <StepContentRenderer content={step.content} interactive={interactive} />
        </div>

        {/* Annotation Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <AnimatePresence>
            {activeLayers.map((layerId) => {
              const content = step.annotations[layerId];
              if (!content) return null;

              const layerDef = ANNOTATION_LAYERS.find((l) => l.id === layerId);
              if (!layerDef) return null;
              const color = layerDef.color;

              return (
                <motion.div
                  key={layerId}
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  <div
                    className="rounded-lg p-3 text-sm border-l-4 h-full bg-slate-800/30"
                    style={{ borderLeftColor: color }}
                  >
                    <div className="flex items-center gap-2 mb-1.5" style={{ color }}>
                      {LayerIconMap[layerId] || <div className="w-3 h-3 rounded-full bg-current" />}
                      <span className="font-bold text-xs uppercase tracking-wider">{layerDef.label}</span>
                    </div>
                    <p className="text-slate-400 leading-relaxed text-xs md:text-sm"><MixedContent text={content} /></p>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      </Card>
    </motion.div>
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
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
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
