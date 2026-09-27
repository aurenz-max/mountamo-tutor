/**
 * Authoring call for a composed demonstration (LA-15).
 *
 * The author diagnoses from the primitive's own evidence — the task, its values and facts,
 * and every response the learner gave on this item — and returns that diagnosis beside a
 * flat script: which piece, which operation, the example values, and the learner's own
 * values. The tutor's words, when it sends any, are a note, not the source: on the
 * 2026-09-26 bench the author did as well with the evidence alone.
 *
 * Code refuses a script it cannot draw or that is the learner's own problem or answer (one
 * retry with the refusal), then builds every frame and caption. 'none' still carries the
 * diagnosis, so the tutor can teach the step in words.
 */
import { Type, type Schema, ThinkingLevel } from '@google/genai';
import { ai } from '../geminiClient';
import {
  DEMO_MENU, DEMO_OPERATIONS, DEMO_PIECES, buildDemonstration, demoRefusal, repairScript,
  type Demonstration, type DemoScript,
} from '../../components/live-activity/demo/demoContract';
import { describeEvidence, type DemonstrationEvidence } from '../../components/live-activity/demo/demonstrationEvidence';

const MODEL = 'gemini-flash-latest';
const OPERATIONS = Array.from(new Set(Object.values(DEMO_OPERATIONS).flat()));

/** The lesson facts a demonstration is authored against, beyond what the runtime snapshot carries. */
export interface DemonstrationLesson { topic: string; grade: string; gradeLevel: string; objectiveText: string }

const schema: Schema = {
  type: Type.OBJECT,
  properties: {
    diagnosis: { type: Type.STRING, description: "What the learner's responses show they are missing, in one plain sentence about the step, e.g. 'Counts the starting number as the first hop.'" },
    sameAnswerOtherMistake: { type: Type.STRING, description: "A DIFFERENT mistake that would produce exactly the same responses on this task, in one sentence; empty string if none would." },
    rationale: { type: Type.STRING },
    piece: { type: Type.STRING, enum: [...DEMO_PIECES, 'none'] },
    operation: { type: Type.STRING, enum: OPERATIONS },
    values: { type: Type.ARRAY, items: { type: Type.INTEGER } },
    denominator: { type: Type.INTEGER },
    studentValues: { type: Type.ARRAY, items: { type: Type.INTEGER } },
    focus: { type: Type.STRING },
  },
  required: ['diagnosis', 'sameAnswerOtherMistake', 'rationale', 'piece', 'operation', 'values', 'denominator', 'studentValues', 'focus'],
  propertyOrdering: ['diagnosis', 'sameAnswerOtherMistake', 'rationale', 'piece', 'operation', 'values', 'denominator', 'studentValues', 'focus'],
};

export type DemonstrationResult =
  | { kind: 'demonstration'; diagnosis: string; script: DemoScript; demonstration: Demonstration; rationale: string }
  | { kind: 'none'; diagnosis: string; rationale: string };

export async function composeDemonstration(lesson: DemonstrationLesson, evidence: DemonstrationEvidence, note?: string): Promise<DemonstrationResult> {
  const base = `You design a short worked demonstration for a stuck learner in a live lesson. Code will draw it and write every caption; you diagnose and choose the example.

LESSON: "${lesson.topic}" (Grade ${lesson.grade})
OBJECTIVE: ${lesson.objectiveText}
CURRENT ACTIVITY: ${evidence.primitiveId}${evidence.evalMode ? ` (task: ${evidence.evalMode})` : ''}
${describeEvidence(evidence)}
TUTOR'S NOTE: ${note?.trim() || 'none'}

PIECES AND WHAT THEY DRAW:
${DEMO_MENU}

First diagnose from the learner's responses what step they are missing. The tutor's note is context; the responses are the evidence. A single response often fits more than one mistake: check whether a different mistake would produce exactly the same responses, and if so choose an example that shows the step both would miss. With no wrong response yet, diagnose from the task what a learner usually needs first.
Then choose the piece and operation whose drawing shows that specific step. If none of them shows it, answer piece "none" and still give the diagnosis.
- values: a DIFFERENT example from the learner's problem, of the same kind and size, inside the lesson's range.
- denominator: 1 for whole numbers.
- studentValues: the learner's own problem in the same value format (empty if unknown).
- focus: the one thing the tutor should point at while it plays.`;

  let prompt = base;
  let diagnosis = '';
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
    const raw = JSON.parse(response.text ?? '{}') as Omit<DemoScript, 'piece'> & { piece: DemoScript['piece'] | 'none'; rationale: string; diagnosis: string; sameAnswerOtherMistake?: string };
    // Code, not the prompt, states the ambiguity: one response rarely separates two mistakes.
    const other = (raw.sameAnswerOtherMistake ?? '').trim();
    diagnosis = (other ? `Either: ${raw.diagnosis?.trim()} Or: ${other}` : (raw.diagnosis ?? '').trim()).slice(0, 300);
    if (raw.piece === 'none') return { kind: 'none', diagnosis, rationale: raw.rationale };
    const script: DemoScript = {
      piece: raw.piece, operation: raw.operation, values: raw.values ?? [], denominator: raw.denominator || 1,
      focus: raw.focus, studentValues: raw.studentValues ?? [],
    };
    const refusal = demoRefusal(script);
    const drawable = refusal ? repairScript(script) : script;
    if (drawable) return { kind: 'demonstration', diagnosis, script: drawable, demonstration: buildDemonstration(drawable), rationale: raw.rationale };
    console.warn(`[composeDemonstration] refused: ${refusal}`);
    prompt = `${base}\n\nYour previous script was refused: ${refusal} Fix it.`;
  }
  return { kind: 'none', diagnosis, rationale: 'No drawable script after one retry.' };
}
