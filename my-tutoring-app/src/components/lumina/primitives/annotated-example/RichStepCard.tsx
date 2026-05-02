'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Layers, BookOpen, AlertTriangle, Lightbulb, GitMerge } from 'lucide-react';
import { Card } from '../../../ui/card';
import { Badge } from '../../../ui/badge';
import { StepContentRenderer, StepTypeIcon, MixedContent } from './StepContentRenderer';
import type { LayerId, RichExampleStep } from './types';
import { ANNOTATION_LAYERS } from './types';

/**
 * Icon map for the five annotation layers. Co-located with the card that
 * renders them so AnnotatedExample (Watch) and RevealView (Try compare)
 * stay visually identical.
 */
export const LayerIconMap: Record<string, React.ReactNode> = {
  steps: <Layers size={14} />,
  strategy: <Lightbulb size={14} />,
  misconceptions: <AlertTriangle size={14} />,
  connections: <GitMerge size={14} />,
  narrative: <BookOpen size={14} />,
  explain: <BookOpen size={14} />,
};

interface RichStepCardProps {
  step: RichExampleStep;
  index: number;
  activeLayers: LayerId[];
  isCompact?: boolean;
  interactive?: boolean;
  onCompletionChange?: (complete: boolean) => void;
}

/**
 * One numbered step in the worked example: type-specific body
 * (algebra/table/graph-sketch/case-split/diagram) plus the togglable
 * annotation grid. Used by both AnnotatedExample (Watch act) and the
 * Try-It RevealView (post-Done canonical comparison column).
 */
export const RichStepCard: React.FC<RichStepCardProps> = ({
  step,
  index,
  activeLayers,
  isCompact,
  interactive = true,
  onCompletionChange,
}) => {
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
          <StepContentRenderer
            content={step.content}
            challenge={step.challenge}
            interactive={interactive}
            onCompletionChange={onCompletionChange}
          />
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
                    <p className="text-slate-400 leading-relaxed text-xs md:text-sm">
                      {layerId === 'narrative' ? content : <MixedContent text={content} />}
                    </p>
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
