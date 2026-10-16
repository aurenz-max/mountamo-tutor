import { Type, Schema } from "@google/genai";
import { ai } from "../geminiClient";
import type { GenerationContext } from "../generation/generationContext";
import type { StoichiometryLabData } from "../../primitives/visual-primitives/chemistry/StoichiometryLab";
import { resolveEvalModeConstraint, logEvalModeResolution, type ChallengeTypeDoc } from '../evalMode';
import {
  buildStoichChallenges, libraryReaction, modesFor, normalizeReaction, reactantsOf, reactionFromLibrary, REACTIONS,
  STOICH_MODES, type GradeBand, type LibraryReaction, type StoichMode, type StoichTier,
} from "../../primitives/visual-primitives/chemistry/stoichiometryLabWorkspace";

// Re-export type for convenience (no redefinition — sourced from the component)
export type { StoichiometryLabData };

/**
 * Stoichiometry Lab generator. The model only picks which library reaction fits the topic and writes a title and a
 * one-line description; code builds every item and computes every key (`stoichiometryLabWorkspace.ts`). The old
 * generator asked the model for masses and answers and then recomputed most of them, kept the model's convert key
 * unchecked, and checked a percent-yield answer against the theoretical grams.
 *
 * `config.difficulty` (easy | medium | hard) is the item structure: convert is one, two or three cards; limiting and
 * yield add the mass trap, then the mole trap. No tier: a pinned mode ladders easy, medium, hard.
 */

const CHALLENGE_TYPE_DOCS: Record<string, ChallengeTypeDoc> = {
  convert: { promptDoc: '"convert": build a chain of conversion factors (code builds the items).', schemaDescription: "'convert'" },
  limiting: { promptDoc: '"limiting": which reactant runs out first (code builds the items).', schemaDescription: "'limiting'" },
  yield: { promptDoc: '"yield": grams of product that can form (code builds the items).', schemaDescription: "'yield'" },
};

type SupportTier = StoichTier;
const SUPPORT_TIERS: readonly SupportTier[] = ['easy', 'medium', 'hard'];
/** STRICT lookup — the manifest enum-constrains config.difficulty to these. Unknown/absent -> null. */
function normalizeSupportTier(difficulty?: string): SupportTier | null {
  const d = difficulty?.toLowerCase().trim() ?? '';
  return (SUPPORT_TIERS as readonly string[]).includes(d) ? (d as SupportTier) : null;
}

const resolveGradeBand = (gradeLevel: string): GradeBand => {
  const gl = (gradeLevel || "").toLowerCase();
  if (gl.includes("11") || gl.includes("12") || gl.includes("high school") || gl.includes("advanced")) return "11-12";
  if (gl.includes("9") || gl.includes("10")) return "9-10";
  if (gl.includes("8")) return "8";
  return "9-10";
};

/**
 * Canonical-grade -> band mapper (systemic 14m). The prose test above matches "high school" in the high-school
 * sentence, so every high-school lesson landed 11-12. Canonical grade wins when present (below-range grades clamp to
 * the '8' floor rung); null keeps the prose fallback reachable.
 */
export function stoichiometryLabGradeBandFromGrade(grade?: string): GradeBand | null {
  if (!grade) return null;
  const g = grade.trim().toUpperCase();
  if (g === "K") return "8";
  const n = parseInt(g, 10);
  if (isNaN(n)) return null;
  if (n <= 8) return "8";
  if (n <= 10) return "9-10";
  return "11-12";
}

/** The library reactions a session can use: every requested mode must have items, grade 8 keeps the intro set. */
export function eligibleReactions(modes: StoichMode[], band: GradeBand): LibraryReaction[] {
  const fits = REACTIONS.filter(r => {
    const rx = normalizeReaction(reactionFromLibrary(r));
    return !!rx && modes.every(m => modesFor(rx).includes(m));
  });
  const intro = fits.filter(r => r.intro);
  return band === '8' && intro.length ? intro : fits;
}

/** The fallback pick when no model answers: the reaction whose topic words the topic mentions most, else the first. */
export function reactionByTopic(topic: string, options: LibraryReaction[]): LibraryReaction {
  const t = topic.toLowerCase();
  const score = (r: LibraryReaction) => r.topics.filter(w => t.includes(w)).length;
  return [...options].sort((a, b) => score(b) - score(a))[0] ?? REACTIONS[0];
}

type StoichiometryLabConfig = Partial<{ targetEvalMode?: string; intent?: string; difficulty?: string }>;

export const generateStoichiometryLab = async (ctx: GenerationContext): Promise<StoichiometryLabData> => {
  const { topic } = ctx;
  const config: StoichiometryLabConfig = { ...(ctx.raw as StoichiometryLabConfig), intent: ctx.intent };
  const gradeBand = stoichiometryLabGradeBandFromGrade(ctx.grade) ?? resolveGradeBand(ctx.gradeContext);

  const constraint = resolveEvalModeConstraint('stoichiometry-lab', config?.targetEvalMode, CHALLENGE_TYPE_DOCS);
  logEvalModeResolution('stoichiometry-lab', config?.targetEvalMode, constraint);
  const pinned = (constraint?.allowedTypes ?? []).filter((m): m is StoichMode => (STOICH_MODES as string[]).includes(m));
  const modes: StoichMode[] = pinned.length ? pinned : gradeBand === '8' ? ['convert', 'limiting'] : STOICH_MODES;
  const tier = normalizeSupportTier(config?.difficulty);
  const options = eligibleReactions(modes, gradeBand);

  const schema: Schema = {
    type: Type.OBJECT,
    properties: {
      reactionId: { type: Type.STRING, enum: options.map(r => r.id), description: 'The reaction from the list that best fits the topic.' },
      title: { type: Type.STRING, description: 'Short engaging title naming the reaction or its setting (no numbers).' },
      description: { type: Type.STRING, description: 'One sentence of real-world setting for the reaction. No numbers, no masses, and never which reactant runs out or how much forms.' },
    },
    required: ['reactionId', 'title', 'description'],
  };
  const list = options.map(r => `- ${r.id}: ${r.label} (${reactionFromLibrary(r).equation})`).join('\n');
  const prompt = `A stoichiometry lab for grade band ${gradeBand} on the topic "${topic}".${config?.intent ? `\nInstructor intent: ${config.intent}` : ''}
Pick the ONE reaction from this list that best fits the topic (if none mentions it, pick the most familiar one for the grade band):
${list}
Then write a short title and a one-sentence real-world setting for that reaction. Code builds every question and answer:
write no numbers, no masses, no amounts, and never say which reactant runs out first or how much product forms.`;

  let picked: LibraryReaction | undefined;
  let title = '', description = '';
  try {
    const response = await ai.models.generateContent({
      model: "gemini-flash-lite-latest",
      contents: prompt,
      config: { responseMimeType: "application/json", responseSchema: schema },
    });
    const raw = JSON.parse(response.text ?? '{}') as { reactionId?: string; title?: string; description?: string };
    picked = options.find(r => r.id === raw.reactionId);
    title = (raw.title ?? '').trim();
    description = (raw.description ?? '').trim();
  } catch (error) {
    console.error('[stoichiometry-lab] Gemini pick failed; choosing the reaction by topic words:', error);
  }
  if (!picked) picked = reactionByTopic(topic, options);
  const reaction = reactionFromLibrary(libraryReaction(picked.id)!);
  // A description with a number in it can state an amount; the lab never shows one it did not compute.
  if (/\d/.test(description)) description = '';

  const challenges = buildStoichChallenges(reaction, modes, tier, Math.floor(Math.random() * 2 ** 31), gradeBand);
  const result: StoichiometryLabData = {
    title: title || picked.label,
    description: description || picked.label,
    gradeBand,
    reaction,
    challenges,
    challengeTypes: modes.filter(m => challenges.some(c => c.type === m)),
    ...(tier ? { supportTier: tier } : {}),
  };
  console.log('⚗️ Stoichiometry Lab Generated:', {
    title: result.title, reaction: reaction.equation, gradeBand, modes, tier: tier ?? 'ladder',
    challenges: challenges.map(c => `${c.id}:${c.tier}`), twoReactants: reactantsOf(normalizeReaction(reaction)!).length >= 2,
  });
  return result;
};
