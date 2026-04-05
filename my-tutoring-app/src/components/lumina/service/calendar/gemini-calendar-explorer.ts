import { Type, Schema } from "@google/genai";
import {
  CalendarExplorerData,
  CalendarExplorerChallenge,
} from "../../primitives/visual-primitives/calendar/CalendarExplorer";
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
};

// ---------------------------------------------------------------------------
// Calendar math helpers
// ---------------------------------------------------------------------------

const DAYS_OF_WEEK = [
  "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday",
] as const;

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

// Ensure variety across months
function randomMonth(): number {
  return Math.floor(Math.random() * 12) + 1;
}

function randomYear(): number {
  return 2024 + Math.floor(Math.random() * 3); // 2024-2026
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

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
  gradeLevel: string,
  count: number,
): Promise<CalendarExplorerChallenge[]> {
  const prompt = `
Create ${count} calendar IDENTIFY challenges for "${topic}" (${gradeLevel} students).

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
  gradeLevel: string,
  count: number,
): Promise<CalendarExplorerChallenge[]> {
  const prompt = `
Create ${count} calendar COUNTING challenges for "${topic}" (${gradeLevel} students).

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
  gradeLevel: string,
  count: number,
): Promise<CalendarExplorerChallenge[]> {
  const prompt = `
Create ${count} calendar PATTERN challenges for "${topic}" (${gradeLevel} students).

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
// Fallbacks — one per type, correct by construction
// ===========================================================================

const FALLBACKS: Record<string, CalendarExplorerChallenge> = {
  identify: {
    id: "fb-1",
    type: "identify",
    question: "What day of the week is January 1, 2025?",
    month: 1,
    year: 2025,
    // Jan 1, 2025 is a Wednesday
    correctAnswer: "Wednesday",
    options: ["Monday", "Tuesday", "Wednesday", "Thursday"],
    hint: "Find January 1 on the calendar and look at the column header.",
    narration: "Let's find out what day the new year starts on!",
    highlightDates: [1],
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
};

// ===========================================================================
// Main generator — dispatches to per-type sub-generators in parallel
// ===========================================================================

export const generateCalendarExplorer = async (
  topic: string,
  gradeLevel: string,
  config?: Partial<{ targetEvalMode?: string }>,
): Promise<CalendarExplorerData> => {
  // ── Resolve eval mode ──
  const evalConstraint = resolveEvalModeConstraint(
    "calendar-explorer",
    config?.targetEvalMode,
    CHALLENGE_TYPE_DOCS,
  );
  logEvalModeResolution("CalendarExplorer", config?.targetEvalMode, evalConstraint);

  const gradeBand = resolveGradeBand(gradeLevel);
  const allowedTypes = evalConstraint?.allowedTypes ?? Object.keys(CHALLENGE_TYPE_DOCS);

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
        generators.push(generateIdentifyChallenges(topic, gradeLevel, countPerType));
        break;
      case "count":
        generators.push(generateCountChallenges(topic, gradeLevel, countPerType));
        break;
      case "pattern":
        generators.push(generatePatternChallenges(topic, gradeLevel, countPerType));
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
  };
  let title = `Calendar Explorer: ${topic}`;
  let description = "Explore the calendar to find dates, count days, and discover patterns!";
  if (isSingleType) {
    const label = typeLabels[allowedTypes[0]] ?? "Calendar";
    title = `${label}: ${topic}`;
    description = `Practice ${label.toLowerCase()} on the calendar.`;
  }

  const typeBreakdown = challenges.map((c) => c.type).join(", ");
  console.log(`[CalendarExplorer] Final: ${challenges.length} challenge(s) → [${typeBreakdown}]`);

  return {
    title,
    description,
    challenges,
    gradeBand: gradeBand as CalendarExplorerData["gradeBand"],
  };
};
