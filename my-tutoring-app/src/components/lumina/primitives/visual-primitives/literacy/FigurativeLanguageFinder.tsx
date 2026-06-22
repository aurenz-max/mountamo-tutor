'use client';

import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import {
  LuminaCard,
  LuminaCardContent,
  LuminaCardHeader,
  LuminaCardTitle,
  LuminaBadge,
  LuminaButton,
  LuminaPanel,
  LuminaActionButton,
} from '../../../ui';
import {
  usePrimitiveEvaluation,
  type PrimitiveEvaluationResult,
} from '../../../evaluation';
import type { FigurativeLanguageFinderMetrics } from '../../../evaluation/types';
import { useLuminaAI } from '../../../hooks/useLuminaAI';
import { SoundManager } from '../../../utils/SoundManager';

// ============================================================================
// Data Types (Single Source of Truth)
// ============================================================================

export type FigurativeType = 'simile' | 'metaphor' | 'personification' | 'hyperbole' | 'idiom' | 'alliteration' | 'onomatopoeia' | 'imagery';

export interface FigurativeInstance {
  instanceId: string;
  text: string;                      // The figurative phrase as it appears
  startIndex: number;                // Character offset in passage
  endIndex: number;
  type: FigurativeType;
  literalMeaning: string;            // What it literally means
  explanation: string;               // Why it's this type
}

export interface FigurativeLanguageFinderData {
  title: string;
  gradeLevel: string;
  passage: string;
  instances: FigurativeInstance[];

  // Which instances require literal translation (Phase 3)
  translateInstanceIds: string[];     // 2-3 instance IDs students must translate

  // Available types for classification
  availableTypes: FigurativeType[];

  // ── Within-mode support tier (config.difficulty) — scaffolding level, NOT the
  //    passage, instances, or answers. Set deterministically by the generator. ──
  /** easy: pre-cue the figurative spans in the Find phase so finding is confirmation;
   *  hard: no cue — the student locates them in plain prose. Display-only. */
  prehighlightInstances?: boolean;
  /** easy: restrict the classify chips to a tighter choice set (still contains every
   *  correct type present, so no answer is unselectable); hard: full type menu.
   *  Decoupled into its OWN field so it never narrows the answer key. */
  classifyTypeChoices?: FigurativeType[];
  /** easy: per-phase instruction names the strategy / signal words; hard: neutral. */
  nameStrategyInHints?: boolean;

  // Evaluation props
  instanceId?: string;
  skillId?: string;
  subskillId?: string;
  objectiveId?: string;
  exhibitId?: string;
  onEvaluationSubmit?: (result: PrimitiveEvaluationResult<FigurativeLanguageFinderMetrics>) => void;
}

// ============================================================================
// Props
// ============================================================================

interface FigurativeLanguageFinderProps {
  data: FigurativeLanguageFinderData;
  className?: string;
}

// ============================================================================
// Constants
// ============================================================================

type FinderPhase = 'find' | 'classify' | 'interpret' | 'review';

// Figurative-language tagging color language — this is the bespoke interaction
// surface's "ink" (what color each figurative type is highlighted/tagged with
// on the passage and classify chips), not chrome. Kept verbatim.
const TYPE_COLORS: Record<FigurativeType, string> = {
  simile: 'bg-blue-500/20 border-blue-500/40 text-blue-300',
  metaphor: 'bg-violet-500/20 border-violet-500/40 text-violet-300',
  personification: 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300',
  hyperbole: 'bg-rose-500/20 border-rose-500/40 text-rose-300',
  idiom: 'bg-amber-500/20 border-amber-500/40 text-amber-300',
  alliteration: 'bg-cyan-500/20 border-cyan-500/40 text-cyan-300',
  onomatopoeia: 'bg-orange-500/20 border-orange-500/40 text-orange-300',
  imagery: 'bg-pink-500/20 border-pink-500/40 text-pink-300',
};

// Signal-word / strategy cue per figurative type — shown ONLY at the easy tier
// (#2 instruction-as-scaffold). Names the thing to look for; never the answer.
const TYPE_STRATEGY: Record<FigurativeType, string> = {
  simile: 'comparisons using "like" or "as"',
  metaphor: 'a thing said to BE another thing (no "like"/"as")',
  personification: 'objects/animals doing human actions',
  hyperbole: 'wild exaggerations that can\'t be literally true',
  idiom: 'common sayings that don\'t mean their literal words',
  alliteration: 'repeated starting sounds in nearby words',
  onomatopoeia: 'words that spell out a sound',
  imagery: 'vivid sensory details you can picture, hear, or feel',
};

const TYPE_LABELS: Record<FigurativeType, string> = {
  simile: 'Simile',
  metaphor: 'Metaphor',
  personification: 'Personification',
  hyperbole: 'Hyperbole',
  idiom: 'Idiom',
  alliteration: 'Alliteration',
  onomatopoeia: 'Onomatopoeia',
  imagery: 'Imagery',
};

// ============================================================================
// Component
// ============================================================================

const FigurativeLanguageFinder: React.FC<FigurativeLanguageFinderProps> = ({ data, className }) => {
  const {
    title, gradeLevel, passage, instances, translateInstanceIds, availableTypes,
    prehighlightInstances, classifyTypeChoices, nameStrategyInHints,
    instanceId: evalInstanceId, skillId, subskillId, objectiveId, exhibitId, onEvaluationSubmit,
  } = data;

  // Classify chips: prefer the tier-reduced choice set when the generator supplied
  // one (easy/medium). It is GUARANTEED to contain every correct type present, so
  // no correct answer is ever made unselectable. Falls back to the full menu.
  const classifyOptions: FigurativeType[] =
    classifyTypeChoices && classifyTypeChoices.length > 0 ? classifyTypeChoices : availableTypes;

  const [currentPhase, setCurrentPhase] = useState<FinderPhase>('find');
  const [foundInstances, setFoundInstances] = useState<Set<number>>(new Set()); // indices into instances[]
  const [classifications, setClassifications] = useState<Record<number, FigurativeType>>({}); // instance index -> type
  const [translations, setTranslations] = useState<Record<string, string>>({}); // instanceId -> student translation

  // Stable fallback instance ID — must not change across renders
  const stableInstanceIdRef = useRef(evalInstanceId || `figurative-language-finder-${Date.now()}`);
  const resolvedInstanceId = evalInstanceId || stableInstanceIdRef.current;

  const {
    submitResult: submitEvaluation,
    hasSubmitted: hasSubmittedEvaluation,
  } = usePrimitiveEvaluation<FigurativeLanguageFinderMetrics>({
    primitiveType: 'figurative-language-finder',
    instanceId: resolvedInstanceId,
    skillId, subskillId, objectiveId, exhibitId,
    onSubmit: onEvaluationSubmit as ((result: PrimitiveEvaluationResult) => void) | undefined,
  });

  // Types of figurative language present in this passage — drives tutor context.
  const typesPresent = useMemo(
    () => Array.from(new Set(instances.map(i => i.type))).map(t => TYPE_LABELS[t]).join(', '),
    [instances]
  );

  // ---------------------------------------------------------------------------
  // AI Tutoring Integration — the AI tutor coaches the student through finding,
  // classifying, and interpreting figurative language. It never names the answer;
  // it points at signal words and the literal/figurative distinction.
  // ---------------------------------------------------------------------------
  const aiPrimitiveData = useMemo(() => ({
    gradeLevel,
    currentPhase,
    totalInstances: instances.length,
    instancesFound: foundInstances.size,
    typesPresent,
    classifiedCount: Object.keys(classifications).length,
  }), [gradeLevel, currentPhase, instances.length, foundInstances, typesPresent, classifications]);

  const { sendText, isConnected } = useLuminaAI({
    primitiveType: 'figurative-language-finder',
    instanceId: resolvedInstanceId,
    primitiveData: aiPrimitiveData,
    gradeLevel,
  });

  // Activity introduction — fire once when the AI tutor connects
  const hasIntroducedRef = useRef(false);
  useEffect(() => {
    if (!isConnected || hasIntroducedRef.current || instances.length === 0) return;
    hasIntroducedRef.current = true;
    sendText(
      `[ACTIVITY_START] This is a figurative-language activity for Grade ${gradeLevel}. `
      + `The passage "${title}" contains ${instances.length} figurative phrases (types in play: ${typesPresent}). `
      + `Warmly introduce the activity (2 sentences max): we'll find, classify, and interpret figurative language. `
      + `Encourage the student to tap each figurative phrase they spot in the passage. Do NOT reveal which phrases or types they are.`,
      { silent: true }
    );
  }, [isConnected, instances.length, gradeLevel, title, typesPresent, sendText]);

  // Phase navigation
  const phases: FinderPhase[] = ['find', 'classify', 'interpret', 'review'];
  const phaseLabels: Record<FinderPhase, string> = { find: 'Find', classify: 'Classify', interpret: 'Interpret', review: 'Review' };

  const nextPhase = () => {
    const idx = phases.indexOf(currentPhase);
    if (idx < phases.length - 1) {
      SoundManager.navigate();
      const next = phases[idx + 1];
      setCurrentPhase(next);
      if (next === 'classify') {
        sendText(
          `[PHASE_CLASSIFY] The student found ${foundInstances.size} of ${instances.length} figurative phrases and is now labeling each by type. Briefly prompt them to think about HOW each phrase works (one sentence). Do not reveal any answer.`,
          { silent: true }
        );
      } else if (next === 'interpret') {
        sendText(
          `[PHASE_INTERPRET] The student is now writing the literal meaning of ${translateInstanceIds.length} figurative phrase(s). Briefly prompt them to put the figurative phrase into plain words (one sentence).`,
          { silent: true }
        );
      } else if (next === 'review') {
        sendText(
          `[PHASE_REVIEW] The student reached the review step. Briefly invite them to check their labels before submitting (one sentence).`,
          { silent: true }
        );
      }
    }
  };
  const prevPhase = () => {
    const idx = phases.indexOf(currentPhase);
    if (idx > 0) {
      SoundManager.navigate();
      setCurrentPhase(phases[idx - 1]);
    }
  };

  // Toggle instance found
  const toggleInstance = useCallback((index: number) => {
    setFoundInstances(prev => {
      const next = new Set(Array.from(prev));
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }, []);

  // Render passage with clickable figurative instances
  const renderPassage = useMemo(() => {
    if (instances.length === 0) return <p className="text-slate-200 text-sm leading-relaxed">{passage}</p>;

    const sorted = [...instances].map((inst, origIdx) => ({ ...inst, origIdx })).sort((a, b) => a.startIndex - b.startIndex);
    const elements: React.ReactNode[] = [];
    let lastEnd = 0;

    sorted.forEach((inst) => {
      if (inst.startIndex > lastEnd) {
        elements.push(<span key={`t-${inst.origIdx}`} className="text-slate-200">{passage.slice(lastEnd, inst.startIndex)}</span>);
      }

      const isFound = foundInstances.has(inst.origIdx);
      const classification = classifications[inst.origIdx];
      const typeColor = classification ? TYPE_COLORS[classification] : '';
      // easy tier (#1 perception): pre-cue the figurative spans in the Find phase so
      // locating them is confirmation, not discovery. Does NOT mark them found — the
      // student still taps each one, so foundInstances / the score are unchanged.
      const showCue = prehighlightInstances && currentPhase === 'find' && !isFound;

      elements.push(
        <span
          key={`i-${inst.origIdx}`}
          onClick={() => currentPhase === 'find' ? toggleInstance(inst.origIdx) : undefined}
          className={`rounded px-0.5 transition-colors ${
            currentPhase === 'find' ? 'cursor-pointer hover:bg-yellow-400/20' : ''
          } ${
            isFound
              ? classification
                ? typeColor
                : 'bg-yellow-400/20 text-yellow-200 underline underline-offset-2'
              : showCue
                ? 'decoration-dashed decoration-slate-400/60 underline underline-offset-2 text-slate-200'
                : 'text-slate-200'
          }`}
        >
          {passage.slice(inst.startIndex, inst.endIndex)}
        </span>
      );
      lastEnd = inst.endIndex;
    });

    if (lastEnd < passage.length) {
      elements.push(<span key="t-end" className="text-slate-200">{passage.slice(lastEnd)}</span>);
    }

    return <p className="text-sm leading-relaxed">{elements}</p>;
  }, [passage, instances, foundInstances, classifications, currentPhase, toggleInstance, prehighlightInstances]);

  // Classify an instance
  const classifyInstance = useCallback((index: number, type: FigurativeType) => {
    const inst = instances[index];
    if (!inst) return;
    if (type === inst.type) {
      SoundManager.playCorrect();
      sendText(
        `[CLASSIFY_CORRECT] The student correctly labeled "${inst.text}" as ${TYPE_LABELS[inst.type]}. Affirm briefly in one short sentence — note the signal that makes it a ${TYPE_LABELS[inst.type]}.`,
        { silent: true }
      );
    } else {
      SoundManager.playIncorrect();
      sendText(
        `[CLASSIFY_INCORRECT] The student labeled "${inst.text}" as ${TYPE_LABELS[type]}, but that is not the best fit. Give a brief hint about what to look for, without naming the correct type.`,
        { silent: true }
      );
    }
    setClassifications(prev => ({ ...prev, [index]: type }));
  }, [instances, sendText]);

  // Calculate score
  const calculateScore = useCallback(() => {
    const instancesTotal = instances.length;
    const instancesFound = foundInstances.size;
    let classificationsCorrect = 0;
    let classificationsTotal = 0;

    foundInstances.forEach(idx => {
      if (classifications[idx]) {
        classificationsTotal++;
        if (classifications[idx] === instances[idx].type) classificationsCorrect++;
      }
    });

    // Translation accuracy (simplified — check if they wrote something substantial)
    let translationScore = 0;
    const translateIds = translateInstanceIds.filter(id => instances.find(i => i.instanceId === id));
    if (translateIds.length > 0) {
      const filled = translateIds.filter(id => (translations[id] || '').trim().length > 10).length;
      translationScore = Math.round((filled / translateIds.length) * 100);
    }

    const typesEncountered = Array.from(new Set(instances.map(i => i.type)));

    // Score: finding (30%) + classification (40%) + translation (30%)
    const findScore = instancesTotal > 0 ? Math.round((instancesFound / instancesTotal) * 30) : 30;
    const classScore = classificationsTotal > 0 ? Math.round((classificationsCorrect / classificationsTotal) * 40) : 0;
    const transScore = Math.round((translationScore / 100) * 30);

    return {
      score: findScore + classScore + transScore,
      instancesFound,
      instancesTotal,
      classificationsCorrect,
      classificationsTotal,
      literalTranslationAccuracy: translationScore,
      typesEncountered,
      falsePositives: 0, // Simplified — we only allow clicking real instances
    };
  }, [instances, foundInstances, classifications, translateInstanceIds, translations]);

  // Submit
  const submitFinalEvaluation = useCallback(() => {
    if (hasSubmittedEvaluation) return;
    const m = calculateScore();

    const metrics: FigurativeLanguageFinderMetrics = {
      type: 'figurative-language-finder',
      instancesFound: m.instancesFound,
      instancesTotal: m.instancesTotal,
      classificationsCorrect: m.classificationsCorrect,
      classificationsTotal: m.classificationsTotal,
      literalTranslationAccuracy: m.literalTranslationAccuracy,
      typesEncountered: m.typesEncountered,
      falsePositives: m.falsePositives,
      attemptsCount: 1,
    };

    submitEvaluation(m.score >= 50, m.score, metrics, {
      foundInstances: Array.from(foundInstances),
      classifications,
      translations,
    });

    sendText(
      `[ACTIVITY_COMPLETE] The student finished: found ${m.instancesFound}/${m.instancesTotal} phrases and labeled ${m.classificationsCorrect}/${m.classificationsTotal} correctly (score ${m.score}). Give a brief, warm wrap-up (one or two sentences) and one tip for spotting figurative language next time.`,
      { silent: true }
    );
  }, [hasSubmittedEvaluation, calculateScore, submitEvaluation, foundInstances, classifications, translations, sendText]);

  // Render progress
  const renderProgress = () => (
    <div className="flex items-center gap-2 mb-4">
      {phases.map((phase, i) => {
        const isActive = phase === currentPhase;
        const phaseIdx = phases.indexOf(currentPhase);
        const isCompleted = i < phaseIdx;
        return (
          <React.Fragment key={phase}>
            {i > 0 && <div className={`h-0.5 w-6 ${isCompleted || isActive ? 'bg-emerald-500/60' : 'bg-slate-600/40'}`} />}
            <div className={`px-2 py-1 rounded text-xs font-medium border ${
              isCompleted ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300'
              : isActive ? 'bg-blue-500/20 border-blue-500/40 text-blue-300'
              : 'bg-slate-700/20 border-slate-600/30 text-slate-500'
            }`}>
              {phaseLabels[phase]}
            </div>
          </React.Fragment>
        );
      })}
    </div>
  );

  // easy-tier strategy cue (#2): name the signal words for the types actually in
  // play. Distinct from the legend (which just labels). Hidden at medium/hard.
  const strategyCue = useMemo(() => {
    if (!nameStrategyInHints) return null;
    const present = Array.from(new Set(instances.map(i => i.type)));
    if (present.length === 0) return null;
    return present.map(t => `${TYPE_LABELS[t]} — ${TYPE_STRATEGY[t]}`);
  }, [nameStrategyInHints, instances]);

  const renderStrategyCue = () =>
    strategyCue ? (
      <LuminaPanel accent="blue" className="p-3">
        <p className="text-xs text-blue-200 font-medium mb-1">What to look for:</p>
        <ul className="space-y-0.5">
          {strategyCue.map((line, i) => (
            <li key={i} className="text-xs text-slate-300">{line}</li>
          ))}
        </ul>
      </LuminaPanel>
    ) : null;

  // Type legend
  const renderTypeLegend = () => (
    <div className="flex flex-wrap gap-1.5 mt-2">
      {availableTypes.map(t => (
        <span key={t} className={`text-xs px-1.5 py-0.5 rounded border ${TYPE_COLORS[t]}`}>
          {TYPE_LABELS[t]}
        </span>
      ))}
    </div>
  );

  return (
    <LuminaCard className={className}>
      <LuminaCardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <LuminaCardTitle className="text-lg">{title}</LuminaCardTitle>
            <div className="flex items-center gap-2">
              <LuminaBadge className="text-xs">Grade {gradeLevel}</LuminaBadge>
              <LuminaBadge accent="pink" className="text-xs">{instances.length} Instances</LuminaBadge>
            </div>
          </div>
        </div>
      </LuminaCardHeader>

      <LuminaCardContent className="space-y-4">
        {renderProgress()}

        {/* Phase 1: Find */}
        {currentPhase === 'find' && (
          <div className="space-y-3">
            <p className="text-xs text-slate-500">Tap each figurative language phrase you find in the passage:</p>
            {renderStrategyCue()}
            {/* Interaction surface: clickable/highlightable passage spans — left bespoke */}
            <div className="rounded-lg bg-white/5 border border-white/10 p-4">
              {renderPassage}
            </div>
            {renderTypeLegend()}
            <div className="flex items-center justify-between">
              <p className="text-xs text-slate-400">Found: {foundInstances.size} / {instances.length}</p>
              <LuminaActionButton action="next" onClick={nextPhase} disabled={foundInstances.size === 0}>
                Next: Classify
              </LuminaActionButton>
            </div>
          </div>
        )}

        {/* Phase 2: Classify */}
        {currentPhase === 'classify' && (
          <div className="space-y-3">
            <p className="text-xs text-slate-500">Label each highlighted phrase with its figurative language type:</p>
            {renderStrategyCue()}
            <div className="space-y-2">
              {Array.from(foundInstances).sort((a, b) => a - b).map(idx => {
                const inst = instances[idx];
                if (!inst) return null;
                const currentClassification = classifications[idx];
                return (
                  <LuminaPanel key={idx} className="p-3">
                    <p className="text-sm text-yellow-200 font-medium mb-2">&ldquo;{inst.text}&rdquo;</p>
                    {/* Figurative-tagging chips — bespoke interaction surface (color = the "ink").
                        Choice set is tier-reduced at easy/medium, full menu at hard. */}
                    <div className="flex flex-wrap gap-1.5">
                      {classifyOptions.map(t => (
                        <button
                          key={t}
                          onClick={() => classifyInstance(idx, t)}
                          className={`px-2 py-1 rounded text-xs border transition-all ${
                            currentClassification === t ? TYPE_COLORS[t] : 'bg-white/5 border-white/10 text-slate-400 hover:bg-white/10'
                          }`}
                        >
                          {TYPE_LABELS[t]}
                        </button>
                      ))}
                    </div>
                  </LuminaPanel>
                );
              })}
            </div>
            <div className="flex justify-between">
              <LuminaButton onClick={prevPhase}>Back</LuminaButton>
              <LuminaActionButton action="next" onClick={nextPhase}
                disabled={Array.from(foundInstances).some(idx => !classifications[idx])}>
                Next: Interpret
              </LuminaActionButton>
            </div>
          </div>
        )}

        {/* Phase 3: Interpret */}
        {currentPhase === 'interpret' && (
          <div className="space-y-3">
            <p className="text-xs text-slate-500">Write what these figurative phrases literally mean:</p>
            {translateInstanceIds.map(id => {
              const inst = instances.find(i => i.instanceId === id);
              if (!inst) return null;
              return (
                <LuminaPanel key={id} className="p-3 space-y-2">
                  <p className="text-sm text-yellow-200">&ldquo;{inst.text}&rdquo;</p>
                  <p className="text-xs text-slate-500">Type: {TYPE_LABELS[inst.type]}</p>
                  {/* Free-response interpretation entry — bespoke interaction surface */}
                  <textarea
                    value={translations[id] || ''}
                    onChange={e => setTranslations(prev => ({ ...prev, [id]: e.target.value }))}
                    placeholder="What does this literally mean?..."
                    rows={2}
                    className="w-full px-3 py-2 rounded-lg border border-white/10 bg-white/5 text-slate-200 placeholder:text-slate-500 text-sm focus:outline-none focus:border-blue-500/40 resize-none"
                  />
                </LuminaPanel>
              );
            })}
            <div className="flex justify-between">
              <LuminaButton onClick={prevPhase}>Back</LuminaButton>
              <LuminaActionButton action="next" onClick={nextPhase}>
                Review
              </LuminaActionButton>
            </div>
          </div>
        )}

        {/* Phase 4: Review */}
        {currentPhase === 'review' && (
          <div className="space-y-4">
            {/* Interaction surface: passage with tagged spans — left bespoke */}
            <div className="rounded-lg bg-white/5 border border-white/10 p-4">
              {renderPassage}
            </div>

            {/* Classification summary */}
            <div className="space-y-1.5">
              {Array.from(foundInstances).sort((a, b) => a - b).map(idx => {
                const inst = instances[idx];
                if (!inst) return null;
                const classified = classifications[idx];
                const isCorrect = classified === inst.type;
                return (
                  <div key={idx} className={`flex items-center gap-2 rounded-lg border px-3 py-2 ${isCorrect ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-white/5 border-white/10'}`}>
                    <span className="text-xs text-slate-300 flex-1">&ldquo;{inst.text}&rdquo;</span>
                    <span className={`text-xs px-1.5 py-0.5 rounded ${classified ? TYPE_COLORS[classified] : 'bg-slate-700/40 text-slate-500'}`}>
                      {classified ? TYPE_LABELS[classified] : '?'}
                    </span>
                  </div>
                );
              })}
            </div>

            <div className="flex justify-between">
              <LuminaButton onClick={prevPhase}>Edit</LuminaButton>
              {!hasSubmittedEvaluation ? (
                <LuminaActionButton action="check" onClick={submitFinalEvaluation}>
                  Submit
                </LuminaActionButton>
              ) : (
                <LuminaPanel accent="emerald" className="p-4 text-center w-full">
                  <p className="text-emerald-300 font-semibold">Analysis Complete!</p>
                  <p className="text-slate-400 text-sm mt-1">
                    Found: {foundInstances.size}/{instances.length} | Classified: {Object.values(classifications).filter((c, i) => c === instances[Array.from(foundInstances)[i]]?.type).length} correct
                  </p>
                </LuminaPanel>
              )}
            </div>
          </div>
        )}
      </LuminaCardContent>
    </LuminaCard>
  );
};

export default FigurativeLanguageFinder;
