import { Type, Schema } from '@google/genai';
import { ai } from '../geminiClient';
import type { GenerationContext } from '../generation/generationContext';
import type { SoundWaveExplorerData } from '../../primitives/visual-primitives/physics/SoundWaveExplorer';
import {
  buildSoundItems, DEFAULT_MODES, SOUND_MODES, type SoundFocus, type SoundMode, type SoundTier,
} from '../../primitives/visual-primitives/physics/soundWaveWorkspace';
import { resolveEvalModeConstraint, logEvalModeResolution, type ChallengeTypeDoc } from '../evalMode';

export type { SoundWaveExplorerData };

/**
 * Sound Wave Explorer generator. Gemini reads the topic and writes only the frame: a title, a neutral description and
 * which part of sound the lesson is about (`soundFocus`). Every item, wave, choice and key is built by code
 * (`soundWaveWorkspace.ts`, `buildSoundItems`): the model's old challenges stated their answers in the instruction,
 * named keys the screen could not show (one object drawn, "which is lower?" asked about two), and carried no wave
 * settings, so the schema carries no challenge, value or answer. `config.difficulty` picks the structural band (easy:
 * shaking words, one feature differs; medium: physical changes, crossed waves; hard: the unchanged feature asked,
 * three waves, two changes).
 */
const CHALLENGE_TYPE_DOCS: Record<SoundMode, ChallengeTypeDoc> = {
  observe: { promptDoc: 'observe: a sound maker starts or stops shaking; say what happens to the sound (or the reverse)', schemaDescription: 'Vibration and sound' },
  predict: { promptDoc: 'predict: one change to how a sound maker is played; predict the loudness or the pitch', schemaDescription: 'Predict a change' },
  classify: { promptDoc: 'classify: read drawn waves; which sound is louder or higher', schemaDescription: 'Read the waves' },
  apply: { promptDoc: 'apply: from a before and an after wave, say what was done to the sound maker', schemaDescription: 'Reverse reasoning' },
};

const FOCI: SoundFocus[] = ['vibration', 'loudness', 'pitch', 'both'];

const schema: Schema = {
  type: Type.OBJECT,
  properties: {
    title: { type: Type.STRING, description: "Short, friendly title for the sound lab, e.g. 'Shake, Rattle and Hum'. Never states a result." },
    description: { type: Type.STRING, description: 'One neutral sentence about what the learner investigates. Never says which sound is louder or higher.' },
    soundFocus: {
      type: Type.STRING,
      enum: FOCI,
      description: "What the topic is about: 'vibration' (vibrations make sound), 'loudness' (loud and soft, volume, amplitude), "
        + "'pitch' (high and low, frequency), 'both' (sound in general, or loudness and pitch together).",
    },
  },
  required: ['title', 'description', 'soundFocus'],
};

const normalizeTier = (d?: string): SoundTier => {
  const t = (d ?? '').toLowerCase().trim();
  return t === 'easy' || t === 'hard' ? t : 'medium';
};

/** K, 1, 2 or 3 from the canonical grade, else the normalized grade key; above grade 3 reads as 3, unknown as 1. */
function resolveGrade(grade: string | undefined, gradeLevel: string): 'K' | '1' | '2' | '3' {
  const g = (grade ?? '').trim().toUpperCase() || (/kinder/i.test(gradeLevel) ? 'K' : gradeLevel.match(/\d+/)?.[0] ?? '');
  if (g === 'K') return 'K';
  const n = parseInt(g, 10);
  if (isNaN(n)) return '1';
  return n <= 1 ? '1' : n === 2 ? '2' : '3';
}

export const generateSoundWaveExplorer = async (ctx: GenerationContext): Promise<SoundWaveExplorerData> => {
  const { topic } = ctx;
  const config = (ctx.raw ?? {}) as { difficulty?: string; targetEvalMode?: string; soundFocus?: SoundFocus };
  const gradeLevel = resolveGrade(ctx.grade, ctx.gradeLevel ?? '');
  const targetEvalMode = ctx.targetEvalMode ?? config.targetEvalMode;
  const constraint = resolveEvalModeConstraint('sound-wave-explorer', targetEvalMode, CHALLENGE_TYPE_DOCS);
  logEvalModeResolution('SoundWaveExplorer', targetEvalMode, constraint);
  const modes: SoundMode[] = constraint ? SOUND_MODES.filter(m => constraint.allowedTypes.includes(m)) : DEFAULT_MODES[gradeLevel];
  const tier = normalizeTier(ctx.supportTier ?? config.difficulty);

  const intent = ctx.intent ? `\nLEARNING FOCUS: "${ctx.intent}".` : '';
  const prompt = `Frame a sound lab about "${topic}" for grade ${gradeLevel}.${intent}

Code builds every question (drums, guitar strings, rubber bands, bells, tuning forks, and drawn sound waves).
The learner will: ${modes.map(m => CHALLENGE_TYPE_DOCS[m].promptDoc).join('; ')}.

Return only:
1. title: short, friendly and neutral.
2. description: one neutral sentence about what the learner investigates. Never say which sound is louder, quieter,
   higher or lower, or what a change does.
3. soundFocus: what the topic and learning focus are about. Use 'both' when the topic is sound in general.`;

  let raw: { title?: string; description?: string; soundFocus?: string } = {};
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-flash-lite-latest',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: schema,
        systemInstruction: 'You are a primary science teacher framing a sound lab. You choose what the lesson is about; you never state results.',
      },
    });
    raw = JSON.parse(response.text || '{}');
  } catch (error) {
    console.error('[sound-wave-explorer] framing call failed; using the topic-neutral frame', error);
  }

  const soundFocus: SoundFocus = config.soundFocus ?? ((FOCI as string[]).includes(raw.soundFocus ?? '') ? raw.soundFocus as SoundFocus : 'both');
  const items = buildSoundItems({ modes, tier, focus: soundFocus, rng: Math.random });

  const data: SoundWaveExplorerData = {
    title: raw.title?.trim() || 'Sound Lab',
    description: raw.description?.trim() || 'Find out how shaking makes sound, and what a drawn wave says about it.',
    soundFocus,
    challengeTypes: modes,
    difficulty: tier,
    gradeLevel,
    items,
  };
  console.log('[SoundWaveExplorer] generated', { title: data.title, gradeLevel, soundFocus, tier, modes, items: items.map(i => i.id) });
  return data;
};
