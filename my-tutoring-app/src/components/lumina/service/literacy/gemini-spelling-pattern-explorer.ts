import { Type, Schema } from "@google/genai";
import { ai } from "../geminiClient";
import type { GenerationContext } from "../generation/generationContext";
import { SpellingPatternExplorerData, PatternType } from "../../primitives/visual-primitives/literacy/SpellingPatternExplorer";
import {
  resolveEvalModeConstraint,
  constrainChallengeTypeEnum,
  buildChallengeTypePromptSection,
  logEvalModeResolution,
  type ChallengeTypeDoc,
} from '../evalMode';
import { makePatternItems, patternsNamed, sessionPatterns } from '../../primitives/visual-primitives/literacy/spellingPatternBuild';
import { mulberry32, type WordSpaceStamp } from '../wordSpace/pick';
import { scopeFromObjective } from '../wordSpace/scope';
import { candidatePatterns, drawSpellingSession } from '../wordSpace/spellingPatternSpaces';

const CHALLENGE_TYPE_DOCS: Record<string, ChallengeTypeDoc> = {
  'short-vowel': {
    promptDoc: `"short-vowel": CVC and short vowel patterns. Word families (-at, -an, -ig, -op, -ug). Grade 1 level.`,
    schemaDescription: "'short-vowel' (CVC patterns)",
  },
  'long-vowel': {
    promptDoc: `"long-vowel": CVCe and vowel team patterns (ai, ea, oa, ee). Grade 2 level.`,
    schemaDescription: "'long-vowel' (CVCe, vowel teams)",
  },
  'r-controlled': {
    promptDoc: `"r-controlled": R-controlled vowel patterns (ar, er, ir, or, ur). Grade 3 level.`,
    schemaDescription: "'r-controlled' (ar, er, ir, or, ur)",
  },
  'suffix-change': {
    promptDoc: `"suffix-change": Suffix addition rules (-ing, -ed, -ly, -ful, -ness). Doubling, dropping, changing rules. Grades 3-4.`,
    schemaDescription: "'suffix-change' (suffix addition rules)",
  },
  'latin-root': {
    promptDoc: `"latin-root": Latin/Greek root-based spelling patterns. -tion/-sion/-cian endings. Grades 5-6.`,
    schemaDescription: "'latin-root' (etymology-based spelling)",
  },
  'silent-letter': {
    promptDoc: `"silent-letter": Silent letter conventions (kn, wr, gn, mb, etc.). Grades 5-6.`,
    schemaDescription: "'silent-letter' (silent letter patterns)",
  },
};

const spellingPatternExplorerSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    title: { type: Type.STRING },
    gradeLevel: { type: Type.STRING },
    patternType: { type: Type.STRING, enum: ["short-vowel", "long-vowel", "r-controlled", "suffix-change", "latin-root", "silent-letter"] },
    patternWords: { type: Type.ARRAY, items: { type: Type.STRING }, description: "6-10 words that share the spelling pattern" },
    highlightPattern: { type: Type.STRING, description: "The shared pattern to highlight (e.g. '-ight', 'silent-e', '-tion')" },
    ruleTemplate: { type: Type.STRING, description: "Fill-in-the-blank rule template for students" },
    correctRule: { type: Type.STRING, description: "Model answer for the rule" },
    dictationWords: { type: Type.ARRAY, items: { type: Type.STRING }, description: "4-6 new words using the same pattern for spelling practice" },
    dictationHints: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Optional hint for each dictation word" },
  },
  required: ["title", "gradeLevel", "patternType", "patternWords", "highlightPattern", "ruleTemplate", "correctRule", "dictationWords"]
};

// ---------------------------------------------------------------------------
// Within-mode support tier (config.difficulty) — scaffolding level, NOT content
// ---------------------------------------------------------------------------

type SupportTier = 'easy' | 'medium' | 'hard';
const SUPPORT_TIERS: readonly SupportTier[] = ['easy', 'medium', 'hard'];

/** STRICT lookup — the manifest enum-constrains config.difficulty to these.
 *  Unknown/absent → null (no tier applied; byte-identical legacy payload). */
export function normalizeSupportTier(difficulty?: string): SupportTier | null {
  const d = difficulty?.toLowerCase().trim() ?? '';
  return (SUPPORT_TIERS as readonly string[]).includes(d) ? (d as SupportTier) : null;
}

type SpellingPatternExplorerConfig = Partial<SpellingPatternExplorerData & {
  targetEvalMode: string;
  /**
   * Per-component support tier from the manifest ('easy' | 'medium' | 'hard').
   * Second axis of the two-field contract: targetEvalMode = which skill,
   * difficulty = how much on-screen scaffolding within it. On the model path it
   * never changes content: the tiers are component display gates driven by the
   * typed `supportTier` stamp below, and nothing tier-shaped reaches the prompt.
   * On the word-space path (grades K-2) it also picks the dictation words.
   */
  difficulty: string;
}>;

/**
 * Post-parse finalize: strip the tier-steering config fields from the spread
 * (so the raw `difficulty` string never leaks into component data, exactly like
 * `targetEvalMode`) and stamp the typed `supportTier` AFTER the spread so a
 * config-provided value can never clobber the normalized tier. Gated ONLY on
 * the tier being non-null — absent/unknown difficulty stamps NOTHING and the
 * payload stays byte-identical legacy.
 */
export function finalizeSpellingPatternExplorerData(
  result: SpellingPatternExplorerData,
  config: SpellingPatternExplorerConfig | undefined,
): SpellingPatternExplorerData {
  const supportTier = normalizeSupportTier(config?.difficulty);
  const { targetEvalMode: _unusedMode, difficulty: _unusedDifficulty, ...configRest } = config ?? {};
  void _unusedMode;
  void _unusedDifficulty;
  return {
    ...result,
    ...configRest,
    ...(supportTier ? { supportTier } : {}),
  };
}

export const generateSpellingPatternExplorer = async (
  ctx: GenerationContext,
): Promise<SpellingPatternExplorerData> => {
  const { topic } = ctx;
  const intent = ctx.intent;
  const config = ctx.raw as SpellingPatternExplorerConfig;
  // Grade ladder for this generator (gradeNotes/patternsByGrade define rungs 1-6).
  // Read the canonical curriculum grade (ctx.grade); the legacy prose read of
  // ctx.gradeContext never matched ['1'..'6'] and silently pinned every objective
  // to grade 3 (parse-and-fallback). See /topic-fidelity --grade.
  const LADDER = ['1', '2', '3', '4', '5', '6'] as const;
  let gradeLevelKey: string;
  if (ctx.grade && (LADDER as readonly string[]).includes(ctx.grade)) {
    gradeLevelKey = ctx.grade;
  } else if (ctx.grade && parseInt(ctx.grade, 10) > 6) {
    gradeLevelKey = '6'; // above-ceiling numeric grade clamps to top rung
  } else {
    // Band fallback only (no canonical grade): this ladder has no K rung, so
    // kindergarten/preschool clamps to the grade-1 floor; other bands → mid rung.
    gradeLevelKey = ctx.gradeLevel === 'kindergarten' || ctx.gradeLevel === 'preschool' ? '1' : '3';
  }

  // pattern_build (open build, qa/open-build/ROADMAP.md OB-8L): code-owned asks on the shared letter build surface.
  // No model call: the patterns follow the objective (a named spelling, sound or pattern family), else the grade
  // (1-3; above 3 uses the grade-3 set); any real word with the asked pattern passes, judged by code and the word judge.
  if (config?.targetEvalMode === 'pattern_build') {
    const tier = normalizeSupportTier(config?.difficulty);
    const named = patternsNamed(`${topic ?? ''} ${intent ?? ''}`);
    const patterns = sessionPatterns(named, gradeLevelKey, config?.patternType);
    const buildItems = makePatternItems(patterns, 4);
    console.log('[SpellingPatternExplorer] pattern_build: letter build', { named, patterns, asks: buildItems.map(i => i.ask) });
    return {
      title: 'Make Pattern Words', gradeLevel: gradeLevelKey, patternType: config?.patternType ?? 'long-vowel',
      patternWords: [], highlightPattern: '', ruleTemplate: '', correctRule: '', dictationWords: [],
      task: 'letter_build', buildItems, ...(tier ? { supportTier: tier } : {}),
    };
  }

  const evalConstraint = resolveEvalModeConstraint(
    'spelling-pattern-explorer',
    config?.targetEvalMode,
    CHALLENGE_TYPE_DOCS,
  );
  logEvalModeResolution('SpellingPatternExplorer', config?.targetEvalMode, evalConstraint);

  const activeSchema = evalConstraint
    ? constrainChallengeTypeEnum(spellingPatternExplorerSchema, evalConstraint.allowedTypes, CHALLENGE_TYPE_DOCS, {
        fieldName: 'patternType',
        rootLevel: true,
      })
    : spellingPatternExplorerSchema;

  const gradeNotes: Record<string, string> = {
    '1': 'Grade 1: SHORT-VOWEL CVC patterns. Word families (-at, -an, -ig, -op, -ug). 6 pattern words, 4 dictation words. Simple rule.',
    '2': 'Grade 2: LONG-VOWEL patterns (CVCe, vowel teams: ai, ea, oa, ee). 7 pattern words, 4-5 dictation words.',
    '3': 'Grade 3: R-CONTROLLED vowels. Doubling rule (hopping vs hoping). Plural rules. 8 pattern words, 5 dictation words.',
    '4': 'Grade 4: SUFFIX-CHANGE (-ing, -ed, -ly, -ful, -ness). Homophones. 8 pattern words, 5-6 dictation words.',
    '5': 'Grade 5: LATIN-ROOT affecting spelling. -tion/-sion/-cian endings. Silent letters. 8-10 pattern words, 5-6 dictation words.',
    '6': 'Grade 6: Advanced patterns (ei/ie rule). Absorbed prefixes (in→im, il, ir). Etymology-based spelling. 10 pattern words, 6 dictation words.',
  };

  const patternsByGrade: Record<string, PatternType[]> = {
    '1': ['short-vowel'],
    '2': ['long-vowel'],
    '3': ['r-controlled', 'suffix-change'],
    '4': ['suffix-change'],
    '5': ['latin-root', 'silent-letter'],
    '6': ['latin-root', 'silent-letter'],
  };

  const patterns = patternsByGrade[gradeLevelKey] || patternsByGrade['3'];
  const selectedPattern = evalConstraint
    ? evalConstraint.allowedTypes[0] as PatternType
    : (config?.patternType || patterns[Math.floor(Math.random() * patterns.length)]);

  // ── Word space (2026-10-14, service/wordSpace/spellingPatternSpaces.ts): at grades K-2 with a support tier
  //    and no remediation focus, code picks one pattern the objective allows, the tier's four dictation
  //    words and six easier pattern words from the word library, and writes the rule from the pattern.
  //    No model call. A pattern the library cannot fill (er, mb, a one-onset family) takes the model path.
  const spaceTier = normalizeSupportTier(config?.difficulty);
  const lexGrade = ctx.grade === 'K' || ctx.grade === '1' || ctx.grade === '2' ? ctx.grade
    : !ctx.grade && (gradeLevelKey === '1' || gradeLevelKey === '2') ? gradeLevelKey : null;
  const spaceKind = (['short-vowel', 'long-vowel', 'r-controlled', 'silent-letter'] as const).find(k => k === selectedPattern);
  if (spaceTier && lexGrade && spaceKind && !ctx.remediationFocus) {
    const texts = [ctx.objective?.text, intent, topic];
    const scope = scopeFromObjective(texts);
    const candidates = candidatePatterns(spaceKind, patternsNamed(texts.filter(Boolean).join(' ')), scope?.family ?? null, scope?.vowels ?? null);
    const session = drawSpellingSession(candidates, lexGrade, spaceTier, mulberry32(Math.floor(Math.random() * 2 ** 31)));
    if (session) {
      const { def, dictation, examples } = session;
      const items: WordSpaceStamp[] = dictation.map(d => ({ space: `spelling-pattern-${spaceKind}`, structure: d.structure, beta: d.beta }));
      const meanBeta = +(dictation.reduce((s, d) => s + d.beta, 0) / dictation.length).toFixed(2);
      console.log(`[SpellingPatternExplorer] Word space (${spaceTier}, grade ${lexGrade}, ${def.shown} of ${candidates.join(',')}): `
        + `dictate ${dictation.map(d => `${d.payload.word} β${d.beta}`).join(', ')}; examples ${examples.map(e => e.payload.word).join(', ')}`);
      return finalizeSpellingPatternExplorerData({
        title: def.title, gradeLevel: gradeLevelKey, patternType: spaceKind,
        patternWords: examples.map(e => e.payload.word), highlightPattern: def.shown,
        ruleTemplate: def.ruleTemplate, correctRule: def.correctRule,
        dictationWords: dictation.map(d => d.payload.word),
        wordSpace: { space: `spelling-pattern-${spaceKind}`, structure: def.shown, beta: meanBeta, items },
      }, config);
    }
    console.log(`[SpellingPatternExplorer] Word space (${spaceTier}, grade ${lexGrade}): no pattern of ${candidates.join(',') || '(none the library holds)'} fills a session, model path`);
  }

  const challengeTypeSection = buildChallengeTypePromptSection(evalConstraint, CHALLENGE_TYPE_DOCS);

  const prompt = `Create a spelling pattern exploration activity about: "${topic}".
${intent ? `\nSPECIFIC FOCUS: The broad lesson is "${topic}", but THIS activity must specifically target: "${intent}". Shape the content (passages, target words, sentences, evidence, questions) to serve that focus. Never name or reveal the answer in this focus text.\n` : ''}
GRADE: ${gradeLevelKey}. PATTERN TYPE: ${selectedPattern}.
${gradeNotes[gradeLevelKey] || gradeNotes['3']}
${challengeTypeSection}
Rules:
1. Choose words related to the topic when possible
2. All patternWords must share the same spelling pattern
3. highlightPattern is the shared pattern substring
4. ruleTemplate should be a fill-in-the-blank sentence
5. dictationWords should be NEW words (not in patternWords) using the same pattern
6. Include dictationHints for each dictation word`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-flash-lite-latest',
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: activeSchema,
        systemInstruction: 'You are an expert K-6 spelling instructor specializing in phonics patterns, morphology, and word study. You create word lists with clear, consistent spelling patterns. Your rule templates guide students to discover patterns inductively. Dictation words apply the same pattern in new contexts.',
      }
    });
    const text = response.text;
    if (!text) throw new Error("No data returned from Gemini API");
    const result = JSON.parse(text) as SpellingPatternExplorerData;
    // Single exit path: strip difficulty/targetEvalMode from the config spread and
    // stamp the typed supportTier in code (display gating is component-side).
    const data = finalizeSpellingPatternExplorerData(result, config);
    if (data.supportTier) {
      console.log(`[SpellingPatternExplorer] Support tier "${data.supportTier}" stamped (component display gates own the withdrawal)`);
    }
    return data;
  } catch (error) {
    console.error("Error generating spelling pattern explorer:", error);
    throw error;
  }
};
