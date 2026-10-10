import type { EvidenceFinderData } from '../../../primitives/visual-primitives/literacy/EvidenceFinder';
import { evidenceFinderItems, workspaceAssignment } from '../../../primitives/visual-primitives/literacy/evidenceFinderWorkspace';
import { workspaceOpening, type WorkspaceDomain } from './adapterContract';

const text = (s: unknown) => typeof s === 'string' && !!s.trim();
const STRENGTHS = ['strong', 'moderate', 'weak'];

/**
 * Reject a passage whose phases cannot be answered: two or more sentences with unique ids, one to four claims, at
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
  if (d.cerEnabled && evidence.some(s => !STRENGTHS.includes(String(s.evidenceStrength))))
    throw new Error('An evidence-finder passage asks for strength ratings but an evidence sentence has none.');
  return d;
}

/** What the live adapter needs from the evidence finder; the catalog's `teachingWorkspace` declares the rest. */
export const evidenceFinderLiveDomain: WorkspaceDomain<EvidenceFinderData> = {
  validate: validateEvidenceFinderData,
  initialState: d => {
    const items = evidenceFinderItems(d);
    return workspaceOpening({ title: d.title, task: workspaceAssignment(items[0], d).task, total: items.length });
  },
};
