'use client';

/**
 * Machine Workshop's bench, drawn in 2D from the side (SVG). User 11-05: 3D made the task harder without teaching
 * more; from the side every motion the lesson is about lies flat in the picture: the wheels spin, the peg goes round
 * in a circle, the slider goes straight up and down, the beam rocks.
 *
 * The bench plays back the poses `machineModel.ts` computed; it decides nothing. Before anything is fitted the wheel
 * spins on its own and the working end shows the up-and-down it needs, so the problem is on screen before any words.
 * While a run plays, the peg's circle and the slider's line are traced: that is the principle, drawn.
 */
import React, { useEffect, useRef, useState } from 'react';
import {
  KIND_NAMES, hasBeam, isConverter, loadStage, endWord, type Build, type MachineChallenge, type Pose, type TrayPart,
} from './machineModel';

export interface MachineBenchProps {
  item: MachineChallenge;
  build: Build;
  /** The run playing now (frames from the model) and a key that restarts it. */
  run: { frames: readonly Pose[]; key: string } | null;
  solved: boolean;
  /** A tap on a fitted part takes it off. */
  onTapPlaced?: (slot: 'driver' | 'link') => void;
  disabled?: boolean;
  className?: string;
}

const S = 100; // px per model unit
const SH = 1.1; // shaft height above the bench top
const REST_TOP = SH + 2.0;
const CAM_BASE = 0.2;
const BIG_GEAR = 0.7, SMALL_GEAR = 0.3, STEP = 1.9;
const FLUID = { oil: '#1f1a14', water: '#4aa8ff', air: '#e2e8f0' } as const;
const C = { wood: '#a5703f', steel: '#b8c2cc', dark: '#56606b', brass: '#d4a440', red: '#d9483b', green: '#22a35a', blue: '#3b82f6', ink: '#0f172a' };

export function benchLayout(c: MachineChallenge) {
  const slot = c.stages.findIndex(s => isConverter(s.kind));
  const spin = c.stages.slice(0, slot);
  const xs: number[] = [];
  spin.forEach((s, i) => xs.push(i === 0 ? 0 : xs[i - 1] + (s.kind === 'gearbox' ? BIG_GEAR + SMALL_GEAR + 0.12 : STEP)));
  const slotX = xs[xs.length - 1];
  const beam = hasBeam(c);
  const load = loadStage(c).kind;
  const endX = beam ? slotX + 3.4 : load === 'stamp' ? slotX + 1.3 : slotX;
  const ratios: number[] = [], signs: number[] = [];
  for (let i = spin.length - 1; i >= 0; i--) {
    if (i === spin.length - 1) { ratios[i] = 1; signs[i] = 1; continue; }
    const next = spin[i + 1].kind;
    ratios[i] = ratios[i + 1] * (next === 'gearbox' ? BIG_GEAR / SMALL_GEAR : next === 'belt' ? 1.6 : 1);
    signs[i] = signs[i + 1] * (next === 'gearbox' ? -1 : 1);
  }
  const minX = -1.3, maxX = Math.max(endX, slotX) + 1.5;
  const top = spin[0]?.kind === 'windmill' ? 5.4 : 4.9, bottom = -0.75;
  return { spin, xs, slotX, beam, load, endX, ratios, signs, minX, maxX, top, bottom };
}

const wheelR = (kind: string) => (kind === 'gearbox' ? BIG_GEAR : kind === 'belt' ? 0.6 : 0.35);

/** A spur gear's outline around (0,0), radius r (model units, drawn in px). */
function gearPath(r: number, teeth: number): string {
  const pts: string[] = [];
  for (let i = 0; i < teeth * 4; i++) {
    const a = (i / (teeth * 4)) * Math.PI * 2;
    const rr = (i % 4 === 1 || i % 4 === 2 ? r + 0.06 : r - 0.02) * S;
    pts.push(`${(Math.sin(a) * rr).toFixed(1)},${(-Math.cos(a) * rr).toFixed(1)}`);
  }
  return `M${pts.join('L')}Z`;
}
/** A cam: round base with one smooth bump pointing up at angle 0. */
function camPath(lift: number): string {
  const pts: string[] = [];
  for (let i = 0; i <= 64; i++) {
    const a = (i / 64) * Math.PI * 2;
    const rr = (CAM_BASE + (lift * (1 + Math.cos(a))) / 2) * S;
    pts.push(`${(Math.sin(a) * rr).toFixed(1)},${(-Math.cos(a) * rr).toFixed(1)}`);
  }
  return `M${pts.join('L')}Z`;
}
const Spokes: React.FC<{ r: number; color: string }> = ({ r, color }) => (
  <g>
    <circle r={r * S} fill="none" stroke={color} strokeWidth={6} />
    {[0, 45, 90, 135].map(a => <line key={a} x1={0} y1={-r * S} x2={0} y2={r * S} stroke={color} strokeWidth={4} transform={`rotate(${a})`} />)}
    <circle r={6} fill={C.dark} />
  </g>
);

/** A tray part's picture, for the tray buttons (same shapes as on the bench). */
export const PartIcon: React.FC<{ part: TrayPart; size?: number }> = ({ part, size = 56 }) => {
  const box = 120;
  let body: React.ReactNode;
  if (part.part === 'crank') {
    const r = Math.min(0.42, part.value);
    body = <g transform="translate(60,60)"><circle r={(r + 0.12) * S} fill={C.red} /><circle cy={-r * S} r={7} fill={C.steel} stroke={C.ink} strokeWidth={2} /><circle r={5} fill={C.dark} /></g>;
  } else if (part.part === 'cam') {
    body = <g transform="translate(60,64) scale(0.8)"><path d={camPath(Math.min(0.5, part.value))} fill={C.green} /><circle r={5} fill={C.dark} /></g>;
  } else if (part.part === 'pinion') {
    body = <g transform="translate(60,60)"><path d={gearPath(0.32, 10)} fill={C.brass} /><circle r={5} fill={C.dark} /></g>;
  } else if (part.part === 'rod') {
    const len = Math.min(100, Math.max(40, part.value * 70));
    body = <g transform="translate(60,60) rotate(-35)"><rect x={-5} y={-len / 2} width={10} height={len} rx={5} fill={C.steel} stroke={C.ink} strokeWidth={2} /><circle cy={len / 2 - 6} r={4} fill={C.ink} /></g>;
  } else if (part.part === 'follower') {
    body = <g transform="translate(60,30)"><rect x={-4} y={0} width={8} height={62} fill={C.steel} /><circle cy={70} r={11} fill={C.dark} /></g>;
  } else {
    body = <g transform="translate(55,12)"><rect x={0} y={0} width={14} height={96} fill={C.brass} />{Array.from({ length: 9 }, (_, k) => <rect key={k} x={-8} y={6 + k * 10} width={8} height={5} fill={C.brass} />)}</g>;
  }
  return <svg width={size} height={size} viewBox={`0 0 ${box} ${box}`} aria-hidden>{body}</svg>;
};

export const MachineBench: React.FC<MachineBenchProps> = ({ item: c, build, run, solved, onTapPlaced, disabled, className }) => {
  const L = benchLayout(c);
  const driver = c.tray.find(p => p.id === build.driver) ?? null;
  const link = c.tray.find(p => p.id === build.link) ?? null;

  // The clock: a run plays its frames; with nothing on the wheel, the wheel spins on its own to show the problem.
  const [now, setNow] = useState(0);
  const start = useRef(0);
  const idleSpin = !run && !driver && !solved;
  useEffect(() => {
    if (!run && !idleSpin) return;
    start.current = performance.now();
    let raf = 0;
    const step = () => {
      setNow(performance.now() - start.current);
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [run?.key, idleSpin]); // eslint-disable-line react-hooks/exhaustive-deps

  let f: Pose = { slotAngle: 0, d: 0, shake: 0, effect: false };
  let frameIndex = 0;
  if (run) {
    frameIndex = Math.min(run.frames.length - 1, Math.floor((now / 1000) * 60));
    f = run.frames[frameIndex];
  } else if (idleSpin) {
    f = { ...f, slotAngle: (now / 1000) * 2 * Math.PI * 0.4 };
  }
  // Whether the working end did its job in the last third of a second (for the drops / chips).
  const recentEffect = run ? run.frames.slice(Math.max(0, frameIndex - 20), frameIndex + 1).some(p => p.effect) : false;
  const jitter = f.shake ? Math.sin(now / 18) * 0.03 * f.shake : 0;

  const W = (L.maxX - L.minX) * S, H = (L.top - L.bottom) * S;
  const X = (x: number) => (x - L.minX) * S;
  const Y = (y: number) => (L.top - y) * S;
  const deg = (rad: number) => (rad * 180) / Math.PI;

  // The slider rides rigidly on what drives it (heights above the shaft centre); everything above follows `d`.
  let sliderY = SH + 1.0, rollerY = 0, rackY = 0;
  if (driver && link) {
    if (link.part === 'rod' && driver.part === 'crank') sliderY = SH + (link.value - driver.value) + f.d;
    else if (link.part === 'follower') {
      const contact = driver.part === 'cam' ? CAM_BASE + f.d : driver.part === 'crank' ? driver.value + 0.12 : driver.value + 0.06 + f.d;
      rollerY = SH + contact + 0.07;
      sliderY = rollerY + 0.6;
    } else if (link.part === 'rack' && driver.part === 'pinion') {
      rackY = SH - 0.45 + f.d;
      sliderY = rackY + 0.9;
    }
  }
  const sx = L.slotX + jitter;
  const sliderTop = sliderY + 0.22;
  let rodTopY: number, loadY: number, headY = 0, tilt = 0, armY = 0;
  const pivot = { x: L.slotX + 1.6, y: REST_TOP + 0.35 };
  if (L.beam) {
    tilt = -Math.asin(Math.max(-0.5, Math.min(0.5, (f.d - 0.3) / 1.6)));
    rodTopY = pivot.y - Math.sin(tilt) * 1.6;
    headY = pivot.y + Math.sin(tilt) * 1.8;
    // The cable is long enough that a pump's piston stays in its cylinder; a hammer stops on the rock.
    loadY = Math.max(L.load === 'stamp' ? 0.56 : 0.15, headY - 2.9);
  } else if (L.load === 'stamp') {
    loadY = 0.6 + f.d;
    armY = loadY + 1.4;
    rodTopY = armY;
  } else {
    loadY = REST_TOP + (L.load === 'pump' ? 0.45 : 0.25) + f.d;
    rodTopY = loadY;
  }
  const showTrail = !!(run || solved) && driver && link && (driver.part === 'crank' || driver.part === 'cam') && link.part !== 'rack';
  const end = endWord(L.load);
  const fluid = c.fluid ? FLUID[c.fluid] : L.load === 'saw' ? '#e8c48a' : L.load === 'stamp' ? '#fbbf24' : '#f472b6';
  const tapProps = (slot: 'driver' | 'link') => (onTapPlaced && !disabled
    ? { onClick: () => onTapPlaced(slot), style: { cursor: 'pointer' }, 'data-machine-target': `placed:${slot}` } : { 'data-machine-target': `placed:${slot}` });

  return (
    <div className={className} data-machine-scene="2d">
      <svg viewBox={`0 0 ${W.toFixed(0)} ${H.toFixed(0)}`} className="h-full w-full" role="img"
        aria-label={`${c.name}: ${c.stages.map(s => (isConverter(s.kind) ? 'missing part' : KIND_NAMES[s.kind])).join(', then ')}`}>
        <rect x={0} y={0} width={W} height={H} fill="#1e2a38" />
        {/* The bench top */}
        <rect x={X(L.minX + 0.1)} y={Y(0)} width={(L.maxX - L.minX - 0.2) * S} height={0.22 * S} rx={6} fill={C.wood} />

        {/* Spin stages, left to right */}
        {L.spin.map((s, i) => {
          const x = L.xs[i];
          const ang = deg(f.slotAngle * L.ratios[i] * L.signs[i]);
          const r = wheelR(s.kind);
          return (
            <g key={i}>
              <rect x={X(x) - 7} y={Y(SH)} width={14} height={SH * S} fill={C.dark} />
              {s.kind === 'motor' && <rect x={X(x - 0.95)} y={Y(SH + 0.4)} width={0.75 * S} height={0.8 * S} rx={10} fill={C.blue} />}
              {s.kind === 'water_wheel' && <rect x={X(x - 1.1)} y={Y(0.25)} width={2.2 * S} height={0.18 * S} fill="#4aa8ff" opacity={0.7} />}
              {s.kind === 'windmill' && <rect x={X(x) - 5} y={Y(SH + 2.6)} width={10} height={2.6 * S} fill={C.dark} />}
              <g transform={`translate(${X(x)},${Y(SH)}) rotate(${ang})`}>
                {/* The gearbox gear under the slot sits behind the learner's part, dimmed, so the part reads in front. */}
                {s.kind === 'gearbox'
                  ? <path d={gearPath(BIG_GEAR, 22)} fill={C.brass} opacity={i === L.spin.length - 1 ? 0.35 : 1} />
                  : <Spokes r={r} color={C.steel} />}
                {s.kind === 'hand_crank' && <g><rect x={-5} y={-0.65 * S} width={10} height={0.65 * S} fill={C.wood} /><circle cy={-0.65 * S} r={11} fill={C.red} /></g>}
                {s.kind === 'water_wheel' && Array.from({ length: 12 }, (_, k) => <rect key={k} x={-10} y={-0.95 * S} width={20} height={22} fill={C.wood} transform={`rotate(${k * 30})`} />)}
              </g>
              {s.kind === 'windmill' && (
                <g transform={`translate(${X(x)},${Y(SH + 2.6)}) rotate(${ang})`}>
                  {Array.from({ length: 8 }, (_, k) => <rect key={k} x={-8} y={-0.85 * S} width={16} height={0.75 * S} fill={C.steel} transform={`rotate(${k * 45})`} />)}
                  <circle r={8} fill={C.dark} />
                </g>
              )}
              {/* A gearbox's small gear sits on the shaft before it. */}
              {L.spin[i + 1]?.kind === 'gearbox' && (
                <g transform={`translate(${X(x)},${Y(SH)}) rotate(${ang})`}><path d={gearPath(SMALL_GEAR, 9)} fill={C.brass} opacity={0.95} /></g>
              )}
              {/* A belt from the shaft before to this pulley. */}
              {s.kind === 'belt' && (() => {
                const px = L.xs[i - 1], pr = wheelR(L.spin[i - 1].kind);
                return <g stroke="#111" strokeWidth={5} fill="none">
                  <line x1={X(px)} y1={Y(SH + pr)} x2={X(x)} y2={Y(SH + r)} /><line x1={X(px)} y1={Y(SH - pr)} x2={X(x)} y2={Y(SH - r)} />
                </g>;
              })()}
              <text x={X(x)} y={Y(-0.5)} textAnchor="middle" fontSize={22} fill="#cbd5e1">{KIND_NAMES[s.kind]}</text>
            </g>
          );
        })}

        {/* The slider's guide above the slot wheel */}
        <g stroke={C.dark} strokeWidth={5}>
          <line x1={X(L.slotX - 0.16)} y1={Y(SH + 0.35)} x2={X(L.slotX - 0.16)} y2={Y(SH + 2.7)} />
          <line x1={X(L.slotX + 0.16)} y1={Y(SH + 0.35)} x2={X(L.slotX + 0.16)} y2={Y(SH + 2.7)} />
        </g>

        {/* The principle, traced while it runs: the peg's circle and the slider's straight line. */}
        {showTrail && driver && (
          <g fill="none" stroke="#fde68a" strokeWidth={3} strokeDasharray="8 6" opacity={0.85} data-machine-trail="">
            {driver.part === 'crank' && <circle cx={X(L.slotX)} cy={Y(SH)} r={driver.value * S} />}
            <line x1={X(L.slotX) + 26} y1={Y(sliderY - f.d)} x2={X(L.slotX) + 26} y2={Y(sliderY - f.d + (driver.part === 'crank' ? 2 * driver.value : driver.value))} />
            <path d={`M${X(L.slotX) + 18},${Y(sliderY - f.d) - 4} l8,8 l8,-8 M${X(L.slotX) + 18},${Y(sliderY - f.d + (driver.part === 'crank' ? 2 * driver.value : driver.value)) + 4} l8,-8 l8,8`} />
          </g>
        )}

        {/* The slot: the learner's wheel part */}
        {driver ? (
          <g transform={`translate(${X(sx)},${Y(SH)}) rotate(${deg(f.slotAngle)})`} {...tapProps('driver')}>
            {driver.part === 'crank' && <><circle r={(driver.value + 0.12) * S} fill={C.red} /><circle cy={-driver.value * S} r={8} fill={C.steel} stroke={C.ink} strokeWidth={2} /></>}
            {driver.part === 'cam' && <path d={camPath(driver.value)} fill={C.green} />}
            {driver.part === 'pinion' && <path d={gearPath(driver.value, 10)} fill={C.brass} />}
            <circle r={6} fill={C.dark} />
          </g>
        ) : (
          <g>
            <circle cx={X(L.slotX)} cy={Y(SH)} r={0.5 * S} fill="none" stroke="#fde68a" strokeWidth={3} strokeDasharray="10 8" />
            <text x={X(L.slotX)} y={Y(SH) + 14} textAnchor="middle" fontSize={44} fontWeight={700} fill="#fde68a">?</text>
          </g>
        )}

        {/* The learner's joining part */}
        {link && driver && (() => {
          const tp = tapProps('link');
          if (link.part === 'rod' && driver.part === 'crank') {
            const px = sx + Math.sin(f.slotAngle) * driver.value, py = SH + Math.cos(f.slotAngle) * driver.value;
            return <line {...tp} x1={X(px)} y1={Y(py)} x2={X(sx)} y2={Y(sliderY)} stroke={C.steel} strokeWidth={12} strokeLinecap="round" />;
          }
          // Every joining part is drawn fitted at the joint, even in a pair that cannot work: a rod hangs from the slider
          // with its hole resting on the wheel's rim (no peg to hook), a rack stands beside a wheel with no teeth. The run
          // then shows why it does nothing; the part never lies loose on the bench.
          const rim = driver.part === 'crank' ? driver.value + 0.12 : driver.part === 'cam' ? CAM_BASE : driver.value + 0.06;
          if (link.part === 'rod') {
            return <g {...tp}>
              <line x1={X(sx)} y1={Y(sliderY)} x2={X(sx)} y2={Y(SH + rim + 0.05)} stroke={C.steel} strokeWidth={12} strokeLinecap="round" />
              <circle cx={X(sx)} cy={Y(SH + rim + 0.05)} r={5} fill={C.ink} />
            </g>;
          }
          if (link.part === 'follower') return <g {...tp}><rect x={X(sx) - 4} y={Y(rollerY + 0.6)} width={8} height={0.6 * S} fill={C.steel} /><circle cx={X(sx)} cy={Y(rollerY)} r={9} fill={C.dark} /></g>;
          const x0 = sx + (driver.part === 'pinion' ? driver.value + 0.08 : (driver.part === 'cam' ? CAM_BASE + driver.value : rim) + 0.04);
          const y0 = driver.part === 'pinion' ? rackY : SH - 0.45;
          return <g {...tp}>
            <rect x={X(x0)} y={Y(y0 + 0.9)} width={14} height={0.9 * S} fill={C.brass} />
            {Array.from({ length: 9 }, (_, k) => <rect key={k} x={X(x0) - 7} y={Y(y0 + 0.05 + k * 0.1) - 5} width={7} height={5} fill={C.brass} />)}
            <line x1={X(x0) + 7} y1={Y(y0 + 0.9)} x2={X(sx)} y2={Y(sliderY)} stroke={C.steel} strokeWidth={6} />
          </g>;
        })()}

        {/* The slider and the push rod up to the working end */}
        <rect x={X(sx) - 14} y={Y(sliderY + 0.22)} width={28} height={0.22 * S} rx={4} fill={C.steel} stroke={C.ink} strokeWidth={2} />
        <line x1={X(sx)} y1={Y(sliderTop)} x2={X(L.beam ? L.slotX : sx)} y2={Y(rodTopY)} stroke={C.steel} strokeWidth={6} />

        {L.beam && (
          <g>
            <rect x={X(pivot.x) - 9} y={Y(pivot.y)} width={18} height={pivot.y * S} fill={C.dark} />
            <g transform={`translate(${X(pivot.x)},${Y(pivot.y)}) rotate(${-deg(tilt)})`}>
              <rect x={-1.8 * S} y={-9} width={3.6 * S} height={18} rx={6} fill="#1e293b" stroke="#475569" strokeWidth={2} />
              <path d={`M${1.75 * S},${-30} a30,30 0 0 1 0,60 z`} fill="#1e293b" stroke="#475569" strokeWidth={2} />
            </g>
            <line x1={X(L.endX)} y1={Y(headY)} x2={X(L.endX)} y2={Y(loadY + 0.1)} stroke={C.dark} strokeWidth={3} />
            <text x={X(pivot.x)} y={Y(pivot.y + 0.45)} textAnchor="middle" fontSize={22} fill="#cbd5e1">{KIND_NAMES.walking_beam}</text>
          </g>
        )}
        {!L.beam && L.load === 'stamp' && (
          <g stroke={C.dark} strokeWidth={6}>
            <line x1={X(L.slotX)} y1={Y(armY)} x2={X(L.endX)} y2={Y(armY)} />
            <line x1={X(L.endX)} y1={Y(armY)} x2={X(L.endX)} y2={Y(loadY + 0.5)} />
          </g>
        )}

        {/* The working end */}
        <g data-machine-load={L.load}>
          {L.load === 'pump' && (() => {
            const cylY = L.beam ? 0.6 : REST_TOP + 0.85;
            return <>
              <rect x={X(L.endX) - 24} y={Y(cylY + 0.5)} width={48} height={S} fill="#94a3b8" opacity={0.35} stroke="#94a3b8" strokeWidth={2} />
              <rect x={X(L.endX) + 24} y={Y(cylY + 0.38)} width={40} height={10} fill={C.dark} />
              <rect x={X(L.endX) - 20} y={Y(loadY + 0.07)} width={40} height={14} fill={C.steel} />
              {recentEffect && [0, 1, 2, 3, 4].map(k => <circle key={k} cx={X(L.endX) + 70 + k * 9} cy={Y(cylY + 0.35) + ((frameIndex + k * 4) % 20) * 2.5} r={5} fill={fluid} />)}
            </>;
          })()}
          {L.load === 'needle' && <>
            <rect x={X(L.endX) - 70} y={Y(REST_TOP + 1.3)} width={140} height={6} fill="#e9d5ff" />
            <polygon points={`${X(L.endX) - 4},${Y(loadY)} ${X(L.endX) + 4},${Y(loadY)} ${X(L.endX)},${Y(loadY + 0.55)}`} fill={C.steel} />
            {recentEffect && <circle cx={X(L.endX)} cy={Y(REST_TOP + 1.3) - 8} r={6} fill={fluid} />}
          </>}
          {L.load === 'saw' && <>
            <rect x={X(L.endX) - 80} y={Y(REST_TOP + 1.25)} width={160} height={12} fill={C.wood} />
            <rect x={X(L.endX) - 3} y={Y(loadY + 0.7)} width={6} height={0.7 * S} fill={C.steel} />
            {recentEffect && [0, 1, 2].map(k => <circle key={k} cx={X(L.endX) + 10 + k * 8} cy={Y(REST_TOP + 1.25) - 6 - k * 5} r={3} fill={fluid} />)}
          </>}
          {L.load === 'stamp' && <>
            <rect x={X(L.endX) - 35} y={Y(0.3)} width={70} height={0.3 * S} fill={C.dark} />
            <circle cx={X(L.endX)} cy={Y(0.42)} r={14} fill="#a8a29e" />
            <rect x={X(L.endX) - 20} y={Y(loadY + 0.5)} width={40} height={0.5 * S} fill="#334155" />
            {recentEffect && [0, 1, 2].map(k => <circle key={k} cx={X(L.endX) - 30 + k * 30} cy={Y(0.6) - k * 3} r={4} fill={fluid} />)}
          </>}
          {L.load === 'figure' && <g transform={`translate(${X(L.endX)},${Y(loadY + 0.25)})`}>
            <ellipse rx={28} ry={20} fill="#f59e0b" /><circle cx={24} cy={-20} r={13} fill="#f59e0b" />
            <polygon points="36,-22 50,-18 36,-14" fill={C.red} /><circle cx={27} cy={-23} r={2.5} fill={C.ink} />
          </g>}
          <text x={X(L.endX) + (L.beam ? 70 : 90)} y={Y(L.beam ? 1.6 : REST_TOP + 0.6)} fontSize={22} fill="#cbd5e1">{KIND_NAMES[L.load] === 'Figure' ? 'Bird' : KIND_NAMES[L.load]}</text>
        </g>

        {/* The problem, shown: the wheel spins; the working end has to go up and down. */}
        {!solved && (
          <g data-machine-goal="" fontSize={20} fontWeight={600}>
            <text x={X(L.slotX) + 0.9 * S} y={Y(SH - 0.35)} textAnchor="start" fill="#7dd3fc">⟳ spins</text>
            <g transform={`translate(${X(L.endX) - (L.beam ? 70 : 64)},${Y(L.beam ? 1.3 : REST_TOP + 0.9)})`}>
              <text textAnchor="middle" fill="#fdba74">↕</text>
              <text y={24} textAnchor="middle" fontSize={16} fill="#fdba74">{end} must go</text>
              <text y={42} textAnchor="middle" fontSize={16} fill="#fdba74">up and down</text>
            </g>
          </g>
        )}
        <text x={X(L.slotX) - 0.3 * S} y={Y(SH + 0.95)} textAnchor="end" fontSize={22} fontWeight={700} fill={solved ? '#86efac' : '#fde68a'}>
          {solved ? (driver?.part === 'cam' ? KIND_NAMES.cam_follower : KIND_NAMES.crank_rod) : '? missing part'}
        </text>
        <text x={16} y={34} fontSize={26} fontWeight={700} fill="#fde68a">{c.name}</text>
      </svg>
    </div>
  );
};

export default MachineBench;
