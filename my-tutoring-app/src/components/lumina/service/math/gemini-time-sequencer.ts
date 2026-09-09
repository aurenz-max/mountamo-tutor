import { Type, Schema } from "@google/genai";
import { TimeSequencerData, TimeSequencerChallenge } from "../../primitives/visual-primitives/math/TimeSequencer";
import { ai } from "../geminiClient";
import type { GenerationContext } from "../generation/generationContext";
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
  "clock-sequence": {
    promptDoc:
      `"clock-sequence": Order daily routine events in chronological sequence, where each card also `
      + `shows an ANALOG CLOCK FACE at the hour that activity happens. Same tap-in-order interaction `
      + `as sequence-events. Provide 3-4 events with emojis. correctOrderCsv is comma-separated event IDs `
      + `in correct order. HARD REQUIREMENTS on the times: every event's typicalTime must be a WHOLE HOUR `
      + `(e.g. "7:00 AM", never "7:30 AM"), no two events may share an hour, and ALL events in one `
      + `challenge must be in the same half of the day (all AM or all PM) — a 12-hour clock face cannot `
      + `tell 8 in the morning from 8 at night, and the activity DROPS any challenge that breaks either rule.`,
    schemaDescription: "'clock-sequence' (order events by the clock face on each card)",
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
// Within-mode support tier (config.difficulty) — scaffolding level, NOT events/times
// ---------------------------------------------------------------------------

type SupportTier = 'easy' | 'medium' | 'hard';
const SUPPORT_TIERS: readonly SupportTier[] = ['easy', 'medium', 'hard'];

/** STRICT lookup — the manifest enum-constrains config.difficulty to these.
 *  Unknown/absent → null (no tier applied; grade-band defaults stand). */
function normalizeSupportTier(difficulty?: string): SupportTier | null {
  const d = difficulty?.toLowerCase().trim() ?? '';
  return (SUPPORT_TIERS as readonly string[]).includes(d) ? (d as SupportTier) : null;
}

// ---------------------------------------------------------------------------
// Grade band — the K band is a pre-reader band, and that changes the SCAFFOLD
// ---------------------------------------------------------------------------

type GradeBand = "K" | "1" | "2";

/** Canonical band from the generation context's grade string. Hoisted out of the
 *  tail of the generator (where it only labelled the payload) because the support
 *  tier now needs it: at K the easy scaffold cannot be "read the time on each card". */
function resolveGradeBand(gradeLevel: string): GradeBand {
  const gl = gradeLevel.toLowerCase();
  if (gl.includes("kinder") || gl.includes("k")) return "K";
  if (gl.includes("2")) return "2";
  return "1";
}

/**
 * Position through the day (0 = midnight, 1 = the next midnight) derived in CODE
 * from the typicalTime the model already supplies for every event.
 *
 * This is the K band's replacement for the elapsed-time anchor. A pre-reader cannot
 * read "8:30 AM"; they can see where the sun sits. The component draws a sun/moon on
 * a dawn-to-night strip at this fraction, so the cue is MONOTONIC in time — two events
 * an hour apart still read as "this one is earlier", which a four-bucket sky emoji
 * could not do (three events in one morning would all show the same sunrise).
 *
 * Returns undefined for an unparseable time; the component then draws no strip.
 */
function dayFractionFor(typicalTime?: string): number | undefined {
  if (!typicalTime) return undefined;
  const m = /^\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\s*$/i.exec(typicalTime);
  if (!m) return undefined;
  let hour = Number(m[1]);
  const minute = m[2] ? Number(m[2]) : 0;
  const meridiem = m[3]?.toLowerCase();
  if (hour > 23 || minute > 59) return undefined;
  if (meridiem === "pm" && hour < 12) hour += 12;
  if (meridiem === "am" && hour === 12) hour = 0;
  return Math.round(((hour * 60 + minute) / 1440) * 1000) / 1000;
}

/**
 * The whole hour a `typicalTime` names, as a 0-11 dial position — or undefined
 * when the time is not on the hour, is unparseable, or is missing.
 *
 * `dayFractionFor` already parses the same string, but it maps to a 24-hour
 * fraction and quietly accepts "7:30". This one REFUSES anything that is not a
 * whole hour, because a clock face drawn from 7:30 would need a minute hand the
 * child has not been taught to read and the mode's claim (whole-hour times) would
 * be false.
 */
function wholeHourDialFor(typicalTime?: string): number | undefined {
  if (!typicalTime) return undefined;
  const m = /^\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\s*$/i.exec(typicalTime);
  if (!m) return undefined;
  const hour = Number(m[1]);
  const minute = m[2] ? Number(m[2]) : 0;
  if (minute !== 0 || hour > 23) return undefined;
  return hour % 12;
}

/** Which half of the day a `typicalTime` falls in — 'am' or 'pm'. A 12-hour
 *  face shows 8:00 AM and 8:00 PM identically, so a challenge that mixes them
 *  has two cards the child cannot tell apart. */
function meridiemFor(typicalTime?: string): 'am' | 'pm' | undefined {
  const fraction = dayFractionFor(typicalTime);
  if (fraction === undefined) return undefined;
  return fraction < 0.5 ? 'am' : 'pm';
}

/**
 * Support scaffold for time-sequencer. Withdraws scaffolding intrinsic to the
 * ordering/time-reasoning task — it NEVER changes which events appear, their
 * labels, their times, or the correct answer.
 *
 * Levers (discovered from TimeSequencer.tsx):
 *  - showTimeAnchors (#1 perception): the EventCardVisual already renders an
 *    optional `typicalTime` per event (`showTime` prop). At easy these elapsed-time
 *    anchors are shown so the student sequences by reading the clock; at hard they
 *    are withdrawn and the student sequences from event reasoning alone.
 *  - prelabelFirstSlot (#1, answer-leak-guarded): seed ONLY the first event of the
 *    ordered sequence as a "start here" anchor — NEVER the full order. The remaining
 *    slots stay blank. The checker reads `correctOrder` independent of this flag.
 *  - nameStrategy (#2 instruction-as-scaffold): at easy the instruction names the
 *    ordering/time-reasoning strategy ("read the time on each card and go earliest →
 *    latest"); at hard the instruction is bare and the student supplies the strategy.
 */
interface SupportScaffold {
  /** sequence-events / before-after / match-time-of-day: show per-event typicalTime anchors. */
  showTimeAnchors?: boolean;
  /** K ONLY: show the code-derived sun-position strip instead of the printed clock time. */
  showSkyCue?: boolean;
  /** sequence-events: pre-seed ONLY the first ordered slot as a start-here anchor (never the full order). */
  prelabelFirstSlot?: boolean;
  /** all modes: instruction names the ordering / time-reasoning strategy. */
  nameStrategy?: boolean;
  promptLines: string[];
}

const SCAFFOLD_LEAD =
  'This tier changes only how much on-screen / instructional help the student gets. '
  + 'It NEVER changes which events appear, their labels, their times, or the correct order/answer.';

/** Strategy phrasing injected into the instruction at easy/medium when nameStrategy is on.
 *  `withAnchors` (easy) can reference the on-screen clock times; otherwise the strategy
 *  leans on routine reasoning so it never names a cue the tier has withdrawn. */
function strategyFor(chType: string, withAnchors: boolean, withSky: boolean): string {
  switch (chType) {
    case 'sequence-events':
      if (withSky) return 'Look at the sky on each card. The sun comes up first, then it climbs, then it goes down, then it is dark.';
      return withAnchors
        ? 'Read the time on each card and put them in order from earliest to latest.'
        : 'Walk through your day in order — what do you do first, next, and last?';
    case 'match-time-of-day':
      return 'Picture when you usually do this — is it light or dark outside, before or after meals?';
    case 'before-after':
      if (withSky) return 'Look at the sky on the card, then walk through your day to find the one right next to it.';
      return 'Walk through your routine in order, then find the event that comes right before or after.';
    case 'duration-compare':
      return 'Picture doing each activity and count how long it takes — one is much quicker.';
    case 'read-schedule':
      return 'Find the time in the left column, then read across to the activity.';
    default:
      return '';
  }
}

function resolveSupportStructure(pinnedType: string, tier: SupportTier, band: GradeBand): SupportScaffold {
  // THE EASY TIER'S SCAFFOLD IS BAND-DEPENDENT. Withdrawing help is the same at every
  // band; WHICH help is offered is not. The clock-time anchor is a reading task, so at
  // Kindergarten the easy tier shows a sun-position picture instead (K MATH
  // PTRN001-03-C asked a pre-reader to "read the time on each card" in 10/10 items —
  // qa/reader-fit/time-sequencer-PRE-2026-09-08.md).
  const isPreReader = band === 'K';
  const showTimeAnchors = !isPreReader && tier === 'easy';  // medium + hard withdraw the clock anchors
  const showSkyCue = isPreReader && tier === 'easy';        // the K band's perception scaffold
  const prelabelFirstSlot = tier !== 'hard';               // easy + medium seed only the first slot
  const nameStrategy = tier !== 'hard';                    // hard gives the bare instruction

  const lines: string[] = [SCAFFOLD_LEAD];

  if (pinnedType === 'clock-sequence') {
    lines.push(
      `The clock FACE on each card is STRUCTURAL and stays on at every tier — it is the task, not a scaffold.`,
      `Give every event a WHOLE-HOUR typicalTime ("7:00 AM"), all within the same half of the day, and no two the same.`,
      `The first event is ${prelabelFirstSlot ? 'pre-seeded as a "start here" anchor; the remaining slots stay blank' : 'NOT pre-seeded — the student places every event including the first'}.`,
      `The instruction ${nameStrategy ? 'names the ordering strategy ("look at the little hand on each clock, earliest first")' : 'is bare — it does NOT name a strategy; the student decides how to order the events'}.`,
    );
  } else if (pinnedType === 'sequence-events') {
    lines.push(
      isPreReader
        ? `The perception anchor is a SUN-POSITION PICTURE the system draws on each card, ${showSkyCue ? 'SHOWN so the student can order by where the sun sits' : 'WITHDRAWN — the student sequences from event reasoning alone'}. The clock time is NEVER printed at this band.`
        : `Elapsed-time anchors (a typical clock time on each event card) are ${showTimeAnchors ? 'SHOWN so the student can order by reading the time' : 'WITHDRAWN — the student sequences from event reasoning alone'}.`,
      `Provide a realistic typicalTime for every event regardless (e.g. "7:00 AM") — the system decides whether to display it${isPreReader ? ', and at this band it draws the sun position from that time instead of printing the digits' : ''}. Keep times consistent with the correct order.`,
      `The first event is ${prelabelFirstSlot ? 'pre-seeded as a "start here" anchor; the remaining slots stay blank for the student' : 'NOT pre-seeded — the student places every event including the first'}.`,
      `The instruction ${nameStrategy ? (isPreReader ? 'names the ordering strategy in PICTURES ("look at the sky on each card") and never mentions a time, a clock or a number' : 'names the ordering strategy ("read the time on each card, earliest → latest")') : 'is bare — it does NOT name a strategy; the student decides how to order the events'}.`,
    );
  } else if (pinnedType === 'before-after') {
    lines.push(
      isPreReader
        ? `The perception anchor on the REFERENCE card only (never on the options) is a SUN-POSITION PICTURE the system draws, ${showSkyCue ? 'SHOWN to anchor the reasoning' : 'WITHDRAWN — the student reasons from the activity alone'}. The clock time is NEVER printed at this band.`
        : `Elapsed-time anchors (a typical clock time on the REFERENCE event card only — never on the options) are ${showTimeAnchors ? 'SHOWN to anchor the reasoning' : 'WITHDRAWN — the student reasons from the activity alone'}.`,
      `Provide a realistic referenceTime regardless — the system decides whether to display it.`,
      `The instruction ${nameStrategy ? (isPreReader ? 'names the reasoning strategy in PICTURES and never mentions a time or a clock' : 'names the time-reasoning strategy') : 'is bare — it does NOT name a strategy'}.`,
    );
  } else if (pinnedType === 'match-time-of-day') {
    // NO time anchor: the clock time trivially reveals the period (the answer).
    lines.push(
      `The instruction ${nameStrategy ? 'names the time-reasoning strategy (picture when you do this — light/dark, before/after meals)' : 'is bare — it does NOT name a strategy'}.`,
      'Do NOT reveal the clock time on screen — the time would give away the period, which IS the answer.',
    );
  } else {
    // duration-compare / read-schedule — no time-anchor lever; instruction-as-scaffold only.
    lines.push(
      `The instruction ${nameStrategy ? 'names the reasoning strategy' : 'is bare — it does NOT name a strategy; the student decides how to reason'}.`,
      'Structural labels (schedule rows, the two activities) stay ON at every tier — they are the task, not a scaffold.',
    );
  }

  lines.push('Keep the title and description neutral — never state the support level or reveal the correct order/answer.');

  return { showTimeAnchors, showSkyCue, prelabelFirstSlot, nameStrategy, promptLines: lines };
}

// ---------------------------------------------------------------------------
// Kindergarten band guard: nothing in the child's copy asks them to read a time
// ---------------------------------------------------------------------------

/**
 * Phrases that hand a pre-reader a reading task: being told to READ or CHECK a time,
 * any mention of a clock, and any printed clock time. Plain "time" is deliberately NOT
 * matched: "Which one takes more time?" IS the duration task, not a reading demand.
 */
const CLOCK_LANGUAGE_PATTERNS: readonly RegExp[] = [
  /\bo['’]?clock\b/i,
  /\bclocks?\b/i,
  /\d{1,2}\s*:\s*\d{2}/,
  /\b\d{1,2}\s*(?:a\.?m\.?|p\.?m\.?)\b/i,
  /\b(?:read|reading|check|checking|look at|see|compare|comparing|use|using)\b[^.!?]{0,32}\btimes?\b/i,
  /\btimes?\b[^.!?]{0,24}\bon\s+(?:each|the|these|those)\b/i,
];

function mentionsClockReading(text: string | undefined): boolean {
  if (!text) return false;
  return CLOCK_LANGUAGE_PATTERNS.some((re) => re.test(text));
}

/** Copy that sends the child to the sun-position strip. Only meaningful while the strip
 *  is actually on screen — see the withdrawal branch below. */
function mentionsSkyCue(text: string | undefined): boolean {
  return !!text && /\b(?:sky|sun|sunrise|sunset|moon)\b/i.test(text);
}

/** Band-safe replacement copy, owned by code so a repair can never re-introduce the
 *  demand it removes. Deliberately generic: the model's EVENTS carry the topic, and a
 *  repaired line only has to state the task a pre-reader can already see. */
const PRE_READER_COPY: Record<string, { instruction: string; hint: string }> = {
  'sequence-events': {
    instruction: 'Put the cards in order. Which one happens first?',
    hint: 'Look at the sky on each card. The sun comes up first, and the dark night is last.',
  },
  'clock-sequence': {
    // The ONE pre-reader copy in this file that may name a clock, because the
    // clock is what the objective asks the child to connect (TIME001-03-G,
    // skill "Telling Time to the Hour"). What stays banned is a printed time.
    instruction: 'Put the cards in order, from earliest to latest.',
    hint: 'Look at the little hand on each clock. The one nearest the top of the morning comes first.',
  },
  'match-time-of-day': {
    instruction: 'When does this happen?',
    hint: 'Picture yourself doing it. Is it light outside, or is it dark?',
  },
  'before-after': {
    instruction: 'What happens right next to this one in your day?',
    hint: 'Walk through your day and find the one that goes right beside it.',
  },
  'duration-compare': {
    instruction: 'Which one takes longer?',
    hint: 'Picture doing each one. Which one is over quickly?',
  },
};

const PRE_READER_DESCRIPTION = 'Put the picture cards in order, from the start of the day to the end.';

/**
 * Repair a Kindergarten challenge whose copy asks the child to read a time.
 * The prompt already forbids it (PRE_READER_PROMPT_SECTION below); this is the backstop,
 * in the shape slice 1 established on number-sequencer: replace the offending FIELD,
 * keep the generated events, and say so in the log.
 *
 * Returns the field names it rewrote, so the caller can report how often it fired.
 */
function repairPreReaderCopy(ch: TimeSequencerChallenge): string[] {
  const fallback = PRE_READER_COPY[ch.type] ?? PRE_READER_COPY['sequence-events'];
  const rewritten: string[] = [];
  // `clock-sequence` is the one type whose copy MAY name a clock or a hand: the
  // K objective it serves is "connect whole-hour times to daily activities in
  // sequence" under the skill "Telling Time to the Hour", so a cap that forbids
  // mentioning the clock would be a cap below what the lesson asks. What stays
  // banned even here is a PRINTED clock time — those digits are the reading
  // demand, and the face is not.
  if (ch.type === 'clock-sequence') {
    if (/\d{1,2}\s*:\s*\d{2}/.test(ch.instruction ?? '')) {
      ch.instruction = fallback.instruction;
      rewritten.push('instruction');
    }
    if (/\d{1,2}\s*:\s*\d{2}/.test(ch.hint ?? '')) {
      ch.hint = fallback.hint;
      rewritten.push('hint');
    }
    return rewritten;
  }
  if (mentionsClockReading(ch.instruction)) {
    ch.instruction = ch.type === 'before-after' && ch.relation
      ? `What happens right ${ch.relation.toUpperCase()} this one?`
      : fallback.instruction;
    rewritten.push('instruction');
  }
  if (mentionsClockReading(ch.hint)) {
    ch.hint = fallback.hint;
    rewritten.push('hint');
  }
  return rewritten;
}

/** Prompt block for the pre-reader band. Reaches all five sub-prompts through the same
 *  folded-string route the tier section uses, so no sub-generator signature changes. */
const PRE_READER_PROMPT_SECTION =
  `\n## KINDERGARTEN BAND (THE STUDENT CANNOT READ)\n`
  + `- NEVER tell the student to read, check or compare a time or a clock, and never put a clock time `
  + `("8:30 AM", "7 o'clock") in an instruction, hint, title or description. Those are reading tasks.\n`
  + `- The order comes from the PICTURES and from the child's own routine. Write instructions like `
  + `"Put the cards in order. Which one happens first?" and hints like "Which one happens when you wake up?".\n`
  + `- Keep every event label to 2-4 short words; the emoji carries the meaning.\n`
  + `- Still provide a typicalTime for every event: the system draws a sun-position picture from it and never `
  + `shows the digits to this student.\n`;

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

const SEQUENCE_EVENT_SLOT_FIELDS = (slot: number) => [
  `event${slot}Id`, `event${slot}Label`, `event${slot}Emoji`, `event${slot}Time`,
];

/**
 * Two things the prompt asked for and only the schema could get.
 *
 * `sequence-5` kept returning three cards: the prompt asked for four or five, the schema
 * required only slots 0-2 and described 3 and 4 as "use empty string if fewer", and
 * flash-lite filled what was required and stopped.
 *
 * And every slot's TIME is now required too. It was optional, so draws came back with
 * labels but no times — which at Kindergarten is not a cosmetic gap: the sun-position
 * cue is derived from that time, so a missing one silently costs the child the whole
 * easy-tier scaffold (4 of 5 challenges in the 2026-09-08 sequence-5 draw).
 */
function buildSequenceEventsSchema(minEvents: number): Schema {
  const base = sequenceEventsSchema;
  const items = base.properties!.challenges.items as Schema;
  const slots = Math.min(Math.max(minEvents, 3), 5);
  const required: string[] = [...(items.required ?? [])];
  for (let slot = 0; slot < slots; slot++) {
    for (const field of SEQUENCE_EVENT_SLOT_FIELDS(slot)) {
      if (!required.includes(field)) required.push(field);
    }
  }
  // Requiring the field is not enough on its own: slots 3 and 4 are DESCRIBED as
  // "use empty string if fewer than N events", and the post-process drops an event
  // with a blank id — so the model obeyed the description, emitted "", and a
  // sequence-5 draw still came back with three cards. Withdraw the escape from any
  // slot this mode actually needs.
  const properties = { ...(items.properties ?? {}) } as Record<string, Schema>;
  for (let slot = 3; slot < slots; slot++) {
    for (const field of SEQUENCE_EVENT_SLOT_FIELDS(slot)) {
      const prop = properties[field];
      if (!prop) continue;
      properties[field] = {
        ...prop,
        nullable: false,
        description: `${(prop.description ?? '').replace(/\s*\(use empty string[^)]*\)/i, '')} REQUIRED for this activity — never blank.`.trim(),
      };
    }
  }
  return {
    ...base,
    properties: {
      ...base.properties,
      challenges: {
        ...base.properties!.challenges,
        items: { ...items, properties, required },
      },
    },
  } as Schema;
}

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
          event0Time: { type: Type.STRING, description: "1st event typical clock time (e.g. '7:00 AM') — must agree with the correct order" },
          event1Id: { type: Type.STRING, description: "2nd event ID" },
          event1Label: { type: Type.STRING, description: "2nd event label" },
          event1Emoji: { type: Type.STRING, description: "2nd event emoji" },
          event1Time: { type: Type.STRING, description: "2nd event typical clock time" },
          event2Id: { type: Type.STRING, description: "3rd event ID" },
          event2Label: { type: Type.STRING, description: "3rd event label" },
          event2Emoji: { type: Type.STRING, description: "3rd event emoji" },
          event2Time: { type: Type.STRING, description: "3rd event typical clock time" },
          event3Id: { type: Type.STRING, description: "4th event ID (use empty string if fewer than 4 events)", nullable: true },
          event3Label: { type: Type.STRING, description: "4th event label", nullable: true },
          event3Emoji: { type: Type.STRING, description: "4th event emoji", nullable: true },
          event3Time: { type: Type.STRING, description: "4th event typical clock time", nullable: true },
          event4Id: { type: Type.STRING, description: "5th event ID (use empty string if fewer than 5 events)", nullable: true },
          event4Label: { type: Type.STRING, description: "5th event label", nullable: true },
          event4Emoji: { type: Type.STRING, description: "5th event emoji", nullable: true },
          event4Time: { type: Type.STRING, description: "5th event typical clock time", nullable: true },
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
          eventTime: { type: Type.STRING, description: "Typical clock time for the activity (e.g. '8:00 AM')" },
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
          referenceTime: { type: Type.STRING, description: "Typical clock time for the reference event (e.g. '12:00 PM')" },
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
  tierSection: string,
  opts?: SubGeneratorOptions,
): Promise<SubResult> {
  const minEvents = Math.min(5, Math.max(3, opts?.minEvents ?? 3));
  // `clock-sequence` is the SAME ask with one extra constraint on the times, so
  // it shares this prompt and this schema rather than forking a near-duplicate.
  // The type it emits is the only structural difference on the wire.
  const emitType = opts?.emitType ?? "sequence-events";
  const isClock = emitType === "clock-sequence";
  const theme = randomTheme();
  const prompt = `
Create ${count} "${emitType}" challenges for teaching "${topic}" to ${gradeLevel} students.
Theme: ${theme}.

Each challenge: give 3-5 daily routine events. Student must tap them in chronological order.
- Use event IDs like "e1", "e2", etc.
- correctOrderCsv: comma-separated event IDs in the correct chronological order.
- All event IDs must be unique within each challenge.
- correctOrderCsv MUST contain exactly the same IDs as the events listed.
- Provide a realistic typicalTime (e.g. "7:00 AM") for EVERY event; the times must agree with the correct chronological order.
- Vary the scenarios — don't repeat the same events across challenges.
${isClock ? `
CLOCK RULES — the activity draws an analog clock face from each time, and DROPS any challenge that breaks these:
- Every typicalTime must be a WHOLE HOUR: "7:00 AM", "11:00 AM", "3:00 PM". Never ":30", never ":15".
- No two events in a challenge may share the same hour.
- Every event in ONE challenge must be in the same half of the day — all AM, or all PM. A clock face
  cannot tell 8 in the morning from 8 at night, so a challenge that mixes them has cards the child
  cannot tell apart. Pick a morning routine OR an afternoon/evening routine, not a whole day.
- Choose activities whose hour is genuinely typical, so the face and the routine agree.
` : ""}
${tierSection}
${SHARED_CONTEXT}
`;

  const result = await ai.models.generateContent({
    model: "gemini-flash-lite-latest",
    contents: prompt,
    config: { responseMimeType: "application/json", responseSchema: buildSequenceEventsSchema(minEvents) },
  });

  const data = result.text ? JSON.parse(result.text) : null;
  if (!data?.challenges?.length) return { title: "", description: "", challenges: [] };

  // Post-process: flat → structured
  const challenges: TimeSequencerChallenge[] = data.challenges.map((flat: Record<string, unknown>, i: number) => {
    const events: { id: string; label: string; emoji: string; typicalTime?: string }[] = [];
    for (let j = 0; j < 5; j++) {
      const id = flat[`event${j}Id`];
      const label = flat[`event${j}Label`];
      const emoji = flat[`event${j}Emoji`];
      const time = flat[`event${j}Time`];
      if (typeof id === "string" && id && typeof label === "string" && typeof emoji === "string") {
        events.push({ id, label, emoji, typicalTime: typeof time === "string" && time ? time : undefined });
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
      type: emitType as TimeSequencerChallenge["type"],
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
  tierSection: string,
): Promise<SubResult> {
  const theme = randomTheme();
  const prompt = `
Create ${count} "match-time-of-day" challenges for teaching "${topic}" to ${gradeLevel} students.
Theme: ${theme}.

Each challenge: show ONE activity. Student picks whether it happens in morning, afternoon, evening, or night.
- correctPeriod must be exactly one of: 'morning', 'afternoon', 'evening', 'night'.
- For K: only use morning, afternoon, night (no evening).
- Provide a realistic eventTime (e.g. "8:00 AM") that agrees with the correct period.
- Use a variety of daily activities (eating, sleeping, school, play, etc.).
${tierSection}
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
        typicalTime: typeof flat.eventTime === "string" && flat.eventTime ? flat.eventTime : undefined,
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
  tierSection: string,
): Promise<SubResult> {
  const theme = randomTheme();
  const prompt = `
Create ${count} "before-after" challenges for teaching "${topic}" to ${gradeLevel} students.
Theme: ${theme}.

Each challenge: show a reference event. Ask "What happens BEFORE/AFTER [event]?"
Provide 3 options. correctOptionIndex is the 0-based index of the correct answer.
- relation must be 'before' or 'after'.
- correctOptionIndex must be 0, 1, or 2.
- Provide a realistic referenceTime (e.g. "12:00 PM") for the reference event.
- Use varied daily activities that have clear temporal relationships.
${tierSection}
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
        typicalTime: typeof flat.referenceTime === "string" && flat.referenceTime ? flat.referenceTime : undefined,
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
  tierSection: string,
): Promise<SubResult> {
  const theme = randomTheme();
  const prompt = `
Create ${count} "duration-compare" challenges for teaching "${topic}" to ${gradeLevel} students.
Theme: ${theme}.

Each challenge: show two activities. Student picks which takes longer.
- correctAnswer must be exactly 'A', 'B', or 'same'.
- Choose activities with clearly different durations (e.g. brushing teeth vs going to school).
- Include 1 'same' answer if ${count} >= 3.
${tierSection}
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
  tierSection: string,
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
${tierSection}
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

/** Scope a sub-generator needs as VALUES rather than prose. Only sequence-events uses
 *  it today; the map type carries it so a second consumer needs no signature churn. */
interface SubGeneratorOptions {
  /** Fewest event cards per challenge, from the eval mode's window. */
  minEvents?: number;
  /** The challenge type to stamp on the result. `clock-sequence` reuses the
   *  sequence-events prompt and schema and differs only in its time rules. */
  emitType?: string;
}

type SubGenerator = (
  topic: string,
  gradeLevel: string,
  count: number,
  tierSection: string,
  opts?: SubGeneratorOptions,
) => Promise<SubResult>;

const GENERATOR_MAP: Record<string, SubGenerator> = {
  "sequence-events": generateSequenceEvents,
  "clock-sequence": generateSequenceEvents,
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
  "clock-sequence": {
    id: "c1",
    type: "clock-sequence",
    instruction: "Put the cards in order, from earliest to latest.",
    hint: "Look at the little hand on each clock. The one nearest the top of the morning comes first.",
    events: [
      { id: "e1", label: "Wake up", emoji: "🌅", typicalTime: "7:00 AM", clockHour: 7 },
      { id: "e2", label: "Eat breakfast", emoji: "🍳", typicalTime: "8:00 AM", clockHour: 8 },
      { id: "e3", label: "Go to school", emoji: "🎒", typicalTime: "9:00 AM", clockHour: 9 },
    ],
    correctOrder: ["e1", "e2", "e3"],
    showClockFace: true,
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

type TimeSequencerConfig = Partial<{
    targetEvalMode?: string;
    /**
     * Per-component support tier from the manifest ('easy' | 'medium' | 'hard').
     * Second axis of the two-field contract: targetEvalMode = which skill,
     * difficulty = how much on-screen / instructional scaffolding within it.
     * NEVER changes the events, labels, times, or the correct answer.
     */
    difficulty?: string;
  }>;

export const generateTimeSequencer = async (
  ctx: GenerationContext,
): Promise<TimeSequencerData> => {
  const { topic } = ctx;
  const gradeLevel = ctx.gradeContext;
  // Per-component objective (≠ broad topic). The LLM authors the events + times here
  // (post-process is only flat→structured), so feeding intent into the prompt is a
  // genuine Tier-1 scope lever — it moves which events/times the LLM picks. Folded into
  // the tierSection string so it reaches all five sub-prompts with no signature change.
  const intent = ctx.intent || topic;
  const intentSection = ctx.intent
    ? `\nTHIS ACTIVITY'S SPECIFIC FOCUS: ${intent}\n`
      + `- Choose the events and times to target that focus (e.g. "telling time to the half hour" `
      + `→ use times on the hour/half hour; "morning routine" → morning events). Keep times `
      + `grade-appropriate. Do NOT reveal the correct chronological order in any label.\n`
    : "";
  const config = ctx.raw as TimeSequencerConfig;
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

  // ── Within-mode support tier (config.difficulty): scaffolding level, NOT events/times.
  //    `supportTier` is the STUDENT's tier and DRIVES the deterministic application
  //    at the end (single OR blended session). `pinnedType` is only for prompt tone. ──
  const supportTier = normalizeSupportTier(config?.difficulty);
  const pinnedType =
    evalConstraint && evalConstraint.allowedTypes.length === 1
      ? evalConstraint.allowedTypes[0]
      : undefined;

  // ── Grade band, resolved BEFORE the prompts are built. ──
  // It used to be read at the tail, purely to label the payload, which is why
  // resolveSupportStructure had no band to consult and offered a pre-reader
  // "read the time on each card" as its easy-tier help.
  const gradeBand = resolveGradeBand(gradeLevel);
  const isPreReader = gradeBand === "K";

  // ── How many cards a sequencing challenge asks for. ──
  // The EVAL MODE declares it, not the band: `sequence-5` is four or five cards at
  // every grade it is routed to. The band rule this replaces capped K at three, so a
  // K lesson pinned to sequence-5 (K MATH PTRN001-03-F asks for 4-5 picture cards)
  // silently got three.
  const targetEvalMode = evalConstraint?.definition.evalMode;
  const eventWindow = targetEvalMode === "sequence-5"
    ? { min: 4, max: 5 }
    : targetEvalMode === "sequence-3"
      ? { min: 3, max: 3 }
      // clock-sequence caps at four cards: every card must be a DISTINCT whole
      // hour inside one half-day, and five of those pushes the model into
      // implausible routine times (a "wake up" at 4 to make the set fit).
      : targetEvalMode === "clock-sequence"
        ? { min: 3, max: 4 }
        : { min: 3, max: isPreReader ? 3 : 5 };

  /** Everything that scopes a sub-prompt beyond the topic: the support tier, the
   *  card window (sequencing only) and the pre-reader band block. Folded into the
   *  one string each sub-generator already takes, so no signature changes. */
  const buildScopeSection = (chType: string): string => {
    let out = "";
    if (supportTier) {
      const sc = resolveSupportStructure(chType, supportTier, gradeBand);
      out += (
        `\n## WITHIN-MODE SUPPORT TIER (scaffolding level — NOT events/times)\n`
        + sc.promptLines.map((l) => `- ${l}`).join("\n")
        + "\n"
      );
    }
    if (chType === "sequence-events" || chType === "clock-sequence") {
      out += eventWindow.min === eventWindow.max
        ? `\n- Give EXACTLY ${eventWindow.min} events in every challenge.\n`
        : `\n- Give ${eventWindow.min}-${eventWindow.max} events in every challenge.\n`;
    }
    if (isPreReader) out += PRE_READER_PROMPT_SECTION;
    return out;
  };

  // ── Determine challenge count per type ──
  // Target ~5 total challenges
  const totalTarget = 5;
  const challengesPerType = Math.max(1, Math.ceil(totalTarget / allowedTypes.length));

  // ── Dispatch sub-generators in parallel ──
  const results = await Promise.all(
    allowedTypes
      .filter((t) => GENERATOR_MAP[t])
      .map((t) => GENERATOR_MAP[t](
        topic,
        gradeLevel,
        challengesPerType,
        buildScopeSection(t) + intentSection,
        t === "sequence-events" || t === "clock-sequence"
          ? { minEvents: eventWindow.min, emitType: t }
          : undefined,
      )),
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

  // ── clock-sequence: the FACE is code-owned, and an unaskable card is dropped ──
  // The mode's claim is "whole-hour times", and the child reads it off a dial.
  // Three things make a challenge unaskable and none of them can be repaired
  // without inventing times the model did not choose:
  //   - a time that is not on the hour (7:30 needs a minute hand this band has
  //     not been taught, and the objective says whole hours),
  //   - two cards on the same hour (identical faces, so the pair is unorderable
  //     by the cue the mode is teaching),
  //   - a set that crosses noon (a 12-hour face shows 8 AM and 8 PM the same).
  // Dropped, not repaired: a card whose face disagrees with its place in the
  // order teaches the child that the hand does not mean anything.
  {
    const clockChallenges = allChallenges.filter((ch) => ch.type === "clock-sequence");
    if (clockChallenges.length > 0) {
      const kept: TimeSequencerChallenge[] = [];
      const dropReasons: string[] = [];
      for (const ch of allChallenges) {
        if (ch.type !== "clock-sequence") { kept.push(ch); continue; }
        const events = ch.events ?? [];
        const hours = events.map((ev) => wholeHourDialFor(ev.typicalTime));
        const halves = events.map((ev) => meridiemFor(ev.typicalTime));
        if (events.length < 3 || hours.some((h) => h === undefined)) {
          dropReasons.push(`${ch.id}(not every time is a whole hour)`);
          continue;
        }
        if (new Set(hours).size !== hours.length) {
          dropReasons.push(`${ch.id}(two cards share an hour)`);
          continue;
        }
        if (new Set(halves).size !== 1) {
          dropReasons.push(`${ch.id}(the set crosses noon — a 12-hour face cannot separate it)`);
          continue;
        }
        // THE FACE IS NOT ALLOWED TO LIE. Here the clock is not a scaffold that
        // can be withdrawn — it is the only cue the child has — so a set whose
        // hours do not rise along `correctOrder` cannot be shown at all. Slice 5
        // withdrew the sun strip in this case; there is nothing to withdraw to.
        const hourById = new Map(events.map((ev, j) => [ev.id, hours[j] as number]));
        const ordered = (ch.correctOrder ?? []).map((id) => hourById.get(id));
        const agrees = ordered.length === events.length
          && ordered.every((h) => typeof h === "number")
          && ordered.every((h, j) => j === 0 || (h as number) > (ordered[j - 1] as number));
        if (!agrees) {
          dropReasons.push(`${ch.id}(the clock hours disagree with correctOrder)`);
          continue;
        }
        events.forEach((ev, j) => { ev.clockHour = hours[j]; });
        // The face is structural, so it is set here rather than by the support
        // tier — no tier withdraws it.
        ch.showClockFace = true;
        kept.push(ch);
      }
      allChallenges = kept;
      console.log(
        `[TimeSequencer] clock-sequence: ${kept.filter((c) => c.type === "clock-sequence").length}`
        + `/${clockChallenges.length} challenge(s) kept`
        + (dropReasons.length > 0 ? `; dropped ${dropReasons.join(", ")}` : ""),
      );
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

  // ── Fallback title/description ──
  if (!title) title = "Time & Sequencing";
  if (!description) description = "Learn about the order of daily events and time concepts!";

  // ── Within-mode support tier: withdraw on-screen / instructional scaffolding
  //    (never the events, times, or the answer). Applied PER CHALLENGE from each
  //    challenge's OWN type, so a blended (auto-mode) session gets difficulty too —
  //    the tier is a student property, not a single-mode one. Runs at the END,
  //    after the fallback + trim, so a tier can only REMOVE help.
  //
  //    ANSWER-LEAK GUARD: prelabelFirstSlot seeds ONLY the first ordered event as a
  //    "start here" anchor — never the full order. The component's checker reads
  //    `correctOrder` independent of show* flags, so a withdrawn anchor cannot leak
  //    or invalidate the answer. Structural labels (schedule rows) stay ON. ──
  if (supportTier) {
    for (const ch of allChallenges) {
      const sc = resolveSupportStructure(ch.type, supportTier, gradeBand);
      // #1 perception: elapsed-time anchors. EXCLUDES match-time-of-day — there the
      // clock time would reveal the period, which is the answer (answer-leak guard).
      // At K the anchor is a PICTURE: showTimeAnchors stays false at every tier and
      // showSkyCue carries the easy tier instead, so the help a pre-reader is offered
      // is one they can actually use.
      if (ch.type === "sequence-events" || ch.type === "before-after") {
        ch.showTimeAnchors = sc.showTimeAnchors ?? false;
        ch.showSkyCue = sc.showSkyCue ?? false;
      }
      // clock-sequence takes NEITHER anchor: the printed time is the reading
      // task the face replaces, and a sun strip beside a clock face would let
      // the child order by the sun and never look at the hand.
      if (ch.type === "clock-sequence") {
        ch.showTimeAnchors = false;
        ch.showSkyCue = false;
      }
      // #1 answer-leak-guarded: pre-seed only the FIRST ordered slot for sequencing.
      if (ch.type === "sequence-events" || ch.type === "clock-sequence") {
        ch.prelabelFirstSlot = sc.prelabelFirstSlot ?? false;
      }
      // #2 instruction-as-scaffold: name the strategy at easy/medium; withhold at hard.
      // The strategy text only references a cue the tier actually shows.
      ch.showStrategyHint = sc.nameStrategy ?? false;
      ch.strategyHint = sc.nameStrategy
        ? strategyFor(ch.type, sc.showTimeAnchors ?? false, sc.showSkyCue ?? false)
        : undefined;
    }
    console.log(
      `[TimeSequencer] Support tier "${supportTier}" applied per-challenge across ${allChallenges.length} challenge(s) [${pinnedType ? `single-mode ${pinnedType}` : "blended"}] at band ${gradeBand}.`,
    );
  }

  // ── Kindergarten band: sun position instead of a printed time, and no copy that
  //    asks the child to read one. The cue is derived from the SAME typicalTime the
  //    tier would have printed, so the perceptual information survives the swap. ──
  if (isPreReader) {
    let cued = 0;
    let withdrawn = 0;
    const repairs: string[] = [];
    for (const ch of allChallenges) {
      for (const ev of [...(ch.events ?? []), ch.event, ch.referenceEvent, ch.eventA, ch.eventB]) {
        if (!ev) continue;
        const fraction = dayFractionFor(ev.typicalTime);
        if (fraction !== undefined) { ev.dayFraction = fraction; cued += 1; }
      }
      // The sun position is the child's ONLY perception anchor at this band, so it is
      // not allowed to disagree with the answer. If the model's times do not rise along
      // correctOrder — or one card has no usable time — the cue is withdrawn for that
      // challenge and the child sequences from routine reasoning instead. A wrong
      // scaffold teaches the wrong thing; a missing one only teaches less.
      if (ch.type === "sequence-events" && ch.showSkyCue) {
        const byId = new Map((ch.events ?? []).map((e) => [e.id, e]));
        const ordered = (ch.correctOrder ?? []).map((id) => byId.get(id)?.dayFraction);
        const agrees = ordered.length > 1
          && ordered.every((f) => typeof f === "number")
          && ordered.every((f, i) => i === 0 || (f as number) >= (ordered[i - 1] as number));
        if (!agrees) {
          ch.showSkyCue = false;
          ch.strategyHint = ch.showStrategyHint ? strategyFor(ch.type, false, false) : undefined;
          // The copy has to follow the cue off the screen. A withdrawn strip leaves
          // "look at the sun in the picture" pointing at nothing, which is a worse
          // instruction than none — the child hunts for a picture that is not there.
          if (mentionsSkyCue(ch.instruction)) ch.instruction = PRE_READER_COPY['sequence-events'].instruction;
          if (mentionsSkyCue(ch.hint)) ch.hint = 'Walk through your day. Which one do you do first?';
          withdrawn += 1;
        }
      }
      const rewritten = repairPreReaderCopy(ch);
      if (rewritten.length > 0) repairs.push(`${ch.id}(${rewritten.join("+")})`);
    }
    // A clock-sequence session is the one place the session copy may say
    // "clock" at this band, for the same reason the per-challenge copy may:
    // the clock is the objective. Printed DIGITS stay banned either way — that
    // is the reading demand, and the face is not one.
    const clockSessionAtK = allChallenges.every((ch) => ch.type === "clock-sequence");
    const sessionCopyBanned = clockSessionAtK
      ? (text: string | undefined) => !!text && /\d{1,2}\s*:\s*\d{2}/.test(text)
      : mentionsClockReading;
    if (sessionCopyBanned(description)) {
      description = PRE_READER_DESCRIPTION;
      repairs.push("description");
    }
    if (sessionCopyBanned(title)) {
      title = "Time & Sequencing";
      repairs.push("title");
    }
    console.log(
      `[TimeSequencer] Kindergarten band: sun-position cue on ${cued} event card(s)`
      + (withdrawn > 0 ? `; cue WITHDRAWN from ${withdrawn} challenge(s) whose times disagree with correctOrder` : "")
      + (repairs.length > 0
        ? `; rewrote clock-reading copy in ${repairs.length} place(s) [${repairs.join(", ")}]`
        : "; no clock-reading copy to repair"),
    );
  }

  // Final log
  const typeBreakdown = allChallenges.map((c) => c.type).join(", ");
  console.log(
    `[TimeSequencer] Final: ${allChallenges.length} challenge(s) → [${typeBreakdown}]`,
  );

  return {
    title,
    description,
    gradeBand,
    ...(supportTier ? { supportTier } : {}),
    challenges: allChallenges,
  } as TimeSequencerData;
};
