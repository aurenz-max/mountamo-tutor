/**
 * Authoring call for a composed demonstration (LA-15 pilot).
 *
 * The model reads the tutor's stated need and the piece menu, and returns a flat script:
 * which piece, which operation, the example values, and the student's own values. Code
 * refuses a script it cannot draw or that is the student's own problem (one retry with the
 * refusal), then builds every frame and caption. 'none' means no piece can show this
 * obstacle; the caller falls back to resolveDetour.
 */
import { Type, type Schema, ThinkingLevel } from '@google/genai';
import { ai } from '../geminiClient';
import {
  DEMO_MENU, DEMO_OPERATIONS, DEMO_PIECES, buildDemonstration, demoRefusal,
  type Demonstration, type DemoScript,
} from '../../components/live-activity/demo/demoContract';
import type { DetourNeed, DetourParent } from './resolveDetour';

const MODEL = 'gemini-flash-latest';
const OPERATIONS = Array.from(new Set(Object.values(DEMO_OPERATIONS).flat()));

const schema: Schema = {
  type: Type.OBJECT,
  properties: {
    rationale: { type: Type.STRING },
    piece: { type: Type.STRING, enum: [...DEMO_PIECES, 'none'] },
    operation: { type: Type.STRING, enum: OPERATIONS },
    values: { type: Type.ARRAY, items: { type: Type.INTEGER } },
    denominator: { type: Type.INTEGER },
    studentValues: { type: Type.ARRAY, items: { type: Type.INTEGER } },
    focus: { type: Type.STRING },
  },
  required: ['rationale', 'piece', 'operation', 'values', 'denominator', 'studentValues', 'focus'],
  propertyOrdering: ['rationale', 'piece', 'operation', 'values', 'denominator', 'studentValues', 'focus'],
};

export type DemonstrationResult =
  | { kind: 'demonstration'; script: DemoScript; demonstration: Demonstration; rationale: string }
  | { kind: 'none'; rationale: string };

export async function composeDemonstration(parent: DetourParent, need: DetourNeed): Promise<DemonstrationResult> {
  const base = `You design a short worked demonstration for a stuck student in a live lesson. Code will draw it and write every caption; you choose the example.

LESSON: "${parent.topic}" (Grade ${parent.grade})
OBJECTIVE: ${parent.objectiveText}
CURRENT ACTIVITY: ${parent.componentId}${parent.evalMode ? ` (task: ${parent.evalMode})` : ''}
${parent.currentTask ? `STUDENT'S CURRENT PROBLEM: ${parent.currentTask}
` : ''}${parent.lastAnswer ? `STUDENT'S LAST ANSWER: ${parent.lastAnswer}
` : ''}- Obstacle: ${need.obstacle}
- Evidence: ${need.evidence || 'not stated'}
- Purpose: ${need.purpose}

PIECES AND WHAT THEY DRAW:
${DEMO_MENU}

Diagnose the missing step from the student's actual answer when one is given; the tutor's words may only name the topic.
Choose the piece and operation whose drawing shows that specific missing step. If none of them shows it, answer piece "none".
- values: a DIFFERENT example from the student's problem, of the same kind and size, inside the lesson's range.
- denominator: 1 for whole numbers.
- studentValues: the student's own problem in the same value format (empty if unknown).
- focus: the one thing the tutor should point at while it plays.`;

  let prompt = base;
  for (let attempt = 0; attempt < 2; attempt++) {
    const response = await ai.models.generateContent({
      model: MODEL,
      contents: prompt,
      config: {
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        responseMimeType: 'application/json',
        responseSchema: schema,
        temperature: 0.2,
      },
    });
    const raw = JSON.parse(response.text ?? '{}') as Omit<DemoScript, 'piece'> & { piece: DemoScript['piece'] | 'none'; rationale: string };
    if (raw.piece === 'none') return { kind: 'none', rationale: raw.rationale };
    const script: DemoScript = {
      piece: raw.piece, operation: raw.operation, values: raw.values ?? [], denominator: raw.denominator || 1,
      focus: raw.focus, studentValues: raw.studentValues ?? [],
    };
    const refusal = demoRefusal(script);
    if (!refusal) return { kind: 'demonstration', script, demonstration: buildDemonstration(script), rationale: raw.rationale };
    console.warn(`[composeDemonstration] refused: ${refusal}`);
    prompt = `${base}\n\nYour previous script was refused: ${refusal} Fix it.`;
  }
  return { kind: 'none', rationale: 'No drawable script after one retry.' };
}
