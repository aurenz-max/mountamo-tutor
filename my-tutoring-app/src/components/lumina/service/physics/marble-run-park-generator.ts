import type { GenerationContext } from "../generation/generationContext";
import type { MarbleRunParkData } from "../../primitives/visual-primitives/physics/MarbleRunPark";
import { LOOP_TOP_LEVER } from "../../primitives/visual-primitives/physics/marbleLevers";
import { MARBLE_TASKS, pickLoops, seededRng, type MarbleChallenge, type MarbleTask, type Tier } from "../../primitives/visual-primitives/physics/marbleModel";

export type { MarbleRunParkData };

/**
 * Marble Run Park generator (Fork C, code-only: no content model call). Every item comes from `marbleModel.ts`: the
 * loop's size, the eight peg heights, and what the marble does from each peg (the model runs it). `config.difficulty`
 * sets the structure: easy asks for any peg that gets round; medium for the lowest one, with a peg level with the
 * loop's top that still fails; hard the same with a strip of carpet before the loop. One mode at birth.
 */

const COUNT: Record<MarbleTask, number> = { make_the_loop: 3 };
const FRAMING: Record<Tier, { title: string; description: string }> = {
  easy: { title: "Loop the Loop", description: "Start the marble from a peg on the ramp. Can it go all the way round the loop?" },
  medium: { title: "Just High Enough", description: "Higher starts go faster. Find the lowest start that still makes the loop." },
  hard: { title: "Carpet Before the Loop", description: "Carpet slows the marble down. Find the lowest start that still makes the loop." },
};

/** The band from the exact grade where the lesson has one (`ctx.grade`: 'K', '1'..'12'); else from the grade key. */
export function marbleBand(gradeLevel: string, grade?: string): MarbleRunParkData["gradeBand"] {
  const n = parseInt(grade ?? '', 10);
  if (Number.isFinite(n)) return n >= 3 ? "3-5" : "K-2";
  return /\b([3-5]|third|fourth|fifth)\b/i.test(gradeLevel) ? "3-5" : "K-2";
}

export function buildMarbleRunPark(
  ctx: Pick<GenerationContext, "gradeLevel" | "supportTier" | "grade">, seed = Date.now(),
): MarbleRunParkData {
  const tier: Tier = ctx.supportTier ?? "medium";
  const challenges: MarbleChallenge[] = pickLoops(COUNT.make_the_loop, tier, seededRng(seed), "loop");
  // Where the levers start: at easy the loop-top line is drawn from the start. A starting position is not a pull.
  if (tier === "easy") challenges.forEach(c => { c.startLevers = [LOOP_TOP_LEVER]; });
  return {
    ...FRAMING[tier],
    challenges,
    challengeType: MARBLE_TASKS[0],
    gradeBand: marbleBand(ctx.gradeLevel, ctx.grade),
    supportTier: tier,
  };
}

export async function generateMarbleRunPark(ctx: GenerationContext): Promise<MarbleRunParkData> {
  return buildMarbleRunPark(ctx, (Date.now() ^ Math.floor(Math.random() * 0x7fffffff)) >>> 0);
}
