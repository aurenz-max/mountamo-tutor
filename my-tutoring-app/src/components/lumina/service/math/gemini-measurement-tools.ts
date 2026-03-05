import { Type, Schema } from "@google/genai";
import { MeasurementToolsData } from "../../primitives/visual-primitives/math/MeasurementTools";
import { ai } from "../geminiClient";

/**
 * Simplified schema for Measurement Tools.
 * 2 types only (outer object + challenge array item) to stay within Gemini's
 * reliable JSON generation limits.
 */
const measurementToolsSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    toolType: {
      type: Type.STRING,
      description: "One of: 'ruler', 'scale', 'measuring_cup', 'thermometer'",
    },
    measurementType: {
      type: Type.STRING,
      description: "One of: 'length', 'weight', 'capacity', 'temperature'",
    },
    unit: {
      type: Type.STRING,
      description: "Primary unit shown on the tool: 'cm', 'm', 'in', 'ft', 'g', 'kg', 'lb', 'mL', 'L', 'cup', '°C', '°F'",
    },
    precision: {
      type: Type.STRING,
      description: "Tick mark precision: 'whole', 'half', or 'quarter'",
    },
    gradeBand: {
      type: Type.STRING,
      description: "'1-2' or '3-5'",
    },
    conversionFact: {
      type: Type.STRING,
      description: "Conversion fact for convert challenges, e.g. '1 inch = 2.54 cm'. Empty string if no conversion challenges.",
    },
    challenges: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.STRING, description: "Unique ID, e.g. 'c1', 'c2'" },
          type: { type: Type.STRING, description: "One of: 'estimate', 'read', 'convert'" },
          objectName: { type: Type.STRING, description: "Object name, e.g. 'Pencil'" },
          objectEmoji: { type: Type.STRING, description: "Single emoji for the object, e.g. '✏️'" },
          value: { type: Type.NUMBER, description: "The actual measurement value displayed on the tool" },
          targetAnswer: { type: Type.NUMBER, description: "Correct answer the student must enter" },
          targetUnit: { type: Type.STRING, description: "Unit the student answers in" },
          acceptableMin: { type: Type.NUMBER, description: "Min acceptable answer (for estimate challenges only)" },
          acceptableMax: { type: Type.NUMBER, description: "Max acceptable answer (for estimate challenges only)" },
          hint: { type: Type.STRING, description: "Hint shown after wrong attempts" },
          instruction: { type: Type.STRING, description: "Student-facing instruction, warm and encouraging" },
        },
        required: ["id", "type", "objectName", "objectEmoji", "value", "targetAnswer", "targetUnit", "hint", "instruction"],
      },
      description: "Array of 4-6 progressive measurement challenges",
    },
  },
  required: ["toolType", "measurementType", "unit", "precision", "gradeBand", "challenges"],
};

/**
 * Generate measurement tools data for interactive measurement activities.
 *
 * Three challenge types:
 * - estimate: Student sees object name/emoji (no tool) and guesses measurement
 * - read: Student sees a read-only tool visualization and reads the value
 * - convert: Student converts a given measurement to another unit
 */
export const generateMeasurementTools = async (
  topic: string,
  gradeLevel: string,
  config?: {
    toolType?: string;
    measurementType?: string;
    unit?: string;
    gradeBand?: '1-2' | '3-5';
  },
): Promise<MeasurementToolsData> => {
  const prompt = `
Create an educational measurement activity for teaching "${topic}" to ${gradeLevel} students.

THE STUDENT EXPERIENCE:
- Students see objects displayed on READ-ONLY measurement tools (ruler, scale, measuring cup, thermometer)
- They must READ the value from the tool visualization and type their answer
- They do NOT drag sliders — they visually read the instrument like in real life

THREE CHALLENGE TYPES:

1. "estimate" — Student sees the object emoji and name but NO measurement tool.
   They guess the measurement based on experience.
   - targetAnswer = the actual measurement value
   - acceptableMin = targetAnswer * 0.75 (allow 25% margin)
   - acceptableMax = targetAnswer * 1.25
   - targetUnit = the primary unit

2. "read" — Student sees the object displayed ON the measurement tool.
   For a ruler: a colored bar sits on the ruler from 0 to the value.
   For a scale: a gauge shows the weight.
   For a cup: liquid fills to the value.
   For a thermometer: mercury rises to the value.
   - targetAnswer = value (they must read the exact value from the tool)
   - targetUnit = the primary unit
   - Do NOT set acceptableMin/acceptableMax

3. "convert" — Student is given the measurement in one unit and converts to another.
   - value = the known measurement
   - targetAnswer = the mathematically correct converted value
   - targetUnit = the TARGET unit (different from the primary unit)
   - Do NOT set acceptableMin/acceptableMax

TOOL & UNIT MAPPING:
- ruler → length → cm, m, in, ft
- scale → weight → g, kg, lb
- measuring_cup → capacity → mL, L, cup
- thermometer → temperature → °C, °F

GRADE GUIDELINES:
- Grades 1-2 (gradeBand "1-2"):
  - precision: "whole" only
  - Simple objects kids know (pencils, books, apples, toys)
  - 4-5 challenges: 1-2 estimate, 2-3 read, NO convert
  - Values should be small whole numbers (1-30 for cm/in, 1-10 for kg)
  - conversionFact: empty string

- Grades 3-5 (gradeBand "3-5"):
  - precision: "half" or "quarter"
  - More varied objects (kitchen items, sports gear, science materials)
  - 4-6 challenges: 1-2 estimate, 2-3 read, 1 convert
  - Values can include halves/quarters matching the precision
  - conversionFact: provide the conversion fact (e.g., "1 inch = 2.54 cm")

CRITICAL RULES:
1. value MUST be a multiple of the precision step:
   - whole: 1, 2, 3, 5, 8, 12 (integers only)
   - half: 1.5, 3.0, 7.5 (multiples of 0.5)
   - quarter: 2.25, 5.75, 8.5 (multiples of 0.25)
2. For "read" challenges, targetAnswer MUST equal value exactly
3. For "estimate" challenges, always set acceptableMin and acceptableMax
4. For "convert" challenges, targetAnswer must be mathematically correct
5. Each challenge should use a different object (different objectName and objectEmoji)
6. Order: estimate challenges first, then read challenges, then convert
7. Use warm, encouraging instruction text appropriate for the grade level
8. Hints should guide without revealing the answer

${config ? `
CONFIGURATION:
${config.toolType ? `- Tool type: ${config.toolType}` : ''}
${config.measurementType ? `- Measurement type: ${config.measurementType}` : ''}
${config.unit ? `- Unit: ${config.unit}` : ''}
${config.gradeBand ? `- Grade band: ${config.gradeBand}` : ''}
` : ''}

Return the complete measurement tools configuration.
`;

  const result = await ai.models.generateContent({
    model: "gemini-flash-lite-latest",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: measurementToolsSchema,
    },
  });

  const data = result.text ? JSON.parse(result.text) : null;

  if (!data) {
    throw new Error('No valid measurement tools data returned from Gemini API');
  }

  // ── Validation & sanitization ──────────────────────────────────

  // Tool type
  const validToolTypes = ['ruler', 'scale', 'measuring_cup', 'thermometer'];
  if (!validToolTypes.includes(data.toolType)) {
    data.toolType = 'ruler';
  }

  // Measurement type
  const validMeasurementTypes = ['length', 'weight', 'capacity', 'temperature'];
  if (!validMeasurementTypes.includes(data.measurementType)) {
    data.measurementType = 'length';
  }

  // Tool ↔ measurement type consistency
  const toolToType: Record<string, string> = {
    ruler: 'length', scale: 'weight', measuring_cup: 'capacity', thermometer: 'temperature',
  };
  if (toolToType[data.toolType] !== data.measurementType) {
    const typeToTool: Record<string, string> = {
      length: 'ruler', weight: 'scale', capacity: 'measuring_cup', temperature: 'thermometer',
    };
    data.toolType = typeToTool[data.measurementType] || 'ruler';
  }

  // Grade band
  if (data.gradeBand !== '1-2' && data.gradeBand !== '3-5') {
    data.gradeBand = gradeLevel.toLowerCase().includes('kinder') || gradeLevel.includes('1') || gradeLevel.includes('2')
      ? '1-2' : '3-5';
  }

  // Precision
  const validPrecisions = ['whole', 'half', 'quarter'];
  if (!validPrecisions.includes(data.precision)) {
    data.precision = data.gradeBand === '1-2' ? 'whole' : 'half';
  }

  // Unit
  const validUnits = ['cm', 'm', 'in', 'ft', 'g', 'kg', 'lb', 'mL', 'L', 'cup', '°C', '°F'];
  if (!validUnits.includes(data.unit)) {
    const defaultUnits: Record<string, string> = {
      length: 'cm', weight: 'g', capacity: 'mL', temperature: '°C',
    };
    data.unit = defaultUnits[data.measurementType] || 'cm';
  }

  // Precision step for value alignment
  const precisionStep = data.precision === 'whole' ? 1 : data.precision === 'half' ? 0.5 : 0.25;

  // Challenge validation
  const validChallengeTypes = ['estimate', 'read', 'convert'];
  data.challenges = (data.challenges || []).filter(
    (c: { type: string }) => validChallengeTypes.includes(c.type),
  );

  // Ensure at least 3 challenges
  if (data.challenges.length < 3) {
    data.challenges = [
      {
        id: 'c1', type: 'estimate', objectName: 'Pencil', objectEmoji: '✏️',
        value: 15, targetAnswer: 15, targetUnit: data.unit,
        acceptableMin: 11, acceptableMax: 19,
        hint: 'Think about objects you know — how long is your hand?',
        instruction: 'How long do you think this pencil is?',
      },
      {
        id: 'c2', type: 'read', objectName: 'Eraser', objectEmoji: '🧹',
        value: 5, targetAnswer: 5, targetUnit: data.unit,
        hint: 'Look carefully where the object ends on the ruler!',
        instruction: 'Read the measurement tool to find the exact length of this eraser.',
      },
      {
        id: 'c3', type: 'read', objectName: 'Crayon', objectEmoji: '🖍️',
        value: 9, targetAnswer: 9, targetUnit: data.unit,
        hint: 'Find the number on the ruler where the crayon ends.',
        instruction: 'Use the ruler to measure this crayon. What is its length?',
      },
    ];
  }

  // Sanitize each challenge
  for (const ch of data.challenges) {
    // Ensure value aligns with precision
    ch.value = Math.round(ch.value / precisionStep) * precisionStep;
    if (ch.value <= 0) ch.value = precisionStep;

    // For read challenges, targetAnswer must match value
    if (ch.type === 'read') {
      ch.targetAnswer = ch.value;
    }

    // For estimate challenges, ensure acceptable range exists
    if (ch.type === 'estimate') {
      if (ch.acceptableMin == null) ch.acceptableMin = ch.targetAnswer * 0.75;
      if (ch.acceptableMax == null) ch.acceptableMax = ch.targetAnswer * 1.25;
    }

    // Ensure targetUnit exists
    if (!ch.targetUnit) {
      ch.targetUnit = data.unit;
    }

    // Ensure emoji exists
    if (!ch.objectEmoji) ch.objectEmoji = '📦';
  }

  // Ensure conversionFact is a string
  if (typeof data.conversionFact !== 'string') {
    data.conversionFact = '';
  }

  // Apply explicit config overrides
  if (config) {
    if (config.toolType && validToolTypes.includes(config.toolType)) data.toolType = config.toolType;
    if (config.measurementType && validMeasurementTypes.includes(config.measurementType)) data.measurementType = config.measurementType;
    if (config.gradeBand) data.gradeBand = config.gradeBand;
  }

  return data;
};
