import type { EquationBalancerData } from '../../../primitives/visual-primitives/chemistry/EquationBalancer';
import { askOf, balancerItems, resolveBalancerModes } from '../../../primitives/visual-primitives/chemistry/equationBalancerWorkspace';
import { workspaceOpening, type WorkspaceDomain } from './adapterContract';

/**
 * Reject content a mode cannot be asked on: no title, no readable equation, or a requested mode with no item (simple
 * needs an equation whose count depends on both numbers; guided an equation with no shared element; complex one with a
 * shared element). Every key is solved from the formulas, so nothing else is trusted from the generator.
 */
export function validateEquationBalancerData(value: unknown): EquationBalancerData {
  const d = value as EquationBalancerData;
  if (!d || typeof d.title !== 'string' || !d.title.trim()) throw new Error('Generated equation balancer has invalid lesson content.');
  const items = balancerItems(d);
  if (!items.length) throw new Error('The generated equation balancer has no equation code can read and solve.');
  for (const mode of resolveBalancerModes(d)) {
    if (!items.some(i => i.mode === mode)) throw new Error(`The equation-balancer ${mode} mode has no item to ask on these equations.`);
  }
  return d;
}

/** What the live adapter needs from the equation balancer; the catalog's `teachingWorkspace` declares the rest. */
export const equationBalancerLiveDomain: WorkspaceDomain<EquationBalancerData> = {
  validate: validateEquationBalancerData,
  initialState: d => {
    const items = balancerItems(d);
    return workspaceOpening({ title: d.title, task: askOf(items[0]), total: items.length });
  },
};
