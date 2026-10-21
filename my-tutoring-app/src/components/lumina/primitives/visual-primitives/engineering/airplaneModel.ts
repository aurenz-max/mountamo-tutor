/**
 * Airplane diorama, the domain: the parts of a jet, the asks, the check and the misses. Pure (no three.js),
 * so the generator, the workspace module, the boss and the tests share one source.
 *
 * The task is to FIND a part on the 3D jet and tap it. Nothing on screen names a part while the learner
 * looks: the ask names the target (K-2: by name) or what it does (3-5: by its job), and the jet is the
 * only answer surface. After a right tap the part shows what it does.
 */
import { AIRPLANE_MISSES_BY_MODE, type AirplaneMiss } from './airplaneDiorama.card';

export const AIRPLANE_PARTS = ['wings', 'engines', 'tail', 'cockpit', 'gear', 'cabin', 'nose'] as const;
export type AirplanePart = typeof AIRPLANE_PARTS[number];

export const AIRPLANE_TASKS = ['find_part', 'flight_plan'] as const;
export type AirplaneTask = typeof AIRPLANE_TASKS[number];

export type AirplaneBand = 'K-2' | '3-5';
/** How the ask names the target: by its name, or by the job it does (the learner must know which part does it). */
export type AskStyle = 'name' | 'job';

export interface AirplanePartInfo {
  /** "the wings": what the learner hears and what feedback names. */
  name: string;
  /** The name is plural ("the wings"): the ask says "tap them". */
  plural?: boolean;
  /** Singular display name for the card after a find. */
  title: string;
  /** The job ask (3-5): what the part does, never its name. */
  jobAsk: string;
  /** The job ask as a question, for feedback after a wrong tap. */
  jobQuestion: string;
  /** One sentence a child can follow, shown after the part is found. */
  fact: string;
  /** What the jet does to show the part working, in the learner's terms. */
  shows: string;
}

/** Code-owned: what each part is and does (kid-level, true of any passenger jet). */
export const PART_INFO: Record<AirplanePart, AirplanePartInfo> = {
  wings: {
    name: 'the wings', plural: true, title: 'Wings',
    jobAsk: 'Find the part that lifts the plane up into the air and tap it.', jobQuestion: 'Which part lifts the plane up into the air?',
    fact: 'As the plane rushes forward, air flowing over and under the wings pushes them up. That push is called lift.',
    shows: 'the flaps at the back of the wings slide down, and the tips tilt to steer',
  },
  engines: {
    name: 'an engine', title: 'Engines',
    jobAsk: 'Find the part that pushes the plane forward and tap it.', jobQuestion: 'Which part pushes the plane forward?',
    fact: 'The big fan at the front pulls in air and blows it out the back, so hard that the whole plane moves forward.',
    shows: 'the fans spin up fast',
  },
  tail: {
    name: 'the tail', title: 'Tail',
    jobAsk: 'Find the part that keeps the plane flying straight and steady and tap it.', jobQuestion: 'Which part keeps the plane flying straight and steady?',
    fact: 'The tall fin keeps the nose from swinging side to side, and the small back wings keep it from bobbing up and down.',
    shows: 'the rudder on the fin and the flaps on the small back wings move',
  },
  cockpit: {
    name: 'the cockpit', title: 'Cockpit',
    jobAsk: 'Find the place where the pilots sit and fly the plane and tap it.', jobQuestion: 'Where do the pilots sit and fly the plane?',
    fact: 'Two pilots sit up front behind the big windows, with screens that show the speed, the height and the way to go.',
    shows: 'you can see inside to the pilot seats and the glowing screens',
  },
  gear: {
    name: 'the landing gear', title: 'Landing gear',
    jobAsk: 'Find the part the plane rolls on when it is on the ground and tap it.', jobQuestion: 'What does the plane roll on when it is on the ground?',
    fact: 'The wheels and legs hold the plane up on the ground. Their springy legs soak up the bump when the plane lands.',
    shows: 'the plane bounces on its springy legs',
  },
  cabin: {
    name: 'the cabin', title: 'Cabin',
    jobAsk: 'Find the place where the passengers ride and tap it.', jobQuestion: 'Where do the passengers ride?',
    fact: 'The long body holds rows of seats for the passengers, with a window for almost every row.',
    shows: 'you can see inside to the rows of seats',
  },
  nose: {
    name: 'the nose', title: 'Nose',
    jobAsk: 'Find the part at the very front that hides the weather radar and tap it.', jobQuestion: 'Which part is at the very front, hiding the weather radar?',
    fact: 'The pointed nose cuts through the air. Inside it, a radar looks ahead for storms.',
    shows: 'the radar sends out a sweep ahead of the plane',
  },
};

/** The ask in the learner's words. A job ask never names the part (naming it is the answer). */
export function askFor(part: AirplanePart, style: AskStyle): string {
  return style === 'name' ? `Find ${PART_INFO[part].name} on the jet and tap ${PART_INFO[part].plural ? 'them' : 'it'}.` : PART_INFO[part].jobAsk;
}

export interface FindPartChallenge {
  id: string;
  type: 'find_part';
  /** The part to find: the key. Never reaches the tutor on a job ask. */
  part: AirplanePart;
  askStyle: AskStyle;
  instruction: string;
}

export const askStyleFor = (band: AirplaneBand): AskStyle => (band === 'K-2' ? 'name' : 'job');

export function buildAirplaneChallenge(part: AirplanePart, opts: { id: string; band: AirplaneBand }): FindPartChallenge {
  const askStyle = askStyleFor(opts.band);
  return { id: opts.id, type: 'find_part', part, askStyle, instruction: askFor(part, askStyle) };
}

/**
 * The parts a session asks for: the lesson's focus parts first (in order), then the rest in a shuffled order,
 * `count` distinct parts in all.
 */
export function selectParts(focus: readonly AirplanePart[], count: number, rng: () => number = Math.random): AirplanePart[] {
  const out: AirplanePart[] = [];
  for (const p of focus) if (AIRPLANE_PARTS.includes(p) && !out.includes(p)) out.push(p);
  const rest = AIRPLANE_PARTS.filter(p => !out.includes(p));
  for (let i = rest.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [rest[i], rest[j]] = [rest[j], rest[i]]; }
  return [...out, ...rest].slice(0, Math.max(1, Math.min(count, AIRPLANE_PARTS.length)));
}

// ── The check (the misses each check names are the card's, `airplaneDiorama.card.ts`) ──

/** Parts a learner mixes up because they sit together or look alike (the back wings look like wings). */
const NEIGHBORS: Record<AirplanePart, readonly AirplanePart[]> = {
  wings: ['tail', 'engines'],
  engines: ['wings', 'gear'],
  tail: ['wings'],
  cockpit: ['nose', 'cabin'],
  gear: ['engines', 'cabin'],
  cabin: ['cockpit', 'wings'],
  nose: ['cockpit'],
};

export const partMatches = (c: FindPartChallenge, tapped: AirplanePart) => tapped === c.part;

/** The named wrong answer: a part next to or like the asked one, or any other part. */
export function airplaneMiss(c: FindPartChallenge, tapped: AirplanePart): AirplaneMiss | undefined {
  if (tapped === c.part) return undefined;
  return NEIGHBORS[c.part].includes(tapped) ? 'close_part' : 'wrong_part';
}

/** "Tapped the tail": the learner's work, in words. */
export const describeTap = (tapped: AirplanePart) => `Tapped ${PART_INFO[tapped].name}`;

/** What the screen says after a tap: it names what was tapped, and on a miss repeats the ask. */
export function tapFeedback(c: FindPartChallenge, tapped: AirplanePart): string {
  if (tapped === c.part) return `Yes! That's ${PART_INFO[tapped].name}.`;
  const again = c.askStyle === 'name' ? `Look again for ${PART_INFO[c.part].name}.` : PART_INFO[c.part].jobQuestion;
  return `That's ${PART_INFO[tapped].name}. ${again}`;
}

// ── Flight plan: load the fuel a trip needs ─────────────────────────────────

/**
 * A trip between two airports. The learner loads fuel tanks and presses Fly; the flight is the check.
 * K-2 reads the trip in hops (the map draws each hop; one tank flies one hop). 3-5 reads it in km (the map
 * shows only the distance; one tank flies `perTank` km), so dividing is the task. Every trip needs one spare
 * tank on top, and the rule says so on screen. Code owns every number; the key is `tanksNeeded`.
 */
export interface FlightPlanChallenge {
  id: string;
  type: 'flight_plan';
  from: string;
  to: string;
  /** Who or what the jet carries, e.g. "the school band". */
  cargo: string;
  units: 'hops' | 'km';
  /** The trip length in `units`. */
  distance: number;
  /** How far one tank flies, in `units` (1 for hops). */
  perTank: number;
  /** Spare tanks on top of the trip. */
  spare: number;
  instruction: string;
}

export type AirplaneChallenge = FindPartChallenge | FlightPlanChallenge;

export const SPARE_TANKS = 1;
/** Most tanks the loader holds: well past any key, so the limit never hints at the answer. */
export const MAX_TANKS = 15;

/** Tanks the trip itself burns. */
export const tanksForTrip = (c: FlightPlanChallenge) => Math.ceil(c.distance / c.perTank);
/** The key: the trip's tanks plus the spare. */
export const tanksNeeded = (c: FlightPlanChallenge) => tanksForTrip(c) + c.spare;

export const formatDistance = (c: Pick<FlightPlanChallenge, 'units'>, n: number) =>
  c.units === 'hops' ? `${n} hop${n === 1 ? '' : 's'}` : `${n.toLocaleString('en-US')} km`;
export const tankWord = (n: number, spare = false) => `${n} ${spare ? 'spare ' : ''}tank${n === 1 ? '' : 's'}`;

export function flightInstruction(c: Omit<FlightPlanChallenge, 'instruction' | 'id' | 'type'>): string {
  const rule = c.units === 'hops'
    ? 'Each tank of fuel flies one hop on the map.'
    : `Each tank of fuel flies ${c.perTank.toLocaleString('en-US')} km.`;
  const trip = c.units === 'hops' ? `from ${c.from} to ${c.to}` : `from ${c.from} to ${c.to}, ${formatDistance(c, c.distance)} away`;
  return `Fly ${c.cargo} ${trip}. ${rule} Load enough tanks for the trip plus ${tankWord(c.spare, true)}, then press Fly.`;
}

export interface FlightNumbers { units: 'hops' | 'km'; distance: number; perTank: number }

function shuffle<T>(xs: readonly T[], rng: () => number): T[] {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

/** `count` trips with different tank counts. K-2: 2-6 hops. 3-5: 3-9 tanks of 100-500 km each. */
export function pickFlightNumbers(band: AirplaneBand, count: number, rng: () => number = Math.random): FlightNumbers[] {
  if (band === 'K-2') {
    const hops = shuffle([2, 3, 4, 5, 6], rng);
    return Array.from({ length: count }, (_, i) => ({ units: 'hops' as const, distance: hops[i % hops.length], perTank: 1 }));
  }
  const ns = shuffle([3, 4, 5, 6, 7, 8, 9], rng);
  const per = shuffle([100, 200, 250, 300, 400, 500], rng);
  return Array.from({ length: count }, (_, i) => {
    const n = ns[i % ns.length], perTank = per[i % per.length];
    return { units: 'km' as const, distance: n * perTank, perTank };
  });
}

export interface FlightTrip { from: string; to: string; cargo: string }

export function buildFlightPlanChallenge(trip: FlightTrip, numbers: FlightNumbers, id: string): FlightPlanChallenge {
  const base = { ...trip, ...numbers, spare: SPARE_TANKS };
  return { id, type: 'flight_plan', ...base, instruction: flightInstruction(base) };
}

/** What a flight does with `loaded` tanks: how far it gets, and the tanks left if it lands. */
export interface FlightRun { loaded: number; reached: boolean; flown: number; short: number; left: number }

export function flyTrip(c: FlightPlanChallenge, loaded: number): FlightRun {
  const range = loaded * c.perTank;
  const reached = range >= c.distance;
  return { loaded, reached, flown: Math.min(range, c.distance), short: reached ? 0 : c.distance - range,
    left: reached ? loaded - tanksForTrip(c) : 0 };
}

export type FlightPlanMiss = typeof AIRPLANE_MISSES_BY_MODE.flight_plan[number];

export function flightMiss(c: FlightPlanChallenge, loaded: number): FlightPlanMiss | undefined {
  const trip = tanksForTrip(c);
  if (loaded < trip) return 'too_little_fuel';
  if (loaded < trip + c.spare) return 'no_spare_fuel';
  if (loaded > trip + c.spare) return 'too_much_fuel';
  return undefined;
}
export const flightMatches = (c: FlightPlanChallenge, loaded: number) => flightMiss(c, loaded) === undefined;

/** "Loaded 4 tanks and pressed Fly": the learner's work, in words. */
export const describeFuel = (loaded: number) => `Loaded ${tankWord(loaded)} and pressed Fly`;

/** What the flight showed, in the learner's terms. Never says how many tanks the trip needed. */
export function flightFeedback(c: FlightPlanChallenge, run: FlightRun): string {
  if (!run.reached) {
    return `Out of fuel! The jet flew ${formatDistance(c, run.flown)} and had to land ${formatDistance(c, run.short)} short of ${c.to}.`;
  }
  if (run.left < c.spare) {
    return `The jet reached ${c.to}, but its tanks were empty. Pilots always land with a spare tank, in case they have to circle or turn back.`;
  }
  if (run.left > c.spare) {
    return `The jet reached ${c.to} with ${tankWord(run.left)} left, more than the spare. Every extra tank makes the jet heavier, so it burns more fuel.`;
  }
  return `Yes! The jet reached ${c.to} with ${tankWord(run.left, true)} left. Just right!`;
}
