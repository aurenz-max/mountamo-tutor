import { NextResponse } from 'next/server';
import { validTallies } from '@/components/lumina/service/componentMastery/contract';
import { COMPONENT_KINDS, componentKind, expandTallies } from '@/components/lumina/service/componentMastery/registry';

/**
 * Component mastery (`service/componentMastery/contract.ts`). No model call.
 * POST: what a primitive observed, in its kind's unit -> evidence rows on component ids, for the submit path.
 * GET ?kind=: the kind's components in display order, for the grid.
 */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (!validTallies(body?.tallies)) return NextResponse.json({ error: 'Invalid tallies' }, { status: 400 });
  return NextResponse.json({ evidence: expandTallies(body.tallies) });
}

export async function GET(request: Request) {
  const kind = new URL(request.url).searchParams.get('kind');
  if (!kind) return NextResponse.json({ kinds: COMPONENT_KINDS.map(k => ({ kind: k.kind, title: k.title })) });
  const found = componentKind(kind);
  if (!found) return NextResponse.json({ error: 'Unknown kind' }, { status: 404 });
  return NextResponse.json({ kind: found.kind, title: found.title, components: found.components() });
}
