/**
 * Orbit Mechanics Lab — pure physics core.
 *
 * WHY THIS MODULE EXISTS
 * ----------------------
 * The integration step, the orbital-element solve and the projected orbit path
 * all used to live inside `OrbitMechanicsLab.tsx` as closures over component
 * state. That made them untestable, so the Kindergarten speed presets below
 * could only ever have been *asserted* — never *proved* — to produce three
 * different outcomes.
 *
 * Everything here is pure. The component calls these functions rather than
 * keeping its own copy, so a test that simulates a launch is exercising the
 * SAME code the child's rocket flies on. If these two ever diverge the presets
 * become decoration, which is exactly the failure this module prevents.
 */

// ============================================================================
// Types
// ============================================================================

export interface OrbitBodyConfig {
  /** Radius of the central body, km. */
  bodyRadiusKm: number;
  /** Surface gravity of the central body, m/s². */
  surfaceGravity: number;
}

export interface OrbitCraftConfig extends OrbitBodyConfig {
  /** Thrust the student selected, kN. */
  thrustKN: number;
  /** Launch pitch, degrees from horizontal (90 = straight up). */
  launchAngle: number;
  /** Dry + wet mass at ignition, kg. */
  rocketMassKg: number;
  /** Propellant aboard at ignition, kg. */
  propellantMassKg: number;
}

export interface OrbitState {
  x: number;            // km from centre
  y: number;            // km from centre
  vx: number;           // km/s
  vy: number;           // km/s
  altitudeKm: number;
  massKg: number;
  propellantKg: number;
  trail: Array<{ x: number; y: number }>;
  isLaunching: boolean;
  hasCrashed: boolean;
  hasEscaped: boolean;
}

export interface OrbitalElements {
  altitude: number;
  velocity: number;
  apogee: number;
  perigee: number;
  eccentricity: number;
  period: number;              // minutes
  isInOrbit: boolean;
  energy: number;
  isEscaping: boolean;
  /** Direction of periapsis, radians, in world coords. */
  argumentOfPeriapsis: number;
  /** Semi-major axis, km. Infinity on an escape trajectory. */
  semiMajorAxis: number;
}

export const TIME_STEP = 1;      // simulation seconds per integration step
export const TRAIL_LENGTH = 200;
export const KARMAN_LINE_KM = 100;
export const LEO_ALTITUDE_KM = 200;

/** Fuel burned per second, per kN of thrust. */
const FUEL_RATE_PER_KN = 0.08;

// ============================================================================
// Core physics
// ============================================================================

/** Gravitational parameter μ (km³/s²) for a body. */
export const gravitationalParameter = (cfg: OrbitBodyConfig): number =>
  (cfg.surfaceGravity * cfg.bodyRadiusKm * cfg.bodyRadiusKm) / 1000;

/** Gravitational acceleration at a world point, km/s². */
export const calculateGravity = (
  x: number,
  y: number,
  cfg: OrbitBodyConfig,
): { ax: number; ay: number } => {
  const r = Math.sqrt(x * x + y * y);
  if (r < cfg.bodyRadiusKm * 0.9) return { ax: 0, ay: 0 }; // inside the body

  const g = (cfg.surfaceGravity * Math.pow(cfg.bodyRadiusKm / r, 2)) / 1000;
  return { ax: -g * (x / r), ay: -g * (y / r) };
};

/**
 * Solve the orbital elements from the current state vector.
 *
 * `argumentOfPeriapsis` comes from the eccentricity vector, so the drawn orbit
 * path (below) can never disagree with the numbers shown in the flight panel —
 * both are derived here, once.
 */
export const calculateOrbitalElements = (
  state: Pick<OrbitState, 'x' | 'y' | 'vx' | 'vy'>,
  cfg: OrbitBodyConfig,
): OrbitalElements => {
  const { x, y, vx, vy } = state;
  const { bodyRadiusKm } = cfg;
  const r = Math.sqrt(x * x + y * y);
  const v = Math.sqrt(vx * vx + vy * vy);
  const altitude = r - bodyRadiusKm;

  const mu = gravitationalParameter(cfg);
  const energy = (v * v) / 2 - mu / r;
  const a = energy < 0 ? -mu / (2 * energy) : Infinity;
  const h = Math.abs(x * vy - y * vx);

  const eSquared = 1 + (2 * energy * h * h) / (mu * mu);
  const e = Math.sqrt(Math.max(0, eSquared));

  // Eccentricity vector points at periapsis.
  const rDotV = x * vx + y * vy;
  const ex = ((v * v - mu / r) * x - rDotV * vx) / mu;
  const ey = ((v * v - mu / r) * y - rDotV * vy) / mu;
  const argumentOfPeriapsis = Math.atan2(ey, ex);

  const apogee = a < Infinity ? a * (1 + e) - bodyRadiusKm : Infinity;
  const perigee = a < Infinity ? a * (1 - e) - bodyRadiusKm : -Infinity;
  const period = a > 0 && a < Infinity
    ? (2 * Math.PI * Math.sqrt((a * a * a) / mu)) / 60
    : Infinity;

  return {
    altitude,
    velocity: v,
    apogee,
    perigee,
    eccentricity: e,
    period,
    isInOrbit: e < 1 && perigee > 0,
    energy,
    isEscaping: energy >= 0,
    argumentOfPeriapsis,
    semiMajorAxis: a,
  };
};

/**
 * Advance the simulation one step (velocity Verlet).
 *
 * Thrust follows a gravity turn: it starts radial (straight up) and blends to
 * tangential as altitude climbs past `turnAltitude`, which the launch angle
 * sets. A lower angle turns sooner, building horizontal speed faster.
 */
export const orbitStep = (
  state: OrbitState,
  dt: number,
  applyThrust: boolean,
  cfg: OrbitCraftConfig,
): OrbitState => {
  if (state.hasCrashed || state.hasEscaped) return state;

  const { bodyRadiusKm, thrustKN, launchAngle, rocketMassKg, propellantMassKg } = cfg;
  let { x, y, vx, vy, massKg, propellantKg, trail, isLaunching } = state;

  const r = Math.sqrt(x * x + y * y);
  const altitude = r - bodyRadiusKm;

  if (altitude < 0) return { ...state, hasCrashed: true };
  if (altitude > bodyRadiusKm * 10) return { ...state, hasEscaped: true };

  const { ax: gx, ay: gy } = calculateGravity(x, y, cfg);

  let thrustAx = 0;
  let thrustAy = 0;

  if (applyThrust && propellantKg > 0 && isLaunching) {
    const thrustN = thrustKN * 1000;
    const thrustAccel = (thrustN / massKg) / 1000; // km/s²

    // Local orbital frame at the craft's position, so thrust stays correctly
    // oriented relative to the central body rather than the launch site.
    const radialX = x / r;
    const radialY = y / r;
    const tangentX = radialY;
    const tangentY = -radialX;

    const turnAltitude = 20 + (launchAngle - 45) * 0.67; // 45°→20km, 90°→50km
    const pitchFactor = Math.min(1, Math.max(0, (altitude - 1) / turnAltitude));

    const tangentFrac = Math.sin((pitchFactor * Math.PI) / 2);
    const radialFrac = Math.cos((pitchFactor * Math.PI) / 2);

    thrustAx = thrustAccel * (radialFrac * radialX + tangentFrac * tangentX);
    thrustAy = thrustAccel * (radialFrac * radialY + tangentFrac * tangentY);

    const fuelRate = thrustKN * FUEL_RATE_PER_KN;
    propellantKg = Math.max(0, propellantKg - fuelRate * dt);
    massKg = rocketMassKg - propellantMassKg + propellantKg;

    if (propellantKg <= 0) isLaunching = false;
  }

  const ax = gx + thrustAx;
  const ay = gy + thrustAy;

  const newVx = vx + ax * dt;
  const newVy = vy + ay * dt;
  const newX = x + newVx * dt;
  const newY = y + newVy * dt;

  const newTrail = [...trail];
  const last = trail[trail.length - 1];
  if (
    trail.length === 0
    || Math.sqrt(Math.pow(newX - last.x, 2) + Math.pow(newY - last.y, 2)) > bodyRadiusKm * 0.02
  ) {
    newTrail.push({ x: newX, y: newY });
    if (newTrail.length > TRAIL_LENGTH) newTrail.shift();
  }

  return {
    x: newX,
    y: newY,
    vx: newVx,
    vy: newVy,
    altitudeKm: Math.sqrt(newX * newX + newY * newY) - bodyRadiusKm,
    massKg,
    propellantKg,
    trail: newTrail,
    isLaunching,
    hasCrashed: false,
    hasEscaped: false,
  };
};

/** The state a craft starts in, sitting on the pad. */
export const initialLaunchState = (cfg: OrbitCraftConfig): OrbitState => ({
  x: 0,
  y: cfg.bodyRadiusKm + 1,
  vx: 0,
  vy: 0,
  altitudeKm: 1,
  massKg: cfg.rocketMassKg,
  propellantKg: cfg.propellantMassKg,
  trail: [{ x: 0, y: cfg.bodyRadiusKm + 1 }],
  isLaunching: true,
  hasCrashed: false,
  hasEscaped: false,
});

// ============================================================================
// Projected orbit path — the catalog's Kindergarten rung is "showOrbitPath only"
// ============================================================================

/**
 * World-space points tracing the projected orbit, or `null` when the craft is
 * not on a closed orbit (still ascending, escaping, or about to hit the ground).
 *
 * Sampled in true anomaly rather than drawn as a rotated SVG ellipse: the
 * caller maps each point through the same world→screen transform it uses for
 * the craft, so the path cannot drift from the dot travelling along it.
 */
export const orbitPathPoints = (
  state: Pick<OrbitState, 'x' | 'y' | 'vx' | 'vy'>,
  cfg: OrbitBodyConfig,
  samples = 128,
): Array<{ x: number; y: number }> | null => {
  const el = calculateOrbitalElements(state, cfg);
  if (!isFinite(el.semiMajorAxis) || el.eccentricity >= 1) return null;
  if (el.perigee <= -cfg.bodyRadiusKm) return null;

  const a = el.semiMajorAxis;
  const e = el.eccentricity;
  const omega = el.argumentOfPeriapsis;
  const p = a * (1 - e * e); // semi-latus rectum

  const points: Array<{ x: number; y: number }> = [];
  for (let i = 0; i <= samples; i++) {
    const nu = (i / samples) * 2 * Math.PI;   // true anomaly
    const r = p / (1 + e * Math.cos(nu));
    if (!isFinite(r) || r <= 0) continue;
    const theta = nu + omega;
    points.push({ x: r * Math.cos(theta), y: r * Math.sin(theta) });
  }

  return points.length > 2 ? points : null;
};

// ============================================================================
// Kindergarten / Grade-1 speed choices
// ============================================================================

export type SpeedChoiceId = 'slow' | 'justRight' | 'fast';

export interface SpeedChoice {
  id: SpeedChoiceId;
  emoji: string;
  /**
   * Word caption and accessible name. At PRE it is decoration — the tutor
   * speaks the choice — but it must still describe the SPEED and never the
   * correctness: a button labelled "Just right" hands over the answer to
   * anyone who can read it, or to any child it is read aloud to.
   */
  label: string;
  thrustKN: number;
  launchAngle: number;
}

/**
 * Thrust-to-weight targets, chosen from a sweep of the real `orbitStep` physics
 * across every grade's rocket rung (propellant is 60% of mass at all of them,
 * so outcome depends on TWR alone and these generalise):
 *
 *   TWR 0.90 → never leaves the pad, falls back            → "too slow"
 *   TWR 1.02 → orbit, e≈0.11, apogee ≈1,700 km, on screen  → "just right"
 *   TWR 2.50 → orbit, e≈0.72, apogee ≈33,000 km, far off   → "too fast"
 *
 * `orbitPhysics.test.ts` re-derives all three from `orbitStep` on every run, so
 * a physics change that collapses them into the same outcome fails the build
 * instead of silently making the child's choice meaningless.
 */
export const SPEED_CHOICE_TWR: Record<SpeedChoiceId, number> = {
  slow: 0.90,
  justRight: 1.02,
  fast: 2.50,
};

/** The one choice that actually orbits — the K/G1 answer. */
export const CORRECT_SPEED_CHOICE: SpeedChoiceId = 'justRight';

/**
 * Build the three tappable speed choices for a given rocket.
 *
 * Derived from the rocket's own mass rather than hardcoded kN, so any thrust
 * range Gemini emits still yields one too-slow, one orbiting and one runaway
 * option. Values are NOT clamped into `thrustOptions` — that range exists to
 * bound the grade 2+ slider, and clamping "too slow" up into it would erase the
 * failure the K task is built on.
 */
export const speedChoicesFor = (
  rocketMassKg: number,
  surfaceGravity: number,
): SpeedChoice[] => {
  const kNFor = (twr: number) =>
    Math.max(1, Math.round((twr * rocketMassKg * surfaceGravity) / 1000));

  return [
    { id: 'slow', emoji: '🐢', label: 'Slow', thrustKN: kNFor(SPEED_CHOICE_TWR.slow), launchAngle: 90 },
    { id: 'justRight', emoji: '🚀', label: 'Medium', thrustKN: kNFor(SPEED_CHOICE_TWR.justRight), launchAngle: 90 },
    { id: 'fast', emoji: '⚡', label: 'Super fast', thrustKN: kNFor(SPEED_CHOICE_TWR.fast), launchAngle: 90 },
  ];
};

// ============================================================================
// Headless launch simulation — used by tests to prove the presets differ
// ============================================================================

export type LaunchOutcome = 'crash' | 'orbit' | 'escape' | 'timeout';

export interface LaunchResult {
  outcome: LaunchOutcome;
  seconds: number;
  maxAltitudeKm: number;
  eccentricity?: number;
  apogeeKm?: number;
  perigeeKm?: number;
  periodMin?: number;
}

/**
 * Fly a launch to its conclusion using the SAME `orbitStep` the component
 * animates, and report what happened.
 */
export const simulateLaunch = (
  cfg: OrbitCraftConfig,
  maxSeconds = 40000,
): LaunchResult => {
  let state = initialLaunchState(cfg);
  let maxAltitudeKm = 0;

  for (let t = 0; t < maxSeconds; t += TIME_STEP) {
    state = orbitStep(state, TIME_STEP, state.isLaunching, cfg);
    maxAltitudeKm = Math.max(maxAltitudeKm, state.altitudeKm);

    if (state.hasCrashed) return { outcome: 'crash', seconds: t, maxAltitudeKm };
    if (state.hasEscaped) return { outcome: 'escape', seconds: t, maxAltitudeKm };

    if (!state.isLaunching) {
      const el = calculateOrbitalElements(state, cfg);
      if (el.isInOrbit) {
        return {
          outcome: 'orbit',
          seconds: t,
          maxAltitudeKm,
          eccentricity: el.eccentricity,
          apogeeKm: el.apogee,
          perigeeKm: el.perigee,
          periodMin: el.period,
        };
      }
    }
  }

  return { outcome: 'timeout', seconds: maxSeconds, maxAltitudeKm };
};
