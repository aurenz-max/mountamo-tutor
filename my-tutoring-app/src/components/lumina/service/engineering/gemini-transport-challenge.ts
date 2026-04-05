import { Type, Schema } from "@google/genai";
import { ai } from "../geminiClient";
import {
  resolveEvalModeConstraint,
  logEvalModeResolution,
  buildChallengeTypePromptSection,
  type ChallengeTypeDoc,
} from "../evalMode";

// Import types from the component — single source of truth
import type {
  TransportChallengeData,
  TransportScenario,
  VehicleOption,
  TransportConstraint,
} from "../../primitives/visual-primitives/engineering/TransportChallenge";

// Re-export for convenience
export type { TransportChallengeData, TransportScenario };

// ============================================================================
// Constants
// ============================================================================

const VALID_CONSTRAINT_TYPES = ["budget", "time", "co2"] as const;
const VALID_EMOJIS = ["🚗", "🚌", "🚐", "🚂", "✈️", "🚢", "🚲", "🏍️"] as const;
const VALID_COLORS = ["#3b82f6", "#ef4444", "#22c55e", "#f59e0b", "#8b5cf6"] as const;
const MAX_FLEET_SIZE = 15;

// ============================================================================
// Eval Mode Challenge Type Docs
// ============================================================================

const CHALLENGE_TYPE_DOCS: Record<string, ChallengeTypeDoc> = {
  single_constraint: {
    promptDoc:
      "single_constraint: ONE constraint (budget OR time OR co2). 3-4 vehicles. " +
      "One vehicle clearly wins on the single constraint. Simple math: trips * cost vs budget.",
    schemaDescription:
      "single_constraint — one constraint, one obvious best vehicle",
  },
  multi_constraint: {
    promptDoc:
      "multi_constraint: 2-3 constraints (e.g., budget AND time). 4 vehicles. " +
      "At least 2 vehicles meet all constraints. Real trade-offs exist between them.",
    schemaDescription:
      "multi_constraint — multiple constraints, trade-offs between viable vehicles",
  },
  full_optimization: {
    promptDoc:
      "full_optimization: 3-4 constraints. 4-5 vehicles. No single vehicle is perfect — " +
      "each fails at least one constraint or is suboptimal. Student must find the least-bad option.",
    schemaDescription:
      "full_optimization — many constraints, no perfect answer",
  },
};

// ============================================================================
// Scenario themes for variety
// ============================================================================

const SCENARIO_THEMES = [
  "a school field trip",
  "a company office relocation",
  "a music festival shuttle",
  "a sports team travel day",
  "a community evacuation drill",
  "a tourist group excursion",
  "a summer camp transfer",
  "a hospital patient transport",
];

function randomTheme(): string {
  return SCENARIO_THEMES[Math.floor(Math.random() * SCENARIO_THEMES.length)];
}

// ============================================================================
// Flat → Structured Helpers
// ============================================================================

interface FlatScenario {
  [key: string]: unknown;
}

function extractConstraints(flat: FlatScenario, maxSlots: number): TransportConstraint[] {
  const constraints: TransportConstraint[] = [];
  for (let i = 0; i < maxSlots; i++) {
    const type = flat[`constraint${i}Type`] as string | undefined;
    const limit = flat[`constraint${i}Limit`] as number | undefined;
    const unit = flat[`constraint${i}Unit`] as string | undefined;
    if (
      type &&
      VALID_CONSTRAINT_TYPES.includes(type as typeof VALID_CONSTRAINT_TYPES[number]) &&
      typeof limit === "number" &&
      limit > 0 &&
      unit
    ) {
      constraints.push({ type: type as TransportConstraint["type"], limit, unit });
    }
  }
  return constraints;
}

function extractVehicles(flat: FlatScenario, maxSlots: number): VehicleOption[] {
  const vehicles: VehicleOption[] = [];
  for (let i = 0; i < maxSlots; i++) {
    const name = flat[`vehicle${i}Name`] as string | undefined;
    const emoji = flat[`vehicle${i}Emoji`] as string | undefined;
    const capacity = flat[`vehicle${i}Capacity`] as number | undefined;
    const speedKmh = flat[`vehicle${i}SpeedKmh`] as number | undefined;
    const costPerTrip = flat[`vehicle${i}CostPerTrip`] as number | undefined;
    const co2PerTrip = flat[`vehicle${i}Co2PerTrip`] as number | undefined;
    const turnaroundMinutes = flat[`vehicle${i}TurnaroundMinutes`] as number | undefined;
    const color = flat[`vehicle${i}Color`] as string | undefined;
    const requiresInfrastructure = flat[`vehicle${i}RequiresInfrastructure`] as string | undefined;
    const infrastructureCost = flat[`vehicle${i}InfrastructureCost`] as number | undefined;

    if (
      name &&
      typeof capacity === "number" && capacity > 0 &&
      typeof speedKmh === "number" && speedKmh > 0 &&
      typeof costPerTrip === "number" && costPerTrip > 0 &&
      typeof co2PerTrip === "number" && co2PerTrip > 0 &&
      typeof turnaroundMinutes === "number" && turnaroundMinutes >= 0
    ) {
      const vehicle: VehicleOption = {
        id: `v${i}`,
        name,
        emoji: VALID_EMOJIS.includes(emoji as typeof VALID_EMOJIS[number])
          ? emoji!
          : VALID_EMOJIS[i % VALID_EMOJIS.length],
        capacity,
        speedKmh,
        costPerTrip,
        co2PerTrip,
        turnaroundMinutes,
        color: VALID_COLORS.includes(color as typeof VALID_COLORS[number])
          ? color!
          : VALID_COLORS[i % VALID_COLORS.length],
      };
      if (requiresInfrastructure) vehicle.requiresInfrastructure = requiresInfrastructure;
      if (typeof infrastructureCost === "number" && infrastructureCost > 0) {
        vehicle.infrastructureCost = infrastructureCost;
      }
      vehicles.push(vehicle);
    }
  }
  return vehicles;
}

function extractTradeOffOptions(flat: FlatScenario): string[] {
  const opts: string[] = [];
  for (let i = 0; i < 4; i++) {
    const opt = flat[`tradeOffOption${i}`] as string | undefined;
    if (opt) opts.push(opt);
  }
  return opts;
}

// ============================================================================
// Best Vehicle Recomputation (mirrors component's computeVehicleOutcome)
// ============================================================================

interface VehicleOutcome {
  vehicleId: string;
  totalTrips: number;
  totalTimeMinutes: number;
  totalCost: number;
  totalCO2: number;
  allConstraintsMet: boolean;
  constraintResults: { type: string; met: boolean; actual: number; limit: number }[];
}

function computeOutcome(
  vehicle: VehicleOption,
  distanceKm: number,
  peopleToTransport: number,
  constraints: TransportConstraint[],
): VehicleOutcome {
  const totalTrips = Math.ceil(peopleToTransport / vehicle.capacity);
  const fleetSize = Math.min(totalTrips, MAX_FLEET_SIZE);
  const outboundMinutes = (distanceKm / vehicle.speedKmh) * 60;
  const batches = Math.ceil(totalTrips / fleetSize);
  const roundTripMinutes = outboundMinutes * 2 + vehicle.turnaroundMinutes;
  const totalTimeMinutes =
    outboundMinutes +
    (batches > 1 ? (batches - 1) * roundTripMinutes : 0) +
    vehicle.turnaroundMinutes / 2;
  const totalCost = totalTrips * vehicle.costPerTrip + (vehicle.infrastructureCost ?? 0);
  const totalCO2 = totalTrips * vehicle.co2PerTrip;

  const constraintResults = constraints.map((c) => {
    const actual =
      c.type === "budget" ? totalCost : c.type === "time" ? totalTimeMinutes : totalCO2;
    return { type: c.type, met: actual <= c.limit, actual, limit: c.limit };
  });

  return {
    vehicleId: vehicle.id,
    totalTrips,
    totalTimeMinutes,
    totalCost,
    totalCO2,
    allConstraintsMet: constraintResults.every((r) => r.met),
    constraintResults,
  };
}

/**
 * Recompute bestVehicleId using the same math the component uses.
 * Returns the vehicle ID that:
 *  1. Meets all constraints (if any vehicle does), with lowest total cost
 *  2. Otherwise, the vehicle failing the fewest constraints
 */
function recomputeBestVehicle(
  vehicles: VehicleOption[],
  distanceKm: number,
  peopleToTransport: number,
  constraints: TransportConstraint[],
): string {
  const outcomes = vehicles.map((v) =>
    computeOutcome(v, distanceKm, peopleToTransport, constraints),
  );

  // Prefer vehicles meeting all constraints, then sort by total cost
  const passing = outcomes.filter((o) => o.allConstraintsMet);
  if (passing.length > 0) {
    passing.sort((a, b) => a.totalCost - b.totalCost);
    return passing[0].vehicleId;
  }

  // No vehicle meets all constraints — pick the one failing fewest
  outcomes.sort((a, b) => {
    const aFails = a.constraintResults.filter((r) => !r.met).length;
    const bFails = b.constraintResults.filter((r) => !r.met).length;
    if (aFails !== bFails) return aFails - bFails;
    return a.totalCost - b.totalCost;
  });
  return outcomes[0].vehicleId;
}

/**
 * Compute acceptable vehicle IDs: vehicles that meet all constraints
 * (excluding the best vehicle itself).
 */
function computeAcceptableVehicles(
  vehicles: VehicleOption[],
  bestVehicleId: string,
  distanceKm: number,
  peopleToTransport: number,
  constraints: TransportConstraint[],
): string[] {
  return vehicles
    .filter((v) => v.id !== bestVehicleId)
    .filter((v) =>
      computeOutcome(v, distanceKm, peopleToTransport, constraints).allConstraintsMet,
    )
    .map((v) => v.id);
}

// ============================================================================
// Validate & Reconstruct a Scenario from Flat Gemini Output
// ============================================================================

function reconstructScenario(
  flat: FlatScenario,
  scenarioType: TransportScenario["type"],
  index: number,
  maxVehicles: number,
  maxConstraints: number,
): TransportScenario | null {
  const title = flat.title as string | undefined;
  const origin = flat.origin as string | undefined;
  const destination = flat.destination as string | undefined;
  const distanceKm = flat.distanceKm as number | undefined;
  const peopleToTransport = flat.peopleToTransport as number | undefined;
  const explanation = flat.explanation as string | undefined;
  const tradeOffQuestion = flat.tradeOffQuestion as string | undefined;
  const tradeOffCorrectIndex = flat.tradeOffCorrectIndex as number | undefined;

  // Validate required scalars
  if (
    !title || !origin || !destination || !explanation || !tradeOffQuestion ||
    typeof distanceKm !== "number" || distanceKm <= 0 ||
    typeof peopleToTransport !== "number" || peopleToTransport <= 0 ||
    typeof tradeOffCorrectIndex !== "number"
  ) {
    console.warn(`[TransportChallenge] Scenario ${index}: missing required scalar fields`);
    return null;
  }

  // Extract arrays
  const constraints = extractConstraints(flat, maxConstraints);
  const vehicles = extractVehicles(flat, maxVehicles);
  const tradeOffOptions = extractTradeOffOptions(flat);

  // Validate array sizes
  if (constraints.length < 1) {
    console.warn(`[TransportChallenge] Scenario ${index}: no valid constraints`);
    return null;
  }
  if (vehicles.length < 3) {
    console.warn(`[TransportChallenge] Scenario ${index}: fewer than 3 valid vehicles (got ${vehicles.length})`);
    return null;
  }
  if (tradeOffOptions.length !== 4) {
    console.warn(`[TransportChallenge] Scenario ${index}: need exactly 4 tradeOffOptions (got ${tradeOffOptions.length})`);
    return null;
  }

  // Validate tradeOffCorrectIndex range
  const safeCorrectIndex = Math.max(0, Math.min(3, Math.round(tradeOffCorrectIndex)));

  // Recompute bestVehicleId using real math
  const bestVehicleId = recomputeBestVehicle(
    vehicles,
    distanceKm,
    peopleToTransport,
    constraints,
  );

  // Compute acceptable vehicles
  const acceptableVehicleIds = computeAcceptableVehicles(
    vehicles,
    bestVehicleId,
    distanceKm,
    peopleToTransport,
    constraints,
  );

  return {
    id: `s${index}`,
    type: scenarioType,
    title,
    origin,
    destination,
    distanceKm,
    peopleToTransport,
    constraints,
    vehicles,
    bestVehicleId,
    acceptableVehicleIds,
    tradeOffQuestion,
    tradeOffOptions,
    tradeOffCorrectIndex: safeCorrectIndex,
    explanation,
  };
}

// ============================================================================
// Per-Type Schemas (flat, no nullable fields)
// ============================================================================

const constraintTypeEnum = {
  type: Type.STRING,
  enum: ["budget", "time", "co2"],
};

const vehicleEmojiEnum = {
  type: Type.STRING,
  enum: ["🚗", "🚌", "🚐", "🚂", "✈️", "🚢", "🚲", "🏍️"],
};

const vehicleColorEnum = {
  type: Type.STRING,
  enum: ["#3b82f6", "#ef4444", "#22c55e", "#f59e0b", "#8b5cf6"],
};

function makeVehicleFields(index: number): Record<string, Schema> {
  return {
    [`vehicle${index}Name`]: { type: Type.STRING, description: `Vehicle ${index} display name` },
    [`vehicle${index}Emoji`]: { ...vehicleEmojiEnum, description: `Vehicle ${index} emoji icon` },
    [`vehicle${index}Capacity`]: { type: Type.NUMBER, description: `Vehicle ${index} passenger capacity per trip` },
    [`vehicle${index}SpeedKmh`]: { type: Type.NUMBER, description: `Vehicle ${index} speed in km/h` },
    [`vehicle${index}CostPerTrip`]: { type: Type.NUMBER, description: `Vehicle ${index} cost per trip in dollars` },
    [`vehicle${index}Co2PerTrip`]: { type: Type.NUMBER, description: `Vehicle ${index} CO2 per trip in kg` },
    [`vehicle${index}TurnaroundMinutes`]: { type: Type.NUMBER, description: `Vehicle ${index} turnaround time between trips in minutes` },
    [`vehicle${index}Color`]: { ...vehicleColorEnum, description: `Vehicle ${index} display color` },
  };
}

function makeConstraintFields(index: number): Record<string, Schema> {
  return {
    [`constraint${index}Type`]: { ...constraintTypeEnum, description: `Constraint ${index} type` },
    [`constraint${index}Limit`]: { type: Type.NUMBER, description: `Constraint ${index} limit value` },
    [`constraint${index}Unit`]: { type: Type.STRING, description: `Constraint ${index} unit (e.g., 'dollars', 'minutes', 'kg CO2')` },
  };
}

const sharedScenarioFields: Record<string, Schema> = {
  title: { type: Type.STRING, description: "Engaging scenario description" },
  origin: { type: Type.STRING, description: "Origin city/location" },
  destination: { type: Type.STRING, description: "Destination city/location" },
  distanceKm: { type: Type.NUMBER, description: "Realistic distance in kilometers" },
  peopleToTransport: { type: Type.NUMBER, description: "Number of people to move (10-500)" },
  tradeOffQuestion: { type: Type.STRING, description: "Multiple choice question about trade-offs" },
  tradeOffOption0: { type: Type.STRING, description: "Trade-off answer option 1" },
  tradeOffOption1: { type: Type.STRING, description: "Trade-off answer option 2" },
  tradeOffOption2: { type: Type.STRING, description: "Trade-off answer option 3" },
  tradeOffOption3: { type: Type.STRING, description: "Trade-off answer option 4" },
  tradeOffCorrectIndex: { type: Type.NUMBER, description: "Index (0-3) of the correct trade-off option" },
  explanation: { type: Type.STRING, description: "Explanation of why the best vehicle is optimal" },
};

// Single constraint: 1 constraint, 3-4 vehicles
const singleConstraintSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    scenarios: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          ...sharedScenarioFields,
          ...makeConstraintFields(0),
          ...makeVehicleFields(0),
          ...makeVehicleFields(1),
          ...makeVehicleFields(2),
          ...makeVehicleFields(3),
        },
        required: [
          "title", "origin", "destination", "distanceKm", "peopleToTransport",
          "constraint0Type", "constraint0Limit", "constraint0Unit",
          "vehicle0Name", "vehicle0Emoji", "vehicle0Capacity", "vehicle0SpeedKmh",
          "vehicle0CostPerTrip", "vehicle0Co2PerTrip", "vehicle0TurnaroundMinutes", "vehicle0Color",
          "vehicle1Name", "vehicle1Emoji", "vehicle1Capacity", "vehicle1SpeedKmh",
          "vehicle1CostPerTrip", "vehicle1Co2PerTrip", "vehicle1TurnaroundMinutes", "vehicle1Color",
          "vehicle2Name", "vehicle2Emoji", "vehicle2Capacity", "vehicle2SpeedKmh",
          "vehicle2CostPerTrip", "vehicle2Co2PerTrip", "vehicle2TurnaroundMinutes", "vehicle2Color",
          "tradeOffQuestion", "tradeOffOption0", "tradeOffOption1", "tradeOffOption2", "tradeOffOption3",
          "tradeOffCorrectIndex", "explanation",
        ],
      },
      description: "3 single-constraint transport scenarios",
    },
  },
  required: ["scenarios"],
};

// Multi constraint: 2-3 constraints, 4 vehicles
const multiConstraintSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    scenarios: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          ...sharedScenarioFields,
          ...makeConstraintFields(0),
          ...makeConstraintFields(1),
          ...makeConstraintFields(2),
          ...makeVehicleFields(0),
          ...makeVehicleFields(1),
          ...makeVehicleFields(2),
          ...makeVehicleFields(3),
        },
        required: [
          "title", "origin", "destination", "distanceKm", "peopleToTransport",
          "constraint0Type", "constraint0Limit", "constraint0Unit",
          "constraint1Type", "constraint1Limit", "constraint1Unit",
          "vehicle0Name", "vehicle0Emoji", "vehicle0Capacity", "vehicle0SpeedKmh",
          "vehicle0CostPerTrip", "vehicle0Co2PerTrip", "vehicle0TurnaroundMinutes", "vehicle0Color",
          "vehicle1Name", "vehicle1Emoji", "vehicle1Capacity", "vehicle1SpeedKmh",
          "vehicle1CostPerTrip", "vehicle1Co2PerTrip", "vehicle1TurnaroundMinutes", "vehicle1Color",
          "vehicle2Name", "vehicle2Emoji", "vehicle2Capacity", "vehicle2SpeedKmh",
          "vehicle2CostPerTrip", "vehicle2Co2PerTrip", "vehicle2TurnaroundMinutes", "vehicle2Color",
          "vehicle3Name", "vehicle3Emoji", "vehicle3Capacity", "vehicle3SpeedKmh",
          "vehicle3CostPerTrip", "vehicle3Co2PerTrip", "vehicle3TurnaroundMinutes", "vehicle3Color",
          "tradeOffQuestion", "tradeOffOption0", "tradeOffOption1", "tradeOffOption2", "tradeOffOption3",
          "tradeOffCorrectIndex", "explanation",
        ],
      },
      description: "3 multi-constraint transport scenarios",
    },
  },
  required: ["scenarios"],
};

// Full optimization: 3-4 constraints, 4-5 vehicles
const fullOptimizationSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    scenarios: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          ...sharedScenarioFields,
          ...makeConstraintFields(0),
          ...makeConstraintFields(1),
          ...makeConstraintFields(2),
          ...makeConstraintFields(3),
          ...makeVehicleFields(0),
          ...makeVehicleFields(1),
          ...makeVehicleFields(2),
          ...makeVehicleFields(3),
          ...makeVehicleFields(4),
        },
        required: [
          "title", "origin", "destination", "distanceKm", "peopleToTransport",
          "constraint0Type", "constraint0Limit", "constraint0Unit",
          "constraint1Type", "constraint1Limit", "constraint1Unit",
          "constraint2Type", "constraint2Limit", "constraint2Unit",
          "vehicle0Name", "vehicle0Emoji", "vehicle0Capacity", "vehicle0SpeedKmh",
          "vehicle0CostPerTrip", "vehicle0Co2PerTrip", "vehicle0TurnaroundMinutes", "vehicle0Color",
          "vehicle1Name", "vehicle1Emoji", "vehicle1Capacity", "vehicle1SpeedKmh",
          "vehicle1CostPerTrip", "vehicle1Co2PerTrip", "vehicle1TurnaroundMinutes", "vehicle1Color",
          "vehicle2Name", "vehicle2Emoji", "vehicle2Capacity", "vehicle2SpeedKmh",
          "vehicle2CostPerTrip", "vehicle2Co2PerTrip", "vehicle2TurnaroundMinutes", "vehicle2Color",
          "vehicle3Name", "vehicle3Emoji", "vehicle3Capacity", "vehicle3SpeedKmh",
          "vehicle3CostPerTrip", "vehicle3Co2PerTrip", "vehicle3TurnaroundMinutes", "vehicle3Color",
          "tradeOffQuestion", "tradeOffOption0", "tradeOffOption1", "tradeOffOption2", "tradeOffOption3",
          "tradeOffCorrectIndex", "explanation",
        ],
      },
      description: "3 full-optimization transport scenarios",
    },
  },
  required: ["scenarios"],
};

// ============================================================================
// Hardcoded Fallbacks (one per type)
// ============================================================================

const FALLBACKS: Record<string, TransportScenario> = {
  single_constraint: {
    id: "s0",
    type: "single_constraint",
    title: "School Museum Trip",
    origin: "Maple Elementary School",
    destination: "City Science Museum",
    distanceKm: 15,
    peopleToTransport: 30,
    constraints: [{ type: "budget", limit: 200, unit: "dollars" }],
    vehicles: [
      { id: "v0", name: "Sedan", emoji: "🚗", capacity: 4, speedKmh: 50, costPerTrip: 15, co2PerTrip: 3, turnaroundMinutes: 10, color: "#3b82f6" },
      { id: "v1", name: "Minivan", emoji: "🚐", capacity: 12, speedKmh: 50, costPerTrip: 40, co2PerTrip: 8, turnaroundMinutes: 10, color: "#ef4444" },
      { id: "v2", name: "School Bus", emoji: "🚌", capacity: 30, speedKmh: 40, costPerTrip: 80, co2PerTrip: 15, turnaroundMinutes: 15, color: "#f59e0b" },
    ],
    bestVehicleId: "v2",
    acceptableVehicleIds: ["v1"],
    tradeOffQuestion: "Why is the school bus the best choice for this trip?",
    tradeOffOptions: [
      "It is the fastest vehicle",
      "It carries everyone in one trip for $80, well under the $200 budget",
      "It produces the least CO2 per person",
      "It is the cheapest per trip",
    ],
    tradeOffCorrectIndex: 1,
    explanation: "The bus carries all 30 students in a single trip for $80 — well within the $200 budget. Sedans would need 8 trips ($120) and vans need 3 trips ($120), both viable but less efficient.",
  },
  multi_constraint: {
    id: "s0",
    type: "multi_constraint",
    title: "Commuter Rush Hour Challenge",
    origin: "Oakville Suburbs",
    destination: "Downtown Business District",
    distanceKm: 50,
    peopleToTransport: 100,
    constraints: [
      { type: "budget", limit: 500, unit: "dollars" },
      { type: "time", limit: 180, unit: "minutes" },
    ],
    vehicles: [
      { id: "v0", name: "Sedan", emoji: "🚗", capacity: 4, speedKmh: 60, costPerTrip: 10, co2PerTrip: 5, turnaroundMinutes: 10, color: "#3b82f6" },
      { id: "v1", name: "Minivan", emoji: "🚐", capacity: 12, speedKmh: 55, costPerTrip: 30, co2PerTrip: 10, turnaroundMinutes: 10, color: "#ef4444" },
      { id: "v2", name: "City Bus", emoji: "🚌", capacity: 50, speedKmh: 45, costPerTrip: 100, co2PerTrip: 30, turnaroundMinutes: 15, color: "#22c55e" },
      { id: "v3", name: "Express Train", emoji: "🚂", capacity: 100, speedKmh: 120, costPerTrip: 150, co2PerTrip: 15, turnaroundMinutes: 5, color: "#8b5cf6" },
    ],
    bestVehicleId: "v3",
    acceptableVehicleIds: [],
    tradeOffQuestion: "What makes the train better than the bus for this route?",
    tradeOffOptions: [
      "The train is cheaper per person",
      "The train moves everyone in 1 trip within time and budget",
      "The train uses less fuel than any other option",
      "The train has more comfortable seats",
    ],
    tradeOffCorrectIndex: 1,
    explanation: "The express train carries all 100 people in a single trip for $150 (within budget) and takes about 30 minutes (within the 3-hour limit). The bus needs 2 trips and is slower.",
  },
  full_optimization: {
    id: "s0",
    type: "full_optimization",
    title: "London to Paris Tourist Transfer",
    origin: "London Victoria",
    destination: "Paris Gare du Nord",
    distanceKm: 450,
    peopleToTransport: 200,
    constraints: [
      { type: "budget", limit: 3000, unit: "dollars" },
      { type: "time", limit: 300, unit: "minutes" },
      { type: "co2", limit: 1000, unit: "kg CO2" },
    ],
    vehicles: [
      { id: "v0", name: "Car", emoji: "🚗", capacity: 4, speedKmh: 80, costPerTrip: 20, co2PerTrip: 5, turnaroundMinutes: 15, color: "#3b82f6" },
      { id: "v1", name: "Coach Bus", emoji: "🚌", capacity: 50, speedKmh: 70, costPerTrip: 150, co2PerTrip: 30, turnaroundMinutes: 20, color: "#ef4444" },
      { id: "v2", name: "Eurostar Train", emoji: "🚂", capacity: 100, speedKmh: 300, costPerTrip: 500, co2PerTrip: 15, turnaroundMinutes: 10, color: "#22c55e" },
      { id: "v3", name: "Airplane", emoji: "✈️", capacity: 200, speedKmh: 800, costPerTrip: 2500, co2PerTrip: 400, turnaroundMinutes: 60, color: "#f59e0b" },
    ],
    bestVehicleId: "v2",
    acceptableVehicleIds: [],
    tradeOffQuestion: "Why is there no perfect vehicle for this scenario?",
    tradeOffOptions: [
      "Cars are too slow and expensive for 200 people",
      "The plane is fast but blows the CO2 budget with 400kg",
      "Every vehicle exceeds at least one constraint or requires multiple trips",
      "Buses are cheap but too slow to make 4 trips in 5 hours",
    ],
    tradeOffCorrectIndex: 2,
    explanation: "The train is the best compromise: 2 trips at $1000 total, ~100 min travel, 30kg CO2. The plane is 1 trip but costs $2500 and 400kg CO2. Buses need 4 trips and are too slow. Cars need 50 trips.",
  },
};

// ============================================================================
// Per-Type Sub-Generators
// ============================================================================

async function generateSingleConstraintScenarios(
  topic: string,
  gradeLevel: string,
): Promise<TransportScenario[]> {
  const prompt = `
Create 3 educational TRANSPORT CHALLENGE scenarios for "${topic}" (${gradeLevel} students).
Theme: ${randomTheme()}.

Each scenario has ONE constraint and 3-4 vehicles. ONE vehicle must clearly be the best choice.

RULES:
- distanceKm: realistic (5-100km for local, 100-500km for regional)
- peopleToTransport: 10-100
- Each vehicle needs realistic: capacity (2-50), speedKmh (10-120), costPerTrip (5-200), co2PerTrip (1-50), turnaroundMinutes (5-30)
- ONE constraint only: budget OR time OR co2
- Set constraint limits so exactly 1-2 vehicles clearly satisfy it, with one being obviously best
- The tradeOffQuestion should test understanding of WHY the best vehicle wins
- tradeOffCorrectIndex: 0-3 index into the 4 options
- Make scenarios varied: different origins, destinations, group sizes

CRITICAL MATH CHECK:
For budget constraint: totalTrips = ceil(people/capacity), totalCost = totalTrips * costPerTrip
For time constraint: approximate totalTime = (distanceKm/speedKmh)*60*2 * ceil(totalTrips/15) minutes
For co2 constraint: totalCO2 = totalTrips * co2PerTrip
Set the constraint limit so only 1-2 vehicles pass.

Generate 3 scenarios with increasing difficulty.
`;

  const result = await ai.models.generateContent({
    model: "gemini-flash-lite-latest",
    contents: prompt,
    config: { responseMimeType: "application/json", responseSchema: singleConstraintSchema },
  });

  const data = result.text ? JSON.parse(result.text) : null;
  if (!data?.scenarios?.length) return [];

  return (data.scenarios as FlatScenario[])
    .map((flat, i) => reconstructScenario(flat, "single_constraint", i, 4, 1))
    .filter((s): s is TransportScenario => s !== null);
}

async function generateMultiConstraintScenarios(
  topic: string,
  gradeLevel: string,
): Promise<TransportScenario[]> {
  const prompt = `
Create 3 educational TRANSPORT CHALLENGE scenarios for "${topic}" (${gradeLevel} students).
Theme: ${randomTheme()}.

Each scenario has 2-3 constraints and 4 vehicles. At least 2 vehicles should meet all constraints.

RULES:
- distanceKm: 20-200km
- peopleToTransport: 30-200
- Each vehicle needs realistic: capacity (4-100), speedKmh (20-300), costPerTrip (10-500), co2PerTrip (2-100), turnaroundMinutes (5-30)
- Use 2-3 different constraint types (budget, time, co2)
- Set limits so there are TRADE-OFFS: e.g., cheapest vehicle is slowest, fastest pollutes most
- tradeOffQuestion tests understanding of the trade-off
- tradeOffCorrectIndex: 0-3

CRITICAL MATH CHECK:
totalTrips = ceil(people/capacity)
totalCost = totalTrips * costPerTrip
totalCO2 = totalTrips * co2PerTrip
Approximate time: (distance/speed)*60 for outbound, plus turnaround per batch

Generate 3 scenarios with realistic trade-offs.
`;

  const result = await ai.models.generateContent({
    model: "gemini-flash-lite-latest",
    contents: prompt,
    config: { responseMimeType: "application/json", responseSchema: multiConstraintSchema },
  });

  const data = result.text ? JSON.parse(result.text) : null;
  if (!data?.scenarios?.length) return [];

  return (data.scenarios as FlatScenario[])
    .map((flat, i) => reconstructScenario(flat, "multi_constraint", i, 4, 3))
    .filter((s): s is TransportScenario => s !== null);
}

async function generateFullOptimizationScenarios(
  topic: string,
  gradeLevel: string,
): Promise<TransportScenario[]> {
  const prompt = `
Create 3 educational TRANSPORT CHALLENGE scenarios for "${topic}" (${gradeLevel} students).
Theme: ${randomTheme()}.

Each scenario has 3-4 constraints and 4-5 vehicles. NO vehicle should perfectly satisfy all constraints.
Every vehicle should fail at least one constraint or be suboptimal — students must find the LEAST BAD option.

RULES:
- distanceKm: 50-500km
- peopleToTransport: 50-500
- Each vehicle needs realistic: capacity (4-200), speedKmh (20-800), costPerTrip (10-3000), co2PerTrip (2-500), turnaroundMinutes (5-60)
- Use 3-4 different constraint types (budget, time, co2)
- Set limits TIGHT so no vehicle meets all — each has a weakness
- tradeOffQuestion explores the optimization challenge
- tradeOffCorrectIndex: 0-3

CRITICAL: Design so every vehicle busts at least one constraint. The "best" is the one that comes closest overall.

Generate 3 complex optimization scenarios.
`;

  const result = await ai.models.generateContent({
    model: "gemini-flash-lite-latest",
    contents: prompt,
    config: { responseMimeType: "application/json", responseSchema: fullOptimizationSchema },
  });

  const data = result.text ? JSON.parse(result.text) : null;
  if (!data?.scenarios?.length) return [];

  return (data.scenarios as FlatScenario[])
    .map((flat, i) => reconstructScenario(flat, "full_optimization", i, 5, 4))
    .filter((s): s is TransportScenario => s !== null);
}

// ============================================================================
// Main Generator (Orchestrator Pattern)
// ============================================================================

export const generateTransportChallenge = async (
  topic: string,
  gradeLevel: string,
  config?: Partial<{ targetEvalMode?: string }>,
): Promise<TransportChallengeData> => {
  // ── Resolve eval mode ──
  const evalConstraint = resolveEvalModeConstraint(
    "transport-challenge",
    config?.targetEvalMode,
    CHALLENGE_TYPE_DOCS,
  );
  logEvalModeResolution("TransportChallenge", config?.targetEvalMode, evalConstraint);

  const allowedTypes = evalConstraint?.allowedTypes ?? Object.keys(CHALLENGE_TYPE_DOCS);

  // ── Dispatch sub-generators in parallel ──
  const generators: Promise<TransportScenario[]>[] = [];
  const typeOrder: string[] = [];

  for (const type of allowedTypes) {
    typeOrder.push(type);
    switch (type) {
      case "single_constraint":
        generators.push(generateSingleConstraintScenarios(topic, gradeLevel));
        break;
      case "multi_constraint":
        generators.push(generateMultiConstraintScenarios(topic, gradeLevel));
        break;
      case "full_optimization":
        generators.push(generateFullOptimizationScenarios(topic, gradeLevel));
        break;
    }
  }

  const results = await Promise.all(generators);

  // ── Combine results ──
  let scenarios: TransportScenario[] = results.flat();

  // Re-assign IDs sequentially
  scenarios = scenarios.map((s, i) => ({ ...s, id: `s${i}` }));

  // ── Log rejection counts ──
  let totalGenerated = 0;
  for (const r of results) totalGenerated += r.length;
  const rejected = results.reduce((sum, r, i) => {
    // We asked for 3 per type; anything less is a rejection
    return sum + Math.max(0, 3 - r.length);
  }, 0);
  if (rejected > 0) {
    console.warn(`[TransportChallenge] Rejected ${rejected} scenario(s) during validation`);
  }

  // ── Fallback if empty ──
  if (scenarios.length === 0) {
    const fallbackType = allowedTypes[0] ?? "single_constraint";
    console.warn(`[TransportChallenge] No valid scenarios — using ${fallbackType} fallback`);
    scenarios = [FALLBACKS[fallbackType] ?? FALLBACKS.single_constraint];
  }

  // ── Build title from active types ──
  const typeLabels: Record<string, string> = {
    single_constraint: "Single Constraint",
    multi_constraint: "Multi-Constraint",
    full_optimization: "Full Optimization",
  };
  const activeLabels = allowedTypes.map((t) => typeLabels[t] ?? t).join(" & ");

  return {
    title: `Transport Challenge: ${activeLabels}`,
    description: `Pick the best vehicle for each scenario. Consider cost, time, and environmental impact to transport everyone safely!`,
    scenarios,
  };
};
