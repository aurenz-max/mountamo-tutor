import { Type, Schema } from "@google/genai";
import { ai } from "../geminiClient";
import type { GenerationContext } from "../generation/generationContext";
import { resolveEvalModes, type ChallengeTypeDoc } from "../evalMode";
import type { AirplaneDioramaData } from "../../primitives/visual-primitives/engineering/AirplaneDiorama";
import {
  AIRPLANE_PARTS,
  AIRPLANE_TASKS,
  buildAirplaneChallenge,
  buildFlightPlanChallenge,
  pickFlightNumbers,
  selectParts,
  type AirplaneBand,
  type AirplaneChallenge,
  type AirplanePart,
  type AirplaneTask,
  type FlightTrip,
} from "../../primitives/visual-primitives/engineering/airplaneModel";

export type { AirplaneDioramaData };

/**
 * Airplane diorama generator (Fork A). Gemini reads the lesson and returns only framing: a title, one sentence,
 * a made-up airline for the paint, which parts the lesson is about, and trip stories (two made-up airports and
 * who rides). Code picks the parts (`selectParts`) and writes every ask (`buildAirplaneChallenge`); code sets
 * every trip's distance and fuel rule (`pickFlightNumbers`) and writes its instruction (`buildFlightPlanChallenge`).
 */

const FALLBACK_AIRLINE = "Skyway";
/** Items per session by task: one task fills the session; mixed is finds first, then trips. */
const SINGLE_COUNT: Record<AirplaneTask, number> = { find_part: 5, flight_plan: 4 };
const MIXED_COUNT: Record<AirplaneTask, number> = { find_part: 3, flight_plan: 2 };

/**
 * The tasks. Gemini writes no challenge list, so the resolved modes are not a schema enum: code builds the
 * items of each resolved task.
 */
const CHALLENGE_TYPE_DOCS: Record<AirplaneTask, ChallengeTypeDoc> = {
  find_part: {
    promptDoc: '"find_part": find a named part of the jet (or the part that does a job) and tap it on the 3D jet.',
    schemaDescription: "'find_part' (find the part)",
  },
  flight_plan: {
    promptDoc: '"flight_plan": a trip between two airports; load enough fuel tanks for the distance plus a spare, then fly.',
    schemaDescription: "'flight_plan' (load the fuel for a trip)",
  },
};

const isTask = (t: string): t is AirplaneTask => (AIRPLANE_TASKS as readonly string[]).includes(t);

const schema: Schema = {
  type: Type.OBJECT,
  properties: {
    title: { type: Type.STRING, description: "Names the activity, 2-5 words, e.g. 'Parts of a Jet', 'Fuel for the Trip'. No numbers. Never names a part." },
    description: { type: Type.STRING, description: "One child-friendly sentence inviting the learner in. No numbers. Never names a part or says where one is." },
    airlineName: { type: Type.STRING, description: "A made-up, friendly airline name of one or two words, 3-12 letters, painted on the jet, e.g. 'Bluebird', 'Sunny Air'. Never a real airline." },
    focusParts: {
      type: Type.ARRAY,
      description: "The parts of the jet this lesson is about, most important first. Empty when the lesson is about the whole airplane.",
      items: { type: Type.STRING, enum: [...AIRPLANE_PARTS] },
    },
    trips: {
      type: Type.ARRAY,
      description: "5 short trip stories, each between two different made-up airports.",
      items: {
        type: Type.OBJECT,
        properties: {
          from: { type: Type.STRING, description: "Made-up town the jet leaves from, 1-2 words. No numbers." },
          to: { type: Type.STRING, description: "Made-up town the jet flies to, 1-2 words. No numbers." },
          cargo: { type: Type.STRING, description: "Who or what the jet carries, starting with 'the' or 'a', 2-6 words. No numbers." },
        },
        required: ["from", "to", "cargo"],
      },
    },
  },
  required: ["title", "description", "airlineName", "focusParts", "trips"],
};

/** 'K-2' for kindergarten through grade 2; '3-5' otherwise or when the grade is unknown. */
export function airplaneBand(ctx: Pick<GenerationContext, "grade" | "gradeLevel" | "gradeContext">): AirplaneBand {
  const g = (ctx.grade ?? "").toString().trim().toUpperCase();
  if (g) {
    if (g === "K") return "K-2";
    const n = parseInt(g, 10);
    if (!isNaN(n)) return n <= 2 ? "K-2" : "3-5";
  }
  const level = (ctx.gradeLevel ?? "").toLowerCase();
  if (["kindergarten", "preschool", "toddler"].includes(level)) return "K-2";
  const prose = (ctx.gradeContext ?? "").toLowerCase();
  if (/\b(kindergarten|preschool|grade [12]|[12](st|nd) grade)\b/.test(prose)) return "K-2";
  return "3-5";
}

function buildPrompt(ctx: GenerationContext, band: AirplaneBand, tasks: readonly AirplaneTask[]): string {
  const lines = [`LESSON TOPIC: ${ctx.topic}`];
  if (ctx.title) lines.push(`ACTIVITY TITLE: ${ctx.title}`);
  if (ctx.intent) lines.push(`ACTIVITY INTENT (what the lesson asked this activity to do): ${ctx.intent}`);
  if (ctx.objective?.text) lines.push(`LEARNING OBJECTIVE: ${ctx.objective.text}`);
  const finds = tasks.includes("find_part"), trips = tasks.includes("flight_plan");
  const doing = [
    finds ? `turns a passenger jet and finds its parts: ${AIRPLANE_PARTS.join(", ")} ("gear" is the landing gear, "cabin" is the long body where the passengers ride)` : "",
    trips ? "plans short flights between two airports by loading enough fuel for each trip" : "",
  ].filter(Boolean).join("; and ");
  return `${lines.join("\n")}

You are framing a 3D airplane activity for ${ctx.gradeContext || (band === "K-2" ? "grades K-2" : "grades 3-5")}. The learner
${doing}. The app writes every question and sets every number itself.

Return:
- title and description for this activity (no numbers; never name a part or say where one is)${!finds
    ? '. This activity is only about fuel and trips, so the title and description are about planning flights and fuel, never about the parts of the jet'
    : ''};
- airlineName: a made-up airline name for the paint on the jet;
- focusParts: only the parts the lesson topic, intent or objective is about (for "how wings and engines help a plane fly":
  wings, engines). Leave it empty for a lesson about the whole airplane, about vehicles in general, or about fuel and trips;
- trips: 5 trip stories that fit the lesson, each with two different made-up towns (1-2 words each) and who or what
  rides, starting with "the" or "a". Invent fresh town names that fit the lesson's setting; every town and every rider
  different. No real cities, no numbers.`;
}

const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");

/** Words that name a part. On a job-ask session the title and description must not hold one (it is the answer). */
const PART_WORDS = /\b(wings?|engines?|tails?|fins?|rudders?|cockpits?|gear|wheels?|cabins?|nose|radome|flaps?)\b/i;
export const framingNamesPart = (text: string) => PART_WORDS.test(text);

/** A painted name a child can read: letters and one space, 3-12 letters. */
export function cleanAirline(raw: unknown): string {
  const s = str(raw).replace(/\s+/g, " ");
  return /^[A-Za-z]+( [A-Za-z]+)?$/.test(s) && s.replace(/ /g, "").length >= 3 && s.length <= 12 ? s : FALLBACK_AIRLINE;
}

export function cleanFocus(raw: unknown): AirplanePart[] {
  if (!Array.isArray(raw)) return [];
  const out: AirplanePart[] = [];
  for (const p of raw) if ((AIRPLANE_PARTS as readonly string[]).includes(p) && !out.includes(p as AirplanePart)) out.push(p as AirplanePart);
  return out;
}

const TOWN = /^[A-Z][A-Za-z']+( [A-Z][A-Za-z']+)?$/;
const CARGO = /^(the|a|an) [a-z][a-z' -]{2,40}$/i;
const cap = (s: string) => s.replace(/\b[a-z]/g, ch => ch.toUpperCase());

/** Keep trips with two different short town names and a "the/a ..." cargo; no digits anywhere. */
export function cleanTrips(raw: unknown): FlightTrip[] {
  if (!Array.isArray(raw)) return [];
  const out: FlightTrip[] = [];
  for (const t of raw) {
    const from = cap(str(t?.from).replace(/\s+/g, " ")), to = cap(str(t?.to).replace(/\s+/g, " "));
    const cargo = str(t?.cargo).replace(/\s+/g, " ").replace(/[.!]+$/, "");
    if (!TOWN.test(from) || !TOWN.test(to) || from.length > 16 || to.length > 16 || from === to) continue;
    if (!CARGO.test(cargo) || cargo.split(" ").length > 7) continue;
    const c = cargo.charAt(0).toLowerCase() + cargo.slice(1);
    if (out.some(o => o.to === to || o.cargo === c)) continue;
    out.push({ from, to, cargo: c });
  }
  return out;
}

const FALLBACK_TRIPS: FlightTrip[] = [
  { from: "Pine Hill", to: "Bay Town", cargo: "the school band" },
  { from: "Maple Field", to: "Snow Peak", cargo: "a team of skiers" },
  { from: "Sandy Cove", to: "River Bend", cargo: "a load of fresh apples" },
  { from: "Cloud Lake", to: "Sunny Vale", cargo: "the soccer team" },
  { from: "Oak Ridge", to: "Harbor Point", cargo: "a box of birthday gifts" },
];

const FRAMING_FALLBACK: Record<"find" | "trip" | "mixed", { title: string; description: string }> = {
  find: { title: "Parts of a Jet", description: "Turn the jet and find each part. Every part you find shows what it does!" },
  trip: { title: "Fuel for the Trip", description: "Load just enough fuel for each trip, then fly the jet there!" },
  mixed: { title: "Ready for Takeoff", description: "Get to know the jet, then fuel it up and fly!" },
};

export const generateAirplaneDiorama = async (ctx: GenerationContext): Promise<AirplaneDioramaData> => {
  const band = airplaneBand(ctx);
  // Explicit pin wins; otherwise the intent resolves the task(s). null => mixed: some of each task.
  const resolution = await resolveEvalModes(
    "airplane-diorama",
    { targetEvalMode: ctx.targetEvalMode, intent: ctx.intent, objectiveText: ctx.objective?.text },
    CHALLENGE_TYPE_DOCS,
  );
  const resolved = (resolution?.allowedTypes ?? AIRPLANE_TASKS).filter(isTask);
  const tasks: AirplaneTask[] = resolved.length ? AIRPLANE_TASKS.filter(t => resolved.includes(t)) : ["find_part"];

  let title = "", description = "", airlineName = FALLBACK_AIRLINE;
  let focus: AirplanePart[] = [];
  let trips: FlightTrip[] = [];
  try {
    const result = await ai.models.generateContent({
      model: "gemini-flash-lite-latest",
      contents: buildPrompt(ctx, band, tasks),
      config: { responseMimeType: "application/json", responseSchema: schema },
    });
    const data = result.text ? JSON.parse(result.text) : null;
    title = str(data?.title);
    description = str(data?.description);
    airlineName = cleanAirline(data?.airlineName);
    focus = cleanFocus(data?.focusParts);
    trips = cleanTrips(data?.trips);
  } catch (err) {
    console.warn("[AirplaneDiorama] generation failed:", err);
  }

  const counts = tasks.length === 1 ? SINGLE_COUNT : MIXED_COUNT;
  const challenges: AirplaneChallenge[] = [];
  if (tasks.includes("find_part")) {
    for (const part of selectParts(focus, counts.find_part)) {
      challenges.push(buildAirplaneChallenge(part, { id: `ap-${challenges.length + 1}`, band }));
    }
  }
  if (tasks.includes("flight_plan")) {
    const n = counts.flight_plan;
    const spare = FALLBACK_TRIPS.filter(f => !trips.some(t => t.to === f.to)).sort(() => Math.random() - 0.5);
    const pool = trips.length >= n ? trips : [...trips, ...spare];
    pickFlightNumbers(band, n).forEach((numbers, i) => {
      challenges.push(buildFlightPlanChallenge(pool[i % pool.length], numbers, `ap-${challenges.length + 1}`));
    });
  }

  console.log(
    `[AirplaneDiorama] modes: ${resolution ? `${resolution.modes.map(m => m.evalMode).join("+")} (${resolution.source})` : "mixed"}`
      + ` band=${band} focus=[${focus.join(", ")}] trips=${trips.length} items=[${challenges.map(c =>
        c.type === "find_part" ? c.part : `${c.to}:${c.distance}${c.units}/${c.perTank}`).join(", ")}] airline=${airlineName}`,
  );

  // On a job-ask session a part word in the framing gives the answer away, so code-owned words replace it.
  const jobAsks = band === "3-5" && tasks.includes("find_part");
  const ok = (t: string) => !!t && !/\d/.test(t) && !(jobAsks && framingNamesPart(t));
  const fallback = FRAMING_FALLBACK[tasks.length > 1 ? "mixed" : tasks[0] === "flight_plan" ? "trip" : "find"];
  return {
    title: ok(title) ? title : fallback.title,
    description: ok(description) ? description : fallback.description,
    challenges,
    challengeType: tasks[tasks.length - 1],
    gradeBand: band,
    airlineName,
    ...(ctx.supportTier ? { supportTier: ctx.supportTier } : {}),
  };
};
