import type {
  JudgedCueOptions,
  JudgedCueSurface,
  JudgedScriptItem,
  ResponseClassId,
} from '../../../hooks/judgedScriptContract';

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

export const affirmFor = (item: ThreeDShapeItem): string => {
  if (item.kind === 'classify_dimension') return `Yes, this shape is ${item.answer}.`;
  if (item.kind === 'match_object') return `Yes, ${item.objectName} is like a ${item.answer}.`;
  if (item.kind === 'count_property') {
    const noun = item.answer === 'one' ? propertyNoun(item.propertyKey).replace(/s$/, '') : propertyNoun(item.propertyKey);
    return `Yes, this ${SHAPE_LABELS[item.shape3d!]} has ${item.answer} ${noun}.`;
  }
  if (item.kind === 'judge_property') {
    return item.propertyKey === 'flatFaces' || item.propertyKey === 'curvedSurfaces'
      ? `Yes, it ${item.answer === 'yes' ? 'does' : 'does not'} have ${propertyNoun(item.propertyKey)}.`
      : `Yes, it ${item.answer === 'yes' ? 'can' : 'cannot'} ${movementVerb(item.propertyKey)}.`;
  }
  if (item.kind === 'name_face_shape') return `Yes, each flat face is a ${item.answer}.`;
  return `Yes, it is a ${item.answer}.`;
};

export const correctionFor = (item: ThreeDShapeItem): string => {
  const reask = askFor(item);
  switch (item.kind) {
    case 'identify_shape': return `My turn: I look at the whole solid, not just one flat face. It is a ${item.answer}. ${reask}`;
    case 'classify_dimension': return `My turn: a flat shape can be drawn on paper; a solid can be held. This one is ${item.answer}. ${reask}`;
    case 'match_object': return `My turn: ${item.objectName} is the object name. Its mathematical solid name is ${item.answer}. ${reask}`;
    case 'count_property': return `My turn: I touch each ${propertyNoun(item.propertyKey).replace(/s$/, '')} exactly once and count ${item.answer}. ${reask}`;
    case 'judge_property': {
      const fact = item.propertyKey === 'flatFaces' || item.propertyKey === 'curvedSurfaces'
        ? `the ${SHAPE_LABELS[item.shape3d!]} ${item.answer === 'yes' ? 'has' : 'does not have'} ${propertyNoun(item.propertyKey)}`
        : `the ${SHAPE_LABELS[item.shape3d!]} ${item.answer === 'yes' ? 'can' : 'cannot'} ${movementVerb(item.propertyKey)}`;
      return `My turn: ${fact}. ${reask}`;
    }
    case 'name_face_shape': return `My turn: I name the flat face, not the solid. Each flat face is a ${item.answer}. ${reask}`;
    case 'solve_riddle': return `My turn: I use every clue, especially the one that tells similar solids apart. The answer is ${item.answer}. ${reask}`;
  }
};

const TWO_BRANCH_LAW =
  'Judge only the learner response. If it is right, use the exact affirmation. If it is wrong, use the exact correction. Do not create a third branch. On repeated wrong answers, repeat that same exact correction unchanged; never improvise another hint. ';
const ACTIVE_ITEM_RESET =
  'This is the only active item contract. Discard every earlier item, answer, clue, and verdict before judging the learner\'s next response. ';
const NEVER_PERFORM =
  'Never answer for the learner, never read stage directions or bracket tags aloud, and never reveal the answer before the learner tries. Think time is unbounded.';
const VERDICT_ENDS_THE_TURN =
  'The verdict is the whole turn: after the exact affirmation or correction, stop speaking.';

const judgingContract = (item: ThreeDShapeItem): string => {
  const alternates = item.spokenAlternates.length
    ? `Also accept these exact natural forms: ${item.spokenAlternates.map((v) => `"${v}"`).join(', ')}. `
    : '';
  let refusal = 'Any different answer is wrong. ';
  if (item.kind === 'identify_shape') refusal = 'A two-dimensional look-alike or face name is wrong. ';
  if (item.kind === 'match_object') refusal = `Repeating "${item.objectName}" is wrong; the question asks for its mathematical solid name. `;
  if (item.kind === 'count_property') refusal = 'A number one more or one less is wrong. ';
  if (item.kind === 'name_face_shape') refusal = `Saying "${SHAPE_LABELS[item.shape3d!]}" is wrong; that names the solid, not its face. `;
  if (item.kind === 'solve_riddle') refusal = 'A solid that matches only one clue is wrong; every clue must fit. ';
  return `${ACTIVE_ITEM_RESET}The correct spoken answer is "${item.answer}". ${alternates}${refusal}${TWO_BRANCH_LAW}If right, say exactly: "${affirmFor(item)}" If wrong, say exactly: "${correctionFor(item)}"`;
};

export const itemCue = (item: ThreeDShapeItem, opts: JudgedCueOptions): string => {
  const opening = opts.opening ? 'Hi! Welcome to the shape lab. ' : '';
  const how = opts.howToPlay ? 'Look or listen, then say your answer out loud. ' : '';
  return `[3DS_ITEM] Say exactly: "${opening}${how}${askFor(item)}" ${judgingContract(item)} ${NEVER_PERFORM} ${VERDICT_ENDS_THE_TURN}`;
};

export const moveOnCue = (
  _item: ThreeDShapeItem,
  next: ThreeDShapeItem | null,
  opts: JudgedCueOptions,
): string => {
  if (!next) return '[3DS_MOVE] Say exactly: "Good try! We will explore that shape again another day." Then stop.';
  const how = opts.howToPlay ? 'Look or listen, then say your answer out loud. ' : '';
  return `[3DS_MOVE] The previous item is closed permanently. ${judgingContract(next)} Say exactly: "Good try! Here comes the next question. ${how}${askFor(next)}" ${NEVER_PERFORM} ${VERDICT_ENDS_THE_TURN}`;
};

export const completeCue = (): string =>
  '[3DS_COMPLETE] Say exactly: "Great shape work today! You told me every answer out loud. See you next time!" Then stop; the activity is over.';

export const pronounceCue = (item: ThreeDShapeItem): string =>
  `[3DS_HEAR] The learner asked to hear the question again. Say exactly: "${askFor(item)}" The turn ends after that line. Never say the answer and do not treat your own words as an attempt. ${NEVER_PERFORM}`;

export const threeDShapeExplorerPackBase = (
  items: ThreeDShapeItem[],
): JudgedCueSurface<ThreeDShapeItem> => ({
  primitiveType: '3d-shape-explorer',
  activityLine: 'live tutor-judged solid-shape practice',
  items,
  itemCue,
  moveOnCue,
  completeCue,
  pronounceCue,
  contextFor: (item) => ({ challengeType: item.sourceMode, stimulus: item.stimulus }),
});

const alternateShape = (item: ThreeDShapeItem): string => {
  if (item.shape3d === 'sphere') return 'circle';
  if (item.shape3d === 'cube') return 'square';
  if (item.shape3d === 'rectangular-prism') return 'rectangle';
  if (item.shape3d === 'cylinder') return 'cone';
  return 'cylinder';
};

export const threeDShapeExplorerHarnessAnswers = (item: ThreeDShapeItem) => {
  let signatureWrong = alternateShape(item);
  let why = 'a nearby shape that ignores the defining solid features';
  if (item.kind === 'classify_dimension') {
    signatureWrong = item.answer === 'flat' ? 'solid' : 'flat';
    why = 'the confident flat/solid reversal';
  } else if (item.kind === 'match_object') {
    signatureWrong = item.objectName ?? 'object';
    why = 'the everyday object repeated instead of translated into a mathematical solid name';
  } else if (item.kind === 'count_property') {
    const n = NUMBER_WORDS.indexOf(item.answer as (typeof NUMBER_WORDS)[number]);
    signatureWrong = NUMBER_WORDS[Math.min(20, n + 1)] || 'one';
    why = 'the off-by-one count';
  } else if (item.kind === 'judge_property') {
    signatureWrong = item.answer === 'yes' ? 'no' : 'yes';
    why = 'the opposite property verdict, including roll/slide/stack confusion';
  } else if (item.kind === 'name_face_shape') {
    signatureWrong = SHAPE_LABELS[item.shape3d!];
    why = 'the solid name said instead of the shape of its flat face';
  } else if (item.kind === 'solve_riddle') {
    signatureWrong = item.shape3d === 'cylinder' ? 'cone' : item.shape3d === 'cone' ? 'cylinder' : alternateShape(item);
    why = 'the nearest solid sharing one clue while ignoring the distinguishing clue';
  }
  return {
    correct: item.answer,
    plainWrong: item.answer === 'no' ? 'yes' : item.answer === 'yes' ? 'no' : 'triangle',
    signatureWrong: { text: signatureWrong, why },
    leakTokens: [item.answer, ...item.spokenAlternates],
    leakExemptSpan: item.kind === 'classify_dimension'
      ? 'flat or solid'
      : item.kind === 'judge_property' ? 'yes or no' : undefined,
  };
};
