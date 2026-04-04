import { Type, Schema } from "@google/genai";
import { TimeSequencerData, TimeSequencerChallenge } from "../../primitives/visual-primitives/math/TimeSequencer";
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
  "sequence-events": {
    promptDoc:
      `"sequence-events": Order daily routine events in chronological sequence. `
      + `Student taps events one by one to build the correct order. `
      + `Provide 3-5 events with emojis. correctOrderCsv is comma-separated event IDs in correct order.`,
    schemaDescription: "'sequence-events' (order events chronologically)",
  },
  "match-time-of-day": {
    promptDoc:
      `"match-time-of-day": Match an activity to a time of day (morning, afternoon, evening, night). `
      + `Show one event, student picks the correct time period.`,
    schemaDescription: "'match-time-of-day' (match event to morning/afternoon/evening/night)",
  },
  "before-after": {
    promptDoc:
      `"before-after": Identify what happens before or after a reference event. `
      + `Show a reference event and 3-4 options. Student picks the event that comes before or after.`,
    schemaDescription: "'before-after' (what comes before/after)",
  },
  "duration-compare": {
    promptDoc:
      `"duration-compare": Compare which of two activities takes longer. `
      + `Show eventA and eventB, student picks which takes more time. correctAnswer is 'A', 'B', or 'same'.`,
    schemaDescription: "'duration-compare' (which takes longer)",
  },
  "read-schedule": {
    promptDoc:
      `"read-schedule": Read a daily schedule to find what activity happens at a given time. `
      + `Show a schedule with times and activities, ask what happens at a target time. `
      + `Provide 4 activity options. Grade 2+ only.`,
    schemaDescription: "'read-schedule' (read a schedule to answer questions)",
  },
};

// ---------------------------------------------------------------------------
// Shared constants
// ---------------------------------------------------------------------------

const VALID_PERIODS = ["morning", "afternoon", "evening", "night"];
const VALID_ANSWERS = ["A", "B", "same"];

const SCENARIO_THEMES = [
  "a school day morning routine",
  "a weekend day at home",
  "getting ready for a field trip",
  "a birthday party day",
  "a rainy day schedule",
  "a visit to grandma's house",
];

function randomTheme(): string {
  return SCENARIO_THEMES[Math.floor(Math.random() * SCENARIO_THEMES.length)];
}

const SHARED_CONTEXT = `Use relatable daily routine activities with fun emojis.
Emojis to use: 🌅 ☀️ 🌙 🍳 🎒 📚 🏃 🍽️ 🛁 😴 🦷 🚌 🌇 ⭐ 🧹 🎨 🎵 🐕 🍎 🥤
Use warm, encouraging instruction text appropriate for young children.
Include helpful hints that guide without giving the answer.`;

// ---------------------------------------------------------------------------
// Per-mode schemas — flat, focused, no nullable fields
// ---------------------------------------------------------------------------

const sequenceEventsSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    title: { type: Type.STRING, description: "Activity title" },
    description: { type: Type.STRING, description: "Brief educational description" },
    challenges: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.STRING, description: "Unique ID e.g. 'c1'" },
          instruction: { type: Type.STRING, description: "Student-facing instruction" },
          hint: { type: Type.STRING, description: "Hint shown after incorrect attempts" },
          event0Id: { type: Type.STRING, description: "1st event ID (e.g. 'e1')" },
          event0Label: { type: Type.STRING, description: "1st event label" },
          event0Emoji: { type: Type.STRING, description: "1st event emoji" },
          event1Id: { type: Type.STRING, description: "2nd event ID" },
          event1Label: { type: Type.STRING, description: "2nd event label" },
          event1Emoji: { type: Type.STRING, description: "2nd event emoji" },
          event2Id: { type: Type.STRING, description: "3rd event ID" },
          event2Label: { type: Type.STRING, description: "3rd event label" },
          event2Emoji: { type: Type.STRING, description: "3rd event emoji" },
          event3Id: { type: Type.STRING, description: "4th event ID (use empty string if fewer than 4 events)", nullable: true },
          event3Label: { type: Type.STRING, description: "4th event label", nullable: true },
          event3Emoji: { type: Type.STRING, description: "4th event emoji", nullable: true },
          event4Id: { type: Type.STRING, description: "5th event ID (use empty string if fewer than 5 events)", nullable: true },
          event4Label: { type: Type.STRING, description: "5th event label", nullable: true },
          event4Emoji: { type: Type.STRING, description: "5th event emoji", nullable: true },
          correctOrderCsv: { type: Type.STRING, description: "Comma-separated event IDs in correct chronological order" },
        },
        required: ["id", "instruction", "hint", "event0Id", "event0Label", "event0Emoji", "event1Id", "event1Label", "event1Emoji", "event2Id", "event2Label", "event2Emoji", "correctOrderCsv"],
      },
      description: "Array of sequence challenges",
    },
  },
  required: ["title", "description", "challenges"],
};

const matchTimeOfDaySchema: Schema = {
  type: Type.OBJECT,
  properties: {
    title: { type: Type.STRING, description: "Activity title" },
    description: { type: Type.STRING, description: "Brief educational description" },
    challenges: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.STRING, description: "Unique ID" },
          instruction: { type: Type.STRING, description: "Student-facing instruction" },
          hint: { type: Type.STRING, description: "Hint" },
          eventLabel: { type: Type.STRING, description: "Activity label" },
          eventEmoji: { type: Type.STRING, description: "Activity emoji" },
          correctPeriod: { type: Type.STRING, description: "'morning', 'afternoon', 'evening', or 'night'" },
        },
        required: ["id", "instruction", "hint", "eventLabel", "eventEmoji", "correctPeriod"],
      },
    },
  },
  required: ["title", "description", "challenges"],
};

const beforeAfterSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    title: { type: Type.STRING, description: "Activity title" },
    description: { type: Type.STRING, description: "Brief educational description" },
    challenges: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.STRING, description: "Unique ID" },
          instruction: { type: Type.STRING, description: "Student-facing instruction" },
          hint: { type: Type.STRING, description: "Hint" },
          referenceLabel: { type: Type.STRING, description: "Reference event label" },
          referenceEmoji: { type: Type.STRING, description: "Reference event emoji" },
          relation: { type: Type.STRING, description: "'before' or 'after'" },
          option0Label: { type: Type.STRING, description: "Option 1 label" },
          option0Emoji: { type: Type.STRING, description: "Option 1 emoji" },
          option1Label: { type: Type.STRING, description: "Option 2 label" },
          option1Emoji: { type: Type.STRING, description: "Option 2 emoji" },
          option2Label: { type: Type.STRING, description: "Option 3 label" },
          option2Emoji: { type: Type.STRING, description: "Option 3 emoji" },
          correctOptionIndex: { type: Type.NUMBER, description: "Index of correct option (0, 1, or 2)" },
        },
        required: ["id", "instruction", "hint", "referenceLabel", "referenceEmoji", "relation", "option0Label", "option0Emoji", "option1Label", "option1Emoji", "option2Label", "option2Emoji", "correctOptionIndex"],
      },
    },
  },
  required: ["title", "description", "challenges"],
};

const durationCompareSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    title: { type: Type.STRING, description: "Activity title" },
    description: { type: Type.STRING, description: "Brief educational description" },
    challenges: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.STRING, description: "Unique ID" },
          instruction: { type: Type.STRING, description: "Student-facing instruction" },
          hint: { type: Type.STRING, description: "Hint" },
          eventALabel: { type: Type.STRING, description: "Event A label" },
          eventAEmoji: { type: Type.STRING, description: "Event A emoji" },
          eventBLabel: { type: Type.STRING, description: "Event B label" },
          eventBEmoji: { type: Type.STRING, description: "Event B emoji" },
          correctAnswer: { type: Type.STRING, description: "'A', 'B', or 'same'" },
        },
        required: ["id", "instruction", "hint", "eventALabel", "eventAEmoji", "eventBLabel", "eventBEmoji", "correctAnswer"],
      },
    },
  },
  required: ["title", "description", "challenges"],
};

const readScheduleSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    title: { type: Type.STRING, description: "Activity title" },
    description: { type: Type.STRING, description: "Brief educational description" },
    challenges: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.STRING, description: "Unique ID" },
          instruction: { type: Type.STRING, description: "Student-facing instruction" },
          hint: { type: Type.STRING, description: "Hint" },
          schedule0Time: { type: Type.STRING, description: "Schedule entry 1 time" },
          schedule0Activity: { type: Type.STRING, description: "Schedule entry 1 activity" },
          schedule0Emoji: { type: Type.STRING, description: "Schedule entry 1 emoji" },
          schedule1Time: { type: Type.STRING, description: "Schedule entry 2 time" },
          schedule1Activity: { type: Type.STRING, description: "Schedule entry 2 activity" },
          schedule1Emoji: { type: Type.STRING, description: "Schedule entry 2 emoji" },
          schedule2Time: { type: Type.STRING, description: "Schedule entry 3 time" },
          schedule2Activity: { type: Type.STRING, description: "Schedule entry 3 activity" },
          schedule2Emoji: { type: Type.STRING, description: "Schedule entry 3 emoji" },
          schedule3Time: { type: Type.STRING, description: "Schedule entry 4 time" },
          schedule3Activity: { type: Type.STRING, description: "Schedule entry 4 activity" },
          schedule3Emoji: { type: Type.STRING, description: "Schedule entry 4 emoji" },
          targetTime: { type: Type.STRING, description: "Time to look up" },
          correctActivity: { type: Type.STRING, description: "Activity at targetTime" },
          wrongOption1: { type: Type.STRING, description: "Wrong activity option 1" },
          wrongOption2: { type: Type.STRING, description: "Wrong activity option 2" },
          wrongOption3: { type: Type.STRING, description: "Wrong activity option 3" },
        },
        required: ["id", "instruction", "hint", "schedule0Time", "schedule0Activity", "schedule0Emoji", "schedule1Time", "schedule1Activity", "schedule1Emoji", "schedule2Time", "schedule2Activity", "schedule2Emoji", "schedule3Time", "schedule3Activity", "schedule3Emoji", "targetTime", "correctActivity", "wrongOption1", "wrongOption2", "wrongOption3"],
      },
    },
  },
  required: ["title", "description", "challenges"],
};

// ---------------------------------------------------------------------------
// Per-mode sub-generators
// ---------------------------------------------------------------------------

interface SubResult {
  title: string;
  description: string;
  challenges: TimeSequencerChallenge[];
}

async function generateSequenceEvents(
  topic: string,
  gradeLevel: string,
  count: number,
): Promise<SubResult> {
  const theme = randomTheme();
  const prompt = `
Create ${count} "sequence-events" challenges for teaching "${topic}" to ${gradeLevel} students.
Theme: ${theme}.

Each challenge: give 3-5 daily routine events. Student must tap them in chronological order.
- Use event IDs like "e1", "e2", etc.
- correctOrderCsv: comma-separated event IDs in the correct chronological order.
- For K: 3 events max. For Grade 1-2: 4-5 events.
- All event IDs must be unique within each challenge.
- correctOrderCsv MUST contain exactly the same IDs as the events listed.
- Vary the scenarios — don't repeat the same events across challenges.

${SHARED_CONTEXT}
`;

  const result = await ai.models.generateContent({
    model: "gemini-flash-lite-latest",
    contents: prompt,
    config: { responseMimeType: "application/json", responseSchema: sequenceEventsSchema },
  });

  const data = result.text ? JSON.parse(result.text) : null;
  if (!data?.challenges?.length) return { title: "", description: "", challenges: [] };

  // Post-process: flat → structured
  const challenges: TimeSequencerChallenge[] = data.challenges.map((flat: Record<string, unknown>, i: number) => {
    const events: { id: string; label: string; emoji: string }[] = [];
    for (let j = 0; j < 5; j++) {
      const id = flat[`event${j}Id`];
      const label = flat[`event${j}Label`];
      const emoji = flat[`event${j}Emoji`];
      if (typeof id === "string" && id && typeof label === "string" && typeof emoji === "string") {
        events.push({ id, label, emoji });
      }
    }

    // Parse and validate correctOrderCsv
    const csvStr = typeof flat.correctOrderCsv === "string" ? flat.correctOrderCsv : "";
    const orderIds = csvStr.split(",").map((s: string) => s.trim()).filter(Boolean);
    const eventIdSet = new Set(events.map((e) => e.id));
    const validOrder = orderIds.filter((id: string) => eventIdSet.has(id));
    // Fill missing IDs
    for (const e of events) {
      if (!validOrder.includes(e.id)) validOrder.push(e.id);
    }

    return {
      id: `c${i + 1}`,
      type: "sequence-events" as const,
      instruction: (flat.instruction as string) || "Put these events in order!",
      hint: (flat.hint as string) || "Think about what happens first in your day!",
      events: events.length >= 2 ? events : undefined,
      correctOrder: events.length >= 2 ? validOrder : undefined,
    };
  }).filter((ch: TimeSequencerChallenge) => ch.events && ch.events.length >= 2);

  return { title: data.title || "", description: data.description || "", challenges };
}

async function generateMatchTimeOfDay(
  topic: string,
  gradeLevel: string,
  count: number,
): Promise<SubResult> {
  const theme = randomTheme();
  const prompt = `
Create ${count} "match-time-of-day" challenges for teaching "${topic}" to ${gradeLevel} students.
Theme: ${theme}.

Each challenge: show ONE activity. Student picks whether it happens in morning, afternoon, evening, or night.
- correctPeriod must be exactly one of: 'morning', 'afternoon', 'evening', 'night'.
- For K: only use morning, afternoon, night (no evening).
- Use a variety of daily activities (eating, sleeping, school, play, etc.).

${SHARED_CONTEXT}
`;

  const result = await ai.models.generateContent({
    model: "gemini-flash-lite-latest",
    contents: prompt,
    config: { responseMimeType: "application/json", responseSchema: matchTimeOfDaySchema },
  });

  const data = result.text ? JSON.parse(result.text) : null;
  if (!data?.challenges?.length) return { title: "", description: "", challenges: [] };

  const challenges: TimeSequencerChallenge[] = data.challenges.map((flat: Record<string, unknown>, i: number) => {
    const period = typeof flat.correctPeriod === "string" ? flat.correctPeriod.toLowerCase() : "";
    return {
      id: `c${i + 1}`,
      type: "match-time-of-day" as const,
      instruction: (flat.instruction as string) || "When does this happen?",
      hint: (flat.hint as string) || "Think about when you do this activity!",
      event: {
        id: `evt${i + 1}`,
        label: (flat.eventLabel as string) || "Activity",
        emoji: (flat.eventEmoji as string) || "🌟",
      },
      correctPeriod: (VALID_PERIODS.includes(period) ? period : "morning") as TimeSequencerChallenge["correctPeriod"],
    };
  });

  return { title: data.title || "", description: data.description || "", challenges };
}

async function generateBeforeAfter(
  topic: string,
  gradeLevel: string,
  count: number,
): Promise<SubResult> {
  const theme = randomTheme();
  const prompt = `
Create ${count} "before-after" challenges for teaching "${topic}" to ${gradeLevel} students.
Theme: ${theme}.

Each challenge: show a reference event. Ask "What happens BEFORE/AFTER [event]?"
Provide 3 options. correctOptionIndex is the 0-based index of the correct answer.
- relation must be 'before' or 'after'.
- correctOptionIndex must be 0, 1, or 2.
- Use varied daily activities that have clear temporal relationships.

${SHARED_CONTEXT}
`;

  const result = await ai.models.generateContent({
    model: "gemini-flash-lite-latest",
    contents: prompt,
    config: { responseMimeType: "application/json", responseSchema: beforeAfterSchema },
  });

  const data = result.text ? JSON.parse(result.text) : null;
  if (!data?.challenges?.length) return { title: "", description: "", challenges: [] };

  const challenges: TimeSequencerChallenge[] = data.challenges.map((flat: Record<string, unknown>, i: number) => {
    const options: { id: string; label: string; emoji: string }[] = [];
    for (let j = 0; j < 3; j++) {
      const label = flat[`option${j}Label`];
      const emoji = flat[`option${j}Emoji`];
      if (typeof label === "string" && typeof emoji === "string") {
        options.push({ id: `opt${j}`, label, emoji });
      }
    }

    const rel = typeof flat.relation === "string" ? flat.relation.toLowerCase() : "";
    const correctIdx = typeof flat.correctOptionIndex === "number"
      ? Math.min(Math.max(0, Math.floor(flat.correctOptionIndex)), options.length - 1)
      : 0;

    return {
      id: `c${i + 1}`,
      type: "before-after" as const,
      instruction: (flat.instruction as string) || "What happens next?",
      hint: (flat.hint as string) || "Think about your daily routine!",
      referenceEvent: {
        id: `ref${i}`,
        label: (flat.referenceLabel as string) || "Event",
        emoji: (flat.referenceEmoji as string) || "🌟",
      },
      relation: ((rel === "before" || rel === "after") ? rel : "after") as "before" | "after",
      options,
      correctEvent: options[correctIdx]?.id ?? options[0]?.id,
    };
  }).filter((ch: TimeSequencerChallenge) => ch.options && ch.options.length >= 2);

  return { title: data.title || "", description: data.description || "", challenges };
}

async function generateDurationCompare(
  topic: string,
  gradeLevel: string,
  count: number,
): Promise<SubResult> {
  const theme = randomTheme();
  const prompt = `
Create ${count} "duration-compare" challenges for teaching "${topic}" to ${gradeLevel} students.
Theme: ${theme}.

Each challenge: show two activities. Student picks which takes longer.
- correctAnswer must be exactly 'A', 'B', or 'same'.
- Choose activities with clearly different durations (e.g. brushing teeth vs going to school).
- Include 1 'same' answer if ${count} >= 3.

${SHARED_CONTEXT}
`;

  const result = await ai.models.generateContent({
    model: "gemini-flash-lite-latest",
    contents: prompt,
    config: { responseMimeType: "application/json", responseSchema: durationCompareSchema },
  });

  const data = result.text ? JSON.parse(result.text) : null;
  if (!data?.challenges?.length) return { title: "", description: "", challenges: [] };

  const challenges: TimeSequencerChallenge[] = data.challenges.map((flat: Record<string, unknown>, i: number) => {
    const ans = typeof flat.correctAnswer === "string" ? flat.correctAnswer : "";
    return {
      id: `c${i + 1}`,
      type: "duration-compare" as const,
      instruction: (flat.instruction as string) || "Which takes longer?",
      hint: (flat.hint as string) || "Think about how much time each activity takes!",
      eventA: {
        id: `eA${i}`,
        label: (flat.eventALabel as string) || "Activity A",
        emoji: (flat.eventAEmoji as string) || "🌟",
      },
      eventB: {
        id: `eB${i}`,
        label: (flat.eventBLabel as string) || "Activity B",
        emoji: (flat.eventBEmoji as string) || "⭐",
      },
      correctAnswer: (VALID_ANSWERS.includes(ans) ? ans : "A") as "A" | "B" | "same",
    };
  });

  return { title: data.title || "", description: data.description || "", challenges };
}

async function generateReadSchedule(
  topic: string,
  gradeLevel: string,
  count: number,
): Promise<SubResult> {
  const theme = randomTheme();
  const prompt = `
Create ${count} "read-schedule" challenges for teaching "${topic}" to ${gradeLevel} students.
Theme: ${theme}.

Each challenge: show a 4-entry daily schedule with clock times (e.g. "8:00 AM", "12:30 PM").
Ask what happens at targetTime. Provide 3 wrong options plus the correct one.
- correctActivity MUST match the activity in the schedule at targetTime EXACTLY.
- wrongOption1/2/3 must be plausible activities NOT at that time.
- Schedule entries should be in chronological order.
- Grade 2+ content — use simple clock times.

${SHARED_CONTEXT}
`;

  const result = await ai.models.generateContent({
    model: "gemini-flash-lite-latest",
    contents: prompt,
    config: { responseMimeType: "application/json", responseSchema: readScheduleSchema },
  });

  const data = result.text ? JSON.parse(result.text) : null;
  if (!data?.challenges?.length) return { title: "", description: "", challenges: [] };

  const challenges: TimeSequencerChallenge[] = data.challenges.map((flat: Record<string, unknown>, i: number) => {
    const schedule: { time: string; activity: string; emoji: string }[] = [];
    for (let j = 0; j < 4; j++) {
      const time = flat[`schedule${j}Time`];
      const activity = flat[`schedule${j}Activity`];
      const emoji = flat[`schedule${j}Emoji`];
      if (typeof time === "string" && typeof activity === "string" && typeof emoji === "string") {
        schedule.push({ time, activity, emoji });
      }
    }

    const correctActivity = (flat.correctActivity as string) || "";
    const wrong1 = (flat.wrongOption1 as string) || "";
    const wrong2 = (flat.wrongOption2 as string) || "";
    const wrong3 = (flat.wrongOption3 as string) || "";

    // Derive correctActivity from schedule if Gemini didn't match
    const targetTime = (flat.targetTime as string) || "";
    const scheduleEntry = schedule.find((s) => s.time === targetTime);
    const derivedCorrect = scheduleEntry?.activity ?? correctActivity;

    // Build shuffled activity options
    const allOpts = [derivedCorrect, wrong1, wrong2, wrong3].filter(Boolean);
    // Shuffle
    for (let k = allOpts.length - 1; k > 0; k--) {
      const r = Math.floor(Math.random() * (k + 1));
      [allOpts[k], allOpts[r]] = [allOpts[r], allOpts[k]];
    }

    return {
      id: `c${i + 1}`,
      type: "read-schedule" as const,
      instruction: (flat.instruction as string) || `What happens at ${targetTime}?`,
      hint: (flat.hint as string) || "Look at the schedule and find the time!",
      schedule: schedule.length >= 3 ? schedule : undefined,
      targetTime,
      correctActivity: derivedCorrect,
      activityOptions: allOpts.length >= 2 ? allOpts : undefined,
    };
  }).filter((ch: TimeSequencerChallenge) => ch.schedule && ch.activityOptions);

  return { title: data.title || "", description: data.description || "", challenges };
}

// ---------------------------------------------------------------------------
// Generator dispatch map
// ---------------------------------------------------------------------------

type SubGenerator = (
  topic: string,
  gradeLevel: string,
  count: number,
) => Promise<SubResult>;

const GENERATOR_MAP: Record<string, SubGenerator> = {
  "sequence-events": generateSequenceEvents,
  "match-time-of-day": generateMatchTimeOfDay,
  "before-after": generateBeforeAfter,
  "duration-compare": generateDurationCompare,
  "read-schedule": generateReadSchedule,
};

// ---------------------------------------------------------------------------
// Fallback challenges
// ---------------------------------------------------------------------------

const FALLBACKS: Record<string, TimeSequencerChallenge> = {
  "sequence-events": {
    id: "c1",
    type: "sequence-events",
    instruction: "Put these morning events in order!",
    hint: "Think about what you do first when you wake up.",
    events: [
      { id: "e1", label: "Wake up", emoji: "🌅" },
      { id: "e2", label: "Brush teeth", emoji: "🦷" },
      { id: "e3", label: "Eat breakfast", emoji: "🍳" },
    ],
    correctOrder: ["e1", "e2", "e3"],
  },
  "match-time-of-day": {
    id: "c1",
    type: "match-time-of-day",
    instruction: "When do you eat breakfast?",
    hint: "Do you eat breakfast when you first wake up?",
    event: { id: "e1", label: "Eat breakfast", emoji: "🍳" },
    correctPeriod: "morning",
  },
  "before-after": {
    id: "c1",
    type: "before-after",
    instruction: "What happens AFTER you wake up?",
    hint: "Think about the first thing you do after opening your eyes.",
    referenceEvent: { id: "e1", label: "Wake up", emoji: "🌅" },
    relation: "after",
    options: [
      { id: "e2", label: "Brush teeth", emoji: "🦷" },
      { id: "e3", label: "Go to sleep", emoji: "😴" },
      { id: "e4", label: "Eat dinner", emoji: "🍽️" },
    ],
    correctEvent: "e2",
  },
  "duration-compare": {
    id: "c1",
    type: "duration-compare",
    instruction: "Which takes longer?",
    hint: "Think about how much time each activity usually takes.",
    eventA: { id: "e1", label: "Brush teeth", emoji: "🦷" },
    eventB: { id: "e2", label: "Go to school", emoji: "🚌" },
    correctAnswer: "B",
  },
  "read-schedule": {
    id: "c1",
    type: "read-schedule",
    instruction: "Look at the schedule. What happens at 9:00 AM?",
    hint: "Find 9:00 AM on the schedule and read the activity.",
    schedule: [
      { time: "8:00 AM", activity: "Breakfast", emoji: "🍳" },
      { time: "9:00 AM", activity: "Math class", emoji: "📚" },
      { time: "12:00 PM", activity: "Lunch", emoji: "🍽️" },
      { time: "3:00 PM", activity: "Go home", emoji: "🚌" },
    ],
    targetTime: "9:00 AM",
    correctActivity: "Math class",
    activityOptions: ["Breakfast", "Math class", "Lunch", "Go home"],
  },
};

// ---------------------------------------------------------------------------
// Main orchestrator
// ---------------------------------------------------------------------------

export const generateTimeSequencer = async (
  topic: string,
  gradeLevel: string,
  config?: Partial<{ targetEvalMode?: string }>,
): Promise<TimeSequencerData> => {
  // ── Resolve eval mode ──
  const evalConstraint = resolveEvalModeConstraint(
    "time-sequencer",
    config?.targetEvalMode,
    CHALLENGE_TYPE_DOCS,
  );

  logEvalModeResolution("TimeSequencer", config?.targetEvalMode, evalConstraint);

  // ── Determine allowed types ──
  const allTypes = Object.keys(CHALLENGE_TYPE_DOCS);
  const allowedTypes = evalConstraint?.allowedTypes ?? allTypes;

  // ── Determine challenge count per type ──
  // Target ~5 total challenges
  const totalTarget = 5;
  const challengesPerType = Math.max(1, Math.ceil(totalTarget / allowedTypes.length));

  // ── Dispatch sub-generators in parallel ──
  const results = await Promise.all(
    allowedTypes
      .filter((t) => GENERATOR_MAP[t])
      .map((t) => GENERATOR_MAP[t](topic, gradeLevel, challengesPerType)),
  );

  // ── Combine results ──
  let allChallenges: TimeSequencerChallenge[] = [];
  let title = "";
  let description = "";

  for (const result of results) {
    if (!title && result.title) title = result.title;
    if (!description && result.description) description = result.description;

    for (const ch of result.challenges) {
      const idx = allChallenges.length;
      ch.id = `c${idx + 1}`;
      allChallenges.push(ch);
    }
  }

  // ── Trim to target if we got too many ──
  if (allChallenges.length > totalTarget + 1) {
    allChallenges = allChallenges.slice(0, totalTarget + 1);
  }

  // ── Fallback if empty ──
  if (allChallenges.length === 0) {
    const fallbackType = allowedTypes[0] ?? "sequence-events";
    console.log(`[TimeSequencer] No valid challenges — using ${fallbackType} fallback`);
    allChallenges = [FALLBACKS[fallbackType] ?? FALLBACKS["sequence-events"]];
  }

  // ── Resolve grade band ──
  const gl = gradeLevel.toLowerCase();
  let gradeBand: "K" | "1" | "2" = "1";
  if (gl.includes("kinder") || gl.includes("k")) gradeBand = "K";
  else if (gl.includes("2")) gradeBand = "2";

  // ── Fallback title/description ──
  if (!title) title = "Time & Sequencing";
  if (!description) description = "Learn about the order of daily events and time concepts!";

  // Final log
  const typeBreakdown = allChallenges.map((c) => c.type).join(", ");
  console.log(
    `[TimeSequencer] Final: ${allChallenges.length} challenge(s) → [${typeBreakdown}]`,
  );

  return {
    title,
    description,
    gradeBand,
    challenges: allChallenges,
  } as TimeSequencerData;
};
