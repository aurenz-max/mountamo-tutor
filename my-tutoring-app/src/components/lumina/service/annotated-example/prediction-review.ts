import { Type, ThinkingLevel } from '@google/genai';
import { ai } from '../geminiClient';
import type { Inset } from '../../types';
import type { ChallengeAssignment, RichExampleStep } from '../../primitives/annotated-example/types';

export interface PredictionContext {
  problemStatement: string;
  problemTitle?: string;
  problemInset?: Inset;
  solutionStrategy: string;
  steps: RichExampleStep[];
}

export function predictionExposure(input: PredictionContext, assignment: ChallengeAssignment) {
  const step = input.steps[assignment.stepIndex];
  return {
    problem: input.problemStatement, title: input.problemTitle,
    inset: input.problemInset,
    // Some sibling consumers show strategy before work; err on the conservative side.
    strategy: input.solutionStrategy,
    earlierSteps: input.steps.slice(0, assignment.stepIndex).map(s => ({ title: s.title, content: s.content, annotations: s.annotations, challenge: s.challenge })),
    // A pending card uses a neutral heading; its actual title and annotations are hidden.
    currentFrom: assignment.kind === 'transition' && step?.content.type === 'algebra' ? step.content.transitions[assignment.transitionIndex]?.from.latex : undefined,
    earlierTransitions: assignment.kind === 'transition' && step?.content.type === 'algebra' ? step.content.transitions.slice(0, assignment.transitionIndex) : [],
  };
}

/** Only exact notation, not a semantic equivalence classifier. The reviewer
 * below covers paraphrases, units and disclosures implicit in other visuals. */
const literal = (s: string) => s.replace(/\\(?:d?frac)\s*\{([^{}]+)\}\s*\{([^{}]+)\}/g, '$1/$2').replace(/[\s$]/g, '').toLowerCase();

export function directPredictionDisclosure(input: PredictionContext, a: ChallengeAssignment): boolean {
  const answer = literal(a.acceptableAnswers[0] || '');
  if (!answer) return true;
  const known: string[] = [];
  const inset = input.problemInset;
  if (inset?.insetType === 'number-line') {
    for (const point of inset.points ?? []) known.push(point.label, String(point.value));
  }
  for (const step of input.steps.slice(0, a.stepIndex)) {
    if (step.content.type === 'algebra') {
      known.push(step.content.result, ...step.content.transitions.flatMap(t => [t.to.latex, t.operation]));
    }
  }
  return known.some(s => literal(s) === answer);
}

export async function reviewPredictions(input: PredictionContext, assignments: ChallengeAssignment[]) {
  const dropped: Array<{ assignment: ChallengeAssignment; reason: string }> = [];
  const candidates = assignments.filter(assignment => {
    if (!input.steps[assignment.stepIndex] || directPredictionDisclosure(input, assignment)) {
      dropped.push({ assignment, reason: 'Answer already disclosed or invalid step index' });
      return false;
    }
    return true;
  });
  if (!candidates.length) return { safe: [], dropped };
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-flash-latest',
      contents: `Audit prediction questions for a worked example. For each candidate, independently check:
1. Its answer is correct and the question can be answered from the visible information. The hidden body cannot be required to solve it.
2. Its answer has NOT already been stated, labeled, worked out, or revealed in the prompt, visible problem/inset, strategy, previous steps, previous annotations or previous transitions. A question about a result already computed in an earlier representation is a recall question, not a prediction. Reject it. Interpret numeric labels, equivalent wording, equations, and operation names semantically. Inset scales/ticks alone are not an answer; a labeled answer point is.
3. Distractors are actually wrong, and the prompt does not name the correct choice. A neutral heading replaces the current step's title until commit. Current annotations, the current operation/result and future steps are hidden.
4. The rationale must also be mathematically true. In algebra, dividing both sides by a nonzero number BEFORE subtracting a constant is a valid solving path, not an order-of-operations violation. Reject questions/rationales claiming otherwise. An operation question needs an explicit target that makes the requested choice uniquely appropriate, not merely the author's preferred first move.
Use safe=false for any failed or uncertain check; optional questions may be omitted while retaining the worked example. Return exactly one review per candidate, using its index. State the concrete reason. Do not insist that every example needs a question.
Candidates: ${JSON.stringify(candidates.map((a, index) => ({ index, question: a, visible: predictionExposure(input, a), hiddenStep: input.steps[a.stepIndex].content })))}`,
      config: {
        thinkingConfig: { thinkingLevel: ThinkingLevel.HIGH }, responseMimeType: 'application/json',
        responseSchema: { type: Type.OBJECT, properties: { reviews: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: {
          index: { type: Type.INTEGER }, safe: { type: Type.BOOLEAN }, reason: { type: Type.STRING },
        }, required: ['index', 'safe', 'reason'] } } }, required: ['reviews'] },
      },
    });
    const { reviews } = JSON.parse(response.text || '{}');
    const safe: ChallengeAssignment[] = [];
    candidates.forEach((assignment, index) => {
      const matches = Array.isArray(reviews) ? reviews.filter(r => r?.index === index) : [];
      if (matches.length === 1 && matches[0].safe === true && typeof matches[0].reason === 'string') safe.push(assignment);
      else dropped.push({ assignment, reason: matches[0]?.reason || 'Missing or malformed prediction review' });
    });
    return { safe, dropped };
  } catch (error) {
    return { safe: [], dropped: [...dropped, ...candidates.map(assignment => ({ assignment, reason: `Prediction review unavailable: ${error instanceof Error ? error.message : String(error)}` }))] };
  }
}
