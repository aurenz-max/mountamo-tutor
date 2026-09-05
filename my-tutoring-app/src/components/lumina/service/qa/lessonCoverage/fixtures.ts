/**
 * Coverage-eval fixtures — the five cases the evaluator must get right, built
 * as the `ExhibitData` the frontend would render (manifest + brief +
 * orderedComponents), through the same shapes the real generators emit.
 *
 *   1 fullCoverage        uppercase M taught, three find-it items → ASSESSED_SUFFICIENTLY
 *   2 taughtNotTested     lowercase m taught, only uppercase assessed → TAUGHT_NOT_ASSESSED · CRITICAL
 *   3 missingObjective    letter T declared, never appears → NOT_TAUGHT · CRITICAL
 *   4 indirect            objective is PRODUCING /m/, items only tap the letter → INDIRECTLY / INSUFFICIENTLY
 *   5 guardInduced        objective is /t/, the continuant guard reports unaskableLetters=["t"]
 *                         and no production item contains t → zero assessment + content_guard
 *
 * Case 5 is the phonics defect that motivated the evaluator (Lesson Bench
 * item 17): the lesson looked valid while t and p never had a production
 * surface. It is a permanent regression fixture.
 */
import type { ExhibitData, ExhibitManifest, IntroBriefingData, ManifestItem, ObjectiveData, OrderedComponent } from '../../../types';

export interface FixtureBlock {
  instanceId: string;
  componentId: string;
  title: string;
  intent: string;
  objectiveIds: string[];
  data: unknown;
  targetEvalMode?: string;
  /** Present in the manifest but absent from the assembled lesson (generation failed). */
  missing?: boolean;
}

export interface FixtureSpec {
  topic: string;
  gradeLevel?: string;
  objectives: Array<Pick<ObjectiveData, 'id' | 'text' | 'verb'> & Partial<ObjectiveData>>;
  blocks: FixtureBlock[];
  finalAssessment?: FixtureBlock;
}

export function makeExhibit(spec: FixtureSpec): ExhibitData {
  const gradeLevel = spec.gradeLevel ?? 'kindergarten';
  const objectives: ObjectiveData[] = spec.objectives.map((o) => ({ icon: '🔤', grade: 'K', ...o }));
  const byObjective = new Map<string, FixtureBlock[]>();
  for (const b of spec.blocks) {
    const owner = b.objectiveIds[0];
    byObjective.set(owner, [...(byObjective.get(owner) ?? []), b]);
  }
  const manifest: ExhibitManifest = {
    topic: spec.topic,
    gradeLevel,
    themeColor: '#F59E0B',
    subject: 'LANGUAGE_ARTS',
    curatorBrief: { instanceId: 'brief-intro', title: 'Welcome', intent: 'Introduce the lesson' },
    objectiveBlocks: objectives.map((o) => ({
      objectiveId: o.id,
      objectiveText: o.text,
      objectiveVerb: o.verb,
      components: (byObjective.get(o.id) ?? []).map((b) => ({
        componentId: b.componentId as ManifestItem['componentId'],
        instanceId: b.instanceId,
        title: b.title,
        intent: b.intent,
        config: b.targetEvalMode ? { targetEvalMode: b.targetEvalMode } : {},
      })),
    })),
    ...(spec.finalAssessment
      ? {
          finalAssessment: {
            componentId: 'knowledge-check' as const,
            instanceId: spec.finalAssessment.instanceId,
            title: spec.finalAssessment.title,
            intent: spec.finalAssessment.intent,
            config: spec.finalAssessment.targetEvalMode ? { targetEvalMode: spec.finalAssessment.targetEvalMode } : {},
          },
        }
      : {}),
  };
  const allBlocks = [...spec.blocks, ...(spec.finalAssessment ? [spec.finalAssessment] : [])];
  manifest.layout = [
    { componentId: 'curator-brief', instanceId: 'brief-intro', title: 'Welcome', intent: 'Introduce the lesson', objectiveIds: objectives.map((o) => o.id) },
    ...allBlocks.map((b): ManifestItem => {
      const owner = objectives.find((o) => o.id === b.objectiveIds[0]);
      return {
        componentId: b.componentId as ManifestItem['componentId'],
        instanceId: b.instanceId,
        title: b.title,
        intent: b.intent,
        config: {
          ...(b.targetEvalMode ? { targetEvalMode: b.targetEvalMode } : {}),
          objectiveId: b.objectiveIds[0],
          objectiveText: owner?.text,
          objectiveVerb: owner?.verb,
          subskillId: owner?.subskillId,
          skillId: owner?.skillId,
          objectiveGrade: owner?.grade ?? 'K',
          intent: b.intent,
        },
        objectiveIds: b.objectiveIds,
      };
    }),
  ];
  const introBriefing: IntroBriefingData = {
    primitive: 'intro_briefing',
    topic: spec.topic,
    subject: 'Language Arts',
    gradeLevel,
    estimatedTime: '15 minutes',
    hook: { type: 'question', content: `Today we learn about ${spec.topic}.`, visual: '🔤' },
    bigIdea: { statement: spec.topic, whyItMatters: 'Letters and sounds unlock reading.' },
    objectives,
    prerequisites: { shouldKnow: [], quickCheck: { question: '', answer: '', hint: '' } },
    roadmap: [],
    connections: { buildingFrom: [], leadingTo: [], realWorld: [] },
    mindset: { encouragement: '', growthTip: '' },
  };
  const orderedComponents: OrderedComponent[] = [
    { componentId: 'curator-brief', instanceId: 'brief-intro', title: 'Welcome', data: introBriefing, objectiveIds: objectives.map((o) => o.id) },
    ...allBlocks
      .filter((b) => !b.missing)
      .map((b): OrderedComponent => ({
        componentId: b.componentId as OrderedComponent['componentId'],
        instanceId: b.instanceId,
        title: b.title,
        data: { ...(b.data as Record<string, unknown>), __instanceId: b.instanceId },
        objectiveIds: b.objectiveIds,
      })),
  ];
  return {
    topic: spec.topic,
    themeColor: manifest.themeColor,
    manifest,
    introBriefing,
    intro: { hook: introBriefing.hook.content, objectives: objectives.map((o) => o.text) },
    orderedComponents,
    cards: [],
    featureExhibit: null,
    comparison: null,
    tables: [],
    graphBoards: [],
    scaleSpectrums: [],
    annotatedExamples: [],
    nestedHierarchies: [],
    imagePanels: [],
    takeHomeActivities: [],
    knowledgeCheck: null,
    specializedExhibits: [],
    relatedTopics: [],
  } as unknown as ExhibitData;
}

// ── Shared block builders (shapes copied from real generator output) ────────
const letterCard = (letter: string, word: string, note: string) => ({
  title: `${word[0].toUpperCase()}${word.slice(1)}`,
  subheading: `The letter ${letter}`,
  definition: note,
  conceptElements: [{ label: `Letter ${letter}`, type: 'primary' }],
  curiosityNote: `Say it with me: ${word}!`,
});

const findIt = (id: string, targetLetter: string, targetCase: 'uppercase' | 'lowercase', grid: string[]) => ({
  id,
  mode: 'find-it',
  targetLetter,
  targetCase,
  letterGrid: grid,
  targetCount: 1,
  showTargetReference: true,
});

const soundChallenge = (id: string, letter: string, spoken: string, keyword: string) => ({
  id,
  challengeType: 'letter_sound',
  letter,
  spoken,
  keyword,
  elicitation: 'isolated',
  supportTier: 'medium',
});

const seeHear = (id: string, letter: string, sound: string, word: string) => ({
  id,
  mode: 'see-hear',
  targetLetter: letter,
  targetSound: sound,
  keywordWord: word,
  options: [],
  showKeywordAnchor: 'never',
  auditionBeforeCommit: true,
});

const UPPER_GRID_M = ['A', 'S', 'M', 'T', 'N', 'P', 'I', 'A', 'S', 'T', 'N', 'P', 'I', 'A', 'S', 'T'];

// ── Case 1 — full coverage ──────────────────────────────────────────────────
export const fullCoverage = (): ExhibitData =>
  makeExhibit({
    topic: 'Recognizing uppercase M',
    objectives: [{ id: 'obj1', text: 'Identify uppercase M.', verb: 'identify' }],
    blocks: [
      { instanceId: 'obj1-cards', componentId: 'concept-card-grid', title: 'Meet the letter M', intent: 'Introduce uppercase M with a keyword picture', objectiveIds: ['obj1'],
        data: { cards: [letterCard('M', 'moon', 'Uppercase M has two tall mountains.')] } },
      { instanceId: 'obj1-spotter', componentId: 'letter-spotter', title: 'Spot the M', intent: 'Find uppercase M among other letters', objectiveIds: ['obj1'], targetEvalMode: 'find_it',
        data: { title: 'Spot the M', challenges: [
          findIt('ch1', 'm', 'uppercase', UPPER_GRID_M),
          findIt('ch2', 'm', 'uppercase', ['T', 'N', 'M', 'A', 'S', 'P', 'I', 'T', 'N', 'A', 'S', 'P', 'I', 'T', 'N', 'A']),
          findIt('ch3', 'm', 'uppercase', ['P', 'I', 'A', 'S', 'T', 'N', 'M', 'P', 'I', 'A', 'S', 'T', 'N', 'P', 'I', 'A']),
        ], letterGroup: 3, cumulativeLetters: ['m'], newLetters: ['m'], supportTier: 'medium' } },
    ],
  });

// ── Case 2 — taught but not tested ──────────────────────────────────────────
export const taughtNotTested = (): ExhibitData =>
  makeExhibit({
    topic: 'Uppercase and lowercase M',
    objectives: [
      { id: 'obj1', text: 'Identify uppercase M.', verb: 'identify' },
      { id: 'obj2', text: 'Identify lowercase m.', verb: 'identify' },
    ],
    blocks: [
      { instanceId: 'obj1-cards', componentId: 'concept-card-grid', title: 'Big M', intent: 'Introduce uppercase M', objectiveIds: ['obj1'],
        data: { cards: [letterCard('M', 'moon', 'Uppercase M has two tall mountains.')] } },
      { instanceId: 'obj1-spotter', componentId: 'letter-spotter', title: 'Spot the big M', intent: 'Find uppercase M', objectiveIds: ['obj1'], targetEvalMode: 'find_it',
        data: { title: 'Spot the big M', challenges: [
          findIt('ch1', 'm', 'uppercase', UPPER_GRID_M),
          findIt('ch2', 'm', 'uppercase', ['T', 'N', 'M', 'A', 'S', 'P', 'I', 'T', 'N', 'A', 'S', 'P', 'I', 'T', 'N', 'A']),
          findIt('ch3', 'm', 'uppercase', ['P', 'I', 'A', 'S', 'T', 'N', 'M', 'P', 'I', 'A', 'S', 'T', 'N', 'P', 'I', 'A']),
        ], supportTier: 'medium' } },
      { instanceId: 'obj2-cards', componentId: 'concept-card-grid', title: 'Little m', intent: 'Introduce lowercase m', objectiveIds: ['obj2'],
        data: { cards: [letterCard('m', 'mitten', 'Lowercase m is small with two humps.')] } },
    ],
  });

// ── Case 3 — declared objective completely missing ──────────────────────────
export const missingObjective = (): ExhibitData =>
  makeExhibit({
    topic: 'Letters M and T',
    objectives: [
      { id: 'obj1', text: 'Identify uppercase M.', verb: 'identify' },
      { id: 'obj2', text: 'Identify letter T.', verb: 'identify' },
    ],
    blocks: [
      { instanceId: 'obj1-cards', componentId: 'concept-card-grid', title: 'Meet M', intent: 'Introduce uppercase M', objectiveIds: ['obj1'],
        data: { cards: [letterCard('M', 'moon', 'Uppercase M has two tall mountains.')] } },
      { instanceId: 'obj1-spotter', componentId: 'letter-spotter', title: 'Spot the M', intent: 'Find uppercase M', objectiveIds: ['obj1'], targetEvalMode: 'find_it',
        data: { title: 'Spot the M', challenges: [
          findIt('ch1', 'm', 'uppercase', ['A', 'S', 'M', 'N', 'P', 'I', 'A', 'S', 'N', 'P', 'I', 'A', 'S', 'N', 'P', 'I']),
          findIt('ch2', 'm', 'uppercase', ['N', 'M', 'A', 'S', 'P', 'I', 'N', 'A', 'S', 'P', 'I', 'N', 'A', 'S', 'P', 'I']),
        ], supportTier: 'medium' } },
      // The manifest planned a T block; generation failed, so the student never saw it.
      { instanceId: 'obj2-spotter', componentId: 'letter-spotter', title: 'Spot the T', intent: 'Find letter T', objectiveIds: ['obj2'], targetEvalMode: 'find_it', data: null, missing: true },
    ],
  });

// ── Case 4 — indirect assessment ────────────────────────────────────────────
export const indirectAssessment = (): ExhibitData =>
  makeExhibit({
    topic: 'The /m/ sound',
    objectives: [{ id: 'obj1', text: 'Produce the /m/ sound when shown the letter m.', verb: 'apply' }],
    blocks: [
      { instanceId: 'obj1-cards', componentId: 'concept-card-grid', title: 'Mmm says m', intent: 'Model the /m/ sound', objectiveIds: ['obj1'],
        data: { cards: [letterCard('m', 'moon', 'Press your lips together and hum: mmm.')] } },
      { instanceId: 'obj1-spotter', componentId: 'letter-spotter', title: 'Spot the m', intent: 'Find the letter m', objectiveIds: ['obj1'], targetEvalMode: 'find_it',
        data: { title: 'Spot the m', challenges: [
          findIt('ch1', 'm', 'lowercase', ['a', 's', 'm', 't', 'n', 'p', 'i', 'a', 's', 't', 'n', 'p', 'i', 'a', 's', 't']),
          findIt('ch2', 'm', 'lowercase', ['t', 'n', 'm', 'a', 's', 'p', 'i', 't', 'n', 'a', 's', 'p', 'i', 't', 'n', 'a']),
          findIt('ch3', 'm', 'lowercase', ['p', 'i', 'a', 's', 't', 'n', 'm', 'p', 'i', 'a', 's', 't', 'n', 'p', 'i', 'a']),
        ], supportTier: 'medium' } },
    ],
  });

// ── Case 5 — guard-induced failure (the motivating phonics defect) ──────────
export const guardInduced = (): ExhibitData =>
  makeExhibit({
    topic: 'Letter-Sound Group 1: s, a, t',
    objectives: [
      { id: 'obj1', text: 'Produce the most common sound for s and a when shown the letter.', verb: 'apply' },
      { id: 'obj2', text: 'Produce a crisp /t/ sound (not "tuh") when shown the letter t.', verb: 'apply' },
    ],
    blocks: [
      { instanceId: 'obj1-cards', componentId: 'concept-card-grid', title: 'Sun, apple, tiger', intent: 'Introduce s, a and t with keyword pictures', objectiveIds: ['obj1'],
        data: { cards: [
          letterCard('s', 'sun', 'The sun hisses: sss.'),
          letterCard('a', 'apple', 'Apple says: a, a, a.'),
          letterCard('t', 'tiger', 'Tiger says a crisp: t.'),
        ] } },
      { instanceId: 'obj1-di-sounds', componentId: 'di-letter-sounds', title: 'Say the sound', intent: 'Drill the sounds for s, a and t out loud', objectiveIds: ['obj1'], targetEvalMode: 'letter_sound',
        data: {
          title: 'Say the sound',
          description: 'Say each letter sound out loud.',
          challengeType: 'letter_sound',
          challenges: [
            soundChallenge('dils-1-s', 's', 'sss', 'sun'),
            soundChallenge('dils-2-a', 'a', 'aaa', 'apple'),
            soundChallenge('dils-3-s', 's', 'sss', 'sock'),
            soundChallenge('dils-4-a', 'a', 'aaa', 'ant'),
          ],
          letters: 's, a, s, a',
          // The continuant menu cannot drill a stop consonant; the generator reports it instead of substituting.
          unaskableLetters: ['t'],
        } },
      { instanceId: 'obj2-sound-link', componentId: 'letter-sound-link', title: 'See it, say it', intent: 'Show the letter, the child says its sound', objectiveIds: ['obj2'], targetEvalMode: 'see_hear',
        data: {
          title: 'See it, say it',
          letterGroup: 1,
          cumulativeLetters: ['s', 'a', 't'],
          challenges: [seeHear('ch1', 's', '/s/', 'sun'), seeHear('ch2', 'a', '/ă/', 'apple')],
          unaskableLetters: ['t'],
          supportTier: 'medium',
        } },
    ],
  });

export const FIXTURES = {
  fullCoverage,
  taughtNotTested,
  missingObjective,
  indirectAssessment,
  guardInduced,
} as const;
