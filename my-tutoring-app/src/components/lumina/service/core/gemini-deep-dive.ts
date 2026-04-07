/**
 * DeepDive Orchestrator Generator
 *
 * Two-stage generation:
 * 1. ORCHESTRATOR (gemini-flash-lite-latest) — plans which blocks to use, in what order,
 *    with per-block briefs and tutoring instructions.
 * 2. PARALLEL BLOCK GENERATORS (gemini-flash-lite-latest) — each gets a tight brief
 *    and a fixed schema for its block type. Runs concurrently.
 *
 * Image blocks use gemini-flash-lite-latest-image for real AI-generated images.
 */

import { Type, Schema } from '@google/genai';
import { ai } from '../geminiClient';
import type {
  DeepDiveData,
  DeepDiveBlock,
  HeroImageBlockData,
  KeyFactsBlockData,
  DataTableBlockData,
  MultipleChoiceBlockData,
  PullQuoteBlockData,
  ProseBlockData,
  BlockType,
} from '../../primitives/visual-primitives/core/deep-dive/types';

// ═══════════════════════════════════════════════════════════════════════
// Stage 1: Orchestrator — plans the block layout
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
  blocks: OrchestratorBlockPlan[];
}

const ORCHESTRATOR_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    title: { type: Type.STRING, description: 'Engaging title for the deep dive' },
    subtitle: { type: Type.STRING, description: 'One-sentence subtitle explaining the scope' },
    narrativeArc: { type: Type.STRING, description: '2-3 sentences describing the learning journey from start to finish' },
    blocks: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          blockType: {
            type: Type.STRING,
            description: 'One of: hero-image, key-facts, data-table, multiple-choice, pull-quote, prose',
          },
          label: { type: Type.STRING, description: 'Short display label for this block (e.g. "Key Facts", "Quick Quiz")' },
          brief: { type: Type.STRING, description: 'Detailed content brief for the block generator. Be specific about what to include.' },
          tutoringBrief: { type: Type.STRING, description: 'What the AI tutor should do when the student is on this block' },
          transitionCue: { type: Type.STRING, description: 'How this block connects to the next one — narrative flow' },
        },
        required: ['blockType', 'label', 'brief', 'tutoringBrief', 'transitionCue'],
      },
    },
  },
  required: ['title', 'subtitle', 'narrativeArc', 'blocks'],
};

function buildOrchestratorPrompt(
  topic: string,
  gradeLevel: string,
  evalMode?: string,
): string {
  const evalGuidance = getEvalModeGuidance(evalMode);

  return `You are an expert learning experience designer. Plan a DeepDive lesson on "${topic}" for ${gradeLevel} students.

A DeepDive is a vertical scroll experience assembled from modular blocks. Your job is to plan which blocks to use, in what order, and write a content brief for each.

## Available Block Types (Phase 1)
- **hero-image**: An AI-generated image that anchors attention. Brief should describe the visual scene in detail.
- **key-facts**: 3-5 bullet-point facts with emoji icons. Quick knowledge transfer.
- **data-table**: Structured comparison or data table. Brief should specify headers and what data to include.
- **multiple-choice**: A comprehension question with 4 options and explanation. Brief should specify what concept to test and the difficulty level.
- **pull-quote**: An editorial highlight — 1-2 sentences that capture the most important insight from the surrounding content. The brief IS the quote text (pithy, not a paragraph). The label is the attribution source. No separate generation needed. Use pull quotes after display blocks to highlight key takeaways. Never place two pull quotes adjacent.
- **prose**: Explanatory narrative text — 2-4 paragraphs that explain *why* something matters, provide context, or connect structured blocks narratively. Brief should specify the explanatory focus and tone. Place between display blocks (e.g., KeyFacts → Prose → DataTable) to create reading flow. Never place two prose blocks adjacent. Optionally include a figure by mentioning "include a figure of [description]" in the brief. Layout options: mention "masonry layout" in the brief for card-grid style (best with 3-4+ short paragraphs, e.g., fun facts, multiple perspectives, comparisons). Mention "reveal animation" for text that animates in line-by-line on scroll (great for dramatic or climactic content). Mention "columns layout" to force newspaper-style multi-column text.

## Rules
1. Start with a hero-image to anchor the topic visually.
2. Place display blocks (key-facts, data-table) BEFORE the MC questions that reference them.
3. Each MC question should test comprehension of a specific display block above it.
4. The brief for each block must be detailed enough that a separate AI can generate the content without seeing the other blocks.
5. Include the topic name and grade level context in each brief.
6. Tutoring briefs describe what the AI tutor should SAY when the student reaches this block.
7. Transition cues create narrative flow between blocks.
8. IMPORTANT: Use ALL available block types for visual and cognitive variety. Every lesson MUST include at least one prose block and at least one pull-quote block. Never produce a lesson using only hero-image, key-facts, data-table, and multiple-choice.

${evalGuidance}

Plan the blocks now. Make each brief specific and detailed.`;
}

function getEvalModeGuidance(evalMode?: string): string {
  switch (evalMode) {
    case 'explore':
      return `## Eval Mode: EXPLORE (easy)
Favor display blocks. Include at most 1-2 easy MC questions. 5-6 blocks total.
MC questions should test basic recall of directly stated facts.
Use prose blocks to explain concepts narratively. Use pull-quote blocks after display blocks to highlight key insights.`;
    case 'recall':
      return `## Eval Mode: RECALL (medium-easy)
Mix of display and MC blocks. Include 2-3 MC questions testing direct recall.
6-7 blocks total.
Use prose blocks between display blocks for narrative flow. Use pull-quote blocks to highlight key takeaways.`;
    case 'apply':
      return `## Eval Mode: APPLY (medium-hard)
Include a data-table and MC questions that require cross-referencing data.
7-8 blocks total. MC questions should require multi-step reasoning.
Use prose blocks to explain context before data tables. Use pull-quote blocks to highlight important relationships.`;
    case 'analyze':
      return `## Eval Mode: ANALYZE (hard)
Include 3-4 challenging MC questions requiring synthesis across blocks.
7-9 blocks total. Questions should test analysis, not just recall.
Use prose blocks to build narrative depth. Use pull-quote blocks to highlight key insights for synthesis.`;
    default:
      return `## Default Mode
Include a good mix of ALL block types: hero-image, key-facts, prose, pull-quote, data-table, and 2-3 MC questions.
Use prose blocks for narrative explanations between structured blocks. Use pull-quote blocks to highlight key insights.
6-8 blocks total.`;
  }
}

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
  if (!text) throw new Error('Orchestrator returned empty response');

  const plan: OrchestratorPlan = JSON.parse(text);

  // Validate: filter to only Phase 1 block types
  const validTypes = new Set<string>(['hero-image', 'key-facts', 'data-table', 'multiple-choice', 'pull-quote', 'prose']);
  plan.blocks = plan.blocks.filter((b) => validTypes.has(b.blockType));

  if (plan.blocks.length === 0) {
    throw new Error('Orchestrator produced no valid blocks');
  }

  return plan;
}

// ═══════════════════════════════════════════════════════════════════════
// Stage 2: Parallel Block Generators
// ═══════════════════════════════════════════════════════════════════════

// ── Image generation ────────────────────────────────────────────────

async function generateImage(prompt: string): Promise<string | null> {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: { parts: [{ text: prompt }] },
      config: {
        imageConfig: { aspectRatio: '16:9' },
      },
    });

    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
        return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
      }
    }
    return null;
  } catch (error) {
    console.error('[DeepDive] Image generation failed:', error);
    return null;
  }
}

// ── Key Facts generator ─────────────────────────────────────────────

const KEY_FACTS_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    fact0Icon: { type: Type.STRING, description: 'Emoji icon for fact 1' },
    fact0Text: { type: Type.STRING, description: 'Fact 1 text' },
    fact1Icon: { type: Type.STRING, description: 'Emoji icon for fact 2' },
    fact1Text: { type: Type.STRING, description: 'Fact 2 text' },
    fact2Icon: { type: Type.STRING, description: 'Emoji icon for fact 3' },
    fact2Text: { type: Type.STRING, description: 'Fact 3 text' },
    fact3Icon: { type: Type.STRING, description: 'Emoji icon for fact 4 (optional)', nullable: true },
    fact3Text: { type: Type.STRING, description: 'Fact 4 text (optional)', nullable: true },
    fact4Icon: { type: Type.STRING, description: 'Emoji icon for fact 5 (optional)', nullable: true },
    fact4Text: { type: Type.STRING, description: 'Fact 5 text (optional)', nullable: true },
  },
  required: ['fact0Icon', 'fact0Text', 'fact1Icon', 'fact1Text', 'fact2Icon', 'fact2Text'],
};

async function generateKeyFacts(brief: string, topic: string, gradeLevel: string): Promise<KeyFactsBlockData['facts']> {
  const response = await ai.models.generateContent({
    model: 'gemini-flash-lite-latest',
    contents: `Generate key facts for a ${gradeLevel} lesson on "${topic}".

Brief: ${brief}

Generate 3-5 facts. Each fact should be a clear, memorable statement with an appropriate emoji icon.
Keep facts concise (1-2 sentences max). Use age-appropriate vocabulary for ${gradeLevel}.`,
    config: {
      responseMimeType: 'application/json',
      responseSchema: KEY_FACTS_SCHEMA,
    },
  });

  const text = response.text;
  if (!text) return [{ icon: '\u2139\uFE0F', text: `Key fact about ${topic}` }];

  const data = JSON.parse(text);
  const facts: KeyFactsBlockData['facts'] = [];

  for (let i = 0; i < 5; i++) {
    const icon = data[`fact${i}Icon`];
    const factText = data[`fact${i}Text`];
    if (icon && factText) {
      facts.push({ icon, text: factText });
    }
  }

  return facts.length > 0 ? facts : [{ icon: '\u2139\uFE0F', text: `Key fact about ${topic}` }];
}

// ── Data Table generator ────────────────────────────────────────────

const DATA_TABLE_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    caption: { type: Type.STRING, description: 'Brief caption for the table' },
    header0: { type: Type.STRING, description: 'Column 1 header' },
    header1: { type: Type.STRING, description: 'Column 2 header' },
    header2: { type: Type.STRING, description: 'Column 3 header', nullable: true },
    header3: { type: Type.STRING, description: 'Column 4 header', nullable: true },
    // Up to 6 rows with up to 4 columns each (flat)
    row0col0: { type: Type.STRING }, row0col1: { type: Type.STRING },
    row0col2: { type: Type.STRING, nullable: true }, row0col3: { type: Type.STRING, nullable: true },
    row1col0: { type: Type.STRING }, row1col1: { type: Type.STRING },
    row1col2: { type: Type.STRING, nullable: true }, row1col3: { type: Type.STRING, nullable: true },
    row2col0: { type: Type.STRING }, row2col1: { type: Type.STRING },
    row2col2: { type: Type.STRING, nullable: true }, row2col3: { type: Type.STRING, nullable: true },
    row3col0: { type: Type.STRING, nullable: true }, row3col1: { type: Type.STRING, nullable: true },
    row3col2: { type: Type.STRING, nullable: true }, row3col3: { type: Type.STRING, nullable: true },
    row4col0: { type: Type.STRING, nullable: true }, row4col1: { type: Type.STRING, nullable: true },
    row4col2: { type: Type.STRING, nullable: true }, row4col3: { type: Type.STRING, nullable: true },
    row5col0: { type: Type.STRING, nullable: true }, row5col1: { type: Type.STRING, nullable: true },
    row5col2: { type: Type.STRING, nullable: true }, row5col3: { type: Type.STRING, nullable: true },
  },
  required: [
    'caption', 'header0', 'header1',
    'row0col0', 'row0col1', 'row1col0', 'row1col1', 'row2col0', 'row2col1',
  ],
};

async function generateDataTable(
  brief: string,
  topic: string,
  gradeLevel: string,
): Promise<{ headers: string[]; rows: string[][]; caption: string }> {
  const response = await ai.models.generateContent({
    model: 'gemini-flash-lite-latest',
    contents: `Generate a data table for a ${gradeLevel} lesson on "${topic}".

Brief: ${brief}

Generate a table with 2-4 columns and 3-6 rows. The data should be factually accurate and educational.
Use age-appropriate language for ${gradeLevel}.`,
    config: {
      responseMimeType: 'application/json',
      responseSchema: DATA_TABLE_SCHEMA,
    },
  });

  const text = response.text;
  if (!text) {
    return {
      headers: ['Item', 'Detail'],
      rows: [['(data)', '(unavailable)']],
      caption: `Table about ${topic}`,
    };
  }

  const data = JSON.parse(text);

  // Reconstruct headers
  const headers: string[] = [data.header0, data.header1];
  if (data.header2) headers.push(data.header2);
  if (data.header3) headers.push(data.header3);

  // Reconstruct rows
  const colCount = headers.length;
  const rows: string[][] = [];
  for (let r = 0; r < 6; r++) {
    const col0 = data[`row${r}col0`];
    if (!col0) break;
    const row: string[] = [col0];
    for (let c = 1; c < colCount; c++) {
      row.push(data[`row${r}col${c}`] || '');
    }
    rows.push(row);
  }

  return {
    headers,
    rows: rows.length > 0 ? rows : [['(data)', '(unavailable)']],
    caption: data.caption || `Table about ${topic}`,
  };
}

// ── Multiple Choice generator ───────────────────────────────────────

const MC_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    question: { type: Type.STRING, description: 'The question text' },
    option0: { type: Type.STRING, description: 'Option A' },
    option1: { type: Type.STRING, description: 'Option B' },
    option2: { type: Type.STRING, description: 'Option C' },
    option3: { type: Type.STRING, description: 'Option D' },
    correctIndex: { type: Type.NUMBER, description: 'Index of the correct option (0-3)' },
    explanation: { type: Type.STRING, description: 'Explanation of why the correct answer is right (2-3 sentences)' },
  },
  required: ['question', 'option0', 'option1', 'option2', 'option3', 'correctIndex', 'explanation'],
};

async function generateMultipleChoice(
  brief: string,
  topic: string,
  gradeLevel: string,
): Promise<{ question: string; options: string[]; correctIndex: number; explanation: string }> {
  const response = await ai.models.generateContent({
    model: 'gemini-flash-lite-latest',
    contents: `Generate a multiple choice question for a ${gradeLevel} lesson on "${topic}".

Brief: ${brief}

Generate exactly 4 options. Make distractors plausible but clearly wrong.
The explanation should teach, not just state the correct answer.
Use age-appropriate language for ${gradeLevel}.
IMPORTANT: Do NOT make the correct answer obvious from its position or length.`,
    config: {
      responseMimeType: 'application/json',
      responseSchema: MC_SCHEMA,
    },
  });

  const text = response.text;
  if (!text) {
    return {
      question: `Question about ${topic}`,
      options: ['Option A', 'Option B', 'Option C', 'Option D'],
      correctIndex: 0,
      explanation: 'Unable to generate explanation.',
    };
  }

  const data = JSON.parse(text);

  // Validate correctIndex
  const correctIndex = Math.max(0, Math.min(3, Math.round(data.correctIndex)));

  return {
    question: data.question,
    options: [data.option0, data.option1, data.option2, data.option3],
    correctIndex,
    explanation: data.explanation,
  };
}

// ── Prose generator ───────────────────────────────────────────────────

const PROSE_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    paragraph0: { type: Type.STRING, description: 'First paragraph' },
    paragraph1: { type: Type.STRING, description: 'Second paragraph' },
    paragraph2: { type: Type.STRING, description: 'Third paragraph (optional)', nullable: true },
    paragraph3: { type: Type.STRING, description: 'Fourth paragraph (optional)', nullable: true },
    figureCaption: { type: Type.STRING, description: 'Caption for optional inline figure', nullable: true },
    figureAltText: { type: Type.STRING, description: 'Alt text for optional inline figure', nullable: true },
    figurePlacement: { type: Type.STRING, description: 'Figure placement: left or right', nullable: true },
    figurePrompt: { type: Type.STRING, description: 'Detailed image generation prompt for the figure (only if the brief requests a figure)', nullable: true },
    layout: { type: Type.STRING, description: 'Layout mode: flow (default), masonry (card grid), or columns (newspaper). Only set if the brief requests a specific layout.', nullable: true },
    reveal: { type: Type.BOOLEAN, description: 'Whether to animate text appearing line-by-line on scroll. Only true if the brief requests reveal animation.', nullable: true },
  },
  required: ['paragraph0', 'paragraph1'],
};

async function generateProse(
  brief: string,
  topic: string,
  gradeLevel: string,
): Promise<{
  paragraphs: string[];
  figure?: { imageBase64: string; caption: string; altText: string; placement: 'left' | 'right' };
  layout?: 'flow' | 'masonry' | 'columns';
  reveal?: boolean;
}> {
  const wantsFigure = /figure|image|illustration|picture|visual/i.test(brief);
  const wantsMasonry = /masonry/i.test(brief);
  const wantsColumns = /columns?\s+layout/i.test(brief);
  const wantsReveal = /reveal\s+anim/i.test(brief);

  const layoutHint = wantsMasonry
    ? '\n\nThe brief requests masonry layout. Write 3-4+ SHORT paragraphs (1-2 sentences each) — each becomes a card in a masonry grid. Make each paragraph a self-contained point, fact, or perspective.'
    : wantsColumns
      ? '\n\nThe brief requests columns layout. Write 2-3 longer paragraphs — they will be split into newspaper-style columns.'
      : '';

  const response = await ai.models.generateContent({
    model: 'gemini-flash-lite-latest',
    contents: `Write explanatory narrative prose for a ${gradeLevel} lesson on "${topic}".

Brief: ${brief}

Write 2-3 paragraphs of clear, engaging explanatory text. Use age-appropriate vocabulary for ${gradeLevel}.
Write in an editorial, article-like tone — not bullet points, not a textbook. Explain *why* things matter, not just *what* they are.
Each paragraph should be 2-4 sentences.${wantsFigure ? '\n\nThe brief requests a figure. Provide a figureCaption, figureAltText, figurePlacement (left or right), and a figurePrompt describing the image to generate.' : ''}${layoutHint}`,
    config: {
      responseMimeType: 'application/json',
      responseSchema: PROSE_SCHEMA,
    },
  });

  const text = response.text;
  if (!text) {
    return { paragraphs: [`Learn more about ${topic}.`] };
  }

  const data = JSON.parse(text);

  // Reconstruct paragraphs
  const paragraphs: string[] = [];
  for (let i = 0; i < 4; i++) {
    const p = data[`paragraph${i}`];
    if (p) paragraphs.push(p);
  }

  if (paragraphs.length === 0) {
    return { paragraphs: [`Learn more about ${topic}.`] };
  }

  // Generate figure image if requested and prompt provided
  let figure: { imageBase64: string; caption: string; altText: string; placement: 'left' | 'right' } | undefined;
  if (wantsFigure && data.figurePrompt) {
    const figureImage = await generateImage(
      `Educational illustration for ${gradeLevel} students: ${data.figurePrompt}. Clean, informative, no text overlays.`,
    );
    if (figureImage) {
      figure = {
        imageBase64: figureImage,
        caption: data.figureCaption || '',
        altText: data.figureAltText || `Illustration for ${topic}`,
        placement: data.figurePlacement === 'left' ? 'left' : 'right',
      };
    }
  }

  // Resolve layout mode
  const layoutVal = data.layout as string | undefined;
  const layout: 'flow' | 'masonry' | 'columns' | undefined =
    wantsMasonry || layoutVal === 'masonry' ? 'masonry'
    : wantsColumns || layoutVal === 'columns' ? 'columns'
    : undefined;

  const reveal = wantsReveal || data.reveal === true || undefined;

  return { paragraphs, figure, layout, reveal };
}

// ═══════════════════════════════════════════════════════════════════════
// Assembly: Orchestrate + Generate in Parallel
// ═══════════════════════════════════════════════════════════════════════

async function generateBlock(
  plan: OrchestratorBlockPlan,
  index: number,
  topic: string,
  gradeLevel: string,
): Promise<DeepDiveBlock | null> {
  const baseId = `block-${index}`;

  try {
    switch (plan.blockType as BlockType) {
      case 'hero-image': {
        const imagePrompt = `Educational illustration for ${gradeLevel} students: ${plan.brief}. Clean, professional, visually engaging. No text overlays.`;
        const imageBase64 = await generateImage(imagePrompt);
        return {
          id: baseId,
          blockType: 'hero-image',
          label: plan.label,
          tutoringBrief: plan.tutoringBrief,
          transitionCue: plan.transitionCue,
          imageBase64: imageBase64 || '',
          caption: plan.brief.slice(0, 200),
          altText: `Visual illustration for ${topic}`,
        } as HeroImageBlockData;
      }

      case 'key-facts': {
        const facts = await generateKeyFacts(plan.brief, topic, gradeLevel);
        return {
          id: baseId,
          blockType: 'key-facts',
          label: plan.label,
          tutoringBrief: plan.tutoringBrief,
          transitionCue: plan.transitionCue,
          facts,
        } as KeyFactsBlockData;
      }

      case 'data-table': {
        const tableData = await generateDataTable(plan.brief, topic, gradeLevel);
        return {
          id: baseId,
          blockType: 'data-table',
          label: plan.label,
          tutoringBrief: plan.tutoringBrief,
          transitionCue: plan.transitionCue,
          headers: tableData.headers,
          rows: tableData.rows,
          caption: tableData.caption,
        } as DataTableBlockData;
      }

      case 'pull-quote': {
        // No Gemini call — the orchestrator generates quote content inline
        return {
          id: baseId,
          blockType: 'pull-quote',
          label: plan.label,
          tutoringBrief: plan.tutoringBrief,
          transitionCue: plan.transitionCue,
          text: plan.brief,
          attribution: plan.label,
        } as PullQuoteBlockData;
      }

      case 'prose': {
        const proseData = await generateProse(plan.brief, topic, gradeLevel);
        return {
          id: baseId,
          blockType: 'prose',
          label: plan.label,
          tutoringBrief: plan.tutoringBrief,
          transitionCue: plan.transitionCue,
          paragraphs: proseData.paragraphs,
          figure: proseData.figure,
          layout: proseData.layout,
          reveal: proseData.reveal,
        } as ProseBlockData;
      }

      case 'multiple-choice': {
        const mcData = await generateMultipleChoice(plan.brief, topic, gradeLevel);
        return {
          id: baseId,
          blockType: 'multiple-choice',
          label: plan.label,
          tutoringBrief: plan.tutoringBrief,
          transitionCue: plan.transitionCue,
          question: mcData.question,
          options: mcData.options,
          correctIndex: mcData.correctIndex,
          explanation: mcData.explanation,
        } as MultipleChoiceBlockData;
      }

      default:
        console.warn(`[DeepDive] Unknown block type: ${plan.blockType}`);
        return null;
    }
  } catch (error) {
    console.error(`[DeepDive] Failed to generate block ${index} (${plan.blockType}):`, error);
    return null;
  }
}

// ═══════════════════════════════════════════════════════════════════════
// Main Export
// ═══════════════════════════════════════════════════════════════════════

export async function generateDeepDive(
  topic: string,
  gradeLevel: string,
  config?: Partial<{ targetEvalMode?: string }>,
): Promise<DeepDiveData> {
  const evalMode = config?.targetEvalMode;

  console.log(`[DeepDive] Starting orchestration for "${topic}" (grade: ${gradeLevel}, eval: ${evalMode || 'default'})`);

  // Stage 1: Orchestrator plans the blocks
  const plan = await runOrchestrator(topic, gradeLevel, evalMode);
  console.log(`[DeepDive] Orchestrator planned ${plan.blocks.length} blocks: ${plan.blocks.map((b) => b.blockType).join(', ')}`);

  // Stage 2: Generate all blocks in parallel
  const blockPromises = plan.blocks.map((blockPlan, index) =>
    generateBlock(blockPlan, index, topic, gradeLevel),
  );

  const generatedBlocks = await Promise.all(blockPromises);

  // Filter out failed blocks
  const validBlocks = generatedBlocks.filter((b): b is DeepDiveBlock => b !== null);

  const rejected = generatedBlocks.length - validBlocks.length;
  if (rejected > 0) {
    console.warn(`[DeepDive] ${rejected} block(s) failed generation and were filtered out`);
  }

  if (validBlocks.length === 0) {
    // Hardcoded fallback — should never happen but prevents empty render
    return {
      title: `Deep Dive: ${topic}`,
      subtitle: 'Content generation encountered an issue. Please try again.',
      topic,
      gradeLevel,
      blocks: [
        {
          id: 'fallback-0',
          blockType: 'key-facts',
          label: 'Key Facts',
          facts: [{ icon: '\u26A0\uFE0F', text: `We couldn't generate content for "${topic}". Please try again.` }],
        } as KeyFactsBlockData,
      ],
    };
  }

  console.log(`[DeepDive] Successfully assembled ${validBlocks.length} blocks`);

  return {
    title: plan.title,
    subtitle: plan.subtitle,
    topic,
    gradeLevel,
    narrativeArc: plan.narrativeArc,
    blocks: validBlocks,
  };
}
