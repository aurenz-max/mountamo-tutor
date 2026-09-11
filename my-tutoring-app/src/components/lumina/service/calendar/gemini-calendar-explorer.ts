import { Type, Schema } from "@google/genai";
import {
  CalendarExplorerData,
  CalendarExplorerChallenge,
} from "../../primitives/visual-primitives/calendar/CalendarExplorer";
import { ai } from "../geminiClient";
import type { GenerationContext, SupportTier } from "../generation/generationContext";
import { buildScopePromptSection } from '../scopeContext';
import {
  resolveEvalModes,
  type ChallengeTypeDoc,
} from "../evalMode";

// ---------------------------------------------------------------------------
// Challenge type documentation registry
// ---------------------------------------------------------------------------

const CHALLENGE_TYPE_DOCS: Record<string, ChallengeTypeDoc> = {
  identify: {
    promptDoc:
      `"identify": Identify a specific date on a calendar. Questions like "What date is the third Wednesday?" `
      + `or "What day of the week is the 15th?" Student selects a date or day name. `
      + `correctAnswer is a day number or day-of-week string. options are string choices.`,
    schemaDescription: "'identify' (find a date or day on the calendar)",
  },
  count: {
    promptDoc:
      `"count": Count occurrences of a day-of-week in a month or count total days. `
      + `Questions like "How many Tuesdays are in March 2026?" or "How many days are in February 2024?" `
      + `correctAnswer is a count as string. options are count strings.`,
    schemaDescription: "'count' (count days of a type in a month)",
  },
  pattern: {
    promptDoc:
      `"pattern": Identify date patterns or relationships across time. `
      + `Questions like "If March 1 is a Saturday, what day is March 8?" or "What is the date 2 weeks after March 5?" `
      + `correctAnswer is a day name or date string. options are string choices.`,
    schemaDescription: "'pattern' (identify date patterns)",
  },
  day_sequence: {
    promptDoc:
      `"day_sequence": Hear one day name and SAY the next day in a continuing spoken chain. `
      + `The screen shows no printed week strip; code computes every successor and the live tutor judges each turn.`,
    schemaDescription: "'day_sequence' (say the next day in order)",
  },
  mark_events: {
    promptDoc:
      `"mark_events": Place a named event marker on its requested calendar date. `
      + `Code owns the month, date, and answer key; the student taps the matching calendar cell.`,
    schemaDescription: "'mark_events' (mark a named event date)",
  },
  day_offset: {
    promptDoc:
      `"day_offset": Count forward 1-7 days from a named weekday and choose the landing day. `
      + `Code owns the cyclic weekday arithmetic and answer key.`,
    schemaDescription: "'day_offset' (count forward from a weekday)",
  },
  interval_count: {
    promptDoc:
      `"interval_count": Count days between two visibly marked dates, with the counting convention stated explicitly. `
      + `Code owns both endpoints and the answer key.`,
    schemaDescription: "'interval_count' (count an interval between marked dates)",
  },
  month_sequence: {
    promptDoc:
      `"month_sequence": Hear one month name and SAY the next month in a continuing spoken chain. `
      + `The screen shows no printed month strip; code computes every successor and the live tutor judges each turn.`,
    schemaDescription: "'month_sequence' (say the next month in order)",
  },
};

// ---------------------------------------------------------------------------
// Calendar math helpers
// ---------------------------------------------------------------------------

export const DAYS_OF_WEEK = [
  "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday",
] as const;

export const DAY_SEQUENCE_TURN_COUNT = 5;
export const MONTH_SEQUENCE_TURN_COUNT = 5;

export const MONTHS_OF_YEAR = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
] as const;

/**
 * Build an answer-key-safe spoken chain. The first stimulus is random in
 * production; tests may inject a start index. Every later stimulus is the
 * previous answer, so the child must hold and continue one genuine sequence.
 */
export function buildDaySequenceChallenges(
  startIndex = Math.floor(Math.random() * DAYS_OF_WEEK.length),
  turnCount = DAY_SEQUENCE_TURN_COUNT,
): CalendarExplorerChallenge[] {
  const safeStart = ((startIndex % DAYS_OF_WEEK.length) + DAYS_OF_WEEK.length) % DAYS_OF_WEEK.length;
  const safeCount = Math.max(DAY_SEQUENCE_TURN_COUNT, Math.floor(turnCount));

  return Array.from({ length: safeCount }, (_, index) => {
    const currentDay = DAYS_OF_WEEK[(safeStart + index) % DAYS_OF_WEEK.length];
    const expectedDay = DAYS_OF_WEEK[(safeStart + index + 1) % DAYS_OF_WEEK.length];
    return {
      id: `day-sequence-${index + 1}`,
      type: "day_sequence",
      question: "Listen to the tutor, then say the day that comes next.",
      month: 1,
      year: 2026,
      correctAnswer: expectedDay,
      options: [],
      hint: "Say the week together from Sunday, then try this day again.",
      narration: `Continue the spoken day chain from ${currentDay}.`,
      currentDay,
      expectedDay,
      chainPosition: index + 1,
    };
  });
}

/** Build a code-owned spoken month chain, including December -> January. */
export function buildMonthSequenceChallenges(
  startIndex = Math.floor(Math.random() * MONTHS_OF_YEAR.length),
  turnCount = MONTH_SEQUENCE_TURN_COUNT,
): CalendarExplorerChallenge[] {
  const safeStart = ((startIndex % MONTHS_OF_YEAR.length) + MONTHS_OF_YEAR.length) % MONTHS_OF_YEAR.length;
  const safeCount = Math.max(MONTH_SEQUENCE_TURN_COUNT, Math.floor(turnCount));

  return Array.from({ length: safeCount }, (_, index) => {
    const currentMonth = MONTHS_OF_YEAR[(safeStart + index) % MONTHS_OF_YEAR.length];
    const expectedMonth = MONTHS_OF_YEAR[(safeStart + index + 1) % MONTHS_OF_YEAR.length];
    return {
      id: `month-sequence-${index + 1}`,
      type: "month_sequence",
      question: "Listen to the tutor, then say the month that comes next.",
      month: 1,
      year: 2026,
      correctAnswer: expectedMonth,
      options: [],
      hint: "Say the months together from January, then try this month again.",
      narration: `Continue the spoken month chain from ${currentMonth}.`,
      currentMonth,
      expectedMonth,
      chainPosition: index + 1,
    };
  });
}

const DAY_OFFSETS = [1, 2, 3, 5, 7] as const;

/** Count forward from changing weekday starts; all cyclic arithmetic is code-owned. */
export function buildDayOffsetChallenges(
  startIndex = Math.floor(Math.random() * DAYS_OF_WEEK.length),
  turnCount = 5,
): CalendarExplorerChallenge[] {
  const safeStart = ((startIndex % DAYS_OF_WEEK.length) + DAYS_OF_WEEK.length) % DAYS_OF_WEEK.length;
  const safeCount = Math.max(1, Math.floor(turnCount));

  return Array.from({ length: safeCount }, (_, index) => {
    const currentIndex = (safeStart + index * 2) % DAYS_OF_WEEK.length;
    const offsetDays = DAY_OFFSETS[index % DAY_OFFSETS.length];
    const startDay = DAYS_OF_WEEK[currentIndex];
    const landingDay = DAYS_OF_WEEK[(currentIndex + offsetDays) % DAYS_OF_WEEK.length];
    return {
      id: `day-offset-${index + 1}`,
      type: "day_offset",
      question: `Start on ${startDay}. Count forward ${offsetDays} ${offsetDays === 1 ? "day" : "days"}. What day do you land on?`,
      month: 1,
      year: 2026,
      correctAnswer: landingDay,
      options: [...DAYS_OF_WEEK],
      hint: `Begin after ${startDay} and count one day for each step.`,
      narration: `Let's count ${offsetDays} ${offsetDays === 1 ? "day" : "days"} forward from ${startDay}.`,
      startDay,
      offsetDays,
    };
  });
}

const EVENT_LABELS = [
  "Library Day", "Field Trip", "Birthday Party", "School Concert", "Family Picnic",
] as const;

/** Build a cumulative event-marking session on one stable monthly calendar. */
export function buildMarkEventChallenges(
  month = randomMonth(),
  year = randomYear(),
  startDate = 4 + Math.floor(Math.random() * 4),
  turnCount = 5,
): CalendarExplorerChallenge[] {
  const daysInMonth = getDaysInMonth(month, year);
  const safeCount = Math.max(1, Math.floor(turnCount));
  const usableSpan = Math.max(1, daysInMonth - 2);
  const dates = Array.from({ length: safeCount }, (_, index) =>
    2 + ((Math.max(2, startDate) - 2 + index * 5) % usableSpan));

  return dates.map((eventDate, index) => ({
    id: `mark-event-${index + 1}`,
    type: "mark_events",
    question: `Mark ${EVENT_LABELS[index % EVENT_LABELS.length]} on ${MONTHS_OF_YEAR[month - 1]} ${eventDate}.`,
    month,
    year,
    correctAnswer: String(eventDate),
    options: [],
    hint: `Find ${eventDate} in the calendar, then place the marker there.`,
    narration: `Put the ${EVENT_LABELS[index % EVENT_LABELS.length]} marker on its date.`,
    highlightDates: [eventDate],
    markedDates: dates.slice(0, index),
    eventLabel: EVENT_LABELS[index % EVENT_LABELS.length],
  }));
}

function buildIntervalOptions(answer: number): string[] {
  const values = new Set<number>([answer]);
  for (const delta of [-2, -1, 1, 2, 3]) {
    if (answer + delta >= 0) values.add(answer + delta);
    if (values.size === 4) break;
  }
  return Array.from(values).sort((a, b) => a - b).slice(0, 4).map(String);
}

/** Build marked-endpoint interval questions with the convention stated in every prompt. */
export function buildIntervalCountChallenges(
  month = randomMonth(),
  year = randomYear(),
  startDate = 3 + Math.floor(Math.random() * 4),
  turnCount = 5,
): CalendarExplorerChallenge[] {
  const daysInMonth = getDaysInMonth(month, year);
  const safeCount = Math.max(1, Math.floor(turnCount));

  return Array.from({ length: safeCount }, (_, index) => {
    const span = 2 + (index % 6);
    const maxStart = Math.max(1, daysInMonth - span);
    const intervalStartDate = 1 + ((Math.max(1, startDate) - 1 + index * 4) % maxStart);
    const intervalEndDate = intervalStartDate + span;
    const countConvention = index % 2 === 0 ? "between" as const : "inclusive" as const;
    const answer = countConvention === "between" ? span - 1 : span + 1;
    const monthName = MONTHS_OF_YEAR[month - 1];
    const question = countConvention === "between"
      ? `How many days are between ${monthName} ${intervalStartDate} and ${monthName} ${intervalEndDate}? Do not count the two marked days.`
      : `How many calendar days are there from ${monthName} ${intervalStartDate} through ${monthName} ${intervalEndDate}? Count both marked days.`;

    return {
      id: `interval-count-${index + 1}`,
      type: "interval_count",
      question,
      month,
      year,
      correctAnswer: String(answer),
      options: buildIntervalOptions(answer),
      hint: countConvention === "between"
        ? "Count only the calendar boxes inside the two markers."
        : "Count every calendar box from the first marker through the second marker.",
      narration: "Use the two event markers to count the interval.",
      markedDates: [intervalStartDate, intervalEndDate],
      intervalStartDate,
      intervalEndDate,
      countConvention,
    };
  });
}

function getDaysInMonth(month: number, year: number): number {
  return new Date(year, month, 0).getDate();
}

function getDayOfWeek(day: number, month: number, year: number): string {
  return DAYS_OF_WEEK[new Date(year, month - 1, day).getDay()];
}

/** Count how many times a given day-of-week occurs in a month */
function countDayOfWeekInMonth(dayName: string, month: number, year: number): number {
  const daysInMonth = getDaysInMonth(month, year);
  let count = 0;
  for (let d = 1; d <= daysInMonth; d++) {
    if (getDayOfWeek(d, month, year) === dayName) count++;
  }
  return count;
}

/** Find the nth occurrence of a day-of-week in a month (1-based). Returns 0 if not found. */
function nthDayOfWeekInMonth(dayName: string, nth: number, month: number, year: number): number {
  const daysInMonth = getDaysInMonth(month, year);
  let count = 0;
  for (let d = 1; d <= daysInMonth; d++) {
    if (getDayOfWeek(d, month, year) === dayName) {
      count++;
      if (count === nth) return d;
    }
  }
  return 0;
}

function resolveGradeBand(gradeLevel: string): string {
  const gl = gradeLevel.toLowerCase();
  if (gl.includes("kinder") || gl.includes("k")) return "K";
  if (/4|5/.test(gl)) return "4-5";
  if (gl.includes("3")) return "3";
  if (gl.includes("2")) return "2";
  return "1";
}

/**
 * Map the canonical objective grade ('K' | '1'..'12') onto the component's band.
 * resolveGradeBand() above only ever saw `gradeContext` PROSE, and its digit tests
 * match any "4" or "5" anywhere in that prose — a Grade-1 objective was landing on
 * the "4-5" band. The band is what the component uses to hold the pre-reader floor
 * and what it hands the live tutor as gradeLevel, so it has to come from the
 * canonical grade whenever there is one. Returns null when there isn't.
 */
export function calendarGradeBandFromGrade(grade?: string): string | null {
  if (!grade) return null;
  const g = grade.trim().toUpperCase();
  if (g === "K") return "K";
  const n = parseInt(g, 10);
  if (isNaN(n)) return null;
  if (n <= 1) return "1";
  if (n === 2) return "2";
  if (n === 3) return "3";
  return "4-5";
}

// Ensure variety across months
function randomMonth(): number {
  return Math.floor(Math.random() * 12) + 1;
}

function randomYear(): number {
  return 2024 + Math.floor(Math.random() * 3); // 2024-2026
}

const MONTH_NAMES = MONTHS_OF_YEAR;

// ===========================================================================
// Within-mode support tier (ctx.supportTier) — SCAFFOLD WITHDRAWAL, not numbers
//
// The eval mode is the task identity (identify / count / pattern). The tier only
// decides how much of the calendar's *help* is on screen while the student does
// that same task. INVARIANTS:
//   • The tier never appears in any prompt — every stamp below is applied in CODE
//     post-parse, so the tier cannot steer WHICH month/day/question Gemini draws.
//   • The tier never touches question, month, year, correctAnswer or targetDayOfWeek.
//     The calendar grid itself (the manipulable object) is never withdrawn.
//   • Every field is OPTIONAL. No tier ⇒ no fields stamped ⇒ byte-identical legacy
//     full-help render (the component reads them with `!== false`).
//
// LEVERS
//   #1 perception   showTargetDayColumn (count) — the purple pre-marking of every
//                     target-day cell. It performs the counting task for the
//                     student, so `hard` drops it and the child must find the
//                     column and count unaided.
//   #2 orientation  showDayHeaders / showMonthLabel — the Sun..Sat header row and
//                     the "March 2025" caption. medium drops the caption (the
//                     question names the month), hard drops both.
//   #3 answer-form  count option spread — the code-built options are ALWAYS
//                     adjacent [n-1, n, n+1, n+2], i.e. already the hard end.
//                     `easy` REBUILDS them wide (n, n±3, n+6) so a rough count
//                     discriminates. The correct answer is always present; the
//                     option count never changes; MC never becomes free entry.
//   #4 instruction  hint — the generated hints are strategy giveaways ("Look at
//                     the Friday column and count each one"), which hand over the
//                     method that `hard` is meant to assess. `hard` replaces the
//                     hint with a neutral one IN CODE (the LLM never authors the
//                     hard hint, and never learns a tier exists).
// ===========================================================================

/** Strategy-free hint stamped at `hard`. Names no column, row, or method. */
export const CALENDAR_NEUTRAL_HINT = "Use the calendar to work it out.";

interface CalendarSupportScaffold {
  showDayHeaders: boolean;
  showMonthLabel: boolean;
  /** count only — the purple pre-marking of target-day cells. */
  showTargetDayColumn: boolean;
  /** count only — rebuild the MC options with a wide spread. */
  wideOptionSpread: boolean;
  /** hard only — overwrite the generated strategy hint. */
  neutralHint: boolean;
}

function resolveCalendarSupport(tier: SupportTier): CalendarSupportScaffold {
  switch (tier) {
    case "easy":
      return {
        showDayHeaders: true,
        showMonthLabel: true,
        showTargetDayColumn: true,
        wideOptionSpread: true,
        neutralHint: false,
      };
    case "medium":
      return {
        showDayHeaders: true,
        showMonthLabel: false,
        showTargetDayColumn: true,
        wideOptionSpread: false,
        neutralHint: false,
      };
    case "hard":
    default:
      return {
        showDayHeaders: false,
        showMonthLabel: false,
        showTargetDayColumn: false,
        wideOptionSpread: false,
        neutralHint: true,
      };
  }
}

/**
 * Build the 4 count options around the computed count.
 *  - narrow (legacy): [n-1, n, n+1, n+2], clamped at 1 — byte-identical to the
 *    inline builder in generateCountChallenges for every real month count.
 *  - wide (easy only): [n-3, n, n+3, n+6], clamped at 1 — a rough count still
 *    discriminates, so the child is graded on "did you count" not "±1".
 * The correct answer is ALWAYS present.
 */
export function buildCalendarCountOptions(count: number, wide: boolean): string[] {
  const offsets = wide ? [-3, 0, 3, 6] : [-1, 0, 1, 2];
  const nums: number[] = [];
  for (const off of offsets) {
    const v = count + off;
    if (v >= 1 && !nums.includes(v)) nums.push(v);
  }
  if (!nums.includes(count)) nums.push(count);
  let step = wide ? 9 : 3;
  while (nums.length < 4) {
    const v = count + step;
    if (!nums.includes(v)) nums.push(v);
    step += wide ? 3 : 1;
  }
  const out = nums.sort((a, b) => a - b).slice(0, 4).map(String);
  if (!out.includes(String(count))) out[out.length - 1] = String(count);
  return out;
}

/**
 * Stamp the tier's scaffold fields onto every challenge. Pure + deterministic.
 *
 * `preReader` is the K band floor: at K the header row, the month caption and the
 * target-day marking are the pre-reader's ONLY orientation channels (the question
 * text that names the month is a reading demand K cannot meet, and a child who
 * cannot read "Fri" can only find the Friday column by its marking). Band supports
 * compose with tiers and ALWAYS win — the floor is stamped explicitly (`true`), so
 * it is visible in the payload rather than a silent override at render time.
 */
export function applyCalendarSupportTier(
  challenges: CalendarExplorerChallenge[],
  supportTier: SupportTier | undefined,
  preReader: boolean,
): CalendarExplorerChallenge[] {
  // Absent tier ⇒ untouched. Legacy payloads carry none of these fields.
  if (!supportTier) return challenges;

  const sc = resolveCalendarSupport(supportTier);

  return challenges.map((c) => {
    const next: CalendarExplorerChallenge = { ...c };

    next.showDayHeaders = preReader ? true : sc.showDayHeaders;
    next.showMonthLabel = preReader ? true : sc.showMonthLabel;

    if (c.type === "count") {
      next.showTargetDayColumn = preReader ? true : sc.showTargetDayColumn;
      if (sc.wideOptionSpread) {
        const n = parseInt(c.correctAnswer, 10);
        if (!isNaN(n) && n >= 1) next.options = buildCalendarCountOptions(n, true);
      }
    }

    if (sc.neutralHint) next.hint = CALENDAR_NEUTRAL_HINT;

    return next;
  });
}

/**
 * Is this a pre-reader (K) instance? The canonical objective grade wins; the raw
 * grade key is the fallback. NEVER resolveGradeBand() — its `includes("k")` test
 * matches any prose containing a "k".
 */
export function isCalendarPreReader(ctx: Pick<GenerationContext, "grade" | "gradeLevel">): boolean {
  if (ctx.grade) return ctx.grade === "K";
  return /kinder|(^|[^a-z])k([^a-z]|$)/i.test(ctx.gradeLevel ?? "");
}

// ---------------------------------------------------------------------------
// Flat challenge interface for Gemini output
// ---------------------------------------------------------------------------

interface FlatChallenge {
  [key: string]: unknown;
}

function collectOptions(flat: FlatChallenge, maxSlots: number): string[] {
  const out: string[] = [];
  for (let i = 0; i < maxSlots; i++) {
    const v = flat[`option${i}`];
    if (typeof v === "string" && v.trim()) out.push(v.trim());
  }
  return out;
}

function collectHighlightDates(flat: FlatChallenge, maxSlots: number): number[] {
  const out: number[] = [];
  for (let i = 0; i < maxSlots; i++) {
    const v = flat[`highlightDate${i}`];
    if (typeof v === "number" && v > 0) out.push(v);
  }
  return out;
}

// ===========================================================================
// Per-type schemas — flat, all fields required, no nullable fields
// ===========================================================================

const identifySchema: Schema = {
  type: Type.OBJECT,
  properties: {
    challenges: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.STRING, description: "Unique challenge ID like 'id-1'" },
          question: { type: Type.STRING, description: "The question to ask the student" },
          month: { type: Type.NUMBER, description: "Month 1-12" },
          year: { type: Type.NUMBER, description: "Year (2024-2026)" },
          correctAnswer: { type: Type.STRING, description: "The correct answer as a string (day number or day name)" },
          option0: { type: Type.STRING, description: "Answer choice 1" },
          option1: { type: Type.STRING, description: "Answer choice 2" },
          option2: { type: Type.STRING, description: "Answer choice 3" },
          option3: { type: Type.STRING, description: "Answer choice 4" },
          hint: { type: Type.STRING, description: "Hint for the student" },
          narration: { type: Type.STRING, description: "Brief AI narration text introducing the question" },
          highlightDate0: { type: Type.NUMBER, description: "1st date to highlight after correct answer" },
          highlightDate1: { type: Type.NUMBER, description: "2nd date to highlight (optional, use 0 if none)" },
          highlightDate2: { type: Type.NUMBER, description: "3rd date to highlight (optional, use 0 if none)" },
        },
        required: [
          "id", "question", "month", "year", "correctAnswer",
          "option0", "option1", "option2", "option3",
          "hint", "narration", "highlightDate0",
        ],
      },
      description: "5-6 identify challenges",
    },
  },
  required: ["challenges"],
};

const countSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    challenges: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.STRING, description: "Unique challenge ID like 'cnt-1'" },
          question: { type: Type.STRING, description: "The counting question" },
          month: { type: Type.NUMBER, description: "Month 1-12" },
          year: { type: Type.NUMBER, description: "Year (2024-2026)" },
          correctAnswer: { type: Type.STRING, description: "The correct count as a string" },
          option0: { type: Type.STRING, description: "Answer choice 1" },
          option1: { type: Type.STRING, description: "Answer choice 2" },
          option2: { type: Type.STRING, description: "Answer choice 3" },
          option3: { type: Type.STRING, description: "Answer choice 4" },
          hint: { type: Type.STRING, description: "Hint for the student" },
          narration: { type: Type.STRING, description: "Brief AI narration text" },
          targetDayOfWeek: {
            type: Type.STRING,
            description: "Day of week to count: 'Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'",
          },
        },
        required: [
          "id", "question", "month", "year", "correctAnswer",
          "option0", "option1", "option2", "option3",
          "hint", "narration", "targetDayOfWeek",
        ],
      },
      description: "5-6 count challenges",
    },
  },
  required: ["challenges"],
};

const patternSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    challenges: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.STRING, description: "Unique challenge ID like 'pat-1'" },
          question: { type: Type.STRING, description: "The pattern question" },
          month: { type: Type.NUMBER, description: "Month 1-12" },
          year: { type: Type.NUMBER, description: "Year (2024-2026)" },
          correctAnswer: { type: Type.STRING, description: "The correct answer (day name or date as string)" },
          option0: { type: Type.STRING, description: "Answer choice 1" },
          option1: { type: Type.STRING, description: "Answer choice 2" },
          option2: { type: Type.STRING, description: "Answer choice 3" },
          option3: { type: Type.STRING, description: "Answer choice 4" },
          hint: { type: Type.STRING, description: "Hint for the student" },
          narration: { type: Type.STRING, description: "Brief AI narration text" },
        },
        required: [
          "id", "question", "month", "year", "correctAnswer",
          "option0", "option1", "option2", "option3",
          "hint", "narration",
        ],
      },
      description: "5-6 pattern challenges",
    },
  },
  required: ["challenges"],
};

// ===========================================================================
// Per-type sub-generators
// ===========================================================================

async function generateIdentifyChallenges(
  topic: string,
  scopeSection: string,
  gradeLevel: string,
  count: number,
): Promise<CalendarExplorerChallenge[]> {
  const prompt = `
Create ${count} calendar IDENTIFY challenges for "${topic}" (${gradeLevel} students).
${scopeSection}

Question types (mix these):
- "What date is the third Wednesday of [Month] [Year]?"
- "What day of the week is [Month] [Day], [Year]?"
- "What is the first Monday of [Month] [Year]?"

RULES:
- month must be 1-12, year must be 2024-2026
- correctAnswer is a day number (e.g., "15") or a day name (e.g., "Wednesday")
- ALL 4 options must be strings. correctAnswer MUST appear as one of option0-option3.
- highlightDate0 should be the date number to highlight on the calendar after answering correctly.
  Use 0 for highlightDate1/highlightDate2 if not needed.
- Make sure the dates you reference actually exist in the given month/year.
- Vary the months and days across challenges.

EXAMPLE:
{
  "challenges": [{
    "id": "id-1",
    "question": "What day of the week is March 15, 2025?",
    "month": 3, "year": 2025,
    "correctAnswer": "Saturday",
    "option0": "Thursday", "option1": "Friday", "option2": "Saturday", "option3": "Sunday",
    "hint": "Find March 15 on the calendar and look at which column it falls in.",
    "narration": "Let's find out what day March 15th falls on!",
    "highlightDate0": 15, "highlightDate1": 0, "highlightDate2": 0
  }]
}
`;

  const result = await ai.models.generateContent({
    model: "gemini-flash-lite-latest",
    contents: prompt,
    config: { responseMimeType: "application/json", responseSchema: identifySchema },
  });

  const data = result.text ? JSON.parse(result.text) : null;
  if (!data?.challenges?.length) return [];

  return (data.challenges as FlatChallenge[])
    .map((flat): CalendarExplorerChallenge | null => {
      const month = typeof flat.month === "number" ? flat.month : 0;
      const year = typeof flat.year === "number" ? flat.year : 0;
      if (month < 1 || month > 12 || year < 2020 || year > 2030) return null;

      const question = typeof flat.question === "string" ? flat.question : "";
      const correctAnswer = typeof flat.correctAnswer === "string" ? flat.correctAnswer.trim() : "";
      const hint = typeof flat.hint === "string" ? flat.hint : "Look carefully at the calendar!";
      const narration = typeof flat.narration === "string" ? flat.narration : "Let's explore the calendar!";
      if (!question || !correctAnswer) return null;

      // Reconstruct options
      let options = collectOptions(flat, 4);
      if (options.length < 2) return null;

      // VALIDATE: correctAnswer must be in options
      if (!options.some((o) => o.toLowerCase() === correctAnswer.toLowerCase())) {
        // Try to fix by replacing last option
        options[options.length - 1] = correctAnswer;
      }

      // Validate date if correctAnswer is a number (day of month)
      const dayNum = parseInt(correctAnswer, 10);
      if (!isNaN(dayNum)) {
        const daysInMonth = getDaysInMonth(month, year);
        if (dayNum < 1 || dayNum > daysInMonth) return null;
      }

      // Validate day name if correctAnswer is a day name
      if (isNaN(dayNum)) {
        // Verify it's a real day name
        const dayNameMatch = DAYS_OF_WEEK.find(
          (d) => d.toLowerCase() === correctAnswer.toLowerCase(),
        );
        if (!dayNameMatch) return null;

        // Cross-check: if question asks about a specific date, verify the answer
        const dateMatch = question.match(/(\w+)\s+(\d+),?\s+(\d{4})/);
        if (dateMatch) {
          const qMonth = MONTH_NAMES.findIndex(
            (m) => m.toLowerCase() === dateMatch[1].toLowerCase(),
          ) + 1;
          const qDay = parseInt(dateMatch[2], 10);
          const qYear = parseInt(dateMatch[3], 10);
          if (qMonth > 0 && qDay > 0) {
            const actualDay = getDayOfWeek(qDay, qMonth, qYear);
            if (actualDay.toLowerCase() !== correctAnswer.toLowerCase()) {
              // Gemini got it wrong — use computed value
              options = options.map((o) =>
                o.toLowerCase() === correctAnswer.toLowerCase() ? actualDay : o,
              );
              // Update correctAnswer to the computed value — handled below
              return {
                id: flat.id as string,
                type: "identify",
                question,
                month,
                year,
                correctAnswer: actualDay,
                options,
                hint,
                narration,
                highlightDates: collectHighlightDates(flat, 3).filter((d) => d > 0),
              };
            }
          }
        }
      }

      return {
        id: flat.id as string,
        type: "identify",
        question,
        month,
        year,
        correctAnswer,
        options,
        hint,
        narration,
        highlightDates: collectHighlightDates(flat, 3).filter((d) => d > 0),
      };
    })
    .filter((c): c is CalendarExplorerChallenge => c !== null);
}

async function generateCountChallenges(
  topic: string,
  scopeSection: string,
  gradeLevel: string,
  count: number,
): Promise<CalendarExplorerChallenge[]> {
  const prompt = `
Create ${count} calendar COUNTING challenges for "${topic}" (${gradeLevel} students).
${scopeSection}

Question types (mix these — ONLY count a specific day-of-week, never total days):
- "How many Tuesdays are in March 2025?"
- "How many Saturdays are in June 2026?"
- "How many Fridays are in January 2024?"

RULES:
- month must be 1-12, year must be 2024-2026
- targetDayOfWeek must be a full day name: "Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"
- correctAnswer is the count as a string (e.g., "4" or "5")
- ALL 4 options must be count strings. correctAnswer MUST appear as one of option0-option3.
- Options should be close numbers like "3","4","5","6".
- Vary the months, years, and target days across challenges.

IMPORTANT: Count carefully! Most months have 4-5 of each day.
February 2024 has 29 days (leap year). February 2025 has 28 days.

EXAMPLE:
{
  "challenges": [{
    "id": "cnt-1",
    "question": "How many Fridays are in October 2025?",
    "month": 10, "year": 2025,
    "correctAnswer": "5",
    "option0": "3", "option1": "4", "option2": "5", "option3": "6",
    "hint": "Look at the Friday column and count each one in October.",
    "narration": "Let's count the Fridays in October!",
    "targetDayOfWeek": "Friday"
  }]
}
`;

  const result = await ai.models.generateContent({
    model: "gemini-flash-lite-latest",
    contents: prompt,
    config: { responseMimeType: "application/json", responseSchema: countSchema },
  });

  const data = result.text ? JSON.parse(result.text) : null;
  if (!data?.challenges?.length) return [];

  return (data.challenges as FlatChallenge[])
    .map((flat): CalendarExplorerChallenge | null => {
      const month = typeof flat.month === "number" ? flat.month : 0;
      const year = typeof flat.year === "number" ? flat.year : 0;
      if (month < 1 || month > 12 || year < 2020 || year > 2030) return null;

      const question = typeof flat.question === "string" ? flat.question : "";
      const hint = typeof flat.hint === "string" ? flat.hint : "Count carefully on the calendar!";
      const narration = typeof flat.narration === "string" ? flat.narration : "Let's count!";
      const targetDayOfWeek = typeof flat.targetDayOfWeek === "string" ? flat.targetDayOfWeek.trim() : "";
      if (!question || !targetDayOfWeek) return null;

      // Validate targetDayOfWeek is a real day name
      const normalizedDay = DAYS_OF_WEEK.find(
        (d) => d.toLowerCase() === targetDayOfWeek.toLowerCase(),
      );
      if (!normalizedDay) return null;

      // Reject "total days" questions — they don't match the targetDayOfWeek schema.
      // The question must reference the target day name to be semantically valid.
      if (!question.toLowerCase().includes(normalizedDay.toLowerCase())) return null;

      // COMPUTE the actual count using Date math — never trust Gemini's count
      const computedCount = countDayOfWeekInMonth(normalizedDay, month, year);
      const correctAnswer = String(computedCount);

      // Build options around the computed count
      const baseOptions = [
        String(Math.max(1, computedCount - 1)),
        correctAnswer,
        String(computedCount + 1),
        String(computedCount + 2),
      ];
      // Deduplicate and ensure 4 options
      const uniqueOptions = Array.from(new Set(baseOptions));
      while (uniqueOptions.length < 4) {
        uniqueOptions.push(String(computedCount + uniqueOptions.length));
      }
      const options = uniqueOptions.slice(0, 4);

      // Ensure correctAnswer is in options
      if (!options.includes(correctAnswer)) {
        options[options.length - 1] = correctAnswer;
      }

      return {
        id: flat.id as string,
        type: "count",
        question,
        month,
        year,
        correctAnswer,
        options,
        hint,
        narration,
        targetDayOfWeek: normalizedDay,
      };
    })
    .filter((c): c is CalendarExplorerChallenge => c !== null);
}

async function generatePatternChallenges(
  topic: string,
  scopeSection: string,
  gradeLevel: string,
  count: number,
): Promise<CalendarExplorerChallenge[]> {
  const prompt = `
Create ${count} calendar PATTERN challenges for "${topic}" (${gradeLevel} students).
${scopeSection}

Question types (mix these):
- "If ${MONTH_NAMES[randomMonth() - 1]} 1 is a ${DAYS_OF_WEEK[Math.floor(Math.random() * 7)]}, what day is ${MONTH_NAMES[randomMonth() - 1]} 8?"
- "What is the date exactly 2 weeks after March 5, 2025?"
- "March 3 is a Monday. What day of the week is March 10?"
- "What is the last day of February 2024?"

RULES:
- month must be 1-12, year must be 2024-2026
- correctAnswer is a day name (e.g., "Monday") or a date as string (e.g., "19")
- ALL 4 options must be strings. correctAnswer MUST appear as one of option0-option3.
- Questions should involve weekly patterns (every 7 days = same day), biweekly jumps,
  or month-end/month-start relationships.
- Make sure your answer is mathematically correct for the given month/year.

EXAMPLE:
{
  "challenges": [{
    "id": "pat-1",
    "question": "March 3, 2025 is a Monday. What day of the week is March 17, 2025?",
    "month": 3, "year": 2025,
    "correctAnswer": "Monday",
    "option0": "Sunday", "option1": "Monday", "option2": "Tuesday", "option3": "Wednesday",
    "hint": "March 17 is exactly 2 weeks after March 3. What pattern do you notice?",
    "narration": "Let's find the pattern in the calendar!"
  }]
}
`;

  const result = await ai.models.generateContent({
    model: "gemini-flash-lite-latest",
    contents: prompt,
    config: { responseMimeType: "application/json", responseSchema: patternSchema },
  });

  const data = result.text ? JSON.parse(result.text) : null;
  if (!data?.challenges?.length) return [];

  return (data.challenges as FlatChallenge[])
    .map((flat): CalendarExplorerChallenge | null => {
      const month = typeof flat.month === "number" ? flat.month : 0;
      const year = typeof flat.year === "number" ? flat.year : 0;
      if (month < 1 || month > 12 || year < 2020 || year > 2030) return null;

      const question = typeof flat.question === "string" ? flat.question : "";
      let correctAnswer = typeof flat.correctAnswer === "string" ? flat.correctAnswer.trim() : "";
      const hint = typeof flat.hint === "string" ? flat.hint : "Look for patterns in the calendar!";
      const narration = typeof flat.narration === "string" ? flat.narration : "Let's find a pattern!";
      if (!question || !correctAnswer) return null;

      let options = collectOptions(flat, 4);
      if (options.length < 2) return null;

      // Cross-check: if question mentions specific dates, verify the day-of-week answer
      const dayNameMatch = DAYS_OF_WEEK.find(
        (d) => d.toLowerCase() === correctAnswer.toLowerCase(),
      );
      if (dayNameMatch) {
        // Try to extract the target date from the question to verify
        const targetMatch = question.match(/(?:what day(?:\s+of the week)?\s+is\s+)(\w+)\s+(\d+)/i);
        if (targetMatch) {
          const tMonth = MONTH_NAMES.findIndex(
            (m) => m.toLowerCase() === targetMatch[1].toLowerCase(),
          ) + 1;
          const tDay = parseInt(targetMatch[2], 10);
          if (tMonth > 0 && tDay > 0 && tDay <= getDaysInMonth(tMonth, year)) {
            const actualDay = getDayOfWeek(tDay, tMonth, year);
            if (actualDay.toLowerCase() !== correctAnswer.toLowerCase()) {
              // Fix Gemini's incorrect answer
              options = options.map((o) =>
                o.toLowerCase() === correctAnswer.toLowerCase() ? actualDay : o,
              );
              correctAnswer = actualDay;
            }
          }
        }
      }

      // Cross-check: if answer is a date number, verify it exists in the month
      const dateNum = parseInt(correctAnswer, 10);
      if (!isNaN(dateNum)) {
        const daysInMonth = getDaysInMonth(month, year);
        if (dateNum < 1 || dateNum > daysInMonth) return null;
      }

      // VALIDATE: correctAnswer must be in options
      if (!options.some((o) => o.toLowerCase() === correctAnswer.toLowerCase())) {
        options[options.length - 1] = correctAnswer;
      }

      return {
        id: flat.id as string,
        type: "pattern",
        question,
        month,
        year,
        correctAnswer,
        options,
        hint,
        narration,
      };
    })
    .filter((c): c is CalendarExplorerChallenge => c !== null);
}

// ===========================================================================
// Today-framed identify — code-owned, correct by construction
//
// "Identify today's day of the week" and "point to yesterday and tomorrow" are the two
// K calendar objectives the identify mode could not serve: the mode is defined as date
// lookup, and the component had no notion of today, so both draws of TIME001-02-B asked
// which weekday an arbitrary 2025 date fell on. Nothing about a marked-today question is
// generative — the frame, the question, the key and the options all follow from one date —
// so the whole set is built here rather than asked for and then corrected. The Gemini
// identify schema is untouched; plain date lookups keep the LLM path.
// ===========================================================================

type RelativeDay = 'today' | 'yesterday' | 'tomorrow';

export interface TodayFraming {
  /** Which relative days the objective asks about. */
  relatives: RelativeDay[];
  /** What the child answers with: the weekday name, or the date they point at. */
  form: 'day-name' | 'date';
}

/**
 * Does this objective frame its questions around today? Returns null for every other
 * calendar objective, which keeps the LLM date-lookup path exactly as it was.
 *
 * The test is syntactic on purpose: "today", "yesterday" and "tomorrow" are the literal
 * words the objective uses, and a child pointing at a marked day is what "point to
 * yesterday" means. The ANSWER FORM comes from the verb — "identify today's day of the
 * week" wants a weekday name, "point to yesterday" wants a date in the grid, which is
 * also the only answer channel the grid offers (isGridAnswerChallenge).
 */
export function resolveTodayFraming(objective: string): TodayFraming | null {
  const t = objective.toLowerCase();
  const yesterday = /\byesterday\b/.test(t);
  const tomorrow = /\btomorrow\b/.test(t);
  const today = /\btoday\b/.test(t);
  if (!today && !yesterday && !tomorrow) return null;

  const wantsDayName = /day of the week|weekday|what day/.test(t);
  const wantsPointing = /\b(point|tap|touch|click|show)\b/.test(t);
  const form: TodayFraming['form'] =
    wantsPointing && !wantsDayName ? 'date'
      : wantsDayName ? 'day-name'
        : yesterday || tomorrow ? 'date'
          : 'day-name';

  const relatives: RelativeDay[] = [];
  // Today alone carries the session only when the objective names nothing else; when it
  // names yesterday/tomorrow, those ARE the task and "which is today" is the given.
  if (yesterday) relatives.push('yesterday');
  if (tomorrow) relatives.push('tomorrow');
  if (relatives.length === 0) relatives.push('today');
  return { relatives, form };
}

interface TodayFrame {
  month: number;
  year: number;
  todayDate: number;
}

/**
 * The session's frames. The first is the real today — the child's own calendar — and the
 * rest are further days of the same month, so five items are five different questions
 * instead of the same one asked five times. Offsets 1, 3, 5, 2, 4, 6 are distinct modulo
 * 7, so consecutive frames land on different weekdays and the answers differ too.
 *
 * `needsNeighbours` pulls a frame off the edges of the month: the grid draws one month,
 * so a "tomorrow" on the 31st would point at a square that is not on screen.
 */
export function buildTodayFrames(count: number, needsNeighbours: boolean, now = new Date()): TodayFrame[] {
  const month = now.getMonth() + 1;
  const year = now.getFullYear();
  const daysInMonth = getDaysInMonth(month, year);
  const lo = needsNeighbours ? 2 : 1;
  const hi = needsNeighbours ? daysInMonth - 1 : daysInMonth;
  const clamp = (d: number) => Math.min(Math.max(d, lo), hi);

  const frames: TodayFrame[] = [];
  const seen = new Set<number>();
  for (const offset of [0, 1, 3, 5, 2, 4, 6, 8, 10, 12]) {
    if (frames.length >= count) break;
    const day = clamp(((now.getDate() - 1 + offset) % daysInMonth) + 1);
    if (seen.has(day)) continue;
    seen.add(day);
    frames.push({ month, year, todayDate: day });
  }
  return frames;
}

function dateForRelative(frame: TodayFrame, rel: RelativeDay): number {
  if (rel === 'yesterday') return frame.todayDate - 1;
  if (rel === 'tomorrow') return frame.todayDate + 1;
  return frame.todayDate;
}

/** Four weekday names including the answer, rotated so the key isn't always in one slot. */
function dayNameOptions(correct: string, slot: number): string[] {
  const i = DAYS_OF_WEEK.findIndex((d) => d === correct);
  const others = [2, 4, 5].map((step) => DAYS_OF_WEEK[(i + step) % 7]);
  const out: string[] = [...others];
  out.splice(slot % 4, 0, correct);
  return out.slice(0, 4);
}

/** Four in-month dates including the answer, rotated the same way. */
function dateOptions(correct: number, daysInMonth: number, slot: number): string[] {
  const others: number[] = [];
  for (const off of [-2, 2, -3, 3, -4, 4]) {
    if (others.length >= 3) break;
    const d = correct + off;
    if (d >= 1 && d <= daysInMonth && !others.includes(d)) others.push(d);
  }
  const out = others.map(String);
  out.splice(slot % 4, 0, String(correct));
  return out.slice(0, 4);
}

const RELATIVE_QUESTION: Record<RelativeDay, Record<'day-name' | 'date', string>> = {
  today: {
    'day-name': 'The ⭐ shows today. What day of the week is today?',
    date: 'The ⭐ shows today. Tap today on the calendar.',
  },
  yesterday: {
    'day-name': 'The ⭐ shows today. What day of the week was yesterday?',
    date: 'The ⭐ shows today. Tap yesterday on the calendar.',
  },
  tomorrow: {
    'day-name': 'The ⭐ shows today. What day of the week is tomorrow?',
    date: 'The ⭐ shows today. Tap tomorrow on the calendar.',
  },
};

const RELATIVE_HINT: Record<RelativeDay, Record<'day-name' | 'date', string>> = {
  today: {
    'day-name': 'Find the ⭐, then read the word at the top of its column.',
    date: 'Today is the square with the ⭐ on it.',
  },
  yesterday: {
    'day-name': 'Yesterday is the square just before the ⭐. Read the word at the top of that column.',
    date: 'Yesterday is the square just before the ⭐.',
  },
  tomorrow: {
    'day-name': 'Tomorrow is the square just after the ⭐. Read the word at the top of that column.',
    date: 'Tomorrow is the square just after the ⭐.',
  },
};

/** Build the session. Every question is asked against the starred day, so every one of
 *  them is answerable from what is on screen. */
export function buildTodayFrameChallenges(
  framing: TodayFraming,
  count: number,
  now = new Date(),
): CalendarExplorerChallenge[] {
  const needsNeighbours = framing.relatives.some((r) => r !== 'today');
  const frames = buildTodayFrames(count, needsNeighbours, now);
  if (frames.length === 0) return [];

  const challenges: CalendarExplorerChallenge[] = [];
  for (let i = 0; i < count; i++) {
    const frame = frames[i % frames.length];
    const rel = framing.relatives[i % framing.relatives.length];
    const daysInMonth = getDaysInMonth(frame.month, frame.year);
    const day = dateForRelative(frame, rel);
    if (day < 1 || day > daysInMonth) continue;

    const dayName = getDayOfWeek(day, frame.month, frame.year);
    const isDateForm = framing.form === 'date';
    const correctAnswer = isDateForm ? String(day) : dayName;

    challenges.push({
      id: `c${i + 1}`,
      type: 'identify',
      question: RELATIVE_QUESTION[rel][framing.form],
      month: frame.month,
      year: frame.year,
      correctAnswer,
      options: isDateForm ? dateOptions(day, daysInMonth, i) : dayNameOptions(dayName, i),
      hint: RELATIVE_HINT[rel][framing.form],
      narration: `Let's find ${rel} on the calendar!`,
      highlightDates: [day],
      todayDate: frame.todayDate,
    });
  }
  return challenges;
}

// ===========================================================================
// Fallbacks — one per type, correct by construction
// ===========================================================================

export const FALLBACKS: Record<string, CalendarExplorerChallenge> = {
  identify: {
    id: "fb-1",
    // DATE-ANSWER fallback (was a day-of-week answer, "Wednesday"). An identify
    // challenge whose correctAnswer is a day NAME is answered from the options
    // list, not the grid; a numeric answer is answerable by clicking the date,
    // which is the mode's native act. Keep the fallback in the grid-answerable
    // class so the safety net is always the simplest working interaction.
    type: "identify",
    question: "What date is the second Tuesday of March 2025?",
    month: 3,
    year: 2025,
    // March 2025 starts on a Saturday → Tuesdays fall on 4, 11, 18, 25.
    correctAnswer: "11",
    options: ["4", "11", "18", "25"],
    hint: "Find the Tuesdays in March, then count to the second one.",
    narration: "Let's find the second Tuesday in March!",
    highlightDates: [11],
  },
  count: {
    id: "fb-1",
    type: "count",
    question: "How many Sundays are in March 2025?",
    month: 3,
    year: 2025,
    // March 2025: Sundays on 2, 9, 16, 23, 30 = 5
    correctAnswer: "5",
    options: ["3", "4", "5", "6"],
    hint: "Look at the Sunday column and count each one.",
    narration: "Let's count the Sundays in March!",
    targetDayOfWeek: "Sunday",
  },
  pattern: {
    id: "fb-1",
    type: "pattern",
    question: "March 3, 2025 is a Monday. What day of the week is March 10, 2025?",
    month: 3,
    year: 2025,
    // 7 days later = same day
    correctAnswer: "Monday",
    options: ["Sunday", "Monday", "Tuesday", "Wednesday"],
    hint: "March 10 is exactly one week after March 3. What stays the same?",
    narration: "Let's discover a weekly pattern!",
  },
  day_sequence: {
    id: "fallback-day-sequence",
    type: "day_sequence",
    question: "Listen to the tutor, then say the day that comes next.",
    month: 1,
    year: 2026,
    correctAnswer: "Tuesday",
    options: [],
    hint: "Say the week together from Sunday, then try this day again.",
    narration: "Continue the spoken day chain from Monday.",
    currentDay: "Monday",
    expectedDay: "Tuesday",
    chainPosition: 1,
  },
  month_sequence: {
    id: "fallback-month-sequence",
    type: "month_sequence",
    question: "Listen to the tutor, then say the month that comes next.",
    month: 1,
    year: 2026,
    correctAnswer: "February",
    options: [],
    hint: "Say the months together from January, then try this month again.",
    narration: "Continue the spoken month chain from January.",
    currentMonth: "January",
    expectedMonth: "February",
    chainPosition: 1,
  },
  day_offset: {
    id: "fallback-day-offset",
    type: "day_offset",
    question: "Start on Tuesday. Count forward 3 days. What day do you land on?",
    month: 1,
    year: 2026,
    correctAnswer: "Friday",
    options: [...DAYS_OF_WEEK],
    hint: "Begin after Tuesday and count one day for each step.",
    narration: "Let's count three days forward from Tuesday.",
    startDay: "Tuesday",
    offsetDays: 3,
  },
  mark_events: {
    id: "fallback-mark-events",
    type: "mark_events",
    question: "Mark Library Day on March 11.",
    month: 3,
    year: 2025,
    correctAnswer: "11",
    options: [],
    hint: "Find 11 in the calendar, then place the marker there.",
    narration: "Put the Library Day marker on its date.",
    highlightDates: [11],
    markedDates: [],
    eventLabel: "Library Day",
  },
  interval_count: {
    id: "fallback-interval-count",
    type: "interval_count",
    question: "How many days are between March 4 and March 9? Do not count the two marked days.",
    month: 3,
    year: 2025,
    correctAnswer: "4",
    options: ["3", "4", "5", "6"],
    hint: "Count only the calendar boxes inside the two markers.",
    narration: "Use the two event markers to count the interval.",
    markedDates: [4, 9],
    intervalStartDate: 4,
    intervalEndDate: 9,
    countConvention: "between",
  },
};

// ===========================================================================
// Main generator — dispatches to per-type sub-generators in parallel
// ===========================================================================

export const generateCalendarExplorer = async (
  ctx: GenerationContext,
): Promise<CalendarExplorerData> => {
  const { topic } = ctx;
  const scopeSection = buildScopePromptSection(ctx.scope);
  const gradeLevel = ctx.gradeContext;
  // The per-component objective is the contract; the broad topic is the fallback.
  const todayFraming = resolveTodayFraming(`${ctx.intent ?? ''} ${topic}`);
  // Axis 3 — normalized once upstream in resolveGenerationContext. Never re-parse
  // config.difficulty here.
  const supportTier = ctx.supportTier;
  // ── Resolve the task identity from an explicit pin or this component's intent. ──
  const resolution = await resolveEvalModes(
    "calendar-explorer",
    {
      targetEvalMode: ctx.targetEvalMode,
      intent: ctx.intent,
      objectiveText: ctx.objective.text,
    },
    CHALLENGE_TYPE_DOCS,
  );

  // Canonical objective grade wins; the prose parser is only the fallback.
  const gradeBand = calendarGradeBandFromGrade(ctx.grade) ?? resolveGradeBand(gradeLevel);
  // Broad mixed practice preserves the existing visual session. A spoken chain
  // is a different response channel and is therefore selected only as a resolved
  // task identity, never slipped into a tap session. If a curator requests an
  // incompatible cross-modality blend, the spoken chain wins as the safer,
  // assessable contract instead of rendering a dead half-voice/half-tap run.
  const visualTypes = ["identify", "count", "pattern"];
  const spokenTypes = ["day_sequence", "month_sequence"];
  let allowedTypes = resolution?.allowedTypes ?? visualTypes;
  const resolvedSpokenTypes = allowedTypes.filter((type) => spokenTypes.includes(type));
  if (resolvedSpokenTypes.length > 0 && resolvedSpokenTypes.length < allowedTypes.length) {
    console.warn(
      `[CalendarExplorer] Cross-modality blend [${allowedTypes.join(", ")}] collapsed to spoken sequence mode(s)`,
    );
    allowedTypes = resolvedSpokenTypes;
  }
  console.log(
    `[CalendarExplorer] modes: ${resolution ? `${resolution.modes.map(m => m.evalMode).join("+")} (${resolution.source})` : "mixed visual"}`
    + ` -> types [${allowedTypes.join(", ")}]`,
  );

  // Determine challenge count per type
  const isSingleType = allowedTypes.length === 1;
  const countPerType = isSingleType ? 5 : 2;

  // ── Dispatch sub-generators in parallel ──
  const generators: Promise<CalendarExplorerChallenge[]>[] = [];
  const typeOrder: string[] = [];

  for (const type of allowedTypes) {
    typeOrder.push(type);
    switch (type) {
      case "identify":
        // A today-framed objective is served in code (see buildTodayFrameChallenges);
        // every other identify objective keeps the LLM date-lookup path.
        generators.push(
          todayFraming
            ? Promise.resolve(buildTodayFrameChallenges(todayFraming, countPerType))
            : generateIdentifyChallenges(topic, scopeSection, gradeLevel, countPerType),
        );
        break;
      case "count":
        generators.push(generateCountChallenges(topic, scopeSection, gradeLevel, countPerType));
        break;
      case "pattern":
        generators.push(generatePatternChallenges(topic, scopeSection, gradeLevel, countPerType));
        break;
      case "day_sequence":
        // The seven-day cycle is closed, stable content. Code — not Gemini —
        // owns the random start, successor truth, and five-turn minimum.
        generators.push(Promise.resolve(buildDaySequenceChallenges()));
        break;
      case "month_sequence":
        generators.push(Promise.resolve(buildMonthSequenceChallenges()));
        break;
      case "day_offset":
        generators.push(Promise.resolve(buildDayOffsetChallenges(undefined, countPerType)));
        break;
      case "mark_events":
        generators.push(Promise.resolve(buildMarkEventChallenges(undefined, undefined, undefined, countPerType)));
        break;
      case "interval_count":
        generators.push(Promise.resolve(buildIntervalCountChallenges(undefined, undefined, undefined, countPerType)));
        break;
    }
  }

  const results = await Promise.all(generators);

  // ── Combine results ──
  let challenges: CalendarExplorerChallenge[] = results.flat();

  // Re-assign IDs sequentially
  challenges = challenges.map((c, i) => ({ ...c, id: `c${i + 1}` }));

  // ── Fallback if any type produced zero challenges ──
  for (let i = 0; i < typeOrder.length; i++) {
    if (results[i].length === 0) {
      const fallbackType = typeOrder[i];
      console.log(`[CalendarExplorer] No valid ${fallbackType} challenges — injecting fallback`);
      const fb = FALLBACKS[fallbackType];
      if (fb) {
        challenges.push({ ...fb, id: `c${challenges.length + 1}` });
      }
    }
  }

  // ── Total fallback if still empty ──
  if (challenges.length === 0) {
    const fallbackType = allowedTypes[0] ?? "identify";
    console.log(`[CalendarExplorer] No valid challenges at all — using ${fallbackType} fallback`);
    challenges = [{ ...(FALLBACKS[fallbackType] ?? FALLBACKS.identify), id: "c1" }];
  }

  // ── Build title/description from topic ──
  const typeLabels: Record<string, string> = {
    identify: "Date Finding",
    count: "Day Counting",
    pattern: "Calendar Patterns",
    day_sequence: "Days in Order",
    month_sequence: "Months in Order",
    day_offset: "Days Forward",
    mark_events: "Mark Events",
    interval_count: "Days Between Events",
  };
  let title = `Calendar Explorer: ${topic}`;
  let description = "Explore the calendar to find dates, count days, and discover patterns!";
  if (isSingleType) {
    const label = typeLabels[allowedTypes[0]] ?? "Calendar";
    title = `${label}: ${topic}`;
    description = `Practice ${label.toLowerCase()} on the calendar.`;
  }

  // ── Within-mode support tier: withdraw on-screen / instructional scaffolding.
  //    Applied LAST so fallback challenges are tiered too, in CODE so the tier
  //    never reaches a prompt. A curated blend has no single support surface,
  //    and spoken day_sequence has its own correction scaffold, so only one
  //    resolved visual mode receives this visual-calendar tier. ──
  const preReader = isCalendarPreReader(ctx);
  const tierApplies = resolution?.modes.length === 1 && !spokenTypes.includes(allowedTypes[0]);
  challenges = applyCalendarSupportTier(
    challenges,
    tierApplies ? supportTier : undefined,
    preReader,
  );
  if (supportTier && tierApplies) {
    console.log(
      `[CalendarExplorer] Support tier "${supportTier}" applied to ${challenges.length} challenge(s)`
      + (preReader ? " (K band floor: orientation scaffolds held)" : ""),
    );
  }

  if (todayFraming) {
    console.log(
      `[CalendarExplorer] Today-framed objective — identify built in code `
      + `(${todayFraming.form} answers, relatives: ${todayFraming.relatives.join(", ")})`,
    );
  }

  const typeBreakdown = challenges.map((c) => c.type).join(", ");
  console.log(`[CalendarExplorer] Final: ${challenges.length} challenge(s) → [${typeBreakdown}]`);

  return {
    title,
    description,
    challenges,
    gradeBand: gradeBand as CalendarExplorerData["gradeBand"],
    // Tell the live tutor the support level whenever a tier is present — the
    // reveal policy has to match what the screen withdrew.
    ...(supportTier ? { supportTier } : {}),
  };
};
