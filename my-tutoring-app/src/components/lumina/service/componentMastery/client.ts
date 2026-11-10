/**
 * The submit paths' call to `/api/lumina/component-evidence` (`contract.ts`): a session's tallies in, evidence rows
 * out. Client-safe. Best-effort: with no tallies, a slow route or an error, the submission goes without them.
 */
import type { ComponentEvidence, ComponentTally } from './contract';

export async function componentEvidenceFor(tallies: ComponentTally[] | undefined): Promise<ComponentEvidence[]> {
  if (!tallies?.length) return [];
  const abort = new AbortController(), timer = setTimeout(() => abort.abort(), 4000);
  try {
    const response = await fetch('/api/lumina/component-evidence', { method: 'POST', signal: abort.signal,
      headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tallies }) });
    const body = response.ok ? await response.json() : null;
    return Array.isArray(body?.evidence) ? body.evidence : [];
  } catch {
    return [];
  } finally { clearTimeout(timer); }
}
