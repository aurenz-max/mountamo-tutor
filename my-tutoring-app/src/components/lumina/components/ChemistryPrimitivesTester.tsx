'use client';

import React, { useState, useEffect, useRef } from 'react';
// ============================================================================
// Primitive Imports
// ============================================================================
// SC: Science Core (molecule-viewer, periodic-table handled by fallback)
// CM: Chemistry - Matter & Particles
import MatterExplorer from '../primitives/visual-primitives/chemistry/MatterExplorer';
import StatesOfMatter from '../primitives/visual-primitives/chemistry/StatesOfMatter';
import AtomBuilder from '../primitives/visual-primitives/chemistry/AtomBuilder';
import MoleculeConstructor from '../primitives/visual-primitives/chemistry/MoleculeConstructor';
// CR: Chemistry - Reactions & Energy
import ReactionLab from '../primitives/visual-primitives/chemistry/ReactionLab';
import EquationBalancer from '../primitives/visual-primitives/chemistry/EquationBalancer';
import EnergyOfReactions from '../primitives/visual-primitives/chemistry/EnergyOfReactions';
// CS: Chemistry - Solutions & Safety
import MixingAndDissolving from '../primitives/visual-primitives/chemistry/MixingAndDissolving';
import PhExplorer from '../primitives/visual-primitives/chemistry/PhExplorer';
import SafetyLab from '../primitives/visual-primitives/chemistry/SafetyLab';

import {
  EvaluationProvider,
  useEvaluationContext,
  type PrimitiveEvaluationResult,
} from '../evaluation';
import { ExhibitProvider } from '../contexts/ExhibitContext';
import { LuminaAIProvider, useLuminaAIContext } from '@/contexts/LuminaAIContext';
import { getComponentById } from '../service/manifest/catalog';
import type { ComponentId } from '../types';
import { Bot, Send, Mic, MicOff, Loader2, CheckCircle, XCircle, ChevronRight, ChevronLeft } from 'lucide-react';

interface ChemistryPrimitivesTesterProps {
  onBack: () => void;
}

type PrimitiveType =
  | 'molecule-viewer' | 'periodic-table'
  | 'matter-explorer' | 'states-of-matter' | 'atom-builder' | 'molecule-constructor'
  | 'reaction-lab' | 'equation-balancer' | 'energy-of-reactions'
  | 'mixing-and-dissolving' | 'ph-explorer' | 'safety-lab';

type GradeLevel = 'toddler' | 'preschool' | 'kindergarten' | 'elementary' | 'middle-school' | 'high-school' | 'undergraduate' | 'graduate' | 'phd';

interface PrimitiveOption {
  value: PrimitiveType;
  label: string;
  icon: string;
  topic: string;
  strand: string;
}

const PRIMITIVE_OPTIONS: PrimitiveOption[] = [
  // ===== SC: Science Core =====
  { value: 'molecule-viewer', label: 'Molecule Viewer', icon: '🧬', topic: 'Exploring 3D molecular structures', strand: 'SC' },
  { value: 'periodic-table', label: 'Periodic Table', icon: '⚛️', topic: 'Exploring elements and periodic trends', strand: 'SC' },
  // ===== CM: Matter & Particles =====
  { value: 'matter-explorer', label: 'Matter Explorer', icon: '🧊', topic: 'Classifying states of matter', strand: 'CM' },
  { value: 'states-of-matter', label: 'States of Matter', icon: '🌡️', topic: 'Particle model and phase transitions', strand: 'CM' },
  { value: 'atom-builder', label: 'Atom Builder', icon: '⚛️', topic: 'Building atoms with protons, neutrons, electrons', strand: 'CM' },
  { value: 'molecule-constructor', label: 'Molecule Constructor', icon: '🔗', topic: 'Snapping atoms into molecules', strand: 'CM' },
  // ===== CR: Reactions & Energy =====
  { value: 'reaction-lab', label: 'Reaction Lab', icon: '🧪', topic: 'Conducting chemical reactions', strand: 'CR' },
  { value: 'equation-balancer', label: 'Equation Balancer', icon: '⚖️', topic: 'Balancing chemical equations', strand: 'CR' },
  { value: 'energy-of-reactions', label: 'Energy of Reactions', icon: '🔥', topic: 'Exothermic and endothermic reactions', strand: 'CR' },
  // ===== CS: Solutions & Safety =====
  { value: 'mixing-and-dissolving', label: 'Mixing & Dissolving', icon: '💧', topic: 'Solutions, mixtures, and dissolving', strand: 'CS' },
  { value: 'ph-explorer', label: 'pH Explorer', icon: '🌈', topic: 'pH scale, acids, and bases', strand: 'CS' },
  { value: 'safety-lab', label: 'Safety Lab', icon: '🥽', topic: 'Lab safety and hazard identification', strand: 'CS' },
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

const STRAND_LABELS: Record<string, { label: string; color: string }> = {
  SC: { label: 'Science Core', color: 'text-blue-400' },
  CM: { label: 'Matter & Particles', color: 'text-cyan-400' },
  CR: { label: 'Reactions & Energy', color: 'text-orange-400' },
  CS: { label: 'Solutions & Safety', color: 'text-emerald-400' },
};

// Dynamic renderer that maps componentId to the appropriate primitive component
const PrimitiveRenderer: React.FC<{
  componentId: PrimitiveType;
  data: unknown;
  onEvaluationSubmit?: (result: PrimitiveEvaluationResult) => void;
}> = ({ componentId, data, onEvaluationSubmit }) => {
  if (!data) return null;

  switch (componentId) {
    // ===== CM: Matter & Particles =====
    case 'matter-explorer':
      return (
        <MatterExplorer
          data={{
            ...(data as Parameters<typeof MatterExplorer>[0]['data']),
            instanceId: `matter-explorer-${Date.now()}`,
            skillId: 'chemistry-states-of-matter',
            subskillId: 'matter-classification',
            objectiveId: 'classify-matter-states',
            onEvaluationSubmit,
          }}
        />
      );
    case 'states-of-matter':
      return (
        <StatesOfMatter
          data={{
            ...(data as Parameters<typeof StatesOfMatter>[0]['data']),
            instanceId: `states-of-matter-${Date.now()}`,
            skillId: 'chemistry-states-of-matter',
            subskillId: 'phase-transitions',
            objectiveId: 'understand-particle-model',
            onEvaluationSubmit,
          }}
        />
      );
    case 'atom-builder':
      return (
        <AtomBuilder
          data={{
            ...(data as Parameters<typeof AtomBuilder>[0]['data']),
            instanceId: `atom-builder-${Date.now()}`,
            skillId: 'chemistry-atomic-structure',
            subskillId: 'subatomic-particles',
            objectiveId: 'build-atoms',
            onEvaluationSubmit,
          }}
        />
      );
    case 'molecule-constructor':
      return (
        <MoleculeConstructor
          data={{
            ...(data as Parameters<typeof MoleculeConstructor>[0]['data']),
            instanceId: `molecule-constructor-${Date.now()}`,
            skillId: 'chemistry-bonding',
            subskillId: 'molecular-structure',
            objectiveId: 'build-molecules',
            onEvaluationSubmit,
          }}
        />
      );
    // ===== CR: Reactions & Energy =====
    case 'reaction-lab':
      return (
        <ReactionLab
          data={{
            ...(data as Parameters<typeof ReactionLab>[0]['data']),
            instanceId: `reaction-lab-${Date.now()}`,
            skillId: 'chemistry-reactions',
            subskillId: 'chemical-change',
            objectiveId: 'identify-reaction-signs',
            onEvaluationSubmit,
          }}
        />
      );
    case 'equation-balancer':
      return (
        <EquationBalancer
          data={{
            ...(data as Parameters<typeof EquationBalancer>[0]['data']),
            instanceId: `equation-balancer-${Date.now()}`,
            skillId: 'chemistry-reactions',
            subskillId: 'equation-balancing',
            objectiveId: 'balance-chemical-equations',
            onEvaluationSubmit,
          }}
        />
      );
    case 'energy-of-reactions':
      return (
        <EnergyOfReactions
          data={{
            ...(data as Parameters<typeof EnergyOfReactions>[0]['data']),
            instanceId: `energy-of-reactions-${Date.now()}`,
            skillId: 'chemistry-energy',
            subskillId: 'exothermic-endothermic',
            objectiveId: 'understand-reaction-energy',
            onEvaluationSubmit,
          }}
        />
      );
    // ===== CS: Solutions & Safety =====
    case 'mixing-and-dissolving':
      return (
        <MixingAndDissolving
          data={{
            ...(data as Parameters<typeof MixingAndDissolving>[0]['data']),
            instanceId: `mixing-and-dissolving-${Date.now()}`,
            skillId: 'chemistry-solutions',
            subskillId: 'dissolving',
            objectiveId: 'understand-solutions-mixtures',
            onEvaluationSubmit,
          }}
        />
      );
    case 'ph-explorer':
      return (
        <PhExplorer
          data={{
            ...(data as Parameters<typeof PhExplorer>[0]['data']),
            instanceId: `ph-explorer-${Date.now()}`,
            skillId: 'chemistry-acids-bases',
            subskillId: 'ph-scale',
            objectiveId: 'understand-ph-acids-bases',
            onEvaluationSubmit,
          }}
        />
      );
    case 'safety-lab':
      return (
        <SafetyLab
          data={{
            ...(data as Parameters<typeof SafetyLab>[0]['data']),
            instanceId: `safety-lab-${Date.now()}`,
            skillId: 'chemistry-safety',
            subskillId: 'hazard-identification',
            objectiveId: 'identify-lab-hazards',
            onEvaluationSubmit,
          }}
        />
      );
    default:
      return (
        <div className="max-w-4xl mx-auto">
          <div className="backdrop-blur-xl bg-slate-900/40 border border-white/10 rounded-2xl shadow-2xl p-8">
            <div className="text-center space-y-4">
              <div className="text-5xl">{PRIMITIVE_OPTIONS.find(p => p.value === componentId)?.icon || '🧪'}</div>
              <h3 className="text-xl font-semibold text-slate-100">
                {PRIMITIVE_OPTIONS.find(p => p.value === componentId)?.label || componentId}
              </h3>
              <p className="text-slate-400 text-sm max-w-md mx-auto">
                This primitive is ready to be built.
              </p>
              {data && (
                <details className="text-left mt-6">
                  <summary className="text-slate-500 text-xs cursor-pointer hover:text-slate-300 transition-colors">
                    View generated JSON data
                  </summary>
                  <pre className="mt-2 p-4 bg-black/30 rounded-lg text-xs text-slate-400 overflow-auto max-h-96 border border-white/5">
                    {JSON.stringify(data, null, 2)}
                  </pre>
                </details>
              )}
            </div>
          </div>
        </div>
      );
  }
};

// Evaluation Results Panel
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

      {pendingSubmissions.length > 0 && (
        <div className="p-2 bg-amber-500/10 rounded-lg border border-amber-500/30">
          <p className="text-amber-400 text-xs">
            {pendingSubmissions.length} evaluation(s) pending sync...
          </p>
        </div>
      )}

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
                {result.metrics && 'type' in result.metrics && (
                  <p className="text-xs text-slate-400 mt-1">{result.metrics.type}</p>
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

// ============================================================================
// AI Tutor Panel - connects to backend WebSocket for real-time scaffolding
// ============================================================================

const AITutorPanel: React.FC<{
  primitiveType: PrimitiveType;
  gradeLevel: string;
  topic: string;
  generatedData: unknown;
}> = ({ primitiveType, gradeLevel, topic, generatedData }) => {
  const ai = useLuminaAIContext();
  const [textInput, setTextInput] = useState('');
  const [connectionAttempted, setConnectionAttempted] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll chat to bottom
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [ai.conversation]);

  // Disconnect when primitive changes
  useEffect(() => {
    if (ai.isConnected) {
      ai.disconnect();
      setConnectionAttempted(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [primitiveType]);

  const buildPrimitiveData = (): Record<string, unknown> => {
    const base: Record<string, unknown> = { gradeLevel };
    if (!generatedData || typeof generatedData !== 'object') return base;
    const d = generatedData as Record<string, unknown>;
    for (const [k, v] of Object.entries(d)) {
      if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') {
        base[k] = v;
      }
    }
    return base;
  };

  const handleConnect = async () => {
    setConnectionAttempted(true);
    const primitiveData = buildPrimitiveData();
    try {
      await ai.connect({
        primitive_type: primitiveType,
        instance_id: `tester-${primitiveType}-${Date.now()}`,
        primitive_data: primitiveData,
        topic: topic || 'Tester Session',
        grade_level: gradeLevel,
      });
    } catch (err) {
      console.error('Connection failed:', err);
    }
  };

  const handleDisconnect = () => {
    ai.disconnect();
    setConnectionAttempted(false);
  };

  const handleSendText = () => {
    if (textInput.trim()) {
      ai.sendText(textInput);
      setTextInput('');
    }
  };

  const handleHint = (level: 1 | 2 | 3) => {
    ai.requestHint(level, buildPrimitiveData());
  };

  const handleToggleVoice = () => {
    if (ai.isListening) {
      ai.stopListening();
    } else {
      ai.startListening();
    }
  };

  const catalogEntry = getComponentById(primitiveType as ComponentId);
  const hasScaffold = !!catalogEntry?.tutoring;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 pt-4 pb-3 border-b border-slate-700/50">
        <div className="flex items-center gap-2 mb-1">
          <Bot className="w-4 h-4 text-emerald-400" />
          <h3 className="text-sm font-semibold text-slate-200">AI Tutor</h3>
          {hasScaffold && (
            <span className="px-1.5 py-0.5 bg-green-500/20 text-green-400 rounded text-[10px] font-medium">
              Scaffold
            </span>
          )}
        </div>
        <p className="text-slate-500 text-[10px]">
          {generatedData
            ? 'Connect to get real-time tutoring for this activity.'
            : 'Generate content first, then connect.'}
        </p>
      </div>

      {/* Connection Status */}
      <div className="px-4 py-3">
        <div className="flex items-center justify-between p-2.5 bg-slate-800/50 rounded-lg border border-slate-700">
          <div className="flex items-center gap-2">
            {ai.isConnected ? (
              <CheckCircle className="w-3.5 h-3.5 text-green-400" />
            ) : (
              <XCircle className="w-3.5 h-3.5 text-slate-500" />
            )}
            <span className={`text-xs font-medium ${ai.isConnected ? 'text-green-400' : 'text-slate-400'}`}>
              {ai.isConnected ? 'Connected' : connectionAttempted ? 'Disconnected' : 'Not connected'}
            </span>
          </div>
          {!ai.isConnected ? (
            <button
              onClick={handleConnect}
              disabled={!generatedData}
              className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-700 disabled:text-slate-500 text-white text-xs font-medium rounded-lg transition-colors disabled:cursor-not-allowed"
            >
              Connect
            </button>
          ) : (
            <button
              onClick={handleDisconnect}
              className="px-3 py-1 bg-red-600/80 hover:bg-red-600 text-white text-xs font-medium rounded-lg transition-colors"
            >
              Disconnect
            </button>
          )}
        </div>
      </div>

      {/* Hint Buttons */}
      {ai.isConnected && (
        <div className="px-4 pb-3">
          <div className="grid grid-cols-3 gap-1.5">
            {([1, 2, 3] as const).map((level) => {
              const labels = ['Gentle Nudge', 'Specific', 'Walkthrough'];
              const icons = ['💡', '🔍', '🎯'];
              const used = ai.aiMetrics.hintsGiven[`level${level}` as keyof typeof ai.aiMetrics.hintsGiven];
              return (
                <button
                  key={level}
                  onClick={() => handleHint(level)}
                  disabled={ai.isAIResponding}
                  className={`flex flex-col items-center gap-0.5 p-2 rounded-lg border transition-colors disabled:opacity-50 ${
                    used > 0
                      ? 'bg-emerald-500/10 border-emerald-500/50'
                      : 'bg-slate-800/50 border-slate-700 hover:bg-slate-700/50'
                  }`}
                >
                  <span className="text-base">{icons[level - 1]}</span>
                  <span className="text-[10px] text-slate-400">{labels[level - 1]}</span>
                  {used > 0 && (
                    <span className="text-[10px] text-emerald-400">({used})</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Chat Messages */}
      {ai.isConnected && (
        <div className="flex-1 flex flex-col min-h-0 px-4 pb-3">
          <div className="flex-1 bg-slate-900/50 rounded-lg border border-slate-700 overflow-hidden flex flex-col">
            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {ai.conversation.length === 0 && (
                <p className="text-slate-500 text-xs text-center py-4">
                  Connected. Request a hint or type a message to start.
                </p>
              )}
              {ai.conversation.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[85%] rounded-lg p-2 ${
                    msg.role === 'user'
                      ? 'bg-emerald-600 text-white'
                      : 'bg-slate-800 border border-slate-700 text-slate-200'
                  }`}>
                    <p className="text-xs whitespace-pre-wrap">{msg.content}</p>
                    {msg.isAudio && (
                      <span className="text-[10px] opacity-60 flex items-center gap-1 mt-1">
                        <Mic className="w-2.5 h-2.5" /> Voice
                      </span>
                    )}
                  </div>
                </div>
              ))}
              {ai.isAIResponding && (
                <div className="flex justify-start">
                  <div className="bg-slate-800 border border-slate-700 rounded-lg p-2">
                    <div className="flex items-center gap-1.5 text-slate-400">
                      <Loader2 className="w-3 h-3 animate-spin" />
                      <span className="text-xs">Thinking...</span>
                    </div>
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            {/* Input */}
            <div className="border-t border-slate-700 p-2 flex gap-1.5">
              <input
                type="text"
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSendText()}
                placeholder="Type a message..."
                disabled={!ai.isConnected}
                className="flex-1 px-2 py-1.5 bg-slate-800 border border-slate-700 rounded text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500 text-xs disabled:opacity-50"
              />
              <button
                onClick={handleSendText}
                disabled={!ai.isConnected || !textInput.trim()}
                className="p-1.5 bg-emerald-600 hover:bg-emerald-700 rounded disabled:opacity-50 transition-colors"
              >
                <Send className="w-3.5 h-3.5 text-white" />
              </button>
              <button
                onClick={handleToggleVoice}
                disabled={!ai.isConnected}
                className={`p-1.5 rounded disabled:opacity-50 transition-colors ${
                  ai.isListening ? 'bg-red-600 hover:bg-red-700' : 'bg-purple-600 hover:bg-purple-700'
                }`}
              >
                {ai.isListening ? (
                  <MicOff className="w-3.5 h-3.5 text-white" />
                ) : (
                  <Mic className="w-3.5 h-3.5 text-white" />
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Metrics */}
      {ai.isConnected && ai.aiMetrics.totalInteractions > 0 && (
        <div className="px-4 pb-3 flex justify-between text-[10px] text-slate-500">
          <span>Hints: {ai.aiMetrics.totalHints}</span>
          <span>Interactions: {ai.aiMetrics.totalInteractions}</span>
          <span>Voice: {ai.aiMetrics.voiceInteractions}</span>
        </div>
      )}

      {/* Scaffold Info (when not connected) */}
      {!ai.isConnected && hasScaffold && catalogEntry?.tutoring && (
        <div className="px-4 pb-4 flex-1 overflow-y-auto">
          <details className="text-left">
            <summary className="text-slate-500 text-xs cursor-pointer hover:text-slate-300 transition-colors mb-2">
              View scaffold config
            </summary>
            <div className="space-y-2">
              <div className="p-2 bg-slate-800/50 rounded-lg border border-slate-700">
                <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Task</div>
                <p className="text-slate-300 text-xs">{catalogEntry.tutoring.taskDescription}</p>
              </div>
              <div className="p-2 bg-slate-800/50 rounded-lg border border-slate-700">
                <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Levels</div>
                <div className="space-y-1">
                  {(['level1', 'level2', 'level3'] as const).map((level, i) => (
                    <p key={level} className="text-slate-400 text-[11px]">
                      <span className={`font-bold mr-1 ${
                        i === 0 ? 'text-blue-400' : i === 1 ? 'text-yellow-400' : 'text-orange-400'
                      }`}>{i + 1}.</span>
                      {catalogEntry.tutoring!.scaffoldingLevels[level]}
                    </p>
                  ))}
                </div>
              </div>
            </div>
          </details>
        </div>
      )}
    </div>
  );
};

// ============================================================================
// Main content component
// ============================================================================

const ChemistryPrimitivesTesterContent: React.FC<ChemistryPrimitivesTesterProps> = ({ onBack }) => {
  const [selectedPrimitive, setSelectedPrimitive] = useState<PrimitiveType>('reaction-lab');
  const [selectedGrade, setSelectedGrade] = useState<GradeLevel>('elementary');
  const [topic, setTopic] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedData, setGeneratedData] = useState<unknown>(null);
  const [error, setError] = useState<string | null>(null);
  const [tutorPanelOpen, setTutorPanelOpen] = useState(true);
  const [lastEvaluationResult, setLastEvaluationResult] = useState<PrimitiveEvaluationResult | null>(null);

  const selectedOption = PRIMITIVE_OPTIONS.find((p) => p.value === selectedPrimitive);

  const handleEvaluationSubmit = (result: PrimitiveEvaluationResult) => {
    console.log('Evaluation submitted:', result);
    setLastEvaluationResult(result);
  };

  const handleGenerate = async () => {
    setIsGenerating(true);
    setError(null);
    setGeneratedData(null);

    try {
      const currentTopic = topic || selectedOption?.topic || 'Chemistry concepts';
      const response = await fetch('/api/lumina', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'generateComponentContent',
          params: {
            componentId: selectedPrimitive,
            topic: currentTopic,
            gradeLevel: selectedGrade,
            config: {},
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

  const strands = ['SC', 'CM', 'CR', 'CS'];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-emerald-950/20 to-slate-950">
      {/* Header */}
      <div className="border-b border-slate-800 bg-slate-900/50 backdrop-blur">
        <div className="max-w-[1920px] mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={onBack}
              className="text-slate-400 hover:text-white transition-colors"
            >
              &larr; Back
            </button>
            <div className="h-6 w-px bg-slate-700" />
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              <span>🧪</span>
              <span>Chemistry Primitives</span>
            </h1>
          </div>
          <button
            onClick={() => setTutorPanelOpen(!tutorPanelOpen)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              tutorPanelOpen
                ? 'bg-emerald-600/20 text-emerald-300 border border-emerald-500/30'
                : 'bg-slate-800 text-slate-400 border border-slate-700 hover:text-white'
            }`}
          >
            <Bot className="w-3.5 h-3.5" />
            AI Tutor
            {tutorPanelOpen ? <ChevronRight className="w-3 h-3" /> : <ChevronLeft className="w-3 h-3" />}
          </button>
        </div>
      </div>

      {/* Main Layout */}
      <div className="flex h-[calc(100vh-73px)]">
        {/* Compact Left Panel */}
        <div className="w-64 border-r border-slate-800 bg-slate-900/30 backdrop-blur p-4 overflow-y-auto flex-shrink-0">
          <div className="space-y-4">
            {/* Primitive Selector grouped by strand */}
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-2 uppercase tracking-wider">
                Primitive
              </label>
              <div className="space-y-3">
                {strands.map((strand) => {
                  const strandPrimitives = PRIMITIVE_OPTIONS.filter(p => p.strand === strand);
                  const strandInfo = STRAND_LABELS[strand];
                  return (
                    <div key={strand}>
                      <div className={`text-[10px] font-semibold uppercase tracking-widest mb-1 ${strandInfo.color}`}>
                        {strand}: {strandInfo.label}
                      </div>
                      <div className="space-y-1">
                        {strandPrimitives.map((option) => {
                          const entry = getComponentById(option.value as ComponentId);
                          const hasScaffold = !!entry?.tutoring;
                          return (
                            <button
                              key={option.value}
                              onClick={() => {
                                setSelectedPrimitive(option.value);
                                setGeneratedData(null);
                                setError(null);
                              }}
                              className={`w-full text-left px-3 py-2 rounded-lg transition-all ${
                                selectedPrimitive === option.value
                                  ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-500/20'
                                  : 'bg-slate-800/50 text-slate-300 hover:bg-slate-800 hover:text-white'
                              }`}
                            >
                              <div className="flex items-center gap-2">
                                <span className="text-lg">{option.icon}</span>
                                <div className="flex-1 min-w-0">
                                  <span className="text-sm font-medium block truncate">{option.label}</span>
                                </div>
                                {hasScaffold && (
                                  <span className={`w-2 h-2 rounded-full flex-shrink-0 ${
                                    selectedPrimitive === option.value ? 'bg-green-300' : 'bg-green-500'
                                  }`} />
                                )}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
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
                className="w-full bg-slate-800 text-white border border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
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
                Topic (optional)
              </label>
              <input
                type="text"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder={selectedOption?.topic || 'Enter topic...'}
                className="w-full bg-slate-800 text-white border border-slate-700 rounded-lg px-3 py-2 text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            {/* Generate Button */}
            <button
              onClick={handleGenerate}
              disabled={isGenerating}
              className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 disabled:from-slate-700 disabled:to-slate-700 text-white font-semibold py-3 px-4 rounded-lg transition-all shadow-lg disabled:shadow-none disabled:cursor-not-allowed"
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
                'Generate Content'
              )}
            </button>

            {/* Evaluation Results */}
            <div className="pt-4 border-t border-slate-700">
              <EvaluationResultsPanel />
            </div>
          </div>
        </div>

        {/* Main Content Area */}
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
                  <div className="text-6xl mb-4">🧪</div>
                  <h3 className="text-xl font-semibold text-white mb-2">
                    Chemistry Primitives Tester
                  </h3>
                  <p className="text-slate-400 max-w-md mb-6">
                    Select a primitive from the sidebar, choose a grade level, and click Generate
                    to test interactive chemistry components with AI tutoring.
                  </p>
                  <div className="flex flex-wrap justify-center gap-2">
                    {strands.map((strand) => {
                      const info = STRAND_LABELS[strand];
                      const count = PRIMITIVE_OPTIONS.filter(p => p.strand === strand).length;
                      return (
                        <span key={strand} className={`text-xs px-2 py-1 rounded-full bg-white/5 border border-white/10 ${info.color}`}>
                          {strand}: {count} primitives
                        </span>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {generatedData != null && (
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

        {/* Right Panel - AI Tutor */}
        {tutorPanelOpen && (
          <div className="w-80 border-l border-slate-800 bg-slate-900/30 backdrop-blur flex-shrink-0 flex flex-col">
            <AITutorPanel
              primitiveType={selectedPrimitive}
              gradeLevel={selectedGrade}
              topic={topic || selectedOption?.topic || ''}
              generatedData={generatedData}
            />
          </div>
        )}
      </div>
    </div>
  );
};

// Wrapper with all required providers
const ChemistryPrimitivesTester: React.FC<ChemistryPrimitivesTesterProps> = (props) => {
  return (
    <EvaluationProvider>
      <ExhibitProvider objectives={[]} manifestItems={[]}>
        <LuminaAIProvider>
          <ChemistryPrimitivesTesterContent {...props} />
        </LuminaAIProvider>
      </ExhibitProvider>
    </EvaluationProvider>
  );
};

export { ChemistryPrimitivesTester };
export default ChemistryPrimitivesTester;
