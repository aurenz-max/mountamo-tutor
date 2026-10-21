/**
 * atom-builder's card: how each mode is wired to the live tutor, in the shape every card shares
 * (`components/live-activity/boss.ts`). The catalog reads it; the behavior is `atomBuilder.boss.ts`.
 * Every item is a build on the particle tray, checked by the activity, one at a time: a classic item against its target
 * counts (build, identify, ion_isotope), make_atom against its code-owned ask. The generator does not pin the classic
 * modes, so any classic session can hold any classic item type; the scene's `kind` names the item's type.
 */
import type { AtomBuildMiss } from './atomBuild';
import { defineCard } from '../../../components/live-activity/boss';

export type AtomMode = 'build' | 'identify' | 'make_atom' | 'ion_isotope';

/**
 * What a wrong classic check shows, first that applies: the protons are not the target's (`protons_off`), then the
 * neutrons (`neutrons_off`), then the electrons (`electrons_off`). make_atom's misses are `AtomBuildMiss`.
 */
export type ClassicAtomMiss = 'protons_off' | 'neutrons_off' | 'electrons_off';
export type AtomMiss = ClassicAtomMiss | AtomBuildMiss;
export const CLASSIC_ATOM_MISSES: readonly ClassicAtomMiss[] = ['protons_off', 'neutrons_off', 'electrons_off'];
export const MAKE_ATOM_MISSES: readonly AtomBuildMiss[] = ['no_protons', 'nucleus_off', 'not_neutral', 'shell_not_full',
  'valence_off', 'still_neutral', 'charge_sign', 'charge_size', 'need_two', 'different_element', 'same_neutrons'];

export const ATOM_MISSES_BY_MODE: Record<AtomMode, readonly AtomMiss[]> = {
  build: CLASSIC_ATOM_MISSES,
  identify: CLASSIC_ATOM_MISSES,
  ion_isotope: CLASSIC_ATOM_MISSES,
  make_atom: MAKE_ATOM_MISSES,
};

const TRAY = 'presses + and - beside proton, neutron and electron on the particle tray';
const CLASSIC = { answer: 'build', judge: 'activity', flow: 'one-at-a-time',
  moves: `${TRAY}, then presses Check Answer (Clear Atom empties the tray)` } as const;

export const atomBuilderCard = defineCard<AtomMiss>({
  id: 'atom-builder',
  grades: ['Grade 3', 'Grade 4', 'Grade 5', 'Grade 6', 'Grade 7', 'Grade 8'],
  // Every item publishes levers (`atomBuilderLevers.ts`).
  modes: {
    build: { ...CLASSIC, misses: ATOM_MISSES_BY_MODE.build },
    identify: { ...CLASSIC, misses: ATOM_MISSES_BY_MODE.identify },
    ion_isotope: { ...CLASSIC, misses: ATOM_MISSES_BY_MODE.ion_isotope },
    // need_two: its words say to press Keep this atom, and that button is on the board.
    make_atom: { answer: 'build', judge: 'activity', flow: 'one-at-a-time',
      moves: `${TRAY}, then presses I'm done! (for two isotopes: builds one atom, presses Keep this atom, changes it, then `
        + 'presses I\'m done!; Start over empties the board)',
      misses: ATOM_MISSES_BY_MODE.make_atom, unanswered: ['need_two'] },
  },
  words: {
    job: 'build atoms from protons, neutrons and electrons: a named element, an ion or an isotope, or any atom that has '
      + 'the property asked (many atoms pass)',
    answer: 'the atom they built',
    question: 'the instruction and the particle tray',
  },
  levers: true,
});
