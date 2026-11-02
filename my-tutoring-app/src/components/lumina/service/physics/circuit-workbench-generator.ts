import type { GenerationContext } from "../generation/generationContext";
import type { CircuitWorkbenchData } from "../../primitives/visual-primitives/physics/CircuitWorkbench";
import { resolveEvalModes, type ChallengeTypeDoc } from "../evalMode";
import {
  CIRCUIT_TASKS, pickLightIt, type CircuitChallenge, type CircuitTask, type Tier,
} from "../../primitives/visual-primitives/physics/circuitModel";
import { pickBreaks } from "../../primitives/visual-primitives/physics/breakModel";
import { pickConductors } from "../../primitives/visual-primitives/physics/conductorModel";
import { pickSwitches } from "../../primitives/visual-primitives/physics/switchModel";
import { pickTwoBulbs } from "../../primitives/visual-primitives/physics/twoBulbModel";
import { pickDevices } from "../../primitives/visual-primitives/physics/deviceModel";
import { pickMagnets } from "../../primitives/visual-primitives/physics/magnetModel";
import { seeded } from "../../primitives/visual-primitives/physics/buoyancyModel";
import { XRAY_LEVER } from "../../primitives/visual-primitives/physics/circuitLevers";

export type { CircuitWorkbenchData };

/**
 * Circuit workbench generator (Fork C, code-only: no content model call). Every item comes from the circuit model in
 * `circuitModel.ts` (light it) and `breakModel.ts` (find the break): the bulbs, the wires on, the broken part and the
 * check. `config.difficulty` (the support tier) sets the structure: light it starts from one wire on (easy), a wrong
 * first try (medium) or two bulbs where only one may light (hard); find the break is a loose wire (easy), a dead battery
 * or burnt-out bulb (medium), or two bulbs in a row (hard). A fresh seed every call varies the session. The mode is
 * pinned or resolved from the lesson intent; unresolved (mixed) runs some of each.
 */

const SINGLE_COUNT: Record<CircuitTask, number> = { light_it: 5, find_the_break: 4, conductor_test: 4, magnet_test: 4, add_a_switch: 4, build_device: 3, two_bulbs: 4 };
const MIXED_COUNT: Record<CircuitTask, number> = { light_it: 3, find_the_break: 2, conductor_test: 2, magnet_test: 1, add_a_switch: 1, build_device: 1, two_bulbs: 1 };

const CHALLENGE_TYPE_DOCS: Record<CircuitTask, ChallengeTypeDoc> = {
  light_it: {
    promptDoc: '"light_it": wire a battery and a bulb into a closed loop so the bulb lights (out of one battery end, through the bulb, back into the other end).',
    schemaDescription: "'light_it' (wire a closed loop so the bulb lights)",
  },
  find_the_break: {
    promptDoc: '"find_the_break": a wired light stays dark because one part is broken (a dead battery, a burnt-out bulb, a loose wire); test one part at a time and name the broken part.',
    schemaDescription: "'find_the_break' (test parts one at a time to find what is broken)",
  },
  conductor_test: {
    promptDoc: '"conductor_test": put everyday things across a gap in a circuit to see which let electricity through and light the bulb (metal does, pencil lead too; rubber, wood, plastic, paper, string and glass do not), then decide about untested things.',
    schemaDescription: "'conductor_test' (test which things let electricity through)",
  },
  magnet_test: {
    promptDoc: '"magnet_test": hold a magnet over everyday things (steel, iron, aluminium foil, a copper coin, a brass key, plastic) to see which it pulls, then decide about untested things: magnets pull iron and steel, not every metal.',
    schemaDescription: "'magnet_test' (which things a magnet pulls)",
  },
  add_a_switch: {
    promptDoc: '"add_a_switch": wire a switch into a battery-and-bulb loop so the switch turns the bulb on and off.',
    schemaDescription: "'add_a_switch' (wire a switch that turns the bulb on and off)",
  },
  build_device: {
    promptDoc: '"build_device": an open build: choose parts (bulb, motor with a fan, buzzer, switch) from a tray and wire a device that works (a fan, a night light, a doorbell, a lighthouse).',
    schemaDescription: "'build_device' (build a working device from a tray of parts)",
  },
  two_bulbs: {
    promptDoc: '"two_bulbs": wire two bulbs in a row (series: one path, dim, one out and both go out) or side by side (parallel: each its own path, bright), and test by taking a bulb out.',
    schemaDescription: "'two_bulbs' (wire two bulbs in a row or side by side)",
  },
};
const isTask = (t: string): t is CircuitTask => (CIRCUIT_TASKS as readonly string[]).includes(t);

const FRAMING: Record<CircuitTask, Record<Tier, { title: string; description: string }>> = {
  light_it: {
    easy: { title: "Light the Bulb", description: "One wire is on. Add a wire so the electricity has a path all the way round." },
    medium: { title: "Fix the Circuit", description: "These circuits do not work yet. Guess, test, and fix the wires so the bulb lights." },
    hard: { title: "Which Bulb Lights?", description: "Two bulbs, one battery. Wire a loop that lights only the bulb you are asked for." },
  },
  find_the_break: {
    easy: { title: "Something Came Loose", description: "The light will not turn on. Look closely, find what is wrong, and fix it." },
    medium: { title: "Find the Break", description: "It looks fine, but it stays dark. Test one part at a time to find what is broken." },
    hard: { title: "Two Dark Bulbs", description: "Both bulbs are dark. One broken part can do that. Test, and find which one." },
  },
  conductor_test: {
    easy: { title: "What Lets It Through?", description: "Put things in the gap and watch the bulb. Which ones light it?" },
    medium: { title: "Conductor Test", description: "Test some things in the gap, then use your tests to decide about the others." },
    hard: { title: "Shiny or Not?", description: "Some things look like they should work and do not. Test, and let the bulb decide." },
  },
  magnet_test: {
    easy: { title: "Magnet Hunt", description: "Hold the magnet over things. Which ones jump up to it?" },
    medium: { title: "What Does a Magnet Pull?", description: "Test some things, then use your tests to decide about the rest." },
    hard: { title: "Not Every Metal", description: "Some metal things stay put. Test, and find out which metal a magnet pulls." },
  },
  add_a_switch: {
    easy: { title: "Add a Switch", description: "Finish the loop through the switch, then flip it. Does the bulb turn on and off?" },
    medium: { title: "Switch It On", description: "This bulb is always on. Put a switch in the loop so you can turn it off." },
    hard: { title: "A Backwards Switch", description: "This switch does something strange. Test it, then wire it so it works." },
  },
  build_device: {
    easy: { title: "Make It Work", description: "Choose your parts and wire them. Can you make a fan spin or a light shine?" },
    medium: { title: "Gadget Builder", description: "Build a device with a switch: a night light, a doorbell, a fan." },
    hard: { title: "Lighthouse Engineer", description: "Two parts, one switch. Build a device where both work together." },
  },
  two_bulbs: {
    easy: { title: "Bulbs in a Row", description: "Wire two bulbs on one path. How bright are they? Take one out and see." },
    medium: { title: "Side by Side", description: "Give each bulb its own path to the battery. What happens when you take one out?" },
    hard: { title: "Rewire the Bulbs", description: "These bulbs are wired one way. Test them, then wire them the other way." },
  },
};
const MIXED_FRAMING = { title: "The Electric Workbench", description: "Wire circuits that light, then find what is broken in the ones that do not." };

/** The band from the exact grade where the lesson has one (`ctx.grade`: 'K', '1'..'12'); else from the grade key,
 *  which can be only a band ('elementary' covers grades 1-5). */
export function circuitBand(gradeLevel: string, grade?: string): CircuitWorkbenchData["gradeBand"] {
  const n = parseInt(grade ?? '', 10);
  if (Number.isFinite(n)) return n >= 3 ? "3-5" : "K-2";
  return /\b([3-5]|third|fourth|fifth)\b/i.test(gradeLevel) ? "3-5" : "K-2";
}

/** A session of the given tasks (in ladder order); one task fills it, a mix runs some of each. */
export function buildCircuitWorkbench(
  ctx: Pick<GenerationContext, "gradeLevel" | "supportTier" | "grade">, seed = Date.now(), tasks: readonly CircuitTask[] = ["light_it"],
): CircuitWorkbenchData {
  const tier: Tier = ctx.supportTier ?? "medium";
  const rng = seeded(seed);
  const counts = tasks.length === 1 ? SINGLE_COUNT : MIXED_COUNT;
  const challenges: CircuitChallenge[] = [];
  if (tasks.includes("light_it")) challenges.push(...pickLightIt(counts.light_it, tier, rng, "light"));
  if (tasks.includes("find_the_break")) challenges.push(...pickBreaks(counts.find_the_break, tier, rng, "break"));
  if (tasks.includes("build_device")) challenges.push(...pickDevices(counts.build_device, tier, rng, "device"));
  if (tasks.includes("two_bulbs")) challenges.push(...pickTwoBulbs(counts.two_bulbs, tier, rng, "two"));
  if (tasks.includes("magnet_test")) challenges.push(...pickMagnets(counts.magnet_test, tier, rng, "magnet"));
  if (tasks.includes("add_a_switch")) challenges.push(...pickSwitches(counts.add_a_switch, tier, rng, "switch"));
  if (tasks.includes("conductor_test")) challenges.push(...pickConductors(counts.conductor_test, tier, rng, "cond"));
  // Where the levers start: at easy the charge dots are drawn from the start. A starting position is not a pull.
  if (tier === "easy") challenges.forEach(c => { c.startLevers = [XRAY_LEVER]; });
  return {
    ...(tasks.length > 1 ? MIXED_FRAMING : FRAMING[tasks[0]][tier]),
    challenges,
    challengeType: tasks[0],
    gradeBand: circuitBand(ctx.gradeLevel, ctx.grade),
    supportTier: tier,
  };
}

export async function generateCircuitWorkbench(ctx: GenerationContext): Promise<CircuitWorkbenchData> {
  // Explicit pin wins (no model call); otherwise the intent resolves the task(s). null => mixed: some of each.
  const resolution = await resolveEvalModes(
    "circuit-workbench",
    { targetEvalMode: ctx.targetEvalMode, intent: ctx.intent, objectiveText: ctx.objective?.text },
    CHALLENGE_TYPE_DOCS,
  );
  const resolved = (resolution?.allowedTypes ?? CIRCUIT_TASKS).filter(isTask);
  const tasks = CIRCUIT_TASKS.filter(t => resolved.includes(t));
  return buildCircuitWorkbench(ctx, (Date.now() ^ Math.floor(Math.random() * 0x7fffffff)) >>> 0, tasks.length ? tasks : ["light_it"]);
}
