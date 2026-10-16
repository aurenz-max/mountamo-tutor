import { Type, Schema } from "@google/genai";
import { ai } from "../geminiClient";
import type { GenerationContext } from "../generation/generationContext";
import { resolveEvalModeConstraint, logEvalModeResolution, type ChallengeTypeDoc } from "../evalMode";
import type { EquationBalancerData } from "../../primitives/visual-primitives/chemistry/EquationBalancer";
import {
  BALANCER_MODES, balanceModeOf, balanceRank, countItem, countRank, EQUATION_BANK, equationText, toEquation,
  type BalancerMode, type Equation, type LessonEquation,
} from "../../primitives/visual-primitives/chemistry/equationBalancerWorkspace";

// Re-export type for convenience (no redefinition — sourced from the component)
export type { EquationBalancerData };

/**
 * Equation Balancer generator. Every equation comes from the code bank (`EQUATION_BANK`), and code parses the formulas,
 * solves each key and builds every item (`equationBalancerWorkspace.ts`). Gemini only picks which bank equations fit the
 * topic, for each mode, and writes a title and one real-world line per equation (shown after the item is credited).
 */
const CHALLENGE_TYPE_DOCS: Record<BalancerMode, ChallengeTypeDoc> = {
  simple: {
    promptDoc: "simple (count atoms): the equation is printed with its numbers in front, and the learner counts the atoms of one element on one side.",
    schemaDescription: "Count atoms in a printed equation",
  },
  guided: {
    promptDoc: "guided (balance): the learner sets the number in front of each formula; each element sits in one formula on each side.",
    schemaDescription: "Balance an equation element by element",
  },
  complex: {
    promptDoc: "complex (balance, shared element): an element sits in two formulas on one side, such as oxygen in a combustion.",
    schemaDescription: "Balance an equation with a shared element",
  },
};

const PICKS: Record<BalancerMode, [number, number]> = { simple: [4, 2], guided: [3, 2], complex: [3, 2] };

/** Determine the grade band from grade level context string */
const resolveGradeBand = (gradeLevel: string): "6-7" | "7-8" => {
  const gl = gradeLevel.toLowerCase();
  if (gl.includes("8") || gl.includes("grade 8") || gl.includes("7-8") || gl.includes("advanced")) return "7-8";
  return "6-7";
};

/**
 * Canonical-grade → band mapper (systemic 14m). Canonical grade wins when
 * present (below-range grades clamp to the 6-7 floor rung); null keeps the
 * prose fallback reachable (never deleted).
 */
export function equationBalancerGradeBandFromGrade(grade?: string): "6-7" | "7-8" | null {
  if (!grade) return null;
  const g = grade.trim().toUpperCase();
  if (g === "K") return "6-7";
  const n = parseInt(g, 10);
  if (isNaN(n)) return null;
  return n <= 7 ? "6-7" : "7-8";
}

const bank = (): Equation[] => EQUATION_BANK.map(b => toEquation({ id: b.id })).filter((e): e is Equation => !!e);

/**
 * The bank equations a mode can be asked on, by structure: 6-7 gets the smaller two thirds, 7-8 the larger two thirds.
 * Sorted smallest first.
 */
export function candidatesFor(mode: BalancerMode, band: "6-7" | "7-8"): Equation[] {
  const rank = (e: Equation) => (mode === "simple" ? countRank(countItem(e)!) : balanceRank(e));
  const pool = bank().filter(e => (mode === "simple" ? !!countItem(e) : balanceModeOf(e) === mode)).sort((a, b) => rank(a) - rank(b));
  const cut = Math.ceil((pool.length * 2) / 3);
  return band === "6-7" ? pool.slice(0, cut) : pool.slice(pool.length - cut);
}

const schemaFor = (modes: BalancerMode[], ids: string[]): Schema => ({
  type: Type.OBJECT,
  properties: {
    title: { type: Type.STRING, description: "Short, engaging title for the activity (e.g. 'Atoms In, Atoms Out')" },
    description: { type: Type.STRING, description: "One kid-friendly sentence about the activity. Never give a number or coefficient." },
    picks: {
      type: Type.ARRAY,
      description: "The equations chosen for each task, from the candidate lists only.",
      items: {
        type: Type.OBJECT,
        properties: {
          mode: { type: Type.STRING, enum: modes },
          id: { type: Type.STRING, enum: ids },
          realWorld: { type: Type.STRING, description: "One sentence on where this reaction happens in real life. No numbers in front of formulas, no counts." },
        },
        required: ["mode", "id", "realWorld"],
      },
    },
  },
  required: ["title", "description", "picks"],
});

/** A real-world line that states a coefficient or an atom count would answer an item: dropped. */
const leaksNumbers = (line: string) => /\b\d+\s*[A-Z][a-z]?\d*|\b(two|three|four|five|six|seven|eight|nine|ten)\s+(molecules?|atoms?)\b/i.test(line);

export const generateEquationBalancer = async (ctx: GenerationContext): Promise<EquationBalancerData> => {
  const { topic } = ctx;
  const config = ctx.raw as Partial<EquationBalancerData>;
  // Canonical objective grade wins; the prose parser is only the fallback (14m).
  const gradeBand = equationBalancerGradeBandFromGrade(ctx.grade) ?? resolveGradeBand(ctx.gradeContext);
  const constraint = resolveEvalModeConstraint("equation-balancer", ctx.targetEvalMode, CHALLENGE_TYPE_DOCS);
  logEvalModeResolution("EquationBalancer", ctx.targetEvalMode, constraint);
  const modes: BalancerMode[] = constraint
    ? BALANCER_MODES.filter(m => constraint.allowedTypes.includes(m))
    : gradeBand === "7-8" ? BALANCER_MODES : ["simple", "guided"];
  const want = (m: BalancerMode) => PICKS[m][modes.length === 1 ? 0 : 1];

  const candidates = new Map(modes.map(m => [m, candidatesFor(m, gradeBand)]));
  const allIds = Array.from(new Set(Array.from(candidates.values()).flat().map(e => e.id)));
  const intent = ctx.intent
    ? `\nLEARNING FOCUS: "${ctx.intent}". Prefer the reactions that serve it.` : "";

  const lists = modes.map(m => `${CHALLENGE_TYPE_DOCS[m].promptDoc}\nPick ${want(m)} for mode "${m}" from:\n`
    + candidates.get(m)!.map(e => `- ${e.id}: ${e.name} (${equationText(e)})`).join("\n")).join("\n\n");

  const prompt = `Choose real chemical reactions for an equation-balancing activity about "${topic}" for grades ${gradeBand}.${intent}

The learner will do these tasks; code builds every item and its answer from the reactions you choose:
${lists}

RULES:
1. Pick only ids from the list for that mode, and never the same id twice.
2. Prefer reactions that fit the topic; when few fit, fill with the most familiar ones.
3. realWorld: one sentence on where the reaction happens (a stove, rust on a bike, a plant leaf). Never write a number in front of a formula, a count of atoms or molecules, or the balanced equation.`;

  const response = await ai.models.generateContent({
    model: "gemini-flash-lite-latest",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: schemaFor(modes, allIds),
      systemInstruction: "You are a chemistry educator choosing familiar, real reactions for grades 6-8 and saying where each happens in daily life.",
    },
  });
  const text = response.text;
  if (!text) throw new Error("No data returned from Gemini API for equation-balancer");
  const raw = JSON.parse(text) as { title?: string; description?: string; picks?: Array<{ mode?: string; id?: string; realWorld?: string }> };

  // Code keeps only valid picks, one mode per equation, then fills each mode from the smallest candidates.
  const taken = new Set<string>();
  const equations: LessonEquation[] = [];
  // Balance modes first: a count item prints its equation at the key, so the equations a balance item needs go there.
  for (const mode of [...modes].sort((a, b) => Number(a === "simple") - Number(b === "simple"))) {
    const pool = candidates.get(mode)!;
    const chosen = (raw.picks ?? []).filter(p => p.mode === mode && pool.some(e => e.id === p.id) && !taken.has(p.id!));
    const add = (id: string, realWorld?: string) => {
      if (taken.has(id) || equations.filter(e => e.for === mode).length >= want(mode)) return;
      taken.add(id);
      const line = realWorld?.trim();
      equations.push({ id, for: mode, ...(line && !leaksNumbers(line) ? { realWorld: line } : {}) });
    };
    for (const p of chosen) add(p.id!, p.realWorld);
    for (const e of pool) add(e.id);
  }

  const data: EquationBalancerData = {
    title: config.title ?? (raw.title?.trim() || "Balance the Atoms"),
    description: raw.description,
    equations: config.equations ?? equations,
    challengeTypes: modes,
    gradeBand: config.gradeBand ?? gradeBand,
  };
  console.log("⚖️ Equation Balancer Generated:", { title: data.title, gradeBand: data.gradeBand, modes,
    equations: data.equations!.map(e => `${e.for}:${e.id}`) });
  return data;
};
