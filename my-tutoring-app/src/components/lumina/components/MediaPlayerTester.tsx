'use client';

import React, { useState } from 'react';
import MediaPlayer from '../primitives/MediaPlayer';
import { MediaPlayerData } from '../types';
import { EvaluationProvider } from '../evaluation';
import { ExhibitProvider } from '../contexts/ExhibitContext';
import { LuminaAIProvider } from '@/contexts/LuminaAIContext';

interface MediaPlayerTesterProps {
  onBack: () => void;
}

const MediaPlayerTesterInner: React.FC<MediaPlayerTesterProps> = ({ onBack }) => {
  const [mediaData, setMediaData] = useState<MediaPlayerData | null>(null);

  // Generation controls
  const [topic, setTopic] = useState('');
  const [gradeLevel, setGradeLevel] = useState<string>('elementary');
  const [segmentCount, setSegmentCount] = useState<number>(4);
  const [imageResolution, setImageResolution] = useState<'1K' | '2K' | '4K'>('1K');

  // Generation state
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = async () => {
    if (!topic.trim()) {
      setError('Please enter a topic');
      return;
    }

    setIsGenerating(true);
    setError(null);

    try {
      // Use universal generateComponentContent endpoint (registry pattern)
      const response = await fetch('/api/lumina', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'generateComponentContent',
          params: {
            componentId: 'media-player',
            topic,
            gradeLevel,
            config: {
              segmentCount,
              imageResolution,
            },
          },
        }),
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.statusText}`);
      }

      const result = await response.json();
      // The registry returns { type, instanceId, data } - extract the data
      const generatedMedia = result.data || result;
      setMediaData(generatedMedia);
    } catch (err) {
      console.error('Generation error:', err);
      setError(err instanceof Error ? err.message : 'Failed to generate media player content');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleClear = () => {
    setMediaData(null);
    setError(null);
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
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path>
          </svg>
          Back to Home
        </button>
      </div>

      {/* Title */}
      <div className="text-center mb-8">
        <h2 className="text-4xl font-bold text-white mb-2">Media Player Tester</h2>
        <p className="text-slate-400">Generate and test audio-visual lesson content using AI</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 max-w-7xl mx-auto">
        {/* Left Column: Generation Controls */}
        <div className="bg-slate-800/50 rounded-2xl p-6 border border-slate-700">
          <h3 className="text-2xl font-bold text-white mb-6">AI Media Generator</h3>

          {/* Topic Input */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-slate-300 mb-2">Topic</label>
            <input
              type="text"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              className="w-full px-4 py-2 bg-slate-700 text-white rounded-lg border border-slate-600 focus:border-blue-500 focus:outline-none"
              placeholder="e.g., Photosynthesis, Water Cycle, Newton's Laws"
            />
          </div>

          {/* Common Fields Grid */}
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Grade Level</label>
              <select
                value={gradeLevel}
                onChange={(e) => setGradeLevel(e.target.value)}
                className="w-full px-4 py-2 bg-slate-700 text-white rounded-lg border border-slate-600 focus:border-blue-500 focus:outline-none"
              >
                <option value="toddler">Toddler</option>
                <option value="preschool">Preschool</option>
                <option value="kindergarten">Kindergarten</option>
                <option value="elementary">Elementary</option>
                <option value="middle-school">Middle School</option>
                <option value="high-school">High School</option>
                <option value="undergraduate">Undergraduate</option>
                <option value="graduate">Graduate</option>
                <option value="phd">PhD</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Segments</label>
              <input
                type="number"
                min="2"
                max="6"
                value={segmentCount}
                onChange={(e) => setSegmentCount(Math.max(2, Math.min(6, parseInt(e.target.value) || 4)))}
                className="w-full px-4 py-2 bg-slate-700 text-white rounded-lg border border-slate-600 focus:border-blue-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Image Resolution */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-slate-300 mb-2">Image Resolution</label>
            <div className="flex gap-2">
              {(['1K', '2K', '4K'] as const).map((res) => (
                <button
                  key={res}
                  type="button"
                  onClick={() => setImageResolution(res)}
                  className={`flex-1 rounded-lg border px-4 py-2 text-sm font-medium transition-all ${
                    imageResolution === res
                      ? 'border-indigo-500 bg-indigo-500/20 text-indigo-300'
                      : 'border-slate-700 bg-slate-800/50 text-slate-400 hover:bg-slate-700'
                  }`}
                >
                  {res}
                </button>
              ))}
            </div>
            <p className="text-xs text-slate-500 mt-2">Higher resolutions take longer to generate</p>
          </div>

          {/* Error Display */}
          {error && (
            <div className="mb-6 p-4 bg-red-900/20 border border-red-500/50 rounded-lg">
              <p className="text-red-400 text-sm">{error}</p>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-3">
            <button
              onClick={handleGenerate}
              disabled={isGenerating}
              className="flex-1 px-6 py-3 bg-purple-600 hover:bg-purple-700 disabled:bg-slate-700 disabled:opacity-50 text-white rounded-lg font-semibold transition-all flex items-center justify-center gap-2"
            >
              {isGenerating ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  Generating...
                </>
              ) : (
                'Generate Media Player'
              )}
            </button>
            {mediaData && (
              <button
                onClick={handleClear}
                disabled={isGenerating}
                className="px-6 py-3 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white rounded-lg font-semibold transition-all"
              >
                Clear
              </button>
            )}
          </div>

          {/* Quick Examples */}
          <div className="mt-6 pt-6 border-t border-slate-700">
            <p className="text-xs text-slate-500 mb-3 uppercase tracking-wider">Quick Topics</p>
            <div className="flex flex-wrap gap-2">
              {['Water Cycle', 'Photosynthesis', 'Solar System', 'Food Chain', 'Life Cycle of a Butterfly', 'States of Matter'].map(exampleTopic => (
                <button
                  key={exampleTopic}
                  onClick={() => setTopic(exampleTopic)}
                  className="px-3 py-1 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-full text-xs transition-colors"
                >
                  {exampleTopic}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column: Preview */}
        <div className="bg-slate-900/50 rounded-2xl p-6 border border-slate-700">
          <h3 className="text-2xl font-bold text-white mb-6">
            Live Preview {mediaData && `(${mediaData.segments.length} segments)`}
          </h3>
          {!mediaData ? (
            <div className="flex items-center justify-center h-96 text-slate-500">
              <div className="text-center max-w-sm">
                <svg className="w-16 h-16 mx-auto mb-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"></path>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                </svg>
                <p className="text-lg mb-2">No media player generated yet</p>
                <p className="text-sm text-slate-600">Enter a topic and click "Generate Media Player"</p>
              </div>
            </div>
          ) : (
            <div className="overflow-y-auto">
              <MediaPlayer data={mediaData} />
            </div>
          )}
        </div>
      </div>

      {/* Info Panel */}
      <div className="mt-8 max-w-7xl mx-auto">
        <div className="bg-blue-900/20 border border-blue-500/30 rounded-xl p-6">
          <div className="flex items-start gap-3">
            <svg className="w-6 h-6 text-blue-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
            </svg>
            <div className="flex-1">
              <h4 className="text-blue-300 font-semibold mb-2">How to Use</h4>
              <ul className="text-slate-300 text-sm space-y-1">
                <li>• <strong>Topic:</strong> Enter any educational topic for multi-segment audio-visual lesson</li>
                <li>• <strong>Segments:</strong> Choose 2-6 segments (each has narration + image)</li>
                <li>• <strong>Resolution:</strong> Higher quality images take longer to generate</li>
                <li>• <strong>Generation Time:</strong> Expect 30-60 seconds depending on segment count and resolution</li>
                <li>• <strong>Features:</strong> AI-generated voiceover narration (Gemini TTS) + AI-generated images (Gemini Image Gen)</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Main export - wraps with EvaluationProvider, ExhibitProvider, and LuminaAIProvider
export const MediaPlayerTester: React.FC<MediaPlayerTesterProps> = (props) => {
  return (
    <EvaluationProvider
      sessionId={`media-player-tester-${Date.now()}`}
      exhibitId="media-player-tester"
      onCompetencyUpdate={(updates) => {
        console.log('Competency updates received:', updates);
      }}
    >
      <ExhibitProvider objectives={[]} manifestItems={[]}>
        <LuminaAIProvider>
          <MediaPlayerTesterInner {...props} />
        </LuminaAIProvider>
      </ExhibitProvider>
    </EvaluationProvider>
  );
};

export default MediaPlayerTester;
