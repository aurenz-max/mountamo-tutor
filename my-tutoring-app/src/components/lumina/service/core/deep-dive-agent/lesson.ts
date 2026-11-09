/**
 * Lesson-level pieces of the agentic DeepDive author: the lesson shapes code
 * offers each run, and the checks over the assembled lesson.
 *
 * Variety across runs is code-owned. Asked the same question, one model
 * converges on one arc (hero → key facts → prose → pull quote → quiz), so each
 * run is offered three shapes drawn at random from SHAPES and the agent picks
 * the one that fits the topic. Topic fit stays the agent's call.
 */

import type { BlockType, DeepDiveBlock, DeepDiveSection, DrawerBlockData, GenDisplayBlockData, SeeAlsoLink } from '../../../primitives/visual-primitives/core/deep-dive/types';
import { isEvaluableBlock } from '../../../primitives/visual-primitives/core/deep-dive/deepDiveWorkspace';
import { blockAnswer, blockIssues, norm, PRE_READER_BLOCKED, visibleText, type BlockContext } from './blocks';
import { mathIssues } from '../../../utils/mathText';

export interface LessonShape {
  id: string;
  /** How the lesson opens and how it builds; what the agent reads. */
  move: string;
  /** Topics it fits, so the agent can reject it. */
  fits: string;
  /** Block types the lesson may open with; code holds the agent to its chosen shape. */
  opens: BlockType[];
}

export const SHAPES: LessonShape[] = [
  { id: 'phenomenon-first', move: 'Open on something surprising the student can predict or notice (a mini-sim prediction, or a striking picture with a question). Then explain why it happens, then check the idea on a new case.', fits: 'science and causes; anything with a counterintuitive outcome', opens: ['mini-sim', 'figure', 'hero-image', 'pull-quote', 'multiple-choice'] },
  { id: 'story-first', move: 'Open with one person or one moment, told vividly (prose with reveal, perspectives or a short timeline). Pull the concept out of the story, then check it away from the story.', fits: 'history, biography, discoveries, inventions, literature', opens: ['prose', 'perspectives', 'timeline'] },
  { id: 'data-detective', move: 'Open with a table or comparison and let the student find the pattern before anyone names it. Then explain the pattern and why it holds, then check with a case the table did not show.', fits: 'anything with numbers, measurements, rankings or categories', opens: ['data-table', 'compare-contrast', 'drawer'] },
  { id: 'misconception-repair', move: 'Open by stating the common wrong idea as if it were true (pull quote or check). Show evidence that breaks it, explain the right idea, and end on a check the wrong idea would fail.', fits: 'topics with a well-known wrong belief (seasons, heavy things fall faster, plants eat soil)', opens: ['pull-quote', 'multiple-choice', 'mini-sim'] },
  { id: 'parts-to-whole', move: 'Open on the whole thing, then take it apart: the parts and what each does (diagram or key facts), then how they work together, then a check on one part\'s job in the whole.', fits: 'systems, structures, organisms, machines, places', opens: ['diagram', 'figure', 'hero-image', 'key-facts', 'drawer'] },
  { id: 'two-worlds', move: 'Build understanding of two things, then put them side by side (compare-contrast) as the centre of the lesson; end by applying the difference to a new example.', fits: 'any topic that is clearest against its contrast (city vs country, weather vs climate)', opens: ['figure', 'hero-image', 'key-facts', 'prose', 'diagram'] },
  { id: 'question-ladder', move: 'Short explain, check, explain, check: three checks of rising difficulty, each preceded by just enough teaching to answer it.', fits: 'concepts with clear steps of difficulty; review lessons', opens: ['prose', 'key-facts'] },
  { id: 'experiment-first', move: 'Make an experiment the core (hypothesis-lab or mini-sim), set up by a short scenario and followed by what the result means.', fits: 'science practices, cause and effect, fair tests', opens: ['prose', 'mini-sim', 'hypothesis-lab'] },
  { id: 'words-that-matter', move: 'Teach 3-4 key terms through use: flip cards and prose that use each term in context, then recall checks (fill-in-blank, multiple choice) on meaning, not spelling.', fits: 'vocabulary-heavy topics, early grades, new domains', opens: ['key-facts', 'figure', 'hero-image'] },
];

/** Three distinct shapes, drawn at random each run. */
export function drawShapes(random: () => number = Math.random, count = 3): LessonShape[] {
  const pool = [...SHAPES];
  const out: LessonShape[] = [];
  while (out.length < count && pool.length) out.push(pool.splice(Math.floor(random() * pool.length), 1)[0]);
  return out;
}

export interface LessonBounds {
  /** Outline sections, and blocks per section. */
  sections: [number, number];
  perSection: [number, number];
  /** Minimum evaluable blocks, and the most blocks a lesson may have. */
  checks: number;
  maxBlocks: number;
}

/** Lesson size per eval mode. Depth comes from sections; the eval mode moves the number of checks. */
export function lessonBounds(evalMode: string | undefined, preReader: boolean): LessonBounds {
  if (preReader) return { sections: [2, 3], perSection: [2, 3], checks: evalMode === 'explore' ? 1 : 2, maxBlocks: 8 };
  const checks = evalMode === 'explore' ? 2 : evalMode === 'analyze' ? 4 : 3;
  return { sections: evalMode === 'explore' ? [3, 4] : [3, 5], perSection: [2, 4], checks, maxBlocks: 16 };
}

/** "2.1" refs for every key idea in the outline, with their text. */
export function ideaRefs(outline: DeepDiveSection[]): Map<string, string> {
  return new Map(outline.flatMap((s, si) => s.ideas.map((idea, ii) => [`${si + 1}.${ii + 1}`, idea] as [string, string])));
}

/** The outline is the coverage contract: every key idea is taught, and every check tests an idea taught above it. */
function coverageChecks(blocks: DeepDiveBlock[], outline: DeepDiveSection[], bounds: LessonBounds, sized: boolean, blocking: string[], advisory: string[]) {
  const [smin, smax] = bounds.sections;
  if (outline.length < smin || outline.length > smax) blocking.push(`the outline has ${outline.length} sections; this level needs ${smin}-${smax}`);
  outline.forEach((s, i) => { if (s.ideas.length < 1 || s.ideas.length > 3) blocking.push(`section ${i + 1} "${s.heading}" has ${s.ideas.length} key ideas; give it 1-3`); });
  outline.forEach((s, i) => mathIssues(s.heading).forEach((x) => blocking.push(`section ${i + 1} heading: math: ${x}`)));
  const refs = ideaRefs(outline);
  const taught = new Map<string, number>();
  let lastSection = 0;
  blocks.forEach((b, i) => {
    if (b.section === undefined || b.section >= outline.length) { blocking.push(`block ${i} (${b.blockType}) has no valid section; set section to 1-${outline.length}`); return; }
    if (b.section < lastSection) blocking.push(`block ${i} is in section ${b.section + 1} after a block of section ${lastSection + 1}; keep blocks in section order`);
    lastSection = Math.max(lastSection, b.section);
    const ideas = b.ideas ?? [];
    const unknown = ideas.filter((r) => !refs.has(r));
    if (unknown.length) blocking.push(`block ${i} names ideas not in the outline: ${unknown.join(', ')}`);
    if (isEvaluableBlock(b)) {
      if (!ideas.length) blocking.push(`block ${i} is a check with no ideas; name the idea it tests`);
      const untaught = ideas.filter((r) => refs.has(r) && !taught.has(r));
      if (untaught.length) blocking.push(`block ${i} tests ${untaught.join(', ')} before any block teaches it; teach it above the check`);
    } else {
      ideas.forEach((r) => { if (!taught.has(r)) taught.set(r, i); });
      if (!ideas.length && b.blockType !== 'hero-image') advisory.push(`block ${i} (${b.blockType}) names no idea; every section block should teach one`);
    }
  });
  refs.forEach((idea, r) => { if (!taught.has(r)) blocking.push(`idea ${r} ("${idea}") is not taught by any block`); });
  outline.forEach((s, si) => {
    const mine = blocks.filter((b) => b.section === si);
    if (sized && (mine.length < bounds.perSection[0] || mine.length > bounds.perSection[1])) blocking.push(`section ${si + 1} "${s.heading}" has ${mine.length} blocks; give each section ${bounds.perSection[0]}-${bounds.perSection[1]}`);
    if (mine.length && mine.every(isEvaluableBlock)) blocking.push(`section ${si + 1} "${s.heading}" has only checks; it needs a block that teaches`);
    if (bounds.checks >= 3 && mine.length && !mine.some(isEvaluableBlock)) advisory.push(`section ${si + 1} "${s.heading}" has no check`);
  });
}

/** The shape every staged-pipeline lesson converged on. */
const STOCK_OPENING: BlockType[] = ['hero-image', 'key-facts', 'prose'];

export interface LessonCheckInput {
  ctx: BlockContext;
  planned: boolean;
  blocks: DeepDiveBlock[];
  /** When an instructor picked a template, the block types in order. */
  requiredSequence?: BlockType[];
  /** The shape the agent chose ('own' or an id from `offered`) and the shapes code drew. */
  shape?: string;
  offered?: LessonShape[];
  /** The See also links; required for readers (null = add_see_also not offered). */
  seeAlso?: SeeAlsoLink[] | null;
  /** The outline from plan_lesson; blocks are checked against it. */
  outline?: DeepDiveSection[];
}

export function lessonChecks({ ctx, planned, blocks, requiredSequence, shape, offered, seeAlso, outline }: LessonCheckInput): { blocking: string[]; advisory: string[] } {
  const blocking: string[] = [];
  const advisory: string[] = [];
  if (!planned) blocking.push('call plan_lesson first');
  const bounds = lessonBounds(ctx.evalMode, ctx.preReader);
  if (!requiredSequence && blocks.length > bounds.maxBlocks) blocking.push(`the lesson has ${blocks.length} blocks; at most ${bounds.maxBlocks}`);
  if (planned) {
    if (outline?.length) coverageChecks(blocks, outline, bounds, !requiredSequence, blocking, advisory);
    else blocking.push('plan_lesson needs the outline: sections with their key ideas');
  }
  const checks = blocks.filter(isEvaluableBlock).length;
  if (checks < bounds.checks) blocking.push(`${checks} evaluable block(s); this level needs at least ${bounds.checks}`);

  blocks.forEach((b, i) => {
    const issues = blockIssues(b, ctx);
    issues.blocking.forEach((x) => blocking.push(`block ${i} (${b.blockType}): ${x}`));
    issues.advisory.forEach((x) => advisory.push(`block ${i} (${b.blockType}): ${x}`));
    if (i > 0 && blocks[i - 1].blockType === b.blockType) blocking.push(`blocks ${i - 1} and ${i} are both ${b.blockType}; never place two of a type next to each other`);
  });

  // A check is taught by what comes before it, so its answer must not sit in the
  // block right above it word for word as the sentence that states it. Recall of a
  // taught word is fine; a definition-to-term copy is advisory for the agent to judge.
  blocks.forEach((b, i) => {
    const answer = blockAnswer(b);
    if (!answer || i === 0 || b.blockType === 'fill-in-blank') return;
    const text = norm(blocks.slice(0, i).map(visibleText).join(' '));
    if (norm(answer).length >= 12 && text.includes(norm(answer))) advisory.push(`block ${i}'s right option appears word for word above it; students can match words instead of understanding`);
  });

  const drawerIds = blocks.filter((b): b is DrawerBlockData => b.blockType === 'drawer').map((b) => b.drawerId);
  if (drawerIds.length > 2) blocking.push(`${drawerIds.length} embedded displays; use at most 2`);
  if (new Set(drawerIds).size < drawerIds.length) blocking.push('the same display is embedded twice');
  const builtIds = blocks.filter((b): b is GenDisplayBlockData => b.blockType === 'display').map((b) => b.displayId);
  if (builtIds.length > 2) blocking.push(`${builtIds.length} built displays; use at most 2`);
  if (new Set(builtIds).size < builtIds.length) blocking.push('the same built display is used twice');
  // Fit is the agent's call, so a lesson with no display is only flagged.
  if (ctx.drawers && !requiredSequence && !drawerIds.length && blocks.length >= 5) {
    advisory.push('no embedded display: if a catalog display shows an idea here better than one of the prose, key-facts or pull-quote blocks, replace that block with embed_primitive (replaceIndex)');
  }

  if (seeAlso !== null) {
    const links = seeAlso ?? [];
    if (links.length < 2 || links.length > 4) blocking.push(`${links.length} See also links; call add_see_also with 2-4`);
    // A link opens new sections at any time, so it must not ask for or state a check's answer.
    const answers = blocks.map(blockAnswer).filter((a): a is string => !!a && norm(a).length >= 4);
    links.forEach((l) => {
      const hit = answers.find((a) => norm(`${l.label} ${l.question}`).includes(norm(a)));
      if (hit) blocking.push(`See also "${l.label}" contains a check's answer ("${hit}")`);
    });
  }

  if (requiredSequence) {
    const got = blocks.map((b) => b.blockType).join(' → ');
    const want = requiredSequence.join(' → ');
    if (got !== want) blocking.push(`the instructor's template requires ${want}; the lesson is ${got}`);
  } else {
    const chosen = offered?.find((s) => s.id === shape);
    if (shape && shape !== 'own' && offered && !chosen) blocking.push(`shape "${shape}" was not offered; choose one of ${offered.map((s) => s.id).join(', ')} or "own"`);
    const opens = chosen?.opens.filter((t) => !(ctx.preReader && PRE_READER_BLOCKED.has(t)) && (t !== 'drawer' || ctx.drawers));
    if (opens?.length && blocks[0] && !opens.includes(blocks[0].blockType)) blocking.push(`the ${chosen!.id} shape opens with ${opens.join(' or ')}; the lesson opens with ${blocks[0].blockType}`);
    if (STOCK_OPENING.every((t, i) => blocks[i]?.blockType === t)) advisory.push('the lesson opens hero-image → key-facts → prose, the stock opening; open the way the chosen shape says');
    const counts = new Map<string, number>();
    // Each drawer is its own primitive, so it counts as its own type.
    blocks.forEach((b) => { const t = b.blockType === 'drawer' ? (b as DrawerBlockData).drawerId : b.blockType === 'display' ? (b as GenDisplayBlockData).displayId : b.blockType; counts.set(t, (counts.get(t) ?? 0) + 1); });
    const allowed = Math.max(2, Math.ceil(blocks.length / 5));
    const repeated = Array.from(counts).find(([t, n]) => n > allowed && t !== 'multiple-choice');
    if (repeated) advisory.push(`${repeated[1]} ${repeated[0]} blocks; use another type for one of them`);
    const wanted = blocks.length >= 12 ? 6 : blocks.length >= 6 ? 4 : 0;
    if (counts.size < wanted) advisory.push(`only ${counts.size} block types in ${blocks.length} blocks`);
  }
  return { blocking, advisory };
}
