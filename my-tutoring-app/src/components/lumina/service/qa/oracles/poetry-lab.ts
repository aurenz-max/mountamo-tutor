import type { ContentOracle, OracleResult, OracleViolation } from './types';
import { asRecordArray } from './helpers';

const norm = (value: unknown): string => String(value ?? '').trim().toLowerCase();

const lineEnding = (line: unknown): string => {
  const words = String(line ?? '').trim().split(/\s+/);
  return norm(words[words.length - 1]).replace(/^[^a-z]+|[^a-z]+$/g, '');
};

const hasValue = (data: Record<string, unknown>, key: string): boolean =>
  data[key] !== undefined && data[key] !== null;

const containsEmojiPicture = (value: unknown): boolean =>
  /[\u2600-\u27BF\u2B00-\u2BFF]|[\uD83C-\uDBFF][\uDC00-\uDFFF]/.test(String(value ?? ''));

const forbidFields = (
  data: Record<string, unknown>,
  fields: string[],
  where: string,
  violations: OracleViolation[],
) => {
  for (const field of fields) {
    if (hasValue(data, field)) {
      violations.push({ check: 'schema', where, detail: `mode must not contain ${field}` });
    }
  }
};

const verifyAnalysis = (data: Record<string, unknown>, violations: OracleViolation[]): number => {
  const lines = Array.isArray(data.poemLines) ? data.poemLines.map(String) : [];
  const poem = String(data.poem ?? '');
  if (lines.length === 0 || lines.some((line) => !line.trim())) {
    violations.push({ check: 'schema', where: 'analysis.poemLines', detail: 'poemLines must be non-empty strings' });
  }
  if (poem !== lines.join('\n')) {
    violations.push({ check: 'answer-key-desync', where: 'analysis.poem', detail: 'poem does not equal poemLines joined with newlines' });
  }

  const moodOptions = Array.isArray(data.moodOptions) ? data.moodOptions.map(norm) : [];
  const correctMood = norm(data.correctMood);
  if (moodOptions.length < 3 || moodOptions.length > 4) {
    violations.push({ check: 'schema', where: 'analysis.moodOptions', detail: `expected 3-4 mood options, received ${moodOptions.length}` });
  }
  if (!correctMood || !moodOptions.includes(correctMood)) {
    violations.push({ check: 'answer-key-desync', where: 'analysis.correctMood', detail: 'correctMood is not a member of moodOptions (case-insensitive)' });
  }

  const rhymeOptions = Array.isArray(data.rhymeSchemeOptions) ? data.rhymeSchemeOptions.map(norm) : [];
  const rhymeScheme = norm(data.rhymeScheme);
  if (rhymeOptions.length === 0 || !rhymeOptions.includes(rhymeScheme)) {
    violations.push({ check: 'answer-key-desync', where: 'analysis.rhymeScheme', detail: 'rhymeScheme is not a member of rhymeSchemeOptions' });
  }

  let previousEnd = -1;
  const instances = asRecordArray(data.figurativeInstances);
  for (let index = 0; index < instances.length; index++) {
    const instance = instances[index];
    const start = Number(instance.startIndex);
    const end = Number(instance.endIndex);
    const text = String(instance.text ?? '');
    const where = `analysis.figurative#${index + 1}`;
    if (!Number.isInteger(start) || !Number.isInteger(end) || start < 0 || end <= start || poem.slice(start, end) !== text) {
      violations.push({ check: 'answer-key-desync', where, detail: 'figurative slice does not reproduce its declared text' });
    }
    if (start < previousEnd) {
      violations.push({ check: 'schema', where, detail: 'figurative instances overlap or are not sorted' });
    }
    previousEnd = Math.max(previousEnd, end);
  }

  forbidFields(data, ['templateType', 'compositionPrompt', 'templateConstraints', 'rounds'], 'analysis', violations);
  return 1 + instances.length;
};

const verifyComposition = (data: Record<string, unknown>, violations: OracleViolation[]): number => {
  const prompt = String(data.compositionPrompt ?? '').trim();
  const templateType = String(data.templateType ?? '');
  const constraints = data.templateConstraints && typeof data.templateConstraints === 'object'
    ? data.templateConstraints as Record<string, unknown>
    : {};
  const lineCount = Number(constraints.lineCount);
  const syllables = Array.isArray(constraints.syllablesPerLine)
    ? constraints.syllablesPerLine.map(Number)
    : undefined;
  const rhymePattern = String(constraints.rhymePattern ?? '').toUpperCase();
  const acrosticWord = String(constraints.acrosticWord ?? '').trim();

  if (!prompt) violations.push({ check: 'schema', where: 'composition.compositionPrompt', detail: 'compositionPrompt is empty' });
  if (!templateType) violations.push({ check: 'schema', where: 'composition.templateType', detail: 'templateType is missing' });
  if (!Number.isInteger(lineCount) || lineCount < 1) {
    violations.push({ check: 'schema', where: 'composition.templateConstraints', detail: 'lineCount must be at least 1' });
  }

  if (templateType === 'haiku' && (lineCount !== 3 || JSON.stringify(syllables) !== JSON.stringify([5, 7, 5]))) {
    violations.push({ check: 'answer-key-desync', where: 'composition.haiku', detail: 'haiku must use 3 lines with syllables [5,7,5]' });
  }
  if (templateType === 'limerick' && (lineCount !== 5 || rhymePattern !== 'AABBA' || JSON.stringify(syllables) !== JSON.stringify([8, 8, 5, 5, 8]))) {
    violations.push({ check: 'answer-key-desync', where: 'composition.limerick', detail: 'limerick must use AABBA and syllables [8,8,5,5,8]' });
  }
  if (templateType === 'sonnet-intro' && (lineCount !== 4 || rhymePattern !== 'ABAB')) {
    violations.push({ check: 'answer-key-desync', where: 'composition.sonnet-intro', detail: 'sonnet-intro must use 4 lines with ABAB' });
  }
  if (templateType === 'acrostic' && (!acrosticWord || lineCount !== acrosticWord.length)) {
    violations.push({ check: 'answer-key-desync', where: 'composition.acrostic', detail: 'acrostic lineCount must equal acrosticWord length' });
  }

  forbidFields(
    data,
    ['poem', 'poemLines', 'correctMood', 'moodOptions', 'figurativeInstances', 'rhymeScheme', 'rhymeSchemeOptions', 'rounds'],
    'composition',
    violations,
  );
  return 1;
};

const verifyRhymeHunt = (data: Record<string, unknown>, violations: OracleViolation[]): number => {
  const rounds = asRecordArray(data.rounds);
  if (rounds.length < 3) {
    violations.push({ check: 'schema', where: 'rhyme_hunt.rounds', detail: `expected at least 3 rounds, received ${rounds.length}` });
  }

  for (let index = 0; index < rounds.length; index++) {
    const round = rounds[index];
    const where = `rhyme_hunt.round#${index + 1}`;
    const lines = Array.isArray(round.poemLines) ? round.poemLines : [];
    const endings = lines.map(lineEnding);
    const candidates = asRecordArray(round.candidates);
    const candidateWords = candidates.map((candidate) => norm(candidate.word));
    const endingSet = new Set(endings);

    if (lines.length !== 4) {
      violations.push({ check: 'schema', where, detail: `expected 4 poemLines, received ${lines.length}` });
    }
    if (candidates.length !== 4) {
      violations.push({ check: 'schema', where, detail: `expected 4 candidates, received ${candidates.length}` });
    }
    if (candidates.some((candidate) => !norm(candidate.word) || !containsEmojiPicture(candidate.emoji))) {
      violations.push({ check: 'schema', where, detail: 'every candidate needs a non-empty word and an actual emoji picture' });
    }
    if (new Set(candidateWords).size !== candidateWords.length) {
      violations.push({ check: 'schema', where, detail: 'candidate words must be deduplicated' });
    }
    if (endings.length === 4 && (candidateWords.length !== 4 || candidateWords.some((word) => !endingSet.has(word)) || endings.some((word) => !candidateWords.includes(word)))) {
      violations.push({ check: 'answer-key-desync', where, detail: 'candidates must equal the four independently derived line-ending words' });
    }

    const a = norm(round.rhymeWordA);
    const b = norm(round.rhymeWordB);
    if (!a || !b || a === b || !endingSet.has(a) || !endingSet.has(b)) {
      violations.push({ check: 'answer-key-desync', where, detail: 'the two distinct declared rhyme words must both be derived line endings' });
    }
  }

  forbidFields(
    data,
    ['poem', 'poemLines', 'correctMood', 'moodOptions', 'figurativeInstances', 'rhymeScheme', 'rhymeSchemeOptions', 'templateType', 'compositionPrompt', 'templateConstraints'],
    'rhyme_hunt',
    violations,
  );
  return rounds.length;
};

export const poetryLabOracle: ContentOracle = {
  componentId: 'poetry-lab',
  verify(data, ctx): OracleResult {
    const violations: OracleViolation[] = [];
    const mode = String(data.mode ?? ctx.evalMode);
    let checkedChallenges = 0;

    if (mode === 'analysis') checkedChallenges = verifyAnalysis(data, violations);
    else if (mode === 'composition') checkedChallenges = verifyComposition(data, violations);
    else if (mode === 'rhyme_hunt') checkedChallenges = verifyRhymeHunt(data, violations);
    else {
      violations.push({ check: 'schema', where: 'mode', detail: `unsupported Poetry Lab mode "${mode}"` });
    }

    return { violations, uncheckedTypes: [], checkedChallenges };
  },
};
