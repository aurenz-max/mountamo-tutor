import type { ExhibitData } from '../../types';

/**
 * Student-safe labels for active remediation in a lesson.
 *
 * Only curriculum descriptions stamped beside the private signal are returned.
 * The diagnosis itself is deliberately unreadable through this helper.
 */
export function getRemediationLabels(exhibit: ExhibitData): string[] {
  const labels = new Set<string>();
  for (const item of exhibit.manifest?.layout ?? []) {
    if (typeof item.config?.remediationFocus !== 'string') continue;
    const label = item.config?.remediationLabel;
    if (typeof label === 'string' && label.trim()) labels.add(label.trim());
  }
  return Array.from(labels);
}
