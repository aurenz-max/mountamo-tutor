'use client';

/**
 * Lever Lab open builds: `build_balance` (seat kids so the seesaw stays level) and `build_lift` (place a fulcrum and
 * a helper so the rock comes up). The scene is one svg held still by blocks while the learner builds; "I'm done!"
 * takes the blocks away and the code judge (`leverLabBuild.ts`) decides how the bar moves. Try again keeps the build;
 * Start over clears it. Rendered by LeverLab when the payload carries `challenges`; older payloads keep the sandbox.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  LuminaCard, LuminaCardContent, LuminaCardHeader, LuminaCardTitle, LuminaBadge, LuminaPrompt,
  LuminaButton, LuminaActionButton, LuminaFeedbackCard,
} from '../../../ui';
import { usePrimitiveEvaluation, type PrimitiveEvaluationResult } from '../../../evaluation';
import type { LeverLabMetrics } from '../../../evaluation/types';
import type { DiagnosisEvidence } from '../../../evaluation/diagnosis/types';
import { useChallengeProgress } from '../../../hooks/useChallengeProgress';
import { usePhaseResults, type PhaseConfig } from '../../../hooks/usePhaseResults';
import PhaseSummaryPanel from '../../../components/PhaseSummaryPanel';
import { SoundManager } from '../../../utils/SoundManager';
import { useBuildWatcher } from '../../build-layer/buildLayer';
import {
  judgeBalance, judgeLift, seatingKey, spotWord, sizeWord, LEVER_MISS_WORDS, LEVER_PASS_WORDS, LIFT_BAR, MAX_SEATED, SEATS,
  type LeverBuildChallenge, type LeverVerdict, type SeatedKid,
} from './leverLabBuild';

export interface LeverBuildData {
  title: string;
  description?: string;
  challenges: LeverBuildChallenge[];
  instanceId?: string;
  skillId?: string;
  subskillId?: string;
  objectiveId?: string;
  exhibitId?: string;
  onEvaluationSubmit?: (result: PrimitiveEvaluationResult<LeverLabMetrics>) => void;
}

const PHASES: Record<string, PhaseConfig> = {
  build_balance: { label: 'Balance the seesaw', icon: '⚖️', accentColor: 'orange' },
  build_lift: { label: 'Lift the rock', icon: '🪨', accentColor: 'amber' },
};

const W = 640, H = 320, BEAM_Y = 170, GROUND_Y = 272;
// Seesaw: seats every 56 units from the middle.
const MID = W / 2, STEP = 56;
const seatX = (seat: number) => MID + seat * STEP;
// Lift bar: marks 0..LIFT_BAR every 52 units.
const barX = (p: number) => 60 + p * 52;
const KID_COLORS = ['#38bdf8', '#a78bfa', '#f472b6', '#facc15', '#34d399'];
const kidR = (weight: number) => 12 + weight * 3;

function Kid({ x, weight, icon, color, onTap, ...rest }: { x: number; weight: number; icon: string; color: string; onTap?: () => void }) {
  const r = kidR(weight);
  return (
    <g transform={`translate(${x}, ${BEAM_Y - 15 - r})`} onClick={onTap} style={{ cursor: onTap ? 'pointer' : 'default' }} {...rest}>
      <circle r={r} fill={color} stroke="rgba(255,255,255,0.6)" strokeWidth={2} />
      <text y={r * 0.35} textAnchor="middle" fontSize={r * 1.05} style={{ pointerEvents: 'none' }}>{icon}</text>
      <circle cx={r * 0.8} cy={-r * 0.8} r={10} fill="#0f172a" stroke="white" strokeWidth={1.5} />
      <text x={r * 0.8} y={-r * 0.8 + 4} textAnchor="middle" fontSize={12} fontWeight={700} fill="white" style={{ pointerEvents: 'none' }}>{weight}</text>
    </g>
  );
}

const LeverBuild: React.FC<{ data: LeverBuildData; className?: string }> = ({ data, className }) => {
  const { title, description, challenges, instanceId, skillId, subskillId, objectiveId, exhibitId, onEvaluationSubmit } = data;

  const { currentIndex, results, isComplete, recordResult, incrementAttempts, advance } = useChallengeProgress({
    challenges, getChallengeId: (c) => c.id,
  });
  const phaseResults = usePhaseResults({ challenges, results, isComplete, getChallengeType: (c) => c.type, phaseConfig: PHASES,
    getScore: (rs) => Math.round(rs.reduce((s, r) => s + (r.score ?? 0), 0) / Math.max(1, rs.length)) });
  const ch = challenges[currentIndex] ?? null;
  const isBalance = ch?.type === 'build_balance';

  const instanceRef = useRef(instanceId || `lever-lab-${Date.now()}`);
  const { submitResult, hasSubmitted, submittedResult, elapsedMs } = usePrimitiveEvaluation<LeverLabMetrics>({
    primitiveType: 'lever-lab', instanceId: instanceId || instanceRef.current, skillId, subskillId, objectiveId, exhibitId,
    onSubmit: onEvaluationSubmit as ((r: PrimitiveEvaluationResult) => void) | undefined,
  });

  // The build: seated kids (balance), or a fulcrum spot and the helper's spot (lift).
  const [placed, setPlaced] = useState<SeatedKid[]>([]);
  const [fulcrum, setFulcrum] = useState<number | null>(null);
  const [pusherAt, setPusherAt] = useState<number | null>(null);
  const [weight, setWeight] = useState<number>(ch?.palette?.[0] ?? 1);
  const [verdict, setVerdict] = useState<LeverVerdict | null>(null);
  const [misses, setMisses] = useState(0);
  const passedKeys = useRef<Record<string, string>>({});
  const observations = useRef<Array<{ itemId: string; challenge: string; observed: string; miss: string }>>([]);
  const missCounts = useRef<Record<string, number>>({});
  // The summary waits for "See results", so the last item's verdict stays on screen until the learner moves on.
  const [showResults, setShowResults] = useState(false);
  const svgRef = useRef<SVGSVGElement>(null);

  // A new item opens an empty scene.
  useEffect(() => {
    setPlaced([]); setFulcrum(null); setPusherAt(null); setVerdict(null); setMisses(0);
    setWeight(ch?.palette?.[0] ?? 1);
  }, [ch?.id, ch?.palette]);

  const checked = verdict !== null;
  const passed = !!verdict?.pass;
  const building = !!ch && !checked && !showResults;
  const hasWork = isBalance ? placed.length > 0 : fulcrum !== null || pusherAt !== null;
  const ready = isBalance ? placed.length > 0 : fulcrum !== null && pusherAt !== null;

  const describeBuild = useCallback((): string => {
    if (!ch) return '';
    if (isBalance) return placed.length ? `Right side: ${[...placed].sort((a, b) => a.seat - b.seat).map(k => `weight ${k.weight} at seat ${k.seat}`).join(', ')}` : 'Right side empty';
    return `Fulcrum at ${fulcrum ?? 'none'}, helper (weight ${ch.pusherWeight}) at ${pusherAt ?? 'none'}; rock (weight ${ch.rockWeight}) at 0`;
  }, [ch, isBalance, placed, fulcrum, pusherAt]);

  const handleDone = () => {
    if (!ch || !ready) return;
    const prev = ch.differentFrom ? passedKeys.current[ch.differentFrom] : undefined;
    const v = isBalance
      ? judgeBalance(ch.given ?? [], placed, prev)
      : judgeLift(ch.rockWeight ?? 1, ch.pusherWeight ?? 1, { fulcrum, pusherAt }, prev !== undefined ? Number(prev) : undefined);
    if (!v) return;
    incrementAttempts();
    setVerdict(v);
    if (v.pass) {
      SoundManager.playCorrect();
      passedKeys.current[ch.id] = isBalance ? seatingKey(placed) : String(fulcrum);
      recordResult({ challengeId: ch.id, correct: true, attempts: misses + 1, score: misses === 0 ? 100 : misses === 1 ? 67 : 33, misses });
    } else {
      SoundManager.playIncorrect();
      setMisses(m => m + 1);
      missCounts.current[v.miss!] = (missCounts.current[v.miss!] ?? 0) + 1;
      observations.current.push({ itemId: ch.id, challenge: ch.instruction, observed: describeBuild(), miss: v.miss! });
    }
  };

  const tryAgain = () => { SoundManager.tap(); setVerdict(null); };
  const startOver = () => { SoundManager.tap(); setPlaced([]); setFulcrum(null); setPusherAt(null); setVerdict(null); };
  const next = () => { SoundManager.navigate(); if (!advance()) setShowResults(true); };

  // Submit once every item has a result.
  useEffect(() => {
    if (!isComplete || hasSubmitted || !challenges.length) return;
    const solved = results.filter(r => r.correct);
    const firstTry = results.filter(r => r.correct && (r.misses as number) === 0).length;
    const accuracy = Math.round(results.reduce((s, r) => s + (r.score ?? 0), 0) / challenges.length);
    const modes = Array.from(new Set(challenges.map(c => c.type)));
    const metrics: LeverLabMetrics = {
      type: 'lever-lab', evalMode: modes.length === 1 ? modes[0] : 'mixed', accuracy,
      challengesTotal: challenges.length, challengesSolved: solved.length, firstTryCorrect: firstTry,
      totalAttempts: results.reduce((s, r) => s + r.attempts, 0), misses: { ...missCounts.current },
    };
    const obs = observations.current;
    const evidence: DiagnosisEvidence | undefined = obs.length ? {
      firstResponseScore: Math.round((firstTry / challenges.length) * 100),
      challengeSummary: `Lever open builds, ${challenges.length} items; "I'm done!" is code-judged by weight x distance on each side, and a miss keeps the build for another try.`,
      expected: challenges.map(c => c.type === 'build_balance'
        ? `Right side turning effect equal to the left (weight x seat = ${(c.given ?? []).reduce((s, k) => s + k.weight * -k.seat, 0)})`
        : `Helper across the fulcrum from the rock, helper weight x distance >= rock weight ${c.rockWeight} x fulcrum distance`).join('; ').slice(0, 2000),
      observed: obs.map(o => `${o.observed} -> ${o.miss}`).join('; ').slice(0, 2000),
      priorAttempts: obs.slice(0, 12).map(o => ({ challenge: o.challenge, observed: `${o.observed} (${o.miss})` })),
    } : undefined;
    submitResult(solved.length === challenges.length, accuracy, metrics, { results, builds: passedKeys.current }, undefined, evidence);
  }, [isComplete, hasSubmitted, challenges, results, submitResult]);

  // The live line (shared build layer). Every weight and seat is a number, so the line may say none; it may not say
  // whether the bar will tip, since that is what "I'm done!" shows.
  const madeFacts = !ch ? '' : isBalance
    ? `kids the child seated on the right: ${placed.map(k => `${sizeWord(k.weight)} ${spotWord(k.seat, SEATS)}`).join('; ') || 'none'}`
    : `fulcrum: ${fulcrum === null ? 'not placed' : spotWord(fulcrum, LIFT_BAR) === 'near the middle' ? 'close to the rock' : spotWord(fulcrum, LIFT_BAR) === 'at the far end' ? 'far from the rock' : 'between the rock and the middle'}; `
      + `helper: ${pusherAt === null ? 'not placed' : pusherAt < (fulcrum ?? 0) ? 'between the rock and the fulcrum' : spotWord(pusherAt, LIFT_BAR)}`;
  const seeing = useBuildWatcher({
    buildKey: `${ch?.id}:${seatingKey(placed)}:${fulcrum}:${pusherAt}`,
    enabled: building && hasWork,
    svg: svgRef,
    request: {
      task: isBalance ? 'Seating kids on one side of a seesaw' : 'Building a lever with a bar, a fulcrum and a helper next to a rock',
      numbers: 'never',
      neverSay: ['level', 'balance', 'balanced', 'tip', 'tips', 'tilt', 'heavy', 'heavier', 'light', 'lighter', 'even', 'equal',
        'lift', 'lifts', 'lifting', 'strong', 'stronger', 'weak', 'enough', 'right', 'wrong', 'correct', 'win'],
      sceneNote: isBalance
        ? 'A seesaw on a triangle, held still by wooden blocks under both ends. A kid already sits on the left side; the child seats kids on the right.'
        : 'A bar held still by wooden blocks, with a grey rock on its left end. The child places the triangle fulcrum under the bar and a helper on the bar.',
      made: madeFacts,
    },
  });

  // ── scene taps ──
  const tapSeat = (seat: number) => {
    if (!building || !ch) return;
    if (placed.some(k => k.seat === seat)) return;
    if (placed.length >= MAX_SEATED) { SoundManager.invalid(); return; }
    SoundManager.snap();
    setPlaced(p => [...p, { seat, weight, icon: '' }]);
  };
  const removeKid = (seat: number) => { if (!building) return; SoundManager.pop(); setPlaced(p => p.filter(k => k.seat !== seat)); };
  const tapFulcrumSlot = (p: number) => {
    if (!building || p === pusherAt) return;
    SoundManager.snap(); setFulcrum(f => (f === p ? null : p));
  };
  const tapSpot = (p: number) => {
    if (!building || p === fulcrum) return;
    SoundManager.snap(); setPusherAt(s => (s === p ? null : p));
  };

  // Tilt after the check only. Balance turns about the middle; lift about the fulcrum.
  const angle = !checked ? 0 : verdict!.tilt * (isBalance ? 11 : verdict!.tilt > 0 ? 14 : 5);
  const pivotX = isBalance ? MID : barX(fulcrum ?? 0);
  // A CSS transform (not the svg attribute) so the bar swings when the blocks come away.
  const beamStyle: React.CSSProperties = {
    transform: `rotate(${angle}deg)`, transformOrigin: `${pivotX}px ${BEAM_Y}px`, transformBox: 'view-box', transition: 'transform 0.7s ease-in',
  };

  const renderBalance = () => {
    const given = ch!.given ?? [];
    return (
      <>
        <g style={beamStyle} data-beam data-tilt={checked ? verdict!.tilt : 0}>
          <rect x={MID - (SEATS + 0.5) * STEP} y={BEAM_Y - 9} width={(2 * SEATS + 1) * STEP} height={18} rx={6} fill="#8B5A2B" stroke="rgba(255,255,255,0.25)" />
          {Array.from({ length: 2 * SEATS + 1 }, (_, i) => i - SEATS).filter(d => d !== 0).map(d => (
            <g key={d}>
              <rect x={seatX(d) - 14} y={BEAM_Y - 12} width={28} height={6} rx={3} fill="#5b3a1a" />
              <text data-aid x={seatX(d)} y={BEAM_Y + 26} textAnchor="middle" fontSize={12} fill="#94a3b8">{Math.abs(d)}</text>
            </g>
          ))}
          {/* Empty right seats: ghost targets (help, not work). */}
          {building && Array.from({ length: SEATS }, (_, i) => i + 1).filter(d => !placed.some(k => k.seat === d)).map(d => (
            // The whole column above a seat is the tap target, so it stays finger-sized at phone width.
            <g key={`t${d}`} data-aid data-seat={d} style={{ cursor: 'pointer' }} onClick={() => tapSeat(d)}>
              <rect x={seatX(d) - 27} y={BEAM_Y - 92} width={54} height={84} fill="transparent" style={{ pointerEvents: 'all' }} />
              <circle cx={seatX(d)} cy={BEAM_Y - 30} r={20} fill="rgba(255,255,255,0.04)" stroke="rgba(255,255,255,0.35)" strokeDasharray="4 4" />
            </g>
          ))}
          {given.map((k, i) => <Kid key={`g${i}`} data-given x={seatX(k.seat)} weight={k.weight} icon={k.icon} color="#fb923c" />)}
          {placed.map(k => (
            <Kid key={`p${k.seat}`} data-placed={k.seat} x={seatX(k.seat)} weight={k.weight} icon={k.icon || '🧒'}
              color={KID_COLORS[(k.weight - 1) % KID_COLORS.length]} onTap={() => removeKid(k.seat)} />
          ))}
        </g>
        <polygon points={`${MID},${BEAM_Y + 9} ${MID - 34},${GROUND_Y} ${MID + 34},${GROUND_Y}`} fill="#475569" stroke="#64748b" strokeWidth={2} />
      </>
    );
  };

  const renderLift = () => (
    <>
      <g style={beamStyle} data-beam data-tilt={checked ? verdict!.tilt : 0}>
        <rect x={barX(0) - 30} y={BEAM_Y - 8} width={barX(LIFT_BAR) - barX(0) + 50} height={16} rx={5} fill="#64748b" stroke="rgba(255,255,255,0.3)" />
        {Array.from({ length: LIFT_BAR + 1 }, (_, p) => (
          <text key={p} data-aid x={barX(p)} y={BEAM_Y + 24} textAnchor="middle" fontSize={11} fill="#94a3b8">{p}</text>
        ))}
        {/* The rock on the left end. */}
        <g data-rock transform={`translate(${barX(0)}, ${BEAM_Y - 34})`}>
          <ellipse rx={34} ry={26} fill="#78716c" stroke="#a8a29e" strokeWidth={2} />
          <text y={9} textAnchor="middle" fontSize={26} style={{ pointerEvents: 'none' }}>🪨</text>
          <circle cx={26} cy={-20} r={11} fill="#0f172a" stroke="white" strokeWidth={1.5} />
          <text x={26} y={-16} textAnchor="middle" fontSize={12} fontWeight={700} fill="white">{ch!.rockWeight}</text>
        </g>
        {building && Array.from({ length: LIFT_BAR }, (_, i) => i + 1).filter(p => p !== pusherAt && p !== fulcrum).map(p => (
          <g key={`s${p}`} data-aid data-spot={p} style={{ cursor: 'pointer' }} onClick={() => tapSpot(p)}>
            <rect x={barX(p) - 25} y={BEAM_Y - 92} width={50} height={84} fill="transparent" style={{ pointerEvents: 'all' }} />
            <circle cx={barX(p)} cy={BEAM_Y - 28} r={18} fill="rgba(255,255,255,0.04)" stroke="rgba(255,255,255,0.35)" strokeDasharray="4 4" />
          </g>
        ))}
        {pusherAt !== null && (
          <Kid data-pusher={pusherAt} x={barX(pusherAt)} weight={ch!.pusherWeight ?? 1} icon="🧒" color="#38bdf8" onTap={() => tapSpot(pusherAt)} />
        )}
      </g>
      {building && Array.from({ length: LIFT_BAR - 1 }, (_, i) => i + 1).filter(p => p !== fulcrum && p !== pusherAt).map(p => (
        <rect key={`f${p}`} data-aid data-fulcrum-slot={p} x={barX(p) - 24} y={BEAM_Y + 12} width={48} height={GROUND_Y - BEAM_Y - 14}
          rx={6} fill="rgba(255,255,255,0.03)" stroke="rgba(255,255,255,0.2)" strokeDasharray="4 4" style={{ cursor: 'pointer' }}
          onClick={() => tapFulcrumSlot(p)} />
      ))}
      {fulcrum !== null && (
        <polygon data-fulcrum={fulcrum} points={`${barX(fulcrum)},${BEAM_Y + 8} ${barX(fulcrum) - 26},${GROUND_Y} ${barX(fulcrum) + 26},${GROUND_Y}`}
          fill="#475569" stroke="#94a3b8" strokeWidth={2} style={{ cursor: building ? 'pointer' : 'default' }} onClick={() => tapFulcrumSlot(fulcrum)} />
      )}
    </>
  );

  const missWords = verdict && !verdict.pass && ch ? LEVER_MISS_WORDS[ch.type][verdict.miss!] : '';

  return (
    <LuminaCard className={`w-full max-w-4xl mx-auto ${className ?? ''}`}>
      <LuminaCardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <LuminaCardTitle className="text-lg">{title}</LuminaCardTitle>
          {!showResults && <LuminaBadge>{currentIndex + 1} / {challenges.length}</LuminaBadge>}
        </div>
        {description && <p className="text-sm text-slate-400 mt-1">{description}</p>}
      </LuminaCardHeader>
      <LuminaCardContent className="space-y-4">
        {showResults && phaseResults.length > 0 && (
          <PhaseSummaryPanel phases={phaseResults}
            overallScore={submittedResult?.score ?? Math.round(results.reduce((s, r) => s + (r.score ?? 0), 0) / Math.max(1, challenges.length))}
            durationMs={elapsedMs} heading="Lever Lab Complete!" celebrationMessage="You built levers that work!" />
        )}
        {ch && !showResults && (
          <>
            <LuminaPrompt>
              <p className="text-slate-100">{ch.instruction}</p>
              <p className="mt-1 text-xs text-slate-400">
                {isBalance
                  ? 'Pick a kid below, then tap a seat on the right. Tap a kid to take them off.'
                  : 'Tap under the bar to put the fulcrum there. Tap on the bar to put the helper there. Tap again to take one away.'}
              </p>
            </LuminaPrompt>

            <div className="rounded-2xl border border-slate-700/50 bg-slate-800/40 overflow-hidden">
              <svg ref={svgRef} data-build-scene={isBalance ? 'seesaw' : 'lift'} viewBox={`0 0 ${W} ${H}`} className="w-full h-auto select-none"
                style={{ maxHeight: 380, touchAction: 'manipulation' }} role="img" aria-label={isBalance ? 'Seesaw' : 'Lever and rock'}>
                <rect width={W} height={H} fill="#0f172a" />
                <rect y={GROUND_Y} width={W} height={H - GROUND_Y} fill="#14532d" opacity={0.5} />
                {/* Blocks hold the bar still while the learner builds; "I'm done!" takes them away. */}
                {!checked && (isBalance
                  ? [MID - (SEATS + 0.1) * STEP, MID + (SEATS - 0.6) * STEP].map(x => (
                    <rect key={x} data-chock x={x} y={BEAM_Y + 9} width={30} height={GROUND_Y - BEAM_Y - 9} fill="#a16207" stroke="#ca8a04" />))
                  : [barX(0) - 22, barX(LIFT_BAR) - 30].map(x => (
                    <rect key={x} data-chock x={x} y={BEAM_Y + 8} width={22} height={GROUND_Y - BEAM_Y - 8} fill="#a16207" stroke="#ca8a04" />)))}
                {isBalance ? renderBalance() : renderLift()}
              </svg>
            </div>

            {isBalance && building && (
              <div className="flex flex-wrap justify-center gap-2" data-pip-object="tray">
                {(ch.palette ?? []).map(w => (
                  <button key={w} type="button" data-pip-object={`tray-${w}`} aria-label={`Kid who weighs ${w}`} aria-pressed={weight === w}
                    onClick={() => { SoundManager.select(); setWeight(w); }}
                    className={`min-h-[44px] min-w-[64px] rounded-xl border px-3 py-1.5 text-sm transition ${weight === w
                      ? 'border-orange-400 bg-orange-500/20 text-orange-100' : 'border-white/15 bg-white/5 text-slate-200 hover:bg-white/10'}`}>
                    <span className="mr-1" style={{ fontSize: 14 + w * 2 }}>🧒</span>{w}
                  </button>
                ))}
              </div>
            )}

            {seeing && building && (
              <div data-testid="build-watcher" className="text-center">
                <span className="rounded-full bg-white/10 px-4 py-1.5 text-base text-amber-100">👀 {seeing}</span>
              </div>
            )}

            {checked && (
              <LuminaFeedbackCard status={passed ? 'correct' : 'incorrect'}>
                {passed ? LEVER_PASS_WORDS[ch.type] : `Not yet. ${missWords}`}
              </LuminaFeedbackCard>
            )}

            <div className="flex flex-wrap justify-center gap-3">
              {passed ? (
                <LuminaActionButton action="next" onClick={next}>
                  {currentIndex + 1 < challenges.length ? 'Next →' : 'See results →'}
                </LuminaActionButton>
              ) : checked ? (
                <LuminaActionButton action="retry" onClick={tryAgain}>Try again</LuminaActionButton>
              ) : (
                <>
                  <LuminaButton disabled={!hasWork} onClick={startOver}>Start over</LuminaButton>
                  <LuminaActionButton action="check" disabled={!ready} onClick={handleDone}>I&apos;m done!</LuminaActionButton>
                </>
              )}
            </div>
          </>
        )}
      </LuminaCardContent>
    </LuminaCard>
  );
};

export default LeverBuild;
