import { Type, Schema } from "@google/genai";
import { TimeSequencerData } from "../../primitives/visual-primitives/math/TimeSequencer";
import { ai } from "../geminiClient";
import {
  resolveEvalModeConstraint,
  constrainChallengeTypeEnum,
  buildChallengeTypePromptSection,
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
// Valid periods for validation
// ---------------------------------------------------------------------------

const VALID_PERIODS = ["morning", "afternoon", "evening", "night"];
const VALID_ANSWERS = ["A", "B", "same"];

// ---------------------------------------------------------------------------
// Flattened Gemini schema (arrays → indexed fields)
// ---------------------------------------------------------------------------

const timeSequencerSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    title: {
      type: Type.STRING,
      description: "Title for the time/sequencing activity (e.g., 'My Daily Routine!')",
    },
    description: {
      type: Type.STRING,
      description: "Brief educational description",
    },
    gradeBand: {
      type: Type.STRING,
      description: "Grade band: 'K', '1', or '2'",
    },
    challenges: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.STRING, description: "Unique challenge ID (e.g., 'c1')" },
          type: {
            type: Type.STRING,
            description:
              "Challenge type: 'sequence-events', 'match-time-of-day', 'before-after', 'duration-compare', 'read-schedule'",
          },
          instruction: {
            type: Type.STRING,
            description: "Student-facing instruction, warm and encouraging",
          },
          hint: { type: Type.STRING, description: "Hint shown after incorrect attempts" },

          // --- sequence-events: flattened events array + correctOrderCsv ---
          event0Id: { type: Type.STRING, description: "1st event ID (sequence-events)", nullable: true },
          event0Label: { type: Type.STRING, description: "1st event label", nullable: true },
          event0Emoji: { type: Type.STRING, description: "1st event emoji", nullable: true },
          event0TypicalTime: { type: Type.STRING, description: "1st event typical time", nullable: true },
          event1Id: { type: Type.STRING, description: "2nd event ID", nullable: true },
          event1Label: { type: Type.STRING, description: "2nd event label", nullable: true },
          event1Emoji: { type: Type.STRING, description: "2nd event emoji", nullable: true },
          event1TypicalTime: { type: Type.STRING, description: "2nd event typical time", nullable: true },
          event2Id: { type: Type.STRING, description: "3rd event ID", nullable: true },
          event2Label: { type: Type.STRING, description: "3rd event label", nullable: true },
          event2Emoji: { type: Type.STRING, description: "3rd event emoji", nullable: true },
          event2TypicalTime: { type: Type.STRING, description: "3rd event typical time", nullable: true },
          event3Id: { type: Type.STRING, description: "4th event ID", nullable: true },
          event3Label: { type: Type.STRING, description: "4th event label", nullable: true },
          event3Emoji: { type: Type.STRING, description: "4th event emoji", nullable: true },
          event3TypicalTime: { type: Type.STRING, description: "4th event typical time", nullable: true },
          event4Id: { type: Type.STRING, description: "5th event ID", nullable: true },
          event4Label: { type: Type.STRING, description: "5th event label", nullable: true },
          event4Emoji: { type: Type.STRING, description: "5th event emoji", nullable: true },
          event4TypicalTime: { type: Type.STRING, description: "5th event typical time", nullable: true },
          event5Id: { type: Type.STRING, description: "6th event ID", nullable: true },
          event5Label: { type: Type.STRING, description: "6th event label", nullable: true },
          event5Emoji: { type: Type.STRING, description: "6th event emoji", nullable: true },
          event5TypicalTime: { type: Type.STRING, description: "6th event typical time", nullable: true },
          correctOrderCsv: { type: Type.STRING, description: "Comma-separated event IDs in correct chronological order", nullable: true },

          // --- match-time-of-day: single event + correctPeriod ---
          eventId: { type: Type.STRING, description: "Single event ID (match-time-of-day)", nullable: true },
          eventLabel: { type: Type.STRING, description: "Single event label", nullable: true },
          eventEmoji: { type: Type.STRING, description: "Single event emoji", nullable: true },
          eventTypicalTime: { type: Type.STRING, description: "Single event typical time", nullable: true },
          correctPeriod: { type: Type.STRING, description: "Correct time period: 'morning', 'afternoon', 'evening', or 'night'", nullable: true },

          // --- before-after: referenceEvent + relation + options + correctEvent ---
          referenceEventId: { type: Type.STRING, description: "Reference event ID (before-after)", nullable: true },
          referenceEventLabel: { type: Type.STRING, description: "Reference event label", nullable: true },
          referenceEventEmoji: { type: Type.STRING, description: "Reference event emoji", nullable: true },
          relation: { type: Type.STRING, description: "'before' or 'after'", nullable: true },
          option0Id: { type: Type.STRING, description: "Option 1 ID", nullable: true },
          option0Label: { type: Type.STRING, description: "Option 1 label", nullable: true },
          option0Emoji: { type: Type.STRING, description: "Option 1 emoji", nullable: true },
          option1Id: { type: Type.STRING, description: "Option 2 ID", nullable: true },
          option1Label: { type: Type.STRING, description: "Option 2 label", nullable: true },
          option1Emoji: { type: Type.STRING, description: "Option 2 emoji", nullable: true },
          option2Id: { type: Type.STRING, description: "Option 3 ID", nullable: true },
          option2Label: { type: Type.STRING, description: "Option 3 label", nullable: true },
          option2Emoji: { type: Type.STRING, description: "Option 3 emoji", nullable: true },
          option3Id: { type: Type.STRING, description: "Option 4 ID", nullable: true },
          option3Label: { type: Type.STRING, description: "Option 4 label", nullable: true },
          option3Emoji: { type: Type.STRING, description: "Option 4 emoji", nullable: true },
          correctEvent: { type: Type.STRING, description: "Correct option event ID (before-after)", nullable: true },

          // --- duration-compare: eventA + eventB + correctAnswer ---
          eventAId: { type: Type.STRING, description: "Event A ID (duration-compare)", nullable: true },
          eventALabel: { type: Type.STRING, description: "Event A label", nullable: true },
          eventAEmoji: { type: Type.STRING, description: "Event A emoji", nullable: true },
          eventBId: { type: Type.STRING, description: "Event B ID (duration-compare)", nullable: true },
          eventBLabel: { type: Type.STRING, description: "Event B label", nullable: true },
          eventBEmoji: { type: Type.STRING, description: "Event B emoji", nullable: true },
          correctAnswer: { type: Type.STRING, description: "Which takes longer: 'A', 'B', or 'same'", nullable: true },

          // --- read-schedule: flattened schedule + targetTime + correctActivity + options ---
          schedule0Time: { type: Type.STRING, description: "Schedule entry 1 time", nullable: true },
          schedule0Activity: { type: Type.STRING, description: "Schedule entry 1 activity", nullable: true },
          schedule0Emoji: { type: Type.STRING, description: "Schedule entry 1 emoji", nullable: true },
          schedule1Time: { type: Type.STRING, description: "Schedule entry 2 time", nullable: true },
          schedule1Activity: { type: Type.STRING, description: "Schedule entry 2 activity", nullable: true },
          schedule1Emoji: { type: Type.STRING, description: "Schedule entry 2 emoji", nullable: true },
          schedule2Time: { type: Type.STRING, description: "Schedule entry 3 time", nullable: true },
          schedule2Activity: { type: Type.STRING, description: "Schedule entry 3 activity", nullable: true },
          schedule2Emoji: { type: Type.STRING, description: "Schedule entry 3 emoji", nullable: true },
          schedule3Time: { type: Type.STRING, description: "Schedule entry 4 time", nullable: true },
          schedule3Activity: { type: Type.STRING, description: "Schedule entry 4 activity", nullable: true },
          schedule3Emoji: { type: Type.STRING, description: "Schedule entry 4 emoji", nullable: true },
          schedule4Time: { type: Type.STRING, description: "Schedule entry 5 time", nullable: true },
          schedule4Activity: { type: Type.STRING, description: "Schedule entry 5 activity", nullable: true },
          schedule4Emoji: { type: Type.STRING, description: "Schedule entry 5 emoji", nullable: true },
          schedule5Time: { type: Type.STRING, description: "Schedule entry 6 time", nullable: true },
          schedule5Activity: { type: Type.STRING, description: "Schedule entry 6 activity", nullable: true },
          schedule5Emoji: { type: Type.STRING, description: "Schedule entry 6 emoji", nullable: true },
          targetTime: { type: Type.STRING, description: "Target time to look up in schedule", nullable: true },
          correctActivity: { type: Type.STRING, description: "Correct activity at targetTime", nullable: true },
          activityOption0: { type: Type.STRING, description: "Activity option 1", nullable: true },
          activityOption1: { type: Type.STRING, description: "Activity option 2", nullable: true },
          activityOption2: { type: Type.STRING, description: "Activity option 3", nullable: true },
          activityOption3: { type: Type.STRING, description: "Activity option 4", nullable: true },
        },
        required: ["id", "type", "instruction", "hint"],
      },
      description: "Array of 5-6 progressive challenges",
    },
  },
  required: ["title", "description", "gradeBand", "challenges"],
};

// ---------------------------------------------------------------------------
// Flat → structured helpers
// ---------------------------------------------------------------------------

interface FlatChallenge {
  [key: string]: unknown;
}

function collectEventCards(flat: FlatChallenge, prefix: string, maxSlots: number) {
  const cards: { id: string; label: string; emoji: string; typicalTime?: string }[] = [];
  for (let i = 0; i < maxSlots; i++) {
    const id = flat[`${prefix}${i}Id`];
    const label = flat[`${prefix}${i}Label`];
    const emoji = flat[`${prefix}${i}Emoji`];
    const time = flat[`${prefix}${i}TypicalTime`];
    if (typeof id === "string" && typeof label === "string" && typeof emoji === "string") {
      const card: { id: string; label: string; emoji: string; typicalTime?: string } = { id, label, emoji };
      if (typeof time === "string" && time) card.typicalTime = time;
      cards.push(card);
    }
  }
  return cards.length > 0 ? cards : undefined;
}

function collectSingleEvent(flat: FlatChallenge, prefix: string) {
  const id = flat[`${prefix}Id`];
  const label = flat[`${prefix}Label`];
  const emoji = flat[`${prefix}Emoji`];
  const time = flat[`${prefix}TypicalTime`];
  if (typeof id === "string" && typeof label === "string" && typeof emoji === "string") {
    const card: { id: string; label: string; emoji: string; typicalTime?: string } = { id, label, emoji };
    if (typeof time === "string" && time) card.typicalTime = time;
    return card;
  }
  return undefined;
}

function collectSingleEventNoTime(flat: FlatChallenge, prefix: string) {
  const id = flat[`${prefix}Id`];
  const label = flat[`${prefix}Label`];
  const emoji = flat[`${prefix}Emoji`];
  if (typeof id === "string" && typeof label === "string" && typeof emoji === "string") {
    return { id, label, emoji };
  }
  return undefined;
}

function collectScheduleEntries(flat: FlatChallenge, maxSlots: number) {
  const entries: { time: string; activity: string; emoji: string }[] = [];
  for (let i = 0; i < maxSlots; i++) {
    const time = flat[`schedule${i}Time`];
    const activity = flat[`schedule${i}Activity`];
    const emoji = flat[`schedule${i}Emoji`];
    if (typeof time === "string" && typeof activity === "string" && typeof emoji === "string") {
      entries.push({ time, activity, emoji });
    }
  }
  return entries.length > 0 ? entries : undefined;
}

function collectActivityOptions(flat: FlatChallenge) {
  const opts: string[] = [];
  for (let i = 0; i < 4; i++) {
    const v = flat[`activityOption${i}`];
    if (typeof v === "string" && v) opts.push(v);
  }
  return opts.length > 0 ? opts : undefined;
}

function collectOptionEvents(flat: FlatChallenge, maxSlots: number) {
  const cards: { id: string; label: string; emoji: string }[] = [];
  for (let i = 0; i < maxSlots; i++) {
    const id = flat[`option${i}Id`];
    const label = flat[`option${i}Label`];
    const emoji = flat[`option${i}Emoji`];
    if (typeof id === "string" && typeof label === "string" && typeof emoji === "string") {
      cards.push({ id, label, emoji });
    }
  }
  return cards.length > 0 ? cards : undefined;
}

// ---------------------------------------------------------------------------
// Generator
// ---------------------------------------------------------------------------

/**
 * Generate time sequencer data for interactive time-of-day ordering,
 * event matching, before/after, duration comparison, and schedule reading.
 *
 * Grade-aware content:
 * - K: simple 3-event sequences, morning/afternoon/night only.
 * - Grade 1: 4-5 event sequences, before/after, duration compare.
 * - Grade 2: read-schedule with clock times, all challenge types.
 */
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

  // ── Build mode-constrained schema ──
  const activeSchema = evalConstraint
    ? constrainChallengeTypeEnum(timeSequencerSchema, evalConstraint.allowedTypes, CHALLENGE_TYPE_DOCS)
    : timeSequencerSchema;

  // ── Build prompt ──
  const challengeTypeSection = buildChallengeTypePromptSection(evalConstraint, CHALLENGE_TYPE_DOCS);

  // Randomize theme
  const scenarioThemes = [
    "a school day morning routine",
    "a weekend day at home",
    "getting ready for a field trip",
    "a birthday party day",
    "a rainy day schedule",
    "a visit to grandma's house",
  ];
  const randomTheme = scenarioThemes[Math.floor(Math.random() * scenarioThemes.length)];

  const prompt = `
Create an educational time sequencing activity for teaching "${topic}" to ${gradeLevel} students.
Theme this activity around ${randomTheme}.

CONTEXT:
- Students learn to understand the order of daily events, time-of-day concepts, and schedules.
- Use relatable daily routine activities with fun emojis.
- Emojis to use: 🌅 ☀️ 🌙 🍳 🎒 📚 🏃 🍽️ 🛁 😴 🦷 🚌 🌇 ⭐ 🧹 🎨 🎵 🐕 🍎 🥤

GRADE-LEVEL GUIDELINES:
- Grade K: ONLY use "sequence-events" (3 events max) and "match-time-of-day" (morning/afternoon/night only, no evening). Keep very simple.
- Grade 1: Use "sequence-events" (4-5 events), "match-time-of-day" (all 4 periods), "before-after", and "duration-compare".
- Grade 2: All types including "read-schedule" with clock times (e.g., "8:00 AM", "12:30 PM").

${challengeTypeSection}

FIELD GUIDELINES PER CHALLENGE TYPE:
- "sequence-events": Set event0Id..event5Id, event0Label..event5Label, event0Emoji..event5Emoji, event0TypicalTime..event5TypicalTime. Set correctOrderCsv as comma-separated IDs in chronological order. Event IDs should be short like "e1", "e2", etc.
- "match-time-of-day": Set eventId, eventLabel, eventEmoji, eventTypicalTime (the single event). Set correctPeriod to 'morning', 'afternoon', 'evening', or 'night'.
- "before-after": Set referenceEventId, referenceEventLabel, referenceEventEmoji. Set relation ('before' or 'after'). Set option0Id..option3Id, option0Label..option3Label, option0Emoji..option3Emoji (3-4 choices). Set correctEvent to the correct option's ID.
- "duration-compare": Set eventAId, eventALabel, eventAEmoji and eventBId, eventBLabel, eventBEmoji. Set correctAnswer to 'A', 'B', or 'same'.
- "read-schedule": Set schedule0Time..schedule5Time, schedule0Activity..schedule5Activity, schedule0Emoji..schedule5Emoji (4-6 schedule entries in time order). Set targetTime (e.g., "9:00 AM"). Set correctActivity (the activity at that time). Set activityOption0..activityOption3 (4 choices including the correct one).

IMPORTANT VALIDATION RULES:
- For "sequence-events": correctOrderCsv MUST contain exactly the same IDs as the events listed, in chronological order.
- For "before-after": correctEvent MUST be one of the option IDs.
- For "read-schedule": correctActivity MUST be one of activityOption0-3, and MUST match the schedule entry at targetTime.
- All event IDs must be unique within each challenge.

REQUIREMENTS:
1. Generate 5-6 challenges that progress in difficulty.
2. Use warm, encouraging instruction text appropriate for young children.
3. Include helpful hints that guide without giving the answer.
4. Set gradeBand based on grade level (K, 1, or 2).
5. Use varied daily routine scenarios — don't repeat the same events across challenges.
6. Emojis should clearly represent the activity.

Return the complete time sequencer configuration.
`;

  logEvalModeResolution("TimeSequencer", config?.targetEvalMode, evalConstraint);

  const result = await ai.models.generateContent({
    model: "gemini-flash-lite-latest",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: activeSchema,
    },
  });

  const data = result.text ? JSON.parse(result.text) : null;

  if (!data) {
    throw new Error("No valid time sequencer data returned from Gemini API");
  }

  // ── Validate gradeBand ──
  const validGrades = ["K", "1", "2"];
  if (!validGrades.includes(data.gradeBand)) {
    const gl = gradeLevel.toLowerCase();
    if (gl.includes("kinder") || gl.includes("k")) data.gradeBand = "K";
    else if (gl.includes("2")) data.gradeBand = "2";
    else data.gradeBand = "1";
  }

  // ── Reconstruct arrays from flat fields & validate per challenge ──
  const validTypes = ["sequence-events", "match-time-of-day", "before-after", "duration-compare", "read-schedule"];

  data.challenges = (data.challenges || [])
    .filter((c: FlatChallenge) => validTypes.includes(c.type as string))
    .map((flat: FlatChallenge) => {
      const challenge: Record<string, unknown> = {
        id: flat.id,
        type: flat.type,
        instruction: flat.instruction,
        hint: flat.hint || "Think about what happens during your day!",
      };

      switch (flat.type) {
        case "sequence-events": {
          const events = collectEventCards(flat, "event", 6);
          if (events && events.length >= 2) {
            challenge.events = events;
            // Parse and validate correctOrderCsv
            const csvStr = typeof flat.correctOrderCsv === "string" ? flat.correctOrderCsv : "";
            const orderIds = csvStr.split(",").map((s: string) => s.trim()).filter(Boolean);
            const eventIdSet = new Set(events.map((e) => e.id));
            // Filter to only valid IDs
            const validOrder = orderIds.filter((id: string) => eventIdSet.has(id));
            // If order is incomplete, fill in missing IDs at end
            if (validOrder.length < events.length) {
              for (const e of events) {
                if (!validOrder.includes(e.id)) validOrder.push(e.id);
              }
            }
            challenge.correctOrder = validOrder;
          }
          break;
        }
        case "match-time-of-day": {
          const evt = collectSingleEvent(flat, "event");
          if (evt) challenge.event = evt;
          const period = typeof flat.correctPeriod === "string" ? flat.correctPeriod.toLowerCase() : "";
          challenge.correctPeriod = VALID_PERIODS.includes(period) ? period : "morning";
          break;
        }
        case "before-after": {
          const ref = collectSingleEventNoTime(flat, "referenceEvent");
          if (ref) challenge.referenceEvent = ref;
          const rel = typeof flat.relation === "string" ? flat.relation.toLowerCase() : "";
          challenge.relation = (rel === "before" || rel === "after") ? rel : "after";
          const options = collectOptionEvents(flat, 4);
          if (options) {
            challenge.options = options;
            // Validate correctEvent is one of the option IDs
            const optionIds = new Set(options.map((o) => o.id));
            if (typeof flat.correctEvent === "string" && optionIds.has(flat.correctEvent)) {
              challenge.correctEvent = flat.correctEvent;
            } else if (options.length > 0) {
              challenge.correctEvent = options[0].id;
            }
          }
          break;
        }
        case "duration-compare": {
          const evtA = collectSingleEventNoTime(flat, "eventA");
          const evtB = collectSingleEventNoTime(flat, "eventB");
          if (evtA) challenge.eventA = evtA;
          if (evtB) challenge.eventB = evtB;
          const ans = typeof flat.correctAnswer === "string" ? flat.correctAnswer : "";
          challenge.correctAnswer = VALID_ANSWERS.includes(ans) ? ans : "A";
          break;
        }
        case "read-schedule": {
          const schedule = collectScheduleEntries(flat, 6);
          if (schedule) challenge.schedule = schedule;
          if (typeof flat.targetTime === "string") challenge.targetTime = flat.targetTime;
          const actOpts = collectActivityOptions(flat);
          if (actOpts) {
            challenge.activityOptions = actOpts;
            // Validate correctActivity is in options
            if (typeof flat.correctActivity === "string" && actOpts.includes(flat.correctActivity)) {
              challenge.correctActivity = flat.correctActivity;
            } else if (actOpts.length > 0) {
              // Try to find the correct one from the schedule
              if (schedule && typeof flat.targetTime === "string") {
                const entry = schedule.find((s) => s.time === flat.targetTime);
                if (entry && actOpts.includes(entry.activity)) {
                  challenge.correctActivity = entry.activity;
                } else {
                  challenge.correctActivity = actOpts[0];
                }
              } else {
                challenge.correctActivity = actOpts[0];
              }
            }
          }
          break;
        }
      }

      return challenge;
    });

  // ── Fallback if empty ──
  if (data.challenges.length === 0) {
    const fallbackType = evalConstraint?.allowedTypes[0] ?? "sequence-events";
    console.log(`[TimeSequencer] No valid challenges — using ${fallbackType} fallback`);
    const fallbacks: Record<string, Record<string, unknown>> = {
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
    data.challenges = [fallbacks[fallbackType] ?? fallbacks["sequence-events"]];
  }

  // Final log
  const typeBreakdown = (data.challenges as Array<{ type: string }>)
    .map((c) => c.type)
    .join(", ");
  console.log(
    `[TimeSequencer] Final: ${data.challenges.length} challenge(s) → [${typeBreakdown}]`,
  );

  return data as TimeSequencerData;
};
