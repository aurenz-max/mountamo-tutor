import type { OrderedComponent } from '../types';

/**
 * A lesson section is done when its primitive has submitted an evaluation
 * result. A knowledge-check never submits under its own id: each inner problem
 * reports under a derived `${instanceId}::pN` id, so it is done only when
 * EVERY inner problem has reported.
 */
export function isSectionDone(
  section: Pick<OrderedComponent, 'instanceId' | 'componentId' | 'data'>,
  submittedIds: ReadonlySet<string>,
): boolean {
  if (submittedIds.has(section.instanceId)) return true;
  if (section.componentId !== 'knowledge-check') return false;
  const problems = (section.data as { problems?: unknown[] } | undefined)?.problems;
  const expected = Array.isArray(problems) && problems.length > 0 ? problems.length : 1;
  const prefix = `${section.instanceId}::`;
  let reported = 0;
  submittedIds.forEach((id) => {
    if (id.startsWith(prefix)) reported += 1;
  });
  return reported >= expected;
}
