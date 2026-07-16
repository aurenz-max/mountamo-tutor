import { Type, Schema, ThinkingLevel } from "@google/genai";
import { MediaPlayerData, FullLessonSegment, SegmentKnowledgeCheck } from "../../types";
import { ai } from "../geminiClient";
import type { GenerationContext } from "../generation/generationContext";
import { buildScopePromptSection, gradeToBand, buildGradeLine } from "../scopeContext";

/**
 * media-player generator — narrated listening-comprehension walkthrough.
 *
 * Reimagined 2026-07-16 (media-player-reimagining workstream, contract:
 * docs/contracts/media-player.md). Three band modalities as eval-mode task
 * identities — each check is answerable from that segment's NARRATION alone
 * (contract R3; the audio channel is the objective, not chrome):
 *
 *   listen_and_look     PRE (K)      main-idea/key-detail picture check
 *   listen_for_details  EMERGING (1) specific-detail check, short options
 *   story_analysis      ESTABLISHED  why/how/sequence/evidence check
 *
 * Grade banding reads ctx.grade FIRST (gradeToBand), falling back to the prose
 * gradeContext only when no canonical grade exists — never parse grade out of
 * prose when ctx.grade is present. The result is stamped as data.gradeLevel so
 * the component can band-gate presentation (contract R8 rebuild).
 */

// ---------------------------------------------------------------------------
// Eval modes (task identities)
// ---------------------------------------------------------------------------

export type MediaPlayerEvalMode =
  | 'listen_and_look'
  | 'listen_for_details'
  | 'story_analysis';

const MODE_DOCS: Record<MediaPlayerEvalMode, { defaultSegments: number; promptSection: string }> = {
  listen_and_look: {
    defaultSegments: 3,
    promptSection: `TASK IDENTITY — LISTEN AND LOOK (pre-reader, kindergarten):
The child CANNOT read. A tutor reads every script and every question + option aloud; the child answers by tapping a PICTURE.
- Each knowledge check asks for the MAIN IDEA or ONE key detail of THAT segment's script. One short spoken sentence, MAX 12 words.
- options: exactly 3, each 1-4 words, a CONCRETE thing a 5-year-old can picture. No abstract phrases. The wording must not leak the answer.
- optionAEmoji/optionBEmoji/optionCEmoji: REQUIRED — one DISTINCT emoji per option, same order, clearly depicting it. The emoji is the answer surface; it must stand alone without the text.
- scripts: warm storyteller voice, very simple words, concrete images ("as big as a school bus").`,
  },
  listen_for_details: {
    defaultSegments: 3,
    promptSection: `TASK IDENTITY — LISTEN FOR DETAILS (emerging reader, grade 1):
The student listens to each narrated segment, then identifies a SPECIFIC detail they heard.
- Each knowledge check asks about one concrete detail stated in THAT segment's script (a who / what / where / when / how many).
- options: 3-4, each SHORT (1-4 words) so an emerging reader can decode them; a tutor also reads them aloud.
- Distractors are plausible details NOT stated in the segment.`,
  },
  story_analysis: {
    defaultSegments: 4,
    promptSection: `TASK IDENTITY — STORY ANALYSIS (established reader, grade 2+):
The student listens and reads along, then reasons about the narration.
- Vary the question kinds across segments: WHY/HOW something happened, WHICH detail supports an idea, WHAT ORDER events happened in, or what a word/idea in the script means.
- options: 3-4 full phrases or sentences; distractors must be wrong-on-reflection, not obviously silly.
- Questions still answerable ONLY from the segment's script — no outside knowledge.`,
  },
};

const isMediaPlayerEvalMode = (v: unknown): v is MediaPlayerEvalMode =>
  typeof v === 'string' && v in MODE_DOCS;

/** Grade default when the resolver doesn't pin a mode (grade = ceiling). */
const defaultModeForGrade = (grade?: string, preReader?: boolean): MediaPlayerEvalMode => {
  if (preReader) return 'listen_and_look';
  const g = (grade ?? '').toUpperCase();
  if (g === 'K') return 'listen_and_look';
  const n = parseInt(g, 10);
  if (!isNaN(n)) return n <= 1 ? 'listen_for_details' : 'story_analysis';
  return 'listen_for_details';
};

// ---------------------------------------------------------------------------
// Grade banding (prose fallback kept for free-form lessons only)
// ---------------------------------------------------------------------------

const inferGradeLevelFromContext = (gradeContext: string): string => {
  const lower = (gradeContext || '').toLowerCase();
  if (lower.includes('preschool') || lower.includes('prek')) return 'preschool';
  if (lower.includes('kindergarten')) return 'kindergarten';
  if (lower.includes('middle')) return 'middle-school';
  if (lower.includes('high')) return 'high-school';
  return 'elementary';
};

const getGradeLevelContext = (bandKey: string): string => {
  const contexts: Record<string, string> = {
    'preschool': 'preschool children (ages 3-5) - Use simple sentences, colorful examples, storytelling, and hands-on concepts. Build curiosity and wonder.',
    'kindergarten': 'kindergarten students (ages 5-6) - Use clear, very simple language, relatable examples, and a warm storyteller voice. The script will be READ ALOUD to a child who cannot read.',
    'Kindergarten': 'kindergarten students (ages 5-6) - Use clear, very simple language, relatable examples, and a warm storyteller voice. The script will be READ ALOUD to a child who cannot read.',
    'elementary': 'elementary students (grades 1-5) - Use age-appropriate vocabulary, concrete examples, and an engaging narrator voice.',
    'Elementary': 'elementary students (grades 1-5) - Use age-appropriate vocabulary, concrete examples, and an engaging narrator voice.',
    'middle-school': 'middle school students (grades 6-8) - Use more complex vocabulary, abstract concepts, and real-world applications.',
    'Middle School': 'middle school students (grades 6-8) - Use more complex vocabulary, abstract concepts, and real-world applications.',
    'high-school': 'high school students (grades 9-12) - Use advanced vocabulary, sophisticated concepts, and academic rigor.',
    'High School': 'high school students (grades 9-12) - Use advanced vocabulary, sophisticated concepts, and academic rigor.',
  };
  return contexts[bandKey] || contexts['elementary'];
};

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

type MediaPlayerConfig = {
  segmentCount?: number;
  imageResolution?: '1K' | '2K' | '4K';
  targetEvalMode?: string;
};

/** Raw per-segment shape as the model emits it (flat PRE emoji fields — the
 *  fact-file pattern; a nested emoji array is the shape flash-tier models drop). */
interface RawSegment {
  title: string;
  script: string;
  imagePrompt: string;
  knowledgeCheck: {
    question: string;
    options: string[];
    correctOptionIndex: number;
    explanation?: string;
    optionAEmoji?: string | null;
    optionBEmoji?: string | null;
    optionCEmoji?: string | null;
    optionDEmoji?: string | null;
  };
}

interface RawLesson {
  lessonTitle: string;
  segments: RawSegment[];
}

const buildSchema = (preReader: boolean): Schema => ({
  type: Type.OBJECT,
  properties: {
    lessonTitle: {
      type: Type.STRING,
      description: "Short, catchy lesson title (3-6 words). NEVER restate the full objective or topic sentence.",
    },
    segments: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING, description: "Short, catchy segment title (3-5 words)" },
          script: {
            type: Type.STRING,
            description: "Clear, engaging narration script (2-3 sentences) intended to be spoken aloud. Age-appropriate and conversational.",
          },
          imagePrompt: {
            type: Type.STRING,
            description: "Detailed visual description for image generation that illustrates the concept clearly",
          },
          knowledgeCheck: {
            type: Type.OBJECT,
            description: "Comprehension question answerable ONLY from this segment's script",
            properties: {
              question: { type: Type.STRING, description: "Question testing the KEY concept from this segment" },
              options: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: "3-4 answer choices (1 correct + plausible distractors)",
              },
              correctOptionIndex: { type: Type.NUMBER, description: "0-based index of the correct answer" },
              explanation: { type: Type.STRING, description: "Brief explanation of why this answer is correct" },
              ...(preReader
                ? {
                    optionAEmoji: { type: Type.STRING, nullable: true, description: "Single DISTINCT emoji depicting option 1 (the picture answer surface)" },
                    optionBEmoji: { type: Type.STRING, nullable: true, description: "Single DISTINCT emoji depicting option 2" },
                    optionCEmoji: { type: Type.STRING, nullable: true, description: "Single DISTINCT emoji depicting option 3" },
                    optionDEmoji: { type: Type.STRING, nullable: true, description: "Single DISTINCT emoji depicting option 4, if present" },
                  }
                : {}),
            },
            required: ["question", "options", "correctOptionIndex"],
          },
        },
        required: ["title", "script", "imagePrompt", "knowledgeCheck"],
      },
    },
  },
  required: ["lessonTitle", "segments"],
});

// ---------------------------------------------------------------------------
// Image generation (unchanged — contract R7: on-demand, never upfront)
// ---------------------------------------------------------------------------

/**
 * Generate image for a specific prompt. Returns base64 data URL or null.
 * Exported as `generateMediaImage` for on-demand ("Generate Visual") generation
 * triggered by the student at runtime via /api/lumina, mirroring MachineProfile.
 */
export const generateMediaImage = async (
  prompt: string,
  resolution: '1K' | '2K' | '4K' = '1K'
): Promise<string | null> => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3.1-flash-lite-image",
      contents: {
        parts: [{ text: prompt }]
      },
      config: {
        imageConfig: {
          aspectRatio: "16:9",
          imageSize: resolution
        }
      }
    });

    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
        const base64String = part.inlineData.data;
        return `data:image/png;base64,${base64String}`;
      }
    }

    console.warn('No image generated found in response');
    return null;
  } catch (error) {
    console.error('Error generating image segment:', error);
    return null;
  }
};

// ---------------------------------------------------------------------------
// Post-processing
// ---------------------------------------------------------------------------

/** Assemble optionEmojis from the flat fields; keep only when complete + distinct. */
const resolveOptionEmojis = (kc: RawSegment['knowledgeCheck']): string[] | undefined => {
  const raw = [kc.optionAEmoji, kc.optionBEmoji, kc.optionCEmoji, kc.optionDEmoji]
    .slice(0, kc.options.length)
    .map((e) => (e ?? '').trim());
  const complete = raw.length === kc.options.length && raw.every((e) => e.length > 0);
  const distinct = new Set(raw).size === raw.length;
  return complete && distinct ? raw : undefined;
};

const toSegment = (raw: RawSegment, preReader: boolean): FullLessonSegment => {
  const kc: SegmentKnowledgeCheck = {
    question: raw.knowledgeCheck.question,
    options: raw.knowledgeCheck.options,
    correctOptionIndex: raw.knowledgeCheck.correctOptionIndex,
    ...(raw.knowledgeCheck.explanation ? { explanation: raw.knowledgeCheck.explanation } : {}),
  };
  if (preReader) {
    const emojis = resolveOptionEmojis(raw.knowledgeCheck);
    if (emojis) kc.optionEmojis = emojis;
  }
  return {
    title: raw.title,
    script: raw.script,
    imagePrompt: raw.imagePrompt,
    knowledgeCheck: kc,
    audioBase64: null,
    imageUrl: null,
  };
};

// ---------------------------------------------------------------------------
// Generator
// ---------------------------------------------------------------------------

export const generateMediaPlayer = async (
  ctx: GenerationContext
): Promise<MediaPlayerData> => {
  const config = ctx.raw as MediaPlayerConfig;
  const topic = ctx.intent || ctx.title || ctx.topic;

  // ── Grade banding: ctx.grade first, prose fallback second ──
  const bandKey = gradeToBand(ctx.grade) || inferGradeLevelFromContext(ctx.gradeContext);
  const gradeLevelContext = getGradeLevelContext(bandKey);
  const gradeLine = buildGradeLine(ctx.grade, 'spoken-script vocabulary, sentence length, and question difficulty');
  const canonicalGrade = (ctx.grade ?? '').toString().trim().toLowerCase();
  const isPreReader =
    canonicalGrade === 'k' || canonicalGrade === 'kindergarten' ||
    (!ctx.grade && /(kinder|preschool|pre-?k\b|prek|pre-?reader)/i.test(ctx.gradeContext ?? ''));

  // ── Eval mode: manifest pin (ctx.targetEvalMode | config), else grade default ──
  const pinned = ctx.targetEvalMode ?? config.targetEvalMode;
  const evalMode: MediaPlayerEvalMode = isMediaPlayerEvalMode(pinned)
    ? pinned
    : defaultModeForGrade(ctx.grade, isPreReader);
  const modeDoc = MODE_DOCS[evalMode];
  const preReaderRender = evalMode === 'listen_and_look';

  const segmentCount = config.segmentCount ?? modeDoc.defaultSegments;
  const imageResolution = config.imageResolution ?? '1K';
  const scopeSection = buildScopePromptSection(ctx.scope);

  const prompt = `Create a ${segmentCount}-part narrated educational walkthrough about: "${topic}".
${scopeSection}
TARGET AUDIENCE: ${gradeLevelContext}
${gradeLine ? gradeLine + '\n' : ''}
${modeDoc.promptSection}

For the LESSON provide:
1. lessonTitle: a short, catchy title (3-6 words) — a headline, NOT a restatement of the objective.

For EACH of the ${segmentCount} segments provide:
1. A short, catchy segment title (3-5 words)
2. A narration script (2-3 sentences, written to be SPOKEN aloud with natural pacing — this is the teaching channel)
3. A detailed visual description prompt for an image generation model
4. A knowledge check matching the TASK IDENTITY above

KNOWLEDGE CHECK RULES (all modes):
- Answerable ONLY from that segment's script — a student who only LISTENED can answer
- Exactly one correct option; correctOptionIndex is its 0-based position
- Never leak the answer in the question wording or option phrasing
- Include a brief explanation of why the correct answer is right

The segments build on each other progressively, starting with fundamentals.`;

  console.log(`[MediaPlayer] mode=${evalMode} (pin=${pinned ?? 'none'}) grade=${ctx.grade ?? bandKey} segments=${segmentCount}`);

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        thinkingConfig: {
          thinkingLevel: ThinkingLevel.HIGH,
        },
        responseMimeType: "application/json",
        responseSchema: buildSchema(preReaderRender),
        temperature: 1.0,
      },
    });

    const raw: RawLesson | null = response.text ? JSON.parse(response.text) : null;
    if (!raw || !Array.isArray(raw.segments) || raw.segments.length === 0) {
      throw new Error('No valid lesson plan returned from Gemini API');
    }

    // Structural validation — a mis-keyed check makes the challenge unsolvable.
    for (const seg of raw.segments) {
      const kc = seg.knowledgeCheck;
      if (
        !kc || !Array.isArray(kc.options) || kc.options.length < 2 ||
        typeof kc.correctOptionIndex !== 'number' ||
        kc.correctOptionIndex < 0 || kc.correctOptionIndex >= kc.options.length
      ) {
        throw new Error(`media-player: invalid knowledgeCheck on segment "${seg?.title ?? '?'}"`);
      }
    }

    const segments = raw.segments.map((s) => toSegment(s, preReaderRender));

    // Short title (clears MP-1 — never echo the raw topic/intent paragraph).
    const lessonTitle = (raw.lessonTitle || '').trim();
    const title = lessonTitle && lessonTitle.length <= 60
      ? lessonTitle
      : (lessonTitle ? lessonTitle.slice(0, 57) + '…' : segments[0].title);

    const result: MediaPlayerData = {
      title,
      description: `A ${segments.length}-part narrated walkthrough with a check after each part.`,
      segments,
      imageResolution,
      gradeLevel: ctx.grade ?? (isPreReader ? 'K' : bandKey),
      evalMode,
    };

    console.log('[MediaPlayer] Generated:', {
      title: result.title,
      evalMode,
      gradeLevel: result.gradeLevel,
      segments: segments.length,
      preEmojis: preReaderRender
        ? segments.map((s) => s.knowledgeCheck?.optionEmojis?.join('') ?? '—')
        : undefined,
    });
    return result;
  } catch (error) {
    console.error('Error generating media player:', error);
    throw error;
  }
};
