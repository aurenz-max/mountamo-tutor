/**
 * Drawer generators. Gemini writes a small spec; drawerSpecs.ts checks it in code. A spec that
 * fails is sent back once or twice with the problems listed; if it still fails the generator
 * throws, so a learner never sees a wrong number or a broken chain. No fallback content.
 *
 * Model: gemini-flash-lite-latest, as most generators use. Array sizes are bounded in the
 * prompt and checked in code, not with maxItems.
 */
import { Type, type Schema } from '@google/genai';
import { ai } from '../geminiClient';
import {
  causeChainProblems, modelSliderProblems, partWholeProblems,
  type DrawerCauseChainData, type DrawerModelSliderData, type DrawerPartWholeData, type DrawerProblem,
} from '../../primitives/visual-primitives/drawers/drawerSpecs';

const MODEL = 'gemini-flash-lite-latest';
const ATTEMPTS = 3;

export interface DrawerAsk { topic: string; gradeContext: string; intent?: string; title?: string }

export const brief = (a: DrawerAsk) =>
  `Lesson topic: ${a.topic}\nWhat this display is for: ${a.intent || a.title || a.topic}\nAudience: ${a.gradeContext}\n`;

export async function generateChecked<Raw, Data>(kind: string, schema: Schema, prompt: string,
  build: (raw: Raw) => Data, problems: (d: Data) => DrawerProblem[]): Promise<Data> {
  let feedback = '';
  let last: DrawerProblem[] = [];
  for (let attempt = 1; attempt <= ATTEMPTS; attempt++) {
    const res = await ai.models.generateContent({
      model: MODEL,
      contents: prompt + feedback,
      config: { responseMimeType: 'application/json', responseSchema: schema },
    });
    let data: Data;
    try { data = build(JSON.parse(res.text ?? '{}') as Raw); } catch (e) { last = [`unreadable output: ${(e as Error).message}`]; continue; }
    last = problems(data);
    if (!last.length) {
      if (attempt > 1) console.log(`[drawer:${kind}] passed checks on attempt ${attempt}`);
      return data;
    }
    console.warn(`[drawer:${kind}] attempt ${attempt} failed checks:`, last);
    feedback = `\n\nYour previous answer failed these checks. Fix every one:\n- ${last.join('\n- ')}\n`;
  }
  throw new Error(`[drawer:${kind}] no spec passed its checks after ${ATTEMPTS} attempts: ${last.join('; ')}`);
}

// ---------------------------------------------------------------------------
// model-slider
// ---------------------------------------------------------------------------

const modelSliderSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    title: { type: Type.STRING, description: 'A question the display answers, e.g. "How far does a car travel before it stops?"' },
    caption: { type: Type.STRING, description: 'One sentence telling the learner what to watch for, without stating the result.' },
    inputs: {
      type: Type.ARRAY, description: '1-3 quantities on sliders.',
      items: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.STRING, description: 'Short variable name used in formulas: letters only, e.g. "speed".' },
          label: { type: Type.STRING }, unit: { type: Type.STRING, description: 'Unit shown after the value; empty string if none.' },
          min: { type: Type.NUMBER }, max: { type: Type.NUMBER }, step: { type: Type.NUMBER },
          value: { type: Type.NUMBER, description: 'Starting value, between min and max and on a step.' },
        },
        required: ['id', 'label', 'unit', 'min', 'max', 'step', 'value'],
      },
    },
    outputs: {
      type: Type.ARRAY, description: '1-3 results computed from the inputs. A later output may use earlier output ids.',
      items: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.STRING, description: 'Short variable name, letters only.' },
          label: { type: Type.STRING }, unit: { type: Type.STRING },
          expr: { type: Type.STRING, description: 'Formula using input ids, earlier output ids, numbers, + - * / ^ and parentheses. Allowed functions: min max sqrt abs round floor ceil log10 ln exp. Include unit conversions in the formula.' },
          digits: { type: Type.INTEGER, description: 'Decimal places to show, 0-3.' },
          primary: { type: Type.BOOLEAN, description: 'True for the one result the display is about.' },
        },
        required: ['id', 'label', 'unit', 'expr', 'digits', 'primary'],
      },
    },
    barParts: { type: Type.ARRAY, items: { type: Type.STRING }, description: 'Ids of 2-3 outputs with the same unit that add up to a total, drawn as one stacked bar. Empty if no outputs add up that way.' },
    checkSettings: { type: Type.STRING, description: 'Input settings for a known real-world fact, as "id=value; id=value". At least one must differ from its starting value.' },
    checkOutput: { type: Type.STRING, description: 'The output id the fact gives a value for.' },
    checkExpect: { type: Type.NUMBER, description: 'The value the fact states, independent of your formula.' },
    checkTolerance: { type: Type.NUMBER, description: 'How far off still agrees with the fact, at most 5% of checkExpect.' },
    checkFact: { type: Type.STRING, description: 'The fact in one plain sentence, with its numbers.' },
  },
  required: ['title', 'caption', 'inputs', 'outputs', 'barParts', 'checkSettings', 'checkOutput', 'checkExpect', 'checkTolerance', 'checkFact'],
};

interface ModelSliderRaw extends Omit<DrawerModelSliderData, 'check'> {
  checkSettings: string; checkOutput: string; checkExpect: number; checkTolerance: number; checkFact: string;
}

export const parseSettings = (s: string) => Object.fromEntries((s || '').split(/[;,]/).map(x => x.split('=').map(y => y.trim()))
  .filter(([k, v]) => k && v !== undefined && Number.isFinite(Number(v))).map(([k, v]) => [k, Number(v)]));

export const generateDrawerModelSlider = (ask: DrawerAsk): Promise<DrawerModelSliderData> =>
  generateChecked<ModelSliderRaw, DrawerModelSliderData>('model-slider', modelSliderSchema,
    `You are designing an explorable model for a lesson: sliders for the quantities in a real relationship and the `
    + `results computed from them.\n${brief(ask)}\n`
    + `Pick the one relationship from this lesson that is most worth exploring. It must be an established formula with `
    + `real constants, as found in a textbook (physics, chemistry, geometry, measurement, finance); never invent a formula `
    + `to imitate a qualitative idea. Ranges must be realistic and must keep every formula defined (no division by zero, no square root `
    + `of a negative) everywhere on the sliders. Use words the audience knows in labels.\n`
    + `The check is a known fact from outside your formula (a textbook value, a measured figure). It proves the `
    + `formula is right, so state the value the fact gives, not a number you computed. The check setting must differ `
    + `from the starting values.`,
    raw => ({
      title: raw.title, caption: raw.caption, inputs: raw.inputs, outputs: raw.outputs,
      barParts: raw.barParts ?? [],
      check: { set: parseSettings(raw.checkSettings), output: raw.checkOutput, expect: raw.checkExpect, tolerance: raw.checkTolerance, fact: raw.checkFact },
    }),
    modelSliderProblems);

// ---------------------------------------------------------------------------
// part-whole
// ---------------------------------------------------------------------------

const partWholeSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    title: { type: Type.STRING, description: 'A question, e.g. "What is air made of?"' },
    caption: { type: Type.STRING, description: 'One sentence pointing at what is surprising, without giving the numbers.' },
    wholeLabel: { type: Type.STRING, description: 'What the whole is, as it reads after "of": "the air", "Earth\'s water".' },
    unit: { type: Type.STRING, description: '"%" when values are percentages, otherwise the unit of every value.' },
    total: { type: Type.NUMBER, description: 'The whole. 100 when unit is "%".' },
    parts: {
      type: Type.ARRAY, description: '2-6 top-level parts that add up exactly to total, plus optionally 2-4 parts that break down ONE small top-level part.',
      items: {
        type: Type.OBJECT,
        properties: {
          label: { type: Type.STRING },
          value: { type: Type.NUMBER },
          parent: { type: Type.STRING, description: 'Empty for a top-level part; for a breakdown part, the exact label of the top-level part it breaks down.' },
        },
        required: ['label', 'value', 'parent'],
      },
    },
  },
  required: ['title', 'caption', 'wholeLabel', 'unit', 'total', 'parts'],
};

export const generateDrawerPartWhole = (ask: DrawerAsk): Promise<DrawerPartWholeData> =>
  generateChecked<DrawerPartWholeData, DrawerPartWholeData>('part-whole', partWholeSchema,
    `You are designing a part-whole display for a lesson: a real whole split into named parts.\n${brief(ask)}\n`
    + `Use real, published figures. The top-level parts must add up exactly to the total; if the real figures have a `
    + `small remainder, name it ("Everything else", "Other") and give it the remainder. If one part is too small to see `
    + `and its contents matter to the lesson, break that one part down; its breakdown must add up exactly to it.`,
    raw => ({ ...raw, parts: (raw.parts ?? []).map(p => ({ ...p, parent: p.parent ?? '' })) }),
    partWholeProblems);

// ---------------------------------------------------------------------------
// cause-chain
// ---------------------------------------------------------------------------

const causeChainSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    title: { type: Type.STRING },
    caption: { type: Type.STRING, description: 'One sentence inviting a prediction, without giving any effect away.' },
    nodes: {
      type: Type.ARRAY, description: '3-5 things in order; the first is what the learner changes.',
      items: {
        type: Type.OBJECT,
        properties: { id: { type: Type.STRING }, label: { type: Type.STRING, description: 'A plural noun phrase that can "go up" or "go down", e.g. "Sea otters", "Prices".' } },
        required: ['id', 'label'],
      },
    },
    links: {
      type: Type.ARRAY, description: 'Exactly one link between each pair of neighbouring nodes, in order.',
      items: {
        type: Type.OBJECT,
        properties: {
          from: { type: Type.STRING }, to: { type: Type.STRING },
          effect: { type: Type.STRING, enum: ['same', 'opposite'], description: 'same: when "from" goes up, "to" goes up. opposite: when "from" goes up, "to" goes down.' },
          because: { type: Type.STRING, description: 'The reason in one short clause, e.g. "Sea otters eat sea urchins".' },
        },
        required: ['from', 'to', 'effect', 'because'],
      },
    },
  },
  required: ['title', 'caption', 'nodes', 'links'],
};

export const generateDrawerCauseChain = (ask: DrawerAsk): Promise<DrawerCauseChainData> =>
  generateChecked<DrawerCauseChainData, DrawerCauseChainData>('cause-chain', causeChainSchema,
    `You are designing a cause-and-effect chain for a lesson: one change at the start travels link by link.\n${brief(ask)}\n`
    + `Use a chain that is well established for this topic. Each link must be a real, direct effect, and the reason `
    + `must say why in words the audience knows.`,
    raw => raw,
    causeChainProblems);
