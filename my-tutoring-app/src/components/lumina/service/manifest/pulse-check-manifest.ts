/**
 * Pulse-check manifest — the measurement-shaped exhibit, built in CODE.
 *
 * The daily pulse beat is the measurement half of the evidence economy: a
 * ~4-minute first block whose only job is to produce gate-advancing evidence
 * on already-scheduled subskills (due mastery checks + IRT-confirmed
 * targets). It must NOT look like a lesson — no curator brief, no hook, no
 * "15-20 minutes", no teaching components.
 *
 * So there is nothing for an LLM to plan: the manifest is deterministic —
 * one knowledge-check spanning all objectives. The KC orchestrator already
 * tags each problem with the objective it assesses (per-objective subskill
 * attribution via config.lessonObjectives, stamped by
 * flattenManifestToLayout), which is exactly the evidence routing the pulse
 * beat exists for. Skipping the brief + manifest LLM calls also makes the
 * beat launch fast — measurement should feel instant, not curated.
 */

import type { ExhibitManifest, IntroBriefingData } from '../../types';
// Pure flatten module — NOT gemini-manifest, which imports the server-only
// Gemini client and would break every client bundle that reaches this file.
import { enrichManifestWithLayout } from './flattenManifest';

export interface PulseObjective {
  id: string;
  text: string;
  verb: string;
  icon: string;
  subskillId?: string;
  skillId?: string;
  grade?: string;
}

/** Deterministic manifest: one orchestrated knowledge-check, no narrative. */
export const buildPulseCheckManifest = (
  topic: string,
  gradeLevel: string,
  objectives: PulseObjective[],
): ExhibitManifest => {
  const raw: ExhibitManifest = {
    topic,
    gradeLevel,
    themeColor: '#c026d3', // fuchsia — the pulse identity color
    // NO curatorBrief: flattenManifestToLayout emits no intro card, so the
    // exhibit opens directly on the check.
    objectiveBlocks: [],
    finalAssessment: {
      componentId: 'knowledge-check',
      instanceId: 'pulse-daily-check',
      title: 'Daily Pulse',
      intent:
        'A quick daily measurement beat. One focused, fast problem per ' +
        'objective — produce evidence of what the student can do today. ' +
        'No teaching, no warm-up items: each problem goes straight at its ' +
        'objective at grade level.',
      config: {
        count: objectives.length,
        context:
          'Daily pulse check: short, confidence-building measurement items. ' +
          'Each objective below is a distinct curriculum subskill being ' +
          'checked — keep every problem tightly scoped to its own objective.',
      },
    },
  };
  // Stamps config.lessonObjectives (with subskill/skill IDs) onto the KC —
  // the orchestrator routes each problem's evidence to ITS objective.
  return enrichManifestWithLayout(raw, objectives);
};

/**
 * Minimal typed brief for the build step's exhibit assembly
 * (exhibit.introBriefing / intro.hook). Never rendered as an intro card —
 * the pulse manifest has no curator-brief layout item — but the sidebar
 * objective list and completion summary read from it.
 */
export const buildPulseBrief = (
  topic: string,
  gradeLevel: string,
  objectives: PulseObjective[],
): IntroBriefingData => ({
  primitive: 'intro_briefing',
  topic,
  subject: 'General',
  gradeLevel,
  estimatedTime: '4-6 minutes',
  hook: {
    type: 'question',
    content: 'Quick pulse check — show what you know, then on with the day!',
    visual: '⚡',
  },
  bigIdea: {
    statement: 'A few fast wins to lock in your progress.',
    whyItMatters: 'Every answer sharpens your progress map.',
  },
  objectives: objectives.map(o => ({
    id: o.id,
    text: o.text,
    verb: (['identify', 'explain', 'create', 'analyze', 'compare', 'apply', 'evaluate']
      .includes(o.verb) ? o.verb : 'apply') as IntroBriefingData['objectives'][number]['verb'],
    icon: o.icon || '🎯',
    subskillId: o.subskillId,
    skillId: o.skillId,
    grade: o.grade,
  })),
  prerequisites: {
    shouldKnow: [],
    quickCheck: { question: '', answer: '', hint: '' },
  },
  roadmap: [],
  connections: { buildingFrom: [], leadingTo: [], realWorld: [] },
  mindset: {
    encouragement: 'Quick and honest beats slow and perfect — just show what you know.',
    growthTip: 'Not sure? Give it your best try — that tells us exactly what to practice next.',
  },
});
