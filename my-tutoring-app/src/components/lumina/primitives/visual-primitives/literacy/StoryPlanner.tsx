'use client';

import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import {
  LuminaCard,
  LuminaCardContent,
  LuminaCardHeader,
  LuminaCardTitle,
  LuminaBadge,
  LuminaPanel,
  LuminaButton,
  LuminaChip,
  LuminaFeedbackCard,
  LuminaReadAloud,
} from '../../../ui';
import {
  usePrimitiveEvaluation,
  type PrimitiveEvaluationResult,
} from '../../../evaluation';
import type { StoryPlannerMetrics } from '../../../evaluation/types';
import { SoundManager } from '../../../utils/SoundManager';
import { useLuminaAI } from '../../../hooks/useLuminaAI';
import { isStoryPlannerPictureBand } from '../../../service/literacy/storyPlannerBand';

// ============================================================================
// Data Types (Single Source of Truth)
// ============================================================================

export interface StoryElement {
  elementId: string;
  label: string;                     // "Character", "Setting", "Problem", etc.
  prompt: string;                    // "Who is your main character? Describe them."
  required: boolean;
  /**
   * K-1 only. Emoji-prefixed picture options ("🐶 A puppy"). A five-year-old
   * cannot read the prompt or type an answer, so at that band the plan is
   * assembled by TAPPING one of these. All options are equally valid — this is
   * a creative choice, never a quiz. Absent at grade 2+, where the student
   * writes their own.
   */
  choices?: string[];
}

export interface StoryPlannerData {
  title: string;
  gradeLevel: string;
  writingPrompt: string;              // The narrative writing prompt
  elements: StoryElement[];           // Planning cards to fill out
  storyArcLabels: string[];           // e.g. ["Beginning", "Rising Action", "Climax", "Falling Action", "Resolution"]
  conflictTypes?: string[];           // For grades 4+: internal, external, person vs nature, etc.
  dialoguePrompt?: string;            // For grades 3+: guidance for adding dialogue
  /**
   * K-1 only. One emoji-prefixed event per `storyArcLabels` entry, IN STORY
   * ORDER — i.e. the answer key for the arc. It is shuffled before the student
   * sees it and never rendered in generated order. Absent at grade 2+.
   */
  arcEvents?: string[];
  // Eval-mode task identity: which narrative-writing skill this plan emphasises.
  // Optional / back-compatible — the scaffold renders identically regardless.
  planningFocus?: 'story_structure' | 'character_setting' | 'conflict_resolution' | 'theme_craft';

  // Evaluation props
  instanceId?: string;
  skillId?: string;
  subskillId?: string;
  objectiveId?: string;
  exhibitId?: string;
  onEvaluationSubmit?: (result: PrimitiveEvaluationResult<StoryPlannerMetrics>) => void;
}

// ============================================================================
// Props
// ============================================================================

interface StoryPlannerProps {
  data: StoryPlannerData;
  className?: string;
}

// ============================================================================
// Types
// ============================================================================

type PlannerPhase = 'plan' | 'arc' | 'review';

interface PictureOption {
  /** Leading emoji — the answer surface at K-1. */
  emoji: string;
  /** The words after it — a caption, never the load-bearing channel. */
  label: string;
  /** The original string, used as the state value and identity. */
  raw: string;
}

// ============================================================================
// Picture-band helpers (pure — exercised directly by the reader-fit tests)
// ============================================================================

/**
 * Split "🐶 A puppy" into its glyph and its caption.
 *
 * Deliberately avoids `\p{Extended_Pictographic}` — the project targets ES5 and
 * the `u` flag is a compile error there. A leading token that is short, has no
 * ASCII alphanumerics and is non-ASCII is an emoji for our purposes; anything
 * else is treated as plain text so a caption-only option still renders.
 */
export const splitPictureOption = (raw: string): PictureOption => {
  const trimmed = (raw || '').trim();
  const sp = trimmed.indexOf(' ');
  if (sp > 0) {
    const head = trimmed.slice(0, sp);
    const isGlyph =
      head.length <= 8 && !/[A-Za-z0-9]/.test(head) && /[^\x00-\x7F]/.test(head);
    if (isGlyph) {
      return { emoji: head, label: trimmed.slice(sp + 1).trim(), raw: trimmed };
    }
  }
  return { emoji: '', label: trimmed, raw: trimmed };
};

const hashString = (s: string): number => {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
};

/**
 * Shuffle the arc events for the tray. The generator emits them IN ORDER —
 * that order is the answer, so it must never reach the screen.
 *
 * A content-seeded rotation by 1..n-1 is a guaranteed derangement (no card sits
 * in the slot it belongs to) and is deterministic, so the board does not
 * reshuffle on every render and the tests can assert against it. `Math.random`
 * would do neither.
 */
export const shuffleArcEvents = (events: string[]): string[] => {
  const n = events.length;
  if (n < 2) return events.slice();
  const shift = (hashString(events.join('|')) % (n - 1)) + 1;
  return events.map((_, i) => events[(i + shift) % n]);
};

// ============================================================================
// Component
// ============================================================================

const StoryPlanner: React.FC<StoryPlannerProps> = ({ data, className }) => {
  const {
    title, gradeLevel, writingPrompt, elements, storyArcLabels, conflictTypes, dialoguePrompt,
    arcEvents,
    instanceId, skillId, subskillId, objectiveId, exhibitId, onEvaluationSubmit,
  } = data;

  const [currentPhase, setCurrentPhase] = useState<PlannerPhase>('plan');
  const [elementTexts, setElementTexts] = useState<Record<string, string>>({});
  const [arcTexts, setArcTexts] = useState<Record<string, string>>({});
  const [selectedConflict, setSelectedConflict] = useState<string>('');
  const [elementIdx, setElementIdx] = useState(0);

  // ── Reading band ──────────────────────────────────────────────────────────
  // K-1 gets the tap-a-picture planner; 2+ keeps the free-text one untouched.
  // `pickMode`/`orderMode` additionally require the CONTENT to exist — a band
  // gate that fires without the content behind it renders an empty screen.
  const isPictureBand = isStoryPlannerPictureBand(gradeLevel);

  const choiceElements = useMemo(
    () => elements.map(e => ({
      ...e,
      options: (e.choices ?? []).filter(c => !!c && c.trim()).map(splitPictureOption),
    })),
    [elements],
  );
  const pickMode =
    isPictureBand && elements.length > 0 && choiceElements.every(e => e.options.length > 1);
  const orderMode =
    isPictureBand && storyArcLabels.length > 1 && (arcEvents?.length ?? 0) === storyArcLabels.length;

  const arcTray = useMemo(
    () => (orderMode && arcEvents ? shuffleArcEvents(arcEvents) : []),
    [orderMode, arcEvents],
  );

  const {
    submitResult: submitEvaluation,
    hasSubmitted: hasSubmittedEvaluation,
  } = usePrimitiveEvaluation<StoryPlannerMetrics>({
    primitiveType: 'story-planner',
    instanceId: instanceId || `story-planner-${Date.now()}`,
    skillId, subskillId, objectiveId, exhibitId,
    onSubmit: onEvaluationSubmit as ((result: PrimitiveEvaluationResult) => void) | undefined,
  });

  // ── Tutor context ─────────────────────────────────────────────────────────
  // Flat literal on purpose: a bag assembled behind local statements makes
  // tutor-test report every key as "dynamic — verify at runtime".
  //
  // What is deliberately NOT here: `arcEvents` in generated order. That is the
  // answer to the sequencing task, and everything in this bag is fair game for
  // the tutor to say out loud.
  const currentElement = pickMode && currentPhase === 'plan' ? choiceElements[elementIdx] : undefined;
  const currentChoiceLabels = currentElement ? currentElement.options.map(o => o.label).join(', ') : '';
  const chosenSummary = elements
    .map(e => `${e.label}: ${splitPictureOption(elementTexts[e.elementId] || '').label || '(not chosen yet)'}`)
    .join('; ');
  const arcTrayLabels = arcTray.map(c => splitPictureOption(c).label).join(', ');
  const arcFilledCount = storyArcLabels.filter(l => (arcTexts[l] || '').trim()).length;
  const gradeBand = isPictureBand ? 'K-1' : '2-6';

  const aiPrimitiveData = useMemo(() => ({
    title,
    writingPrompt,
    gradeBand,
    plannerPhase: currentPhase,
    currentQuestion: currentElement?.prompt ?? '',
    currentChoiceLabels,
    chosenSummary,
    arcLabels: storyArcLabels.join(', '),
    arcTrayLabels,
    arcFilledCount,
    arcSlotCount: storyArcLabels.length,
  }), [
    title, writingPrompt, gradeBand, currentPhase, currentElement?.prompt,
    currentChoiceLabels, chosenSummary, storyArcLabels, arcTrayLabels,
    arcFilledCount,
  ]);

  const { sendText, isAudioPlaying } = useLuminaAI({
    primitiveType: 'story-planner',
    instanceId: instanceId || `story-planner-${title}`,
    primitiveData: aiPrimitiveData,
    gradeLevel: isPictureBand ? 'kindergarten' : 'elementary',
  });

  // `silent` suppresses only the chat-transcript entry — the tutor still speaks.
  const readAloud = useCallback((text: string) => {
    if (!text) return;
    sendText(
      `[STORY_PLAN_READ_ALOUD] The learner tapped "read it to me" and cannot read the screen. `
      + `Read this aloud, word for word, warmly and slowly: "${text}". Then wait.`,
      { silent: true },
    );
  }, [sendText]);

  // ORIENT + STIMULUS. At the picture band the writing prompt is a sentence a
  // non-reader cannot decode, so the tutor reading it IS the stimulus channel;
  // the same beat asks the first question and names the three pictures, because
  // the tutor's voice is the only thing that carries the option labels.
  const askedRef = useRef<Record<string, boolean>>({});
  const orientedRef = useRef(false);
  useEffect(() => {
    if (!pickMode || currentPhase !== 'plan') return;
    const elem = choiceElements[elementIdx];
    if (!elem || askedRef.current[elem.elementId]) return;
    askedRef.current[elem.elementId] = true;
    const preamble = orientedRef.current
      ? ''
      : `A young child who cannot read any words is planning a story called "${title}". `
        + `First read them the story idea aloud, word for word: "${writingPrompt}". `
        + `Reading it aloud IS your greeting — this OVERRIDES any instruction to keep it to one sentence. `;
    orientedRef.current = true;
    sendText(
      `[STORY_ELEMENT_ASKED] ${preamble}Now ask them out loud: "${elem.prompt}" `
      + `Then say the three pictures they can pick: ${elem.options.map(o => o.label).join(', ')}. `
      + `Tell them to tap the one they like best. Every one is a good answer — there is no wrong pick. Then wait.`,
      { silent: true },
    );
  }, [pickMode, currentPhase, elementIdx, choiceElements, sendText, title, writingPrompt]);

  // ORIENT for the free-text band (grades 2+), which has no per-element screens.
  useEffect(() => {
    if (pickMode || orientedRef.current) return;
    orientedRef.current = true;
    sendText(
      `[STORY_PLAN_ORIENT] A student is planning a story called "${title}". `
      + `The writing prompt is: "${writingPrompt}". They fill in planning cards, then map out the story arc. `
      + `Welcome them and point them at the first card. Do not plan the story for them.`,
      { silent: true },
    );
  }, [pickMode, sendText, title, writingPrompt]);

  const arcAnnouncedRef = useRef(false);
  useEffect(() => {
    if (!orderMode || currentPhase !== 'arc' || arcAnnouncedRef.current) return;
    arcAnnouncedRef.current = true;
    sendText(
      `[STORY_ARC_STARTED] The child now has ${arcTray.length} picture cards showing things that happen `
      + `in their story: ${arcTrayLabels}. They tap them to put them in order, from what happens FIRST at the `
      + `top to what happens LAST at the bottom. Say what to do in one warm sentence, and describe each card `
      + `out loud so they know what the pictures are. NEVER tell them which card goes where.`,
      { silent: true },
    );
  }, [orderMode, currentPhase, arcTray.length, arcTrayLabels, sendText]);

  // Phase nav
  const phases: PlannerPhase[] = ['plan', 'arc', 'review'];
  const phaseLabels: Record<PlannerPhase, string> = { plan: 'Plan Elements', arc: 'Story Arc', review: 'Review' };

  const nextPhase = () => {
    const idx = phases.indexOf(currentPhase);
    if (idx < phases.length - 1) {
      SoundManager.navigate();
      setCurrentPhase(phases[idx + 1]);
    }
  };
  const prevPhase = () => {
    const idx = phases.indexOf(currentPhase);
    if (idx > 0) {
      SoundManager.navigate();
      setCurrentPhase(phases[idx - 1]);
    }
  };

  // ── Picture-band interactions ─────────────────────────────────────────────
  // Tap = choose: one tap records the pick AND moves on. No confirm step.
  const chooseOption = useCallback((elemId: string, elemLabel: string, opt: PictureOption) => {
    SoundManager.select();
    setElementTexts(prev => ({ ...prev, [elemId]: opt.raw }));
    sendText(
      `[STORY_ELEMENT_CHOSEN] The child picked "${opt.label}" for the ${elemLabel} of their story. `
      + `Say it back to them warmly in a few words so they know you heard. Do not ask a follow-up question.`,
      { silent: true },
    );
    if (elementIdx < choiceElements.length - 1) setElementIdx(i => i + 1);
    else setCurrentPhase('arc');
  }, [sendText, elementIdx, choiceElements.length]);

  // One tap drops the card into the next empty slot (the life-cycle-sequencer
  // shape). The next slot is read from the CURRENT render's state, never
  // computed inside a setState updater.
  const placeEvent = useCallback((raw: string) => {
    const nextSlot = storyArcLabels.find(l => !(arcTexts[l] || '').trim());
    if (!nextSlot) return;
    SoundManager.snap();
    setArcTexts(prev => ({ ...prev, [nextSlot]: raw }));
    sendText(
      `[STORY_EVENT_PLACED] The child put the "${splitPictureOption(raw).label}" picture into part `
      + `${storyArcLabels.indexOf(nextSlot) + 1} of their story. Say what they placed in a few warm words. `
      + `NEVER say whether it is in the right place and never hint at the correct order.`,
      { silent: true },
    );
  }, [storyArcLabels, arcTexts, sendText]);

  const unplaceSlot = useCallback((label: string) => {
    if (hasSubmittedEvaluation) return;
    SoundManager.pop();
    setArcTexts(prev => {
      const next = { ...prev };
      delete next[label];
      return next;
    });
  }, [hasSubmittedEvaluation]);

  const placedSet = useMemo(
    () => new Set(storyArcLabels.map(l => arcTexts[l]).filter(Boolean)),
    [storyArcLabels, arcTexts],
  );
  const arcComplete = orderMode && arcFilledCount === storyArcLabels.length;

  // Metrics calculation
  const calculateMetrics = useCallback(() => {
    const requiredElements = elements.filter(e => e.required);
    const filledRequired = requiredElements.filter(e => (elementTexts[e.elementId] || '').trim().length > 5).length;
    const totalFilled = elements.filter(e => (elementTexts[e.elementId] || '').trim().length > 5).length;
    const eventCount = storyArcLabels.filter(label => (arcTexts[label] || '').trim().length > 5).length;

    // Character depth
    const charElement = elements.find(e => e.label.toLowerCase().includes('character'));
    const charText = charElement ? (elementTexts[charElement.elementId] || '') : '';
    const hasTraits = charText.length > 20;
    const characterDepth: 'deep' | 'moderate' | 'surface' = hasTraits && charText.length > 50 ? 'deep' : hasTraits ? 'moderate' : 'surface';

    // Conflict
    const conflictIdentified = !!selectedConflict || elements.some(e =>
      e.label.toLowerCase().includes('problem') && (elementTexts[e.elementId] || '').trim().length > 5
    );

    // Resolution connects to conflict
    const resolutionArc = arcTexts[storyArcLabels[storyArcLabels.length - 1]] || '';
    const resolutionConnects = resolutionArc.trim().length > 10;

    // Descriptive language (simple count of adjective-like patterns)
    const allText = [...Object.values(elementTexts), ...Object.values(arcTexts)].join(' ');
    const descriptiveCount = (allText.match(/\b(beautiful|bright|dark|cold|warm|soft|loud|quiet|huge|tiny|sparkling|mysterious|ancient|colorful|gentle|fierce|smooth|rough)\b/gi) || []).length;

    return {
      elementsPlanned: totalFilled,
      elementsRequired: requiredElements.length,
      characterDepth,
      eventCount,
      conflictIdentified,
      resolutionConnectsToConflict: resolutionConnects,
      descriptiveLanguageUsed: descriptiveCount,
      filledRequired,
    };
  }, [elements, elementTexts, arcTexts, storyArcLabels, selectedConflict]);

  /** How many arc cards sit in the slot they actually belong to. */
  const arcSlotsCorrect = useMemo(() => {
    if (!orderMode || !arcEvents) return 0;
    return storyArcLabels.filter((label, i) => arcTexts[label] === arcEvents[i]).length;
  }, [orderMode, arcEvents, storyArcLabels, arcTexts]);

  // Submit
  const submitFinalEvaluation = useCallback(() => {
    if (hasSubmittedEvaluation) return;
    const m = calculateMetrics();

    let score: number;
    if (pickMode || orderMode) {
      // Picture band: the INSTRUMENT is the measure. Choosing a card always
      // clears the old `length > 5` text checks, so those prove nothing here —
      // what is actually assessed is whether the plan is complete and whether
      // the events are in story order. That is stricter than what it replaces.
      const chosen = elements.filter(e => (elementTexts[e.elementId] || '').trim()).length;
      const planScore = elements.length > 0 ? (chosen / elements.length) * 40 : 40;
      const orderScore = orderMode && storyArcLabels.length > 0
        ? (arcSlotsCorrect / storyArcLabels.length) * 60
        : 60;
      score = Math.round(planScore + orderScore);
    } else {
      // Score: elements (30%) + arc events (30%) + conflict (20%) + resolution (10%) + descriptive (10%)
      const elemScore = m.elementsRequired > 0 ? Math.round((m.filledRequired / m.elementsRequired) * 30) : 30;
      const arcScore = storyArcLabels.length > 0 ? Math.round((m.eventCount / storyArcLabels.length) * 30) : 30;
      const conflictScore = m.conflictIdentified ? 20 : 0;
      const resScore = m.resolutionConnectsToConflict ? 10 : 0;
      const descScore = Math.min(10, m.descriptiveLanguageUsed * 3);
      score = elemScore + arcScore + conflictScore + resScore + descScore;
    }

    const metrics: StoryPlannerMetrics = {
      type: 'story-planner',
      elementsPlanned: m.elementsPlanned,
      elementsRequired: m.elementsRequired,
      characterDepth: m.characterDepth,
      eventCount: m.eventCount,
      conflictIdentified: m.conflictIdentified,
      resolutionConnectsToConflict: m.resolutionConnectsToConflict,
      descriptiveLanguageUsed: m.descriptiveLanguageUsed,
    };

    if (pickMode || orderMode) {
      SoundManager.playPerfect();
      sendText(
        `[STORY_PLAN_COMPLETE] The child finished planning. Their story is: ${chosenSummary}. `
        + `Tell their story back to them out loud as one or two happy sentences, using their own picks, `
        + `then tell them what a good storyteller they are. Do not correct the order of anything.`,
        { silent: true },
      );
    }

    submitEvaluation(score >= 50, score, metrics, { elementTexts, arcTexts, selectedConflict });
  }, [
    hasSubmittedEvaluation, calculateMetrics, storyArcLabels, submitEvaluation,
    elementTexts, arcTexts, selectedConflict, pickMode, orderMode, elements,
    arcSlotsCorrect, sendText, chosenSummary,
  ]);

  // Render progress — adult wayfinding chrome; hidden at the picture band.
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

  // Arc band tints — interaction-surface visuals for the story-arc compose board.
  const ARC_COLORS = ['bg-blue-500/15 border-blue-500/30', 'bg-amber-500/15 border-amber-500/30', 'bg-rose-500/15 border-rose-500/30', 'bg-amber-500/15 border-amber-500/30', 'bg-emerald-500/15 border-emerald-500/30'];

  const pictureCardClass =
    'flex flex-col items-center justify-center gap-2 rounded-2xl border border-white/15 bg-white/5 '
    + 'px-3 py-5 transition-all hover:bg-white/10 hover:scale-[1.03] active:scale-95 '
    + 'focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/60';

  return (
    <LuminaCard className={className}>
      <LuminaCardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <LuminaCardTitle className="text-lg">{title}</LuminaCardTitle>
            {/* Grade badge is developer/teacher chrome — never in the child's field. */}
            {!isPictureBand && <LuminaBadge className="text-xs">Grade {gradeLevel}</LuminaBadge>}
          </div>
          {isPictureBand && (
            <LuminaReadAloud
              iconOnly
              size="lg"
              accent="cyan"
              speaking={isAudioPlaying}
              aria-label="Tell me the story idea again"
              className="ml-3 flex-shrink-0"
              onClick={() => readAloud(writingPrompt)}
            />
          )}
        </div>
      </LuminaCardHeader>

      <LuminaCardContent className="space-y-4">
        {!isPictureBand && renderProgress()}

        {/* Writing prompt — a full sentence, so at the picture band it is spoken
            (ORIENT beat + the header read-aloud) rather than printed. */}
        {!isPictureBand && (
          <LuminaPanel className="p-3">
            <p className="text-xs text-slate-500 mb-1">Writing Prompt:</p>
            <p className="text-slate-200 text-sm font-medium">{writingPrompt}</p>
          </LuminaPanel>
        )}

        {/* ── Phase 1 (K-1): one question, three pictures, one tap ───────── */}
        {pickMode && currentPhase === 'plan' && currentElement && (
          <div className="space-y-4">
            <div className="flex items-center justify-center gap-3">
              <LuminaReadAloud
                size="lg"
                accent="cyan"
                label="Hear the question"
                speakingLabel="Listening…"
                speaking={isAudioPlaying}
                onClick={() => readAloud(currentElement.prompt)}
              />
            </div>
            <div className="grid grid-cols-3 gap-3">
              {currentElement.options.map(opt => (
                <button
                  key={opt.raw}
                  type="button"
                  aria-label={opt.label}
                  onClick={() => chooseOption(currentElement.elementId, currentElement.label, opt)}
                  className={pictureCardClass}
                >
                  <span className="text-5xl leading-none" aria-hidden>{opt.emoji || '⭐'}</span>
                  <span className="text-sm text-slate-200 text-center leading-tight">{opt.label}</span>
                </button>
              ))}
            </div>
            {elementIdx > 0 && (
              <div className="flex justify-start">
                <button
                  type="button"
                  aria-label="Go back to the picture before"
                  onClick={() => { SoundManager.navigate(); setElementIdx(i => Math.max(0, i - 1)); }}
                  className="text-3xl leading-none px-3 py-1 rounded-full hover:bg-white/10 active:scale-95"
                >
                  <span aria-hidden>⬅️</span>
                </button>
              </div>
            )}
          </div>
        )}

        {/* ── Phase 1 (grade 2+): the original free-text planner ──────────── */}
        {!pickMode && currentPhase === 'plan' && (
          <div className="space-y-3">
            {elements.map(elem => (
              <LuminaPanel key={elem.elementId} className="p-3 space-y-1.5">
                <div className="flex items-center gap-2">
                  <p className="text-xs font-bold text-slate-300">{elem.label}</p>
                  {elem.required && <span className="text-xs text-rose-400">*</span>}
                </div>
                <p className="text-xs text-slate-500">{elem.prompt}</p>
                {/* Compose surface — bespoke edit field */}
                <textarea
                  value={elementTexts[elem.elementId] || ''}
                  onChange={e => setElementTexts(prev => ({ ...prev, [elem.elementId]: e.target.value }))}
                  rows={2}
                  className="w-full px-3 py-2 rounded-lg border border-white/10 bg-white/5 text-slate-200 placeholder:text-slate-500 text-sm focus:outline-none focus:border-blue-500/40 resize-none"
                />
              </LuminaPanel>
            ))}

            {conflictTypes && conflictTypes.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-xs text-slate-500">Conflict type:</p>
                <div className="flex flex-wrap gap-1.5">
                  {conflictTypes.map(ct => (
                    <LuminaChip
                      key={ct}
                      state={selectedConflict === ct ? 'selected' : 'idle'}
                      onClick={() => { SoundManager.select(); setSelectedConflict(ct); }}
                      className="px-2 py-1 text-xs"
                    >
                      {ct}
                    </LuminaChip>
                  ))}
                </div>
              </div>
            )}

            <div className="flex justify-end">
              <LuminaButton tone="primary" onClick={nextPhase}
                disabled={elements.filter(e => e.required).every(e => !(elementTexts[e.elementId] || '').trim())}>
                Next: Story Arc
              </LuminaButton>
            </div>
          </div>
        )}

        {/* ── Phase 2 (K-1): put the pictures in story order ──────────────── */}
        {orderMode && currentPhase === 'arc' && (
          <div className="space-y-4">
            {/* The story so far — pictures only, not interactive. */}
            <div className="flex items-center justify-center gap-3">
              {elements.map(e => {
                const picked = splitPictureOption(elementTexts[e.elementId] || '');
                if (!picked.raw) return null;
                return (
                  <span key={e.elementId} className="text-3xl leading-none" title={picked.label} aria-hidden>
                    {picked.emoji || '⭐'}
                  </span>
                );
              })}
            </div>

            {/* Ordered slots. Numerals, not the generated arc labels — those are
                sentences at grade 1 and unreadable at both K and 1. */}
            <div className="space-y-2">
              {storyArcLabels.map((label, i) => {
                const placed = arcTexts[label];
                const card = placed ? splitPictureOption(placed) : null;
                const correct = hasSubmittedEvaluation && arcEvents ? placed === arcEvents[i] : null;
                const tint = correct === null
                  ? ARC_COLORS[i % ARC_COLORS.length]
                  : correct
                    ? 'bg-emerald-500/20 border-emerald-500/50'
                    : 'bg-amber-500/20 border-amber-500/50';
                return (
                  <div key={label} className="flex items-center gap-3">
                    <span className="text-2xl font-bold text-slate-400 w-6 text-center" aria-hidden>{i + 1}</span>
                    {card ? (
                      <button
                        type="button"
                        aria-label={`${card.label} — tap to take it back out`}
                        onClick={() => unplaceSlot(label)}
                        className={`flex-1 flex items-center gap-3 rounded-xl border p-3 text-left transition-all active:scale-95 ${tint}`}
                      >
                        <span className="text-3xl leading-none" aria-hidden>{card.emoji || '⭐'}</span>
                        <span className="text-sm text-slate-200">{card.label}</span>
                        {correct === true && <span className="ml-auto text-xl" aria-hidden>✅</span>}
                      </button>
                    ) : (
                      <div className="flex-1 rounded-xl border border-dashed border-white/15 bg-white/[0.02] p-3 h-[58px]" />
                    )}
                  </div>
                );
              })}
            </div>

            {/* Tray — cards not yet placed. */}
            <div className="flex flex-wrap items-stretch justify-center gap-3">
              {arcTray.filter(c => !placedSet.has(c)).map(c => {
                const card = splitPictureOption(c);
                return (
                  <button
                    key={c}
                    type="button"
                    aria-label={card.label}
                    onClick={() => placeEvent(c)}
                    className={`${pictureCardClass} w-32`}
                  >
                    <span className="text-4xl leading-none" aria-hidden>{card.emoji || '⭐'}</span>
                    <span className="text-xs text-slate-200 text-center leading-tight">{card.label}</span>
                  </button>
                );
              })}
            </div>

            {arcComplete && !hasSubmittedEvaluation && (
              <div className="flex justify-center">
                <LuminaButton tone="primary" size="lg" onClick={submitFinalEvaluation}>
                  <span aria-hidden className="mr-2">🎉</span>Finish
                </LuminaButton>
              </div>
            )}
            {hasSubmittedEvaluation && (
              <div className="flex flex-col items-center gap-3">
                <LuminaFeedbackCard status="correct" label="Your story is ready!" className="w-full" />
                <LuminaReadAloud
                  size="lg"
                  accent="cyan"
                  label="Tell me my story"
                  speakingLabel="Telling your story…"
                  speaking={isAudioPlaying}
                  onClick={() => sendText(
                    `[STORY_PLAN_COMPLETE] Tell the child their finished story back out loud, warmly, `
                    + `in one or two sentences using their own picks: ${chosenSummary}.`,
                    { silent: true },
                  )}
                />
              </div>
            )}
          </div>
        )}

        {/* ── Phase 2 (grade 2+): the original arc compose board ──────────── */}
        {!orderMode && currentPhase === 'arc' && (
          <div className="space-y-3">
            <p className="text-xs text-slate-500">Plan what happens at each part of your story:</p>
            {dialoguePrompt && (
              <LuminaPanel accent="purple" className="p-2">
                <p className="text-xs text-purple-300">{dialoguePrompt}</p>
              </LuminaPanel>
            )}
            {/* Story-arc compose board — bespoke edit surface */}
            <div className="space-y-2">
              {storyArcLabels.map((label, i) => (
                <div key={label} className={`rounded-lg border p-3 ${ARC_COLORS[i % ARC_COLORS.length]}`}>
                  <p className="text-xs font-bold text-slate-300 mb-1">{label}</p>
                  <textarea
                    value={arcTexts[label] || ''}
                    onChange={e => setArcTexts(prev => ({ ...prev, [label]: e.target.value }))}
                    placeholder={`What happens in the ${label.toLowerCase()}?`}
                    rows={2}
                    className="w-full px-3 py-2 rounded-lg border border-white/10 bg-black/20 text-slate-200 placeholder:text-slate-500 text-sm focus:outline-none focus:border-blue-500/40 resize-none"
                  />
                </div>
              ))}
            </div>
            <div className="flex justify-between">
              <LuminaButton onClick={prevPhase}>Back</LuminaButton>
              <LuminaButton tone="primary" onClick={nextPhase}
                disabled={!storyArcLabels.some(l => (arcTexts[l] || '').trim())}>
                Review
              </LuminaButton>
            </div>
          </div>
        )}

        {/* ── Phase 3 (grade 2+ only): review + story mountain ────────────── */}
        {currentPhase === 'review' && (
          <div className="space-y-4">
            {/* Elements summary */}
            <div className="grid gap-2 grid-cols-2">
              {elements.map(elem => (
                <LuminaPanel key={elem.elementId} className="p-2">
                  <p className="text-xs font-bold text-slate-400">{elem.label}</p>
                  <p className="text-xs text-slate-300 mt-0.5">{elementTexts[elem.elementId] || <span className="italic text-slate-600">Empty</span>}</p>
                </LuminaPanel>
              ))}
            </div>

            {/* Arc visualization — story-mountain compose board */}
            <div className="flex items-end gap-1" style={{ height: '80px' }}>
              {storyArcLabels.map((label, i) => {
                const heights = [30, 50, 80, 50, 35]; // story mountain shape
                const h = heights[i % heights.length];
                const filled = !!(arcTexts[label] || '').trim();
                return (
                  <div key={label} className="flex-1 flex flex-col items-center gap-1">
                    <div
                      className={`w-full rounded-t-lg border transition-all ${filled ? ARC_COLORS[i % ARC_COLORS.length] : 'bg-slate-700/20 border-slate-600/30'}`}
                      style={{ height: `${h}px` }}
                    />
                    <p className="text-[10px] text-slate-500 text-center">{label}</p>
                  </div>
                );
              })}
            </div>

            <div className="flex justify-between">
              <LuminaButton onClick={prevPhase}>Edit</LuminaButton>
              {!hasSubmittedEvaluation ? (
                <LuminaButton tone="primary" onClick={submitFinalEvaluation}>
                  Finish
                </LuminaButton>
              ) : (
                <LuminaFeedbackCard status="correct" label="Story Plan Complete!" className="w-full" />
              )}
            </div>
          </div>
        )}
      </LuminaCardContent>
    </LuminaCard>
  );
};

export default StoryPlanner;
