/**
 * Which catalog modes a manifest's eval-mode pin names, and whether a teaching-workspace
 * family can run them. Catalog-only on purpose: primitives import this through
 * `withTeachingWorkspace`, so it must not pull in the adapter registry.
 *
 * The lesson plan, the prepared-plan projection and the component switch all decide with
 * this, so a section the plan binds is the section the component mounts on the workspace.
 */
import { getComponentById } from '../../service/manifest/catalog';

/** The one mode an ungraded teaching surface mounts with: it has no eval modes, so its content is unpinned. */
export const UNGRADED_MODE = 'mixed';

/** `mixed` is every catalog mode, `a|b` a blend, anything else one mode. Null when the pin is
 *  empty or names a mode the catalog does not have. */
export function pinnedModes(primitiveId: string, pin: string | undefined): string[] | null {
  if (!pin) return null;
  const catalog = (getComponentById(primitiveId)?.evalModes ?? []).map(mode => mode.evalMode);
  const keys = pin === 'mixed' ? catalog : pin.split('|');
  return keys.length && keys.every(key => catalog.includes(key)) ? keys : null;
}

/** A pin runs on the teaching workspace when every mode it names is one the family binds. A blend
 *  or `mixed` section records its evaluation exactly as the scripted drill did: the evaluation
 *  boundary accepts only a single-mode pin (`evalModeKey.ts`). */
export function pinBindsWorkspace(primitiveId: string, workspaceModes: readonly string[], pin: string | undefined): boolean {
  // An ungraded teaching surface has no eval modes to pin: it binds unpinned (`mixed`) content only.
  if (getComponentById(primitiveId)?.teachingWorkspace?.ungraded) return !pin || pin === UNGRADED_MODE;
  const modes = pinnedModes(primitiveId, pin);
  return !!modes && modes.every(mode => workspaceModes.includes(mode));
}

/** The catalog declares a teaching workspace and the pin names only its modes: the rule every host
 *  and every component switch applies, read from the one declaration. */
export function catalogBindsWorkspace(primitiveId: string, pin: string | undefined): boolean {
  const entry = getComponentById(primitiveId);
  return !!entry?.teachingWorkspace && pinBindsWorkspace(primitiveId,
    entry.teachingWorkspace.ungraded ? [UNGRADED_MODE] : (entry.evalModes ?? []).map(m => m.evalMode), pin);
}
