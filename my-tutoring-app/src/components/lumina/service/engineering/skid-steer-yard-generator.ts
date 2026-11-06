import type { GenerationContext } from "../generation/generationContext";
import { resolveEvalModes, type ChallengeTypeDoc } from "../evalMode";
import { airplaneBand } from "./gemini-airplane-diorama";
import type { SkidSteerYardData } from "../../primitives/visual-primitives/engineering/SkidSteerYard";
import {
  pickMatchAttachment, pickSetLevers, SKID_STEER_TASKS, type SkidSteerChallenge, type SkidSteerTask,
} from "../../primitives/visual-primitives/engineering/skidSteerModel";

export type { SkidSteerYardData };

/**
 * Skid steer yard generator (Fork C, code-only): no content model call. Code picks every item from the difficulty and
 * a random draw and writes every ask, so each run differs and every key is computed by the same check the learner's
 * press runs.
 * - match_attachment (`pickMatchAttachment`): five different jobs; easy offers 3 tools and no near miss, hard 4 with it.
 * - set_levers (`pickSetLevers`): five different things to face, both sides, a room ramp from open yard to boxed in.
 *
 * Modes: an explicit pin wins with no model call; otherwise `resolveEvalModes` reads the lesson's intent (one
 * flash-lite enum call); null is mixed: two jobs, then three turns. Topic fit comes from the catalog entry, which
 * names only the skid steer lessons this world was built for.
 *
 * Difficulty: the lesson's `config.difficulty` when it sends one; otherwise K-2 starts easy and 3-5 starts medium.
 */

const CHALLENGE_TYPE_DOCS: Record<SkidSteerTask, ChallengeTypeDoc> = {
  match_attachment: {
    promptDoc: '"match_attachment": a job waits in front of the skid steer; pick the attachment that does it (bucket, forks, auger, broom, snow blade, grapple).',
    schemaDescription: "'match_attachment' (pick the tool for a job)",
  },
  set_levers: {
    promptDoc: '"set_levers": set the left and right wheel levers to turn the skid steer to face a thing in the yard.',
    schemaDescription: "'set_levers' (steer with the two wheel levers)",
  },
};

const isTask = (t: string): t is SkidSteerTask => (SKID_STEER_TASKS as readonly string[]).includes(t);

const FRAMING: Record<SkidSteerTask | "mixed", { title: string; description: string }> = {
  match_attachment: { title: "The Right Tool for the Job",
    description: "A skid steer can swap its bucket for other tools. Pick the attachment each job needs." },
  set_levers: { title: "Drive the Skid Steer",
    description: "A skid steer has no steering wheel. Set its left wheels and right wheels to turn it toward each job." },
  mixed: { title: "Skid Steer Yard",
    description: "Pick the right attachment for each job, then steer the skid steer with its two wheel levers." },
};

export const generateSkidSteerYard = async (ctx: GenerationContext): Promise<SkidSteerYardData> => {
  const band = airplaneBand(ctx);
  const resolution = await resolveEvalModes(
    "skid-steer-yard",
    { targetEvalMode: ctx.targetEvalMode, intent: ctx.intent, objectiveText: ctx.objective?.text },
    CHALLENGE_TYPE_DOCS,
  );
  const resolved = (resolution?.allowedTypes ?? SKID_STEER_TASKS).filter(isTask);
  const tasks: SkidSteerTask[] = resolved.length ? SKID_STEER_TASKS.filter(t => resolved.includes(t)) : [...SKID_STEER_TASKS];
  const tier = ctx.supportTier ?? (band === "K-2" ? "easy" : "medium");

  let challenges: SkidSteerChallenge[];
  if (tasks.length === 1) {
    challenges = tasks[0] === "match_attachment" ? pickMatchAttachment(tier) : pickSetLevers(tier);
  } else {
    // Jobs first (the easier mode), then turns; ids re-numbered across the session.
    challenges = [...pickMatchAttachment(tier, 2), ...pickSetLevers(tier, 3)].map((c, i) => ({ ...c, id: `ss-${i + 1}` }));
  }
  console.log(
    `[SkidSteerYard] modes: ${resolution ? `${resolution.modes.map(m => m.evalMode).join("+")} (${resolution.source})` : "mixed"}`
    + ` band=${band} tier=${tier} items=[${challenges.map(c => c.type === "match_attachment" ? `${c.job}:${c.options.length}` : `${c.goal}/${c.side}/${c.room}`).join(", ")}]`,
  );
  const framing = FRAMING[tasks.length > 1 ? "mixed" : tasks[0]];
  return {
    ...framing,
    challenges,
    challengeType: challenges[0].type,
    gradeBand: band,
    supportTier: tier,
  };
};
