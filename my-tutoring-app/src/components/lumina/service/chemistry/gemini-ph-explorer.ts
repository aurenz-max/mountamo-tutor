import { Type, Schema } from "@google/genai";
import { ai } from "../geminiClient";
import type { GenerationContext } from "../generation/generationContext";
import { resolveEvalModeConstraint, logEvalModeResolution, type ChallengeTypeDoc } from "../evalMode";
import type { PhExplorerData, Substance } from "../../primitives/visual-primitives/chemistry/PhExplorer";
import { PH_MODES, type PhMode } from "../../primitives/visual-primitives/chemistry/phExplorerWorkspace";

// Re-export type for convenience (no redefinition — sourced from the component)
export type { PhExplorerData };

/**
 * pH Explorer generator. Gemini writes only the substances (name, pH, a real-world line); every item, key and colour is
 * built by code from the pH values (`phExplorerWorkspace.ts`), so the schema carries no challenge, answer or colour.
 */
const CHALLENGE_TYPE_DOCS: Record<PhMode, ChallengeTypeDoc> = {
  test: {
    promptDoc: "test: the learner dips litmus papers into each named substance and says acid, base or neutral. "
      + "Include clear acids (pH 1-5), clear bases (pH 9-13) and pure water (pH 7). Names must not contain the words acid, base or neutral.",
    schemaDescription: "Litmus test of named substances",
  },
  indicator: {
    promptDoc: "indicator: the learner reads each sample's red cabbage juice colour and names its pH range. "
      + "Spread the substances across the whole scale: some near pH 2, 3-4, 7, 8-9, 10-12 and 13.",
    schemaDescription: "Cabbage juice colour to pH range",
  },
  neutralize: {
    promptDoc: "neutralize: code mixes a strong acid with a strong base. Include hydrochloric acid (pH 1) and sodium hydroxide (pH 13) "
      + "among the substances. Never include bleach.",
    schemaDescription: "Strong acid and strong base neutralization",
  },
};

const phExplorerSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    title: { type: Type.STRING, description: "Short, engaging title for the lab (e.g. 'Kitchen pH Lab')" },
    description: { type: Type.STRING, description: "One kid-friendly sentence about the lab. Never say which substance is an acid or a base." },
    substances: {
      type: Type.ARRAY,
      description: "6-8 substances with a mix of acids, bases and at least one neutral.",
      items: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.STRING, description: "Unique snake_case id (e.g. 'lemon_juice')" },
          name: { type: Type.STRING, description: "Display name (e.g. 'Lemon Juice')" },
          pH: { type: Type.NUMBER, description: "Accurate pH from 0 to 14" },
          category: { type: Type.STRING, enum: ["food", "cleaning", "body", "nature", "lab"], description: "Where it is found" },
          realWorldInfo: { type: Type.STRING, description: "One fun real-world fact, shown after the learner answers" },
        },
        required: ["id", "name", "pH", "category", "realWorldInfo"],
      },
    },
  },
  required: ["title", "description", "substances"],
};

/** Determine the grade band from grade level context string */
const resolveGradeBand = (gradeLevel: string): "4-6" | "7-8" => {
  const gl = gradeLevel.toLowerCase();
  if (gl.includes("7") || gl.includes("8") || gl.includes("middle") || gl.includes("advanced")) return "7-8";
  return "4-6";
};

/**
 * Canonical-grade → band mapper (systemic 14m). Canonical grade wins when
 * present (below-range grades clamp to the 4-6 floor rung); null keeps the
 * prose fallback reachable (never deleted).
 */
export function phExplorerGradeBandFromGrade(grade?: string): "4-6" | "7-8" | null {
  if (!grade) return null;
  const g = grade.trim().toUpperCase();
  if (g === "K") return "4-6";
  const n = parseInt(g, 10);
  if (isNaN(n)) return null;
  return n <= 6 ? "4-6" : "7-8";
}

const BAND_SUBSTANCES: Record<"4-6" | "7-8", string> = {
  "4-6": "Grades 4-6: simple, kid-friendly language and HOUSEHOLD substances kids recognise, e.g. lemon juice (pH 2), "
    + "vinegar (pH 3), orange juice (pH 3.5), pure water (pH 7), baking soda solution (pH 8.5), soap (pH 10), "
    + "milk of magnesia (pH 10.5), washing soda solution (pH 11.5). No chemical formulas.",
  "7-8": "Grades 7-8: everyday and lab substances, e.g. hydrochloric acid (pH 1), lemon juice (pH 2), vinegar (pH 3), "
    + "pure water (pH 7), baking soda solution (pH 8.5), ammonia solution (pH 11), sodium hydroxide (pH 13). Scientific "
    + "vocabulary is fine in the real-world lines (H+ ions, concentration).",
};

export const generatePhExplorer = async (ctx: GenerationContext): Promise<PhExplorerData> => {
  const { topic } = ctx;
  const config = ctx.raw as Partial<PhExplorerData>;
  // Canonical objective grade wins; the prose parser is only the fallback (14m).
  const gradeBand = phExplorerGradeBandFromGrade(ctx.grade) ?? resolveGradeBand(ctx.gradeContext);
  const constraint = resolveEvalModeConstraint("ph-explorer", ctx.targetEvalMode, CHALLENGE_TYPE_DOCS);
  logEvalModeResolution("PhExplorer", ctx.targetEvalMode, constraint);
  const modes: PhMode[] = constraint
    ? PH_MODES.filter(m => constraint.allowedTypes.includes(m))
    : gradeBand === "7-8" ? PH_MODES : ["test", "indicator"];

  const intent = ctx.intent
    ? `\nLEARNING FOCUS: "${ctx.intent}". Choose substances that serve it. Do not state which substance is an acid or a base anywhere except realWorldInfo.`
    : "";

  const prompt = `Create the substances for a pH lab about "${topic}".${intent}

${BAND_SUBSTANCES[gradeBand]}

The learner will do these tasks (code builds them from your substances):
${modes.map(m => `- ${CHALLENGE_TYPE_DOCS[m].promptDoc}`).join("\n")}

RULES:
1. 6-8 substances, each with an accurate pH from 0 to 14, a unique id and a display name.
2. A mix of acids, bases and at least one neutral (pure water, pH 7).
3. No two substances with the same name. Never include bleach.
4. realWorldInfo: one fun, memorable fact connecting the substance to daily life.`;

  const response = await ai.models.generateContent({
    model: "gemini-flash-lite-latest",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: phExplorerSchema,
      systemInstruction: "You are an expert science educator choosing real substances with accurate pH values for a pH lab.",
    },
  });
  const text = response.text;
  if (!text) throw new Error("No data returned from Gemini API for ph-explorer");
  const result = JSON.parse(text) as PhExplorerData;

  const seen = new Set<string>();
  const substances: Substance[] = (Array.isArray(result.substances) ? result.substances : [])
    .filter(s => s && typeof s.name === "string" && s.name.trim() && Number.isFinite(s.pH) && s.pH >= 0 && s.pH <= 14
      && !/bleach|hypochlor/i.test(s.name))
    .map((s, i) => ({ ...s, id: String(s.id || `sub${i + 1}`).trim(), name: s.name.trim(), pH: Math.round(s.pH * 10) / 10 }))
    .filter(s => !seen.has(s.id) && !!seen.add(s.id));
  // Pure water is the neutral every test and indicator lab needs; code adds it when the model left it out.
  if (!substances.some(s => Math.abs(s.pH - 7) < 0.25)) {
    substances.push({ id: "pure_water", name: "Pure Water", pH: 7, category: "nature",
      realWorldInfo: "Pure water sits right in the middle of the pH scale, at 7." });
  }

  const data: PhExplorerData = {
    title: result.title || "pH Lab",
    description: result.description,
    substances,
    challengeTypes: modes,
    gradeBand,
    ...(config.title !== undefined ? { title: config.title } : {}),
    ...(config.substances !== undefined ? { substances: config.substances } : {}),
    ...(config.gradeBand !== undefined ? { gradeBand: config.gradeBand } : {}),
  };
  console.log("🧪 pH Explorer Generated:", { title: data.title, gradeBand: data.gradeBand, modes, substanceCount: data.substances.length });
  return data;
};
