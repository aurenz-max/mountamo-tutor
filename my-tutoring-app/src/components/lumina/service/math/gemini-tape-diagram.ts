import { Type, Schema, ThinkingLevel } from "@google/genai";
import { TapeDiagramData, BarConfig, BarSegment } from "../../primitives/visual-primitives/math/TapeDiagram";
import { ai } from "../geminiClient";

/**
 * Schema definition for Tape Diagram / Bar Model Data
 *
 * This schema defines the structure for tape diagram visualization,
 * including bars, segments, labels, and comparison modes.
 */
const barSegmentSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    value: {
      type: Type.NUMBER,
      description: "Numeric value of this segment (optional if unknown)",
      nullable: true
    },
    label: {
      type: Type.STRING,
      description: "Text label for this segment (e.g., 'apples', 'x', '5', 'unknown')"
    },
    isUnknown: {
      type: Type.BOOLEAN,
      description: "Mark as true for unknown/variable segments to solve for. Shows '?' with dashed border",
      nullable: true
    }
  },
  required: ["label"]
};

const barConfigSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    segments: {
      type: Type.ARRAY,
      items: barSegmentSchema,
      description: "Array of segments that make up this bar. Each segment can have a value, label, and unknown status"
    },
    totalLabel: {
      type: Type.STRING,
      description: "Label for the entire bar shown in bracket above (e.g., 'Total', '24', 'x + 5')",
      nullable: true
    },
    color: {
      type: Type.STRING,
      description: "Custom gradient color class (optional, auto-assigned if not provided)",
      nullable: true
    }
  },
  required: ["segments"]
};

const tapeDiagramSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    title: {
      type: Type.STRING,
      description: "Title for the tape diagram (e.g., 'Part-Part-Whole: Total = 24')"
    },
    description: {
      type: Type.STRING,
      description: "Educational description explaining what students will learn from this visualization"
    },
    bars: {
      type: Type.ARRAY,
      items: barConfigSchema,
      description: "Array of bar configurations. Use 1 bar for part-whole, 2+ bars for comparison"
    },
    comparisonMode: {
      type: Type.BOOLEAN,
      description: "Align bars for side-by-side comparison (true for comparing quantities). Default: false",
      nullable: true
    },
    showBrackets: {
      type: Type.BOOLEAN,
      description: "Display brackets with total labels above bars. Default: true",
      nullable: true
    },
    unknownSegment: {
      type: Type.NUMBER,
      description: "Index of segment marked as unknown (deprecated - use segment.isUnknown instead)",
      nullable: true
    }
  },
  required: ["title", "description", "bars"]
};

/**
 * Generate tape diagram data for visualization
 *
 * This function creates tape diagram data including:
 * - Appropriate number of bars based on the problem type
 * - Segments with values and labels
 * - Unknown segments for algebra problems
 * - Comparison alignment for multi-step problems
 * - Educational context and descriptions
 *
 * @param topic - The math topic or word problem to visualize
 * @param gradeLevel - Grade level for age-appropriate content
 * @param config - Optional configuration hints from the manifest
 * @returns TapeDiagramData with complete configuration
 */
export const generateTapeDiagram = async (
  topic: string,
  gradeLevel: string,
  config?: {
    bars?: number;
    comparisonMode?: boolean;
    showBrackets?: boolean;
  }
): Promise<TapeDiagramData> => {
  const prompt = `
Create an educational tape diagram (bar model) visualization for teaching "${topic}" to ${gradeLevel} students.

CONTEXT:
- Tape diagrams are rectangular bars divided into labeled segments
- They represent part-part-whole and comparison relationships
- Essential for word problem solving from elementary through algebra
- Students can visualize quantities, operations, and unknowns

GUIDELINES FOR GRADE LEVELS:
- Grades 1-3: Simple part-whole (2-3 segments), basic addition/subtraction word problems
- Grades 2-4: Comparison problems (2 bars), simple multiplication/division
- Grades 3-6: Multi-step word problems (2-3 bars), ratios, fractions
- Grades 6-7: Ratio and proportion (2 bars with equivalent segments)
- Grades 6-Algebra: Algebraic equation setup with variables, multi-step equations

TOPIC-SPECIFIC GUIDANCE:
- "Part-part-whole": 1 bar with 2-3 segments, show total with bracket
- "Comparison word problems": 2 bars aligned vertically, one shorter/longer than the other
- "Addition word problems": 1 bar partitioned by addends, total label
- "Subtraction word problems": 1 bar showing whole and parts, unknown segment
- "Multiplication word problems": 1 bar with equal groups/parts
- "Division word problems": 1 bar divided into equal unknown parts
- "Multi-step problems": 2-3 bars showing different quantities/steps
- "Ratio and proportion": 2 bars with proportional segments, enable comparison mode
- "Algebraic equations": Use 1-2 bars with variable segments (isUnknown: true, label: "x" or "?")

BAR MODEL PROBLEM TYPES:
1. Part-Part-Whole (1 bar):
   - Segments: individual parts
   - Total: sum shown in bracket
   - Example: "John has 5 apples and 7 oranges. How many fruits total?"
     → 1 bar, segments: [{value: 5, label: "apples"}, {value: 7, label: "oranges"}], totalLabel: "Total = ?"

2. Comparison (2 bars):
   - Bar 1: First quantity
   - Bar 2: Second quantity (longer/shorter)
   - Example: "Maria has 12 marbles. John has 5 more than Maria. How many does John have?"
     → Bar 1: segments: [{value: 12, label: "Maria"}]
     → Bar 2: segments: [{value: 12, label: "same as Maria"}, {value: 5, label: "5 more"}]
     → comparisonMode: true

3. Unknown Part (1 bar with unknown segment):
   - Known segments + 1 unknown segment (isUnknown: true)
   - Example: "A box has 20 candies. 8 are chocolate. How many are not chocolate?"
     → segments: [{value: 8, label: "chocolate"}, {isUnknown: true, label: "not chocolate"}]
     → totalLabel: "Total = 20"

4. Algebraic (variable segments):
   - Use isUnknown: true for variable segments
   - Label with "x", "y", or descriptive variable name
   - Example: "The sum of x and 7 equals 15"
     → segments: [{isUnknown: true, label: "x"}, {value: 7, label: "7"}]
     → totalLabel: "Total = 15"

SEGMENT CONFIGURATION:
- Each segment has: value (number or omit if unknown), label (string), isUnknown (boolean)
- For known values: {value: 5, label: "5 apples"}
- For unknowns: {isUnknown: true, label: "?"}
- For variables: {isUnknown: true, label: "x"}

${config ? `
CONFIGURATION HINTS:
${config.bars !== undefined ? `- Number of bars: ${config.bars}` : ''}
${config.comparisonMode !== undefined ? `- Comparison mode: ${config.comparisonMode}` : ''}
${config.showBrackets !== undefined ? `- Show brackets: ${config.showBrackets}` : ''}
` : ''}

REQUIREMENTS:
1. Choose appropriate number of bars based on problem type (1 for part-whole, 2+ for comparison)
2. Create segments with clear labels (avoid generic "Segment 1", use meaningful labels)
3. Use isUnknown: true for segments that represent unknowns or variables
4. Set totalLabel for bars where showing the total is educational
5. Enable comparisonMode for problems comparing two or more quantities
6. Write a clear, student-friendly title that describes the problem
7. Provide an educational description of what students will learn
8. Keep segment counts reasonable (2-5 segments per bar for elementary, up to 8 for advanced)

IMPORTANT:
- For single quantity problems: 1 bar with segments
- For comparing two quantities: 2 bars with comparisonMode: true
- For multi-step problems: 2-3 bars showing progression
- Always use meaningful labels (not "Segment 1", "Part A", etc.)
- Mark unknowns with isUnknown: true (shows "?" with dashed border)
- Use totalLabel to show the whole or result

Return the complete tape diagram configuration.
`;

  const result = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: prompt,
    config: {
      thinkingConfig: {
        thinkingLevel: ThinkingLevel.LOW,
      },
      responseMimeType: "application/json",
      responseSchema: tapeDiagramSchema,
      temperature: 0.8,
    },
  });

  const data = result.text ? JSON.parse(result.text) : null;

  if (!data) {
    throw new Error('No valid tape diagram data returned from Gemini API');
  }

  // Validation: ensure bars array is not empty
  if (!data.bars || data.bars.length === 0) {
    console.warn('Tape diagram has no bars. Adding default bar.');
    data.bars = [
      {
        segments: [
          { value: 10, label: "Part 1" },
          { value: 5, label: "Part 2" }
        ],
        totalLabel: "Total"
      }
    ];
  }

  // Validation: ensure each bar has segments
  data.bars.forEach((bar: BarConfig, index: number) => {
    if (!bar.segments || bar.segments.length === 0) {
      console.warn(`Bar ${index} has no segments. Adding default segment.`);
      bar.segments = [{ value: 10, label: "Value" }];
    }
  });

  // Apply any explicit config overrides from manifest
  if (config) {
    if (config.comparisonMode !== undefined) data.comparisonMode = config.comparisonMode;
    if (config.showBrackets !== undefined) data.showBrackets = config.showBrackets;
  }

  return data;
};
