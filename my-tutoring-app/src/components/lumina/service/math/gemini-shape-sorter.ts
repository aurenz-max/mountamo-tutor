import { Type, Schema } from "@google/genai";
import type { ShapeSorterData } from "../../primitives/visual-primitives/math/ShapeSorter";
import { SHAPE_PROPERTIES } from "../../primitives/visual-primitives/math/ShapeSorter";
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
  identify: {
    promptDoc:
      `"identify": Student finds all shapes matching a rule (e.g., "Find all the triangles"). `
      + `Set ruleAttribute to shape/color/sides/curved. Set targetValue to the matching value. `
      + `Include 2-3 matching shapes mixed with distractors (4-8 shapes total). `
      + `K: circle, square, triangle, rectangle. Grade 1: add hexagon, pentagon, diamond, oval.`,
    schemaDescription: "'identify' (find matching shapes)",
  },
  count: {
    promptDoc:
      `"count": Student counts the sides and corners of a single shape. `
      + `Set ruleAttribute to "shape". Set targetValue to the shape name (e.g., "hexagon"). `
      + `Include exactly 1 shape to examine — pick shapes with interesting properties. `
      + `Use warm language ("How many sides and corners does this shape have?").`,
    schemaDescription: "'count' (count sides/corners)",
  },
  sort: {
    promptDoc:
      `"sort": Student groups shapes by a geometric attribute (sides or curved). `
      + `Set ruleAttribute to "sides" or "curved". No targetValue needed. `
      + `Include 4-6 shapes from at least 2 different categories. `
      + `Example: sort by sides → mix triangles (3), squares (4), hexagons (6).`,
    schemaDescription: "'sort' (classify by attribute)",
  },
};

// ---------------------------------------------------------------------------
// Base schema
// ---------------------------------------------------------------------------

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
            description: "Challenge type: 'identify' (find matching shapes), 'count' (count sides/corners), 'sort' (classify by attribute)",
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
  config?: Partial<ShapeSorterData> & {
    /** Target eval mode from the IRT calibration system. */
    targetEvalMode?: string;
  },
): Promise<ShapeSorterData> => {
  // ── Resolve eval mode from the catalog (single source of truth) ──
  const evalConstraint = resolveEvalModeConstraint(
    'shape-sorter',
    config?.targetEvalMode,
    CHALLENGE_TYPE_DOCS,
  );

  // ── Build mode-constrained schema ──
  const activeSchema = evalConstraint
    ? constrainChallengeTypeEnum(shapeSorterSchema, evalConstraint.allowedTypes, CHALLENGE_TYPE_DOCS)
    : shapeSorterSchema;

  // ── Build prompt ──
  const challengeTypeSection = buildChallengeTypePromptSection(evalConstraint, CHALLENGE_TYPE_DOCS);

  const prompt = `
Create a shape sorting activity for teaching "${topic}" to ${gradeLevel} students.

GOAL: Teach Defining Attributes (shape, sides, curved) vs Non-Defining Attributes (color, size, rotation).

SUPPORTED SHAPES: circle, square, triangle, rectangle, diamond, rhombus, hexagon, pentagon, oval
VALID COLORS: red, blue, green, yellow, purple, orange, pink, cyan

${challengeTypeSection}

${!evalConstraint ? `
CHALLENGE PROGRESSION (generate 4-5 challenges):
1. "identify" with ruleAttribute "color" — "Find all the blue shapes" (targetValue: "blue")
2. "identify" with ruleAttribute "shape" — "Find all the triangles" (targetValue: "triangle")
3. "count" with ruleAttribute "shape" — "How many sides and corners?" (targetValue: shape name, e.g. "hexagon")
4. "sort" with ruleAttribute "sides" — "Sort by number of sides" (no targetValue needed)
5. "sort" with ruleAttribute "curved" — "Sort: curved or straight?" (no targetValue needed)

GUIDELINES FOR GRADE LEVELS:
- Kindergarten ("K"): use circle, square, triangle, rectangle. Simple language.
- Grade 1 ("1"): add hexagon, pentagon, diamond, oval. More shapes per challenge.
` : ''}

RULES:
- For EVERY challenge, generate a "shapes" array of 4-8 shapes with varied colors, sizes, and rotations.
- For "identify": include 2-3 shapes matching the target mixed with distractors.
- For "count": include 1 shape (the one to examine). Use a shape with interesting properties.
- For "sort": include 4-6 shapes from at least 2 different categories based on the rule.
- Vary rotation (0-360) to test that students recognize rotated shapes.
${config?.gradeBand ? `\nGrade band: ${config.gradeBand}` : ''}
`;

  logEvalModeResolution('ShapeSorter', config?.targetEvalMode, evalConstraint);

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
    const fallbackType = evalConstraint?.allowedTypes[0] ?? 'identify';
    const fallbacks: Record<string, { id: string; type: string; instruction: string; ruleAttribute: string; targetValue?: string; shapes: Array<{ shape: string; color: string; size: string; rotation: number }> }> = {
      identify: {
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
      count: {
        id: 'c1',
        type: 'count',
        instruction: 'How many sides and corners does this shape have?',
        ruleAttribute: 'shape',
        targetValue: 'hexagon',
        shapes: [
          { shape: 'hexagon', color: 'blue', size: 'large', rotation: 0 },
        ],
      },
      sort: {
        id: 'c1',
        type: 'sort',
        instruction: 'Sort these shapes by the number of sides!',
        ruleAttribute: 'sides',
        shapes: [
          { shape: 'triangle', color: 'red', size: 'medium', rotation: 0 },
          { shape: 'square', color: 'blue', size: 'medium', rotation: 30 },
          { shape: 'hexagon', color: 'green', size: 'large', rotation: 0 },
          { shape: 'pentagon', color: 'yellow', size: 'small', rotation: 15 },
        ],
      },
    };
    console.log(`[ShapeSorter] No valid challenges — using ${fallbackType} fallback`);
    data.challenges = [fallbacks[fallbackType] ?? fallbacks.identify];
  }

  // Final summary log
  const typeBreakdown = (data.challenges as Array<{ type: string }>).map((c: { type: string }) => c.type).join(', ');
  console.log(`[ShapeSorter] Final: ${data.challenges.length} challenge(s) → [${typeBreakdown}]`);

  // Apply config overrides
  if (config?.gradeBand !== undefined) data.gradeBand = config.gradeBand;

  return data;
};
