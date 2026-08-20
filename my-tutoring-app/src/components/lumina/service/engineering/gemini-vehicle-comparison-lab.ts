import { Type, Schema } from "@google/genai";
import { ai } from "../geminiClient";
import type { GenerationContext } from "../generation/generationContext";
import { buildScopePromptSection } from '../scopeContext';
import {
  resolveEvalModes,
  constrainChallengeTypeEnum,
  buildModeConstraintSection,
  type ChallengeTypeDoc,
} from '../evalMode';
import {
  VEHICLE_VISUAL_KINDS,
  resolveVehicleVisualKind,
} from '../../primitives/visual-primitives/engineering/vehicleVisualKind';

// Import types from the component - single source of truth
import type {
  VehicleComparisonLabData,
  ComparisonVehicle,
  ComparisonChallenge,
  SurprisingFact,
  ComparisonMetricKey,
} from '../../primitives/visual-primitives/engineering/VehicleComparisonLab';

// Re-export for convenience
export type { VehicleComparisonLabData };

type ComparisonChallengeType = 'metric_leader' | 'evidence_choice' | 'constraint_tradeoff';

const CHALLENGE_TYPE_DOCS: Record<ComparisonChallengeType, ChallengeTypeDoc> = {
  metric_leader: {
    promptDoc:
      '"metric_leader": Name one visible comparison metric in the scenario. The student reads that column and chooses the vehicle with the greatest value (or the lowest non-null CO2 value). Set bestEvidenceMetric to that named metric; no separate evidence choice is required.',
    schemaDescription: "'metric_leader' (read one metric and identify its leader)",
  },
  evidence_choice: {
    promptDoc:
      '"evidence_choice": Ask the student to choose the best vehicle for a one-priority scenario AND choose which visible metric supports the claim. The keyed vehicle must be the mathematical leader on bestEvidenceMetric; keep the scenario answer-free.',
    schemaDescription: "'evidence_choice' (choose a vehicle and cite its supporting metric)",
  },
  constraint_tradeoff: {
    promptDoc:
      '"constraint_tradeoff": Give meaningful passenger and distance minimums that rule out at least one vehicle, plus one priority (speed, capacity, range, or environment). The student must first find the vehicles that satisfy BOTH minimums, then choose the feasible vehicle that leads on the priority metric and cite that metric.',
    schemaDescription: "'constraint_tradeoff' (filter by constraints, then justify a priority trade-off)",
  },
};

const CHALLENGE_TYPES = Object.keys(CHALLENGE_TYPE_DOCS) as ComparisonChallengeType[];

/**
 * Schema for Vehicle Metric
 */
const vehicleMetricSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    value: { type: Type.NUMBER, description: "Numeric value for comparison (e.g., 920 for 920 km/h)." },
    unit: { type: Type.STRING, description: "Unit of measurement (e.g., 'km/h', 'kg', 'passengers')." },
    display: { type: Type.STRING, description: "Human-readable display string (e.g., '920 km/h')." },
  },
  required: ["value", "unit", "display"]
};

/**
 * Schema for Comparison Vehicle
 */
const comparisonVehicleSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    id: { type: Type.STRING, description: "Unique identifier for this vehicle (kebab-case)." },
    name: { type: Type.STRING, description: "Full name of the vehicle (e.g., 'Boeing 747-400')." },
    category: { type: Type.STRING, enum: ["air", "land", "sea", "space"], description: "Transportation domain." },
    visualKind: {
      type: Type.STRING,
      enum: [...VEHICLE_VISUAL_KINDS],
      description: "Specific visual form of this vehicle. Use generic only when none of the named forms is honest.",
    },
    imagePrompt: { type: Type.STRING, description: "Detailed prompt for AI image generation of this vehicle." },
    metrics: {
      type: Type.OBJECT,
      properties: {
        topSpeed: vehicleMetricSchema,
        weight: vehicleMetricSchema,
        passengerCapacity: vehicleMetricSchema,
        range: vehicleMetricSchema,
        fuelType: { type: Type.STRING, description: "Type of fuel or energy source." },
        yearIntroduced: { type: Type.NUMBER, description: "Year this vehicle was first introduced." },
        costPerTrip: { type: Type.STRING, nullable: true, description: "Approximate cost per trip or per passenger." },
        co2PerPassengerKm: { type: Type.NUMBER, nullable: true, description: "CO2 emissions per passenger-kilometer in grams." },
      },
      required: ["topSpeed", "weight", "passengerCapacity", "range", "fuelType", "yearIntroduced"]
    },
    funFact: { type: Type.STRING, description: "An engaging fun fact about this vehicle that kids will want to share." },
  },
  required: ["id", "name", "category", "visualKind", "imagePrompt", "metrics", "funFact"]
};

/**
 * Schema for Comparison Challenge
 */
const comparisonChallengeSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    id: { type: Type.STRING, description: "Unique kebab-case challenge ID." },
    type: { type: Type.STRING, enum: CHALLENGE_TYPES },
    scenario: { type: Type.STRING, description: "Real-world transportation scenario (e.g., 'Move 500 people from Tokyo to Osaka')." },
    origin: { type: Type.STRING, nullable: true },
    destination: { type: Type.STRING, nullable: true },
    constraints: {
      type: Type.OBJECT,
      properties: {
        passengers: { type: Type.NUMBER, description: "Number of passengers to transport." },
        distance: { type: Type.NUMBER, description: "Distance in kilometers." },
        maxTime: { type: Type.STRING, nullable: true, description: "Maximum acceptable travel time." },
        priority: { type: Type.STRING, enum: ["speed", "capacity", "range", "weight", "environment"] },
      },
      required: ["passengers", "distance", "maxTime", "priority"]
    },
    bestVehicleId: { type: Type.STRING, description: "ID of the best vehicle for this scenario." },
    explanation: { type: Type.STRING, description: "Why this vehicle is the best choice, using data." },
    acceptableAlternatives: { type: Type.ARRAY, items: { type: Type.STRING }, description: "IDs of other acceptable vehicle choices." },
    bestEvidenceMetric: { type: Type.STRING, enum: ["topSpeed", "weight", "passengerCapacity", "range", "yearIntroduced", "co2PerPassengerKm"] },
    acceptableEvidenceMetrics: { type: Type.ARRAY, items: { type: Type.STRING, enum: ["topSpeed", "weight", "passengerCapacity", "range", "yearIntroduced", "co2PerPassengerKm"] } },
  },
  required: ["id", "type", "scenario", "origin", "destination", "constraints", "bestVehicleId", "explanation", "acceptableAlternatives", "bestEvidenceMetric", "acceptableEvidenceMetrics"]
};

/**
 * Schema for Surprising Fact
 */
const surprisingFactSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    fact: { type: Type.STRING, description: "A counterintuitive or surprising comparison fact." },
    vehicleIds: { type: Type.ARRAY, items: { type: Type.STRING }, description: "IDs of vehicles involved in this fact." },
  },
  required: ["fact", "vehicleIds"]
};

/**
 * Schema for Vehicle Comparison Lab Data
 */
const vehicleComparisonLabSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    title: { type: Type.STRING, description: "Title for the comparison lab (e.g., 'Air vs Land vs Sea')." },
    instructions: { type: Type.STRING, description: "Brief instructions for the student." },
    topicFocus: { type: Type.STRING, description: "Short phrase naming the requested comparison focus." },
    vehicles: {
      type: Type.ARRAY,
      items: comparisonVehicleSchema,
      minItems: "4",
      maxItems: "6",
      description: "Array of 4-6 topic-specific vehicles to compare.",
    },
    comparisonMetrics: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Which metrics to show in the comparison chart (e.g., 'topSpeed', 'weight', 'passengerCapacity', 'range')." },
    chartType: { type: Type.STRING, enum: ["bar", "radar", "scatter", "table"], description: "Default chart type for the comparison." },
    challengeType: { type: Type.STRING, enum: CHALLENGE_TYPES },
    challenges: { type: Type.ARRAY, items: comparisonChallengeSchema, description: "2-3 transportation scenario challenges." },
    surprisingFacts: { type: Type.ARRAY, items: surprisingFactSchema, description: "2-3 counterintuitive comparison facts." },
    gradeBand: { type: Type.STRING, enum: ["K-2", "3-5"], description: "Grade band for content complexity." },
  },
  required: ["title", "instructions", "topicFocus", "vehicles", "comparisonMetrics", "chartType", "challengeType", "challenges", "surprisingFacts", "gradeBand"]
};

/**
 * Generate Vehicle Comparison Lab data
 */
export const generateVehicleComparisonLab = async (
  ctx: GenerationContext,
): Promise<VehicleComparisonLabData> => {
  const { topic } = ctx;
  const scopeSection = buildScopePromptSection(ctx.scope);
  const gradeLevel = ctx.gradeContext;
  const rawConfig = ctx.raw as Partial<VehicleComparisonLabData> & {
    targetEvalMode?: string;
    intent?: string;
    objectiveText?: string;
  };
  const config = {
    ...rawConfig,
    intent: ctx.intent ?? rawConfig.intent,
  };
  const resolution = await resolveEvalModes(
    'vehicle-comparison-lab',
    {
      targetEvalMode: config.targetEvalMode,
      intent: config.intent,
      objectiveText: config.objectiveText,
    },
    CHALLENGE_TYPE_DOCS,
  );
  const allowedTypes = resolution?.allowedTypes;
  const activeSchema = resolution
    ? constrainChallengeTypeEnum(vehicleComparisonLabSchema, resolution.allowedTypes, CHALLENGE_TYPE_DOCS)
    : vehicleComparisonLabSchema;
  const challengeTypeSection = buildModeConstraintSection(resolution, CHALLENGE_TYPE_DOCS);
  const {
    targetEvalMode: _targetEvalMode,
    intent: _intent,
    objectiveText: _objectiveText,
    ...contentConfig
  } = config;
  const hasContentConfig = Object.keys(contentConfig).length > 0;
  const prompt = `
Create a Vehicle Comparison Lab for teaching "${topic}"
${scopeSection} to ${gradeLevel} students.

TOPIC FIDELITY — AUTHORITATIVE:
- Build the entire roster around the LESSON TOPIC and THIS COMPONENT'S INTENT.
- If the scope names a class such as airplanes, bicycles, trains, boats, spacecraft, or construction vehicles, compare examples INSIDE that class. Never force a token air/land/sea mix.
- If the scope names vehicles, include those exact vehicles and only close, meaningful peers.
- If it names one vehicle, include it plus 3-5 peers that reveal its defining trade-offs.
- Use a mixed transport roster only when the scope itself is broad transportation comparison.
- title, instructions, topicFocus, every vehicle, scenario, and fact must reinforce the same focus.
- Set each vehicle's visualKind to its actual form (for example bicycle, bus, car, or train), not merely its broad air/land/sea/space category.

CONTEXT — VEHICLE COMPARISON:
A Vehicle Comparison Lab lets students compare real vehicles across multiple dimensions:
speed, weight, passenger capacity, range, fuel type, and environmental impact.

${challengeTypeSection}

REQUIRED VEHICLE DATA (use REAL statistics — never make up numbers):
Include 4-6 real vehicles that form the coherent topic-specific comparison set described above. A surprise vehicle is welcome only when it belongs in that set.

REFERENCE DATA (use only entries relevant to the authoritative topic; do not import unrelated examples):
- Boeing 747: 920 km/h, 178,756 kg, 416 pax, 14,200 km range
- Shinkansen N700: 300 km/h, 715,000 kg, 1,323 pax, 500 km/trip
- Tesla Model 3: 225 km/h, 1,760 kg, 5 pax, 580 km
- School Bus: 90 km/h, 10,000 kg, 72 pax, 450 km
- Bicycle: 25 km/h, 10 kg, 1 pax, unlimited range
- Container Ship: 46 km/h, 55,000,000 kg, 0 pax (15,000 TEU), 24,000 km
- Space Shuttle: 28,000 km/h, 2,030,000 kg, 7 crew, LEO
- Wright Flyer: 48 km/h, 274 kg, 1 pilot, 260 m

${!resolution ? `GRADE-LEVEL GUIDELINES:

GRADES K-2:
- Focus on big vs small, fast vs slow, few vs many
- Simple comparisons: "Which is faster?" "Which carries more people?"
- 4-5 vehicles maximum (too many is overwhelming)
- comparisonMetrics: ["topSpeed", "passengerCapacity", "weight"]
- chartType: "bar"
- Simple challenges: "Which vehicle takes you to school?"
- gradeBand: "K-2"
- Fun, wonder-driven language

GRADES 3-5:
- Trade-off analysis: "No vehicle is best at everything"
- 5-6 topic-specific vehicles; include environmental data only when it is meaningfully comparable
- comparisonMetrics: ["topSpeed", "weight", "passengerCapacity", "range", "co2PerPassengerKm"]
- chartType: "bar" (can toggle to table)
- Complex challenges with constraints
- gradeBand: "3-5"
- Data-driven reasoning language
` : ''}

FOR ALL GRADES:
- surprisingFacts must be genuine and counterintuitive
- challenges must reference actual vehicle IDs from the vehicles array
- All metric values must be real statistics
- funFact should make kids want to tell their parents
- Return exactly 3 challenges with unique IDs.
- Every challenge needs bestEvidenceMetric from comparisonMetrics.
- For metric_leader and evidence_choice, bestVehicleId is the mathematical maximum on bestEvidenceMetric, except CO2 where it is the minimum non-null value.
- For constraint_tradeoff, map priority to bestEvidenceMetric (speed=topSpeed, capacity=passengerCapacity, range=range, environment=co2PerPassengerKm). First filter to vehicles whose passengerCapacity and range meet the scenario minimums, then key the mathematical leader among those feasible vehicles. Do not use priority "weight" for this type.
- Make the pre-answer scenario answer-free: never name the best vehicle or its exact winning number.
- The post-answer explanation names the winner and quotes its exact visible value.
- Set topicFocus to the actual requested comparison focus and chartType to "bar". Set challengeType to the first challenge's type as representative metadata.

${hasContentConfig ? `CONFIGURATION HINTS:\n${JSON.stringify(contentConfig, null, 2)}` : ''}

Return a complete Vehicle Comparison Lab configuration.
`;

  console.log(
    `[VehicleComparisonLab] modes: ${resolution ? `${resolution.modes.map((mode) => mode.evalMode).join('+')} (${resolution.source})` : 'mixed'} -> types [${(allowedTypes ?? ['all']).join(', ')}]`,
  );

  const result = await ai.models.generateContent({
    model: "gemini-flash-lite-latest",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: activeSchema
    },
  });

  const data = result.text ? JSON.parse(result.text) : null;

  if (!data) {
    throw new Error('No valid Vehicle Comparison Lab data returned from Gemini API');
  }

  const metricKeys: ComparisonMetricKey[] = [
    'topSpeed', 'weight', 'passengerCapacity', 'range', 'yearIntroduced', 'co2PerPassengerKm',
  ];
  const isMetricKey = (value: unknown): value is ComparisonMetricKey =>
    typeof value === 'string' && metricKeys.includes(value as ComparisonMetricKey);

  if (!Array.isArray(data.vehicles) || data.vehicles.length < 4) {
    throw new Error('Vehicle Comparison Lab requires at least 4 topic-specific vehicles');
  }
  const seenVehicleIds = new Set<string>();
  data.vehicles = data.vehicles
    .filter((vehicle: ComparisonVehicle) => {
      if (!vehicle?.id || seenVehicleIds.has(vehicle.id)) return false;
      seenVehicleIds.add(vehicle.id);
      return !!vehicle.name && !!vehicle.metrics && !!vehicle.imagePrompt;
    })
    .map((vehicle: ComparisonVehicle) => ({
      ...vehicle,
      visualKind: resolveVehicleVisualKind(vehicle),
      imageUrl: null,
    }));
  if (data.vehicles.length < 4) {
    throw new Error('Vehicle Comparison Lab returned fewer than 4 valid unique vehicles');
  }

  data.topicFocus = typeof data.topicFocus === 'string' && data.topicFocus.trim()
    ? data.topicFocus.trim()
    : (ctx.intent || topic);
  data.chartType = 'bar';
  data.comparisonMetrics = (Array.isArray(data.comparisonMetrics) ? data.comparisonMetrics : [])
    .filter(isMetricKey)
    .filter((metric: ComparisonMetricKey, index: number, all: ComparisonMetricKey[]) => all.indexOf(metric) === index)
    .filter((metric: ComparisonMetricKey) => metric !== 'co2PerPassengerKm'
      || data.vehicles.filter((vehicle: ComparisonVehicle) => vehicle.metrics.co2PerPassengerKm != null).length >= 2);
  for (const fallbackMetric of ['topSpeed', 'passengerCapacity', 'range'] as ComparisonMetricKey[]) {
    if (data.comparisonMetrics.length >= 3) break;
    if (!data.comparisonMetrics.includes(fallbackMetric)) data.comparisonMetrics.push(fallbackMetric);
  }

  const valueFor = (vehicle: ComparisonVehicle, metric: ComparisonMetricKey): number | null => {
    if (metric === 'yearIntroduced') return vehicle.metrics.yearIntroduced;
    if (metric === 'co2PerPassengerKm') return vehicle.metrics.co2PerPassengerKm;
    return vehicle.metrics[metric].value;
  };
  const winnerFor = (
    metric: ComparisonMetricKey,
    candidates: ComparisonVehicle[] = data.vehicles,
  ): ComparisonVehicle | null => {
    const available = candidates.filter((vehicle: ComparisonVehicle) => valueFor(vehicle, metric) != null);
    if (available.length === 0) return null;
    return available.reduce((best: ComparisonVehicle, vehicle: ComparisonVehicle) => {
      const bestValue = valueFor(best, metric) ?? 0;
      const value = valueFor(vehicle, metric) ?? 0;
      return metric === 'co2PerPassengerKm'
        ? (value < bestValue ? vehicle : best)
        : (value > bestValue ? vehicle : best);
    });
  };
  const displayFor = (vehicle: ComparisonVehicle, metric: ComparisonMetricKey): string => {
    if (metric === 'yearIntroduced') return String(vehicle.metrics.yearIntroduced);
    if (metric === 'co2PerPassengerKm') return `${vehicle.metrics.co2PerPassengerKm} g CO2/pkm`;
    return vehicle.metrics[metric].display;
  };
  const metricName = (metric: ComparisonMetricKey): string => ({
    topSpeed: 'top speed',
    weight: 'weight',
    passengerCapacity: 'passenger capacity',
    range: 'range',
    yearIntroduced: 'year introduced',
    co2PerPassengerKm: 'CO2 per passenger-kilometer',
  })[metric];
  const priorityMetric = (priority: ComparisonChallenge['constraints']['priority']): ComparisonMetricKey | null => {
    switch (priority) {
      case 'speed': return 'topSpeed';
      case 'capacity': return 'passengerCapacity';
      case 'range': return 'range';
      case 'environment': return 'co2PerPassengerKm';
      default: return null;
    }
  };
  const feasibleVehiclesFor = (challenge: ComparisonChallenge): ComparisonVehicle[] => (
    data.vehicles.filter((vehicle: ComparisonVehicle) => (
      vehicle.metrics.passengerCapacity.value >= challenge.constraints.passengers
      && vehicle.metrics.range.value >= challenge.constraints.distance
    ))
  );
  const derivedWinnerFor = (challenge: ComparisonChallenge): ComparisonVehicle | null => {
    if (challenge.type !== 'constraint_tradeoff') return winnerFor(challenge.bestEvidenceMetric);
    const expectedMetric = priorityMetric(challenge.constraints.priority);
    if (!expectedMetric || expectedMetric !== challenge.bestEvidenceMetric) return null;
    return winnerFor(challenge.bestEvidenceMetric, feasibleVehiclesFor(challenge));
  };

  const seenChallengeIds = new Set<string>();
  data.challenges = (Array.isArray(data.challenges) ? data.challenges : [])
    .filter((challenge: ComparisonChallenge) => CHALLENGE_TYPES.includes(challenge?.type))
    .map((challenge: ComparisonChallenge, index: number) => {
      let normalizedChallenge: ComparisonChallenge = {
        ...challenge,
        constraints: { ...challenge.constraints },
      };
      let evidenceMetric = isMetricKey(challenge.bestEvidenceMetric)
        ? challenge.bestEvidenceMetric
        : 'topSpeed';

      if (normalizedChallenge.type === 'constraint_tradeoff') {
        const requestedMetric = priorityMetric(normalizedChallenge.constraints.priority);
        evidenceMetric = requestedMetric && data.comparisonMetrics.includes(requestedMetric)
          ? requestedMetric
          : 'topSpeed';
        if (evidenceMetric === 'topSpeed') normalizedChallenge.constraints.priority = 'speed';

        let feasible = feasibleVehiclesFor(normalizedChallenge);
        if (feasible.length === 0 || feasible.length === data.vehicles.length) {
          const capacities = data.vehicles
            .map((vehicle: ComparisonVehicle) => vehicle.metrics.passengerCapacity.value)
            .sort((a: number, b: number) => a - b);
          normalizedChallenge.constraints.passengers = capacities[
            Math.max(0, Math.floor((capacities.length - 1) / 2))
          ] ?? 1;
          normalizedChallenge.constraints.distance = Math.min(
            ...data.vehicles.map((vehicle: ComparisonVehicle) => vehicle.metrics.range.value),
          );
          feasible = feasibleVehiclesFor(normalizedChallenge);
        }

        const derivedWinner = winnerFor(evidenceMetric, feasible);
        if (derivedWinner) {
          const priorityLabel = normalizedChallenge.constraints.priority === 'environment'
            ? 'lowest emissions'
            : normalizedChallenge.constraints.priority === 'capacity'
              ? 'greatest capacity'
              : normalizedChallenge.constraints.priority === 'range'
                ? 'longest range'
                : 'greatest speed';
          normalizedChallenge = {
            ...normalizedChallenge,
            scenario: `Carry at least ${normalizedChallenge.constraints.passengers} passengers for ${normalizedChallenge.constraints.distance} km. Among the vehicles that qualify, which has the ${priorityLabel}?`,
            bestVehicleId: derivedWinner.id,
            bestEvidenceMetric: evidenceMetric,
            explanation: `${derivedWinner.name} meets the passenger and range minimums, then leads the qualifying vehicles on ${metricName(evidenceMetric)} with ${displayFor(derivedWinner, evidenceMetric)}.`,
          };
        }
      } else {
        if (!data.comparisonMetrics.includes(evidenceMetric)) {
          evidenceMetric = data.comparisonMetrics[0] ?? 'topSpeed';
        }
        const derivedWinner = winnerFor(evidenceMetric);
        if (derivedWinner) {
          normalizedChallenge = {
            ...normalizedChallenge,
            scenario: normalizedChallenge.type === 'metric_leader'
              ? `Which vehicle leads on ${metricName(evidenceMetric)}? Read the visible values and choose.`
              : `Which vehicle leads on ${metricName(evidenceMetric)}? Choose the visible data that proves it.`,
            bestVehicleId: derivedWinner.id,
            bestEvidenceMetric: evidenceMetric,
            explanation: `${derivedWinner.name} leads this comparison on ${metricName(evidenceMetric)} with ${displayFor(derivedWinner, evidenceMetric)}.`,
          };
        }
      }

      const candidates = normalizedChallenge.type === 'constraint_tradeoff'
        ? feasibleVehiclesFor(normalizedChallenge)
        : data.vehicles;
      const keyedVehicle = candidates.find(
        (vehicle: ComparisonVehicle) => vehicle.id === normalizedChallenge.bestVehicleId,
      );
      const keyedValue = keyedVehicle ? valueFor(keyedVehicle, evidenceMetric) : null;
      return {
        ...normalizedChallenge,
        id: normalizedChallenge.id || `evidence-mission-${index + 1}`,
        // An alternative is only genuinely acceptable when the displayed key
        // metric ties the keyed winner. This prevents a generous prose answer
        // from bypassing the visible evidence the student is asked to cite.
        acceptableAlternatives: Array.isArray(normalizedChallenge.acceptableAlternatives)
          ? normalizedChallenge.acceptableAlternatives.filter((id: string) => {
            const alternative = candidates.find((vehicle: ComparisonVehicle) => vehicle.id === id);
            return !!alternative && keyedValue != null && valueFor(alternative, evidenceMetric) === keyedValue;
          })
          : [],
        acceptableEvidenceMetrics: Array.isArray(normalizedChallenge.acceptableEvidenceMetrics)
          ? normalizedChallenge.acceptableEvidenceMetrics.filter((metric: unknown) => (
            isMetricKey(metric)
            && metric !== evidenceMetric
            && data.comparisonMetrics.includes(metric)
            && winnerFor(metric, candidates)?.id === normalizedChallenge.bestVehicleId
          ))
          : [],
      };
    })
    .filter((challenge: ComparisonChallenge) => {
      if (seenChallengeIds.has(challenge.id)
        || !seenVehicleIds.has(challenge.bestVehicleId)
        || !isMetricKey(challenge.bestEvidenceMetric)
        || !data.comparisonMetrics.includes(challenge.bestEvidenceMetric)) return false;
      const derivedWinner = derivedWinnerFor(challenge);
      if (!derivedWinner || derivedWinner.id !== challenge.bestVehicleId) {
        console.warn(`[VehicleComparisonLab] Rejected ${challenge.id}: answer is not derivable from visible evidence`);
        return false;
      }
      seenChallengeIds.add(challenge.id);
      return true;
    })
    .slice(0, 3);

  const buildFallbackChallenge = (
    type: ComparisonChallengeType,
    idSuffix: string | number,
  ): ComparisonChallenge => {
    const usedMetrics = new Set<ComparisonMetricKey>(
      data.challenges.map((challenge: ComparisonChallenge) => challenge.bestEvidenceMetric),
    );
    let evidenceMetric = data.comparisonMetrics.find((metric: ComparisonMetricKey) => !usedMetrics.has(metric) && winnerFor(metric))
      || data.comparisonMetrics.find((metric: ComparisonMetricKey) => winnerFor(metric))
      || 'topSpeed';
    let passengers = 1;
    let distance = 1;
    let priority: ComparisonChallenge['constraints']['priority'] = evidenceMetric === 'passengerCapacity' ? 'capacity'
      : evidenceMetric === 'range' ? 'range'
        : evidenceMetric === 'co2PerPassengerKm' ? 'environment' : 'speed';
    let candidates = data.vehicles;
    if (type === 'constraint_tradeoff') {
      const capacities = data.vehicles
        .map((vehicle: ComparisonVehicle) => vehicle.metrics.passengerCapacity.value)
        .sort((a: number, b: number) => a - b);
      passengers = capacities[Math.max(0, Math.floor((capacities.length - 1) / 2))] ?? 1;
      distance = Math.min(...data.vehicles.map((vehicle: ComparisonVehicle) => vehicle.metrics.range.value));
      evidenceMetric = 'topSpeed';
      priority = 'speed';
      candidates = data.vehicles.filter((vehicle: ComparisonVehicle) => (
        vehicle.metrics.passengerCapacity.value >= passengers
        && vehicle.metrics.range.value >= distance
      ));
    }
    const winner = winnerFor(evidenceMetric, candidates) || data.vehicles[0];
    const scenario = type === 'metric_leader'
      ? `Which vehicle leads on ${metricName(evidenceMetric)}? Read the visible values and choose.`
      : type === 'constraint_tradeoff'
        ? `Move at least ${passengers} passengers for ${distance} km, then choose the fastest vehicle that qualifies.`
        : `Which vehicle leads on ${metricName(evidenceMetric)}? Choose the visible data that proves it.`;
    return {
      id: `derived-${type}-${idSuffix}`,
      type,
      scenario,
      origin: 'Comparison Bay',
      destination: 'Evidence Station',
      constraints: {
        passengers,
        distance,
        maxTime: null,
        priority,
      },
      bestVehicleId: winner.id,
      acceptableAlternatives: [],
      bestEvidenceMetric: evidenceMetric,
      acceptableEvidenceMetrics: [],
      explanation: type === 'constraint_tradeoff'
        ? `${winner.name} meets the passenger and range minimums, then leads the qualifying vehicles on ${metricName(evidenceMetric)} with ${displayFor(winner, evidenceMetric)}.`
        : `${winner.name} leads this comparison with ${displayFor(winner, evidenceMetric)}.`,
    };
  };

  let fallbackIndex = 1;
  while (data.challenges.length < 3) {
    const fallbackTypes = resolution?.allowedTypes.length
      ? resolution.allowedTypes as ComparisonChallengeType[]
      : CHALLENGE_TYPES;
    const type = fallbackTypes[(fallbackIndex - 1) % fallbackTypes.length] ?? 'evidence_choice';
    data.challenges.push(buildFallbackChallenge(type, fallbackIndex));
    fallbackIndex += 1;
  }

  // A mixed session is only honest when every task identity appears. With three
  // challenge slots and three types, replace duplicate types deterministically
  // instead of trusting the model's natural tendency to collapse to one enum.
  if (!resolution) {
    const counts = new Map<ComparisonChallengeType, number>();
    for (const challenge of data.challenges as ComparisonChallenge[]) {
      counts.set(challenge.type, (counts.get(challenge.type) ?? 0) + 1);
    }
    for (const missingType of CHALLENGE_TYPES.filter((type) => !counts.has(type))) {
      const replaceIndex = (data.challenges as ComparisonChallenge[]).findIndex(
        (challenge) => (counts.get(challenge.type) ?? 0) > 1,
      );
      if (replaceIndex < 0) break;
      const replacedType = data.challenges[replaceIndex].type as ComparisonChallengeType;
      counts.set(replacedType, (counts.get(replacedType) ?? 1) - 1);
      data.challenges[replaceIndex] = buildFallbackChallenge(missingType, `mixed-${missingType}`);
      counts.set(missingType, 1);
    }
  }
  data.challengeType = data.challenges[0]?.type ?? resolution?.allowedTypes[0] ?? 'evidence_choice';

  if (!Array.isArray(data.surprisingFacts) || data.surprisingFacts.length === 0) {
    data.surprisingFacts = data.vehicles.slice(0, 2).map((vehicle: ComparisonVehicle) => ({
      fact: vehicle.funFact,
      vehicleIds: [vehicle.id],
    }));
  } else {
    data.surprisingFacts = data.surprisingFacts
      .map((fact: SurprisingFact) => ({
        ...fact,
        vehicleIds: fact.vehicleIds.filter((id: string) => seenVehicleIds.has(id)),
      }))
      .filter((fact: SurprisingFact) => !!fact.fact && fact.vehicleIds.length > 0);
  }

  return data as VehicleComparisonLabData;
};
