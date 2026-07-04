'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { FoundationExplorerData, FoundationConcept } from '../types';
import { generateConceptImage } from '../service/geminiClient-api';
import { useLuminaAI } from '../hooks/useLuminaAI';
import { useChallengeProgress } from '../hooks/useChallengeProgress';
import { usePhaseResults, type PhaseConfig } from '../hooks/usePhaseResults';
import { SoundManager } from '../utils/SoundManager';
import PhaseSummaryPanel from '../components/PhaseSummaryPanel';
import { usePrimitiveEvaluation, type FoundationExplorerMetrics } from '../evaluation';
import {
  Target,
  CheckCircle2,
  Lightbulb,
  Sparkles,
  MapPin,
  ArrowRight,
  Loader2,
} from 'lucide-react';
import {
  LuminaBadge,
  LuminaCallout,
  LuminaMark,
  answerStateClasses,
  type AnswerChoiceState,
  type LuminaAccent,
} from '../ui';

/**
 * FoundationExplorer - Objective-driven concept exploration
 *
 * A cohesive learning experience that:
 * 1. Leads with a large central diagram, spotlighting where the active concept lives
 * 2. Lets students explore each concept's definition + real-world context
 * 3. Gates each concept behind a quick graded multiple-choice self-check
 * 4. Rolls the per-concept checks up into a PhaseSummaryPanel + evaluation submission
 *
 * The Lumina tutor is woven in as an optional coach (Ask Lumina) during exploration.
 */

interface FoundationExplorerProps {
  data: FoundationExplorerData;
  className?: string;
}

const VERB_CONFIG: Record<string, { label: string; accent: LuminaAccent }> = {
  identify: { label: 'IDENTIFY', accent: 'blue' },
  explain: { label: 'EXPLAIN', accent: 'purple' },
  apply: { label: 'APPLY', accent: 'emerald' },
  analyze: { label: 'ANALYZE', accent: 'rose' },
  compare: { label: 'COMPARE', accent: 'cyan' },
};

// Per-concept phase-summary accents cycle through the summary panel's palette.
const PHASE_ACCENTS: NonNullable<PhaseConfig['accentColor']>[] = [
  'blue', 'emerald', 'amber', 'purple', 'cyan', 'pink',
];

// Attempts → per-concept score. First try is full credit; later tries taper.
const scoreForAttempts = (attempts: number) =>
  attempts <= 1 ? 100 : attempts === 2 ? 70 : 50;

// Stable string hash so option order is shuffled deterministically (no answer
// leaking from position) without re-shuffling on every render.
const hashString = (s: string): number => {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  return h;
};

const FoundationExplorer: React.FC<FoundationExplorerProps> = ({ data, className }) => {
  const {
    objectiveText,
    objectiveVerb,
    diagram,
    concepts,
    themeColor = '#6366f1',
  } = data;

  // Evaluation context props (injected into data by ManifestOrderRenderer).
  const skillId = (data as any).skillId as string | undefined;
  const subskillId = (data as any).subskillId as string | undefined;
  const objectiveId = (data as any).objectiveId as string | undefined;
  const exhibitId = (data as any).exhibitId as string | undefined;
  const resolvedInstanceId = (data as any).instanceId || `foundation-explorer-${Date.now()}`;

  const [selectedConceptId, setSelectedConceptId] = useState<string | null>(concepts[0]?.id || null);
  const [attempts, setAttempts] = useState<Record<string, number>>({});
  const [wrongPicks, setWrongPicks] = useState<Record<string, number[]>>({});
  const [hintRevealed, setHintRevealed] = useState<Record<string, boolean>>({});
  const [diagramImageUrl, setDiagramImageUrl] = useState<string | null>(null);
  const [imageLoading, setImageLoading] = useState(false);

  // AI trigger guards
  const hasTriggeredAllCompleteRef = useRef(false);

  const selectedConcept = concepts.find(c => c.id === selectedConceptId);
  const selectedIndex = concepts.findIndex(c => c.id === selectedConceptId);
  const verbConfig = VERB_CONFIG[objectiveVerb] || VERB_CONFIG.identify;

  // --- Challenge progress: one "challenge" per concept (keyed by concept id) ---
  const { results, isComplete, recordResult } = useChallengeProgress<FoundationConcept>({
    challenges: concepts,
    getChallengeId: (c) => c.id,
  });

  const isMastered = (id: string) => results.some(r => r.challengeId === id && r.correct);
  const completedCount = results.filter(r => r.correct).length;
  const progressPct = concepts.length ? (completedCount / concepts.length) * 100 : 0;

  // Per-concept phase breakdown for the summary panel.
  const phaseConfig = useMemo<Record<string, PhaseConfig>>(() => {
    const cfg: Record<string, PhaseConfig> = {};
    concepts.forEach((c, i) => {
      cfg[c.id] = { label: c.name, accentColor: PHASE_ACCENTS[i % PHASE_ACCENTS.length] };
    });
    return cfg;
  }, [concepts]);

  const phaseResults = usePhaseResults({
    challenges: concepts,
    results,
    isComplete,
    getChallengeType: (c) => c.id,
    phaseConfig,
    getScore: (rs) => {
      if (rs.length === 0) return 0;
      const total = rs.reduce(
        (s, r) => s + (typeof r.score === 'number' ? r.score : r.correct ? 100 : 0),
        0,
      );
      return Math.round(total / rs.length);
    },
  });

  // Deterministic option order per concept — correct answer never sits in a
  // predictable slot regardless of what the generator emitted.
  const optionOrder = useMemo(() => {
    const map: Record<string, number[]> = {};
    for (const c of concepts) {
      const opts = c.selfCheck?.options ?? [];
      map[c.id] = opts
        .map((text, i) => ({ i, k: hashString(`${c.id}:${i}:${text}`) }))
        .sort((a, b) => a.k - b.k)
        .map(({ i }) => i);
    }
    return map;
  }, [concepts]);

  // --- AI Tutoring Integration ---
  const aiPrimitiveData = {
    objectiveText,
    objectiveVerb,
    selectedConceptName: selectedConcept?.name || '',
    completedCount,
    totalConcepts: concepts.length,
    allCompleted: isComplete,
  };

  const { sendText, isAIResponding } = useLuminaAI({
    primitiveType: 'foundation-explorer',
    instanceId: resolvedInstanceId,
    primitiveData: aiPrimitiveData,
    exhibitId,
  });

  // --- Evaluation submission ---
  const {
    submitResult: submitEvaluation,
    hasSubmitted: hasSubmittedEvaluation,
    elapsedMs,
  } = usePrimitiveEvaluation<FoundationExplorerMetrics>({
    primitiveType: 'foundation-explorer',
    instanceId: resolvedInstanceId,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
  });

  // AI trigger + evaluation submit: all concepts mastered
  useEffect(() => {
    if (!isComplete || hasTriggeredAllCompleteRef.current) return;
    hasTriggeredAllCompleteRef.current = true;
    SoundManager.playStreak();

    const totalConcepts = concepts.length;
    const totalAttempts = results.reduce((s, r) => s + r.attempts, 0);
    const firstTryCount = results.filter(r => r.correct && r.attempts === 1).length;
    const hintsViewed = Object.values(hintRevealed).filter(Boolean).length;
    const overallAccuracy = totalConcepts > 0
      ? Math.round(
          results.reduce(
            (s, r) => s + (typeof r.score === 'number' ? r.score : r.correct ? 100 : 0),
            0,
          ) / totalConcepts,
        )
      : 0;

    if (!hasSubmittedEvaluation) {
      submitEvaluation(
        overallAccuracy >= 70,
        overallAccuracy,
        {
          type: 'foundation-explorer',
          evalMode: objectiveVerb,
          totalConcepts,
          conceptsMastered: completedCount,
          overallAccuracy,
          firstTryCount,
          totalAttempts,
          hintsViewed,
          objectiveVerb,
        },
      );
    }

    const conceptNames = concepts.map(c => c.name).join(', ');
    sendText(
      `[ALL_COMPLETE] The student passed the self-check on all ${concepts.length} concepts: ${conceptNames}. ` +
      `Overall accuracy ${overallAccuracy}%, ${firstTryCount} on the first try. ` +
      `Learning objective: "${objectiveText}". ` +
      `Celebrate their effort and briefly recap how these concepts connect to the objective.`,
      { silent: true }
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isComplete]);

  // Generate diagram image
  useEffect(() => {
    let mounted = true;
    const fetchImage = async () => {
      if (diagramImageUrl || imageLoading || !diagram.imagePrompt) return;
      setImageLoading(true);
      const url = await generateConceptImage(
        `Minimal educational schematic illustration: ${diagram.imagePrompt}. ` +
        `Style: glowing thin-line vector diagram, subtle neon accent glow, on a seamless deep navy-to-black background (#0f172a to #000000) that fills the entire frame edge-to-edge — NO solid boxes, NO letterbox bars, NO light or white background panels. ` +
        `Clean thin labels in light slate. Soft depth, faint ambient glow, premium dark-UI aesthetic. Flat 2D, no photorealism, no drop shadows on a card.`,
        '16:9'
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
      SoundManager.select();
      setSelectedConceptId(conceptId);
      sendText(
        `[CONCEPT_SELECTED] The student is now looking at "${concept.name}". ` +
        `Definition: "${concept.briefDefinition}". ` +
        `Progress: ${completedCount} of ${concepts.length} concepts mastered so far. ` +
        `Give ONE vivid, curiosity-sparking teaching hook about this concept (1-2 sentences) — ` +
        `a mental image or a "notice how..." nudge. Do NOT just tell them to read the panel.`,
        { silent: true }
      );
    }
  };

  // Student-initiated AI question (non-silent → engages the tutor + claims focus).
  const askLumina = (text: string) => {
    SoundManager.select();
    sendText(text);
  };

  const handleExplainSimply = () => {
    if (!selectedConcept) return;
    askLumina(
      `Can you explain "${selectedConcept.name}" to me in a really simple, everyday way — ` +
      `maybe with a quick example I'd recognize?`
    );
  };

  const handleConnectGoal = () => {
    if (!selectedConcept) return;
    askLumina(
      `How does "${selectedConcept.name}" connect to what we're trying to learn: "${objectiveText}"?`
    );
  };

  const nextUnmasteredId = (afterId: string): string | null => {
    const done = new Set(results.filter(r => r.correct).map(r => r.challengeId));
    done.add(afterId);
    const start = concepts.findIndex(c => c.id === afterId);
    for (let step = 1; step <= concepts.length; step++) {
      const c = concepts[(start + step) % concepts.length];
      if (!done.has(c.id)) return c.id;
    }
    return null;
  };

  const handleAnswer = (concept: FoundationConcept, originalIndex: number) => {
    if (isMastered(concept.id)) return;
    if ((wrongPicks[concept.id] || []).includes(originalIndex)) return;

    const nextAttempts = (attempts[concept.id] || 0) + 1;
    setAttempts(prev => ({ ...prev, [concept.id]: nextAttempts }));

    const isCorrect = originalIndex === concept.selfCheck.correctIndex;

    if (isCorrect) {
      SoundManager.playCorrect();
      recordResult({
        challengeId: concept.id,
        correct: true,
        attempts: nextAttempts,
        score: scoreForAttempts(nextAttempts),
      });
      sendText(
        `[CONCEPT_COMPLETED] The student answered the self-check for "${concept.name}" correctly ` +
        `(attempt ${nextAttempts}). Progress: ${completedCount + 1} of ${concepts.length}. ` +
        `Celebrate briefly in 1 sentence.`,
        { silent: true }
      );
      const nextId = nextUnmasteredId(concept.id);
      if (nextId) {
        window.setTimeout(() => setSelectedConceptId(nextId), 1050);
      }
    } else {
      SoundManager.playIncorrect();
      setWrongPicks(prev => ({
        ...prev,
        [concept.id]: [...(prev[concept.id] || []), originalIndex],
      }));
      // Surface the hint on a miss and coach (without giving the answer).
      setHintRevealed(prev => ({ ...prev, [concept.id]: true }));
      sendText(
        `[HINT_REQUESTED] The student picked a wrong option on the self-check for "${concept.name}". ` +
        `Question: "${concept.selfCheck.prompt}". ` +
        `Gently narrow it down or point at the diagram detail that unlocks it. Do NOT reveal the answer.`,
        { silent: true }
      );
    }
  };

  const optionState = (concept: FoundationConcept, originalIndex: number): AnswerChoiceState => {
    const mastered = isMastered(concept.id);
    const isCorrectOption = originalIndex === concept.selfCheck.correctIndex;
    if (mastered) return isCorrectOption ? 'correct' : 'dimmed';
    if ((wrongPicks[concept.id] || []).includes(originalIndex)) return 'incorrect';
    return 'idle';
  };

  const spotlightColor = selectedConcept?.color || themeColor;

  return (
    <div className={`w-full ${className || ''}`}>
      <div className="max-w-7xl mx-auto glass-panel rounded-3xl border border-white/10 p-6 md:p-8 relative overflow-hidden shadow-2xl">
        {/* Ambient background glow keyed to the active concept */}
        <div
          className="absolute -top-24 -right-24 w-[520px] h-[520px] rounded-full blur-[160px] opacity-20 transition-colors duration-700 pointer-events-none"
          style={{ backgroundColor: spotlightColor }}
        />

        <div className="relative z-10">
          {/* Header with objective + progress */}
          <div className="flex items-center gap-3 mb-6">
            <span className="text-[10px] font-mono uppercase tracking-widest text-slate-400">Learning:</span>
            <LuminaBadge accent={verbConfig.accent} className="text-[10px] uppercase tracking-widest font-mono rounded-full">
              {verbConfig.label}
            </LuminaBadge>
            <div className="ml-auto flex items-center gap-3">
              <div className="hidden sm:flex items-center gap-2 w-44">
                <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-emerald-500 transition-all duration-500 rounded-full"
                    style={{ width: `${progressPct}%` }}
                  />
                </div>
                <span className="font-mono text-[11px] text-slate-500 tabular-nums whitespace-nowrap">
                  {completedCount}/{concepts.length} mastered
                </span>
              </div>
              {isComplete && (
                <span className="flex items-center gap-2 text-emerald-400 text-sm">
                  <CheckCircle2 size={16} />
                  Complete!
                </span>
              )}
            </div>
          </div>

          {/* Main content grid */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left side: Large hero diagram + concept selector + objective */}
            <div className="lg:col-span-7 space-y-5">
              {/* Central Diagram — the hero, with an active-concept spotlight */}
              <div className="relative rounded-2xl border border-white/10 overflow-hidden bg-black/40">
                <div className="relative w-full aspect-[16/10] min-h-[320px] lg:min-h-[460px] flex items-center justify-center">
                  {diagramImageUrl ? (
                    <img
                      src={diagramImageUrl}
                      alt={diagram.description}
                      className="w-full h-full object-contain"
                    />
                  ) : imageLoading ? (
                    <div className="flex flex-col items-center gap-3">
                      <Loader2 size={32} className="text-slate-500 animate-spin" />
                      <span className="text-xs text-slate-500 font-mono animate-pulse">Generating diagram…</span>
                    </div>
                  ) : (
                    <div className="text-center p-8">
                      <div className="text-6xl mb-4 opacity-70">📐</div>
                      <p className="text-slate-400 text-sm max-w-sm mx-auto">{diagram.description}</p>
                    </div>
                  )}

                  {/* Spotlight: tie the right-panel concept back to the diagram */}
                  {diagramImageUrl && selectedConcept && (
                    <div className="absolute inset-x-0 bottom-0 p-4 bg-gradient-to-t from-black/85 via-black/50 to-transparent pointer-events-none">
                      <div
                        className="inline-flex items-start gap-2.5 rounded-xl px-3 py-2 backdrop-blur-md border max-w-full"
                        style={{
                          backgroundColor: `${spotlightColor}1f`,
                          borderColor: `${spotlightColor}55`,
                        }}
                      >
                        <MapPin size={15} className="mt-0.5 flex-shrink-0" style={{ color: spotlightColor }} />
                        <p className="text-xs text-slate-100 leading-snug">
                          <span className="font-semibold" style={{ color: spotlightColor }}>{selectedConcept.name}:</span>{' '}
                          {selectedConcept.diagramHighlight}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Concept Selector — legend/stepper tied to concept identity colors */}
              <div>
                <div className="text-[10px] uppercase tracking-widest text-slate-500 font-mono mb-2 px-1">
                  Concepts in this diagram
                </div>
                <div className="flex flex-wrap gap-2">
                  {concepts.map((concept, i) => {
                    const active = selectedConceptId === concept.id;
                    const mastered = isMastered(concept.id);

                    return (
                      <button
                        key={concept.id}
                        onClick={() => handleConceptSelect(concept.id)}
                        className={`group flex items-center gap-2.5 pl-2.5 pr-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-300 border ${
                          active
                            ? 'bg-white/10 text-white shadow-lg'
                            : 'bg-white/[0.03] border-white/10 text-slate-400 hover:text-white hover:bg-white/[0.07] hover:border-white/20'
                        }`}
                        style={active ? { borderColor: `${concept.color}66`, boxShadow: `0 0 20px ${concept.color}22` } : {}}
                      >
                        {mastered ? (
                          <CheckCircle2 size={18} className="text-emerald-400 flex-shrink-0" />
                        ) : (
                          <span
                            className="w-[18px] h-[18px] rounded-full flex items-center justify-center text-[10px] font-mono flex-shrink-0 transition-all"
                            style={{
                              color: active ? '#fff' : concept.color,
                              backgroundColor: active ? concept.color : 'transparent',
                              border: `2px solid ${concept.color}`,
                              boxShadow: active ? `0 0 8px ${concept.color}` : 'none',
                            }}
                          >
                            {i + 1}
                          </span>
                        )}
                        {concept.name}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Objective reminder — grounds the whole exhibit */}
              <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
                <div className="flex items-start gap-3">
                  <Target size={16} className="text-slate-500 mt-0.5 flex-shrink-0" />
                  <div>
                    <span className="text-[10px] uppercase tracking-widest text-slate-500 font-mono">Learning Objective</span>
                    <p className="text-slate-300 text-sm mt-1 leading-relaxed">{objectiveText}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Right side: Concept detail + graded self-check, or the summary */}
            <div className="lg:col-span-5">
              {isComplete ? (
                <PhaseSummaryPanel
                  phases={phaseResults}
                  durationMs={elapsedMs}
                  heading="Concepts Mastered"
                  celebrationMessage={`You worked through all ${concepts.length} concepts for "${objectiveText}".`}
                  className="h-full"
                />
              ) : selectedConcept ? (
                <div className="glass-panel rounded-2xl border border-white/10 relative overflow-hidden h-full flex flex-col">
                  {/* Accent bar */}
                  <div
                    className="absolute top-0 left-0 w-full h-1"
                    style={{ backgroundColor: selectedConcept.color }}
                  />

                  <div className="p-6 pt-7 space-y-5 flex-1">
                    {/* Concept name + position */}
                    <div>
                      <div className="flex items-center justify-between gap-3 mb-2">
                        <h3 className="text-2xl font-light text-white">{selectedConcept.name}</h3>
                        <span
                          className="text-[10px] font-mono uppercase tracking-widest px-2 py-1 rounded-full flex-shrink-0"
                          style={{ color: selectedConcept.color, backgroundColor: `${selectedConcept.color}1a` }}
                        >
                          {selectedIndex + 1} / {concepts.length}
                        </span>
                      </div>
                      <p className="text-slate-200 text-[15px] leading-relaxed">{selectedConcept.briefDefinition}</p>
                    </div>

                    {/* In Context */}
                    <LuminaCallout
                      accent="amber"
                      label="In Context"
                      icon={<Lightbulb size={16} />}
                      className="p-4"
                    >
                      <p className="text-slate-100 mb-1.5">{selectedConcept.inContext.scenario}</p>
                      <p className="text-slate-400">{selectedConcept.inContext.whereToFind}</p>
                    </LuminaCallout>

                    {/* Ask Lumina — native AI question affordance */}
                    <div className="rounded-xl border border-indigo-400/20 bg-indigo-500/[0.06] p-4">
                      <div className="flex items-center gap-2 mb-3">
                        <LuminaMark variant="bare" size={20} />
                        <span className="text-[11px] uppercase tracking-widest font-mono text-indigo-200/90">
                          Ask Lumina
                        </span>
                        {isAIResponding && (
                          <span className="ml-auto flex items-center gap-1.5 text-[11px] text-indigo-300/80">
                            <Loader2 size={12} className="animate-spin" />
                            thinking…
                          </span>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <button
                          onClick={handleExplainSimply}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-indigo-100 bg-white/5 border border-white/10 hover:bg-white/10 hover:border-indigo-400/40 transition-all"
                        >
                          <Sparkles size={13} />
                          Explain it simply
                        </button>
                        <button
                          onClick={handleConnectGoal}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-indigo-100 bg-white/5 border border-white/10 hover:bg-white/10 hover:border-indigo-400/40 transition-all"
                        >
                          <Target size={13} />
                          Why does it matter?
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Self-Check — graded MCQ, pinned to the bottom */}
                  <div className="p-6 pt-0">
                    <div
                      className="rounded-xl p-4 border transition-all duration-300"
                      style={{
                        backgroundColor: isMastered(selectedConcept.id) ? 'rgba(16, 185, 129, 0.1)' : 'rgba(255, 255, 255, 0.04)',
                        borderColor: isMastered(selectedConcept.id) ? 'rgba(16, 185, 129, 0.3)' : 'rgba(255, 255, 255, 0.1)',
                      }}
                    >
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="text-[10px] uppercase tracking-widest font-mono flex items-center gap-2" style={{ color: selectedConcept.color }}>
                          <Target size={12} />
                          Self-Check
                        </h4>
                        {isMastered(selectedConcept.id) && (
                          <span className="flex items-center gap-1.5 text-emerald-400 text-xs font-medium">
                            <CheckCircle2 size={14} />
                            Mastered
                          </span>
                        )}
                      </div>
                      <p className="text-white text-sm mb-3 leading-relaxed">{selectedConcept.selfCheck.prompt}</p>

                      {/* Options (deterministically shuffled) */}
                      <div className="space-y-2">
                        {(optionOrder[selectedConcept.id] || []).map((originalIndex) => {
                          const state = optionState(selectedConcept, originalIndex);
                          const disabled = state === 'correct' || state === 'incorrect' || state === 'dimmed';
                          return (
                            <button
                              key={originalIndex}
                              onClick={() => handleAnswer(selectedConcept, originalIndex)}
                              disabled={disabled}
                              className={`relative w-full rounded-lg border px-3.5 py-2.5 text-left text-sm transition-all duration-300 ${answerStateClasses[state]}`}
                            >
                              {selectedConcept.selfCheck.options[originalIndex]}
                              {state === 'correct' && (
                                <CheckCircle2 className="absolute top-2 right-2 w-4 h-4 text-emerald-400" />
                              )}
                            </button>
                          );
                        })}
                      </div>

                      {/* Hint (auto-surfaces on a miss) */}
                      {!isMastered(selectedConcept.id) && (
                        <div className="mt-3">
                          {hintRevealed[selectedConcept.id] ? (
                            <p className="text-sm text-amber-300 border-l-2 border-amber-500/50 pl-3 py-0.5">
                              💡 {selectedConcept.selfCheck.hint}
                            </p>
                          ) : (
                            <button
                              onClick={() => {
                                SoundManager.pop();
                                setHintRevealed(prev => ({ ...prev, [selectedConcept.id]: true }));
                              }}
                              className="text-xs text-slate-400 hover:text-amber-300 transition-colors flex items-center gap-1.5"
                            >
                              <Lightbulb size={13} />
                              Need a hint?
                            </button>
                          )}
                        </div>
                      )}

                      {/* Advance nudge once mastered (auto-advance also fires) */}
                      {isMastered(selectedConcept.id) && nextUnmasteredId(selectedConcept.id) && (
                        <button
                          onClick={() => {
                            const nextId = nextUnmasteredId(selectedConcept.id);
                            if (nextId) handleConceptSelect(nextId);
                          }}
                          className="mt-3 w-full py-2.5 rounded-lg text-sm font-medium text-emerald-100 bg-emerald-500/15 border border-emerald-400/40 hover:bg-emerald-500/25 transition-all flex items-center justify-center gap-2"
                        >
                          Next concept
                          <ArrowRight size={14} />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="glass-panel rounded-2xl border border-white/10 p-6 flex items-center justify-center h-full min-h-[300px]">
                  <p className="text-slate-500 text-center">
                    Select a concept to explore
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FoundationExplorer;
