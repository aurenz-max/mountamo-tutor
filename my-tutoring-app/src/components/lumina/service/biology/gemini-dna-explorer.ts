import { Type, Schema } from "@google/genai";
import { ai } from "../geminiClient";
import type { GenerationContext } from "../generation/generationContext";

// Import the data type from the component (single source of truth)
import { DnaExplorerData, BuildChallenge } from "../../primitives/visual-primitives/biology/DnaExplorer";

/**
 * Schema definition for DNA Explorer Data
 *
 * Generates interactive DNA structure exploration activities for genetics education.
 * Supports:
 * - Structure mode: Explore the double helix, backbone, and base pairing
 * - Base-pairing mode: Practice matching complementary bases
 * - Transcription mode: Understand DNA → RNA
 * - Replication mode: Understand DNA copying
 */
const dnaExplorerSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    title: {
      type: Type.STRING,
      description: "Engaging title for the DNA exploration activity"
    },
    description: {
      type: Type.STRING,
      description: "Brief instructions for students (1-2 sentences)"
    },
    mode: {
      type: Type.STRING,
      enum: ["structure", "base-pairing", "transcription", "replication"],
      description: "The focus mode for this DNA exploration"
    },
    sequence: {
      type: Type.OBJECT,
      properties: {
        templateStrand: {
          type: Type.STRING,
          description: "DNA template strand sequence (5' to 3' direction, only A/T/C/G characters, 6-12 bases). This strand and its complement are DISPLAYED to the student on the Explore tab — it is a worked example, never a challenge."
        },
        complementaryStrand: {
          type: Type.STRING,
          description: "Complementary strand (3' to 5' direction, auto-paired: A↔T, C↔G)"
        },
        highlightedRegion: {
          type: Type.OBJECT,
          properties: {
            start: { type: Type.INTEGER, description: "Start index (0-based) of highlighted region" },
            end: { type: Type.INTEGER, description: "End index (0-based) of highlighted region" },
            label: { type: Type.STRING, description: "Label for the highlighted region (e.g., 'Gene for eye color')" }
          },
          required: ["start", "end", "label"]
        }
      },
      required: ["templateStrand", "complementaryStrand"]
    },
    nucleotides: {
      type: Type.ARRAY,
      description: "Information about each of the 4 DNA nucleotides (A, T, C, G)",
      items: {
        type: Type.OBJECT,
        properties: {
          base: {
            type: Type.STRING,
            enum: ["A", "T", "C", "G"],
            description: "Single-letter base code"
          },
          fullName: {
            type: Type.STRING,
            description: "Full name of the nucleotide (e.g., 'Adenine')"
          },
          type: {
            type: Type.STRING,
            enum: ["purine", "pyrimidine"],
            description: "Whether purine (A, G) or pyrimidine (C, T)"
          },
          pairsWith: {
            type: Type.STRING,
            description: "Which base this pairs with (A↔T, C↔G)"
          },
          color: {
            type: Type.STRING,
            description: "Hex color for this base (e.g., '#22c55e' for green)"
          },
          bondType: {
            type: Type.STRING,
            description: "Bond description (e.g., '2 hydrogen bonds' for A-T, '3 hydrogen bonds' for C-G)"
          }
        },
        required: ["base", "fullName", "type", "pairsWith", "color", "bondType"]
      }
    },
    structuralFeatures: {
      type: Type.OBJECT,
      properties: {
        sugarPhosphateBackbone: {
          type: Type.STRING,
          description: "Grade-appropriate description of the sugar-phosphate backbone"
        },
        majorGroove: {
          type: Type.STRING,
          description: "Description of the major groove (grades 7-8 only, null for 5-6)"
        },
        minorGroove: {
          type: Type.STRING,
          description: "Description of the minor groove (grades 7-8 only, null for 5-6)"
        },
        antiparallelOrientation: {
          type: Type.STRING,
          description: "Grade-appropriate explanation of 5' to 3' directionality"
        }
      },
      required: ["sugarPhosphateBackbone", "antiparallelOrientation"]
    },
    zoomLevels: {
      type: Type.ARRAY,
      description: "Zoom levels from chromosome down to molecular (2-5 levels based on grade)",
      items: {
        type: Type.OBJECT,
        properties: {
          level: {
            type: Type.STRING,
            enum: ["chromosome", "gene", "sequence", "base-pair", "molecular"],
            description: "Zoom level identifier"
          },
          description: {
            type: Type.STRING,
            description: "What students see at this zoom level"
          },
          visibleFeatures: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: "Features visible at this zoom level"
          }
        },
        required: ["level", "description", "visibleFeatures"]
      }
    },
    centralDogmaStep: {
      type: Type.STRING,
      enum: ["none", "transcription", "translation"],
      description: "Which central dogma step to highlight (none for structure/base-pairing mode)"
    },
    buildChallenges: {
      type: Type.ARRAY,
      description: "Base pairing challenges for students (2-4 challenges). Each challenge must use a NOVEL sequence — never the Explore-tab sequence.templateStrand, and never any run of it.",
      items: {
        type: Type.OBJECT,
        properties: {
          givenStrand: {
            type: Type.STRING,
            description: "The FULL template strand the student must complement, with NO blanks or placeholders — all bases visible (e.g., 'GGCATT'). MUST be a NEW sequence that shares no 4-base run with sequence.templateStrand: that strand's complement is printed on the Explore tab, so reusing it (or any stretch of it) hands the student the answer."
          },
          task: {
            type: Type.STRING,
            description: "Instructions for the student (e.g., 'Complete the complementary strand'). Never state, spell or quote the answer bases."
          },
          correctAnswer: {
            type: Type.STRING,
            description: "The full correct complementary DNA strand for givenStrand (A↔T, C↔G), e.g. 'CCGTAA'."
          }
        },
        required: ["givenStrand", "task", "correctAnswer"]
      }
    },
    gradeBand: {
      type: Type.STRING,
      enum: ["5-6", "7-8"],
      description: "Target grade band"
    }
  },
  required: [
    "title", "description", "mode", "sequence", "nucleotides",
    "structuralFeatures", "zoomLevels", "centralDogmaStep",
    "buildChallenges", "gradeBand"
  ]
};

// ===========================================================================
// Answer contract (DNA-1) — code owns every answer-bearing strand
// ===========================================================================
//
// Measured 2026-08-08 over 20 real generations (see
// qa/eval-reports/dna-explorer-DNA-1-2026-08-08.md): 13/20 shipped a build
// challenge whose `givenStrand` was the Explore-tab `templateStrand` or a
// contiguous run of it. The Explore tab prints templateStrand ABOVE its own
// complement, aligned base-for-base, so any shared run means the answer is
// already on screen — the student slides a window instead of applying A↔T/C↔G.
//
// This cannot be expressed in a JSON response schema (no cross-field
// constraint exists) and prompt prose did not bind it — the pre-fix generator
// already asked for "no blanks" and still emitted `ATCG` (a prefix of the
// displayed `ATCGGATA`) in 12/20 runs. So the constraint lives in code:
// base pairing is deterministic, which makes every answer here derivable
// rather than trusted. The LLM keeps the prose (title, task wording, structural
// copy); code owns the strands and every key.
//
// Invariant enforced below, and re-derived independently by the oracle at
// service/qa/oracles/dna-explorer.ts:
//
//   1. sequence.complementaryStrand === complement(sequence.templateStrand)
//   2. no buildChallenge.givenStrand shares a LEAK_WINDOW-base run with
//      sequence.templateStrand (forwards or reversed), and none equals it
//   3. buildChallenge.correctAnswer === complement(givenStrand), always
//   4. challenges are distinct from one another
//
// (2) implies the answers are equally disjoint from the displayed complement:
// complementing is a bijection on bases, so it maps shared runs to shared runs.

/** Below 4 bases, two random A/T/C/G strings collide by chance — that is noise, not a leak. */
export const LEAK_WINDOW = 4;

const BASES = ['A', 'T', 'C', 'G'] as const;

export const DNA_COMPLEMENT: Record<string, string> = { A: 'T', T: 'A', C: 'G', G: 'C' };

/** Uppercase and drop anything that is not a DNA base — blanks, spaces, `_`, `?`. */
export const cleanStrand = (value: unknown): string =>
  String(value ?? '').toUpperCase().replace(/[^ATCG]/g, '');

/**
 * The complement the component grades against. Build challenges are DNA→DNA by
 * contract: DnaExplorer renders A/T/C/G only and its incorrect-answer feedback
 * says "A pairs with T, and C pairs with G", so an mRNA (A→U) key would be both
 * unstyled and contradicted on screen. Transcription is taught in the explainer
 * copy, not in the graded strand.
 */
export const complementStrand = (strand: string): string =>
  strand.split('').map((b) => DNA_COMPLEMENT[b] ?? '').join('');

const windowsOf = (strand: string, k: number): string[] => {
  const out: string[] = [];
  for (let i = 0; i + k <= strand.length; i++) out.push(strand.slice(i, i + k));
  return out;
};

const reverseOf = (s: string): string => s.split('').reverse().join('');

/**
 * The leak predicate: does `candidate` let a student read its answer off the
 * displayed sequence? True when the two share any run of `LEAK_WINDOW` bases
 * (either reading direction) or when they are outright equal.
 */
export const strandLeaksTemplate = (candidate: string, displayedTemplate: string): boolean => {
  if (!candidate || !displayedTemplate) return false;
  if (candidate === displayedTemplate) return true;
  const k = Math.min(LEAK_WINDOW, candidate.length, displayedTemplate.length);
  if (k <= 0) return false;
  const shown = new Set([
    ...windowsOf(displayedTemplate, k),
    ...windowsOf(reverseOf(displayedTemplate), k),
  ]);
  return windowsOf(candidate, k).some((w) => shown.has(w));
};

/** Deterministic PRNG so a given LLM payload always repairs to the same strands. */
const hashSeed = (s: string): number => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
};

const mulberry32 = (seed: number) => () => {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = seed;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

const shuffled = <T,>(items: readonly T[], rand: () => number): T[] => {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

/**
 * Produce a challenge strand of `length` bases that does NOT leak against the
 * displayed template and is not already used by another challenge.
 *
 * Keeps as much of the model's own strand as is legal (greedy left-to-right,
 * preferring the original base at each position) so a clean generation passes
 * through byte-identical and only the leaking positions move.
 */
export const buildNonLeakingStrand = (
  preferred: string,
  displayedTemplate: string,
  length: number,
  rand: () => number,
  used: ReadonlySet<string> = new Set(),
): string => {
  const k = Math.min(LEAK_WINDOW, Math.max(1, length), displayedTemplate.length || LEAK_WINDOW);
  const shown = new Set([
    ...windowsOf(displayedTemplate, k),
    ...windowsOf(reverseOf(displayedTemplate), k),
  ]);

  for (let attempt = 0; attempt < 32; attempt++) {
    const out: string[] = [];
    let stuck = false;
    for (let i = 0; i < length; i++) {
      const keep = attempt === 0 ? preferred[i] : undefined;
      const candidates = keep
        ? [keep, ...shuffled(BASES.filter((b) => b !== keep), rand)]
        : shuffled(BASES, rand);
      const pick = candidates.find((c) => {
        if (out.length < k - 1) return true;
        return !shown.has(out.slice(-(k - 1)).join('') + c);
      });
      if (!pick) { stuck = true; break; }
      out.push(pick);
    }
    if (stuck) continue;
    const candidate = out.join('');
    if (!strandLeaksTemplate(candidate, displayedTemplate) && !used.has(candidate)) return candidate;
  }

  // Unreachable for realistic inputs (a 12-base template forbids at most 18 of
  // 256 four-mers). Fail loud rather than silently shipping a leaking strand.
  console.warn('🧬 DNA Explorer: could not build a non-leaking strand; falling back to a rotation');
  const fallback = displayedTemplate
    ? complementStrand(displayedTemplate).slice(0, length).padEnd(length, 'G')
    : 'GTCA'.repeat(length).slice(0, length);
  return fallback;
};

/** Neutral task wording used when the model's own task text is unusable. */
const TASK_TEMPLATES = [
  'Write the complementary strand for this template.',
  'This is a new template strand. Pair every base to build its partner strand.',
  'Build the matching strand. Remember which bases go together.',
  'One more template — write the strand that pairs with it.',
];

/** Grade-band strand sizing, mirroring the prompt guidelines. */
const BAND_SHAPE: Record<'5-6' | '7-8', { min: number; max: number; fallback: number; minChallenges: number }> = {
  '5-6': { min: 4, max: 8, fallback: 6, minChallenges: 2 },
  '7-8': { min: 6, max: 12, fallback: 8, minChallenges: 3 },
};

/**
 * Enforce the answer contract on a generated (and config-merged) payload.
 *
 * Repairs rather than rejects: a leaking strand is a fixable coordinate, not a
 * broken activity, and rejecting would drop an otherwise-good lesson block.
 * Returns the repaired data plus a count of what it had to move, so the caller
 * can log the real repair rate instead of assuming the prompt held.
 */
export const validateDnaExplorerData = (
  data: DnaExplorerData,
): { data: DnaExplorerData; repairs: { strands: number; keys: number; tasks: number; added: number } } => {
  const repairs = { strands: 0, keys: 0, tasks: 0, added: 0 };
  const band: '5-6' | '7-8' = data.gradeBand === '7-8' ? '7-8' : '5-6';
  const shape = BAND_SHAPE[band];

  // --- 1. The displayed sequence: complement is derived, never trusted. ---
  const template = cleanStrand(data.sequence?.templateStrand) || 'ATGCAT';
  const complementary = complementStrand(template);
  const highlight = data.sequence?.highlightedRegion;
  const sequence = {
    templateStrand: template,
    complementaryStrand: complementary,
    ...(highlight
      ? {
          highlightedRegion: {
            ...highlight,
            start: Math.max(0, Math.min(highlight.start ?? 0, template.length - 1)),
            end: Math.max(0, Math.min(highlight.end ?? 0, template.length - 1)),
          },
        }
      : {}),
  };

  // --- 2/3/4. Build challenges: strands disjoint from the display, keys derived. ---
  const rand = mulberry32(hashSeed(`${data.title ?? ''}|${template}|${data.buildChallenges?.length ?? 0}`));
  const raw = Array.isArray(data.buildChallenges) ? data.buildChallenges : [];
  const wanted = Math.min(4, Math.max(shape.minChallenges, raw.length));
  const used = new Set<string>();
  const challenges: BuildChallenge[] = [];

  for (let i = 0; i < wanted; i++) {
    const source = raw[i];
    if (!source) repairs.added++;

    const cleaned = cleanStrand(source?.givenStrand);
    const length = Math.min(shape.max, Math.max(shape.min, cleaned.length || shape.fallback));
    const preferred = cleaned.slice(0, length);
    const given = buildNonLeakingStrand(preferred, template, length, rand, used);
    if (source && given !== cleaned) repairs.strands++;
    used.add(given);

    const correctAnswer = complementStrand(given);
    if (source && cleanStrand(source.correctAnswer) !== correctAnswer) repairs.keys++;

    // The task is prose, but it must not spell the key out or promise an mRNA
    // transcript the component will not grade. Both are cheap to detect and the
    // neutral fallback always fits the interaction.
    const taskText = String(source?.task ?? '').trim();
    const taskLeaks = !taskText
      || new RegExp(`\\b${correctAnswer}\\b`, 'i').test(taskText)
      || new RegExp(`\\b${given}\\b`, 'i').test(taskText)
      || /\b(m?rna|uracil|transcri\w*)\b/i.test(taskText);
    if (source && taskLeaks) repairs.tasks++;

    challenges.push({
      givenStrand: given,
      task: taskLeaks ? TASK_TEMPLATES[i % TASK_TEMPLATES.length] : taskText,
      correctAnswer,
    });
  }

  return { data: { ...data, gradeBand: band, sequence, buildChallenges: challenges }, repairs };
};

/**
 * Generate DNA Explorer data using Gemini AI
 *
 * Creates an interactive DNA structure exploration with base pairing
 * challenges, zoom levels, and structural feature descriptions.
 *
 * @param ctx - Generation context (topic, grade, intent, raw config)
 * @returns DnaExplorerData with sequence, nucleotides, challenges, and zoom levels
 */
export const generateDnaExplorer = async (
  ctx: GenerationContext
): Promise<DnaExplorerData> => {
  const { topic } = ctx;
  const config = ctx.raw as Partial<DnaExplorerData>;

  // Canonical grade first, prose second. `ctx.gradeContext` is PROSE ("middle
  // school students - ...") and the old token map indexed it directly, so the
  // lookup missed at every grade and `|| '5-6'` always won — the 7-8 band was
  // unreachable (probed 2026-08-08 at grade=7: gradeBand still '5-6'). Same
  // class the biology gradeBand.ts helper fixes for the K-2/3-5/6-8 vocabulary;
  // this primitive uses a 5-6/7-8 vocabulary, which is why it was missed.
  const bandFromGrade = (grade?: string): '5-6' | '7-8' | null => {
    const g = String(grade ?? '').trim().toUpperCase();
    if (!g) return null;
    if (g === '5-6' || g === '7-8') return g;
    const n = parseInt(g, 10);
    if (isNaN(n)) return null;
    return n <= 6 ? '5-6' : '7-8';
  };
  const bandFromProse = (prose?: string): '5-6' | '7-8' => {
    const p = (prose ?? '').toLowerCase();
    if (/\b(grade [78]|[78]th grade|middle school)\b/.test(p)) return '7-8';
    return '5-6';
  };
  const gradeBand: '5-6' | '7-8' =
    (config.gradeBand as '5-6' | '7-8' | undefined)
    ?? bandFromGrade(ctx.grade)
    ?? bandFromProse(ctx.gradeContext);

  // Per-primitive intent: the specific objective the manifest assigned to THIS activity.
  // The genetics topic stays fixed; intent biases which facets get the spotlight.
  const intent = ctx.intent || "";
  const intentFocus = intent
    ? `

LEARNING FOCUS: This activity is being used to teach: "${intent}".
Keep every sequence, nucleotide, and feature scientifically accurate and complete, but lead
with and expand the aspects most relevant to this focus (e.g. a base-pairing focus means
richer pairing content; a structure focus means richer backbone/groove content).
Do not state or reveal the answer to any challenge or question the student will be asked.`
    : "";

  const gradeContext = {
    '5-6': `
GRADE 5-6 GUIDELINES:
- Focus on BASE PAIRING RULES: A always pairs with T, C always pairs with G
- Use simple vocabulary: "backbone" instead of "sugar-phosphate backbone" in descriptions
- Keep sequences SHORT: 6-8 bases maximum
- Mode should be "structure" or "base-pairing" (no transcription/replication)
- centralDogmaStep should be "none"
- Zoom levels: 3 levels (chromosome, sequence, base-pair)
- Do NOT include majorGroove/minorGroove in structural features
- Build challenges: 2-3 complementary strand completion tasks, each 4-8 bases
- Use fun analogies: "DNA is like a twisted ladder" or "bases are like puzzle pieces"
- Highlighted region label should be simple: "A gene" or "Important section"
- antiparallelOrientation: simple explanation like "The two strands run in opposite directions, like two lanes on a road"
`,
    '7-8': `
GRADE 7-8 GUIDELINES:
- Include BASE PAIRING RULES plus hydrogen bond specifics (A-T: 2 bonds, C-G: 3 bonds)
- Use scientific vocabulary: nucleotide, phosphodiester bond, antiparallel
- Sequences can be LONGER: 8-12 bases
- All modes available (structure, base-pairing, transcription, replication)
- centralDogmaStep can be "transcription" or "translation" if mode is transcription
- Zoom levels: 4-5 levels (chromosome, gene, sequence, base-pair, molecular)
- Include majorGroove and minorGroove descriptions
- Build challenges: 3-4 complementary strand tasks, each 6-12 bases
- Highlighted region: can be specific gene or promoter region
- antiparallelOrientation: scientific explanation with 5' and 3' terminology
- Include more detail about purine vs pyrimidine classification
`
  };

  const generationPrompt = `Create an interactive DNA structure exploration activity for: "${topic}".

TARGET GRADE BAND: ${gradeBand}

${gradeContext[gradeBand]}

REQUIREMENTS:

1. **Sequence**: Generate a DNA sequence appropriate for the topic and grade level.
   - Template strand: 5' to 3' direction, only A/T/C/G
   - Complementary strand: Must be correctly base-paired (A↔T, C↔G)
   - Length: 6-8 bases for grade 5-6, 8-12 for grade 7-8
   - Do NOT start every sequence with "ATCG" — vary the opening bases between activities
   - Optionally highlight a region of interest

2. **Nucleotides**: Provide information for all 4 DNA bases:
   - A (Adenine) - purine, pairs with T, 2 hydrogen bonds
   - T (Thymine) - pyrimidine, pairs with A, 2 hydrogen bonds
   - C (Cytosine) - pyrimidine, pairs with G, 3 hydrogen bonds
   - G (Guanine) - purine, pairs with C, 3 hydrogen bonds

3. **Structural Features**: Grade-appropriate descriptions of:
   - Sugar-phosphate backbone
   - Antiparallel orientation (5' → 3')
   - Major and minor grooves (7-8 only)

4. **Zoom Levels**: Progressive zoom from chromosome to molecular level
   - Each level describes what's visible and key features

5. **Build Challenges**: Interactive tasks for students:
   - THE SEQUENCE ABOVE IS ALREADY SOLVED ON SCREEN. The Explore tab prints
     sequence.templateStrand directly above sequence.complementaryStrand, aligned
     base for base. So every build challenge must use a COMPLETELY NEW strand that
     shares NO run of 4 bases with sequence.templateStrand. If it reuses that strand,
     or any stretch of it, the student reads the answer off the Explore tab instead
     of pairing bases, and the activity teaches nothing.
   - givenStrand is the FULL new template with every base visible — no blanks, no '_'
   - correctAnswer is that strand's complement (A↔T, C↔G), same length
   - Every challenge uses a different strand from every other challenge
   - Task text never states, spells or quotes the answer bases
   - Build challenges are always DNA → DNA complements, even in transcription mode
     (the component grades A/T/C/G); teach RNA in the descriptions, not in the strand
   - Progress from simple to more complex

6. **Central Dogma Step**: Set based on mode:
   - structure/base-pairing → "none"
   - transcription → "transcription"
   - replication → "none" (replication is about DNA copying, not central dogma per se)

CRITICAL: Make sure:
- All complementary base pairings are correct (A↔T, C↔G)
- Build challenge answers match the base pairing rules
- No build challenge strand overlaps the displayed Explore-tab sequence
- Zoom levels progress from largest (chromosome) to smallest
- Grade-appropriate vocabulary throughout
- Title and description are engaging for the target age group
${intentFocus}

Now generate the DNA exploration activity for "${topic}" at grade level ${gradeBand}.`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-flash-lite-latest',
      contents: generationPrompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: dnaExplorerSchema,
        systemInstruction: `You are an expert molecular biology educator specializing in middle school genetics. You understand DNA structure, base pairing rules, the central dogma, and how to make molecular biology accessible and exciting for students. You always generate scientifically accurate base pair combinations and create engaging exploration activities that build from observation to understanding. You never let a student read an answer off the screen: practice strands are always new sequences, never the one already shown solved.`,
      }
    });

    const text = response.text;
    if (!text) {
      throw new Error("No data returned from Gemini API");
    }

    const result = JSON.parse(text) as DnaExplorerData;

    // Merge config overrides FIRST, then enforce the answer contract — an
    // override is just as capable of reintroducing the leak as the model is.
    const merged: DnaExplorerData = {
      ...result,
      ...config,
      gradeBand,
    };
    const { data: finalData, repairs } = validateDnaExplorerData(merged);

    console.log('🧬 DNA Explorer Generated:', {
      title: finalData.title,
      mode: finalData.mode,
      sequenceLength: finalData.sequence.templateStrand.length,
      challenges: finalData.buildChallenges.length,
      zoomLevels: finalData.zoomLevels.length,
      gradeBand: finalData.gradeBand,
      repairs,
    });

    return finalData;

  } catch (error) {
    console.error("Error generating DNA explorer:", error);
    throw error;
  }
};
