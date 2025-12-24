import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight, Check, Layers, BookOpen, AlertTriangle, Lightbulb, GitMerge } from 'lucide-react';
import { AnnotatedExampleData, ExampleStep } from '../types';
import { clsx } from 'clsx';

// --- Utility Components ---

// Math text renderer - checks for math-like symbols and applies proper styling
const MathText = ({ text }: { text: string }) => {
  const isMath = /[\^=+\-\\×÷√∫∑∏]/.test(text);

  if (!isMath) {
    return <span className="font-sans">{text}</span>;
  }

  // Split on superscript pattern and render with proper formatting
  const parts = text.split(/(\^[\d]+|\^[{][\d]+[}])/g);

  return (
    <span className="font-serif text-lg tracking-wide">
      {parts.map((part, i) => {
        if (part.startsWith('^')) {
          const supText = part.replace(/\^[{]?([^}]+)[}]?/, '$1');
          return <sup key={i} className="text-xs">{supText}</sup>;
        }
        return <span key={i}>{part}</span>;
      })}
    </span>
  );
};

// Map string icon names to Lucide React components
const IconMap: Record<string, React.ReactNode> = {
  steps: <Layers size={14} />,
  strategy: <Lightbulb size={14} />,
  warning: <AlertTriangle size={14} />,
  connections: <GitMerge size={14} />,
  explain: <BookOpen size={14} />
};

interface AnnotatedExampleProps {
  data: AnnotatedExampleData;
  className?: string;
}

export const AnnotatedExample: React.FC<AnnotatedExampleProps> = ({ data, className }) => {
  const [activeLayers, setActiveLayers] = useState<string[]>(["steps"]);
  const [currentStep, setCurrentStep] = useState(0);
  const [viewMode, setViewMode] = useState<"step" | "full">("step");

  const toggleLayer = (layerId: string) => {
    setActiveLayers(prev =>
      prev.includes(layerId) ? prev.filter(id => id !== layerId) : [...prev, layerId]
    );
  };

  return (
    <div className={clsx("max-w-3xl mx-auto font-sans text-slate-200", className)}>
      {/* --- Header Section --- */}
      <div className="mb-6 space-y-4">
        <div className="flex justify-between items-start">
          <div>
            <span className="inline-block px-2 py-1 mb-2 text-xs font-bold tracking-wider text-blue-400 uppercase bg-blue-900/30 rounded">
              {data.subject}
            </span>
            <h1 className="text-2xl font-serif font-bold text-white tracking-tight">{data.title}</h1>
          </div>
          {/* View Toggle */}
          <div className="bg-slate-800 p-1 rounded-lg flex text-xs font-medium">
            {(['step', 'full'] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                className={clsx(
                  "px-3 py-1.5 rounded-md transition-all",
                  viewMode === mode
                    ? 'bg-slate-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                )}
              >
                {mode === 'step' ? 'Step-by-Step' : 'Full Solution'}
              </button>
            ))}
          </div>
        </div>

        {/* Problem Card */}
        <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-slate-900 to-slate-800 border border-slate-700 p-6 shadow-xl">
          <div className="relative z-10">
            <p className="text-slate-400 text-sm mb-3 font-medium uppercase tracking-wide">Problem Statement</p>
            {data.problem.equations && data.problem.equations.length > 0 && (
              <div className="text-xl md:text-2xl font-mono text-white mb-2 space-y-1">
                {data.problem.equations.map((eq, i) => (
                  <div key={i}><MathText text={eq} /></div>
                ))}
              </div>
            )}
            <p className="text-slate-300 leading-relaxed">{data.problem.statement}</p>
            {data.problem.context && (
              <p className="text-slate-400 text-sm mt-2 leading-relaxed">{data.problem.context}</p>
            )}
          </div>
          {/* Decorative background blob */}
          <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
        </div>

        {/* Layer Toggles */}
        <div className="flex flex-wrap gap-2 py-2">
          {data.layers.map(layer => {
            const isActive = activeLayers.includes(layer.id);
            return (
              <button
                key={layer.id}
                onClick={() => toggleLayer(layer.id)}
                className={clsx(
                  "flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold transition-all border",
                  isActive
                    ? 'bg-opacity-15 border-transparent shadow-sm'
                    : 'bg-transparent border-slate-700 text-slate-500 hover:border-slate-600'
                )}
                style={isActive ? {
                  backgroundColor: `${layer.color}25`,
                  color: layer.color,
                  boxShadow: `0 0 10px ${layer.color}15`
                } : {}}
              >
                {/* Dynamically render icon if mapped, otherwise use emoji */}
                {IconMap[layer.id.toLowerCase()] || <span className="text-sm">{layer.icon}</span>}
                {layer.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* --- Main Content Area --- */}
      <AnimatePresence mode='wait'>
        {viewMode === "step" ? (
          <motion.div
            key="step-view"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
          >
            {/* Step Navigation Bar */}
            <div className="flex items-center justify-between mb-4 bg-slate-900/50 p-2 rounded-xl border border-slate-800">
              <button
                onClick={() => setCurrentStep(Math.max(0, currentStep - 1))}
                disabled={currentStep === 0}
                className="p-2 hover:bg-slate-700 rounded-lg disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
                aria-label="Previous step"
              >
                <ChevronLeft size={20} />
              </button>

              <div className="flex gap-1.5">
                {data.steps.map((_, idx) => (
                  <button
                    key={idx}
                    onClick={() => setCurrentStep(idx)}
                    className={clsx(
                      "h-1.5 rounded-full transition-all duration-300",
                      idx === currentStep ? 'w-8 bg-blue-500' : 'w-2 bg-slate-700 hover:bg-slate-600'
                    )}
                    aria-label={`Go to step ${idx + 1}`}
                  />
                ))}
              </div>

              <button
                onClick={() => setCurrentStep(Math.min(data.steps.length - 1, currentStep + 1))}
                disabled={currentStep === data.steps.length - 1}
                className="p-2 hover:bg-slate-700 rounded-lg disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
                aria-label="Next step"
              >
                <ChevronRight size={20} />
              </button>
            </div>

            {/* Step Card */}
            <StepCard
              step={data.steps[currentStep]}
              index={currentStep}
              activeLayers={activeLayers}
              layers={data.layers}
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
             {/* Continuous vertical line for timeline effect */}
            <div className="absolute left-[1.15rem] top-4 bottom-4 w-0.5 bg-slate-800 z-0" />

            {data.steps.map((step, idx) => (
              <div key={step.id} className="relative z-10 pb-8 last:pb-0">
                <StepCard
                  step={step}
                  index={idx}
                  activeLayers={activeLayers}
                  layers={data.layers}
                  isCompact={true}
                />
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// --- Sub-Components ---

const StepCard: React.FC<{
  step: ExampleStep;
  index: number;
  activeLayers: string[];
  layers: AnnotatedExampleData['layers'];
  isCompact?: boolean;
}> = ({ step, index, activeLayers, layers, isCompact }) => {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3 }}
      className={clsx(
        "flex gap-4",
        !isCompact && "bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-lg"
      )}
    >
      {/* Step Number Bubble */}
      <div className="flex-shrink-0">
        <div className="w-10 h-10 rounded-full bg-slate-800 border-2 border-slate-700 flex items-center justify-center font-bold text-slate-300 shadow-sm">
          {index + 1}
        </div>
      </div>

      <div className="flex-grow min-w-0">
        <h3 className="text-lg font-serif font-semibold text-slate-100 mb-3 pt-1.5">{step.title}</h3>

        {/* Math Work Area */}
        <div className="bg-slate-950 rounded-lg border border-slate-800/50 p-4 mb-4 font-mono text-sm overflow-x-auto">
          {step.work.map((line, i) => (
            <div key={i} className="flex justify-between items-baseline py-1 group">
              <span className="text-slate-200"><MathText text={line.text} /></span>
              {line.annotation && (
                <span className="text-slate-600 text-xs italic opacity-0 group-hover:opacity-100 transition-opacity ml-4">
                  // {line.annotation}
                </span>
              )}
            </div>
          ))}

          {step.result && step.result.length > 0 && (
            <div className="mt-3 pt-3 border-t border-slate-800/80">
              {step.result.map((line, i) => (
                <div key={i} className="flex items-center gap-2 text-emerald-400 font-bold">
                  <Check size={14} />
                  <MathText text={line.text} />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Annotation Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <AnimatePresence>
            {activeLayers.map(layerId => {
              const content = step.annotations[layerId];
              if (!content) return null;

              const layerDef = layers.find(l => l.id === layerId);
              const color = layerDef?.color || '#ccc';

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
                      {IconMap[layerId.toLowerCase()] || <div className="w-3 h-3 rounded-full bg-current"/>}
                      <span className="font-bold text-xs uppercase tracking-wider">{layerDef?.label}</span>
                    </div>
                    <p className="text-slate-400 leading-relaxed text-xs md:text-sm">
                      {content}
                    </p>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  );
};

export default AnnotatedExample;
