import { Type, Schema } from "@google/genai";
import { ai } from "../geminiClient";

// Import types from the component - single source of truth
import type {
  PropulsionTimelineData,
  TimelineMilestone,
  TimelineEra,
  SpeedRecord,
  SequencingChallenge,
  InnovationChain,
} from '../../primitives/visual-primitives/engineering/PropulsionTimeline';

// Re-export for convenience
export type { PropulsionTimelineData };

/**
 * Schema for Timeline Milestone
 */
const timelineMilestoneSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    id: { type: Type.STRING, description: "Unique identifier (kebab-case, e.g., 'wright-flyer')." },
    year: { type: Type.NUMBER, description: "Year of this milestone (e.g., 1903)." },
    name: { type: Type.STRING, description: "Name of the milestone (e.g., 'Wright Brothers First Flight')." },
    vehicle: { type: Type.STRING, description: "Vehicle involved (e.g., 'Wright Flyer')." },
    domain: { type: Type.STRING, enum: ["land", "sea", "air", "space"], description: "Transportation domain." },
    topSpeed: { type: Type.STRING, description: "Top speed at the time (e.g., '48 km/h')." },
    description: { type: Type.STRING, description: "What happened at this milestone. Kid-friendly storytelling." },
    significance: { type: Type.STRING, description: "Why this milestone mattered for transportation history." },
    imagePrompt: { type: Type.STRING, description: "Prompt for generating a period-accurate vehicle illustration." },
    enabledBy: { type: Type.STRING, nullable: true, description: "ID of earlier milestone that made this possible (null if none)." },
    enabledNext: { type: Type.STRING, nullable: true, description: "ID of later milestone this enabled (null if none)." },
  },
  required: ["id", "year", "name", "vehicle", "domain", "topSpeed", "description", "significance", "imagePrompt"]
};

/**
 * Schema for Timeline Era
 */
const timelineEraSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    name: { type: Type.STRING, description: "Name of the era (e.g., 'Age of Sail', 'Steam Revolution')." },
    startYear: { type: Type.NUMBER, description: "Start year of this era." },
    endYear: { type: Type.NUMBER, description: "End year of this era." },
    color: { type: Type.STRING, description: "Hex color for this era's timeline band (e.g., '#3b82f6')." },
    description: { type: Type.STRING, description: "Brief description of this era." },
    dominantTransport: { type: Type.STRING, description: "The dominant form of transportation in this era." },
  },
  required: ["name", "startYear", "endYear", "color", "description", "dominantTransport"]
};

/**
 * Schema for Speed Record
 */
const speedRecordSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    year: { type: Type.NUMBER, description: "Year of the speed record." },
    speed: { type: Type.NUMBER, description: "Speed in km/h." },
    vehicle: { type: Type.STRING, description: "Vehicle that set the record." },
    domain: { type: Type.STRING, description: "Domain (land, sea, air, space)." },
  },
  required: ["year", "speed", "vehicle", "domain"]
};

/**
 * Schema for Sequencing Challenge
 */
const sequencingChallengeSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    items: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Milestone IDs to put in order (shuffled). Use 4-6 items." },
    correctOrder: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Same milestone IDs in correct chronological order." },
    hint: { type: Type.STRING, description: "A helpful hint for ordering (e.g., 'Think about which technology came first')." },
  },
  required: ["items", "correctOrder", "hint"]
};

/**
 * Schema for Innovation Chain
 */
const innovationChainSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    name: { type: Type.STRING, description: "Name of the chain (e.g., 'From Steam to Space')." },
    milestoneIds: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Ordered milestone IDs in the chain." },
    narrative: { type: Type.STRING, description: "How each step enabled the next, told as a story." },
  },
  required: ["name", "milestoneIds", "narrative"]
};

/**
 * Schema for Propulsion Timeline Data
 */
const propulsionTimelineSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    title: { type: Type.STRING, description: "Title for the timeline." },
    timeRange: {
      type: Type.OBJECT,
      properties: {
        startYear: { type: Type.NUMBER, description: "Earliest year on the timeline." },
        endYear: { type: Type.NUMBER, description: "Latest year on the timeline." },
      },
      required: ["startYear", "endYear"]
    },
    milestones: { type: Type.ARRAY, items: timelineMilestoneSchema, description: "8-15 transportation milestones spanning history." },
    eras: { type: Type.ARRAY, items: timelineEraSchema, description: "4-6 historical eras." },
    speedRecords: { type: Type.ARRAY, items: speedRecordSchema, description: "6-10 speed records over time showing exponential growth." },
    sequencingChallenges: { type: Type.ARRAY, items: sequencingChallengeSchema, description: "2-3 chronological ordering challenges." },
    innovationChains: { type: Type.ARRAY, items: innovationChainSchema, description: "2-3 innovation chains showing how inventions connect." },
    gradeBand: { type: Type.STRING, enum: ["K-2", "3-5"], description: "Grade band for content complexity." },
  },
  required: ["title", "timeRange", "milestones", "eras", "speedRecords", "sequencingChallenges", "innovationChains", "gradeBand"]
};

/**
 * Generate Propulsion Timeline data
 */
export const generatePropulsionTimeline = async (
  topic: string,
  gradeLevel: string,
  config?: Partial<PropulsionTimelineData>
): Promise<PropulsionTimelineData> => {
  const prompt = `
Create a Propulsion Timeline for teaching "${topic}" to ${gradeLevel} students.

CONTEXT — HISTORY OF TRANSPORTATION:
This timeline shows how humans have moved throughout history, from walking to spacecraft.

KEY MILESTONES TO INCLUDE (use real dates and speeds):
- ~3500 BC: The Wheel (Mesopotamia) — land, ~5 km/h
- ~3000 BC: The Sail (Egypt/Mesopotamia) — sea, ~10 km/h
- 1804: First Steam Locomotive (Richard Trevithick) — land, ~16 km/h
- 1807: First Steamboat (Robert Fulton, Clermont) — sea, ~8 km/h
- 1885: First Automobile (Karl Benz) — land, ~16 km/h
- 1903: Wright Brothers First Flight — air, 48 km/h, 12 seconds
- 1914: First Commercial Airline Flight — air, ~100 km/h
- 1947: Sound Barrier Broken (Chuck Yeager, Bell X-1) — air, 1,234 km/h
- 1957: Sputnik (first satellite) — space, 28,000 km/h
- 1961: First Human in Space (Yuri Gagarin) — space, 28,000 km/h
- 1964: Shinkansen Bullet Train — land, 210 km/h
- 1969: Moon Landing (Apollo 11) — space, 39,000 km/h
- 1976: Concorde (supersonic passenger flight) — air, 2,180 km/h
- 2012: Tesla Model S — land, electric, 210 km/h
- 2020+: Electric & autonomous vehicles — land, ongoing

ERAS:
- Human & Animal Power (~10000 BC - 1800): Walking, horses, oxcarts
- Age of Sail (~3000 BC - 1850): Wind-powered ships dominate sea travel
- Steam Revolution (1800 - 1900): Trains and steamships transform transportation
- Internal Combustion (1885 - 1960): Cars and airplanes
- Jet Age (1947 - present): Jets, space travel, supersonic
- Electric Future (2010 - present): EVs, sustainability, autonomous

GRADE-LEVEL GUIDELINES:

GRADES K-2:
- 6-8 milestones maximum (key moments kids can relate to)
- Simple language: "People walked, then rode horses, then made engines"
- 1-2 sequencing challenges with 4 items each
- 1 innovation chain
- Speed records: 4-5 entries showing "things got faster"
- gradeBand: "K-2"

GRADES 3-5:
- 10-15 milestones with richer detail
- Innovation chains: steam → train → factory → car
- 2-3 sequencing challenges with 5-6 items each
- 2-3 innovation chains
- Speed records: 8-10 entries
- gradeBand: "3-5"

CRITICAL RULES:
- sequencingChallenge items and correctOrder must reference valid milestone IDs
- innovationChain milestoneIds must reference valid milestone IDs
- enabledBy/enabledNext must reference valid milestone IDs or be null
- Speed records must use real numbers
- Eras should NOT overlap significantly

${config ? `CONFIGURATION HINTS:\n${JSON.stringify(config, null, 2)}` : ''}

Return a complete Propulsion Timeline configuration.
`;

  const result = await ai.models.generateContent({
    model: "gemini-flash-lite-latest",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: propulsionTimelineSchema
    },
  });

  const data = result.text ? JSON.parse(result.text) : null;

  if (!data) {
    throw new Error('No valid Propulsion Timeline data returned from Gemini API');
  }

  // Validation
  if (!data.milestones || data.milestones.length < 3) {
    throw new Error('Propulsion Timeline requires at least 3 milestones');
  }

  // Validate domain values
  const validDomains = ['land', 'sea', 'air', 'space'];
  for (const m of data.milestones) {
    if (!validDomains.includes(m.domain)) {
      console.warn(`Invalid domain "${m.domain}" for ${m.name}. Defaulting to "land".`);
      m.domain = 'land';
    }
  }

  // Validate sequencing challenge references
  const milestoneIds = new Set(data.milestones.map((m: TimelineMilestone) => m.id));
  for (const challenge of data.sequencingChallenges || []) {
    challenge.items = challenge.items.filter((id: string) => milestoneIds.has(id));
    challenge.correctOrder = challenge.correctOrder.filter((id: string) => milestoneIds.has(id));
  }

  // Validate innovation chain references
  for (const chain of data.innovationChains || []) {
    chain.milestoneIds = chain.milestoneIds.filter((id: string) => milestoneIds.has(id));
  }

  return data;
};
