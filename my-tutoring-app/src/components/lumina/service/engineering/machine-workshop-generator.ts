import type { GenerationContext } from "../generation/generationContext";
import type { MachineWorkshopData } from "../../primitives/visual-primitives/engineering/MachineWorkshop";
import {
  MACHINE_TASKS, buildItem, machineFair, seededRng, type ItemWords, type MachineChallenge, type Rng, type Tier,
} from "../../primitives/visual-primitives/engineering/machineModel";
import { authorMachines, type AuthorResult } from "./machine-author";

export type { MachineWorkshopData };

/**
 * Machine Workshop generator. The author agent (`machine-author.ts`) picks real machines for the lesson and names
 * their parts in order; code checks that each chain assembles and is the real machine, and falls back to the atlas
 * for any that are not. Code then builds every number: the tray, the part sizes, the stroke the working end can use,
 * the push it needs (`buildItem`), and keeps an item only if exactly the two promised builds work (`machineFair`).
 * `config.difficulty` sets the structure: easy = only the pairing matters; medium = sizes matter (too small, too
 * far, a rod that jams); hard = a bigger crank fits but pushes too weakly. One mode at birth.
 */

const COUNT = 3;

const FRAMING: Record<Tier, { title: string; description: string }> = {
  easy: { title: "Spin to Push", description: "Each machine has a wheel that spins round and round, but its working end must go up and down. Pick the parts that turn one into the other." },
  medium: { title: "The Right Size", description: "Build the part that turns spinning into up-and-down, and pick sizes that make the working end go just far enough." },
  hard: { title: "Far Enough, Strong Enough", description: "A bigger crank pushes farther but weaker. Build a part that goes far enough and still pushes hard enough." },
};

export function machineBand(gradeLevel: string, grade?: string): MachineWorkshopData["gradeBand"] {
  const n = grade === 'K' ? 0 : parseInt(grade ?? '', 10);
  if (Number.isFinite(n)) return n >= 6 ? "6-8" : n >= 3 ? "3-5" : "K-2";
  if (/\b(6|7|8|sixth|seventh|eighth|middle)\b/i.test(gradeLevel)) return "6-8";
  return /\b(k|kindergarten|1|2|first|second)\b/i.test(gradeLevel) ? "K-2" : "3-5";
}

/** Items from authored words: code numbers, kept only when fair (a few redraws of the sizes, then skipped). */
export function buildMachineItems(words: readonly ItemWords[], tier: Tier, band: MachineWorkshopData["gradeBand"], rng: Rng): MachineChallenge[] {
  const items: MachineChallenge[] = [];
  words.forEach((w, i) => {
    for (let tries = 0; tries < 6; tries++) {
      const item = buildItem(`machine-${i + 1}`, w, tier, band, rng);
      if (machineFair(item)) { items.push(item); return; }
    }
    console.warn(`[machine-workshop] no fair item for ${w.machine} at ${tier}`);
  });
  return items;
}

export function assembleMachineWorkshop(authored: AuthorResult, tier: Tier, band: MachineWorkshopData["gradeBand"], rng: Rng): MachineWorkshopData {
  const challenges = buildMachineItems(authored.picks.map(p => p.words), tier, band, rng);
  return {
    ...FRAMING[tier],
    challenges,
    challengeType: MACHINE_TASKS[0],
    gradeBand: band,
    supportTier: tier,
    authoring: {
      calls: authored.calls,
      sources: authored.picks.map(p => `${p.words.machine}:${p.source}`),
      rejected: authored.picks.filter(p => p.errors.length).map(p => ({ machine: p.words.machine, errors: p.errors })),
      repaired: authored.picks.filter(p => p.firstErrors?.length).map(p => ({ machine: p.words.machine, errors: p.firstErrors! })),
      ...(authored.failure ? { failure: authored.failure } : {}),
    },
  };
}

export async function generateMachineWorkshop(ctx: GenerationContext): Promise<MachineWorkshopData> {
  const band = machineBand(ctx.gradeLevel, ctx.grade);
  // Easy unless the lesson asks for more: most learners have never seen a crank or a cam (user 11-05: "absurdly
  // difficult" at medium). Sizes and force are what config.difficulty adds.
  const tier: Tier = ctx.supportTier ?? "easy";
  const rng = seededRng((Date.now() ^ Math.floor(Math.random() * 0x7fffffff)) >>> 0);
  const authored = await authorMachines(
    { topic: ctx.topic, intent: ctx.intent, objective: ctx.objective?.text, gradeLevel: ctx.gradeLevel, grade: ctx.grade },
    COUNT, rng,
  );
  return assembleMachineWorkshop(authored, tier, band, rng);
}
