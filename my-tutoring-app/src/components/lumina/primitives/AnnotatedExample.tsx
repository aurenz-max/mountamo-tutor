'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight, Layers, BookOpen, AlertTriangle, Lightbulb, GitMerge } from 'lucide-react';
import { Card } from '../../ui/card';
import { Button } from '../../ui/button';
import { Badge } from '../../ui/badge';
import { Tabs, TabsList, TabsTrigger } from '../../ui/tabs';
import { StepContentRenderer, StepTypeIcon, KaTeX, MixedContent } from './annotated-example/StepContentRenderer';
import type { RichAnnotatedExampleData, RichExampleStep, LayerId } from './annotated-example/types';
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
                <RichStepCard step={step} index={idx} activeLayers={activeLayers} isCompact />
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
}> = ({ step, index, activeLayers, isCompact }) => {
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
          <StepContentRenderer content={step.content} />
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

export default AnnotatedExample;
