export type AnnotatedExampleBindingMode = 'representative' | 'strict';
export type AnnotatedExampleOperationFamily =
  | 'skip-counting'
  | 'repeated-addition'
  | 'multiplication';

export interface AnnotatedExampleAuthoringContract {
  /** Manifest-authored steering. It is prompt input, never diagnostic log data. */
  intent?: string;
  /** Canonical curriculum grade (`ctx.grade`), never parsed from grade prose. */
  canonicalGrade?: string;
  binding: AnnotatedExampleBindingMode;
  requiredNumbers: number[];
  requiredTerms: string[];
  operationFamily?: AnnotatedExampleOperationFamily;
  explicitlyAllowsMultiplication: boolean;
}

export interface AuthoringViolation {
  code:
    | 'missing-number'
    | 'missing-term'
    | 'scope-overflow'
    | 'operation-missing'
    | 'grade1-operation';
  detail: string;
}

export interface DeterministicRepeatedAdditionModel {
  count: number;
  increment: number;
  target: number;
  entity: string;
  unit: string;
  rows: Array<[string, string]>;
}

const NUMBER_WORDS: Record<string, number> = {
  zero: 0,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
  thirteen: 13,
  fourteen: 14,
  fifteen: 15,
  sixteen: 16,
  seventeen: 17,
  eighteen: 18,
  nineteen: 19,
  twenty: 20,
  thirty: 30,
  forty: 40,
  fifty: 50,
  sixty: 60,
  seventy: 70,
  eighty: 80,
  ninety: 90,
};

const NUMBER_TOKEN =
  '(?:\\d+(?:\\.\\d+)?|zero|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety)';

const GENERIC_QUANTITY_NOUNS = new Set([
  'example',
  'examples',
  'number',
  'numbers',
  'problem',
  'problems',
  'step',
  'steps',
  'value',
  'values',
]);

const NON_ENTITY_FOLLOWERS = new Set([
  'and',
  'at',
  'by',
  'from',
  'in',
  'less',
  'more',
  'of',
  'or',
  'than',
  'through',
  'to',
  'within',
]);

function unique<T>(values: T[]): T[] {
  return Array.from(new Set(values));
}

function normalizeTerm(value: string): string {
  const normalized = value.toLowerCase().replace(/[^a-z-]/g, '');
  if (normalized.endsWith('ies') && normalized.length > 3) {
    return `${normalized.slice(0, -3)}y`;
  }
  if (normalized.endsWith('s') && !normalized.endsWith('ss') && normalized.length > 3) {
    return normalized.slice(0, -1);
  }
  return normalized;
}

export function extractNumericAnchors(text: string): number[] {
  const matches = text.toLowerCase().match(new RegExp(`\\b${NUMBER_TOKEN}\\b`, 'g')) ?? [];
  return unique(
    matches
      .map((token) => NUMBER_WORDS[token] ?? Number(token))
      .filter((value) => Number.isFinite(value)),
  );
}

function extractTermAnchors(text: string): string[] {
  const matches = text.matchAll(new RegExp(`\\b(${NUMBER_TOKEN})\\s+([a-zA-Z][a-zA-Z-]*)\\b`, 'gi'));
  const terms: string[] = [];
  for (const match of Array.from(matches)) {
    const rawTerm = match[2].toLowerCase();
    if (NON_ENTITY_FOLLOWERS.has(rawTerm) || GENERIC_QUANTITY_NOUNS.has(rawTerm)) continue;
    const term = normalizeTerm(rawTerm);
    if (term) terms.push(term);
  }
  return unique(terms);
}

export function textContainsMultiplication(text: string): boolean {
  return (
    /(?:\d|\$)\s*(?:[\u00d7*]|\\times|x)\s*(?:\d|\$)/i.test(text) ||
    /\b(?:multipl(?:y|ied|ication)|times|product|rectangular\s+array)\b/i.test(text) ||
    /\barray\s+(?:task|model|of)\b/i.test(text)
  );
}

function inferOperationFamily(intent: string): AnnotatedExampleOperationFamily | undefined {
  if (/\bskip[- ]?count(?:ing)?\b/i.test(intent)) return 'skip-counting';
  if (/\brepeated\s+addition\b/i.test(intent)) return 'repeated-addition';
  if (textContainsMultiplication(intent)) return 'multiplication';
  return undefined;
}

export function buildAnnotatedExampleAuthoringContract(input: {
  intent?: string;
  canonicalGrade?: string;
}): AnnotatedExampleAuthoringContract {
  const intent = input.intent?.trim();
  const requiredNumbers = intent ? extractNumericAnchors(intent) : [];
  const requiredTerms = intent ? extractTermAnchors(intent) : [];
  const exactCue = intent
    ? /\b(?:exact|specifically|use\s+this|worked\s+example|must\s+(?:use|show|keep))\b/i.test(intent)
    : false;
  const sequenceCue = requiredNumbers.length >= 2 && /[,?]/.test(intent ?? '');
  const binding: AnnotatedExampleBindingMode =
    intent && (exactCue || sequenceCue || requiredTerms.length > 0) ? 'strict' : 'representative';
  const operationFamily = intent ? inferOperationFamily(intent) : undefined;

  return {
    intent,
    canonicalGrade: input.canonicalGrade,
    binding,
    requiredNumbers,
    requiredTerms,
    operationFamily,
    explicitlyAllowsMultiplication: operationFamily === 'multiplication',
  };
}

function hasTerm(text: string, term: string): boolean {
  if (term === 'cent' && /¢/.test(text)) return true;
  const normalizedWords = text
    .toLowerCase()
    .split(/[^a-z-]+/)
    .map(normalizeTerm)
    .filter(Boolean);
  return normalizedWords.includes(term);
}

function operationViolations(
  text: string,
  contract: AnnotatedExampleAuthoringContract,
): AuthoringViolation[] {
  const violations: AuthoringViolation[] = [];
  const gradeOne = contract.canonicalGrade === '1';
  const requiresEarlyOperation =
    contract.operationFamily === 'skip-counting' ||
    contract.operationFamily === 'repeated-addition';

  if (requiresEarlyOperation && !/\b(?:skip[- ]?count(?:ing)?|repeated\s+addition)\b/i.test(text)) {
    violations.push({
      code: 'operation-missing',
      detail: `required ${contract.operationFamily} operation is not named`,
    });
  }

  if (
    gradeOne &&
    requiresEarlyOperation &&
    !contract.explicitlyAllowsMultiplication &&
    textContainsMultiplication(text)
  ) {
    violations.push({
      code: 'grade1-operation',
      detail: 'multiplication/array task replaced a Grade-1 skip-counting or repeated-addition objective',
    });
  }

  return violations;
}

export function validateTextAgainstAuthoringContract(
  text: string,
  contract: AnnotatedExampleAuthoringContract,
): AuthoringViolation[] {
  if (contract.binding !== 'strict') return operationViolations(text, contract);

  const violations: AuthoringViolation[] = [];
  const foundNumbers = new Set(extractNumericAnchors(text));
  for (const number of contract.requiredNumbers) {
    if (!foundNumbers.has(number)) {
      violations.push({ code: 'missing-number', detail: `required numeric anchor ${number} is absent` });
    }
  }
  for (const term of contract.requiredTerms) {
    if (!hasTerm(text, term)) {
      violations.push({ code: 'missing-term', detail: `required entity/unit anchor "${term}" is absent` });
    }
  }

  if (contract.canonicalGrade === '1' && contract.requiredNumbers.length > 0) {
    const ceiling = Math.max(...contract.requiredNumbers);
    const overflow = Array.from(foundNumbers).find((value) => value > ceiling);
    if (overflow !== undefined) {
      violations.push({
        code: 'scope-overflow',
        detail: `generated value ${overflow} exceeds the strict intent ceiling ${ceiling}`,
      });
    }
  }

  violations.push(...operationViolations(text, contract));
  return violations;
}

export function formatAuthoringContractForPrompt(
  contract: AnnotatedExampleAuthoringContract,
): string {
  if (!contract.intent) return '';

  const lines = [
    '## Authoring contract',
    `Binding mode: ${contract.binding.toUpperCase()}.`,
    `Manifest steering: ${contract.intent}`,
  ];

  if (contract.binding === 'strict') {
    lines.push(
      'The manifest specifies a concrete worked example. It outranks creative variation.',
      `Required numeric anchors: ${contract.requiredNumbers.join(', ') || '(none)'}.`,
      `Required entity/unit anchors: ${contract.requiredTerms.join(', ') || '(none)'}.`,
      'Keep those quantities, entities, units, scenario, and requested operation family in the problem statement.',
    );
  }

  if (contract.operationFamily) {
    lines.push(`Required operation family: ${contract.operationFamily}.`);
  }
  if (
    contract.canonicalGrade === '1' &&
    (contract.operationFamily === 'skip-counting' || contract.operationFamily === 'repeated-addition')
  ) {
    lines.push(
      'Canonical grade is Grade 1. Use skip counting/repeated addition; do not replace it with multiplication, times, products, rows-by-columns, or an array task.',
    );
  }

  return lines.join('\n');
}

export function buildPinnedSolverGuidance(
  contract: AnnotatedExampleAuthoringContract,
): string | undefined {
  if (!contract.intent) return undefined;
  const lines = [
    `Preserve the validated manifest intent: ${contract.intent}`,
    'Solve only the pinned problem and keep its quantities, entities, units, and operation identity unchanged.',
  ];
  if (
    contract.canonicalGrade === '1' &&
    (contract.operationFamily === 'skip-counting' || contract.operationFamily === 'repeated-addition')
  ) {
    lines.push(
      'Use skip counting or repeated addition throughout. Do not introduce multiplication, a times symbol, a product, rows/columns, or an array as a solution or verification method.',
    );
  }
  return lines.join(' ');
}

export function buildIntentFaithfulFallback(
  contract: AnnotatedExampleAuthoringContract,
): string {
  const intent = contract.intent?.trim();
  if (!intent) {
    throw new Error('[AE Orchestrator] Cannot build a strict fallback without manifest steering');
  }
  return intent;
}

/**
 * Derive the narrow safe fallback for a concrete repeated-addition intent.
 * This is semantic arithmetic, not a denomination branch: it only activates
 * when the first quantity × increment exactly equals the pinned target.
 */
export function deriveDeterministicRepeatedAdditionModel(
  contract: AnnotatedExampleAuthoringContract,
): DeterministicRepeatedAdditionModel | null {
  if (
    contract.binding !== 'strict' ||
    (contract.operationFamily !== 'skip-counting' &&
      contract.operationFamily !== 'repeated-addition') ||
    contract.requiredNumbers.length < 3 ||
    contract.requiredTerms.length < 2
  ) {
    return null;
  }

  const [count, increment] = contract.requiredNumbers;
  const target = contract.requiredNumbers[contract.requiredNumbers.length - 1];
  if (
    !Number.isInteger(count) ||
    !Number.isInteger(increment) ||
    count < 1 ||
    count > 50 ||
    increment < 1 ||
    count * increment !== target
  ) {
    return null;
  }

  const unit = contract.requiredTerms[contract.requiredTerms.length - 1];
  const entity = contract.requiredTerms.find((term) => term !== unit) ?? contract.requiredTerms[0];
  const rows: Array<[string, string]> = [];
  for (let index = 1; index <= count; index++) {
    rows.push([String(index), String(index * increment)]);
  }
  return { count, increment, target, entity, unit, rows };
}
