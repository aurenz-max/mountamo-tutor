/**
 * evidence-finder's boss (`components/live-activity/boss.ts`), bespoke because each step is a set of highlights or
 * ratings the activity checks whole: the card is `evidenceFinder.card.ts`; this file validates a lesson, lists its
 * items (find, and rate on a CER passage), asks one, carries the lever set and plays the harness.
 */
import type { EvidenceFinderData } from './EvidenceFinder';
import type { DriverInput } from '../../../components/live-activity/liveJourneySpec';
import { bossAssignment, defineBoss } from '../../../components/live-activity/boss';
import { evidenceFinderCard, type EvidenceFinderMiss } from './evidenceFinder.card';
import { EVIDENCE_LEVERS, practiceItem } from './evidenceFinderLevers';
import {
  STRENGTHS, STRENGTH_LABELS, askFor, claimOf, evidenceFinderItems, practicePhase, rateList, type EvidenceFinderItem,
} from './evidenceFinderWorkspace';

const text = (s: unknown) => typeof s === 'string' && !!s.trim();

/**
 * Reject a passage whose steps cannot be answered: two or more sentences with unique ids, one to four claims, at
 * least one evidence sentence and one that is not (with every sentence evidence, "highlight everything" passes), each
 * evidence sentence's claim index naming a claim (required with two or more claims), and, when the strength rating is
 * asked (`cerEnabled`), a strength on every evidence sentence.
 */
export function validateEvidenceFinderData(value: unknown): EvidenceFinderData {
  const d = value as EvidenceFinderData;
  const sentences = d?.passage?.sentences;
  if (!d || !text(d.title) || !Array.isArray(sentences) || sentences.length < 2
      || sentences.some(s => !s || !text(s.id) || !text(s.text) || typeof s.isEvidence !== 'boolean')
      || new Set(sentences.map(s => s.id)).size !== sentences.length
      || !Array.isArray(d.claims) || !d.claims.length || d.claims.length > 4 || d.claims.some(c => !c || !text(c.text)))
    throw new Error('Generated evidence finder has invalid lesson content.');
  const evidence = sentences.filter(s => s.isEvidence);
  if (!evidence.length || evidence.length === sentences.length)
    throw new Error('An evidence-finder passage needs evidence and sentences that are not evidence.');
  if (evidence.some(s => (d.claims.length > 1 || s.claimIndex !== undefined)
      && !(Number.isInteger(s.claimIndex) && s.claimIndex! >= 0 && s.claimIndex! < d.claims.length)))
    throw new Error('An evidence-finder evidence sentence names no claim of the passage.');
  if (d.cerEnabled && evidence.some(s => !(STRENGTHS as readonly string[]).includes(String(s.evidenceStrength))))
    throw new Error('An evidence-finder passage asks for strength ratings but an evidence sentence has none.');
  return d;
}

const touch = (id: string): DriverInput => ({ type: 'touch', target: `sentence-${id}` });

export const evidenceFinderBoss = defineBoss<EvidenceFinderData, EvidenceFinderItem, EvidenceFinderMiss>({
  card: evidenceFinderCard,
  validate: validateEvidenceFinderData,
  items: evidenceFinderItems,
  ask: askFor,
  // Highlights and ratings the activity checks: no key reaches the tutor.
  assignment: item => bossAssignment(item.id, askFor(item), null),
  levers: EVIDENCE_LEVERS,
  stepOf: item => item.kind,
  drive: {
    component: 'primitives/visual-primitives/literacy/EvidenceFinder.tsx',
    instanceId: 'evidence',
    defaults: { grade: 'Grade 4', mode: 'locate_evidence', topic: 'How bees help plants grow' },
    mounted: '[data-pip-object="workspace"]',
    // The session item, or the practice passage a simplify lever opened (`<step>~simpler`), rebuilt from the session's.
    current: ctx => {
      const id = String(ctx.itemId ?? ''), step = practicePhase(id);
      const parent = evidenceFinderItems(ctx.data as EvidenceFinderData).find(i => i.id === (step ?? id));
      return parent && step ? practiceItem(parent) ?? undefined : parent;
    },
    // Each step through its real controls. find: (with two claims, tap the claim) tap every evidence sentence under
    // its claim, then Check; a wrong one puts every evidence sentence under the first claim (`wrong_claim`) when the
    // second has evidence, else adds a sentence that is not evidence (`not_evidence`). rate: tap each sentence's
    // strength, then Check; a wrong one rates every sentence Strong (or Weak when all are strong).
    play: (right, item) => {
      const d = item.data;
      const evidence = d.passage.sentences.filter(s => s.isEvidence);
      if (item.kind === 'find') {
        const claimFor = (s: (typeof evidence)[number]) => (!right && d.claims.length > 1 ? 0 : claimOf(d, s));
        const spread = d.claims.length > 1 && evidence.some(s => claimOf(d, s) > 0);
        const extra = !right && !spread ? d.passage.sentences.filter(s => !s.isEvidence).slice(0, 1) : [];
        return [...d.claims.flatMap((c, i): DriverInput[] => {
          const here = evidence.filter(s => claimFor(s) === i).map(s => touch(s.id));
          const more = i === 0 ? extra.map(s => touch(s.id)) : [];
          if (!here.length && !more.length) return [];
          return [...(d.claims.length > 1 ? [{ type: 'choose', label: c.text } as DriverInput] : []), ...here, ...more];
        }), { type: 'check' }];
      }
      const list = rateList(d);
      const all = list.every(s => (s.evidenceStrength ?? 'strong') === 'strong') ? 'weak' : 'strong';
      return [...list.map((s): DriverInput => ({ type: 'choose',
        label: `${STRENGTH_LABELS[right ? s.evidenceStrength ?? 'strong' : all]}: ${s.text.trim()}` })), { type: 'check' }];
    },
    // The replay's word check. find's key is which printed sentences are evidence; reading the passage aloud
    // (allowed) reads it, so find's replies are read by hand. rate's key words (Strong, Moderate, Weak) are the
    // printed choices on every sentence, so its replies are read by hand too.
    replayKeys: () => [],
  },
});
