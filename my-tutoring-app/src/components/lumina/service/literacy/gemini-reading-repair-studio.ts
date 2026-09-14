import { Type, type Schema } from '@google/genai';
import { ai } from '../geminiClient';
import { resolveEvalModes, buildModeConstraintSection, type ChallengeTypeDoc } from '../evalMode';
import type { GenerationContext } from '../generation/generationContext';
import type { ReadingRepairStudioData } from '../../primitives/visual-primitives/literacy/ReadingRepairStudio';
import { normalizeReading, readingWords } from '../../primitives/visual-primitives/literacy/readingRepairEvidence';

const CHALLENGE_TYPE_DOCS: Record<string, ChallengeTypeDoc> = {
  notice_and_repair: {
    promptDoc: '"notice_and_repair": Read unfamiliar print cold, check the learner\'s own recording against letters and sentence meaning, mark any words to revisit, then reread. Accurate first readings need no repair. Three fresh 5-8 word sentences; no supplied misreading or model. Audio feedback is provisional local practice, not mastery.',
    schemaDescription: "'notice_and_repair' (check and reread one's own reading)",
  },
};

const sentenceSchema: Schema = {
  type: Type.OBJECT,
  properties: { text: { type: Type.STRING, description: 'One complete natural sentence, 5-8 words.' } },
  required: ['text'],
};

export function validRepairSentence(value: unknown): value is { text: string } {
  if (!value || typeof value !== 'object' || !('text' in value) || typeof value.text !== 'string') return false;
  const text = value.text;
  const count = readingWords(text).length;
  return text === text.trim() && count >= 5 && count <= 8
    && /^[A-Z][a-zA-Z ,'-]+[.!?]$/.test(text)
    && !/\b(read|wind|lead|live|tear|bow|minute|close|record|present)\b/i.test(text);
}

/** Fork B: three independent content-bearing calls, bounded repair, no fixtures. */
export async function generateReadingRepairStudio(ctx: GenerationContext): Promise<ReadingRepairStudioData> {
  const pin = ctx.targetEvalMode?.trim();
  if (pin && pin !== 'mixed' && !CHALLENGE_TYPE_DOCS[pin]) {
    throw new Error(`[reading-repair-studio] Unsupported eval mode: ${pin}`);
  }
  const resolution = await resolveEvalModes('reading-repair-studio', {
    targetEvalMode: pin, intent: ctx.intent, objectiveText: ctx.objective.text,
  }, CHALLENGE_TYPE_DOCS);
  // Single-mode path: Gemini generates only sentence content. The orchestrator
  // stamps the sole task identity; there is no model-selected enum to constrain.
  const modePrompt = resolution ? buildModeConstraintSection(resolution, CHALLENGE_TYPE_DOCS)
    : `SINGLE AVAILABLE TASK:\n${CHALLENGE_TYPE_DOCS.notice_and_repair.promptDoc}`;
  console.log(`[ReadingRepairStudio] mode: notice_and_repair (${resolution?.source ?? 'single-mode default'}); requested: ${pin ?? 'auto'}; assessment: provisional-local-only`);
  const accepted: { text: string }[] = [];
  const seen = new Set<string>();
  const angles = ['an everyday action with a clear time clue', 'an observation with a place clue', 'a new event with a cause or meaning clue'];
  for (let round = 0; round < 3 && accepted.length < 3; round++) {
    const missing = 3 - accepted.length;
    const candidates = await Promise.all(Array.from({ length: missing }, async (_, index) => {
      const result = await ai.models.generateContent({
        model: 'gemini-flash-latest',
        contents: `Write one fresh sentence for Reading Repair Studio, grade 2 language arts.
${modePrompt}
The child reads the PRINT cold, checks their OWN reading, then may reread. Do not manufacture a misreading.
Topic: ${ctx.topic}. Teaching intent: ${ctx.intent ?? ctx.objective.text ?? 'Monitor word reading and self-correct using print and sentence meaning'}.
Grade ceiling: ${ctx.gradeContext}. Use familiar, concrete grade-two vocabulary even if the broad grade band is older.
This sentence should feature ${angles[(accepted.length + index) % angles.length]}.
Exactly 5-8 words, one complete sentence, natural grammar, ordinary ASCII letters, spaces, optional comma, final punctuation.
Sentence meaning should help a reader check a word, while the letters remain the reference. No nonsense, missing words, hints, marked target, model reading, questions about spelling, or intentional errors.
Avoid pronunciation-ambiguous words: read, wind, lead, live, tear, bow, minute, close, record, present. Avoid proper names, abbreviations, digits and hyphens.
Do not repeat these sentences or their wording: ${JSON.stringify(accepted.map(c => c.text))}.
Variation seed: ${crypto.randomUUID()}. Return only text in the required JSON.`,
        config: { responseMimeType: 'application/json', responseSchema: sentenceSchema },
      });
      if (!result.text) throw new Error('[reading-repair-studio] Empty generation response');
      const candidate: unknown = JSON.parse(result.text);
      if (!validRepairSentence(candidate)) {
        console.warn('[reading-repair-studio] Rejected invalid sentence contract');
        return null;
      }
      return candidate;
    }));
    for (const candidate of candidates) {
      if (!candidate) continue;
      const key = normalizeReading(candidate.text).join(' ');
      if (seen.has(key)) { console.warn('[reading-repair-studio] Rejected duplicate sentence'); continue; }
      seen.add(key);
      accepted.push(candidate);
    }
  }
  if (accepted.length !== 3) throw new Error('[reading-repair-studio] Could not generate three valid unique sentences');
  return { title: 'Reading Repair Studio', description: 'Read, listen back, and check the print.',
    gradeLevel: ctx.gradeLevel, challengeType: 'notice_and_repair',
    challenges: accepted.map((sentence, index) => ({ ...sentence, id: `reading-repair-${index + 1}`, challengeType: 'notice_and_repair' })) };
}
