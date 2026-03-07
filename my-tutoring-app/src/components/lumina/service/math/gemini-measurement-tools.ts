import { Type, Schema } from "@google/genai";
import { MeasurementToolsData, MeasurementShape } from "../../primitives/visual-primitives/math/MeasurementTools";
import { ai } from "../geminiClient";

/**
 * Gemini schema for the new MeasurementTools shape-based interface.
 * 2 types (outer object + shape array item) to stay within Gemini's
 * reliable JSON generation limits.
 */
const measurementToolsSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    title: {
      type: Type.STRING,
      description: "Short activity title, e.g. 'Measure the Shapes'",
    },
    rulerLengthInches: {
      type: Type.NUMBER,
      description: "Total ruler length in inches (must be >= largest shape width). Typically 12.",
    },
    unit: {
      type: Type.STRING,
      description: "One of: 'inches', 'centimeters'",
    },
    precision: {
      type: Type.STRING,
      description: "One of: 'whole', 'half'",
    },
    gradeBand: {
      type: Type.STRING,
      description: "One of: 'K-2', '3-5'",
    },
    shapes: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.STRING, description: "Unique ID, e.g. 's1', 's2'" },
          type: { type: Type.STRING, description: "One of: 'rectangle', 'square'" },
          widthInches: { type: Type.NUMBER, description: "Width of the shape in inches (the measurement the student must find)" },
          heightInches: { type: Type.NUMBER, description: "Visual height in inches (1-2, just for display)" },
          color: { type: Type.STRING, description: "Fill color in rgba format, e.g. 'rgba(99,102,241,0.35)'" },
          label: { type: Type.STRING, description: "Descriptive label, e.g. 'Blue Rectangle', 'Red Square'" },
          hint: { type: Type.STRING, description: "Helpful hint that guides without revealing the answer" },
        },
        required: ["id", "type", "widthInches", "heightInches", "color", "label", "hint"],
      },
      description: "Array of 3-5 shapes to measure",
    },
  },
  required: ["title", "rulerLengthInches", "unit", "precision", "gradeBand", "shapes"],
};

/**
 * Generate measurement tools data for interactive ruler-based measurement.
 *
 * Students drag colored shapes onto a ruler and read the width.
 */
export const generateMeasurementTools = async (
  topic: string,
  gradeLevel: string,
  config?: {
    unit?: 'inches' | 'centimeters';
    precision?: 'whole' | 'half';
    gradeBand?: 'K-2' | '3-5';
  },
): Promise<MeasurementToolsData> => {
  const prompt = `
Create a measurement activity for teaching "${topic}" to ${gradeLevel} students.

THE STUDENT EXPERIENCE:
- Students see colored shapes (rectangles and squares) in a holding area.
- They drag each shape onto a horizontal ruler that starts at 0.
- The shape's LEFT edge aligns with 0 on the ruler.
- They read where the RIGHT edge falls on the ruler to determine the width.
- They type their answer (in the specified unit).

SHAPE REQUIREMENTS:
- Generate 3 to 5 shapes (mix of 'rectangle' and 'square' types).
- Each shape needs a unique widthInches — this is the measurement the student must find.
- heightInches should be small (1 to 2 inches) — it's only for visual display height.
- For squares, widthInches and heightInches should be equal.
- Each shape must have a DIFFERENT color using rgba format (e.g. 'rgba(99,102,241,0.35)').
- Each shape needs a descriptive label like "Blue Rectangle" or "Red Square".
- Each shape needs a hint that helps the student read the ruler without revealing the answer.

GRADE GUIDELINES:
${config?.gradeBand === '3-5' || (!config?.gradeBand && !gradeLevel.toLowerCase().includes('kinder') && !gradeLevel.includes('1') && !gradeLevel.includes('2')) ? `
- Grades 3-5 (gradeBand "3-5"):
  - precision: "half" — widths can be multiples of 0.5 (e.g. 2.5, 3.0, 4.5, 7.0)
  - Use widths from 2 to 10 inches
  - More varied shape names
` : `
- Grades K-2 (gradeBand "K-2"):
  - precision: "whole" — widths must be whole numbers only (e.g. 2, 3, 5, 8)
  - Use widths from 1 to 8 inches
  - Simple, friendly shape names
`}

RULER:
- rulerLengthInches should be large enough to fit the widest shape. Use 12 for most cases.

CRITICAL RULES:
1. Each shape must have a DIFFERENT widthInches — no two shapes should be the same width.
2. widthInches must match the precision: whole numbers only for "whole", multiples of 0.5 for "half".
3. widthInches must be LESS THAN rulerLengthInches.
4. Use 5 distinct rgba colors (vary hue: blue, red, green, purple, amber, teal, etc.).
5. Hints should reference the ruler (e.g. "Count the tick marks carefully") without giving the number.
6. Order shapes from smallest width to largest.

${config ? `
CONFIGURATION:
${config.unit ? `- Unit: ${config.unit}` : ''}
${config.precision ? `- Precision: ${config.precision}` : ''}
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

  // Grade band
  if (data.gradeBand !== 'K-2' && data.gradeBand !== '3-5') {
    data.gradeBand = gradeLevel.toLowerCase().includes('kinder') || gradeLevel.includes('1') || gradeLevel.includes('2')
      ? 'K-2' : '3-5';
  }

  // Precision
  if (data.precision !== 'whole' && data.precision !== 'half') {
    data.precision = data.gradeBand === 'K-2' ? 'whole' : 'half';
  }

  // Unit
  if (data.unit !== 'inches' && data.unit !== 'centimeters') {
    data.unit = 'inches';
  }

  // Precision step for value alignment
  const precisionStep = data.precision === 'whole' ? 1 : 0.5;

  // Title fallback
  if (!data.title || typeof data.title !== 'string') {
    data.title = 'Measure the Shapes';
  }

  // Ensure shapes array exists and has valid entries
  const validShapeTypes = ['rectangle', 'square'];
  data.shapes = (data.shapes || []).filter(
    (s: MeasurementShape) => validShapeTypes.includes(s.type),
  );

  // Fallback shapes if Gemini returned too few
  if (data.shapes.length < 3) {
    data.shapes = [
      {
        id: 's1', type: 'rectangle' as const, widthInches: 3, heightInches: 1.5,
        color: 'rgba(99,102,241,0.35)', label: 'Blue Rectangle',
        hint: 'Look where the right edge of the shape lines up on the ruler.',
      },
      {
        id: 's2', type: 'square' as const, widthInches: 2, heightInches: 2,
        color: 'rgba(239,68,68,0.35)', label: 'Red Square',
        hint: 'Count the big tick marks from 0 to the edge.',
      },
      {
        id: 's3', type: 'rectangle' as const, widthInches: 5, heightInches: 1,
        color: 'rgba(16,185,129,0.35)', label: 'Green Rectangle',
        hint: 'Find the number on the ruler where the shape ends.',
      },
    ] satisfies MeasurementShape[];
  }

  // Sanitize each shape
  for (const shape of data.shapes as MeasurementShape[]) {
    // Ensure type is valid
    if (!validShapeTypes.includes(shape.type)) {
      shape.type = 'rectangle';
    }

    // Align widthInches to precision step
    shape.widthInches = Math.round(shape.widthInches / precisionStep) * precisionStep;
    if (shape.widthInches <= 0) shape.widthInches = precisionStep;

    // Clamp heightInches to 1-2 range
    if (typeof shape.heightInches !== 'number' || shape.heightInches <= 0) {
      shape.heightInches = shape.type === 'square' ? shape.widthInches : 1.5;
    }
    if (shape.type === 'square') {
      shape.heightInches = shape.widthInches;
    } else {
      shape.heightInches = Math.max(1, Math.min(2, shape.heightInches));
    }

    // Ensure color is an rgba string
    if (!shape.color || typeof shape.color !== 'string' || !shape.color.startsWith('rgba')) {
      shape.color = 'rgba(99,102,241,0.35)';
    }

    // Ensure label and hint
    if (!shape.label) shape.label = shape.type === 'square' ? 'Square' : 'Rectangle';
    if (!shape.hint) shape.hint = 'Look carefully at the ruler markings.';
  }

  // Ensure rulerLengthInches is large enough
  const maxWidth = Math.max(...(data.shapes as MeasurementShape[]).map((s: MeasurementShape) => s.widthInches));
  if (typeof data.rulerLengthInches !== 'number' || data.rulerLengthInches <= maxWidth) {
    data.rulerLengthInches = Math.max(12, Math.ceil(maxWidth + 2));
  }

  // Apply explicit config overrides
  if (config) {
    if (config.unit) data.unit = config.unit;
    if (config.precision) data.precision = config.precision;
    if (config.gradeBand) data.gradeBand = config.gradeBand;
  }

  return data as MeasurementToolsData;
};
