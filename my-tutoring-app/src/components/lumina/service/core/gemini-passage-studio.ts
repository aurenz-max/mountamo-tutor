/**
 * PassageStudio Orchestrator Generator
 *
 * Two-stage generation (mirrors gemini-deep-dive.ts):
 *   1. ORCHESTRATOR — plans stimulus kind/layout/block sequence AND writes
 *      the actual stimulus content inline (passage/poem/dialogue/sentences).
 *   2. PARALLEL BLOCK GENERATORS — each block hydrates against the stimulus.
 *
 * Anchor strategy: block generators return substring "quotes" instead of raw
 * character offsets. The pipeline resolves quotes to spans via indexOf so we
 * never rely on the LLM to compute offsets correctly. Quotes that don't
 * resolve are dropped and the block falls back to anchor-less rendering.
 */

import { Type, Schema } from '@google/genai';
import { ai } from '../geminiClient';
import type {
  PassageStudioData,
  PassageStimulus,
  PassageSpan,
  PassageBlock,
  PassageLayout,
  BlockType,
  PassageDisplayBlockData,
  PullQuoteBlockData,
  VocabCardBlockData,
  AuthorContextBlockData,
  ComprehensionMcqBlockData,
  EvidenceHighlightBlockData,
  VocabInContextBlockData,
  InferenceBuilderBlockData,
  ThemeStatementBlockData,
  ThemeRubricCriterion,
} from '../../primitives/visual-primitives/core/passage-studio/types';

// ═══════════════════════════════════════════════════════════════════════
// Stage 1: Orchestrator
// ═══════════════════════════════════════════════════════════════════════

interface OrchestratorBlockPlan {
  blockType: string;
  label: string;
  brief: string;
  tutoringBrief: string;
  transitionCue: string;
}

interface OrchestratorPlan {
  title: string;
  subtitle: string;
  narrativeArc: string;
  layout: string;
  stimulusKind: 'prose' | 'poem' | 'dialogue' | 'sentence-set';
  stimulusTitle?: string | null;
  stimulusAuthor?: string | null;
  stimulusSource?: string | null;
  stimulusText: string;
  blocks: OrchestratorBlockPlan[];
}

const ORCHESTRATOR_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    title: { type: Type.STRING, description: 'Engaging title for the lesson' },
    subtitle: { type: Type.STRING, description: 'One-sentence subtitle describing what the student will work on' },
    narrativeArc: { type: Type.STRING, description: '2-3 sentences describing the analytical journey from reading → comprehension → analysis' },
    layout: { type: Type.STRING, description: 'One of: stack, split_passage, reveal_beat, annotated_passage' },
    stimulusKind: { type: Type.STRING, description: 'One of: prose, poem, dialogue, sentence-set' },
    stimulusTitle: { type: Type.STRING, description: 'Optional title for the passage/poem/dialogue', nullable: true },
    stimulusAuthor: { type: Type.STRING, description: 'Optional author/poet attribution', nullable: true },
    stimulusSource: { type: Type.STRING, description: 'Optional publication/source attribution', nullable: true },
    stimulusText: {
      type: Type.STRING,
      description:
        'The full stimulus content as a single string. Format depends on stimulusKind:\n' +
        '- prose: paragraphs separated by \\n\\n. 60–250 words depending on grade level.\n' +
        '- poem: one line per \\n. 4–12 lines.\n' +
        '- dialogue: one turn per line, formatted "Speaker: line text". 2–8 turns.\n' +
        '- sentence-set: one sentence per \\n. 2–6 sentences.',
    },
    blocks: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          blockType: { type: Type.STRING, description: 'One of: passage-display, pull-quote, vocab-card, author-context, comprehension-mcq, evidence-highlight, vocab-in-context, inference-builder, theme-statement' },
          label: { type: Type.STRING, description: 'Short display label for this block' },
          brief: { type: Type.STRING, description: 'Detailed brief for the block generator. For evaluable blocks, specify what concept to test. For pull-quote, the brief IS the quote text.' },
          tutoringBrief: { type: Type.STRING, description: 'What the AI tutor should do when the student is on this block' },
          transitionCue: { type: Type.STRING, description: 'How this block connects to the next — narrative flow' },
        },
        required: ['blockType', 'label', 'brief', 'tutoringBrief', 'transitionCue'],
      },
    },
  },
  required: ['title', 'subtitle', 'narrativeArc', 'layout', 'stimulusKind', 'stimulusText', 'blocks'],
};

function buildOrchestratorPrompt(topic: string, gradeLevel: string, evalMode?: string): string {
  return `You are an expert language-arts learning designer. Plan a PassageStudio lesson on "${topic}" for ${gradeLevel} students.

A PassageStudio is a multi-block close-reading experience anchored to a single text stimulus. Your job is to:
1. Pick the stimulus kind (prose excerpt, poem, dialogue, or sentence set).
2. WRITE THE ACTUAL STIMULUS as a single string in stimulusText, formatted per the kind's rules below.
3. Pick a wrapper layout strategy.
4. Plan a sequence of blocks that walk the student through reading → comprehension → analysis.
5. Write content briefs for each block. Briefs can quote phrases from the stimulus you just wrote — downstream generators will see it.

## Stimulus kinds and how to format stimulusText

- **prose** — fiction excerpts, nonfiction articles, opinion pieces, fables. Default choice.
  Format: 2–4 short paragraphs separated by \\n\\n. 60–250 words depending on grade level.
  The passage needs a clear narrative or argument arc, concrete evocative phrases (blocks will anchor to these), and a coherent voice. Include 1–2 stretch vocabulary words.

- **poem** — pairs especially well with reveal_beat or annotated_passage layouts.
  Format: one line per \\n, 4–12 lines total. Provide stimulusTitle. No blank lines between stanzas — just \\n.
  Use clear, evocative imagery. Don't shy away from figurative language.

- **dialogue** — short conversations. Best for character/social analysis.
  Format: one turn per line, each line formatted exactly as "Speaker: line text". 2–8 turns total. Use \\n between turns.
  Use distinct voices so character analysis is possible.

- **sentence-set** — collection of sentences for grammar/syntax/word-choice work.
  Format: one sentence per \\n, 2–6 sentences total.
  Each sentence stands alone but they share a topic so comparisons are possible.

## Available block types
**Display (no scoring):**
- **passage-display** — renders the stimulus (or an excerpt). EVERY lesson must have at least one. In stack/reveal_beat layouts this is the student's primary read; in split_passage/annotated_passage the layout pins the passage and this block is optional.
- **pull-quote** — editorial highlight. The brief IS the quote text (1–2 sentences). Use sparingly to mark thematic beats.
- **vocab-card** — definition card for a word students should know before encountering it. Brief should specify the target word and its definition.
- **author-context** — 1–2 short paragraphs about the author/source/era/genre. Use for poetry and historical texts.

**Evaluable (scored):**
- **comprehension-mcq** — MCQ testing what the passage says (literal). Brief should specify what concept/event to ask about.
- **evidence-highlight** — student selects spans from the passage that support a claim. Brief should specify the claim AND name 3–4 candidate phrases (some correct, some distractors) the block generator will quote into.
- **vocab-in-context** — 4 meanings of a passage word, only one fits the context. Brief should specify the target word — pick a word that actually appears verbatim in the stimulus you wrote.
- **inference-builder** — 4 candidate inferences, student picks the best-supported one. Brief should specify what inference to draw and 2–3 plausible alternatives.
- **theme-statement** — open-response (1–3 sentences) judged by a rubric. Brief should specify what theme/idea the student should articulate.

## Layout choices
- **stack** — vertical flow. Default. Best when the lesson is short and linear.
- **split_passage** — passage pinned left, blocks scroll right. Best when many evaluables share the same passage.
- **reveal_beat** — sequential reveal, blocks unlock in order. Pedagogically strong for dramatic texts (stanzas of a poem, beats of a fable). Pair with multiple short passage-display blocks (each with an excerpt) interleaved with their evaluables.
- **annotated_passage** — passage centered, blocks render as margin notes. Best for dense literary analysis where most blocks anchor to specific phrases.

## Rules
1. Every lesson MUST include at least one passage-display block (unless using a layout that pins the passage).
2. The first block should orient the reader (passage-display or author-context).
3. Place comprehension-mcq before inference-builder before theme-statement (literal → analytical → synthesis).
4. Vary block types — don't stack 3 MCQs in a row.
5. Briefs must reference specific phrases from the stimulus you wrote so block generators can anchor accurately.
6. theme-statement should be the FINAL evaluable block when included. It synthesizes everything above.
7. Tutoring briefs describe what the AI tutor should SAY when the student reaches this block.
8. Transition cues are short narrative pivots between blocks.

${getEvalModeGuidance(evalMode)}

Write the stimulus and plan the blocks now. Make every brief specific.`;
}

function getEvalModeGuidance(evalMode?: string): string {
  switch (evalMode) {
    case 'explore':
      return `## Eval Mode: EXPLORE (easy)
Favor display blocks. Include 1–2 easy comprehension-mcq questions. 4–5 blocks total.
MC questions should test directly stated facts. Don't include theme-statement at this level.`;
    case 'recall':
      return `## Eval Mode: RECALL (medium-easy)
Mix of display and evaluables. 2–3 comprehension-mcq + 1 vocab-in-context. 5–7 blocks total.
Include passage-display + brief author-context if the text is unusual.`;
    case 'apply':
      return `## Eval Mode: APPLY (medium-hard)
Include comprehension-mcq + evidence-highlight + vocab-in-context. 6–8 blocks total.
Evidence-highlight requires the student to find textual support for a claim.`;
    case 'analyze':
      return `## Eval Mode: ANALYZE (hard)
Include comprehension-mcq + evidence-highlight + inference-builder + theme-statement. 7–9 blocks total.
End with theme-statement so the student synthesizes their analysis. Use reveal_beat or annotated_passage layout.`;
    default:
      return `## Default Mode
Include a balanced mix: 1 passage-display + 1–2 comprehension-mcq + 1 evidence-highlight + 1 vocab-in-context. 5–7 blocks total.`;
  }
}

const VALID_LAYOUTS = new Set<PassageLayout>(['stack', 'split_passage', 'reveal_beat', 'annotated_passage']);
const VALID_STIMULUS_KINDS = new Set<PassageStimulus['kind']>(['prose', 'poem', 'dialogue', 'sentence-set']);
const VALID_BLOCK_TYPES = new Set<BlockType>([
  'passage-display',
  'pull-quote',
  'vocab-card',
  'author-context',
  'comprehension-mcq',
  'evidence-highlight',
  'vocab-in-context',
  'inference-builder',
  'theme-statement',
]);

async function runOrchestrator(
  topic: string,
  gradeLevel: string,
  evalMode?: string,
): Promise<OrchestratorPlan> {
  const prompt = buildOrchestratorPrompt(topic, gradeLevel, evalMode);

  const response = await ai.models.generateContent({
    model: 'gemini-flash-lite-latest',
    contents: prompt,
    config: {
      responseMimeType: 'application/json',
      responseSchema: ORCHESTRATOR_SCHEMA,
    },
  });

  const text = response.text;
  if (!text) throw new Error('PassageStudio orchestrator returned empty response');

  const plan: OrchestratorPlan = JSON.parse(text);
  plan.blocks = plan.blocks.filter((b) => VALID_BLOCK_TYPES.has(b.blockType as BlockType));
  if (plan.blocks.length === 0) {
    throw new Error('PassageStudio orchestrator produced no valid blocks');
  }
  return plan;
}

// ═══════════════════════════════════════════════════════════════════════
// Stimulus extraction — parses the inline stimulusText into kind-specific shape
// ═══════════════════════════════════════════════════════════════════════

function extractStimulus(
  plan: OrchestratorPlan,
  kind: PassageStimulus['kind'],
  topic: string,
): PassageStimulus {
  const title = plan.stimulusTitle ?? undefined;
  const author = plan.stimulusAuthor ?? undefined;
  const source = plan.stimulusSource ?? undefined;
  const rawText = plan.stimulusText || `(passage about ${topic} unavailable)`;

  switch (kind) {
    case 'prose':
      return { kind: 'prose', title, author, source, text: rawText };

    case 'poem': {
      const lines = rawText.split('\n').map((l) => l.trim()).filter((l) => l.length > 0);
      return {
        kind: 'poem',
        title: title || `Poem: ${topic}`,
        author,
        lines,
        text: lines.join('\n'),
      };
    }

    case 'dialogue': {
      const turns: Array<{ speaker: string; text: string }> = [];
      for (const line of rawText.split('\n')) {
        const match = line.match(/^([^:]+):\s*(.+)$/);
        if (match) {
          turns.push({ speaker: match[1].trim(), text: match[2].trim() });
        }
      }
      return {
        kind: 'dialogue',
        title,
        turns,
        text: turns.map((t) => `${t.speaker}: ${t.text}`).join('\n'),
      };
    }

    case 'sentence-set': {
      const sentences = rawText.split('\n').map((s) => s.trim()).filter((s) => s.length > 0);
      return { kind: 'sentence-set', sentences, text: sentences.join('\n') };
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════
// Helpers — quote → span resolution
// ═══════════════════════════════════════════════════════════════════════

/**
 * Best-effort find the start offset of a quote in the stimulus text.
 * Tries:
 *   1. Exact match
 *   2. Case-insensitive match
 *   3. Whitespace-collapsed match (handles \n vs ' ' differences from LLM)
 * Returns null if no match.
 */
function resolveQuote(text: string, quote: string): PassageSpan | null {
  if (!quote) return null;
  const trimmed = quote.trim();
  if (!trimmed) return null;

  const exact = text.indexOf(trimmed);
  if (exact >= 0) return { start: exact, end: exact + trimmed.length };

  const lower = text.toLowerCase();
  const ci = lower.indexOf(trimmed.toLowerCase());
  if (ci >= 0) return { start: ci, end: ci + trimmed.length };

  // Whitespace-collapsed search — build a map from collapsed offsets back to original.
  const collapsedOf: number[] = [];
  let collapsed = '';
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (/\s/.test(ch)) {
      if (collapsed.endsWith(' ')) continue;
      collapsed += ' ';
    } else {
      collapsed += ch;
    }
    collapsedOf.push(i);
  }
  const collapsedQuote = trimmed.replace(/\s+/g, ' ');
  const ciCollapsed = collapsed.toLowerCase().indexOf(collapsedQuote.toLowerCase());
  if (ciCollapsed >= 0) {
    const start = collapsedOf[ciCollapsed];
    const endIdx = ciCollapsed + collapsedQuote.length - 1;
    const end = collapsedOf[Math.min(endIdx, collapsedOf.length - 1)] + 1;
    return { start, end };
  }

  return null;
}

// ═══════════════════════════════════════════════════════════════════════
// Stage 2b: Block generators
// ═══════════════════════════════════════════════════════════════════════

const PASSAGE_DISPLAY_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    showAttribution: { type: Type.BOOLEAN, description: 'Whether to render the attribution above the passage', nullable: true },
    excerptQuote: { type: Type.STRING, description: 'If only an excerpt should be rendered, the verbatim text. Otherwise null.', nullable: true },
  },
  required: [],
};

const COMPREHENSION_MCQ_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    question: { type: Type.STRING },
    option0: { type: Type.STRING },
    option1: { type: Type.STRING },
    option2: { type: Type.STRING },
    option3: { type: Type.STRING },
    correctIndex: { type: Type.NUMBER, description: '0–3' },
    explanation: { type: Type.STRING, description: 'Why the correct answer is right (2–3 sentences)' },
    evidenceQuote: { type: Type.STRING, description: 'Verbatim phrase from the passage that grounds the correct answer.', nullable: true },
  },
  required: ['question', 'option0', 'option1', 'option2', 'option3', 'correctIndex', 'explanation'],
};

const EVIDENCE_HIGHLIGHT_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    claim: { type: Type.STRING, description: 'The claim the student is finding evidence for' },
    candidate0Quote: { type: Type.STRING, description: 'Verbatim phrase from the passage' },
    candidate0IsEvidence: { type: Type.BOOLEAN, description: 'Does this phrase support the claim?' },
    candidate0Rationale: { type: Type.STRING, description: 'Why or why not', nullable: true },
    candidate1Quote: { type: Type.STRING },
    candidate1IsEvidence: { type: Type.BOOLEAN },
    candidate1Rationale: { type: Type.STRING, nullable: true },
    candidate2Quote: { type: Type.STRING },
    candidate2IsEvidence: { type: Type.BOOLEAN },
    candidate2Rationale: { type: Type.STRING, nullable: true },
    candidate3Quote: { type: Type.STRING, nullable: true },
    candidate3IsEvidence: { type: Type.BOOLEAN, nullable: true },
    candidate3Rationale: { type: Type.STRING, nullable: true },
    minCorrect: { type: Type.NUMBER, description: 'Minimum number of correct evidence spans the student must select. Defaults to 1.', nullable: true },
    explanation: { type: Type.STRING, description: 'Overall feedback after submission' },
  },
  required: [
    'claim', 'explanation',
    'candidate0Quote', 'candidate0IsEvidence',
    'candidate1Quote', 'candidate1IsEvidence',
    'candidate2Quote', 'candidate2IsEvidence',
  ],
};

const VOCAB_IN_CONTEXT_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    word: { type: Type.STRING, description: 'The target word — must appear verbatim in the passage' },
    meaning0: { type: Type.STRING },
    meaning1: { type: Type.STRING },
    meaning2: { type: Type.STRING },
    meaning3: { type: Type.STRING, nullable: true },
    correctIndex: { type: Type.NUMBER, description: '0–3' },
    explanation: { type: Type.STRING },
  },
  required: ['word', 'meaning0', 'meaning1', 'meaning2', 'correctIndex', 'explanation'],
};

const INFERENCE_BUILDER_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    question: { type: Type.STRING },
    candidate0: { type: Type.STRING, description: 'Inference statement A' },
    candidate1: { type: Type.STRING, description: 'Inference statement B' },
    candidate2: { type: Type.STRING, description: 'Inference statement C' },
    candidate3: { type: Type.STRING, description: 'Inference statement D (optional)', nullable: true },
    correctIndex: { type: Type.NUMBER, description: '0–3' },
    correctEvidenceQuote: { type: Type.STRING, description: 'Verbatim phrase from the passage supporting the correct inference', nullable: true },
    explanation: { type: Type.STRING, description: 'Why the correct inference is best-supported and why the others fall short (3–5 sentences)' },
  },
  required: ['question', 'candidate0', 'candidate1', 'candidate2', 'correctIndex', 'explanation'],
};

const THEME_STATEMENT_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    prompt: { type: Type.STRING, description: 'The writing prompt — usually about the passage\'s theme' },
    rubric0Label: { type: Type.STRING },
    rubric0Description: { type: Type.STRING },
    rubric0Weight: { type: Type.NUMBER, description: '1–3' },
    rubric1Label: { type: Type.STRING },
    rubric1Description: { type: Type.STRING },
    rubric1Weight: { type: Type.NUMBER },
    rubric2Label: { type: Type.STRING },
    rubric2Description: { type: Type.STRING },
    rubric2Weight: { type: Type.NUMBER },
    exemplar: { type: Type.STRING, description: 'A strong example response (2–3 sentences)' },
    minLength: { type: Type.NUMBER, nullable: true },
    maxLength: { type: Type.NUMBER, nullable: true },
  },
  required: [
    'prompt', 'exemplar',
    'rubric0Label', 'rubric0Description', 'rubric0Weight',
    'rubric1Label', 'rubric1Description', 'rubric1Weight',
    'rubric2Label', 'rubric2Description', 'rubric2Weight',
  ],
};

const VOCAB_CARD_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    word: { type: Type.STRING },
    partOfSpeech: { type: Type.STRING, nullable: true },
    definition: { type: Type.STRING },
    exampleSentence: { type: Type.STRING, description: 'Sentence using the word — usually mirrors the passage\'s usage', nullable: true },
    etymology: { type: Type.STRING, nullable: true },
  },
  required: ['word', 'definition'],
};

const AUTHOR_CONTEXT_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    paragraph0: { type: Type.STRING },
    paragraph1: { type: Type.STRING, nullable: true },
    paragraph2: { type: Type.STRING, nullable: true },
    era: { type: Type.STRING, nullable: true },
    genre: { type: Type.STRING, nullable: true },
  },
  required: ['paragraph0'],
};

// ── Block factories ─────────────────────────────────────────────────

async function generateBlock(
  plan: OrchestratorBlockPlan,
  index: number,
  stimulus: PassageStimulus,
  topic: string,
  gradeLevel: string,
): Promise<PassageBlock | null> {
  const baseId = `block-${index}`;
  const passageContext = `\n\n## Passage:\n${stimulus.text}`;

  try {
    switch (plan.blockType as BlockType) {
      case 'passage-display': {
        const response = await ai.models.generateContent({
          model: 'gemini-flash-lite-latest',
          contents: `Configure a passage-display block for a ${gradeLevel} lesson.

Brief: ${plan.brief}${passageContext}

If the brief asks for an excerpt, return the verbatim text of that excerpt as excerptQuote. Otherwise leave it null.
Set showAttribution true if attribution helps frame the passage.`,
          config: { responseMimeType: 'application/json', responseSchema: PASSAGE_DISPLAY_SCHEMA },
        });
        const data = JSON.parse(response.text || '{}');
        const excerpt = data.excerptQuote ? resolveQuote(stimulus.text, data.excerptQuote) ?? undefined : undefined;
        const block: PassageDisplayBlockData = {
          id: baseId,
          blockType: 'passage-display',
          label: plan.label,
          tutoringBrief: plan.tutoringBrief,
          transitionCue: plan.transitionCue,
          excerpt,
          showAttribution: data.showAttribution ?? true,
        };
        return block;
      }

      case 'pull-quote': {
        // No Gemini call — the orchestrator's brief IS the quote.
        const block: PullQuoteBlockData = {
          id: baseId,
          blockType: 'pull-quote',
          label: plan.label,
          tutoringBrief: plan.tutoringBrief,
          transitionCue: plan.transitionCue,
          text: plan.brief,
          attribution: plan.label,
        };
        return block;
      }

      case 'vocab-card': {
        const response = await ai.models.generateContent({
          model: 'gemini-flash-lite-latest',
          contents: `Write a vocab card for a ${gradeLevel} lesson.

Brief: ${plan.brief}${passageContext}

The exampleSentence should mirror the word's usage in the passage — quote the relevant phrase if possible.`,
          config: { responseMimeType: 'application/json', responseSchema: VOCAB_CARD_SCHEMA },
        });
        const data = JSON.parse(response.text || '{}');
        const passageAnchor = resolveQuote(stimulus.text, data.word) ?? undefined;
        const block: VocabCardBlockData = {
          id: baseId,
          blockType: 'vocab-card',
          label: plan.label,
          tutoringBrief: plan.tutoringBrief,
          transitionCue: plan.transitionCue,
          word: data.word,
          partOfSpeech: data.partOfSpeech ?? undefined,
          definition: data.definition,
          exampleSentence: data.exampleSentence ?? undefined,
          etymology: data.etymology ?? undefined,
          passageAnchor,
        };
        return block;
      }

      case 'author-context': {
        const response = await ai.models.generateContent({
          model: 'gemini-flash-lite-latest',
          contents: `Write 1–3 short paragraphs of author/source/era context for a ${gradeLevel} lesson on "${topic}".

Brief: ${plan.brief}${passageContext}

Keep paragraphs to 2–3 sentences each. Be factual; if uncertain, frame as "this kind of text" rather than naming a specific author.`,
          config: { responseMimeType: 'application/json', responseSchema: AUTHOR_CONTEXT_SCHEMA },
        });
        const data = JSON.parse(response.text || '{}');
        const paragraphs: string[] = [];
        for (let i = 0; i < 3; i++) {
          const p = data[`paragraph${i}`];
          if (p) paragraphs.push(p);
        }
        const block: AuthorContextBlockData = {
          id: baseId,
          blockType: 'author-context',
          label: plan.label,
          tutoringBrief: plan.tutoringBrief,
          transitionCue: plan.transitionCue,
          paragraphs: paragraphs.length > 0 ? paragraphs : [`Context for ${topic}.`],
          era: data.era ?? undefined,
          genre: data.genre ?? undefined,
        };
        return block;
      }

      case 'comprehension-mcq': {
        const response = await ai.models.generateContent({
          model: 'gemini-flash-lite-latest',
          contents: `Generate a comprehension MCQ for a ${gradeLevel} lesson on "${topic}".

Brief: ${plan.brief}${passageContext}

Generate 4 options. The correct answer should be directly supported by a verbatim phrase in the passage — return that phrase as evidenceQuote.
Make distractors plausible but clearly wrong. Don't make the correct answer obvious from length or position.`,
          config: { responseMimeType: 'application/json', responseSchema: COMPREHENSION_MCQ_SCHEMA },
        });
        const data = JSON.parse(response.text || '{}');
        const correctIndex = Math.max(0, Math.min(3, Math.round(data.correctIndex)));
        const evidenceAnchor = data.evidenceQuote ? resolveQuote(stimulus.text, data.evidenceQuote) ?? undefined : undefined;
        const block: ComprehensionMcqBlockData = {
          id: baseId,
          blockType: 'comprehension-mcq',
          label: plan.label,
          tutoringBrief: plan.tutoringBrief,
          transitionCue: plan.transitionCue,
          question: data.question,
          options: [data.option0, data.option1, data.option2, data.option3],
          correctIndex,
          explanation: data.explanation,
          evidenceAnchor,
        };
        return block;
      }

      case 'evidence-highlight': {
        const response = await ai.models.generateContent({
          model: 'gemini-flash-lite-latest',
          contents: `Generate an evidence-highlight block for a ${gradeLevel} lesson on "${topic}".

Brief: ${plan.brief}${passageContext}

Pick a CLAIM about the passage. Then produce 3–4 candidate phrases — verbatim quotes from the passage. At least 1 must support the claim (isEvidence: true). Include 1–2 distractors that are passage text but don't support the claim (isEvidence: false).
Each candidate gets a short rationale explaining why it does or doesn't support the claim.`,
          config: { responseMimeType: 'application/json', responseSchema: EVIDENCE_HIGHLIGHT_SCHEMA },
        });
        const data = JSON.parse(response.text || '{}');

        const candidateSpans: EvidenceHighlightBlockData['candidateSpans'] = [];
        for (let i = 0; i < 4; i++) {
          const quote = data[`candidate${i}Quote`];
          if (!quote) continue;
          const span = resolveQuote(stimulus.text, quote);
          if (!span) continue; // drop unresolvable quotes
          candidateSpans.push({
            span,
            isEvidence: !!data[`candidate${i}IsEvidence`],
            rationale: data[`candidate${i}Rationale`] ?? undefined,
          });
        }

        if (candidateSpans.length < 2) return null;

        const block: EvidenceHighlightBlockData = {
          id: baseId,
          blockType: 'evidence-highlight',
          label: plan.label,
          tutoringBrief: plan.tutoringBrief,
          transitionCue: plan.transitionCue,
          claim: data.claim,
          candidateSpans,
          minCorrect: data.minCorrect ?? 1,
          explanation: data.explanation,
        };
        return block;
      }

      case 'vocab-in-context': {
        const response = await ai.models.generateContent({
          model: 'gemini-flash-lite-latest',
          contents: `Generate a vocab-in-context block for a ${gradeLevel} lesson.

Brief: ${plan.brief}${passageContext}

Pick a word that appears VERBATIM in the passage. Generate 3–4 plausible meanings. Only ONE fits the passage's context. Distractors should be real meanings of the word in OTHER contexts (this is what makes the question hard — the student must use context, not vocabulary memorization).`,
          config: { responseMimeType: 'application/json', responseSchema: VOCAB_IN_CONTEXT_SCHEMA },
        });
        const data = JSON.parse(response.text || '{}');
        const targetAnchor = resolveQuote(stimulus.text, data.word);
        if (!targetAnchor) return null;
        const meanings = [data.meaning0, data.meaning1, data.meaning2];
        if (data.meaning3) meanings.push(data.meaning3);
        const correctIndex = Math.max(0, Math.min(meanings.length - 1, Math.round(data.correctIndex)));
        const block: VocabInContextBlockData = {
          id: baseId,
          blockType: 'vocab-in-context',
          label: plan.label,
          tutoringBrief: plan.tutoringBrief,
          transitionCue: plan.transitionCue,
          word: data.word,
          targetAnchor,
          meanings,
          correctIndex,
          explanation: data.explanation,
        };
        return block;
      }

      case 'inference-builder': {
        const response = await ai.models.generateContent({
          model: 'gemini-flash-lite-latest',
          contents: `Generate an inference-builder block for a ${gradeLevel} lesson.

Brief: ${plan.brief}${passageContext}

Ask a question that requires reading between the lines. Provide 3–4 candidate inferences (candidate0..candidate3). ONE is the best-supported inference; the others are plausible but weaker (over-stated, under-stated, or unsupported by the passage).
Set correctIndex (0-based) to the best inference. Provide a single correctEvidenceQuote — a verbatim phrase from the passage that supports the correct inference.
The explanation should cover both why the correct inference is best-supported AND why the distractors fall short.`,
          config: { responseMimeType: 'application/json', responseSchema: INFERENCE_BUILDER_SCHEMA },
        });
        const data = JSON.parse(response.text || '{}');

        const inferences: string[] = [data.candidate0, data.candidate1, data.candidate2];
        if (data.candidate3) inferences.push(data.candidate3);
        const filtered = inferences.filter((s): s is string => typeof s === 'string' && s.length > 0);
        if (filtered.length < 3) return null;

        const correctIndex = Math.max(0, Math.min(filtered.length - 1, Math.round(data.correctIndex)));
        const correctAnchor = data.correctEvidenceQuote
          ? resolveQuote(stimulus.text, data.correctEvidenceQuote) ?? undefined
          : undefined;

        const candidates: InferenceBuilderBlockData['candidates'] = filtered.map((inference, i) => ({
          inference,
          evidenceAnchor: i === correctIndex ? correctAnchor : undefined,
          rationale: '',
        }));

        const block: InferenceBuilderBlockData = {
          id: baseId,
          blockType: 'inference-builder',
          label: plan.label,
          tutoringBrief: plan.tutoringBrief,
          transitionCue: plan.transitionCue,
          question: data.question,
          candidates,
          correctIndex,
          explanation: data.explanation,
        };
        return block;
      }

      case 'theme-statement': {
        const response = await ai.models.generateContent({
          model: 'gemini-flash-lite-latest',
          contents: `Generate a theme-statement open-response block for a ${gradeLevel} lesson.

Brief: ${plan.brief}${passageContext}

Write a prompt asking the student to articulate the theme/main idea in 1–3 sentences.
Author 3 rubric criteria, each with a label, description, and weight (1–3). Total weights should be ~6.
Author an exemplar — a strong 2–3 sentence response that would score full marks.
Set minLength (default 30) and maxLength (default 500) characters.`,
          config: { responseMimeType: 'application/json', responseSchema: THEME_STATEMENT_SCHEMA },
        });
        const data = JSON.parse(response.text || '{}');
        const rubric: ThemeRubricCriterion[] = [];
        for (let i = 0; i < 3; i++) {
          const label = data[`rubric${i}Label`];
          const desc = data[`rubric${i}Description`];
          const weight = data[`rubric${i}Weight`];
          if (label && desc && typeof weight === 'number') {
            rubric.push({ label, description: desc, weight: Math.max(1, Math.min(3, Math.round(weight))) });
          }
        }
        if (rubric.length < 2) return null;
        const block: ThemeStatementBlockData = {
          id: baseId,
          blockType: 'theme-statement',
          label: plan.label,
          tutoringBrief: plan.tutoringBrief,
          transitionCue: plan.transitionCue,
          prompt: data.prompt,
          rubric,
          exemplar: data.exemplar,
          minLength: data.minLength ?? 30,
          maxLength: data.maxLength ?? 500,
        };
        return block;
      }

      default:
        console.warn(`[PassageStudio] Unknown block type: ${plan.blockType}`);
        return null;
    }
  } catch (error) {
    console.error(`[PassageStudio] Failed to generate block ${index} (${plan.blockType}):`, error);
    return null;
  }
}

// ═══════════════════════════════════════════════════════════════════════
// Main export
// ═══════════════════════════════════════════════════════════════════════

export async function generatePassageStudio(
  topic: string,
  gradeLevel: string,
  config?: Partial<{ targetEvalMode?: string; layoutOverride?: PassageLayout }>,
): Promise<PassageStudioData> {
  const evalMode = config?.targetEvalMode;
  const layoutOverride = config?.layoutOverride;

  const totalStart = Date.now();
  console.log(`[PassageStudio] Orchestrating "${topic}" (grade: ${gradeLevel}, eval: ${evalMode || 'default'})`);

  // Stage 1: Orchestrator
  const orchStart = Date.now();
  const plan = await runOrchestrator(topic, gradeLevel, evalMode);
  const orchSec = ((Date.now() - orchStart) / 1000).toFixed(1);

  // Resolve stimulus kind + layout
  const stimulusKind: PassageStimulus['kind'] = VALID_STIMULUS_KINDS.has(plan.stimulusKind)
    ? plan.stimulusKind
    : 'prose';
  const layout: PassageLayout = layoutOverride && VALID_LAYOUTS.has(layoutOverride)
    ? layoutOverride
    : VALID_LAYOUTS.has(plan.layout as PassageLayout) ? (plan.layout as PassageLayout) : 'stack';

  console.log(`[PassageStudio] Plan ready in ${orchSec}s — ${plan.blocks.length} blocks (layout: ${layout}, stimulus: ${stimulusKind})`);
  console.log(`[PassageStudio] Block sequence: ${plan.blocks.map((b, i) => `${i}=${b.blockType}`).join(', ')}`);

  // Stimulus content was generated inline by the orchestrator — just extract it.
  const stimulus = extractStimulus(plan, stimulusKind, topic);
  console.log(`[PassageStudio] Stimulus: ${stimulusKind}, ${stimulus.text.length} chars${'lines' in stimulus ? `, ${stimulus.lines.length} lines` : ''}${'turns' in stimulus ? `, ${stimulus.turns.length} turns` : ''}${'sentences' in stimulus ? `, ${stimulus.sentences.length} sentences` : ''}`);

  // Stage 2: Parallel block hydration with per-block timing
  const blockPromises = plan.blocks.map(async (bp, i) => {
    const tag = `block ${i} (${bp.blockType})`;
    const start = Date.now();
    console.log(`[PassageStudio]  ▶ ${tag} — "${bp.label}"`);
    const block = await generateBlock(bp, i, stimulus, topic, gradeLevel);
    const sec = ((Date.now() - start) / 1000).toFixed(1);
    if (block) {
      console.log(`[PassageStudio]  ✓ ${tag} done in ${sec}s`);
    } else {
      console.warn(`[PassageStudio]  ✗ ${tag} returned null after ${sec}s`);
    }
    return block;
  });
  const generatedBlocks = await Promise.all(blockPromises);
  const validBlocks = generatedBlocks.filter((b): b is PassageBlock => b !== null);

  const rejected = generatedBlocks.length - validBlocks.length;
  if (rejected > 0) {
    console.warn(`[PassageStudio] ${rejected} block(s) failed and were filtered out`);
  }

  const totalSec = ((Date.now() - totalStart) / 1000).toFixed(1);
  console.log(`[PassageStudio] Done in ${totalSec}s (${validBlocks.length}/${plan.blocks.length} blocks valid)`);

  // Ensure at least one passage-display block exists for stack/reveal_beat layouts.
  // For split_passage / annotated_passage the layout pins the passage so it's optional.
  if (
    (layout === 'stack' || layout === 'reveal_beat') &&
    !validBlocks.some((b) => b.blockType === 'passage-display')
  ) {
    validBlocks.unshift({
      id: 'block-passage',
      blockType: 'passage-display',
      label: 'The passage',
      tutoringBrief: 'Wait for the student to finish reading before discussing.',
      showAttribution: true,
    });
  }

  if (validBlocks.length === 0) {
    throw new Error(`PassageStudio generated no valid blocks for "${topic}"`);
  }

  return {
    title: plan.title,
    subtitle: plan.subtitle,
    gradeLevel,
    stimulus,
    blocks: validBlocks,
    layout,
    narrativeArc: plan.narrativeArc,
  };
}
