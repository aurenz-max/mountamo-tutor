import { Type, Schema } from "@google/genai";
import { MeasurementToolsData } from "../../primitives/visual-primitives/math/MeasurementTools";
import { ai } from "../geminiClient";

/**
 * Schema definition for Measurement Tools Data
 *
 * This schema defines the structure for measurement activities,
 * including tool selection, estimation, precision reading,
 * and unit conversion for grades 1-5.
 */
const measurementToolsSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    toolType: {
      type: Type.STRING,
      description: "Tool type: 'ruler', 'tape_measure', 'scale', 'balance', 'measuring_cup', 'thermometer'"
    },
    measurementType: {
      type: Type.STRING,
      description: "Measurement type: 'length', 'weight', 'capacity', 'temperature'"
    },
    unit: {
      type: Type.OBJECT,
      properties: {
        primary: {
          type: Type.STRING,
          description: "Primary unit: 'cm', 'm', 'in', 'ft', 'g', 'kg', 'lb', 'mL', 'L', 'cup', '°C', '°F'"
        },
        secondary: {
          type: Type.STRING,
          description: "Secondary unit for conversion (e.g., if primary is 'cm', secondary might be 'm'). Null if no conversion."
        },
        precision: {
          type: Type.STRING,
          description: "Precision: 'whole', 'half', 'quarter', 'tenth'"
        }
      },
      required: ["primary", "precision"]
    },
    objectToMeasure: {
      type: Type.OBJECT,
      properties: {
        name: {
          type: Type.STRING,
          description: "Name of the object to measure (e.g., 'Pencil', 'Watermelon', 'Glass of Water')"
        },
        actualValue: {
          type: Type.NUMBER,
          description: "The true measurement value of the object"
        },
        imagePrompt: {
          type: Type.STRING,
          description: "Description for AI image generation of the object"
        },
        category: {
          type: Type.STRING,
          description: "Category: 'school', 'kitchen', 'nature', 'sports', 'animals'"
        }
      },
      required: ["name", "actualValue", "imagePrompt", "category"]
    },
    challenges: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          id: {
            type: Type.STRING,
            description: "Unique challenge ID (e.g., 'c1', 'c2')"
          },
          type: {
            type: Type.STRING,
            description: "Challenge type: 'measure', 'estimate', 'compare', 'convert', 'choose_tool', 'choose_unit'"
          },
          instruction: {
            type: Type.STRING,
            description: "Student-facing instruction, warm and encouraging"
          },
          targetAnswer: {
            type: Type.NUMBER,
            description: "The correct answer (numeric value)"
          },
          acceptableRange: {
            type: Type.OBJECT,
            properties: {
              min: { type: Type.NUMBER, description: "Minimum acceptable answer" },
              max: { type: Type.NUMBER, description: "Maximum acceptable answer" }
            },
            required: ["min", "max"]
          },
          hint: {
            type: Type.STRING,
            description: "Hint text shown after incorrect attempts"
          },
          narration: {
            type: Type.STRING,
            description: "AI narration for this challenge"
          }
        },
        required: ["id", "type", "instruction", "targetAnswer", "hint", "narration"]
      },
      description: "Array of 3-5 progressive measurement challenges"
    },
    nonStandardUnits: {
      type: Type.OBJECT,
      properties: {
        enabled: {
          type: Type.BOOLEAN,
          description: "Whether to use non-standard units (for grade 1)"
        },
        unitName: {
          type: Type.STRING,
          description: "Name of non-standard unit (e.g., 'paper clips', 'hand spans')"
        },
        unitLength: {
          type: Type.NUMBER,
          description: "Length of one non-standard unit in cm"
        }
      },
      required: ["enabled", "unitName", "unitLength"]
    },
    conversionReference: {
      type: Type.OBJECT,
      properties: {
        enabled: {
          type: Type.BOOLEAN,
          description: "Whether to show conversion reference"
        },
        conversions: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              from: { type: Type.STRING, description: "Source unit" },
              to: { type: Type.STRING, description: "Target unit" },
              factor: { type: Type.NUMBER, description: "Conversion factor" },
              description: { type: Type.STRING, description: "Description of conversion" }
            },
            required: ["from", "to", "factor", "description"]
          }
        }
      },
      required: ["enabled"]
    },
    imagePrompt: {
      type: Type.STRING,
      description: "Image prompt for the measurement context illustration"
    },
    gradeBand: {
      type: Type.STRING,
      description: "Grade band: '1-2' or '3-5'"
    }
  },
  required: ["toolType", "measurementType", "unit", "objectToMeasure", "challenges", "gradeBand"]
};

/**
 * Generate measurement tools data for interactive measurement activities
 *
 * Grade-aware content:
 * - Grades 1-2: Non-standard units, compare longer/shorter/heavier/lighter,
 *   standard units (inches/cm, pounds/kg), estimate then measure
 * - Grades 3-5: Units within a system (cm→m, g→kg, mL→L), half/quarter precision,
 *   convert within metric/customary, multi-step problems, choose appropriate unit
 *
 * @param topic - The math topic or concept
 * @param gradeLevel - Grade level for age-appropriate content
 * @param config - Optional configuration hints from the manifest
 * @returns MeasurementToolsData with complete configuration
 */
export const generateMeasurementTools = async (
  topic: string,
  gradeLevel: string,
  config?: {
    toolType?: string;
    measurementType?: string;
    unit?: string;
    objectCategory?: string;
    gradeBand?: '1-2' | '3-5';
    challengeTypes?: string[];
    includeConversion?: boolean;
    useNonStandard?: boolean;
  }
): Promise<MeasurementToolsData> => {
  const prompt = `
Create an educational measurement activity for teaching "${topic}" to ${gradeLevel} students.

CONTEXT:
- Students use virtual measurement tools (rulers, scales, measuring cups, thermometers) to measure objects
- Key skills: choosing tools, estimating, reading instruments, unit conversion
- Students estimate FIRST, then measure to check their estimate

GUIDELINES FOR GRADE LEVELS:

Grades 1-2 (gradeBand "1-2"):
- Grade 1: Non-standard units (paper clips, hand spans), compare longer/shorter, heavier/lighter
- Grade 2: Standard units (inches/cm for length, pounds/kg for weight), estimate then measure
- Use simple, fun objects kids can relate to (pencils, apples, books, toys)
- Focus on measure and estimate challenges, maybe one compare
- Precision: "whole" only
- Set nonStandardUnits.enabled = true for grade 1 content
- No conversion challenges

Grades 3-5 (gradeBand "3-5"):
- Grade 3: Units within a system (cm→m, g→kg, mL→L), half-inch/half-cm precision
- Grade 4: Larger/smaller units, convert within metric, two-step problems
- Grade 5: Convert within customary system, choose most appropriate unit, multi-step
- Use more varied objects (kitchen ingredients, sports equipment, science materials)
- Include estimate, measure, convert, choose_tool, and choose_unit challenges
- Precision: "half" or "quarter" for grades 3-4, up to "tenth" for grade 5
- Set conversionReference.enabled = true with relevant conversion facts

TOOL TYPE GUIDELINES:
- ruler/tape_measure → length measurements (cm, m, in, ft)
- scale/balance → weight measurements (g, kg, lb)
- measuring_cup → capacity measurements (mL, L, cup)
- thermometer → temperature measurements (°C, °F)

CHALLENGE TYPES:
- "measure": Use the tool to find the measurement. targetAnswer = actualValue.
- "estimate": Look at the object and guess its measurement. acceptableRange = ±20%.
- "compare": Which is longer/heavier/more? targetAnswer = count of larger.
- "convert": Given a measurement in one unit, convert to another. targetAnswer = converted value.
- "choose_tool": Which tool would you use to measure this? targetAnswer = tool name string as number (use ruler=1, scale=2, measuring_cup=3, thermometer=4).
- "choose_unit": Which unit is most appropriate? targetAnswer = unit identifier as number.

${config ? `
CONFIGURATION HINTS:
${config.toolType ? `- Tool type: ${config.toolType}` : ''}
${config.measurementType ? `- Measurement type: ${config.measurementType}` : ''}
${config.unit ? `- Unit: ${config.unit}` : ''}
${config.objectCategory ? `- Object category: ${config.objectCategory}` : ''}
${config.gradeBand ? `- Grade band: ${config.gradeBand}` : ''}
${config.challengeTypes ? `- Challenge types: ${config.challengeTypes.join(', ')}` : ''}
${config.includeConversion !== undefined ? `- Include conversion: ${config.includeConversion}` : ''}
${config.useNonStandard !== undefined ? `- Use non-standard units: ${config.useNonStandard}` : ''}
` : ''}

REQUIREMENTS:
1. Generate 3-5 challenges that progress in difficulty
2. Start with easier challenges (estimate, simple measure) and build to harder (convert, choose_tool)
3. Use warm, encouraging instruction text
4. Object's actualValue must be a realistic measurement for the object
5. For estimate challenges, set acceptableRange to ±15-25% of actualValue
6. For convert challenges, targetAnswer must be mathematically correct
7. Include meaningful hints that guide without giving the answer
8. Include narration text the AI tutor can use
9. Tool type must match measurement type (ruler→length, scale→weight, etc.)
10. If unit.secondary is set, include at least one conversion challenge
11. Choose a fun, relatable object appropriate for the grade level

Return the complete measurement tools configuration.
`;

  const result = await ai.models.generateContent({
    model: "gemini-flash-lite-latest",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: measurementToolsSchema
    },
  });

  const data = result.text ? JSON.parse(result.text) : null;

  if (!data) {
    throw new Error('No valid measurement tools data returned from Gemini API');
  }

  // Validation: ensure toolType is valid
  const validToolTypes = ['ruler', 'tape_measure', 'scale', 'balance', 'measuring_cup', 'thermometer'];
  if (!validToolTypes.includes(data.toolType)) {
    data.toolType = 'ruler';
  }

  // Validation: ensure measurementType is valid
  const validMeasurementTypes = ['length', 'weight', 'capacity', 'temperature'];
  if (!validMeasurementTypes.includes(data.measurementType)) {
    data.measurementType = 'length';
  }

  // Validation: ensure tool matches measurement type
  const toolToType: Record<string, string> = {
    ruler: 'length', tape_measure: 'length',
    scale: 'weight', balance: 'weight',
    measuring_cup: 'capacity',
    thermometer: 'temperature',
  };
  if (toolToType[data.toolType] !== data.measurementType) {
    // Fix the mismatch: adjust tool to match measurement type
    const typeToTool: Record<string, string> = {
      length: 'ruler', weight: 'scale', capacity: 'measuring_cup', temperature: 'thermometer',
    };
    data.toolType = typeToTool[data.measurementType] || 'ruler';
  }

  // Validation: ensure gradeBand is valid
  if (data.gradeBand !== '1-2' && data.gradeBand !== '3-5') {
    data.gradeBand = gradeLevel.toLowerCase().includes('kinder') || gradeLevel.includes('1') || gradeLevel.includes('2')
      ? '1-2' : '3-5';
  }

  // Validation: ensure precision is valid
  const validPrecisions = ['whole', 'half', 'quarter', 'tenth'];
  if (!validPrecisions.includes(data.unit?.precision)) {
    data.unit = { ...data.unit, precision: data.gradeBand === '1-2' ? 'whole' : 'half' };
  }

  // Ensure valid unit
  const validUnits = ['cm', 'm', 'in', 'ft', 'g', 'kg', 'lb', 'mL', 'L', 'cup', '°C', '°F'];
  if (!validUnits.includes(data.unit?.primary)) {
    const defaultUnits: Record<string, string> = {
      length: 'cm', weight: 'g', capacity: 'mL', temperature: '°C',
    };
    data.unit = { ...data.unit, primary: defaultUnits[data.measurementType] || 'cm' };
  }

  // Ensure challenges have valid types
  const validChallengeTypes = ['measure', 'estimate', 'compare', 'convert', 'choose_tool', 'choose_unit'];
  data.challenges = (data.challenges || []).filter(
    (c: { type: string }) => validChallengeTypes.includes(c.type)
  );

  // Ensure at least one challenge
  if (data.challenges.length === 0) {
    data.challenges = [{
      id: 'c1',
      type: 'measure',
      instruction: `Can you measure the ${data.objectToMeasure?.name || 'object'}?`,
      targetAnswer: data.objectToMeasure?.actualValue || 10,
      hint: 'Read the measurement tool carefully!',
      narration: "Let's measure this together! Use the tool to find the value.",
    }];
  }

  // Ensure actualValue is positive
  if (!data.objectToMeasure?.actualValue || data.objectToMeasure.actualValue <= 0) {
    data.objectToMeasure = { ...data.objectToMeasure, actualValue: 10 };
  }

  // Ensure valid object category
  const validCategories = ['school', 'kitchen', 'nature', 'sports', 'animals'];
  if (!validCategories.includes(data.objectToMeasure?.category)) {
    data.objectToMeasure = { ...data.objectToMeasure, category: 'school' };
  }

  // Set nonStandardUnits defaults
  if (!data.nonStandardUnits) {
    data.nonStandardUnits = { enabled: false, unitName: 'paper clips', unitLength: 3 };
  }

  // Set conversionReference defaults
  if (!data.conversionReference) {
    data.conversionReference = { enabled: false, conversions: [] };
  }

  // Apply explicit config overrides
  if (config) {
    if (config.toolType !== undefined) data.toolType = config.toolType;
    if (config.measurementType !== undefined) data.measurementType = config.measurementType;
    if (config.gradeBand !== undefined) data.gradeBand = config.gradeBand;
  }

  return data;
};
