/**
 * evidence-finder's in-item levers (/add-support-tiers; report qa/eval-reports/evidence-finder-levers-2026-10-09.md).
 * No real-learner evidence: the misses are what `evidenceFinderMiss` observes; the catalog's commonStruggles name
 * "opinion vs evidence", "weak evidence" and "wrong section". Every answer is a fact about THIS passage (which
 * sentences prove the claim, which claim each supports, how strong each is), so no lever marks, orders or singles out
 * a sentence of the passage. Help levers count, or show a worked example on another topic; simplify levers open a
 * short practice passage on another topic.
 *
 * find (`not_evidence`, `wrong_claim`, `missed_evidence`):
 * - `evidence_count` (help) under each claim a row of boxes, one per sentence that clearly proves it (strong or
 *   moderate), filled one per sentence highlighted under that claim. It counts picks, never marks which (`countLeaks`).
 * - `proof_example` (help) a worked example on another topic: a claim (two on a two-claim passage), a sentence that
 *   proves it, one only about the topic, and an opinion, each marked with why. None of the passage's topic (`poolLeaks`).
 * - `practice_passage` (simplify) a four-sentence practice passage on another topic, the same number of claims, every
 *   proving sentence strong. Ungraded; the full passage comes back after it, blank.
 * rate (`weak_as_strong`, `rated_too_strong`, `rated_too_weak`, `mixed_ratings`):
 * - `strength_guide` (help) what Strong, Moderate and Weak mean, each with an example on another topic.
 * - `practice_ratings` (simplify) two sentences to rate on another topic, one strong and one weak (far apart).
 */
import type { WorkspaceLever } from '../../../components/live-activity/runtime/contract';
import type { TeachingAssignment } from '../../../components/live-activity/runtime/useTeachingWorkspace';
import type { EvidenceFinderData } from './EvidenceFinder';
import {
  FIND_MISSES, RATE_MISSES, claimOf, requiredEvidence, type EvidenceFinderItem, type EvidenceFinderMiss, type Strength,
} from './evidenceFinderWorkspace';

export const COUNT_LEVER = 'evidence_count';
export const EXAMPLE_LEVER = 'proof_example';
export const PASSAGE_LEVER = 'practice_passage';
export const GUIDE_LEVER = 'strength_guide';
export const RATINGS_LEVER = 'practice_ratings';
export const PRACTICE_SUFFIX = '~simpler';
export const PRACTICE_NOTE = 'A short practice passage on another topic, ungraded; the full passage comes back after it, blank.';

export const practiceId = (item: EvidenceFinderItem['id']) => `${item}${PRACTICE_SUFFIX}`;
export const practicePhase = (id: string | null | undefined): EvidenceFinderItem['id'] | null =>
  id?.endsWith(PRACTICE_SUFFIX) ? id.slice(0, -PRACTICE_SUFFIX.length) as EvidenceFinderItem['id'] : null;

// ── the other-topic pool ───────────────────────────────────────────────────

/** One topic far from any generated passage's, with every sentence a worked example or a practice item needs. */
export interface PoolTopic {
  topic: string;
  /** A passage that uses any of these words is on this topic: the pool entry is not used for it. */
  words: readonly string[];
  claims: [string, string];
  /** Two strong proofs of claim 1, one of claim 2. */
  proves: [string, string];
  provesSecond: string;
  /** Supports claim 1 less directly. */
  moderate: string;
  /** Only relates to claim 1. */
  weak: string;
  /** About the topic, proves neither claim. */
  topical: string;
  opinion: string;
}

export const POOL: readonly PoolTopic[] = [
  { topic: 'frogs', words: ['frog', 'frogs', 'tadpole', 'tadpoles', 'toad', 'toads'],
    claims: ['Frogs are good jumpers.', 'Frogs eat insects.'],
    proves: ['A frog can jump twenty times the length of its body.', 'Long back legs push a frog high into the air.'],
    provesSecond: 'A frog catches flies with its long, sticky tongue.',
    moderate: 'Frogs have long back legs.', weak: 'Frogs move around the pond every day.',
    topical: 'Frogs live near ponds and streams.', opinion: 'Frogs are the cutest animals in the pond.' },
  { topic: 'owls', words: ['owl', 'owls', 'owlet', 'owlets'],
    claims: ['Owls hunt at night.', 'Owls fly without a sound.'],
    proves: ['Owls catch mice in the dark while most birds sleep.', 'An owl\'s big eyes let it see when there is very little light.'],
    provesSecond: 'Soft edges on an owl\'s feathers make its wings quiet.',
    moderate: 'Owls are awake when people are in bed.', weak: 'Owls have sharp claws.',
    topical: 'Owls build nests in old trees.', opinion: 'Owls are the most beautiful birds.' },
  { topic: 'bikes', words: ['bike', 'bikes', 'bicycle', 'bicycles', 'cycling', 'pedal', 'pedals'],
    claims: ['Riding a bike is good exercise.', 'Bikes keep the air clean.'],
    proves: ['Pedaling makes your heart and leg muscles work hard.', 'Doctors say a daily bike ride keeps your heart strong.'],
    provesSecond: 'A bike makes no smoke, so it does not dirty the air.',
    moderate: 'Riding uphill makes you breathe hard.', weak: 'Many kids ride bikes to school.',
    topical: 'Bikes come in many colors and sizes.', opinion: 'Red bikes are the best bikes.' },
];

const norm = (s: string) => s.trim().toLowerCase();
const wordIn = (w: string, text: string) =>
  new RegExp(`(?<![a-z0-9])${w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![a-z0-9])`).test(text);
const sessionText = (data: EvidenceFinderData) =>
  norm([data.title, data.passage.text, ...data.passage.sentences.map(s => s.text), ...data.claims.map(c => c.text)].join(' '));

/** Leak rule for every other-topic example or practice item: the session passage never uses the pool topic's words. */
export function poolLeaks(entry: PoolTopic, data: EvidenceFinderData): boolean {
  const text = sessionText(data);
  return entry.words.some(w => wordIn(w, text));
}

const seedStart = (data: EvidenceFinderData) => {
  let n = 0;
  for (const ch of `${data.title}|${data.passage.sentences.map(s => s.id).join('|')}`) n = (n * 31 + ch.charCodeAt(0)) >>> 0;
  return n;
};

/** The pool topics this passage can use, from its seed: the example first, then the practice (a different one when it can). */
function topics(data: EvidenceFinderData): PoolTopic[] {
  const start = seedStart(data);
  return POOL.map((_, k) => POOL[(start + k) % POOL.length]).filter(t => !poolLeaks(t, data));
}
export const exampleTopic = (data: EvidenceFinderData): PoolTopic | null => topics(data)[0] ?? null;
export const practiceTopic = (data: EvidenceFinderData): PoolTopic | null => topics(data)[1] ?? topics(data)[0] ?? null;

// ── help: what each lever draws ────────────────────────────────────────────

/** One marked sentence of the worked example. */
export interface ExampleLine { text: string; mark: 'proves' | 'topic' | 'opinion'; claim?: number; why: string }
export interface ProofExample { topic: string; claims: string[]; lines: ExampleLine[] }

/** The worked example: the session's number of claims, on another topic. */
export function proofExample(data: EvidenceFinderData): ProofExample | null {
  const t = exampleTopic(data);
  if (!t) return null;
  const two = data.claims.length > 1;
  return {
    topic: t.topic,
    claims: two ? [...t.claims] : [t.claims[0]],
    lines: [
      { text: t.proves[0], mark: 'proves', claim: 0, why: two ? 'a fact that proves claim 1' : 'a fact that proves the claim' },
      ...(two ? [{ text: t.provesSecond, mark: 'proves' as const, claim: 1, why: 'a fact that proves claim 2' }] : []),
      { text: t.topical, mark: 'topic', why: 'about the topic, but it proves nothing' },
      { text: t.opinion, mark: 'opinion', why: 'an opinion, not a fact' },
    ],
  };
}

export interface StrengthGuide { topic: string; claim: string; rows: Array<{ strength: Strength; means: string; example: string }> }

export function strengthGuide(data: EvidenceFinderData): StrengthGuide | null {
  const t = exampleTopic(data);
  if (!t) return null;
  return { topic: t.topic, claim: t.claims[0], rows: [
    { strength: 'strong', means: 'a specific fact that proves the claim', example: t.proves[0] },
    { strength: 'moderate', means: 'helps the claim, but less directly', example: t.moderate },
    { strength: 'weak', means: 'only mentions the idea; it does not prove it', example: t.weak },
  ] };
}

/** Per claim: how many sentences clearly prove it (strong or moderate). */
export const proofCounts = (data: EvidenceFinderData): number[] =>
  data.claims.map((_, i) => requiredEvidence(data).filter(s => claimOf(data, s) === i).length);

/**
 * Leak rule for the count: refused when a claim has nothing that clearly proves it (an empty row says "this one has
 * none"), or when the proving sentences are every sentence (the count would say "pick them all").
 */
export function countLeaks(data: EvidenceFinderData): boolean {
  const counts = proofCounts(data);
  return counts.some(n => n === 0) || counts.reduce((a, b) => a + b, 0) >= data.passage.sentences.length;
}

// ── simplify: the practice items ───────────────────────────────────────────

/**
 * The practice passage for find: four or five sentences on another topic, the session's number of claims, every proving
 * sentence strong and stated outright. The practice for rate: one strong and one weak sentence (plus one that is not
 * evidence, never rated) for one claim.
 */
export function practiceFor(item: EvidenceFinderItem, data: EvidenceFinderData): EvidenceFinderData | null {
  const t = practiceTopic(data);
  if (!t) return null;
  const s = (id: string, text: string, claimIndex?: number, evidenceStrength?: Strength) =>
    (claimIndex === undefined ? { id, text, isEvidence: false } : { id, text, isEvidence: true, claimIndex, evidenceStrength });
  const two = data.claims.length > 1;
  const sentences = item.id === 'rate'
    ? [s('p1', t.proves[0], 0, 'strong'), s('p2', t.topical), s('p3', t.weak, 0, 'weak')]
    : two
      ? [s('p1', t.topical), s('p2', t.proves[0], 0, 'strong'), s('p3', t.opinion), s('p4', t.provesSecond, 1, 'strong')]
      : [s('p1', t.topical), s('p2', t.proves[0], 0, 'strong'), s('p3', t.opinion), s('p4', t.proves[1], 0, 'strong')];
  const claims = (item.id === 'find' && two ? t.claims : [t.claims[0]])
    .map((text, i) => ({ id: `practice-claim${i + 1}`, text, color: i ? 'violet' : 'blue' }));
  const p: EvidenceFinderData = {
    title: 'Practice passage', gradeLevel: data.gradeLevel, cerEnabled: data.cerEnabled,
    passage: { text: sentences.map(x => x.text).join(' '), sentences }, claims,
  };
  return practiceLeaks(p, data) ? null : p;
}

/** Leak rule for a practice item: never the session's passage, and no sentence or claim of it. */
export function practiceLeaks(p: EvidenceFinderData, data: EvidenceFinderData): boolean {
  const theirs = new Set([...data.passage.sentences.map(s => s.text), ...data.claims.map(c => c.text)].map(norm));
  return norm(p.passage.text) === norm(data.passage.text)
    || [...p.passage.sentences.map(s => s.text), ...p.claims.map(c => c.text)].some(x => theirs.has(norm(x)));
}

export function practiceAssignment(item: EvidenceFinderItem, p: EvidenceFinderData): TeachingAssignment {
  const task = item.id === 'rate'
    ? 'Practice passage: rate how strong each piece of evidence is: Strong, Moderate or Weak.'
    : p.claims.length > 1
      ? `Practice passage: highlight every sentence that is evidence, under the claim it supports: ${p.claims
        .map((c, i) => `claim ${i + 1}, "${c.text}"`).join('; ')}.`
      : `Practice passage: highlight every sentence that is evidence for the claim: "${p.claims[0].text}".`;
  return { id: practiceId(item.id), task, response: 'gesture' };
}

// ── declarations ───────────────────────────────────────────────────────────

/** The levers on a session item. A practice item carries none. */
export function evidenceFinderLevers(item: EvidenceFinderItem | null | undefined, data: EvidenceFinderData,
  pulled: readonly string[]): WorkspaceLever[] {
  if (!item) return [];
  const lever = (id: string, kind: WorkspaceLever['kind'], answers: readonly EvidenceFinderMiss[], when: string, does: string): WorkspaceLever =>
    ({ id, kind, carrier: 'shown', pulled: pulled.includes(id), answers, when, does });
  const practice = practiceFor(item, data);
  if (item.id === 'find') return [
    ...(countLeaks(data) ? [] : [lever(COUNT_LEVER, 'help', ['missed_evidence', 'wrong_claim'],
      'The learner stops before finding all the evidence, or puts evidence under the wrong claim.',
      data.claims.length > 1
        ? 'Shows under each claim a row of boxes, one for each sentence that clearly proves it, filling one per sentence '
          + 'highlighted under that claim. It counts; it never marks which sentences. You may say how many each claim has.'
        : 'Shows under the claim a row of boxes, one for each sentence that clearly proves it, filling one per sentence '
          + 'highlighted. It counts; it never marks which sentences. You may say how many there are.')]),
    ...(proofExample(data) ? [lever(EXAMPLE_LEVER, 'help', ['not_evidence', 'wrong_claim'],
      'The learner highlights sentences that are only about the topic, or opinions, or sorts them under the wrong claim.',
      'Shows a worked example on another topic: a claim, a sentence that proves it, one that is only about the topic, and '
        + 'an opinion, each marked with why. Nothing from this passage is on it.')] : []),
    ...(practice ? [lever(PASSAGE_LEVER, 'simplify', FIND_MISSES,
      'The learner cannot find the evidence in a passage this long yet.',
      'Opens a four-sentence practice passage on another topic with the same task first. It is not graded; this passage '
        + 'comes back after it, blank.')] : []),
  ];
  return [
    ...(strengthGuide(data) ? [lever(GUIDE_LEVER, 'help', RATE_MISSES,
      'The learner rates evidence too strong or too weak, or rates a sentence that only mentions the idea as Strong.',
      'Shows what Strong, Moderate and Weak mean, each with an example sentence on another topic. Nothing from this '
        + 'passage is on it.')] : []),
    ...(practice ? [lever(RATINGS_LEVER, 'simplify', RATE_MISSES,
      'The learner cannot tell the strengths apart in this passage yet.',
      'Opens a practice with two sentences on another topic to rate, one strong and one weak, first. It is not graded; '
        + 'this passage comes back after it, blank.')] : []),
  ];
}

/** What the pulled help levers put on screen, for the tutor. Never a sentence of the passage singled out. */
export function evidenceFinderLeverFacts(item: EvidenceFinderItem, data: EvidenceFinderData, pulled: readonly string[],
  highlighted: Readonly<Record<string, number>>): string {
  const has = (id: string) => pulled.includes(id);
  if (item.id === 'find') {
    const counts = proofCounts(data);
    const filled = (i: number) => Object.values(highlighted).filter(c => c === i).length;
    const count = has(COUNT_LEVER) && !countLeaks(data)
      ? (data.claims.length > 1
        ? `Under each claim, a row of boxes, one for each sentence that clearly proves it (${counts.map((n, i) =>
          `claim ${i + 1}: ${n}, ${Math.min(filled(i), n)} filled`).join('; ')}). It does not mark which sentences.`
        : `Under the claim, a row of ${counts[0]} boxes, one for each sentence that clearly proves it, ${Math.min(filled(0), counts[0])} `
          + 'filled. It does not mark which sentences.') : '';
    const ex = has(EXAMPLE_LEVER) ? proofExample(data) : null;
    const example = ex ? `A worked example about ${ex.topic}, not this passage: ${ex.claims.map((c, i) =>
      `${ex.claims.length > 1 ? `claim ${i + 1}` : 'claim'} "${c}"`).join(', ')}; ${ex.lines.map(l => `"${l.text}" is marked ${l.why}`)
      .join('; ')}.` : '';
    return [count, example].filter(Boolean).join(' ');
  }
  const g = has(GUIDE_LEVER) ? strengthGuide(data) : null;
  return g ? `A strength guide about ${g.topic}, not this passage, for the claim "${g.claim}": ${g.rows.map(r =>
    `${r.strength === 'strong' ? 'Strong' : r.strength === 'moderate' ? 'Moderate' : 'Weak'} means ${r.means}, e.g. "${r.example}"`)
    .join('; ')}.` : '';
}
