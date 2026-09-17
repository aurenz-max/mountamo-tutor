import 'server-only';

/**
 * TypeSafe primitive selection — the SELECTION half of manifest creation.
 *
 * WHAT THIS IS. Given a topic, a grade and (optionally) the lesson's learning
 * objectives, rank the live catalog and pick one eval mode per shortlisted
 * primitive, using TypeSafe's System One model (typed Choice / Score / Noul
 * answers with probabilities; no generated text). Two requests, the shape of
 * docs.typesafe.ai/cookbooks/skill_suggestion.md:
 *
 *   Call 1 (skim)   every catalog primitive as a Choice option, asked FIVE ways
 *                   in one request: overall best, and best for each lesson phase
 *                   role — introduce / visualize / apply / assess. The per-role
 *                   questions matter: a single "which one best teaches this" is
 *                   winner-take-all (measured 0.98 on regrouping-workbench for
 *                   G2 regrouping) and starves the introduce/assess scaffolding a
 *                   block also needs. Plus subject Choice + an "informational"
 *                   Noul (the deep-dive signal).
 *   Call 2 (verify) the shortlist with full description, constraints and
 *                   affordances: a 4-level fit Score, a role Choice, and — for
 *                   multi-mode primitives — an eval-mode Choice over the
 *                   catalog's evalModes.
 *
 * WHAT THIS IS NOT. TypeSafe cannot author curatorBrief, titles or intents; it
 * does not emit JSON. A manifest built on this would have code assemble the
 * objective-block skeleton from the role winners and a generator author the
 * per-slot prose. This module is the measured POC of the selection step only;
 * it is consumed by /api/lumina/typesafe-select (dev panel) and
 * scripts/typesafe-manifest-probe.mjs. It does not touch the production
 * manifest path.
 */

import { UNIVERSAL_CATALOG } from '../catalog';
import { renderAffordanceTag, resolveAffordances } from '../catalog/affordances';
import type { ComponentDefinition } from '../../../types';
import {
  rankChoice,
  systemOne,
  type ChoiceAnswer,
  type ChoiceQuestion,
  type Question,
  type SystemOneUsage,
} from './typesafeClient';

export const PHASE_ROLES = ['introduce', 'visualize', 'apply', 'assess'] as const;
export type PhaseRole = (typeof PHASE_ROLES)[number];

const ROLE_INSTRUCTIONS: Record<PhaseRole, string> = {
  introduce:
    'Which component would best INTRODUCE this lesson topic to a student at the stated grade: explain the core vocabulary and idea before any practice? A reading, explainer, worked example or concept display fits here; a drill does not.',
  visualize:
    'Which component would best let the student VISUALIZE or manipulate a model of this topic at the stated grade: see the idea as concrete objects or a picture they can act on?',
  apply:
    'Which component would best give the student PRACTICE on this topic at the stated grade: problems they answer, build or solve, with feedback?',
  assess:
    'Which component would best ASSESS understanding of this topic at the end of the lesson, across everything taught?',
};

/**
 * How each phase-role Choice builds its option set.
 *   'none'        every catalog primitive is an option for every role (baseline).
 *   'affordances' a role's options are the primitives whose catalog
 *                 `affordances.role` includes that role, plus untagged
 *                 primitives (unknown, never excluded). Code owns the policy;
 *                 the model only ranks within it. Cuts skim input tokens and is
 *                 the lever against a dominant specialist bleeding into every
 *                 role (regrouping-workbench winning introduce AND assess).
 */
export type RoleFilter = 'none' | 'affordances';

/**
 * What the questions judge fit AGAINST.
 *   'topic'      the lesson topic, with objectives as extra state (baseline).
 *   'objective'  the learning objective(s); the topic is context only. The
 *                bench pilot showed topic-focused calls return the same role
 *                winners for every objective of a subskill (balance-scale 1.00
 *                on all three OPS001-11-a objectives) — the manifest picks
 *                DIFFERENT primitives per objective, so this is the lever.
 */
export type Focus = 'topic' | 'objective';

export interface SelectPrimitivesInput {
  topic: string;
  /** 'K' | '1'..'12' or a band name; passed through to the model as text. */
  grade: string;
  objectives?: string[];
  /** Shortlist size from the overall ranking (per-role winners are added on top). */
  k?: number;
  roleFilter?: RoleFilter;
  focus?: Focus;
  signal?: AbortSignal;
}

export interface RankedPrimitive {
  id: string;
  p: number;
  rank: number;
}

export interface RoleWinner {
  role: PhaseRole;
  id: string;
  p: number;
  confidence: number;
  runnersUp: RankedPrimitive[];
}

export interface VerifiedCandidate {
  id: string;
  /** Rank in the overall skim, or null if it entered the shortlist via a role. */
  skimRank: number | null;
  skimP: number;
  /** 0..3 probability-weighted; 3 = the canonical tool for exactly this topic. */
  fit: number;
  fitConfidence: number;
  fitLevels: Record<string, number>;
  role: PhaseRole;
  roleConfidence: number;
  /** Winning eval mode, or null when the primitive has fewer than two modes. */
  mode: string | null;
  modeConfidence: number | null;
  modeProbabilities: Record<string, number> | null;
  modeCandidates: number;
}

export interface CallStats {
  ms: number;
  usage: SystemOneUsage;
}

export interface SelectPrimitivesResult {
  topic: string;
  grade: string;
  objectives: string[] | null;
  model: string;
  catalogSize: number;
  roleFilter: RoleFilter;
  focus: Focus;
  /** How many catalog primitives each phase-role Choice was offered. */
  roleOptionCounts: Record<PhaseRole, number>;
  subject: { choice: string; confidence: number; probabilities: Record<string, number> };
  /** P(topic is informational background rather than a practiced skill). */
  informational: number;
  overall: RankedPrimitive[];
  roles: RoleWinner[];
  shortlist: VerifiedCandidate[];
  skim: CallStats;
  verify: CallStats;
}

/**
 * The candidates worth showing the curator: the verified shortlist's best fits.
 * Generic containers rarely clear `minFit` (their descriptions name no topic,
 * so the ranker scores them low), which is the point — this hands the curator
 * the specialists it tends to miss and leaves scaffold choice to its ladder.
 */
export function suggestSpecialists(
  result: SelectPrimitivesResult,
  opts: { max?: number; minFit?: number; excludeIds?: ReadonlySet<string> } = {},
): Array<{ id: string; fit: number; mode: string | null }> {
  const max = opts.max ?? 4;
  const minFit = opts.minFit ?? 1.5;
  const exclude = opts.excludeIds ?? new Set<string>();
  return result.shortlist
    .filter((s) => s.fit >= minFit && !exclude.has(s.id))
    .sort((a, b) => b.fit - a.fit)
    .slice(0, max)
    .map((s) => ({ id: s.id, fit: Math.round(s.fit * 100) / 100, mode: s.mode }));
}

/**
 * Phase scaffolds the curator places by POLICY (the Introduce/Visualize/Apply
 * ladder, spoken-first explain, caregiver block last). The first suggestion A/B
 * (qa/typesafe/suggest-ab-*) showed these turning up as 1.5–1.9 candidates on
 * most objectives and adding nothing the curator did not already do — the
 * block is for specialists it misses, so the strict arm never shows them.
 */
export const POLICY_SCAFFOLD_IDS: ReadonlySet<string> = new Set([
  'knowledge-check', 'flashcard-deck', 'annotated-example', 'concept-card-grid',
  'foundation-explorer', 'comparison-panel', 'fast-fact', 'di-spoken-practice',
  'take-home-activity', 'deep-dive', 'custom-visual', 'how-it-works', 'feature-exhibit',
  'generative-table', 'practice-problem',
]);

const FIT_LEVELS = [
  'Wrong domain or wrong age band; would not teach this topic',
  'Adjacent: same subject area but teaches a different skill than the topic',
  'Teaches this topic adequately; a reasonable choice',
  'The canonical tool for exactly this topic and grade',
];

function skimCriteria(catalog: ComponentDefinition[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const c of catalog) {
    out[c.id] = c.description.length > 220 ? `${c.description.slice(0, 217)}...` : c.description;
  }
  return out;
}

function candidateCard(c: ComponentDefinition) {
  return {
    id: c.id,
    description: c.description,
    constraints: c.constraints ?? null,
    affordances: renderAffordanceTag(c) || null,
    evalModes: (c.evalModes ?? []).map((m) => ({
      key: m.evalMode,
      label: m.label,
      description: m.description,
      beta: m.beta,
    })),
  };
}

export async function selectPrimitives(input: SelectPrimitivesInput): Promise<SelectPrimitivesResult> {
  const k = input.k ?? 8;
  const catalog = UNIVERSAL_CATALOG.filter((c) => c.id !== 'curator-brief');
  const byId = new Map<string, ComponentDefinition>(catalog.map((c) => [c.id, c]));
  const focus: Focus = input.focus === 'objective' && input.objectives?.length ? 'objective' : 'topic';
  const state =
    focus === 'objective'
      ? {
          learningObjective: input.objectives!.length === 1 ? input.objectives![0] : input.objectives,
          lessonTopic: input.topic,
          grade: input.grade,
        }
      : {
          topic: input.topic,
          grade: input.grade,
          ...(input.objectives?.length ? { learningObjectives: input.objectives } : {}),
        };
  // Every selection question judges against the same target; say which.
  const target =
    focus === 'objective'
      ? ' Judge fit to the LEARNING OBJECTIVE in the state — what this block must get the student to do. The lesson topic is context only.'
      : '';

  // ---- Call 1: skim ---------------------------------------------------------
  const criteria = skimCriteria(catalog);
  const roleFilter = input.roleFilter ?? 'none';
  const optionsForRole = (role: PhaseRole): Record<string, string> => {
    if (roleFilter === 'none') return criteria;
    const out: Record<string, string> = {};
    for (const c of catalog) {
      const a = resolveAffordances(c);
      // Untagged primitives are unknown, never excluded; tagged ones must declare the role.
      if (!a.declared || a.role.length === 0 || a.role.includes(role)) out[c.id] = criteria[c.id];
    }
    return out;
  };
  const roleQuestions = Object.fromEntries(
    PHASE_ROLES.map((role) => [
      `role_${role}`,
      { type: 'choice', instructions: ROLE_INSTRUCTIONS[role] + target, criteria: optionsForRole(role) } satisfies ChoiceQuestion,
    ]),
  ) as Record<`role_${PhaseRole}`, ChoiceQuestion>;
  const roleOptionCounts = Object.fromEntries(
    PHASE_ROLES.map((role) => [role, Object.keys(roleQuestions[`role_${role}`].criteria).length]),
  ) as Record<PhaseRole, number>;

  const skim = await systemOne(
    state,
    {
      best: {
        type: 'choice',
        instructions:
          'Which interactive learning component would best teach this lesson topic to a student at the stated grade? Prefer the most specific tool for the topic over a generic display component.' +
          target,
        criteria,
      } satisfies ChoiceQuestion,
      subject: {
        type: 'choice',
        instructions: 'Which curriculum subject does this lesson topic belong to?',
        criteria: { MATHEMATICS: null, LANGUAGE_ARTS: null, SCIENCE: null, SOCIAL_STUDIES: null },
      } satisfies ChoiceQuestion,
      informational: {
        type: 'noul',
        instructions:
          'Is this topic primarily informational background knowledge (facts to read and remember) rather than a skill the student practices by doing?',
        criteria: {
          true: 'Background knowledge; best taught with readings, timelines, diagrams',
          false: 'A procedural or conceptual skill; best taught by manipulating and answering',
        },
      },
      ...roleQuestions,
    },
    { signal: input.signal },
  );

  const overall = rankChoice(skim.answers.best);
  const roles: RoleWinner[] = PHASE_ROLES.map((role) => {
    const answer = skim.answers[`role_${role}`] as ChoiceAnswer;
    const ranked = rankChoice(answer);
    return {
      role,
      id: answer.choice,
      p: answer.probabilities[answer.choice] ?? 0,
      confidence: answer.confidence,
      runnersUp: ranked.slice(1, 4),
    };
  });

  // Shortlist = top-k overall ∪ each role's winner (dedup, catalog-valid only).
  const shortlistIds: string[] = [];
  for (const r of overall.slice(0, k)) shortlistIds.push(r.id);
  for (const w of roles) if (!shortlistIds.includes(w.id)) shortlistIds.push(w.id);
  const candidates = shortlistIds.map((id) => byId.get(id)).filter((c): c is ComponentDefinition => Boolean(c));

  // ---- Call 2: verify -------------------------------------------------------
  const verifyQuestions: Record<string, Question> = {};
  for (const c of candidates) {
    const modes = c.evalModes ?? [];
    verifyQuestions[`fit__${c.id}`] = {
      type: 'score',
      instructions: `How well does the candidate component with id "${c.id}" (see candidates in state) fit the lesson topic at the stated grade?${target}`,
      criteria: FIT_LEVELS,
    };
    verifyQuestions[`role__${c.id}`] = {
      type: 'choice',
      instructions: `In a lesson on this topic, which phase would the component "${c.id}" best serve?`,
      criteria: {
        introduce: 'Explains vocabulary and the core idea before any practice',
        visualize: 'Lets the student see or manipulate a model of the idea',
        apply: 'Practice problems the student answers',
        assess: 'Checks understanding across the lesson at the end',
      },
    };
    if (modes.length >= 2) {
      const modeCriteria: Record<string, string> = {};
      for (const m of modes) modeCriteria[m.evalMode] = `${m.label}: ${m.description}`;
      verifyQuestions[`mode__${c.id}`] = {
        type: 'choice',
        instructions: `For the component "${c.id}", which single eval mode (the specific skill it drills) best matches the lesson topic and objectives?`,
        criteria: modeCriteria,
      };
    }
  }
  const verify = await systemOne(
    { ...state, candidates: candidates.map(candidateCard) },
    verifyQuestions,
    { signal: input.signal },
  );

  const shortlist: VerifiedCandidate[] = candidates
    .map((c) => {
      const fit = verify.answers[`fit__${c.id}`];
      const role = verify.answers[`role__${c.id}`];
      const mode = verify.answers[`mode__${c.id}`];
      const skimRow = overall.find((r) => r.id === c.id);
      if (fit?.type !== 'score' || role?.type !== 'choice') {
        throw new Error(`TypeSafe verify answer missing or mistyped for ${c.id}`);
      }
      const modeAnswer = mode?.type === 'choice' ? mode : null;
      return {
        id: c.id,
        skimRank: skimRow ? skimRow.rank : null,
        skimP: skimRow?.p ?? 0,
        fit: fit.score,
        fitConfidence: fit.confidence,
        fitLevels: fit.probabilities,
        role: role.choice as PhaseRole,
        roleConfidence: role.confidence,
        mode: modeAnswer?.choice ?? null,
        modeConfidence: modeAnswer?.confidence ?? null,
        modeProbabilities: modeAnswer?.probabilities ?? null,
        modeCandidates: (c.evalModes ?? []).length,
      };
    })
    .sort((a, b) => b.fit - a.fit);

  return {
    topic: input.topic,
    grade: input.grade,
    objectives: input.objectives?.length ? input.objectives : null,
    model: skim.model,
    catalogSize: catalog.length,
    roleFilter,
    focus,
    roleOptionCounts,
    subject: {
      choice: skim.answers.subject.choice,
      confidence: skim.answers.subject.confidence,
      probabilities: skim.answers.subject.probabilities,
    },
    informational: skim.answers.informational.noul,
    overall: overall.slice(0, 30),
    roles,
    shortlist,
    skim: { ms: skim.ms, usage: skim.usage },
    verify: { ms: verify.ms, usage: verify.usage },
  };
}
