import { Type, Schema } from "@google/genai";
import { AnalogClockData } from "../../primitives/visual-primitives/math/AnalogClock";
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
  read: {
    promptDoc:
      `"read": Student reads an analog clock face and picks the correct time from 4 options. `
      + `Generate 4 multiple-choice options (option0-option3) as "H:MM" strings with exactly one correct answer. `
      + `Set correctOptionIndex (0-3) to indicate the correct option.`,
    schemaDescription: "'read' (read analog clock face)",
  },
  set_time: {
    promptDoc:
      `"set_time": Student drags clock hands to show a given time. `
      + `Only targetHour and targetMinute are needed — no MC options. `
      + `Instruction tells the student what time to set (e.g., "Set the clock to 3:15").`,
    schemaDescription: "'set_time' (set clock hands to target time)",
  },
  match: {
    promptDoc:
      `"match": Student matches an analog clock face to the correct digital time from 4 options. `
      + `Generate 4 multiple-choice options (option0-option3) as "H:MM" strings with exactly one correct answer. `
      + `Set correctOptionIndex (0-3) to indicate the correct option.`,
    schemaDescription: "'match' (match analog to digital time)",
  },
  elapsed: {
    promptDoc:
      `"elapsed": Student watches a stopwatch and determines elapsed time. `
      + `Set startHour/startMinute for the starting time, targetHour/targetMinute for the ending time. `
      + `Include elapsedDescription (e.g., "30 minutes later"). `
      + `Generate 4 MC options (option0-option3) for "how much time passed?" and set correctOptionIndex.`,
    schemaDescription: "'elapsed' (determine elapsed time)",
  },
};

// ---------------------------------------------------------------------------
// Gemini JSON schema
// ---------------------------------------------------------------------------

const analogClockSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    title: {
      type: Type.STRING,
      description: "Title for the clock activity (e.g., 'Reading the Clock', 'What Time Is It?')",
    },
    description: {
      type: Type.STRING,
      description: "Brief educational description of what students will learn",
    },
    gradeBand: {
      type: Type.STRING,
      description: "Grade band: 'K' for Kindergarten, '1-2' for Grades 1-2, '3-5' for Grades 3-5",
    },
    challenges: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          id: {
            type: Type.STRING,
            description: "Unique challenge ID (e.g., 'c1', 'c2')",
          },
          type: {
            type: Type.STRING,
            description: "Challenge type: 'read' (read analog clock face), 'set_time' (set clock hands to target time), 'match' (match analog to digital time), 'elapsed' (determine elapsed time)",
          },
          instruction: {
            type: Type.STRING,
            description: "Student-facing instruction. Do NOT reveal the answer in the text.",
          },
          targetHour: {
            type: Type.NUMBER,
            description: "Target hour (1-12)",
          },
          targetMinute: {
            type: Type.NUMBER,
            description: "Target minute (0-59)",
          },
          option0: {
            type: Type.STRING,
            description: "Multiple-choice option 0 as 'H:MM' string (for read/match/elapsed types)",
          },
          option1: {
            type: Type.STRING,
            description: "Multiple-choice option 1 as 'H:MM' string",
          },
          option2: {
            type: Type.STRING,
            description: "Multiple-choice option 2 as 'H:MM' string",
          },
          option3: {
            type: Type.STRING,
            description: "Multiple-choice option 3 as 'H:MM' string",
          },
          correctOptionIndex: {
            type: Type.NUMBER,
            description: "Index (0-3) of the correct MC option",
          },
          startHour: {
            type: Type.NUMBER,
            description: "Starting hour for elapsed-time challenges (1-12)",
          },
          startMinute: {
            type: Type.NUMBER,
            description: "Starting minute for elapsed-time challenges (0-59)",
          },
          elapsedDescription: {
            type: Type.STRING,
            description: "Description of elapsed time (e.g., '30 minutes later')",
          },
          hint: {
            type: Type.STRING,
            description: "Hint text shown after incorrect attempts",
          },
        },
        required: ["id", "type", "instruction", "targetHour", "targetMinute", "hint"],
      },
      description: "Array of 4-6 progressive challenges",
    },
  },
  required: ["title", "challenges", "gradeBand"],
};

// ---------------------------------------------------------------------------
// Generator
// ---------------------------------------------------------------------------

export const generateAnalogClock = async (
  topic: string,
  gradeLevel: string,
  config?: {
    targetEvalMode?: string;
  },
): Promise<AnalogClockData> => {
  // ── Resolve eval mode ──
  const evalConstraint = resolveEvalModeConstraint(
    'analog-clock',
    config?.targetEvalMode,
    CHALLENGE_TYPE_DOCS,
  );

  // ── Build mode-constrained schema ──
  const activeSchema = evalConstraint
    ? constrainChallengeTypeEnum(analogClockSchema, evalConstraint.allowedTypes, CHALLENGE_TYPE_DOCS)
    : analogClockSchema;

  // ── Build prompt ──
  const challengeTypeSection = buildChallengeTypePromptSection(evalConstraint, CHALLENGE_TYPE_DOCS);

  const prompt = `
Create an educational analog clock activity for teaching "${topic}" to ${gradeLevel} students.

CONTEXT:
- Students learn to read analog clocks, set times, match analog to digital, and calculate elapsed time
- The analog clock has an hour hand and a minute hand on a 12-hour face
- Key skills: telling time, understanding hour/minute relationship, elapsed time

${challengeTypeSection}

GRADE-LEVEL TIME GRANULARITY (CRITICAL):
- Kindergarten (gradeBand "K"): ONLY use :00 (on the hour) and :30 (half-hour). targetMinute must be 0 or 30.
- Grades 1-2 (gradeBand "1-2"): Use :00, :15, :30, :45 (quarter-hour intervals). targetMinute must be 0, 15, 30, or 45.
- Grades 3-5 (gradeBand "3-5"): Use 5-minute intervals. targetMinute must be a multiple of 5 (0, 5, 10, 15, ..., 55).

CHALLENGE TYPE RULES:
- "read" and "match": Provide 4 MC options (option0-option3) as "H:MM" strings. Set correctOptionIndex (0-3). Make distractors plausible (e.g., swap hour/minute hand reading, off by 1 hour).
- "set_time": Only needs targetHour, targetMinute, and instruction. No MC options needed.
- "elapsed": Set startHour/startMinute and targetHour/targetMinute (the end time). Include elapsedDescription. Provide 4 MC options for the elapsed duration (e.g., "30 minutes", "1 hour 15 minutes") and set correctOptionIndex.

CRITICAL RULES:
1. Generate 4-6 challenges that progress in difficulty
2. Do NOT reveal the answer in the instruction text
3. For MC options, ensure exactly one correct answer and 3 plausible distractors
4. Format all time options as "H:MM" (e.g., "3:00", "12:45", "9:05" — use leading zero for minutes < 10)
5. targetHour must be 1-12, targetMinute must be 0-59
6. Use warm, age-appropriate language
7. Include helpful hints that guide without giving the answer
8. Vary the hours used across challenges — do not repeat the same hour

Return the complete analog clock configuration.
`;

  logEvalModeResolution('AnalogClock', config?.targetEvalMode, evalConstraint);

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
    throw new Error('No valid analog clock data returned from Gemini API');
  }

  // ── Validation & defaults ──

  // gradeBand
  if (data.gradeBand !== 'K' && data.gradeBand !== '1-2' && data.gradeBand !== '3-5') {
    const gl = gradeLevel.toLowerCase();
    if (gl.includes('kinder') || gl.includes('k')) data.gradeBand = 'K';
    else if (gl.includes('1') || gl.includes('2')) data.gradeBand = '1-2';
    else data.gradeBand = '3-5';
  }

  // Filter to valid challenge types
  const validTypes = ['read', 'set_time', 'match', 'elapsed'];
  data.challenges = (data.challenges || []).filter(
    (c: { type: string }) => validTypes.includes(c.type),
  );

  // Validate each challenge
  for (const ch of data.challenges as Array<{
    type: string;
    targetHour: number;
    targetMinute: number;
    startHour?: number;
    startMinute?: number;
    correctOptionIndex?: number;
    option0?: string;
    option1?: string;
    option2?: string;
    option3?: string;
    hint?: string;
  }>) {
    // Clamp targetHour to 1-12
    if (ch.targetHour < 1 || ch.targetHour > 12 || !Number.isInteger(ch.targetHour)) {
      ch.targetHour = Math.max(1, Math.min(12, Math.round(ch.targetHour || 12)));
    }
    // Clamp targetMinute to 0-59
    if (ch.targetMinute < 0 || ch.targetMinute > 59 || !Number.isInteger(ch.targetMinute)) {
      ch.targetMinute = Math.max(0, Math.min(59, Math.round(ch.targetMinute || 0)));
    }

    // Validate elapsed-specific fields
    if (ch.type === 'elapsed') {
      if (ch.startHour != null) {
        ch.startHour = Math.max(1, Math.min(12, Math.round(ch.startHour)));
      }
      if (ch.startMinute != null) {
        ch.startMinute = Math.max(0, Math.min(59, Math.round(ch.startMinute)));
      }
    }

    // Validate correctOptionIndex for MC types — auto-correct from target time
    if (ch.type === 'read' || ch.type === 'match') {
      const targetStr = `${ch.targetHour}:${String(ch.targetMinute).padStart(2, '0')}`;
      const options = [ch.option0, ch.option1, ch.option2, ch.option3];
      const matchIdx = options.findIndex(o => o === targetStr);
      if (matchIdx >= 0) {
        ch.correctOptionIndex = matchIdx;
      } else if (ch.correctOptionIndex == null || ch.correctOptionIndex < 0 || ch.correctOptionIndex > 3) {
        ch.correctOptionIndex = 0;
      }
    } else if (ch.type === 'elapsed') {
      // Derive correctOptionIndex from actual elapsed time
      const sH = ch.startHour ?? ch.targetHour;
      const sM = ch.startMinute ?? 0;
      const startTotal = (sH % 12) * 60 + sM;
      let endTotal = (ch.targetHour % 12) * 60 + ch.targetMinute;
      if (endTotal <= startTotal) endTotal += 720; // crossed 12
      const elapsedMins = endTotal - startTotal;

      // Build human-readable elapsed strings to match against options
      const elapsedHrs = Math.floor(elapsedMins / 60);
      const elapsedRem = elapsedMins % 60;
      const elapsedCandidates: string[] = [];
      if (elapsedHrs > 0 && elapsedRem > 0) {
        elapsedCandidates.push(`${elapsedHrs} hour${elapsedHrs > 1 ? 's' : ''} ${elapsedRem} minute${elapsedRem > 1 ? 's' : ''}`);
        elapsedCandidates.push(`${elapsedHrs} hour${elapsedHrs > 1 ? 's' : ''} and ${elapsedRem} minute${elapsedRem > 1 ? 's' : ''}`);
        elapsedCandidates.push(`${elapsedHrs}h ${elapsedRem}m`);
      } else if (elapsedHrs > 0) {
        elapsedCandidates.push(`${elapsedHrs} hour${elapsedHrs > 1 ? 's' : ''}`);
        elapsedCandidates.push(`${elapsedHrs}h`);
      } else {
        elapsedCandidates.push(`${elapsedRem} minute${elapsedRem > 1 ? 's' : ''}`);
        elapsedCandidates.push(`${elapsedRem}m`);
        elapsedCandidates.push(`${elapsedRem} min`);
      }

      const options = [ch.option0, ch.option1, ch.option2, ch.option3];
      const matchIdx = options.findIndex(o =>
        o != null && elapsedCandidates.some(c => o.toLowerCase().includes(c.toLowerCase())),
      );
      if (matchIdx >= 0) {
        ch.correctOptionIndex = matchIdx;
      } else {
        // Fallback: try matching the raw minute count
        const rawMatch = options.findIndex(o =>
          o != null && (o.includes(String(elapsedMins)) || o.includes(String(elapsedMins) + ' min')),
        );
        ch.correctOptionIndex = rawMatch >= 0 ? rawMatch : (ch.correctOptionIndex ?? 0);
      }
    }

    // Ensure hint exists
    if (!ch.hint) {
      ch.hint = 'Look carefully at where the hour and minute hands are pointing.';
    }
  }

  // ── Fallback if empty ──
  if (data.challenges.length === 0) {
    const fallbackType = evalConstraint?.allowedTypes[0] ?? 'read';
    console.log(`[AnalogClock] No valid challenges — using ${fallbackType} fallback`);
    data.challenges = [{
      id: 'c1',
      type: fallbackType,
      instruction: fallbackType === 'set_time'
        ? 'Set the clock to 3:00!'
        : 'What time does the clock show?',
      targetHour: 3,
      targetMinute: 0,
      option0: '3:00',
      option1: '6:00',
      option2: '12:15',
      option3: '9:00',
      correctOptionIndex: 0,
      hint: 'Look at the short hand first — it points to the hour.',
    }];
  }

  // Final summary log
  const typeBreakdown = (data.challenges as Array<{ type: string }>).map(c => c.type).join(', ');
  console.log(`[AnalogClock] Final: ${data.challenges.length} challenge(s) → [${typeBreakdown}]`);

  return data;
};
