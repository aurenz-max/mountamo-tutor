import { Type, Schema, ThinkingLevel } from "@google/genai";
import type {
  FunctionSketchData,
  FunctionSketchChallenge,
  CurvePoint,
  FeatureMarker,
  SketchKeyFeature,
} from "../../primitives/visual-primitives/math/FunctionSketch";
import { ai } from "../geminiClient";
import {
  resolveEvalModeConstraint,
  logEvalModeResolution,
  type ChallengeTypeDoc,
} from "../evalMode/index";

// ---------------------------------------------------------------------------
// Challenge type documentation registry
// ---------------------------------------------------------------------------

const CHALLENGE_TYPE_DOCS: Record<string, ChallengeTypeDoc> = {
  'identify-features': {
    promptDoc:
      `"identify-features": Show a curve and ask the student to identify key features `
      + `(roots, maxima, minima, y-intercepts, asymptotes). Each feature has a type, `
      + `coordinates, and a label describing it.`,
    schemaDescription: "'identify-features' (mark features on a given curve)",
  },
  'classify-shape': {
    promptDoc:
      `"classify-shape": Show a curve and ask the student to classify it as linear, `
      + `quadratic, exponential, sinusoidal, logarithmic, or other standard function type. `
      + `Multiple-choice with 4 options.`,
    schemaDescription: "'classify-shape' (identify function family from graph)",
  },
  'sketch-match': {
    promptDoc:
      `"sketch-match": Give a verbal/symbolic description of a function and ask the `
      + `student to sketch it by placing control points. Key features define scoring. `
      + `A reveal curve is shown after submission.`,
    schemaDescription: "'sketch-match' (draw a function from description)",
  },
  'compare-functions': {
    promptDoc:
      `"compare-functions": Show two curves on the same axes and ask which one `
      + `matches a description. Student selects Curve A or Curve B.`,
    schemaDescription: "'compare-functions' (pick which curve matches a description)",
  },
};

// ---------------------------------------------------------------------------
// Grade-appropriate guidance
// ---------------------------------------------------------------------------

function getFunctionGuidance(gradeLevel: string): string {
  if (/[6-8]/.test(gradeLevel)) {
    return 'Use linear (y=mx+b), quadratic (y=x²), and simple exponential (y=2^x) functions. Keep coefficients small (1-5). Axis range: -10 to 10.';
  }
  if (/[9]|10/.test(gradeLevel)) {
    return 'Use quadratic, cubic, exponential, and basic trig (sin, cos). Can use transformations (shifts, scales). Axis range: -10 to 10 or 0 to 2π for trig.';
  }
  return 'Use any standard function: polynomial, rational, trig, exponential, logarithmic, piecewise. Axis ranges appropriate to the function domain.';
}

// ===========================================================================
// Shared helpers: generate curve points from a function description
// ===========================================================================

/**
 * Generate dense curve points. Gemini provides key structural info,
 * but we generate the actual point arrays in post-processing from
 * the flat fields returned by Gemini.
 */
function generateCurvePoints(
  xMin: number, xMax: number, numPoints: number,
  // Gemini gives us y-values at evenly-spaced x positions
  yValues: number[],
): CurvePoint[] {
  const step = (xMax - xMin) / (numPoints - 1);
  return yValues.map((y, i) => ({ x: xMin + i * step, y }));
}

// ===========================================================================
// Schema: Identify-Features mode
// ===========================================================================

const identifyFeaturesSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    title: { type: Type.STRING, description: "Title for the challenge" },
    context: { type: Type.STRING, description: "Domain context (e.g., physics, economics)" },
    instruction: { type: Type.STRING, description: "What the student should do, e.g. 'Mark the roots and maximum of this function'" },
    expression: { type: Type.STRING, description: "LaTeX expression for the function (displayed to student)" },
    xLabel: { type: Type.STRING, description: "X-axis label" },
    xMin: { type: Type.NUMBER, description: "X-axis minimum" },
    xMax: { type: Type.NUMBER, description: "X-axis maximum" },
    yLabel: { type: Type.STRING, description: "Y-axis label" },
    yMin: { type: Type.NUMBER, description: "Y-axis minimum" },
    yMax: { type: Type.NUMBER, description: "Y-axis maximum" },
    // 20 y-values at evenly-spaced x positions (we reconstruct the curve)
    curveY0:  { type: Type.NUMBER, description: "Y value at x=xMin" },
    curveY1:  { type: Type.NUMBER, description: "Y at position 1/19" },
    curveY2:  { type: Type.NUMBER, description: "Y at position 2/19" },
    curveY3:  { type: Type.NUMBER, description: "Y at position 3/19" },
    curveY4:  { type: Type.NUMBER, description: "Y at position 4/19" },
    curveY5:  { type: Type.NUMBER, description: "Y at position 5/19" },
    curveY6:  { type: Type.NUMBER, description: "Y at position 6/19" },
    curveY7:  { type: Type.NUMBER, description: "Y at position 7/19" },
    curveY8:  { type: Type.NUMBER, description: "Y at position 8/19" },
    curveY9:  { type: Type.NUMBER, description: "Y at position 9/19" },
    curveY10: { type: Type.NUMBER, description: "Y at position 10/19" },
    curveY11: { type: Type.NUMBER, description: "Y at position 11/19" },
    curveY12: { type: Type.NUMBER, description: "Y at position 12/19" },
    curveY13: { type: Type.NUMBER, description: "Y at position 13/19" },
    curveY14: { type: Type.NUMBER, description: "Y at position 14/19" },
    curveY15: { type: Type.NUMBER, description: "Y at position 15/19" },
    curveY16: { type: Type.NUMBER, description: "Y at position 16/19" },
    curveY17: { type: Type.NUMBER, description: "Y at position 17/19" },
    curveY18: { type: Type.NUMBER, description: "Y at position 18/19" },
    curveY19: { type: Type.NUMBER, description: "Y value at x=xMax" },
    // Up to 4 features (flat)
    feature0Type: { type: Type.STRING, description: "Feature type: root, maximum, minimum, y-intercept, or asymptote", enum: ["root", "maximum", "minimum", "y-intercept", "asymptote"] },
    feature0X: { type: Type.NUMBER, description: "X coordinate of feature 0" },
    feature0Y: { type: Type.NUMBER, description: "Y coordinate of feature 0" },
    feature0Label: { type: Type.STRING, description: "Label describing feature 0 (e.g. 'first root')" },
    feature1Type: { type: Type.STRING, description: "Feature type", enum: ["root", "maximum", "minimum", "y-intercept", "asymptote"] },
    feature1X: { type: Type.NUMBER, description: "X coordinate of feature 1" },
    feature1Y: { type: Type.NUMBER, description: "Y coordinate of feature 1" },
    feature1Label: { type: Type.STRING, description: "Label describing feature 1" },
    feature2Type: { type: Type.STRING, description: "Feature type", enum: ["root", "maximum", "minimum", "y-intercept", "asymptote"] },
    feature2X: { type: Type.NUMBER, description: "X coordinate of feature 2" },
    feature2Y: { type: Type.NUMBER, description: "Y coordinate of feature 2" },
    feature2Label: { type: Type.STRING, description: "Label describing feature 2" },
    feature3Type: { type: Type.STRING, description: "Feature type", enum: ["root", "maximum", "minimum", "y-intercept", "asymptote"] },
    feature3X: { type: Type.NUMBER, description: "X coordinate of feature 3" },
    feature3Y: { type: Type.NUMBER, description: "Y coordinate of feature 3" },
    feature3Label: { type: Type.STRING, description: "Label describing feature 3" },
    featureCount: { type: Type.NUMBER, description: "Number of features (2-4)" },
  },
  required: [
    "title", "context", "instruction", "expression",
    "xLabel", "xMin", "xMax", "yLabel", "yMin", "yMax",
    "curveY0", "curveY1", "curveY2", "curveY3", "curveY4",
    "curveY5", "curveY6", "curveY7", "curveY8", "curveY9",
    "curveY10", "curveY11", "curveY12", "curveY13", "curveY14",
    "curveY15", "curveY16", "curveY17", "curveY18", "curveY19",
    "feature0Type", "feature0X", "feature0Y", "feature0Label",
    "feature1Type", "feature1X", "feature1Y", "feature1Label",
    "featureCount",
  ],
};

// ===========================================================================
// Schema: Classify-Shape mode
// ===========================================================================

const classifyShapeSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    title: { type: Type.STRING, description: "Title for the challenge" },
    context: { type: Type.STRING, description: "Domain context" },
    instruction: { type: Type.STRING, description: "Ask 'What type of function is this?'" },
    xLabel: { type: Type.STRING, description: "X-axis label" },
    xMin: { type: Type.NUMBER, description: "X-axis minimum" },
    xMax: { type: Type.NUMBER, description: "X-axis maximum" },
    yLabel: { type: Type.STRING, description: "Y-axis label" },
    yMin: { type: Type.NUMBER, description: "Y-axis minimum" },
    yMax: { type: Type.NUMBER, description: "Y-axis maximum" },
    // 20 y-values
    curveY0:  { type: Type.NUMBER }, curveY1:  { type: Type.NUMBER },
    curveY2:  { type: Type.NUMBER }, curveY3:  { type: Type.NUMBER },
    curveY4:  { type: Type.NUMBER }, curveY5:  { type: Type.NUMBER },
    curveY6:  { type: Type.NUMBER }, curveY7:  { type: Type.NUMBER },
    curveY8:  { type: Type.NUMBER }, curveY9:  { type: Type.NUMBER },
    curveY10: { type: Type.NUMBER }, curveY11: { type: Type.NUMBER },
    curveY12: { type: Type.NUMBER }, curveY13: { type: Type.NUMBER },
    curveY14: { type: Type.NUMBER }, curveY15: { type: Type.NUMBER },
    curveY16: { type: Type.NUMBER }, curveY17: { type: Type.NUMBER },
    curveY18: { type: Type.NUMBER }, curveY19: { type: Type.NUMBER },
    correctType: { type: Type.STRING, description: "The correct function family (e.g. 'quadratic', 'exponential', 'sinusoidal', 'linear', 'logarithmic', 'cubic')" },
    option0: { type: Type.STRING, description: "First MC option (one must equal correctType)" },
    option1: { type: Type.STRING, description: "Second MC option" },
    option2: { type: Type.STRING, description: "Third MC option" },
    option3: { type: Type.STRING, description: "Fourth MC option" },
    explanation: { type: Type.STRING, description: "Brief explanation of why the correct type is right" },
  },
  required: [
    "title", "context", "instruction",
    "xLabel", "xMin", "xMax", "yLabel", "yMin", "yMax",
    "curveY0", "curveY1", "curveY2", "curveY3", "curveY4",
    "curveY5", "curveY6", "curveY7", "curveY8", "curveY9",
    "curveY10", "curveY11", "curveY12", "curveY13", "curveY14",
    "curveY15", "curveY16", "curveY17", "curveY18", "curveY19",
    "correctType", "option0", "option1", "option2", "option3", "explanation",
  ],
};

// ===========================================================================
// Schema: Sketch-Match mode
// ===========================================================================

const sketchMatchSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    title: { type: Type.STRING, description: "Title for the challenge" },
    context: { type: Type.STRING, description: "Domain context" },
    instruction: { type: Type.STRING, description: "What the student should sketch" },
    sketchDescription: { type: Type.STRING, description: "Verbal description of the function to sketch" },
    sketchExpression: { type: Type.STRING, description: "LaTeX expression of the function" },
    xLabel: { type: Type.STRING, description: "X-axis label" },
    xMin: { type: Type.NUMBER, description: "X-axis minimum" },
    xMax: { type: Type.NUMBER, description: "X-axis maximum" },
    yLabel: { type: Type.STRING, description: "Y-axis label" },
    yMin: { type: Type.NUMBER, description: "Y-axis minimum" },
    yMax: { type: Type.NUMBER, description: "Y-axis maximum" },
    // 20 y-values for the reveal curve
    revealY0:  { type: Type.NUMBER }, revealY1:  { type: Type.NUMBER },
    revealY2:  { type: Type.NUMBER }, revealY3:  { type: Type.NUMBER },
    revealY4:  { type: Type.NUMBER }, revealY5:  { type: Type.NUMBER },
    revealY6:  { type: Type.NUMBER }, revealY7:  { type: Type.NUMBER },
    revealY8:  { type: Type.NUMBER }, revealY9:  { type: Type.NUMBER },
    revealY10: { type: Type.NUMBER }, revealY11: { type: Type.NUMBER },
    revealY12: { type: Type.NUMBER }, revealY13: { type: Type.NUMBER },
    revealY14: { type: Type.NUMBER }, revealY15: { type: Type.NUMBER },
    revealY16: { type: Type.NUMBER }, revealY17: { type: Type.NUMBER },
    revealY18: { type: Type.NUMBER }, revealY19: { type: Type.NUMBER },
    minPoints: { type: Type.NUMBER, description: "Minimum control points (3-8)" },
    // Up to 5 key features (flat)
    kf0Type: { type: Type.STRING, description: "Key feature type", enum: ["peak", "zero", "intercept", "trend"] },
    kf0Desc: { type: Type.STRING, description: "Description of key feature 0" },
    kf0X: { type: Type.NUMBER, description: "Expected X position" },
    kf0Y: { type: Type.NUMBER, description: "Expected Y position" },
    kf0Weight: { type: Type.NUMBER, description: "Importance weight 0-1" },
    kf1Type: { type: Type.STRING, enum: ["peak", "zero", "intercept", "trend"] },
    kf1Desc: { type: Type.STRING }, kf1X: { type: Type.NUMBER },
    kf1Y: { type: Type.NUMBER }, kf1Weight: { type: Type.NUMBER },
    kf2Type: { type: Type.STRING, enum: ["peak", "zero", "intercept", "trend"] },
    kf2Desc: { type: Type.STRING }, kf2X: { type: Type.NUMBER },
    kf2Y: { type: Type.NUMBER }, kf2Weight: { type: Type.NUMBER },
    kf3Type: { type: Type.STRING, enum: ["peak", "zero", "intercept", "trend"] },
    kf3Desc: { type: Type.STRING }, kf3X: { type: Type.NUMBER },
    kf3Y: { type: Type.NUMBER }, kf3Weight: { type: Type.NUMBER },
    kf4Type: { type: Type.STRING, enum: ["peak", "zero", "intercept", "trend"] },
    kf4Desc: { type: Type.STRING }, kf4X: { type: Type.NUMBER },
    kf4Y: { type: Type.NUMBER }, kf4Weight: { type: Type.NUMBER },
    keyFeatureCount: { type: Type.NUMBER, description: "Number of key features (3-5)" },
  },
  required: [
    "title", "context", "instruction", "sketchDescription", "sketchExpression",
    "xLabel", "xMin", "xMax", "yLabel", "yMin", "yMax",
    "revealY0", "revealY1", "revealY2", "revealY3", "revealY4",
    "revealY5", "revealY6", "revealY7", "revealY8", "revealY9",
    "revealY10", "revealY11", "revealY12", "revealY13", "revealY14",
    "revealY15", "revealY16", "revealY17", "revealY18", "revealY19",
    "minPoints",
    "kf0Type", "kf0Desc", "kf0X", "kf0Y", "kf0Weight",
    "kf1Type", "kf1Desc", "kf1X", "kf1Y", "kf1Weight",
    "kf2Type", "kf2Desc", "kf2X", "kf2Y", "kf2Weight",
    "keyFeatureCount",
  ],
};

// ===========================================================================
// Schema: Compare-Functions mode
// ===========================================================================

const compareFunctionsSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    title: { type: Type.STRING, description: "Title for the challenge" },
    context: { type: Type.STRING, description: "Domain context" },
    instruction: { type: Type.STRING, description: "Overall instruction" },
    question: { type: Type.STRING, description: "The comparison question (e.g. 'Which curve represents exponential growth?')" },
    xLabel: { type: Type.STRING }, xMin: { type: Type.NUMBER }, xMax: { type: Type.NUMBER },
    yLabel: { type: Type.STRING }, yMin: { type: Type.NUMBER }, yMax: { type: Type.NUMBER },
    // Curve A: 20 y-values
    curveAY0:  { type: Type.NUMBER }, curveAY1:  { type: Type.NUMBER },
    curveAY2:  { type: Type.NUMBER }, curveAY3:  { type: Type.NUMBER },
    curveAY4:  { type: Type.NUMBER }, curveAY5:  { type: Type.NUMBER },
    curveAY6:  { type: Type.NUMBER }, curveAY7:  { type: Type.NUMBER },
    curveAY8:  { type: Type.NUMBER }, curveAY9:  { type: Type.NUMBER },
    curveAY10: { type: Type.NUMBER }, curveAY11: { type: Type.NUMBER },
    curveAY12: { type: Type.NUMBER }, curveAY13: { type: Type.NUMBER },
    curveAY14: { type: Type.NUMBER }, curveAY15: { type: Type.NUMBER },
    curveAY16: { type: Type.NUMBER }, curveAY17: { type: Type.NUMBER },
    curveAY18: { type: Type.NUMBER }, curveAY19: { type: Type.NUMBER },
    // Curve B: 20 y-values
    curveBY0:  { type: Type.NUMBER }, curveBY1:  { type: Type.NUMBER },
    curveBY2:  { type: Type.NUMBER }, curveBY3:  { type: Type.NUMBER },
    curveBY4:  { type: Type.NUMBER }, curveBY5:  { type: Type.NUMBER },
    curveBY6:  { type: Type.NUMBER }, curveBY7:  { type: Type.NUMBER },
    curveBY8:  { type: Type.NUMBER }, curveBY9:  { type: Type.NUMBER },
    curveBY10: { type: Type.NUMBER }, curveBY11: { type: Type.NUMBER },
    curveBY12: { type: Type.NUMBER }, curveBY13: { type: Type.NUMBER },
    curveBY14: { type: Type.NUMBER }, curveBY15: { type: Type.NUMBER },
    curveBY16: { type: Type.NUMBER }, curveBY17: { type: Type.NUMBER },
    curveBY18: { type: Type.NUMBER }, curveBY19: { type: Type.NUMBER },
    labelA: { type: Type.STRING, description: "Label for Curve A" },
    labelB: { type: Type.STRING, description: "Label for Curve B" },
    correctCurve: { type: Type.STRING, description: "'A' or 'B'", enum: ["A", "B"] },
    explanation: { type: Type.STRING, description: "Why the correct curve matches" },
  },
  required: [
    "title", "context", "instruction", "question",
    "xLabel", "xMin", "xMax", "yLabel", "yMin", "yMax",
    "curveAY0", "curveAY1", "curveAY2", "curveAY3", "curveAY4",
    "curveAY5", "curveAY6", "curveAY7", "curveAY8", "curveAY9",
    "curveAY10", "curveAY11", "curveAY12", "curveAY13", "curveAY14",
    "curveAY15", "curveAY16", "curveAY17", "curveAY18", "curveAY19",
    "curveBY0", "curveBY1", "curveBY2", "curveBY3", "curveBY4",
    "curveBY5", "curveBY6", "curveBY7", "curveBY8", "curveBY9",
    "curveBY10", "curveBY11", "curveBY12", "curveBY13", "curveBY14",
    "curveBY15", "curveBY16", "curveBY17", "curveBY18", "curveBY19",
    "labelA", "labelB", "correctCurve", "explanation",
  ],
};

// ===========================================================================
// Helper: reconstruct y-values from flat fields
// ===========================================================================

function extractYValues(data: Record<string, unknown>, prefix: string): number[] {
  const values: number[] = [];
  for (let i = 0; i < 20; i++) {
    const val = data[`${prefix}${i}`];
    if (typeof val !== 'number' || !isFinite(val)) return []; // reject entirely
    values.push(val);
  }
  return values;
}

function extractFeatures(data: Record<string, unknown>, count: number): FeatureMarker[] {
  const features: FeatureMarker[] = [];
  const validTypes = new Set(['root', 'maximum', 'minimum', 'y-intercept', 'asymptote']);
  for (let i = 0; i < count; i++) {
    const type = data[`feature${i}Type`] as string;
    const x = data[`feature${i}X`] as number;
    const y = data[`feature${i}Y`] as number;
    const label = data[`feature${i}Label`] as string;
    if (!validTypes.has(type) || typeof x !== 'number' || typeof y !== 'number' || !label) {
      console.warn(`[FunctionSketch] Rejecting invalid feature ${i}: type=${type}, x=${x}, y=${y}`);
      continue;
    }
    const xRange = ((data.xMax as number) ?? 10) - ((data.xMin as number) ?? -10);
    features.push({ type: type as FeatureMarker['type'], x, y, label, tolerance: xRange * 0.06 });
  }
  return features;
}

function extractKeyFeatures(data: Record<string, unknown>, count: number): SketchKeyFeature[] {
  const features: SketchKeyFeature[] = [];
  const validTypes = new Set(['peak', 'zero', 'intercept', 'trend']);
  for (let i = 0; i < count; i++) {
    const type = data[`kf${i}Type`] as string;
    const desc = data[`kf${i}Desc`] as string;
    const x = data[`kf${i}X`] as number;
    const y = data[`kf${i}Y`] as number;
    const weight = data[`kf${i}Weight`] as number;
    if (!validTypes.has(type) || typeof x !== 'number' || typeof y !== 'number') {
      console.warn(`[FunctionSketch] Rejecting invalid key feature ${i}`);
      continue;
    }
    const xRange = ((data.xMax as number) ?? 10) - ((data.xMin as number) ?? -10);
    features.push({
      type: type as SketchKeyFeature['type'],
      description: desc || '',
      x, y,
      tolerance: xRange * 0.08,
      weight: typeof weight === 'number' && weight > 0 ? weight : 0.5,
    });
  }
  return features;
}

// ===========================================================================
// Sub-generator result type
// ===========================================================================

interface SubGeneratorResult {
  title: string;
  context: string;
  challenge: FunctionSketchChallenge;
}

// ===========================================================================
// Sub-generators
// ===========================================================================

async function generateIdentifyFeatures(topic: string, gradeLevel: string): Promise<SubGeneratorResult> {
  const prompt = `
Create a function for a "${topic}" lesson (grade ${gradeLevel}) where the student must identify key features on the graph.

${getFunctionGuidance(gradeLevel)}

RULES:
- Choose a function with 2-4 clearly visible features (roots, maxima, minima, y-intercept, asymptote)
- Provide 20 y-values at evenly spaced x positions from xMin to xMax — these define the curve
- Each y-value must be a finite number within [yMin, yMax]
- Features must have coordinates that actually lie on or very near the curve
- featureCount = how many features you defined (2, 3, or 4)
- Do NOT put the answer in the title or instruction
- Use a real-world context related to "${topic}" where possible

EXAMPLE (quadratic):
{
  "title": "Projectile Path",
  "context": "A ball thrown upward follows a parabolic trajectory",
  "instruction": "Identify the key features of this projectile's height over time",
  "expression": "h(t) = -4.9t^2 + 20t",
  "xLabel": "Time (s)", "xMin": 0, "xMax": 5,
  "yLabel": "Height (m)", "yMin": -2, "yMax": 22,
  "curveY0": 0, "curveY1": 4.8, ..., "curveY19": -2.5,
  "feature0Type": "y-intercept", "feature0X": 0, "feature0Y": 0, "feature0Label": "launch point",
  "feature1Type": "maximum", "feature1X": 2.04, "feature1Y": 20.4, "feature1Label": "peak height",
  "feature2Type": "root", "feature2X": 4.08, "feature2Y": 0, "feature2Label": "landing point",
  "featureCount": 3
}
`;

  const result = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: prompt,
    config: {
      thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
      responseMimeType: "application/json",
      responseSchema: identifyFeaturesSchema,
    },
  });

  const data = result.text ? JSON.parse(result.text) : null;
  if (!data) throw new Error('[FunctionSketch] No data from Gemini for identify-features');

  const yValues = extractYValues(data, 'curveY');
  if (yValues.length === 0) throw new Error('[FunctionSketch] Invalid curve y-values');

  const featureCount = Math.min(4, Math.max(2, data.featureCount ?? 2));
  const features = extractFeatures(data, featureCount);
  if (features.length < 2) throw new Error('[FunctionSketch] Too few valid features');

  const curve = generateCurvePoints(data.xMin, data.xMax, 20, yValues);

  return {
    title: data.title || topic,
    context: data.context || `Exploring ${topic}`,
    challenge: {
      id: `identify-${Date.now()}`,
      type: 'identify-features',
      instruction: data.instruction,
      xLabel: data.xLabel, xMin: data.xMin, xMax: data.xMax,
      yLabel: data.yLabel, yMin: data.yMin, yMax: data.yMax,
      referenceCurve: curve,
      expression: data.expression,
      features,
    },
  };
}

async function generateClassifyShape(topic: string, gradeLevel: string): Promise<SubGeneratorResult> {
  const prompt = `
Create a function classification challenge for "${topic}" (grade ${gradeLevel}).

${getFunctionGuidance(gradeLevel)}

RULES:
- Generate a clear, recognizable function from one of: linear, quadratic, cubic, exponential, sinusoidal, logarithmic
- Provide 20 y-values at evenly spaced x positions from xMin to xMax
- correctType must exactly match one of the 4 options
- Make the options plausible but distinguishable
- Do NOT put the correct type in the title or instruction
- All y-values must be finite and within [yMin, yMax]

EXAMPLE:
{
  "title": "Mystery Function",
  "context": "Population growth model",
  "instruction": "What type of function best describes this curve?",
  "xLabel": "Years", "xMin": 0, "xMax": 10,
  "yLabel": "Population", "yMin": 0, "yMax": 1100,
  "curveY0": 100, "curveY1": 122, ..., "curveY19": 1000,
  "correctType": "exponential",
  "option0": "linear", "option1": "exponential", "option2": "quadratic", "option3": "logarithmic",
  "explanation": "The function shows constant percentage growth — each interval multiplies by the same factor"
}
`;

  const result = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: prompt,
    config: {
      thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
      responseMimeType: "application/json",
      responseSchema: classifyShapeSchema,
    },
  });

  const data = result.text ? JSON.parse(result.text) : null;
  if (!data) throw new Error('[FunctionSketch] No data from Gemini for classify-shape');

  const yValues = extractYValues(data, 'curveY');
  if (yValues.length === 0) throw new Error('[FunctionSketch] Invalid curve y-values for classify');

  const options = [data.option0, data.option1, data.option2, data.option3].filter(Boolean);
  if (options.length < 4) throw new Error('[FunctionSketch] Fewer than 4 options');
  if (!options.includes(data.correctType)) {
    // Force correctType into options
    options[3] = data.correctType;
  }

  const curve = generateCurvePoints(data.xMin, data.xMax, 20, yValues);

  return {
    title: data.title || topic,
    context: data.context || `Exploring ${topic}`,
    challenge: {
      id: `classify-${Date.now()}`,
      type: 'classify-shape',
      instruction: data.instruction,
      xLabel: data.xLabel, xMin: data.xMin, xMax: data.xMax,
      yLabel: data.yLabel, yMin: data.yMin, yMax: data.yMax,
      classifyCurve: curve,
      correctType: data.correctType,
      options,
      classifyExplanation: data.explanation,
    },
  };
}

async function generateSketchMatch(topic: string, gradeLevel: string): Promise<SubGeneratorResult> {
  const prompt = `
Create a sketch challenge for "${topic}" (grade ${gradeLevel}). The student will place control points to draw what they think the function looks like.

${getFunctionGuidance(gradeLevel)}

RULES:
- Choose a function with 3-5 clearly identifiable key features (peaks, zeros, intercepts, trends)
- Provide the verbal description AND the LaTeX expression
- Provide 20 y-values for the reveal curve (shown after student submits)
- For each key feature, provide: type (peak/zero/intercept/trend), description, expected x/y, weight (0-1)
- Weights should sum to roughly 1.0
- minPoints should be 4-6
- All y-values must be finite and within [yMin, yMax]
- keyFeatureCount = number of key features defined (3-5)

EXAMPLE:
{
  "title": "Sketch the Sine Wave",
  "context": "Sound wave analysis",
  "instruction": "Sketch the function described below by placing control points",
  "sketchDescription": "A sine wave with amplitude 3 and period 2π",
  "sketchExpression": "y = 3\\\\sin(x)",
  "xLabel": "x", "xMin": -7, "xMax": 7,
  "yLabel": "y", "yMin": -4, "yMax": 4,
  "revealY0": 1.97, ..., "revealY19": 1.97,
  "minPoints": 5,
  "kf0Type": "peak", "kf0Desc": "Maximum at x=π/2", "kf0X": 1.57, "kf0Y": 3, "kf0Weight": 0.25,
  "kf1Type": "zero", "kf1Desc": "Root at origin", "kf1X": 0, "kf1Y": 0, "kf1Weight": 0.25,
  "kf2Type": "zero", "kf2Desc": "Root at x=π", "kf2X": 3.14, "kf2Y": 0, "kf2Weight": 0.2,
  "kf3Type": "peak", "kf3Desc": "Minimum at x=3π/2", "kf3X": 4.71, "kf3Y": -3, "kf3Weight": 0.3,
  "keyFeatureCount": 4
}
`;

  const result = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: prompt,
    config: {
      thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
      responseMimeType: "application/json",
      responseSchema: sketchMatchSchema,
    },
  });

  const data = result.text ? JSON.parse(result.text) : null;
  if (!data) throw new Error('[FunctionSketch] No data from Gemini for sketch-match');

  const revealYValues = extractYValues(data, 'revealY');
  if (revealYValues.length === 0) throw new Error('[FunctionSketch] Invalid reveal curve y-values');

  const kfCount = Math.min(5, Math.max(3, data.keyFeatureCount ?? 3));
  const keyFeatures = extractKeyFeatures(data, kfCount);
  if (keyFeatures.length < 3) throw new Error('[FunctionSketch] Too few valid key features');

  const revealCurve = generateCurvePoints(data.xMin, data.xMax, 20, revealYValues);

  return {
    title: data.title || topic,
    context: data.context || `Exploring ${topic}`,
    challenge: {
      id: `sketch-${Date.now()}`,
      type: 'sketch-match',
      instruction: data.instruction,
      xLabel: data.xLabel, xMin: data.xMin, xMax: data.xMax,
      yLabel: data.yLabel, yMin: data.yMin, yMax: data.yMax,
      sketchDescription: data.sketchDescription,
      sketchExpression: data.sketchExpression,
      keyFeatures,
      revealCurve,
      minPoints: Math.max(3, Math.min(8, data.minPoints ?? 5)),
    },
  };
}

async function generateCompareFunctions(topic: string, gradeLevel: string): Promise<SubGeneratorResult> {
  const prompt = `
Create a function comparison challenge for "${topic}" (grade ${gradeLevel}). Two curves are shown and the student picks which one matches a description.

${getFunctionGuidance(gradeLevel)}

RULES:
- Generate TWO distinct but related functions (e.g., one exponential and one quadratic, or two trig with different periods)
- Provide 20 y-values for each curve (Curve A and Curve B)
- The question should ask which curve matches a specific property or description
- correctCurve must be "A" or "B"
- The curves must be visually distinguishable
- All y-values must be finite and within [yMin, yMax]
- Do NOT reveal the answer in the question

EXAMPLE:
{
  "title": "Growth Models",
  "context": "Comparing bacteria population models",
  "instruction": "Two population models are shown. Study both curves.",
  "question": "Which curve represents exponential growth rather than linear growth?",
  "xLabel": "Hours", "xMin": 0, "xMax": 10,
  "yLabel": "Population", "yMin": 0, "yMax": 110,
  "curveAY0": 10, "curveAY1": 15, ..., "curveAY19": 100,
  "curveBY0": 10, "curveBY1": 20, ..., "curveBY19": 100,
  "labelA": "Model A", "labelB": "Model B",
  "correctCurve": "B",
  "explanation": "Curve B shows increasing rate of change (exponential), while Curve A grows at a constant rate (linear)"
}
`;

  const result = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: prompt,
    config: {
      thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
      responseMimeType: "application/json",
      responseSchema: compareFunctionsSchema,
    },
  });

  const data = result.text ? JSON.parse(result.text) : null;
  if (!data) throw new Error('[FunctionSketch] No data from Gemini for compare-functions');

  const curveAY = extractYValues(data, 'curveAY');
  const curveBY = extractYValues(data, 'curveBY');
  if (curveAY.length === 0 || curveBY.length === 0) {
    throw new Error('[FunctionSketch] Invalid curve y-values for compare');
  }

  const curveA = generateCurvePoints(data.xMin, data.xMax, 20, curveAY);
  const curveB = generateCurvePoints(data.xMin, data.xMax, 20, curveBY);

  const correctCurve = data.correctCurve === 'A' || data.correctCurve === 'B'
    ? data.correctCurve : 'A';

  return {
    title: data.title || topic,
    context: data.context || `Exploring ${topic}`,
    challenge: {
      id: `compare-${Date.now()}`,
      type: 'compare-functions',
      instruction: data.instruction,
      xLabel: data.xLabel, xMin: data.xMin, xMax: data.xMax,
      yLabel: data.yLabel, yMin: data.yMin, yMax: data.yMax,
      curveA, curveB,
      labelA: data.labelA,
      labelB: data.labelB,
      question: data.question,
      correctCurve,
      compareExplanation: data.explanation,
    },
  };
}

// ===========================================================================
// Main generator — delegates to sub-generator based on eval mode
// ===========================================================================

export const generateFunctionSketch = async (
  topic: string,
  gradeLevel: string,
  config?: { targetEvalMode?: string },
): Promise<FunctionSketchData> => {
  const evalConstraint = resolveEvalModeConstraint('function-sketch', config?.targetEvalMode, CHALLENGE_TYPE_DOCS);
  logEvalModeResolution('FunctionSketch', config?.targetEvalMode, evalConstraint);

  const challengeType = evalConstraint?.allowedTypes[0] || 'identify-features';

  let result: SubGeneratorResult;
  switch (challengeType) {
    case 'classify-shape':
      result = await generateClassifyShape(topic, gradeLevel);
      break;
    case 'sketch-match':
      result = await generateSketchMatch(topic, gradeLevel);
      break;
    case 'compare-functions':
      result = await generateCompareFunctions(topic, gradeLevel);
      break;
    case 'identify-features':
    default:
      result = await generateIdentifyFeatures(topic, gradeLevel);
      break;
  }

  return {
    title: result.title,
    context: result.context,
    challenges: [result.challenge],
  };
};
