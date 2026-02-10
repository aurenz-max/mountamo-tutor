'use client';

import React, { useState } from 'react';
import OrganismCard from '../primitives/visual-primitives/biology/OrganismCard';
import SpeciesProfile from '../primitives/biology-primitives/SpeciesProfile';
import ClassificationSorter from '../primitives/visual-primitives/biology/ClassificationSorter';
import LifeCycleSequencer from '../primitives/visual-primitives/biology/LifeCycleSequencer';
import BodySystemExplorer from '../primitives/visual-primitives/biology/BodySystemExplorer';
import HabitatDiorama from '../primitives/visual-primitives/biology/HabitatDiorama';
import CompareContrast from '../primitives/visual-primitives/biology/CompareContrast';
import ProcessAnimator from '../primitives/visual-primitives/biology/ProcessAnimator';
import MicroscopeViewer from '../primitives/visual-primitives/biology/MicroscopeViewer';
import AdaptationInvestigator from '../primitives/visual-primitives/biology/AdaptationInvestigator';
import FoodWebBuilder from '../primitives/visual-primitives/biology/FoodWebBuilder';
import CellBuilder from '../primitives/visual-primitives/biology/CellBuilder';
import {
  EvaluationProvider,
  useEvaluationContext,
  type PrimitiveEvaluationResult,
} from '../evaluation';

interface BiologyPrimitivesTesterProps {
  onBack: () => void;
}

type PrimitiveType = 'organism-card' | 'species-profile' | 'classification-sorter' | 'life-cycle-sequencer' | 'body-system-explorer' | 'habitat-diorama' | 'bio-compare-contrast' | 'bio-process-animator' | 'microscope-viewer' | 'adaptation-investigator' | 'food-web-builder' | 'cell-builder';
type GradeLevel = 'toddler' | 'preschool' | 'kindergarten' | 'elementary' | 'middle-school' | 'high-school' | 'undergraduate' | 'graduate' | 'phd';

const PRIMITIVE_OPTIONS: Array<{ value: PrimitiveType; label: string; icon: string; topic: string }> = [
  { value: 'organism-card', label: 'Organism Card', icon: '🦋', topic: 'Basic organism characteristics' },
  { value: 'species-profile', label: 'Species Profile', icon: '🦖', topic: 'Detailed species information' },
  { value: 'classification-sorter', label: 'Classification Sorter', icon: '🔍', topic: 'Interactive sorting activity' },
  { value: 'life-cycle-sequencer', label: 'Life Cycle Sequencer', icon: '🔄', topic: 'Temporal sequence learning' },
  { value: 'body-system-explorer', label: 'Body System Explorer', icon: '🫁', topic: 'Interactive anatomy exploration' },
  { value: 'habitat-diorama', label: 'Habitat Diorama', icon: '🌳', topic: 'Interactive ecosystem explorer' },
  { value: 'bio-compare-contrast', label: 'Compare & Contrast', icon: '🔄', topic: 'Frogs vs Toads' },
  { value: 'bio-process-animator', label: 'Process Animator', icon: '🎬', topic: 'Photosynthesis' },
  { value: 'microscope-viewer', label: 'Microscope Viewer', icon: '🔬', topic: 'Onion cell' },
  { value: 'adaptation-investigator', label: 'Adaptation Investigator', icon: '🧬', topic: 'Structure-function reasoning' },
  { value: 'food-web-builder', label: 'Food Web Builder', icon: '🕸️', topic: 'Ecosystem energy flow' },
  { value: 'cell-builder', label: 'Cell Builder', icon: '🧫', topic: 'Cell structure and organelles' },
];

const GRADE_OPTIONS: Array<{ value: GradeLevel; label: string }> = [
  { value: 'toddler', label: 'Toddler' },
  { value: 'preschool', label: 'Preschool' },
  { value: 'kindergarten', label: 'Kindergarten' },
  { value: 'elementary', label: 'Elementary' },
  { value: 'middle-school', label: 'Middle School' },
  { value: 'high-school', label: 'High School' },
  { value: 'undergraduate', label: 'Undergraduate' },
  { value: 'graduate', label: 'Graduate' },
  { value: 'phd', label: 'PhD' },
];

// Quick example organisms
const EXAMPLE_ORGANISMS = [
  { name: 'Tyrannosaurus Rex', icon: '🦖' },
  { name: 'Great White Shark', icon: '🦈' },
  { name: 'Blue Whale', icon: '🐋' },
  { name: 'Bald Eagle', icon: '🦅' },
  { name: 'Giant Panda', icon: '🐼' },
  { name: 'Monarch Butterfly', icon: '🦋' },
];

// Dynamic renderer that maps componentId to the appropriate primitive component
const PrimitiveRenderer: React.FC<{
  componentId: PrimitiveType;
  data: unknown;
  onEvaluationSubmit?: (result: PrimitiveEvaluationResult) => void;
}> = ({ componentId, data, onEvaluationSubmit }) => {
  if (!data) return null;

  switch (componentId) {
    case 'organism-card':
      return (
        <OrganismCard
          data={data as Parameters<typeof OrganismCard>[0]['data']}
        />
      );
    case 'species-profile':
      return (
        <SpeciesProfile
          data={data as Parameters<typeof SpeciesProfile>[0]['data']}
        />
      );
    case 'classification-sorter':
      return (
        <ClassificationSorter
          data={{
            ...(data as Parameters<typeof ClassificationSorter>[0]['data']),
            instanceId: `classification-sorter-${Date.now()}`,
            onEvaluationSubmit,
          }}
        />
      );
    case 'life-cycle-sequencer':
      return (
        <LifeCycleSequencer
          data={{
            ...(data as Parameters<typeof LifeCycleSequencer>[0]['data']),
            instanceId: `life-cycle-sequencer-${Date.now()}`,
            // Don't pass onEvaluationSubmit - the usePrimitiveEvaluation hook already handles context submission
          }}
        />
      );
    case 'body-system-explorer':
      return (
        <BodySystemExplorer
          data={data as Parameters<typeof BodySystemExplorer>[0]['data']}
        />
      );
    case 'habitat-diorama':
      return (
        <HabitatDiorama
          data={data as Parameters<typeof HabitatDiorama>[0]['data']}
          instanceId={`habitat-diorama-${Date.now()}`}
          onInteraction={(interaction) => {
            console.log('Habitat interaction:', interaction);
          }}
        />
      );
    case 'bio-compare-contrast':
      return (
        <CompareContrast
          data={{
            ...(data as Parameters<typeof CompareContrast>[0]['data']),
            instanceId: `bio-compare-contrast-${Date.now()}`,
            onEvaluationSubmit,
          }}
        />
      );
    case 'bio-process-animator':
      return (
        <ProcessAnimator
          data={{
            ...(data as Parameters<typeof ProcessAnimator>[0]['data']),
            instanceId: `bio-process-animator-${Date.now()}`,
            onEvaluationSubmit,
          }}
        />
      );
    case 'microscope-viewer':
      return (
        <MicroscopeViewer
          data={{
            ...(data as Parameters<typeof MicroscopeViewer>[0]['data']),
            instanceId: `microscope-viewer-${Date.now()}`,
            onEvaluationSubmit,
          }}
        />
      );
    case 'adaptation-investigator':
      return (
        <AdaptationInvestigator
          data={{
            ...(data as Parameters<typeof AdaptationInvestigator>[0]['data']),
            instanceId: `adaptation-investigator-${Date.now()}`,
            onEvaluationSubmit,
          }}
        />
      );
    case 'food-web-builder':
      return (
        <FoodWebBuilder
          data={{
            ...(data as Parameters<typeof FoodWebBuilder>[0]['data']),
            instanceId: `food-web-builder-${Date.now()}`,
            onEvaluationSubmit,
          }}
        />
      );
    case 'cell-builder':
      return (
        <CellBuilder
          data={{
            ...(data as Parameters<typeof CellBuilder>[0]['data']),
            instanceId: `cell-builder-${Date.now()}`,
            onEvaluationSubmit,
          }}
        />
      );
    default:
      return <div className="text-slate-400">Unknown primitive: {componentId}</div>;
  }
};

// Evaluation Results Panel - Shows submitted results from the session
const EvaluationResultsPanel: React.FC = () => {
  const context = useEvaluationContext();

  if (!context) {
    return (
      <div className="p-4 bg-slate-800/50 rounded-lg border border-slate-700">
        <p className="text-slate-500 text-sm">Evaluation tracking not available (no provider)</p>
      </div>
    );
  }

  const { submittedResults, pendingSubmissions, isOnline, getSessionSummary } = context;
  const summary = getSessionSummary();

  return (
    <div className="p-4 bg-slate-800/50 rounded-xl border border-slate-700 space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="text-lg font-semibold text-white">Evaluation Results</h4>
        <div className={`flex items-center gap-2 px-2 py-1 rounded-full text-xs ${
          isOnline ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
        }`}>
          <span className={`w-2 h-2 rounded-full ${isOnline ? 'bg-green-400' : 'bg-red-400'}`} />
          {isOnline ? 'Online' : 'Offline'}
        </div>
      </div>

      {/* Session Summary */}
      <div className="grid grid-cols-3 gap-3">
        <div className="p-3 bg-slate-700/50 rounded-lg text-center">
          <div className="text-2xl font-bold text-white">{summary.totalAttempts}</div>
          <div className="text-xs text-slate-400">Attempts</div>
        </div>
        <div className="p-3 bg-slate-700/50 rounded-lg text-center">
          <div className="text-2xl font-bold text-green-400">{summary.successfulAttempts}</div>
          <div className="text-xs text-slate-400">Successes</div>
        </div>
        <div className="p-3 bg-slate-700/50 rounded-lg text-center">
          <div className="text-2xl font-bold text-amber-400">{Math.round(summary.averageScore)}%</div>
          <div className="text-xs text-slate-400">Avg Score</div>
        </div>
      </div>

      {/* Pending Submissions */}
      {pendingSubmissions.length > 0 && (
        <div className="p-2 bg-amber-500/10 rounded-lg border border-amber-500/30">
          <p className="text-amber-400 text-xs">
            {pendingSubmissions.length} evaluation(s) pending sync...
          </p>
        </div>
      )}

      {/* Recent Results */}
      {submittedResults.length > 0 && (
        <div className="space-y-2">
          <h5 className="text-sm font-medium text-slate-300">Recent Results</h5>
          <div className="max-h-48 overflow-y-auto space-y-2">
            {submittedResults.slice(-5).reverse().map((result) => (
              <div
                key={result.attemptId}
                className={`p-3 rounded-lg border ${
                  result.success
                    ? 'bg-green-500/10 border-green-500/30'
                    : 'bg-red-500/10 border-red-500/30'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className={`text-sm font-medium ${
                    result.success ? 'text-green-400' : 'text-red-400'
                  }`}>
                    {result.success ? '✓ Success' : '✗ Incomplete'}
                  </span>
                  <span className="text-xs text-slate-400">
                    {result.score}%
                  </span>
                </div>
                {result.feedback && (
                  <p className="text-xs text-slate-400 mt-1">{result.feedback}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {submittedResults.length === 0 && (
        <div className="text-center py-8 text-slate-500 text-sm">
          No evaluation results yet. Complete a primitive activity to see results.
        </div>
      )}
    </div>
  );
};

// Main component with content generation
const BiologyPrimitivesTesterContent: React.FC<BiologyPrimitivesTesterProps> = ({ onBack }) => {
  const context = useEvaluationContext();
  const [selectedPrimitive, setSelectedPrimitive] = useState<PrimitiveType>('organism-card');
  const [selectedGrade, setSelectedGrade] = useState<GradeLevel>('elementary');
  const [topic, setTopic] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedData, setGeneratedData] = useState<unknown>(null);
  const [error, setError] = useState<string | null>(null);

  const selectedOption = PRIMITIVE_OPTIONS.find((p) => p.value === selectedPrimitive);

  const handleGenerate = async () => {
    setIsGenerating(true);
    setError(null);
    setGeneratedData(null);

    try {
      // Use topic if provided, otherwise use a default based on primitive type
      const defaultTopic =
        selectedPrimitive === 'species-profile' ? 'Tyrannosaurus Rex' :
        selectedPrimitive === 'classification-sorter' ? 'Sort animals by vertebrate class' :
        selectedPrimitive === 'life-cycle-sequencer' ? 'Butterfly metamorphosis' :
        selectedPrimitive === 'body-system-explorer' ? 'digestive system' :
        selectedPrimitive === 'habitat-diorama' ? 'Coral Reef Ecosystem' :
        selectedPrimitive === 'microscope-viewer' ? 'Onion epidermal cell' :
        selectedPrimitive === 'adaptation-investigator' ? 'Arctic Fox fur color change' :
        selectedPrimitive === 'food-web-builder' ? 'Grassland ecosystem' :
        selectedPrimitive === 'cell-builder' ? 'Muscle cell' :
        'Monarch Butterfly';
      const currentTopic = topic.trim() || defaultTopic;

      // Build config based on primitive type
      const config: Record<string, unknown> = {};
      if (selectedPrimitive === 'body-system-explorer') {
        // For body system explorer, extract the system from the topic
        const systemMatch = currentTopic.toLowerCase().match(/(digestive|circulatory|respiratory|nervous|skeletal|muscular|immune|endocrine|reproductive|urinary)/);
        if (systemMatch) {
          config.system = systemMatch[1];
        }
      }

      const response = await fetch('/api/lumina', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'generateComponentContent',
          params: {
            componentId: selectedPrimitive,
            topic: currentTopic,
            gradeLevel: selectedGrade,
            config,
          },
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to generate content');
      }

      const result = await response.json();
      setGeneratedData(result.data || result);
    } catch (err) {
      console.error('Generation error:', err);
      setError(err instanceof Error ? err.message : 'Unknown error occurred');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleEvaluationSubmit = (result: PrimitiveEvaluationResult) => {
    if (context) {
      context.submitEvaluation(result);
    }
  };

  const handleQuickExample = (exampleName: string) => {
    setTopic(exampleName);
    // Auto-generate after setting topic
    setTimeout(() => {
      handleGenerate();
    }, 100);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-green-950 to-slate-950">
      {/* Header */}
      <div className="border-b border-slate-800 bg-slate-900/50 backdrop-blur">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={onBack}
              className="text-slate-400 hover:text-white transition-colors"
            >
              ← Back
            </button>
            <div className="h-6 w-px bg-slate-700" />
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              <span>🧬</span>
              <span>Biology Primitives Tester</span>
            </h1>
          </div>
        </div>
      </div>

      {/* Main Layout - Compact Left Sidebar */}
      <div className="flex h-[calc(100vh-73px)]">
        {/* Compact Left Panel */}
        <div className="w-64 border-r border-slate-800 bg-slate-900/30 backdrop-blur p-4 overflow-y-auto flex-shrink-0">
          <div className="space-y-4">
            {/* Primitive Selector */}
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-2 uppercase tracking-wider">
                Primitive
              </label>
              <div className="space-y-1">
                {PRIMITIVE_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    onClick={() => setSelectedPrimitive(option.value)}
                    className={`w-full text-left px-3 py-2 rounded-lg transition-all ${
                      selectedPrimitive === option.value
                        ? 'bg-green-600 text-white shadow-lg shadow-green-500/20'
                        : 'bg-slate-800/50 text-slate-300 hover:bg-slate-800 hover:text-white'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{option.icon}</span>
                      <span className="text-sm font-medium">{option.label}</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Grade Level Selector */}
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-2 uppercase tracking-wider">
                Grade Level
              </label>
              <select
                value={selectedGrade}
                onChange={(e) => setSelectedGrade(e.target.value as GradeLevel)}
                className="w-full bg-slate-800 text-white border border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              >
                {GRADE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Topic Input */}
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-2 uppercase tracking-wider">
                {selectedPrimitive === 'classification-sorter' ? 'Topic (optional)' :
                 selectedPrimitive === 'life-cycle-sequencer' ? 'Life Cycle (optional)' :
                 selectedPrimitive === 'habitat-diorama' ? 'Ecosystem/Habitat (optional)' :
                 selectedPrimitive === 'microscope-viewer' ? 'Specimen (optional)' :
                 selectedPrimitive === 'adaptation-investigator' ? 'Adaptation (optional)' :
                 selectedPrimitive === 'food-web-builder' ? 'Ecosystem (optional)' :
                 selectedPrimitive === 'cell-builder' ? 'Cell Type (optional)' :
                 'Species/Organism (optional)'}
              </label>
              <input
                type="text"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder={
                  selectedPrimitive === 'classification-sorter' ? 'e.g., "Sort by diet"' :
                  selectedPrimitive === 'life-cycle-sequencer' ? 'e.g., "Frog life cycle"' :
                  selectedPrimitive === 'habitat-diorama' ? 'e.g., "African Savanna"' :
                  selectedPrimitive === 'microscope-viewer' ? 'e.g., "Onion cell", "Paramecium"' :
                  selectedPrimitive === 'adaptation-investigator' ? 'e.g., "Cactus spines", "Chameleon camouflage"' :
                  selectedPrimitive === 'food-web-builder' ? 'e.g., "Coral reef", "Temperate forest"' :
                  selectedPrimitive === 'cell-builder' ? 'e.g., "Muscle cell", "Leaf cell", "Nerve cell", "Plant cell"' :
                  'Leave blank for default...'
                }
                className="w-full bg-slate-800 text-white border border-slate-700 rounded-lg px-3 py-2 text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>

            {/* Generate Button */}
            <button
              onClick={handleGenerate}
              disabled={isGenerating}
              className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 disabled:from-slate-700 disabled:to-slate-700 text-white font-semibold py-3 px-4 rounded-lg transition-all shadow-lg disabled:shadow-none disabled:cursor-not-allowed"
            >
              {isGenerating ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                      fill="none"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                  Generating...
                </span>
              ) : (
                '✨ Generate Content'
              )}
            </button>

            {/* Quick Examples */}
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-2 uppercase tracking-wider">
                Quick Examples
              </label>
              <div className="space-y-1">
                {EXAMPLE_ORGANISMS.map((example) => (
                  <button
                    key={example.name}
                    onClick={() => {
                      setTopic(example.name);
                      setTimeout(() => handleGenerate(), 100);
                    }}
                    disabled={isGenerating}
                    className="w-full px-3 py-2 text-xs bg-slate-800/50 hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg border border-slate-700 transition-all flex items-center gap-2"
                  >
                    <span>{example.icon}</span>
                    <span>{example.name}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Evaluation Results (Compact) */}
            <div className="pt-4 border-t border-slate-700">
              <EvaluationResultsPanel />
            </div>
          </div>
        </div>

        {/* Main Content Area - Large Primitive Display */}
        <div className="flex-1 overflow-y-auto">
          <div className="p-6">
            {error && (
              <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
                <p className="text-red-400 text-sm font-medium">Error: {error}</p>
              </div>
            )}

            {!generatedData && !error && (
              <div className="flex items-center justify-center h-[calc(100vh-200px)]">
                <div className="text-center">
                  <div className="text-6xl mb-4">🧬</div>
                  <h3 className="text-xl font-semibold text-white mb-2">
                    Welcome to Biology Primitives
                  </h3>
                  <p className="text-slate-400 max-w-md">
                    Select a primitive, choose a grade level, enter a species or organism,
                    and click Generate to explore interactive biology visualizations.
                  </p>
                </div>
              </div>
            )}

            {generatedData && (
              <div className="space-y-6">
                <PrimitiveRenderer
                  componentId={selectedPrimitive}
                  data={generatedData}
                  onEvaluationSubmit={handleEvaluationSubmit}
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// Wrapper with EvaluationProvider
const BiologyPrimitivesTester: React.FC<BiologyPrimitivesTesterProps> = (props) => {
  return (
    <EvaluationProvider>
      <BiologyPrimitivesTesterContent {...props} />
    </EvaluationProvider>
  );
};

export default BiologyPrimitivesTester;
