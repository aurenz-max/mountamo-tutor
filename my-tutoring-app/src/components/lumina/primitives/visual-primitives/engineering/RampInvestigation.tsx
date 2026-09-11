'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { LuminaButton, LuminaFeedbackCard, LuminaPanel } from '../../../ui';
import { SoundManager } from '../../../utils/SoundManager';
import { useLuminaAI } from '../../../hooks/useLuminaAI';
import { useJudgedScriptRunner, type JudgedRunSummary } from '../../../hooks/useJudgedScriptRunner';
import JudgedMicPanel from '../../../components/JudgedMicPanel';
import { rampExplanationPack } from './rampExplanationScript';
import { isFairRampTest, measureRampTrial, type RampInvestigationChallenge, type RampInvestigationResult, type RampScenario, type RampTrial } from './rampChallenges';

const surfaces = { none: 'Frictionless', low: 'Smooth', medium: 'Grippy', high: 'Rough' };

/** The bench raises force in half-newton steps and records only after motion. */
function RampTrialView({ side, setup, running, trial, onMeasured }: {
  side: 'a' | 'b'; setup: RampScenario; running: boolean; trial?: RampTrial; onMeasured: (trial: RampTrial) => void;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const callback = useRef(onMeasured); callback.current = onMeasured;
  const [push, setPush] = useState<number | null>(trial?.firstMovingForce ?? null);
  useEffect(() => {
    const ctx = canvas.current?.getContext('2d');
    if (!ctx) return;
    let frame = 0;
    let start: number | null = null;
    let finished = false;
    const result = measureRampTrial(side, setup);
    const angle = setup.angle * Math.PI / 180;
    const endX = 45 + Math.cos(angle) * 245;
    const endY = 180 - Math.sin(angle) * 245;
    function draw(now: number) {
      if (start === null) start = now;
      const elapsed = (now - start) / 1000;
      const force = running ? Math.min(result.firstMovingForce, Math.floor(elapsed * 60) * 0.5) : trial?.firstMovingForce ?? 0;
      const measuringSeconds = result.firstMovingForce / 30;
      const travel = running ? Math.min(0.75, Math.max(0, elapsed - measuringSeconds) * 0.8) : trial ? 0.75 : 0;
      ctx!.clearRect(0, 0, 330, 220);
      ctx!.fillStyle = '#0f172a'; ctx!.fillRect(0, 0, 330, 220);
      ctx!.strokeStyle = '#334155'; ctx!.lineWidth = 1;
      for (let x = 10; x < 330; x += 25) { ctx!.beginPath(); ctx!.moveTo(x, 0); ctx!.lineTo(x, 220); ctx!.stroke(); }
      ctx!.fillStyle = side === 'a' ? '#164e63' : '#4c1d95';
      ctx!.beginPath(); ctx!.moveTo(45, 180); ctx!.lineTo(endX, endY); ctx!.lineTo(endX, 180); ctx!.fill();
      ctx!.strokeStyle = setup.frictionLevel === 'high' ? '#fbbf24' : '#cbd5e1'; ctx!.lineWidth = setup.frictionLevel === 'high' ? 5 : 3;
      ctx!.beginPath(); ctx!.moveTo(45, 180); ctx!.lineTo(endX, endY); ctx!.stroke();
      ctx!.save(); ctx!.translate(45 + (endX - 45) * travel, 180 + (endY - 180) * travel); ctx!.rotate(-angle);
      ctx!.fillStyle = '#c4b5fd'; ctx!.fillRect(0, -31, 32, 30); ctx!.restore();
      ctx!.fillStyle = '#e2e8f0'; ctx!.font = '14px sans-serif';
      ctx!.fillText(`${setup.angle}° · ${setup.loadWeight} kg · ${surfaces[setup.frictionLevel]}`, 15, 205);
      if (running) {
        setPush(force);
        if (travel >= 0.75 && !finished) { finished = true; callback.current(result); return; }
        frame = requestAnimationFrame(draw);
      }
    }
    frame = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frame);
  }, [setup, side, running, trial]);
  return <div className="overflow-hidden rounded-xl border border-white/10">
    <canvas ref={canvas} width={330} height={220} role="img" aria-label={`Ramp ${side.toUpperCase()}: ${setup.angle} degrees, ${setup.loadWeight} kilograms, ${surfaces[setup.frictionLevel]} surface`} className="w-full" />
    <p className="px-3 py-2 text-sm text-slate-300" aria-live="polite">{trial ? `First moving push: ${trial.firstMovingForce.toFixed(1)} N` : running ? `Testing push: ${(push ?? 0).toFixed(1)} N` : 'Push measurement not taken yet'}</p>
  </div>;
}

function SpokenEvidence({ challenge, trials, instanceId, exhibitId, gradeLevel, onFinished }: {
  challenge: RampInvestigationChallenge; trials: RampTrial[]; instanceId: string; exhibitId?: string; gradeLevel: string;
  onFinished: (summary: JudgedRunSummary) => void;
}) {
  const pack = useMemo(() => rampExplanationPack(challenge, trials), [challenge, trials]);
  const runner = useJudgedScriptRunner({ pack, instanceId, exhibitId, gradeLevel, silenceCloseMs: 1200, onFinished });
  return <div className="space-y-3"><LuminaButton tone="ghost" onClick={runner.hearStimulus}>Hear the question</LuminaButton><JudgedMicPanel run={runner} /></div>;
}

export default function RampInvestigation({ challenge, instanceId, exhibitId, gradeLevel = '3', supportTier, onFinished }: {
  challenge: RampInvestigationChallenge; instanceId: string; exhibitId?: string; gradeLevel?: string;
  supportTier?: 'easy' | 'medium' | 'hard'; onFinished: (result: RampInvestigationResult) => void;
}) {
  const planning = challenge.mode === 'plan_fair_test';
  const [setupB, setSetupB] = useState(challenge.scenarios.b);
  const [phase, setPhase] = useState<'plan' | 'predict' | 'test' | 'explain' | 'done'>(planning ? 'plan' : 'predict');
  const [planAttempts, setPlanAttempts] = useState<RampInvestigationResult['planAttempts']>([]);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [prediction, setPrediction] = useState<'a' | 'b' | 'same' | null>(null);
  const [running, setRunning] = useState<'a' | 'b' | null>(null);
  const [trials, setTrials] = useState<RampTrial[]>([]);
  const finished = useRef(false);
  const spoken = phase === 'explain';
  const { sendText } = useLuminaAI({ primitiveType: 'ramp-lab', instanceId, exhibitId, gradeLevel,
    enabled: !spoken, primitiveData: { evalMode: challenge.mode, question: challenge.brief, phase,
      trialCount: String(trials.length), supportTier: supportTier ?? 'medium', feedback: feedback ?? 'No feedback yet' } });
  function commitPlan() {
    const fair = isFairRampTest(challenge.variable, challenge.scenarios.a, setupB);
    setPlanAttempts(previous => [...previous, { setup: { ...setupB }, fair }]);
    SoundManager[fair ? 'playCorrect' : 'playIncorrect']();
    if (fair) { setPhase('predict'); setFeedback(null); }
    else {
      const message = 'This comparison cannot isolate the requested change yet. Check what changed and what stayed the same.';
      setFeedback(message);
      sendText(`[RAMP_PLAN_RETRY] The learner tried a plan that does not isolate the requested variable. Say exactly: "${message}" Do not identify which setting to change.`, { silent: true });
    }
  }
  function finish(explanation?: RampInvestigationResult['explanation']) {
    if (finished.current || trials.length !== 2 || !prediction) return;
    finished.current = true;
    const a = trials.find(t => t.side === 'a')!; const b = trials.find(t => t.side === 'b')!;
    const expected = a.firstMovingForce === b.firstMovingForce ? 'same' : a.firstMovingForce < b.firstMovingForce ? 'a' : 'b';
    onFinished({ challengeId: challenge.id, mode: challenge.mode, solved: planning || !!explanation?.solved,
      firstTryCorrect: planning ? planAttempts.length === 1 && planAttempts[0].fair : !!explanation?.solved && explanation.corrections === 0,
      planAttempts, prediction, predictionCorrect: prediction === expected, trials, explanation });
    setPhase('done');
  }
  const measurementsComplete = trials.length === 2;
  return <div className="space-y-5" data-testid="ramp-investigation">
    <p className="text-sm text-cyan-200">{phase === 'plan' ? '1 · Set up a fair comparison' : phase === 'predict' ? '2 · Make a prediction' : phase === 'test' ? '3 · Collect your evidence' : phase === 'explain' ? '4 · Explain from evidence' : 'Investigation recorded'}</p>
    {supportTier !== 'hard' && <p className="text-sm text-slate-300">{phase === 'plan' ? 'Keep the box type the same. Change only the condition you are investigating.' : 'The test bench raises the push in 0.5 N steps until the box moves. Record both setups before drawing a conclusion.'}</p>}
    <div className="grid gap-4 md:grid-cols-2">
      {(['a', 'b'] as const).map(side => {
        const setup = side === 'a' ? challenge.scenarios.a : setupB;
        return <LuminaPanel key={side} accent={side === 'a' ? 'cyan' : 'purple'} className="space-y-3 p-4">
          <h4 className="font-semibold text-white">Setup {side.toUpperCase()}{side === 'a' ? ' · reference' : ''}</h4>
          <RampTrialView side={side} setup={setup} running={running === side} trial={trials.find(t => t.side === side)} onMeasured={trial => {
            setTrials(previous => previous.some(t => t.side === trial.side) ? previous : [...previous, trial]); setRunning(null); SoundManager.tick();
          }} />
          {side === 'b' && planning && <fieldset disabled={phase !== 'plan'} className="grid grid-cols-3 gap-2 text-sm text-slate-200">
            <label>Angle<select aria-label="Setup B angle" className="mt-1 block w-full rounded bg-slate-800 p-2" value={setupB.angle} onChange={e => { setSetupB({ ...setupB, angle: Number(e.target.value) }); setFeedback(null); }}>
              {[15, 25, 35].map(n => <option key={n} value={n}>{n}°</option>)}</select></label>
            <label>Mass<select aria-label="Setup B mass" className="mt-1 block w-full rounded bg-slate-800 p-2" value={setupB.loadWeight} onChange={e => { setSetupB({ ...setupB, loadWeight: Number(e.target.value) }); setFeedback(null); }}>
              {[2, 4, 6].map(n => <option key={n} value={n}>{n} kg</option>)}</select></label>
            <label>Surface<select aria-label="Setup B surface" className="mt-1 block w-full rounded bg-slate-800 p-2" value={setupB.frictionLevel} onChange={e => { setSetupB({ ...setupB, frictionLevel: e.target.value as RampScenario['frictionLevel'] }); setFeedback(null); }}>
              {(['low', 'medium', 'high'] as const).map(s => <option key={s} value={s}>{surfaces[s]}</option>)}</select></label>
          </fieldset>}
          {phase === 'test' && <LuminaButton tone="primary" disabled={running !== null || trials.some(t => t.side === side)} onClick={() => setRunning(side)}>Run trial {side.toUpperCase()}</LuminaButton>}
        </LuminaPanel>;
      })}
    </div>
    {feedback && <LuminaFeedbackCard status="incorrect">{feedback}</LuminaFeedbackCard>}
    {phase === 'plan' && <LuminaButton tone="primary" onClick={commitPlan}>Commit my plan</LuminaButton>}
    {phase === 'predict' && <div className="space-y-3">
      <p className="text-white">Which setup will need less push to start moving uphill?</p>
      <div className="flex flex-wrap gap-3">{(['a', 'b', 'same'] as const).map(choice => <LuminaButton key={choice} tone={prediction === choice ? 'primary' : 'subtle'} aria-pressed={prediction === choice} onClick={() => setPrediction(choice)}>{choice === 'same' ? 'The same push' : `Setup ${choice.toUpperCase()}`}</LuminaButton>)}</div>
      <LuminaButton tone="primary" disabled={!prediction} onClick={() => setPhase('test')}>Record prediction</LuminaButton>
    </div>}
    {trials.length > 0 && <div className="overflow-x-auto"><table className="w-full text-left text-sm text-slate-200"><caption className="mb-2 text-left font-semibold text-white">Your trial notebook</caption><thead><tr><th className="p-2">Setup</th><th className="p-2">Last still</th><th className="p-2">First moving</th></tr></thead><tbody>
      {[...trials].sort((a, b) => a.side.localeCompare(b.side)).map(trial => <tr key={trial.side} className="border-t border-white/10"><th className="p-2">{trial.side.toUpperCase()}</th><td className="p-2">{trial.lastStillForce.toFixed(1)} N</td><td className="p-2">{trial.firstMovingForce.toFixed(1)} N</td></tr>)}
    </tbody></table></div>}
    {phase === 'test' && measurementsComplete && <LuminaButton tone="primary" onClick={() => planning ? finish() : setPhase('explain')}>{planning ? 'Record investigation' : 'Explain my results'}</LuminaButton>}
    {spoken && <SpokenEvidence challenge={challenge} trials={trials} instanceId={instanceId} exhibitId={exhibitId} gradeLevel={gradeLevel} onFinished={summary => {
      const outcome = summary.outcomes[0];
      finish({ solved: outcome?.solved ?? false, corrections: outcome?.corrections ?? 2, score: outcome?.score ?? 0 });
    }} />}
    {phase === 'done' && <LuminaFeedbackCard status="insight">Your plan, prediction, and measurements are saved separately. {planning ? 'A fair comparison lets you investigate one condition at a time.' : 'Use the trial notebook when you explain what changed.'}</LuminaFeedbackCard>}
  </div>;
}
