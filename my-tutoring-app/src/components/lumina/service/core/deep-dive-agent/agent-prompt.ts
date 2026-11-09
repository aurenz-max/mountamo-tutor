/**
 * System prompt and non-block tools for the agentic DeepDive author.
 */

import { Type, type FunctionDeclaration } from '@google/genai';
import { lessonBounds, type LessonShape } from './lesson';
import { DEEP_DIVE_DISPLAYS, SECTION_FIELDS, tierModes } from './blocks';
import { displayPrompt } from '../../agent-kit/displays';
import type { DrawerOption } from './drawers';
import { displayMenuLine } from './displays';
import type { DisplayTemplate } from '../../gen-display/types';
import { MATH_WRITING_RULE } from '../../../utils/mathText';

export function buildAgentSystemPrompt(input: {
  topic: string;
  gradeLevel: string;
  intent?: string;
  evalMode?: string;
  preReader: boolean;
  /** Longest sentence for this reader, in words, when the grade is known. */
  sentenceLimit?: number;
  scopeSection: string;
  shapes: LessonShape[];
  templateHint?: string;
  softDeadlineSeconds: number;
  drawers: DrawerOption[];
  displays: DisplayTemplate[];
}): string {
  const bounds = lessonBounds(input.evalMode, input.preReader);
  const modes = tierModes(input.evalMode);
  const tierNotes = [
    modes.compareSort && 'compare-contrast points are pooled and sorted by the student',
    modes.timelineOrder && 'timeline events are shuffled and ordered by the student',
    modes.diagramLabel && 'diagram labels are dragged onto the picture by the student',
    modes.tablePattern && 'data tables carry a find-the-pattern question',
    modes.workedTry && 'worked examples carry a try step the student picks',
  ].filter(Boolean);

  return `You author ONE DeepDive lesson on "${input.topic}" for a ${input.gradeLevel}. A DeepDive is a full article on its topic, like a good encyclopedia entry written for this student: a vertical scroll of sections, each made of blocks the student reads, explores and answers, with a tutor beside them.
${input.intent ? `\nThis lesson's job: ${input.intent}\n` : ''}${input.scopeSection}
You work with tools. Every write returns the block as the student will see it plus code checks. Read every result and fix what is wrong before you finish.

## What a good DeepDive is
- It covers the topic. Before writing, ask what a ${input.gradeLevel} needs to know to understand "${input.topic}"${input.intent ? ' for this lesson\'s job' : ''}: the what, the how or why, and what it connects to or changes. That becomes the outline: ${bounds.sections[0]}-${bounds.sections[1]} sections, each a subtopic heading with 1-3 key ideas stated as full sentences ("Chlorophyll breaks down when days get shorter", not "chlorophyll"). Leave out nothing a student would need to explain the topic to a friend; add nothing that is only trivia.
- An objective: what the student can do or explain after the whole lesson that they could not before.
- An arc, not a pile. Sections build on each other, and inside a section each block exists because the next one needs it: a check tests an idea a block above it taught; an explanation answers a question the lesson raised; nothing repeats what an earlier block already said.
- Every key idea is taught by at least one block, and every block names the ideas it teaches or tests ("ideas": ["2.1"]). Code checks this against the outline.
- The block type fits the job. A diagram when where parts sit is the idea, a figure when seeing it teaches it (how it moves, what it looks like, a cut-away, a before and after), a mini-sim for "what happens if", a table when exact numbers are the evidence, a chart when the shape of the numbers is (a trend, a comparison, parts of a whole), a number line when where numbers sit is the idea (order, distance, fractions, negatives, an inequality), a definition for a term the rest of the lesson depends on, a passage when the student must read a real text closely (a primary source, a poem, a letter), a worked example when how to solve is the idea (follow it with a check on a new problem, never the same one), a timeline when dated events are in order, a process when stages follow each other from a start to an end (a cycle that loops back is the cycle wheel display), a misconception callout when students at this grade really believe something false about the topic, perspectives when who tells it changes the story, prose for why, key facts for quick concrete facts. Do not use a block type only for variety.
- Checks teach. Distractors are the errors a real student at this grade makes. Never reveal an answer in a label, a question, or a block placed right before the check that states it in the same words; the student should have to understand, not match words.
- Facts are correct and specific: real numbers, real names, real dates.${input.preReader ? '' : `
- Math is typeset. ${MATH_WRITING_RULE} This holds in every field: prose, facts, table cells, questions, options, explanations, headings. Code checks every expression renders.`}
- Words fit the reader. ${input.preReader ? 'This student CANNOT READ: the tutor reads everything aloud and pictures carry the meaning. Every question is one short sentence; every option is 1-4 words with an emoji.' : input.sentenceLimit ? `Every sentence the student reads is at most ${input.sentenceLimit} words, including options, captions and explanations; code counts them. Use the everyday word when one exists and explain each new term the first time it appears.` : 'Sentences carry one or two ideas; explain each new term the first time it appears.'}

## This lesson's size
${bounds.sections[0]}-${bounds.sections[1]} sections of ${bounds.perSection[0]}-${bounds.perSection[1]} blocks each, at most ${bounds.maxBlocks} blocks, at least ${bounds.checks} evaluable, spread across the sections (multiple-choice, fill-in-blank, mini-sim, perspectives, hypothesis-lab${tierNotes.length ? ', worked-example' : ''}${tierNotes.length ? ', and at this level also compare-contrast, timeline, diagram and data-table as described' : ''}).${tierNotes.length ? `\nAt this level: ${tierNotes.join('; ')}.` : ''}

## Lesson shape
Code drew these shapes for this run. Choose the one that best fits the topic and the job, and build the arc it describes. If none fits, choose "own" and describe your arc in plan_lesson.
${input.shapes.map((s) => `- ${s.id}: ${s.move} Fits: ${s.fits}. Opens with: ${s.opens.join(' or ')}.`).join('\n')}
The shape sets how the lesson opens and moves; the outline sets what it covers. Code checks that the first block is one the chosen shape opens with. A hero image is optional; most lessons do not need one.
${input.templateHint ? `\n${input.templateHint}\n` : ''}
## Pictures
A lesson that only tells is weaker than one that shows. Wherever seeing something would teach an idea, show it, and pick the cheapest thing that can:
1. Data, positions and dates: write_chart, write_number_line, write_data_table, write_timeline. Code draws them.
2. A picture one of these code-drawn displays can show: write_figure with display set to the JSON. You write a few values and code draws it, so use one before drawing the same thing yourself.
${displayPrompt(DEEP_DIVE_DISPLAYS)}
3. Anything else you can draw with shapes: write_diagram or write_figure with svg. You draw it, and the next result shows you a screenshot exactly as the student will see it.
4. Only when it must look real (a painting, a photograph of a place): the image model (write_hero_image, or imagePrompt on a diagram). It costs about ten times as much, and you never see the result.
Look at each screenshot. Is every part drawn and clearly separate, would this student recognize it, does each numbered pin sit on its part, is any labelled part drawn twice so that a right answer could land on the wrong copy, is anything false or cut off? If something is wrong, rewrite that block (replaceIndex). If it is right, leave it.

${input.drawers.length ? `## Embedded displays (embed_primitive)
These are interactive displays from the lesson catalog. You give the id and what it must show for this lesson; its own generator builds it, code checks every number in it, and the result shows you what the student will see. It is a section like any other: place it where the arc needs it and build the next block on what it showed. Use one when the idea has that display's shape and it shows the idea better than prose or key facts would. Most topics have at least one idea with such a shape (a chain of causes, a cycle, sizes across scales, then and now, parts of a whole, different points of view); look for it before you write prose about it. Displays are ungraded, so the checks stay yours. At most 2 per lesson, never two of the same id.
${input.drawers.map((d) => `- ${d.id}: ${d.description}${d.constraints ? ` Limits: ${d.constraints}` : ''}`).join('\n')}

` : ''}${input.displays.length ? `## Built displays (use_display)
Interactive displays already built and tested for topics like this one. Reuse one by giving it this lesson's params (use_display); the display is the same, only its numbers, words and cases change. Use one only when it shows an idea in your outline; the same limits as embedded displays apply (ungraded, at most 2).
${input.displays.map(displayMenuLine).join('\n')}

` : ''}${input.preReader ? '' : `## When no display fits (request_display)
If an idea in your outline needs something the student moves to see it (a model, a simulation, a graph they change) and no block, embedded display or built display can show it, call request_display describing it. It is built later for future lessons; for this lesson, teach the idea with the blocks you have.

`}${input.preReader ? '' : `## See also (add_see_also)
2-4 related questions a curious student might want to open next, like the "See also" list at the end of an encyclopedia article: each a short label and the question it opens. They go past this lesson (a neighbouring idea, a cause, a consequence, a famous case), not back over it, and never ask or answer a check in the lesson. When the student opens one, new sections answering it are built below the lesson.

`}## Layout (plan_lesson.layout)
stack (default, linear narrative); grid_2col (blocks that pair up, comparison); reveal_progressive (each block appears after the student finishes the one before; for misconception repair or guided reasoning); masonry (many small self-contained blocks, 5+).

## How to work quickly
You have about ${input.softDeadlineSeconds} seconds. Call several tools in the same turn whenever they do not depend on each other.
1. Decide the outline, the objective, the shape and the arc. Call plan_lesson, and in the same turn write EVERY block in order with the write_*${input.drawers.length ? ' and embed_primitive' : ''} tools${input.preReader ? '' : ' and call add_see_also'}.
2. Read the results. Fix every blocking issue with write_* (replaceIndex) or remove_block.
3. Before finish, read the lesson top to bottom as the student would: does it cover the topic, so the student could explain it to a friend? Can every check be answered from what is above it, without giving it away? Does each block move the lesson forward? Fix what fails.
4. Call finish. If it reports blocking issues, fix them and call finish again.`;
}

const LESSON_TOOLS: FunctionDeclaration[] = [
  {
    name: 'plan_lesson',
    description: 'Set (or replace) the lesson frame. Blocks already written are kept.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        objective: { type: Type.STRING, description: 'What the student can do or explain after this lesson, one sentence.' },
        shape: { type: Type.STRING, description: 'The id of the chosen shape, or "own".' },
        shapeReason: { type: Type.STRING, description: 'One sentence: why this shape fits this topic.' },
        title: { type: Type.STRING, description: 'Lesson title; inviting, not a question whose answer is a check.' },
        subtitle: { type: Type.STRING, description: 'One sentence on the scope.' },
        narrativeArc: { type: Type.STRING, description: '2-3 sentences: how the sections build to the objective. The tutor reads this.' },
        sections: {
          type: Type.ARRAY, description: 'The outline, in order. Blocks refer to section n (1-based) and idea "n.m".',
          items: {
            type: Type.OBJECT,
            properties: {
              heading: { type: Type.STRING, description: 'Section heading the student sees, 2-6 words. Never names the answer to a check.' },
              ideas: { type: Type.ARRAY, items: { type: Type.STRING }, description: '1-3 key ideas, each a full sentence this section must teach.' },
            },
            required: ['heading', 'ideas'],
          },
        },
        layout: { type: Type.STRING, enum: ['stack', 'grid_2col', 'reveal_progressive', 'masonry'] },
      },
      required: ['objective', 'shape', 'shapeReason', 'title', 'subtitle', 'narrativeArc', 'sections', 'layout'],
    },
  },
  {
    name: 'remove_block',
    description: 'Remove the block at index (0-based). Later blocks shift down.',
    parameters: { type: Type.OBJECT, properties: { index: { type: Type.INTEGER } }, required: ['index'] },
  },
  {
    name: 'move_block',
    description: 'Move the block at index from to index to (0-based).',
    parameters: { type: Type.OBJECT, properties: { from: { type: Type.INTEGER }, to: { type: Type.INTEGER } }, required: ['from', 'to'] },
  },
  {
    name: 'finish',
    description: 'Submit the lesson. Runs the final checks. Returns blocking issues if any; otherwise the lesson ships.',
    parameters: { type: Type.OBJECT, properties: {} },
  },
];

const COMMON_FIELDS = {
  label: { type: Type.STRING, description: 'Short section heading. Never names the answer to a check.' },
  tutoringBrief: { type: Type.STRING, description: 'One sentence: what the tutor says or does while the student is on this section.' },
  transitionCue: { type: Type.STRING, description: 'One short sentence linking this section to the next.' },
  replaceIndex: { type: Type.INTEGER, nullable: true, description: 'Omit to append. Set to a 0-based index to replace that block in place.' },
  ...SECTION_FIELDS,
};

/** The frame tools, plus embed_primitive when this audience has drawers and add_see_also for readers. */
export function lessonTools(drawers: DrawerOption[], preReader: boolean, displays: DisplayTemplate[] = []): FunctionDeclaration[] {
  const tools = [...LESSON_TOOLS];
  if (drawers.length) {
    tools.push({
      name: 'embed_primitive',
      description: 'Place an interactive display from the catalog as a section. Its generator builds it (a few seconds); the result shows what the student will see, or why it could not be built.',
      parameters: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.STRING, enum: drawers.map((d) => d.id) },
          intent: { type: Type.STRING, description: 'What this display must show for this lesson: the case, the quantities or parts, and the one idea the student should see. 1-3 sentences.' },
          ...COMMON_FIELDS,
        },
        required: ['id', 'intent', 'label', 'tutoringBrief', 'transitionCue', 'section', 'ideas'],
      },
    });
  }
  if (displays.length) {
    tools.push({
      name: 'use_display',
      description: 'Place a built display as a section, with params for this lesson. Params you leave out keep the validated value.',
      parameters: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.STRING, enum: displays.map((d) => d.id) },
          params: {
            type: Type.ARRAY, description: 'The params to set for this lesson.',
            items: { type: Type.OBJECT, properties: { name: { type: Type.STRING }, valueJson: { type: Type.STRING, description: 'The value as JSON: 3, "Mars", [1,2].' } }, required: ['name', 'valueJson'] },
          },
          ...COMMON_FIELDS,
        },
        required: ['id', 'params', 'label', 'tutoringBrief', 'transitionCue', 'section', 'ideas'],
      },
    });
  }
  if (!preReader) {
    tools.push({
      name: 'request_display',
      description: 'Ask for an interactive display the library lacks. It is built later; it does not appear in this lesson.',
      parameters: {
        type: Type.OBJECT,
        properties: {
          idea: { type: Type.STRING, description: 'The idea it must show, one sentence, general enough for other lessons.' },
          interaction: { type: Type.STRING, description: 'What the student moves or does, and what changes.' },
          why: { type: Type.STRING, description: 'Why no block or display in this lesson can show it.' },
        },
        required: ['idea', 'interaction', 'why'],
      },
    });
  }
  if (!preReader) {
    tools.push({
      name: 'add_see_also',
      description: 'Set (or replace) the See also links shown under the lesson.',
      parameters: {
        type: Type.OBJECT,
        properties: {
          links: {
            type: Type.ARRAY, description: '2-4 links.',
            items: {
              type: Type.OBJECT,
              properties: {
                label: { type: Type.STRING, description: 'The link text, 2-6 words, e.g. "Why some trees stay green".' },
                question: { type: Type.STRING, description: 'The question it opens, as the student would ask it.' },
              },
              required: ['label', 'question'],
            },
          },
        },
        required: ['links'],
      },
    });
  }
  return tools;
}
