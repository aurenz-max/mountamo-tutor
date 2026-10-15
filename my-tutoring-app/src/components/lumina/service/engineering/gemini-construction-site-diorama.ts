import { Type, Schema } from "@google/genai";
import { ai } from "../geminiClient";
import type { GenerationContext } from "../generation/generationContext";
import { logEvalModeResolution } from "../evalMode";
import { airplaneBand } from "./gemini-airplane-diorama";
import type { ConstructionSiteDioramaData } from "../../primitives/visual-primitives/engineering/ConstructionSiteDiorama";
import { buildLoadChallenge, pickLoads } from "../../primitives/visual-primitives/engineering/constructionModel";

export type { ConstructionSiteDioramaData };

/**
 * Construction site diorama generator (Fork A). Gemini reads the lesson and returns only words: a title, one
 * sentence, a made-up company for the truck doors, and places the loads go ("the new playground"). Code picks
 * every number (`pickLoads`: different scoop counts, every material before a repeat) and writes every ask
 * (`buildLoadChallenge`), so the key and the words the learner hears come from one place.
 */

const LOADS = 5;
const FALLBACK_COMPANY = "Big Dig";
const FALLBACK_DESTINATIONS = [
  "the new playground", "the garden beds", "the school's new path", "the bridge ramp", "the soccer field",
  "the new house", "the park pond",
];

const schema: Schema = {
  type: Type.OBJECT,
  properties: {
    title: { type: Type.STRING, description: "Names the activity, 2-5 words, e.g. 'Load the Dump Truck', 'Busy Work Site'. No numbers." },
    description: { type: Type.STRING, description: "One child-friendly sentence inviting the learner to work the excavator and load the dump truck. No numbers." },
    companyName: { type: Type.STRING, description: "A made-up, friendly building company name of one or two words, 3-12 letters, painted on the truck, e.g. 'Rock Solid', 'Dig Deep'. Never a real company." },
    destinations: {
      type: Type.ARRAY,
      description: "5 different places the truck carries its load to, each starting with 'the', 2-5 words, fitting the lesson, e.g. 'the new playground', 'the garden beds'. No numbers.",
      items: { type: Type.STRING },
    },
  },
  required: ["title", "description", "companyName", "destinations"],
};

function buildPrompt(ctx: GenerationContext, band: "K-2" | "3-5"): string {
  const lines = [`LESSON TOPIC: ${ctx.topic}`];
  if (ctx.title) lines.push(`ACTIVITY TITLE: ${ctx.title}`);
  if (ctx.intent) lines.push(`ACTIVITY INTENT (what the lesson asked this activity to do): ${ctx.intent}`);
  if (ctx.objective?.text) lines.push(`LEARNING OBJECTIVE: ${ctx.objective.text}`);
  return `${lines.join("\n")}

You are framing a 3D construction site activity for ${ctx.gradeContext || (band === "K-2" ? "grades K-2" : "grades 3-5")}. The
learner works an excavator to dig dirt, sand, gravel or rocks from a pile and load a dump truck, then sends the truck to
a job. The app picks every number and writes every question itself.

Return:
- title and description for this lesson (no numbers);
- companyName: a made-up building company name for the truck doors;
- destinations: 5 places the loads go, fitting the lesson topic (a lesson about a park: "the new playground", "the
  park path"; about a town: "the new library", "the fire station").`;
}

const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");

/** A painted name a child can read: letters and one space, 3-12 letters. */
export function cleanCompany(raw: unknown): string {
  const s = str(raw).replace(/\s+/g, " ");
  return /^[A-Za-z]+( [A-Za-z]+)?$/.test(s) && s.replace(/ /g, "").length >= 3 && s.length <= 12 ? s : FALLBACK_COMPANY;
}

/** Destinations a child hears inside the ask: "the ..." , 2-5 words, letters only; filled up from the fallbacks. */
export function cleanDestinations(raw: unknown, count: number): string[] {
  const out: string[] = [];
  if (Array.isArray(raw)) {
    for (const r of raw) {
      const s = str(r).replace(/\s+/g, " ").replace(/[.!]+$/, "");
      const lower = s.charAt(0).toLowerCase() + s.slice(1);
      const words = lower.split(" ");
      if (/^the [a-z' ]+$/i.test(lower) && words.length >= 2 && words.length <= 5 && !out.includes(lower)) out.push(lower);
    }
  }
  for (const f of FALLBACK_DESTINATIONS) if (out.length < count && !out.includes(f)) out.push(f);
  return out.slice(0, count);
}

export const generateConstructionSiteDiorama = async (ctx: GenerationContext): Promise<ConstructionSiteDioramaData> => {
  const band = airplaneBand(ctx);
  // One mode at birth; /add-eval-modes wires resolveEvalModes when the ladder lands.
  logEvalModeResolution("ConstructionSiteDiorama", ctx.targetEvalMode, null);

  let title = "", description = "", companyName = FALLBACK_COMPANY, rawDestinations: unknown = [];
  try {
    const result = await ai.models.generateContent({
      model: "gemini-flash-lite-latest",
      contents: buildPrompt(ctx, band),
      config: { responseMimeType: "application/json", responseSchema: schema },
    });
    const data = result.text ? JSON.parse(result.text) : null;
    title = str(data?.title);
    description = str(data?.description);
    companyName = cleanCompany(data?.companyName);
    rawDestinations = data?.destinations;
  } catch (err) {
    console.warn("[ConstructionSiteDiorama] generation failed:", err);
  }

  const destinations = cleanDestinations(rawDestinations, LOADS);
  const loads = pickLoads(band, LOADS);
  const challenges = loads.map((n, i) => buildLoadChallenge(n, destinations[i], `cs-${i + 1}`));
  console.log(`[ConstructionSiteDiorama] band=${band} loads=[${loads.map(l => `${l.target} ${l.material}`).join(", ")}] company=${companyName}`);

  return {
    title: title && !/\d/.test(title) ? title : "Load the Dump Truck",
    description: description && !/\d/.test(description)
      ? description : "Work the excavator: dig from the pile, dump into the truck, and send it off with just the right load!",
    challenges,
    challengeType: "load_truck",
    gradeBand: band,
    companyName,
    ...(ctx.supportTier ? { supportTier: ctx.supportTier } : {}),
  };
};
