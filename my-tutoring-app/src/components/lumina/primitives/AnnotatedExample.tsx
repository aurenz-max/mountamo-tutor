import { useState } from 'react';
import { AnnotatedExampleData } from '../types';

interface AnnotatedExampleProps {
  data: AnnotatedExampleData;
  className?: string;
}

const AnnotatedExample: React.FC<AnnotatedExampleProps> = ({ data, className }) => {
  const [activeLayers, setActiveLayers] = useState(["steps"]);
  const [currentStep, setCurrentStep] = useState(0);
  const [viewMode, setViewMode] = useState<"step" | "full">("step");

  const toggleLayer = (layerId: string) => {
    setActiveLayers(prev =>
      prev.includes(layerId)
        ? prev.filter(id => id !== layerId)
        : [...prev, layerId]
    );
  };

  const getLayerStyle = (layerId: string) => {
    const layer = data.layers.find(l => l.id === layerId);
    return {
      borderColor: layer?.color,
      backgroundColor: `${layer?.color}15`
    };
  };

  const currentStepData = data.steps[currentStep];

  return (
    <div className={className}>
      {/* Header */}
      <div className="mb-4">
        <div className="text-xs text-slate-500 mb-1">{data.subject}</div>
        <h1 className="text-xl font-semibold text-slate-100">{data.title}</h1>
      </div>

      {/* Problem Statement */}
      <div className="mb-4 bg-slate-900 rounded-xl p-4 border border-slate-800">
        <div className="text-sm text-slate-400 mb-2">{data.problem.statement}</div>
        {data.problem.equations && data.problem.equations.length > 0 && (
          <div className="font-mono text-lg text-slate-100 space-y-1">
            {data.problem.equations.map((eq, idx) => (
              <div key={idx}>{eq}</div>
            ))}
          </div>
        )}
        {data.problem.context && (
          <div className="text-sm text-slate-300 mt-2">{data.problem.context}</div>
        )}
      </div>

      {/* Layer Toggle */}
      <div className="mb-4">
        <div className="text-xs text-slate-500 mb-2">Annotation Layers</div>
        <div className="flex flex-wrap gap-2">
          {data.layers.map(layer => (
            <button
              key={layer.id}
              onClick={() => toggleLayer(layer.id)}
              className={`
                px-3 py-1.5 rounded-lg text-sm font-medium transition-all border-2
                ${activeLayers.includes(layer.id)
                  ? 'bg-opacity-20'
                  : 'bg-slate-800 border-slate-700 opacity-50'
                }
              `}
              style={activeLayers.includes(layer.id) ? {
                borderColor: layer.color,
                backgroundColor: `${layer.color}20`,
                color: layer.color
              } : {}}
            >
              <span className="mr-1">{layer.icon}</span>
              {layer.label}
            </button>
          ))}
        </div>
      </div>

      {/* View Mode Toggle */}
      <div className="mb-4 flex gap-2">
        <button
          onClick={() => setViewMode("step")}
          className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
            viewMode === "step"
              ? "bg-slate-700 text-slate-100"
              : "bg-slate-800 text-slate-400"
          }`}
        >
          Step by Step
        </button>
        <button
          onClick={() => setViewMode("full")}
          className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
            viewMode === "full"
              ? "bg-slate-700 text-slate-100"
              : "bg-slate-800 text-slate-400"
          }`}
        >
          Full Solution
        </button>
      </div>

      {/* Step by Step View */}
      {viewMode === "step" && (
        <div>
          {/* Step Navigation */}
          <div className="mb-4 flex items-center justify-between">
            <button
              onClick={() => setCurrentStep(prev => Math.max(0, prev - 1))}
              disabled={currentStep === 0}
              className="px-3 py-1.5 rounded-lg bg-slate-800 text-sm disabled:opacity-30 disabled:cursor-not-allowed"
            >
              ← Previous
            </button>
            <div className="flex gap-1">
              {data.steps.map((_, idx) => (
                <button
                  key={idx}
                  onClick={() => setCurrentStep(idx)}
                  className={`w-8 h-8 rounded-full text-sm font-medium transition-colors ${
                    idx === currentStep
                      ? "bg-blue-600 text-white"
                      : idx < currentStep
                        ? "bg-slate-700 text-slate-300"
                        : "bg-slate-800 text-slate-500"
                  }`}
                >
                  {idx + 1}
                </button>
              ))}
            </div>
            <button
              onClick={() => setCurrentStep(prev => Math.min(data.steps.length - 1, prev + 1))}
              disabled={currentStep === data.steps.length - 1}
              className="px-3 py-1.5 rounded-lg bg-slate-800 text-sm disabled:opacity-30 disabled:cursor-not-allowed"
            >
              Next →
            </button>
          </div>

          {/* Current Step */}
          <div className="bg-slate-900 rounded-xl p-4 border border-slate-800">
            <h3 className="font-medium text-slate-100 mb-3">
              Step {currentStep + 1}: {currentStepData.title}
            </h3>

            {/* Work */}
            <div className="font-mono bg-slate-950 rounded-lg p-4 mb-4">
              {currentStepData.work.map((line, idx) => (
                <div key={idx} className="flex justify-between items-center py-1">
                  <span className="text-slate-200">{line.text}</span>
                  {line.annotation && (
                    <span className="text-slate-500 text-sm ml-4">{line.annotation}</span>
                  )}
                </div>
              ))}
              {currentStepData.result && currentStepData.result.length > 0 && (
                <>
                  <div className="border-t border-slate-700 my-2"></div>
                  {currentStepData.result.map((line, idx) => (
                    <div key={idx} className="py-1 text-emerald-400 font-medium">
                      {line.text}
                    </div>
                  ))}
                </>
              )}
            </div>

            {/* Annotations */}
            <div className="space-y-2">
              {activeLayers.map(layerId => {
                const layer = data.layers.find(l => l.id === layerId);
                const annotation = currentStepData.annotations[layerId];
                if (!annotation) return null;
                return (
                  <div
                    key={layerId}
                    className="rounded-lg p-3 border-l-4"
                    style={getLayerStyle(layerId)}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span>{layer?.icon}</span>
                      <span className="text-xs font-medium" style={{ color: layer?.color }}>
                        {layer?.label}
                      </span>
                    </div>
                    <p className="text-sm text-slate-300">{annotation}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Full Solution View */}
      {viewMode === "full" && (
        <div className="space-y-4">
          {data.steps.map((step, stepIdx) => (
            <div
              key={step.id}
              className="bg-slate-900 rounded-xl p-4 border border-slate-800"
            >
              <h3 className="font-medium text-slate-100 mb-3 flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-slate-700 flex items-center justify-center text-xs">
                  {stepIdx + 1}
                </span>
                {step.title}
              </h3>

              {/* Work */}
              <div className="font-mono bg-slate-950 rounded-lg p-3 mb-3 text-sm">
                {step.work.map((line, idx) => (
                  <div key={idx} className="flex justify-between items-center py-0.5">
                    <span className="text-slate-200">{line.text}</span>
                    {line.annotation && (
                      <span className="text-slate-500 text-xs ml-4">{line.annotation}</span>
                    )}
                  </div>
                ))}
                {step.result && step.result.length > 0 && (
                  <>
                    <div className="border-t border-slate-700 my-1"></div>
                    {step.result.map((line, idx) => (
                      <div key={idx} className="py-0.5 text-emerald-400 font-medium">
                        {line.text}
                      </div>
                    ))}
                  </>
                )}
              </div>

              {/* Annotations */}
              {activeLayers.length > 0 && (
                <div className="grid gap-2" style={{
                  gridTemplateColumns: `repeat(${Math.min(activeLayers.length, 2)}, 1fr)`
                }}>
                  {activeLayers.map(layerId => {
                    const layer = data.layers.find(l => l.id === layerId);
                    const annotation = step.annotations[layerId];
                    if (!annotation) return null;
                    return (
                      <div
                        key={layerId}
                        className="rounded-lg p-2 border-l-4 text-xs"
                        style={getLayerStyle(layerId)}
                      >
                        <div className="flex items-center gap-1 mb-1">
                          <span className="text-xs">{layer?.icon}</span>
                          <span className="font-medium" style={{ color: layer?.color }}>
                            {layer?.label}
                          </span>
                        </div>
                        <p className="text-slate-300 leading-relaxed">{annotation}</p>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default AnnotatedExample;
