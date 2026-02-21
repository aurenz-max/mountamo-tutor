import { Type, Schema, ThinkingLevel } from "@google/genai";
import { PlaceValueChartData } from "../../primitives/visual-primitives/math/PlaceValueChart";
import { ai } from "../geminiClient";

/**
 * Schema definition for Place Value Chart Data (multi-phase interface)
 *
 * Three-phase educational flow:
 *   Phase 1: Identify the Place (multiple choice — which place is this digit in?)
 *   Phase 2: Find the Value (multiple choice — what is this digit worth?)
 *   Phase 3: Build the Number (interactive chart — enter digits to construct the number)
 *
 * The generator produces:
 *   - targetNumber: the number students will study and build
 *   - highlightedDigitPlace: which place column to spotlight in phases 1 & 2
 *   - placeNameChoices: 4 MC options for phase 1 (one correct)
 *   - digitValueChoices: 4 MC options for phase 2 (one correct)
 */
const placeValueChartSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    title: {
      type: Type.STRING,
      description: "Title for the place value chart (e.g., 'Explore 3,472' or 'Place Value Challenge')"
    },
    description: {
      type: Type.STRING,
      description: "Educational description. Introduce the number and tell students they will identify place names, digit values, and then build the number."
    },
    targetNumber: {
      type: Type.NUMBER,
      description: "The number students will study and build. Must be age-appropriate for the grade level. Should have a non-zero digit at highlightedDigitPlace."
    },
    highlightedDigitPlace: {
      type: Type.NUMBER,
      description: "The place value position to highlight in phases 1 and 2. 0 = ones, 1 = tens, 2 = hundreds, 3 = thousands, -1 = tenths, -2 = hundredths. The digit at this place in targetNumber MUST be non-zero."
    },
    minPlace: {
      type: Type.NUMBER,
      description: "Smallest place value column to show. 0 for ones, -1 for tenths, -2 for hundredths. Should cover all digits in targetNumber."
    },
    maxPlace: {
      type: Type.NUMBER,
      description: "Largest place value column to show. 1 for tens, 2 for hundreds, 3 for thousands, etc. Should cover all digits in targetNumber."
    },
    showExpandedForm: {
      type: Type.BOOLEAN,
      description: "Whether to show expanded form during the build phase. Recommended true for learning. Default: true."
    },
    showMultipliers: {
      type: Type.BOOLEAN,
      description: "Whether to show multiplier labels (x1, x10, x100, etc.) above each column. Helpful for younger students. Default: true."
    },
    gradeLevel: {
      type: Type.STRING,
      description: "Grade level string for age-appropriate language (e.g., 'Grade 2', 'Grade 5')."
    },
    placeNameChoices: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: "Exactly 4 place name options for Phase 1 multiple choice. One must be the correct place name for highlightedDigitPlace. Example: ['Ones', 'Tens', 'Hundreds', 'Thousands']. Always include the correct answer and 3 plausible distractors from nearby places."
    },
    digitValueChoices: {
      type: Type.ARRAY,
      items: { type: Type.NUMBER },
      description: "Exactly 4 numeric value options for Phase 2 multiple choice. One must be the correct value of the digit at highlightedDigitPlace. Example for digit 4 in hundreds place: [4, 40, 400, 4000]. Include the face value of the digit and values at neighboring places as distractors."
    }
  },
  required: [
    "title", "description", "targetNumber", "highlightedDigitPlace",
    "minPlace", "maxPlace", "placeNameChoices", "digitValueChoices"
  ]
};

/**
 * Place name lookup for validation
 */
const PLACE_NAMES: Record<number, string> = {
  6: 'Millions',
  5: 'Hundred Thousands',
  4: 'Ten Thousands',
  3: 'Thousands',
  2: 'Hundreds',
  1: 'Tens',
  0: 'Ones',
  [-1]: 'Tenths',
  [-2]: 'Hundredths',
  [-3]: 'Thousandths',
};

/**
 * Get the digit at a specific place in a number.
 * place 0 = ones, 1 = tens, 2 = hundreds, -1 = tenths, etc.
 */
function getDigitAtPlace(num: number, place: number): number {
  const absNum = Math.abs(num);
  if (place >= 0) {
    return Math.floor(absNum / Math.pow(10, place)) % 10;
  } else {
    // For decimal places: multiply to shift the decimal, then extract
    const shifted = Math.round(absNum * Math.pow(10, -place));
    return shifted % 10;
  }
}

/**
 * Generate place value chart data for multi-phase interactive problems
 *
 * This function creates place value chart problems where students:
 * 1. Phase 1 - Identify the place name of a highlighted digit (MC)
 * 2. Phase 2 - Determine the value of that digit in its place (MC)
 * 3. Phase 3 - Build the entire number by entering digits in the chart
 *
 * @param topic - The math topic or concept to teach
 * @param gradeLevel - Grade level for age-appropriate content
 * @param config - Optional configuration hints from the manifest
 * @returns PlaceValueChartData configured for multi-phase interaction
 */
export const generatePlaceValueChart = async (
  topic: string,
  gradeLevel: string,
  config?: Partial<PlaceValueChartData>
): Promise<PlaceValueChartData> => {
  const prompt = `
Create a MULTI-PHASE place value chart problem for "${topic}" for ${gradeLevel} students.

PROBLEM FLOW (three phases):
  Phase 1: "Identify the Place" — student picks the place name of a highlighted digit (MC)
  Phase 2: "Find the Value" — student picks the value of that digit (MC)
  Phase 3: "Build the Number" — student enters every digit in the place value chart

GRADE-APPROPRIATE TARGET NUMBERS:
- Grades K-1: 2-digit whole numbers (e.g., 35, 72)
  -> minPlace: 0, maxPlace: 1
- Grades 1-2: 2- to 3-digit whole numbers (e.g., 47, 253)
  -> minPlace: 0, maxPlace: 2
- Grades 3-4: 3- to 4-digit whole numbers (e.g., 1,450, 5,832)
  -> minPlace: 0, maxPlace: 3 or 4
- Grades 5-6: Include decimals (e.g., 3,245.75, 12,450.5)
  -> minPlace: -2, maxPlace: 4 or 5
- Grades 7-8: Larger numbers with decimals (e.g., 125,456.125)
  -> minPlace: -3, maxPlace: 5 or 6

CHOOSING highlightedDigitPlace:
- Pick a place whose digit in targetNumber is NON-ZERO
- Prefer interior places (hundreds, tens) over edge places for interest
- Example: for 3,472, highlight the hundreds place (highlightedDigitPlace: 2, digit = 4)

GENERATING placeNameChoices (Phase 1 MC):
- Exactly 4 options, one correct
- Correct answer: the place name for highlightedDigitPlace (e.g., "Hundreds")
- Distractors: 3 other place names from adjacent or nearby places
- Shuffle order so correct answer is not always first
- Example: ["Tens", "Hundreds", "Thousands", "Ones"]

GENERATING digitValueChoices (Phase 2 MC):
- Exactly 4 options, one correct
- Correct answer: digit * 10^highlightedDigitPlace (e.g., 4 * 100 = 400)
- Distractors: the same digit multiplied by neighboring powers of 10
- Example for digit 4 at hundreds place: [4, 40, 400, 4000]
- Shuffle order so correct answer is not always first

${config?.targetNumber ? `
SPECIFIED TARGET: ${config.targetNumber}
Use this exact number as the targetNumber. Adjust minPlace, maxPlace, and highlightedDigitPlace to match.
` : ''}
${config?.highlightedDigitPlace !== undefined ? `
SPECIFIED HIGHLIGHTED PLACE: ${config.highlightedDigitPlace}
Use this exact place position. Ensure the digit at this place in targetNumber is non-zero.
` : ''}

ADDITIONAL GUIDELINES:
- title: Use format like "Explore 3,472" or "Place Value Challenge: 253"
- description: Introduce the challenge warmly, e.g., "Let's explore the number 3,472! First, identify which place the highlighted digit is in, then figure out its value, and finally build the whole number!"
- showExpandedForm: true (helps students see the breakdown during build phase)
- showMultipliers: true for grades K-4, optional for 5+
- gradeLevel: echo back the grade level string

EXAMPLE OUTPUT:
{
  "title": "Explore 3,472",
  "description": "Let's explore 3,472! Which place is the highlighted digit in? What is it worth? Then build the whole number!",
  "targetNumber": 3472,
  "highlightedDigitPlace": 2,
  "minPlace": 0,
  "maxPlace": 3,
  "showExpandedForm": true,
  "showMultipliers": true,
  "gradeLevel": "Grade 3",
  "placeNameChoices": ["Tens", "Hundreds", "Thousands", "Ones"],
  "digitValueChoices": [4, 40, 400, 4000]
}

Return a complete multi-phase place value chart problem.
`;

  const result = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: prompt,
    config: {
      thinkingConfig: {
        thinkingLevel: ThinkingLevel.LOW,
      },
      responseMimeType: "application/json",
      responseSchema: placeValueChartSchema
    },
  });

  const data = result.text ? JSON.parse(result.text) : null;

  if (!data) {
    throw new Error('No valid place value chart data returned from Gemini API');
  }

  // ── Apply explicit config overrides from manifest ──
  if (config) {
    if (config.targetNumber !== undefined) data.targetNumber = config.targetNumber;
    if (config.highlightedDigitPlace !== undefined) data.highlightedDigitPlace = config.highlightedDigitPlace;
    if (config.minPlace !== undefined) data.minPlace = config.minPlace;
    if (config.maxPlace !== undefined) data.maxPlace = config.maxPlace;
    if (config.showExpandedForm !== undefined) data.showExpandedForm = config.showExpandedForm;
    if (config.showMultipliers !== undefined) data.showMultipliers = config.showMultipliers;
    if (config.gradeLevel !== undefined) data.gradeLevel = config.gradeLevel;
    if (config.placeNameChoices !== undefined) data.placeNameChoices = config.placeNameChoices;
    if (config.digitValueChoices !== undefined) data.digitValueChoices = config.digitValueChoices;
  }

  // ── Validation & defaults ──

  // Ensure targetNumber is a valid number
  if (typeof data.targetNumber !== 'number' || isNaN(data.targetNumber)) {
    data.targetNumber = 347; // safe fallback
  }

  // Ensure gradeLevel is set
  if (!data.gradeLevel) {
    data.gradeLevel = gradeLevel;
  }

  // Ensure minPlace and maxPlace are numbers and cover the targetNumber
  if (typeof data.minPlace !== 'number') data.minPlace = 0;
  if (typeof data.maxPlace !== 'number') data.maxPlace = 3;

  // Calculate the actual range needed by targetNumber
  const absTarget = Math.abs(data.targetNumber);
  const integerDigits = absTarget >= 1 ? Math.floor(Math.log10(absTarget)) : 0;
  if (data.maxPlace < integerDigits) {
    data.maxPlace = integerDigits;
  }

  // Check for decimal places needed
  const targetStr = String(data.targetNumber);
  if (targetStr.includes('.')) {
    const decimalPart = targetStr.split('.')[1];
    const decPlaces = decimalPart ? decimalPart.length : 0;
    if (data.minPlace > -decPlaces) {
      data.minPlace = -decPlaces;
    }
  }

  // Ensure highlightedDigitPlace is within [minPlace, maxPlace]
  if (typeof data.highlightedDigitPlace !== 'number') {
    data.highlightedDigitPlace = 0;
  }
  if (data.highlightedDigitPlace < data.minPlace) {
    data.highlightedDigitPlace = data.minPlace;
  }
  if (data.highlightedDigitPlace > data.maxPlace) {
    data.highlightedDigitPlace = data.maxPlace;
  }

  // Ensure the digit at highlightedDigitPlace is non-zero; if not, find one that is
  const highlightedDigit = getDigitAtPlace(data.targetNumber, data.highlightedDigitPlace);
  if (highlightedDigit === 0) {
    // Search for a non-zero digit, preferring middle places
    let found = false;
    for (let offset = 1; offset <= data.maxPlace - data.minPlace; offset++) {
      for (const dir of [1, -1]) {
        const candidate = data.highlightedDigitPlace + offset * dir;
        if (candidate >= data.minPlace && candidate <= data.maxPlace) {
          if (getDigitAtPlace(data.targetNumber, candidate) !== 0) {
            data.highlightedDigitPlace = candidate;
            found = true;
            break;
          }
        }
      }
      if (found) break;
    }
  }

  // Recompute the correct digit and value after potential adjustment
  const finalDigit = getDigitAtPlace(data.targetNumber, data.highlightedDigitPlace);
  const correctValue = finalDigit * Math.pow(10, data.highlightedDigitPlace);
  const correctPlaceName = PLACE_NAMES[data.highlightedDigitPlace] || `10^${data.highlightedDigitPlace}`;

  // Validate placeNameChoices: must be an array of 4 strings containing the correct answer
  if (
    !Array.isArray(data.placeNameChoices) ||
    data.placeNameChoices.length !== 4 ||
    !data.placeNameChoices.includes(correctPlaceName)
  ) {
    // Rebuild placeNameChoices from scratch
    const allPlaces = Object.entries(PLACE_NAMES)
      .map(([k, v]) => ({ place: Number(k), name: v }))
      .filter(p => p.place >= data.minPlace && p.place <= data.maxPlace && p.name !== correctPlaceName);

    // Pick 3 distractors, preferring nearby places
    allPlaces.sort((a, b) =>
      Math.abs(a.place - data.highlightedDigitPlace) - Math.abs(b.place - data.highlightedDigitPlace)
    );
    const distractors = allPlaces.slice(0, 3).map(p => p.name);

    // If we don't have enough distractors, pull from outside range
    while (distractors.length < 3) {
      const fallbacks = Object.values(PLACE_NAMES).filter(
        n => n !== correctPlaceName && !distractors.includes(n)
      );
      if (fallbacks.length > 0) {
        distractors.push(fallbacks[0]);
      } else {
        break;
      }
    }

    // Shuffle: insert correct answer at random position
    const choices = [...distractors.slice(0, 3)];
    const insertIdx = Math.floor(Math.random() * 4);
    choices.splice(insertIdx, 0, correctPlaceName);
    data.placeNameChoices = choices;
  }

  // Validate digitValueChoices: must be an array of 4 numbers containing the correct value
  if (
    !Array.isArray(data.digitValueChoices) ||
    data.digitValueChoices.length !== 4 ||
    !data.digitValueChoices.includes(correctValue)
  ) {
    // Rebuild: use the digit at neighboring powers of 10
    const distractorValues: number[] = [];
    for (const offset of [-1, 1, -2, 2, -3, 3]) {
      const candidatePlace = data.highlightedDigitPlace + offset;
      const val = finalDigit * Math.pow(10, candidatePlace);
      if (val !== correctValue && val > 0 && !distractorValues.includes(val)) {
        distractorValues.push(val);
      }
      if (distractorValues.length >= 3) break;
    }
    // If still short, add face value and simple multiples
    if (!distractorValues.includes(finalDigit) && finalDigit !== correctValue) {
      distractorValues.push(finalDigit);
    }
    while (distractorValues.length < 3) {
      const filler = correctValue * (distractorValues.length + 2);
      if (!distractorValues.includes(filler) && filler !== correctValue) {
        distractorValues.push(filler);
      }
    }

    const valChoices = [...distractorValues.slice(0, 3)];
    const insertIdx = Math.floor(Math.random() * 4);
    valChoices.splice(insertIdx, 0, correctValue);
    data.digitValueChoices = valChoices;
  }

  // Default optional booleans
  if (data.showExpandedForm === undefined) data.showExpandedForm = true;
  if (data.showMultipliers === undefined) data.showMultipliers = true;

  return data as PlaceValueChartData;
};
