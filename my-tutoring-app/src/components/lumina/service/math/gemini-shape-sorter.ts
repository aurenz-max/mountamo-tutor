import { Type, Schema } from "@google/genai";
import type { ShapeSorterData } from "../../primitives/visual-primitives/math/ShapeSorter";
import { SHAPE_PROPERTIES } from "../../primitives/visual-primitives/math/ShapeSorter";
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
            enum: ['identify', 'count', 'sort'],
            description: "Challenge type: identify (find matching shapes), count (count sides/corners of one shape), sort (group shapes by attribute)",
          },
          instruction: {
            type: Type.STRING,
            description: "Student-facing instruction, warm and encouraging",
          },
          ruleAttribute: {
            type: Type.STRING,
            enum: ['shape', 'color', 'sides', 'curved'],
            description: "Attribute being tested. Must be one of: shape, color, sides, curved",
          },
          targetValue: {
            type: Type.STRING,
            description: "For 'identify': the value to match — must be EXACTLY one of: shape name (circle/oval/triangle/square/rectangle/diamond/rhombus/hexagon/pentagon), color name (red/blue/green/yellow/purple/orange/pink/cyan), side count as digit ('0','3','4','5','6'), or 'true'/'false' for curved. For 'count': the shape name to examine. Omit for 'sort'.",
          },
          shapes: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                shape: {
                  type: Type.STRING,
                  enum: ['circle', 'oval', 'triangle', 'square', 'rectangle', 'diamond', 'rhombus', 'hexagon', 'pentagon'],
                  description: "Shape name",
                },
                color: {
                  type: Type.STRING,
                  enum: ['red', 'blue', 'green', 'yellow', 'purple', 'orange', 'pink', 'cyan'],
                  description: "Shape color",
                },
                size: {
                  type: Type.STRING,
                  enum: ['small', 'medium', 'large'],
                  description: "Shape size",
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
    gradeBand: { type: Type.STRING, enum: ['K', '1'], description: "Grade band" },
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

    // For identify, ensure targetValue is valid for the ruleAttribute.
    // Enums handle shape/color/type/size, but targetValue is a free string
    // whose valid domain depends on ruleAttribute — normalize it here.
    if (ch.type === 'identify') {
      const tv = (ch.targetValue ?? '').toString().trim().toLowerCase();

      switch (ch.ruleAttribute) {
        case 'shape':
          ch.targetValue = VALID_SHAPES.includes(tv) ? tv : ch.shapes[0].shape;
          break;
        case 'color':
          ch.targetValue = VALID_COLORS.includes(tv) ? tv : ch.shapes[0].color;
          break;
        case 'sides': {
          // Accept "3", "three", "3 sides" → extract the digit
          const digitMatch = tv.match(/\d+/);
          const wordMap: Record<string, string> = {
            zero: '0', three: '3', four: '4', five: '5', six: '6',
          };
          ch.targetValue = digitMatch?.[0]
            ?? wordMap[tv]
            ?? String(SHAPE_PROPERTIES[ch.shapes[0].shape]?.sides ?? 3);
          break;
        }
        case 'curved':
          ch.targetValue = String(['true', 'yes', 'curved'].includes(tv));
          break;
        default:
          ch.targetValue = ch.shapes[0].shape;
      }

      // Guarantee at least one shape actually matches the resolved target
      const hasMatch = ch.shapes.some((s: { shape: string; color: string }) => {
        const props = SHAPE_PROPERTIES[s.shape];
        switch (ch.ruleAttribute) {
          case 'shape':  return s.shape === ch.targetValue;
          case 'color':  return s.color === ch.targetValue;
          case 'sides':  return String(props?.sides ?? -1) === ch.targetValue;
          case 'curved': return String(props?.curved ?? false) === ch.targetValue;
          default:       return false;
        }
      });
      if (!hasMatch) {
        // Derive targetValue from the first shape so instruction ↔ target stay coherent
        const first = ch.shapes[0];
        const firstProps = SHAPE_PROPERTIES[first.shape];
        switch (ch.ruleAttribute) {
          case 'shape':  ch.targetValue = first.shape; break;
          case 'color':  ch.targetValue = first.color; break;
          case 'sides':  ch.targetValue = String(firstProps?.sides ?? 3); break;
          case 'curved': ch.targetValue = String(firstProps?.curved ?? false); break;
        }
        // Rewrite instruction to match the corrected target
        const friendlyTarget = ch.ruleAttribute === 'sides'
          ? `shapes with ${ch.targetValue} sides`
          : ch.ruleAttribute === 'curved'
            ? (ch.targetValue === 'true' ? 'curved shapes' : 'straight shapes')
            : `${ch.targetValue} shapes`;
        ch.instruction = `Can you find all the ${friendlyTarget}? Tap each one!`;
      }
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
