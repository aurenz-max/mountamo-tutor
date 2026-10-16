'use client';

/**
 * Sound Wave Explorer: sound makers, their drawn waves and real tones, one closed question per item (one eval mode each).
 * - observe: a sound maker starts or stops shaking (or a sound starts or stops); what happens to the other half?
 * - predict: a sound maker is played once; one change; predict the loudness or the pitch before it plays.
 * - classify: two or three drawn waves; which sound is louder, quieter, higher or lower?
 * - apply: a Before wave and an After wave; which change made the After sound?
 *
 * Every item is built and keyed by code (`soundWaveWorkspace.ts`). Nothing that answers the item is drawn or played
 * before the answer is credited (or, on the scripted path, shown after two misses): the After wave is "?", the observe
 * picture shows the moment before the change, and the classify sounds do not play. Two paths, chosen by
 * `withWorkspaceController`: the scripted path (tester, no tutor) has its own Next and two tries before a reveal; the
 * workspace path (W1, plain shape) commits every check through `progress.commitCheck` with a named miss, takes a
 * spoken answer judged against the key, and lets the runtime move on. The levers live in `soundWaveLevers.ts`.
 */
import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { usePrimitiveEvaluation, type PrimitiveEvaluationResult } from '../../../evaluation';
import type { SoundWaveExplorerMetrics } from '../../../evaluation/types';
import { useLuminaAI } from '../../../hooks/useLuminaAI';
import { SoundManager } from '../../../utils/SoundManager';
import { useWorkspacePipSurface } from '../../../pip/useWorkspacePipSurface';
import {
  LuminaActionButton,
  LuminaAnswerChoice,
  LuminaButton,
  LuminaCard,
  LuminaCardContent,
  LuminaCardHeader,
  LuminaCardTitle,
  LuminaFeedbackCard,
  LuminaPanel,
  LuminaPrompt,
  LuminaSectionLabel,
  type AnswerChoiceState,
} from '../../../ui';
import type { TeachingWorkspace } from '../../../components/live-activity/runtime/useTeachingWorkspace';
import type { TeachingEvaluationResult } from '../../../components/live-activity/runtime/useWorkspaceRunner';
import { withWorkspaceController } from '../../../components/live-activity/runtime/withTeachingWorkspace';
import { useScriptedProgress, useWorkspaceProgressFor, type Progress, type ProgressOptions }
  from '../../../components/live-activity/runtime/useWorkspaceProgress';
import {
  afterWave, AMP_PX, askOf, choicesOf, CREST_COUNT, CREST_HZ, describeSoundWork, keyChoice, MAKER_NAME, soundCorrect,
  soundItems, soundMiss, WAVE_LABELS, workspaceAssignment, workspaceScene, type Maker, type ObserveEvent, type ObserveItem,
  type SoundFocus, type SoundItem, type SoundMode, type SoundTier, type Wave,
} from './soundWaveWorkspace';
import {
  changeLines, CHANGE_LEVER, CREST_LEVER, FEATURE_LEVER, FEATURE_LINES, leverFact, shakeLines, SHAKE_LEVER, simplerItem,
  soundLevers,
} from './soundWaveLevers';

// ============================================================================
// Data Types (single source of truth; the generator imports them)
// ============================================================================

export type { SoundFocus, SoundItem, SoundMode, SoundTier };

export interface SoundWaveExplorerData {
  title: string;
  description?: string;
  /** What the lesson is about (the model's reading of the topic); code picks the asked feature from it. */
  soundFocus?: SoundFocus;
  /** The eval modes this session asks, in order (`resolveSoundModes`). */
  challengeTypes?: SoundMode[];
  /** config.difficulty: the structural band the items were built at. */
  difficulty?: SoundTier;
  /** The items, built and keyed by code at generation; absent or invalid: rebuilt from the fields above. */
  items?: SoundItem[];
  gradeLevel?: 'K' | '1' | '2' | '3';
  /** Legacy generations (before 2026-10-15): read only for the modes and the tier. */
  challenges?: Array<{ type?: string }>;
  supportTier?: string;
  theme?: string;
  objects?: unknown[];

  // Evaluation props (auto-injected by ManifestOrderRenderer)
  instanceId?: string;
  skillId?: string;
  subskillId?: string;
  objectiveId?: string;
  exhibitId?: string;
  onEvaluationSubmit?: (result: PrimitiveEvaluationResult<SoundWaveExplorerMetrics>) => void;
}

interface SoundWaveExplorerProps {
  data: SoundWaveExplorerData;
  className?: string;
  /** Carried onto the runtime mount so the live host keeps its resolved plan metadata. */
  runtimePlanItemId?: string;
  /** The RESOLVED plan mode, kept exactly as mounted rather than rebuilt from the item. */
  runtimeEvalMode?: string;
}

const MODE_LABEL: Record<SoundMode, string> = {
  observe: 'Shaking and sound', predict: 'Predict the sound', classify: 'Read the waves', apply: 'What was done?',
};

// ============================================================================
// Audio: a short sine tone (Web Audio), silent where audio is unavailable
// ============================================================================

let audioCtx: AudioContext | null = null;
function playTone(wave: Wave, ms = 700) {
  if (wave.amp <= 0) return;
  try {
    const W = window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext };
    const Ctor = W.AudioContext ?? W.webkitAudioContext;
    if (!Ctor) return;
    audioCtx ??= new Ctor();
    const ctx = audioCtx;
    if (ctx.state === 'suspended') void ctx.resume();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = CREST_HZ[wave.crests];
    gain.gain.setValueAtTime(0.06 * wave.amp, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + ms / 1000);
    osc.connect(gain); gain.connect(ctx.destination);
    osc.start(ctx.currentTime); osc.stop(ctx.currentTime + ms / 1000);
  } catch { /* no audio */ }
}

// ============================================================================
// Drawings
// ============================================================================

const WAVE_W = 640;
const WAVE_H = 140;
const MID = WAVE_H / 2;

/** One wave at the shared scale; with `marks`, its crests numbered and a line at its top. */
const WavePanel = ({ wave, label, marks }: { wave: Wave | null; label: string; marks: boolean }) => {
  const amp = wave ? AMP_PX[wave.amp] : 0;
  const n = wave ? CREST_COUNT[wave.crests] : 0;
  const x0 = 30, x1 = WAVE_W - 20, len = x1 - x0;
  const path = wave && amp > 0
    ? Array.from({ length: 241 }, (_, k) => {
      const x = x0 + (k / 240) * len;
      return `${k === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${(MID - amp * Math.sin((2 * Math.PI * n * k) / 240)).toFixed(1)}`;
    }).join(' ')
    : `M ${x0} ${MID} L ${x1} ${MID}`;
  const crests = marks && wave && amp > 0 ? Array.from({ length: n }, (_, i) => x0 + ((i + 0.25) / n) * len) : [];
  return (
    <svg viewBox={`0 0 ${WAVE_W} ${WAVE_H}`} className="w-full" role="img" aria-label={label} data-wave={label}>
      <text x={8} y={18} fill="rgba(226,232,240,0.8)" fontSize={14} fontFamily="sans-serif">{label}</text>
      <line x1={x0} y1={MID} x2={x1} y2={MID} stroke="rgba(255,255,255,0.12)" strokeDasharray="4 6" />
      {wave === null ? (
        <text x={WAVE_W / 2} y={MID + 10} textAnchor="middle" fill="rgba(148,163,184,0.9)" fontSize={34} fontFamily="sans-serif">?</text>
      ) : (
        <path d={path} fill="none" stroke={amp > 0 ? '#60A5FA' : 'rgba(148,163,184,0.5)'} strokeWidth={2.5} />
      )}
      {marks && wave && amp > 0 && (
        <g data-lever="crest-marks">
          <line x1={x0} y1={MID - amp} x2={x1} y2={MID - amp} stroke="rgba(250,204,21,0.6)" strokeDasharray="3 4" />
          {crests.map((x, i) => (
            <text key={i} x={x} y={MID - amp - 6} textAnchor="middle" fill="rgba(250,204,21,0.9)" fontSize={12} fontFamily="sans-serif">{i + 1}</text>
          ))}
        </g>
      )}
    </svg>
  );
};

const VIBRATE_STYLE_ID = 'sound-wave-explorer-vibrate-keyframes';
function ensureVibrateKeyframes() {
  if (typeof document === 'undefined' || document.getElementById(VIBRATE_STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = VIBRATE_STYLE_ID;
  style.textContent = '@keyframes swe-vibrate { 0%,100% { transform: translateX(-2px); } 50% { transform: translateX(2px); } }';
  document.head.appendChild(style);
}

/** The observe picture: what is shaking and what is sounding, before the change until credit. */
function observeState(event: ObserveEvent, after: boolean): { shaking: boolean; sounding: boolean } {
  switch (event) {
    case 'struck': case 'heard_start': return { shaking: after, sounding: after };
    case 'held': case 'heard_stop': return { shaking: !after, sounding: !after };
    case 'speaker_on': return { shaking: after, sounding: after };
    case 'speaker_off': return { shaking: !after, sounding: !after };
    case 'fork_water': return { shaking: after, sounding: true };
  }
}

const MakerShape = ({ maker }: { maker: Maker }) => {
  switch (maker) {
    case 'drum': return (<g><ellipse cx={120} cy={130} rx={60} ry={16} fill="#78350F" /><rect x={60} y={96} width={120} height={34} fill="#92400E" /><ellipse cx={120} cy={96} rx={60} ry={16} fill="#F5F5DC" stroke="#D4A574" strokeWidth={2} /></g>);
    case 'guitar_string': return (<g><rect x={30} y={60} width={8} height={90} fill="#92400E" rx={2} /><rect x={202} y={60} width={8} height={90} fill="#92400E" rx={2} /><line x1={38} y1={105} x2={202} y2={105} stroke="#EAB308" strokeWidth={3} /></g>);
    case 'rubber_band': return (<g><rect x={40} y={80} width={18} height={60} fill="#64748B" rx={3} /><rect x={182} y={80} width={18} height={60} fill="#64748B" rx={3} /><line x1={58} y1={110} x2={182} y2={110} stroke="#EF4444" strokeWidth={4} /></g>);
    case 'bell': return (<g><path d="M 85 135 Q 80 85 120 65 Q 160 85 155 135 Z" fill="#FFD700" stroke="#DAA520" strokeWidth={2} /><circle cx={120} cy={140} r={5} fill="#B8860B" /></g>);
    case 'tuning_fork': return (<g><rect x={117} y={110} width={6} height={50} fill="#94A3B8" rx={2} /><rect x={100} y={50} width={6} height={64} fill="#CBD5E1" rx={3} /><rect x={134} y={50} width={6} height={64} fill="#CBD5E1" rx={3} /><path d="M 103 114 Q 120 124 137 114" fill="none" stroke="#CBD5E1" strokeWidth={5} /></g>);
  }
};

const SoundMarks = ({ x, y }: { x: number; y: number }) => (
  <g stroke="rgba(96,165,250,0.8)" fill="none" strokeWidth={2} data-sound-mark="on">
    <path d={`M ${x} ${y - 14} Q ${x + 10} ${y} ${x} ${y + 14}`} />
    <path d={`M ${x + 10} ${y - 22} Q ${x + 24} ${y} ${x + 10} ${y + 22}`} />
  </g>
);

const ObservePicture = ({ item, after }: { item: ObserveItem; after: boolean }) => {
  const { shaking, sounding } = observeState(item.event, after);
  const shake = shaking ? { animation: 'swe-vibrate 120ms linear infinite' } : undefined;
  const label = `${after ? 'After' : 'Before'}: ${item.event.startsWith('speaker') ? 'the drum with rice and the speaker' : item.event === 'fork_water' ? 'the tuning fork and the bowl of water' : `the ${MAKER_NAME[item.maker]}`}`;
  return (
    <svg viewBox="0 0 260 180" className="w-full max-w-[320px]" role="img" aria-label={label}>
      {item.event === 'speaker_on' || item.event === 'speaker_off' ? (
        <g>
          <MakerShape maker="drum" />
          <g style={shake}>{[96, 108, 120, 132, 144].map((x, i) => <circle key={x} cx={x} cy={shaking ? 80 - (i % 2) * 6 : 92} r={3} fill="#FEF3C7" />)}</g>
          <rect x={196} y={70} width={44} height={66} rx={6} fill="#334155" stroke="#94A3B8" />
          <circle cx={218} cy={103} r={14} fill="#1E293B" stroke="#64748B" />
          {sounding && <SoundMarks x={186} y={103} />}
        </g>
      ) : item.event === 'fork_water' ? (
        <g>
          <g style={{ animation: 'swe-vibrate 120ms linear infinite' }} transform="translate(0,-30)"><MakerShape maker="tuning_fork" /></g>
          <path d="M 60 140 Q 120 175 180 140 Z" fill="#1E3A8A" stroke="#60A5FA" />
          {shaking
            ? <g stroke="#93C5FD" fill="none">{[10, 22, 34].map(r => <ellipse key={r} cx={120} cy={142} rx={r * 1.4} ry={r / 4} />)}</g>
            : <line x1={64} y1={141} x2={176} y2={141} stroke="#93C5FD" />}
        </g>
      ) : (
        <g>
          <g style={shake}><MakerShape maker={item.maker} /></g>
          {sounding && <SoundMarks x={214} y={70} />}
        </g>
      )}
    </svg>
  );
};

const FeatureCard = () => (
  <LuminaPanel accent="cyan" data-lever="feature-card" className="space-y-2 text-sm text-slate-300">
    <div className="grid grid-cols-2 gap-2">
      <WavePanel wave={{ amp: 5, crests: 2 }} label="Bigger shakes" marks={false} />
      <WavePanel wave={{ amp: 2, crests: 2 }} label="Smaller shakes" marks={false} />
      <WavePanel wave={{ amp: 3, crests: 5 }} label="Faster shakes" marks={false} />
      <WavePanel wave={{ amp: 3, crests: 1 }} label="Slower shakes" marks={false} />
    </div>
    {FEATURE_LINES.map(l => <p key={l}>{l}</p>)}
  </LuminaPanel>
);

const ShakeCard = ({ item }: { item: ObserveItem }) => (
  <LuminaPanel accent="cyan" data-lever="shake-card" className="flex items-center gap-3 text-sm text-slate-300">
    <svg viewBox="0 0 80 80" className="h-16 w-16 shrink-0" aria-hidden="true">
      {item.event === 'speaker_on' || item.event === 'speaker_off' || item.event === 'fork_water' ? (
        <g><rect x={6} y={10} width={30} height={34} fill="#93C5FD" stroke="#E2E8F0" /><rect x={40} y={46} width={34} height={20} fill="#F59E0B" /><circle cx={48} cy={68} r={5} fill="#334155" /><circle cx={68} cy={68} r={5} fill="#334155" /></g>
      ) : (
        <g><circle cx={40} cy={26} r={16} fill="#FCD34D" /><rect x={34} y={42} width={12} height={14} fill="#FCD34D" /><path d="M 28 48 L 24 46 M 28 52 L 24 54 M 52 48 L 56 46 M 52 52 L 56 54" stroke="#60A5FA" strokeWidth={2} /></g>
      )}
    </svg>
    <div className="space-y-1">{shakeLines(item).map(l => <p key={l}>{l}</p>)}</div>
  </LuminaPanel>
);

// ============================================================================
// Component
// ============================================================================

const SoundWaveExplorerSurface = ({ data, className, runtimePlanItemId, tutorOwned, useController }:
  SoundWaveExplorerProps & { tutorOwned: boolean; useController: (options: ProgressOptions<SoundItem>) => Progress }) => {
  const workspace = useRef<TeachingWorkspace | null>(null);
  const { title, gradeLevel = '1', instanceId, skillId, subskillId, objectiveId, exhibitId, onEvaluationSubmit } = data;
  useEffect(() => { ensureVibrateKeyframes(); }, []);

  const items = useMemo(() => soundItems(data),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data.items, data.challengeTypes, data.difficulty, data.soundFocus, data.title, data.challenges, data.supportTier]);
  const stableInstanceId = useRef(instanceId || `sound-wave-explorer-${Date.now()}`);
  const resolvedInstanceId = instanceId || stableInstanceId.current;

  // ── Progress: the runtime moves the index on the workspace path (callbacks bound below) ──
  const openItem = useRef<(index: number, retry: boolean) => void>(() => {});
  const solvedAloud = useRef<(index: number) => void>(() => {});
  /** Bound below; an answer the observer credited on the simplify lever's practice item. */
  const practiceAloud = useRef<(source: 'speech' | 'gesture') => void>(() => {});
  const finish = useRef<(result: TeachingEvaluationResult) => void>(() => {});
  const progress = useController({
    challenges: items,
    getChallengeId: i => i.id,
    instanceId: resolvedInstanceId, objectiveId, planItemId: runtimePlanItemId,
    workspace, assignment: workspaceAssignment,
    onItemOpened: (index, retry) => openItem.current(index, retry),
    onSolved: index => solvedAloud.current(index),
    onPracticeSolved: (_id, source) => practiceAloud.current(source),
    onFinished: result => finish.current(result),
  });
  const { currentIndex, currentAttempts, results, isComplete } = progress;
  /** Workspace path: a checked answer stays closed until Try again or Next challenge on the shell. */
  const learnerBlocked = () => tutorOwned && progress.canAttempt === false;

  const sessionItem: SoundItem | undefined = items[Math.min(currentIndex, Math.max(items.length - 1, 0))];
  const [practice, setPractice] = useState<SoundItem | null>(null);
  const item = practice ?? sessionItem;

  const [choice, setChoice] = useState<string | null>(null);
  /** Workspace path: the wrong choice just checked, shown until Try again. */
  const [wrongPick, setWrongPick] = useState<string | null>(null);
  const [scriptedWrongs, setScriptedWrongs] = useState(0);
  const [scriptedReveal, setScriptedReveal] = useState(false);
  const [practiceSolved, setPracticeSolved] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [leverState, setLeverState] = useState<{ item: string; pulled: string[] }>({ item: '', pulled: [] });
  const [submitted, setSubmitted] = useState(false);
  const tappedCorrect = useRef<string | null>(null);

  const pulled = sessionItem && leverState.item === sessionItem.id && !practice ? leverState.pulled : [];
  const leverOn = (id: string) => pulled.includes(id);
  const solvedNow = practice ? practiceSolved : !!item && results.some(r => r.challengeId === item.id && r.correct);
  const revealed = solvedNow || scriptedReveal;

  // The run: once credited, play what the change made (observe's sound, predict's and apply's After sound).
  const playedFor = useRef<string | null>(null);
  useEffect(() => {
    if (!revealed || !item || playedFor.current === item.id) return;
    playedFor.current = item.id;
    if (item.mode === 'predict' || item.mode === 'apply') playTone(afterWave(item));
    if (item.mode === 'observe' && observeState(item.event, true).sounding) playTone({ amp: 3, crests: 3 });
  }, [revealed, item]);

  const { submitResult, hasSubmitted } = usePrimitiveEvaluation<SoundWaveExplorerMetrics>({
    primitiveType: 'sound-wave-explorer',
    instanceId: resolvedInstanceId,
    skillId, subskillId, objectiveId, exhibitId,
    onSubmit: onEvaluationSubmit as ((result: PrimitiveEvaluationResult) => void) | undefined,
  });

  // ── Scripted tutor only: its context carries no key; the workspace tutor reads the scene instead ──
  const aiPrimitiveData = useMemo(() => ({
    gradeLevel, mode: item?.mode ?? 'observe', itemIndex: currentIndex + 1, totalItems: items.length,
    ask: item ? askOf(item) : title, choices: item ? choicesOf(item).join(', ') : '', attemptNumber: currentAttempts + 1,
  }), [gradeLevel, item, currentIndex, items.length, title, currentAttempts]);
  const { sendText, isAudioPlaying, activePrimitiveId } = useLuminaAI({
    primitiveType: 'sound-wave-explorer', instanceId: resolvedInstanceId, primitiveData: aiPrimitiveData,
    gradeLevel: gradeLevel === 'K' ? 'Kindergarten' : `Grade ${gradeLevel}`, enabled: !tutorOwned,
  });
  const say = (text: string) => { if (!tutorOwned) sendText(text, { silent: true }); };

  const clearItem = () => {
    setChoice(null); setWrongPick(null); setFeedback(null);
    setScriptedWrongs(0); setScriptedReveal(false); setPracticeSolved(false);
  };

  openItem.current = (_index, retry) => {
    if (retry) { setChoice(null); setWrongPick(null); setFeedback(null); setPracticeSolved(false); return; }
    setPractice(null); clearItem();
  };

  solvedAloud.current = (index) => {
    const solved = items[index];
    if (!solved || tappedCorrect.current === solved.id || results.some(r => r.challengeId === solved.id && r.correct)) return;
    progress.mergeResult({ challengeId: solved.id, correct: true, attempts: currentAttempts + 1 });
    setChoice(keyChoice(solved)); setWrongPick(null);
  };

  // A spoken answer credited on the practice item: shown there as on a session item, recorded nowhere. The full item
  // comes back blank when the practice closes. A tap shows its own credit in the check.
  practiceAloud.current = (source) => {
    if (source !== 'speech' || !practice) return;
    setPracticeSolved(true);
    setChoice(keyChoice(practice)); setWrongPick(null);
  };

  // ── Handlers ──
  const pick = (c: string) => {
    if (!item || revealed || wrongPick !== null || learnerBlocked()) return;
    SoundManager.select();
    setChoice(c); setFeedback(null);
  };

  const check = () => {
    if (!item || choice === null || revealed || wrongPick !== null || learnerBlocked()) return;
    const correct = soundCorrect(item, choice);
    progress.commitCheck(describeSoundWork(item, { choice }), correct, correct ? undefined : soundMiss(item, choice));
    if (correct) {
      SoundManager.playCorrect();
      if (practice) setPracticeSolved(true); else tappedCorrect.current = item.id;
      say(`[ANSWER_CORRECT] The learner chose "${choice}" for: ${askOf(item)} The result now shows and plays. Praise briefly.`);
      return;
    }
    SoundManager.playIncorrect();
    if (tutorOwned) { setWrongPick(choice); return; }
    const wrongs = scriptedWrongs + 1;
    setScriptedWrongs(wrongs);
    if (wrongs >= 2) {
      setScriptedReveal(true);
      if (!practice) progress.recordResult({ challengeId: item.id, correct: false, attempts: currentAttempts + 1 });
      say(`[ANSWER_REVEALED] Two tries missed on: ${askOf(item)} The answer is on screen ("${keyChoice(item)}"); explain it plainly with the shaking.`);
      return;
    }
    setChoice(null);
    setFeedback('Not quite. Look again at the shaking and the waves, and try once more.');
    say(`[ANSWER_INCORRECT] The learner chose "${choice}" for: ${askOf(item)} It is wrong. You are not told the answer: ask what `
      + 'the shaking does, without naming a choice.');
  };

  const metrics = (): SoundWaveExplorerMetrics => {
    const correct = items.filter(i => results.some(r => r.challengeId === i.id && r.correct)).length;
    const attempts = results.reduce((s, r) => s + (r.attempts ?? 1), 0) || currentAttempts;
    return {
      type: 'sound-wave-explorer',
      evalMode: items[0]?.mode,
      challengesCompleted: results.length,
      challengesCorrect: correct,
      totalAttempts: attempts,
      accuracy: items.length ? Math.round((correct / items.length) * 100) : 0,
      averageAttemptsPerChallenge: attempts / Math.max(results.length, 1),
    };
  };

  /** Scripted path: Next, and on the last item the session report. */
  const next = () => {
    if (progress.advance()) { clearItem(); say(`[NEXT_ITEM] Item ${currentIndex + 2} of ${items.length}: ${askOf(items[currentIndex + 1])}`); return; }
    if (hasSubmitted || submitted || progress.recordsEvaluation === false) return;
    const score = items.length ? Math.round((results.filter(r => r.correct).length / items.length) * 100) : 0;
    setSubmitted(true);
    submitResult(score >= 70, score, metrics(), { challengeResults: results });
    say(`[ALL_COMPLETE] The learner finished all ${items.length} sound items. Celebrate briefly.`);
  };

  finish.current = (result) => {
    if (hasSubmitted || progress.recordsEvaluation === false || !items.length) return;
    setSubmitted(true);
    submitResult(result.passed, result.accuracy, { ...metrics(), totalAttempts: result.teachingAttempts.length },
      { challengeResults: result.outcomes, learningResponses: result.learningResponses,
        teachingAttempts: result.teachingAttempts, assistanceProvenance: result.assistanceProvenance },
      undefined, result.diagnosisEvidence);
  };

  // ── Workspace path: what the tutor and the observer are shown, republished every render ──
  useLayoutEffect(() => {
    if (!tutorOwned || !item || isComplete) return;
    const scene = workspaceScene(item, { choice: wrongPick ?? choice, solved: revealed });
    const levers = practice ? [] : soundLevers(sessionItem, pulled);
    const onScreen = practice ? '' : leverFact(sessionItem, pulled);
    workspace.current = {
      ...scene,
      facts: { ...scene.facts, ...(practice ? { practice: 'A simpler item of the same kind, before the full item comes back.' } : {}),
        ...(onScreen ? { onScreen } : {}) },
      levers,
      pullLever: (id) => {
        const l = levers.find(x => x.id === id);
        if (practice || !l || !sessionItem) return `No lever ${id} on this item.`;
        if (l.pulled) return `${id} is already on screen.`;
        const nextState = { item: sessionItem.id, pulled: [...pulled, id] };
        if (l.kind === 'simplify') {
          const simpler = simplerItem(sessionItem);
          if (!simpler) return 'There is no simpler item here; try a help lever.';
          setLeverState(nextState); clearItem(); setPractice(simpler);
          return { practice: workspaceAssignment(simpler) };
        }
        setLeverState(nextState);
        return true;
      },
      endPractice: () => { clearItem(); setPractice(null); },
    };
  });

  const done = hasSubmitted || submitted || (tutorOwned && isComplete);
  const pip = useWorkspacePipSurface({
    instanceId: resolvedInstanceId,
    scopeId: done || !item ? null : item.id,
    label: 'The sound maker, the waves, and your answer',
    solved: revealed,
    tutorSpeaking: isAudioPlaying && activePrimitiveId === resolvedInstanceId,
  });

  if (!items.length) {
    return (
      <LuminaCard className={className}>
        <LuminaCardHeader><LuminaCardTitle>{title}</LuminaCardTitle></LuminaCardHeader>
        <LuminaCardContent><p className="text-sm text-slate-400">This sound lab has no questions to ask.</p></LuminaCardContent>
      </LuminaCard>
    );
  }

  const key = item ? keyChoice(item) : '';
  const choiceState = (c: string): AnswerChoiceState => revealed ? (c === key ? 'correct' : c === choice ? 'incorrect' : 'dimmed')
    : wrongPick === c ? 'incorrect' : choice === c ? 'selected' : 'idle';
  const closed = revealed || wrongPick !== null || learnerBlocked();
  const marks = leverOn(CREST_LEVER);
  const choices = item ? choicesOf(item) : [];

  const stage = (): React.ReactNode => {
    if (!item) return null;
    if (item.mode === 'observe') return <div className="flex justify-center"><ObservePicture key={`${item.id}:${revealed}`} item={item} after={revealed} /></div>;
    if (item.mode === 'classify') {
      return (
        <div className="space-y-2">
          {item.waves.map((w, i) => (
            <LuminaPanel key={i} className="space-y-1">
              <WavePanel wave={w} label={WAVE_LABELS[i]} marks={marks} />
              {revealed && <LuminaButton size="sm" aria-label={`Hear ${WAVE_LABELS[i]}`} onClick={() => playTone(w)}>{`Hear ${WAVE_LABELS[i]}`}</LuminaButton>}
            </LuminaPanel>
          ))}
        </div>
      );
    }
    const after = afterWave(item);
    const showAfter = item.mode === 'apply' || revealed;
    return (
      <div className="space-y-2">
        <LuminaPanel className="space-y-1">
          <WavePanel wave={item.before} label="Before" marks={marks} />
          <LuminaButton size="sm" aria-label="Hear before" onClick={() => playTone(item.before)}>Hear before</LuminaButton>
        </LuminaPanel>
        <LuminaPanel className="space-y-1">
          <WavePanel wave={showAfter ? after : null} label="After" marks={marks} />
          {revealed && <LuminaButton size="sm" aria-label="Hear after" onClick={() => playTone(after)}>Hear after</LuminaButton>}
        </LuminaPanel>
      </div>
    );
  };

  return (
    <LuminaCard className={className}>
      <LuminaCardHeader>
        <LuminaCardTitle>{title}</LuminaCardTitle>
        {!done && item && (
          <LuminaSectionLabel accent="cyan" size="sm">
            {practice ? 'A simpler item first' : `${MODE_LABEL[item.mode]} · item ${Math.min(currentIndex, items.length - 1) + 1} of ${items.length}`}
          </LuminaSectionLabel>
        )}
      </LuminaCardHeader>

      <LuminaCardContent className="space-y-4">
        {done ? (
          <LuminaFeedbackCard status="insight" label="Sound lab complete">
            {`${results.filter(r => r.correct).length} of ${items.length} items answered.`}
          </LuminaFeedbackCard>
        ) : item && (
          <>
            <LuminaPrompt accent="cyan" {...(practice ? { 'data-practice': 'simpler' } : {})}>{askOf(item)}</LuminaPrompt>

            {pip.store && <div {...pip.dock} />}
            <div {...pip.workspace} className="space-y-4">
              {stage()}
              {item.mode === 'observe' && leverOn(SHAKE_LEVER) && !practice && <ShakeCard item={item} />}
              {(item.mode === 'predict' || item.mode === 'apply') && leverOn(CHANGE_LEVER) && !practice && (
                <LuminaPanel accent="cyan" data-lever="change-card" className="space-y-1 text-sm text-slate-300">
                  {changeLines(item).map(l => <p key={l}>{l}</p>)}
                </LuminaPanel>
              )}
              {leverOn(FEATURE_LEVER) && !practice && <FeatureCard />}

              <div className={`grid gap-2 ${choices.length > 3 ? 'grid-cols-2' : 'grid-cols-3'}`}>
                {choices.map(c => (
                  <LuminaAnswerChoice key={c} aria-label={c} state={choiceState(c)} disabled={closed}
                    className="p-3 text-center font-semibold" onClick={() => pick(c)}>
                    {c}
                  </LuminaAnswerChoice>
                ))}
              </div>
            </div>

            {!revealed && (
              <div className="flex justify-center">
                <LuminaActionButton action="check" disabled={choice === null || closed} onClick={check}>Check Answer</LuminaActionButton>
              </div>
            )}

            {revealed && (
              <LuminaFeedbackCard status={solvedNow ? 'correct' : 'insight'} label={solvedNow ? undefined : 'The answer'}>
                {`${key}.${item.mode === 'observe' ? ' The shaking and the sound go together.' : ''}`}
              </LuminaFeedbackCard>
            )}
            {!revealed && wrongPick !== null && <LuminaFeedbackCard status="incorrect">{`"${wrongPick}" is not it.`}</LuminaFeedbackCard>}
            {!revealed && feedback && <LuminaFeedbackCard status="incorrect">{feedback}</LuminaFeedbackCard>}

            {!tutorOwned && revealed && !practice && (
              <div className="flex justify-end">
                <LuminaActionButton action="next" onClick={next}>{currentIndex < items.length - 1 ? 'Next →' : 'Finish'}</LuminaActionButton>
              </div>
            )}
          </>
        )}
      </LuminaCardContent>
    </LuminaCard>
  );
};

// The workspace path never mounts the scripted progress, whose Next would compete with the observer.
const SoundWaveExplorer = withWorkspaceController<SoundWaveExplorerProps, ProgressOptions<SoundItem>, Progress>(
  'sound-wave-explorer', SoundWaveExplorerSurface, useScriptedProgress, useWorkspaceProgressFor('sound-wave-explorer'));

export default SoundWaveExplorer;
