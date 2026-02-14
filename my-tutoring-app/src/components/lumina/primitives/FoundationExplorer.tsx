'use client';

import React, { useState, useEffect, useRef } from 'react';
import { FoundationExplorerData, FoundationConcept } from '../types';
import { generateConceptImage } from '../service/geminiClient-api';
import { useLuminaAI } from '../hooks/useLuminaAI';
import { Target, CheckCircle2, Lightbulb, HelpCircle, ChevronRight } from 'lucide-react';

/**
 * FoundationExplorer - Objective-driven concept exploration
 *
 * A cohesive learning experience that:
 * 1. Shows a central diagram with all concepts labeled
 * 2. Lets students click concepts to explore definitions and context
 * 3. Provides self-checks aligned to the learning objective verb
 *
 * Designed to bridge from CuratorBrief objectives to foundational concept mastery.
 */

interface FoundationExplorerProps {
  data: FoundationExplorerData;
  className?: string;
}

const VERB_CONFIG: Record<string, { label: string; color: string; bgColor: string; borderColor: string }> = {
  identify: { label: 'IDENTIFY', color: 'text-blue-300', bgColor: 'bg-blue-500/20', borderColor: 'border-blue-500/30' },
  explain: { label: 'EXPLAIN', color: 'text-purple-300', bgColor: 'bg-purple-500/20', borderColor: 'border-purple-500/30' },
  apply: { label: 'APPLY', color: 'text-green-300', bgColor: 'bg-green-500/20', borderColor: 'border-green-500/30' },
  analyze: { label: 'ANALYZE', color: 'text-red-300', bgColor: 'bg-red-500/20', borderColor: 'border-red-500/30' },
  compare: { label: 'COMPARE', color: 'text-cyan-300', bgColor: 'bg-cyan-500/20', borderColor: 'border-cyan-500/30' },
};

const FoundationExplorer: React.FC<FoundationExplorerProps> = ({ data, className }) => {
  const {
    objectiveText,
    objectiveVerb,
    diagram,
    concepts,
    themeColor = '#6366f1',
  } = data;

  const [selectedConceptId, setSelectedConceptId] = useState<string | null>(concepts[0]?.id || null);
  const [selfCheckRevealed, setSelfCheckRevealed] = useState<Record<string, boolean>>({});
  const [conceptsCompleted, setConceptsCompleted] = useState<Record<string, boolean>>({});
  const [diagramImageUrl, setDiagramImageUrl] = useState<string | null>(null);
  const [imageLoading, setImageLoading] = useState(false);

  // AI trigger guards (prevent double-firing)
  const hasTriggeredAllCompleteRef = useRef(false);

  const selectedConcept = concepts.find(c => c.id === selectedConceptId);
  const verbConfig = VERB_CONFIG[objectiveVerb] || VERB_CONFIG.identify;

  const completedCount = Object.values(conceptsCompleted).filter(Boolean).length;
  const allCompleted = completedCount === concepts.length;

  // --- AI Tutoring Integration ---
  const resolvedInstanceId = (data as any).instanceId || `foundation-explorer-${Date.now()}`;

  const aiPrimitiveData = {
    objectiveText,
    objectiveVerb,
    selectedConceptName: selectedConcept?.name || '',
    completedCount,
    totalConcepts: concepts.length,
    allCompleted,
  };

  const { sendText } = useLuminaAI({
    primitiveType: 'foundation-explorer',
    instanceId: resolvedInstanceId,
    primitiveData: aiPrimitiveData,
    exhibitId: (data as any).exhibitId,
  });

  // AI trigger: All concepts completed
  useEffect(() => {
    if (allCompleted && !hasTriggeredAllCompleteRef.current) {
      hasTriggeredAllCompleteRef.current = true;
      const conceptNames = concepts.map(c => c.name).join(', ');
      sendText(
        `[ALL_COMPLETE] The student has explored all ${concepts.length} concepts: ${conceptNames}. ` +
        `Learning objective: "${objectiveText}". ` +
        `Celebrate their effort and briefly recap how these concepts connect to the objective.`,
        { silent: true }
      );
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allCompleted]);

  // Generate diagram image
  useEffect(() => {
    let mounted = true;
    const fetchImage = async () => {
      if (diagramImageUrl || imageLoading || !diagram.imagePrompt) return;
      setImageLoading(true);
      const url = await generateConceptImage(
        `Educational diagram, clean schematic style: ${diagram.imagePrompt}. Clear labels, dark background, professional educational illustration. No photorealism.`
      );
      if (mounted && url) {
        setDiagramImageUrl(url);
      }
      if (mounted) setImageLoading(false);
    };

    fetchImage();
    return () => { mounted = false; };
  }, [diagram.imagePrompt]);

  const handleConceptSelect = (conceptId: string) => {
    const concept = concepts.find(c => c.id === conceptId);
    if (concept && conceptId !== selectedConceptId) {
      setSelectedConceptId(conceptId);
      const exploredSoFar = Object.values(conceptsCompleted).filter(Boolean).length;
      sendText(
        `[CONCEPT_SELECTED] The student selected concept "${concept.name}". ` +
        `Definition: "${concept.briefDefinition}". ` +
        `Progress: ${exploredSoFar} of ${concepts.length} concepts completed so far. ` +
        `Briefly introduce this concept and encourage them to read the definition and check the diagram.`,
        { silent: true }
      );
    }
  };

  const handleSelfCheckReveal = (conceptId: string) => {
    setSelfCheckRevealed(prev => ({ ...prev, [conceptId]: true }));
    const concept = concepts.find(c => c.id === conceptId);
    if (concept) {
      sendText(
        `[HINT_REQUESTED] The student asked for a hint on the self-check for "${concept.name}". ` +
        `Self-check question: "${concept.selfCheck.prompt}". ` +
        `Encourage them to think about the definition and diagram before reading the hint. ` +
        `Do NOT reveal the answer.`,
        { silent: true }
      );
    }
  };

  const handleConceptComplete = (conceptId: string) => {
    setConceptsCompleted(prev => ({ ...prev, [conceptId]: true }));
    const concept = concepts.find(c => c.id === conceptId);
    // Auto-advance to next incomplete concept
    const currentIndex = concepts.findIndex(c => c.id === conceptId);
    const nextConcept = concepts.find((c, i) => i > currentIndex && !conceptsCompleted[c.id]);

    const newCompletedCount = completedCount + 1;
    if (concept) {
      sendText(
        `[CONCEPT_COMPLETED] The student marked "${concept.name}" as understood. ` +
        `Progress: ${newCompletedCount} of ${concepts.length} concepts completed. ` +
        (nextConcept
          ? `Next concept: "${nextConcept.name}". Celebrate briefly and preview the next concept.`
          : newCompletedCount < concepts.length
            ? `Celebrate briefly and encourage them to explore the remaining concepts.`
            : `This was the last concept!`),
        { silent: true }
      );
    }

    if (nextConcept) {
      setSelectedConceptId(nextConcept.id);
    }
  };

  return (
    <div className={`w-full ${className || ''}`}>
      <div className="max-w-6xl mx-auto glass-panel rounded-3xl border border-white/10 p-8 relative overflow-hidden shadow-2xl">
        {/* Ambient background glow */}
        <div
          className="absolute top-0 right-0 w-[500px] h-[500px] rounded-full blur-[150px] opacity-15"
          style={{ backgroundColor: themeColor }}
        />

        <div className="relative z-10">
          {/* Header with objective */}
          <div className="flex items-center gap-3 mb-6">
            <span className="text-[10px] font-mono uppercase tracking-widest text-slate-400">Learning:</span>
            <span className={`text-[10px] uppercase tracking-widest px-2 py-1 rounded-full font-mono border ${verbConfig.bgColor} ${verbConfig.color} ${verbConfig.borderColor}`}>
              {verbConfig.label}
            </span>
            {allCompleted && (
              <span className="ml-auto flex items-center gap-2 text-emerald-400 text-sm">
                <CheckCircle2 size={16} />
                All concepts explored!
              </span>
            )}
          </div>

          {/* Main content grid */}
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
            {/* Left side: Diagram + Concept Selector */}
            <div className="lg:col-span-3 space-y-6">
              {/* Central Diagram */}
              <div className="glass-panel rounded-2xl border border-white/10 p-6 relative overflow-hidden">
                <div className="aspect-video bg-black/40 rounded-xl overflow-hidden flex items-center justify-center border border-white/5">
                  {diagramImageUrl ? (
                    <img
                      src={diagramImageUrl}
                      alt={diagram.description}
                      className="w-full h-full object-contain"
                    />
                  ) : imageLoading ? (
                    <div className="flex flex-col items-center gap-3">
                      <div className="relative w-12 h-12">
                        <div className="absolute inset-0 border-2 border-slate-700 rounded-full"></div>
                        <div className="absolute inset-0 border-t-2 border-white rounded-full animate-spin"></div>
                      </div>
                      <span className="text-xs text-slate-500 font-mono animate-pulse">Generating diagram...</span>
                    </div>
                  ) : (
                    <div className="text-center p-8">
                      <div className="text-6xl mb-4">📐</div>
                      <p className="text-slate-400 text-sm">{diagram.description}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Concept Selector Tabs */}
              <div className="flex flex-wrap gap-2">
                {concepts.map((concept) => {
                  const isSelected = selectedConceptId === concept.id;
                  const isCompleted = conceptsCompleted[concept.id];

                  return (
                    <button
                      key={concept.id}
                      onClick={() => handleConceptSelect(concept.id)}
                      className={`flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-300 border ${
                        isSelected
                          ? 'glass-panel border-white/30 text-white shadow-lg scale-105'
                          : 'bg-white/5 border-white/10 text-slate-400 hover:text-white hover:bg-white/10 hover:border-white/20'
                      }`}
                      style={isSelected ? { borderColor: `${concept.color}50` } : {}}
                    >
                      <div
                        className={`w-3 h-3 rounded-full transition-all ${isCompleted ? 'bg-emerald-500' : ''}`}
                        style={!isCompleted ? { backgroundColor: isSelected ? concept.color : 'transparent', border: `2px solid ${concept.color}` } : {}}
                      />
                      {concept.name}
                      {isCompleted && <CheckCircle2 size={14} className="text-emerald-400" />}
                    </button>
                  );
                })}
              </div>

              {/* Progress indicator */}
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <div className="flex-1 h-1 bg-white/10 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-emerald-500 transition-all duration-500 rounded-full"
                    style={{ width: `${(completedCount / concepts.length) * 100}%` }}
                  />
                </div>
                <span className="font-mono">{completedCount}/{concepts.length} explored</span>
              </div>
            </div>

            {/* Right side: Concept Detail Panel */}
            <div className="lg:col-span-2">
              {selectedConcept ? (
                <div className="glass-panel rounded-2xl border border-white/10 p-6 relative overflow-hidden h-full">
                  {/* Accent bar */}
                  <div
                    className="absolute top-0 left-0 w-full h-1"
                    style={{ backgroundColor: selectedConcept.color }}
                  />

                  <div className="space-y-5 pt-2">
                    {/* Concept name */}
                    <div>
                      <h3 className="text-2xl font-light text-white mb-2">{selectedConcept.name}</h3>
                      <p className="text-slate-300 leading-relaxed">{selectedConcept.briefDefinition}</p>
                    </div>

                    {/* In Context */}
                    <div className="bg-white/5 rounded-xl p-4 border border-white/10">
                      <h4 className="text-[10px] uppercase tracking-widest text-slate-400 font-mono mb-2 flex items-center gap-2">
                        <Lightbulb size={12} />
                        In Context
                      </h4>
                      <p className="text-white text-sm font-light mb-2">{selectedConcept.inContext.scenario}</p>
                      <p className="text-slate-400 text-sm">{selectedConcept.inContext.whereToFind}</p>
                    </div>

                    {/* Where in diagram */}
                    <div className="text-sm text-slate-400">
                      <span className="text-[10px] uppercase tracking-widest font-mono">In the diagram:</span>
                      <p className="text-slate-300 mt-1">{selectedConcept.diagramHighlight}</p>
                    </div>

                    {/* Self-Check */}
                    <div
                      className="rounded-xl p-4 border transition-all duration-300"
                      style={{
                        backgroundColor: conceptsCompleted[selectedConcept.id] ? 'rgba(16, 185, 129, 0.1)' : 'rgba(255, 255, 255, 0.05)',
                        borderColor: conceptsCompleted[selectedConcept.id] ? 'rgba(16, 185, 129, 0.3)' : 'rgba(255, 255, 255, 0.1)'
                      }}
                    >
                      <h4 className="text-[10px] uppercase tracking-widest font-mono mb-3 flex items-center gap-2" style={{ color: selectedConcept.color }}>
                        <Target size={12} />
                        Self-Check
                      </h4>
                      <p className="text-white text-sm mb-4">{selectedConcept.selfCheck.prompt}</p>

                      {!selfCheckRevealed[selectedConcept.id] ? (
                        <button
                          onClick={() => handleSelfCheckReveal(selectedConcept.id)}
                          className="text-sm text-slate-400 hover:text-white transition-colors flex items-center gap-2"
                        >
                          <HelpCircle size={14} />
                          Need a hint?
                        </button>
                      ) : (
                        <div className="space-y-3">
                          <p className="text-sm text-amber-300 border-l-2 border-amber-500/50 pl-3">
                            💡 {selectedConcept.selfCheck.hint}
                          </p>
                          {!conceptsCompleted[selectedConcept.id] && (
                            <button
                              onClick={() => handleConceptComplete(selectedConcept.id)}
                              className="w-full py-3 rounded-lg text-sm font-medium transition-all duration-300 flex items-center justify-center gap-2 hover:scale-105"
                              style={{ backgroundColor: selectedConcept.color, color: 'white' }}
                            >
                              <CheckCircle2 size={16} />
                              I understand this concept!
                            </button>
                          )}
                        </div>
                      )}

                      {conceptsCompleted[selectedConcept.id] && (
                        <div className="flex items-center gap-2 text-emerald-400 text-sm mt-2">
                          <CheckCircle2 size={16} />
                          Concept mastered!
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="glass-panel rounded-2xl border border-white/10 p-6 flex items-center justify-center h-full">
                  <p className="text-slate-500 text-center">
                    Select a concept to explore
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Objective reminder footer */}
          <div className="mt-8 pt-6 border-t border-white/10">
            <div className="flex items-start gap-3">
              <Target size={18} className="text-slate-500 mt-0.5 flex-shrink-0" />
              <div>
                <span className="text-[10px] uppercase tracking-widest text-slate-500 font-mono">Learning Objective</span>
                <p className="text-slate-300 text-sm mt-1">{objectiveText}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FoundationExplorer;
