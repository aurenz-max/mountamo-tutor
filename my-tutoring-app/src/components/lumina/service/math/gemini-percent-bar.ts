import { Type, Schema } from "@google/genai";
import { PercentBarData } from "../../primitives/visual-primitives/math/PercentBar";
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
  direct: {
    promptDoc:
      `"direct": Percent-of-a-number problems. Student finds X% of Y. `
      + `No addition or subtraction from the original value. `
      + `Context: benchmark percents (25%, 50%, 75%), test scores, simple fractions. `
      + `Set changeRate=0, discountFactor=targetPercent/100. `
      + `Grade 5-6 focus. Examples: "What is 50% of 20 cookies?", "Score 80% on a 60-point test."`,
    schemaDescription: "'direct' (percent of a number)",
  },
  subtraction: {
    promptDoc:
      `"subtraction": Discount/decrease problems. Student calculates what remains after a percentage is removed. `
      + `Context: store discounts, price reductions, percent decrease. `
      + `Set changeRate to a negative value (e.g., -20 for 20% off). `
      + `discountFactor = (100 - |discount|) / 100 (e.g., 0.80 for 20% off). `
      + `Be clear whether asking for the discount amount or the remaining percentage.`,
    schemaDescription: "'subtraction' (discount, decrease)",
  },
  addition: {
    promptDoc:
      `"addition": Tax/tip/markup problems. Student identifies the percentage rate being added. `
      + `Context: sales tax, restaurant tips, price markup. `
      + `Set changeRate to a positive value (e.g., +8 for 8% tax). `
      + `discountFactor = (100 + rate) / 100 (e.g., 1.08 for 8% tax). `
      + `The targetPercent is the rate itself (8%, 15%, etc.). `
      + `CRITICAL: The bar only accepts percentages (0-100). Questions MUST ask for the percentage rate `
      + `(e.g., "What percent tax is being added?", "What percentage tip should you leave?"), `
      + `NOT for dollar amounts or final totals (e.g., NEVER "What is the total cost?", "How much do you pay?"). `
      + `Students place the percentage on the bar — they cannot enter dollar values.`,
    schemaDescription: "'addition' (tax, tip, markup)",
  },
  comparison: {
    promptDoc:
      `"comparison": Compare percentages across contexts. Student evaluates two scenarios. `
      + `Context: comparing discounts, tax rates across states, test scores. `
      + `More complex — requires reasoning about relative percentages. `
      + `Grade 7-8 focus. May involve computing both scenarios to compare.`,
    schemaDescription: "'comparison' (compare percentages)",
  },
};

// ---------------------------------------------------------------------------
// Base schema
// ---------------------------------------------------------------------------

const percentBarSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    title: {
      type: Type.STRING,
      description: "Title for the percent bar problem (e.g., 'Calculate the Sales Tax', 'Find the Discount')"
    },
    description: {
      type: Type.STRING,
      description: "Educational description explaining what students will learn and why it matters"
    },
    challengeType: {
      type: Type.STRING,
      enum: ["direct", "subtraction", "addition", "comparison"],
      description: "Problem type: 'direct' (percent of a number), 'subtraction' (discount/decrease), 'addition' (tax/tip/markup), 'comparison' (compare percentages). All phases must use this same problem type."
    },

    // Context and scenario
    scenario: {
      type: Type.STRING,
      description: "Real-world story/context for the problem (e.g., 'You're buying a $50 shirt and need to calculate 8% sales tax.')"
    },

    // The whole value (100%)
    wholeValue: {
      type: Type.NUMBER,
      description: "The value representing 100% (the whole). Use meaningful numbers like prices, test points, quantities."
    },
    wholeValueLabel: {
      type: Type.STRING,
      description: "Label for the whole value (e.g., 'Total Price', 'Total Points', 'Full Amount')"
    },

    // Phase 1: Explore - Initial estimation question
    exploreQuestion: {
      type: Type.STRING,
      description: "Question guiding students to understand the problem (e.g., 'What percentage represents the sales tax?')"
    },
    exploreTargetPercent: {
      type: Type.NUMBER,
      description: "The target percentage students should discover in the explore phase (0-100)"
    },
    exploreHint: {
      type: Type.STRING,
      description: "Hint to help students if they struggle in explore phase"
    },
    exploreContext: {
      type: Type.OBJECT,
      properties: {
        problemType: {
          type: Type.STRING,
          description: "Type of percent problem: 'addition' (tax, tip, markup), 'subtraction' (discount, decrease), 'direct' (percent of a number, test score), or 'comparison'"
        },
        initialValue: {
          type: Type.NUMBER,
          description: "The starting value (e.g., original price of $60)"
        },
        changeRate: {
          type: Type.NUMBER,
          description: "The rate of change as a signed percentage (+8 for 8% tax, -20 for 20% discount, 0 for direct problems)"
        },
        discountFactor: {
          type: Type.NUMBER,
          description: "The multiplier expressed as decimal (e.g., 1.08 for 8% tax, 0.80 for 20% discount, same as targetPercent/100 for direct problems)"
        },
        finalValue: {
          type: Type.NUMBER,
          description: "The resulting value after applying the change (e.g., $48 after 20% discount on $60)"
        }
      },
      required: ["problemType", "initialValue", "changeRate", "discountFactor", "finalValue"],
      description: "Context explaining the relationship between different percent formulations"
    },

    // Phase 2: Practice - 2-3 related practice targets
    practiceQuestions: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          question: {
            type: Type.STRING,
            description: "Practice question (e.g., 'Now try finding 15% for a tip calculation')"
          },
          targetPercent: {
            type: Type.NUMBER,
            description: "Target percentage for this practice question (0-100)"
          },
          hint: {
            type: Type.STRING,
            description: "Hint if student needs help"
          },
          context: {
            type: Type.OBJECT,
            properties: {
              problemType: {
                type: Type.STRING,
                description: "Type of percent problem: 'addition' (tax, tip, markup), 'subtraction' (discount, decrease), 'direct' (percent of a number, test score), or 'comparison'"
              },
              initialValue: {
                type: Type.NUMBER,
                description: "The starting value"
              },
              changeRate: {
                type: Type.NUMBER,
                description: "The rate of change as a signed percentage (+/- or 0)"
              },
              discountFactor: {
                type: Type.NUMBER,
                description: "The multiplier as a decimal"
              },
              finalValue: {
                type: Type.NUMBER,
                description: "The resulting value"
              }
            },
            required: ["problemType", "initialValue", "changeRate", "discountFactor", "finalValue"],
            description: "Context for this practice question"
          }
        },
        required: ["question", "targetPercent", "hint", "context"]
      },
      description: "2-3 practice questions to build fluency before the main problem"
    },

    // Phase 3: Apply - Main problem
    mainQuestion: {
      type: Type.STRING,
      description: "The main problem students must solve (e.g., 'Calculate the total cost including the 8% sales tax')"
    },
    mainTargetPercent: {
      type: Type.NUMBER,
      description: "The final target percentage for the main problem (0-100)"
    },
    mainHint: {
      type: Type.STRING,
      description: "Hint for the main problem if needed"
    },
    mainContext: {
      type: Type.OBJECT,
      properties: {
        problemType: {
          type: Type.STRING,
          description: "Type of percent problem: 'addition' (tax, tip, markup), 'subtraction' (discount, decrease), 'direct' (percent of a number, test score), or 'comparison'"
        },
        initialValue: {
          type: Type.NUMBER,
          description: "The starting value"
        },
        changeRate: {
          type: Type.NUMBER,
          description: "The rate of change as a signed percentage (+/- or 0)"
        },
        discountFactor: {
          type: Type.NUMBER,
          description: "The multiplier as a decimal"
        },
        finalValue: {
          type: Type.NUMBER,
          description: "The resulting value"
        }
      },
      required: ["problemType", "initialValue", "changeRate", "discountFactor", "finalValue"],
      description: "Context for the main problem"
    },

    // Visual configuration
    showPercentLabels: {
      type: Type.BOOLEAN,
      description: "Whether to display percentage markers on the bar. Default: true"
    },
    showValueLabels: {
      type: Type.BOOLEAN,
      description: "Whether to display absolute value labels. Default: true"
    },
    benchmarkLines: {
      type: Type.ARRAY,
      items: {
        type: Type.NUMBER,
        description: "Percentage value for benchmark line (e.g., 25, 50, 75)"
      },
      description: "Array of benchmark percentages to show as guide lines"
    },
    doubleBar: {
      type: Type.BOOLEAN,
      description: "Whether to show a second bar displaying actual values. Use true for connecting percents to real values."
    }
  },
  required: [
    "title",
    "description",
    "challengeType",
    "scenario",
    "wholeValue",
    "wholeValueLabel",
    "exploreQuestion",
    "exploreTargetPercent",
    "exploreHint",
    "exploreContext",
    "practiceQuestions",
    "mainQuestion",
    "mainTargetPercent",
    "mainHint",
    "mainContext"
  ]
};

/**
 * Generate percent bar problem-solving data
 *
 * Creates a multi-phase interactive problem where students:
 * 1. Explore: Discover the key percentage through guided questioning
 * 2. Practice: Apply understanding to 2-3 related scenarios
 * 3. Apply: Solve the main problem with precision
 */
export const generatePercentBar = async (
  topic: string,
  gradeLevel: string,
  config?: Partial<PercentBarData> & {
    /** Target eval mode from the IRT calibration system. */
    targetEvalMode?: string;
  }
): Promise<PercentBarData> => {
  // Resolve eval mode from catalog (single source of truth)
  const evalConstraint = resolveEvalModeConstraint(
    'percent-bar',
    config?.targetEvalMode,
    CHALLENGE_TYPE_DOCS,
  );
  logEvalModeResolution('PercentBar', config?.targetEvalMode, evalConstraint);

  // Constrain schema when eval mode is active (challengeType is at root level)
  const activeSchema = evalConstraint
    ? constrainChallengeTypeEnum(percentBarSchema, evalConstraint.allowedTypes, CHALLENGE_TYPE_DOCS, {
        fieldName: 'challengeType',
        rootLevel: true,
      })
    : percentBarSchema;

  // Build challenge type prompt section
  const challengeTypeSection = buildChallengeTypePromptSection(
    evalConstraint,
    CHALLENGE_TYPE_DOCS,
  );

  const prompt = `
Create a multi-phase percent bar problem for teaching "${topic}" to ${gradeLevel} students.

${challengeTypeSection}

PROBLEM-SOLVING STRUCTURE:

Phase 1 - EXPLORE (Discovery):
- Ask a question that helps students identify the key percentage
- This should be the foundation for understanding the problem

Phase 2 - PRACTICE (Guided Application):
- Provide 2-3 related practice questions to build fluency
- Each practice question uses the same or similar percentages
- Progressively increase difficulty or change context slightly

Phase 3 - APPLY (Main Problem):
- The culminating problem that ties everything together
- Should require precision and understanding from phases 1-2

${!evalConstraint ? `
GRADE LEVEL GUIDELINES:
- Grade 5: Benchmark percents (25%, 50%, 75%), whole values 20-100, simple contexts
- Grade 6: Varied percents (30%, 60%, 80%), whole values 50-100, test scores, simple money
- Grade 7-8: Real percentages (8% tax, 15% tip, 35% discount), realistic prices, complex contexts

TOPIC CATEGORIES:
1. SALES TAX (addition): Tax rate added to purchase price
2. DISCOUNTS (subtraction): Percentage removed from original price
3. TIPS (addition): Percentage added to bill
4. TEST SCORES (direct): Percent of a number
5. BENCHMARK PERCENTS (direct): Fractions as percents (25%, 50%, 75%)
6. PERCENT OF A NUMBER (direct): Basic percent calculation
` : ''}

CRITICAL REQUIREMENTS:
1. Set the "challengeType" field to match the problem type used across all phases
2. All three phases (explore, practice, apply) must have clear, specific questions
3. Practice questions array must have exactly 2-3 items
4. ALL context objects must have problemType matching the challengeType
5. Use real-world contexts that students can relate to
6. Use doubleBar: true when actual values matter (money, scores, quantities)
7. The bar ONLY accepts percentages (0-100). ALL questions MUST ask for a percentage, NEVER for a dollar amount or final total. For "addition" problems (tax/tip/markup), ask "What percent is the tax/tip?" NOT "What is the total cost?"

CONTEXT OBJECTS (REQUIRED for every phase):
- problemType: Must match the root challengeType
- initialValue: The starting value
- changeRate: Signed percentage (+8 for tax, -20 for discount, 0 for direct)
- discountFactor: The multiplier as decimal (1.08 for tax, 0.80 for 20% off, 0.50 for "50% of")
- finalValue: The result after applying the percentage

${config ? `
CONFIGURATION HINTS:
${config.wholeValue ? `- Whole value: ${config.wholeValue}` : ''}
${config.wholeValueLabel ? `- Whole value label: ${config.wholeValueLabel}` : ''}
${config.exploreTargetPercent !== undefined ? `- Explore target: ${config.exploreTargetPercent}%` : ''}
${config.benchmarkLines ? `- Benchmark lines: ${config.benchmarkLines.join(', ')}` : ''}
${config.doubleBar !== undefined ? `- Double bar: ${config.doubleBar}` : ''}
` : ''}

Return the complete multi-phase percent bar problem as JSON.
`;

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
    throw new Error('No valid percent bar data returned from Gemini API');
  }

  // Validation: ensure wholeValue is valid
  if (!data.wholeValue || typeof data.wholeValue !== 'number' || data.wholeValue <= 0) {
    console.warn('Invalid wholeValue. Using default of 100.');
    data.wholeValue = 100;
  }

  // Validation: ensure target percents are valid
  if (typeof data.exploreTargetPercent !== 'number' || data.exploreTargetPercent < 0 || data.exploreTargetPercent > 100) {
    console.warn('Invalid exploreTargetPercent. Using default of 50.');
    data.exploreTargetPercent = 50;
  }

  if (typeof data.mainTargetPercent !== 'number' || data.mainTargetPercent < 0 || data.mainTargetPercent > 100) {
    console.warn('Invalid mainTargetPercent. Using default of 50.');
    data.mainTargetPercent = 50;
  }

  // Validation: ensure practice questions exist and are valid
  if (!Array.isArray(data.practiceQuestions) || data.practiceQuestions.length < 2) {
    console.warn('Invalid practiceQuestions. Creating defaults.');
    const fallbackType = evalConstraint?.allowedTypes[0] ?? 'direct';
    data.practiceQuestions = [
      {
        question: 'Try finding 25% on the bar.',
        targetPercent: 25,
        hint: '25% is one quarter - look for the first benchmark line.',
        context: {
          problemType: fallbackType,
          initialValue: data.wholeValue || 100,
          changeRate: 0,
          discountFactor: 0.25,
          finalValue: ((data.wholeValue || 100) * 0.25)
        }
      },
      {
        question: 'Now try finding 75% on the bar.',
        targetPercent: 75,
        hint: '75% is three quarters - look for the third benchmark line.',
        context: {
          problemType: fallbackType,
          initialValue: data.wholeValue || 100,
          changeRate: 0,
          discountFactor: 0.75,
          finalValue: ((data.wholeValue || 100) * 0.75)
        }
      }
    ];
  }

  // Validation: ensure contexts exist
  if (!data.exploreContext) {
    console.warn('Missing exploreContext. Creating default.');
    data.exploreContext = {
      problemType: evalConstraint?.allowedTypes[0] ?? 'direct',
      initialValue: data.wholeValue,
      changeRate: 0,
      discountFactor: data.exploreTargetPercent / 100,
      finalValue: (data.wholeValue * data.exploreTargetPercent) / 100
    };
  }

  if (!data.mainContext) {
    console.warn('Missing mainContext. Creating default.');
    data.mainContext = {
      problemType: evalConstraint?.allowedTypes[0] ?? 'direct',
      initialValue: data.wholeValue,
      changeRate: 0,
      discountFactor: data.mainTargetPercent / 100,
      finalValue: (data.wholeValue * data.mainTargetPercent) / 100
    };
  }

  // Validation: ensure all practice questions have context
  data.practiceQuestions = data.practiceQuestions.map((pq: any) => {
    if (!pq.context) {
      console.warn('Missing context in practice question. Creating default.');
      return {
        ...pq,
        context: {
          problemType: evalConstraint?.allowedTypes[0] ?? 'direct',
          initialValue: data.wholeValue,
          changeRate: 0,
          discountFactor: pq.targetPercent / 100,
          finalValue: (data.wholeValue * pq.targetPercent) / 100
        }
      };
    }
    return pq;
  });

  // Set defaults for optional boolean fields
  if (data.showPercentLabels === undefined) data.showPercentLabels = true;
  if (data.showValueLabels === undefined) data.showValueLabels = true;
  if (data.doubleBar === undefined) data.doubleBar = false;

  // Validation: ensure benchmarkLines is valid
  if (!data.benchmarkLines || !Array.isArray(data.benchmarkLines)) {
    data.benchmarkLines = [25, 50, 75];
  } else {
    data.benchmarkLines = data.benchmarkLines.filter((b: any) =>
      typeof b === 'number' && b > 0 && b < 100
    );
    if (data.benchmarkLines.length === 0) {
      data.benchmarkLines = [25, 50, 75];
    }
  }

  // Apply any explicit config overrides from manifest (non-eval-mode config)
  if (config) {
    if (config.wholeValue !== undefined) data.wholeValue = config.wholeValue;
    if (config.wholeValueLabel) data.wholeValueLabel = config.wholeValueLabel;
    if (config.exploreTargetPercent !== undefined) data.exploreTargetPercent = config.exploreTargetPercent;
    if (config.mainTargetPercent !== undefined) data.mainTargetPercent = config.mainTargetPercent;
    if (config.showPercentLabels !== undefined) data.showPercentLabels = config.showPercentLabels;
    if (config.showValueLabels !== undefined) data.showValueLabels = config.showValueLabels;
    if (config.benchmarkLines) data.benchmarkLines = config.benchmarkLines;
    if (config.doubleBar !== undefined) data.doubleBar = config.doubleBar;
  }

  return data as PercentBarData;
};
