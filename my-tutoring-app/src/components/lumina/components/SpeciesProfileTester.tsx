'use client';

import React, { useState } from 'react';
import SpeciesProfile, { SpeciesProfileData } from '../primitives/biology-primitives/SpeciesProfile';

interface SpeciesProfileTesterProps {
  onBack: () => void;
}

type GradeLevel = 'toddler' | 'preschool' | 'kindergarten' | 'elementary' | 'middle-school' | 'high-school' | 'undergraduate' | 'graduate' | 'phd';

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

export const SpeciesProfileTester: React.FC<SpeciesProfileTesterProps> = ({ onBack }) => {
  const [species, setSpecies] = useState('');
  const [gradeLevel, setGradeLevel] = useState<GradeLevel>('elementary');
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generatedData, setGeneratedData] = useState<SpeciesProfileData | null>(null);

  const handleGenerate = async () => {
    if (!species.trim()) return;

    setIsGenerating(true);
    setError(null);

    try {
      // Use the API route to generate the species profile
      const response = await fetch('/api/lumina', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'generateComponentContent',
          params: {
            componentId: 'species-profile',
            topic: species,
            gradeLevel: gradeLevel,
            config: {
              intent: 'Provide comprehensive biological and ecological information about the species',
            },
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
      setError(err instanceof Error ? err.message : 'Failed to generate species profile');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="min-h-screen">
      {/* Header */}
      <div className="mb-4 text-center">
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
      <div className="text-center mb-6">
        <h2 className="text-3xl font-bold text-white mb-1">Species Profile Tester</h2>
        <p className="text-sm text-slate-400">AI-generated biological profiles for any species</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[320px,1fr] gap-4 px-4">
        {/* Left Column: Controls */}
        <div className="bg-slate-800/50 rounded-2xl p-4 border border-slate-700 h-fit">
          <h3 className="text-xl font-bold text-white mb-4">Generate</h3>

          {/* Species Input */}
          <div className="mb-4">
            <label className="block text-xs font-medium text-slate-300 mb-1">Species Name</label>
            <input
              type="text"
              value={species}
              onChange={(e) => setSpecies(e.target.value)}
              placeholder="e.g. Tyrannosaurus Rex..."
              className="w-full px-3 py-2 text-sm bg-slate-700 text-white rounded-lg border border-slate-600 focus:border-blue-500 focus:outline-none"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleGenerate();
                }
              }}
            />
          </div>

          {/* Grade Level */}
          <div className="mb-4">
            <label className="block text-xs font-medium text-slate-300 mb-1">Grade Level</label>
            <select
              value={gradeLevel}
              onChange={(e) => setGradeLevel(e.target.value as GradeLevel)}
              className="w-full px-3 py-2 text-sm bg-slate-700 text-white rounded-lg border border-slate-600 focus:border-blue-500 focus:outline-none"
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
            disabled={isGenerating || !species.trim()}
            className="w-full px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 disabled:bg-slate-700 disabled:opacity-50 text-white rounded-lg font-semibold transition-all flex items-center justify-center gap-2"
          >
            {isGenerating ? (
              <>
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <span>🦖</span>
                Generate Species Profile
              </>
            )}
          </button>

          {/* Info */}
          <div className="mt-4 p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
            <h4 className="text-xs font-bold text-blue-300 mb-1">Profile Includes</h4>
            <ul className="text-[10px] text-slate-400 space-y-0.5">
              <li>• <strong>Physical Stats:</strong> Size & weight</li>
              <li>• <strong>Diet:</strong> Food & hunting behavior</li>
              <li>• <strong>Habitat:</strong> Time period & location</li>
              <li>• <strong>Taxonomy:</strong> Scientific classification</li>
              <li>• <strong>Facts:</strong> Interesting discoveries</li>
            </ul>
          </div>

          {/* Quick Examples */}
          <div className="mt-4">
            <label className="block text-xs font-medium text-slate-300 mb-2">Quick Examples</label>
            <div className="space-y-2">
              {[
                { name: 'Tyrannosaurus Rex', icon: '🦖' },
                { name: 'Great White Shark', icon: '🦈' },
                { name: 'Blue Whale', icon: '🐋' },
                { name: 'Bald Eagle', icon: '🦅' },
              ].map((example) => (
                <button
                  key={example.name}
                  onClick={() => {
                    setSpecies(example.name);
                    // Auto-generate after setting species
                    setTimeout(() => handleGenerate(), 100);
                  }}
                  className="w-full px-3 py-2 text-xs bg-slate-700 hover:bg-slate-600 text-white rounded-lg border border-slate-600 transition-all flex items-center gap-2"
                >
                  <span>{example.icon}</span>
                  <span>{example.name}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column: Preview */}
        <div className="flex-1 bg-slate-800/50 rounded-2xl p-4 border border-slate-700 min-h-[calc(100vh-200px)]">
          {generatedData ? (
            <div className="bg-slate-900/50 rounded-xl overflow-hidden h-full overflow-y-auto">
              <SpeciesProfile
                data={generatedData}
              />
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-slate-500">
              <span className="text-6xl mb-4">🦕</span>
              <p className="text-center">Enter a species name and click "Generate" to create a profile</p>
              <p className="text-xs text-slate-600 mt-2">Try dinosaurs, marine animals, birds, or any living creature!</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SpeciesProfileTester;
