import type { GenerationContext } from "../generation/generationContext";
import type { WaveTankData } from "../../primitives/visual-primitives/physics/WaveTank";
import { CHANGES_LEVER } from "../../primitives/visual-primitives/physics/waveLevers";
import { WAVE_TASKS, pickKnocks, seededRng, type WaveChallenge, type WaveTask, type Tier } from "../../primitives/visual-primitives/physics/waveModel";
import { marbleBand } from "./marble-run-park-generator";

export type { WaveTankData };

/**
 * Wave Tank generator (Fork C, code-only: no content model call). Every item comes from `waveModel.ts`: the first
 * wave's paddle settings and the tower's strength (a wave knocks it down when size × speed reaches it).
 * `config.difficulty` sets the structure: easy, one step up on either setting is enough; medium, one step is not enough
 * on either; hard, the push size is stuck, so only pushing faster (more than one step) works. One mode at birth.
 */

const COUNT: Record<WaveTask, number> = { knock_it_down: 3 };
const FRAMING: Record<Tier, { title: string; description: string }> = {
  easy: { title: "Make a Bigger Wave", description: "The paddle makes waves. Change one thing so a wave knocks the tower down." },
  medium: { title: "Waves That Knock Things Down", description: "Taller waves and closer-together waves carry more energy. Change one thing about the paddle, enough to knock the tower down." },
  hard: { title: "The Stuck Paddle", description: "The paddle cannot push any bigger. Can a wave still carry enough energy to knock the tower down?" },
};

export const waveBand = marbleBand;

export function buildWaveTank(
  ctx: Pick<GenerationContext, "gradeLevel" | "supportTier" | "grade">, seed = Date.now(),
): WaveTankData {
  const tier: Tier = ctx.supportTier ?? "medium";
  const challenges: WaveChallenge[] = pickKnocks(COUNT.knock_it_down, tier, seededRng(seed), "wave");
  // Where the levers start: at easy the first wave's settings are ringed from the start. A starting position is not a pull.
  if (tier === "easy") challenges.forEach(c => { c.startLevers = [CHANGES_LEVER]; });
  return {
    ...FRAMING[tier],
    challenges,
    challengeType: WAVE_TASKS[0],
    gradeBand: waveBand(ctx.gradeLevel, ctx.grade),
    supportTier: tier,
  };
}

export async function generateWaveTank(ctx: GenerationContext): Promise<WaveTankData> {
  return buildWaveTank(ctx, (Date.now() ^ Math.floor(Math.random() * 0x7fffffff)) >>> 0);
}
