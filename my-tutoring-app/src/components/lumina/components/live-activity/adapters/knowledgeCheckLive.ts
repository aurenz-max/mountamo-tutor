import type { ProblemData } from '../../../types';
import { knowledgeCheckAssignment, knowledgeCheckItems } from '../../../primitives/knowledgeCheckWorkspace';
import { workspaceOpening, type WorkspaceDomain } from './adapterContract';

type KnowledgeCheckPayload = { problems: ProblemData[]; title?: string };

/** Reject an empty set. Every problem yields an item (a problem the spoken kinds cannot ask is worked on screen),
 *  because completion is counted per problem. */
export function validateKnowledgeCheckData(value: unknown): KnowledgeCheckPayload {
  const d = value as KnowledgeCheckPayload;
  if (!d || !Array.isArray(d.problems) || !d.problems.length) throw new Error('Generated knowledge check has no problems.');
  if (!knowledgeCheckItems(d).judgedViable) throw new Error('This knowledge check has no items.');
  return d;
}

/** What the live adapter needs from the lesson; the catalog's `teachingWorkspace` declares the rest. */
export const knowledgeCheckLiveDomain: WorkspaceDomain<KnowledgeCheckPayload> = {
  validate: validateKnowledgeCheckData,
  initialState: data => {
    const { items } = knowledgeCheckItems(data);
    return workspaceOpening({ title: data.title || 'Knowledge Check', task: knowledgeCheckAssignment(items[0]).task, total: items.length });
  },
};
