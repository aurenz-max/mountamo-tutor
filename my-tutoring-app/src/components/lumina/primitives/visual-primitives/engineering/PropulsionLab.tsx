'use client';

/**
 * Propulsion Lab: a small craft with one or two engines (jet engine, rocket engine, propeller, or a sail), on a track
 * on Earth or in space, and one task per eval mode (Newton's third law: an engine pushes the craft the opposite way from
 * its blast; a jet engine, a propeller and a sail need air, a rocket engine does not).
 * - predict: the craft drawn with its engines off; predict what it does when they start, then they run.
 * - observe: the craft held by a clamp with its engines running; read the streams and say what it does when let go.
 * - experiment: a question; set up Test A and Test B and run them. The check is a fair test.
 *
 * Every item is built and keyed by code (`propulsionWorkspace.ts`). No label, badge or readout names what the craft
 * does, and it moves only after a credited answer (predict, observe) or a run (experiment). Taught only on the shared
 * tutor/JEV workspace (`withWorkspaceOnly`; its wiring is `propulsionLab.card.ts` + `propulsionLab.boss.ts`): every
 * check commits through `progress.commitCheck` with a named miss, a spoken answer is judged by the tutor against the
 * key, and the runtime moves on. The levers are one lever set in `propulsionLevers.ts`.
 */
import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { usePrimitiveEvaluation, type PrimitiveEvaluationResult } from '../../../evaluation';
import type { PropulsionLabMetrics } from '../../../evaluation/types';
import { SoundManager } from '../../../utils/SoundManager';
import { PipDock, PipWorkspace } from '../../../pip/WorkspacePip';
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
import { withWorkspaceOnly } from '../../../components/live-activity/runtime/withTeachingWorkspace';
import { useWorkspaceProgressFor } from '../../../components/live-activity/runtime/useWorkspaceProgress';
import { leverScene } from '../../../components/live-activity/bossLevers';
import {
  askOf, describePropulsionWork, emptyWork, ENGINES, keyOf, MOTIONS, PLACE_TEXT, propulsionCorrect,
  propulsionItems, propulsionMiss, pushOf, TEST_ENGINES, testButton, testResult, THROTTLE_SIZE, THROTTLE_TEXT, works,
  workComplete, workspaceScene,
  type ChoiceItem, type Motion, type Place, type PropulsionItem, type PropulsionMode, type PropulsionTier,
  type PropulsionWork, type Setup, type Thruster,
} from './propulsionWorkspace';
import {
  AIR_MARKS_LEVER, airLine, BLAST_ARROWS_LEVER, CAN_PUSH_LEVER, canPushLine, COMPARE_TESTS_LEVER, compareLines,
  HOW_IT_WORKS_LEVER, howLines, LABEL_STREAMS_LEVER, PROPULSION_LEVERS, STREAM_UNITS_LEVER, streamLines, unitLines,
} from './propulsionLevers';
import { propulsionLabBoss } from './propulsionLab.boss';

// ============================================================================
// Data Types (single source of truth; the generator imports them)
// ============================================================================

export type { PropulsionItem, PropulsionMode, PropulsionTier };

export interface PropulsionLabData {
  title: string;
  description?: string;
  /** One sentence shown under the title; never states an outcome. */
  overview?: string;
  gradeBand?: '1-2' | '3-5';
  /** The eval modes this session asks, in order (`resolvePropulsionModes`). */
  challengeTypes?: PropulsionMode[];
  /** config.difficulty: the structural band the items were built at. */
  difficulty?: PropulsionTier;
  /** The items, built and keyed by code at generation; absent or invalid: rebuilt from the fields above. */
  items?: PropulsionItem[];
  /** Legacy generations (model-written multiple choice): read only for their modes. */
  challenges?: Array<{ type?: string }>;

  // Evaluation props (auto-injected by ManifestOrderRenderer)
  instanceId?: string;
  skillId?: string;
  subskillId?: string;
  objectiveId?: string;
  exhibitId?: string;
  onEvaluationSubmit?: (result: PrimitiveEvaluationResult<PropulsionLabMetrics>) => void;
}

interface PropulsionLabProps {
  data: PropulsionLabData;
  className?: string;
  runtimePlanItemId?: string;
  runtimeEvalMode?: string;
}

const MODE_LABEL: Record<PropulsionMode, string> = { predict: 'Predict, then watch', observe: 'Read the streams', experiment: 'Set up a fair test' };

// ============================================================================
// The scene (canvas). Draws what it is given; the craft moves only when `motion` is set.
// ============================================================================

const CW = 640;
const CH = 200;
const UNIT = 16;
const ENGINE_COLOR: Record<string, string> = { jet: '#f97316', rocket: '#a855f7', propeller: '#3b82f6', sail: '#14b8a6' };

interface SceneProps {
  place: Place;
  thrusters: Thruster[];
  /** Draw what comes out of each working engine. */
  streams: boolean;
  /** The craft's motion, once run; null while it holds still. */
  motion: Motion | null;
  /** Pixels per frame when moving. */
  speed: number;
  clamp: boolean;
  /** blast_arrows: an arrow at each engine, the way it is aimed. */
  arrows: boolean;
  /** air_marks: ring the specks of air. */
  ringAir: boolean;
  label: string;
}

const PropulsionScene = ({ place, thrusters, streams, motion, speed, clamp, arrows, ringAir, label }: SceneProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const live = useRef({ place, thrusters, streams, motion, speed, clamp, arrows, ringAir });
  live.current = { place, thrusters, streams, motion, speed, clamp, arrows, ringAir };
  const sim = useRef({ x: CW / 2, t: 0 });

  // A new run starts from the middle.
  useEffect(() => { sim.current = { x: CW / 2, t: sim.current.t }; }, [motion]);

  useEffect(() => {
    const ctx = canvasRef.current?.getContext?.('2d');
    if (!ctx) return;
    let frame = 0;
    const specks = Array.from({ length: 36 }, (_, i) => ({ x: (i * 97) % CW, y: 20 + (i * 53) % (CH - 40) }));
    const stars = Array.from({ length: 50 }, (_, i) => ({ x: (i * 137.5) % CW, y: (i * 71.3) % CH, r: i % 3 === 0 ? 1.4 : 0.7 }));
    const draw = () => {
      const { place: p, thrusters: ts, streams: st, motion: m, speed: sp, clamp: cl, arrows: ar, ringAir: ring } = live.current;
      const s = sim.current;
      s.t += 1;
      if (m && m !== 'Stays still') {
        s.x += (m === 'Moves right' ? 1 : -1) * sp;
        if (s.x > CW + 80) s.x = -80;
        if (s.x < -80) s.x = CW + 80;
      }
      const cy = CH / 2;
      const bg = ctx.createLinearGradient(0, 0, 0, CH);
      if (p === 'space') { bg.addColorStop(0, '#020617'); bg.addColorStop(1, '#0f172a'); } else { bg.addColorStop(0, '#0c1a2e'); bg.addColorStop(1, '#1a2d4a'); }
      ctx.fillStyle = bg; ctx.fillRect(0, 0, CW, CH);
      if (p === 'space') {
        ctx.fillStyle = '#ffffff';
        for (const star of stars) { ctx.beginPath(); ctx.arc(star.x, star.y, star.r, 0, Math.PI * 2); ctx.fill(); }
      } else {
        for (const k of specks) {
          const x = (k.x + Math.sin((s.t + k.y) * 0.02) * 4 + CW) % CW;
          ctx.beginPath(); ctx.arc(x, k.y, 2.5, 0, Math.PI * 2); ctx.fillStyle = 'rgba(148,163,184,0.55)'; ctx.fill();
          if (ring) { ctx.beginPath(); ctx.arc(x, k.y, 7, 0, Math.PI * 2); ctx.strokeStyle = 'rgba(250,204,21,0.7)'; ctx.lineWidth = 1.5; ctx.stroke(); }
        }
        ctx.strokeStyle = 'rgba(148,163,184,0.35)'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(0, cy + 34); ctx.lineTo(CW, cy + 34); ctx.stroke();
      }
      // Wind for a sail on Earth.
      const sail = ts.find(t => t.engine === 'sail');
      if (sail && p === 'air') {
        ctx.strokeStyle = 'rgba(94,234,212,0.5)'; ctx.lineWidth = 2;
        for (let i = 0; i < 6; i++) {
          const x = ((s.t * 3 + i * 120) % (CW + 60)) - 60, y = 30 + i * 12;
          ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 40, y); ctx.stroke();
        }
      }
      const x = s.x, bw = 120, bh = 36;
      // Streams: a band of the engine's colour, one tick per unit, with particles flowing out.
      if (st) {
        for (const t of ts) {
          if (t.engine === 'sail' || !works(t.engine, p)) continue;
          const dir = t.blast === 'left' ? -1 : 1;
          const x0 = x + dir * (bw / 2 + 14), len = t.size * UNIT;
          const g = ctx.createLinearGradient(x0, 0, x0 + dir * len, 0);
          g.addColorStop(0, `${ENGINE_COLOR[t.engine]}cc`); g.addColorStop(1, `${ENGINE_COLOR[t.engine]}22`);
          ctx.fillStyle = g;
          ctx.beginPath(); ctx.moveTo(x0, cy - 9); ctx.lineTo(x0 + dir * len, cy - 14); ctx.lineTo(x0 + dir * len, cy + 14); ctx.lineTo(x0, cy + 9); ctx.closePath(); ctx.fill();
          ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 1;
          for (let u = 1; u <= t.size; u++) { const tx = x0 + dir * u * UNIT; ctx.beginPath(); ctx.moveTo(tx, cy - 16); ctx.lineTo(tx, cy - 11); ctx.stroke(); }
          for (let k = 0; k < 6; k++) {
            const f = ((s.t * 0.04 + k / 6) % 1);
            ctx.beginPath(); ctx.arc(x0 + dir * f * len, cy + Math.sin(k * 3 + s.t * 0.1) * 6, 2.5, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.fill();
          }
        }
      }
      // Craft body, nose to the right.
      ctx.fillStyle = '#475569';
      ctx.beginPath(); ctx.moveTo(x - bw / 2, cy - bh / 2); ctx.lineTo(x + bw / 2 - 10, cy - bh / 2);
      ctx.quadraticCurveTo(x + bw / 2 + 14, cy, x + bw / 2 - 10, cy + bh / 2); ctx.lineTo(x - bw / 2, cy + bh / 2); ctx.closePath(); ctx.fill();
      // Engines.
      for (const t of ts) {
        const c = ENGINE_COLOR[t.engine];
        if (t.engine === 'sail') {
          ctx.strokeStyle = '#e2e8f0'; ctx.lineWidth = 3;
          ctx.beginPath(); ctx.moveTo(x, cy - bh / 2); ctx.lineTo(x, cy - bh / 2 - 50); ctx.stroke();
          ctx.fillStyle = c; ctx.beginPath(); ctx.moveTo(x + 2, cy - bh / 2 - 48); ctx.lineTo(x + 2, cy - bh / 2 - 4); ctx.lineTo(x + 38, cy - bh / 2 - 6); ctx.closePath(); ctx.fill();
          continue;
        }
        const dir = t.blast === 'left' ? -1 : 1;
        const ex = x + dir * (bw / 2);
        ctx.fillStyle = c;
        if (t.engine === 'rocket') {
          ctx.beginPath(); ctx.moveTo(ex, cy - 8); ctx.lineTo(ex + dir * 14, cy - 13); ctx.lineTo(ex + dir * 14, cy + 13); ctx.lineTo(ex, cy + 8); ctx.closePath(); ctx.fill();
        } else if (t.engine === 'jet') {
          ctx.fillRect(Math.min(ex, ex + dir * 14), cy - 10, 14, 20);
          ctx.fillStyle = '#1e293b'; ctx.fillRect(Math.min(ex + dir * 10, ex + dir * 14), cy - 6, 4, 12);
        } else {
          // The blades spin whenever the engine is switched on, with or without air to push.
          const spin = st ? Math.sin(s.t * 0.6) : 1;
          ctx.fillRect(Math.min(ex, ex + dir * 8), cy - 4, 8, 8);
          ctx.strokeStyle = c; ctx.lineWidth = 5;
          ctx.beginPath(); ctx.moveTo(ex + dir * 10, cy - 22 * spin); ctx.lineTo(ex + dir * 10, cy + 22 * spin); ctx.stroke();
        }
        if (ar) {
          ctx.setLineDash([5, 4]); ctx.strokeStyle = '#fde68a'; ctx.lineWidth = 2;
          const ax = ex + dir * 20;
          ctx.beginPath(); ctx.moveTo(ax, cy + 26); ctx.lineTo(ax + dir * 40, cy + 26); ctx.stroke(); ctx.setLineDash([]);
          ctx.fillStyle = '#fde68a'; ctx.beginPath(); ctx.moveTo(ax + dir * 48, cy + 26); ctx.lineTo(ax + dir * 40, cy + 21); ctx.lineTo(ax + dir * 40, cy + 31); ctx.closePath(); ctx.fill();
        }
      }
      if (cl) {
        ctx.strokeStyle = '#cbd5e1'; ctx.lineWidth = 4;
        ctx.beginPath(); ctx.moveTo(x - 20, 0); ctx.lineTo(x - 20, cy - bh / 2); ctx.moveTo(x + 20, 0); ctx.lineTo(x + 20, cy - bh / 2); ctx.stroke();
      }
      frame = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(frame);
  }, []);

  return <canvas ref={canvasRef} width={CW} height={CH} className="w-full rounded-xl border border-white/10" style={{ maxWidth: CW }} aria-label={label} />;
};

/** Pixels per frame for a craft's net push. */
const speedOf = (place: Place, ts: Thruster[]) => {
  let net = 0;
  for (const t of ts) if (works(t.engine, place)) net += (pushOf(t) === 'right' ? 1 : -1) * t.size;
  return Math.min(4, 0.6 + Math.abs(net) * 0.5);
};
const testThrusters = (s: Setup): Thruster[] => [{ engine: s.engine, blast: 'left', size: THROTTLE_SIZE[s.throttle] }];

/** The worked explanation once an item is solved or revealed. */
function revealText(item: PropulsionItem, w: PropulsionWork, ran: { a: Setup; b: Setup } | null): string {
  if (item.mode === 'experiment') {
    const r = ran ?? { a: w.a, b: w.b };
    const vary = item.question.vary === 'place' ? 'place' : item.question.vary === 'engine' ? 'engine' : 'throttle';
    return `These two tests differ only in the ${vary}, so they can answer the question. Test A: ${testResult(r.a)}. Test B: ${testResult(r.b)}.`;
  }
  const lines = item.thrusters.map(t => {
    const e = ENGINES[t.engine].label;
    if (t.engine === 'sail') return works('sail', item.place) ? 'The wind pushes on the sail, toward the right.' : 'In space there is no wind to catch, so the sail pushes nothing.';
    if (!works(t.engine, item.place)) return `In space the ${e} has no air to push, so it pushes nothing.`;
    return `The ${e} blasts out to the ${t.blast}, so it pushes the craft the other way, to the ${pushOf(t)}.`;
  });
  const live = item.thrusters.filter(t => works(t.engine, item.place));
  const cancel = live.length > 1 && keyOf(item) === 'Stays still' ? ' The two pushes are equally strong and opposite, so they cancel.' : '';
  return `${lines.join(' ')}${cancel} The craft ${keyOf(item).toLowerCase()}.`;
}

// ============================================================================
// Component
// ============================================================================

const usePropulsionProgress = useWorkspaceProgressFor('propulsion-lab');

const PropulsionLabSurface = ({ data, className, runtimePlanItemId }: PropulsionLabProps) => {
  const workspace = useRef<TeachingWorkspace | null>(null);
  const { title, overview, instanceId, skillId, subskillId, objectiveId, exhibitId, onEvaluationSubmit } = data;

  const items = useMemo(() => propulsionItems(data),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data.items, data.challengeTypes, data.difficulty, data.title, data.gradeBand]);
  const stableInstanceId = useRef(instanceId || `propulsion-lab-${Date.now()}`);
  const resolvedInstanceId = instanceId || stableInstanceId.current;

  // ── Progress: the runtime moves the index (callbacks bound below) ──
  const openItem = useRef<(index: number, retry: boolean) => void>(() => {});
  const solvedAloud = useRef<(index: number) => void>(() => {});
  const finish = useRef<(result: TeachingEvaluationResult) => void>(() => {});
  const progress = usePropulsionProgress({
    challenges: items,
    getChallengeId: i => i.id,
    instanceId: resolvedInstanceId, objectiveId, planItemId: runtimePlanItemId,
    workspace, assignment: propulsionLabBoss.assignment,
    onItemOpened: (index, retry) => openItem.current(index, retry),
    onSolved: index => solvedAloud.current(index),
    onFinished: result => finish.current(result),
  });
  const { currentIndex, currentAttempts, results, isComplete } = progress;
  /** A checked answer stays closed until Try again or Next challenge on the shell. */
  const learnerBlocked = () => progress.canAttempt === false;

  const sessionItem: PropulsionItem | undefined = items[Math.min(currentIndex, Math.max(items.length - 1, 0))];
  const [practice, setPractice] = useState<PropulsionItem | null>(null);
  const item = practice ?? sessionItem;

  const [work, setWork] = useState<PropulsionWork>(() => emptyWork(sessionItem));
  /** The checked wrong work, shown until Try again. */
  const [wrongShown, setWrongShown] = useState(false);
  /** Experiment: the two tests last run. */
  const [ran, setRan] = useState<{ a: Setup; b: Setup } | null>(null);
  const [practiceSolved, setPracticeSolved] = useState(false);
  const [leverState, setLeverState] = useState<{ item: string; pulled: string[] }>({ item: '', pulled: [] });
  const [submitted, setSubmitted] = useState(false);
  const tappedCorrect = useRef<string | null>(null);

  const pulled = sessionItem && leverState.item === sessionItem.id && !practice ? leverState.pulled : [];
  const leverOn = (id: string) => pulled.includes(id);
  const solvedNow = practice ? practiceSolved || !!progress.practiceSolved : !!item && results.some(r => r.challengeId === item.id && r.correct);
  const revealed = solvedNow;

  const { submitResult, hasSubmitted } = usePrimitiveEvaluation<PropulsionLabMetrics>({
    primitiveType: 'propulsion-lab',
    instanceId: resolvedInstanceId,
    skillId, subskillId, objectiveId, exhibitId,
    onSubmit: onEvaluationSubmit as ((result: PrimitiveEvaluationResult) => void) | undefined,
  });

  const clearItem = (next?: PropulsionItem) => {
    setWork(emptyWork(next ?? item)); setWrongShown(false); setRan(null); setPracticeSolved(false);
  };

  openItem.current = (index, retry) => {
    if (retry) { clearItem(item); return; }
    setPractice(null); clearItem(items[index]);
  };

  solvedAloud.current = (index) => {
    const solved = items[index];
    if (!solved || solved.mode === 'experiment' || tappedCorrect.current === solved.id || results.some(r => r.challengeId === solved.id && r.correct)) return;
    progress.mergeResult({ challengeId: solved.id, correct: true, attempts: currentAttempts + 1 });
    setWork(w => ({ ...w, choice: keyOf(solved) })); setWrongShown(false);
  };

  // ── Handlers ──
  const closed = revealed || wrongShown || learnerBlocked();
  const pick = (c: Motion) => {
    if (!item || closed) return;
    SoundManager.select();
    setWork(w => ({ ...w, choice: c }));
  };
  const setTest = (test: 'a' | 'b', patch: Partial<Setup>) => {
    if (!item || item.mode !== 'experiment' || closed || (test === 'a' && item.lockA)) return;
    SoundManager.select();
    setWork(w => ({ ...w, [test]: { ...w[test], ...patch } }));
    setRan(null);
  };

  const check = () => {
    if (!item || closed || !workComplete(item, work)) return;
    const correct = propulsionCorrect(item, work);
    progress.commitCheck(describePropulsionWork(item, work), correct, correct ? undefined : propulsionMiss(item, work));
    if (item.mode === 'experiment') setRan({ a: { ...work.a }, b: { ...work.b } });
    if (correct) {
      SoundManager.playCorrect();
      if (practice) setPracticeSolved(true); else tappedCorrect.current = item.id;
      return;
    }
    SoundManager.playIncorrect();
    setWrongShown(true);
  };

  const metrics = (): PropulsionLabMetrics => {
    const right = items.filter(i => results.some(r => r.challengeId === i.id && r.correct));
    const combos = new Set<string>();
    for (const i of items) {
      if (i.mode === 'experiment') { combos.add(`${i.start.a.engine}-${i.start.a.place}`); combos.add(`${i.start.b.engine}-${i.start.b.place}`); }
      else for (const t of i.thrusters) combos.add(`${t.engine}-${i.place}`);
    }
    const dead = (i: PropulsionItem) => (i.mode === 'experiment' ? false : i.thrusters.some(t => !works(t.engine, i.place)));
    return {
      type: 'propulsion-lab',
      combinationsExplored: combos.size,
      combinationsTotal: 8,
      challengesCompleted: results.length,
      challengesCorrect: right.length,
      challengesTotal: items.length,
      noThrustDiscoveries: right.filter(dead).length,
      vacuumExperimentDone: right.some(i => (i.mode === 'experiment' ? i.question.vary === 'place' : i.place === 'space')),
      attemptsCount: currentAttempts,
    };
  };

  finish.current = (result) => {
    if (hasSubmitted || progress.recordsEvaluation === false || !items.length) return;
    setSubmitted(true);
    submitResult(result.passed, result.accuracy, { ...metrics(), attemptsCount: result.teachingAttempts.length },
      { challengeResults: result.outcomes, learningResponses: result.learningResponses,
        teachingAttempts: result.teachingAttempts, assistanceProvenance: result.assistanceProvenance },
      undefined, result.diagnosisEvidence);
  };

  // ── What the tutor and the observer are shown, republished every render ──
  useLayoutEffect(() => {
    if (!item || isComplete) return;
    const scene = workspaceScene(item, { work, solved: revealed, ran });
    const ctx = { work };
    // No lever on the practice item: the full item's levers come back with it.
    const levers = practice || !sessionItem ? [] : PROPULSION_LEVERS.declare(sessionItem, ctx, pulled);
    const withPractice = practice
      ? { ...scene, facts: { ...scene.facts, practice: 'A simpler item of the same kind, before the full item comes back.' } }
      : scene;
    workspace.current = {
      ...leverScene(withPractice, { support: '',
        onScreen: practice || !sessionItem ? '' : PROPULSION_LEVERS.onScreen(sessionItem, ctx, pulled) }),
      levers,
      pullLever: (id) => {
        const l = levers.find(x => x.id === id);
        if (practice || !l || !sessionItem) return `No lever ${id} on this item.`;
        if (l.pulled) return `${id} is already on screen.`;
        const nextState = { item: sessionItem.id, pulled: [...pulled, id] };
        if (l.kind === 'simplify') {
          const simpler = PROPULSION_LEVERS.simpler(sessionItem, ctx, id);
          if (!simpler) return 'There is no simpler item here; try a help lever.';
          setLeverState(nextState); clearItem(simpler); setPractice(simpler);
          return { practice: propulsionLabBoss.assignment(simpler) };
        }
        setLeverState(nextState);
        return true;
      },
      endPractice: () => { clearItem(sessionItem); setPractice(null); },
    };
  });

  const done = hasSubmitted || submitted || isComplete;

  if (!items.length) {
    return (
      <LuminaCard className={className}>
        <LuminaCardHeader><LuminaCardTitle>{title}</LuminaCardTitle></LuminaCardHeader>
        <LuminaCardContent><p className="text-sm text-slate-400">This lab has no questions to ask.</p></LuminaCardContent>
      </LuminaCard>
    );
  }

  const choiceState = (c: Motion): AnswerChoiceState => {
    if (!item || item.mode === 'experiment') return 'idle';
    const key = keyOf(item);
    if (revealed) return c === key ? 'correct' : c === work.choice ? 'incorrect' : 'dimmed';
    if (wrongShown && work.choice === c) return 'incorrect';
    return work.choice === c ? 'selected' : 'idle';
  };

  const choiceItem: ChoiceItem | null = item && item.mode !== 'experiment' ? item : null;
  const expItem = item?.mode === 'experiment' ? item : null;

  const testPanel = (test: 'a' | 'b') => {
    if (!expItem) return null;
    const s = work[test], name = test === 'a' ? 'A' : 'B';
    const locked = test === 'a' && expItem.lockA;
    const row = <K extends keyof Setup>(field: K, values: Setup[K][], text: (v: Setup[K]) => string) => (
      <div className="flex flex-wrap gap-2">
        {values.map(v => (
          <LuminaButton key={String(v)} size="sm" aria-label={testButton(name, text(v))} aria-pressed={s[field] === v}
            disabled={closed || locked} onClick={() => setTest(test, { [field]: v } as Partial<Setup>)}
            className={s[field] === v ? 'bg-white/15 ring-1 ring-white/30 text-white' : 'text-slate-400'}>
            {text(v)}
          </LuminaButton>
        ))}
      </div>
    );
    const shownRun = ran ? ran[test] : null;
    return (
      <LuminaPanel key={name} className="space-y-2" data-test={name}>
        <p className="text-xs uppercase tracking-wider text-slate-400">{`Test ${name}${locked ? ' (set)' : ''}`}</p>
        <PropulsionScene place={s.place} thrusters={testThrusters(s)} streams={!!shownRun} motion={shownRun ? (works(shownRun.engine, shownRun.place) ? 'Moves right' : 'Stays still') : null}
          speed={shownRun ? 0.5 + THROTTLE_SIZE[shownRun.throttle] * 0.5 : 0} clamp={false} arrows={false} ringAir={false} label={`Test ${name}: the craft`} />
        {row('engine', TEST_ENGINES, v => ENGINES[v].button)}
        {row('place', ['air', 'space'] as Place[], v => PLACE_TEXT[v].button)}
        {row('throttle', ['low', 'high'] as Setup['throttle'][], v => THROTTLE_TEXT[v])}
        {leverOn(CAN_PUSH_LEVER) && <p data-lever="can-push" className="text-xs text-amber-200">{canPushLine(s)}</p>}
        {shownRun && <p className="text-xs text-slate-300">{`Ran: ${testResult(shownRun)}.`}</p>}
      </LuminaPanel>
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
        {overview && !done && <p className="text-sm text-slate-400">{overview}</p>}
      </LuminaCardHeader>

      <LuminaCardContent className="space-y-4">
        {done ? (
          <LuminaFeedbackCard status="insight" label="Lab complete">
            {`${results.filter(r => r.correct).length} of ${items.length} items answered.`}
          </LuminaFeedbackCard>
        ) : item && (
          <>
            <LuminaPrompt accent="cyan" {...(practice ? { 'data-practice': 'simpler' } : {})}>{askOf(item)}</LuminaPrompt>

            {/* Pip comes from the workspace runner (`pip/WorkspacePip.tsx`): the dock above, the craft and the answer as its region. */}
            <PipDock />
            <PipWorkspace className="space-y-4">
              {choiceItem && (
                <PropulsionScene place={choiceItem.place} thrusters={choiceItem.thrusters}
                  streams={choiceItem.mode === 'observe' || revealed} motion={revealed ? keyOf(choiceItem) : null}
                  speed={speedOf(choiceItem.place, choiceItem.thrusters)} clamp={choiceItem.mode === 'observe' && !revealed}
                  arrows={leverOn(BLAST_ARROWS_LEVER) && !revealed} ringAir={leverOn(AIR_MARKS_LEVER)}
                  label={choiceItem.mode === 'observe' ? 'The craft in its clamp, its engines running' : 'The craft and its engines, switched off'} />
              )}

              {choiceItem?.mode === 'predict' && leverOn(HOW_IT_WORKS_LEVER) && (
                <LuminaPanel accent="cyan" data-lever="how-it-works" className="text-sm text-slate-300">
                  {howLines(choiceItem).map(l => <p key={l}>{l}</p>)}
                </LuminaPanel>
              )}
              {choiceItem?.mode === 'predict' && leverOn(AIR_MARKS_LEVER) && (
                <LuminaPanel accent="cyan" data-lever="air-marks" className="text-sm font-semibold text-amber-200">{airLine(choiceItem)}</LuminaPanel>
              )}
              {choiceItem?.mode === 'predict' && leverOn(BLAST_ARROWS_LEVER) && !revealed && (
                <LuminaPanel accent="cyan" data-lever="blast-arrows" className="text-sm text-slate-300">
                  A dashed arrow at each engine shows the way it is aimed to blast. Nothing is switched on yet.
                </LuminaPanel>
              )}
              {choiceItem?.mode === 'observe' && (leverOn(LABEL_STREAMS_LEVER) || leverOn(STREAM_UNITS_LEVER)) && (
                <LuminaPanel accent="cyan" data-lever={leverOn(LABEL_STREAMS_LEVER) ? 'label-streams' : 'stream-units'} className="space-y-1 text-sm text-slate-300">
                  {leverOn(LABEL_STREAMS_LEVER) && streamLines(choiceItem).map(l => <p key={l}>{l}</p>)}
                  {leverOn(STREAM_UNITS_LEVER) && <p data-lever="stream-units" className="font-mono">{unitLines(choiceItem).join('   ')}</p>}
                </LuminaPanel>
              )}

              {choiceItem && (
                <div className="grid grid-cols-3 gap-2">
                  {MOTIONS.map(c => (
                    <LuminaAnswerChoice key={c} aria-label={c} state={choiceState(c)} disabled={closed}
                      className="p-3 text-center font-semibold" onClick={() => pick(c)}>
                      {c}
                    </LuminaAnswerChoice>
                  ))}
                </div>
              )}

              {expItem && (
                <div className="space-y-3">
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    {testPanel('a')}
                    {testPanel('b')}
                  </div>
                  {leverOn(COMPARE_TESTS_LEVER) && (
                    <LuminaPanel accent="cyan" data-lever="compare-tests" className="space-y-1 text-sm text-slate-300">
                      {compareLines(work.a, work.b).map(l => <p key={l}>{l}</p>)}
                    </LuminaPanel>
                  )}
                </div>
              )}
            </PipWorkspace>

            {!revealed && (
              <div className="flex justify-center">
                <LuminaActionButton action="check" disabled={closed || !workComplete(item, work)} onClick={check}>
                  {item.mode === 'experiment' ? 'Run and check' : 'Check Answer'}
                </LuminaActionButton>
              </div>
            )}

            {revealed && <LuminaFeedbackCard status="correct">{revealText(item, work, ran)}</LuminaFeedbackCard>}
            {!revealed && wrongShown && (
              <LuminaFeedbackCard status="incorrect">
                {item.mode === 'experiment' ? 'These two tests cannot answer the question.' : 'That is not it.'}
              </LuminaFeedbackCard>
            )}
          </>
        )}
      </LuminaCardContent>
    </LuminaCard>
  );
};

const PropulsionLab = withWorkspaceOnly<PropulsionLabProps>('propulsion-lab', PropulsionLabSurface, props => props.data.title);

export default PropulsionLab;
