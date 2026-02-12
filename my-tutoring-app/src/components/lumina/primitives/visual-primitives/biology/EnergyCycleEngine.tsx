'use client';

import React, { useState, useMemo, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { usePrimitiveEvaluation, type PrimitiveEvaluationResult } from '../../../evaluation';
import type { EnergyCycleEngineMetrics } from '../../../evaluation/types';

// ============================================================================
// Data Interface (Single Source of Truth)
// ============================================================================

export interface MoleculeInput {
  molecule: string;
  source: string;
  amount: 'adjustable' | 'fixed';
}

export interface MoleculeOutput {
  molecule: string;
  destination: string;
}

export interface ProcessStage {
  name: string;
  description: string;
  location: string;
}

export interface PhotosynthesisData {
  location: string;
  inputs: MoleculeInput[];
  outputs: MoleculeOutput[];
  equation: string;
  energySource: string;
  stages: ProcessStage[];
}

export interface CellularRespirationData {
  location: string;
  inputs: MoleculeInput[];
  outputs: MoleculeOutput[];
  equation: string;
  energyOutput: string;
  stages: ProcessStage[];
}

export interface CouplingPoint {
  molecule: string;
  producedBy: 'photosynthesis' | 'respiration';
  consumedBy: 'photosynthesis' | 'respiration';
  description: string;
}

export interface ExperimentScenario {
  scenario: string;
  affectedInputs: { molecule: string; newLevel: string }[];
  expectedOutcome: string;
  explanation: string;
}

export interface EnergyCycleEngineData {
  mode: 'photosynthesis' | 'respiration' | 'coupled';
  photosynthesis: PhotosynthesisData;
  cellularRespiration: CellularRespirationData;
  couplingPoints: CouplingPoint[];
  experiments: ExperimentScenario[];
  gradeBand: '5-6' | '7-8';

  // Evaluation props (optional, auto-injected by ManifestOrderRenderer)
  instanceId?: string;
  skillId?: string;
  subskillId?: string;
  objectiveId?: string;
  exhibitId?: string;
  onEvaluationSubmit?: (result: PrimitiveEvaluationResult) => void;
}

interface EnergyCycleEngineProps {
  data: EnergyCycleEngineData;
  className?: string;
}

// ============================================================================
// Helper Components
// ============================================================================

const MoleculeTag: React.FC<{
  name: string;
  color: string;
  level?: number;
  pulsing?: boolean;
}> = ({ name, color, level, pulsing }) => (
  <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${pulsing ? 'animate-pulse' : ''}`}
    style={{ backgroundColor: `${color}20`, borderColor: `${color}40`, color }}>
    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: color, opacity: level !== undefined ? Math.max(0.2, level / 100) : 1 }} />
    {name}
    {level !== undefined && <span className="text-[10px] opacity-70">{level}%</span>}
  </div>
);

const MOLECULE_COLORS: Record<string, string> = {
  'CO₂': '#94a3b8',
  'CO2': '#94a3b8',
  'Carbon Dioxide': '#94a3b8',
  'H₂O': '#60a5fa',
  'H2O': '#60a5fa',
  'Water': '#60a5fa',
  'O₂': '#34d399',
  'O2': '#34d399',
  'Oxygen': '#34d399',
  'Glucose': '#fbbf24',
  'C₆H₁₂O₆': '#fbbf24',
  'C6H12O6': '#fbbf24',
  'ATP': '#f472b6',
  'Light': '#facc15',
  'Light Energy': '#facc15',
  'Sunlight': '#facc15',
};

function getMoleculeColor(molecule: string): string {
  for (const [key, color] of Object.entries(MOLECULE_COLORS)) {
    if (molecule.toLowerCase().includes(key.toLowerCase())) return color;
  }
  return '#a78bfa';
}

// ============================================================================
// Process Panel
// ============================================================================

const ProcessPanel: React.FC<{
  title: string;
  icon: string;
  color: string;
  location: string;
  equation: string;
  energyLabel: string;
  inputs: MoleculeInput[];
  outputs: MoleculeOutput[];
  stages: ProcessStage[];
  inputLevels: Record<string, number>;
  onInputChange?: (molecule: string, level: number) => void;
  disabled?: boolean;
  broken?: boolean;
}> = ({ title, icon, color, location, equation, energyLabel, inputs, outputs, stages, inputLevels, onInputChange, disabled, broken }) => (
  <Card className={`backdrop-blur-xl border-white/10 transition-all duration-500 ${broken ? 'bg-red-950/30 border-red-500/30' : 'bg-slate-900/40'}`}>
    <CardHeader className="pb-3">
      <div className="flex items-center justify-between">
        <CardTitle className="text-base text-slate-100 flex items-center gap-2">
          <span className="text-xl">{icon}</span>
          {title}
        </CardTitle>
        {broken && <Badge className="bg-red-500/20 border-red-500/40 text-red-300 text-[10px]">BLOCKED</Badge>}
      </div>
      <div className="text-xs text-slate-500">Location: {location}</div>
    </CardHeader>
    <CardContent className="space-y-4">
      {/* Equation */}
      <div className="p-2.5 rounded-lg bg-black/20 border border-white/5 text-center">
        <p className="text-xs text-slate-500 mb-1">Chemical Equation</p>
        <p className="text-sm font-mono text-slate-200">{equation}</p>
      </div>

      {/* Energy */}
      <div className="flex items-center gap-2">
        <span className="text-yellow-400 text-sm">&#9889;</span>
        <span className="text-xs text-slate-400">{energyLabel}</span>
      </div>

      {/* Inputs with sliders */}
      <div>
        <p className="text-xs font-medium text-slate-400 mb-2 uppercase tracking-wider">Inputs</p>
        <div className="space-y-2">
          {inputs.map((input) => {
            const level = inputLevels[input.molecule] ?? 100;
            const canAdjust = input.amount === 'adjustable' && onInputChange && !disabled;
            return (
              <div key={input.molecule} className="space-y-1">
                <div className="flex items-center justify-between">
                  <MoleculeTag name={input.molecule} color={getMoleculeColor(input.molecule)} level={level} pulsing={broken} />
                  <span className="text-[10px] text-slate-600">{input.source}</span>
                </div>
                {canAdjust && (
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={level}
                    onChange={(e) => onInputChange(input.molecule, parseInt(e.target.value))}
                    className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Outputs */}
      <div>
        <p className="text-xs font-medium text-slate-400 mb-2 uppercase tracking-wider">Outputs</p>
        <div className="flex flex-wrap gap-1.5">
          {outputs.map((output) => {
            const avgInput = Object.values(inputLevels).reduce((a, b) => a + b, 0) / Math.max(Object.values(inputLevels).length, 1);
            const outputLevel = broken ? 0 : Math.round(avgInput);
            return (
              <MoleculeTag
                key={output.molecule}
                name={output.molecule}
                color={getMoleculeColor(output.molecule)}
                level={outputLevel}
                pulsing={outputLevel < 20}
              />
            );
          })}
        </div>
      </div>

      {/* Stages */}
      <Accordion type="single" collapsible>
        {stages.map((stage, i) => (
          <AccordionItem key={i} value={`stage-${i}`} className="border-white/10">
            <AccordionTrigger className="text-xs text-slate-300 hover:text-slate-100 hover:no-underline py-2">
              <span className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-[10px] text-slate-400">{i + 1}</span>
                {stage.name}
              </span>
            </AccordionTrigger>
            <AccordionContent className="text-xs text-slate-400 pb-2">
              <p>{stage.description}</p>
              <p className="text-[10px] text-slate-600 mt-1">Location: {stage.location}</p>
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </CardContent>
  </Card>
);

// ============================================================================
// Coupling Visualization
// ============================================================================

const CouplingVisualization: React.FC<{
  couplingPoints: CouplingPoint[];
  photoActive: boolean;
  respActive: boolean;
}> = ({ couplingPoints, photoActive, respActive }) => (
  <div className="flex flex-col items-center justify-center gap-3 py-4 px-2">
    <p className="text-[10px] text-slate-500 uppercase tracking-widest">Energy Cycle</p>
    {couplingPoints.map((cp, i) => {
      const isFlowing = (cp.producedBy === 'photosynthesis' && photoActive) || (cp.producedBy === 'respiration' && respActive);
      return (
        <div key={i} className="flex flex-col items-center gap-1">
          <MoleculeTag
            name={cp.molecule}
            color={getMoleculeColor(cp.molecule)}
            pulsing={isFlowing}
          />
          <div className="flex items-center gap-1 text-[10px]">
            {cp.producedBy === 'photosynthesis' ? (
              <span className="text-emerald-400">&#8594;</span>
            ) : (
              <span className="text-orange-400">&#8592;</span>
            )}
          </div>
          <p className="text-[9px] text-slate-600 text-center max-w-[100px]">{cp.description}</p>
        </div>
      );
    })}
  </div>
);

// ============================================================================
// Main Component
// ============================================================================

const EnergyCycleEngine: React.FC<EnergyCycleEngineProps> = ({ data, className }) => {
  const {
    mode,
    photosynthesis,
    cellularRespiration,
    couplingPoints,
    experiments,
    gradeBand,
    instanceId,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onEvaluationSubmit,
  } = data;

  // State
  const [activeTab, setActiveTab] = useState<string>(mode === 'respiration' ? 'respiration' : mode === 'coupled' ? 'coupled' : 'photosynthesis');
  const [photoInputs, setPhotoInputs] = useState<Record<string, number>>(() => {
    const initial: Record<string, number> = {};
    photosynthesis.inputs.forEach((inp) => { initial[inp.molecule] = 100; });
    return initial;
  });
  const [respInputs, setRespInputs] = useState<Record<string, number>>(() => {
    const initial: Record<string, number> = {};
    cellularRespiration.inputs.forEach((inp) => { initial[inp.molecule] = 100; });
    return initial;
  });
  const [activeExperiment, setActiveExperiment] = useState<number | null>(null);
  const [experimentAnswers, setExperimentAnswers] = useState<Record<number, string>>({});
  const [experimentRevealed, setExperimentRevealed] = useState<Record<number, boolean>>({});
  const [photoBroken, setPhotoBroken] = useState(false);
  const [respBroken, setRespBroken] = useState(false);

  // Evaluation
  const {
    submitResult,
    hasSubmitted,
    resetAttempt,
  } = usePrimitiveEvaluation<EnergyCycleEngineMetrics>({
    primitiveType: 'energy-cycle-engine',
    instanceId: instanceId || `energy-cycle-engine-${Date.now()}`,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onSubmit: onEvaluationSubmit,
  });

  // Computed values
  const photoActive = useMemo(() => !photoBroken && Object.values(photoInputs).some((v) => v > 20), [photoInputs, photoBroken]);
  const respActive = useMemo(() => !respBroken && Object.values(respInputs).some((v) => v > 20), [respInputs, respBroken]);

  const experimentsCompleted = useMemo(() =>
    Object.keys(experimentRevealed).length, [experimentRevealed]);

  const correctExperiments = useMemo(() => {
    let count = 0;
    for (const [idx, answer] of Object.entries(experimentAnswers)) {
      const experiment = experiments[parseInt(idx)];
      if (experiment && answer.toLowerCase().trim() === experiment.expectedOutcome.toLowerCase().trim()) {
        count++;
      }
    }
    return count;
  }, [experimentAnswers, experiments]);

  // Handlers
  const handlePhotoInputChange = useCallback((molecule: string, level: number) => {
    setPhotoInputs((prev) => ({ ...prev, [molecule]: level }));
  }, []);

  const handleRespInputChange = useCallback((molecule: string, level: number) => {
    setRespInputs((prev) => ({ ...prev, [molecule]: level }));
  }, []);

  const handleRunExperiment = useCallback((index: number) => {
    const experiment = experiments[index];
    if (!experiment) return;

    setActiveExperiment(index);

    // Apply affected inputs
    const newPhotoInputs = { ...photoInputs };
    const newRespInputs = { ...respInputs };
    let brokePhoto = false;
    let brokeResp = false;

    experiment.affectedInputs.forEach(({ molecule, newLevel }) => {
      const level = newLevel === 'zero' || newLevel === '0' ? 0 : newLevel === 'low' ? 20 : newLevel === 'high' ? 100 : parseInt(newLevel) || 0;

      // Check which process this affects
      if (photosynthesis.inputs.some((inp) => inp.molecule.toLowerCase() === molecule.toLowerCase())) {
        newPhotoInputs[molecule] = level;
        if (level === 0) brokePhoto = true;
      }
      if (cellularRespiration.inputs.some((inp) => inp.molecule.toLowerCase() === molecule.toLowerCase())) {
        newRespInputs[molecule] = level;
        if (level === 0) brokeResp = true;
      }

      // Special handling for light
      if (molecule.toLowerCase().includes('light')) {
        if (level === 0) brokePhoto = true;
      }
    });

    setPhotoInputs(newPhotoInputs);
    setRespInputs(newRespInputs);
    setPhotoBroken(brokePhoto);
    setRespBroken(brokeResp);
  }, [experiments, photoInputs, respInputs, photosynthesis.inputs, cellularRespiration.inputs]);

  const handleResetExperiment = useCallback(() => {
    setActiveExperiment(null);
    setPhotoBroken(false);
    setRespBroken(false);
    const resetPhoto: Record<string, number> = {};
    photosynthesis.inputs.forEach((inp) => { resetPhoto[inp.molecule] = 100; });
    setPhotoInputs(resetPhoto);
    const resetResp: Record<string, number> = {};
    cellularRespiration.inputs.forEach((inp) => { resetResp[inp.molecule] = 100; });
    setRespInputs(resetResp);
  }, [photosynthesis.inputs, cellularRespiration.inputs]);

  const handleRevealExplanation = useCallback((index: number) => {
    setExperimentRevealed((prev) => ({ ...prev, [index]: true }));
  }, []);

  const handleSubmitEvaluation = useCallback(() => {
    if (hasSubmitted) return;

    const totalExperiments = experiments.length;
    const completed = experimentsCompleted;
    const score = totalExperiments > 0 ? Math.round((completed / totalExperiments) * 100) : 100;

    const metrics: EnergyCycleEngineMetrics = {
      type: 'energy-cycle-engine',
      mode: activeTab as 'photosynthesis' | 'respiration' | 'coupled',
      gradeBand,
      totalExperiments,
      experimentsCompleted: completed,
      experimentsCorrect: correctExperiments,
      experimentAccuracy: totalExperiments > 0 ? Math.round((correctExperiments / totalExperiments) * 100) : 100,
      couplingPointsExplored: activeTab === 'coupled' ? couplingPoints.length : 0,
      photosynthesisExplored: activeTab !== 'respiration',
      respirationExplored: activeTab !== 'photosynthesis',
      coupledModeUsed: activeTab === 'coupled',
      inputsAdjusted: Object.values(photoInputs).some((v) => v !== 100) || Object.values(respInputs).some((v) => v !== 100),
      processDisrupted: photoBroken || respBroken,
    };

    submitResult(score >= 60, score, metrics, {
      studentWork: {
        photoInputs,
        respInputs,
        experimentAnswers,
        experimentsRevealed: Object.keys(experimentRevealed),
      },
    });
  }, [
    hasSubmitted, experiments, experimentsCompleted, correctExperiments,
    activeTab, gradeBand, couplingPoints, photoInputs, respInputs,
    photoBroken, respBroken, experimentAnswers, experimentRevealed,
    submitResult,
  ]);

  const handleReset = useCallback(() => {
    handleResetExperiment();
    setExperimentAnswers({});
    setExperimentRevealed({});
    resetAttempt();
  }, [handleResetExperiment, resetAttempt]);

  return (
    <Card className={`backdrop-blur-xl bg-slate-900/40 border-white/10 shadow-2xl ${className || ''}`}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-xl text-slate-100 flex items-center gap-2">
              <span className="text-2xl">&#9883;</span>
              Photosynthesis & Cellular Respiration
            </CardTitle>
            <p className="text-sm text-slate-400 mt-1">
              Explore how these two processes form a continuous energy cycle
            </p>
          </div>
          <Badge className="bg-emerald-500/20 border-emerald-500/40 text-emerald-300">
            Grades {gradeBand}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid grid-cols-3 bg-slate-800/50 border border-white/10">
            <TabsTrigger value="photosynthesis" className="data-[state=active]:bg-emerald-600/30 data-[state=active]:text-emerald-300">
              Photosynthesis
            </TabsTrigger>
            <TabsTrigger value="coupled" className="data-[state=active]:bg-purple-600/30 data-[state=active]:text-purple-300">
              Coupled Cycle
            </TabsTrigger>
            <TabsTrigger value="respiration" className="data-[state=active]:bg-orange-600/30 data-[state=active]:text-orange-300">
              Respiration
            </TabsTrigger>
          </TabsList>

          {/* Photosynthesis Only */}
          <TabsContent value="photosynthesis" className="mt-4">
            <ProcessPanel
              title="Photosynthesis"
              icon="&#127793;"
              color="#34d399"
              location={photosynthesis.location}
              equation={photosynthesis.equation}
              energyLabel={photosynthesis.energySource}
              inputs={photosynthesis.inputs}
              outputs={photosynthesis.outputs}
              stages={photosynthesis.stages}
              inputLevels={photoInputs}
              onInputChange={handlePhotoInputChange}
              broken={photoBroken}
            />
          </TabsContent>

          {/* Coupled View */}
          <TabsContent value="coupled" className="mt-4">
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto_1fr] gap-4">
              <ProcessPanel
                title="Photosynthesis"
                icon="&#127793;"
                color="#34d399"
                location={photosynthesis.location}
                equation={photosynthesis.equation}
                energyLabel={photosynthesis.energySource}
                inputs={photosynthesis.inputs}
                outputs={photosynthesis.outputs}
                stages={photosynthesis.stages}
                inputLevels={photoInputs}
                onInputChange={handlePhotoInputChange}
                broken={photoBroken}
              />

              <CouplingVisualization
                couplingPoints={couplingPoints}
                photoActive={photoActive}
                respActive={respActive}
              />

              <ProcessPanel
                title="Cellular Respiration"
                icon="&#128293;"
                color="#f97316"
                location={cellularRespiration.location}
                equation={cellularRespiration.equation}
                energyLabel={cellularRespiration.energyOutput}
                inputs={cellularRespiration.inputs}
                outputs={cellularRespiration.outputs}
                stages={cellularRespiration.stages}
                inputLevels={respInputs}
                onInputChange={handleRespInputChange}
                broken={respBroken}
              />
            </div>
          </TabsContent>

          {/* Respiration Only */}
          <TabsContent value="respiration" className="mt-4">
            <ProcessPanel
              title="Cellular Respiration"
              icon="&#128293;"
              color="#f97316"
              location={cellularRespiration.location}
              equation={cellularRespiration.equation}
              energyLabel={cellularRespiration.energyOutput}
              inputs={cellularRespiration.inputs}
              outputs={cellularRespiration.outputs}
              stages={cellularRespiration.stages}
              inputLevels={respInputs}
              onInputChange={handleRespInputChange}
              broken={respBroken}
            />
          </TabsContent>
        </Tabs>

        {/* Experiments Section */}
        {experiments.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium text-slate-300 flex items-center gap-2">
                <span>&#128300;</span> What If? Experiments
              </h3>
              {activeExperiment !== null && (
                <Button
                  variant="ghost"
                  onClick={handleResetExperiment}
                  className="bg-white/5 border border-white/20 hover:bg-white/10 text-xs h-7 px-3"
                >
                  Reset
                </Button>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {experiments.map((experiment, i) => (
                <Card key={i} className={`backdrop-blur-sm border-white/10 transition-all ${
                  activeExperiment === i ? 'bg-amber-950/30 border-amber-500/30 ring-1 ring-amber-500/20' : 'bg-slate-800/30'
                }`}>
                  <CardContent className="p-3 space-y-2">
                    <p className="text-xs text-slate-200 font-medium">{experiment.scenario}</p>

                    {activeExperiment !== i && !experimentRevealed[i] && (
                      <Button
                        variant="ghost"
                        onClick={() => handleRunExperiment(i)}
                        className="bg-amber-500/10 border border-amber-500/30 hover:bg-amber-500/20 text-amber-300 text-xs h-7 w-full"
                      >
                        Run Experiment
                      </Button>
                    )}

                    {activeExperiment === i && !experimentRevealed[i] && (
                      <div className="space-y-2">
                        <p className="text-[10px] text-slate-500 uppercase">What do you think will happen?</p>
                        <textarea
                          value={experimentAnswers[i] || ''}
                          onChange={(e) => setExperimentAnswers((prev) => ({ ...prev, [i]: e.target.value }))}
                          placeholder="Type your prediction..."
                          className="w-full bg-slate-900/50 border border-white/10 rounded-lg px-3 py-2 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-amber-500/50 resize-none"
                          rows={2}
                        />
                        <Button
                          variant="ghost"
                          onClick={() => handleRevealExplanation(i)}
                          className="bg-white/5 border border-white/20 hover:bg-white/10 text-xs h-7 w-full"
                        >
                          Check Prediction
                        </Button>
                      </div>
                    )}

                    {experimentRevealed[i] && (
                      <div className="space-y-1.5">
                        <div className="p-2 rounded bg-emerald-500/10 border border-emerald-500/20">
                          <p className="text-[10px] text-emerald-400 font-medium uppercase">Expected Outcome</p>
                          <p className="text-xs text-slate-300">{experiment.expectedOutcome}</p>
                        </div>
                        <div className="p-2 rounded bg-blue-500/10 border border-blue-500/20">
                          <p className="text-[10px] text-blue-400 font-medium uppercase">Explanation</p>
                          <p className="text-xs text-slate-300">{experiment.explanation}</p>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Coupling Points Info */}
        {couplingPoints.length > 0 && (
          <Accordion type="single" collapsible>
            <AccordionItem value="coupling" className="border-white/10">
              <AccordionTrigger className="text-sm text-slate-300 hover:text-slate-100 hover:no-underline">
                <span className="flex items-center gap-2">
                  <span>&#128279;</span> How Are These Processes Connected?
                </span>
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-3">
                  {couplingPoints.map((cp, i) => (
                    <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-slate-800/30 border border-white/5">
                      <MoleculeTag name={cp.molecule} color={getMoleculeColor(cp.molecule)} />
                      <div className="flex-1">
                        <div className="flex items-center gap-2 text-xs mb-1">
                          <Badge className="bg-emerald-500/20 border-emerald-500/30 text-emerald-300 text-[10px]">
                            Produced by {cp.producedBy}
                          </Badge>
                          <span className="text-slate-600">&#8594;</span>
                          <Badge className="bg-orange-500/20 border-orange-500/30 text-orange-300 text-[10px]">
                            Used by {cp.consumedBy}
                          </Badge>
                        </div>
                        <p className="text-xs text-slate-400">{cp.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        )}

        {/* Evaluation Controls */}
        <div className="flex items-center gap-3 pt-2 border-t border-white/5">
          <Button
            onClick={handleSubmitEvaluation}
            disabled={hasSubmitted || experimentsCompleted === 0}
            variant="ghost"
            className="bg-emerald-500/10 border border-emerald-500/30 hover:bg-emerald-500/20 text-emerald-300"
          >
            {hasSubmitted ? 'Submitted' : 'Submit Progress'}
          </Button>
          {hasSubmitted && (
            <Button
              onClick={handleReset}
              variant="ghost"
              className="bg-white/5 border border-white/20 hover:bg-white/10"
            >
              Try Again
            </Button>
          )}
          <div className="flex-1" />
          <span className="text-xs text-slate-600">
            {experimentsCompleted}/{experiments.length} experiments completed
          </span>
        </div>
      </CardContent>
    </Card>
  );
};

export default EnergyCycleEngine;
