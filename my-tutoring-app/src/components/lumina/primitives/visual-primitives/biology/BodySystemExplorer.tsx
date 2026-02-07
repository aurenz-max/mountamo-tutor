import React, { useState } from 'react';
import { Info, MapPin, Lightbulb, ArrowRight, Play, RotateCcw, ChevronRight } from 'lucide-react';

// ============================================================================
// DATA TYPES (Single Source of Truth)
// ============================================================================

export interface OrganInfo {
  id: string;
  name: string;
  svgRegion: string; // CSS selector or coordinate bounds for clickable region
  function: string;
  funFact: string | null;
  connectedTo: string[]; // IDs of connected organs
  layerGroup: string; // Which layer this organ belongs to
}

export interface PathwayStep {
  organId: string;
  action: string; // What happens at this organ
  order: number;
}

export interface Pathway {
  id: string;
  name: string;
  description: string;
  steps: PathwayStep[];
}

export interface Layer {
  id: string;
  label: string;
  defaultVisible: boolean;
}

export type BodySystem =
  | 'digestive'
  | 'circulatory'
  | 'respiratory'
  | 'nervous'
  | 'skeletal'
  | 'muscular'
  | 'immune'
  | 'endocrine'
  | 'reproductive'
  | 'urinary';

export interface BodySystemExplorerData {
  system: BodySystem;
  title: string;
  overview: string;
  organs: OrganInfo[];
  pathways: Pathway[];
  layers: Layer[];
  gradeBand: '2-4' | '5-6' | '7-8';

  // Evaluation props (optional, auto-injected by ManifestOrderRenderer)
  instanceId?: string;
  skillId?: string;
  subskillId?: string;
  objectiveId?: string;
  exhibitId?: string;
  onEvaluationSubmit?: (result: any) => void;
}

interface BodySystemExplorerProps {
  data: BodySystemExplorerData;
  className?: string;
}

// ============================================================================
// SYSTEM COLOR THEMES
// ============================================================================

const SYSTEM_COLORS: Record<BodySystem, string> = {
  digestive: '#f59e0b',
  circulatory: '#ef4444',
  respiratory: '#3b82f6',
  nervous: '#a855f7',
  skeletal: '#d1d5db',
  muscular: '#dc2626',
  immune: '#10b981',
  endocrine: '#ec4899',
  reproductive: '#f43f5e',
  urinary: '#06b6d4',
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

const BodySystemExplorer: React.FC<BodySystemExplorerProps> = ({ data, className }) => {
  // Handle incomplete or missing data
  if (!data || !data.system) {
    return (
      <div className="glass-card p-6 text-center">
        <p className="text-slate-400">Loading body system explorer...</p>
      </div>
    );
  }

  const [selectedPathway, setSelectedPathway] = useState<Pathway | null>(
    (data.pathways || [])[0] || null
  );
  const [currentPathwayStep, setCurrentPathwayStep] = useState(0);

  const systemColor = SYSTEM_COLORS[data.system] || '#3b82f6';

  // Start pathway trace
  const startPathwayTrace = (pathway: Pathway) => {
    setSelectedPathway(pathway);
    setCurrentPathwayStep(0);
  };

  // Advance pathway step
  const nextPathwayStep = () => {
    if (selectedPathway && currentPathwayStep < selectedPathway.steps.length - 1) {
      setCurrentPathwayStep(currentPathwayStep + 1);
    }
  };

  // Previous pathway step
  const prevPathwayStep = () => {
    if (currentPathwayStep > 0) {
      setCurrentPathwayStep(currentPathwayStep - 1);
    }
  };

  // Reset pathway
  const resetPathway = () => {
    setCurrentPathwayStep(0);
  };

  // Go to specific step
  const goToStep = (stepIndex: number) => {
    setCurrentPathwayStep(stepIndex);
  };

  // Get current pathway step info
  const currentStep = selectedPathway?.steps.find(s => s.order === currentPathwayStep);
  const currentStepOrgan = currentStep ? (data.organs || []).find(o => o.id === currentStep.organId) : null;

  return (
    <div className={`space-y-6 ${className || ''}`}>
      {/* Header */}
      <div className="glass-card p-6">
        <h3 className="text-2xl font-bold mb-2" style={{ color: systemColor }}>
          {data.title || 'Body System Explorer'}
        </h3>
        <p className="text-slate-300 text-sm leading-relaxed">
          {data.overview || 'Explore the human body systems'}
        </p>
        <div className="mt-3 px-3 py-1.5 bg-slate-800/50 rounded-lg inline-block">
          <span className="text-xs text-slate-400 font-medium">
            Grade {data.gradeBand || '5-6'}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Left Panel - Pathway Selector (1 column) */}
        <div className="lg:col-span-1 space-y-4">
          <div className="glass-card p-5">
            <div className="flex items-center gap-2 mb-4">
              <MapPin className="w-5 h-5" style={{ color: systemColor }} />
              <h4 className="text-base font-semibold text-slate-200">Pathways</h4>
            </div>
            <div className="space-y-2">
              {(data.pathways || []).map(pathway => (
                <button
                  key={pathway.id}
                  onClick={() => startPathwayTrace(pathway)}
                  className={`w-full text-left px-3 py-2.5 rounded-lg transition-all ${
                    selectedPathway?.id === pathway.id
                      ? 'bg-slate-700 border-2'
                      : 'bg-slate-800/50 border border-slate-700 hover:bg-slate-700/50'
                  }`}
                  style={{
                    borderColor: selectedPathway?.id === pathway.id ? systemColor : undefined
                  }}
                >
                  <div className="flex items-center gap-2">
                    <Play className="w-3.5 h-3.5 flex-shrink-0" style={{
                      color: selectedPathway?.id === pathway.id ? systemColor : '#94a3b8'
                    }} />
                    <span className="text-sm font-medium text-slate-200 leading-tight">
                      {pathway.name}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Center Panel - Visual Reference (2 columns) */}
        <div className="lg:col-span-2">
          <div className="glass-card p-6 h-full">
            <div className="relative bg-slate-900/50 rounded-lg p-6 min-h-[600px] flex items-center justify-center">
              {/* Simplified visual representation */}
              <div className="relative w-full h-full flex items-center justify-center">
                {/* System icon/placeholder */}
                <div className="text-center space-y-4">
                  <div className="w-40 h-40 mx-auto rounded-full bg-gradient-to-br from-slate-800 to-slate-900 flex items-center justify-center border-4"
                    style={{ borderColor: systemColor }}>
                    <Info className="w-16 h-16" style={{ color: systemColor }} />
                  </div>
                  <div className="max-w-xs mx-auto">
                    <h5 className="text-lg font-bold mb-2" style={{ color: systemColor }}>
                      {selectedPathway?.name || 'Select a Pathway'}
                    </h5>
                    <p className="text-slate-400 text-sm">
                      {selectedPathway?.description || 'Choose a pathway from the left to explore how this system works.'}
                    </p>
                  </div>
                </div>

                {/* Pathway progress visualization */}
                {selectedPathway && (
                  <div className="absolute bottom-6 left-6 right-6">
                    <div className="bg-slate-800/80 backdrop-blur-sm rounded-lg p-4 border border-slate-700">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-semibold text-slate-400 uppercase">
                          Progress
                        </span>
                        <span className="text-xs text-slate-400">
                          Step {currentPathwayStep + 1} of {selectedPathway.steps.length}
                        </span>
                      </div>
                      <div className="flex gap-1">
                        {selectedPathway.steps.map((_, index) => (
                          <button
                            key={index}
                            onClick={() => goToStep(index)}
                            className="flex-1 h-2 rounded-full transition-all"
                            style={{
                              backgroundColor: index <= currentPathwayStep ? systemColor : '#334155'
                            }}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Right Panel - Detailed Info Cards (2 columns) */}
        <div className="lg:col-span-2 space-y-4">
          {selectedPathway && currentStepOrgan ? (
            <>
              {/* Current Step Card */}
              <div className="glass-card p-6 border-2" style={{ borderColor: systemColor }}>
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold text-white"
                      style={{ backgroundColor: systemColor }}>
                      {currentPathwayStep + 1}
                    </div>
                    <div>
                      <h4 className="text-xs font-semibold text-slate-400 uppercase">
                        {currentStepOrgan.layerGroup}
                      </h4>
                      <h3 className="text-xl font-bold" style={{ color: systemColor }}>
                        {currentStepOrgan.name}
                      </h3>
                    </div>
                  </div>
                  <button
                    onClick={resetPathway}
                    className="p-2 rounded-lg bg-slate-700 hover:bg-slate-600 transition-colors"
                    title="Reset to start"
                  >
                    <RotateCcw className="w-4 h-4 text-slate-300" />
                  </button>
                </div>

                {/* What happens here */}
                <div className="mb-4">
                  <div className="text-xs font-semibold text-slate-400 uppercase mb-2">
                    What Happens Here
                  </div>
                  <p className="text-base text-slate-200 leading-relaxed">
                    {currentStep.action}
                  </p>
                </div>

                {/* Organ function */}
                <div className="mb-4 p-4 bg-slate-800/50 rounded-lg">
                  <div className="text-xs font-semibold text-slate-400 uppercase mb-2">
                    Function
                  </div>
                  <p className="text-sm text-slate-300 leading-relaxed">
                    {currentStepOrgan.function}
                  </p>
                </div>

                {/* Fun fact */}
                {currentStepOrgan.funFact && (
                  <div className="p-4 bg-slate-800/50 rounded-lg border-l-4"
                    style={{ borderColor: systemColor }}>
                    <div className="flex items-start gap-3">
                      <Lightbulb className="w-5 h-5 mt-0.5 flex-shrink-0" style={{ color: systemColor }} />
                      <div>
                        <div className="text-xs font-semibold text-slate-400 uppercase mb-1">
                          Fun Fact
                        </div>
                        <p className="text-sm text-slate-300 leading-relaxed">
                          {currentStepOrgan.funFact}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Navigation */}
                <div className="mt-6 flex gap-2">
                  <button
                    onClick={prevPathwayStep}
                    disabled={currentPathwayStep === 0}
                    className="flex-1 px-4 py-2.5 rounded-lg bg-slate-700 hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    <span className="text-sm font-medium text-white">Previous</span>
                  </button>
                  <button
                    onClick={nextPathwayStep}
                    disabled={currentPathwayStep === selectedPathway.steps.length - 1}
                    className="flex-1 px-4 py-2.5 rounded-lg flex items-center justify-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    style={{ backgroundColor: systemColor }}
                  >
                    <span className="text-sm font-medium text-white">
                      {currentPathwayStep === selectedPathway.steps.length - 1 ? 'Complete' : 'Next'}
                    </span>
                    {currentPathwayStep < selectedPathway.steps.length - 1 && (
                      <ArrowRight className="w-4 h-4 text-white" />
                    )}
                  </button>
                </div>
              </div>

              {/* All Steps Overview */}
              <div className="glass-card p-5">
                <h4 className="text-base font-semibold text-slate-200 mb-3">
                  Complete Pathway
                </h4>
                <div className="space-y-2">
                  {selectedPathway.steps.map((step, index) => {
                    const stepOrgan = (data.organs || []).find(o => o.id === step.organId);
                    const isCurrentStep = index === currentPathwayStep;
                    const isPastStep = index < currentPathwayStep;

                    return (
                      <button
                        key={step.order}
                        onClick={() => goToStep(index)}
                        className={`w-full text-left p-3 rounded-lg transition-all ${
                          isCurrentStep
                            ? 'bg-slate-700 border-2'
                            : isPastStep
                            ? 'bg-slate-800/50 border border-slate-600'
                            : 'bg-slate-800/30 border border-slate-700/50'
                        }`}
                        style={{
                          borderColor: isCurrentStep ? systemColor : undefined
                        }}
                      >
                        <div className="flex items-start gap-3">
                          <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                            isPastStep || isCurrentStep ? 'text-white' : 'text-slate-500'
                          }`}
                            style={{
                              backgroundColor: isPastStep || isCurrentStep ? systemColor : '#334155'
                            }}>
                            {index + 1}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-semibold text-slate-200 mb-1">
                              {stepOrgan?.name}
                            </div>
                            <p className="text-xs text-slate-400 leading-relaxed line-clamp-2">
                              {step.action}
                            </p>
                          </div>
                          {isCurrentStep && (
                            <ChevronRight className="w-4 h-4 flex-shrink-0" style={{ color: systemColor }} />
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Connected Organs */}
              {currentStepOrgan.connectedTo && currentStepOrgan.connectedTo.length > 0 && (
                <div className="glass-card p-5">
                  <h4 className="text-base font-semibold text-slate-200 mb-3">
                    Connected Organs
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {(currentStepOrgan.connectedTo || []).map(connectedId => {
                      const connectedOrgan = (data.organs || []).find(o => o.id === connectedId);
                      if (!connectedOrgan) return null;

                      // Find if this organ is in the pathway
                      const stepIndex = selectedPathway.steps.findIndex(s => s.organId === connectedId);

                      return (
                        <button
                          key={connectedId}
                          onClick={() => stepIndex >= 0 && goToStep(stepIndex)}
                          disabled={stepIndex < 0}
                          className="px-3 py-2 text-sm font-medium rounded-lg bg-slate-800/50 hover:bg-slate-700 transition-colors border disabled:opacity-50 disabled:cursor-not-allowed"
                          style={{ borderColor: systemColor, color: systemColor }}
                        >
                          {connectedOrgan.name}
                          {stepIndex >= 0 && ` (Step ${stepIndex + 1})`}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="glass-card p-6 h-full flex items-center justify-center">
              <div className="text-center space-y-3">
                <Info className="w-12 h-12 mx-auto text-slate-600" />
                <p className="text-sm text-slate-500">
                  Select a pathway from the left to begin exploring
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default BodySystemExplorer;
