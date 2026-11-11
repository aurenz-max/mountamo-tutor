/**
 * agent-canvas's boss on the tap preset: the child operates the canvas and the program's own goal check judges it on
 * Check. This file validates a lesson and plays the harness. The canvas runs in a sandboxed frame the harness (jsdom)
 * cannot run, so a play delivers what the author's own recorded playthrough made the page report (`report`), then
 * presses Check: the right play is the author's proof, the wrong play its wrong attempt.
 */
import { hasText, tapBoss } from '../../../../components/live-activity/boss';
import { agentCanvasCard, type CanvasMiss } from './agentCanvas.card';
import type { AgentCanvasData } from './AgentCanvas';
import { canvasPage, type CanvasChallenge } from './agentCanvasWorkspace';

/** Why a stored canvas cannot run, or null. */
export function canvasItemError(c: CanvasChallenge, page?: string): string | null {
  if (!c || !hasText(c.id)) return 'it has no id';
  if (!hasText(c.ask)) return 'it has no ask';
  if (!/lumina-display/.test(canvasPage(c, page))) return 'it has no canvas page';
  if (!Array.isArray(c.proof) || !c.proof.length) return 'its author never played it to the goal';
  if (!Array.isArray(c.miss) || !c.miss.length) return 'its author never showed a wrong attempt staying unmet';
  return null;
}

/** Reject an agent-canvas lesson the workspace cannot run. */
export function validateAgentCanvasData(value: unknown): AgentCanvasData {
  const d = value as AgentCanvasData;
  if (!d || !hasText(d.title) || !Array.isArray(d.challenges) || d.challenges.length < 1 || d.challenges.length > 6)
    throw new Error('Generated canvas session has invalid lesson content.');
  if (new Set(d.challenges.map(c => c?.id)).size !== d.challenges.length) throw new Error('Canvas items need distinct ids.');
  for (const c of d.challenges) {
    const error = canvasItemError(c, d.page);
    if (error) throw new Error(`Canvas item ${c?.id}: ${error}.`);
  }
  return d;
}

export const agentCanvasBoss = tapBoss<AgentCanvasData, CanvasChallenge, CanvasMiss>({
  card: agentCanvasCard,
  validate: validateAgentCanvasData,
  items: d => d.challenges,
  choice: {
    ask: c => c.ask,
    play: (right, item) => [
      { type: 'report', goal: right, scene: right ? item.proofScene ?? item.scene : item.missScene ?? item.scene },
      { type: 'choose', label: 'Check' },
    ],
  },
  drive: {
    component: 'primitives/visual-primitives/core/agent-canvas/AgentCanvas.tsx',
    instanceId: 'agent-canvas',
    defaults: { grade: 'Grade 3', mode: 'canvas', topic: 'Area of rectangles' },
    mounted: '[data-pip-object="workspace"]',
  },
});
