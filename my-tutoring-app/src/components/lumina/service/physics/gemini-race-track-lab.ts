import { Type, Schema } from '@google/genai';
import { ai } from '../geminiClient';
import type { GenerationContext } from '../generation/generationContext';
import type { RaceTrackLabData } from '../../primitives/visual-primitives/physics/RaceTrackLab';
import {
  buildRaceItems, gradeModes, RACE_MODES, type RaceMode, type RaceTier,
} from '../../primitives/visual-primitives/physics/raceTrackWorkspace';
import { resolveEvalModeConstraint, logEvalModeResolution, type ChallengeTypeDoc } from '../evalMode';

export type { RaceTrackLabData };

/**
 * Race Track Lab generator. Gemini reads the topic and writes only the frame: a title and one neutral sentence. Every
 * race, speed, start, choice and key is built by code (`raceTrackWorkspace.ts`, `buildRaceItems`): before 2026-10-15
 * the model wrote each question and its answer string, the screen printed every car's speed, and the old names
 * (Rocket Rabbit, Speedy Snail, Cheetah) hinted the winner. `config.difficulty` picks the structural band of the items
 * (easy: two cars from square 0 with a clear gap; medium: three cars, a one-square gap, a difference, a log past
 * square 0, a head start on the graph; hard: a head start that fools the eye, two cars with different times, a speed
 * read from a line that does not start at 0).
 */
const CHALLENGE_TYPE_DOCS: Record<RaceMode, ChallengeTypeDoc> = {
  observe: { promptDoc: 'observe: run a timed race and say which car is fastest', schemaDescription: 'Fastest from a timed race' },
  predict: { promptDoc: 'predict: read each car\'s speed and predict which crosses the finish line first', schemaDescription: 'Predict the winner' },
  measure: { promptDoc: 'measure: run a timed race and count the squares a car moved', schemaDescription: 'Count distance' },
  calculate: { promptDoc: 'calculate: work out a car\'s speed from distance and time', schemaDescription: 'Speed = distance / time' },
  graph: { promptDoc: 'graph: read a position-time graph (steeper is faster)', schemaDescription: 'Position-time graph' },
};

const schema: Schema = {
  type: Type.OBJECT,
  properties: {
    title: { type: Type.STRING, description: "Short title for the lab, e.g. 'Toy Car Races: Speed, Distance and Time'. Never names a winner." },
    description: { type: Type.STRING, description: 'One neutral sentence about what the learner investigates. Never says which car is faster.' },
  },
  required: ['title', 'description'],
};

const normalizeTier = (d?: string): RaceTier => {
  const t = (d ?? '').toLowerCase().trim();
  return t === 'easy' || t === 'hard' ? t : 'medium';
};

/** 'K', '1' ... '8' from the canonical grade, else from the grade prose. */
function resolveGrade(ctx: GenerationContext): string {
  const g = (ctx.grade ?? '').trim().toUpperCase();
  if (g === 'K' || /^\d+$/.test(g)) return g === 'K' ? 'K' : String(Math.min(8, parseInt(g, 10)));
  const m = ctx.gradeContext?.match(/grade\s*(\d+|K)/i)?.[1]?.toUpperCase();
  if (m) return m === 'K' ? 'K' : String(Math.min(8, parseInt(m, 10)));
  return /kindergarten/i.test(ctx.gradeContext ?? '') ? 'K' : '3';
}

export const generateRaceTrackLab = async (ctx: GenerationContext): Promise<RaceTrackLabData> => {
  const { topic } = ctx;
  const config = (ctx.raw ?? {}) as { difficulty?: string; targetEvalMode?: string };
  const grade = resolveGrade(ctx);
  const constraint = resolveEvalModeConstraint('race-track-lab', ctx.targetEvalMode ?? config.targetEvalMode, CHALLENGE_TYPE_DOCS);
  logEvalModeResolution('race-track-lab', ctx.targetEvalMode ?? config.targetEvalMode, constraint);
  const modes: RaceMode[] = constraint ? RACE_MODES.filter(m => constraint.allowedTypes.includes(m)) : gradeModes(grade);
  const tier = normalizeTier(config.difficulty);

  const intent = ctx.intent ? `\nLEARNING FOCUS: "${ctx.intent}".` : '';
  const prompt = `Frame a race track lab about "${topic}" for grade ${grade}.${intent}

Code builds every race (toy cars named by colour on a track of numbered squares).
The learner will: ${modes.map(m => CHALLENGE_TYPE_DOCS[m].promptDoc).join('; ')}.

Return only:
1. title: short and neutral, in words a grade ${grade} learner can read.
2. description: one neutral sentence about what the learner investigates. Never say which car is faster or wins.`;

  let raw: { title?: string; description?: string } = {};
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-flash-lite-latest',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: schema,
        systemInstruction: 'You are a science teacher framing a speed, distance and time lab. You never state results.',
      },
    });
    raw = JSON.parse(response.text || '{}');
  } catch (error) {
    console.error('[race-track-lab] framing call failed; using the topic-neutral frame', error);
  }

  const items = buildRaceItems({ modes, tier, rng: Math.random });
  const data: RaceTrackLabData = {
    title: raw.title?.trim() || 'Race Track Lab',
    description: raw.description?.trim() || 'Find out which car is faster from how far it goes and how long it takes.',
    challengeTypes: modes,
    difficulty: tier,
    grade,
    items,
  };
  console.log('🏁 Race Track Lab Generated:', { title: data.title, grade, tier, modes, items: items.map(i => i.id) });
  return data;
};
