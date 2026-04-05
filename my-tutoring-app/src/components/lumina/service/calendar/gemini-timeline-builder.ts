import { Type, Schema } from "@google/genai";
import {
  TimelineBuilderData,
  TimelineBuilderChallenge,
  TimelineEvent,
} from "../../primitives/visual-primitives/calendar/TimelineBuilder";
import { ai } from "../geminiClient";
import {
  resolveEvalModeConstraint,
  logEvalModeResolution,
  type ChallengeTypeDoc,
} from "../evalMode";

// ---------------------------------------------------------------------------
// Challenge type documentation registry
// ---------------------------------------------------------------------------

const CHALLENGE_TYPE_DOCS: Record<string, ChallengeTypeDoc> = {
  daily: {
    promptDoc:
      `"daily": Events within a single day. Students order activities like ` +
      `waking up, eating meals, going to school, bedtime. ` +
      `scaleStart/scaleEnd are time-of-day labels (e.g., "Morning" / "Night").`,
    schemaDescription: "'daily' (order events within a day)",
  },
  yearly: {
    promptDoc:
      `"yearly": Events across months or seasons. Students order holidays, ` +
      `seasonal events, school milestones. ` +
      `scaleStart/scaleEnd are month or season labels (e.g., "January" / "December").`,
    schemaDescription: "'yearly' (order events across a year)",
  },
  historical: {
    promptDoc:
      `"historical": Events across decades or centuries. Students order inventions, ` +
      `historical milestones, or famous discoveries. ` +
      `scaleStart/scaleEnd are year labels (e.g., "1800" / "2000").`,
    schemaDescription: "'historical' (order events across history)",
  },
};

// ---------------------------------------------------------------------------
// Grade band resolution
// ---------------------------------------------------------------------------

function resolveGradeBand(gradeLevel: string): TimelineBuilderData["gradeBand"] {
  const gl = gradeLevel.toLowerCase();
  if (gl.includes("kinder") || gl.includes("k") || gl.includes("1")) return "K-1";
  if (/[23]/.test(gl)) return "2-3";
  if (/[45]/.test(gl)) return "4-5";
  if (/[678]/.test(gl)) return "6-8";
  return "K-1";
}

// ---------------------------------------------------------------------------
// Flat challenge interface for Gemini output
// ---------------------------------------------------------------------------

interface FlatChallenge {
  [key: string]: unknown;
}

/** Reconstruct events[] from flat event0Label, event0Pos, event0Desc, ... fields */
function collectEvents(flat: FlatChallenge, maxSlots: number): TimelineEvent[] {
  const events: TimelineEvent[] = [];
  for (let i = 0; i < maxSlots; i++) {
    const label = flat[`event${i}Label`];
    const pos = flat[`event${i}Pos`];
    const desc = flat[`event${i}Desc`];
    if (typeof label === "string" && label.trim() && typeof pos === "number") {
      events.push({
        id: `evt-${i}`,
        label: label.trim(),
        correctPosition: pos,
        ...(typeof desc === "string" && desc.trim() ? { description: desc.trim() } : {}),
      });
    }
  }
  return events;
}

/**
 * Normalize correctPosition values to be 0-based sequential.
 * Sort by raw position, then re-assign 0,1,2,3...
 */
function normalizePositions(events: TimelineEvent[]): TimelineEvent[] {
  const sorted = [...events].sort((a, b) => a.correctPosition - b.correctPosition);
  return sorted.map((e, i) => ({ ...e, correctPosition: i }));
}

/** Validate a reconstructed challenge — returns null if invalid */
function validateChallenge(
  flat: FlatChallenge,
  challengeType: "daily" | "yearly" | "historical",
): TimelineBuilderChallenge | null {
  const title = typeof flat.title === "string" ? flat.title.trim() : "";
  const instruction = typeof flat.instruction === "string" ? flat.instruction.trim() : "";
  const scaleStart = typeof flat.scaleStart === "string" ? flat.scaleStart.trim() : "";
  const scaleEnd = typeof flat.scaleEnd === "string" ? flat.scaleEnd.trim() : "";
  const hint = typeof flat.hint === "string" ? flat.hint.trim() : "";
  const narration = typeof flat.narration === "string" ? flat.narration.trim() : "";

  // Reject if any required top-level field is missing
  if (!title || !instruction || !scaleStart || !scaleEnd || !hint || !narration) {
    console.log(
      `[TimelineBuilder] Rejected challenge: missing required field ` +
        `(title=${!!title}, instruction=${!!instruction}, scaleStart=${!!scaleStart}, ` +
        `scaleEnd=${!!scaleEnd}, hint=${!!hint}, narration=${!!narration})`,
    );
    return null;
  }

  // Reconstruct and validate events
  const rawEvents = collectEvents(flat, 6);
  if (rawEvents.length < 3) {
    console.log(
      `[TimelineBuilder] Rejected challenge "${title}": only ${rawEvents.length} valid events (need ≥3)`,
    );
    return null;
  }

  // Normalize positions to 0-based sequential
  const events = normalizePositions(rawEvents);

  return {
    id: "", // will be re-assigned later
    type: challengeType,
    title,
    instruction,
    scaleStart,
    scaleEnd,
    events,
    hint,
    narration,
  };
}

// ===========================================================================
// Per-type schemas — flat, all fields required, no nullable fields
// ===========================================================================

/** Build the flat schema for a timeline challenge type with N event slots */
function buildTimelineSchema(
  typeDescription: string,
  eventSlots: number,
): Schema {
  const eventProperties: Record<string, Schema> = {};
  const eventRequired: string[] = [];
  for (let i = 0; i < eventSlots; i++) {
    eventProperties[`event${i}Label`] = {
      type: Type.STRING,
      description: `Event ${i + 1} label (short name like "Wake Up" or "Light Bulb Invented")`,
    };
    eventProperties[`event${i}Pos`] = {
      type: Type.NUMBER,
      description: `Event ${i + 1} chronological position (0-based: 0=earliest, ${eventSlots - 1}=latest)`,
    };
    eventProperties[`event${i}Desc`] = {
      type: Type.STRING,
      description: `Event ${i + 1} short description (1 sentence)`,
    };
    eventRequired.push(`event${i}Label`, `event${i}Pos`, `event${i}Desc`);
  }

  return {
    type: Type.OBJECT,
    properties: {
      challenges: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING, description: "Challenge title" },
            instruction: {
              type: Type.STRING,
              description: "Instruction telling the student what to do",
            },
            scaleStart: {
              type: Type.STRING,
              description: `Label for the start of the timeline (${typeDescription})`,
            },
            scaleEnd: {
              type: Type.STRING,
              description: `Label for the end of the timeline (${typeDescription})`,
            },
            hint: { type: Type.STRING, description: "A helpful hint for the student" },
            narration: { type: Type.STRING, description: "Brief narration introducing the challenge" },
            ...eventProperties,
          },
          required: [
            "title",
            "instruction",
            "scaleStart",
            "scaleEnd",
            "hint",
            "narration",
            ...eventRequired,
          ],
        },
        description: "Timeline challenges",
      },
    },
    required: ["challenges"],
  };
}

const dailySchema = buildTimelineSchema("e.g., 'Morning' / 'Night'", 5);
const yearlySchema = buildTimelineSchema("e.g., 'January' / 'December'", 5);
const historicalSchema = buildTimelineSchema("e.g., '1800' / '2000'", 5);

// ===========================================================================
// Per-type sub-generators
// ===========================================================================

async function generateDailyChallenges(
  topic: string,
  gradeLevel: string,
  count: number,
): Promise<TimelineBuilderChallenge[]> {
  const prompt = `
Create ${count} DAILY timeline challenges for "${topic}" (${gradeLevel} students).

Students must place events in chronological order on a timeline from Morning to Night.

Each challenge should have 5 events that happen throughout a typical day.
Events should be age-appropriate daily activities.

RULES:
- scaleStart should be a morning label (e.g., "Early Morning", "6 AM")
- scaleEnd should be an evening label (e.g., "Bedtime", "9 PM")
- event positions: 0=earliest in the day, 4=latest. Each event gets a UNIQUE position 0-4.
- Labels should be short (2-4 words). Descriptions should be 1 sentence.
- Do NOT reveal the order in the labels or descriptions.
- Vary the themes: school day, weekend, holiday, summer day, etc.

EXAMPLE:
{
  "challenges": [{
    "title": "A School Day",
    "instruction": "Put these school day events in the correct order from morning to night.",
    "scaleStart": "Morning",
    "scaleEnd": "Night",
    "hint": "Think about what you do first when you wake up.",
    "narration": "Let's put a school day in order!",
    "event0Label": "Eat Breakfast", "event0Pos": 0, "event0Desc": "Start the day with a healthy meal.",
    "event1Label": "Ride the Bus", "event1Pos": 1, "event1Desc": "Travel to school.",
    "event2Label": "Math Class", "event2Pos": 2, "event2Desc": "Learn numbers and shapes.",
    "event3Label": "Play at Recess", "event3Pos": 3, "event3Desc": "Run and play with friends outside.",
    "event4Label": "Read Before Bed", "event4Pos": 4, "event4Desc": "Read a story before sleeping."
  }]
}
`;

  try {
    const result = await ai.models.generateContent({
      model: "gemini-flash-lite-latest",
      contents: prompt,
      config: { responseMimeType: "application/json", responseSchema: dailySchema },
    });

    const data = result.text ? JSON.parse(result.text) : null;
    if (!data?.challenges?.length) return [];

    return (data.challenges as FlatChallenge[])
      .map((flat) => validateChallenge(flat, "daily"))
      .filter((c): c is TimelineBuilderChallenge => c !== null);
  } catch (err) {
    console.error("[TimelineBuilder] Daily generation failed:", err);
    return [];
  }
}

async function generateYearlyChallenges(
  topic: string,
  gradeLevel: string,
  count: number,
): Promise<TimelineBuilderChallenge[]> {
  const prompt = `
Create ${count} YEARLY timeline challenges for "${topic}" (${gradeLevel} students).

Students must place events in chronological order on a timeline spanning a year.

Each challenge should have 5 events spread across different months or seasons.
Events can be holidays, seasonal activities, school milestones, or nature changes.

RULES:
- scaleStart should be a beginning-of-year label (e.g., "January", "Winter")
- scaleEnd should be an end-of-year label (e.g., "December", "Winter Again")
- event positions: 0=earliest in the year, 4=latest. Each event gets a UNIQUE position 0-4.
- Labels should be short (2-4 words). Descriptions should mention the month or season.
- Do NOT put month names in the event labels — that would give away the order.
- Vary the themes: holidays, seasons, school year, nature, sports seasons.

EXAMPLE:
{
  "challenges": [{
    "title": "Holidays Through the Year",
    "instruction": "Arrange these holidays from earliest to latest in the year.",
    "scaleStart": "January",
    "scaleEnd": "December",
    "hint": "Think about which holiday comes first after New Year's Day.",
    "narration": "Can you put these holidays in the right order?",
    "event0Label": "Valentine's Day", "event0Pos": 0, "event0Desc": "A day to share love and friendship.",
    "event1Label": "Independence Day", "event1Pos": 1, "event1Desc": "Celebrate with fireworks in summer.",
    "event2Label": "Halloween", "event2Pos": 2, "event2Desc": "Dress up in costumes and get candy.",
    "event3Label": "Thanksgiving", "event3Pos": 3, "event3Desc": "Gather with family for a big meal.",
    "event4Label": "Christmas", "event4Pos": 4, "event4Desc": "Exchange gifts and celebrate together."
  }]
}
`;

  try {
    const result = await ai.models.generateContent({
      model: "gemini-flash-lite-latest",
      contents: prompt,
      config: { responseMimeType: "application/json", responseSchema: yearlySchema },
    });

    const data = result.text ? JSON.parse(result.text) : null;
    if (!data?.challenges?.length) return [];

    return (data.challenges as FlatChallenge[])
      .map((flat) => validateChallenge(flat, "yearly"))
      .filter((c): c is TimelineBuilderChallenge => c !== null);
  } catch (err) {
    console.error("[TimelineBuilder] Yearly generation failed:", err);
    return [];
  }
}

async function generateHistoricalChallenges(
  topic: string,
  gradeLevel: string,
  count: number,
): Promise<TimelineBuilderChallenge[]> {
  const prompt = `
Create ${count} HISTORICAL timeline challenges for "${topic}" (${gradeLevel} students).

Students must place historical events in chronological order on a timeline spanning decades or centuries.

Each challenge should have 5 events from history, science, or culture.
Adapt difficulty to the grade level.

RULES:
- scaleStart should be a year or era label (e.g., "1800", "Ancient Times")
- scaleEnd should be a later year or era label (e.g., "2000", "Modern Day")
- event positions: 0=earliest in history, 4=latest. Each event gets a UNIQUE position 0-4.
- Labels should be short (2-5 words). Descriptions should mention the approximate year or era.
- Do NOT put years in the event labels — that would give away the order.
- Vary the themes: inventions, exploration, science, art, civil rights.

EXAMPLE:
{
  "challenges": [{
    "title": "Great Inventions",
    "instruction": "Put these inventions in the order they were created, from oldest to newest.",
    "scaleStart": "1800",
    "scaleEnd": "2000",
    "hint": "Think about which of these inventions people had first.",
    "narration": "Let's travel through time and explore great inventions!",
    "event0Label": "Telephone Invented", "event0Pos": 0, "event0Desc": "Alexander Graham Bell made the first phone call in 1876.",
    "event1Label": "First Light Bulb", "event1Pos": 1, "event1Desc": "Thomas Edison demonstrated a practical light bulb in 1879.",
    "event2Label": "First Airplane Flight", "event2Pos": 2, "event2Desc": "The Wright Brothers flew at Kitty Hawk in 1903.",
    "event3Label": "Television Broadcast", "event3Pos": 3, "event3Desc": "The first electronic TV demonstration happened in 1927.",
    "event4Label": "Moon Landing", "event4Pos": 4, "event4Desc": "Astronauts walked on the Moon in 1969."
  }]
}
`;

  try {
    const result = await ai.models.generateContent({
      model: "gemini-flash-lite-latest",
      contents: prompt,
      config: { responseMimeType: "application/json", responseSchema: historicalSchema },
    });

    const data = result.text ? JSON.parse(result.text) : null;
    if (!data?.challenges?.length) return [];

    return (data.challenges as FlatChallenge[])
      .map((flat) => validateChallenge(flat, "historical"))
      .filter((c): c is TimelineBuilderChallenge => c !== null);
  } catch (err) {
    console.error("[TimelineBuilder] Historical generation failed:", err);
    return [];
  }
}

// ===========================================================================
// Fallbacks — one per type, correct by construction
// ===========================================================================

const FALLBACKS: Record<string, TimelineBuilderChallenge> = {
  daily: {
    id: "fb-daily",
    type: "daily",
    title: "My Morning Routine",
    instruction: "Put these morning activities in the correct order.",
    scaleStart: "Morning",
    scaleEnd: "Afternoon",
    events: [
      { id: "evt-0", label: "Wake Up", correctPosition: 0 },
      { id: "evt-1", label: "Brush Teeth", correctPosition: 1 },
      { id: "evt-2", label: "Eat Breakfast", correctPosition: 2 },
      { id: "evt-3", label: "Go to School", correctPosition: 3 },
    ],
    hint: "Think about what you do the moment you get out of bed.",
    narration: "Let's put your morning routine in order!",
  },
  yearly: {
    id: "fb-yearly",
    type: "yearly",
    title: "Seasons of the Year",
    instruction: "Arrange these seasonal events from earliest to latest in the year.",
    scaleStart: "January",
    scaleEnd: "December",
    events: [
      { id: "evt-0", label: "Spring Flowers", correctPosition: 0, description: "Flowers bloom in March." },
      { id: "evt-1", label: "Summer Beach", correctPosition: 1, description: "Beach trips in June." },
      { id: "evt-2", label: "Fall Leaves", correctPosition: 2, description: "Leaves change in September." },
      { id: "evt-3", label: "Winter Snow", correctPosition: 3, description: "Snow falls in December." },
    ],
    hint: "Think about when each season starts.",
    narration: "Can you order the seasons through the year?",
  },
  historical: {
    id: "fb-historical",
    type: "historical",
    title: "Great Inventions",
    instruction: "Put these inventions in the order they were created.",
    scaleStart: "1870",
    scaleEnd: "1930",
    events: [
      { id: "evt-0", label: "Telephone", correctPosition: 0, description: "Invented in 1876." },
      { id: "evt-1", label: "Light Bulb", correctPosition: 1, description: "Demonstrated in 1879." },
      { id: "evt-2", label: "Airplane", correctPosition: 2, description: "First flight in 1903." },
      { id: "evt-3", label: "Television", correctPosition: 3, description: "First broadcast in 1927." },
    ],
    hint: "Think about which of these inventions people had first.",
    narration: "Let's explore the timeline of great inventions!",
  },
};

// ===========================================================================
// Main generator — dispatches to per-type sub-generators in parallel
// ===========================================================================

export const generateTimelineBuilder = async (
  topic: string,
  gradeLevel: string,
  config?: Partial<{ targetEvalMode?: string }>,
): Promise<TimelineBuilderData> => {
  // ── Resolve eval mode ──
  const evalConstraint = resolveEvalModeConstraint(
    "timeline-builder",
    config?.targetEvalMode,
    CHALLENGE_TYPE_DOCS,
  );
  logEvalModeResolution("TimelineBuilder", config?.targetEvalMode, evalConstraint);

  const gradeBand = resolveGradeBand(gradeLevel);
  const allowedTypes = evalConstraint?.allowedTypes ?? Object.keys(CHALLENGE_TYPE_DOCS);

  // Determine challenge count per type
  const isSingleType = allowedTypes.length === 1;
  const countPerType = isSingleType ? 4 : 2;

  // ── Dispatch sub-generators in parallel ──
  const generators: Promise<TimelineBuilderChallenge[]>[] = [];
  const typeOrder: string[] = [];

  for (const type of allowedTypes) {
    typeOrder.push(type);
    switch (type) {
      case "daily":
        generators.push(generateDailyChallenges(topic, gradeLevel, countPerType));
        break;
      case "yearly":
        generators.push(generateYearlyChallenges(topic, gradeLevel, countPerType));
        break;
      case "historical":
        generators.push(generateHistoricalChallenges(topic, gradeLevel, countPerType));
        break;
    }
  }

  const results = await Promise.all(generators);

  // ── Combine results ──
  let challenges: TimelineBuilderChallenge[] = results.flat();

  // Re-assign IDs sequentially
  challenges = challenges.map((c, i) => ({ ...c, id: `c${i + 1}` }));

  // ── Fallback if any type produced zero challenges ──
  let rejectedCount = 0;
  for (let i = 0; i < typeOrder.length; i++) {
    if (results[i].length === 0) {
      const fallbackType = typeOrder[i];
      console.log(`[TimelineBuilder] No valid ${fallbackType} challenges — injecting fallback`);
      rejectedCount++;
      const fb = FALLBACKS[fallbackType];
      if (fb) {
        challenges.push({ ...fb, id: `c${challenges.length + 1}` });
      }
    }
  }

  // ── Total fallback if still empty ──
  if (challenges.length === 0) {
    const fallbackType = allowedTypes[0] ?? "daily";
    console.log(`[TimelineBuilder] No valid challenges at all — using ${fallbackType} fallback`);
    challenges = [{ ...(FALLBACKS[fallbackType] ?? FALLBACKS.daily), id: "c1" }];
  }

  if (rejectedCount > 0) {
    console.log(`[TimelineBuilder] ${rejectedCount} type(s) fell back to hardcoded challenges`);
  }

  // ── Build title/description from topic ──
  const typeLabels: Record<string, string> = {
    daily: "Daily Timeline",
    yearly: "Yearly Timeline",
    historical: "Historical Timeline",
  };
  let title = `Timeline Builder: ${topic}`;
  let description = "Place events on the timeline in chronological order!";
  if (isSingleType) {
    const label = typeLabels[allowedTypes[0]] ?? "Timeline";
    title = `${label}: ${topic}`;
    description = `Practice ordering ${label.toLowerCase()} events.`;
  }

  const typeBreakdown = challenges.map((c) => c.type).join(", ");
  console.log(`[TimelineBuilder] Final: ${challenges.length} challenge(s) → [${typeBreakdown}]`);

  return {
    title,
    description,
    challenges,
    gradeBand,
  };
};
