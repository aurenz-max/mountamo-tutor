/**
 * atom-builder's pure workspace pieces: the check, the scene and the harness's learner. The boss
 * (`atomBuilder.boss.ts`), the component and the tests read the same scene, check and misses. Every item is a build on
 * the particle tray, checked by code: the classic types against the item's target counts, `make_atom` against its
 * code-owned ask (`judgeAtomBuild`). No count the instruction does not state reaches the tutor.
 */
import type { SceneOf } from '../../../components/live-activity/bossLevers';
import type { AtomBuilderChallenge } from './AtomBuilder';
import { ELEMENTS, judgeAtomBuild, passingBuilds, type AtomAsk, type BuiltAtom } from './atomBuild';
import type { AtomMiss, ClassicAtomMiss } from './atomBuilder.card';

export { ATOM_MISSES_BY_MODE, CLASSIC_ATOM_MISSES, MAKE_ATOM_MISSES, type AtomMiss, type ClassicAtomMiss } from './atomBuilder.card';

/** What the component reads off the board for the check, the description and the scene. */
export interface AtomView extends BuiltAtom {
  /** make_atom isotope pairs: the first atom, kept beside the board. */
  kept: BuiltAtom | null;
  /** The identity card is on screen, so naming the learner's element tells the tutor nothing the learner cannot see. */
  identityCard: boolean;
}

/** The item's own ask: make_atom with an ask is the open build; anything else is a classic target check. */
export const openAskOf = (c: Pick<AtomBuilderChallenge, 'type' | 'ask'> | null): AtomAsk | null =>
  c?.type === 'make_atom' ? c.ask ?? null : null;

/** Every classic count that is off, in check order. A null target accepts any count. */
export function classicMisses(c: AtomBuilderChallenge, atom: BuiltAtom): ClassicAtomMiss[] {
  const out: ClassicAtomMiss[] = [];
  if (c.targetProtons !== null && atom.protons !== c.targetProtons) out.push('protons_off');
  if (c.targetNeutrons !== null && atom.neutrons !== c.targetNeutrons) out.push('neutrons_off');
  if (c.targetElectrons !== null && atom.electrons !== c.targetElectrons) out.push('electrons_off');
  return out;
}

/** The check's miss, or undefined when the build passes. */
export function atomMiss(c: AtomBuilderChallenge | null, view: AtomView): AtomMiss | undefined {
  if (!c) return undefined;
  const ask = openAskOf(c);
  if (ask) return judgeAtomBuild(ask, view, view.kept).miss ?? undefined;
  return classicMisses(c, view)[0];
}

/** The words a wrong classic check shows: which particle count is off, never by how much or what it should be. */
export const CLASSIC_MISS_WORDS: Record<ClassicAtomMiss, string> = {
  protons_off: 'The number of protons is not right for this atom.',
  neutrons_off: 'The number of neutrons is not right for this atom.',
  electrons_off: 'The number of electrons is not right for this atom.',
};

const plural = (n: number, one: string) => `${n} ${one}${n === 1 ? '' : 's'}`;
const counts = (a: BuiltAtom) => `${plural(a.protons, 'proton')}, ${plural(a.neutrons, 'neutron')}, ${plural(a.electrons, 'electron')}`;

/** The learner's atom in words: what is on the board, never what it should be. */
export function describeAtom(view: AtomView): string {
  if (view.protons + view.neutrons + view.electrons === 0 && !view.kept) return 'No particles on the board yet';
  const name = view.identityCard && view.protons > 0 ? ELEMENTS[view.protons]?.name : undefined;
  const now = `Built ${counts(view)}${name ? ` (the card reads ${name})` : ''}`;
  return view.kept ? `Kept an atom of ${counts(view.kept)}; ${now.charAt(0).toLowerCase()}${now.slice(1)}` : now;
}

const BOARD = 'a particle tray of protons, neutrons and electrons; the atom is drawn as the learner adds them';

/** What is drawn and asked. The item's target counts and the ask's passing atoms are never published. */
export function workspaceScene(c: AtomBuilderChallenge, view: AtomView): SceneOf {
  const ask = openAskOf(c);
  const facts: Record<string, string | number> = {
    kind: ask ? `make_atom (${ask.kind})` : c.type,
    board: ask ? `${BOARD}; the board starts empty` : BOARD,
    // The board is what the item asks about, so its counts are the learner's own work.
    protons: view.protons, neutrons: view.neutrons, electrons: view.electrons,
  };
  if (view.identityCard && view.protons > 0 && ELEMENTS[view.protons]) facts.identityCard = ELEMENTS[view.protons].name;
  if (view.kept) facts.keptAtom = counts(view.kept);
  facts.learnerWork = describeAtom(view);
  // The check reads only the three counts: an item that asks what element an atom is checks the build, not a name.
  if (!ask) facts.checks = c.type === 'identify' || c.type === 'find_on_table'
    ? 'The check reads only the three particle counts on the tray: this item asks what element the atom is, and the learner answers by building it, not by naming it.'
    : 'The check reads only the three particle counts on the tray.';
  return { objects: [], facts } as SceneOf;
}

// ── The journey row's learner (liveJourneySpec.ts) ──────────────────────────

type Input = { type: 'choose'; label: string } | { type: 'check' };

const adds = (a: BuiltAtom): Input[] => ([['proton', a.protons], ['neutron', a.neutrons], ['electron', a.electrons]] as const)
  .flatMap(([kind, n]) => Array.from({ length: n }, (): Input => ({ type: 'choose', label: `Add ${kind}` })));

/** The smallest atom (or isotope pair) that passes an ask on a board of `maxProtons`. */
export function smallestPassing(ask: AtomAsk, maxProtons: number): BuiltAtom | [BuiltAtom, BuiltAtom] | null {
  const all = passingBuilds(ask, maxProtons) as Array<BuiltAtom | [BuiltAtom, BuiltAtom]>;
  const size = (x: BuiltAtom | [BuiltAtom, BuiltAtom]) => (Array.isArray(x) ? [x[0], x[1]] : [x])
    .reduce((s, a) => s + a.protons * 100 + a.neutrons + a.electrons, 0);
  return all.length ? all.reduce((best, x) => (size(x) < size(best) ? x : best)) : null;
}

/** The classic target with null counts read as the protons' (neutral, as many neutrons as protons). */
export function classicTarget(c: AtomBuilderChallenge): BuiltAtom {
  const p = c.targetProtons ?? 1;
  return { protons: p, neutrons: c.targetNeutrons ?? p, electrons: c.targetElectrons ?? p };
}

/** A complete wrong build for a classic item: one count off by one, the electrons when the item checks them. */
export function classicWrong(c: AtomBuilderChallenge): BuiltAtom {
  const t = classicTarget(c);
  if (c.targetElectrons !== null) return { ...t, electrons: t.electrons + 1 };
  if (c.targetNeutrons !== null) return { ...t, neutrons: t.neutrons + 1 };
  return { ...t, protons: t.protons + 1 };
}

/**
 * The journey's inputs for one item, through the real tray. Classic: clear a kept board, add the target counts
 * (wrong: one electron more, `electrons_off`), press Check Answer. make_atom: start over on a kept board, build the
 * smallest atom the ask's menu proves passes (wrong: the same atom with one electron more, or an isotope pair kept and
 * pressed unchanged, `same_neutrons`), press "I'm done!". `maxProtons` is the board's limit.
 */
export function atomHarnessInputs(c: AtomBuilderChallenge, wrong: boolean, maxProtons: number, demand?: Record<string, unknown> | null): Input[] {
  const onBoard = Number(demand?.protons ?? 0) + Number(demand?.neutrons ?? 0) + Number(demand?.electrons ?? 0) > 0 || !!demand?.keptAtom;
  const ask = openAskOf(c);
  if (!ask) {
    const atom = wrong ? classicWrong(c) : classicTarget(c);
    return [...(onBoard ? [{ type: 'choose', label: 'Clear Atom' } as Input] : []), ...adds(atom), { type: 'check' }];
  }
  const done: Input = { type: 'choose', label: "I'm done!" };
  const clear: Input[] = onBoard ? [{ type: 'choose', label: 'Start over' }] : [];
  const pass = smallestPassing(ask, maxProtons);
  if (!pass) throw new Error(`atom-builder make_atom: no atom passes "${c.instruction}" on ${maxProtons} protons`);
  if (Array.isArray(pass)) {
    const [first, second] = pass;
    const keep: Input = { type: 'choose', label: 'Keep this atom' };
    if (wrong) return [...clear, ...adds(first), keep, done];
    const change: Input[] = second.neutrons > first.neutrons
      ? Array.from({ length: second.neutrons - first.neutrons }, () => ({ type: 'choose', label: 'Add neutron' }))
      : Array.from({ length: first.neutrons - second.neutrons }, () => ({ type: 'choose', label: 'Remove neutron' }));
    return [...clear, ...adds(first), keep, ...change, done];
  }
  const atom = wrong ? { ...pass, electrons: pass.electrons + 1 } : pass;
  if (wrong && judgeAtomBuild(ask, atom).pass) throw new Error(`atom-builder make_atom: the wrong build passes "${c.instruction}"`);
  return [...clear, ...adds(atom), done];
}
