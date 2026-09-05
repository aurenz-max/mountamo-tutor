import { extractLesson } from './extract';
import type { AttemptEvidence, Demand, InstructionEvent, JourneyInput, JourneyProbe, JourneyRun, JourneyScenario, LearnerProfile, LessonResult, ProbeEvidence } from './types';

export const MODEL_VERSION = 'content-opportunity-v1';
export const PROFILES: LearnerProfile[] = [
  { id: 'steady', initial: {}, learningRate: .32, decay: .025, echo: .98, slip: .02, hearsTutor: true, canSpeak: true, canTap: true, reader: 'none' },
  { id: 'fast', initial: {}, learningRate: .60, decay: .01, echo: .99, slip: .01, hearsTutor: true, canSpeak: true, canTap: true, reader: 'none' },
  { id: 'struggling', initial: {}, learningRate: .10, decay: .03, echo: .85, slip: .10, hearsTutor: true, canSpeak: true, canTap: true, reader: 'none' },
  { id: 'echo-only', initial: {}, learningRate: 0, decay: 0, echo: 1, slip: 0, hearsTutor: true, canSpeak: true, canTap: true, reader: 'none' },
  { id: 'forgetful', initial: {}, learningRate: .50, decay: .35, echo: .98, slip: .02, hearsTutor: true, canSpeak: true, canTap: true, reader: 'none' },
  { id: 'no-audio', initial: {}, learningRate: .32, decay: .025, echo: 0, slip: .02, hearsTutor: false, canSpeak: true, canTap: true, reader: 'none' },
];

const clamp = (n: number) => Math.max(0, Math.min(1, n));
export const knowledgeKey = (d: Demand) => `${d.capability}:${d.capability === 'decode' ? '*' : d.target}`;
const matches = (target: Demand, event: Demand) => target.capability === event.capability && (target.target === '*' || target.target === event.target);
const mean = (rows: ProbeEvidence[]) => rows.length ? rows.filter((r) => r.correct).length / rows.length : 0;

export class ContentLearner {
  knowledge: Record<string, number>;
  private state: number;
  private examples = new Map<string, number>();
  private recent: string[] = [];
  constructor(readonly profile: LearnerProfile, seed: number) {
    this.knowledge = { ...profile.initial };
    this.state = seed >>> 0;
  }
  private random(): number {
    this.state = (Math.imul(this.state, 1664525) + 1013904223) >>> 0;
    return this.state / 4294967296;
  }
  probability(d: Demand): number {
    let p = this.knowledge[knowledgeKey(d)] ?? 0;
    if (d.capability === 'decode') {
      // A memorized modeled word cannot substitute for sound knowledge on a novel word.
      const sounds = d.graphemes.map((g) => Math.max(this.knowledge[`sound-production:${g}`] ?? 0, .8 * (this.knowledge[`sound-recognition:${g}`] ?? 0)));
      p = Math.min(p, ...sounds);
    }
    return clamp(p * (1 - this.profile.slip));
  }
  private learn(e: InstructionEvent, strength: number) {
    const key = knowledgeKey(e);
    // Repeating one word forever earns diminishing evidence, not unlimited transfer.
    const example = `${key}:${e.target}`;
    const count = this.examples.get(example) ?? 0;
    this.examples.set(example, count + 1);
    const gain = this.profile.learningRate * strength / Math.sqrt(1 + count);
    this.knowledge[key] = clamp((this.knowledge[key] ?? 0) + gain * (1 - (this.knowledge[key] ?? 0)));
  }
  act(e: InstructionEvent, inScope: boolean): AttemptEvidence {
    const rank = { none: 0, emerging: 1, developing: 2 };
    const accessible = this.profile.hearsTutor && rank[this.profile.reader] >= rank[e.reader]
      && (e.modality === 'spoken' ? this.profile.canSpeak : this.profile.canTap);
    const before = this.probability(e);
    const warm = this.recent.includes(`${e.capability}:${e.target}`);
    const independent = accessible && !e.modeled && !warm;
    // Respond before applying instruction's durable learning effect. Echo is its own route.
    const knows = accessible && this.random() < before;
    const echoes = accessible && !knows && (e.modeled || warm) && this.random() < this.profile.echo;
    const guesses = accessible && !knows && !echoes && e.modality === 'tap' && this.random() < .5;
    const firstCorrect = knows || echoes || guesses;
    const correction = accessible && !firstCorrect && e.feedback;
    const finalCorrect = firstCorrect || (correction && this.random() < this.profile.echo);
    if (accessible && inScope && e.explainsRelation && (e.modeled || correction || (independent && firstCorrect && e.feedback))) {
      this.learn(e, e.guided ? 1 : .75);
    }
    if (accessible) this.recent = [...this.recent.slice(-1), `${e.capability}:${e.target}`];
    return { ...e, accessible, independent, firstCorrect, finalCorrect, correction,
      responseRoute: !accessible ? 'inaccessible' : knows ? 'knowledge' : echoes ? 'echo' : 'guess',
      before, after: this.probability(e) };
  }
  /** Assessment never teaches, supplies the answer, or modifies memory. */
  probe(probes: JourneyProbe[]): ProbeEvidence[] {
    return probes.map((p) => {
      const probability = this.profile.canSpeak && this.profile.hearsTutor ? this.probability(p) : 0;
      return { ...p, probability, correct: this.random() < probability };
    });
  }
  sleep(days: number) {
    for (const key of Object.keys(this.knowledge)) this.knowledge[key] *= Math.exp(-this.profile.decay * days);
    this.recent = [];
  }
}

export function validateScenario(s: JourneyScenario): void {
  if (s.version !== 1 || !s.id || !s.curriculumSource || !s.lessons?.length) throw new Error('Scenario needs version 1, id, curriculumSource and lessons');
  if (!Number.isInteger(s.minIndependentItems) || s.minIndependentItems < 1 || !(s.minProbeAccuracy > 0 && s.minProbeAccuracy <= 1) || !(s.retentionDays > 0)) throw new Error('Invalid evidence thresholds');
  if (!s.seeds?.length || s.seeds.some((x) => !Number.isInteger(x))) throw new Error('At least one integer seed required');
  const ids = new Set<string>();
  for (const l of s.lessons) {
    if (!l.id || ids.has(l.id) || l.requires.some((r) => !ids.has(r))) throw new Error(`Invalid/forward prerequisite or duplicate lesson: ${l.id}`);
    ids.add(l.id);
    if (!l.targets.length || !l.probes.length || !l.allowedGraphemes.length) throw new Error(`${l.id}: targets, allowedGraphemes and probes are required`);
    if (new Set(l.probes.map((p) => p.id)).size !== l.probes.length) throw new Error(`${l.id}: duplicate probe IDs`);
    const wordProbes = l.probes.filter((p) => p.capability === 'decode');
    if (new Set(wordProbes.map((p) => p.target)).size !== wordProbes.length) throw new Error(`${l.id}: repeated words cannot count as novel transfer probes`);
    for (const t of l.targets) {
      if (l.probes.filter((p) => matches(t, p)).length < s.minIndependentItems) throw new Error(`${l.id}: too few probes for ${knowledgeKey(t)}`);
    }
    for (const p of l.probes) {
      if (!p.target || p.target === '*' || !p.graphemes.length || p.graphemes.some((g) => !l.allowedGraphemes.includes(g))) throw new Error(`${l.id}: invalid/out-of-scope probe ${p.id}`);
      if (p.capability === 'decode' && p.graphemes.join('') !== p.target) throw new Error(`${l.id}: probe graphemes disagree with ${p.target}`);
    }
  }
}

export interface JourneyOptions {
  /** Audit mode: run every lesson from the retained state even when the previous one did not ADVANCE.
   *  Never a readiness claim — the report labels it. */
  waivePrerequisites?: boolean;
}

export function runJourney(scenario: JourneyScenario, inputs: JourneyInput[], profile: LearnerProfile, seed: number, options: JourneyOptions = {}): JourneyRun {
  validateScenario(scenario);
  const learner = new ContentLearner(profile, seed);
  const approved = new Set<string>();
  const lessons: LessonResult[] = [];
  const practicedWords = new Set<string>();
  for (const contract of scenario.lessons) {
    const input = inputs.find((i) => i.contract.id === contract.id);
    if (!input) throw new Error(`No package supplied for ${contract.id}`);
    const extracted = extractLesson(input.package, contract);
    const reasons: string[] = [];
    const prerequisites = contract.requires.filter((r) => !approved.has(r));
    const result: LessonResult = {
      lessonId: contract.id, packageId: input.package.id, decision: 'INSUFFICIENT_EVIDENCE', reasons,
      before: [], after: [], delayed: [], attempts: [], findings: extracted.findings, unknowns: extracted.unknowns, exposures: extracted.exposures,
      independentItems: 0, knowledge: {},
    };
    if (prerequisites.length && !options.waivePrerequisites) {
      result.decision = 'BLOCKED'; reasons.push(`Prerequisites not demonstrated: ${prerequisites.join(', ')}`);
      result.knowledge = { ...learner.knowledge }; lessons.push(result); continue;
    }
    if (prerequisites.length) {
      result.prerequisitesWaived = true;
      reasons.push(`Audit only — prerequisites waived: ${prerequisites.join(', ')} not demonstrated`);
    }
    result.before = learner.probe(contract.probes);
    for (const event of extracted.events) {
      const inScope = !extracted.findings.some((f) => f.source === event.source && f.code === 'OUT_OF_SCOPE');
      result.attempts.push(learner.act(event, inScope));
      if (event.capability === 'decode') practicedWords.add(event.target);
    }
    result.independentItems = result.attempts.filter((a) => a.independent).length;
    const contaminated = contract.probes.filter((p) => p.capability === 'decode' && practicedWords.has(p.target));
    if (contaminated.length) reasons.push(`Transfer probes appeared in instruction: ${contaminated.map((p) => p.id).join(', ')}`);
    const validProbes = contract.probes.filter((p) => !contaminated.includes(p));
    result.after = learner.probe(validProbes);
    // Actual virtual time passes: the next lesson starts from retained state, not the post-test peak.
    learner.sleep(scenario.retentionDays);
    result.delayed = learner.probe(validProbes);
    for (const target of contract.targets) {
      const delivered = result.attempts.filter((a) => matches(target, a));
      if (!delivered.length) reasons.push(`No delivered task for ${knowledgeKey(target)}`);
      const independent = delivered.filter((a) => a.independent);
      if (independent.length < scenario.minIndependentItems) reasons.push(`Too few independent in-lesson attempts for ${knowledgeKey(target)} (${independent.length}/${scenario.minIndependentItems})`);
    }
    if (extracted.unknowns.length) reasons.push(`${extracted.unknowns.length} block(s) have unverified instructional behavior`);
    if (extracted.findings.length) {
      result.decision = 'BLOCKED'; reasons.push('Content contract failures must be repaired before progression');
    } else if (reasons.length) result.decision = 'INSUFFICIENT_EVIDENCE';
    else {
      const postPass = contract.targets.every((t) => mean(result.after.filter((p) => matches(t, p))) >= scenario.minProbeAccuracy);
      const delayedPass = contract.targets.every((t) => mean(result.delayed.filter((p) => matches(t, p))) >= scenario.minProbeAccuracy);
      const independentPass = contract.targets.every((t) => {
        const rows = result.attempts.filter((a) => a.independent && matches(t, a));
        return rows.filter((a) => a.firstCorrect).length / rows.length >= scenario.minProbeAccuracy;
      });
      result.decision = !postPass || !independentPass ? 'REMEDIATE' : !delayedPass ? 'REVIEW' : 'ADVANCE';
      reasons.push(!postPass || !independentPass ? 'Independent production/transfer has not met the contract' : !delayedPass ? 'Delayed evidence fell below the contract' : 'Independent, transfer and delayed evidence met the contract under this learner model');
    }
    // A waived run can never certify: an ADVANCE here would be built on an undemonstrated prerequisite.
    if (result.prerequisitesWaived && result.decision === 'ADVANCE') { result.decision = 'INSUFFICIENT_EVIDENCE'; reasons.push('Would advance on its own evidence, but the prerequisite chain was waived'); }
    if (result.decision === 'ADVANCE') approved.add(contract.id);
    result.knowledge = { ...learner.knowledge };
    lessons.push(result);
  }
  return { profile: profile.id, seed, lessons };
}
