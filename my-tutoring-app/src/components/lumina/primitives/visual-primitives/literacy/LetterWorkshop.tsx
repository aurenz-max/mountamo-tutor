'use client';

import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Check, Eraser, ArrowRight } from 'lucide-react';
import {
  LuminaCard, LuminaCardHeader, LuminaCardTitle, LuminaCardDescription,
  LuminaCardContent, LuminaBadge, LuminaChallengeCounter, LuminaPrompt,
  LuminaButton, LuminaActionButton, LuminaFeedbackCard, LuminaReadAloud,
} from '../../../ui';
import { usePrimitiveEvaluation, type PrimitiveEvaluationResult } from '../../../evaluation';
import type { LetterWorkshopMetrics } from '../../../evaluation/types';
import { usePhaseResults } from '../../../hooks/usePhaseResults';
import { useLuminaAI } from '../../../hooks/useLuminaAI';
import PhaseSummaryPanel from '../../../components/PhaseSummaryPanel';
import {
  getLetterTemplate, pointsToPath, evaluateLetterTrace, evaluateLetterFormation, TRACE_TOLERANCES, FORMATION_TOLERANCES,
  type TraceStroke, type TracePoint, type TraceAssessment,
} from './letterWorkshopGeometry';

import { LETTER_WORKSHOP_MODES, LETTER_WORKSHOP_MODE_INFO, isLetterWorkshopMode, type LetterWorkshopMode } from './letterWorkshopModes';
import { resolveSupportStructure, normalizeSupportTier, type SupportTier, type letterStructure } from './letterWorkshopDifficulty';
import { useLetterWorkshopCue } from './useLetterWorkshopCue';
import { judgeLetterDrawing, judgeAcceptsLetter, renderLetterInkForJudge, LETTER_JUDGE_VERSION, type LetterEvaluationResult } from './letterWorkshopJudge';
import { usePipSurface, usePipTargets } from '../../../pip/PipSurfaceContext';
import { letterWorkshopPipPose } from '../../../pip/letterWorkshopPipPose';
import { useSpeechScope } from '../../../pip/useSpeechScope';
import type { TeachingWorkspace } from '../../../components/live-activity/runtime/useTeachingWorkspace';
import { withWorkspaceController } from '../../../components/live-activity/runtime/withTeachingWorkspace';
import { useScriptedProgress, useWorkspaceProgressFor, type Progress, type ProgressOptions }
  from '../../../components/live-activity/runtime/useWorkspaceProgress';
import { describeWriting, letterWorkshopMiss, templateOf, workspaceAssignment, workspaceScene } from './letterWorkshopWorkspace';
import {
  ARROWS_LEVER, DOTS_LEVER, FIRST_PART_LEVER, LINES_LEVER, MODEL_STROKES_LEVER, PRACTICE_NOTE,
  firstPart, letterWorkshopLevers, leverFacts, practiceItem, startDots, startingLevers,
} from './letterWorkshopLevers';

export interface LetterWorkshopChallenge {
  id: string;
  type: LetterWorkshopMode;
  /** References code-owned geometry; the model never invents letter strokes. */
  templateId: string;
  supportTier?: SupportTier;
  /** A practice item a simplify lever opened (`letterWorkshopLevers.ts`): one part of the letter, checked by geometry alone. */
  part?: boolean;
  support?: ReturnType<typeof resolveSupportStructure>;
  structure?: ReturnType<typeof letterStructure>;
}

export interface LetterWorkshopData {
  title: string;
  description: string;
  gradeLevel: string;
  challengeType: LetterWorkshopMode;
  challenges: LetterWorkshopChallenge[];
  instanceId?: string;
  skillId?: string;
  subskillId?: string;
  objectiveId?: string;
  exhibitId?: string;
  componentIntent?: string;
  objectiveText?: string;
  onEvaluationSubmit?: (result: PrimitiveEvaluationResult<LetterWorkshopMetrics>) => void;
}

interface TraceAttempt {
  challengeId: string;
  templateId: string;
  type: LetterWorkshopMode;
  assistance: 'trace-guide' | 'beside-model' | 'auditory-cue';
  modelPreviouslySeen: boolean;
  cuePlays: number;
  scorerVersion: string;
  hintLevel: number;
  supportTier: SupportTier | null;
  templateVersion: 'school-manuscript-v1';
  disposition: 'submitted' | 'cleared';
  strokes: TraceStroke[];
  assessment: TraceAssessment | null;
  /** Gemini's reading of a copy/write attempt the geometric check failed; null when it was not asked or did not answer. */
  visionJudge: (LetterEvaluationResult & { version: string; accepted: boolean }) | null;
}

const PHASES = Object.fromEntries(LETTER_WORKSHOP_MODES.map(mode => [mode, { label: LETTER_WORKSHOP_MODE_INFO[mode].label, accentColor: 'cyan' as const }]));
const challengeId = (challenge: LetterWorkshopChallenge) => challenge.id;
const challengeType = (challenge: LetterWorkshopChallenge) => challenge.type;

interface LetterWorkshopProps {
  data: LetterWorkshopData;
  /** The lesson's pinned mode; the workspace pin reads it (`withWorkspaceController`). */
  runtimeEvalMode?: string;
  runtimePlanItemId?: string;
}
type Controlled = { tutorOwned: boolean; useController: (options: ProgressOptions<LetterWorkshopChallenge>) => Progress };

/** A new payload gets a new session, including the evaluation hook's submission guard. */
function LetterWorkshopSurface({ data, runtimePlanItemId, tutorOwned, useController }: LetterWorkshopProps & Controlled) {
  const payloadRef = useRef({ challenges: data.challenges, revision: 0 });
  if (payloadRef.current.challenges !== data.challenges) {
    payloadRef.current = { challenges: data.challenges, revision: payloadRef.current.revision + 1 };
  }
  const sessionKey = `${data.instanceId ?? 'workshop'}:${payloadRef.current.revision}:${JSON.stringify(data.challenges)}`;
  const valid = isLetterWorkshopMode(data.challengeType) && Array.isArray(data.challenges)
    && data.challenges.length > 0 && new Set(data.challenges.map(challengeId)).size === data.challenges.length
    && data.challenges.every(challenge => {
      try { return Boolean(challenge.id && isLetterWorkshopMode(challenge.type) && getLetterTemplate(challenge.templateId)); }
      catch { return false; }
    });
  if (!valid) return <LuminaFeedbackCard status="insight">This writing activity needs a valid set of letter guides. Please generate it again.</LuminaFeedbackCard>;
  return <LetterWorkshopSession key={sessionKey} data={data} planItemId={runtimePlanItemId} tutorOwned={tutorOwned} useController={useController} />;
}

function LetterWorkshopSession({ data, planItemId, tutorOwned, useController }: { data: LetterWorkshopData; planItemId?: string } & Controlled) {
  const instanceRef = useRef(data.instanceId ?? `letter-workshop-${Date.now()}`);
  const workspace = useRef<TeachingWorkspace | null>(null);
  // On the workspace path the runtime moves the index; a fresh item and Try again both open a blank paper.
  // The model a write check revealed stays for Try again (keyed to the item).
  const progress = useController({ challenges: data.challenges, getChallengeId: challengeId,
    instanceId: instanceRef.current, objectiveId: data.objectiveId, planItemId, workspace, assignment: workspaceAssignment,
    onItemOpened: (_index, retry) => {
      clearPaper();
      // Try again keeps a practice item open; a fresh item, or the full item back after practice, closes it.
      if (!retry) setPractice(null);
    } });
  /** Workspace path: a checked writing stays closed until Try again or Next challenge on the shell. */
  const learnerBlocked = () => tutorOwned && progress.canAttempt === false;
  const blocked = learnerBlocked();
  const sessionChallenge = data.challenges[progress.currentIndex];
  // Levers (letterWorkshopLevers.ts): the tutor's pulls on the session item, and the easier item a simplify lever opened.
  const [leverState, setLeverState] = useState<{ item: string; pulled: string[] }>({ item: '', pulled: [] });
  const [practice, setPractice] = useState<LetterWorkshopChallenge | null>(null);
  /** The item on the paper: an easier practice item in place of the session item while one is open. */
  const current = practice ?? sessionChallenge;
  /** The strokes the paper draws and checks (a practice item's part of the letter). */
  const template = templateOf(current);
  const mode = current.type;
  const modeInfo = LETTER_WORKSHOP_MODE_INFO[mode];
  const supportTier = normalizeSupportTier(current.supportTier);
  const support = resolveSupportStructure(mode, supportTier);
  /** Help levers in force on the session item: where its tier started them, plus the tutor's pulls. None on a practice item. */
  const runtimePulled = !practice && leverState.item === sessionChallenge.id ? leverState.pulled : [];
  const leversOn = practice ? [] : Array.from(new Set([...startingLevers(sessionChallenge, support), ...runtimePulled]));
  const on = (id: string) => leversOn.includes(id);
  /** What the paper and the model show: the tier's guides, plus the help levers in force. */
  const guides = { starts: mode === 'trace' ? support.showStarts || on(DOTS_LEVER) : on(DOTS_LEVER),
    arrows: mode === 'trace' && (support.showArrows || on(ARROWS_LEVER)), lines: support.showLineLabels || on(LINES_LEVER),
    modelStrokes: mode === 'copy' && on(MODEL_STROKES_LEVER), firstPart: mode === 'write' && on(FIRST_PART_LEVER) };
  const localOnly = data.challenges.some(ch => ch.type !== 'trace');
  const cue = useLetterWorkshopCue(current.id, template.letter, template.letterCase);
  const exposedTemplates = useRef(new Set<string>());
  // The models a write check revealed, by item: one stays for Try again and for the item's return after practice.
  const [revealed, setRevealed] = useState<string[]>([]);
  const modelRevealed = revealed.includes(current.id);
  const [strokes, setStrokes] = useState<TraceStroke[]>([]);
  const strokesRef = useRef<TraceStroke[]>([]);
  const [assessment, setAssessment] = useState<TraceAssessment | null>(null);
  const assessmentRef = useRef<TraceAssessment | null>(null);
  const [drawing, setDrawing] = useState(false);
  const pointerRef = useRef<number | null>(null);
  const evidenceRef = useRef<TraceAttempt[]>([]);
  const submittedRef = useRef(false);
  const advancingRef = useRef(false);
  const introducedRef = useRef<string | null>(null);
  const [hintLevel, setHintLevel] = useState(0);
  const [hintsViewed, setHintsViewed] = useState(0);
  const [judging, setJudging] = useState(false);
  const judgingRef = useRef(false);
  const mountedRef = useRef(true);
  useEffect(() => { mountedRef.current = true; return () => { mountedRef.current = false; }; }, []);
  const cuedRef = useRef<string | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const { submitResult, elapsedMs } = usePrimitiveEvaluation<LetterWorkshopMetrics>({
    primitiveType: 'letter-workshop', instanceId: instanceRef.current, localOnly,
    skillId: data.skillId, subskillId: data.subskillId, objectiveId: data.objectiveId,
    exhibitId: data.exhibitId, componentIntent: data.componentIntent,
    objectiveText: data.objectiveText, onSubmit: data.onEvaluationSubmit,
  });
  const phases = usePhaseResults({ challenges: data.challenges, results: progress.results,
    isComplete: progress.isComplete, getChallengeType: challengeType, phaseConfig: PHASES });
  const part = current.part ? 'the first part of ' : '';
  const prompt = mode === 'trace' ? `Trace ${part}${template.letterCase} ${template.letter}. ${guides.arrows ? 'Start at each numbered dot and follow the arrows.' : guides.starts ? 'Start at each numbered dot and trace the path.' : 'Follow the letter path.'}`
    : mode === 'copy' ? `Copy ${part}${template.letterCase} ${template.letter} beside the model. Use the writing lines.`
    : 'Listen, then write the letter on the lines.';
  const aiData = useMemo(() => ({
    // Explicit sentinels overwrite prior targets in the tutor's merged context.
    letter: mode === 'write' ? 'withheld' : template.letter,
    letterCase: mode === 'write' ? 'withheld' : template.letterCase,
    supportTier: supportTier ?? 'default', showStarts: support.showStarts, showArrows: support.showArrows,
    showLineLabels: support.showLineLabels, showChecklist: support.showChecklist,
    challengeType: mode, assistance: modelRevealed ? 'beside-model' : modeInfo.assistance,
    challengeNumber: progress.currentIndex + 1, totalChallenges: data.challenges.length,
    instruction: prompt, feedback: assessment?.feedback ?? 'No submitted feedback yet',
    feedbackFocus: !assessment ? 'none' : assessment.passed ? 'matched' : !assessment.strokeCountMatch ? 'stroke-count'
      : assessment.startAccuracy < 1 ? 'start-or-order' : assessment.coverage < 0.8 ? 'incomplete-path'
      : assessment.precision < 0.85 ? 'extra-or-off-path-ink' : 'direction-or-shape',
    interactionState: progress.isComplete ? 'complete' : drawing ? 'drawing' : assessment ? 'feedback' : 'ready',
    cueState: mode === 'write' ? cue.state : 'not-required',
    modelVisible: mode !== 'write' || modelRevealed,
    attemptCount: progress.currentAttempts, hintLevel,
    assessmentScope: localOnly ? 'provisional-geometric-formation' : 'provisional-geometric-tracing',
  }), [template, mode, modeInfo.assistance, modelRevealed, progress.currentIndex, data.challenges.length,
    prompt, assessment, progress.isComplete, drawing, cue.state, progress.currentAttempts, hintLevel, localOnly, supportTier, support.showStarts, support.showArrows, support.showLineLabels, support.showChecklist]);
  // The workspace packet replaces this context (it carries the letter), and its scripted turns.
  const { sendText, requestHint, isConnected, isAudioPlaying, isAIResponding, sessionMode, activePrimitiveId } = useLuminaAI({ primitiveType: 'letter-workshop',
    instanceId: instanceRef.current, primitiveData: aiData, gradeLevel: data.gradeLevel, enabled: !tutorOwned });
  /** The scripted tutor: every cue, introduction and feedback turn below sends only through it, so none on the workspace path. */
  const tutorActive = !tutorOwned && isConnected && (sessionMode !== 'lesson' || activePrimitiveId === instanceRef.current);
  /** Write: the paper opens after the spoken cue; on the workspace path the tutor says the name as the task. */
  const cueReady = tutorOwned || cue.state === 'ready';

  // ── Write cue: the live tutor says the letter name ──────────────────────
  const { observeAudio, play: playCue } = cue;
  useEffect(() => { observeAudio(isAudioPlaying); }, [isAudioPlaying, observeAudio]);
  // Scripted: the cue holds every word to speak, so the backend must not prepend
  // its [CURRENT STATE] block, which the Live model tends to read aloud.
  const speakLetterName = useCallback(() => playCue(tutorActive ? text => sendText(text, { silent: true, scripted: true }) : null),
    [playCue, tutorActive, sendText]);
  // Each write item says its letter once the tutor is free; the button replays it.
  useEffect(() => {
    if (mode !== 'write' || !tutorActive || progress.isComplete || cuedRef.current === current.id) return;
    if (isAudioPlaying || isAIResponding || cue.state !== 'idle') return;
    cuedRef.current = current.id;
    speakLetterName();
  }, [mode, tutorActive, progress.isComplete, current.id, isAudioPlaying, isAIResponding, cue.state, speakLetterName]);

  // ── Pip shared surface ──────────────────────────────────────────────────
  // A projection of this letter's check state, the spoken cue, and the child's
  // ink; Pip never draws, checks, or advances. Tutor audio counts only while the
  // tutor is on this block; the tutor's letter-name cue is scoped to this item.
  const pip = usePipTargets(current.id, false);
  const tutorAudio = isAudioPlaying && activePrimitiveId === instanceRef.current;
  const speechOnItem = useSpeechScope(current.id, tutorAudio);
  const pipPaper = pip.ref('paper');
  const paperRef = useCallback((element: SVGSVGElement | null) => {
    (svgRef as React.MutableRefObject<SVGSVGElement | null>).current = element;
    pipPaper(element);
  }, [pipPaper]);
  const pipStore = usePipSurface(() => {
    if (!pip.dock.current || progress.isComplete) return null;
    const targets = pip.targets(['paper'], () => 'The writing paper');
    const pose = letterWorkshopPipPose({
      running: true, preparing: false, currentSolved: !!assessment?.passed, revealHeld: false, judging: false,
      tutorSpeaking: tutorAudio || cue.state === 'speaking', cueMatchesItem: !tutorAudio || speechOnItem,
      visibleIds: targets.map((target) => target.id), hasInk: strokes.length > 0,
    });
    return { instanceId: instanceRef.current, scopeId: current.id, label: 'Letter workshop', dock: pip.dock.current, targets, pose };
  });

  useEffect(() => {
    strokesRef.current = [];
    setStrokes([]);
    assessmentRef.current = null;
    setAssessment(null);
    pointerRef.current = null;
    setDrawing(false);
    advancingRef.current = false;
    setHintLevel(0);
    if (current.type !== 'write') exposedTemplates.current.add(current.templateId);
  }, [current.id, current.type, current.templateId]);

  useEffect(() => {
    if (!tutorActive || progress.isComplete || introducedRef.current === current.id) return;
    // A late connection must not start an introduction over existing handwriting.
    introducedRef.current = current.id;
    if (drawing || strokesRef.current.length || mode === 'write') return;
    const tag = progress.currentIndex === 0 ? '[ACTIVITY_START]' : '[NEXT_ITEM]';
    sendText(`${tag} Item ${progress.currentIndex + 1} of ${data.challenges.length}; ${modeInfo.label}; support tier ${supportTier ?? 'default'}. Do not restore hidden starts/arrows or dictate strokes. Say briefly: ${prompt} Then wait quietly for the child to draw.`, { silent: true });
  }, [tutorActive, progress.isComplete, current.id, drawing, mode, progress.currentIndex, data.challenges.length, modeInfo.label, supportTier, prompt, sendText]);

  useEffect(() => {
    if (!progress.isComplete || submittedRef.current) return;
    submittedRef.current = true;
    // The live host has no evaluation provider; a workspace family submits only under one.
    if (progress.recordsEvaluation === false) return;
    const correctCount = progress.results.filter(result => result.correct).length;
    const attemptsCount = progress.results.reduce((sum, result) => sum + result.attempts, 0);
    const overallAccuracy = Math.round(100 * correctCount / data.challenges.length);
    submitResult(correctCount === data.challenges.length, overallAccuracy, {
      type: 'letter-workshop', challengeType: new Set(data.challenges.map(ch => ch.type)).size === 1 ? data.challenges[0].type : 'mixed', totalChallenges: data.challenges.length,
      assessmentScope: localOnly ? 'provisional-geometric-formation' : 'provisional-geometric-tracing',
      modeResults: LETTER_WORKSHOP_MODES.filter(mode => data.challenges.some(ch => ch.type === mode)).map(mode => {
        const ids = new Set(data.challenges.filter(ch => ch.type === mode).map(ch => ch.id));
        return { mode, total: ids.size, correct: progress.results.filter(result => ids.has(result.challengeId) && result.correct).length };
      }),
      correctCount, attemptsCount,
      firstTryCount: progress.results.filter(result => result.correct && result.attempts === 1).length,
      hintsViewed, overallAccuracy, averageAttemptsPerChallenge: attemptsCount / data.challenges.length,
    }, { assistance: localOnly ? 'per-attempt' : 'trace-guide', assessmentScope: localOnly ? 'provisional-geometric-formation' : 'provisional-geometric-tracing',
      localOnly, tolerances: { trace: TRACE_TOLERANCES, formation: FORMATION_TOLERANCES }, attempts: evidenceRef.current });
    if (tutorActive) sendText(`[ALL_COMPLETE] Letter practice finished: ${correctCount} of ${data.challenges.length} letters passed the practice checks. Encourage practice; do not claim handwriting mastery.`, { silent: true });
  }, [progress.isComplete, progress.results, progress.recordsEvaluation, data.challenges, localOnly, hintsViewed, tutorActive, submitResult, sendText]);

  function coordinate(event: React.PointerEvent<SVGSVGElement>): TracePoint | null {
    const matrix = event.currentTarget.getScreenCTM();
    if (!matrix) return null;
    const point = event.currentTarget.createSVGPoint();
    point.x = event.clientX;
    point.y = event.clientY;
    const local = point.matrixTransform(matrix.inverse());
    return { x: local.x, y: local.y, t: event.timeStamp };
  }

  function releasePointer() {
    const id = pointerRef.current;
    pointerRef.current = null;
    setDrawing(false);
    if (id !== null && svgRef.current?.hasPointerCapture(id)) svgRef.current.releasePointerCapture(id);
  }

  function drawStart(event: React.PointerEvent<SVGSVGElement>) {
    if ((mode === 'write' && !cueReady) || learnerBlocked() || assessmentRef.current || judgingRef.current || advancingRef.current || pointerRef.current !== null || event.button !== 0 || !event.isPrimary) return;
    const point = coordinate(event);
    if (!point) return;
    event.preventDefault();
    pointerRef.current = event.pointerId;
    event.currentTarget.setPointerCapture(event.pointerId);
    strokesRef.current = [...strokesRef.current, { points: [point], pointerType: event.pointerType }];
    setStrokes(strokesRef.current);
    setDrawing(true);
  }

  function drawMove(event: React.PointerEvent<SVGSVGElement>) {
    if (pointerRef.current !== event.pointerId) return;
    const point = coordinate(event);
    if (!point) return;
    const previous = strokesRef.current;
    const active = previous[previous.length - 1];
    const last = active.points[active.points.length - 1];
    if (Math.hypot(point.x - last.x, point.y - last.y) < 0.8) return;
    // Finish a very long stroke instead of silently dropping its off-path ink.
    if (active.points.length >= 12000) { releasePointer(); return; }
    strokesRef.current = [...previous.slice(0, -1), { ...active, points: [...active.points, point] }];
    setStrokes(strokesRef.current);
  }

  function drawEnd(event: React.PointerEvent<SVGSVGElement>) {
    if (pointerRef.current !== event.pointerId) return;
    drawMove(event);
    releasePointer();
  }

  /** A blank paper: no ink, no feedback (a fresh item, Try again, a practice item opening or closing). */
  function clearPaper() {
    strokesRef.current = []; setStrokes([]); assessmentRef.current = null; setAssessment(null);
    pointerRef.current = null; setDrawing(false);
  }

  function saveAttempt(disposition: TraceAttempt['disposition'], result: TraceAssessment | null, visionJudge: TraceAttempt['visionJudge'] = null) {
    // A practice item (a simplify lever's easier item) is ungraded: it adds nothing to the evidence ledger.
    if (!practice) evidenceRef.current.push({ challengeId: current.id, templateId: current.templateId,
      type: mode, assistance: modelRevealed ? 'beside-model' : modeInfo.assistance, disposition,
      modelPreviouslySeen: exposedTemplates.current.has(current.templateId), cuePlays: cue.plays,
      scorerVersion: mode === 'trace' ? TRACE_TOLERANCES.version : FORMATION_TOLERANCES.version, templateVersion: 'school-manuscript-v1', hintLevel, supportTier,
      strokes: strokesRef.current.map(stroke => ({ ...stroke, points: stroke.points.map(point => ({ ...point })) })),
      assessment: result, visionJudge });
    // On the workspace path a checked attempt is the checked gesture. The scripted path keeps its own books: the
    // learner reads the feedback and presses Next letter, which records the result (a commit would complete early).
    if (!result || !tutorOwned) { progress.incrementAttempts(); return; }
    const writtenAs = visionJudge && visionJudge.confidence >= 60 ? visionJudge.writtenAs : null;
    progress.commitCheck(describeWriting(strokesRef.current.length, writtenAs, result.feedback), result.passed,
      result.passed ? undefined : letterWorkshopMiss(current, { assessment: result, writtenAs }));
  }

  function clear() {
    if (pointerRef.current !== null || advancingRef.current || judgingRef.current || learnerBlocked()) return;
    if (strokesRef.current.length && !assessmentRef.current) saveAttempt('cleared', null);
    strokesRef.current = [];
    setStrokes([]);
    assessmentRef.current = null;
    setAssessment(null);
  }

  async function check() {
    if (pointerRef.current !== null || assessmentRef.current || judgingRef.current || !strokesRef.current.length || advancingRef.current) return;
    if ((mode === 'write' && !cueReady) || learnerBlocked()) return;
    const rawResult = mode === 'trace' ? evaluateLetterTrace(template, strokesRef.current) : evaluateLetterFormation(template, strokesRef.current);
    let result = mode === 'trace' && !guides.arrows && !rawResult.passed
      ? { ...rawResult, correctionPoint: guides.starts ? rawResult.correctionPoint : undefined,
          feedback: guides.starts ? 'Compare your trace with the whole path. Start at each numbered dot and try again.' : 'Compare your marks with the whole letter path. Try tracing it again.' }
      : rawResult;
    // The formation check compares against ONE template, so a real letter made
    // another way (one continuous stroke, a narrower bowl) fails it. Copy/write
    // then ask Gemini whether the child wrote the letter, as NumberTracer does.
    // Trace keeps geometry: its task is following this path from these starts.
    let visionJudge: TraceAttempt['visionJudge'] = null;
    // No image (no 2D canvas) means no judge: the geometric verdict stands, with no wait.
    // A part of a letter is no letter the judge can read: geometry decides it alone.
    const image = !result.passed && mode !== 'trace' && !current.part ? renderLetterInkForJudge(strokesRef.current) : '';
    if (image) {
      judgingRef.current = true; setJudging(true);
      const verdict = await judgeLetterDrawing(strokesRef.current, template, mode, image);
      judgingRef.current = false;
      if (!mountedRef.current) return;
      setJudging(false);
      const accepted = judgeAcceptsLetter(verdict, template);
      if (verdict) visionJudge = { ...verdict, version: LETTER_JUDGE_VERSION, accepted };
      // A rejection keeps the geometric tip unless the judge confidently read a
      // different letter; a "recognized" verdict we overrode would praise a miss.
      if (verdict?.feedback && (accepted || (verdict.confidence >= 60 && !verdict.recognized))) {
        result = { ...result, passed: accepted, feedback: verdict.feedback, correctionPoint: undefined };
      }
    }
    assessmentRef.current = result;
    setAssessment(result);
    saveAttempt('submitted', result, visionJudge);
    if (mode === 'write') { exposedTemplates.current.add(current.templateId); setRevealed(ids => ids.includes(current.id) ? ids : [...ids, current.id]); }
    if (tutorActive) sendText(`[${result.passed ? 'ANSWER_CORRECT' : 'ANSWER_INCORRECT'}] Item ${progress.currentIndex + 1}; ${modeInfo.label}; attempt ${progress.currentAttempts + 1}. Provisional feedback: ${result.feedback} Say that briefly without naming a hidden letter or claiming mastery.`, { silent: true });
  }

  function next() {
    const result = assessmentRef.current;
    if (!result || advancingRef.current || tutorOwned) return;
    advancingRef.current = true;
    cue.cancel();
    progress.recordResult({ challengeId: current.id, correct: result.passed,
      attempts: progress.currentAttempts, score: result.passed ? 100 : 0 });
    progress.advance();
  }

  // Workspace path: what the tutor and the observer are shown, republished every render. No demonstration, no marks.
  useLayoutEffect(() => {
    if (!tutorOwned || progress.isComplete) return;
    const scene = workspaceScene(current, { strokes: strokes.length, modelRevealed });
    // Levers belong to the session item; a practice item offers none. A starting guide (the tier's) shows as pulled.
    const levers = practice ? [] : letterWorkshopLevers(sessionChallenge, leversOn, data.challenges);
    const shown = practice ? undefined : leverFacts(sessionChallenge, leversOn);
    workspace.current = {
      ...scene,
      facts: { ...scene.facts, ...(shown ? { onScreen: `${scene.facts.onScreen} ${shown}` } : {}), ...(practice ? { practice: PRACTICE_NOTE } : {}) },
      // The vision judge is still reading a checked writing.
      readyForResponse: !judging,
      levers,
      pullLever: (id: string) => {
        const lever = levers.find(l => l.id === id);
        if (practice || !lever) return `No lever ${id} on this item.`;
        if (lever.pulled) return `${id} is already on the screen.`;
        const next = { item: sessionChallenge.id, pulled: [...runtimePulled, id] };
        if (lever.kind === 'simplify') {
          const easier = practiceItem(sessionChallenge, data.challenges);
          if (!easier) return 'There is no easier item for this one.';
          setLeverState(next); setPractice(easier); clearPaper();
          return { practice: workspaceAssignment(easier) };
        }
        setLeverState(next);
        return true as const;
      },
      endPractice: () => { setPractice(null); clearPaper(); },
    };
  });

  if (progress.isComplete) return <PhaseSummaryPanel phases={phases} durationMs={elapsedMs}
    heading={localOnly ? "Your letter practice" : "Your tracing practice"} celebrationMessage={localOnly ? "These are practice shape checks. Keep practicing your letter forms." : "You made your own marks. Keep practicing these letter paths."} />;

  return <LuminaCard>
    <LuminaCardHeader>
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <LuminaCardTitle>{mode === 'write' ? 'Letter Workshop' : data.title}</LuminaCardTitle>
        <LuminaBadge accent="cyan">{modeInfo.label}</LuminaBadge>
      </div>
      <LuminaCardDescription>{mode === 'write' ? 'Hear the name and make your own letter.' : mode === 'copy' ? 'Look at the model and make your own letter beside it.' : supportTier ? 'Make your own marks along the letter path.' : data.description}</LuminaCardDescription>
      <LuminaChallengeCounter current={progress.currentIndex + 1} total={data.challenges.length} />
    </LuminaCardHeader>
    <LuminaCardContent className="space-y-5">
      <div className="flex items-center gap-3">
        <LuminaPrompt className="flex-1">{prompt}</LuminaPrompt>
        {/* With the tutor on the workspace, the learner asks the tutor to say it again. */}
        {!tutorOwned && <LuminaReadAloud label={mode === 'write' ? 'Hear the letter name' : 'Read this to me'} speaking={cue.state === 'speaking'} aria-label={mode === 'write' ? 'Hear the letter name' : 'Hear the writing instruction'}
          disabled={drawing || judging || cue.state === 'speaking' || isAudioPlaying || !tutorActive} onClick={() => mode === 'write' ? speakLetterName() : sendText(`[READ_ALOUD] Say exactly: ${prompt}`, { silent: true })} />}
      </div>
      {mode === 'write' && !cueReady && <LuminaFeedbackCard status="insight" role="status">
        {cue.state === 'error' ? 'The letter name did not play. Tap Hear the letter name to try again.'
          : cue.state === 'speaking' ? 'Listen to the letter name.'
          : !tutorActive ? 'Waiting for your tutor to say the letter name.' : 'Tap Hear the letter name before you start.'}
      </LuminaFeedbackCard>}
      {mode !== 'trace' && <LuminaCardDescription>Practice shape feedback</LuminaCardDescription>}
      {support.showChecklist && <LuminaCardDescription data-testid="letter-self-check">{mode === 'trace'
        ? 'Check: start, follow the path, then lift between strokes.'
        : 'Check: use the writing lines, make your marks, then compare after checking.'}</LuminaCardDescription>}
      {/* Pip's dock sits above the paper: it outlines the paper as a region, so
          no connector crosses the model or a start dot. */}
      {pipStore && <div ref={pip.dock} data-pip-dock={instanceRef.current}
        className="mx-auto flex min-h-28 w-full max-w-xl items-center rounded-2xl border border-cyan-300/10 bg-cyan-950/10 px-2" />}
      <div className="flex items-start gap-4 flex-wrap">
      {(mode === 'copy' || modelRevealed) && <div className="w-40 shrink-0" data-testid="letter-copy-model">
        <LuminaCardDescription>{mode === 'copy' ? 'Model' : 'Compare with the model'}</LuminaCardDescription>
        <svg viewBox="0 0 400 300" role="img" aria-label="Letter model" className="w-full rounded-xl" style={{ background: '#fffdf5' }}>
          {template.strokes.map((path, index) => <path key={index} d={pointsToPath(path)} fill="none" stroke="#386f72" strokeWidth="6" strokeLinecap="round" />)}
          {/* model_strokes: each stroke's numbered start and its way, on the model only. */}
          {guides.modelStrokes && <g data-lever="model-strokes">
            {template.strokes.map((path, index) => <StartMark key={index} path={path} index={index} dot arrow scale={2} />)}
          </g>}
        </svg>
      </div>}
      <svg ref={paperRef} data-pip-object="paper" viewBox="0 0 400 300" role="img"
        aria-label={mode === 'write' ? 'Writing paper; draw with a finger, pen, or mouse' : `Writing paper for ${template.letterCase} ${template.letter}; draw with a finger, pen, or mouse`}
        data-testid="letter-writing-paper"
        className="block w-full min-w-0 flex-1 basis-72 max-w-2xl mx-auto rounded-2xl shadow-lg"
        style={{ background: '#fffdf5', touchAction: 'none', userSelect: 'none', cursor: assessment ? 'default' : 'crosshair' }}
        onPointerDown={drawStart} onPointerMove={drawMove} onPointerUp={drawEnd}
        onPointerCancel={event => { if (pointerRef.current === event.pointerId) releasePointer(); }}
        onLostPointerCapture={event => { if (pointerRef.current === event.pointerId) releasePointer(); }}>
        <path d="M20 60 H380 M20 240 H380" fill="none" stroke="#bacfda" strokeWidth="1" />
        <path d="M20 150 H380" fill="none" stroke="#bacfda" strokeDasharray="5 5" />
        {/* writing_lines (and the easy/medium tiers): the line names, and the short-letter space shaded. */}
        {guides.lines && <g data-testid="letter-line-labels" data-lever="writing-lines" fill="#526b78" fontSize="10" aria-hidden="true">
          <rect x="20" y="150" width="360" height="90" fill="#e6f1f5" opacity="0.6" />
          <text x="24" y="54">Top</text><text x="24" y="144">Middle</text><text x="24" y="234">Base</text>
        </g>}
        {mode === 'trace' && template.strokes.map((path, index) => <g key={index} aria-hidden="true">
          <path d={pointsToPath(path)} fill="none" stroke="#386f72" strokeWidth="6" strokeDasharray="2 9" strokeLinecap="round" opacity="0.45" />
          <StartMark path={path} index={index} dot={guides.starts} arrow={guides.arrows} />
        </g>)}
        {/* start_dots on copy/write: each stroke's start, numbered. Points only, never a stroke. */}
        {mode !== 'trace' && guides.starts && <g data-lever="start-dots" aria-hidden="true">
          {startDots(template).map((start, index) => <StartMark key={index} path={[start]} index={index} dot arrow={false} />)}
        </g>}
        {/* first_part on write: the opening of the first stroke, dotted; the rest is the learner's. */}
        {guides.firstPart && <path data-lever="first-part" d={pointsToPath(firstPart(template))} fill="none" stroke="#386f72"
          strokeWidth="6" strokeDasharray="2 9" strokeLinecap="round" opacity="0.45" aria-hidden="true" />}
        {mode !== 'trace' && assessment && <g
          data-testid="letter-feedback-reference"
          aria-hidden="true"
          transform={`translate(${assessment.referenceOffsetX ?? 0} 0)`}
          opacity="0.72">
          {template.strokes.map((path, index) => <path key={index} d={pointsToPath(path)} fill="none"
            stroke="#b77824" strokeWidth="3" strokeDasharray="7 5" strokeLinecap="round" />)}
        </g>}
        {strokes.map((stroke, index) => stroke.points.length === 1
          ? <circle key={index} cx={stroke.points[0].x} cy={stroke.points[0].y} r="3" fill="#244d76" />
          : <path key={index} d={pointsToPath(stroke.points)} fill="none" stroke="#244d76" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />)}
        {assessment && !assessment.passed && assessment.correctionPoint && <circle
          cx={assessment.correctionPoint.x} cy={assessment.correctionPoint.y} r="13"
          fill="none" stroke="#b77824" strokeWidth="2" strokeDasharray="4 3" />}
      </svg>
      </div>
      {judging && <LuminaFeedbackCard status="insight" role="status">Checking your writing…</LuminaFeedbackCard>}
      {assessment && <LuminaFeedbackCard status={assessment.passed ? 'correct' : 'insight'}
        label={assessment.passed ? (mode === 'trace' ? 'Path followed' : 'You wrote it') : 'Try this'} role="status">{assessment.feedback}</LuminaFeedbackCard>}
      <div className="flex justify-center items-center gap-3 flex-wrap">
        {!tutorOwned && <LuminaButton tone="ghost" disabled={!tutorActive || drawing || judging || cue.state === 'speaking' || isAudioPlaying}
          onClick={() => {
            if (!tutorActive || pointerRef.current !== null || cue.state === 'speaking') return;
            const level = Math.min(3, hintLevel + 1) as 1 | 2 | 3;
            setHintLevel(level); setHintsViewed(count => count + 1);
            requestHint(level, { ...aiData, hintLevel: level });
          }}>Help me</LuminaButton>}
        <LuminaButton tone="ghost" onClick={clear} disabled={!strokes.length || drawing || judging || blocked} aria-label={assessment ? 'Try this letter again' : 'Clear writing'}>
          <Eraser className="w-5 h-5" aria-hidden="true" /> {assessment ? 'Try again' : 'Clear'}
        </LuminaButton>
        {!assessment ? <LuminaActionButton action="check" onClick={() => { void check(); }} disabled={!strokes.length || drawing || judging || blocked || (mode === 'write' && !cueReady)}>
          <Check className="w-5 h-5" aria-hidden="true" /> {mode === 'trace' ? 'Check my tracing' : 'Check my writing'}
        </LuminaActionButton> : !tutorOwned && <LuminaActionButton action="next" onClick={next}>
          {progress.currentIndex === data.challenges.length - 1 ? 'Finish practice' : 'Next letter'} <ArrowRight className="w-5 h-5" aria-hidden="true" />
        </LuminaActionButton>}
      </div>
    </LuminaCardContent>
  </LuminaCard>;
}

/** On the workspace path the runtime owns progression: the paper's check commits, the observer advances. */
const LetterWorkshop = withWorkspaceController<LetterWorkshopProps, ProgressOptions<LetterWorkshopChallenge>, Progress>(
  'letter-workshop', LetterWorkshopSurface, useScriptedProgress, useWorkspaceProgressFor('letter-workshop'));

export default LetterWorkshop;

/** A stroke's numbered start dot and the arrow of its first direction. */
function StartMark({ path, index, dot, arrow, scale = 1 }: { path: readonly { x: number; y: number }[]; index: number; dot: boolean; arrow: boolean; scale?: number }) {
  const start = path[0];
  const toward = path.find(point => Math.hypot(point.x - start.x, point.y - start.y) >= 12) ?? path[path.length - 1];
  const angle = Math.atan2(toward.y - start.y, toward.x - start.x);
  return <>
    {dot && <circle data-testid="letter-start" cx={start.x} cy={start.y} r={5 * scale} fill="#b77824" />}
    {dot && <text x={start.x - 15 * scale} y={start.y - 9 * scale} fontSize={13 * scale} fill="#80551c">{index + 1}</text>}
    {arrow && path.length > 1 && <path data-testid="letter-arrow" d="M-5 -4 L0 0 L-5 4"
      transform={`translate(${start.x + 17 * scale * Math.cos(angle)} ${start.y + 17 * scale * Math.sin(angle)}) rotate(${angle * 180 / Math.PI}) scale(${scale})`}
      fill="none" stroke="#80551c" strokeWidth="2" />}
  </>;
}
