import { Type, Schema } from "@google/genai";
import { ai } from "../geminiClient";

// Import types from the component - single source of truth
import type {
  VehicleComparisonLabData,
  ComparisonVehicle,
  ComparisonChallenge,
  SurprisingFact,
} from '../../primitives/visual-primitives/engineering/VehicleComparisonLab';

// Re-export for convenience
export type { VehicleComparisonLabData };

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
    category: { type: Type.STRING, enum: ["air", "land", "sea"], description: "Transportation domain." },
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
  required: ["id", "name", "category", "imagePrompt", "metrics", "funFact"]
};

/**
 * Schema for Comparison Challenge
 */
const comparisonChallengeSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    scenario: { type: Type.STRING, description: "Real-world transportation scenario (e.g., 'Move 500 people from Tokyo to Osaka')." },
    constraints: {
      type: Type.OBJECT,
      properties: {
        passengers: { type: Type.NUMBER, description: "Number of passengers to transport." },
        distance: { type: Type.NUMBER, description: "Distance in kilometers." },
        maxTime: { type: Type.STRING, nullable: true, description: "Maximum acceptable travel time." },
      },
      required: ["passengers", "distance"]
    },
    bestVehicleId: { type: Type.STRING, description: "ID of the best vehicle for this scenario." },
    explanation: { type: Type.STRING, description: "Why this vehicle is the best choice, using data." },
    acceptableAlternatives: { type: Type.ARRAY, items: { type: Type.STRING }, description: "IDs of other acceptable vehicle choices." },
  },
  required: ["scenario", "constraints", "bestVehicleId", "explanation", "acceptableAlternatives"]
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
    vehicles: { type: Type.ARRAY, items: comparisonVehicleSchema, description: "Array of 4-8 vehicles to compare. Include a mix of air, land, and sea." },
    comparisonMetrics: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Which metrics to show in the comparison chart (e.g., 'topSpeed', 'weight', 'passengerCapacity', 'range')." },
    chartType: { type: Type.STRING, enum: ["bar", "radar", "scatter", "table"], description: "Default chart type for the comparison." },
    challenges: { type: Type.ARRAY, items: comparisonChallengeSchema, description: "2-3 transportation scenario challenges." },
    surprisingFacts: { type: Type.ARRAY, items: surprisingFactSchema, description: "2-3 counterintuitive comparison facts." },
    gradeBand: { type: Type.STRING, enum: ["K-2", "3-5"], description: "Grade band for content complexity." },
  },
  required: ["title", "instructions", "vehicles", "comparisonMetrics", "chartType", "challenges", "surprisingFacts", "gradeBand"]
};

/**
 * Generate Vehicle Comparison Lab data
 */
export const generateVehicleComparisonLab = async (
  topic: string,
  gradeLevel: string,
  config?: Partial<VehicleComparisonLabData>
): Promise<VehicleComparisonLabData> => {
  const prompt = `
Create a Vehicle Comparison Lab for teaching "${topic}" to ${gradeLevel} students.

CONTEXT — VEHICLE COMPARISON:
A Vehicle Comparison Lab lets students compare real vehicles across multiple dimensions:
speed, weight, passenger capacity, range, fuel type, and environmental impact.

REQUIRED VEHICLE DATA (use REAL statistics — never make up numbers):
Include 5-8 vehicles with a mix of categories (air, land, sea). Always include at least one "surprise" vehicle (bicycle, Space Shuttle, or Wright Flyer) for "wow" moments.

REFERENCE DATA (use these exact values or similar real-world data):
- Boeing 747: 920 km/h, 178,756 kg, 416 pax, 14,200 km range
- Shinkansen N700: 300 km/h, 715,000 kg, 1,323 pax, 500 km/trip
- Tesla Model 3: 225 km/h, 1,760 kg, 5 pax, 580 km
- School Bus: 90 km/h, 10,000 kg, 72 pax, 450 km
- Bicycle: 25 km/h, 10 kg, 1 pax, unlimited range
- Container Ship: 46 km/h, 55,000,000 kg, 0 pax (15,000 TEU), 24,000 km
- Space Shuttle: 28,000 km/h, 2,030,000 kg, 7 crew, LEO
- Wright Flyer: 48 km/h, 274 kg, 1 pilot, 260 m

GRADE-LEVEL GUIDELINES:

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
- 6-8 vehicles with environmental data
- comparisonMetrics: ["topSpeed", "weight", "passengerCapacity", "range", "co2PerPassengerKm"]
- chartType: "bar" (can toggle to table)
- Complex challenges with constraints
- gradeBand: "3-5"
- Data-driven reasoning language

FOR ALL GRADES:
- surprisingFacts must be genuine and counterintuitive
- challenges must reference actual vehicle IDs from the vehicles array
- All metric values must be real statistics
- funFact should make kids want to tell their parents

${config ? `CONFIGURATION HINTS:\n${JSON.stringify(config, null, 2)}` : ''}

Return a complete Vehicle Comparison Lab configuration.
`;

  const result = await ai.models.generateContent({
    model: "gemini-flash-lite-latest",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: vehicleComparisonLabSchema
    },
  });

  const data = result.text ? JSON.parse(result.text) : null;

  if (!data) {
    throw new Error('No valid Vehicle Comparison Lab data returned from Gemini API');
  }

  // Validation
  if (!data.vehicles || data.vehicles.length < 2) {
    throw new Error('Vehicle Comparison Lab requires at least 2 vehicles');
  }

  if (!data.challenges || data.challenges.length === 0) {
    console.warn('No challenges generated. Adding default.');
    data.challenges = [{
      scenario: 'Which vehicle would you choose for a family trip across the country?',
      constraints: { passengers: 4, distance: 3000 },
      bestVehicleId: data.vehicles[0].id,
      explanation: 'Consider speed, comfort, and range for a long family trip.',
      acceptableAlternatives: [],
    }];
  }

  if (!data.surprisingFacts || data.surprisingFacts.length === 0) {
    data.surprisingFacts = [{
      fact: 'A bicycle is the most energy-efficient vehicle ever invented!',
      vehicleIds: [data.vehicles.find((v: ComparisonVehicle) => v.name.toLowerCase().includes('bicycle'))?.id || data.vehicles[0].id],
    }];
  }

  return data;
};
