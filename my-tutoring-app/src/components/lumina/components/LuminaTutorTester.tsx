'use client';

import React, { useState, useMemo } from 'react';
import { UNIVERSAL_CATALOG } from '../service/manifest/catalog';
import { LuminaAIProvider, useLuminaAIContext } from '@/contexts/LuminaAIContext';
import { EvaluationProvider } from '../evaluation';
import { ExhibitProvider } from '../contexts/ExhibitContext';
import type { ComponentId, TutoringScaffold } from '../types';
import { Bot, Mic, MicOff, Send, Loader2, CheckCircle, XCircle, Info } from 'lucide-react';

// ============================================================================
// Types
// ============================================================================

interface LuminaTutorTesterProps {
  onBack: () => void;
}

interface CatalogEntry {
  id: ComponentId;
  description: string;
  constraints?: string;
  tutoring?: TutoringScaffold;
}

// ============================================================================
// Mock primitive data for testing each scaffold
// ============================================================================

const MOCK_PRIMITIVE_DATA: Record<string, Record<string, unknown>> = {
  'phonics-blender': {
    patternType: 'CVC',
    currentWord: 'cat',
    targetPhonemes: ['k', 'æ', 't'],
    gradeLevel: 'K',
  },
  'fraction-bar': {
    targetFraction: '3/4',
    currentFraction: '1/4',
    denominator: 4,
    numerator: 3,
    gradeLevel: '3rd Grade',
  },
  'story-map': {
    structureType: 'BME',
    currentPhase: 'middle',
    elementsIdentified: ['character', 'setting'],
    gradeLevel: '2nd Grade',
  },
  'evidence-finder': {
    currentClaim: 'Plants need sunlight to grow.',
    gradeLevel: '4th Grade',
  },
  'balance-scale': {
    targetEquation: '2x + 3 = 11',
    gradeLevel: '6th Grade',
  },
};

// ============================================================================
// Scaffold Inspector Panel
// ============================================================================

const ScaffoldInspector: React.FC<{
  entry: CatalogEntry;
  mockData: Record<string, unknown>;
}> = ({ entry, mockData }) => {
  const tutoring = entry.tutoring;

  if (!tutoring) {
    return (
      <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl">
        <div className="flex items-center gap-2 mb-2">
          <Info className="w-4 h-4 text-amber-400" />
          <span className="text-amber-400 font-medium text-sm">No Tutoring Scaffold</span>
        </div>
        <p className="text-slate-400 text-xs">
          This primitive has no <code className="bg-slate-800 px-1 rounded">tutoring</code> field in its catalog entry.
          Add one following{' '}
          <span className="text-indigo-400">ADDING_TUTORING_SCAFFOLD.md</span>.
        </p>
      </div>
    );
  }

  // Simulate template interpolation
  const interpolate = (template: string) => {
    return template.replace(/\{\{(\w+)\}\}/g, (_, key) => {
      const value = mockData[key];
      return value !== undefined ? String(value) : '(not set)';
    });
  };

  return (
    <div className="space-y-3">
      {/* Task Description */}
      <div className="p-3 bg-slate-800/50 rounded-lg border border-slate-700">
        <div className="text-xs text-slate-500 uppercase tracking-wider mb-1">Task Description</div>
        <p className="text-slate-200 text-sm">{interpolate(tutoring.taskDescription)}</p>
      </div>

      {/* Context Keys */}
      {tutoring.contextKeys && (
        <div className="p-3 bg-slate-800/50 rounded-lg border border-slate-700">
          <div className="text-xs text-slate-500 uppercase tracking-wider mb-1">Context Keys</div>
          <div className="flex flex-wrap gap-1">
            {tutoring.contextKeys.map((key) => (
              <span key={key} className="px-2 py-0.5 bg-indigo-500/20 text-indigo-300 rounded text-xs font-mono">
                {key}: {String(mockData[key] ?? '(not set)')}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Scaffolding Levels */}
      <div className="p-3 bg-slate-800/50 rounded-lg border border-slate-700">
        <div className="text-xs text-slate-500 uppercase tracking-wider mb-2">Scaffolding Levels</div>
        <div className="space-y-2">
          {(['level1', 'level2', 'level3'] as const).map((level, i) => (
            <div key={level} className="flex gap-2">
              <span className={`text-xs font-bold w-4 flex-shrink-0 mt-0.5 ${
                i === 0 ? 'text-blue-400' : i === 1 ? 'text-yellow-400' : 'text-orange-400'
              }`}>
                {i + 1}
              </span>
              <p className="text-slate-300 text-xs">
                {interpolate(tutoring.scaffoldingLevels[level])}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Common Struggles */}
      {tutoring.commonStruggles && tutoring.commonStruggles.length > 0 && (
        <div className="p-3 bg-slate-800/50 rounded-lg border border-slate-700">
          <div className="text-xs text-slate-500 uppercase tracking-wider mb-2">Common Struggles</div>
          <div className="space-y-1.5">
            {tutoring.commonStruggles.map((s, i) => (
              <div key={i} className="text-xs">
                <span className="text-red-400">{s.pattern}</span>
                <span className="text-slate-600 mx-1">&rarr;</span>
                <span className="text-green-400">&ldquo;{interpolate(s.response)}&rdquo;</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// ============================================================================
// Live Connection Panel (uses LuminaAIContext)
// ============================================================================

const LiveConnectionPanel: React.FC<{
  primitiveType: ComponentId;
  mockData: Record<string, unknown>;
}> = ({ primitiveType, mockData }) => {
  const context = useLuminaAIContext();
  const [textInput, setTextInput] = useState('');
  const [connectionAttempted, setConnectionAttempted] = useState(false);

  const handleConnect = async () => {
    setConnectionAttempted(true);
    try {
      await context.connect({
        primitive_type: primitiveType,
        instance_id: `tester-${primitiveType}-${Date.now()}`,
        primitive_data: mockData,
        topic: 'Tester Session',
        grade_level: (mockData.gradeLevel as string) || 'K-6',
      });
    } catch (err) {
      console.error('Connection failed:', err);
    }
  };

  const handleDisconnect = () => {
    context.disconnect();
    setConnectionAttempted(false);
  };

  const handleSendText = () => {
    if (textInput.trim()) {
      context.sendText(textInput);
      setTextInput('');
    }
  };

  const handleHint = (level: 1 | 2 | 3) => {
    context.requestHint(level, mockData);
  };

  const handleToggleVoice = () => {
    if (context.isListening) {
      context.stopListening();
    } else {
      context.startListening();
    }
  };

  return (
    <div className="space-y-3">
      {/* Connection Status */}
      <div className="flex items-center justify-between p-3 bg-slate-800/50 rounded-lg border border-slate-700">
        <div className="flex items-center gap-2">
          {context.isConnected ? (
            <CheckCircle className="w-4 h-4 text-green-400" />
          ) : (
            <XCircle className="w-4 h-4 text-slate-500" />
          )}
          <span className={`text-sm font-medium ${context.isConnected ? 'text-green-400' : 'text-slate-400'}`}>
            {context.isConnected ? 'Connected' : connectionAttempted ? 'Disconnected' : 'Not connected'}
          </span>
        </div>
        {!context.isConnected ? (
          <button
            onClick={handleConnect}
            className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-medium rounded-lg transition-colors"
          >
            Connect
          </button>
        ) : (
          <button
            onClick={handleDisconnect}
            className="px-3 py-1.5 bg-red-600/80 hover:bg-red-600 text-white text-xs font-medium rounded-lg transition-colors"
          >
            Disconnect
          </button>
        )}
      </div>

      {/* Hint Buttons */}
      {context.isConnected && (
        <div className="grid grid-cols-3 gap-2">
          {([1, 2, 3] as const).map((level) => {
            const labels = ['Gentle Nudge', 'Specific', 'Walkthrough'];
            const icons = ['💡', '🔍', '🎯'];
            const used = context.aiMetrics.hintsGiven[`level${level}` as keyof typeof context.aiMetrics.hintsGiven];
            return (
              <button
                key={level}
                onClick={() => handleHint(level)}
                disabled={context.isAIResponding}
                className={`flex flex-col items-center gap-1 p-2 rounded-lg border transition-colors disabled:opacity-50 ${
                  used > 0
                    ? 'bg-indigo-500/10 border-indigo-500/50'
                    : 'bg-slate-800/50 border-slate-700 hover:bg-slate-700/50'
                }`}
              >
                <span className="text-lg">{icons[level - 1]}</span>
                <span className="text-xs text-slate-400">{labels[level - 1]}</span>
                {used > 0 && (
                  <span className="text-xs text-indigo-400">({used})</span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* Chat Messages */}
      {context.isConnected && (
        <div className="bg-slate-900/50 rounded-lg border border-slate-700 overflow-hidden">
          <div className="max-h-64 overflow-y-auto p-3 space-y-2">
            {context.conversation.length === 0 && (
              <p className="text-slate-500 text-xs text-center py-4">
                Connected. Request a hint or type a message to start.
              </p>
            )}
            {context.conversation.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] rounded-lg p-2 ${
                  msg.role === 'user'
                    ? 'bg-indigo-600 text-white'
                    : 'bg-slate-800 border border-slate-700 text-slate-200'
                }`}>
                  <p className="text-xs whitespace-pre-wrap">{msg.content}</p>
                  {msg.isAudio && (
                    <span className="text-xs opacity-60 flex items-center gap-1 mt-1">
                      <Mic className="w-3 h-3" /> Voice
                    </span>
                  )}
                </div>
              </div>
            ))}
            {context.isAIResponding && (
              <div className="flex justify-start">
                <div className="bg-slate-800 border border-slate-700 rounded-lg p-2">
                  <div className="flex items-center gap-1.5 text-slate-400">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    <span className="text-xs">Thinking...</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Input */}
          <div className="border-t border-slate-700 p-2 flex gap-2">
            <input
              type="text"
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSendText()}
              placeholder="Type a message..."
              disabled={!context.isConnected}
              className="flex-1 px-2 py-1.5 bg-slate-800 border border-slate-700 rounded text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500 text-xs disabled:opacity-50"
            />
            <button
              onClick={handleSendText}
              disabled={!context.isConnected || !textInput.trim()}
              className="p-1.5 bg-indigo-600 hover:bg-indigo-700 rounded disabled:opacity-50 transition-colors"
            >
              <Send className="w-3.5 h-3.5 text-white" />
            </button>
            <button
              onClick={handleToggleVoice}
              disabled={!context.isConnected}
              className={`p-1.5 rounded disabled:opacity-50 transition-colors ${
                context.isListening ? 'bg-red-600 hover:bg-red-700' : 'bg-purple-600 hover:bg-purple-700'
              }`}
            >
              {context.isListening ? (
                <MicOff className="w-3.5 h-3.5 text-white" />
              ) : (
                <Mic className="w-3.5 h-3.5 text-white" />
              )}
            </button>
          </div>
        </div>
      )}

      {/* Metrics */}
      {context.isConnected && context.aiMetrics.totalInteractions > 0 && (
        <div className="flex justify-between text-xs text-slate-500 px-1">
          <span>Hints: {context.aiMetrics.totalHints}</span>
          <span>Interactions: {context.aiMetrics.totalInteractions}</span>
          <span>Voice: {context.aiMetrics.voiceInteractions}</span>
        </div>
      )}
    </div>
  );
};

// ============================================================================
// Main Tester Content
// ============================================================================

const LuminaTutorTesterContent: React.FC<LuminaTutorTesterProps> = ({ onBack }) => {
  const [selectedId, setSelectedId] = useState<string>('phonics-blender');
  const [filterMode, setFilterMode] = useState<'with-scaffold' | 'without-scaffold' | 'all'>('with-scaffold');
  const [mockDataOverride, setMockDataOverride] = useState<string>('');
  const [mockDataError, setMockDataError] = useState<string | null>(null);

  // Build filtered catalog list
  const catalogEntries = useMemo(() => {
    return UNIVERSAL_CATALOG.filter((entry) => {
      if (filterMode === 'with-scaffold') return !!entry.tutoring;
      if (filterMode === 'without-scaffold') return !entry.tutoring;
      return true;
    }) as CatalogEntry[];
  }, [filterMode]);

  const selectedEntry = useMemo(() => {
    return UNIVERSAL_CATALOG.find((e) => e.id === selectedId) as CatalogEntry | undefined;
  }, [selectedId]);

  // Build effective mock data
  const effectiveMockData = useMemo(() => {
    const base = MOCK_PRIMITIVE_DATA[selectedId] || { gradeLevel: 'K-6' };
    if (!mockDataOverride.trim()) return base;

    try {
      const parsed = JSON.parse(mockDataOverride);
      setMockDataError(null);
      return { ...base, ...parsed };
    } catch {
      setMockDataError('Invalid JSON');
      return base;
    }
  }, [selectedId, mockDataOverride]);

  const withScaffoldCount = UNIVERSAL_CATALOG.filter((e) => e.tutoring).length;
  const totalCount = UNIVERSAL_CATALOG.length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-950">
      {/* Header */}
      <div className="border-b border-slate-800 bg-slate-900/50 backdrop-blur">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={onBack} className="text-slate-400 hover:text-white transition-colors">
              &larr; Back
            </button>
            <div className="h-6 w-px bg-slate-700" />
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              <Bot className="w-6 h-6 text-indigo-400" />
              <span>Lumina Tutor Tester</span>
            </h1>
          </div>
          <div className="text-xs text-slate-500">
            {withScaffoldCount}/{totalCount} primitives have scaffolding
          </div>
        </div>
      </div>

      {/* Main Layout */}
      <div className="flex h-[calc(100vh-73px)]">
        {/* Left Panel - Primitive Selector */}
        <div className="w-64 border-r border-slate-800 bg-slate-900/30 backdrop-blur p-4 overflow-y-auto flex-shrink-0">
          <div className="space-y-4">
            {/* Filter Tabs */}
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-2 uppercase tracking-wider">
                Filter
              </label>
              <div className="flex gap-1">
                {([
                  { key: 'with-scaffold', label: 'With' },
                  { key: 'without-scaffold', label: 'Without' },
                  { key: 'all', label: 'All' },
                ] as const).map(({ key, label }) => (
                  <button
                    key={key}
                    onClick={() => setFilterMode(key)}
                    className={`flex-1 px-2 py-1.5 text-xs font-medium rounded transition-colors ${
                      filterMode === key
                        ? 'bg-indigo-600 text-white'
                        : 'bg-slate-800/50 text-slate-400 hover:bg-slate-800'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Primitive List */}
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-2 uppercase tracking-wider">
                Primitives ({catalogEntries.length})
              </label>
              <div className="space-y-1 max-h-[60vh] overflow-y-auto">
                {catalogEntries.map((entry) => (
                  <button
                    key={entry.id}
                    onClick={() => {
                      setSelectedId(entry.id);
                      setMockDataOverride('');
                      setMockDataError(null);
                    }}
                    className={`w-full text-left px-3 py-2 rounded-lg transition-all ${
                      selectedId === entry.id
                        ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20'
                        : 'bg-slate-800/50 text-slate-300 hover:bg-slate-800 hover:text-white'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full flex-shrink-0 ${
                        entry.tutoring ? 'bg-green-400' : 'bg-slate-600'
                      }`} />
                      <span className="text-xs font-mono truncate">{entry.id}</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Center Panel - Scaffold Inspector */}
        <div className="flex-1 overflow-y-auto border-r border-slate-800">
          <div className="p-6 space-y-6">
            {selectedEntry ? (
              <>
                {/* Component Header */}
                <div>
                  <div className="flex items-center gap-3 mb-2">
                    <h2 className="text-xl font-bold text-white font-mono">{selectedEntry.id}</h2>
                    {selectedEntry.tutoring ? (
                      <span className="px-2 py-0.5 bg-green-500/20 text-green-400 rounded-full text-xs font-medium">
                        Scaffold active
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 bg-slate-700/50 text-slate-500 rounded-full text-xs font-medium">
                        No scaffold
                      </span>
                    )}
                  </div>
                  <p className="text-slate-400 text-sm leading-relaxed">{selectedEntry.description}</p>
                  {selectedEntry.constraints && (
                    <p className="text-slate-500 text-xs mt-1 italic">{selectedEntry.constraints}</p>
                  )}
                </div>

                {/* Scaffold Details */}
                <div>
                  <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider mb-3">
                    Scaffold Preview (with mock data)
                  </h3>
                  <ScaffoldInspector entry={selectedEntry} mockData={effectiveMockData} />
                </div>

                {/* Mock Data Override */}
                <div>
                  <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider mb-2">
                    Override Mock Data (JSON)
                  </h3>
                  <textarea
                    value={mockDataOverride}
                    onChange={(e) => setMockDataOverride(e.target.value)}
                    placeholder={`e.g., ${JSON.stringify(MOCK_PRIMITIVE_DATA[selectedId] || { gradeLevel: 'K-6' }, null, 2)}`}
                    className="w-full h-28 px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-200 placeholder-slate-600 font-mono text-xs focus:outline-none focus:border-indigo-500 resize-none"
                  />
                  {mockDataError && (
                    <p className="text-red-400 text-xs mt-1">{mockDataError}</p>
                  )}
                </div>

                {/* Current Effective Mock Data */}
                <div>
                  <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider mb-2">
                    Effective primitive_data
                  </h3>
                  <pre className="p-3 bg-slate-900/80 border border-slate-700 rounded-lg text-xs text-slate-300 font-mono overflow-x-auto">
                    {JSON.stringify(effectiveMockData, null, 2)}
                  </pre>
                </div>
              </>
            ) : (
              <div className="flex items-center justify-center h-full">
                <p className="text-slate-500">Select a primitive from the sidebar</p>
              </div>
            )}
          </div>
        </div>

        {/* Right Panel - Live Connection Test */}
        <div className="w-80 bg-slate-900/30 backdrop-blur p-4 overflow-y-auto flex-shrink-0">
          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider mb-1">
                Live Connection
              </h3>
              <p className="text-slate-500 text-xs mb-3">
                Connect to the backend WebSocket to test scaffolding in real-time with Gemini.
              </p>
            </div>

            <LiveConnectionPanel
              primitiveType={selectedId as ComponentId}
              mockData={effectiveMockData}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// Wrapper with required providers
// ============================================================================

const LuminaTutorTester: React.FC<LuminaTutorTesterProps> = (props) => {
  return (
    <EvaluationProvider>
      <ExhibitProvider objectives={[]} manifestItems={[]}>
        <LuminaAIProvider>
          <LuminaTutorTesterContent {...props} />
        </LuminaAIProvider>
      </ExhibitProvider>
    </EvaluationProvider>
  );
};

export default LuminaTutorTester;
