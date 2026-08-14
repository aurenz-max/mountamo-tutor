import { Type, Schema } from "@google/genai";
import { ai } from "../geminiClient";
import type { GenerationContext } from "../generation/generationContext";
import { ReadAloudStudioData } from "../../primitives/visual-primitives/literacy/ReadAloudStudio";
import {
  MAX_SENTENCE_WORDS,
  MIN_SENTENCE_WORDS,
  itemFromLine,
  type ReadAloudLineLike,
  type ReadAloudMode,
} from "../../primitives/visual-primitives/literacy/readAloudStudioScript";
import {
  resolveEvalModeConstraint,
  constrainChallengeTypeEnum,
  buildChallengeTypePromptSection,
  logEvalModeResolution,
  type ChallengeTypeDoc,
} from '../evalMode';

// ---------------------------------------------------------------------------
// DI PORT (2026-08-12) — the generator now produces a JUDGED read-aloud.
//
// What changed at the wire. The click-era payload was a `passage` blob plus a
// `passageWords` array plus `expressionMarkers` that pointed at it BY INDEX —
// a shape that only had to survive being rendered. Nothing was ever read back
// and nothing was ever judged, so an index off by one, a marker on a word that
// was not there, or a "question" marker on a statement all cost exactly zero.
// The moment a tutor has to SAY the ask out loud, every one of those becomes an
// unaskable item. So the passage now arrives already split into LINES, each
// line carries its own fields, and the index-into-a-word-array binding is gone
// (positional bindings are a standing footgun in this codebase).
//
// THE LINE WINDOW IS THE BENCH'S, NOT OURS. `MIN_SENTENCE_WORDS` /
// `MAX_SENTENCE_WORDS` (3-8) are imported from the di-sentence-reading pack —
// the sitting that benched `sentence_read_aloud` laddered exactly that far and
// recorded longer connected text as unbenched. The grade ladder therefore rides
// on line COUNT, vocabulary, sentence variety and Lexile, never on line length
// past 8 words.
//
// KEEP-OR-DROP, NEVER BACKFILL. Every line is run through the SAME build gate
// the component runs (`itemFromLine`) before it ships. A placeholder line in a
// judged loop is not a cosmetic defect: it becomes a spoken ask the tutor has
// to judge a child against.
//
// WHAT WRITING THE SPOKEN ASK AUDITED. Two things a tap never had to justify:
// (a) `comprehensionQuestion` / `comprehensionAnswer` were generated on every
// single call for months and rendered nowhere — dead weight in every payload,
// and dead tokens in every request; (b) dialogue lines have to arrive as the
// SPOKEN WORDS ONLY with the speaker in its own field, because the tutor's cue
// says «Mia says: I will not go» — a line arriving with its own quotation marks
// would close the `Say exactly: "…"` span the tutor reads.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Challenge type documentation registry
//
// The three fluency identities survive the port intact — they were always
// genuinely different tasks, they simply had nothing measuring them. What the
// port changes is WHO does the work and what the tutor is allowed to say:
//
//   accuracy   — the child decodes the printed line COLD. The tutor must not
//                read it first; unaided decoding is the whole measurement.
//   expression — the tutor MODELS the line as one smooth phrase, the child says
//                it back. A prosody you have never heard cannot be imitated.
//   dialogue   — the tutor MODELS one character's line in that character's
//                voice, the child says it back their way.
//
// In all three the WORDS are the verdict and the delivery is the teaching:
// there is no prosody response class, so nothing grades how it sounded.
// ---------------------------------------------------------------------------

const CHALLENGE_TYPE_DOCS: Record<string, ChallengeTypeDoc> = {
  accuracy: {
    promptDoc:
      `"accuracy": Smooth, accurate word reading (automaticity), read COLD — the tutor never says the `
      + `line first. Write a plain narrative or informational passage with mostly decodable, `
      + `high-frequency vocabulary. Do NOT set speaker. Do NOT set stressWord. Earliest fluency `
      + `skill — grades 1-3.`,
    schemaDescription: "'accuracy' (smooth, correct word reading, read cold)",
  },
  expression: {
    promptDoc:
      `"expression": Phrasing and stress. Every line must be a natural PHRASE UNIT that sounds `
      + `complete when read as one smooth breath — split at commas and clause boundaries, never `
      + `mid-phrase. Set stressWord on EVERY line to the one content word a good reader leans on `
      + `(a noun, verb, adjective or adverb THAT APPEARS IN THAT LINE — never "the", "and", "of", `
      + `"is"). Do NOT set speaker. Grades 2-5.`,
    schemaDescription: "'expression' (phrasing and stress, modelled then imitated)",
  },
  dialogue: {
    promptDoc:
      `"dialogue": Character-voice reading. EVERY line is one character's spoken words and EVERY `
      + `line must set speaker to that character's name. Write the spoken words ONLY — no quotation `
      + `marks, no "she said", no narration lines. Give the characters clearly different feelings `
      + `so the voices differ. Do NOT set stressWord. Most advanced — grades 4-6.`,
    schemaDescription: "'dialogue' (one character's spoken line, modelled then imitated)",
  },
};

const readAloudStudioSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    title: { type: Type.STRING, description: "Short title for the reading passage" },
    gradeLevel: { type: Type.STRING, description: "Target grade level ('1' through '6')" },
    fluencyFocus: {
      type: Type.STRING,
      enum: ["accuracy", "expression", "dialogue"],
      description: "Which fluency sub-skill this passage targets",
    },
    lexileLevel: { type: Type.STRING, description: "Approximate Lexile level e.g. '520L'" },
    // FLAT line objects, one level deep, bounded. A nested marker object here
    // is exactly the shape flash-lite drops under load.
    lines: {
      type: Type.ARRAY,
      minItems: '4',
      maxItems: '8',
      description:
        `The passage, split into ${MIN_SENTENCE_WORDS}-${MAX_SENTENCE_WORDS} word lines, in reading order. `
        + `Read end to end the lines must form one connected passage.`,
      items: {
        type: Type.OBJECT,
        properties: {
          text: {
            type: Type.STRING,
            description:
              `One line to be read aloud: ${MIN_SENTENCE_WORDS} to ${MAX_SENTENCE_WORDS} words. `
              + `No quotation marks. Never start a sentence with the word "Yes" or the words "My turn".`,
          },
          speaker: {
            type: Type.STRING,
            description: "dialogue mode ONLY: the name of the character who says this line. Omit otherwise.",
          },
          stressWord: {
            type: Type.STRING,
            description:
              "expression mode ONLY: one content word FROM THIS LINE that a good reader leans on. Omit otherwise.",
          },
        },
        required: ["text"],
      },
    },
  },
  required: ["title", "gradeLevel", "lexileLevel", "lines"],
};

type ReadAloudStudioConfig = Partial<ReadAloudStudioData> & {
  /** Target eval mode from the IRT calibration system (accuracy | expression | dialogue). */
  targetEvalMode?: string;
};

/** Raw line shape as it comes back off the wire. */
interface RawLine {
  text?: string;
  speaker?: string;
  stressWord?: string;
}

export const generateReadAloudStudio = async (
  ctx: GenerationContext,
): Promise<ReadAloudStudioData> => {
  const { topic } = ctx;
  const intent = ctx.intent;
  const config = ctx.raw as ReadAloudStudioConfig;

  // ── Grade resolution ────────────────────────────────────────────────
  // Read the canonical curriculum grade (ctx.grade) — the ONLY reliable grade
  // signal. ctx.gradeLevel is a BAND key ('elementary' collapses grades 1-5) and
  // ctx.gradeContext is prose, so neither can recover a numeric rung. This ladder
  // defines rungs 1-6; below-floor (K/preschool) clamps to the floor rung '1',
  // above-ceiling numeric grades clamp to the top rung '6', and a bare band with
  // no numeric grade falls back to the mid rung '3'.
  const LADDER = ['1', '2', '3', '4', '5', '6'] as const;
  let gradeLevelKey: string;
  if (ctx.grade && (LADDER as readonly string[]).includes(ctx.grade)) {
    gradeLevelKey = ctx.grade;
  } else if (ctx.grade === 'K' || ctx.gradeLevel === 'kindergarten' || ctx.gradeLevel === 'preschool') {
    gradeLevelKey = '1';
  } else if (ctx.grade && parseInt(ctx.grade, 10) > 6) {
    gradeLevelKey = '6';
  } else {
    gradeLevelKey = '3';
  }

  // ── Eval mode resolution ────────────────────────────────────────────
  const evalConstraint = resolveEvalModeConstraint(
    'read-aloud-studio',
    config?.targetEvalMode,
    CHALLENGE_TYPE_DOCS,
  );
  logEvalModeResolution('ReadAloudStudio', config?.targetEvalMode, evalConstraint);

  const activeSchema = evalConstraint
    ? constrainChallengeTypeEnum(readAloudStudioSchema, evalConstraint.allowedTypes, CHALLENGE_TYPE_DOCS, {
        fieldName: 'fluencyFocus',
        rootLevel: true,
      })
    : readAloudStudioSchema;

  /** The mode the payload is BUILT for — the resolved constraint wins, because
   *  it is what the component will run the build gates under. */
  const mode: ReadAloudMode =
    (evalConstraint?.allowedTypes[0] as ReadAloudMode | undefined) ?? 'accuracy';

  // Line LENGTH is bench-fixed at 3-8 words for every grade, so the ladder
  // moves line COUNT, vocabulary and Lexile instead. A grade-6 passage is
  // harder because of the words in it, not because the utterance got longer
  // than the judge has been proven on.
  const gradeNotes: Record<string, string> = {
    '1': "Grade 1: 4 lines of 3-5 words. Sight words and simple CVC vocabulary. Lexile ~200L.",
    '2': "Grade 2: 5 lines of 3-6 words. Common two-syllable words. Lexile ~400L.",
    '3': "Grade 3: 6 lines of 4-7 words. Some multisyllable vocabulary. Lexile ~520L.",
    '4': "Grade 4: 6 lines of 4-8 words. Richer verbs and adjectives. Lexile ~700L.",
    '5': "Grade 5: 7 lines of 5-8 words. Subject-specific vocabulary. Lexile ~850L.",
    '6': "Grade 6: 8 lines of 5-8 words. Genre-appropriate, precise word choice. Lexile ~950L.",
  };

  const challengeTypeSection = buildChallengeTypePromptSection(
    evalConstraint,
    CHALLENGE_TYPE_DOCS,
  );

  const prompt = `Create a short read-aloud fluency passage about: "${topic}".
${intent ? `\nSPECIFIC FOCUS: The broad lesson is "${topic}", but THIS activity must specifically target: "${intent}". Shape the passage to serve that focus.\n` : ''}
GRADE: ${gradeLevelKey}.
${gradeNotes[gradeLevelKey] || gradeNotes['3']}

${challengeTypeSection}

A LIVE TUTOR SPEAKS THESE LINES AND JUDGES THE CHILD READING THEM BACK, WORD BY WORD. Rules:
1. Every line must be ${MIN_SENTENCE_WORDS}-${MAX_SENTENCE_WORDS} words. A line outside that window is thrown away, so stay inside it.
2. The lines, read in order, must form ONE connected passage — not a list of unrelated sentences.
3. Each line must be readable on its own: no line may start with a word that only makes sense joined to the line before it.
4. NEVER begin a sentence with the word "Yes" or with the words "My turn" — those two openings mean "correct" and "wrong" to the tutor, and a line carrying one silently flips a verdict.
5. No quotation marks anywhere in any line.
6. Use words a grade ${gradeLevelKey} reader can decode. Every line will be read aloud by a child.${evalConstraint ? `\n7. fluencyFocus MUST be "${evalConstraint.allowedTypes[0]}".` : ''}`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-flash-lite-latest',
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: activeSchema,
        maxOutputTokens: 4096,
        systemInstruction:
          'You are an expert K-6 reading fluency instructor writing material for a live Direct Instruction '
          + 'tutor that reads with a child and judges every word they read back. You write short, connected, '
          + 'grade-appropriate passages split into single-breath lines a child can read aloud one at a time.',
      }
    });
    const text = response.text;
    if (!text) throw new Error("No data returned from Gemini API");
    const result = JSON.parse(text) as {
      title?: string;
      gradeLevel?: string;
      fluencyFocus?: ReadAloudMode;
      lexileLevel?: string;
      lines?: RawLine[];
    };

    const focus: ReadAloudMode = result.fluencyFocus ?? mode;

    // ── KEEP-OR-DROP, on the generator's side of the wire too ──────────
    // The component runs exactly this gate; running it here as well means a
    // payload never carries a line that will silently vanish downstream, and
    // the drop shows up in THIS log where the prompt that caused it lives.
    const rawLines: ReadAloudLineLike[] = (result.lines ?? []).map((line) => ({
      text: line.text ?? '',
      speaker: line.speaker,
      stressWord: line.stressWord,
    }));
    const keptLines = rawLines.filter((line, index) => itemFromLine(line, focus, index) !== null);

    if (keptLines.length < rawLines.length) {
      console.warn(
        `[ReadAloudStudio] dropped ${rawLines.length - keptLines.length}/${rawLines.length} line(s) — `
        + `outside the ${MIN_SENTENCE_WORDS}-${MAX_SENTENCE_WORDS} word window, sentinel-opening, or `
        + `${focus === 'dialogue' ? 'missing a speaker' : 'unbuildable'}.`,
        rawLines.filter((line, index) => itemFromLine(line, focus, index) === null).map((l) => l.text),
      );
    }
    if (keptLines.length === 0) {
      throw new Error('Every generated line failed the judged-line gates — nothing readable to ship.');
    }

    const { targetEvalMode: _unused, ...configRest } = config ?? {};
    void _unused;

    const finalData: ReadAloudStudioData = {
      title: result.title || 'Read It Out Loud',
      gradeLevel: result.gradeLevel || gradeLevelKey,
      fluencyFocus: focus,
      lexileLevel: result.lexileLevel || '',
      lines: keptLines,
      ...configRest,
    };

    console.log('Read Aloud Studio Generated:', {
      title: finalData.title,
      gradeLevel: finalData.gradeLevel,
      fluencyFocus: finalData.fluencyFocus,
      lineCount: finalData.lines.length,
      droppedLines: rawLines.length - keptLines.length,
    });

    return finalData;
  } catch (error) {
    console.error("Error generating read aloud studio:", error);
    throw error;
  }
};
