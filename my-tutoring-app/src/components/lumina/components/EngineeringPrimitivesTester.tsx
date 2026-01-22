'use client';

import React, { useState } from 'react';
import LeverLab from '../primitives/visual-primitives/engineering/LeverLab';
import PulleySystemBuilder from '../primitives/visual-primitives/engineering/PulleySystemBuilder';
import RampLab from '../primitives/visual-primitives/engineering/RampLab';
import WheelAxleExplorer from '../primitives/visual-primitives/engineering/WheelAxleExplorer';
import GearTrainBuilder from '../primitives/visual-primitives/engineering/GearTrainBuilder';

interface EngineeringPrimitivesTesterProps {
  onBack: () => void;
}

type PrimitiveType = 'lever-lab' | 'pulley-system-builder' | 'ramp-lab' | 'wheel-axle-explorer' | 'gear-train-builder';
type GradeLevel = 'toddler' | 'preschool' | 'kindergarten' | 'elementary' | 'middle-school' | 'high-school' | 'undergraduate' | 'graduate' | 'phd';

const PRIMITIVE_OPTIONS: Array<{ value: PrimitiveType; label: string; icon: string; topic: string }> = [
  { value: 'lever-lab', label: 'Lever Lab', icon: '⚖️', topic: 'Understanding levers and balance' },
  { value: 'pulley-system-builder', label: 'Pulley System Builder', icon: '🏗️', topic: 'Understanding pulleys and mechanical advantage' },
  { value: 'ramp-lab', label: 'Ramp Lab', icon: '📐', topic: 'Understanding inclined planes and ramps' },
  { value: 'wheel-axle-explorer', label: 'Wheel & Axle Explorer', icon: '⚙️', topic: 'Understanding wheel and axle machines' },
  { value: 'gear-train-builder', label: 'Gear Train Builder', icon: '🔩', topic: 'Understanding gears and speed ratios' },
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

// Dynamic renderer that maps componentId to the appropriate primitive component
const PrimitiveRenderer: React.FC<{ componentId: PrimitiveType; data: unknown }> = ({ componentId, data }) => {
  if (!data) return null;

  switch (componentId) {
    case 'lever-lab':
      return <LeverLab data={data as Parameters<typeof LeverLab>[0]['data']} />;
    case 'pulley-system-builder':
      return <PulleySystemBuilder data={data as Parameters<typeof PulleySystemBuilder>[0]['data']} />;
    case 'ramp-lab':
      return <RampLab data={data as Parameters<typeof RampLab>[0]['data']} />;
    case 'wheel-axle-explorer':
      return <WheelAxleExplorer data={data as Parameters<typeof WheelAxleExplorer>[0]['data']} />;
    case 'gear-train-builder':
      return <GearTrainBuilder data={data as Parameters<typeof GearTrainBuilder>[0]['data']} />;
    default:
      return <div className="text-slate-400">Unknown primitive: {componentId}</div>;
  }
};

export const EngineeringPrimitivesTester: React.FC<EngineeringPrimitivesTesterProps> = ({ onBack }) => {
  const [selectedPrimitive, setSelectedPrimitive] = useState<PrimitiveType>('lever-lab');
  const [gradeLevel, setGradeLevel] = useState<GradeLevel>('elementary');
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generatedData, setGeneratedData] = useState<unknown>(null);

  const selectedOption = PRIMITIVE_OPTIONS.find(p => p.value === selectedPrimitive)!;

  const handleGenerate = async () => {
    setIsGenerating(true);
    setError(null);

    try {
      const response = await fetch('/api/lumina', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'generateComponentContent',
          params: {
            componentId: selectedPrimitive,
            topic: selectedOption.topic,
            gradeLevel,
            config: {},
          },
        }),
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.statusText}`);
      }

      const result = await response.json();
      setGeneratedData(result.data || result);
    } catch (err) {
      console.error('Generation error:', err);
      setError(err instanceof Error ? err.message : 'Failed to generate primitive');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="min-h-screen">
      {/* Header */}
      <div className="mb-8 text-center">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-2 px-6 py-3 bg-slate-800/50 hover:bg-slate-700/50 text-white rounded-full border border-slate-600 transition-all"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Back to Home
        </button>
      </div>

      {/* Title */}
      <div className="text-center mb-8">
        <h2 className="text-4xl font-bold text-white mb-2">Engineering Primitives Tester</h2>
        <p className="text-slate-400">AI-generated engineering visualizations for any grade level</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 max-w-7xl mx-auto">
        {/* Left Column: Controls */}
        <div className="bg-slate-800/50 rounded-2xl p-6 border border-slate-700 h-fit">
          <h3 className="text-2xl font-bold text-white mb-6">Generate</h3>

          {/* Primitive Selector */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-slate-300 mb-3">Select Primitive</label>
            <div className="grid grid-cols-1 gap-2">
              {PRIMITIVE_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  onClick={() => {
                    setSelectedPrimitive(option.value);
                    setGeneratedData(null);
                  }}
                  className={`p-3 rounded-lg border transition-all text-left ${
                    selectedPrimitive === option.value
                      ? 'border-orange-500 bg-orange-500/20 text-orange-300'
                      : 'border-slate-700 bg-slate-800/50 text-slate-400 hover:bg-slate-700'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-xl">{option.icon}</span>
                    <span className="text-sm font-medium">{option.label}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Grade Level */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-slate-300 mb-2">Grade Level</label>
            <select
              value={gradeLevel}
              onChange={(e) => setGradeLevel(e.target.value as GradeLevel)}
              className="w-full px-4 py-2 bg-slate-700 text-white rounded-lg border border-slate-600 focus:border-orange-500 focus:outline-none"
            >
              {GRADE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </div>

          {/* Error Display */}
          {error && (
            <div className="mb-4 p-3 bg-red-900/20 border border-red-500/50 rounded-lg">
              <p className="text-red-400 text-sm">{error}</p>
            </div>
          )}

          {/* Generate Button */}
          <button
            onClick={handleGenerate}
            disabled={isGenerating}
            className="w-full px-4 py-3 bg-orange-600 hover:bg-orange-700 disabled:bg-slate-700 disabled:opacity-50 text-white rounded-lg font-semibold transition-all flex items-center justify-center gap-2"
          >
            {isGenerating ? (
              <>
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <span>✨</span>
                Generate with AI
              </>
            )}
          </button>

          {/* Info */}
          <p className="mt-4 text-xs text-slate-500 text-center">
            Gemini will generate a {selectedOption.label.toLowerCase()} appropriate for {gradeLevel} level
          </p>
        </div>

        {/* Right Column: Preview */}
        <div className="bg-slate-800/50 rounded-2xl p-6 border border-slate-700">
          <h3 className="text-2xl font-bold text-white mb-6">Preview</h3>

          {generatedData ? (
            <PrimitiveRenderer componentId={selectedPrimitive} data={generatedData} />
          ) : (
            <div className="flex flex-col items-center justify-center h-64 text-slate-500">
              <span className="text-4xl mb-4">{selectedOption.icon}</span>
              <p>Click "Generate with AI" to create a {selectedOption.label.toLowerCase()}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default EngineeringPrimitivesTester;
