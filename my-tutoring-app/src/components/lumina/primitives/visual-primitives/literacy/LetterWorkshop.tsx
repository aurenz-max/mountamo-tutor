'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Check, Eraser, ArrowRight } from 'lucide-react';
import {
  LuminaCard, LuminaCardHeader, LuminaCardTitle, LuminaCardDescription,
  LuminaCardContent, LuminaBadge, LuminaChallengeCounter, LuminaPrompt,
  LuminaButton, LuminaActionButton, LuminaFeedbackCard, LuminaReadAloud,
} from '../../../ui';
import { usePrimitiveEvaluation, type PrimitiveEvaluationResult } from '../../../evaluation';
import type { LetterWorkshopMetrics } from '../../../evaluation/types';
import { useChallengeProgress } from '../../../hooks/useChallengeProgress';
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

export interface LetterWorkshopChallenge {
  id: string;
  type: LetterWorkshopMode;
  /** References code-owned geometry; the model never invents letter strokes. */
  templateId: string;
  supportTier?: SupportTier;
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
}

const PHASES = Object.fromEntries(LETTER_WORKSHOP_MODES.map(mode => [mode, { label: LETTER_WORKSHOP_MODE_INFO[mode].label, accentColor: 'cyan' as const }]));
const challengeId = (challenge: LetterWorkshopChallenge) => challenge.id;
const challengeType = (challenge: LetterWorkshopChallenge) => challenge.type;

/** A new payload gets a new session, including the evaluation hook's submission guard. */
export default function LetterWorkshop({ data }: { data: LetterWorkshopData }) {
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
  return <LetterWorkshopSession key={sessionKey} data={data} />;
}

function LetterWorkshopSession({ data }: { data: LetterWorkshopData }) {
  const instanceRef = useRef(data.instanceId ?? `letter-workshop-${Date.now()}`);
  const progress = useChallengeProgress({ challenges: data.challenges, getChallengeId: challengeId });
  const current = data.challenges[progress.currentIndex];
  const template = getLetterTemplate(current.templateId);
  const mode = current.type;
  const modeInfo = LETTER_WORKSHOP_MODE_INFO[mode];
  const supportTier = normalizeSupportTier(current.supportTier);
  const support = resolveSupportStructure(mode, supportTier);
  const localOnly = data.challenges.some(ch => ch.type !== 'trace');
  const cue = useLetterWorkshopCue(current.id, template.letter, template.letterCase);
  const exposedTemplates = useRef(new Set<string>());
  const [revealedId, setRevealedId] = useState<string | null>(null);
  const modelRevealed = revealedId === current.id;
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
  const svgRef = useRef<SVGSVGElement>(null);
  const { submitResult, elapsedMs } = usePrimitiveEvaluation<LetterWorkshopMetrics>({
    primitiveType: 'letter-workshop', instanceId: instanceRef.current, localOnly,
    skillId: data.skillId, subskillId: data.subskillId, objectiveId: data.objectiveId,
    exhibitId: data.exhibitId, componentIntent: data.componentIntent,
    objectiveText: data.objectiveText, onSubmit: data.onEvaluationSubmit,
  });
  const phases = usePhaseResults({ challenges: data.challenges, results: progress.results,
    isComplete: progress.isComplete, getChallengeType: challengeType, phaseConfig: PHASES });
  const prompt = mode === 'trace' ? `Trace ${template.letterCase} ${template.letter}. ${support.showArrows ? 'Start at each numbered dot and follow the arrows.' : support.showStarts ? 'Start at each numbered dot and trace the path.' : 'Follow the letter path.'}`
    : mode === 'copy' ? `Copy ${template.letterCase} ${template.letter} beside the model. Use the writing lines.`
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
  const { sendText, requestHint, isConnected, isAudioPlaying, sessionMode, activePrimitiveId } = useLuminaAI({ primitiveType: 'letter-workshop',
    instanceId: instanceRef.current, primitiveData: aiData, gradeLevel: data.gradeLevel });
  const tutorActive = isConnected && (sessionMode !== 'lesson' || activePrimitiveId === instanceRef.current);

  useEffect(() => {
    strokesRef.current = [];
    setStrokes([]);
    assessmentRef.current = null;
    setAssessment(null);
    pointerRef.current = null;
    setDrawing(false);
    advancingRef.current = false;
    setRevealedId(null);
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
    if (tutorActive) sendText(`[ALL_COMPLETE] Letter practice finished: ${correctCount} of ${data.challenges.length} paths met the geometric checks. Encourage practice; do not claim handwriting mastery.`, { silent: true });
  }, [progress.isComplete, progress.results, data.challenges, localOnly, hintsViewed, tutorActive, submitResult, sendText]);

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
    if ((mode === 'write' && cue.state !== 'ready') || assessmentRef.current || advancingRef.current || pointerRef.current !== null || event.button !== 0 || !event.isPrimary) return;
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

  function saveAttempt(disposition: TraceAttempt['disposition'], result: TraceAssessment | null) {
    evidenceRef.current.push({ challengeId: current.id, templateId: current.templateId,
      type: mode, assistance: modelRevealed ? 'beside-model' : modeInfo.assistance, disposition,
      modelPreviouslySeen: exposedTemplates.current.has(current.templateId), cuePlays: cue.plays,
      scorerVersion: mode === 'trace' ? TRACE_TOLERANCES.version : FORMATION_TOLERANCES.version, templateVersion: 'school-manuscript-v1', hintLevel, supportTier,
      strokes: strokesRef.current.map(stroke => ({ ...stroke, points: stroke.points.map(point => ({ ...point })) })),
      assessment: result });
    progress.incrementAttempts();
  }

  function clear() {
    if (pointerRef.current !== null || advancingRef.current) return;
    if (strokesRef.current.length && !assessmentRef.current) saveAttempt('cleared', null);
    strokesRef.current = [];
    setStrokes([]);
    assessmentRef.current = null;
    setAssessment(null);
  }

  function check() {
    if (pointerRef.current !== null || assessmentRef.current || !strokesRef.current.length || advancingRef.current) return;
    if (mode === 'write' && cue.state !== 'ready') return;
    const rawResult = mode === 'trace' ? evaluateLetterTrace(template, strokesRef.current) : evaluateLetterFormation(template, strokesRef.current);
    const result = mode === 'trace' && !support.showArrows && !rawResult.passed
      ? { ...rawResult, correctionPoint: support.showStarts ? rawResult.correctionPoint : undefined,
          feedback: support.showStarts ? 'Compare your trace with the whole path. Start at each numbered dot and try again.' : 'Compare your marks with the whole letter path. Try tracing it again.' }
      : rawResult;
    assessmentRef.current = result;
    setAssessment(result);
    saveAttempt('submitted', result);
    if (mode === 'write') { exposedTemplates.current.add(current.templateId); setRevealedId(current.id); }
    if (tutorActive) sendText(`[${result.passed ? 'ANSWER_CORRECT' : 'ANSWER_INCORRECT'}] Item ${progress.currentIndex + 1}; ${modeInfo.label}; attempt ${progress.currentAttempts + 1}. Provisional feedback: ${result.feedback} Say that briefly without naming a hidden letter or claiming mastery.`, { silent: true });
  }

  function next() {
    const result = assessmentRef.current;
    if (!result || advancingRef.current) return;
    advancingRef.current = true;
    cue.cancel();
    progress.recordResult({ challengeId: current.id, correct: result.passed,
      attempts: progress.currentAttempts, score: result.passed ? 100 : 0 });
    progress.advance();
  }

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
        <LuminaReadAloud label={mode === 'write' ? 'Hear the letter name' : 'Read this to me'} speaking={cue.state === 'speaking'} aria-label={mode === 'write' ? 'Hear the letter name' : 'Hear the writing instruction'}
          disabled={drawing || cue.state === 'speaking' || isAudioPlaying || (mode !== 'write' && !tutorActive)} onClick={() => mode === 'write' ? cue.play() : sendText(`[READ_ALOUD] Say exactly: ${prompt}`, { silent: true })} />
      </div>
      {mode === 'write' && cue.state !== 'ready' && <LuminaFeedbackCard status="insight" role="status">
        {cue.state === 'error' ? 'The letter name could not play. Tap Hear the letter name to try again.' : cue.state === 'speaking' ? 'Listen to the letter name.' : 'Tap Hear the letter name before you start.'}
      </LuminaFeedbackCard>}
      {mode !== 'trace' && <LuminaCardDescription>Practice shape feedback</LuminaCardDescription>}
      {support.showChecklist && <LuminaCardDescription data-testid="letter-self-check">{mode === 'trace'
        ? 'Check: start, follow the path, then lift between strokes.'
        : 'Check: use the writing lines, make your marks, then compare after checking.'}</LuminaCardDescription>}
      <div className="flex items-start gap-4 flex-wrap">
      {(mode === 'copy' || modelRevealed) && <div className="w-40 shrink-0" data-testid="letter-copy-model">
        <LuminaCardDescription>{mode === 'copy' ? 'Model' : 'Compare with the model'}</LuminaCardDescription>
        <svg viewBox="0 0 400 300" role="img" aria-label="Letter model" className="w-full rounded-xl" style={{ background: '#fffdf5' }}>
          {template.strokes.map((path, index) => <path key={index} d={pointsToPath(path)} fill="none" stroke="#386f72" strokeWidth="6" strokeLinecap="round" />)}
        </svg>
      </div>}
      <svg ref={svgRef} viewBox="0 0 400 300" role="img"
        aria-label={mode === 'write' ? 'Writing paper; draw with a finger, pen, or mouse' : `Writing paper for ${template.letterCase} ${template.letter}; draw with a finger, pen, or mouse`}
        data-testid="letter-writing-paper"
        className="block w-full min-w-0 flex-1 basis-72 max-w-2xl mx-auto rounded-2xl shadow-lg"
        style={{ background: '#fffdf5', touchAction: 'none', userSelect: 'none', cursor: assessment ? 'default' : 'crosshair' }}
        onPointerDown={drawStart} onPointerMove={drawMove} onPointerUp={drawEnd}
        onPointerCancel={event => { if (pointerRef.current === event.pointerId) releasePointer(); }}
        onLostPointerCapture={event => { if (pointerRef.current === event.pointerId) releasePointer(); }}>
        <path d="M20 60 H380 M20 240 H380" fill="none" stroke="#bacfda" strokeWidth="1" />
        <path d="M20 150 H380" fill="none" stroke="#bacfda" strokeDasharray="5 5" />
        {support.showLineLabels && <g data-testid="letter-line-labels" fill="#526b78" fontSize="10" aria-hidden="true">
          <text x="24" y="54">Top</text><text x="24" y="144">Middle</text><text x="24" y="234">Base</text>
        </g>}
        {mode === 'trace' && template.strokes.map((path, index) => {
          const start = path[0];
          const toward = path.find(point => Math.hypot(point.x - start.x, point.y - start.y) >= 12) ?? path[path.length - 1];
          const angle = Math.atan2(toward.y - start.y, toward.x - start.x) * 180 / Math.PI;
          return <g key={index} aria-hidden="true">
            <path d={pointsToPath(path)} fill="none" stroke="#386f72" strokeWidth="6" strokeDasharray="2 9" strokeLinecap="round" opacity="0.45" />
            {support.showStarts && <circle data-testid="letter-start" cx={start.x} cy={start.y} r="5" fill="#b77824" />}
            {support.showStarts && <text x={start.x - 15} y={start.y - 9} fontSize="13" fill="#80551c">{index + 1}</text>}
            {support.showArrows && <path data-testid="letter-arrow" d="M-5 -4 L0 0 L-5 4" transform={`translate(${start.x + 17 * Math.cos(angle * Math.PI / 180)} ${start.y + 17 * Math.sin(angle * Math.PI / 180)}) rotate(${angle})`} fill="none" stroke="#80551c" strokeWidth="2" />}
          </g>;
        })}
        {strokes.map((stroke, index) => stroke.points.length === 1
          ? <circle key={index} cx={stroke.points[0].x} cy={stroke.points[0].y} r="3" fill="#244d76" />
          : <path key={index} d={pointsToPath(stroke.points)} fill="none" stroke="#244d76" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />)}
        {assessment && !assessment.passed && assessment.correctionPoint && <circle
          cx={assessment.correctionPoint.x} cy={assessment.correctionPoint.y} r="13"
          fill="none" stroke="#b77824" strokeWidth="2" strokeDasharray="4 3" />}
      </svg>
      </div>
      {assessment && <LuminaFeedbackCard status={assessment.passed ? 'correct' : 'insight'}
        label={assessment.passed ? (mode === 'trace' ? 'Path followed' : 'Shape matches') : 'Try this'} role="status">{assessment.feedback}</LuminaFeedbackCard>}
      <div className="flex justify-center items-center gap-3 flex-wrap">
        <LuminaButton tone="ghost" disabled={!tutorActive || drawing || cue.state === 'speaking' || isAudioPlaying}
          onClick={() => {
            if (!tutorActive || pointerRef.current !== null || cue.state === 'speaking') return;
            const level = Math.min(3, hintLevel + 1) as 1 | 2 | 3;
            setHintLevel(level); setHintsViewed(count => count + 1);
            requestHint(level, { ...aiData, hintLevel: level });
          }}>Help me</LuminaButton>
        <LuminaButton tone="ghost" onClick={clear} disabled={!strokes.length || drawing} aria-label={assessment ? 'Try this letter again' : 'Clear writing'}>
          <Eraser className="w-5 h-5" aria-hidden="true" /> {assessment ? 'Try again' : 'Clear'}
        </LuminaButton>
        {!assessment ? <LuminaActionButton action="check" onClick={check} disabled={!strokes.length || drawing || (mode === 'write' && cue.state !== 'ready')}>
          <Check className="w-5 h-5" aria-hidden="true" /> {mode === 'trace' ? 'Check my tracing' : 'Check my writing'}
        </LuminaActionButton> : <LuminaActionButton action="next" onClick={next}>
          {progress.currentIndex === data.challenges.length - 1 ? 'Finish practice' : 'Next letter'} <ArrowRight className="w-5 h-5" aria-hidden="true" />
        </LuminaActionButton>}
      </div>
    </LuminaCardContent>
  </LuminaCard>;
}
