import { Type, type Schema } from '@google/genai';
import { ai } from '../geminiClient';
import {
  deriveResponseClass, normalizeSpokenAnswer,
  type SpokenPracticeItem, type SpokenPracticeMode,
} from '../../primitives/visual-primitives/direct-instruction/diSpokenPracticeScript';

const TASKS = ['visual_naming', 'read_aloud', 'say_answer', 'count_and_say', 'unsupported'] as const;
type Task = typeof TASKS[number];

export interface SpokenTarget {
  id: string;
  stimulusText: string;
  stimulusEmoji: string;
  expectedAnswer: string;
  alternates: string[];
  sourceQuote: string;
}

export interface SpokenPracticePlan {
  task: Task;
  closedSet: boolean;
  targets: SpokenTarget[];
}

// Built via the RegExp constructor, not a /u-flagged literal: this project's
// es5 compile target rejects the `u` flag on regex literal syntax (TS1501),
// but a string-built pattern is only checked at runtime, where Node's regex
// engine has supported \p{} Unicode property escapes since ES2018.
const TOKEN_PATTERN = new RegExp("[\\p{L}\\p{N}]+(?:['’][\\p{L}\\p{N}]+)*|[^\\s]", 'gu');

/** Syntactic inventory only: the model decides WHICH tokens are instructional
 * targets. IDs keep punctuation/Unicode intact across structured generation. */
export function spokenSourceTokens(sources: string[]): Array<{ id: string; text: string }> {
  const tokens = new Set(sources.flatMap(s => s.match(TOKEN_PATTERN) ?? []));
  return Array.from(tokens).map((text, i) => ({ id: `t${i + 1}`, text }));
}

const planSchema = (sources: string[]): Schema => ({
  type: Type.OBJECT,
  properties: {
    task: { type: Type.STRING, enum: [...TASKS] },
    closedSet: { type: Type.BOOLEAN },
    targets: {
      type: Type.ARRAY, maxItems: '6',
      items: {
        type: Type.OBJECT,
        properties: {
          stimulusId: { type: Type.STRING, enum: [...spokenSourceTokens(sources).map(t => t.id), 'picture'] },
          stimulusText: { type: Type.STRING, description: 'Picture label ONLY; empty for a selected text token.' },
          stimulusEmoji: { type: Type.STRING },
          expectedAnswer: { type: Type.STRING },
          alsoAccept: { type: Type.STRING, description: 'Comma-separated equally correct names; empty if none.' },
          sourceId: { type: Type.STRING, enum: sources.map((_, i) => `s${i + 1}`) },
        },
        required: ['stimulusId', 'stimulusText', 'stimulusEmoji', 'expectedAnswer', 'alsoAccept', 'sourceId'],
      },
    },
  },
  required: ['task', 'closedSet', 'targets'],
});

const text = (v: unknown): string => typeof v === 'string' ? v.trim() : '';
const record = (v: unknown): Record<string, unknown> =>
  v !== null && typeof v === 'object' && !Array.isArray(v) ? v as Record<string, unknown> : {};

/** Structural/grounding checks precede a separate semantic review. Grounding
 * alone does not prove that the model extracted the complete or correct set. */
export function parseSpokenPlan(raw: unknown, sources: string[]): SpokenPracticePlan {
  const value = record(raw);
  const tokens = spokenSourceTokens(sources);
  if (!TASKS.includes(value.task as Task) || typeof value.closedSet !== 'boolean'
    || !Array.isArray(value.targets) || value.targets.length > 6) throw new Error('Invalid task plan');
  const task = value.task as Task;
  const targets = value.targets.map((rawTarget, i): SpokenTarget => {
    const t = record(rawTarget);
    const picture = t.stimulusId === 'picture';
    const selected = tokens.find(token => token.id === t.stimulusId);
    const stimulusText = picture ? text(t.stimulusText) : selected?.text ?? '';
    const stimulusEmoji = picture ? text(t.stimulusEmoji) : '';
    const expectedAnswer = normalizeSpokenAnswer(text(t.expectedAnswer));
    const sourceIndex = sources.findIndex((_, i) => `s${i + 1}` === t.sourceId);
    const sourceQuote = sources[sourceIndex] ?? '';
    const alternates = text(t.alsoAccept).split(',').map(normalizeSpokenAnswer)
      .filter(a => a && a.toLowerCase() !== expectedAnswer.toLowerCase());
    if (!stimulusText || !expectedAnswer || !sourceQuote || (picture ? !stimulusEmoji : !sourceQuote.includes(stimulusText))
      || !deriveResponseClass(task === 'read_aloud' ? 'read_aloud' : 'say_answer', expectedAnswer, stimulusText)
      || alternates.some(a => !deriveResponseClass('say_answer', a, stimulusText))) {
      throw new Error('Ungrounded or unsupported target');
    }
    if (task === 'read_aloud' && (stimulusEmoji
      || normalizeSpokenAnswer(stimulusText).toLowerCase() !== expectedAnswer.toLowerCase()
      || alternates.length)) throw new Error('Reading target does not match printed text');
    return { id: `target-${i + 1}`, stimulusText, stimulusEmoji, expectedAnswer, alternates, sourceQuote };
  });
  if (new Set(targets.map(t => t.stimulusEmoji || t.stimulusText.toLowerCase())).size !== targets.length) {
    throw new Error('Duplicate targets');
  }
  if ((task === 'visual_naming' || value.closedSet) && targets.length === 0) throw new Error('Missing targets');
  if (targets.length && task !== 'visual_naming' && task !== 'read_aloud') throw new Error('Unsupported target task');
  return { task, closedSet: value.closedSet, targets };
}

export function modeForSpokenPlan(plan: SpokenPracticePlan): SpokenPracticeMode | null {
  return plan.task === 'unsupported' ? null : plan.task === 'visual_naming' ? 'say_answer' : plan.task;
}

export async function planSpokenPractice(
  topic: string, gradeLevel: string, intent?: string, objectiveText?: string,
): Promise<SpokenPracticePlan> {
  const sources = [objectiveText, intent, topic].filter((s): s is string => Boolean(s));
  const context = JSON.stringify({ topic, gradeLevel, objectiveText, intent });
  let feedback = '';
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-flash-lite-latest',
        contents: `Plan the learning task for spoken practice. Interpret the supplied text; do not write practice items.
CONTEXT: ${context}
SOURCES: ${JSON.stringify(sources.map((text, i) => ({ id: `s${i + 1}`, text })))}
PRINTED TOKEN INVENTORY: ${JSON.stringify(spokenSourceTokens(sources))}
The objective defines scope; the component intent defines this slot's action within that scope.
TASKS:
- visual_naming: retrieve the NAME of a displayed symbol or picture. The visual IS the question.
  Showing + and saying its name is recall, NOT reading. Never print the name to be recalled.
- read_aloud: decode printed words or numerals; the printed text itself is the utterance.
- say_answer: listening recall, arithmetic, or spoken manipulation of sounds/words.
- count_and_say: count displayed objects and say the total (1-10).
- unsupported: letter NAMES, open-ended answers, unsupported representations, or an impossible scope.
An answer must be 1-3 short spoken words. Letter names are not supported by this pack.
closedSet is true ONLY when the objective/intent explicitly enumerates a finite required set for
visual naming or reading. A numerical range, arithmetic topic, or phonics pattern is not such a set.
For a closed set, extract EVERY required target, once each, regardless of prominence in the topic.
For visual_naming without a named set, choose 3-4 distinct, scope-appropriate exemplars.
For reading without a named set and for other tasks, targets is empty and closedSet is false.
For printed symbols, words or numerals, SELECT stimulusId from the token inventory. Code copies
the original token, so leave stimulusText and stimulusEmoji empty. NEVER emit a replacement glyph.
For pictured objects use stimulusId "picture", one unambiguous stimulusEmoji, and the object label
in stimulusText (the label will NOT be printed). sourceId identifies the input establishing the target.
For reading, expectedAnswer is the printed text (digits may become spoken number words); no alternates.
For naming, expectedAnswer/alsoAccept contain correct names, not definitions or associated concepts.
Do not truncate a required set larger than six: use unsupported with no targets instead.
${feedback}`,
        config: { responseMimeType: 'application/json', responseSchema: planSchema(sources), maxOutputTokens: 2048,
          httpOptions: { timeout: 20000 } },
      });
      const plan = parseSpokenPlan(JSON.parse(response.text || '{}'), sources);
      // Review even an empty/open plan: otherwise misclassifying a named set
      // as generic practice would bypass the coverage contract entirely.
      {
        const review = await ai.models.generateContent({
          model: 'gemini-flash-lite-latest',
          contents: `Independently check this proposed spoken-practice plan against the ORIGINAL context.
CONTEXT: ${context}
PLAN: ${JSON.stringify(plan)}
Reject if the task changes the requested learner action, any required named member is missing,
any target is outside scope, a symbol glyph or picture is wrong/ambiguous, any name/alternate is
incorrect, or a letter-name task was admitted. Check EVERY displayed stimulus against its answer.
A named list must be marked closedSet and fully represented, even if another member dominates the topic.
Reading must decode the printed text; naming a symbol/picture must retrieve its name without printing it.
Do not approve merely because quotes occur in the input. Return valid and a short reason.`,
          config: {
            responseMimeType: 'application/json', maxOutputTokens: 1024, httpOptions: { timeout: 20000 },
            responseSchema: { type: Type.OBJECT, properties: {
              valid: { type: Type.BOOLEAN }, reason: { type: Type.STRING },
            }, required: ['valid', 'reason'] },
          },
        });
        const verdict = record(JSON.parse(review.text || '{}'));
        if (verdict.valid !== true) throw new Error(`Plan review: ${text(verdict.reason)}`);
      }
      return plan;
    } catch (error) {
      feedback = `Previous plan failed validation: ${error instanceof Error ? error.message : 'invalid output'}`;
      console.warn(`[DiSpokenPractice] plan attempt ${attempt + 1}: ${feedback}`);
    }
  }
  throw new Error('No verified spoken-practice plan after two attempts');
}

/** Repetition is intentional DI practice. The model supplies a checked mapping
 * once; it never independently re-emits the glyph, answer, or correction per slot. */
export function buildPlannedSpokenItems(plan: SpokenPracticePlan, count: number): SpokenPracticeItem[] {
  const mode = modeForSpokenPlan(plan);
  if (!mode || !plan.targets.length || plan.targets.length > count) return [];
  const offset = Math.floor(Math.random() * plan.targets.length);
  return Array.from({ length: count }, (_, i) => {
    const t = plan.targets[(i + offset) % plan.targets.length];
    const reading = mode === 'read_aloud';
    return {
      id: `dsp-${i + 1}`, targetId: t.id,
      mode, action: mode, answerKind: 'voice',
      responseClass: deriveResponseClass(mode, t.expectedAnswer, t.stimulusText)!,
      stimulusRole: reading ? undefined : 'visual_target',
      stimulusKind: t.stimulusEmoji ? 'emoji' : 'text',
      answerSource: reading ? 'decode' : 'recall',
      stimulusText: t.stimulusText, stimulusEmoji: t.stimulusEmoji, stimulusCount: 0,
      ask: reading ? 'Read it out loud.' : 'What is this called?',
      howToPlay: reading ? 'Read what you see out loud.' : 'Look, then say its name.',
      expectedAnswer: t.expectedAnswer, alternates: t.alternates,
      acceptRule: reading ? 'Sounding out and then reading the whole printed text correctly counts.' : '',
      signatureError: '',
      correctionBody: reading ? `It says ${t.expectedAnswer}.` : `This is called ${t.expectedAnswer}.`,
    };
  });
}

/** Run AFTER item gates. A surviving label alone is not coverage of a target. */
export function hasPlannedCoverage(plan: SpokenPracticePlan, items: SpokenPracticeItem[], count: number): boolean {
  return items.length === count && plan.targets.every(t => items.some(item =>
    item.targetId === t.id && item.stimulusText === t.stimulusText
    && item.stimulusEmoji === t.stimulusEmoji && item.expectedAnswer === t.expectedAnswer));
}
