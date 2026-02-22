import { Type, Schema } from "@google/genai";
import type { ShapeSorterData } from "../../primitives/visual-primitives/math/ShapeSorter";
import { ai } from "../geminiClient";

/**
 * Simplified schema: every challenge has a type, instruction, ruleAttribute,
 * and a unified shapes array. The LLM just picks shapes and rules —
 * correctness (bins, targets, side counts) is derived in code.
 */
const shapeSorterSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    title: { type: Type.STRING, description: "Activity title (e.g., 'Shape Safari!')" },
    description: { type: Type.STRING, description: "Brief educational description" },
    challenges: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.STRING, description: "Unique ID (e.g., 'c1', 'c2')" },
          type: {
            type: Type.STRING,
            description: "Challenge type: 'identify' (find matching shapes), 'count' (count sides/corners of one shape), 'sort' (group shapes by attribute)",
          },
          instruction: {
            type: Type.STRING,
            description: "Student-facing instruction, warm and encouraging",
          },
          ruleAttribute: {
            type: Type.STRING,
            description: "Attribute being tested: 'shape' (name), 'color', 'sides' (number of sides), or 'curved' (curved vs straight)",
          },
          targetValue: {
            type: Type.STRING,
            description: "For 'identify': the value to match (e.g., 'triangle', 'red', '3', 'true'). For 'count': the shape to examine (e.g., 'hexagon'). Omit for 'sort'.",
          },
          shapes: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                shape: {
                  type: Type.STRING,
                  description: "Shape name: circle, square, triangle, rectangle, diamond, rhombus, hexagon, pentagon, oval",
                },
                color: {
                  type: Type.STRING,
                  description: "Color: red, blue, green, yellow, purple, orange, pink, cyan",
                },
                size: {
                  type: Type.STRING,
                  description: "'small', 'medium', or 'large'",
                },
                rotation: {
                  type: Type.NUMBER,
                  description: "Rotation in degrees (0-360). Vary to teach shape constancy.",
                },
              },
              required: ["shape", "color", "size", "rotation"],
            },
            description: "Pool of 4-8 shapes for this challenge. Ensure a good mix of targets and distractors.",
          },
        },
        required: ["id", "type", "instruction", "ruleAttribute", "shapes"],
      },
      description: "Array of 4-5 progressive challenges",
    },
    gradeBand: { type: Type.STRING, description: "Grade band: 'K' or '1'" },
  },
  required: ["title", "description", "challenges", "gradeBand"],
};

// ── Validation constants ─────────────────────────────────────────

const VALID_SHAPES = [
  'circle', 'oval', 'triangle', 'square', 'rectangle',
  'diamond', 'rhombus', 'hexagon', 'pentagon',
];
const VALID_COLORS = ['red', 'blue', 'green', 'yellow', 'purple', 'orange', 'pink', 'cyan'];
const VALID_SIZES = ['small', 'medium', 'large'];
const VALID_TYPES = ['identify', 'count', 'sort'];
const VALID_RULES = ['shape', 'color', 'sides', 'curved'];

// ── Generator ────────────────────────────────────────────────────

export const generateShapeSorter = async (
  topic: string,
  gradeLevel: string,
  config?: Partial<ShapeSorterData>,
): Promise<ShapeSorterData> => {
  const prompt = `
Create a shape sorting activity for teaching "${topic}" to ${gradeLevel} students.

GOAL: Teach Defining Attributes (shape, sides, curved) vs Non-Defining Attributes (color, size, rotation).

SUPPORTED SHAPES: circle, square, triangle, rectangle, diamond, rhombus, hexagon, pentagon, oval
VALID COLORS: red, blue, green, yellow, purple, orange, pink, cyan

CHALLENGE PROGRESSION (generate 4-5 challenges):
1. "identify" with ruleAttribute "color" — "Find all the blue shapes" (targetValue: "blue")
2. "identify" with ruleAttribute "shape" — "Find all the triangles" (targetValue: "triangle")
3. "count" with ruleAttribute "shape" — "How many sides and corners?" (targetValue: shape name, e.g. "hexagon")
4. "sort" with ruleAttribute "sides" — "Sort by number of sides" (no targetValue needed)
5. "sort" with ruleAttribute "curved" — "Sort: curved or straight?" (no targetValue needed)

RULES:
- For EVERY challenge, generate a "shapes" array of 4-8 shapes with varied colors, sizes, and rotations.
- For "identify": include 2-3 shapes matching the target mixed with distractors.
- For "count": include 1 shape (the one to examine). Use a shape with interesting properties.
- For "sort": include 4-6 shapes from at least 2 different categories based on the rule.
- Kindergarten ("K"): use circle, square, triangle, rectangle. Simple language.
- Grade 1 ("1"): add hexagon, pentagon, diamond, oval. More shapes per challenge.
- Vary rotation (0-360) to test that students recognize rotated shapes.
${config?.gradeBand ? `\nGrade band: ${config.gradeBand}` : ''}
`;

  const result = await ai.models.generateContent({
    model: "gemini-flash-lite-latest",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: shapeSorterSchema,
    },
  });

  const data = result.text ? JSON.parse(result.text) : null;
  if (!data) {
    throw new Error('No valid shape sorter data returned from Gemini API');
  }

  // ── Validation & Defaults ────────────────────────────────────────

  if (data.gradeBand !== 'K' && data.gradeBand !== '1') {
    data.gradeBand = gradeLevel.toLowerCase().includes('kinder') ? 'K' : '1';
  }

  // Filter to valid challenge types
  data.challenges = (data.challenges || []).filter(
    (c: { type: string }) => VALID_TYPES.includes(c.type),
  );

  const seenIds = new Set<string>();
  for (let i = 0; i < data.challenges.length; i++) {
    const ch = data.challenges[i];

    // Unique ID
    if (!ch.id || seenIds.has(ch.id)) ch.id = `c${i + 1}`;
    seenIds.add(ch.id);

    // Validate ruleAttribute
    if (!VALID_RULES.includes(ch.ruleAttribute)) ch.ruleAttribute = 'shape';

    // Validate shapes
    if (!Array.isArray(ch.shapes) || ch.shapes.length === 0) {
      ch.shapes = [
        { shape: 'circle', color: 'red', size: 'medium', rotation: 0 },
        { shape: 'square', color: 'blue', size: 'medium', rotation: 0 },
        { shape: 'triangle', color: 'green', size: 'large', rotation: 45 },
        { shape: 'rectangle', color: 'yellow', size: 'small', rotation: 0 },
      ];
    }

    for (const s of ch.shapes) {
      if (!VALID_SHAPES.includes(s.shape)) s.shape = 'circle';
      if (!VALID_COLORS.includes(s.color)) s.color = 'blue';
      if (!VALID_SIZES.includes(s.size)) s.size = 'medium';
      if (typeof s.rotation !== 'number') s.rotation = 0;
    }

    // For count challenges, ensure exactly 1 shape matching targetValue
    if (ch.type === 'count') {
      if (!ch.targetValue || !VALID_SHAPES.includes(ch.targetValue)) {
        ch.targetValue = ch.shapes[0].shape;
      }
      // Keep only the first shape matching targetValue (or just shapes[0])
      const match = ch.shapes.find((s: { shape: string }) => s.shape === ch.targetValue);
      ch.shapes = [match || ch.shapes[0]];
    }

    // For identify, ensure targetValue is valid for the rule
    if (ch.type === 'identify' && !ch.targetValue) {
      ch.targetValue = ch.ruleAttribute === 'color' ? ch.shapes[0].color : ch.shapes[0].shape;
    }
  }

  // Ensure at least one challenge
  if (data.challenges.length === 0) {
    data.challenges = [
      {
        id: 'c1',
        type: 'identify',
        instruction: 'Can you find all the circles? Tap each one!',
        ruleAttribute: 'shape',
        targetValue: 'circle',
        shapes: [
          { shape: 'circle', color: 'red', size: 'medium', rotation: 0 },
          { shape: 'square', color: 'blue', size: 'medium', rotation: 0 },
          { shape: 'circle', color: 'green', size: 'small', rotation: 0 },
          { shape: 'triangle', color: 'yellow', size: 'large', rotation: 45 },
          { shape: 'circle', color: 'purple', size: 'large', rotation: 0 },
        ],
      },
    ];
  }

  // Apply config overrides
  if (config?.gradeBand !== undefined) data.gradeBand = config.gradeBand;

  return data;
};
