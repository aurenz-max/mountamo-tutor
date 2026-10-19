/**
 * 3d-shape-explorer's domain: the code-owned geometry table, the item build (one spoken answer per item), the ask,
 * the spoken key and known misses, the scene, and the harness answers. Pure: the boss, the levers, the component,
 * the generator and the tests read it.
 */
import type { JudgedScriptItem, ResponseClassId } from '../../../hooks/judgedScriptContract';
import type { SceneOf } from '../../../components/live-activity/bossLevers';
import type { SpokenKey } from '../../../components/live-activity/spokenKey';
import { numberMisses, offByMisses, type KnownMiss, type OffByMiss } from '../../../components/live-activity/runtime/spokenMissContract';

export const THREE_D_SHAPES = [
  'cube',
  'sphere',
  'cylinder',
  'cone',
  'rectangular-prism',
] as const;

export const TWO_D_SHAPES = ['circle', 'square', 'triangle', 'rectangle'] as const;

export type ThreeDShapeName = (typeof THREE_D_SHAPES)[number];
export type TwoDShapeName = (typeof TWO_D_SHAPES)[number];
export type ShapeName = ThreeDShapeName | TwoDShapeName;
export type ThreeDShapeMode =
  | 'identify-3d'
  | '2d-vs-3d'
  | 'match-to-real-world'
  | 'faces-and-properties'
  | 'shape-riddle';
export type ThreeDShapeTier = 'easy' | 'medium' | 'hard';
export type PropertyKey =
  | 'flatFaces'
  | 'curvedSurfaces'
  | 'faceShape'
  | 'canRoll'
  | 'canStack'
  | 'canSlide';

export interface ShapeFacts {
  flatFaces: number;
  curvedSurfaces: number;
  faceShapes: readonly TwoDShapeName[];
  canRoll: boolean;
  canStack: boolean;
  canSlide: boolean;
}

/** One source of geometry truth, shared by the generator, pack, and tests. */
export const SHAPE_FACTS: Record<ThreeDShapeName, ShapeFacts> = {
  cube: { flatFaces: 6, curvedSurfaces: 0, faceShapes: ['square'], canRoll: false, canStack: true, canSlide: true },
  sphere: { flatFaces: 0, curvedSurfaces: 1, faceShapes: [], canRoll: true, canStack: false, canSlide: false },
  cylinder: { flatFaces: 2, curvedSurfaces: 1, faceShapes: ['circle'], canRoll: true, canStack: true, canSlide: true },
  cone: { flatFaces: 1, curvedSurfaces: 1, faceShapes: ['circle'], canRoll: true, canStack: false, canSlide: true },
  'rectangular-prism': { flatFaces: 6, curvedSurfaces: 0, faceShapes: ['rectangle'], canRoll: false, canStack: true, canSlide: true },
};

export const SHAPE_LABELS: Record<ThreeDShapeName, string> = {
  cube: 'cube',
  sphere: 'sphere',
  cylinder: 'cylinder',
  cone: 'cone',
  'rectangular-prism': 'rectangular prism',
};

export const COLLECTION_ITEM_CAP = 4;
export const SESSION_ITEM_CAP = 6;

const NUMBER_WORDS = [
  '', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine',
  'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen',
  'seventeen', 'eighteen', 'nineteen', 'twenty',
] as const;

const RIDDLE_CLUES: Record<ThreeDShapeName, readonly string[]> = {
  cube: ['I have six flat faces.', 'Every flat face is a square.', 'I can stack, but I do not roll smoothly.'],
  sphere: ['I have no flat faces.', 'I have one curved surface.', 'I can roll in every direction.'],
  cylinder: ['I have two flat circular faces.', 'I have one curved surface.', 'I can roll and I can stack.'],
  cone: ['I have one flat circular face.', 'I have one point.', 'I can roll, but I do not stack.'],
  'rectangular-prism': ['I have six flat faces.', 'Every flat face is a rectangle.', 'I can stack, but I do not roll smoothly.'],
};

export interface ThreeDShapePropertyQuestionLike {
  question?: string;
  answerType?: 'boolean' | 'number' | 'choice' | string;
  correctAnswer?: string | number | boolean;
  options?: string[];
  propertyKey?: PropertyKey | string;
}

export interface ThreeDShapeChallengeLike {
  id: string;
  type: ThreeDShapeMode | string;
  instruction?: string;
  shape3d?: string;
  options?: string[];
  mixedShapes?: Array<{ name: string; emoji?: string; is3d: boolean }>;
  matchPairs?: Array<{ realWorldObject: string; emoji?: string; shape3d: string }>;
  displayShape?: string;
  properties?: {
    flatFaces: number;
    curvedSurfaces: number;
    faceShapes: string[];
    canRoll: boolean;
    canStack: boolean;
    canSlide: boolean;
  };
  propertyQuestions?: ThreeDShapePropertyQuestionLike[];
  clues?: string[];
  supportTier?: ThreeDShapeTier;
  showElementLabels?: boolean;
  showFaceHighlight?: boolean;
}

export type ThreeDShapeItemKind =
  | 'identify_shape'
  | 'classify_dimension'
  | 'match_object'
  | 'count_property'
  | 'judge_property'
  | 'name_face_shape'
  | 'solve_riddle';

export interface ThreeDShapeItem extends JudgedScriptItem {
  id: string;
  challengeId: string;
  sourceChallengeId: string;
  sourceMode: ThreeDShapeMode;
  kind: ThreeDShapeItemKind;
  action: ThreeDShapeItemKind;
  answerKind: 'voice';
  responseClass: ResponseClassId;
  answer: string;
  spokenAlternates: string[];
  stimulus: string;
  supportTier: ThreeDShapeTier;
  shape?: ShapeName;
  shape3d?: ThreeDShapeName;
  is3d?: boolean;
  objectName?: string;
  emoji?: string;
  propertyKey?: PropertyKey;
  propertyValue?: number | boolean | string;
  clues?: string[];
  showElementLabels: boolean;
  showFaceHighlight: boolean;
  /** Stable within-action ask rotation; prevents back-to-back recitation. */
  askVariant?: number;
}

export interface ThreeDShapeDrop {
  challengeId: string;
  childId?: string;
  reason: string;
}

export interface ThreeDShapeBuildResult {
  items: ThreeDShapeItem[];
  droppedChallenges: number;
  droppedItems: ThreeDShapeDrop[];
}

const isThreeDShape = (value: unknown): value is ThreeDShapeName =>
  typeof value === 'string' && (THREE_D_SHAPES as readonly string[]).includes(value);
const isTwoDShape = (value: unknown): value is TwoDShapeName =>
  typeof value === 'string' && (TWO_D_SHAPES as readonly string[]).includes(value);
export const isCanonicalShapeName = (value: unknown): value is ShapeName =>
  isThreeDShape(value) || isTwoDShape(value);

const normalized = (value: unknown): string => String(value ?? '')
  .toLowerCase()
  .replace(/[-_]/g, ' ')
  .replace(/[^a-z0-9\s]/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();

const sameFacts = (actual: ThreeDShapeChallengeLike['properties'], expected: ShapeFacts): boolean =>
  !!actual
  && actual.flatFaces === expected.flatFaces
  && actual.curvedSurfaces === expected.curvedSurfaces
  && actual.canRoll === expected.canRoll
  && actual.canStack === expected.canStack
  && actual.canSlide === expected.canSlide
  && actual.faceShapes.length === expected.faceShapes.length
  && actual.faceShapes.every((face, index) => face === expected.faceShapes[index]);

export const canonicalPropertiesFor = (shape: ThreeDShapeName) => ({
  ...SHAPE_FACTS[shape],
  faceShapes: [...SHAPE_FACTS[shape].faceShapes],
});

export const canonicalRiddleCluesFor = (shape: ThreeDShapeName): string[] =>
  [...RIDDLE_CLUES[shape]];

export const riddleCandidatesForClues = (clues: readonly string[]): ThreeDShapeName[] => {
  const key = clues.map(normalized).sort().join('|');
  return THREE_D_SHAPES.filter(
    (shape) => RIDDLE_CLUES[shape].map(normalized).sort().join('|') === key,
  );
};

export const validateRiddleClues = (
  shape: ThreeDShapeName,
  clues: readonly string[],
): string[] => {
  const issues: string[] = [];
  const answerTokens = [SHAPE_LABELS[shape], shape];
  if (clues.length < 2) issues.push('riddle needs at least two clues');
  for (const clue of clues) {
    const text = normalized(clue);
    if (answerTokens.some((token) => text.includes(normalized(token)))) {
      issues.push('riddle clue contains the answer name');
    }
  }
  const candidates = riddleCandidatesForClues(clues);
  if (candidates.length !== 1 || candidates[0] !== shape) {
    issues.push('riddle clues are not the code-owned, unique fact set for the keyed shape');
  }
  return issues;
};

export const isSayableObjectName = (value: unknown): value is string => {
  if (typeof value !== 'string') return false;
  const text = value.trim();
  if (!/^[A-Za-z][A-Za-z ]{0,27}$/.test(text)) return false;
  if (text.split(/\s+/).length > 4) return false;
  return !/^(say|tell|answer|ignore|system|assistant|click|tap|choose)\b/i.test(text);
};

export const objectNameLeaksShape = (objectName: string, shape: ThreeDShapeName): boolean => {
  const haystack = ` ${normalized(objectName)} `;
  const tokens = [shape, SHAPE_LABELS[shape], ...(shape === 'rectangular-prism' ? ['cuboid'] : [])];
  return tokens.some((token) => haystack.includes(` ${normalized(token)} `));
};

export const propertyAnswerFor = (
  shape: ThreeDShapeName,
  key: PropertyKey,
): number | boolean | string | null => {
  const facts = SHAPE_FACTS[shape];
  if (key === 'faceShape') return facts.faceShapes.length === 1 ? facts.faceShapes[0] : null;
  return facts[key];
};

const answerMatches = (actual: unknown, expected: number | boolean | string): boolean => {
  if (typeof expected === 'boolean') {
    return normalized(actual) === String(expected) || normalized(actual) === (expected ? 'yes' : 'no');
  }
  return normalized(actual) === normalized(expected);
};

/** Validate a source challenge without changing its mathematical demand. */
export const gateThreeDShapeChallenge = (challenge: ThreeDShapeChallengeLike): string[] => {
  const issues: string[] = [];
  if (!challenge.id?.trim()) issues.push('missing source challenge id');
  if (!['identify-3d', '2d-vs-3d', 'match-to-real-world', 'faces-and-properties', 'shape-riddle'].includes(challenge.type)) {
    return [...issues, 'unknown challenge type'];
  }

  if (challenge.type === 'identify-3d') {
    if (!isThreeDShape(challenge.shape3d)) issues.push('unknown 3D shape name');
  }

  if (challenge.type === '2d-vs-3d') {
    if (!challenge.mixedShapes?.length) issues.push('no shapes to classify');
    for (const member of challenge.mixedShapes ?? []) {
      if (!isCanonicalShapeName(member.name)) issues.push(`unknown shape name: ${member.name}`);
      else if (member.is3d !== isThreeDShape(member.name)) issues.push(`dimension flag disagrees for ${member.name}`);
    }
  }

  if (challenge.type === 'match-to-real-world') {
    if (!challenge.matchPairs?.length) issues.push('no real-world matches');
    for (const pair of challenge.matchPairs ?? []) {
      if (!isThreeDShape(pair.shape3d)) issues.push(`unknown match shape: ${pair.shape3d}`);
      else if (!isSayableObjectName(pair.realWorldObject)) issues.push(`unsayable object: ${pair.realWorldObject}`);
      else if (objectNameLeaksShape(pair.realWorldObject, pair.shape3d)) issues.push(`object name leaks ${pair.shape3d}`);
    }
  }

  if (challenge.type === 'faces-and-properties') {
    if (!isThreeDShape(challenge.displayShape)) issues.push('unknown property shape');
    else {
      if (challenge.properties && !sameFacts(challenge.properties, SHAPE_FACTS[challenge.displayShape])) {
        issues.push('generated properties disagree with canonical facts');
      }
      if (!challenge.propertyQuestions?.length) issues.push('no property questions');
      for (const question of challenge.propertyQuestions ?? []) {
        const key = question.propertyKey;
        if (!['flatFaces', 'curvedSurfaces', 'faceShape', 'canRoll', 'canStack', 'canSlide'].includes(String(key))) {
          issues.push('property question has no explicit valid propertyKey');
          continue;
        }
        const expected = propertyAnswerFor(challenge.displayShape, key as PropertyKey);
        if (expected == null) issues.push(`property ${key} has no single defensible answer`);
        if (question.correctAnswer !== undefined && expected != null && !answerMatches(question.correctAnswer, expected)) {
          issues.push(`answer key disagrees for ${key}`);
        }
        if (typeof expected === 'number' && (!Number.isInteger(expected) || expected < 0 || expected > 20)) {
          issues.push(`property count outside spoken window for ${key}`);
        }
      }
    }
  }

  if (challenge.type === 'shape-riddle') {
    if (!isThreeDShape(challenge.shape3d)) issues.push('unknown riddle shape');
    else if (!challenge.clues) issues.push('riddle has no code-owned clues');
    else issues.push(...validateRiddleClues(challenge.shape3d, challenge.clues));
  }
  return Array.from(new Set(issues));
};

const responseForProperty = (key: PropertyKey, value: number | boolean | string): {
  kind: ThreeDShapeItemKind;
  answer: string;
  alternates: string[];
  responseClass: ResponseClassId;
} | null => {
  if ((key === 'flatFaces' || key === 'curvedSurfaces') && typeof value === 'number') {
    if (value === 0) return { kind: 'judge_property', answer: 'no', alternates: ['nope', 'it does not', "it doesn't"], responseClass: 'yes_no' };
    if (!Number.isInteger(value) || value < 1 || value > 20) return null;
    return { kind: 'count_property', answer: NUMBER_WORDS[value], alternates: [String(value)], responseClass: 'number_word_to_20' };
  }
  if (typeof value === 'boolean') {
    return value
      ? { kind: 'judge_property', answer: 'yes', alternates: ['yeah', 'it does', 'yes it can'], responseClass: 'yes_no' }
      : { kind: 'judge_property', answer: 'no', alternates: ['nope', 'it does not', "it doesn't", 'no it cannot'], responseClass: 'yes_no' };
  }
  if (key === 'faceShape' && typeof value === 'string') {
    return { kind: 'name_face_shape', answer: value, alternates: [], responseClass: 'shape_name' };
  }
  return null;
};

const propertyStimulus = (shape: ThreeDShapeName, key: PropertyKey, value: number | boolean | string): string => {
  const label = SHAPE_LABELS[shape];
  if ((key === 'flatFaces' || key === 'curvedSurfaces') && value === 0) {
    return `${label} shown large; the child is asked whether it has any ${key === 'flatFaces' ? 'flat faces' : 'curved surfaces'}`;
  }
  if (key === 'flatFaces') return `${label} shown large; count its flat faces without a printed total`;
  if (key === 'curvedSurfaces') return `${label} shown large; count its curved surfaces without a printed total`;
  if (key === 'faceShape') return `${label} shown large; inspect the shape of one flat face`;
  return `${label} shown large; decide whether it can ${key === 'canRoll' ? 'roll smoothly' : key === 'canStack' ? 'stack' : 'slide'}`;
};

const makeItem = (
  challenge: ThreeDShapeChallengeLike,
  suffix: string,
  item: Omit<ThreeDShapeItem, 'id' | 'challengeId' | 'sourceChallengeId' | 'sourceMode' | 'answerKind' | 'supportTier' | 'showElementLabels' | 'showFaceHighlight'>,
): ThreeDShapeItem => ({
  ...item,
  id: `${challenge.id}:${suffix}`,
  challengeId: challenge.id,
  sourceChallengeId: challenge.id,
  sourceMode: challenge.type as ThreeDShapeMode,
  answerKind: 'voice',
  supportTier: challenge.supportTier ?? 'medium',
  showElementLabels: !!challenge.showElementLabels,
  showFaceHighlight: !!challenge.showFaceHighlight,
});

const itemsForChallenge = (
  challenge: ThreeDShapeChallengeLike,
  drops: ThreeDShapeDrop[],
): ThreeDShapeItem[] => {
  if (!challenge.id?.trim() || !['identify-3d', '2d-vs-3d', 'match-to-real-world', 'faces-and-properties', 'shape-riddle'].includes(challenge.type)) {
    drops.push({ challengeId: challenge.id || '(missing)', reason: 'missing id or unknown challenge type' });
    return [];
  }
  if (challenge.type === 'identify-3d') {
    if (!isThreeDShape(challenge.shape3d)) {
      drops.push({ challengeId: challenge.id, reason: 'unknown 3D shape name' });
      return [];
    }
    const shape = challenge.shape3d as ThreeDShapeName;
    return [makeItem(challenge, 'shape:0', {
      kind: 'identify_shape', action: 'identify_shape', responseClass: 'shape_name',
      answer: SHAPE_LABELS[shape], spokenAlternates: [], shape, shape3d: shape,
      stimulus: 'one unlabeled solid shown large',
    })];
  }
  if (challenge.type === '2d-vs-3d') {
    const items: ThreeDShapeItem[] = [];
    const members = (challenge.mixedShapes ?? []).slice(0, COLLECTION_ITEM_CAP);
    members.forEach((member, index) => {
      if (!isCanonicalShapeName(member.name) || member.is3d !== isThreeDShape(member.name)) {
        drops.push({ challengeId: challenge.id, childId: `${challenge.id}:shape:${index}`, reason: !isCanonicalShapeName(member.name) ? `unknown shape name: ${member.name}` : `dimension flag disagrees for ${member.name}` });
        return;
      }
      const answer = member.is3d ? 'solid' : 'flat';
      items.push(makeItem(challenge, `shape:${index}`, {
        kind: 'classify_dimension', action: 'classify_dimension', responseClass: 'short_spoken_word',
        answer, spokenAlternates: member.is3d ? ['3d', 'three dimensional'] : ['2d', 'two dimensional'],
        shape: member.name as ShapeName, is3d: member.is3d, emoji: member.emoji,
        stimulus: 'one unlabeled shape drawing shown large',
      }));
    });
    return items;
  }
  if (challenge.type === 'match-to-real-world') {
    const items: ThreeDShapeItem[] = [];
    (challenge.matchPairs ?? []).slice(0, COLLECTION_ITEM_CAP).forEach((pair, index) => {
      if (!isThreeDShape(pair.shape3d) || !isSayableObjectName(pair.realWorldObject) || (isThreeDShape(pair.shape3d) && objectNameLeaksShape(pair.realWorldObject, pair.shape3d))) {
        drops.push({ challengeId: challenge.id, childId: `${challenge.id}:object:${index}`, reason: !isThreeDShape(pair.shape3d) ? `unknown match shape: ${pair.shape3d}` : !isSayableObjectName(pair.realWorldObject) ? `unsayable object: ${pair.realWorldObject}` : `object name leaks ${pair.shape3d}` });
        return;
      }
      const shape = pair.shape3d as ThreeDShapeName;
      items.push(makeItem(challenge, `object:${index}`, {
        kind: 'match_object', action: 'match_object', responseClass: 'shape_name',
        answer: SHAPE_LABELS[shape], spokenAlternates: [], shape, shape3d: shape,
        objectName: pair.realWorldObject.trim(), emoji: pair.emoji,
        stimulus: `${pair.realWorldObject.trim()} pictured and named; its solid-shape name is hidden`,
      }));
    });
    return items;
  }
  if (challenge.type === 'faces-and-properties') {
    if (!isThreeDShape(challenge.displayShape)) {
      drops.push({ challengeId: challenge.id, reason: 'unknown property shape' });
      return [];
    }
    const shape = challenge.displayShape as ThreeDShapeName;
    if (challenge.properties && !sameFacts(challenge.properties, SHAPE_FACTS[shape])) {
      drops.push({ challengeId: challenge.id, reason: 'generated properties disagree with canonical facts' });
      return [];
    }
    const items: ThreeDShapeItem[] = [];
    const questions = (challenge.propertyQuestions ?? []).slice(0, COLLECTION_ITEM_CAP);
    for (let index = 0; index < questions.length; index += 1) {
      const question = questions[index];
      const key = question.propertyKey as PropertyKey;
      if (!['flatFaces', 'curvedSurfaces', 'faceShape', 'canRoll', 'canStack', 'canSlide'].includes(String(key))) {
        drops.push({ challengeId: challenge.id, childId: `${challenge.id}:property:${index}`, reason: 'property question has no explicit valid propertyKey' });
        continue;
      }
      const value = propertyAnswerFor(shape, key);
      if (value != null && question.correctAnswer !== undefined && !answerMatches(question.correctAnswer, value)) {
        drops.push({ challengeId: challenge.id, childId: `${challenge.id}:property:${index}`, reason: `answer key disagrees for ${key}` });
        continue;
      }
      if (value == null) {
        drops.push({ challengeId: challenge.id, childId: `${challenge.id}:property:${index}`, reason: `property ${key} has no defensible spoken response` });
        continue;
      }
      const response = responseForProperty(key, value);
      if (!response) {
        drops.push({ challengeId: challenge.id, childId: `${challenge.id}:property:${index}`, reason: `property ${key} has no defensible spoken response` });
        continue;
      }
      items.push(makeItem(challenge, `property:${index}:${key}`, {
        kind: response.kind, action: response.kind, responseClass: response.responseClass,
        answer: response.answer, spokenAlternates: response.alternates, shape, shape3d: shape,
        propertyKey: key, propertyValue: value, stimulus: propertyStimulus(shape, key, value),
      }));
    }
    return items;
  }
  if (!isThreeDShape(challenge.shape3d) || !challenge.clues || validateRiddleClues(challenge.shape3d, challenge.clues).length > 0) {
    drops.push({ challengeId: challenge.id, reason: !isThreeDShape(challenge.shape3d) ? 'unknown riddle shape' : 'riddle clues are not safe, true, and unique' });
    return [];
  }
  const shape = challenge.shape3d as ThreeDShapeName;
  return [makeItem(challenge, 'riddle:0', {
    kind: 'solve_riddle', action: 'solve_riddle', responseClass: 'shape_name',
    answer: SHAPE_LABELS[shape], spokenAlternates: [], shape, shape3d: shape,
    clues: [...(challenge.clues ?? [])], stimulus: 'a mystery mark and a bounded spoken clue set; answer options are hidden',
  })];
};

const exactKey = (item: ThreeDShapeItem) =>
  `${item.kind}|${item.shape ?? ''}|${normalized(item.objectName)}|${item.propertyKey ?? ''}`;

/** Fan out compound sources, group equal actions, dedupe, and enforce both caps. */
export const buildThreeDShapeItems = (
  challenges: readonly ThreeDShapeChallengeLike[],
): ThreeDShapeBuildResult => {
  const drops: ThreeDShapeDrop[] = [];
  const seenSourceIds = new Set<string>();
  const raw: ThreeDShapeItem[] = [];
  for (const challenge of challenges) {
    if (seenSourceIds.has(challenge.id)) {
      drops.push({ challengeId: challenge.id, reason: 'duplicate source challenge id' });
      continue;
    }
    seenSourceIds.add(challenge.id);
    raw.push(...itemsForChallenge(challenge, drops));
  }

  const actionOrder = Array.from(new Set(raw.map((item) => item.action)));
  const grouped = actionOrder.flatMap((action) => raw
    .filter((item) => item.action === action)
    .map((item, index) => ({ ...item, askVariant: index % 4 })));
  const seenIds = new Set<string>();
  const seenExact = new Set<string>();
  const seenShapeAnswers = new Set<string>();
  const kept: ThreeDShapeItem[] = [];
  for (const item of grouped) {
    let reason = '';
    const key = exactKey(item);
    if (seenIds.has(item.id)) reason = 'duplicate judged item id';
    else if (seenExact.has(key)) reason = 'repeated kind, stimulus, and facet';
    else if (['identify_shape', 'match_object', 'solve_riddle'].includes(item.kind) && seenShapeAnswers.has(item.answer)) {
      reason = 'shape-name answer already used in this session';
    } else if (kept.length > 0 && askFor(kept[kept.length - 1]) === askFor(item)) {
      reason = 'same spoken ask would repeat consecutively';
    } else if (kept.length >= SESSION_ITEM_CAP) reason = 'session item cap reached';
    if (reason) {
      drops.push({ challengeId: item.challengeId, childId: item.id, reason });
      continue;
    }
    kept.push(item);
    seenIds.add(item.id);
    seenExact.add(key);
    if (['identify_shape', 'match_object', 'solve_riddle'].includes(item.kind)) seenShapeAnswers.add(item.answer);
  }
  const producedSources = new Set(kept.map((item) => item.challengeId));
  return {
    items: kept,
    droppedChallenges: challenges.filter((challenge) => !producedSources.has(challenge.id)).length,
    droppedItems: drops,
  };
};

export const itemsFromChallenges = (challenges: readonly ThreeDShapeChallengeLike[]): ThreeDShapeItem[] =>
  buildThreeDShapeItems(challenges).items;

export const wrapperTextForSession = (
  title: unknown,
  description: unknown,
  items: readonly ThreeDShapeItem[],
): { title: string; description?: string } => {
  const answerTokens = Array.from(new Set(items.flatMap((item) => [item.answer, ...item.spokenAlternates]).map(normalized).filter(Boolean)));
  const safe = (value: unknown) => {
    if (typeof value !== 'string' || !value.trim()) return undefined;
    const text = normalized(value);
    return answerTokens.some((answer) => answer.length > 2 && (` ${text} `).includes(` ${answer} `)) ? undefined : value.trim();
  };
  return { title: safe(title) ?? 'Solid Shape Lab', description: safe(description) };
};

export const supportForItem = (item: ThreeDShapeItem, revealHeld: boolean) => ({
  showFaceHighlight: item.kind === 'count_property' && item.showFaceHighlight,
  showElementLabels: revealHeld && item.showElementLabels,
});

const propertyNoun = (key?: PropertyKey) => key === 'curvedSurfaces' ? 'curved surfaces' : 'flat faces';
const movementVerb = (key?: PropertyKey) => key === 'canStack' ? 'stack' : key === 'canSlide' ? 'slide' : 'roll smoothly';

export const askFor = (item: ThreeDShapeItem): string => {
  switch (item.kind) {
    case 'identify_shape': return [
      'Look at this solid. What shape is it?',
      'Here is another solid. What shape is it?',
      'Study this solid. What shape is it?',
      'Take a close look at this solid. What shape is it?',
    ][item.askVariant ?? 0];
    case 'classify_dimension': return [
      'Look at this shape. Is it flat or solid?',
      'Here is another shape. Is it flat or solid?',
      'Study this shape. Is it flat or solid?',
      'Take a close look. Is this shape flat or solid?',
    ][item.askVariant ?? 0];
    case 'match_object': return `Look at this ${item.objectName}. What solid shape is it like?`;
    case 'count_property': return `This is a ${SHAPE_LABELS[item.shape3d!]}. Look carefully at every ${propertyNoun(item.propertyKey).replace(/s$/, '')}. How many ${propertyNoun(item.propertyKey)}?`;
    case 'judge_property':
      if (item.propertyKey === 'flatFaces' || item.propertyKey === 'curvedSurfaces') {
        return `This is a ${SHAPE_LABELS[item.shape3d!]}. Does it have any ${propertyNoun(item.propertyKey)}? Tell me yes or no.`;
      }
      return `This is a ${SHAPE_LABELS[item.shape3d!]}. Could it ${movementVerb(item.propertyKey)}? Tell me yes or no.`;
    case 'name_face_shape': return `This is a ${SHAPE_LABELS[item.shape3d!]}. What shape is each flat face?`;
    case 'solve_riddle': return `${(item.clues ?? []).join(' ')} What solid shape am I?`;
  }
};

/** The harness's spoken answers: the right one and a plain wrong one. */
export const threeDShapeExplorerHarnessAnswers = (item: ThreeDShapeItem) => ({
  correct: item.answer,
  plainWrong: item.answer === 'no' ? 'yes' : item.answer === 'yes' ? 'no' : 'triangle',
});

// ── Spoken key and known misses ──────────────────────────────────────────────

/** What a wrong spoken answer about a solid shows (handoff 20 Part B). */
export type SpokenSolidMiss = OffByMiss | 'flat_look_alike' | 'similar_solid' | 'other_solid' | 'said_object'
  | 'opposite_dimension' | 'said_shape_name' | 'said_other_surface' | 'said_all_surfaces' | 'opposite_verdict'
  | 'said_solid' | 'side_view_shape' | 'other_flat_shape';

const FLAT_LOOK_ALIKE: Record<ThreeDShapeName, string> = {
  cube: 'square', sphere: 'circle', cylinder: 'circle', cone: 'triangle', 'rectangular-prism': 'rectangle',
};
const SIMILAR_SOLID: Partial<Record<ThreeDShapeName, ThreeDShapeName>> = {
  cube: 'rectangular-prism', 'rectangular-prism': 'cube', cylinder: 'cone', cone: 'cylinder',
};
/** The outline of the solid seen from the side, where it differs from its flat face. */
const SIDE_VIEW: Partial<Record<ThreeDShapeName, string>> = { cone: 'triangle', cylinder: 'rectangle' };
/** A face name that is arguably true too (a square is a rectangle), so never listed as a miss. */
const ALSO_TRUE_FACE: Partial<Record<ThreeDShapeName, string>> = { cube: 'rectangle', 'rectangular-prism': 'square' };
const FLAT_SHAPES = ['circle', 'square', 'triangle', 'rectangle'];
const many = (n: number, noun: string) => `${n} ${noun}${n === 1 ? '' : 's'}`;
const orList = (words: string[]) => words.length < 2 ? words.join('') : `${words.slice(0, -1).join(', ')} or ${words.at(-1)}`;

/** The name misses of a solid-shape answer, after `fact` (what is on screen): its flat look-alike, the solid
 *  shaped most like it, then any other solid. */
function solidNameMisses(shape: ThreeDShapeName, fact: string, similarWhy: string): KnownMiss[] {
  const label = SHAPE_LABELS[shape], flat = FLAT_LOOK_ALIKE[shape], similar = SIMILAR_SOLID[shape];
  const others = THREE_D_SHAPES.filter(s => s !== shape && s !== similar).map(s => SHAPE_LABELS[s]);
  return [
    { id: 'flat_look_alike', pattern: `${fact} The learner says "${flat}", a flat shape, instead of ${label}.`, examples: [flat, `a ${flat}`] },
    ...(similar ? [{ id: 'similar_solid', pattern: `${fact} The learner says "${SHAPE_LABELS[similar]}", ${similarWhy}, instead of ${label}.`,
      examples: [SHAPE_LABELS[similar]] }] : []),
    { id: 'other_solid', pattern: `${fact} The learner names a different solid instead of ${label}: ${orList(others)}.`, examples: [others[0]] },
  ];
}

/**
 * A spoken item's known wrong answers, in precedence order, for the `spoken_miss` observer: the solid, face or
 * count on screen stated first, then the learner's word. Concrete per item, never a cause.
 */
export function threeDShapeSpokenMisses(item: ThreeDShapeItem): KnownMiss[] {
  const shape = item.shape3d, label = shape ? SHAPE_LABELS[shape] : item.shape ?? 'shape';
  switch (item.kind) {
    case 'identify_shape':
      return shape ? solidNameMisses(shape, `The solid drawn is a ${label}.`, 'the name of a different solid') : [];
    case 'match_object':
      return shape ? [
        { id: 'said_object', pattern: `The picture is a ${item.objectName}. The learner's answer is ${item.objectName}, the object's own name, not a solid shape name.`,
          examples: [item.objectName ?? 'it'] },
        ...solidNameMisses(shape, `The ${item.objectName} is shaped like a ${label}.`, 'the name of a different solid'),
      ] : [];
    case 'solve_riddle':
      return shape ? [
        ...solidNameMisses(shape, `The riddle's answer is ${label}.`, 'the name of a different solid'),
      ].sort((a, b) => Number(b.id === 'similar_solid') - Number(a.id === 'similar_solid')) : [];
    case 'classify_dimension': {
      const opposite = item.answer === 'solid' ? 'flat' : 'solid';
      return [
        { id: 'opposite_dimension', pattern: `The shape drawn, a ${label}, is ${item.answer}. The learner says "${opposite}" instead of ${item.answer}.`,
          examples: [opposite, opposite === 'flat' ? '2d' : '3d'] },
        { id: 'said_shape_name', pattern: `The shape drawn is a ${label}. The learner says its name, ${label}, and not whether it is flat or solid.`,
          examples: [label] },
      ];
    }
    case 'count_property': {
      if (!shape || !item.propertyKey) return [];
      const facts = SHAPE_FACTS[shape], n = Number(item.propertyValue);
      const flat = item.propertyKey === 'flatFaces', noun = flat ? 'flat faces' : 'curved surfaces';
      const other = flat ? facts.curvedSurfaces : facts.flatFaces, otherNoun = flat ? 'curved surfaces' : 'flat faces';
      const all = facts.flatFaces + facts.curvedSurfaces;
      return [...numberMisses(n, [
        { id: 'said_other_surface', value: other,
          pattern: v => `The ${label} has ${many(v, otherNoun.slice(0, -1))}. The learner's answer is ${v}, the number of ${otherNoun}, not ${noun}.` },
        { id: 'said_all_surfaces', value: facts.curvedSurfaces && facts.flatFaces ? all : undefined,
          pattern: v => `The ${label} has ${many(facts.flatFaces, 'flat face')} and ${many(facts.curvedSurfaces, 'curved surface')}, ${v} surfaces in all. `
            + `The learner's answer is ${v}, every surface counted together.` }]),
        ...offByMisses(n, `the ${n} ${noun} of the ${label}`)];
    }
    case 'judge_property': {
      const wrong = item.answer === 'yes' ? 'no' : 'yes';
      const key = item.propertyKey;
      const truth = key === 'flatFaces' || key === 'curvedSurfaces'
        ? `The ${label} ${item.answer === 'yes' ? 'has' : 'has no'} ${key === 'flatFaces' ? 'flat faces' : 'curved surfaces'}.`
        : `The ${label} ${item.answer === 'yes' ? 'can' : 'cannot'} ${key === 'canStack' ? 'stack' : key === 'canSlide' ? 'slide' : 'roll smoothly'}.`;
      return [{ id: 'opposite_verdict', pattern: `${truth} The learner's answer is ${wrong}, the opposite.`,
        examples: [wrong, wrong === 'yes' ? 'yes it can' : 'no it cannot'] }];
    }
    case 'name_face_shape': {
      if (!shape) return [];
      const side = SIDE_VIEW[shape];
      const others = FLAT_SHAPES.filter(s => s !== item.answer && s !== side && s !== ALSO_TRUE_FACE[shape]);
      const fact = `Each flat face of the ${label} is a ${item.answer}.`;
      return [
        { id: 'said_solid', pattern: `${fact} The learner's answer is ${label}, the name of the solid, not of its face.`, examples: [label] },
        ...(side ? [{ id: 'side_view_shape', pattern: `${fact} The learner's answer is ${side}, the outline of the ${label} seen from the side.`,
          examples: [side] }] : []),
        { id: 'other_flat_shape', pattern: `${fact} The learner names a different flat shape: ${orList(others)}.`, examples: [others[0]] },
      ];
    }
  }
}

/** What does not count, per kind, as an instruction to the judge. */
const SIGNATURE_ERROR: Record<ThreeDShapeItemKind, (item: ThreeDShapeItem) => string> = {
  identify_shape: () => 'A flat look-alike (circle for sphere, square for cube) or the name of one face is not it.',
  match_object: item => `Saying "${item.objectName}" again is not it: the question asks for its solid shape name.`,
  count_property: () => 'A number one more or one less is not it.',
  judge_property: () => 'A true statement about a different property (rolling for stacking) is not it.',
  name_face_shape: item => `"${SHAPE_LABELS[item.shape3d!]}" names the solid, not its face, so it is not it.`,
  classify_dimension: item => `The shape's own name (${item.shape}) does not say whether it is flat or solid.`,
  solve_riddle: () => 'A solid that fits only some of the clues is not it; every clue must fit.',
};

/** The key the tutor judges with. Flat-or-solid and yes-or-no are menus the ask says in full. */
export function threeDShapeKey(item: ThreeDShapeItem): SpokenKey {
  const key = { answer: item.answer, alsoAccept: item.spokenAlternates, signatureError: SIGNATURE_ERROR[item.kind](item) };
  if (item.kind === 'classify_dimension') return { ...key, menu: ['flat', 'solid'] };
  if (item.kind === 'judge_property') return { ...key, menu: ['yes', 'no'] };
  if (item.kind === 'count_property') return { ...key, acceptRule: 'Counting aloud that lands on the right total is right.' };
  return key;
}

// ── Scene ────────────────────────────────────────────────────────────────────

export function threeDShapeScene(item: ThreeDShapeItem): SceneOf {
  const shown = item.kind === 'match_object' ? `a picture of ${item.objectName}, named`
    : item.kind === 'solve_riddle' ? `the riddle's clues, printed: ${(item.clues ?? []).join(' ')}`
    : item.kind === 'classify_dimension' ? 'one shape, drawn large and unlabeled'
    : item.kind === 'identify_shape' ? 'one solid, drawn large and unlabeled'
    : `a ${SHAPE_LABELS[item.shape3d!]}, drawn and named`;
  return { objects: [], facts: {
    shown,
    constraints: 'Nothing on screen is tapped. The answer is printed only after credit.',
  } };
}

/** What the replay button asks the tutor to say: the question only, never the answer. */
export const hearQuestionRequest = (item: ThreeDShapeItem) =>
  `The learner tapped to hear the question again. Say only this, once: "${askFor(item)}" Never say the answer.`;
