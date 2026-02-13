import { Type, Schema } from "@google/genai";
import { ai } from "../geminiClient";
import { SpellingPatternExplorerData, PatternType } from "../../primitives/visual-primitives/literacy/SpellingPatternExplorer";

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

export const generateSpellingPatternExplorer = async (
  topic: string,
  gradeLevel: string = '3',
  config?: Partial<SpellingPatternExplorerData>
): Promise<SpellingPatternExplorerData> => {
  const gradeLevelKey = ['1', '2', '3', '4', '5', '6'].includes(gradeLevel) ? gradeLevel : '3';

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
  const selectedPattern = config?.patternType || patterns[Math.floor(Math.random() * patterns.length)];

  const prompt = `Create a spelling pattern exploration activity about: "${topic}".
GRADE: ${gradeLevelKey}. PATTERN TYPE: ${selectedPattern}.
${gradeNotes[gradeLevelKey] || gradeNotes['3']}

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
        responseSchema: spellingPatternExplorerSchema,
        systemInstruction: 'You are an expert K-6 spelling instructor specializing in phonics patterns, morphology, and word study. You create word lists with clear, consistent spelling patterns. Your rule templates guide students to discover patterns inductively. Dictation words apply the same pattern in new contexts.',
      }
    });
    const text = response.text;
    if (!text) throw new Error("No data returned from Gemini API");
    const result = JSON.parse(text) as SpellingPatternExplorerData;
    return { ...result, ...config };
  } catch (error) {
    console.error("Error generating spelling pattern explorer:", error);
    throw error;
  }
};
