import { Type, Schema } from "@google/genai";
import { PercentBarData } from "../../primitives/visual-primitives/math/PercentBar";
import { ai } from "../geminiClient";

/**
 * Schema definition for Percent Bar Problem-Solving Data
 *
 * Multi-phase interactive problem where students:
 * 1. Explore: Understand the scenario and make an initial estimate
 * 2. Practice: Adjust the bar to match 2-3 target percentages
 * 3. Apply: Solve the main problem with precision
 */
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
 *
 * @param topic - The math topic or concept to teach
 * @param gradeLevel - Grade level for age-appropriate content
 * @param config - Optional configuration hints from the manifest
 * @returns PercentBarData with complete multi-phase problem structure
 */
export const generatePercentBar = async (
  topic: string,
  gradeLevel: string,
  config?: Partial<PercentBarData>
): Promise<PercentBarData> => {
  const prompt = `
Create a multi-phase percent bar problem for teaching "${topic}" to ${gradeLevel} students.

PROBLEM-SOLVING STRUCTURE:

Phase 1 - EXPLORE (Discovery):
- Ask a question that helps students identify the key percentage
- This should be the foundation for understanding the problem
- Example: "The sales tax rate in this city is 8%. What percentage of your purchase goes to tax?"
- Target: The core percentage students need to discover

Phase 2 - PRACTICE (Guided Application):
- Provide 2-3 related practice questions to build fluency
- Each practice question uses the same or similar percentages
- Progressively increase difficulty or change context slightly
- Example practice sequence:
  1. "If the tax is 8%, show what 8% looks like on the bar"
  2. "Now try finding 15% for a standard tip"
  3. "Can you identify 20% for a generous tip?"

Phase 3 - APPLY (Main Problem):
- The culminating problem that ties everything together
- Should require precision and understanding from phases 1-2
- Example: "Calculate the exact amount you'll pay including 8% sales tax on a $50 purchase"

EDUCATIONAL DESIGN PRINCIPLES:
1. Build from simple to complex (explore → practice → apply)
2. Each phase should have a CLEAR, SPECIFIC question
3. Use real-world contexts that students can relate to
4. Practice questions should reinforce the core concept
5. The main problem should feel achievable after completing practice

TOPIC CATEGORIES AND PROBLEM STRUCTURES:

1. SALES TAX (Grades 6-8):
   Explore: "The sales tax rate is 8%. What percentage is added to your purchase?"
   Practice: ["Show 8% on the bar", "Now try 10% tax rate", "Find 6% tax"]
   Apply: "Calculate the total cost of a $50 item with 8% sales tax"

2. DISCOUNTS (Grades 6-8):
   IMPORTANT: For discount problems, you must be clear about what percentage you're asking for:
   - If asking about the discount rate: "Show the 20% discount" → targetPercent: 20
   - If asking about the final price as a percentage: "Show what percentage you'll pay after a 20% discount" → targetPercent: 80
   - If asking about the savings amount: Use the changeRate and finalValue in context

   Example Discount Problem:
   Explore: "A store offers 25% off. Adjust the bar to show the 25% discount."
   Practice: ["Show what percentage you'll pay (after 25% off)", "Try finding the discount for 30% off", "Show the final percentage for 40% off"]
   Apply: "Calculate how much you'll pay on a $80 jacket with 25% off (show the 75% you'll pay)"

3. TIPS (Grades 7-8):
   Explore: "Standard restaurant tip is 15%. What percentage should you add to your bill?"
   Practice: ["Show 15% tip", "Try 18% for good service", "Find 20% for great service"]
   Apply: "Calculate a 15% tip on a $42.50 restaurant bill"

4. TEST SCORES (Grades 5-7):
   Explore: "You answered 80% of questions correctly. What percentage is that?"
   Practice: ["Show 80% correct", "Try 90% for an A grade", "Find 70% passing score"]
   Apply: "Out of 60 test points, how many points is 80%?"

5. BENCHMARK PERCENTS (Grades 5-6):
   Explore: "Half of something is what percent?"
   Practice: ["Show 50% (one half)", "Try 25% (one quarter)", "Find 75% (three quarters)"]
   Apply: "If you ate 50% of 20 cookies, how many did you eat?"

6. PERCENT OF A NUMBER (Grades 6-7):
   Explore: "To find 30% of 80, what percentage are we looking for?"
   Practice: ["Show 30%", "Try 60%", "Find 15%"]
   Apply: "Calculate exactly what 30% of 80 equals"

RESPONSE FORMAT REQUIREMENTS:

1. EXPLORE PHASE:
   - exploreQuestion: Clear question guiding discovery (not just "find X%")
   - exploreTargetPercent: The percentage students should identify
   - exploreHint: Helpful hint without giving away the answer

2. PRACTICE PHASE:
   - practiceQuestions: Array of exactly 2-3 practice problems
   - Each practice builds fluency with similar or related percentages
   - Vary contexts slightly but keep difficulty manageable
   - Progressive difficulty (easiest first)

3. APPLY PHASE:
   - mainQuestion: The culminating problem requiring precision
   - mainTargetPercent: Final target percentage (can be same as explore or different)
   - mainHint: Final guidance if needed

4. WHOLE VALUE & LABELS:
   - wholeValue: Meaningful number appropriate for grade level
   - wholeValueLabel: Descriptive label (e.g., "Purchase Price", "Total Points")

5. VISUAL SETTINGS:
   - benchmarkLines: Default [25, 50, 75] or custom for specific contexts
   - doubleBar: true when connecting percents to actual values is key
   - showPercentLabels: true (almost always)
   - showValueLabels: true (almost always)

GRADE LEVEL GUIDELINES:
- Grade 5: Benchmark percents (25%, 50%, 75%), whole values 20-100, simple contexts
- Grade 6: Varied percents (30%, 60%, 80%), whole values 50-100, test scores, simple money
- Grade 7-8: Real percentages (8% tax, 15% tip, 35% discount), realistic prices, complex contexts

EXAMPLE 1 - Grade 6 Sales Tax Problem:
{
  "title": "Calculate Sales Tax",
  "description": "Learn to calculate sales tax on purchases - an essential real-world math skill!",
  "scenario": "You're buying a video game that costs $50. Your state charges 8% sales tax on all purchases.",
  "wholeValue": 50,
  "wholeValueLabel": "Purchase Price",
  "exploreQuestion": "The tax rate is 8%. Adjust the bar to show what 8% looks like.",
  "exploreTargetPercent": 8,
  "exploreHint": "8% is less than 10%, which would be at the first benchmark line.",
  "exploreContext": {
    "problemType": "addition",
    "initialValue": 50,
    "changeRate": 8,
    "discountFactor": 1.08,
    "finalValue": 54
  },
  "practiceQuestions": [
    {
      "question": "If the tax rate was 10% instead, adjust the bar to show 10%.",
      "targetPercent": 10,
      "hint": "10% is exactly 1/10 of the whole bar.",
      "context": {
        "problemType": "addition",
        "initialValue": 50,
        "changeRate": 10,
        "discountFactor": 1.10,
        "finalValue": 55
      }
    },
    {
      "question": "Some states have 6% tax. Show what 6% looks like.",
      "targetPercent": 6,
      "hint": "6% is a bit more than half of 10%.",
      "context": {
        "problemType": "addition",
        "initialValue": 50,
        "changeRate": 6,
        "discountFactor": 1.06,
        "finalValue": 53
      }
    }
  ],
  "mainQuestion": "Now, set the bar to exactly 8% to calculate the sales tax on your $50 purchase.",
  "mainTargetPercent": 8,
  "mainHint": "Remember, 8% is between 5% and 10% on the bar.",
  "mainContext": {
    "problemType": "addition",
    "initialValue": 50,
    "changeRate": 8,
    "discountFactor": 1.08,
    "finalValue": 54
  },
  "showPercentLabels": true,
  "showValueLabels": true,
  "benchmarkLines": [25, 50, 75],
  "doubleBar": true
}

EXAMPLE 2 - Grade 7 Discount Problem (CRITICAL - Shows how to handle discount formulations):
{
  "title": "Calculate Store Discount",
  "description": "Learn to calculate discounts and sale prices - essential shopping math!",
  "scenario": "You're looking at a board game that costs $60. The store is having a big sale: 20% off all games!",
  "wholeValue": 60,
  "wholeValueLabel": "Original Game Price",
  "exploreQuestion": "The discount is 20% off. Adjust the bar to show exactly what 20% represents.",
  "exploreTargetPercent": 20,
  "exploreHint": "20% is the amount you'll SAVE, not what you'll pay. It's one-fifth of the original price.",
  "exploreContext": {
    "problemType": "subtraction",
    "initialValue": 60,
    "changeRate": -20,
    "discountFactor": 0.80,
    "finalValue": 48
  },
  "practiceQuestions": [
    {
      "question": "Now show what percentage you'll actually PAY after the 20% discount.",
      "targetPercent": 80,
      "hint": "If you save 20%, you pay the remaining 80% (100% - 20% = 80%).",
      "context": {
        "problemType": "subtraction",
        "initialValue": 60,
        "changeRate": -20,
        "discountFactor": 0.80,
        "finalValue": 48
      }
    },
    {
      "question": "If there was a 30% discount instead, show the discount amount (30%).",
      "targetPercent": 30,
      "hint": "30% is the amount saved - nearly one-third of the original price.",
      "context": {
        "problemType": "subtraction",
        "initialValue": 60,
        "changeRate": -30,
        "discountFactor": 0.70,
        "finalValue": 42
      }
    }
  ],
  "mainQuestion": "Set the bar to show what percentage you'll PAY (after the 20% discount).",
  "mainTargetPercent": 80,
  "mainHint": "After saving 20%, you pay 80% of the original price.",
  "mainContext": {
    "problemType": "subtraction",
    "initialValue": 60,
    "changeRate": -20,
    "discountFactor": 0.80,
    "finalValue": 48
  },
  "showPercentLabels": true,
  "showValueLabels": true,
  "benchmarkLines": [20, 40, 60, 80],
  "doubleBar": true
}

EXAMPLE 3 - Grade 7 Tip Calculation:
{
  "title": "Restaurant Tip Calculator",
  "description": "Master the art of calculating tips - a practical skill you'll use for life!",
  "scenario": "You had a great meal at a restaurant. Your bill is $40 and you want to leave a tip for good service.",
  "wholeValue": 40,
  "wholeValueLabel": "Bill Amount",
  "exploreQuestion": "A standard tip is 15%. Adjust the bar to show 15% of your bill.",
  "exploreTargetPercent": 15,
  "exploreHint": "15% is a bit more than one-eighth (12.5%) of the total.",
  "exploreContext": {
    "problemType": "addition",
    "initialValue": 40,
    "changeRate": 15,
    "discountFactor": 1.15,
    "finalValue": 46
  },
  "practiceQuestions": [
    {
      "question": "For great service, try 20%. Show what a 20% tip looks like.",
      "targetPercent": 20,
      "hint": "20% is exactly one-fifth of the total amount.",
      "context": {
        "problemType": "addition",
        "initialValue": 40,
        "changeRate": 20,
        "discountFactor": 1.20,
        "finalValue": 48
      }
    },
    {
      "question": "For okay service, 10% is acceptable. Find 10%.",
      "targetPercent": 10,
      "hint": "10% is one-tenth - easy to calculate!",
      "context": {
        "problemType": "addition",
        "initialValue": 40,
        "changeRate": 10,
        "discountFactor": 1.10,
        "finalValue": 44
      }
    }
  ],
  "mainQuestion": "Set the bar to exactly 15% to see how much tip you should leave.",
  "mainTargetPercent": 15,
  "mainHint": "15% is halfway between 10% and 20%.",
  "mainContext": {
    "problemType": "addition",
    "initialValue": 40,
    "changeRate": 15,
    "discountFactor": 1.15,
    "finalValue": 46
  },
  "showPercentLabels": true,
  "showValueLabels": true,
  "benchmarkLines": [10, 15, 20, 25],
  "doubleBar": true
}

EXAMPLE 4 - Grade 5 Benchmark Percents:
{
  "title": "Understanding 50% - One Half",
  "description": "Discover how percentages relate to fractions you already know!",
  "scenario": "You have 20 cookies to share equally with a friend. You each get half.",
  "wholeValue": 20,
  "wholeValueLabel": "Total Cookies",
  "exploreQuestion": "Half of something is what percent? Adjust the bar to show one-half.",
  "exploreTargetPercent": 50,
  "exploreHint": "Half means dividing into 2 equal parts. Look for the middle benchmark.",
  "exploreContext": {
    "problemType": "direct",
    "initialValue": 20,
    "changeRate": 0,
    "discountFactor": 0.50,
    "finalValue": 10
  },
  "practiceQuestions": [
    {
      "question": "If you shared with 3 friends (4 people total), each person gets one-quarter. Show 25%.",
      "targetPercent": 25,
      "hint": "One quarter is half of one half!",
      "context": {
        "problemType": "direct",
        "initialValue": 20,
        "changeRate": 0,
        "discountFactor": 0.25,
        "finalValue": 5
      }
    },
    {
      "question": "If you kept three-quarters for yourself, that would be 75%. Find it!",
      "targetPercent": 75,
      "hint": "Three quarters is the same as three times one quarter.",
      "context": {
        "problemType": "direct",
        "initialValue": 20,
        "changeRate": 0,
        "discountFactor": 0.75,
        "finalValue": 15
      }
    }
  ],
  "mainQuestion": "Set the bar back to 50% to show exactly how many cookies is half of 20.",
  "mainTargetPercent": 50,
  "mainHint": "50% is right in the middle - the halfway point.",
  "mainContext": {
    "problemType": "direct",
    "initialValue": 20,
    "changeRate": 0,
    "discountFactor": 0.50,
    "finalValue": 10
  },
  "showPercentLabels": true,
  "showValueLabels": true,
  "benchmarkLines": [25, 50, 75],
  "doubleBar": true
}

${config ? `
CONFIGURATION HINTS (Use these if provided):
${config.wholeValue ? `- Whole value: ${config.wholeValue}` : ''}
${config.wholeValueLabel ? `- Whole value label: ${config.wholeValueLabel}` : ''}
${config.exploreTargetPercent !== undefined ? `- Explore target: ${config.exploreTargetPercent}%` : ''}
${config.benchmarkLines ? `- Benchmark lines: ${config.benchmarkLines.join(', ')}` : ''}
${config.doubleBar !== undefined ? `- Double bar: ${config.doubleBar}` : ''}
` : ''}

CRITICAL REQUIREMENTS:
1. All three phases (explore, practice, apply) must have clear, specific questions
2. Practice questions array must have exactly 2-3 items
3. Each question should guide students, not just command them
4. Target percentages should be achievable for the grade level
5. Hints should help without giving away the answer
6. The scenario should be relatable and realistic
7. Use doubleBar: true when actual values matter (money, scores, quantities)
8. Benchmark lines should match the percentages in your problem

CRITICAL - CONTEXT OBJECTS ARE REQUIRED:
9. EVERY phase (explore, practice questions, main) MUST include a context object with:
   - problemType: 'addition', 'subtraction', 'direct', or 'comparison'
   - initialValue: The starting value
   - changeRate: Signed percentage (+8 for tax, -20 for discount, 0 for direct)
   - discountFactor: The multiplier as decimal (1.08 for tax, 0.80 for 20% off, 0.50 for "50% of")
   - finalValue: The result after applying the percentage

10. For DISCOUNT problems, be crystal clear in your question wording:
    - "Show the 20% discount" → asking for 20%
    - "Show what you'll pay after 20% off" → asking for 80%
    - The context object clarifies the relationship (changeRate: -20, discountFactor: 0.80)

11. For TAX/TIP problems, the targetPercent is usually the rate itself (8%, 15%, etc.)
    - The context shows this adds to the original (changeRate: +8, discountFactor: 1.08)

Return the complete multi-phase percent bar problem as JSON.
`;

  const result = await ai.models.generateContent({
    model: "gemini-flash-lite-latest",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: percentBarSchema,
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
    data.practiceQuestions = [
      {
        question: 'Try finding 25% on the bar.',
        targetPercent: 25,
        hint: '25% is one quarter - look for the first benchmark line.',
        context: {
          problemType: 'direct',
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
          problemType: 'direct',
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
      problemType: 'direct',
      initialValue: data.wholeValue,
      changeRate: 0,
      discountFactor: data.exploreTargetPercent / 100,
      finalValue: (data.wholeValue * data.exploreTargetPercent) / 100
    };
  }

  if (!data.mainContext) {
    console.warn('Missing mainContext. Creating default.');
    data.mainContext = {
      problemType: 'direct',
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
          problemType: 'direct',
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
    // Filter out invalid benchmark values
    data.benchmarkLines = data.benchmarkLines.filter((b: any) =>
      typeof b === 'number' && b > 0 && b < 100
    );
    // If no valid benchmarks remain, use defaults
    if (data.benchmarkLines.length === 0) {
      data.benchmarkLines = [25, 50, 75];
    }
  }

  // Apply any explicit config overrides from manifest
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
