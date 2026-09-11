/**
 * Typed Direct Instruction mode definitions.
 *
 * One declaration owns the mode's catalog identity, generator documentation,
 * judged response class, and learner-facing action sequence. The projections
 * below keep those consumers small while preventing their copies from drifting.
 */
import type { EvalModeDefinition } from '../types';
import type { DiActionContract, ResponseClassId } from './judgedScriptContract';

export interface DiModeItem {
  id: string;
  challengeType: string;
}

export interface DiChallengeTypeDoc {
  promptDoc: string;
  schemaDescription: string;
}

type ResolvedText<Item> = string | ((item: Item) => string);

export interface DiModeStepDefinition<Item extends DiModeItem> {
  /** Stable key inside this mode. The item id is prefixed when materialized. */
  id: string;
  /** Optional task-level id for the action contract; defaults to the materialized step id. */
  actionId?: ResolvedText<Item>;
  label: ResolvedText<Item>;
  icon: ResolvedText<Item>;
  answerKind: DiActionContract['answerKind'];
  /** Optional per-step judge contract. The answer step falls back to the mode's response class. */
  responseClass?: ResponseClassId | ((item: Item) => ResponseClassId);
  instruction: ResolvedText<Item>;
  checkingInstruction: ResolvedText<Item>;
}

export interface DiModeDefinition<
  Item extends DiModeItem = DiModeItem,
  Metadata = unknown,
>
  extends Omit<EvalModeDefinition, 'challengeTypes'> {
  challengeTypes: readonly string[];
  /** Generator prompt/schema documentation for every owned challenge type. */
  challengeDocs: Readonly<Record<string, DiChallengeTypeDoc>>;
  /** The response judged at the answer step. */
  responseClass: ResponseClassId | ((item: Item) => ResponseClassId);
  /** Ordered learner story, including preparation/manipulation before answering. */
  steps: readonly DiModeStepDefinition<Item>[];
  /** Exactly one step supplies the assessed response. */
  answerStepId: string;
  /** Controls how-to-play repetition when adjacent items change task identity. */
  groupingKey?: (item: Item) => string;
  /** Primitive-specific mode facts that should share this source of truth. */
  metadata?: Metadata;
}

export interface DiModePlan {
  evalMode: string;
  challengeType: string;
  responseClass: ResponseClassId;
  groupingKey: string;
  steps: Array<{
    key: string;
    id: string;
    answerKind: DiActionContract['answerKind'];
    responseClass?: ResponseClassId;
    actionContract: DiActionContract;
  }>;
  answerStep: {
    key: string;
    id: string;
    answerKind: DiActionContract['answerKind'];
    responseClass: ResponseClassId;
    actionContract: DiActionContract;
  };
}

/** Support tiers describe one skill's scaffold surface; blends and mixed runs
 * deliberately receive no tier rather than pretending one scaffold fits all. */
export const supportForSingleDiMode = <Support>(
  resolution: { modes: readonly unknown[] } | null | undefined,
  support: Support | undefined,
): Support | undefined => resolution?.modes.length === 1 ? support : undefined;

const nonEmpty = (value: string, field: string): void => {
  if (!value.trim()) throw new Error(`DI mode ${field} must not be empty`);
};

const validateDefinition = <Item extends DiModeItem, Metadata>(
  mode: DiModeDefinition<Item, Metadata>,
): void => {
  nonEmpty(mode.evalMode, 'evalMode');
  nonEmpty(mode.label, `${mode.evalMode}.label`);
  nonEmpty(mode.description, `${mode.evalMode}.description`);
  if (mode.beta < 1 || mode.beta > 10) {
    throw new Error(`DI mode ${mode.evalMode}.beta must be between 1 and 10`);
  }
  if (!Number.isInteger(mode.scaffoldingMode) || mode.scaffoldingMode < 1 || mode.scaffoldingMode > 6) {
    throw new Error(`DI mode ${mode.evalMode}.scaffoldingMode must be an integer from 1 through 6`);
  }
  if (mode.challengeTypes.length === 0) {
    throw new Error(`DI mode ${mode.evalMode} must own at least one challenge type`);
  }
  for (const challengeType of mode.challengeTypes) {
    nonEmpty(challengeType, `${mode.evalMode}.challengeTypes`);
    const doc = mode.challengeDocs[challengeType];
    if (!doc) throw new Error(`DI mode ${mode.evalMode} is missing docs for ${challengeType}`);
    nonEmpty(doc.promptDoc, `${mode.evalMode}.${challengeType}.promptDoc`);
    nonEmpty(doc.schemaDescription, `${mode.evalMode}.${challengeType}.schemaDescription`);
  }
  if (mode.steps.length === 0) throw new Error(`DI mode ${mode.evalMode} must define at least one step`);
  const stepIds = new Set<string>();
  for (const step of mode.steps) {
    nonEmpty(step.id, `${mode.evalMode}.step.id`);
    if (typeof step.actionId === 'string') nonEmpty(step.actionId, `${mode.evalMode}.${step.id}.actionId`);
    if (typeof step.icon === 'string') nonEmpty(step.icon, `${mode.evalMode}.${step.id}.icon`);
    if (stepIds.has(step.id)) throw new Error(`DI mode ${mode.evalMode} has duplicate step ${step.id}`);
    stepIds.add(step.id);
  }
  if (!stepIds.has(mode.answerStepId)) {
    throw new Error(`DI mode ${mode.evalMode} answer step ${mode.answerStepId} does not exist`);
  }
  if (mode.steps[mode.steps.length - 1].id !== mode.answerStepId) {
    throw new Error(`DI mode ${mode.evalMode} answer step must be the final step`);
  }
}

/** Curried so a primitive states its item shape once and retains literal mode keys. */
export const defineDiMode = <Item extends DiModeItem, Metadata = unknown>() =>
  <const Definition extends DiModeDefinition<Item, Metadata>>(definition: Definition): Definition => {
    validateDefinition(definition);
    return definition;
  };

export const defineDiModes = <Item extends DiModeItem, Metadata = unknown>(
  ...modes: readonly DiModeDefinition<Item, Metadata>[]
): readonly DiModeDefinition<Item, Metadata>[] => {
  const modeKeys = new Set<string>();
  const challengeTypes = new Set<string>();
  for (const mode of modes) {
    validateDefinition(mode);
    if (modeKeys.has(mode.evalMode)) throw new Error(`Duplicate DI eval mode ${mode.evalMode}`);
    modeKeys.add(mode.evalMode);
    for (const challengeType of mode.challengeTypes) {
      if (challengeTypes.has(challengeType)) {
        throw new Error(`DI challenge type ${challengeType} belongs to more than one mode`);
      }
      challengeTypes.add(challengeType);
    }
  }
  return modes;
};

export const evalModeDefinitionsFromDiModes = <Item extends DiModeItem, Metadata>(
  modes: readonly DiModeDefinition<Item, Metadata>[],
): EvalModeDefinition[] => modes.map((mode) => ({
  evalMode: mode.evalMode,
  label: mode.label,
  beta: mode.beta,
  ...(mode.discrimination === undefined ? {} : { discrimination: mode.discrimination }),
  scaffoldingMode: mode.scaffoldingMode,
  challengeTypes: [...mode.challengeTypes],
  description: mode.description,
  ...(mode.affordances === undefined ? {} : { affordances: mode.affordances }),
}));

export const challengeTypeDocsFromDiModes = <Item extends DiModeItem, Metadata>(
  modes: readonly DiModeDefinition<Item, Metadata>[],
): Record<string, DiChallengeTypeDoc> => Object.fromEntries(
  modes.flatMap((mode) => mode.challengeTypes.map((type) => [type, mode.challengeDocs[type]])),
);

export const modeForDiItem = <Item extends DiModeItem, Metadata>(
  modes: readonly DiModeDefinition<Item, Metadata>[],
  item: Item,
): DiModeDefinition<Item, Metadata> => {
  const mode = modes.find((candidate) => candidate.challengeTypes.includes(item.challengeType));
  if (!mode) throw new Error(`No DI mode owns challenge type ${item.challengeType}`);
  return mode;
};

const resolveText = <Item,>(value: ResolvedText<Item>, item: Item): string =>
  typeof value === 'function' ? value(item) : value;

export const buildDiModePlan = <Item extends DiModeItem, Metadata>(
  modes: readonly DiModeDefinition<Item, Metadata>[],
  item: Item,
): DiModePlan => {
  const mode = modeForDiItem(modes, item);
  const responseClass = typeof mode.responseClass === 'function'
    ? mode.responseClass(item)
    : mode.responseClass;
  const steps = mode.steps.map((step) => {
    const id = `${item.id}-${step.id}`;
    const actionId = step.actionId === undefined ? id : resolveText(step.actionId, item);
    const label = resolveText(step.label, item);
    const icon = resolveText(step.icon, item);
    const instruction = resolveText(step.instruction, item);
    const checkingInstruction = resolveText(step.checkingInstruction, item);
    const stepResponseClass = step.responseClass === undefined
      ? (step.id === mode.answerStepId ? responseClass : undefined)
      : typeof step.responseClass === 'function'
        ? step.responseClass(item)
        : step.responseClass;
    nonEmpty(label, `${mode.evalMode}.${step.id}.label`);
    nonEmpty(actionId, `${mode.evalMode}.${step.id}.actionId`);
    nonEmpty(icon, `${mode.evalMode}.${step.id}.icon`);
    nonEmpty(instruction, `${mode.evalMode}.${step.id}.instruction`);
    nonEmpty(checkingInstruction, `${mode.evalMode}.${step.id}.checkingInstruction`);
    return {
      key: step.id,
      id,
      answerKind: step.answerKind,
      ...(stepResponseClass === undefined ? {} : { responseClass: stepResponseClass }),
      actionContract: { id: actionId, label, icon, answerKind: step.answerKind, instruction, checkingInstruction },
    };
  });
  const answerIndex = mode.steps.findIndex((step) => step.id === mode.answerStepId);
  const answerCandidate = steps[answerIndex];
  const answerStep = { ...answerCandidate, responseClass: answerCandidate.responseClass ?? responseClass };
  for (const step of steps) {
    if (!step.responseClass) continue;
    if (step.answerKind === 'gesture' && step.responseClass !== 'manipulation') {
      throw new Error(`DI mode ${mode.evalMode} gesture step ${step.key} must use responseClass manipulation`);
    }
    if (step.answerKind === 'voice' && step.responseClass === 'manipulation') {
      throw new Error(`DI mode ${mode.evalMode} voice step ${step.key} cannot use responseClass manipulation`);
    }
  }
  return {
    evalMode: mode.evalMode,
    challengeType: item.challengeType,
    responseClass,
    groupingKey: mode.groupingKey?.(item) ?? mode.evalMode,
    steps,
    answerStep,
  };
};
