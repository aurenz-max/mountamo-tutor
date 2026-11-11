/**
 * Life Lab's author agent (K-5 biology canvas, USER 2026-11-07; the full framework, USER 2026-11-08).
 *
 * One model runs the agent kit's author loop (`agent-kit/authorLoop.ts`) and designs a lesson on any biology concept from
 * the topic and objective, never an eval mode. It teaches first (the kit's teach frames) and writes each item through one
 * of two tools: `write_item`, the kit's answer surfaces over displays and its own drawings, and `write_world`, a small
 * living world the child changes and runs (places, living things, one rule, one control, a goal).
 *
 * On a world code runs the rules, solves every setting, labels the skill and blocks shortcuts (`lifeLabWorld.ts`). On a kit
 * item code checks structure and shortcuts and the look stage's blind reader answers against the author's key. Code scores
 * difficulty on both. Invariants: `.claude/skills/agent-primitive/SKILL.md`.
 */
import type { FunctionDeclaration } from '@google/genai';
import { authoredObjective, planWithObjective, runAuthor, str, strs, arr, num, clean, type Args, type WriteOutcome } from '../../agent-kit/authorLoop';
import { leverPrompt, slotLevers, type DraftLever, type LeverCapability } from '../../agent-kit/levers';
import { displayIssues, displayMenu, displayPrompt, displayText, displayToolSchema, readDisplay, readDisplays, type Display } from '../../agent-kit/displays';
import { CARD_SURFACES, difficultyOf, itemErrors, shortcutChecks, shownOrder, type Surface, type SurfaceItem, type SurfaceOption } from '../../agent-kit/surfaces';
import { readTeach, teachIssues, teachPrompt, teachText, teachToolSchema, type TeachStep } from '../../agent-kit/teach';
import { readTerms, termIssues, termsOnScreen, termsPrompt, termsText, termsToolSchema, type Term } from '../../agent-kit/terms';
import { lifeLabItemView, lifeLabView } from './lifeLabView';
import { buildScopePromptSection } from '../../scopeContext';
import type { GenerationContext, GenerationObjective } from '../../generation/generationContext';
import type { LifeLabChallenge, LifeLabData } from '../../../primitives/visual-primitives/biology/life-lab/LifeLab';
import { validateLifeLabData } from '../../../primitives/visual-primitives/biology/life-lab/lifeLab.boss';
import { lifeSpokenKey, respondError, respondOf } from '../../../primitives/visual-primitives/biology/life-lab/lifeLabSpoken';
import { spokenKeyText } from '../../../components/live-activity/spokenKey';
import { COVERAGE } from '../../../primitives/visual-primitives/biology/life-lab/lifeLab.fixtures';
import { COND_KEYS, COND_WORDS, ORGANISMS } from '../../../primitives/visual-primitives/biology/life-lab/lifeLabAtlas';
import {
  LIFE_DISPLAYS, LIFE_MODES, MODE_STANDARDS, itemsOf, normalizeWorld, optionsOf, seededRng, sessionChecks, settleBench, worldChecks, type CheckContext, type ItemDraft, type LifeLabMode,
  type LifeWorld, type SupportTier,
} from '../../../primitives/visual-primitives/biology/life-lab/lifeLabWorld';

const MODEL = 'gemini-flash-latest';
// The soft deadline leaves room for the look to read a late rewrite (11-08: a hard session at 70 s shipped three worlds unread).
const SOFT_DEADLINE_MS = Number(process.env.LUMINA_LL_AGENT_SOFT_MS ?? 130_000);
const HARD_DEADLINE_MS = Number(process.env.LUMINA_LL_AGENT_HARD_MS ?? 170_000);
const MAX_TURNS = 14;
const SALVAGE_MIN = 2;


const WHAT: Record<LifeLabMode, string> = {
  where_it_lives: 'needs rule + move control + all_thrive: animals start in the wrong homes; the child moves each to a place that meets its needs',
  what_it_needs: 'needs rule + condition control + all_thrive: a plant (or animal) lacks something; the child turns light, water or warmth up or down',
  part_for_the_job: 'part_enables (beak or feet) + trait control + action: the place sets the food or ground; the child picks the part',
  hide_from_the_hunter: 'spots + one moth + trait control (part color) + survives: the child picks wings the hunter cannot see on the bark',
  whose_baby: 'inherits + choose + choose: two parents and 2-4 young; exactly one young has every trait from a parent',
  spread_the_seeds: 'part_enables (seed) + trait control + action, moveTo a far place: the place sets the carrier (wind, fur, water)',
  life_cycle: 'stages + order control + order: the stages of a real cycle (plus at most 2 from another living thing) to put in order',
  follow_the_path: 'flows + order control + flow: build the path oxygen takes from where an animal lives into its blood',
  survive_and_change: 'spots + a moth population (variants) + predict + prediction: which color will there be more of after 2-5 families',
  fair_test: 'needs + condition control over 1-3 pots + fair_test {variable}: two pots the same except the variable, one growing (a pot the child cannot change is the one to match)',
};

/** What this lesson is for, in the most specific words it has. */
const objectiveOf = (gctx: GenerationContext) => gctx.objective?.text || gctx.intent || gctx.topic;

// ── Prompt ──────────────────────────────────────────────────────────────────

/** The atlas, offered as shorthand: a world may name one of these as `subject` instead of declaring its facts. */
function atlasMenu(): string {
  const lines = Object.entries(ORGANISMS).map(([id, o]) => `${id} (${o.name}${o.cycle ? `; stages ${o.cycle.join('>')}` : ''})`);
  return `Shorthand (optional): a living thing may give subject = one of these ids and code fills its name, picture, needs and life stages; anything you declare yourself wins. You are NOT limited to these: ${lines.join(', ')}.`;
}

const EXAMPLES = LIFE_MODES.map(m => `${m}: ${JSON.stringify({ ...COVERAGE[m].world, ask: COVERAGE[m].ask, why: COVERAGE[m].why })}`).join('\n');

function systemPrompt(gctx: GenerationContext, tier: SupportTier | undefined, grade: number | undefined): string {
  const suggested = String(gctx.targetEvalMode ?? (gctx.raw as { targetEvalMode?: string } | undefined)?.targetEvalMode ?? '');
  return `You design ONE Life Lab lesson on "${gctx.topic}" for a child in ${grade === undefined ? 'grades K-5' : grade === 0 ? 'Kindergarten' : `grade ${grade}`}: any concept in biology, from a whole forest to a part inside a cell.
${gctx.intent ? `\nThis session's job: ${gctx.intent}\n` : ''}${gctx.objective?.text ? `\nThe learning objective: ${gctx.objective.text}\n` : `\nNo learning objective was given. Write one in plan_session (objectiveText, objectiveVerb): one sentence for what this child will be able to do by the end of this lesson, narrow enough for one lesson. Every section and question serves it.\n`}${(LIFE_MODES as readonly string[]).includes(suggested) ? `\nA suggestion, only if it fits the objective: include a ${suggested} world.\n` : ''}${buildScopePromptSection(gctx.scope)}
You teach this idea, show it and check it. A lesson is 3-5 items on one idea. You decide what the child sees and does, and you build each piece with tools; every write returns the code checks. Fix everything they block, then call finish. Look at the whole lesson first: what does this child need to see to understand this idea? What would prove they understood it? Then choose the pieces.

Work fast: in your FIRST turn call plan_session and then write every item (several calls in one turn). Later turns only fix what comes back.

## The pieces
- teach on an item (see "Teach first"): frames the child taps through before the item opens. The first item of the lesson must teach.
- write_item: drawn cards the child picks, sorts or orders. Use it for anything about what something looks like, what a part does, which case fits, how things group, or what happens in what order: cells, organs, tissues, body systems, classification, food webs, comparing structures.
- write_world: a small living world the child changes and runs. Use it when what the idea needs is to change something and see what the living thing does: habitats and needs, a body part for a job, camouflage, inheritance, a life cycle, a fair test.
Choose by the concept. A world is the right tool only when running it teaches: if the world would be one living thing on an empty background with a list to pick from, write an item with a real drawing. Vary what the child does across the lesson.

## write_item
surface: choose (one right card, 2-5 cards), categorize (sort 3-8 cards into 2-3 boxes), order (3-6 cards). prompt: what the tutor asks, never the answer. stimulus: up to 3 displays above the cards. options: [{id, label, display}], a card is words, a display, or both. answer (choose: a card id), order_key (order: every card id in order), sort_key (categorize: [{id, category}]), categories. misconceptions: [{id, idea}], the wrong idea behind that card, written to the child as what to look at again ("A water bag stores water. Which part makes energy?"); the child reads it after a miss, and it never describes the right card.
An item must draw something: a stimulus or drawn cards. Code blocks a words-only item. Hide what is being asked: leave the label off the part in the drawing, or write "?". When the drawing is what differs between cards, never write that difference in the label: "Cell A", or no label, not "cell packed with...". Wrong cards come from real misconceptions, and the drawing must let a child reason to the answer by the feature that matters. A careful reader who sees only the screen answers each item; if it gets a different answer from yours, the item comes back.
Difficulty on an item comes from more cards, wrong cards from named misconceptions, more to order or sort, and comparing drawings.

## write_world: five blocks, and you write all of the content
You decide which living things, places, traits, parts, stages and facts the lesson needs: any organism, any trait, any part. Declare each fact in the world; code runs it and checks the world is fair, and trusts your facts, so they must be true. Give every choice its own picture: code blocks several options that share one emoji.
- zones (0-4 places): {id, label, kind?, emoji?, cond}. cond: dials light, water, temp (0, 1 or 2: ${COND_KEYS.map(k => `${k} ${COND_WORDS[k].join('/')}`).join('; ')}) and any features as {key, value} words: food (what there is to eat), carrier (wind, fur, water...), ground (snow, sand, tree...), color (the background a hunter looks at), medium (air or water, what a body breathes in), or any other.
- beings (living things): {id, zone, name, emoji, kind animal|plant, needs?, traits?, variants?} (or subject = an atlas id as shorthand). needs: dial ranges [low, high], e.g. light [1,2]. traits: [{name, value}] (a part it has now, a coloring, looks it inherits: wings orange, spots none, antennae long). variants: a population of two colorings [{value, count 2-8}].
- rule (exactly one):
  - needs {beings}: each lives or struggles by its needs against its place's dials.
  - part_enables {being, part, on, also?, job, moveTo?}: the part (beak, feet, roots, leaves, seed shape...) does the job (eat, move, travel, drink...) only if the option picked works on the place's feature "on", and on every feature listed in "also" (a bill that must reach deep water and hold slippery fish). moveTo: a place it goes when it works (a seed carried far).
  - inherits {parents [a, b], traits [names]}: a young belongs to the parents if each listed trait matches one parent. Works for any living thing and any traits.
  - stages {of, stages [{id, name, emoji}]}: a life cycle, stages in the real order (3-6).
  - spots {predator, prey, also?}: the hunter sees prey whose color differs from the place's color. With "also" (features of the place, such as texture) a coloring must match the color and work on each of those; each option then says works.
  - flows {being, start, goal, parts [{id, name, emoji, takes [{in, out}]}]}: something (air, water, food, light energy...) passes through the parts placed in order; each part turns one thing into another; the goal is reached when start becomes goal.
- control (exactly one thing the child changes): condition {zones, keys} · move {beings, zones} · trait {being, part, options [{value, label (what it looks like), emoji, works [feature values it works on]}]} (for a coloring: part color, options [{value: a color, label}]) · order {slots, items [ids], extras [{id, name, emoji}] (a stage from another life)} · choose {among} · predict {of}.
- goal: all_thrive · action · survives · order · flow · choose · prediction · fair_test {variable light|water|temp}.
You never state which choice is right; code works it out from your facts and names the skill from the structure as a label. You decide which kinds of world fit the objective. A reader checks each world against the objective and sends back one that does not practise it.

Kinds of world these blocks have made (examples only: compose what the objective needs, with other living things, places and words; a copy of an example is refused):
${LIFE_MODES.map(m => `- "${m}" (${MODE_STANDARDS[m]}): ${WHAT[m]}.`).join('\n')}
${EXAMPLES}

## What makes a good world
- The topic is the teacher's choice, for this child. Teach any topic at this child's level, in words they know: for a young child a cell part can be "a tiny part inside the animal that turns food into energy". Never refuse a topic because it seems above the grade.
- It teaches the lesson's idea. The places and living things suit the lesson (a pond lesson gets pond animals). When the lesson is about one living thing (monarch butterflies), the first world is about it and later worlds compare it with others that show the same idea (a frog's and a bean plant's life cycles beside the butterfly's): comparing is part of the idea, not off topic.
- The child must use the idea to succeed. Code blocks a goal already true, a goal nothing reaches, a world where every option works, an ask or why-card that names the answer (the working option or a word only it has, the right home with its animal, the stages in order, a part of the path), a baby that is a copy of one parent, two babies that fit.
- A feature in also is a real demand on that part, one a child can reason about from how the part looks: how deep the food is, how hard its shell is, how rough the bark is. Never add one to raise the score: a beak does not work on weather, and a second word for the same thing is not a second demand.
- Facts are true: needs, what each option works on, the order of stages and what each part takes in are real biology for a child's level. Code trusts them.
- The ask (one or two short sentences) says what to change and the goal, never the answer. The why-card (after a wrong check) says how to look again, never the answer.
- Words a young child knows; short sentences; true facts. Every name and value you declare is shown on screen, so write it as words a child of this grade reads and says ("mashed food", not "chyme"; "long thin roots", not "taproot system"), with spaces, not underscores.
- Across the session: vary the living things and the answers and, where the objective allows, what the child does.

## Displays and drawings
Displays go in teach frames, an item's stimulus and cards, and a world's show. You write the values and code draws it. On a world, add show (at most 2) only when seeing it teaches: last summer's moth counts before a prediction, a table of what each pot was given. A display is evidence or an example, never this item's answer: code reads a world's display like the ask and blocks one that names the working option, lists this world's stages in order or names a part of the path. Never show how a world's run ends.
${displayPrompt(LIFE_DISPLAYS)}
When no display can show it, draw it yourself with svg: an organ in cross section, a plant's transport tubes, a muscle fiber, a before and after. The structure of the drawing is the idea, so draw it plainly: the same frame on every card with only the thing being taught changing, plain lines, one drawing language across the lesson, and at least one drawing that tests the rule. You will be shown every drawing you make, the way the child sees it.
${teachPrompt(`Example, how leaves get water, grade 3 (write your own for your concept, with your own drawings):
- frame 1 says "A tall tree has leaves far above its roots, and every leaf needs water." show zoom: Tree, Branch, Leaf.
- frame 2 says "Thin tubes run from the roots up to each leaf. Water climbs them." show your own drawing of a stem cut open, with the tubes lit.
- then the item asks about a new case: two plants drawn with their tubes cut in different places, and which leaves will wilt.`)}

## How the child answers (respond)
The child answers by voice or on screen; you choose which fits the world. Code checks the choice and builds what the tutor judges; you never write a key. Every write returns answeredBy.
- say: the answer is ONE named thing a child can say: the part it picked ("the thick short beak", "tiny hooks"), a coloring ("green"), a prediction ("more dark moths"). The tap still counts. Use say for every part, coloring and prediction world.
- show: the answer is moves, settings, an order or a path, or one of several young told apart only by their looks. None of these can be said as one thing.
On write_item: say when the cards are a choose and every card has words; show for a sort, an order, or cards that are only drawings.
A choice that does not fit is blocked with the reason.

## Difficulty
Every write returns difficulty {band, score, reasons}. Terms: more things to try (more places, options, bench items) raise it; few right settings raise it; a fair test the child designs +1.5, or +0.2 when one pot is already set to match; a prediction +0.8; more families raise it (2 families +0.3, up to 5 families +1); a coloring that starts with more and ends with fewer +1; each extra feature a part or coloring must fit (also) +1; each option that fits only some of them +0.5; each inherited trait +0.3; each young wrong in only one trait +0.4; 3+ living things +0.5; bench parts that do not belong +0.25 each; a stage from another life +0.5. Bands: easy under 1.5, medium under 3, hard 3+.
${tier ? `This session is ${tier.toUpperCase()}: every world must score ${tier} (the first may be one band easier). Reach it by the structure.` : 'No tier is set: start easier and build up.'}

${termsPrompt(`Example: a question "which part chews leaves?" with the choices mandibles, proboscis and claspers. mandibles: "two hard, toothed plates at the front of a caterpillar's head." proboscis: "a long thin tube that stays coiled under a butterfly's head." claspers: "stubby hooked legs near a caterpillar's tail." The child reasons from the shape to the job.`)}
${atlasMenu()}${leverPrompt(LEVER_EXAMPLES)}`;
}

/** Life Lab's lever examples, in its own fields (the agent writes its own for each world). */
const LEVER_EXAMPLES = `Examples (write your own for each world):
- where_it_lives (a penguin and a lizard in the wrong homes): help change {zones: the same places, each with an emoji that shows it (❄️, ☀️)}; simplify change {beings: just the penguin, zones: two places}.
- part_for_the_job (four beaks for hard seeds): help change {zones: the meadow with an emoji of the seeds}, or {beings: a second bird that already eats here, drawn beside it}; simplify change {control: the same part with two options}.
A new label or name is words: a child who cannot read sees nothing new, so code refuses it as a help.
- life_cycle (frog stages plus a caterpillar): simplify change {control: the order with no stage from another life}.
- fair_test (three pots): help change {show: [a table of what each pot was given]}; simplify change {zones: two pots}.
- life_cycle (a frog): help change {show: [a flow with loop true of another animal's life, so the child sees what a cycle looks like]}.
- survive_and_change (moths on dark bark): help change {show: [a bar_graph of how many of each color were left after one family]}.`;

// ── Tools ───────────────────────────────────────────────────────────────────

const s_ = { type: 'string' } as const;
const i_ = { type: 'integer' } as const;
const sa_ = { type: 'array', items: s_ } as const;
const kv_ = { type: 'array', items: { type: 'object', properties: { key: s_, value: s_ }, required: ['key', 'value'] } } as const;
const item_ = { type: 'object', properties: { id: s_, name: s_, emoji: s_ }, required: ['id', 'name'] } as const;
const range_ = { type: 'array', items: i_ } as const;
const WORLD_TOOL: FunctionDeclaration = {
  name: 'write_world',
  description: 'Build one world (appended, or replacing the world at replaceIndex). Returns the code checks, the skill and standards code read from it, the key (for you only) and its difficulty.',
  parametersJsonSchema: {
    type: 'object',
    properties: {
      zones: { type: 'array', items: { type: 'object', properties: {
        id: s_, label: s_, kind: s_, emoji: s_, light: i_, water: i_, temp: i_, features: kv_,
      }, required: ['id', 'label'] } },
      beings: { type: 'array', items: { type: 'object', properties: {
        id: s_, zone: s_, subject: s_, name: s_, emoji: s_, kind: { type: 'string', enum: ['animal', 'plant'] },
        needs: { type: 'object', properties: { light: range_, water: range_, temp: range_ } },
        traits: { type: 'array', items: { type: 'object', properties: { name: s_, value: s_ }, required: ['name', 'value'] } },
        variants: { type: 'array', items: { type: 'object', properties: { value: s_, count: i_ }, required: ['value', 'count'] } },
      }, required: ['id', 'zone'] } },
      rule: { type: 'object', properties: {
        kind: { type: 'string', enum: ['needs', 'part_enables', 'inherits', 'stages', 'spots', 'flows'] },
        beings: sa_, being: s_, part: s_, on: s_, also: sa_, job: s_, moveTo: s_, parents: sa_, traits: sa_, subject: s_, of: s_,
        stages: { type: 'array', items: item_ }, predator: s_, prey: s_, start: s_, goal: s_,
        parts: { type: 'array', items: { type: 'object', properties: { id: s_, name: s_, emoji: s_,
          takes: { type: 'array', items: { type: 'object', properties: { in: s_, out: s_ }, required: ['in', 'out'] } } }, required: ['id', 'name', 'takes'] } },
      }, required: ['kind'] },
      control: { type: 'object', properties: {
        type: { type: 'string', enum: ['condition', 'move', 'trait', 'order', 'choose', 'predict'] },
        zones: sa_, keys: sa_, beings: sa_, being: s_, part: s_,
        options: { type: 'array', items: { type: 'object', properties: { value: s_, label: s_, emoji: s_, works: sa_ }, required: ['value', 'label'] } },
        slots: i_, items: sa_, extras: { type: 'array', items: item_ }, among: sa_, of: s_,
      }, required: ['type'] },
      goal: { type: 'object', properties: { kind: { type: 'string', enum: ['all_thrive', 'action', 'survives', 'order', 'flow', 'choose', 'prediction', 'fair_test'] },
        variable: { type: 'string', enum: [...COND_KEYS] } }, required: ['kind'] },
      steps: { type: 'integer', description: 'Days (needs, 3-5) or families (2-5).' },
      show: { ...displayToolSchema(LIFE_DISPLAYS), description: 'At most 2 displays beside the world (see "Displays and drawings"). Usually left out.' },
      teach: teachToolSchema(LIFE_DISPLAYS),
      terms: termsToolSchema(LIFE_DISPLAYS),
      ask: { type: 'string', description: 'What the tutor asks: what to change and the goal, never the answer. 1-2 short sentences.' },
      why: { type: 'string', description: 'The why-card after a wrong check: how to look again, never the answer.' },
      respond: { type: 'string', enum: ['show', 'say'], description: 'What the child produces (see "How the child answers").' },
      replaceIndex: { type: 'integer' },
    },
    required: ['zones', 'beings', 'rule', 'control', 'goal', 'ask', 'why'],
  },
};
const ITEM_TOOL: FunctionDeclaration = {
  name: 'write_item',
  description: 'Build one item the child answers with drawn cards (appended, or replacing the item at replaceIndex). Returns the code checks, the key as code reads it and the difficulty.',
  parametersJsonSchema: {
    type: 'object',
    properties: {
      surface: { type: 'string', enum: [...CARD_SURFACES] },
      prompt: { type: 'string', description: 'What the tutor asks, never the answer.' },
      stimulus: { ...displayToolSchema(LIFE_DISPLAYS), description: 'Up to 3 displays above the cards.' },
      options: { type: 'array', items: { type: 'object', properties: { id: s_, label: s_, display: displayToolSchema(LIFE_DISPLAYS).items }, required: ['id'] } },
      categories: { ...sa_, description: 'categorize only: 2-3 box names.' },
      answer: { type: 'string', description: 'choose only: the right card id.' },
      order_key: { ...sa_, description: 'order only: every card id in the right order.' },
      sort_key: { type: 'array', description: 'categorize only: which box each card goes in.', items: { type: 'object', properties: { id: s_, category: s_ }, required: ['id', 'category'] } },
      misconceptions: { type: 'array', items: { type: 'object', properties: { id: s_, idea: s_ }, required: ['id', 'idea'] } },
      teach: teachToolSchema(LIFE_DISPLAYS),
      terms: termsToolSchema(LIFE_DISPLAYS),
      respond: { type: 'string', enum: ['show', 'say'], description: 'What the child produces (see "How the child answers").' },
      replaceIndex: { type: 'integer' },
    },
    required: ['surface', 'prompt', 'options'],
  },
};
const PLAN_TOOL: FunctionDeclaration = { name: 'plan_session', description: 'Set the session: a short friendly title and the one idea. Call first.',
  parametersJsonSchema: { type: 'object', properties: { title: s_, idea: s_ }, required: ['title', 'idea'] } };
const REMOVE_TOOL: FunctionDeclaration = { name: 'remove_world', description: 'Remove the world at index.', parametersJsonSchema: { type: 'object', properties: { index: i_ }, required: ['index'] } };
const FINISH_TOOL: FunctionDeclaration = { name: 'finish', description: 'Ship the session. Refused while a check blocks.', parametersJsonSchema: { type: 'object', properties: {} } };
const DECLINE_TOOL: FunctionDeclaration = { name: 'decline', description: 'Only when no living world could show any part of this topic (it is not about living things at all). A topic that seems above the child\'s grade is never a reason. Ends the authoring.',
  parametersJsonSchema: { type: 'object', properties: { reason: s_ }, required: ['reason'] } };

export class LifeLabDeclined extends Error {}

/** The world the agent wrote, as code reads it. Accepts the tool's lists ({key, value}, {name, value}, {in, out}) and the
 * engine's own shapes, so a hand-written world reads the same. */
export function worldOf(a: Args): LifeWorld {
  const r = (a.rule ?? {}) as Args, c = (a.control ?? {}) as Args, g = (a.goal ?? {}) as Args;
  const pairs = (v: unknown, k = 'key', val = 'value'): Record<string, string> => Array.isArray(v)
    ? Object.fromEntries(arr(v).map(x => [str(x[k]), str(x[val])]).filter(([x, y]) => x && y))
    : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v as Args).map(([x, y]) => [x, str(y)]).filter(([, y]) => y)) : {};
  const item = (x: Args) => clean({ id: str(x.id), name: str(x.name), emoji: str(x.emoji) || undefined });
  const range = (v: unknown) => (Array.isArray(v) && v.length === 2 ? [Number(v[0]), Number(v[1])] as [never, never] : undefined);
  const rule = clean({ kind: str(r.kind), beings: strs(r.beings), being: str(r.being) || undefined, part: str(r.part) || undefined, on: str(r.on) || undefined, also: strs(r.also),
    job: str(r.job) || undefined, moveTo: str(r.moveTo) || undefined, parents: strs(r.parents), traits: strs(r.traits), subject: str(r.subject) || undefined,
    of: str(r.of) || undefined, stages: Array.isArray(r.stages) ? arr(r.stages).map(item) : undefined, predator: str(r.predator) || undefined, prey: str(r.prey) || undefined,
    start: str(r.start) || undefined, goal: str(r.goal) || undefined,
    parts: Array.isArray(r.parts) ? arr(r.parts).map(x => ({ ...item(x), takes: pairs(x.takes, 'in', 'out') })) : undefined });
  const options = Array.isArray(c.options) ? (c.options as unknown[]).map(o => (typeof o === 'string' ? o
    : clean({ value: str((o as Args).value), label: str((o as Args).label) || str((o as Args).value), emoji: str((o as Args).emoji) || undefined,
      works: Array.isArray((o as Args).works) ? strs((o as Args).works) : undefined }))) : undefined;
  const control = clean({ type: str(c.type), zones: strs(c.zones), keys: strs(c.keys), beings: strs(c.beings), being: str(c.being) || undefined, part: str(c.part) || undefined,
    options, slots: num(c.slots), items: strs(c.items), extras: Array.isArray(c.extras) ? arr(c.extras).map(item) : undefined, among: strs(c.among), of: str(c.of) || undefined });
  // Lists a rule or control requires stay present (as empty) so the structure check names what is missing; a part
  // option's `works` stays even when empty (it works on nothing here).
  for (const k of ['beings', 'parents', 'traits'] as const) if (Array.isArray(r[k]) && !(k in rule)) (rule as Args)[k] = [];
  for (const k of ['zones', 'keys', 'beings', 'options', 'items', 'among'] as const) if (Array.isArray(c[k]) && !(k in control)) (control as Args)[k] = [];
  if (Array.isArray(control.options)) control.options = (control.options as Array<Args | string>).map((o, i) => (typeof o === 'string' ? o
    : Array.isArray(((c.options as Args[])[i] ?? {}).works) && !('works' in o) ? { ...o, works: [] } : o)) as never;
  const steps = num(a.steps);
  return {
    ...(steps !== undefined ? { steps } : {}),
    ...(a.show !== undefined ? { show: readDisplays(a.show) } : {}),
    zones: arr(a.zones).map(z => {
      const dials = Object.fromEntries((COND_KEYS as readonly string[]).map(k => [k, num(z[k] ?? (z.cond as Args | undefined)?.[k])]).filter(([, v]) => v !== undefined));
      const legacy = z.cond && typeof z.cond === 'object' ? Object.fromEntries(Object.entries(z.cond as Args).filter(([k]) => !(COND_KEYS as readonly string[]).includes(k)).map(([k, v]) => [k, str(v)])) : {};
      return clean({ id: str(z.id), label: str(z.label), kind: str(z.kind) || undefined, emoji: str(z.emoji) || undefined, cond: { ...legacy, ...pairs(z.features), ...dials } });
    }) as LifeWorld['zones'],
    beings: arr(a.beings).map(b => clean({ id: str(b.id), zone: str(b.zone), subject: str(b.subject) || undefined, name: str(b.name) || undefined, emoji: str(b.emoji) || undefined,
      kind: str(b.kind) === 'plant' || str(b.kind) === 'animal' ? str(b.kind) as 'plant' | 'animal' : undefined,
      needs: b.needs && typeof b.needs === 'object' ? clean(Object.fromEntries(Object.entries(b.needs as Args).map(([k, v]) => [k, range(v)]))) : undefined,
      traits: b.traits ? pairs(b.traits, 'name', 'value') : undefined,
      variants: Array.isArray(b.variants) ? arr(b.variants).map(v => ({ value: str(v.value), count: Number(v.count) })) : undefined })) as LifeWorld['beings'],
    rules: [rule as never], controls: [control as never],
    goal: clean({ kind: str(g.kind), variable: str(g.variable) || undefined }) as never,
  };
}

/**
 * A verbatim copy of an example: the same ask, or the same whole world (ids aside). A butterfly life cycle on a
 * butterfly lesson is the right world, not a copy (the 11-07 drive: a subject-level check refused every butterfly).
 */
const shape = (raw: LifeWorld) => {
  const w = normalizeWorld(raw);
  // Key-sorted, so the same world written with its fields in another order still matches.
  const stable = (v: unknown): unknown => (Array.isArray(v) ? v.map(stable) : v && typeof v === 'object'
    ? Object.fromEntries(Object.entries(v as Record<string, unknown>).filter(([, x]) => x !== undefined).sort(([a], [b]) => a.localeCompare(b)).map(([k, x]) => [k, stable(x)])) : v);
  return JSON.stringify(stable({ ...w, beings: w.beings.map(({ id: _id, ...b }) => b), zones: w.zones.map(({ id: _id, label: _l, ...z }) => z) }));
};
const sameWorld = (a: LifeWorld, b: LifeWorld) => shape(a) === shape(b);

/** One piece of the lesson: a world (`draft`) or a kit item (`item`), with what it teaches first and its Learn more words. */
interface Entry { draft?: ItemDraft; item?: SurfaceItem; teach?: TeachStep[]; terms?: Term[]; respond?: 'show' | 'say'; mode?: LifeLabMode | Surface; key?: string; band?: SupportTier; blocking: string[] }
interface State { plan?: { title: string; idea: string }; objective?: GenerationObjective; entries: Entry[]; ctx: CheckContext; tier?: SupportTier }

/** Every word the child can read on a world's screen. */
function worldScreen(world: LifeWorld, ask: string): string {
  const w = normalizeWorld(world);
  return [ask, ...w.zones.flatMap(z => [z.label, ...Object.values(z.cond ?? {}).map(String)]), ...w.beings.flatMap(b => [b.name ?? '', ...Object.values(b.traits ?? {}).map(String)]),
    ...optionsOf(w).map(o => o.label), ...itemsOf(w).map(x => x.name), ...(w.show ?? []).map(displayText)].join(' ').replace(/_/g, ' ');
}

/** Read and check one world. The kit's loop lands it (append or replaceIndex). */
function readWorld(state: State, a: Args, opts?: { lever?: boolean }): WriteOutcome<Entry> {
  if (!state.plan) return { error: 'call plan_session first' };
  let world: LifeWorld;
  try { world = worldOf(a); } catch (e) { return { error: `could not read the world: ${(e as Error).message}` }; }
  const draft: ItemDraft = { world, ask: str(a.ask), why: str(a.why) };
  const checks = worldChecks(world, draft.ask, draft.why, state.ctx);
  if (!draft.ask || !draft.why) checks.blocking.push('ask and why are required');
  const teach = a.teach !== undefined ? readTeach(a.teach) : undefined;
  if (teach) checks.blocking.push(...teachIssues(teach, LIFE_DISPLAYS));
  let terms = readTerms(a.terms);
  if (!checks.blocking.length) {
    // The same picture on every choice says nothing: the 11-08 mitochondria session put one microscope on every card.
    const pics = [...optionsOf(world), ...itemsOf(world)].map(o => o.emoji).filter(Boolean);
    const repeated = pics.find((p, i) => pics.indexOf(p) !== i);
    if (repeated) checks.blocking.push(`${repeated} is the picture on more than one choice, so the pictures tell the child nothing. Give each its own, or write this as an item with drawn cards.`);
  }
  if (!checks.blocking.length && terms.length) {
    const text = worldScreen(world, draft.ask);
    if (opts?.lever) terms = termsOnScreen(terms, text);
    const key = (checks.key ?? '').toLowerCase();
    const cards = optionsOf(world).map(o => ({ label: o.label, right: !!key && key.includes(o.label.toLowerCase()) }));
    checks.blocking.push(...termIssues(terms, { text, cards }, LIFE_DISPLAYS));
    if (key.length > 2 && terms.some(t => t.means.toLowerCase().includes(key))) checks.blocking.push('terms: a definition states the answer');
  }
  if (LIFE_MODES.some(m => sameWorld(world, COVERAGE[m].world) || draft.ask === COVERAGE[m].ask)) checks.blocking.push('this is the example world; build one for this lesson');
  const respond = str(a.respond) === 'say' || str(a.respond) === 'show' ? str(a.respond) as 'show' | 'say' : undefined;
  const spoken = { world, ...(respond ? { respond } : {}) };
  let answeredBy: string | undefined;
  if (!checks.blocking.length) {
    const misfit = respondError(spoken);
    if (misfit) checks.blocking.push(misfit);
    const key = misfit ? null : lifeSpokenKey(spoken);
    answeredBy = key ? `say (or tap): the tutor accepts ${spokenKeyText(key)}` : `show: the board checks it (${respondOf(spoken)})`;
  }
  const item: Entry = { draft, ...(teach?.length ? { teach } : {}), ...(terms.length ? { terms } : {}), ...(respond ? { respond } : {}), mode: checks.mode, key: checks.key, band: checks.difficulty?.band, blocking: checks.blocking };
  return { item, result: { checks: { blocking: checks.blocking, advisory: checks.advisory },
    ...(checks.mode ? { skill: `${checks.mode} (${checks.standards})` } : {}), ...(checks.difficulty ? { difficulty: checks.difficulty } : {}),
    ...(checks.key ? { key: checks.key } : {}), ...(answeredBy ? { answeredBy } : {}) } };
}

const MAX_STIMULUS = 3;
/** Under this a hand-drawn card is a shape or two: the 11-08 mitochondria cards were 103-283 characters and a reader called them generic shapes. */
const MIN_CARD_SVG = 300;
/** A stable shuffle seed from the cards themselves, so a lever that keeps the cards keeps their order. */
const seedOfIds = (ids: readonly string[]) => Array.from(ids.join('|')).reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);
const statesLabel = (text: string, label: string) => !!label.trim() && new RegExp(`\\b${label.trim().toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`).test(text.toLowerCase());

/** A kit item as code reads it: its structure, shown order, difficulty, shortcuts and what the child produces. */
function readItem(state: State, a: Args, opts?: { lever?: boolean }): WriteOutcome<Entry> {
  if (!state.plan) return { error: 'call plan_session first' };
  // The kit's make surface is not offered here yet: this tool has no goal field (queued in qa/evidence-spec/QUEUE.md).
  const surface = (CARD_SURFACES as readonly string[]).includes(str(a.surface)) ? str(a.surface) as Surface : 'choose';
  const options: SurfaceOption[] = arr(a.options).map(o => {
    const d = readDisplay(o.display);
    return { id: str(o.id), ...(str(o.label) ? { label: str(o.label) } : {}), ...(d ? { display: d } : {}) };
  });
  const key = surface === 'order' ? strs(a.order_key) : surface === 'categorize' ? Object.fromEntries(arr(a.sort_key).map(x => [str(x.id), str(x.category)])) : str(a.answer);
  const misconceptions = Object.fromEntries(arr(a.misconceptions).map(m => [str(m.id), str(m.idea)]).filter(([id, idea]) => id && idea));
  const stimulus: Display[] = a.stimulus !== undefined ? readDisplays(a.stimulus) : [];
  const base: SurfaceItem = { id: 'draft', surface, prompt: str(a.prompt), stimulus, options,
    ...(surface === 'categorize' ? { categories: strs(a.categories) } : {}), key,
    ...(Object.keys(misconceptions).length ? { misconceptions } : {}),
    tier: state.tier ?? 'medium', difficulty: { band: 'easy', score: 0, reasons: [] } };
  const blocking = itemErrors(base);
  const shown = blocking.length ? base : { ...base, options: shownOrder(base, seedOfIds(options.map(o => o.id))) };
  const item: SurfaceItem = { ...shown, difficulty: difficultyOf(shown) };
  const drawings = [...stimulus, ...options.flatMap(o => (o.display ? [o.display] : []))];
  blocking.push(...displayIssues(drawings, LIFE_DISPLAYS));
  if (stimulus.length > MAX_STIMULUS) blocking.push(`stimulus: at most ${MAX_STIMULUS} displays`);
  if (!drawings.length) blocking.push('this item has only words, so nothing here could not be a worksheet. Draw it: a stimulus or drawn cards.');
  const token = options.find(o => o.display?.kind === 'svg' && o.display.svg.length < MIN_CARD_SVG);
  if (token) blocking.push(`card ${token.id}'s drawing is only a shape or two (a colored circle or square shows the child nothing). Draw what the card means, use a code-drawn display, or leave the card as words.`);
  if (!blocking.length) blocking.push(...shortcutChecks(item).map(s => `shortcut: ${s}`));
  const right = surface === 'choose' ? options.find(o => o.id === key) : undefined;
  const said = `${item.prompt} ${stimulus.map(displayText).join(' ')}`;
  if (right?.label && statesLabel(said, right.label)) blocking.push(`the prompt or a display names "${right.label}", which is the answer`);
  // The child reads these after a miss; a note about the child ("Confuses the nucleus with...") tells them nothing.
  if (Object.values(misconceptions as Record<string, string>).some(m => /^\s*(the (child|learner|student) )?(thinks|confuses|believes|mistakes|assumes)\b/i.test(m))) blocking.push('a misconception hint is written about the child. Write it to the child, as what to look at again: "A water bag stores water. Which part makes energy?"');
  if (right?.label && Object.values(misconceptions as Record<string, string>).some(m => statesLabel(m, right.label!))) blocking.push(`a misconception hint names "${right.label}", which is the answer`);
  const teach = a.teach !== undefined ? readTeach(a.teach) : undefined;
  if (teach) blocking.push(...teachIssues(teach, LIFE_DISPLAYS));
  const screen = [item.prompt, ...stimulus.map(displayText), ...options.map(o => `${o.label ?? ''} ${o.display ? displayText(o.display) : ''}`), ...(item.categories ?? [])].join(' ');
  const terms = opts?.lever ? termsOnScreen(readTerms(a.terms), screen) : readTerms(a.terms);
  blocking.push(...termIssues(terms, { text: screen, ...(surface === 'choose' ? { cards: options.map(o => ({ label: o.label, right: o.id === key })) } : {}), ...(item.categories ? { categories: item.categories } : {}) }, LIFE_DISPLAYS));
  const respond = str(a.respond) === 'say' || str(a.respond) === 'show' ? str(a.respond) as 'show' | 'say' : undefined;
  const spoken = { item, ...(respond ? { respond } : {}) };
  let answeredBy: string | undefined;
  if (!blocking.length) {
    const misfit = respondError(spoken);
    if (misfit) blocking.push(misfit);
    const said2 = misfit ? null : lifeSpokenKey(spoken);
    answeredBy = said2 ? `say (or tap): the tutor accepts ${spokenKeyText(said2)}` : 'show: the board checks it';
  }
  const keyWords = right?.label ?? (typeof key === 'string' ? key : JSON.stringify(key));
  const entry: Entry = { item, ...(teach?.length ? { teach } : {}), ...(terms.length ? { terms } : {}), ...(respond ? { respond } : {}), mode: surface, key: keyWords, band: item.difficulty.band, blocking };
  return { item: entry, result: { checks: { blocking, advisory: [] }, skill: surface, difficulty: item.difficulty, key: keyWords, ...(answeredBy ? { answeredBy } : {}) } };
}

/** What a write returns to the author (tests read it without the loop). */
export function writeWorld(state: State, a: Args) {
  const out = readWorld(state, a);
  return 'error' in out ? out : out.result;
}

/** The rules over the whole lesson: the worlds' own, then the ones that span worlds and kit items. */
function sessionOf(state: State, min = 3, entries = state.entries, enforceTier = true) {
  const worlds = entries.filter(e => e.draft);
  const tier = enforceTier ? state.tier : undefined;
  const out = sessionChecks(worlds.map(e => ({ ...e.draft!, mode: e.mode as LifeLabMode | undefined, key: e.key, band: e.band })), { tier, min: 0 });
  if (entries.length < min) out.unshift(`a session has ${min}-5 items; it has ${entries.length}`);
  if (entries.length > 5 && !out.some(x => x.startsWith('at most 5'))) out.push('at most 5 items');
  const keys = entries.map(e => e.key).filter(Boolean);
  if (new Set(keys).size !== keys.length && !out.some(x => x.includes('same answer'))) out.push('two items have the same answer; vary the answer');
  const prompts = entries.flatMap(e => (e.item ? [e.item.prompt] : []));
  if (new Set(prompts).size !== prompts.length) out.push('two items ask the same thing; vary them');
  if (entries.length >= 3 && entries.every(e => e.item) && new Set(entries.map(e => e.mode)).size === 1) out.push(`every item is a ${entries[0].mode}; vary what the child does (another surface, or a world)`);
  if (tier) {
    const order: SupportTier[] = ['easy', 'medium', 'hard'];
    entries.forEach((e, i) => {
      if (!e.item || !e.band) return;
      const gap = order.indexOf(tier) - order.indexOf(e.band);
      if (gap !== 0 && !(i === 0 && gap === 1)) out.push(`item ${i} scores ${e.band}; this session is ${tier}`);
    });
  }
  // A word the lesson taught, on the right card and no other: the child matches the word and looks at nothing (11-08: "Cell packed with mitochondria").
  const taught = new Set((entries.flatMap(e => e.teach ?? []).map(s => s.says).join(' ').toLowerCase().match(/[a-z]{5,}/g) ?? []));
  const taughtIn = (label?: string) => (label?.toLowerCase().match(/[a-z]{5,}/g) ?? []).filter(w => taught.has(w));
  entries.forEach((e, i) => {
    const it = e.item;
    if (!it || it.surface !== 'choose' || it.options.length < 3) return;
    const right = it.options.find(o => o.id === it.key);
    const words = taughtIn(right?.label);
    if (words.length && it.options.filter(o => o !== right).every(o => !taughtIn(o.label).length))
      out.push(`item ${i}: only the right card's label uses a word the lesson taught ("${words[0]}"), so the child can match the word. Let the drawings differ and label the cards plainly, or give the wrong cards taught words too.`);
  });
  if (min >= 3 && entries.length && !entries[0].teach?.length) out.push('the first item must teach: give it teach frames that show the idea before it is asked');
  return out;
}

/** What earlier items in the lesson taught: their teach frames and their Learn more words. */
const taughtBefore = (entries: readonly Entry[], index: number) => entries.slice(0, index).map(e => `${teachText(e.teach ?? [])} ${termsText(e.terms ?? [])}`).join(' ').trim();

/** Life Lab's half of the kit's lever capability: its facts, its answer words, its word-only fields. */
const LIFE_LEVERS: LeverCapability<State, Entry> = {
  facts: (e, state) => {
    if (e.item) return { mode: e.mode, key: e.key, score: e.item.difficulty.score, blocking: e.blocking };
    const c = worldChecks(e.draft!.world, e.draft!.ask, e.draft!.why, state.ctx);
    return { mode: c.mode, key: c.key, score: c.difficulty?.score, blocking: e.blocking };
  },
  leaks: (text, e) => !!e.key && e.key.length > 2 && text.toLowerCase().includes(e.key.toLowerCase()),
  wordFields: ['ask', 'why', 'prompt', 'misconceptions'],
  // Labels and names are words; what is drawn is the rest (emoji, kinds, conditions, options, positions, displays).
  drawn: e => JSON.parse(JSON.stringify(e.draft?.world ?? { stimulus: e.item!.stimulus, cards: e.item!.options }, (k, v) => (k === 'label' || k === 'name' ? undefined : v))),
  fixedFields: ['respond', 'teach', 'terms'],
  lowest: e => e.band === 'easy',
};

/** The stored session: each passing world gets its id, its code-named mode, a shuffled bench and its levers. */
export function assembleLifeLab(state: State, seed: number, grade: number | undefined, debug: Record<string, unknown>,
  leversOf: (e: Entry) => DraftLever<Entry>[] = () => []): LifeLabData {
  const rand = seededRng(seed);
  const build = (e: Entry, id: string): LifeLabChallenge => {
    const shared = { ...(e.teach?.length ? { teach: e.teach } : {}), ...(e.terms?.length ? { terms: e.terms } : {}), ...(e.respond ? { respond: e.respond } : {}) };
    if (e.item) return { id, type: e.item.surface, item: { ...e.item, id }, ask: e.item.prompt, why: '', standards: '', difficulty: e.item.difficulty, ...shared };
    const world = settleBench(e.draft!.world, rand);
    const checks = worldChecks(world, e.draft!.ask, e.draft!.why, state.ctx);
    return { id, type: checks.mode!, world, ask: e.draft!.ask, why: e.draft!.why, standards: checks.standards!, difficulty: checks.difficulty!, ...shared };
  };
  const challenges: LifeLabChallenge[] = state.entries.map((e, i) => {
    const c = build(e, `life-${i + 1}`);
    const levers = slotLevers(leversOf(e), (le, id) => build(le, `${c.id}-${id}`));
    return levers.length ? { ...c, levers } : c;
  });
  return validateLifeLabData({
    title: state.plan!.title, description: state.plan!.idea,
    gradeBand: grade !== undefined && grade >= 3 ? '3-5' : 'K-2',
    challengeType: challenges[0].type, challenges, agentDebug: debug,
  });
}

const viewOf = (e: Entry, seed: number) => (e.item ? lifeLabItemView(e.item, e.teach, e.terms) : lifeLabView(settleBench(e.draft!.world, seededRng(seed)), e.draft!.ask, e.teach, e.terms));

/** Every display an entry puts on screen, for the run record. */
const shownOn = (e: Entry) => [...(e.draft?.world.show ?? []), ...(e.item?.stimulus ?? []), ...(e.item?.options.map(o => o.display) ?? []), ...(e.teach ?? []).flatMap(s => s.show), ...(e.terms ?? []).map(t => t.display)];

const gradeNumber = (g?: string) => (g === undefined ? undefined : g.toUpperCase() === 'K' ? 0 : Number.isFinite(Number(g)) ? Number(g) : undefined);

export async function generateLifeLab(gctx: GenerationContext): Promise<LifeLabData> {
  const raw = (gctx.raw ?? {}) as { seed?: number };
  const seed = Number(raw.seed) || Math.floor(Math.random() * 2 ** 31);
  const grade = gradeNumber(gctx.grade);
  const needsObjective = !gctx.objective?.text;
  const state: State = { ...(needsObjective ? {} : { objective: gctx.objective }), entries: [], ctx: { grade }, tier: gctx.supportTier };
  const objective = objectiveOf(gctx);
  console.log(`[LifeLab] objective "${objective.slice(0, 80)}" · grade ${grade ?? '?'} · tier ${state.tier ?? 'none'}`);

  return runAuthor<State, Entry, LifeLabData>({
    tag: 'LifeLab', label: 'session', noun: 'world', topic: gctx.topic, model: MODEL,
    budget: { softMs: SOFT_DEADLINE_MS, hardMs: HARD_DEADLINE_MS, maxTurns: MAX_TURNS, minItems: 3, salvageMin: SALVAGE_MIN },
    system: systemPrompt(gctx, state.tier, grade),
    start: 'Design the Life Lab lesson now.',
    nudge: 'Use the tools: write each item or world, then finish, or decline.',
    Declined: LifeLabDeclined,
    tools: { plan: planWithObjective(PLAN_TOOL, needsObjective), remove: REMOVE_TOOL, finish: FINISH_TOOL, decline: DECLINE_TOOL },
    setPlan: (s, a) => {
      if (!str(a.title) || !str(a.idea)) return { error: 'title and idea are required' };
      if (needsObjective) {
        const written = authoredObjective(a);
        if (!written) return { error: 'this lesson has no objective: write objectiveText and objectiveVerb' };
        s.objective = written;
      }
      s.plan = { title: str(a.title), idea: str(a.idea) };
      return { ok: true };
    },
    writers: [{ decl: ITEM_TOOL, write: readItem }, { decl: WORLD_TOOL, write: readWorld }],
    checks: (s, items, min, opts) => {
      // Out of budget, a world off its tier still ships: a lesson a band away beats no lesson.
      const blocking = [...items.flatMap((e, i) => e.blocking.map(b => `world ${i}: ${b}`)), ...sessionOf(s, min, items, !opts?.salvaged)];
      if (!s.plan) blocking.unshift('call plan_session first');
      return { blocking };
    },
    summarize: (e, i) => `${i}. ${e.mode ?? '?'} (${e.band ?? '?'})${e.teach?.length ? ' teaches first,' : ''} "${(e.draft?.ask ?? e.item?.prompt ?? '').slice(0, 80)}"${e.blocking.length ? ` BLOCKED: ${e.blocking[0]}` : ''}`,
    salvage: (s, items) => ({ items: items.filter(e => !e.blocking.length).slice(0, 5),
      note: `salvaged: shipped the passing worlds after the budget ran out${s.tier ? ` (requested tier ${s.tier} not enforced)` : ''}` }),
    levers: LIFE_LEVERS,
    // The bench is shuffled as it will ship, so the reader never sees stages in the order the author wrote them.
    look: { grade: grade === undefined ? 'elementary' : grade === 0 ? 'Kindergarten' : `grade ${grade}`, objective: s => s.objective?.text ?? objective,
      view: (_s, e, at) => ({ ...viewOf(e, seed), taught: taughtBefore(at.items, at.index) }) },
    displays: { offered: displayMenu(LIFE_DISPLAYS), shown: shownOn },
    ship: (s, items, { debug, leversOf }) => assembleLifeLab({ ...s, entries: items }, seed, grade, { ...debug, objective: s.objective ?? objective }, leversOf),
  }, state, { objective, tier: state.tier });
}

export const __test = { worldOf, writeWorld, readWorld, readItem, taughtBefore, assembleLifeLab, systemPrompt, sessionOf, LIFE_LEVERS, viewOf };
export type { State as LifeLabAuthorState };
