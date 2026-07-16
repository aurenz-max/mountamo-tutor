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

/**
 * Media Player Tester — compact control bar on top, primitive FULL-WIDTH below.
 * The primitive is a wide two-pane card (visual stage + control hub); a side-by-side
 * tester layout crushes it. Controls collapse to a slim summary bar once content
 * is generated so the primitive gets the whole viewport.
 *
 * Grade options map to the canonical curriculum grade (config.objectiveGrade →
 * ctx.grade) so the generator's band gate + grade defaults are exercised exactly
 * as production stamps them. Eval mode pins config.targetEvalMode ('auto' = the
 * generator's grade default).
 */

const GRADE_OPTIONS = [
  { label: 'Kindergarten (PRE)', gradeLevel: 'kindergarten', objectiveGrade: 'K' },
  { label: 'Grade 1 (EMERGING)', gradeLevel: 'elementary', objectiveGrade: '1' },
  { label: 'Grade 2 (ESTABLISHED)', gradeLevel: 'elementary', objectiveGrade: '2' },
  { label: 'Grade 3', gradeLevel: 'elementary', objectiveGrade: '3' },
  { label: 'Grade 5', gradeLevel: 'elementary', objectiveGrade: '5' },
  { label: 'Middle School', gradeLevel: 'middle-school', objectiveGrade: '7' },
  { label: 'High School', gradeLevel: 'high-school', objectiveGrade: '10' },
] as const;

const EVAL_MODES = [
  { value: 'auto', label: 'Auto (grade default)' },
  { value: 'listen_and_look', label: 'listen_and_look (PRE)' },
  { value: 'listen_for_details', label: 'listen_for_details (G1)' },
  { value: 'story_analysis', label: 'story_analysis (G2+)' },
] as const;

const MediaPlayerTesterInner: React.FC<MediaPlayerTesterProps> = ({ onBack }) => {
  const [mediaData, setMediaData] = useState<MediaPlayerData | null>(null);

  // Generation controls
  const [topic, setTopic] = useState('');
  const [gradeIndex, setGradeIndex] = useState<number>(0);
  const [evalMode, setEvalMode] = useState<string>('auto');
  const [segmentCount, setSegmentCount] = useState<number>(3);
  const [imageResolution, setImageResolution] = useState<'1K' | '2K' | '4K'>('1K');

  // Generation state
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showControls, setShowControls] = useState(true);

  const grade = GRADE_OPTIONS[gradeIndex];

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
            gradeLevel: grade.gradeLevel,
            config: {
              segmentCount,
              imageResolution,
              // Canonical grade — resolveGenerationContext normalizes to ctx.grade,
              // which drives the band stamp + grade-default eval mode.
              objectiveGrade: grade.objectiveGrade,
              ...(evalMode !== 'auto' ? { targetEvalMode: evalMode } : {}),
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
      setShowControls(false); // give the primitive the screen
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
    setShowControls(true);
  };

  const fieldClass =
    'px-3 py-2 bg-slate-700 text-white rounded-lg border border-slate-600 focus:border-blue-500 focus:outline-none text-sm';

  return (
    <div className="min-h-screen">
      {/* Header row — compact, one line */}
      <div className="max-w-7xl mx-auto mb-4 flex items-center justify-between gap-4">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-2 px-4 py-2 bg-slate-800/50 hover:bg-slate-700/50 text-white rounded-full border border-slate-600 transition-all text-sm"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path>
          </svg>
          Back
        </button>
        <div className="text-center">
          <h2 className="text-2xl font-bold text-white">Media Player Tester</h2>
          <p className="text-slate-400 text-xs">Narrated listening-comprehension walkthrough — band-gated (PRE / EMERGING / ESTABLISHED)</p>
        </div>
        <button
          onClick={() => setShowControls((v) => !v)}
          className="px-4 py-2 bg-slate-800/50 hover:bg-slate-700/50 text-slate-300 rounded-full border border-slate-600 transition-all text-sm"
        >
          {showControls ? 'Hide controls' : 'Show controls'}
        </button>
      </div>

      {/* Control bar — full-width, horizontal, collapsible */}
      {showControls && (
        <div className="max-w-7xl mx-auto mb-4 bg-slate-800/50 rounded-2xl p-4 border border-slate-700">
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex-1 min-w-[220px]">
              <label className="block text-xs font-medium text-slate-400 mb-1">Topic</label>
              <input
                type="text"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleGenerate(); }}
                className={`w-full ${fieldClass}`}
                placeholder="e.g., Community helpers, Independence Day, The water cycle"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Grade (band)</label>
              <select
                value={gradeIndex}
                onChange={(e) => setGradeIndex(parseInt(e.target.value))}
                className={fieldClass}
              >
                {GRADE_OPTIONS.map((g, i) => (
                  <option key={g.label} value={i}>{g.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Eval mode</label>
              <select
                value={evalMode}
                onChange={(e) => setEvalMode(e.target.value)}
                className={fieldClass}
              >
                {EVAL_MODES.map((m) => (
                  <option key={m.value} value={m.value}>{m.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Segments</label>
              <input
                type="number"
                min="2"
                max="6"
                value={segmentCount}
                onChange={(e) => setSegmentCount(Math.max(2, Math.min(6, parseInt(e.target.value) || 3)))}
                className={`w-20 ${fieldClass}`}
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Images</label>
              <div className="flex gap-1">
                {(['1K', '2K', '4K'] as const).map((res) => (
                  <button
                    key={res}
                    type="button"
                    onClick={() => setImageResolution(res)}
                    className={`rounded-lg border px-3 py-2 text-sm font-medium transition-all ${
                      imageResolution === res
                        ? 'border-indigo-500 bg-indigo-500/20 text-indigo-300'
                        : 'border-slate-700 bg-slate-800/50 text-slate-400 hover:bg-slate-700'
                    }`}
                  >
                    {res}
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={handleGenerate}
              disabled={isGenerating}
              className="px-6 py-2.5 bg-purple-600 hover:bg-purple-700 disabled:bg-slate-700 disabled:opacity-50 text-white rounded-lg font-semibold transition-all flex items-center gap-2 text-sm"
            >
              {isGenerating ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  Generating…
                </>
              ) : (
                'Generate'
              )}
            </button>
            {mediaData && (
              <button
                onClick={handleClear}
                disabled={isGenerating}
                className="px-4 py-2.5 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white rounded-lg font-semibold transition-all text-sm"
              >
                Clear
              </button>
            )}
          </div>

          {/* Quick topics + error, one compact row */}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="text-[10px] text-slate-500 uppercase tracking-wider">Quick:</span>
            {['Community helpers', 'The origins of Independence Day', 'How the light bulb changed daily life', 'Water Cycle', 'Life Cycle of a Butterfly'].map(exampleTopic => (
              <button
                key={exampleTopic}
                onClick={() => setTopic(exampleTopic)}
                className="px-3 py-1 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-full text-xs transition-colors"
              >
                {exampleTopic}
              </button>
            ))}
            {error && <span className="text-red-400 text-xs ml-auto">{error}</span>}
          </div>
        </div>
      )}

      {/* Primitive — FULL WIDTH, the whole point of this tester */}
      <div className="max-w-7xl mx-auto">
        {!mediaData ? (
          <div className="flex items-center justify-center h-[500px] text-slate-500 bg-slate-900/50 rounded-2xl border border-slate-700">
            <div className="text-center max-w-sm">
              <svg className="w-16 h-16 mx-auto mb-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"></path>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
              </svg>
              <p className="text-lg mb-2">No media player generated yet</p>
              <p className="text-sm text-slate-600">Enter a topic and click Generate — the primitive renders full-width here</p>
            </div>
          </div>
        ) : (
          <div>
            {/* Slim generation summary */}
            <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-slate-500">
              <span className="px-2 py-0.5 rounded-full bg-slate-800 border border-slate-700">{mediaData.segments.length} segments</span>
              {mediaData.evalMode && <span className="px-2 py-0.5 rounded-full bg-indigo-500/10 border border-indigo-500/30 text-indigo-300">{mediaData.evalMode}</span>}
              {mediaData.gradeLevel && <span className="px-2 py-0.5 rounded-full bg-slate-800 border border-slate-700">grade: {mediaData.gradeLevel}</span>}
              <span className="truncate">{mediaData.title}</span>
            </div>
            <MediaPlayer data={mediaData} />
          </div>
        )}
      </div>

      {/* Info Panel */}
      <div className="mt-6 max-w-7xl mx-auto">
        <div className="bg-blue-900/20 border border-blue-500/30 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <svg className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
            </svg>
            <ul className="text-slate-300 text-xs space-y-1">
              <li>• <strong>Bands:</strong> Kindergarten renders the PRE picture-check (tap the emoji; everything voiced); Grade 1+ renders the reader MCQ shape. The generator stamps <code>gradeLevel</code> + <code>evalMode</code> from the canonical grade.</li>
              <li>• <strong>Eval mode:</strong> Auto uses the grade default (K→listen_and_look, 1→listen_for_details, 2+→story_analysis); pin one to test it against any grade.</li>
              <li>• <strong>Narration:</strong> all audio is the live Lumina tutor (Gemini Live) — connect the tutor to hear scripts, questions, and options read aloud. No TTS assets.</li>
              <li>• <strong>Visuals:</strong> generated on-demand per segment via the picture button (16:9, chosen resolution).</li>
            </ul>
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
